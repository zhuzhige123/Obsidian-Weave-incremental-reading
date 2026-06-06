<script lang="ts">
  import { onMount } from 'svelte';
  import { Notice } from 'obsidian';
  import type WeavePlugin from '../../main';
  import { IRDeckDataManagementService } from '../../services/incremental-reading/IRDeckDataManagementService';
  import { recomputeAndBroadcastIRData } from '../../services/incremental-reading/IRScheduleRefreshService';
  import type {
    IRBackupOrphanEntry,
    IRDataManagementScanResult,
    IRDuplicateTopicGroup,
    IRMergePointIdConflict,
    IRPointFileFormatReport,
    IRPointFileMovePlanItem,
    IRPointFilePairDiff,
    IRVaultPointFileEntry
  } from '../../types/ir-data-management-types';
  import { showObsidianConfirm } from '../../utils/obsidian-confirm';
  import { logger } from '../../utils/logger';
  import type { IRLegacyStorageMigrationSummary } from '../../services/incremental-reading/IRLegacyStorageMigrationFacade';

  interface Props {
    plugin: WeavePlugin;
    onClose?: () => void;
  }

  let { plugin, onClose }: Props = $props();

  type TabId = 'vault' | 'format' | 'duplicates' | 'backups';

  let activeTab = $state<TabId>('vault');
  let isLoading = $state(true);
  let isBusy = $state(false);
  let scanResult = $state<IRDataManagementScanResult | null>(null);
  let targetDir = $state('');
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

  const service = $derived(new IRDeckDataManagementService(plugin.app));

  async function refreshScan(): Promise<void> {
    isLoading = true;
    try {
      scanResult = await service.scan();
      targetDir = scanResult.canonicalPointsDir;
      movePlan = service.buildNormalizeMovePlan(scanResult.vaultFiles, targetDir);
      if (
        selectedDuplicateGroup &&
        !scanResult.duplicateGroups.some((group) => group.topicId === selectedDuplicateGroup?.topicId)
      ) {
        selectedDuplicateGroup = scanResult.duplicateGroups[0] || null;
      } else if (!selectedDuplicateGroup) {
        selectedDuplicateGroup = scanResult.duplicateGroups[0] || null;
      }
      resetDiffState();
    } catch (error) {
      logger.error('[IRDataManagementModal] scan failed', error);
      new Notice('扫描增量阅读数据失败');
    } finally {
      isLoading = false;
    }
  }

  function resetDiffState(): void {
    diffLeftPath = '';
    diffRightPath = '';
    pairDiff = null;
    keeperPath = '';
    mergePointIdConflicts = null;
    mergeConflictChoices = {};
    if (selectedDuplicateGroup?.files.length) {
      keeperPath = selectedDuplicateGroup.files[0]?.absolutePath || '';
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
      new Notice('请选择两个不同的文件进行比较');
      return;
    }
    isBusy = true;
    try {
      pairDiff = await service.comparePointFiles(diffLeftPath, diffRightPath);
    } catch (error) {
      logger.error('[IRDataManagementModal] compare failed', error);
      new Notice('比较失败');
    } finally {
      isBusy = false;
    }
  }

  async function afterDataMutation(): Promise<void> {
    await recomputeAndBroadcastIRData(plugin.app, 'ui_refresh');
    await refreshScan();
  }

  async function executeNormalizeMove(): Promise<void> {
    if (movePlan.length === 0) {
      new Notice('没有需要移动的文件');
      return;
    }

    const preview = movePlan
      .slice(0, 8)
      .map((item) => `• ${item.sourcePath}\n  → ${item.targetPath}`)
      .join('\n');
    const more = movePlan.length > 8 ? `\n… 另有 ${movePlan.length - 8} 个文件` : '';

    const confirmed = await showObsidianConfirm(
      plugin.app,
      `将把 ${movePlan.length} 个专题文件移动到：\n${targetDir}\n\n${preview}${more}`,
      {
        title: '确认规范移动',
        confirmText: '开始移动',
        confirmClass: 'mod-warning'
      }
    );
    if (!confirmed) {
      return;
    }

    isBusy = true;
    try {
      const moved = await service.executeMovePlan(movePlan);
      new Notice(`已移动 ${moved} 个专题文件`);
      await afterDataMutation();
    } catch (error) {
      logger.error('[IRDataManagementModal] move failed', error);
      new Notice(`移动失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      isBusy = false;
    }
  }

  async function applyKeeperAndRemoveOthers(): Promise<void> {
    if (!selectedDuplicateGroup || !keeperPath) {
      new Notice('请先选择要保留的文件');
      return;
    }

    const toRemove = selectedDuplicateGroup.files
      .map((file) => file.absolutePath)
      .filter((path) => path !== keeperPath);

    if (toRemove.length === 0) {
      new Notice('没有其它文件需要删除');
      return;
    }

    if (mergePointIdConflicts?.length) {
      for (const conflict of mergePointIdConflicts) {
        const choice = mergeConflictChoices[conflict.pointId];
        if (!choice || !conflict.variants.some((v) => v.filePath === choice)) {
          new Notice('请为每个冲突阅读点选择要保留的文件版本');
          return;
        }
      }

      const confirmed = await showObsidianConfirm(
        plugin.app,
        `保留文件：\n${keeperPath}\n\n已处理 ${mergePointIdConflicts.length} 个「同阅读点 id、内容不一致」冲突（按你在下方选择的版本写入）。\n\n将把其它 ${toRemove.length} 个副本合并进保留文件后删除：\n${toRemove.join('\n')}\n\n此操作不可撤销。`,
        {
          title: '确认合并并删除其它副本',
          confirmText: '合并后删除',
          confirmClass: 'mod-warning'
        }
      );
      if (!confirmed) {
        return;
      }

      isBusy = true;
      try {
        const mergeResult = await service.mergeDuplicateGroupKeepingFile(keeperPath, toRemove, {
          resolutions: mergeConflictChoices
        });
        if (mergeResult.conflicts?.length) {
          mergePointIdConflicts = mergeResult.conflicts;
          new Notice('合并未完成：仍有冲突，请重新选择版本');
          return;
        }
        new Notice(
          `已合并 ${mergeResult.addedPointCount} 个阅读点，跳过相同内容 ${mergeResult.skippedDuplicatePointCount} 个，按选择覆盖 ${mergeResult.replacedByResolutionCount} 个，删除 ${mergeResult.removedPaths.length} 个文件`
        );
        cancelMergeConflictUi();
        await afterDataMutation();
      } catch (error) {
        logger.error('[IRDataManagementModal] delete duplicates failed', error);
        new Notice('删除失败');
      } finally {
        isBusy = false;
      }
      return;
    }

    isBusy = true;
    try {
      const conflicts = await service.detectMergePointIdConflicts(keeperPath, toRemove);
      if (conflicts.length > 0) {
        mergePointIdConflicts = conflicts;
        const next: Record<string, string> = {};
        for (const conflict of conflicts) {
          next[conflict.pointId] = defaultConflictChoice(conflict);
        }
        mergeConflictChoices = next;
        new Notice(
          `检测到 ${conflicts.length} 个阅读点在不同文件中内容不一致。请在下方为每个点选择保留版本，然后再次点击合并按钮。`
        );
        return;
      }
    } catch (error) {
      logger.error('[IRDataManagementModal] conflict scan failed', error);
      new Notice('检测合并冲突失败');
      return;
    } finally {
      isBusy = false;
    }

    const confirmed = await showObsidianConfirm(
      plugin.app,
      `保留：\n${keeperPath}\n\n将把其它 ${toRemove.length} 个文件中的阅读点（按 id 去重）合并进保留文件，然后删除这些副本：\n${toRemove.join('\n')}\n\n此操作不可撤销。`,
      {
        title: '确认合并并删除其它副本',
        confirmText: '合并后删除',
        confirmClass: 'mod-warning'
      }
    );
    if (!confirmed) {
      return;
    }

    isBusy = true;
    try {
      const mergeResult = await service.mergeDuplicateGroupKeepingFile(keeperPath, toRemove);
      if (mergeResult.conflicts?.length) {
        mergePointIdConflicts = mergeResult.conflicts;
        const next: Record<string, string> = {};
        for (const conflict of mergeResult.conflicts) {
          next[conflict.pointId] = defaultConflictChoice(conflict);
        }
        mergeConflictChoices = next;
        new Notice('检测到内容冲突，请在下方选择保留版本后再合并');
        return;
      }
      new Notice(
        `已合并 ${mergeResult.addedPointCount} 个阅读点，跳过重复 ${mergeResult.skippedDuplicatePointCount} 个，删除 ${mergeResult.removedPaths.length} 个文件`
      );
      await afterDataMutation();
    } catch (error) {
      logger.error('[IRDataManagementModal] delete duplicates failed', error);
      new Notice('删除失败');
    } finally {
      isBusy = false;
    }
  }

  async function recoverOrphan(entry: IRBackupOrphanEntry): Promise<void> {
    const confirmed = await showObsidianConfirm(
      plugin.app,
      `将恢复到库内目录：\n${targetDir || scanResult?.canonicalPointsDir}\n\n来源：\n${entry.absolutePath}`,
      { title: '确认恢复专题文件', confirmText: '恢复' }
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
      new Notice(`已恢复到：${targetPath}`);
      await afterDataMutation();
    } catch (error) {
      logger.error('[IRDataManagementModal] recover failed', error);
      new Notice('恢复失败');
    } finally {
      isBusy = false;
    }
  }

  async function deleteOrphanWithoutRecover(entry: IRBackupOrphanEntry): Promise<void> {
    const confirmed = await showObsidianConfirm(
      plugin.app,
      `不恢复并删除备份文件：\n${entry.absolutePath}\n\n此操作不可撤销。`,
      {
        title: '确认删除备份文件',
        confirmText: '删除',
        confirmClass: 'mod-warning'
      }
    );
    if (!confirmed) {
      return;
    }

    isBusy = true;
    try {
      await service.deleteBackupFile(entry.absolutePath);
      new Notice('已删除备份文件');
      await refreshScan();
    } catch (error) {
      logger.error('[IRDataManagementModal] delete backup failed', error);
      new Notice('删除失败');
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

  function fileLabel(file: IRVaultPointFileEntry): string {
    return `${file.topicName}（${file.pointCount} 点）`;
  }

  async function migrateSingleFile(report: IRPointFileFormatReport): Promise<void> {
    const confirmed = await showObsidianConfirm(
      plugin.app,
      `将把以下文件迁移为当前规范结构（schemaVersion=${1}）：\n${report.absolutePath}\n\n${report.issues.map((issue) => `• ${issue.message}`).join('\n')}`,
      { title: '确认迁移专题文件', confirmText: '迁移' }
    );
    if (!confirmed) {
      return;
    }

    isBusy = true;
    try {
      await service.migratePointFileToCurrentSchema(report.absolutePath);
      new Notice('专题文件已迁移为当前规范格式');
      await afterDataMutation();
    } catch (error) {
      logger.error('[IRDataManagementModal] migrate file failed', error);
      new Notice('迁移失败');
    } finally {
      isBusy = false;
    }
  }

  async function migrateAllNeedingFiles(): Promise<void> {
    const targets = scanResult?.needsMigrationFiles || [];
    if (targets.length === 0) {
      new Notice('没有需要迁移的文件');
      return;
    }

    const confirmed = await showObsidianConfirm(
      plugin.app,
      `将迁移 ${targets.length} 个专题文件为当前规范结构。建议先备份库。`,
      { title: '确认批量迁移', confirmText: '开始迁移', confirmClass: 'mod-warning' }
    );
    if (!confirmed) {
      return;
    }

    isBusy = true;
    try {
      const migrated = await service.migrateAllPointFiles(targets);
      new Notice(`已迁移 ${migrated} 个专题文件`);
      await afterDataMutation();
    } catch (error) {
      logger.error('[IRDataManagementModal] batch migrate failed', error);
      new Notice('批量迁移失败');
    } finally {
      isBusy = false;
    }
  }

  async function promptDeleteEmptyFile(file: IRVaultPointFileEntry): Promise<void> {
    const confirmed = await showObsidianConfirm(
      plugin.app,
      `该专题文件没有任何阅读点：\n${file.absolutePath}\n\n是否删除此 .irdeck 文件？`,
      {
        title: '删除空专题文件',
        confirmText: '删除',
        confirmClass: 'mod-warning'
      }
    );
    if (!confirmed) {
      return;
    }

    isBusy = true;
    try {
      await service.deleteVaultPointFile(file.absolutePath);
      new Notice('已删除空专题文件');
      await afterDataMutation();
    } catch (error) {
      logger.error('[IRDataManagementModal] delete empty file failed', error);
      new Notice('删除失败');
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

  async function runLegacyStorageMigration(): Promise<void> {
    const confirmed = await showObsidianConfirm(
      plugin.app,
      '这会把旧 chunks/sources/materials 等 vault 残留迁移到新 IR 存储结构，并清理已迁移的旧文件。建议先备份。',
      { title: '执行旧存储迁移', confirmText: '开始迁移', confirmClass: 'mod-warning' }
    );
    if (!confirmed) {
      return;
    }

    isBusy = true;
    try {
      const report = await plugin.executeLegacyStorageMigration();
      new Notice(`旧存储迁移完成：成功 ${report.success}，失败 ${report.failed}`);
      await refreshLegacySummary();
      await refreshScan();
    } catch (error) {
      logger.error('[IRDataManagementModal] legacy migration failed', error);
      new Notice('旧存储迁移失败');
    } finally {
      isBusy = false;
    }
  }

  onMount(() => {
    void refreshScan();
    void refreshLegacySummary();
  });
</script>

<div class="ir-data-mgmt">
  <nav class="ir-data-mgmt__tabs" aria-label="数据管理分类">
    <button
      type="button"
      class="clickable-icon ir-data-mgmt__tab"
      class:is-active={activeTab === 'vault'}
      onclick={() => { activeTab = 'vault'; }}
    >
      库内专题文件
      {#if scanResult}
        <span class="ir-data-mgmt__badge">{scanResult.vaultFiles.length}</span>
      {/if}
    </button>
    <button
      type="button"
      class="clickable-icon ir-data-mgmt__tab"
      class:is-active={activeTab === 'format'}
      onclick={() => { activeTab = 'format'; }}
    >
      格式与空专题
      {#if scanResult}
        <span class="ir-data-mgmt__badge">{scanResult.needsMigrationFiles.length + scanResult.emptyPointFiles.length}</span>
      {/if}
    </button>
    <button
      type="button"
      class="clickable-icon ir-data-mgmt__tab"
      class:is-active={activeTab === 'duplicates'}
      onclick={() => { activeTab = 'duplicates'; }}
    >
      重复专题
      {#if scanResult}
        <span class="ir-data-mgmt__badge">{scanResult.duplicateGroups.length}</span>
      {/if}
    </button>
    <button
      type="button"
      class="clickable-icon ir-data-mgmt__tab"
      class:is-active={activeTab === 'backups'}
      onclick={() => { activeTab = 'backups'; }}
    >
      备份孤立专题
      {#if scanResult}
        <span class="ir-data-mgmt__badge">{scanResult.backupOrphans.length}</span>
      {/if}
    </button>
  </nav>

  <div class="ir-data-mgmt__toolbar">
    <button type="button" class="clickable-icon mod-muted" disabled={isLoading || isBusy} onclick={() => { void refreshScan(); void refreshLegacySummary(); }}>
      重新扫描
    </button>
    {#if isLoading}
      <span class="ir-data-mgmt__hint">正在扫描…</span>
    {:else if scanResult}
      <span class="ir-data-mgmt__hint">
        规范目录：{scanResult.canonicalPointsDir}
      </span>
    {/if}
  </div>

  {#if legacySummary && legacySummary.pendingCount > 0}
    <section class="ir-data-mgmt__legacy-banner">
      <div class="ir-data-mgmt__legacy-copy">
        <strong>旧 vault 存储迁移</strong>
        <p>检测到 {legacySummary.pendingCount} 项旧增量阅读存储待迁移（Weave 主插件已不再处理此类任务）。</p>
      </div>
      <button
        type="button"
        class="mod-warning"
        disabled={isBusy}
        onclick={() => void runLegacyStorageMigration()}
      >
        执行旧存储迁移
      </button>
    </section>
  {/if}

  {#if isLoading}
    <div class="ir-data-mgmt__empty">正在扫描库内与插件备份中的增量阅读专题文件…</div>
  {:else if !scanResult}
    <div class="ir-data-mgmt__empty">扫描失败，请重试。</div>
  {:else if activeTab === 'format'}
    <section class="ir-data-mgmt__section">
      <p class="ir-data-mgmt__desc">
        检查 <code>.irdeck</code> 是否符合当前数据结构（schemaVersion、deck、tagGroups、points 等）。旧格式可一键迁移；没有任何阅读点的文件可删除。
      </p>

      <div class="ir-data-mgmt__subsection">
        <h4>需规范迁移（{scanResult.needsMigrationFiles.length}）</h4>
        {#if scanResult.needsMigrationFiles.length === 0}
          <p class="ir-data-mgmt__empty-inline">所有可见专题文件均已符合当前结构。</p>
        {:else}
          <div class="ir-data-mgmt__actions">
            <button type="button" class="mod-cta" disabled={isBusy} onclick={() => void migrateAllNeedingFiles()}>
              批量迁移为当前格式（{scanResult.needsMigrationFiles.length}）
            </button>
          </div>
          <div class="ir-data-mgmt__table-wrap">
            <table class="ir-data-mgmt__table">
              <thead>
                <tr>
                  <th>专题</th>
                  <th>路径</th>
                  <th>问题</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {#each scanResult.needsMigrationFiles as report (report.absolutePath)}
                  <tr>
                    <td>
                      <div class="ir-data-mgmt__cell-title">{report.topicName || report.topicId}</div>
                      <div class="ir-data-mgmt__cell-sub">{report.topicId}</div>
                    </td>
                    <td><code>{report.absolutePath}</code></td>
                    <td>
                      <ul class="ir-data-mgmt__issue-list">
                        {#each report.issues as issue (issue.code + issue.message)}
                          <li class={`severity-${issue.severity}`}>{issue.message}</li>
                        {/each}
                      </ul>
                    </td>
                    <td>
                      <button type="button" class="clickable-icon mod-muted" disabled={isBusy} onclick={() => void migrateSingleFile(report)}>
                        迁移
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
        <h4>空专题文件（{scanResult.emptyPointFiles.length}）</h4>
        {#if scanResult.emptyPointFiles.length === 0}
          <p class="ir-data-mgmt__empty-inline">没有阅读点数为 0 的专题文件。</p>
        {:else}
          <div class="ir-data-mgmt__table-wrap">
            <table class="ir-data-mgmt__table">
              <thead>
                <tr>
                  <th>专题</th>
                  <th>路径</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {#each scanResult.emptyPointFiles as file (file.absolutePath)}
                  <tr>
                    <td>
                      <div class="ir-data-mgmt__cell-title">{file.topicName}</div>
                      <div class="ir-data-mgmt__cell-sub">{file.topicId}</div>
                    </td>
                    <td><code>{file.absolutePath}</code></td>
                    <td>
                      <button type="button" class="mod-warning" disabled={isBusy} onclick={() => void promptDeleteEmptyFile(file)}>
                        删除空文件
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
    <section class="ir-data-mgmt__section">
      <p class="ir-data-mgmt__desc">
        列出 Obsidian 文件列表可见的全部 <code>.irdeck</code>。可将散落文件一键移动到下方目标目录；同专题 ID 的多份文件会排在同一目录下（第 2 份起使用 <code>.part2</code> 后缀）。
      </p>

      <label class="ir-data-mgmt__field">
        <span>目标目录</span>
        <input
          type="text"
          class="ir-data-mgmt__input"
          bind:value={targetDir}
          oninput={updateMovePlan}
        />
      </label>

      <div class="ir-data-mgmt__actions">
        <button
          type="button"
          class="mod-cta"
          disabled={isBusy || movePlan.length === 0}
          onclick={() => void executeNormalizeMove()}
        >
          一键规范移动（{movePlan.length}）
        </button>
      </div>

      <div class="ir-data-mgmt__table-wrap">
        <table class="ir-data-mgmt__table">
          <thead>
            <tr>
              <th>专题</th>
              <th>路径</th>
              <th>阅读点</th>
              <th>状态</th>
            </tr>
          </thead>
          <tbody>
            {#each scanResult.vaultFiles as file (file.absolutePath)}
              <tr>
                <td>
                  <div class="ir-data-mgmt__cell-title">{file.topicName}</div>
                  <div class="ir-data-mgmt__cell-sub">{file.topicId}</div>
                </td>
                <td><code>{file.absolutePath}</code></td>
                <td>{file.pointCount}</td>
                <td>
                  {#if file.isInCanonicalDir}
                    <span class="ir-data-mgmt__tag is-ok">已在规范目录</span>
                  {:else}
                    <span class="ir-data-mgmt__tag is-warn">待整理</span>
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </section>
  {:else if activeTab === 'duplicates'}
    <section class="ir-data-mgmt__section ir-data-mgmt__split">
      <p class="ir-data-mgmt__desc">
        同一专题 ID 对应多份库内文件时，请比较差异后选择要保留的一份；其余副本将从库内删除（请先确认阅读点是否已合并到保留文件）。
      </p>

      <aside class="ir-data-mgmt__aside">
        <h4>重复专题组</h4>
        {#if scanResult.duplicateGroups.length === 0}
          <p class="ir-data-mgmt__empty-inline">当前没有同 ID 多文件专题。</p>
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
                  <span class="ir-data-mgmt__cell-sub">{group.files.length} 个文件</span>
                </button>
              </li>
            {/each}
          </ul>
        {/if}
      </aside>

      <div class="ir-data-mgmt__main">
        {#if !selectedDuplicateGroup}
          <p class="ir-data-mgmt__empty-inline">请选择左侧重复专题组。</p>
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
                  <code>{file.absolutePath}</code>
                </label>
              </li>
            {/each}
          </ul>

          <div class="ir-data-mgmt__diff-controls">
            <label>
              比较 A
              <select bind:value={diffLeftPath}>
                {#each selectedDuplicateGroup.files as file (file.absolutePath)}
                  <option value={file.absolutePath}>{file.absolutePath}</option>
                {/each}
              </select>
            </label>
            <label>
              比较 B
              <select bind:value={diffRightPath}>
                {#each selectedDuplicateGroup.files as file (file.absolutePath)}
                  <option value={file.absolutePath}>{file.absolutePath}</option>
                {/each}
              </select>
            </label>
            <button type="button" class="clickable-icon mod-muted" disabled={isBusy} onclick={() => void runCompare()}>
              分析差异
            </button>
          </div>

          {#if pairDiff}
            <div class="ir-data-mgmt__diff-panel">
              <p>
                A：{pairDiff.pointCountA} 点 · B：{pairDiff.pointCountB} 点 · 相同 ID：{pairDiff.sharedPointIds.length}
              </p>
              <div class="ir-data-mgmt__diff-cols">
                <div>
                  <h5>仅在 A（{pairDiff.onlyInA.length}）</h5>
                  <ul>
                    {#each pairDiff.onlyInA.slice(0, 30) as id}
                      <li><code>{id}</code></li>
                    {/each}
                    {#if pairDiff.onlyInA.length > 30}
                      <li>… 还有 {pairDiff.onlyInA.length - 30} 个</li>
                    {/if}
                  </ul>
                </div>
                <div>
                  <h5>仅在 B（{pairDiff.onlyInB.length}）</h5>
                  <ul>
                    {#each pairDiff.onlyInB.slice(0, 30) as id}
                      <li><code>{id}</code></li>
                    {/each}
                    {#if pairDiff.onlyInB.length > 30}
                      <li>… 还有 {pairDiff.onlyInB.length - 30} 个</li>
                    {/if}
                  </ul>
                </div>
              </div>
            </div>
          {/if}

          {#if mergePointIdConflicts?.length}
            <div class="ir-data-mgmt__conflict-panel">
              <h5>同阅读点 ID 内容冲突（请为每个点选择保留哪一版）</h5>
              <p class="ir-data-mgmt__cell-sub">
                下列阅读点在多个文件里 id 相同但字段不一致；未选择完整前不会写入保留文件，也不会删除副本。
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
                取消冲突处理
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
              ? '确认合并（已选版本）并删除其它副本'
              : '保留所选文件并删除其它副本'}
          </button>
        {/if}
      </div>
    </section>
  {:else}
    <section class="ir-data-mgmt__section">
      <p class="ir-data-mgmt__desc">
        以下文件仅存在于插件安装目录的 <code>backups</code> / <code>json-recovery</code> 中，当前库内没有相同专题 ID 的在用文件。可恢复到库内规范目录，或选择不恢复并直接删除备份。
      </p>

      {#if scanResult.backupOrphans.length === 0}
        <p class="ir-data-mgmt__empty-inline">未发现备份中的孤立专题文件。</p>
      {:else}
        <div class="ir-data-mgmt__table-wrap">
          <table class="ir-data-mgmt__table">
            <thead>
              <tr>
                <th>专题</th>
                <th>备份路径</th>
                <th>阅读点</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {#each scanResult.backupOrphans as entry (entry.absolutePath)}
                <tr>
                  <td>
                    <div class="ir-data-mgmt__cell-title">{entry.topicName}</div>
                    <div class="ir-data-mgmt__cell-sub">{entry.topicId}</div>
                  </td>
                  <td><code>{entry.relativePath}</code></td>
                  <td>{entry.pointCount}</td>
                  <td class="ir-data-mgmt__row-actions">
                    <button type="button" class="mod-cta" disabled={isBusy} onclick={() => void recoverOrphan(entry)}>
                      恢复到库内
                    </button>
                    <button
                      type="button"
                      class="mod-warning"
                      disabled={isBusy}
                      onclick={() => void deleteOrphanWithoutRecover(entry)}
                    >
                      不恢复，删除
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
    gap: 12px;
    min-height: 420px;
    max-height: min(78vh, 720px);
  }

  .ir-data-mgmt__tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .ir-data-mgmt__tab {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 0 10px;
    min-height: 40px;
    border: none;
    box-shadow: none;
    border-radius: var(--clickable-icon-radius, var(--radius-s));
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
    transition: background-color 0.15s ease, color 0.15s ease;
  }

  .ir-data-mgmt__tab:hover {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }

  .ir-data-mgmt__tab.is-active {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
    font-weight: 600;
  }

  .ir-data-mgmt__badge {
    font-size: var(--font-ui-smaller);
    opacity: 0.85;
  }

  .ir-data-mgmt__toolbar {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
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

  .ir-data-mgmt__hint {
    color: var(--text-muted);
    font-size: var(--font-ui-small);
  }

  .ir-data-mgmt__section {
    display: flex;
    flex-direction: column;
    gap: 10px;
    overflow: auto;
    flex: 1;
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

  .ir-data-mgmt__tag {
    display: inline-block;
    padding: 2px 6px;
    border-radius: var(--radius-s);
    font-size: var(--font-ui-smaller);
  }

  .ir-data-mgmt__tag.is-ok {
    background: var(--background-modifier-success);
  }

  .ir-data-mgmt__tag.is-warn {
    background: var(--background-modifier-error);
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
    gap: 8px;
  }

  .ir-data-mgmt__subsection h4 {
    margin: 8px 0 0;
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
