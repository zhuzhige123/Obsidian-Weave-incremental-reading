<script lang="ts">
  import { onMount } from 'svelte';
  import { Notice } from 'obsidian';
  import type WeavePlugin from '../../main';
  import { IRDeckDataManagementService } from '../../services/incremental-reading/IRDeckDataManagementService';
  import {
    getSharedIRLegacyPointUnificationService,
    type IRLegacyPointFormatScanResult,
  } from '../../services/incremental-reading/IRLegacyPointUnificationService';
  import {
    getSharedIRPointSourcePathNormalizationService,
    type IRPointSourcePathScanResult,
  } from '../../services/incremental-reading/IRPointSourcePathNormalizationService';
  import { recomputeAndBroadcastIRData } from '../../services/incremental-reading/IRScheduleRefreshService';
  import type {
    IRBackupOrphanEntry,
    IRDataManagementScanResult,
    IRDuplicateTopicGroup,
    IRMergePointIdConflict,
    IRPointFileFormatReport,
    IRPointFileMergeResult,
    IRPointFileMovePlanItem,
    IRPointFilePairDiff,
    IRVaultPointFileEntry
  } from '../../types/ir-data-management-types';
  import { IR_POINT_STORAGE_VERSION } from '../../types/ir-point-storage-types';
  import { showObsidianConfirm } from '../../utils/obsidian-confirm';
  import { formatIRDataManagementPathLabel } from '../../utils/ir-data-management-path';
  import { logger } from '../../utils/logger';
  import { obsidianTooltipAction } from '../../utils/obsidian-tooltip-action';
  import { tr } from '../../utils/i18n';
  import TabNavigation from '../ui/TabNavigation.svelte';
  import ObsidianIcon from '../ui/ObsidianIcon.svelte';
  import type { TabDefinition } from '../../types/view-card-modal-types';
  import type { IRLegacyStorageMigrationSummary } from '../../services/incremental-reading/IRLegacyStorageMigrationFacade';

  interface Props {
    plugin: WeavePlugin;
  }

  let { plugin }: Props = $props();
  let t = $derived($tr);

  type TabId = 'vault' | 'format' | 'duplicates' | 'backups';

  let activeTab = $state<TabId>('vault');
  let isLoading = $state(true);
  let isBusy = $state(false);
  let scanResult = $state<IRDataManagementScanResult | null>(null);
  let targetDir = $state('');
  let targetDirTouched = $state(false);
  let movePlan = $state<IRPointFileMovePlanItem[]>([]);

  let selectedDuplicateGroup = $state<IRDuplicateTopicGroup | null>(null);
  let diffLeftPath = $state('');
  let diffRightPath = $state('');
  let pairDiff = $state<IRPointFilePairDiff | null>(null);
  let keeperPath = $state('');
  /** 同阅读点 id 多文件内容不一致时，先进入此状态再让用户选版本后合并 */
  let mergePointIdConflicts = $state<IRMergePointIdConflict[] | null>(null);
  let mergeConflictChoices = $state<Record<string, string>>({});
  let legacySummary = $state<IRLegacyStorageMigrationSummary | null>(null);
  let pointFormatScan = $state<IRLegacyPointFormatScanResult | null>(null);
  let pointFormatScanLoading = $state(false);
  let invalidSourcePathScan = $state<IRPointSourcePathScanResult | null>(null);
  let invalidSourcePathScanLoading = $state(false);
  let helpOpen = $state(false);
  let helpControlEl = $state<HTMLDivElement | undefined>(undefined);

  const service = new IRDeckDataManagementService(plugin.app);

  let dataMgmtTabs = $derived.by((): TabDefinition[] => {
    const vaultCount = scanResult?.vaultFiles.length ?? 0;
    const formatCount =
      (scanResult?.needsMigrationFiles.length ?? 0) +
      (scanResult?.emptyPointFiles.length ?? 0) +
      (pointFormatScan?.legacyBlockCount ?? 0) +
      (invalidSourcePathScan?.invalidPointCount ?? 0);
    const duplicateCount = scanResult?.duplicateGroups.length ?? 0;
    const backupCount = scanResult?.backupOrphans.length ?? 0;
    const countSuffix = (count: number) =>
      scanResult ? t('irDataMgmt.tabs.countSuffix', { count }) : '';

    return [
      { id: 'vault', label: `${t('irDataMgmt.tabs.vault')}${countSuffix(vaultCount)}`, icon: '' },
      { id: 'format', label: `${t('irDataMgmt.tabs.format')}${countSuffix(formatCount)}`, icon: '' },
      { id: 'duplicates', label: `${t('irDataMgmt.tabs.duplicates')}${countSuffix(duplicateCount)}`, icon: '' },
      { id: 'backups', label: `${t('irDataMgmt.tabs.backups')}${countSuffix(backupCount)}`, icon: '' },
    ];
  });

  function handleTabChange(tabId: string): void {
    activeTab = tabId as TabId;
    helpOpen = false;
  }

  function toggleTabHelp(event: MouseEvent): void {
    event.stopPropagation();
    helpOpen = !helpOpen;
  }

  async function handleRescanClick(): Promise<void> {
    helpOpen = false;
    await refreshScan();
    await refreshLegacySummary();
    await refreshPointFormatScan();
    await refreshInvalidSourcePathScan();
  }

  $effect(() => {
    if (!helpOpen) {
      return;
    }

    const onDocumentClick = (event: MouseEvent): void => {
      const target = event.target;
      if (!(target instanceof Node) || !helpControlEl?.contains(target)) {
        helpOpen = false;
      }
    };

    document.addEventListener('click', onDocumentClick, true);
    return () => document.removeEventListener('click', onDocumentClick, true);
  });

  async function refreshScan(): Promise<void> {
    isLoading = true;
    const previousKeeperPath = keeperPath;
    try {
      scanResult = await service.scan();
      if (!targetDirTouched) {
        targetDir = scanResult.canonicalPointsDir;
      }
      movePlan = service.buildNormalizeMovePlan(scanResult.vaultFiles, targetDir);
      if (
        selectedDuplicateGroup &&
        !scanResult.duplicateGroups.some((group) => group.topicId === selectedDuplicateGroup?.topicId)
      ) {
        selectedDuplicateGroup = scanResult.duplicateGroups[0] || null;
      } else if (!selectedDuplicateGroup) {
        selectedDuplicateGroup = scanResult.duplicateGroups[0] || null;
      }
      resetDiffState(previousKeeperPath);
    } catch (error) {
      logger.error('[IRDataManagementModal] scan failed', error);
      new Notice(t('irDataMgmt.notices.scanFailed'));
    } finally {
      isLoading = false;
    }
  }

  function resetDiffState(preserveKeeperPath = ''): void {
    diffLeftPath = '';
    diffRightPath = '';
    pairDiff = null;
    keeperPath = '';
    mergePointIdConflicts = null;
    mergeConflictChoices = {};
    if (selectedDuplicateGroup?.files.length) {
      const filePaths = selectedDuplicateGroup.files.map((file) => file.absolutePath);
      const nextKeeper =
        preserveKeeperPath && filePaths.includes(preserveKeeperPath)
          ? preserveKeeperPath
          : selectedDuplicateGroup.files[0]?.absolutePath || '';
      keeperPath = nextKeeper;
      diffLeftPath = selectedDuplicateGroup.files[0]?.absolutePath || '';
      diffRightPath = selectedDuplicateGroup.files[1]?.absolutePath || '';
    }
  }

  function cancelMergeConflictUi(): void {
    mergePointIdConflicts = null;
    mergeConflictChoices = {};
  }

  function defaultConflictChoice(conflict: IRMergePointIdConflict): string {
    const fromKeeper = conflict.variants.find((v) => v.filePath === keeperPath);
    return (fromKeeper ?? conflict.variants[0])?.filePath || '';
  }

  function selectDuplicateGroup(group: IRDuplicateTopicGroup): void {
    selectedDuplicateGroup = group;
    resetDiffState();
  }

  async function runCompare(): Promise<void> {
    if (!diffLeftPath || !diffRightPath || diffLeftPath === diffRightPath) {
      new Notice(t('irDataMgmt.notices.compareNeedTwoFiles'));
      return;
    }
    isBusy = true;
    try {
      pairDiff = await service.comparePointFiles(diffLeftPath, diffRightPath);
    } catch (error) {
      logger.error('[IRDataManagementModal] compare failed', error);
      new Notice(t('irDataMgmt.notices.compareFailed'));
    } finally {
      isBusy = false;
    }
  }

  async function afterDataMutation(): Promise<void> {
    await recomputeAndBroadcastIRData(plugin.app, 'ui_refresh');
    await refreshScan();
    await refreshPointFormatScan();
    await refreshInvalidSourcePathScan();
  }

  async function executeNormalizeMove(): Promise<void> {
    if (movePlan.length === 0) {
      new Notice(t('irDataMgmt.notices.noFilesToMove'));
      return;
    }

    const preview = movePlan
      .slice(0, 8)
      .map((item) => `• ${item.sourcePath}\n  → ${item.targetPath}`)
      .join('\n');
    const more =
      movePlan.length > 8
        ? t('irDataMgmt.confirm.normalizeMoveMore', { more: movePlan.length - 8 })
        : '';

    const confirmed = await showObsidianConfirm(
      plugin.app,
      t('irDataMgmt.confirm.normalizeMoveBody', {
        count: movePlan.length,
        targetDir,
        preview,
        more,
      }),
      {
        title: t('irDataMgmt.confirm.normalizeMoveTitle'),
        confirmText: t('irDataMgmt.confirm.normalizeMoveConfirm'),
        confirmClass: 'mod-warning'
      }
    );
    if (!confirmed) {
      return;
    }

    isBusy = true;
    try {
      const moved = await service.executeMovePlan(movePlan);
      new Notice(t('irDataMgmt.notices.movedFiles', { count: moved }));
      await afterDataMutation();
    } catch (error) {
      logger.error('[IRDataManagementModal] move failed', error);
      new Notice(
        t('irDataMgmt.notices.moveFailed', {
          message: error instanceof Error ? error.message : String(error),
        })
      );
    } finally {
      isBusy = false;
    }
  }

  function setMergeConflictState(conflicts: IRMergePointIdConflict[]): void {
    mergePointIdConflicts = conflicts;
    const next: Record<string, string> = {};
    for (const conflict of conflicts) {
      next[conflict.pointId] = defaultConflictChoice(conflict);
    }
    mergeConflictChoices = next;
  }

  function validateConflictChoices(
    conflicts: IRMergePointIdConflict[],
    choices: Record<string, string>
  ): boolean {
    return conflicts.every((conflict) => {
      const choice = choices[conflict.pointId];
      return Boolean(choice && conflict.variants.some((variant) => variant.filePath === choice));
    });
  }

  function buildMergeSuccessNotice(
    mergeResult: IRPointFileMergeResult,
    hasResolvedConflicts = false
  ): string {
    if (hasResolvedConflicts) {
      return t('irDataMgmt.notices.mergeSuccessWithResolutions', {
        added: mergeResult.addedPointCount,
        skipped: mergeResult.skippedDuplicatePointCount,
        replaced: mergeResult.replacedByResolutionCount,
        removed: mergeResult.removedPaths.length,
      });
    }
    return t('irDataMgmt.notices.mergeSuccess', {
      added: mergeResult.addedPointCount,
      skipped: mergeResult.skippedDuplicatePointCount,
      removed: mergeResult.removedPaths.length,
    });
  }

  async function confirmMergeDuplicates(
    keeper: string,
    toRemove: string[],
    resolvedConflictCount = 0
  ): Promise<boolean> {
    const conflictNote =
      resolvedConflictCount > 0
        ? t('irDataMgmt.confirm.mergeConflictNote', { count: resolvedConflictCount })
        : '';
    return showObsidianConfirm(
      plugin.app,
      t('irDataMgmt.confirm.mergeBody', {
        keeperLabel:
          resolvedConflictCount > 0
            ? t('irDataMgmt.confirm.mergeKeeperFileLabel')
            : t('irDataMgmt.confirm.mergeKeeperLabel'),
        keeper,
        conflictNote,
        removeCount: toRemove.length,
        toRemove: toRemove.join('\n'),
      }),
      {
        title: t('irDataMgmt.confirm.mergeTitle'),
        confirmText: t('irDataMgmt.confirm.mergeConfirm'),
        confirmClass: 'mod-warning'
      }
    );
  }

  async function runMergeDuplicates(
    toRemove: string[],
    options?: { resolutions?: Record<string, string> }
  ): Promise<void> {
    isBusy = true;
    try {
      const mergeResult = await service.mergeDuplicateGroupKeepingFile(keeperPath, toRemove, options);
      if (mergeResult.conflicts?.length) {
        setMergeConflictState(mergeResult.conflicts);
        new Notice(t('irDataMgmt.notices.mergeConflictPickVersion'));
        return;
      }
      new Notice(buildMergeSuccessNotice(mergeResult, Boolean(options?.resolutions)));
      cancelMergeConflictUi();
      await afterDataMutation();
    } catch (error) {
      logger.error('[IRDataManagementModal] delete duplicates failed', error);
      new Notice(t('irDataMgmt.notices.deleteFailed'));
    } finally {
      isBusy = false;
    }
  }

  async function applyKeeperAndRemoveOthers(): Promise<void> {
    if (!selectedDuplicateGroup || !keeperPath) {
      new Notice(t('irDataMgmt.notices.selectKeeperFirst'));
      return;
    }

    const toRemove = selectedDuplicateGroup.files
      .map((file) => file.absolutePath)
      .filter((path) => path !== keeperPath);

    if (toRemove.length === 0) {
      new Notice(t('irDataMgmt.notices.noOtherFilesToDelete'));
      return;
    }

    if (mergePointIdConflicts?.length) {
      if (!validateConflictChoices(mergePointIdConflicts, mergeConflictChoices)) {
        new Notice(t('irDataMgmt.notices.pickConflictVersion'));
        return;
      }
      const confirmed = await confirmMergeDuplicates(
        keeperPath,
        toRemove,
        mergePointIdConflicts.length
      );
      if (!confirmed) {
        return;
      }
      await runMergeDuplicates(toRemove, { resolutions: mergeConflictChoices });
      return;
    }

    isBusy = true;
    try {
      const conflicts = await service.detectMergePointIdConflicts(keeperPath, toRemove);
      if (conflicts.length > 0) {
        setMergeConflictState(conflicts);
        new Notice(
          t('irDataMgmt.notices.conflictsDetected', { count: conflicts.length })
        );
        return;
      }
    } catch (error) {
      logger.error('[IRDataManagementModal] conflict scan failed', error);
      new Notice(t('irDataMgmt.notices.conflictScanFailed'));
      return;
    } finally {
      isBusy = false;
    }

    const confirmed = await confirmMergeDuplicates(keeperPath, toRemove);
    if (!confirmed) {
      return;
    }
    await runMergeDuplicates(toRemove);
  }

  async function recoverOrphan(entry: IRBackupOrphanEntry): Promise<void> {
    const confirmed = await showObsidianConfirm(
      plugin.app,
      t('irDataMgmt.confirm.recoverBody', {
        targetDir: targetDir || scanResult?.canonicalPointsDir || '',
        sourcePath: entry.absolutePath,
      }),
      { title: t('irDataMgmt.confirm.recoverTitle'), confirmText: t('irDataMgmt.confirm.recoverConfirm') }
    );
    if (!confirmed) {
      return;
    }

    isBusy = true;
    try {
      const targetPath = await service.recoverBackupOrphan(
        entry,
        targetDir || scanResult?.canonicalPointsDir
      );
      new Notice(t('irDataMgmt.notices.recoveredTo', { path: targetPath }));
      await afterDataMutation();
    } catch (error) {
      logger.error('[IRDataManagementModal] recover failed', error);
      new Notice(
        t('irDataMgmt.notices.recoverFailed', {
          message: error instanceof Error ? error.message : String(error),
        })
      );
    } finally {
      isBusy = false;
    }
  }

  async function deleteOrphanWithoutRecover(entry: IRBackupOrphanEntry): Promise<void> {
    const confirmed = await showObsidianConfirm(
      plugin.app,
      t('irDataMgmt.confirm.deleteBackupBody', { path: entry.absolutePath }),
      {
        title: t('irDataMgmt.confirm.deleteBackupTitle'),
        confirmText: t('irDataMgmt.confirm.deleteBackupConfirm'),
        confirmClass: 'mod-warning'
      }
    );
    if (!confirmed) {
      return;
    }

    isBusy = true;
    try {
      await service.deleteBackupFile(entry.absolutePath);
      new Notice(t('irDataMgmt.notices.backupDeleted'));
      await refreshScan();
    } catch (error) {
      logger.error('[IRDataManagementModal] delete backup failed', error);
      new Notice(t('irDataMgmt.notices.deleteFailed'));
    } finally {
      isBusy = false;
    }
  }

  function updateMovePlan(): void {
    if (!scanResult) {
      movePlan = [];
      return;
    }
    movePlan = service.buildNormalizeMovePlan(scanResult.vaultFiles, targetDir);
  }

  function handleTargetDirInput(): void {
    targetDirTouched = true;
    updateMovePlan();
  }

  function fileLabel(file: IRVaultPointFileEntry): string {
    return t('irDataMgmt.fileLabel', { name: file.topicName, count: file.pointCount });
  }

  async function migrateSingleFile(report: IRPointFileFormatReport): Promise<void> {
    const confirmed = await showObsidianConfirm(
      plugin.app,
      t('irDataMgmt.confirm.migrateFileBody', {
        version: IR_POINT_STORAGE_VERSION,
        path: report.absolutePath,
        issues: report.issues.map((issue) => `• ${issue.message}`).join('\n'),
      }),
      { title: t('irDataMgmt.confirm.migrateFileTitle'), confirmText: t('irDataMgmt.confirm.migrateFileConfirm') }
    );
    if (!confirmed) {
      return;
    }

    isBusy = true;
    try {
      await service.migratePointFileToCurrentSchema(report.absolutePath);
      new Notice(t('irDataMgmt.notices.migratedFile'));
      await afterDataMutation();
    } catch (error) {
      logger.error('[IRDataManagementModal] migrate file failed', error);
      new Notice(t('irDataMgmt.notices.migrateFailed'));
    } finally {
      isBusy = false;
    }
  }

  async function migrateAllNeedingFiles(): Promise<void> {
    const targets = scanResult?.needsMigrationFiles || [];
    if (targets.length === 0) {
      new Notice(t('irDataMgmt.notices.noFilesToMigrate'));
      return;
    }

    const confirmed = await showObsidianConfirm(
      plugin.app,
      t('irDataMgmt.confirm.migrateBatchBody', { count: targets.length }),
      { title: t('irDataMgmt.confirm.migrateBatchTitle'), confirmText: t('irDataMgmt.confirm.migrateBatchConfirm'), confirmClass: 'mod-warning' }
    );
    if (!confirmed) {
      return;
    }

    isBusy = true;
    try {
      const migrated = await service.migrateAllPointFiles(targets);
      new Notice(t('irDataMgmt.notices.migratedBatch', { count: migrated }));
      await afterDataMutation();
    } catch (error) {
      logger.error('[IRDataManagementModal] batch migrate failed', error);
      new Notice(t('irDataMgmt.notices.batchMigrateFailed'));
    } finally {
      isBusy = false;
    }
  }

  async function promptDeleteEmptyFile(file: IRVaultPointFileEntry): Promise<void> {
    const confirmed = await showObsidianConfirm(
      plugin.app,
      t('irDataMgmt.confirm.deleteEmptyBody', { path: file.absolutePath }),
      {
        title: t('irDataMgmt.confirm.deleteEmptyTitle'),
        confirmText: t('irDataMgmt.confirm.deleteEmptyConfirm'),
        confirmClass: 'mod-warning'
      }
    );
    if (!confirmed) {
      return;
    }

    isBusy = true;
    try {
      await service.deleteVaultPointFile(file.absolutePath);
      new Notice(t('irDataMgmt.notices.emptyFileDeleted'));
      await afterDataMutation();
    } catch (error) {
      logger.error('[IRDataManagementModal] delete empty file failed', error);
      new Notice(t('irDataMgmt.notices.deleteFailed'));
    } finally {
      isBusy = false;
    }
  }

  async function refreshLegacySummary(): Promise<void> {
    try {
      legacySummary = await plugin.inspectLegacyStorageMigration();
    } catch (error) {
      logger.error('[IRDataManagementModal] legacy inspect failed', error);
      legacySummary = null;
    }
  }

  async function refreshPointFormatScan(): Promise<void> {
    pointFormatScanLoading = true;
    try {
      pointFormatScan = await getSharedIRLegacyPointUnificationService(plugin.app).scanPointFormats();
    } catch (error) {
      logger.error('[IRDataManagementModal] point format scan failed', error);
      pointFormatScan = null;
      new Notice(t('irDataMgmt.notices.pointFormatScanFailed'));
    } finally {
      pointFormatScanLoading = false;
    }
  }

  async function refreshInvalidSourcePathScan(): Promise<void> {
    invalidSourcePathScanLoading = true;
    try {
      invalidSourcePathScan = await getSharedIRPointSourcePathNormalizationService(
        plugin.app
      ).scanInvalidSourcePaths();
    } catch (error) {
      logger.error('[IRDataManagementModal] invalid source path scan failed', error);
      invalidSourcePathScan = null;
      new Notice(t('irDataMgmt.notices.invalidSourcePathScanFailed'));
    } finally {
      invalidSourcePathScanLoading = false;
    }
  }

  async function runInvalidSourcePathNormalization(): Promise<void> {
    const pointCount = invalidSourcePathScan?.invalidPointCount ?? 0;
    const fileCount = invalidSourcePathScan?.affectedFileCount ?? 0;
    if (pointCount <= 0) {
      new Notice(t('irDataMgmt.notices.noInvalidSourcePaths'));
      return;
    }

    const confirmed = await showObsidianConfirm(
      plugin.app,
      t('irDataMgmt.confirm.invalidSourcePathNormalizeBody', { pointCount, fileCount }),
      {
        title: t('irDataMgmt.confirm.invalidSourcePathNormalizeTitle'),
        confirmText: t('irDataMgmt.confirm.invalidSourcePathNormalizeConfirm'),
        confirmClass: 'mod-warning',
      }
    );
    if (!confirmed) {
      return;
    }

    isBusy = true;
    try {
      const result = await getSharedIRPointSourcePathNormalizationService(
        plugin.app
      ).normalizeAllStoredSourcePaths();
      new Notice(
        t('irDataMgmt.notices.invalidSourcePathNormalizeDone', {
          pointsRepaired: result.pointsRepaired,
          pathsCleared: result.pathsCleared,
          filesUpdated: result.filesUpdated,
        })
      );
      if (result.errors.length > 0) {
        logger.warn('[IRDataManagementModal] invalid source path normalization errors', result.errors);
      }
      await afterDataMutation();
      await refreshInvalidSourcePathScan();
      await refreshScan();
    } catch (error) {
      logger.error('[IRDataManagementModal] invalid source path normalization failed', error);
      new Notice(t('irDataMgmt.notices.invalidSourcePathNormalizeFailed'));
    } finally {
      isBusy = false;
    }
  }

  async function runPointFormatUnification(): Promise<void> {
    const legacyCount = pointFormatScan?.legacyBlockCount ?? 0;
    if (legacyCount <= 0) {
      new Notice(t('irDataMgmt.notices.noLegacyPointsToUnify'));
      return;
    }

    const confirmed = await showObsidianConfirm(
      plugin.app,
      t('irDataMgmt.confirm.pointFormatUnifyBody', { count: legacyCount }),
      {
        title: t('irDataMgmt.confirm.pointFormatUnifyTitle'),
        confirmText: t('irDataMgmt.confirm.pointFormatUnifyConfirm'),
        confirmClass: 'mod-warning',
      }
    );
    if (!confirmed) {
      return;
    }

    isBusy = true;
    try {
      const result = await getSharedIRLegacyPointUnificationService(plugin.app).migrateLegacyBlockPointsToChunkFormat();
      new Notice(
        t('irDataMgmt.notices.pointFormatUnifyDone', {
          migrated: result.migrated,
          skipped: result.skipped,
          failed: result.failed,
        })
      );
      if (result.errors.length > 0) {
        logger.warn('[IRDataManagementModal] point format unification errors', result.errors);
      }
      await afterDataMutation();
      await refreshPointFormatScan();
    } catch (error) {
      logger.error('[IRDataManagementModal] point format unification failed', error);
      new Notice(t('irDataMgmt.notices.pointFormatUnifyFailed'));
    } finally {
      isBusy = false;
    }
  }

  async function runLegacyStorageMigration(): Promise<void> {
    const confirmed = await showObsidianConfirm(
      plugin.app,
      t('irDataMgmt.confirm.legacyMigrationBody'),
      { title: t('irDataMgmt.confirm.legacyMigrationTitle'), confirmText: t('irDataMgmt.confirm.legacyMigrationConfirm'), confirmClass: 'mod-warning' }
    );
    if (!confirmed) {
      return;
    }

    isBusy = true;
    try {
      const report = await plugin.executeLegacyStorageMigration();
      new Notice(
        t('irDataMgmt.notices.legacyMigrationDone', {
          success: report.success,
          failed: report.failed,
        })
      );
      await refreshLegacySummary();
      await refreshScan();
    } catch (error) {
      logger.error('[IRDataManagementModal] legacy migration failed', error);
      new Notice(t('irDataMgmt.notices.legacyMigrationFailed'));
    } finally {
      isBusy = false;
    }
  }

  onMount(() => {
    void refreshScan();
    void refreshLegacySummary();
    void refreshPointFormatScan();
    void refreshInvalidSourcePathScan();
  });
</script>

<div class="ir-data-mgmt">
  <div class="ir-data-mgmt__header">
    <div class="ir-data-mgmt__tabs">
      <TabNavigation
        tabs={dataMgmtTabs}
        activeTab={activeTab}
        onTabChange={handleTabChange}
        variant="plain"
      />
    </div>

    <div class="ir-data-mgmt__header-actions">
      <div class="ir-data-mgmt__help-control" bind:this={helpControlEl}>
        <button
          type="button"
          class="clickable-icon ir-data-mgmt__icon-btn"
          class:is-active={helpOpen}
          aria-label={t('irDataMgmt.help.ariaLabel')}
          aria-expanded={helpOpen}
          onclick={toggleTabHelp}
        >
          <ObsidianIcon name="help-circle" size={16} />
        </button>

        {#if helpOpen}
          <div class="ir-data-mgmt__help-popover" role="dialog" aria-label={t('irDataMgmt.help.dialogLabel')}>
            {#if activeTab === 'vault'}
              <p>
                {t('irDataMgmt.help.vault', {
                  canonicalDir: scanResult
                    ? scanResult.canonicalPointsDir
                    : t('irDataMgmt.help.vaultCanonicalPending'),
                })}
              </p>
            {:else if activeTab === 'format'}
              <p>{t('irDataMgmt.help.format')}</p>
            {:else if activeTab === 'duplicates'}
              <p>{t('irDataMgmt.help.duplicates')}</p>
            {:else}
              <p>{t('irDataMgmt.help.backups')}</p>
            {/if}
          </div>
        {/if}
      </div>

      <button
        type="button"
        class="clickable-icon ir-data-mgmt__icon-btn"
        class:is-loading={isLoading}
        disabled={isLoading || isBusy}
        aria-label={t('irDataMgmt.rescan.ariaLabel')}
        use:obsidianTooltipAction={isLoading ? t('irDataMgmt.rescan.loading') : t('irDataMgmt.rescan.tooltip')}
        onclick={() => void handleRescanClick()}
      >
        <ObsidianIcon name="refresh-cw" size={16} />
      </button>
    </div>
  </div>

  {#if legacySummary && legacySummary.pendingCount > 0}
    <section class="ir-data-mgmt__legacy-banner">
      <div class="ir-data-mgmt__legacy-copy">
        <strong>{t('irDataMgmt.legacy.title')}</strong>
        <p>{t('irDataMgmt.legacy.description', { count: legacySummary.pendingCount })}</p>
      </div>
      <button
        type="button"
        class="mod-warning"
        disabled={isBusy}
        onclick={() => void runLegacyStorageMigration()}
      >
        {t('irDataMgmt.legacy.action')}
      </button>
    </section>
  {/if}

  {#if isLoading}
    <div class="ir-data-mgmt__empty">{t('irDataMgmt.loading')}</div>
  {:else if !scanResult}
    <div class="ir-data-mgmt__empty">{t('irDataMgmt.scanFailedInline')}</div>
  {:else if activeTab === 'format'}
    <section class="ir-data-mgmt__section" role="tabpanel" id="format-panel">
      <div class="ir-data-mgmt__subsection">
        <h4 class="ir-data-mgmt__subsection-title">{t('irDataMgmt.format.pointKindTitle')}</h4>
        {#if pointFormatScanLoading && !pointFormatScan}
          <p class="ir-data-mgmt__empty-inline">{t('irDataMgmt.format.pointKindLoading')}</p>
        {:else if pointFormatScan}
          <p class="ir-data-mgmt__desc">
            {t('irDataMgmt.format.pointKindStats', {
              total: pointFormatScan.totalCount,
              chunk: pointFormatScan.chunkCount,
              legacy: pointFormatScan.legacyBlockCount,
              pdf: pointFormatScan.pdfCount,
              epub: pointFormatScan.epubCount,
              other: pointFormatScan.otherCount,
            })}
          </p>
          {#if pointFormatScan.legacyBlockCount > 0}
            <p class="ir-data-mgmt__desc">{t('irDataMgmt.format.pointKindLegacyHint')}</p>
            <div class="ir-data-mgmt__actions">
              <button
                type="button"
                class="mod-cta"
                disabled={isBusy}
                onclick={() => void runPointFormatUnification()}
              >
                {t('irDataMgmt.format.unifyLegacyPoints', { count: pointFormatScan.legacyBlockCount })}
              </button>
            </div>
          {:else}
            <p class="ir-data-mgmt__empty-inline">{t('irDataMgmt.format.pointKindAllUnified')}</p>
          {/if}
        {/if}
      </div>

      <div class="ir-data-mgmt__subsection">
        <h4 class="ir-data-mgmt__subsection-title">
          {t('irDataMgmt.format.invalidSourcePathTitle', {
            count: invalidSourcePathScan?.invalidPointCount ?? 0,
          })}
        </h4>
        {#if invalidSourcePathScanLoading && !invalidSourcePathScan}
          <p class="ir-data-mgmt__empty-inline">{t('irDataMgmt.format.invalidSourcePathLoading')}</p>
        {:else if invalidSourcePathScan}
          {#if invalidSourcePathScan.invalidPointCount > 0}
            <p class="ir-data-mgmt__desc">
              {t('irDataMgmt.format.invalidSourcePathStats', {
                pointCount: invalidSourcePathScan.invalidPointCount,
                fieldCount: invalidSourcePathScan.invalidFieldCount,
                fileCount: invalidSourcePathScan.affectedFileCount,
              })}
            </p>
            <p class="ir-data-mgmt__desc">{t('irDataMgmt.format.invalidSourcePathHint')}</p>
            <div class="ir-data-mgmt__actions">
              <button
                type="button"
                class="mod-cta"
                disabled={isBusy}
                onclick={() => void runInvalidSourcePathNormalization()}
              >
                {t('irDataMgmt.format.normalizeInvalidSourcePaths', {
                  pointCount: invalidSourcePathScan.invalidPointCount,
                })}
              </button>
            </div>
            <div class="ir-data-mgmt__table-wrap">
              <table class="ir-data-mgmt__table">
                <thead>
                  <tr>
                    <th>{t('irDataMgmt.columns.topic')}</th>
                    <th>{t('irDataMgmt.columns.path')}</th>
                    <th>{t('irDataMgmt.columns.points')}</th>
                  </tr>
                </thead>
                <tbody>
                  {#each invalidSourcePathScan.affectedFiles as file (file.absolutePath)}
                    {@const pathInfo = formatIRDataManagementPathLabel(
                      file.absolutePath,
                      scanResult.canonicalPointsDir
                    )}
                    <tr>
                      <td>
                        <div class="ir-data-mgmt__cell-title">{file.topicName || file.topicId}</div>
                        <div class="ir-data-mgmt__cell-sub">{file.topicId}</div>
                      </td>
                      <td><code class="ir-data-mgmt__path" title={pathInfo.full}>{pathInfo.display}</code></td>
                      <td>{file.invalidPointCount}</td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          {:else}
            <p class="ir-data-mgmt__empty-inline">{t('irDataMgmt.format.invalidSourcePathAllClean')}</p>
          {/if}
        {/if}
      </div>

      <div class="ir-data-mgmt__subsection">
        <h4 class="ir-data-mgmt__subsection-title">{t('irDataMgmt.format.needsMigrationTitle', { count: scanResult.needsMigrationFiles.length })}</h4>
        {#if scanResult.needsMigrationFiles.length === 0}
          <p class="ir-data-mgmt__empty-inline">{t('irDataMgmt.format.allCompliant')}</p>
        {:else}
          <div class="ir-data-mgmt__actions">
            <button type="button" class="mod-cta" disabled={isBusy} onclick={() => void migrateAllNeedingFiles()}>
              {t('irDataMgmt.format.batchMigrate', { count: scanResult.needsMigrationFiles.length })}
            </button>
          </div>
          <div class="ir-data-mgmt__table-wrap">
            <table class="ir-data-mgmt__table">
              <thead>
                <tr>
                  <th>{t('irDataMgmt.columns.topic')}</th>
                  <th>{t('irDataMgmt.columns.path')}</th>
                  <th>{t('irDataMgmt.columns.issues')}</th>
                  <th>{t('irDataMgmt.columns.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {#each scanResult.needsMigrationFiles as report (report.absolutePath)}
                  {@const pathInfo = formatIRDataManagementPathLabel(report.absolutePath, scanResult.canonicalPointsDir)}
                  <tr>
                    <td>
                      <div class="ir-data-mgmt__cell-title">{report.topicName || report.topicId}</div>
                      <div class="ir-data-mgmt__cell-sub">{report.topicId}</div>
                    </td>
                    <td><code class="ir-data-mgmt__path" title={pathInfo.full}>{pathInfo.display}</code></td>
                    <td>
                      <ul class="ir-data-mgmt__issue-list">
                        {#each report.issues as issue (issue.code + issue.message)}
                          <li class={`severity-${issue.severity}`}>{issue.message}</li>
                        {/each}
                      </ul>
                    </td>
                    <td>
                      <button type="button" class="clickable-icon mod-muted" disabled={isBusy} onclick={() => void migrateSingleFile(report)}>
                        {t('irDataMgmt.format.migrate')}
                      </button>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}
      </div>

      <div class="ir-data-mgmt__subsection">
        <h4 class="ir-data-mgmt__subsection-title">{t('irDataMgmt.format.emptyTitle', { count: scanResult.emptyPointFiles.length })}</h4>
        {#if scanResult.emptyPointFiles.length === 0}
          <p class="ir-data-mgmt__empty-inline">{t('irDataMgmt.format.noEmpty')}</p>
        {:else}
          <div class="ir-data-mgmt__table-wrap">
            <table class="ir-data-mgmt__table">
              <thead>
                <tr>
                  <th>{t('irDataMgmt.columns.topic')}</th>
                  <th>{t('irDataMgmt.columns.path')}</th>
                  <th>{t('irDataMgmt.columns.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {#each scanResult.emptyPointFiles as file (file.absolutePath)}
                  {@const pathInfo = formatIRDataManagementPathLabel(file.absolutePath, scanResult.canonicalPointsDir)}
                  <tr>
                    <td>
                      <div class="ir-data-mgmt__cell-title">{file.topicName}</div>
                      <div class="ir-data-mgmt__cell-sub">{file.topicId}</div>
                    </td>
                    <td><code class="ir-data-mgmt__path" title={pathInfo.full}>{pathInfo.display}</code></td>
                    <td>
                      <button type="button" class="mod-warning" disabled={isBusy} onclick={() => void promptDeleteEmptyFile(file)}>
                        {t('irDataMgmt.format.deleteEmpty')}
                      </button>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}
      </div>
    </section>
  {:else if activeTab === 'vault'}
    <section class="ir-data-mgmt__section" role="tabpanel" id="vault-panel">
      <div class="ir-data-mgmt__panel">
        <div class="ir-data-mgmt__panel-header">
          <h3 class="ir-data-mgmt__panel-title">{t('irDataMgmt.vault.pathPanelTitle')}</h3>
          <p class="ir-data-mgmt__desc">
            {t('irDataMgmt.vault.pathPanelDesc', { canonicalDir: scanResult.canonicalPointsDir })}
          </p>
        </div>

        <div class="ir-data-mgmt__target-row">
          <label class="ir-data-mgmt__field">
            <span>{t('irDataMgmt.vault.targetDir')}</span>
            <input
              type="text"
              class="ir-data-mgmt__input"
              bind:value={targetDir}
              oninput={handleTargetDirInput}
            />
          </label>
          <button
            type="button"
            class="mod-cta ir-data-mgmt__move-btn"
            disabled={isBusy || movePlan.length === 0}
            onclick={() => void executeNormalizeMove()}
          >
            {t('irDataMgmt.vault.normalizeMove', { count: movePlan.length })}
          </button>
        </div>
      </div>

      <div class="ir-data-mgmt__table-wrap">
        <table class="ir-data-mgmt__table">
          <thead>
            <tr>
              <th>{t('irDataMgmt.columns.topic')}</th>
              <th>{t('irDataMgmt.columns.path')}</th>
              <th>{t('irDataMgmt.columns.points')}</th>
              <th>{t('irDataMgmt.columns.status')}</th>
            </tr>
          </thead>
          <tbody>
            {#each scanResult.vaultFiles as file (file.absolutePath)}
              {@const pathInfo = formatIRDataManagementPathLabel(file.absolutePath, scanResult.canonicalPointsDir)}
              <tr>
                <td>
                  <div class="ir-data-mgmt__cell-title">{file.topicName}</div>
                  <div class="ir-data-mgmt__cell-sub">{file.topicId}</div>
                </td>
                <td><code class="ir-data-mgmt__path" title={pathInfo.full}>{pathInfo.display}</code></td>
                <td>{file.pointCount}</td>
                <td>
                  {#if file.isInCanonicalDir}
                    <span class="ir-data-mgmt__tag is-ok">{t('irDataMgmt.vault.statusInCanonical')}</span>
                  {:else}
                    <span class="ir-data-mgmt__tag is-pending">{t('irDataMgmt.vault.statusPending')}</span>
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </section>
  {:else if activeTab === 'duplicates'}
    <section class="ir-data-mgmt__section ir-data-mgmt__split" role="tabpanel" id="duplicates-panel">
      <aside class="ir-data-mgmt__aside">
        <h4>{t('irDataMgmt.duplicates.groupsTitle')}</h4>
        {#if scanResult.duplicateGroups.length === 0}
          <p class="ir-data-mgmt__empty-inline">{t('irDataMgmt.duplicates.noGroups')}</p>
        {:else}
          <ul class="ir-data-mgmt__group-list">
            {#each scanResult.duplicateGroups as group (group.topicId)}
              <li>
                <button
                  type="button"
                  class="ir-data-mgmt__group-btn"
                  class:is-active={selectedDuplicateGroup?.topicId === group.topicId}
                  onclick={() => selectDuplicateGroup(group)}
                >
                  {group.topicName}
                  <span class="ir-data-mgmt__cell-sub">{t('irDataMgmt.duplicates.fileCount', { count: group.files.length })}</span>
                </button>
              </li>
            {/each}
          </ul>
        {/if}
      </aside>

      <div class="ir-data-mgmt__main">
        {#if !selectedDuplicateGroup}
          <p class="ir-data-mgmt__empty-inline">{t('irDataMgmt.duplicates.selectGroup')}</p>
        {:else}
          <h4>{selectedDuplicateGroup.topicName}</h4>
          <ul class="ir-data-mgmt__file-pick-list">
            {#each selectedDuplicateGroup.files as file (file.absolutePath)}
              <li>
                <label>
                  <input
                    type="radio"
                    name="keeper"
                    value={file.absolutePath}
                    checked={keeperPath === file.absolutePath}
                    onchange={() => {
                      keeperPath = file.absolutePath;
                      cancelMergeConflictUi();
                    }}
                  />
                  <span>{fileLabel(file)}</span>
                  <code class="ir-data-mgmt__path" title={file.absolutePath}>{formatIRDataManagementPathLabel(file.absolutePath, scanResult?.canonicalPointsDir ?? '').display}</code>
                </label>
              </li>
            {/each}
          </ul>

          <div class="ir-data-mgmt__diff-controls">
            <label>
              {t('irDataMgmt.duplicates.compareA')}
              <select bind:value={diffLeftPath}>
                {#each selectedDuplicateGroup.files as file (file.absolutePath)}
                  <option value={file.absolutePath}>{file.absolutePath}</option>
                {/each}
              </select>
            </label>
            <label>
              {t('irDataMgmt.duplicates.compareB')}
              <select bind:value={diffRightPath}>
                {#each selectedDuplicateGroup.files as file (file.absolutePath)}
                  <option value={file.absolutePath}>{file.absolutePath}</option>
                {/each}
              </select>
            </label>
            <button type="button" class="clickable-icon mod-muted" disabled={isBusy} onclick={() => void runCompare()}>
              {t('irDataMgmt.duplicates.analyzeDiff')}
            </button>
          </div>

          {#if pairDiff}
            <div class="ir-data-mgmt__diff-panel">
              <p>
                {t('irDataMgmt.duplicates.diffSummary', {
                  countA: pairDiff.pointCountA,
                  countB: pairDiff.pointCountB,
                  shared: pairDiff.sharedPointIds.length,
                })}
              </p>
              <div class="ir-data-mgmt__diff-cols">
                <div>
                  <h5>{t('irDataMgmt.duplicates.onlyInA', { count: pairDiff.onlyInA.length })}</h5>
                  <ul>
                    {#each pairDiff.onlyInA.slice(0, 30) as id}
                      <li><code>{id}</code></li>
                    {/each}
                    {#if pairDiff.onlyInA.length > 30}
                      <li>{t('irDataMgmt.duplicates.moreIds', { count: pairDiff.onlyInA.length - 30 })}</li>
                    {/if}
                  </ul>
                </div>
                <div>
                  <h5>{t('irDataMgmt.duplicates.onlyInB', { count: pairDiff.onlyInB.length })}</h5>
                  <ul>
                    {#each pairDiff.onlyInB.slice(0, 30) as id}
                      <li><code>{id}</code></li>
                    {/each}
                    {#if pairDiff.onlyInB.length > 30}
                      <li>{t('irDataMgmt.duplicates.moreIds', { count: pairDiff.onlyInB.length - 30 })}</li>
                    {/if}
                  </ul>
                </div>
              </div>
            </div>
          {/if}

          {#if mergePointIdConflicts?.length}
            <div class="ir-data-mgmt__conflict-panel">
              <h5>{t('irDataMgmt.duplicates.conflictTitle')}</h5>
              <p class="ir-data-mgmt__cell-sub">
                {t('irDataMgmt.duplicates.conflictHint')}
              </p>
              <ul class="ir-data-mgmt__conflict-list">
                {#each mergePointIdConflicts as conflict (conflict.pointId)}
                  <li>
                    <div class="ir-data-mgmt__conflict-id">
                      <code>{conflict.pointId}</code>
                      <span class="ir-data-mgmt__cell-sub">{conflict.variants[0]?.title || ''}</span>
                    </div>
                    <ul class="ir-data-mgmt__variant-list">
                      {#each conflict.variants as variant (variant.filePath)}
                        <li>
                          <label>
                            <input
                              type="radio"
                              name={`merge-${conflict.pointId}`}
                              value={variant.filePath}
                              checked={mergeConflictChoices[conflict.pointId] === variant.filePath}
                              onchange={() => {
                                mergeConflictChoices = {
                                  ...mergeConflictChoices,
                                  [conflict.pointId]: variant.filePath
                                };
                              }}
                            />
                            <code>{variant.filePath}</code>
                          </label>
                        </li>
                      {/each}
                    </ul>
                  </li>
                {/each}
              </ul>
              <button type="button" class="clickable-icon mod-muted" disabled={isBusy} onclick={() => cancelMergeConflictUi()}>
                {t('irDataMgmt.duplicates.cancelConflict')}
              </button>
            </div>
          {/if}

          <button
            type="button"
            class="mod-warning"
            disabled={isBusy || !keeperPath}
            onclick={() => void applyKeeperAndRemoveOthers()}
          >
            {mergePointIdConflicts?.length
              ? t('irDataMgmt.duplicates.mergeWithChoices')
              : t('irDataMgmt.duplicates.mergeAndDelete')}
          </button>
        {/if}
      </div>
    </section>
  {:else}
    <section class="ir-data-mgmt__section" role="tabpanel" id="backups-panel">
      {#if scanResult.backupOrphans.length === 0}
        <p class="ir-data-mgmt__empty-inline">{t('irDataMgmt.backups.empty')}</p>
      {:else}
        <div class="ir-data-mgmt__table-wrap">
          <table class="ir-data-mgmt__table">
            <thead>
              <tr>
                <th>{t('irDataMgmt.columns.topic')}</th>
                <th>{t('irDataMgmt.columns.backupPath')}</th>
                <th>{t('irDataMgmt.columns.points')}</th>
                <th>{t('irDataMgmt.columns.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {#each scanResult.backupOrphans as entry (entry.absolutePath)}
                <tr>
                  <td>
                    <div class="ir-data-mgmt__cell-title">{entry.topicName}</div>
                    <div class="ir-data-mgmt__cell-sub">{entry.topicId}</div>
                  </td>
                  <td><code class="ir-data-mgmt__path" title={entry.absolutePath}>{entry.relativePath}</code></td>
                  <td>{entry.pointCount}</td>
                  <td class="ir-data-mgmt__row-actions">
                    <button type="button" class="mod-cta" disabled={isBusy} onclick={() => void recoverOrphan(entry)}>
                      {t('irDataMgmt.backups.recover')}
                    </button>
                    <button
                      type="button"
                      class="mod-warning"
                      disabled={isBusy}
                      onclick={() => void deleteOrphanWithoutRecover(entry)}
                    >
                      {t('irDataMgmt.backups.deleteWithoutRecover')}
                    </button>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </section>
  {/if}
</div>

<style>
  .ir-data-mgmt {
    display: flex;
    flex-direction: column;
    gap: var(--size-4-3);
    min-height: 420px;
  }

  .ir-data-mgmt__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--size-4-3);
    min-width: 0;
  }

  .ir-data-mgmt__tabs {
    flex: 1 1 auto;
    min-width: 0;
    overflow-x: auto;
    scrollbar-width: none;
  }

  .ir-data-mgmt__tabs::-webkit-scrollbar {
    display: none;
  }

  .ir-data-mgmt__header-actions {
    display: inline-flex;
    align-items: center;
    gap: var(--size-4-1);
    flex: 0 0 auto;
  }

  .ir-data-mgmt__help-control {
    position: relative;
    display: inline-flex;
  }

  .ir-data-mgmt__icon-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: var(--size-4-8);
    height: var(--size-4-8);
    min-width: var(--size-4-8);
    padding: 0;
    border: none;
    box-shadow: none;
    border-radius: var(--clickable-icon-radius, var(--radius-s));
    color: var(--text-muted);
    background: transparent;
    cursor: pointer;
    transition: background-color 0.15s ease, color 0.15s ease;
  }

  .ir-data-mgmt__icon-btn:hover:not(:disabled) {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }

  .ir-data-mgmt__icon-btn.is-active {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }

  .ir-data-mgmt__icon-btn.is-loading :global(.obsidian-icon) {
    animation: ir-data-mgmt-spin 0.85s linear infinite;
  }

  @keyframes ir-data-mgmt-spin {
    from {
      transform: rotate(0deg);
    }

    to {
      transform: rotate(360deg);
    }
  }

  .ir-data-mgmt__help-popover {
    position: absolute;
    top: calc(100% + var(--size-4-1));
    right: 0;
    z-index: calc(var(--layer-popover, 1000) + 2);
    width: min(360px, 78vw);
    padding: var(--size-4-3);
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--radius-l);
    background: color-mix(in oklab, var(--background-primary) 92%, var(--background-secondary));
    box-shadow: var(--shadow-s);
  }

  .ir-data-mgmt__help-popover p {
    margin: 0;
    color: var(--text-muted);
    font-size: var(--font-ui-small);
    line-height: 1.55;
  }

  .ir-data-mgmt__help-popover code {
    font-size: var(--font-ui-smaller);
  }

  .ir-data-mgmt__legacy-banner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 14px;
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--radius-m);
    background: var(--background-secondary);
  }

  .ir-data-mgmt__legacy-copy {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }

  .ir-data-mgmt__legacy-copy p {
    margin: 0;
    color: var(--text-muted);
    font-size: var(--font-ui-small);
    line-height: 1.5;
  }

  .ir-data-mgmt__section {
    display: flex;
    flex-direction: column;
    gap: var(--size-4-3);
    overflow: auto;
    flex: 1;
    min-height: 0;
  }

  .ir-data-mgmt__panel {
    display: flex;
    flex-direction: column;
    gap: var(--size-4-3);
    padding: var(--size-4-4);
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--radius-l);
    background: color-mix(in oklab, var(--background-primary), var(--background-secondary) 26%);
  }

  .ir-data-mgmt__panel-header {
    display: flex;
    flex-direction: column;
    gap: var(--size-4-1);
  }

  .ir-data-mgmt__panel-title,
  .ir-data-mgmt__subsection-title {
    margin: 0;
    font-size: var(--font-ui-medium);
    font-weight: 600;
    color: var(--text-normal);
    line-height: 1.4;
  }

  .ir-data-mgmt__target-row {
    display: flex;
    align-items: flex-end;
    gap: var(--size-4-3);
    min-width: 0;
  }

  .ir-data-mgmt__target-row .ir-data-mgmt__field {
    flex: 1 1 auto;
    min-width: 0;
  }

  .ir-data-mgmt__move-btn {
    flex: 0 0 auto;
    white-space: nowrap;
  }

  @media (max-width: 640px) {
    .ir-data-mgmt__target-row {
      flex-direction: column;
      align-items: stretch;
    }

    .ir-data-mgmt__move-btn {
      width: 100%;
    }
  }

  .ir-data-mgmt__desc {
    color: var(--text-muted);
    font-size: var(--font-ui-small);
    margin: 0;
    line-height: 1.5;
  }

  .ir-data-mgmt__field {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: var(--font-ui-small);
  }

  .ir-data-mgmt__input {
    width: 100%;
  }

  .ir-data-mgmt__actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .ir-data-mgmt__table-wrap {
    overflow: auto;
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--radius-m);
  }

  .ir-data-mgmt__table {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--font-ui-small);
  }

  .ir-data-mgmt__table th,
  .ir-data-mgmt__table td {
    text-align: left;
    vertical-align: top;
    padding: 8px 10px;
    border-bottom: 1px solid var(--background-modifier-border);
  }

  .ir-data-mgmt__cell-title {
    font-weight: 600;
  }

  .ir-data-mgmt__cell-sub {
    color: var(--text-muted);
    font-size: var(--font-ui-smaller);
  }

  .ir-data-mgmt__path {
    display: block;
    max-width: min(320px, 36vw);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: var(--font-ui-smaller);
  }

  .ir-data-mgmt__tag {
    display: inline-block;
    padding: 2px 6px;
    border-radius: var(--radius-s);
    font-size: var(--font-ui-smaller);
    font-weight: 500;
  }

  .ir-data-mgmt__tag.is-ok {
    background: color-mix(in oklab, var(--color-green), transparent 84%);
    color: var(--text-success);
  }

  .ir-data-mgmt__tag.is-pending {
    background: color-mix(in oklab, var(--color-yellow), transparent 84%);
    color: var(--text-warning);
  }

  .ir-data-mgmt__empty,
  .ir-data-mgmt__empty-inline {
    color: var(--text-muted);
    padding: 16px 0;
  }

  .ir-data-mgmt__split {
    display: grid;
    grid-template-columns: minmax(180px, 220px) 1fr;
    gap: 16px;
    align-items: start;
  }

  @media (max-width: 720px) {
    .ir-data-mgmt__split {
      grid-template-columns: 1fr;
    }
  }

  .ir-data-mgmt__aside h4,
  .ir-data-mgmt__main h4 {
    margin: 0 0 8px;
  }

  .ir-data-mgmt__group-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .ir-data-mgmt__group-btn {
    width: 100%;
    text-align: left;
    padding: 8px;
    border-radius: var(--radius-s);
    background: var(--background-modifier-hover);
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .ir-data-mgmt__group-btn.is-active {
    outline: 2px solid var(--interactive-accent);
  }

  .ir-data-mgmt__file-pick-list {
    list-style: none;
    margin: 0 0 12px;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .ir-data-mgmt__file-pick-list label {
    display: flex;
    flex-direction: column;
    gap: 4px;
    cursor: pointer;
  }

  .ir-data-mgmt__diff-controls {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    align-items: flex-end;
    margin-bottom: 10px;
  }

  .ir-data-mgmt__diff-controls label {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: var(--font-ui-small);
    min-width: 160px;
    flex: 1;
  }

  .ir-data-mgmt__diff-controls select {
    width: 100%;
  }

  .ir-data-mgmt__diff-panel {
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--radius-m);
    padding: 10px;
    margin-bottom: 12px;
    font-size: var(--font-ui-small);
  }

  .ir-data-mgmt__conflict-panel {
    border: 1px solid var(--text-warning);
    border-radius: var(--radius-m);
    padding: 10px;
    margin-bottom: 12px;
    font-size: var(--font-ui-small);
  }

  .ir-data-mgmt__conflict-panel h5 {
    margin: 0 0 6px;
    font-size: var(--font-ui-medium);
  }

  .ir-data-mgmt__conflict-list {
    margin: 8px 0;
    padding-left: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 12px;
    max-height: 220px;
    overflow: auto;
  }

  .ir-data-mgmt__conflict-id {
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin-bottom: 6px;
  }

  .ir-data-mgmt__variant-list {
    margin: 0;
    padding-left: 16px;
    list-style: disc;
  }

  .ir-data-mgmt__variant-list label {
    display: flex;
    align-items: flex-start;
    gap: 6px;
    cursor: pointer;
  }

  .ir-data-mgmt__variant-list code {
    word-break: break-all;
    font-size: var(--font-ui-smaller);
  }

  .ir-data-mgmt__diff-cols {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  .ir-data-mgmt__diff-cols ul {
    margin: 4px 0 0;
    padding-left: 16px;
    max-height: 160px;
    overflow: auto;
  }

  .ir-data-mgmt__row-actions {
    display: flex;
    flex-direction: column;
    gap: 6px;
    white-space: nowrap;
  }

  .ir-data-mgmt__subsection {
    display: flex;
    flex-direction: column;
    gap: var(--size-4-2);
  }

  .ir-data-mgmt__subsection h4:not(.ir-data-mgmt__subsection-title) {
    margin: var(--size-4-2) 0 0;
    font-size: var(--font-ui-medium);
  }

  .ir-data-mgmt__issue-list {
    margin: 0;
    padding-left: 16px;
    max-width: 280px;
  }

  .ir-data-mgmt__issue-list .severity-error {
    color: var(--text-error);
  }

  .ir-data-mgmt__issue-list .severity-warning {
    color: var(--text-warning);
  }

  .ir-data-mgmt__issue-list .severity-info {
    color: var(--text-muted);
  }
</style>
