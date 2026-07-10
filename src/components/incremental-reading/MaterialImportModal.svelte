<!--
  MaterialImportModal - 阅读材料批量导入模态窗
  
  重构版本 v4.0.0
  - 使用 ResizableModal 统一窗口定位和样式
  - 多彩侧边颜色条标识
  - 优化的多步骤流程（选择 → 拆分方式 → 配置/预览 → 导入）
  - 改进的空状态处理
  
  @module components/incremental-reading/MaterialImportModal
  @version 4.0.0
-->
<script lang="ts">
  import { onDestroy, untrack } from 'svelte';
  import { TFile, Notice, normalizePath, Menu, Setting } from 'obsidian';
  import type { WeavePlugin } from '../../main';
  import { logger } from '../../utils/logger';
  import { getReadingMaterialDueAt } from '../../utils/ir-topic-compat';
  import { resolveIRImportFolder } from '../../config/paths';
  import { VaultFolderSuggestModal } from '../../modals/VaultFolderSuggestModal';
  import ResizableModal from '../ui/ResizableModal.svelte';
  import type { BatchImportResult } from '../../services/incremental-reading/ReadingMaterialManager';
  import { getIRDeckServices } from '../../services/incremental-reading/IRDeckServices';
  import type { IRDeck, IRChunkFileData } from '../../types/ir-types';
  
  import type { ImportStep, RuleSplitConfig as RuleSplitConfigType, ContentBlock } from '../../types/content-split-types';
  import { DEFAULT_RULE_SPLIT_CONFIG } from '../../types/content-split-types';
  import { splitByRules } from '../../utils/content-split-utils';
  import { IRPointWriteService } from '../../services/incremental-reading/IRPointWriteService';
  import { IRTagGroupService } from '../../services/incremental-reading/IRTagGroupService';
  import { IRPdfBookmarkTaskService } from '../../services/incremental-reading/IRPdfBookmarkTaskService';
  import { IREpubBookmarkTaskService } from '../../services/incremental-reading/IREpubBookmarkTaskService';
  import { IRV4SchedulerService } from '../../services/incremental-reading/IRV4SchedulerService';
  import { reportEpubError } from '../../services/epub-integration/epub-error';
  import { getIrEpubStorageService } from '../../services/epub-integration/ir-epub-storage-access';
  import { loadEpubTocForIrImport } from '../../services/epub-integration/ir-epub-toc-loader';
  import type { TocItem } from '../../services/epub-integration/types';
  import type { SchedulingConfig, SchedulingImpact } from '../../types/ir-import-scheduling';
  import { DEFAULT_SCHEDULING_CONFIG, SCHEDULING_PRESETS } from '../../types/ir-import-scheduling';
  import { IRImportSchedulingService, type IRLoadInfo } from '../../services/incremental-reading/IRImportSchedulingService';
  import { getProjectedDayLoad, getProjectedScheduleSummary } from '../../services/incremental-reading/IRProjectedScheduleSummary';
  import { recomputeAndBroadcastIRData } from '../../services/incremental-reading/IRScheduleRefreshService';
  import {
    normalizeIRReadableMarkdownFolderPath,
    resolveIRReadableMarkdownTargetFolder
  } from '../../services/incremental-reading/IRReadableMarkdownPathResolver';
  import { extractBodyContent } from '../../utils/yaml-utils';
  import { ReadingCategory } from '../../types/incremental-reading-types';
  import { createDefaultChunkFileData, generateChunkId, generateSourceId } from '../../types/ir-types';
  import { getPdfOutlineForFile } from '../../utils/pdf-outline';
  import { PREMIUM_FEATURES } from '../../services/premium/PremiumFeatureGuard';
  import { ensureIRPremiumFeature } from '../../services/premium/ir-premium';
  import { tr, i18n } from '../../utils/i18n';
  import MaterialImportStepIndicator from './material-import/MaterialImportStepIndicator.svelte';
  import MaterialImportFileSelectStep from './material-import/MaterialImportFileSelectStep.svelte';
  import MaterialImportOutlineStep from './material-import/MaterialImportOutlineStep.svelte';
  import MaterialImportConfigureStep from './material-import/MaterialImportConfigureStep.svelte';
  import MaterialImportPreviewStep from './material-import/MaterialImportPreviewStep.svelte';
  import {
    INITIAL_IMPORT_ORDERING_OPTIONS,
    SCHEDULING_PRESET_KEYS,
    STRATEGY_OPTIONS
  } from './material-import/material-import-constants';
  import {
    attachEpubItemContext,
    buildContentBlocksFromSelectedOutlineItems,
    flattenEpubTocToOutlineItems
  } from './material-import/material-import-outline-utils';
  import type {
    ImportContentBlock,
    InitialImportOrderingMode,
    OutlineSelectionItem,
    SourceSequenceMeta,
    WholeFileImportMode
  } from './material-import/material-import-types';
  import './material-import/material-import-modal.css';

  interface Props {
    plugin: WeavePlugin;
    open: boolean;
    useObsidianModal?: boolean;
    onClose: () => void;
    onImportComplete: (result: BatchImportResult) => void;
  }

  function ensureExternalReadingPointImportPremium(): boolean {
    return ensureIRPremiumFeature(plugin.app, PREMIUM_FEATURES.IMPORT_EXTERNAL_READING_POINTS);
  }

  async function handlePdfBookmarkTaskImport(): Promise<void> {
    if (!selectedDeckId) return;
    if (!ensureExternalReadingPointImportPremium()) return;

    importing = true;
    importProgress = { current: 0, total: contentBlocks.length };

    try {
      await services.init();

      const pointWriteService = new IRPointWriteService(plugin.app);
      const pdfService = new IRPdfBookmarkTaskService(plugin.app);
      await pdfService.initialize();
      const scheduler = new IRV4SchedulerService(plugin.app);
      await scheduler.initialize();
      const selectedDeck = availableDecks.find(d => d.id === selectedDeckId);
      const deckIdentifiers = [selectedDeckId, selectedDeck?.path].filter(
        (value): value is string => Boolean(value && value.trim())
      );

      let assignments: Map<ContentBlock, Date> | null = null;
      if (contentBlocks.length > 0) {
        const schedulingResult = await calculateProjectedScheduling(
          contentBlocks,
          (block) => estimateContentBlockMinutes(block, 200)
        );
        schedulingImpact = schedulingResult.impact;
        assignments = schedulingResult.assignments;
      }
      const sequenceMetaByBlock = buildContentBlockSequenceMetaMap(
        contentBlocks,
        (block) => `pdf:${normalizePath(String((block as any)?.sourceFilePath || '').trim())}`,
        assignments
      );

      const existing = await pdfService.getTasksByDeckIdentifiers(deckIdentifiers);
      const existingKeys = new Set<string>();
      for (const t of existing) {
        const link = String((t as any)?.link || '').trim();
        const pdfPath = String((t as any)?.pdfPath || '').trim();
        const m = link.match(/\bpage=(\d+)\b/i);
        const pageNumber = m ? Number(m[1]) : 0;
        if (pdfPath && pageNumber > 0) {
          existingKeys.add(`${pdfPath}#${pageNumber}`);
        }
        if (link) {
          existingKeys.add(link);
        }
      }

      let success = 0;
      let skipped = 0;
      const errors: Array<{ path: string; error: string }> = [];

      for (let i = 0; i < contentBlocks.length; i++) {
        const block = contentBlocks[i];
        importProgress = { current: i + 1, total: contentBlocks.length };

        const pdfPath = String(block.sourceFilePath || '').trim();
        if (!pdfPath) continue;

        // 剥离 wikilink 语法：[[path#subpath|alias]] → path#subpath
        const rawContent = String(block.content || '').trim();
        const linkText = rawContent.replace(/^!?\[\[/, '').replace(/\]\]$/, '').split('|')[0];
        const pageNumber = (block as any).pdfPageNumber ? Number((block as any).pdfPageNumber) : 0;
        const key = pageNumber > 0 ? `${pdfPath}#${pageNumber}` : linkText;
        if (existingKeys.has(key) || existingKeys.has(linkText)) {
          skipped++;
          continue;
        }

        try {
          const sequenceMeta = sequenceMetaByBlock.get(block as any);
          const created = await pointWriteService.createPdfPoint({
            deckId: selectedDeckId,
            pdfPath,
            title: block.title || t('irImport.preview.defaultPdfTitle'),
            link: linkText,
            priorityUi: 5,
            sourceSequenceGroup: sequenceMeta?.sourceSequenceGroup,
            sourceSequenceOrder: sequenceMeta?.sourceSequenceOrder,
            sourceSequenceLocked: sequenceMeta?.sourceSequenceLocked,
            sourceSequenceAnchorDateKey: sequenceMeta?.sourceSequenceAnchorDateKey
          });

          const assignedDate = assignments?.get(block as any);
          if (assignedDate) {
            await scheduler.manualRescheduleBlockWithPreviewV4(
              pdfService.toBlockV4(created),
              {
                nextRepDate: assignedDate.getTime(),
                intervalDays: 1,
                scheduleStatus: 'queued'
              },
              selectedDeckId
            );
          }

          existingKeys.add(key);
          existingKeys.add(linkText);
          success++;
        } catch (e) {
          const msg = e instanceof Error ? e.message : i18n.t('irImport.notices.unknownError');
          errors.push({ path: pdfPath, error: msg });
        }
      }

      await finalizeImport({ success, skipped, errors });
    } catch (error) {
      logger.error('[MaterialImportModal] PDF 书签任务导入失败:', error);
      new Notice(i18n.t('irImport.notices.importFailed', {
        message: error instanceof Error ? error.message : i18n.t('irImport.notices.unknownError')
      }));
    } finally {
      importing = false;
    }
  }

  let {
    plugin,
    open = $bindable(),
    useObsidianModal = false,
    onClose,
    onImportComplete
  }: Props = $props();

  let t = $derived($tr);

  function importErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : t('irImport.notices.unknownError');
  }

  async function finalizeImport(result: BatchImportResult): Promise<void> {
    if (result.success > 0) {
      await recomputeAndBroadcastIRData(plugin.app, 'import_materials');
    }

    onImportComplete(result);
    onClose();
  }

  let importing = $state(false);
  let importProgress = $state({ current: 0, total: 0 });
  
  let currentStep = $state<ImportStep>('select');
  let ruleSplitConfig = $state<RuleSplitConfigType>({ ...DEFAULT_RULE_SPLIT_CONFIG });
  let fileContent = $state('');

  let contentBlocks = $state<ImportContentBlock[]>([]);
  let selectedFilePath = $state<string | null>(null);
  let selectedFilePaths = $state<string[]>([]);
  let markdownImportFolder = $state('');
  let appendSourceDocumentBacklinkOnSplitImport = $state(false);
  let wholeFileImportMode = $state<WholeFileImportMode>('reference');
  let splitSourceBacklinkSettingHost = $state<HTMLDivElement | null>(null);
  
  let previewIndex = $state(0);
  
  // 牌组选择相关状态
  let availableDecks = $state<IRDeck[]>([]);
  let selectedDeckId = $state<string | null>(null);
  let showNewDeckInput = $state(false);
  let newDeckName = $state('');
  let creatingDeck = $state(false);
  const services = untrack(() => getIRDeckServices(plugin.app, plugin.settings?.incrementalReading?.importFolder));
  
  let irTagGroupService: IRTagGroupService | null = $state(null);
  
  // 时间分散调度相关状态
  let schedulingConfig = $state<SchedulingConfig>({ ...DEFAULT_SCHEDULING_CONFIG });
  let schedulingImpact = $state<SchedulingImpact | null>(null);
  let showSchedulingDetails = $state(false);
  let useCustomDays = $state(false);
  let customDaysValue = $state(21);
  let initialImportOrderingMode = $state<InitialImportOrderingMode>('preserve-source-order');

  let isPdfImportMode = $state(false);
  let isEpubImportMode = $state(false);
  let previewTagGroupName = $state('');

  // 目录选择状态（PDF / EPUB 统一）
  let outlineAllItems = $state<OutlineSelectionItem[]>([]);
  let outlineVisibleItems = $state<OutlineSelectionItem[]>([]);
  let outlineSelectedIds = $state<Set<string>>(new Set());
  let outlineAvailableLevels = $state<number[]>([]);
  let outlineSelectedLevels = $state<number[]>([]);
  let outlineSelectionInitialized = $state(false);
  let loadingOutline = $state(false);

  function getSchedulingDailyBudgetMinutes(): number {
    return plugin.settings.incrementalReading?.dailyTimeBudgetMinutes || 60;
  }

  function estimateContentBlockMinutes(block: ContentBlock, fallbackChars = 500): number {
    const explicitCharCount = Number((block as any)?.charCount || 0);
    const contentLength = typeof block?.content === 'string' ? block.content.length : 0;
    const charCount = contentLength > 0 ? contentLength : explicitCharCount > 0 ? explicitCharCount : fallbackChars;
    return Math.max(1, Math.ceil(charCount / 500));
  }

  function formatLocalDateKey(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  function shouldPreserveImportedSourceSequence(): boolean {
    return initialImportOrderingMode === 'preserve-source-order';
  }

  function shouldShowInitialImportOrderingSelector(): boolean {
    return contentBlocks.length > 1;
  }

  function buildSourceSequenceMeta(
    sourceSequenceGroup: string,
    sourceSequenceOrder: number,
    nextRepDate?: number | null
  ): SourceSequenceMeta | undefined {
    if (!shouldPreserveImportedSourceSequence()) {
      return undefined;
    }

    const normalizedGroup = String(sourceSequenceGroup || '').trim();
    if (!normalizedGroup || sourceSequenceOrder <= 0) {
      return undefined;
    }

    const anchorDate = typeof nextRepDate === 'number' && nextRepDate > 0 ? new Date(nextRepDate) : new Date();
    return {
      sourceSequenceGroup: normalizedGroup,
      sourceSequenceOrder,
      sourceSequenceLocked: true,
      sourceSequenceAnchorDateKey: formatLocalDateKey(anchorDate)
    };
  }

  function buildContentBlockSequenceMetaMap(
    blocks: ContentBlock[],
    resolveGroupKey: (block: ContentBlock) => string,
    assignments?: Map<ContentBlock, Date> | null
  ): Map<ContentBlock, SourceSequenceMeta> {
    const result = new Map<ContentBlock, SourceSequenceMeta>();
    if (!shouldPreserveImportedSourceSequence()) {
      return result;
    }

    const orderByGroup = new Map<string, number>();
    for (const block of blocks) {
      const rawGroupKey = String(resolveGroupKey(block) || '').trim();
      if (!rawGroupKey) {
        continue;
      }
      const nextOrder = (orderByGroup.get(rawGroupKey) || 0) + 1;
      orderByGroup.set(rawGroupKey, nextOrder);
      const assignedDate = assignments?.get(block);
      const sequenceMeta = buildSourceSequenceMeta(rawGroupKey, nextOrder, assignedDate?.getTime());
      if (sequenceMeta) {
        result.set(block, sequenceMeta);
      }
    }

    return result;
  }

  function resolveExistingLoadMinutes(
    block: any,
    fallbackEstimator: (block: ContentBlock) => number
  ): number {
    const projectedMinutes = Number(block?.estimatedMinutes);
    if (Number.isFinite(projectedMinutes) && projectedMinutes > 0) {
      return projectedMinutes;
    }
    return fallbackEstimator(block as ContentBlock);
  }

  async function createProjectedImportLoadInfo(
    fallbackEstimator: (block: ContentBlock) => number
  ): Promise<IRLoadInfo> {
    if (!selectedDeckId) {
      throw new Error(t('irImport.errors.noDeckForLoadInfo'));
    }

    const summary = await getProjectedScheduleSummary(plugin.app, {
      deckIds: [selectedDeckId],
      horizonDays: Math.max(1, schedulingConfig.distributionDays || 1)
    });

    return {
      dailyBudgetMinutes: getSchedulingDailyBudgetMinutes(),
      getBlocksForDate: async (date: Date) => getProjectedDayLoad(summary, date).items,
      estimateBlockMinutes: (block: any) => resolveExistingLoadMinutes(block, fallbackEstimator)
    };
  }

  async function calculateProjectedScheduling(
    blocks: ContentBlock[],
    fallbackEstimator: (block: ContentBlock) => number
  ): Promise<{ impact: SchedulingImpact; assignments: Map<ContentBlock, Date> }> {
    const loadInfo = await createProjectedImportLoadInfo(fallbackEstimator);
    const schedulingService = new IRImportSchedulingService(loadInfo);
    const impact = await schedulingService.calculateScheduling(blocks, schedulingConfig);
    const assignments = schedulingService.applyScheduling(blocks, impact);
    return { impact, assignments };
  }

  const modalTitle = $derived.by(() => {
    switch (currentStep) {
      case 'select': return t('irImport.title.importMaterials');
      case 'split-mode': return isPdfImportMode || isEpubImportMode ? t('irImport.title.selectOutlineItems') : t('irImport.title.selectSplitMode');
      case 'configure': return t('irImport.title.configureSplitRules');
      case 'preview': return isPdfImportMode ? t('irImport.title.confirmPdfImport') : isEpubImportMode ? t('irImport.title.confirmEpubImport') : t('irImport.title.previewSplitResults');
      default: return t('irImport.title.importMaterials');
    }
  });
  
  const isMultiFileMode = $derived(selectedFilePaths.length > 1);

  function getOutlineUnitLabel(): string {
    return isPdfImportMode ? t('irImport.outline.bookmark') : t('irImport.outline.chapter');
  }

  function initializeOutlineSelection(items: OutlineSelectionItem[]): void {
    const levels = Array.from(new Set(items.map((item) => item.level).filter((level) => level > 0))).sort((a, b) => a - b);
    outlineAllItems = items;
    outlineAvailableLevels = levels;
    outlineSelectedLevels = [...levels];
    outlineVisibleItems = [];
    outlineSelectedIds = new Set();
    outlineSelectionInitialized = false;
    refreshOutlineVisibleItems();
  }

  function refreshOutlineVisibleItems(): void {
    const activeLevels = new Set(outlineSelectedLevels);
    const nextItems = outlineAllItems.filter((item) => activeLevels.has(item.level));
    const previousSelection = new Set(outlineSelectedIds);
    outlineVisibleItems = nextItems;

    if (!outlineSelectionInitialized) {
      outlineSelectedIds = new Set(nextItems.map((item) => item.id));
      outlineSelectionInitialized = true;
      return;
    }

    outlineSelectedIds = new Set(nextItems.filter((item) => previousSelection.has(item.id)).map((item) => item.id));
  }

  function toggleOutlineLevel(level: number): void {
    outlineSelectedLevels = outlineSelectedLevels.includes(level)
      ? outlineSelectedLevels.filter((itemLevel) => itemLevel !== level)
      : [...outlineSelectedLevels, level].sort((a, b) => a - b);
    refreshOutlineVisibleItems();
  }

  function toggleOutlineItem(id: string): void {
    const next = new Set(outlineSelectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    outlineSelectedIds = next;
    outlineSelectionInitialized = true;
  }

  function selectAllVisibleOutlineItems(): void {
    outlineSelectedIds = new Set(outlineVisibleItems.map((item) => item.id));
    outlineSelectionInitialized = true;
  }

  function clearVisibleOutlineItems(): void {
    outlineSelectedIds = new Set();
    outlineSelectionInitialized = true;
  }
  
  // 计算调度影响
  $effect(() => {
    if (currentStep === 'preview' && contentBlocks.length > 0 && selectedDeckId) {
      calculateSchedulingImpact();
    }
  });
  
  // 当调度配置改变时重新计算
  $effect(() => {
    if (currentStep === 'preview' && contentBlocks.length > 0 && selectedDeckId && schedulingImpact) {
      // 配置变化时重新计算
      const config = schedulingConfig; // 触发响应式
      calculateSchedulingImpact();
    }
  });
  
  async function calculateSchedulingImpact() {
    if (!services.storageService || contentBlocks.length === 0) return;
    
    try {
      await services.init();
      const schedulingResult = await calculateProjectedScheduling(
        contentBlocks,
        (block) => estimateContentBlockMinutes(block, 500)
      );
      schedulingImpact = schedulingResult.impact;
    } catch (error) {
      logger.error('[MaterialImportModal] 计算调度影响失败:', error);
    }
  }

  const excludedImportFolderPath = $derived(
    normalizePath(
      resolveIRImportFolder(
        plugin.settings?.incrementalReading?.importFolder,
        plugin.settings?.weaveParentFolder
      )
    )
  );

  function getMarkdownImportContextPath(paths: string[]): string | null {
    for (const path of paths) {
      const file = plugin.app.vault.getAbstractFileByPath(path);
      if (file instanceof TFile && file.extension === 'md') {
        return file.path;
      }
    }
    return null;
  }

  function resolveDefaultMarkdownImportFolder(paths: string[]): string {
    return normalizeIRReadableMarkdownFolderPath(
      resolveIRReadableMarkdownTargetFolder(plugin.app, {
        lastSelectedFolder: plugin.settings?.incrementalReading?.selectionQuickCreateLastFolder,
        contextPath: getMarkdownImportContextPath(paths),
        allowActiveFileFallback: true
      })
    );
  }

  function ensureIncrementalReadingSettings(): Record<string, unknown> {
    const pluginAny = plugin as any;
    if (!pluginAny.settings.incrementalReading) {
      pluginAny.settings.incrementalReading = {
        importFolder: resolveIRImportFolder(undefined, pluginAny.settings?.weaveParentFolder),
        selectionQuickCreateLastFolder: '',
        appendSourceDocumentBacklinkOnSplitImport: false
      };
    }
    if (pluginAny.settings.incrementalReading.appendSourceDocumentBacklinkOnSplitImport === undefined) {
      pluginAny.settings.incrementalReading.appendSourceDocumentBacklinkOnSplitImport = false;
    }
    return pluginAny.settings.incrementalReading as Record<string, unknown>;
  }

  function getSplitSourceBacklinkPreference(): boolean {
    const settings = ensureIncrementalReadingSettings();
    return Boolean(settings.appendSourceDocumentBacklinkOnSplitImport);
  }

  async function saveSplitSourceBacklinkPreference(enabled: boolean): Promise<void> {
    appendSourceDocumentBacklinkOnSplitImport = enabled;
    const settings = ensureIncrementalReadingSettings();
    settings.appendSourceDocumentBacklinkOnSplitImport = enabled;
    await plugin.saveSettings();
  }

  async function showMarkdownImportFolderMenu(): Promise<void> {
    const picker = new VaultFolderSuggestModal(plugin.app, {
      placeholder: t('irImport.mdPath.folderPickerPlaceholder')
    });
    const folderPath = await picker.openAndSelect();
    if (!folderPath) {
      return;
    }

    const normalizedFolder = normalizeIRReadableMarkdownFolderPath(folderPath);
    markdownImportFolder = normalizedFolder;
    const settings = ensureIncrementalReadingSettings();
    settings.selectionQuickCreateLastFolder = normalizedFolder;
    await plugin.saveSettings();
  }

  function getMarkdownImportFolderLabel(): string {
    if (!markdownImportFolder || markdownImportFolder === '/') {
      return t('irImport.mdPath.vaultRoot');
    }
    return markdownImportFolder;
  }

  function isWholeFileMarkdownImport(): boolean {
    return !isPdfImportMode && !isEpubImportMode && ruleSplitConfig.enableWholeFile;
  }

  function shouldShowWholeFileImportModeSelector(): boolean {
    return isWholeFileMarkdownImport();
  }

  function shouldShowMarkdownImportFolderSelector(): boolean {
    if (isPdfImportMode || isEpubImportMode) {
      return false;
    }
    return !ruleSplitConfig.enableWholeFile || wholeFileImportMode === 'copy';
  }

  function shouldShowSplitSourceBacklinkToggle(): boolean {
    if (currentStep !== 'preview') {
      return false;
    }
    if (isPdfImportMode || isEpubImportMode) {
      return false;
    }
    return !ruleSplitConfig.enableWholeFile;
  }

  function buildSourceTraceBacklink(file: TFile): string {
    return `[[${file.path}|${t('irImport.sourceBacklink.linkLabel')}]]`;
  }

  function getWholeFileImportModeLabel(): string {
    return wholeFileImportMode === 'reference' ? t('irImport.importMode.reference') : t('irImport.importMode.copy');
  }

  function getInitialImportOrderingLabel(): string {
    const option = INITIAL_IMPORT_ORDERING_OPTIONS.find(o => o.value === initialImportOrderingMode);
    return option ? t(option.labelKey) : t('irImport.scheduling.ordering.preserveSourceOrder');
  }

  async function goToSplitModeStep(paths: string[]): Promise<void> {
    if (paths.length === 0) return;
    
    selectedFilePaths = paths;

    const extensions = new Set<string>();
    for (const p of paths) {
      const af = plugin.app.vault.getAbstractFileByPath(p);
      if (af instanceof TFile) {
        extensions.add(af.extension);
      }
    }

    const hasMarkdown = extensions.has('md');
    const hasPdf = extensions.has('pdf');
    const hasEpub = extensions.has('epub');
    const typeCount = (hasMarkdown ? 1 : 0) + (hasPdf ? 1 : 0) + (hasEpub ? 1 : 0);
    if (typeCount > 1) {
      new Notice(t('irImport.notices.mixedImportNotSupported'));
      return;
    }

    if ((hasPdf || hasEpub) && !ensureExternalReadingPointImportPremium()) {
      return;
    }

    if (hasEpub) {
      await prepareEpubSplitStep(paths);
      return;
    }

    const isPdfImport = hasPdf;
    if (isPdfImport) {
      await preparePdfSplitStep(paths);
      return;
    }

    if (paths.length === 1) {
      selectedFilePath = paths[0];
      try {
        const file = plugin.app.vault.getAbstractFileByPath(selectedFilePath);
        if (file instanceof TFile) {
          const rawContent = await plugin.app.vault.read(file);
          fileContent = extractBodyContent(rawContent);
        }
      } catch (error) {
        logger.error('[MaterialImportModal] 读取文件失败:', error);
      }
    } else {
      selectedFilePath = null;
      fileContent = '';
    }

    markdownImportFolder = resolveDefaultMarkdownImportFolder(paths);
    wholeFileImportMode = 'reference';
    currentStep = 'configure';
  }

  async function preparePdfSplitStep(filePaths: string[]): Promise<void> {
    if (!ensureExternalReadingPointImportPremium()) {
      return;
    }
    isPdfImportMode = true;
    selectedFilePath = filePaths.length === 1 ? filePaths[0] : null;
    importing = true;
    loadingOutline = true;
    importProgress = { current: 0, total: filePaths.length };

    try {
      const outlineItems: OutlineSelectionItem[] = [];
      for (let i = 0; i < filePaths.length; i++) {
        const p = filePaths[i];
        importProgress = { current: i + 1, total: filePaths.length };

        const file = plugin.app.vault.getAbstractFileByPath(p);
        const tfile = file instanceof TFile ? file : null;
        if (!tfile) continue;

        const items = await getPdfOutlineItemsSafely(tfile);
        logger.debug('[MaterialImportModal] PDF 目录提取结果:', {
          pdf: tfile.path,
          outlineCount: items.length
        });
        if (items.length === 0) {
          outlineItems.push({
            id: `pdf-whole:${tfile.path}`,
            type: 'pdf',
            label: tfile.basename,
            path: [],
            level: 1,
            filePath: tfile.path,
            bookTitle: tfile.basename,
            fallbackWholeFile: true
          });
          continue;
        }

        for (const [index, item] of items.entries()) {
          outlineItems.push({
            id: `pdf:${tfile.path}:${item.pageNumber || 0}:${index}`,
            type: 'pdf',
            label: item.title,
            path: item.path,
            level: Math.max(1, item.path.length || 1),
            filePath: tfile.path,
            bookTitle: tfile.basename,
            pageNumber: typeof item.pageNumber === 'number' && item.pageNumber > 0 ? item.pageNumber : undefined
          });
        }
      }

      initializeOutlineSelection(outlineItems);
      currentStep = 'split-mode';
    } catch (error) {
      logger.error('[MaterialImportModal] 解析 PDF 目录失败:', error);
      new Notice(t('irImport.notices.parsePdfOutlineFailed', { message: importErrorMessage(error) }));
    } finally {
      loadingOutline = false;
      importing = false;
    }
  }

  function handleOutlineSelectionConfirm(): void {
    const selectedItems = outlineVisibleItems.filter((item) => outlineSelectedIds.has(item.id));
    if (selectedItems.length === 0) {
      new Notice(t('irImport.notices.selectAtLeastOne', { unit: getOutlineUnitLabel() }));
      return;
    }

    contentBlocks = buildContentBlocksFromSelectedOutlineItems(selectedItems, isMultiFileMode);
    currentStep = 'preview';
  }

  function getMatchedBlocksForFile(
    filePath: string,
    allBlocks: ContentBlock[],
    fallbackStartIndex: number,
    fallbackCount: number
  ): ContentBlock[] {
    const normalizedFilePath = normalizePath(filePath);
    const blocksForFile = allBlocks.filter(block =>
      (block as ImportContentBlock).sourceFilePath
      && normalizePath((block as ImportContentBlock).sourceFilePath!) === normalizedFilePath
    );

    if (blocksForFile.length > 0) {
      return blocksForFile;
    }

    return allBlocks.slice(fallbackStartIndex, fallbackStartIndex + fallbackCount);
  }

  async function ensureMdMaterialServices() {
    const materialManager = plugin.readingMaterialManager;
    const materialStorage = plugin.readingMaterialStorage;

    if (!materialManager || !materialStorage) {
      throw new Error(t('irImport.errors.materialServiceNotInit'));
    }

    await materialStorage.initialize();
    return { materialManager };
  }

  async function ensureExternalDocumentChunkScheduled(
    file: TFile,
    deckId: string,
    deckName: string,
    nextRepDate?: number,
    sourceSequenceMeta?: SourceSequenceMeta
  ): Promise<void> {
    await services.init();
    const storage = services.storageService;
    if (!storage) {
      throw new Error(t('irImport.errors.storageServiceNotInit'));
    }

    const chunks = await storage.getAllChunkData();
    const existing = Object.values(chunks).find((chunk: any) => (chunk as any)?.filePath === file.path) as IRChunkFileData | undefined;
    const effectiveNextRepDate = nextRepDate ?? Date.now();

    if (existing) {
      existing.deckIds = [deckId];
      existing.deckTag = `#IR_deck_${deckName}`;
      existing.nextRepDate = effectiveNextRepDate;
      existing.intervalDays = existing.intervalDays || 1;
      existing.scheduleStatus = 'queued';
      (existing as any).meta = {
        ...(((existing as any).meta || {}) as Record<string, unknown>),
        ...(sourceSequenceMeta || {})
      };
      existing.updatedAt = Date.now();
      await storage.saveChunkData(existing);
      return;
    }

    const chunk = createDefaultChunkFileData(generateChunkId(), generateSourceId(), file.path) as IRChunkFileData;
    chunk.deckIds = [deckId];
    chunk.deckTag = `#IR_deck_${deckName}`;
    chunk.nextRepDate = effectiveNextRepDate;
    chunk.intervalDays = 1;
    chunk.scheduleStatus = 'queued';
    (chunk as any).meta = {
      ...((((chunk as any).meta || {}) as Record<string, unknown>)),
      ...(sourceSequenceMeta || {})
    };
    chunk.updatedAt = Date.now();
    await storage.saveChunkData(chunk);
  }

  async function importMdFilesAsSourceDocuments(
    filePaths: string[],
    assignments: Map<ContentBlock, Date> | null
  ): Promise<{ successCount: number; errorCount: number; chunkCount: number }> {
    const selectedDeck = availableDecks.find(d => d.id === selectedDeckId);
    if (!selectedDeckId || !selectedDeck) {
      throw new Error(t('irImport.errors.noDeckSelected'));
    }

    const { materialManager } = await ensureMdMaterialServices();

    let successCount = 0;
    let errorCount = 0;
    let chunkCount = 0;
    let fallbackCursor = 0;

    for (let i = 0; i < filePaths.length; i++) {
      const filePath = filePaths[i];
      importProgress = { current: i + 1, total: filePaths.length };

      const file = plugin.app.vault.getAbstractFileByPath(filePath);
      if (!(file instanceof TFile) || file.extension !== 'md') {
        errorCount++;
        continue;
      }

      try {
        const blocksForFile = getMatchedBlocksForFile(
          file.path,
          contentBlocks,
          fallbackCursor,
          filePaths.length === 1 ? contentBlocks.length : 1
        );
        fallbackCursor += blocksForFile.length;

        if (blocksForFile.length === 0) {
          throw new Error(t('irImport.errors.noSplitContent'));
        }

        const splitBlocks = blocksForFile.map((block) => {
          const sourcePrefix = `${file.basename} - `;
          const normalizedTitle = block.title.startsWith(sourcePrefix)
            ? block.title.slice(sourcePrefix.length).trim()
            : block.title.trim();
          return {
            title: normalizedTitle || file.basename,
            content: block.content,
            sourceBacklink: appendSourceDocumentBacklinkOnSplitImport ? buildSourceTraceBacklink(file) : undefined,
            nextReviewAt: assignments?.get(block)
          };
        });

        const createdMaterials = await materialManager.createSplitMarkdownMaterials(file, splitBlocks, {
          source: 'manual',
          category: ReadingCategory.Later,
          priority: 50,
          tags: ['weave-incremental-reading'],
          deckId: selectedDeckId,
          readableMarkdownFolder: markdownImportFolder || undefined
        });

        for (const material of createdMaterials) {
          const createdFile = plugin.app.vault.getAbstractFileByPath(material.filePath);
          if (!(createdFile instanceof TFile)) {
            continue;
          }

          const dueAt = getReadingMaterialDueAt(material);
          const nextRepDate = dueAt ? new Date(dueAt).getTime() : undefined;
          const materialOrder = createdMaterials.indexOf(material) + 1;
          const sequenceMeta = buildSourceSequenceMeta(`md:${normalizePath(file.path)}`, materialOrder, nextRepDate);
          await ensureExternalDocumentChunkScheduled(
            createdFile,
            selectedDeckId,
            selectedDeck.name,
            nextRepDate,
            sequenceMeta
          );
        }

        successCount += createdMaterials.length;
        chunkCount += createdMaterials.length;
        logger.info(
          `[MaterialImportModal] Markdown 拆分导入成功: ${file.path} -> ${createdMaterials.length} 个独立 md 文件`
        );
      } catch (error) {
        errorCount++;
        logger.error(`[MaterialImportModal] Markdown 拆分导入失败: ${file.path}`, error);
        new Notice(t('irImport.notices.importFailedWithFile', { file: file.basename, message: importErrorMessage(error) }));
      }
    }

    return { successCount, errorCount, chunkCount };
  }

  async function importWholeMdFilesByReference(
    filePaths: string[],
    assignments: Map<ContentBlock, Date> | null
  ): Promise<{ successCount: number; errorCount: number; chunkCount: number }> {
    const selectedDeck = availableDecks.find(d => d.id === selectedDeckId);
    if (!selectedDeckId || !selectedDeck) {
      throw new Error(t('irImport.errors.noDeckSelected'));
    }

    const { materialManager } = await ensureMdMaterialServices();
    let successCount = 0;
    let errorCount = 0;
    let fallbackCursor = 0;

    for (let i = 0; i < filePaths.length; i++) {
      const filePath = filePaths[i];
      importProgress = { current: i + 1, total: filePaths.length };

      const file = plugin.app.vault.getAbstractFileByPath(filePath);
      if (!(file instanceof TFile) || file.extension !== 'md') {
        errorCount++;
        continue;
      }

      try {
        const blocksForFile = getMatchedBlocksForFile(
          file.path,
          contentBlocks,
          fallbackCursor,
          filePaths.length === 1 ? Math.max(1, contentBlocks.length) : 1
        );
        fallbackCursor += blocksForFile.length;

        const assignedDate = blocksForFile[0] ? assignments?.get(blocksForFile[0]) : null;
        const material = await materialManager.getOrCreateMaterial(file, {
          source: 'manual',
          category: ReadingCategory.Later,
          priority: 50,
          tags: ['weave-incremental-reading'],
          copyToImportFolder: false
        });

        await materialManager.setReadingDeck(material.uuid, selectedDeckId);
        if (assignedDate) {
          await materialManager.setNextReviewDate(material.uuid, assignedDate);
        }

        await ensureExternalDocumentChunkScheduled(
          file,
          selectedDeckId,
          selectedDeck.name,
          assignedDate?.getTime(),
          buildSourceSequenceMeta(`md:${normalizePath(file.path)}`, 1, assignedDate?.getTime())
        );
        successCount++;
      } catch (error) {
        errorCount++;
        logger.error(`[MaterialImportModal] Markdown 直引导入失败: ${file.path}`, error);
        new Notice(t('irImport.notices.importFailedWithFile', { file: file.basename, message: importErrorMessage(error) }));
      }
    }

    return { successCount, errorCount, chunkCount: 0 };
  }

  async function importWholeMdFilesAsCopies(
    filePaths: string[],
    assignments: Map<ContentBlock, Date> | null
  ): Promise<{ successCount: number; errorCount: number; chunkCount: number }> {
    const selectedDeck = availableDecks.find(d => d.id === selectedDeckId);
    if (!selectedDeckId || !selectedDeck) {
      throw new Error(t('irImport.errors.noDeckSelected'));
    }

    const { materialManager } = await ensureMdMaterialServices();
    let successCount = 0;
    let errorCount = 0;
    let fallbackCursor = 0;

    for (let i = 0; i < filePaths.length; i++) {
      const filePath = filePaths[i];
      importProgress = { current: i + 1, total: filePaths.length };

      const file = plugin.app.vault.getAbstractFileByPath(filePath);
      if (!(file instanceof TFile) || file.extension !== 'md') {
        errorCount++;
        continue;
      }

      try {
        const blocksForFile = getMatchedBlocksForFile(
          file.path,
          contentBlocks,
          fallbackCursor,
          filePaths.length === 1 ? Math.max(1, contentBlocks.length) : 1
        );
        fallbackCursor += blocksForFile.length;

        const assignedDate = blocksForFile[0] ? assignments?.get(blocksForFile[0]) : null;
        const material = await materialManager.createCopiedMarkdownMaterial(file, {
          source: 'manual',
          category: ReadingCategory.Later,
          priority: 50,
          tags: ['weave-incremental-reading'],
          readableMarkdownFolder: markdownImportFolder || undefined
        });

        await materialManager.setReadingDeck(material.uuid, selectedDeckId);
        if (assignedDate) {
          await materialManager.setNextReviewDate(material.uuid, assignedDate);
        }

        const copiedFile = plugin.app.vault.getAbstractFileByPath(material.filePath);
        if (copiedFile instanceof TFile) {
          await ensureExternalDocumentChunkScheduled(
            copiedFile,
            selectedDeckId,
            selectedDeck.name,
            assignedDate?.getTime(),
            buildSourceSequenceMeta(`md:${normalizePath(file.path)}`, 1, assignedDate?.getTime())
          );
        }

        successCount++;
      } catch (error) {
        errorCount++;
        logger.error(`[MaterialImportModal] Markdown 副本导入失败: ${file.path}`, error);
        new Notice(t('irImport.notices.importFailedWithFile', { file: file.basename, message: importErrorMessage(error) }));
      }
    }

    return { successCount, errorCount, chunkCount: 0 };
  }

  async function getPdfOutlineItemsSafely(pdfFile: TFile): Promise<Array<{ title: string; pageNumber: number; path: string[] }>> {
    try {
      return await getPdfOutlineForFile(plugin.app, pdfFile, {
        includeEntriesWithoutPage: true,
        preferOpenView: true,
        maxDirectLoadFileSizeBytes: 0,
        directLoadTimeoutMs: 30000
      });
    } catch (e) {
      logger.debug('[MaterialImportModal] PDF outline extraction failed, falling back to leaf:', e);
      logger.warn('[MaterialImportModal] 未能安全提取 PDF 目录，回退为整本导入:', {
        pdf: pdfFile.path
      });
      return [];
    }
  }

  // --- EPUB functions ---
  async function prepareEpubSplitStep(paths: string[]): Promise<void> {
    if (!ensureExternalReadingPointImportPremium()) {
      return;
    }
    isEpubImportMode = true;
    selectedFilePath = paths.length === 1 ? paths[0] : null;
    loadingOutline = true;
    importing = true;
    importProgress = { current: 0, total: paths.length };
    const epubStorageService = getIrEpubStorageService(plugin.app);

    try {
      const outlineItems: OutlineSelectionItem[] = [];

      for (let i = 0; i < paths.length; i++) {
        const filePath = paths[i];
        importProgress = { current: i + 1, total: paths.length };

        const file = plugin.app.vault.getAbstractFileByPath(filePath);
        const tfile = file instanceof TFile ? file : null;
        if (!tfile) {
          continue;
        }

        try {
          const sourceEntry = await epubStorageService.ensureSourceIdentity(filePath);
          const tocItems = await loadEpubTocForIrImport(plugin.app, filePath);
          const contextualItems: TocItem[] = tocItems.map((item) =>
            attachEpubItemContext(item, filePath, tfile.basename, sourceEntry?.sourceId)
          );
          const flattenedItems = flattenEpubTocToOutlineItems(contextualItems);
          outlineItems.push(...flattenedItems);
        } catch (error) {
          if (error instanceof Error && error.message.startsWith('unsupported-book-format:')) {
            continue;
          }
          throw error;
        }
      }

      initializeOutlineSelection(outlineItems);
      currentStep = 'split-mode';
    } catch (e) {
      const classified = reportEpubError(e, 'toc');
      new Notice(classified.userMessage);
      isEpubImportMode = false;
    } finally {
      loadingOutline = false;
      importing = false;
    }
  }

  async function handleEpubBookmarkTaskImport(): Promise<void> {
    if (!selectedDeckId) return;
    if (!ensureExternalReadingPointImportPremium()) return;

    importing = true;
    importProgress = { current: 0, total: contentBlocks.length };

    try {
      await services.init();

      const pointWriteService = new IRPointWriteService(plugin.app);
      const epubService = new IREpubBookmarkTaskService(plugin.app);
      await epubService.initialize();

      const selected = contentBlocks.filter(
        (block): block is ImportContentBlock & { epubTocHref: string; sourceFilePath: string } =>
          typeof block.epubTocHref === 'string'
          && block.epubTocHref.length > 0
          && typeof block.sourceFilePath === 'string'
          && block.sourceFilePath.length > 0
      );
      const existingHrefMap = new Map<string, Set<string>>();
      const epubStorageService = getIrEpubStorageService(plugin.app);
      const selectedIdentities = new Map<string, { filePath: string; sourceId?: string }>();
      for (const block of selected) {
        const normalizedPath = String(block.sourceFilePath || '').trim();
        if (!normalizedPath) {
          continue;
        }
        const sourceEntry = block.epubSourceId
          ? await epubStorageService.ensureSourceIdentity(normalizedPath, { preferredSourceId: block.epubSourceId })
          : await epubStorageService.ensureSourceIdentity(normalizedPath);
        if (sourceEntry?.sourceId) {
          block.epubSourceId = sourceEntry.sourceId;
        }
        const identityKey = sourceEntry?.sourceId || block.epubSourceId || normalizedPath;
        if (!selectedIdentities.has(identityKey)) {
          selectedIdentities.set(identityKey, {
            filePath: normalizedPath,
            sourceId: sourceEntry?.sourceId || block.epubSourceId
          });
        }
      }
      const selectedDeck = availableDecks.find(d => d.id === selectedDeckId);
      const deckIdentifiers = [selectedDeckId, selectedDeck?.path].filter(
        (value): value is string => Boolean(value && value.trim())
      );
      const existingDeckTasks = await epubService.getTasksByDeckIdentifiers(deckIdentifiers);
      for (const [identityKey, identity] of selectedIdentities.entries()) {
        const existing = existingDeckTasks.filter((task) =>
          (identity.sourceId && task.sourceId === identity.sourceId) ||
          task.epubFilePath === identity.filePath
        );
        existingHrefMap.set(
          identityKey,
          new Set(existing.map(t => t.tocHref))
        );
      }

      const newItems = selected.filter((block) => {
        const identityKey = block.epubSourceId || block.sourceFilePath;
        return !existingHrefMap.get(identityKey)?.has(block.epubTocHref);
      });

      let assignments: Map<ContentBlock, Date> | null = null;
      if (contentBlocks.length > 0) {
        const schedulingResult = await calculateProjectedScheduling(contentBlocks, () => 5);
        schedulingImpact = schedulingResult.impact;
        assignments = schedulingResult.assignments;
      }
      const sequenceMetaByBlock = buildContentBlockSequenceMetaMap(
        selected,
        (block) => `epub:${String((block as any)?.epubSourceId || (block as any)?.sourceFilePath || '').trim()}`,
        assignments
      );

      const inputs = newItems.map((block) => {
        let nextRepDate = 0;
        if (assignments) {
          const assignedDate = assignments.get(block);
          if (assignedDate) {
            nextRepDate = assignedDate.getTime();
          }
        }

        const sequenceMeta = sequenceMetaByBlock.get(block);

        return {
          deckId: selectedDeckId!,
          epubFilePath: block.sourceFilePath,
          sourceId: block.epubSourceId,
          title: block.title || block.epubBookTitle || 'EPUB',
          tocHref: block.epubTocHref,
          tocLevel: block.epubTocLevel || block.outlineLevel || 1,
          priorityUi: 5,
          nextRepDate,
          sourceSequenceGroup: sequenceMeta?.sourceSequenceGroup,
          sourceSequenceOrder: sequenceMeta?.sourceSequenceOrder,
          sourceSequenceLocked: sequenceMeta?.sourceSequenceLocked,
          sourceSequenceAnchorDateKey: sequenceMeta?.sourceSequenceAnchorDateKey
        };
      });

      const created = await pointWriteService.batchCreateEpubPoints(inputs);
      const success = created.length;
      const skipped = selected.length - newItems.length;

      importProgress = { current: contentBlocks.length, total: contentBlocks.length };
      new Notice(t('irImport.notices.epubImportComplete', { success, skipped }));

      await finalizeImport({ success, skipped, errors: [] });
    } catch (error) {
      logger.error('[MaterialImportModal] EPUB 书签任务导入失败:', error);
      new Notice(t('irImport.notices.importFailed', { message: importErrorMessage(error) }));
    } finally {
      importing = false;
    }
  }

  function goBack(): void {
    switch (currentStep) {
      case 'split-mode':
        currentStep = 'select';
        isPdfImportMode = false;
        isEpubImportMode = false;
        selectedFilePath = null;
        outlineAllItems = [];
        outlineVisibleItems = [];
        outlineSelectedIds = new Set();
        outlineAvailableLevels = [];
        outlineSelectedLevels = [];
        outlineSelectionInitialized = false;
        contentBlocks = [];
        selectedFilePaths = [];
        break;
      case 'configure':
        currentStep = 'select';
        break;
      case 'preview':
        if (isPdfImportMode || isEpubImportMode) {
          currentStep = 'split-mode';
        } else {
          currentStep = 'configure';
        }
        break;
    }
  }

  async function handleRuleConfigConfirm(): Promise<void> {
    if (isMultiFileMode) {
      // 批量模式：读取所有文件并生成预览
      await generateBatchPreview();
    } else {
      // 单文件模式：直接拆分当前文件
      let defaultTitle: string | undefined;
      if (selectedFilePath) {
        const file = plugin.app.vault.getAbstractFileByPath(selectedFilePath);
        if (file instanceof TFile) {
          defaultTitle = file.basename;
        }
      }

      contentBlocks = splitByRules(fileContent, ruleSplitConfig, { defaultTitle }).map(block => ({
        ...block,
        sourceFilePath: selectedFilePath || undefined
      }));
      currentStep = 'preview';
    }
  }

  async function generateBatchPreview(): Promise<void> {
    try {
      const allBlocks: ImportContentBlock[] = [];

      for (const filePath of selectedFilePaths) {
        const file = plugin.app.vault.getAbstractFileByPath(filePath);
        if (file instanceof TFile) {
          const content = await plugin.app.vault.read(file);
          const blocks = splitByRules(extractBodyContent(content), ruleSplitConfig, { defaultTitle: file.basename });

          // 为每个块添加文件来源信息
          blocks.forEach(block => {
            allBlocks.push({
              ...block,
              title: block.title ? `${file.basename} - ${block.title}` : file.basename,
              sourceFilePath: file.path
            });
          });
        }
      }

      contentBlocks = allBlocks;
      currentStep = 'preview';
    } catch (error) {
      logger.error('[MaterialImportModal] 生成批量预览失败:', error);
    }
  }

  async function handleBatchImport(): Promise<void> {
    if (selectedFilePaths.length === 0 || !selectedDeckId) return;

    if (isPdfImportMode) {
      await handlePdfBookmarkTaskImport();
      return;
    }
    if (isEpubImportMode) {
      await handleEpubBookmarkTaskImport();
      return;
    }
    
    importing = true;
    importProgress = { current: 0, total: selectedFilePaths.length };

    try {
      const result = await addImportedBlocksAsFiles(selectedFilePaths);
      await finalizeImport({
        success: result.successCount,
        skipped: 0,
        errors: result.errorCount > 0 ? [{ path: '', error: t('irImport.notices.batchImportFailedCount', { count: result.errorCount }) }] : []
      });
    } catch (error) {
      logger.error('[MaterialImportModal] 批量导入失败:', error);
      onImportComplete({ success: 0, skipped: 0, errors: [{ path: '', error: String(error) }] });
      onClose();
    } finally {
      importing = false;
    }
  }

  async function handleSingleFileImport(): Promise<void> {
    if (!selectedFilePath || contentBlocks.length === 0 || !selectedDeckId) return;

    if (isPdfImportMode) {
      await handlePdfBookmarkTaskImport();
      return;
    }
    if (isEpubImportMode) {
      await handleEpubBookmarkTaskImport();
      return;
    }
    
    importing = true;
    
    try {
      const result = await addImportedBlocksAsFiles([selectedFilePath]);
      await finalizeImport({
        success: result.successCount,
        skipped: 0,
        errors: result.errorCount > 0 ? [{ path: selectedFilePath || '', error: t('irImport.notices.importFailedGeneric') }] : []
      });
    } catch (error) {
      logger.error('[MaterialImportModal] 导入失败:', error);
      onImportComplete({ success: 0, skipped: 0, errors: [{ path: selectedFilePath || '', error: String(error) }] });
      onClose();
    } finally {
      importing = false;
    }
  }

  // Obsidian Menu API 实现
  function showSchedulingDaysMenu(evt: MouseEvent) {
    const menu = new Menu();
    
    Object.entries(SCHEDULING_PRESETS).forEach(([key, preset]) => {
      const presetKey = SCHEDULING_PRESET_KEYS[key];
      menu.addItem((item) => {
        item
          .setTitle(presetKey ? t(`irImport.scheduling.presets.${presetKey}`) : preset.label)
          .setChecked(!useCustomDays && schedulingConfig.distributionDays === preset.days)
          .onClick(() => {
            useCustomDays = false;
            schedulingConfig.distributionDays = preset.days;
          });
      });
    });
    
    menu.addItem((item) => {
      item
        .setTitle(t('irImport.scheduling.custom'))
        .setChecked(useCustomDays)
        .onClick(() => {
          useCustomDays = true;
          schedulingConfig.distributionDays = customDaysValue;
        });
    });
    
    menu.showAtMouseEvent(evt);
  }

  function showSchedulingStrategyMenu(evt: MouseEvent) {
    const menu = new Menu();
    
    STRATEGY_OPTIONS.forEach(option => {
      menu.addItem((item) => {
        item
          .setTitle(t(option.labelKey))
          .setChecked(schedulingConfig.strategy === option.value)
          .onClick(() => {
            schedulingConfig.strategy = option.value;
          });
      });
    });
    
    menu.showAtMouseEvent(evt);
  }

  function showInitialImportOrderingMenu(evt: MouseEvent) {
    const menu = new Menu();

    INITIAL_IMPORT_ORDERING_OPTIONS.forEach(option => {
      menu.addItem((item) => {
        item
          .setTitle(t(option.labelKey))
          .setChecked(initialImportOrderingMode === option.value)
          .onClick(() => {
            initialImportOrderingMode = option.value;
          });
      });
    });

    menu.showAtMouseEvent(evt);
  }

  function showWholeFileImportModeMenu(evt: MouseEvent) {
    const menu = new Menu();

    menu.addItem((item) => {
      item
        .setTitle(t('irImport.importMode.reference'))
        .setChecked(wholeFileImportMode === 'reference')
        .onClick(() => {
          wholeFileImportMode = 'reference';
        });
    });

    menu.addItem((item) => {
      item
        .setTitle(t('irImport.importMode.copy'))
        .setChecked(wholeFileImportMode === 'copy')
        .onClick(() => {
          wholeFileImportMode = 'copy';
        });
    });

    menu.showAtMouseEvent(evt);
  }

  function showDeckSelectMenu(evt: MouseEvent) {
    const menu = new Menu();
    
    availableDecks.forEach(deck => {
      menu.addItem((item) => {
        item
          .setTitle(`${deck.icon} ${deck.name}`)
          .setChecked(selectedDeckId === deck.id)
          .onClick(() => {
            selectedDeckId = deck.id;
          });
      });
    });
    
    menu.addSeparator();
    
    menu.addItem((item) => {
      item
        .setTitle(t('irImport.deck.newDeck'))
        .setIcon('plus')
        .onClick(() => {
          showNewDeckInput = true;
        });
    });
    
    menu.showAtMouseEvent(evt);
  }

  function getSchedulingDaysLabel(): string {
    if (useCustomDays) return t('irImport.scheduling.daysSuffix', { count: customDaysValue });
    const preset = Object.entries(SCHEDULING_PRESETS).find(([, value]) => value.days === schedulingConfig.distributionDays);
    if (preset) {
      const presetKey = SCHEDULING_PRESET_KEYS[preset[0]];
      if (presetKey) {
        return t(`irImport.scheduling.presets.${presetKey}`);
      }
    }
    return t('irImport.scheduling.daysSuffix', { count: schedulingConfig.distributionDays });
  }

  function getStrategyLabel(): string {
    const option = STRATEGY_OPTIONS.find(o => o.value === schedulingConfig.strategy);
    return option ? t(option.labelKey) : t('irImport.scheduling.strategies.balanced');
  }

  function getSelectedDeckLabel(): string {
    const deck = availableDecks.find(d => d.id === selectedDeckId);
    return deck ? `${deck.icon} ${deck.name}` : t('irImport.deck.selectDeck');
  }
  
  /**
   * v5.0 文件化块导入：生成独立的 MD 文件
   */
  async function addImportedBlocksAsFiles(filePaths: string[]): Promise<{ successCount: number; errorCount: number; chunkCount: number }> {
    try {
      await services.init();
      const selectedDeck = availableDecks.find(d => d.id === selectedDeckId);

      if (!irTagGroupService) {
        const pluginAny = plugin as any;
        const service = pluginAny.irTagGroupService ?? new IRTagGroupService(plugin.app);
        irTagGroupService = service;
        await service.initialize();
        pluginAny.irTagGroupService = service;
      }

      const tagGroupService = irTagGroupService;
      if (!tagGroupService) {
        throw new Error(t('irImport.errors.tagGroupInitFailed'));
      }
      
      logger.info(`[MaterialImportModal] 开始文件化块导入: ${filePaths.length} 个文件, 牌组: ${selectedDeck?.name || '未分配'}`);
      logger.info(`[MaterialImportModal] ruleSplitConfig: ${JSON.stringify(ruleSplitConfig)}`);
      
      let assignments: Map<ContentBlock, Date> | null = null;
      if (contentBlocks.length > 0) {
        const schedulingResult = await calculateProjectedScheduling(
          contentBlocks,
          (block) => estimateContentBlockMinutes(block, 500)
        );
        schedulingImpact = schedulingResult.impact;
        assignments = schedulingResult.assignments;
      }

      const mdFilePaths: string[] = [];
      const nonMdFilePaths: string[] = [];
      for (const filePath of filePaths) {
        const file = plugin.app.vault.getAbstractFileByPath(filePath);
        if (file instanceof TFile && file.extension === 'md') {
          mdFilePaths.push(filePath);
        } else {
          nonMdFilePaths.push(filePath);
        }
      }

      let successCount = 0;
      let errorCount = 0;

      if (mdFilePaths.length > 0) {
        const mdResult = ruleSplitConfig.enableWholeFile
          ? wholeFileImportMode === 'reference'
            ? await importWholeMdFilesByReference(mdFilePaths, assignments)
            : await importWholeMdFilesAsCopies(mdFilePaths, assignments)
          : await importMdFilesAsSourceDocuments(mdFilePaths, assignments);
        successCount += mdResult.successCount;
        errorCount += mdResult.errorCount;
      }

      if (nonMdFilePaths.length === 0) {
        logger.info(`[MaterialImportModal] MD 源文档直引导入完成: 成功 ${successCount}, 失败 ${errorCount}`);
        if (successCount > 0) {
          new Notice(t('irImport.notices.importCompleteMd', { count: successCount }));
        }
        return { successCount, errorCount, chunkCount: 0 };
      }

      errorCount += nonMdFilePaths.length;
      logger.warn('[MaterialImportModal] 旧文件化块导入已停用，本次跳过非 Markdown 文件:', nonMdFilePaths);
      new Notice(t('irImport.notices.legacyBlockImportDisabled'), 5000);
      return { successCount, errorCount, chunkCount: 0 };
    } catch (error) {
      logger.error('[MaterialImportModal] 文件化块导入失败:', error);
      new Notice(t('irImport.notices.importFailed', { message: importErrorMessage(error) }));
      return { successCount: 0, errorCount: filePaths.length, chunkCount: 0 };
    }
  }

  function resetModalState() {
    currentStep = 'select';
    selectedFilePath = null;
    selectedFilePaths = [];
    contentBlocks = [];
    fileContent = '';
    markdownImportFolder = '';
    appendSourceDocumentBacklinkOnSplitImport = getSplitSourceBacklinkPreference();
    wholeFileImportMode = 'reference';
    previewIndex = 0;
    importing = false;
    importProgress = { current: 0, total: 0 };
    isPdfImportMode = false;
    isEpubImportMode = false;
    outlineAllItems = [];
    outlineVisibleItems = [];
    outlineSelectedIds = new Set();
    outlineAvailableLevels = [];
    outlineSelectedLevels = [];
    outlineSelectionInitialized = false;
    loadingOutline = false;
    selectedDeckId = null;
    showNewDeckInput = false;
    newDeckName = '';
    schedulingConfig = { ...DEFAULT_SCHEDULING_CONFIG };
    schedulingImpact = null;
    showSchedulingDetails = false;
    useCustomDays = false;
    customDaysValue = 21;
    initialImportOrderingMode = 'preserve-source-order';
    availableDecks = [];
  }

  async function loadAvailableDecks(): Promise<void> {
    try {
      await services.init();
      const decks = await services.deckManager!.getAllDecks();
      availableDecks = decks.filter(d => !d.archivedAt);
      
      // 默认选中第一个牌组（如果有）
      if (availableDecks.length > 0 && !selectedDeckId) {
        selectedDeckId = availableDecks[0].id;
      }
    } catch (error) {
      logger.error('[MaterialImportModal] 加载牌组列表失败:', error);
    }
  }
  
  async function handleCreateNewDeck(): Promise<void> {
    if (!newDeckName.trim() || creatingDeck) return;
    
    creatingDeck = true;
    try {
      await services.init();
      const newDeck = await services.deckManager!.createDeck(newDeckName.trim());
      availableDecks = [...availableDecks, newDeck];
      selectedDeckId = newDeck.id;
      showNewDeckInput = false;
      newDeckName = '';
      logger.info(`[MaterialImportModal] 创建新牌组: ${newDeck.name}`);
    } catch (error) {
      logger.error('[MaterialImportModal] 创建牌组失败:', error);
    } finally {
      creatingDeck = false;
    }
  }
  
  function cancelNewDeck(): void {
    showNewDeckInput = false;
    newDeckName = '';
  }
  
  $effect(() => {
    if (open) {
      resetModalState();
    }
  });
  
  // 当进入预览步骤时加载牌组列表 + 预匹配标签组
  $effect(() => {
    if (currentStep === 'preview') {
      loadAvailableDecks();
      preMatchTagGroup();
    }
  });

  $effect(() => {
    const host = splitSourceBacklinkSettingHost;
    if (!host) {
      return;
    }

    host.replaceChildren();

    if (!shouldShowSplitSourceBacklinkToggle()) {
      return;
    }

    new Setting(host)
      .setName(t('irImport.sourceBacklink.name'))
      .setDesc(t('irImport.sourceBacklink.desc'))
      .addToggle((toggle) => {
        toggle
          .setValue(appendSourceDocumentBacklinkOnSplitImport)
          .onChange((value) => {
            void saveSplitSourceBacklinkPreference(value);
          });
      });
  });

  async function preMatchTagGroup() {
    if (isPdfImportMode || isEpubImportMode) {
      previewTagGroupName = '';
      return;
    }
    try {
      const pluginAny = plugin as any;
      const service = pluginAny.irTagGroupService ?? new IRTagGroupService(plugin.app);
      if (!pluginAny.irTagGroupService) {
        await service.initialize();
        pluginAny.irTagGroupService = service;
      }
      irTagGroupService = service;

      // 取第一个选中文件进行预匹配
      const firstPath = selectedFilePaths[0] || selectedFilePath;
      if (firstPath) {
        const groupId = await service.matchGroupForDocument(firstPath, true);
        const allGroups = await service.getAllGroups();
        const matched = allGroups.find((g: any) => g.id === groupId);
        previewTagGroupName = matched?.name || (groupId === 'default' ? t('irImport.tagGroup.default') : groupId);
      } else {
        previewTagGroupName = '';
      }
    } catch {
      previewTagGroupName = '';
    }
  }

  function toggleSchedulingDetails(): void {
    showSchedulingDetails = !showSchedulingDetails;
    if (!schedulingImpact) {
      void calculateSchedulingImpact();
    }
  }

  function handleCustomDaysInput(value: number): void {
    customDaysValue = value;
    schedulingConfig.distributionDays = customDaysValue;
  }

  function handlePreviewImport(): void {
    if (isMultiFileMode) {
      void handleBatchImport();
    } else {
      void handleSingleFileImport();
    }
  }

  onDestroy(() => {
    // 清理
  });
</script>
{#snippet MaterialImportModalContent()}
  <div class="material-import-modal">
    <MaterialImportStepIndicator {currentStep} {isPdfImportMode} {isEpubImportMode} />

    {#if currentStep === 'select'}
      <MaterialImportFileSelectStep
        app={plugin.app}
        excludedImportFolderPath={excludedImportFolderPath}
        {open}
        {importing}
        {importProgress}
        {isPdfImportMode}
        {isEpubImportMode}
        onNext={goToSplitModeStep}
      />
    {:else if currentStep === 'split-mode'}
      <MaterialImportOutlineStep
        {isPdfImportMode}
        {isEpubImportMode}
        {loadingOutline}
        {outlineAllItems}
        {outlineVisibleItems}
        {outlineAvailableLevels}
        {outlineSelectedLevels}
        {outlineSelectedIds}
        {isMultiFileMode}
        onBack={goBack}
        onConfirm={handleOutlineSelectionConfirm}
        onToggleLevel={toggleOutlineLevel}
        onToggleItem={toggleOutlineItem}
        onSelectAll={selectAllVisibleOutlineItems}
        onSelectNone={clearVisibleOutlineItems}
      />
    {:else if currentStep === 'configure'}
      <MaterialImportConfigureStep
        bind:ruleSplitConfig
        onBack={goBack}
        onConfirm={handleRuleConfigConfirm}
      />
    {:else if currentStep === 'preview'}
      <MaterialImportPreviewStep
        {isPdfImportMode}
        {isEpubImportMode}
        {isMultiFileMode}
        {contentBlocks}
        bind:previewIndex
        {previewTagGroupName}
        {importing}
        {selectedDeckId}
        {availableDecks}
        {showNewDeckInput}
        bind:newDeckName
        {creatingDeck}
        {schedulingConfig}
        {schedulingImpact}
        {showSchedulingDetails}
        {useCustomDays}
        {customDaysValue}
        {initialImportOrderingMode}
        {wholeFileImportMode}
        showWholeFileImportModeSelector={shouldShowWholeFileImportModeSelector()}
        showMarkdownImportFolderSelector={shouldShowMarkdownImportFolderSelector()}
        showSplitSourceBacklinkToggle={shouldShowSplitSourceBacklinkToggle()}
        markdownImportFolderLabel={getMarkdownImportFolderLabel()}
        wholeFileImportModeLabel={getWholeFileImportModeLabel()}
        schedulingDaysLabel={getSchedulingDaysLabel()}
        strategyLabel={getStrategyLabel()}
        initialImportOrderingLabel={getInitialImportOrderingLabel()}
        selectedDeckLabel={getSelectedDeckLabel()}
        showInitialImportOrderingSelector={shouldShowInitialImportOrderingSelector()}
        bind:splitSourceBacklinkSettingHost
        onBack={goBack}
        onImport={handlePreviewImport}
        onShowSchedulingDaysMenu={showSchedulingDaysMenu}
        onShowSchedulingStrategyMenu={showSchedulingStrategyMenu}
        onShowInitialImportOrderingMenu={showInitialImportOrderingMenu}
        onToggleSchedulingDetails={toggleSchedulingDetails}
        onCustomDaysInput={handleCustomDaysInput}
        onShowDeckSelectMenu={showDeckSelectMenu}
        onCreateNewDeck={handleCreateNewDeck}
        onCancelNewDeck={cancelNewDeck}
        onShowWholeFileImportModeMenu={showWholeFileImportModeMenu}
        onShowMarkdownImportFolderMenu={showMarkdownImportFolderMenu}
      />
    {/if}
  </div>
{/snippet}

{#if useObsidianModal}
  {@render MaterialImportModalContent()}
{:else}
  <ResizableModal
    bind:open
    {onClose}
    {plugin}
    title={modalTitle}
    accentColor="cyan"
    enableWindowDrag={true}
    initialWidth={currentStep === 'select' ? 520 : 680}
    initialHeight={560}
  >
    {@render MaterialImportModalContent()}
  </ResizableModal>
{/if}
