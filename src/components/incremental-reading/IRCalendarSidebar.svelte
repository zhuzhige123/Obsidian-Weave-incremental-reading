<script lang="ts">
  /** IR calendar sidebar state and interactions. */
  import { onDestroy, onMount, tick } from 'svelte';
  import { Menu, Notice, Platform, TFile, normalizePath } from 'obsidian';
  import { mount, unmount } from 'svelte';
  import type AnkiObsidianPlugin from '../../main';
  import type { IRDeck, IRBlock, IRBlockV4, IRSession, IRTagGroup } from '../../types/ir-types';
  import { createDefaultIRBlockV4, migrateToIRBlockV4 } from '../../types/ir-types';
  import type { ReadingMaterial } from '../../types/incremental-reading-types';
  import { IRStorageService } from '../../services/incremental-reading/IRStorageService';
  import { IRPointStorageService } from '../../services/incremental-reading/IRPointStorageService';
  import { IRChunkScheduleAdapter } from '../../services/incremental-reading/IRChunkScheduleAdapter';
  import { IRPdfBookmarkTaskService, isPdfBookmarkTaskId } from '../../services/incremental-reading/IRPdfBookmarkTaskService';
  import { IREpubBookmarkTaskService, isEpubBookmarkTaskId } from '../../services/incremental-reading/IREpubBookmarkTaskService';
  import { getIrEpubStorageService } from '../../services/epub-integration/ir-epub-storage-access';
  import type { IrEpubStorageLike } from '../../services/epub-integration/ir-epub-storage-types';
  import { IRPointWriteService } from '../../services/incremental-reading/IRPointWriteService';
  import { IRPointTagService, normalizeReadingPointTags } from '../../services/incremental-reading/IRPointTagService';
  import { IRV4SchedulerService } from '../../services/incremental-reading/IRV4SchedulerService';
import {
  computeAllScheduleMenuBlocks,
  scheduleItemToPreviewBlockV4,
} from '../../services/incremental-reading/IRScheduleModePreviewService';
import {
  buildScheduleModePreviewInput,
  computeScheduleMenuActionBlock,
  persistScheduleMenuActionL0,
  recordScheduleMenuActionInteraction,
} from '../../services/incremental-reading/IRScheduleModeMutationService';
import { getSharedIRScheduleImpactPreviewCoordinator } from '../../services/incremental-reading/IRScheduleImpactPreviewCoordinator';
  import { getSharedIRCalendarQueryService } from '../../services/incremental-reading/IRCalendarQueryService';
  import { getSharedIRProjectionRuntime, type IRProjectionPriorityHydrateResult } from '../../services/incremental-reading/IRProjectionRuntime';
  import { getSharedIRRefreshScheduler } from '../../services/incremental-reading/IRRefreshScheduler';
  import { loadIRCalendarView, hydrateIRCalendarMonthHeatmap } from '../../services/incremental-reading/IRCalendarViewLoadService';
  import {
    buildVisibleDayCountsByDate,
    mergeCalendarDayCountMaps,
  } from '../../services/incremental-reading/IRCalendarDayCountSync';
  import { toCalendarMonthKey } from '../../services/incremental-reading/IRCalendarProjectionUtils';
  import { VIEW_TYPE_IR_CALENDAR } from '../../views/IRCalendarView';
  import { runIdleBatchedTasks } from '../../utils/idle-task-queue';
  import {
    buildScheduleItemFromChunkData,
    buildScheduleItemFromEpubTask,
    buildScheduleItemFromLegacyBlock,
    buildScheduleItemFromPdfTask,
    type ScheduleItem
  } from '../../services/incremental-reading/IRCalendarScheduleItem';
  import { compareScheduleItemsForDailyQueue, assembleScheduleItemsForDailyQueue } from '../../services/incremental-reading/IRScheduleItemSort';
  import {
    capItemLoadMinutes,
    computeDayOverloadLevel,
    computeReadingPointStretchCap,
    computeStretchCeilingMinutes,
    DEFAULT_MAX_ESTIMATED_MINUTES_PER_ITEM,
    type IRDailyLoadDayStats,
  } from '../../services/incremental-reading/IRDailyLoadAllocator';
  import {
    applyLocalSchedulePriorityPatch,
    buildPriorityChangePreviewDetails,
    mergeScheduleItemDateKeys,
    persistSchedulePriorityDaySlices,
    syncScheduleMapsPrioritiesFromWorkspace,
  } from '../../services/incremental-reading/IRSchedulePriorityPatch';
  import {
    recomputeAndBroadcastIRData,
    broadcastPriorityChangeUpdate,
    isProjectionPrimaryDataUpdate,
    type UpdatedEventDetail
  } from '../../services/incremental-reading/IRScheduleRefreshService';
  import { scheduleDebouncedRecomputeAndBroadcastIRData } from '../../services/incremental-reading/IRScheduleRecomputeCoordinator';
  import {
    collectDueDateKeysForScheduleMutation,
    patchDayQueue,
  } from '../../services/incremental-reading/IRPatchDayQueueService';
  import { enqueueScheduleFinalize } from '../../services/incremental-reading/IRScheduleFinalizeCoordinator';
  import { getSharedIRWorkspaceSnapshotService } from '../../services/incremental-reading/IRWorkspaceSnapshotService';
  import { calculatePsi } from '../../services/incremental-reading/IRCoreAlgorithmsV4';
  import ObsidianIcon from '../ui/ObsidianIcon.svelte';
  import FloatingMenu from '../ui/FloatingMenu.svelte';
  import IRPrioritySlider from './IRPrioritySlider.svelte';
  import IRScheduleImpactPreviewPanel, { type PreviewDetails } from './IRScheduleImpactPreviewPanel.svelte';
  import { MaterialImportModalObsidian } from './MaterialImportModalObsidian';
  import { AddReadingTargetModalObsidian } from './AddReadingTargetModalObsidian';
  import { canEditReadingPointLink, resolveReadingPointOpenLink } from '../../services/incremental-reading/reading-point-edit/IRReadingPointEditLinkResolver';
  import { tryOpenReadingPointFromScheduleItem } from '../../services/incremental-reading/reading-point-edit/IRReadingPointOpenNavigation';
  import {
    closeActiveReadingPointPrompt,
    openReadingPointTagsPrompt,
    openReadingPointTraceLinkPrompt,
    promptRenameReadingPoint
  } from '../../services/incremental-reading/reading-point-edit/readingPointQuickEdit';
  import { populateReadingPointTopicSubmenu } from '../../services/incremental-reading/reading-point-edit/readingPointTopicSubmenu';
  import { IRReadingPointBatchService } from '../../services/incremental-reading/reading-point-batch/IRReadingPointBatchService';
  import { populateReadingPointBatchSubmenu } from '../../services/incremental-reading/reading-point-batch/readingPointBatchSubmenu';
  import { resolveScheduleItemWriteTarget } from '../../services/incremental-reading/reading-point-batch/resolveScheduleItemWriteTarget';
  import AddReadingPointModal from './AddReadingPointModal.svelte';
  import { IRAnalyticsModalObsidian } from './IRAnalyticsModalObsidian';
  import {
    IRContinueReadingSuggestionsModalObsidian,
    type IRContinueReadingSuggestionModalItem,
    type IRContinueReadingSuggestionsModalObsidianOptions
  } from './IRContinueReadingSuggestionsModalObsidian';
  import IRBlockInfoModal from './IRBlockInfoModal.svelte';
  import IRReviewReminderModal from './IRReviewReminderModal.svelte';
  import { VaultFileSuggestModal } from '../../modals/VaultFileSuggestModal';
  import {
    createAssociatedMarkdownNote,
    getLinkedVaultNoteLabel,
    openLinkedVaultNote,
    pickLinkableVaultNoteFile,
    populateAssociatedNoteMenu,
    resolvePreferredAssociatedNoteFolder
  } from '../../services/incremental-reading/IRAssociatedNoteMenu';
  import { resolveAssociatedNotePaths } from '../../services/incremental-reading/IRAssociatedNoteSignals';
  import {
    canUsePointLinkedNotes,
    getPointAssociatedNotePath,
    getVisibleAssociatedNotePath,
    hasPointAssociatedNote,
    hasVisibleAssociatedNote as hasVisibleAssociatedNoteBase
  } from '../../services/incremental-reading/IRAssociatedNoteVisibility';
  import type { BatchImportResult } from '../../services/incremental-reading/ReadingMaterialManager';
  import { logger } from '../../utils/logger';
  import { readAdvancedScheduleSettingsSnapshot } from '../../utils/ir-plugin-host-access';
  import { currentLanguage, tr } from '../../utils/i18n';
  import { getChunkTopicIds, getTaskTopicId } from '../../utils/ir-topic-compat';
  import { showObsidianConfirm, showObsidianInput } from '../../utils/obsidian-confirm';
  import { showMissingSourceDocumentModal } from './MissingSourceDocumentModal';
  import { IRMonitoringService } from '../../services/incremental-reading/IRMonitoringService';
  import { resolveScheduleItemWebUrl } from '../../services/incremental-reading/ir-web-reading-point';
  import { resolveScheduleItemTypeBadge, resolveScheduleItemTypeIcon, matchesScheduleItemTypeSearch } from '../../services/incremental-reading/IRCalendarScheduleItemTypeBadge';
  import type { IRCalendarSidebarSettings } from '../../types/plugin-settings.d';
  import type { IRCalendarMaterialListProps } from './ir-calendar-sidebar-types';
  import {
    getIRCalendarTimerRuntimeState,
    setIRCalendarTimerRuntimeState,
    type IRCalendarActiveReadingTimerState
  } from '../../stores/ir-calendar-timer-store';
  import IRCalendarSearchInput from './IRCalendarSearchInput.svelte';
  import { parseSearchQuery, type SearchQuery } from '../../utils/search-parser';
  import { buildMonthCalendarDays, IR_CALENDAR_WEEKDAY_KEYS } from './ir-calendar-date';
  import IRCalendarMaterialList from './IRCalendarMaterialList.svelte';
  import {
    populateCalendarBackgroundWallMenu,
    populateCalendarFolderSubscriptionSyncMenu,
    populateCalendarMaterialImportMenu
  } from './ir-calendar-tools-menu';
  import { IRDataManagementModalObsidian } from './IRDataManagementModalObsidian';
  import { PremiumFeatureGuard, PREMIUM_FEATURES } from '../../services/premium/PremiumFeatureGuard';
  import { ensureIRPremiumFeature } from '../../services/premium/ir-premium';

  interface Props {
    plugin: AnkiObsidianPlugin;
    initialDeckId?: string;
    initialDeckName?: string;
    sourceFilePath?: string;
  }

  interface IRMaterialFinishedEventDetail {
    blockId?: string;
    reason?: 'completed' | 'skipped';
    nextBlockId?: string;
    nextMaterial?: ScheduleItem | null;
    autoStartNextTimer?: boolean;
  }

  const DEFAULT_CALENDAR_BACKGROUND_WALL_FADE_PERCENT = 72;
  const CALENDAR_RECONCILE_INTERACTION_PAUSE_MS = 1600;
  const CALENDAR_RECONCILE_MAX_FAILURES_BEFORE_DEGRADED = 3;
  const CALENDAR_RECONCILE_DEGRADED_COOLDOWN_MS = 30_000;

  type CalendarDataPhase =
    | 'cold_start_blocking'
    | 'warm_ready'
    | 'degraded'
    | 'error_recoverable';

  type CalendarLoadStage =
    | 'idle'
    | 'heatmap'
    | 'tier0_cache'
    | 'index_shell'
    | 'workspace_query'
    | 'schedule_compute'
    | 'day_list_assemble'
    | 'selected_date_index'
    | 'selected_date_query'
    | 'timers';

  const DEFAULT_CALENDAR_SIDEBAR_SETTINGS: Required<IRCalendarSidebarSettings> = {
    continuousReadingEnabled: false,
    autoStartNextTimerEnabled: false,
    showSchedulingPreview: false,
    calendarViewMode: 'full',
    showMaterialTimers: true,
    showReadingPointTypeLabels: false,
    backgroundWall: {
      imagePath: '',
      fadePercent: DEFAULT_CALENDAR_BACKGROUND_WALL_FADE_PERCENT
    }
  };
  const CALENDAR_BACKGROUND_WALL_IMAGE_EXTENSIONS = new Set([
    'png',
    'jpg',
    'jpeg',
    'webp',
    'gif',
    'svg',
    'bmp',
    'avif'
  ]);

  function ensurePremiumFeature(featureId: string): boolean {
    return ensureIRPremiumFeature(plugin.app, featureId);
  }

  function premiumMenuTitle(baseTitle: string, featureId: string): string {
    return PremiumFeatureGuard.getInstance().getFeatureEntryTitle(baseTitle, featureId);
  }

  function shouldShowPremiumFeatureEntry(featureId: string): boolean {
    return PremiumFeatureGuard.getInstance().shouldShowFeatureEntry(featureId);
  }

  function hasVisibleAssociatedNote(material: ScheduleItem): boolean {
    if (!shouldShowPremiumFeatureEntry(PREMIUM_FEATURES.ASSOCIATED_NOTES)) {
      return false;
    }
    return hasVisibleAssociatedNoteBase(material);
  }

  function closeBlockInfoModal() {
    try {
      if (blockInfoModalInstance) {
        unmount(blockInfoModalInstance);
      }
    } catch {
    }
    blockInfoModalInstance = null;

    try {
      blockInfoModalContainer?.remove();
    } catch {
    }
    blockInfoModalContainer = null;
  }

  function closeReminderModal() {
    try {
      if (reminderModalInstance) {
        unmount(reminderModalInstance);
      }
    } catch {
    }
    reminderModalInstance = null;

    try {
      reminderModalContainer?.remove();
    } catch {
    }
    reminderModalContainer = null;
  }

  let {
    plugin,
    initialDeckId = '',
    initialDeckName = '',
    sourceFilePath = ''
  }: Props = $props();
  let t = $derived($tr);

  let currentDate = $state(new Date());
  let selectedDate = $state(new Date());
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const DAY_IN_MS = 24 * 60 * 60 * 1000;
  const SUSPENDED_READING_POINT_TAG_KEYS = new Set([
    '搁置',
    '已搁置',
    '暂停',
    '已暂停',
    '挂起',
    '已挂起',
    'suspend',
    'suspended',
    'paused',
    'pause',
    'on hold',
    'archive',
    'archived'
  ]);


  let irDecks = $state<IRDeck[]>([]);
  let allBlocks = $state<IRBlock[]>([]);
  let isLoading = $state(true);
  /** 仅在首屏尚无可展示日历数据时使用阻塞加载态，后续刷新保持旧数据并后台更新。 */
  let hasHydratedCalendarData = $state(false);
  let calendarDataPhase = $state<CalendarDataPhase>('cold_start_blocking');
  let isSelectedDatePreparing = $state(false);
  let calendarLoadStage = $state<CalendarLoadStage>('idle');
  let calendarListLoadProgressPercent = $state(0);
  let calendarLoadStageUpdatedAt = $state(0);
  let calendarLoadStageTick = $state(0);
  let selectedDateLoadToken = 0;
  let selectedDateHydrationAttemptAtByKey = new Map<string, number>();
  const SELECTED_DATE_HYDRATION_RETRY_MS = 5_000;
  let doneItemsLoadToken = 0;
  let openMaterialInFlightId: string | null = null;
  /** 安排完成后的 L1 本地队列已更新，抑制紧随其后的 complete_block 侧栏重载（避免抖动）。 */
  let suppressSidebarRefreshForDateKey = '';
  let suppressSidebarRefreshUntilMs = 0;
  /** 某日期已尝试过本地切片加载（含空列表），避免 $effect 在「热力有数、列表为空」时死循环。 */
  let selectedDateHydrationCompletedKeys = $state<Set<string>>(new Set());

  let readingMaterials = $state<ReadingMaterial[]>([]);


  let materialsByDate = $state<Map<string, ScheduleItem[]>>(new Map());
  let scheduleDayLoadStatsByDate = $state<Map<string, IRDailyLoadDayStats>>(new Map());
  let calendarDayCountsByDate = $state<Map<string, number>>(new Map());
  let pinnedByDate = $state<Map<string, ScheduleItem[]>>(new Map());
  let continueReadingSuspendedItemsPool = $state<ScheduleItem[]>([]);
  let processedChunkIds = $state(new Set<string>());
  let calendarProgressByDate = $state<Record<string, string[]>>({});
  let irStorage = $state<IRStorageService | null>(null);
  let chunkScheduleAdapter = $state<IRChunkScheduleAdapter | null>(null);
  let pdfBookmarkTaskService = $state<IRPdfBookmarkTaskService | null>(null);
  let epubBookmarkTaskService = $state<IREpubBookmarkTaskService | null>(null);
  let epubStorageService = $state<IrEpubStorageLike | null>(null);
  let pointTagService = $state<IRPointTagService | null>(null);
  let pointWriteService = $state<IRPointWriteService | null>(null);
  let readingPointTagsById = $state<Record<string, string[]>>({});
  let activeReadingTagFilter = $state('');
  let showSearchPanel = $state(false);
  let calendarBackgroundWallImagePath = $state('');
  let calendarBackgroundWallImageUrl = $state('');
  let calendarBackgroundWallFadePercent = $state<number>(DEFAULT_CALENDAR_BACKGROUND_WALL_FADE_PERCENT);
  let searchQuery = $state('');
  let parsedSearchQuery = $state<SearchQuery | null>(null);
  let continueReadingActionIds = $state(new Set<string>());
  let continueReadingResolvedTitleById = $state<Record<string, string>>({});
  let monitoringService = $state<IRMonitoringService | null>(null);
  let v4SchedulerService = $state<IRV4SchedulerService | null>(null);

  let schedulingMenuAnchor = $state<HTMLElement | null>(null);
  let schedulingMenuOpen = $state(false);
  let schedulingMenuTarget = $state<ScheduleItem | null>(null);
  let schedulingMenuDateKey = $state<string>('');
  let schedulingMenuTagGroupIntervalFactor = $state(1);
  let schedulingMenuPreparedBlocks = $state<Record<SchedulingAction, IRBlockV4> | null>(null);

  let priorityMenuAnchor = $state<HTMLElement | null>(null);
  let priorityMenuOpen = $state(false);
  let dayLoadTriggerEl = $state<HTMLButtonElement | null>(null);
  let dayLoadPopoverOpen = $state(false);
  let priorityMenuTarget = $state<ScheduleItem | null>(null);
  let prioritySliderExpanded = $state(true);
  type ImpactedPreviewItem = PreviewDetails['impactedItems'][number];
  type PreviewDayDelta = PreviewDetails['dayDeltas'][number];
  let priorityPreviewDetails = $state<PreviewDetails | null>(null);
  let schedulingPreviewByAction = $state<Record<SchedulingAction, PreviewDetails | null>>({
    intensive: null,
    normal: null,
    slow: null,
    postpone: null
  });
  let schedulingPreviewFocusAction = $state<SchedulingAction>('normal');

  let blockInfoModalContainer: HTMLElement | null = null;
  let blockInfoModalInstance: any | null = null;

  let reminderModalContainer: HTMLElement | null = null;
  let reminderModalInstance: any | null = null;

  let suppressClickOnce = $state(false);

  let longPressTimerId = $state<number | null>(null);
  let longPressStartX = $state(0);
  let longPressStartY = $state(0);
  let longPressTriggered = $state(false);


  let importModalInstance: MaterialImportModalObsidian | null = null;
  let addReadingTargetModalInstance: AddReadingTargetModalObsidian | null = null;
  let analyticsModalInstance: IRAnalyticsModalObsidian | null = null;
  let continueReadingSuggestionsModalInstance: IRContinueReadingSuggestionsModalObsidian | null = null;
  let continueReadingSuggestionsModalOpenSignature = $state('');
  let continueReadingSuggestionsModalDismissedSignature = $state('');
  let continueReadingSuggestionsModalCloseReason = $state<'dismiss' | 'action' | 'refresh'>('dismiss');
  let calendarSidebarEl = $state<HTMLDivElement | null>(null);
  let continueReadingTriggerEl = $state<HTMLButtonElement | null>(null);
  let calendarToolsTriggerEl = $state<HTMLButtonElement | null>(null);


  let showAddReadingPointModal = $state(false);
  let arpDeckId = $state('');
  let arpPdfPath = $state('');
  let arpParentTitle = $state('');

  let continuousReadingEnabled = $state(false);

  let showSchedulingPreview = $state(false);
  let showReadingPointTypeLabels = $state(false);
  let calendarViewMode = $state<'full' | 'two-row'>('full');
  let expandedMaterialIds = $state(new Set<string>());
  let siblingCache = $state(new Map<string, ScheduleItem[]>());
  let loadingSiblings = $state(new Set<string>());
  type ActiveReadingTimerState = IRCalendarActiveReadingTimerState;
  type TimerPauseReason = 'manual' | 'switch' | 'completed' | 'skipped';
  let activeReadingTimer = $state<ActiveReadingTimerState | null>(null);
  let timerTotalsByBlockId = $state<Record<string, number>>({});
  let timerNowMs = $state(Date.now());
  let timerTickIntervalId = $state<number | null>(null);
  let timerBusyBlockId = $state<string | null>(null);
  let batchSelectedIds = $state(new Set<string>());
  let batchSelectionMode = $state(false);
  let lastBatchSelectionAnchorId = $state<string | null>(null);
  let readingPointBatchService: IRReadingPointBatchService | null = null;
  let loadDataRequestId = 0;
  let loadDataInFlight: Promise<void> | null = null;
  let loadDataQueued = false;
  let loadDataQueuedForceRecompute = false;
  let lazyMetadataLoadedDateKeys = new Set<string>();
  let unsubscribeProjectionRuntime: (() => void) | null = null;
  let backgroundReconcilePausedUntilMs = 0;
  let reconcileFailureStreak = 0;
  let reconcileDegradedUntilMs = 0;
  let searchScopeLoadInFlight = false;
  /** 过期磁盘缓存展示后，后台 reconcile 需 forceRecompute 以重建负载均衡日程 */
  let calendarScheduleNeedsRecompute = $state(false);
  /** 侧栏不可见或 Obsidian 窗口隐藏时暂停后台 reconcile，避免与其它插件抢主线程 */
  let calendarBackgroundPaused = $state(false);
  let lastAppliedScheduleGeneratedAt = 0;
  let pendingLocalRefreshGeneratedAt = 0;
  let lastLocallyHandledBroadcastGeneratedAt = 0;
  let debounceTimer: number | null = null;

  function getWorkspaceSnapshotService() {
    return getSharedIRWorkspaceSnapshotService(plugin.app);
  }

  function getCalendarQueryService() {
    return getSharedIRCalendarQueryService(plugin.app);
  }

  async function getWorkspaceChunkById(chunkId: string): Promise<any | null> {
    const normalizedId = String(chunkId || '').trim();
    if (!normalizedId) return null;

    const cachedSnapshot = getWorkspaceSnapshotService().getCachedWorkspaceData();
    if (cachedSnapshot?.chunksRecord[normalizedId]) {
      return cachedSnapshot.chunksRecord[normalizedId];
    }

    const storage = await getStorage();
    return await storage.getChunkData(normalizedId);
  }

  async function getWorkspaceLegacyBlockById(blockId: string): Promise<IRBlock | null> {
    const normalizedId = String(blockId || '').trim();
    if (!normalizedId) return null;

    const storage = await getStorage();
    return await storage.getBlock(normalizedId);
  }

  async function getWorkspacePdfTaskById(taskId: string): Promise<any | null> {
    const normalizedId = String(taskId || '').trim();
    if (!normalizedId) return null;

    const cachedSnapshot = getWorkspaceSnapshotService().getCachedWorkspaceData();
    const cachedTask = cachedSnapshot?.pdfTasks.find(
      (entry: any) => String(entry?.id || '').trim() === normalizedId
    );
    if (cachedTask) {
      return cachedTask;
    }

    const pdfService = await getPdfBookmarkTaskService();
    return await pdfService.getTask(normalizedId);
  }

  async function getWorkspaceEpubTaskById(taskId: string): Promise<any | null> {
    const normalizedId = String(taskId || '').trim();
    if (!normalizedId) return null;

    const cachedSnapshot = getWorkspaceSnapshotService().getCachedWorkspaceData();
    const cachedTask = cachedSnapshot?.epubTasks.find(
      (entry: any) => String(entry?.id || '').trim() === normalizedId
    );
    if (cachedTask) {
      return cachedTask;
    }

    const epubService = await getEpubBookmarkTaskService();
    return await epubService.getTask(normalizedId);
  }

  function syncTimerRuntimeState(): void {
    setIRCalendarTimerRuntimeState({
      activeReadingTimer: activeReadingTimer ? { ...activeReadingTimer } : null
    });
  }

  function restoreTimerRuntimeState(): void {
    const runtimeState = getIRCalendarTimerRuntimeState();
    activeReadingTimer = runtimeState.activeReadingTimer
      ? { ...runtimeState.activeReadingTimer }
      : null;
    timerNowMs = Date.now();

    if (activeReadingTimer) {
      ensureTimerTicker();
    } else {
      clearTimerTicker();
    }
  }

  async function removeLocalMaterialReferencesBatch(materialIds: Iterable<string>): Promise<void> {
    const normalizedIds = new Set(
      Array.from(materialIds, (materialId) => String(materialId || '').trim()).filter(Boolean)
    );
    if (normalizedIds.size === 0) {
      return;
    }

    const filterMapItems = (input: Map<string, ScheduleItem[]>): Map<string, ScheduleItem[]> => {
      const next = new Map<string, ScheduleItem[]>();
      for (const [dateKey, items] of input.entries()) {
        const filtered = items.filter((item) => !normalizedIds.has(item.id));
        if (filtered.length > 0) {
          next.set(dateKey, filtered);
        }
      }
      return next;
    };

    materialsByDate = filterMapItems(materialsByDate);
    pinnedByDate = filterMapItems(pinnedByDate);
    siblingCache = filterMapItems(siblingCache);

    processedChunkIds = new Set(Array.from(processedChunkIds).filter((id) => !normalizedIds.has(id)));

    const nextCalendarProgress: Record<string, string[]> = {};
    for (const [dateKey, ids] of Object.entries(calendarProgressByDate)) {
      const filtered = ids.filter((id) => !normalizedIds.has(id));
      if (filtered.length > 0) {
        nextCalendarProgress[dateKey] = filtered;
      }
    }
    calendarProgressByDate = nextCalendarProgress;

    batchSelectedIds = new Set(Array.from(batchSelectedIds).filter((id) => !normalizedIds.has(id)));

    const storage = await getStorage();
    for (const materialId of normalizedIds) {
      await storage.removeCalendarCompletion(materialId);
    }
  }

  async function removeLocalMaterialReferences(materialId: string): Promise<void> {
    await removeLocalMaterialReferencesBatch([materialId]);
  }

  function getCalendarSidebarSettings(): Required<IRCalendarSidebarSettings> {
    const raw = typeof plugin.getIRCalendarSidebarSettings === 'function'
      ? plugin.getIRCalendarSidebarSettings()
      : plugin.settings?.incrementalReading?.calendarSidebar;
    return {
      ...DEFAULT_CALENDAR_SIDEBAR_SETTINGS,
      ...(raw || {}),
      backgroundWall: {
        ...DEFAULT_CALENDAR_SIDEBAR_SETTINGS.backgroundWall,
        ...(raw?.backgroundWall || {})
      }
    };
  }

  function applyCalendarSidebarSettingsFromPlugin(): void {
    const settings = getCalendarSidebarSettings();
    continuousReadingEnabled = settings.continuousReadingEnabled;
    showSchedulingPreview = settings.showSchedulingPreview;
    showReadingPointTypeLabels = settings.showReadingPointTypeLabels === true;
    calendarViewMode = settings.calendarViewMode;
    updateCalendarBackgroundWallState(settings.backgroundWall?.imagePath || '');
    calendarBackgroundWallFadePercent = normalizeCalendarBackgroundWallFadePercent(settings.backgroundWall?.fadePercent);

    if (!continuousReadingEnabled) {
      expandedMaterialIds = new Set();
    }
  }

  async function saveCalendarSidebarSettings(patch: Partial<IRCalendarSidebarSettings>): Promise<void> {
    const currentSettings = getCalendarSidebarSettings();

    const nextSettings: IRCalendarSidebarSettings = {
      ...currentSettings,
      ...patch,
      backgroundWall: {
        ...(currentSettings.backgroundWall || {}),
        ...(patch.backgroundWall || {})
      }
    };

    if (typeof plugin.saveIRCalendarSidebarSettings === 'function') {
      await plugin.saveIRCalendarSidebarSettings(nextSettings);
      return;
    }

    if (!plugin.settings.incrementalReading) {
      plugin.settings.incrementalReading = {};
    }

    plugin.settings.incrementalReading.calendarSidebar = nextSettings;
    await plugin.saveSettings();
  }

  async function setContinuousReadingEnabled(enabled: boolean): Promise<void> {
    continuousReadingEnabled = enabled;
    if (!enabled) {
      expandedMaterialIds = new Set();
    }

    try {
      await saveCalendarSidebarSettings({ continuousReadingEnabled: enabled });
    } catch (error) {
      logger.warn('[IRCalendarSidebar] Failed to save sidebar settings:', error);
      new Notice(t('irSidebar.notices.settingsSaveFailed'));
    }
  }

  async function setCalendarBackgroundWallFadePercent(fadePercent: number): Promise<void> {
    const nextFadePercent = normalizeCalendarBackgroundWallFadePercent(fadePercent);
    const previousFadePercent = calendarBackgroundWallFadePercent;
    calendarBackgroundWallFadePercent = nextFadePercent;

    try {
      await saveCalendarSidebarSettings({
        backgroundWall: {
          fadePercent: nextFadePercent
        }
      });
      new Notice(t('irSidebar.notices.backgroundWallFadeSet'));
    } catch (error) {
      logger.warn('[IRCalendarSidebar] Failed to save calendar background wall fade percent:', error);
      calendarBackgroundWallFadePercent = previousFadePercent;
      new Notice(t('irSidebar.notices.settingsSaveFailed'));
    }
  }

  async function promptCalendarBackgroundWallFadePercent(): Promise<void> {
    const input = await showObsidianInput(
      plugin.app,
      t('irSidebar.header.backgroundWallFadePrompt'),
      String(calendarBackgroundWallFadePercent),
      {
        title: t('irSidebar.header.backgroundWallFadeTitle'),
        placeholder: t('irSidebar.header.backgroundWallFadePlaceholder'),
        confirmText: t('irSidebar.header.backgroundWallFadeSet', { value: Number(calendarBackgroundWallFadePercent) })
      }
    );

    if (input === null) {
      return;
    }

    const trimmed = String(input || '').trim();
    if (!/^\d+$/.test(trimmed)) {
      new Notice(t('irSidebar.notices.backgroundWallFadeInvalid'));
      return;
    }

    const value = Number(trimmed);
    if (!Number.isInteger(value) || value < 0 || value > 100) {
      new Notice(t('irSidebar.notices.backgroundWallFadeInvalid'));
      return;
    }

    await setCalendarBackgroundWallFadePercent(value);
  }

  async function setCalendarViewMode(nextMode: 'full' | 'two-row'): Promise<void> {
    calendarViewMode = nextMode;

    try {
      await saveCalendarSidebarSettings({ calendarViewMode: nextMode });
    } catch (error) {
      logger.warn('[IRCalendarSidebar] Failed to save calendar view mode:', error);
      new Notice(t('irSidebar.notices.settingsSaveFailed'));
    }
  }

  async function setShowSchedulingPreviewEnabled(enabled: boolean): Promise<void> {
    showSchedulingPreview = enabled;

    try {
      await saveCalendarSidebarSettings({ showSchedulingPreview: enabled });
      if (enabled && schedulingMenuOpen && schedulingMenuTarget) {
        applySchedulingMenuDatesSync(schedulingMenuTarget);
        const loadToken = ++schedulingPreviewLoadToken;
        void refineSchedulingMenuPreviews(schedulingMenuTarget, loadToken);
      }
    } catch (error) {
      logger.warn('[IRCalendarSidebar] Failed to save preview setting:', error);
      new Notice(t('irSidebar.notices.settingsSaveFailed'));
    }
  }

  async function setShowReadingPointTypeLabelsEnabled(enabled: boolean): Promise<void> {
    showReadingPointTypeLabels = enabled;

    try {
      await saveCalendarSidebarSettings({ showReadingPointTypeLabels: enabled });
    } catch (error) {
      logger.warn('[IRCalendarSidebar] Failed to save reading point type label setting:', error);
      new Notice(t('irSidebar.notices.settingsSaveFailed'));
    }
  }

  function getReadingPointTypeIndicator(material: ScheduleItem): { icon: string; label: string } | null {
    if (!showReadingPointTypeLabels) {
      return null;
    }

    const badge = resolveScheduleItemTypeBadge(plugin.app, material);
    if (!badge) {
      return null;
    }

    return {
      icon: resolveScheduleItemTypeIcon(badge),
      label: t(`irSidebar.controls.readingPointType.${badge}`)
    };
  }

  function isCalendarBackgroundWallImageFile(file: TFile | null | undefined): file is TFile {
    if (!(file instanceof TFile)) {
      return false;
    }
    return CALENDAR_BACKGROUND_WALL_IMAGE_EXTENSIONS.has(String(file.extension || '').toLowerCase());
  }

  function normalizeCalendarBackgroundWallFadePercent(value: unknown): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return DEFAULT_CALENDAR_BACKGROUND_WALL_FADE_PERCENT;
    }
    return Math.max(0, Math.min(100, Math.round(parsed)));
  }

  function getCalendarBackgroundWallImageFiles(): TFile[] {
    return plugin.app.vault
      .getFiles()
      .filter((file) => isCalendarBackgroundWallImageFile(file))
      .sort((left, right) => {
        const timeDelta = Number(right.stat?.mtime || 0) - Number(left.stat?.mtime || 0);
        if (timeDelta !== 0) {
          return timeDelta;
        }
        return left.path.localeCompare(right.path, 'zh-CN');
      });
  }

  function resolveCalendarBackgroundWallImageUrl(imagePath: string): string {
    const normalizedPath = normalizePath(String(imagePath || '').trim());
    if (!normalizedPath) {
      return '';
    }

    const abstractFile = plugin.app.vault.getAbstractFileByPath(normalizedPath);
    const file = abstractFile instanceof TFile ? abstractFile : null;
    if (!isCalendarBackgroundWallImageFile(file)) {
      return '';
    }

    try {
      return plugin.app.vault.getResourcePath(file);
    } catch (error) {
      logger.warn('[IRCalendarSidebar] Failed to resolve calendar background wall image URL:', error);
      return '';
    }
  }

  function updateCalendarBackgroundWallState(imagePath: string): void {
    calendarBackgroundWallImagePath = normalizePath(String(imagePath || '').trim());
    calendarBackgroundWallImageUrl = resolveCalendarBackgroundWallImageUrl(calendarBackgroundWallImagePath);
  }

  async function chooseCalendarBackgroundWallImage(): Promise<void> {
    const picker = new VaultFileSuggestModal(plugin.app, {
      placeholder: t('irSidebar.header.backgroundWallPickerPlaceholder'),
      files: getCalendarBackgroundWallImageFiles(),
      icon: 'image',
      showFileIcon: false,
      showFilePath: false,
      anchorRect: calendarToolsTriggerEl?.getBoundingClientRect() ?? undefined,
      preferredWidth: 540
    });

    const file = await picker.openAndSelect();
    if (!file) {
      return;
    }

    const nextPath = normalizePath(file.path);
    updateCalendarBackgroundWallState(nextPath);

    try {
      await saveCalendarSidebarSettings({
        backgroundWall: {
          imagePath: nextPath
        }
      });
      new Notice(t('irSidebar.notices.backgroundWallSet'));
    } catch (error) {
      logger.warn('[IRCalendarSidebar] Failed to save calendar background wall image:', error);
      updateCalendarBackgroundWallState(getCalendarSidebarSettings().backgroundWall?.imagePath || '');
      new Notice(t('irSidebar.notices.settingsSaveFailed'));
    }
  }

  async function clearCalendarBackgroundWallImage(): Promise<void> {
    updateCalendarBackgroundWallState('');

    try {
      await saveCalendarSidebarSettings({
        backgroundWall: {
          imagePath: ''
        }
      });
      new Notice(t('irSidebar.notices.backgroundWallCleared'));
    } catch (error) {
      logger.warn('[IRCalendarSidebar] Failed to clear calendar background wall image:', error);
      updateCalendarBackgroundWallState(getCalendarSidebarSettings().backgroundWall?.imagePath || '');
      new Notice(t('irSidebar.notices.settingsSaveFailed'));
    }
  }

  function formatDateKey(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  function parseDateKey(dateKey: string): Date | null {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateKey || '').trim());
    if (!match) return null;
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }

  function handleSearch(query: string): void {
    searchQuery = query;
    parsedSearchQuery = query.trim() ? parseSearchQuery(query) : null;
    if (query.trim()) {
      void ensureSearchScopeLoaded();
    }
  }

  function collectVisibleMonthDateKeys(): string[] {
    const days = getCalendarDisplayDays(getMonthDays(currentDate.getFullYear(), currentDate.getMonth()));
    return Array.from(
      new Set(days.map((day) => formatDateKey(day.date)).filter(Boolean))
    );
  }

  async function ensureSearchScopeLoaded(): Promise<void> {
    if (searchScopeLoadInFlight) {
      return;
    }
    const dateKeys = collectVisibleMonthDateKeys();
    if (dateKeys.length === 0) {
      return;
    }
    const missingDateKeys = dateKeys.filter((dateKey) => {
      const items = materialsByDate.get(dateKey);
      return !items || items.length === 0;
    });
    if (missingDateKeys.length === 0) {
      return;
    }

    searchScopeLoadInFlight = true;
    try {
      const deckIds = getActiveDeckIdsForQuery();
      const projection = await getSharedIRProjectionRuntime(plugin.app).hydratePriorityDatesFromProjection(
        deckIds,
        missingDateKeys
      );
      if (projection) {
        applyProjectionLoadResult(projection, missingDateKeys);
      }
      scheduleBackgroundCalendarReconcile(missingDateKeys, deckIds, 'search-r3');
    } catch (error) {
      logger.warn('[IRCalendarSidebar] search scope load failed:', error);
    } finally {
      searchScopeLoadInFlight = false;
    }
  }

  function clearSearch(): void {
    searchQuery = '';
    parsedSearchQuery = null;
  }

  function toggleSearchPanel(): void {
    if (showSearchPanel) {
      showSearchPanel = false;
      clearSearch();
      return;
    }

    showSearchPanel = true;
  }

  function getRequestedDeckFilterId(): string {
    return String(initialDeckId || '').trim();
  }

  function getActiveDeckFilterId(): string {
    const requestedId = getRequestedDeckFilterId();
    return requestedId ? resolveCanonicalDeckId(requestedId) : '';
  }

  function getActiveDeckFilterName(): string {
    const activeDeckId = getActiveDeckFilterId();
    if (!activeDeckId) return '';
    const matchedDeck = irDecks.find((deck) => resolveCanonicalDeckId(deck.id) === activeDeckId);
    return matchedDeck?.name || String(initialDeckName || '').trim() || activeDeckId;
  }

  function matchesActiveDeckFilter(item: ScheduleItem): boolean {
    const activeDeckId = getActiveDeckFilterId();
    if (!activeDeckId) return true;
    return resolveCanonicalDeckId(item.deckId || '') === activeDeckId;
  }

  function getVisibleMaterialsForDate(dateKey: string): ScheduleItem[] {
    return (materialsByDate.get(dateKey) || []).filter(matchesActiveDeckFilter);
  }

  function getVisiblePinnedForDate(dateKey: string): ScheduleItem[] {
    return (pinnedByDate.get(dateKey) || []).filter(matchesActiveDeckFilter);
  }

  function matchesActiveTagFilter(material: ScheduleItem): boolean {
    const normalizedFilter = activeReadingTagFilter.trim().toLowerCase();
    if (!normalizedFilter) {
      return true;
    }

    return getMaterialTagLabels(material.id).some((tag) => tag.toLowerCase() === normalizedFilter);
  }

  function getScheduleItemDeckName(material: ScheduleItem): string {
    const deckId = resolveCanonicalDeckId(material.deckId || '');
    if (!deckId) {
      return '';
    }

    const matchedDeck = irDecks.find((deck) => resolveCanonicalDeckId(deck.id) === deckId);
    return String(matchedDeck?.name || '').trim();
  }

  function getScheduleItemSourceTFile(material: ScheduleItem): TFile | null {
    const abstractFile = plugin.app.vault.getAbstractFileByPath(String(material.sourceFile || '').trim());
    return abstractFile instanceof TFile ? abstractFile : null;
  }

  function getScheduleItemFrontmatter(material: ScheduleItem): Record<string, unknown> {
    const file = getScheduleItemSourceTFile(material);
    if (!file || file.extension !== 'md') {
      return {};
    }

    return (plugin.app.metadataCache.getFileCache(file)?.frontmatter as Record<string, unknown> | undefined) || {};
  }

  function getReadingMaterialByPath(filePath: string): ReadingMaterial | undefined {
    const normalizedPath = normalizePath(String(filePath || '').trim());
    if (!normalizedPath) {
      return undefined;
    }

    return readingMaterials.find((material) => normalizePath(String(material.filePath || '').trim()) === normalizedPath);
  }

  function getScheduleItemCreatedDate(material: ScheduleItem): string {
    const readingMaterial = getReadingMaterialByPath(material.sourceFile);
    if (readingMaterial?.created) {
      return String(readingMaterial.created).slice(0, 10);
    }

    const file = getScheduleItemSourceTFile(material);
    return file ? new Date(file.stat.ctime).toISOString().slice(0, 10) : '';
  }

  function getScheduleItemModifiedDate(material: ScheduleItem): string {
    const readingMaterial = getReadingMaterialByPath(material.sourceFile);
    if (readingMaterial?.modified) {
      return String(readingMaterial.modified).slice(0, 10);
    }

    const file = getScheduleItemSourceTFile(material);
    return file ? new Date(file.stat.mtime).toISOString().slice(0, 10) : '';
  }

  function getScheduleItemDueDate(material: ScheduleItem): string {
    if (material.nextReviewDate instanceof Date && !Number.isNaN(material.nextReviewDate.getTime())) {
      return material.nextReviewDate.toISOString().slice(0, 10);
    }

    if (material.nextRepDate > 0) {
      return new Date(material.nextRepDate).toISOString().slice(0, 10);
    }

    return '';
  }

  function matchesDateRanges(
    dateValue: string,
    ranges: Array<{ from?: string; to?: string }>
  ): boolean {
    if (ranges.length === 0) {
      return true;
    }

    if (!dateValue) {
      return false;
    }

    return ranges.every((range) => {
      if (range.from && dateValue < range.from) return false;
      if (range.to && dateValue > range.to) return false;
      return true;
    });
  }

  function matchesAnyTokens(value: string, tokens: string[]): boolean {
    if (tokens.length === 0) {
      return true;
    }

    const normalizedValue = value.toLowerCase();
    return tokens.some((token) => normalizedValue.includes(token.toLowerCase()));
  }

  function excludesAllTokens(value: string, tokens: string[]): boolean {
    if (tokens.length === 0) {
      return true;
    }

    const normalizedValue = value.toLowerCase();
    return tokens.every((token) => !normalizedValue.includes(token.toLowerCase()));
  }

  function getScheduleItemSearchText(material: ScheduleItem): string {
    const frontmatter = getScheduleItemFrontmatter(material);
    const readingMaterial = getReadingMaterialByPath(material.sourceFile);
    const readingId = String(
      frontmatter['weave-reading-id'] || readingMaterial?.uuid || ''
    ).trim();
    return [
      material.id,
      readingId,
      material.displayName,
      material.title,
      material.sourceFile,
      material.resumeLink,
      getVisibleAssociatedNotePath(material),
      getScheduleItemDeckName(material),
      ...getMaterialTagLabels(material.id)
    ]
      .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      .join(' ')
      .toLowerCase();
  }

  function matchesSearchQueryForMaterial(material: ScheduleItem, query: SearchQuery): boolean {
    if (!query.raw.trim()) {
      return true;
    }

    const deckName = getScheduleItemDeckName(material);
    const sourceFile = String(material.sourceFile || '');
    const tags = getMaterialTagLabels(material.id);
    const tagText = tags.join(' ').toLowerCase();
    const stateText = String(material.scheduleStatus || '').toLowerCase();
    const searchText = getScheduleItemSearchText(material);

    if (query.decks.length > 0 && !matchesAnyTokens(deckName, query.decks)) {
      return false;
    }

    if (query.tags.length > 0 && !query.tags.some((tag) => tagText.includes(tag.toLowerCase()))) {
      return false;
    }

    if (query.priorities.length > 0 && !query.priorities.includes(Number(material.priority || 0))) {
      return false;
    }

    if (query.sources.length > 0 && !matchesAnyTokens(sourceFile, query.sources)) {
      return false;
    }

    if (query.statuses.length > 0 && !query.statuses.some((status) => stateText.includes(status.toLowerCase()))) {
      return false;
    }

    if (query.states.length > 0 && !query.states.some((state) => stateText.includes(state.toLowerCase()))) {
      return false;
    }

    if (
      !matchesScheduleItemTypeSearch(
        plugin.app,
        material,
        query.types,
        query.excludeTypes
      )
    ) {
      return false;
    }

    if (!matchesDateRanges(getScheduleItemCreatedDate(material), query.dateRanges)) {
      return false;
    }

    if (!matchesDateRanges(getScheduleItemModifiedDate(material), query.modifiedRanges)) {
      return false;
    }

    if (!matchesDateRanges(getScheduleItemDueDate(material), query.dueRanges)) {
      return false;
    }

    if (query.yamlFilters.length > 0) {
      const frontmatter = getScheduleItemFrontmatter(material);
      const matchesYaml = query.yamlFilters.every((filter) => {
        const rawValue = frontmatter[filter.key];
        if (rawValue === undefined || rawValue === null) {
          return false;
        }

        const valueText = Array.isArray(rawValue) ? rawValue.join(' ') : String(rawValue);
        return valueText.toLowerCase().includes(filter.value.toLowerCase());
      });
      if (!matchesYaml) {
        return false;
      }
    }

    if (!excludesAllTokens(deckName, query.excludeDecks)) {
      return false;
    }

    if (query.excludeTags.length > 0 && query.excludeTags.some((tag) => tagText.includes(tag.toLowerCase()))) {
      return false;
    }

    if (!excludesAllTokens(sourceFile, query.excludeSources)) {
      return false;
    }

    if (query.excludeStatuses.length > 0 && query.excludeStatuses.some((status) => stateText.includes(status.toLowerCase()))) {
      return false;
    }

    if (query.text.length > 0 && !query.text.every((text) => searchText.includes(text.toLowerCase()))) {
      return false;
    }

    if (query.excludeText.length > 0 && query.excludeText.some((text) => searchText.includes(text.toLowerCase()))) {
      return false;
    }

    return true;
  }

  function formatSearchResultDateLabel(dateKey: string): string {
    const parsed = parseDateKey(dateKey);
    if (!parsed) {
      return dateKey;
    }

    if (isSameDay(parsed, today)) {
      return t('irSidebar.controls.today');
    }

    if (parsed.getFullYear() === today.getFullYear()) {
      return t('irSidebar.calendar.dateMonthDay', {
        month: parsed.getMonth() + 1,
        day: parsed.getDate()
      });
    }

    return t('irSidebar.calendar.dateFull', {
      year: parsed.getFullYear(),
      month: parsed.getMonth() + 1,
      day: parsed.getDate()
    });
  }

  function getSearchableScheduleEntries(): SearchResultEntry[] {
    const merged = new Map<string, SearchResultEntry>();
    const appendEntries = (input: Map<string, ScheduleItem[]>) => {
      for (const [dateKey, items] of input.entries()) {
        for (const item of items) {
          if (!matchesActiveDeckFilter(item) || merged.has(item.id)) {
            continue;
          }

          merged.set(item.id, { item, dateKey });
        }
      }
    };

    appendEntries(materialsByDate);
    appendEntries(pinnedByDate);

    return Array.from(merged.values()).sort((left, right) => {
      const dateCompare = left.dateKey.localeCompare(right.dateKey);
      if (dateCompare !== 0) {
        return dateCompare;
      }

      return compareScheduleItemsForDailyQueue(left.item, right.item, left.dateKey);
    });
  }

  function getMatchedSearchEntries(): SearchResultEntry[] {
    const query = parsedSearchQuery;
    if (!query?.raw.trim()) {
      return [];
    }

    return getSearchableScheduleEntries().filter(
      (entry) => matchesActiveTagFilter(entry.item) && matchesSearchQueryForMaterial(entry.item, query)
    );
  }

  function getDisplayedMaterialDateLabel(materialId: string, dateKeys: Map<string, string>): string {
    const dateKey = dateKeys.get(materialId);
    return dateKey ? formatSearchResultDateLabel(dateKey) : '';
  }

  function getSearchResultIdentityKey(material: ScheduleItem): string {
    const normalizedSource = normalizeSourcePathKey(material.sourceFile);
    if (normalizedSource) {
      return `${material.id}::${normalizedSource}`;
    }

    const title = String(material.title || '').trim();
    if (title) {
      return title;
    }

    return material.id;
  }

  function getScheduleItemLabel(material: ScheduleItem): string {
    const displayName = String(material.displayName || '').trim();
    if (displayName) {
      return displayName;
    }

    const title = String(material.title || '').trim();
    if (title) {
      return title;
    }

    const cachedResolvedTitle = String(continueReadingResolvedTitleById[material.id] || '').trim();
    if (cachedResolvedTitle) {
      return cachedResolvedTitle;
    }

    const sourceLabel = getSourceDisplayLabel(material.sourceFile);
    return sourceLabel || t('irSidebar.calendar.untitledPoint');
  }

  function getScheduleItemSourceLabel(material: ScheduleItem): string {
    if (isEpubBookmarkTaskId(material.id)) {
      return t('irSidebar.calendar.epubSource');
    }

    if (isPdfBookmarkTaskId(material.id)) {
      return t('irSidebar.calendar.pdfSource');
    }

    return t('irSidebar.calendar.sourceDocument');
  }

  async function showMissingSourceDocumentDialog(
    material: ScheduleItem,
    sourcePath?: string
  ): Promise<void> {
    const itemLabel = getScheduleItemLabel(material);
    const sourceLabel = getScheduleItemSourceLabel(material);
    const normalizedPath = String(sourcePath || material.sourceFile || '').trim();
    const messageLines = [
      t('irSidebar.calendar.sourceNotFoundFor', { itemLabel, sourceLabel }),
      normalizedPath
        ? t('irSidebar.calendar.recordedPath', { path: normalizedPath })
        : t('irSidebar.calendar.noSourcePath'),
      t('irSidebar.calendar.sourceMissingHint')
    ];

    const action = await showMissingSourceDocumentModal(plugin.app, {
      title: t('irSidebar.calendar.sourceNotFoundTitle'),
      message: messageLines,
      acknowledgeText: t('irSidebar.calendar.gotIt'),
      removeButtonText: t('irSidebar.calendar.removeThisPoint'),
      removeDescription: t('irSidebar.calendar.removeSourceMissingDesc'),
      onRemove: async () => {
        await removeMaterial(material, { sourceMissing: true });
      }
    });

    if (action === 'remove') {
      return;
    }
  }

  function isWeakContinueReadingLabel(label: string, material: ScheduleItem): boolean {
    const normalized = String(label || '').trim();
    if (!normalized) {
      return true;
    }

    if (/^untitled$/i.test(normalized)) {
      return true;
    }

    if (material.sourceType === 'chunk') {
      if (/^\d+_?$/.test(normalized)) {
        return true;
      }
      if (/^chunk-[a-z0-9-]+$/i.test(normalized)) {
        return true;
      }
    }

    return false;
  }

  function sanitizeContinueReadingPreviewText(rawText: string): string {
    const cleaned = String(rawText || '')
      .replace(/^#+\s*/, '')
      .replace(/^>\s*/, '')
      .replace(/^\s*[-*+]\s+/, '')
      .replace(/^\s*\d+\.\s+/, '')
      .replace(/\[\[([^\]|]+)(\|[^\]]+)?\]\]/g, '$1')
      .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/\s+/g, ' ')
      .trim();

    return cleaned.length > 60 ? `${cleaned.slice(0, 60).trim()}...` : cleaned;
  }

  async function deriveContinueReadingTitleFromChunkFile(material: ScheduleItem): Promise<string> {
    const normalizedPath = normalizePath(String(material.sourceFile || '').trim());
    if (!normalizedPath) {
      return '';
    }

    const file = plugin.app.vault.getAbstractFileByPath(normalizedPath);
    if (!(file instanceof TFile)) {
      return '';
    }

    try {
      const content = await plugin.app.vault.read(file);
      const withoutFrontmatter = content.replace(/^---\n[\s\S]*?\n---\n?/, '');
      const lines = withoutFrontmatter.split(/\r?\n/);

      for (const rawLine of lines) {
        const headingMatch = String(rawLine || '').match(/^\s*#{1,6}\s+(.+)$/);
        if (!headingMatch?.[1]) {
          continue;
        }

        const cleanedHeading = sanitizeContinueReadingPreviewText(headingMatch[1]);
        if (cleanedHeading) {
          return cleanedHeading;
        }
      }

      for (const rawLine of lines) {
        const cleaned = sanitizeContinueReadingPreviewText(rawLine);
        if (cleaned) {
          return cleaned;
        }
      }
    } catch (error) {
      logger.warn('[IRCalendarSidebar] Failed to derive continue-reading title from chunk file', {
        path: normalizedPath,
        error
      });
    }

    return '';
  }

  async function resolveContinueReadingSuggestionTitle(material: ScheduleItem): Promise<string> {
    const cached = String(continueReadingResolvedTitleById[material.id] || '').trim();
    if (cached) {
      return cached;
    }

    const directLabel = getScheduleItemLabel(material);
    if (!isWeakContinueReadingLabel(directLabel, material)) {
      return directLabel;
    }

    let resolved = '';
    if (material.sourceType === 'chunk') {
      resolved = await deriveContinueReadingTitleFromChunkFile(material);
    }

    if (!resolved) {
      const fallbackTitle = String(material.title || '').trim();
      if (fallbackTitle && !isWeakContinueReadingLabel(fallbackTitle, material)) {
        resolved = fallbackTitle;
      }
    }

    if (!resolved) {
      const sourceLabel = getSourceDisplayLabel(material.sourceFile);
      if (sourceLabel && !isWeakContinueReadingLabel(sourceLabel, material)) {
        resolved = sourceLabel;
      }
    }

    if (!resolved) {
      resolved = t('irSidebar.calendar.untitledPoint');
    }

    continueReadingResolvedTitleById = {
      ...continueReadingResolvedTitleById,
      [material.id]: resolved
    };

    return resolved;
  }

  function findScheduleItemById(blockId: string): ScheduleItem | null {
    for (const item of selectedMaterials) {
      if (item.id === blockId) return item;
    }

    for (const siblings of siblingCache.values()) {
      const match = siblings.find((item) => item.id === blockId);
      if (match) return match;
    }

    for (const items of pinnedByDate.values()) {
      const match = items.find((item) => item.id === blockId);
      if (match) return match;
    }

    for (const items of materialsByDate.values()) {
      const match = items.find((item) => item.id === blockId);
      if (match) return match;
    }

    return null;
  }

  function getActiveReadingTimerLabel(): string {
	if (!activeReadingTimer) return t('irSidebar.controls.untitled');
    const currentItem = findScheduleItemById(activeReadingTimer.blockId);
    return currentItem ? getScheduleItemLabel(currentItem) : activeReadingTimer.title;
  }

  function formatTimerDuration(totalSeconds: number): string {
    const safeSeconds = Math.max(0, Math.floor(totalSeconds));
    const hours = Math.floor(safeSeconds / 3600);
    const minutes = Math.floor((safeSeconds % 3600) / 60);
    const seconds = safeSeconds % 60;
    if (hours > 0) {
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  function formatCompactTimerDuration(totalSeconds: number): string {
    const safeSeconds = Math.max(0, Math.floor(totalSeconds));
    if (safeSeconds < 3600) {
      const minutes = Math.floor(safeSeconds / 60);
      const seconds = safeSeconds % 60;
      return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }

    const hours = Math.floor(safeSeconds / 3600);
    const minutes = Math.floor((safeSeconds % 3600) / 60);
    return `${hours}${t('irSidebar.controls.timerHoursShort')} ${String(minutes).padStart(2, '0')}${t('irSidebar.controls.timerMinutesShort')}`;
  }

  function ensureTimerTicker(): void {
    if (timerTickIntervalId !== null) return;
    timerTickIntervalId = window.setInterval(() => {
      timerNowMs = Date.now();
    }, 1000);
  }

  function clearTimerTicker(): void {
    if (timerTickIntervalId === null) return;
    window.clearInterval(timerTickIntervalId);
    timerTickIntervalId = null;
  }

  function getDisplayedTimerSeconds(blockId: string): number {
    if (activeReadingTimer?.blockId === blockId) {
      return activeReadingTimer.baseSeconds + Math.max(0, Math.floor((timerNowMs - activeReadingTimer.startedAtMs) / 1000));
    }
    return timerTotalsByBlockId[blockId] ?? 0;
  }

  function isTimerRunningForBlock(blockId: string): boolean {
    return activeReadingTimer?.blockId === blockId;
  }

  function getReadingTimerButtonTitle(blockId: string): string {
    const timerText = formatTimerDuration(getDisplayedTimerSeconds(blockId));
    if (isTimerRunningForBlock(blockId)) {
	  return t('irSidebar.controls.pauseReadingTimer') + ` (${timerText})`;
    }
    if (getDisplayedTimerSeconds(blockId) > 0) {
	  return t('irSidebar.controls.resumeTimer', { duration: timerText });
    }
	return t('irSidebar.controls.startTimer');
  }

  async function loadTimerTotalsFromHistory(
    history: { sessions?: Array<{ blockId?: string; duration?: number }> } | null | undefined = null
  ): Promise<void> {
    try {
      const resolvedHistory =
        history ?? (await getWorkspaceSnapshotService().getWorkspaceData()).history;
      const totals: Record<string, number> = {};
      for (const session of resolvedHistory.sessions || []) {
        const blockId = String(session?.blockId || '');
        const duration = Number(session?.duration || 0);
        if (!blockId || duration <= 0) continue;
        totals[blockId] = (totals[blockId] || 0) + duration;
      }
      timerTotalsByBlockId = totals;
    } catch (error) {
      logger.warn('[IRCalendarSidebar] Recovered warning message.', error);
    }
  }

  async function getStoredTimerTotalSeconds(blockId: string): Promise<number> {
    try {
      const storage = await getStorage();
      const sessions = await storage.getBlockSessions(blockId);
      return sessions.reduce((sum, session) => sum + Math.max(0, Number(session.duration || 0)), 0);
    } catch (error) {
      logger.warn('[IRCalendarSidebar] Recovered warning message.', error);
      return timerTotalsByBlockId[blockId] ?? 0;
    }
  }

  async function appendTimerSession(
    blockId: string,
    deckId: string,
    startedAtMs: number,
    durationSeconds: number,
    reason: Exclude<TimerPauseReason, 'manual' | 'switch'>
      | 'manual'
      | 'switch'
  ): Promise<void> {
    if (durationSeconds <= 0) return;

    const storage = await getStorage();
    const endedAtMs = startedAtMs + durationSeconds * 1000;
    const action: IRSession['action'] = reason === 'completed'
      ? 'completed'
      : reason === 'skipped'
        ? 'skipped'
        : 'suspended';

    await storage.addSession({
      id: crypto.randomUUID(),
      blockId,
      deckId,
      startTime: new Date(startedAtMs).toISOString(),
      endTime: new Date(endedAtMs).toISOString(),
      duration: durationSeconds,
      action
    });
  }

  async function pauseActiveReadingTimer(reason: TimerPauseReason = 'manual', onlyBlockId?: string): Promise<boolean> {
    if (!activeReadingTimer) return false;
    if (onlyBlockId && activeReadingTimer.blockId !== onlyBlockId) return false;

    const snapshot = activeReadingTimer;
    const finalSeconds = getDisplayedTimerSeconds(snapshot.blockId);
    const sessionSeconds = Math.max(0, finalSeconds - snapshot.baseSeconds);
    const totalSeconds = snapshot.baseSeconds + sessionSeconds;

    try {
      await appendTimerSession(
        snapshot.blockId,
        snapshot.deckId,
        snapshot.startedAtMs,
        sessionSeconds,
        reason
      );
    } catch (error) {
      logger.warn('[IRCalendarSidebar] Recovered warning message.', error);
      return false;
    }

    timerTotalsByBlockId = {
      ...timerTotalsByBlockId,
      [snapshot.blockId]: totalSeconds
    };
    getWorkspaceSnapshotService().invalidate();
    getCalendarQueryService().invalidate();
    window.dispatchEvent(new CustomEvent('Weave:ir-timer-updated', {
      detail: {
        blockId: snapshot.blockId,
        totalSeconds,
        reason
      }
    }));
    activeReadingTimer = null;
    clearTimerTicker();
    syncTimerRuntimeState();

    if (reason === 'manual') {
      new Notice(t('irSidebar.notices.timerPaused', { title: snapshot.title || t('irSidebar.controls.untitled') }));
    }

    return true;
  }

  async function toggleReadingTimer(
    material: ScheduleItem,
    options: { announceStart?: boolean } = {}
  ): Promise<void> {
    if (!ensurePremiumFeature(PREMIUM_FEATURES.READING_TIMER)) {
      return;
    }
    if (timerBusyBlockId) return;

    const announceStart = options.announceStart !== false;
    timerBusyBlockId = material.id;

    try {
      if (activeReadingTimer?.blockId === material.id) {
        await pauseActiveReadingTimer('manual', material.id);
        return;
      }

      if (activeReadingTimer) {
        await pauseActiveReadingTimer('switch');
      }

      const deckId = await resolveDeckIdForScheduleItem(material);
      const baseSeconds = timerTotalsByBlockId[material.id] ?? await getStoredTimerTotalSeconds(material.id);
      const currentItem = findScheduleItemById(material.id) ?? material;

      activeReadingTimer = {
        blockId: material.id,
        deckId,
        title: getScheduleItemLabel(currentItem),
        startedAtMs: Date.now(),
        baseSeconds
      };
      timerNowMs = Date.now();
      ensureTimerTicker();
      syncTimerRuntimeState();
      if (announceStart) {
        new Notice(t('irSidebar.notices.timerStarted', { title: getScheduleItemLabel(currentItem) }));
      }
    } catch (error) {
      logger.error('[IRCalendarSidebar] Failed to toggle reading timer', error);
      new Notice(t('irSidebar.notices.timerStartFailed'));
    } finally {
      timerBusyBlockId = null;
    }
  }

  async function ensureDoneItemsVisibleForDate(dateKey: string): Promise<void> {
    const loadToken = ++doneItemsLoadToken;
    try {
      const doneIds = calendarProgressByDate[dateKey] || [];
      const currentPinned = pinnedByDate.get(dateKey) || [];
      if (!doneIds.length) {
        if (currentPinned.length > 0) {
          const nextPinnedByDate = new Map(pinnedByDate);
          nextPinnedByDate.delete(dateKey);
          pinnedByDate = nextPinnedByDate;
        }
        return;
      }

      const doneItems: ScheduleItem[] = [];

      for (const id of doneIds) {
        if (loadToken !== doneItemsLoadToken) {
          return;
        }

        if (isPdfBookmarkTaskId(id)) {
          try {
            const task = await getWorkspacePdfTaskById(id);
            if (task) {
              doneItems.push(buildScheduleItemFromPdfTask(task));
            }
          } catch (e) {
            logger.warn('[IRCalendarSidebar] Failed to load PDF reading material', id, e);
          }
          continue;
        }

        if (isEpubBookmarkTaskId(id)) {
          try {
            const task = await getWorkspaceEpubTaskById(id);
            if (task) {
              doneItems.push(
                await buildScheduleItemFromEpubTask(task, { resolveFilePath: resolveEpubTaskFilePath })
              );
            }
          } catch (e) {
            logger.warn('[IRCalendarSidebar] Failed to load EPUB reading material', id, e);
          }
          continue;
        }

        const chunk = await getWorkspaceChunkById(id);
        if (chunk) {
          doneItems.push(buildScheduleItemFromChunkData(chunk, id));
          continue;
        }

        const legacyBlock = await getWorkspaceLegacyBlockById(id);
        if (legacyBlock) {
          doneItems.push(buildScheduleItemFromLegacyBlock(legacyBlock));
        }
      }

      if (loadToken !== doneItemsLoadToken) {
        return;
      }

      if (!doneItems.length) {
        if (currentPinned.length > 0) {
          const nextPinnedByDate = new Map(pinnedByDate);
          nextPinnedByDate.delete(dateKey);
          pinnedByDate = nextPinnedByDate;
        }
        return;
      }

      const merged = new Map<string, ScheduleItem>();
      for (const item of doneItems) merged.set(item.id, item);

      const nextPinnedByDate = new Map(pinnedByDate);
      nextPinnedByDate.set(dateKey, [...merged.values()]);
      pinnedByDate = nextPinnedByDate;
    } catch (error) {
      logger.error('[IRCalendarSidebar] Recovered error message.', error);
    }
  }

  function getMonthDays(year: number, month: number): Array<{ date: Date; otherMonth: boolean }> {
    return buildMonthCalendarDays(year, month);
  }


  function syncCalendarDayCountsFromLoadedMaterials(dateKeys?: string[]): void {
    const visibleCounts = buildVisibleDayCountsByDate(
      materialsByDate,
      pinnedByDate,
      matchesActiveDeckFilter
    );
    if (dateKeys && dateKeys.length > 0) {
      const scoped = new Map<string, number>();
      for (const dateKey of dateKeys) {
        const normalized = String(dateKey || '').trim();
        if (!normalized) {
          continue;
        }
        if (visibleCounts.has(normalized)) {
          scoped.set(normalized, visibleCounts.get(normalized) ?? 0);
        } else if (materialsByDate.has(normalized) || pinnedByDate.has(normalized)) {
          scoped.set(normalized, 0);
        }
      }
      calendarDayCountsByDate = mergeCalendarDayCountMaps(calendarDayCountsByDate, scoped);
      return;
    }
    calendarDayCountsByDate = mergeCalendarDayCountMaps(calendarDayCountsByDate, visibleCounts);
  }

  function getScheduledCountForDateKey(dateKey: string): number {
    const normalized = String(dateKey || '').trim();
    if (materialsByDate.has(normalized) || pinnedByDate.has(normalized)) {
      const ids = new Set<string>();
      for (const item of getVisibleMaterialsForDate(normalized)) {
        ids.add(item.id);
      }
      for (const item of getVisiblePinnedForDate(normalized)) {
        ids.add(item.id);
      }
      return ids.size;
    }
    const materials = getVisibleMaterialsForDate(normalized);
    if (materials.length > 0) {
      return materials.length;
    }
    return calendarDayCountsByDate.get(normalized) ?? 0;
  }

  function markSelectedDateHydrationComplete(dateKey: string): void {
    const normalized = String(dateKey || '').trim();
    if (!normalized || selectedDateHydrationCompletedKeys.has(normalized)) {
      return;
    }
    selectedDateHydrationCompletedKeys = new Set([...selectedDateHydrationCompletedKeys, normalized]);
  }

  function clearSelectedDateHydrationCompletedKeys(dateKeys?: string[]): void {
    if (!dateKeys || dateKeys.length === 0) {
      selectedDateHydrationCompletedKeys = new Set();
      return;
    }
    const drop = new Set(dateKeys.map((key) => String(key || '').trim()).filter(Boolean));
    if (drop.size === 0) {
      return;
    }
    selectedDateHydrationCompletedKeys = new Set(
      [...selectedDateHydrationCompletedKeys].filter((key) => !drop.has(key))
    );
  }

  function isPriorityDateLoadSatisfied(dateKey: string): boolean {
    const normalized = String(dateKey || '').trim();
    if (!normalized) {
      return true;
    }
    if (selectedDateHydrationCompletedKeys.has(normalized)) {
      return true;
    }
    const visibleMaterials = getVisibleMaterialsForDate(normalized);
    const visiblePinned = getVisiblePinnedForDate(normalized);
    if (visibleMaterials.length > 0 || visiblePinned.length > 0) {
      return true;
    }
    if (materialsByDate.has(normalized)) {
      return true;
    }
    const heatmapCount = calendarDayCountsByDate.get(normalized) ?? 0;
    if (heatmapCount === 0) {
      return true;
    }
    return false;
  }

  function arePriorityDatesLoadSatisfied(dateKeys: string[]): boolean {
    return dateKeys.every((dateKey) => isPriorityDateLoadSatisfied(dateKey));
  }

  function isSelectedDateReadingComplete(): boolean {
    const dateKey = formatDateKey(selectedDate);
    const scheduledCount = getScheduledCountForDateKey(dateKey);

    if (scheduledCount > 0 && unfilteredSelectedMaterials.length === 0) {
      return false;
    }

    const dayState = getCalendarDayVisualState(selectedDate);
    if (dayState.hasTasks) {
      return dayState.isFullyCompleted;
    }

    return scheduledCount === 0;
  }

  function mergeMaterialsByDate(
    base: Map<string, ScheduleItem[]>,
    updates: Map<string, ScheduleItem[]>
  ): Map<string, ScheduleItem[]> {
    const merged = new Map(base);
    for (const [dateKey, items] of updates) {
      const existing = merged.get(dateKey) || [];
      if (existing.length === 0 || items.length > 0) {
        merged.set(dateKey, items);
      }
    }
    return merged;
  }

  function applyCalendarDaySummaries(daySummaries: Map<string, { totalCount: number }>): void {
    mergeCalendarDaySummaries(daySummaries);
  }

  function mergeCalendarDaySummaries(daySummaries: Map<string, { totalCount: number }>): void {
    const merged = new Map(calendarDayCountsByDate);
    for (const [dateKey, summary] of daySummaries.entries()) {
      merged.set(dateKey, Math.max(0, Number(summary?.totalCount || 0)));
    }
    calendarDayCountsByDate = merged;
  }

  function setCalendarDataPhase(nextPhase: CalendarDataPhase): void {
    calendarDataPhase = nextPhase;
  }

  function setCalendarLoadStage(stage: CalendarLoadStage, percent?: number): void {
    calendarLoadStage = stage;
    calendarLoadStageUpdatedAt = Date.now();
    if (percent !== undefined) {
      const normalized = Math.max(0, Math.min(100, Math.round(percent)));
      calendarListLoadProgressPercent = normalized;
    } else if (stage === 'idle') {
      calendarListLoadProgressPercent = 0;
    }
  }

  function clearCalendarLoadStage(): void {
    setCalendarLoadStage('idle', 0);
  }

  function maybeClearCalendarLoadStage(): void {
    if (!isLoading && !isSelectedDatePreparing) {
      clearCalendarLoadStage();
    }
  }

  function markWarmReadyPhase(): void {
    if (isDegradedReconcileWindow()) {
      setCalendarDataPhase('degraded');
    } else {
      setCalendarDataPhase('warm_ready');
    }
    isLoading = false;
    maybeClearCalendarLoadStage();
  }

  function markCalendarHeatmapShellReady(): void {
    if (hasHydratedCalendarData || calendarDayCountsByDate.size === 0) {
      return;
    }
    hasHydratedCalendarData = true;
    markWarmReadyPhase();
  }

  /** 本地缓存尝试结束后仍无数据时，解除首屏阻塞，后台 reconcile 继续补齐。 */
  function markCalendarColdStartResolved(): void {
    if (hasHydratedCalendarData) {
      return;
    }
    hasHydratedCalendarData = true;
    markWarmReadyPhase();
  }

  async function mergePriorityDatesFromLocalCache(
    priorityDateKeys: string[],
    deckIds?: string[]
  ): Promise<boolean> {
    if (priorityDateKeys.length === 0) {
      return true;
    }

    const queryService = getCalendarQueryService();

    const shell = await queryService.tryGetCalendarShellFromDayIndex({
      deckIds,
      priorityDateKeys,
    });
    if (shell) {
      materialsByDate = mergeMaterialsByDate(materialsByDate, shell.result.materialsByDate);
      mergeCalendarDaySummaries(shell.daySummaries);
      for (const dateKey of priorityDateKeys) {
        if (isPriorityDateLoadSatisfied(dateKey)) {
          markSelectedDateHydrationComplete(dateKey);
        }
      }
    }
    if (arePriorityDatesLoadSatisfied(priorityDateKeys)) {
      syncCalendarDayCountsFromLoadedMaterials(priorityDateKeys);
      return true;
    }

    const staleDisk = await queryService.tryGetStaleDiskCalendarResult({
      deckIds,
      includeReadingMaterials: false,
      priorityDateKeys,
    });
    if (staleDisk) {
      mergeStaleDiskPriorityDates(staleDisk, priorityDateKeys);
    }
    if (arePriorityDatesLoadSatisfied(priorityDateKeys)) {
      syncCalendarDayCountsFromLoadedMaterials(priorityDateKeys);
      return true;
    }

    const tier0 = await queryService.tryGetTier0CalendarResult({
      deckIds,
      priorityDateKeys,
    });
    if (tier0) {
      materialsByDate = mergeMaterialsByDate(materialsByDate, tier0.result.materialsByDate);
      mergeCalendarDaySummaries(tier0.daySummaries);
      for (const dateKey of priorityDateKeys) {
        if (isPriorityDateLoadSatisfied(dateKey)) {
          markSelectedDateHydrationComplete(dateKey);
        }
      }
    }

    syncCalendarDayCountsFromLoadedMaterials(priorityDateKeys);
    return arePriorityDatesLoadSatisfied(priorityDateKeys);
  }

  function schedulePriorityDatesBackgroundRefresh(
    priorityDateKeys: string[],
    deckIds?: string[]
  ): void {
    scheduleBackgroundCalendarReconcile(priorityDateKeys, deckIds, 'priority-dates');
  }

  function scheduleBackgroundCalendarReconcile(
    priorityDateKeys: string[],
    deckIds?: string[],
    reason?: string
  ): void {
    if (isCalendarSidebarInteractionPaused() || isDegradedReconcileWindow()) {
      return;
    }
    getSharedIRRefreshScheduler(plugin.app).scheduleCalendarReconcile({
      deckIds,
      forceRecompute: calendarScheduleNeedsRecompute,
      priorityDateKeys,
      reason: reason || 'sidebar',
    });
  }

  function applyMonthHeatmapLoadResult(
    monthHeatmap: Map<string, Record<string, number>> | null
  ): void {
    if (!monthHeatmap) {
      return;
    }
    for (const counts of monthHeatmap.values()) {
      mergeCalendarDaySummaries(
        new Map(
          Object.entries(counts).map(([dateKey, totalCount]) => [
            dateKey,
            { totalCount: Math.max(0, Number(totalCount || 0)) },
          ])
        )
      );
    }
  }

  function applyProjectionLoadResult(
    projection: IRProjectionPriorityHydrateResult | null,
    priorityDateKeys: string[]
  ): void {
    if (!projection) {
      return;
    }
    if (projection.source === 'stale_disk') {
      mergeStaleDiskPriorityDates(
        { materialsByDate: projection.materialsByDate, schedule: { generatedAt: 0 } },
        priorityDateKeys
      );
    } else {
      materialsByDate = mergeMaterialsByDate(materialsByDate, projection.materialsByDate);
      mergeCalendarDaySummaries(projection.daySummaries);
    }
    for (const dateKey of priorityDateKeys) {
      if (materialsByDate.has(dateKey)) {
        markSelectedDateHydrationComplete(dateKey);
      }
    }
    if (!hasHydratedCalendarData) {
      hasHydratedCalendarData = true;
    }
  }

  function getDailyReadingPointStretchCap(): number {
    const ir = plugin.getIncrementalReadingSettings?.() ?? plugin.settings?.incrementalReading;
    const baselineCount = Number(ir?.dailyReadingPointCap) || 15;
    const stretchPercent = Number(ir?.flowStretchPercent ?? 15);
    return computeReadingPointStretchCap(
      baselineCount,
      stretchPercent,
      ir?.dailyReadingPointStretchCap
    );
  }

  function isStalePriorityDayOverloaded(itemCount: number): boolean {
    return itemCount > Math.max(getDailyReadingPointStretchCap() * 2, 30);
  }

  function mergeStaleDiskPriorityDates(
    staleDisk: {
      materialsByDate: Map<string, ScheduleItem[]>;
      schedule: { generatedAt: number };
    },
    priorityDateKeys: string[]
  ): void {
    let mergedAny = false;
    let skippedOverloaded = false;

    for (const dateKey of priorityDateKeys) {
      const items = staleDisk.materialsByDate.get(dateKey) || [];
      if (items.length === 0) {
        continue;
      }
      if (isStalePriorityDayOverloaded(items.length)) {
        skippedOverloaded = true;
        continue;
      }
      materialsByDate = mergeMaterialsByDate(new Map([[dateKey, items]]), materialsByDate);
      mergeCalendarDaySummaries(new Map([[dateKey, { totalCount: items.length }]]));
      mergedAny = true;
    }

    if (mergedAny) {
      lastAppliedScheduleGeneratedAt = Math.max(
        lastAppliedScheduleGeneratedAt,
        staleDisk.schedule.generatedAt
      );
    }
    if (mergedAny || skippedOverloaded) {
      calendarScheduleNeedsRecompute = true;
    }
  }

  async function finalizePriorityDatesAfterLoad(
    priorityDateKeys: string[],
    deckIds?: string[]
  ): Promise<void> {
    if (!arePriorityDatesLoadSatisfied(priorityDateKeys)) {
      await mergePriorityDatesFromLocalCache(priorityDateKeys, deckIds);
    }

    const selectedKey = formatDateKey(selectedDate);
    if (!isPriorityDateLoadSatisfied(selectedKey)) {
      await ensureSelectedDateMaterialsLoaded(selectedKey);
    }
  }

  function markRecoverableErrorPhase(): void {
    setCalendarDataPhase('error_recoverable');
    isLoading = false;
    maybeClearCalendarLoadStage();
  }

  function recordCalendarLoadMetric(stage: string, startedAt: number, extra?: Record<string, unknown>): void {
    logger.debug('[IRCalendarSidebar] load metric', {
      stage,
      durationMs: Math.max(0, Date.now() - startedAt),
      phase: calendarDataPhase,
      ...extra,
    });
  }

  function markInteractionPressure(): void {
    backgroundReconcilePausedUntilMs = Date.now() + CALENDAR_RECONCILE_INTERACTION_PAUSE_MS;
  }

  function isDegradedReconcileWindow(): boolean {
    return Date.now() < reconcileDegradedUntilMs;
  }

  function recordReconcileFailure(): void {
    reconcileFailureStreak += 1;
    if (reconcileFailureStreak >= CALENDAR_RECONCILE_MAX_FAILURES_BEFORE_DEGRADED) {
      reconcileDegradedUntilMs = Date.now() + CALENDAR_RECONCILE_DEGRADED_COOLDOWN_MS;
      reconcileFailureStreak = 0;
      setCalendarDataPhase('degraded');
      return;
    }
    setCalendarDataPhase('error_recoverable');
  }

  function recordReconcileSuccess(): void {
    if (reconcileFailureStreak > 0) {
      reconcileFailureStreak = 0;
    }
    if (
      calendarDataPhase === 'error_recoverable' &&
      !isDegradedReconcileWindow()
    ) {
      refreshCalendarPhaseFromRuntime();
    }
  }

  function refreshCalendarPhaseFromRuntime(): void {
    if (!hasHydratedCalendarData) {
      setCalendarDataPhase('cold_start_blocking');
      return;
    }
    if (isDegradedReconcileWindow()) {
      setCalendarDataPhase('degraded');
      return;
    }
    if (calendarDataPhase !== 'error_recoverable') {
      setCalendarDataPhase('warm_ready');
    }
  }

  function isCalendarSidebarInteractionPaused(): boolean {
    return calendarBackgroundPaused || Date.now() < backgroundReconcilePausedUntilMs;
  }

  function isIRCalendarLeafActive(): boolean {
    const activeView = plugin.app.workspace.activeLeaf?.view;
    return activeView?.getViewType?.() === VIEW_TYPE_IR_CALENDAR;
  }

  function refreshCalendarBackgroundPauseState(): void {
    const documentHidden =
      typeof document !== 'undefined' && document.visibilityState === 'hidden';
    calendarBackgroundPaused = documentHidden || !isIRCalendarLeafActive();
    refreshCalendarPhaseFromRuntime();
  }

  async function applyProjectionPriorityDatePatch(
    priorityDateKeys: string[],
    deckIds?: string[]
  ): Promise<void> {
    const projection = await getSharedIRProjectionRuntime(plugin.app).hydratePriorityDatesFromProjection(
      deckIds,
      priorityDateKeys
    );
    applyProjectionLoadResult(projection, priorityDateKeys);
    for (const dateKey of priorityDateKeys) {
      lazyMetadataLoadedDateKeys.delete(dateKey);
      if (isPriorityDateLoadSatisfied(dateKey)) {
        markSelectedDateHydrationComplete(dateKey);
      }
    }
    syncCalendarDayCountsFromLoadedMaterials(priorityDateKeys);
    markWarmReadyPhase();
    const selectedKey = formatDateKey(selectedDate);
    if (priorityDateKeys.includes(selectedKey)) {
      void ensureLazyMetadataForSelectedDate(selectedKey);
    }
  }

  async function hydrateVisibleMonthHeatmapFromProjection(deckIds?: string[]): Promise<void> {
    const monthKey = toCalendarMonthKey(formatDateKey(currentDate));
    if (!monthKey) {
      return;
    }
    try {
      const monthHeatmap = await hydrateIRCalendarMonthHeatmap(plugin.app, deckIds, [monthKey]);
      applyMonthHeatmapLoadResult(monthHeatmap);
    } catch (error) {
      logger.debug('[IRCalendarSidebar] Month heatmap projection hydrate skipped:', error);
    }
  }

  function getActiveDeckIdsForQuery(): string[] | undefined {
    const requestedDeckId = getRequestedDeckFilterId();
    return requestedDeckId ? [requestedDeckId] : undefined;
  }

  async function refreshPriorityCalendarDays(
    dateKeys: string[],
    options: { deckIds?: string[] } = {}
  ): Promise<void> {
    const priorityDateKeys = Array.from(
      new Set(dateKeys.map((key) => String(key || '').trim()).filter(Boolean))
    );
    if (priorityDateKeys.length === 0) {
      return;
    }

    const deckIds = options.deckIds ?? getActiveDeckIdsForQuery();
    const satisfied = await mergePriorityDatesFromLocalCache(priorityDateKeys, deckIds);
    if (satisfied) {
      return;
    }

    schedulePriorityDatesBackgroundRefresh(priorityDateKeys, deckIds);
  }

  async function ensureSelectedDateMaterialsLoaded(dateKey: string): Promise<void> {
    const normalizedDateKey = String(dateKey || '').trim();
    if (!normalizedDateKey) {
      isSelectedDatePreparing = false;
      return;
    }
    if (isPriorityDateLoadSatisfied(normalizedDateKey)) {
      isSelectedDatePreparing = false;
      return;
    }
    const lastAttemptAt = selectedDateHydrationAttemptAtByKey.get(normalizedDateKey) ?? 0;
    if (Date.now() - lastAttemptAt < SELECTED_DATE_HYDRATION_RETRY_MS) {
      return;
    }
    selectedDateHydrationAttemptAtByKey.set(normalizedDateKey, Date.now());

    if (hasHydratedCalendarData && calendarDataPhase !== 'cold_start_blocking') {
      schedulePriorityDatesBackgroundRefresh([normalizedDateKey], getActiveDeckIdsForQuery());
      return;
    }

    const loadToken = ++selectedDateLoadToken;
    isSelectedDatePreparing = true;
    setCalendarLoadStage('selected_date_index', 12);
    try {
      const deckIds = getActiveDeckIdsForQuery();
      setCalendarLoadStage('selected_date_query', 38);
      await mergePriorityDatesFromLocalCache([normalizedDateKey], deckIds);
      if (loadToken !== selectedDateLoadToken) {
        return;
      }
      setCalendarLoadStage('day_list_assemble', 88);
    } catch (error) {
      logger.warn('[IRCalendarSidebar] Failed to load selected date materials:', error);
    } finally {
      if (loadToken === selectedDateLoadToken) {
        if (isPriorityDateLoadSatisfied(normalizedDateKey)) {
          markSelectedDateHydrationComplete(normalizedDateKey);
        } else {
          schedulePriorityDatesBackgroundRefresh([normalizedDateKey], getActiveDeckIdsForQuery());
        }
        isSelectedDatePreparing = false;
        maybeClearCalendarLoadStage();
      }
    }
  }

  function getHeatLevel(date: Date): number {
    const count = getScheduledCountForDateKey(formatDateKey(date));

    if (count === 0) return 0;
    if (count >= 8) return 5;
    if (count >= 6) return 4;
    if (count >= 4) return 3;
    if (count >= 2) return 2;
    return 1;
  }

  function getHeatDots(date: Date): number[] {
    const level = Math.min(getHeatLevel(date), 3);
    return level > 0 ? Array.from({ length: level }, (_, index) => index) : [];
  }

  type CalendarDayVisualState = {
    key: string;
    totalCount: number;
    completedCount: number;
    pendingCount: number;
    completionRatio: number;
    hasTasks: boolean;
    isFullyCompleted: boolean;
    isPartiallyCompleted: boolean;
    isTodayPending: boolean;
    isOverduePending: boolean;
  };

  function getCalendarDayVisualState(date: Date): CalendarDayVisualState {
    const key = formatDateKey(date);
    const scheduledItems = collectDayQueueSourceItems(key);
    const scheduledIds = new Set(scheduledItems.map((item) => item.id));
    const completedIds = Array.isArray(calendarProgressByDate[key])
      ? calendarProgressByDate[key].filter((id, index, source) => source.indexOf(id) === index)
      : [];
    const totalCount = scheduledIds.size + completedIds.filter((id) => !scheduledIds.has(id)).length;
    const completedCount = Math.min(completedIds.length, totalCount);
    const pendingCount = Math.max(0, totalCount - completedCount);
    const completionRatio = totalCount > 0 ? completedCount / totalCount : 0;
    const hasTasks = totalCount > 0;
    const isFullyCompleted = hasTasks && pendingCount === 0;
    const isPartiallyCompleted = completedCount > 0 && pendingCount > 0;
    const isTodayPending = isSameDay(date, today) && pendingCount > 0;
    const isOverduePending = !isSameDay(date, today) && date.getTime() < today.getTime() && pendingCount > 0;

    return {
      key,
      totalCount,
      completedCount,
      pendingCount,
      completionRatio,
      hasTasks,
      isFullyCompleted,
      isPartiallyCompleted,
      isTodayPending,
      isOverduePending,
    };
  }

  function getCalendarDayCellTitle(dayState: CalendarDayVisualState): string {
    if (!dayState.hasTasks) return '';
    return `${dayState.totalCount} tasks, ${dayState.completedCount} completed, ${dayState.pendingCount} pending`;
  }

  function getMaterialExpandButtonLabel(isExpanded: boolean): string {
    return isExpanded ? 'Collapse related materials' : 'Expand related materials';
  }

  function getMaterialTagLabels(materialId: string): string[] {
    return readingPointTagsById[materialId] || [];
  }

  function collectDayQueueSourceItems(dateKey: string): ScheduleItem[] {
    const normalized = String(dateKey || '').trim();
    if (!normalized) {
      return [];
    }
    const merged = new Map<string, ScheduleItem>();
    for (const item of materialsByDate.get(normalized) || []) {
      if (matchesActiveDeckFilter(item)) {
        merged.set(item.id, item);
      }
    }
    for (const item of pinnedByDate.get(normalized) || []) {
      if (matchesActiveDeckFilter(item)) {
        merged.set(item.id, item);
      }
    }
    return [...merged.values()];
  }

  function buildAssembledDayQueueForDateKey(
    dateKey: string,
    options: {
      completedIds: string[];
      itemOverrides?: Map<string, ScheduleItem>;
    }
  ): ScheduleItem[] {
    const normalized = String(dateKey || '').trim();
    if (!normalized) {
      return [];
    }
    const merged = new Map<string, ScheduleItem>();
    for (const item of collectDayQueueSourceItems(normalized)) {
      merged.set(item.id, options.itemOverrides?.get(item.id) ?? item);
    }
    for (const [id, item] of options.itemOverrides || []) {
      merged.set(id, item);
    }
    return assembleScheduleItemsForDailyQueue([...merged.values()], normalized, {
      completedIds: options.completedIds,
      completedIdOrder: options.completedIds,
    });
  }

  function applyLocalDayQueueProjection(dateKey: string, assembled: ScheduleItem[]): void {
    const normalized = String(dateKey || '').trim();
    if (!normalized) {
      return;
    }
    const nextMaterialsByDate = new Map(materialsByDate);
    nextMaterialsByDate.set(normalized, assembled);
    materialsByDate = nextMaterialsByDate;
    syncCalendarDayCountsFromLoadedMaterials([normalized]);
  }

  function markLocalDayQueueRefreshSuppressed(dateKey: string, durationMs = 4000): void {
    const normalized = String(dateKey || '').trim();
    if (!normalized) {
      return;
    }
    suppressSidebarRefreshForDateKey = normalized;
    suppressSidebarRefreshUntilMs = Date.now() + durationMs;
  }

  function shouldSuppressSidebarRefreshForDataUpdate(detail?: UpdatedEventDetail): boolean {
    if (!detail?.priorityDateKeys?.length || !suppressSidebarRefreshForDateKey) {
      return false;
    }
    if (Date.now() >= suppressSidebarRefreshUntilMs) {
      suppressSidebarRefreshForDateKey = '';
      suppressSidebarRefreshUntilMs = 0;
      return false;
    }
    if (
      detail.reason !== 'complete_block' &&
      detail.reason !== 'postpone_block' &&
      detail.reason !== 'ui_refresh'
    ) {
      return false;
    }
    return detail.priorityDateKeys.some(
      (key) => String(key || '').trim() === suppressSidebarRefreshForDateKey
    );
  }

  function getSelectedMaterialsBase(): ScheduleItem[] {
    const key = formatDateKey(selectedDate);
    const materials = getVisibleMaterialsForDate(key);
    const pinned = getVisiblePinnedForDate(key);
    const merged = new Map<string, ScheduleItem>();
    for (const m of materials) merged.set(m.id, m);
    for (const p of pinned) merged.set(p.id, p);
    const completedIds = calendarProgressByDate[key] || [];
    return assembleScheduleItemsForDailyQueue([...merged.values()], key, {
      completedIds,
      completedIdOrder: completedIds,
    });
  }

  function getSelectedDateTagOptions(): Array<{ label: string; count: number }> {
    const counts = new Map<string, { label: string; count: number }>();
    for (const material of getSelectedMaterialsBase()) {
      for (const tag of getMaterialTagLabels(material.id)) {
        const key = tag.toLowerCase();
        const existing = counts.get(key);
        if (existing) {
          existing.count += 1;
        } else {
          counts.set(key, { label: tag, count: 1 });
        }
      }
    }
    return Array.from(counts.values()).sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.label.localeCompare(b.label, 'zh-CN');
    });
  }

  function getSelectedMaterials(): ScheduleItem[] {
    const materials = getSelectedMaterialsBase();
    return materials.filter(matchesActiveTagFilter);
  }

  function getDateKeyDayOffsetFromToday(dateKey: string): number | null {
    const parsed = parseDateKey(dateKey);
    if (!parsed) return null;
    parsed.setHours(0, 0, 0, 0);
    return Math.round((parsed.getTime() - today.getTime()) / DAY_IN_MS);
  }

  function normalizeSourcePathKey(path?: string): string {
    const normalized = normalizePath(String(path || '').trim());
    return normalized ? normalized.toLowerCase() : '';
  }

  function getSourceDisplayLabel(path?: string): string {
    const normalized = normalizePath(String(path || '').trim());
    if (!normalized) {
      return '';
    }

    const baseName = normalized.split('/').pop() || normalized;
    return baseName.replace(/\.md$/i, '');
  }

  function getContinueReadingSourceHints(): Set<string> {
    const hints = new Set<string>();
    const focusedSource = normalizeSourcePathKey(sourceFilePath);
    if (focusedSource) {
      hints.add(focusedSource);
    }

    for (const material of getSelectedMaterialsBase()) {
      const sourceKey = normalizeSourcePathKey(material.sourceFile);
      if (sourceKey) {
        hints.add(sourceKey);
      }
    }

    return hints;
  }

  function hasActiveContinueReadingStatus(item: ScheduleItem): boolean {
    const normalizedStatus = String(item.scheduleStatus || '').trim().toLowerCase();
    return !['archived', 'removed', 'suspended', 'done', 'completed'].includes(normalizedStatus);
  }

  function hasSuspendedContinueReadingStatus(item: ScheduleItem): boolean {
    return isSuspendedContinueReadingStatus(item.scheduleStatus);
  }

  function getContinueReadingDueLabel(dayOffset: number | null): string {
    if (dayOffset === null || dayOffset <= 0) {
      return t('irSidebar.calendar.upcoming');
    }
    if (dayOffset === 1) {
      return t('irSidebar.controls.tomorrow');
    }
    return t('irSidebar.controls.daysLater', { count: dayOffset });
  }

  function getContinueReadingSuggestionMetaText(
    _item: ScheduleItem,
    dayOffset: number | null,
    _sourceHints: Set<string>
  ): string {
    return getContinueReadingDueLabel(dayOffset);
  }

  function getContinueReadingSuggestionScore(
    item: ScheduleItem,
    dayOffset: number | null,
    sourceHints: Set<string>
  ): number {
    const safeOffset = dayOffset ?? 99;
    const sourceMatched = sourceHints.has(normalizeSourcePathKey(item.sourceFile)) ? 1 : 0;
    return (
      sourceMatched * 180 +
      Number(item.priority || 0) * 12 +
      Math.round(Number(item.explanation?.compositeScore ?? 0)) -
      safeOffset * 1000
    );
  }

  function getSuspendedContinueReadingMetaText(
    _item: ScheduleItem,
    _sourceHints: Set<string>
  ): string {
    return t('irSidebar.calendar.suspended');
  }

  function getSuspendedContinueReadingScore(
    item: ScheduleItem,
    sourceHints: Set<string>
  ): number {
    const sourceMatched = sourceHints.has(normalizeSourcePathKey(item.sourceFile)) ? 1 : 0;
    return sourceMatched * 180 + Number(item.priority || 0) * 12 - Number(item.intervalDays || 0);
  }

  function getContinueReadingSuggestions(limit = 5): ContinueReadingSuggestion[] {
    const todayKey = formatDateKey(today);
    const sourceHints = getContinueReadingSourceHints();
    const suggestions: ContinueReadingSuggestion[] = [];
    const seenIds = new Set<string>();

    const futureDateKeys = Array.from(materialsByDate.keys())
      .filter((dateKey) => dateKey > todayKey)
      .sort((left, right) => left.localeCompare(right, 'zh-CN'));

    for (const dateKey of futureDateKeys) {
      const dayOffset = getDateKeyDayOffsetFromToday(dateKey);
      if (dayOffset === null || dayOffset <= 0) {
        continue;
      }

      for (const item of getVisibleMaterialsForDate(dateKey)) {
        if (seenIds.has(item.id) || !hasActiveContinueReadingStatus(item)) {
          continue;
        }

        seenIds.add(item.id);
        suggestions.push({
          item,
          dateKey,
          dayOffset,
          metaText: getContinueReadingSuggestionMetaText(item, dayOffset, sourceHints),
          score: getContinueReadingSuggestionScore(item, dayOffset, sourceHints),
        });
      }
    }

    return suggestions
      .sort((left, right) => {
        if (right.score !== left.score) {
          return right.score - left.score;
        }
        if (left.dayOffset !== right.dayOffset) {
          return left.dayOffset - right.dayOffset;
        }
        return (right.item.priority || 0) - (left.item.priority || 0);
      })
      .slice(0, limit);
  }

  function getSuspendedContinueReadingSuggestions(limit = 5): SuspendedContinueReadingSuggestion[] {
    const sourceHints = getContinueReadingSourceHints();
    const suggestions: SuspendedContinueReadingSuggestion[] = [];
    const seenIds = new Set<string>();

    for (const item of continueReadingSuspendedItemsPool) {
      if (seenIds.has(item.id) || !matchesActiveDeckFilter(item) || !hasSuspendedContinueReadingStatus(item)) {
        continue;
      }

      seenIds.add(item.id);
      suggestions.push({
        item,
        metaText: getSuspendedContinueReadingMetaText(item, sourceHints),
        score: getSuspendedContinueReadingScore(item, sourceHints)
      });
    }

    return suggestions
      .sort((left, right) => {
        if (right.score !== left.score) {
          return right.score - left.score;
        }
        return (right.item.priority || 0) - (left.item.priority || 0);
      })
      .slice(0, limit);
  }

  function hasContinueReadingCandidatesAvailable(): boolean {
    if (isLoading || !isSameDay(selectedDate, today)) {
      return false;
    }

    return getContinueReadingSuggestions().length > 0 || getSuspendedContinueReadingSuggestions().length > 0;
  }

  function hasReadableReadingPointsForDate(date: Date): boolean {
    const dateKey = formatDateKey(date);
    const doneIds = new Set(calendarProgressByDate[dateKey] || []);
    const merged = new Map<string, ScheduleItem>();

    for (const item of getVisibleMaterialsForDate(dateKey)) {
      merged.set(item.id, item);
    }

    for (const item of getVisiblePinnedForDate(dateKey)) {
      if (!merged.has(item.id)) {
        merged.set(item.id, item);
      }
    }

    return Array.from(merged.values()).some((item) => hasActiveContinueReadingStatus(item) && !doneIds.has(item.id));
  }

  function shouldOfferContinueReadingSuggestions(): boolean {
    if (!hasContinueReadingCandidatesAvailable()) {
      return false;
    }

    return !hasReadableReadingPointsForDate(today);
  }

  function getContinueReadingSuggestionsSignature(
    suggestions: ContinueReadingSuggestion[] = getContinueReadingSuggestions(),
    suspendedSuggestions: SuspendedContinueReadingSuggestion[] = getSuspendedContinueReadingSuggestions()
  ): string {
    const todayKey = formatDateKey(today);
    const scheduledSignature = suggestions.map((suggestion) => `${suggestion.item.id}@${suggestion.dateKey}`).join('|');
    const suspendedSignature = suspendedSuggestions.map((suggestion) => suggestion.item.id).join('|');
    const signatureBody = [scheduledSignature ? `scheduled:${scheduledSignature}` : '', suspendedSignature ? `suspended:${suspendedSignature}` : '']
      .filter(Boolean)
      .join('::');
    return signatureBody ? `${todayKey}::${signatureBody}` : '';
  }

  async function buildContinueReadingSuggestionModalItems(
    suggestions: ContinueReadingSuggestion[] = getContinueReadingSuggestions()
  ): Promise<IRContinueReadingSuggestionModalItem[]> {
    return await Promise.all(
      suggestions.map(async (suggestion) => ({
        id: suggestion.item.id,
        title: await resolveContinueReadingSuggestionTitle(suggestion.item),
        metaText: suggestion.metaText,
        contextLabel: getContinueReadingDueLabel(suggestion.dayOffset),
        priorityLabel: `P${suggestion.item.priority || 0}`,
        kind: 'scheduled' as const
      }))
    );
  }

  async function buildSuspendedContinueReadingModalItems(
    suggestions: SuspendedContinueReadingSuggestion[] = getSuspendedContinueReadingSuggestions()
  ): Promise<IRContinueReadingSuggestionModalItem[]> {
    return await Promise.all(
      suggestions.map(async (suggestion) => ({
        id: suggestion.item.id,
        title: await resolveContinueReadingSuggestionTitle(suggestion.item),
        metaText: suggestion.metaText,
        contextLabel: t('irSidebar.calendar.suspended'),
        priorityLabel: `P${suggestion.item.priority || 0}`,
        kind: 'suspended' as const
      }))
    );
  }

  function getCalendarDisplayDays(
    days: Array<{ date: Date; otherMonth: boolean }>
  ): Array<{ date: Date; otherMonth: boolean }> {
    if (calendarViewMode !== 'two-row') {
      return days;
    }

    const isCurrentDisplayedMonth =
      currentDate.getFullYear() === today.getFullYear() &&
      currentDate.getMonth() === today.getMonth();
    const isSelectedInDisplayedMonth =
      selectedDate.getFullYear() === currentDate.getFullYear() &&
      selectedDate.getMonth() === currentDate.getMonth();
    const anchorDate = isCurrentDisplayedMonth
      ? today
      : isSelectedInDisplayedMonth
        ? selectedDate
        : new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const anchorIndex = days.findIndex(({ date }) => isSameDay(date, anchorDate));

    if (anchorIndex < 0) {
      return days.slice(0, 14);
    }

    const rowStart = Math.floor(anchorIndex / 7) * 7;
    const visibleDays = days.slice(rowStart, Math.min(rowStart + 14, days.length));

    if (visibleDays.length === 14) {
      return visibleDays;
    }

    const lastVisibleDate = visibleDays.length > 0
      ? visibleDays[visibleDays.length - 1].date
      : anchorDate;
    const paddedDays = [...visibleDays];
    for (let offset = 1; paddedDays.length < 14; offset += 1) {
      paddedDays.push({
        date: new Date(
          lastVisibleDate.getFullYear(),
          lastVisibleDate.getMonth(),
          lastVisibleDate.getDate() + offset
        ),
        otherMonth: true
      });
    }

    return paddedDays;
  }

  function showMonthCalendarToolsMenu(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();

    const menu = new Menu();
    if (shouldShowPremiumFeatureEntry(PREMIUM_FEATURES.ANALYTICS_VIEW)) {
      menu.addItem((item) => {
        item
          .setTitle(premiumMenuTitle(t('irSidebar.header.analyticsTitle'), PREMIUM_FEATURES.ANALYTICS_VIEW))
          .setIcon('bar-chart-2')
          .onClick(() => {
            if (!ensurePremiumFeature(PREMIUM_FEATURES.ANALYTICS_VIEW)) {
              return;
            }
            openAnalyticsModal();
          });
      });
    }

    menu.addItem((item) => {
      item
        .setTitle(`${t('irDataMgmt.title')}…`)
        .setIcon('database')
        .onClick(() => {
          openIRDataManagementModal();
        });
    });

    populateCalendarMaterialImportMenu(menu, {
      importTitle: t('irSidebar.header.importTitle'),
      onOpenImport: openImportModal
    });

    if (shouldShowPremiumFeatureEntry(PREMIUM_FEATURES.FOLDER_SUBSCRIPTION)) {
      menu.addSeparator();

      populateCalendarFolderSubscriptionSyncMenu(menu, {
        syncTitle: premiumMenuTitle(t('irCommands.updateFolderSubscription'), PREMIUM_FEATURES.FOLDER_SUBSCRIPTION),
        onSync: () => {
          if (!ensurePremiumFeature(PREMIUM_FEATURES.FOLDER_SUBSCRIPTION)) {
            return;
          }
          void plugin.syncIncrementalReadingFolderSubscriptionFromSettings?.({ trigger: 'manual' });
        }
      });
    }

    if (shouldShowPremiumFeatureEntry(PREMIUM_FEATURES.CALENDAR_BACKGROUND_WALL)) {
      menu.addSeparator();

      populateCalendarBackgroundWallMenu(menu, {
        backgroundWallTitle: premiumMenuTitle(t('irSidebar.header.backgroundWallTitle'), PREMIUM_FEATURES.CALENDAR_BACKGROUND_WALL),
        chooseTitle: premiumMenuTitle(t('irSidebar.header.backgroundWallChoose'), PREMIUM_FEATURES.CALENDAR_BACKGROUND_WALL),
        clearTitle: premiumMenuTitle(t('irSidebar.header.backgroundWallClear'), PREMIUM_FEATURES.CALENDAR_BACKGROUND_WALL),
        fadeTitle: premiumMenuTitle(
          t('irSidebar.header.backgroundWallFadeSet', { value: Number(calendarBackgroundWallFadePercent) }),
          PREMIUM_FEATURES.CALENDAR_BACKGROUND_WALL
        ),
        hasImage: Boolean(calendarBackgroundWallImagePath),
        onChoose: () => {
          if (!ensurePremiumFeature(PREMIUM_FEATURES.CALENDAR_BACKGROUND_WALL)) {
            return;
          }
          void chooseCalendarBackgroundWallImage();
        },
        onClear: () => {
          if (!ensurePremiumFeature(PREMIUM_FEATURES.CALENDAR_BACKGROUND_WALL)) {
            return;
          }
          void clearCalendarBackgroundWallImage();
        },
        onSetFade: () => {
          if (!ensurePremiumFeature(PREMIUM_FEATURES.CALENDAR_BACKGROUND_WALL)) {
            return;
          }
          void promptCalendarBackgroundWallFadePercent();
        }
      });
    }

    menu.addSeparator();

    menu.addItem((item) => {
      item
        .setTitle(
          calendarViewMode === 'two-row'
            ? t('irSidebar.calendar.switchFullMonth')
            : t('irSidebar.calendar.switchTwoRowMonth')
        )
        .setIcon('calendar')
        .onClick(() => {
          void setCalendarViewMode(calendarViewMode === 'two-row' ? 'full' : 'two-row');
        });
    });

    const triggerRect = calendarToolsTriggerEl?.getBoundingClientRect();
    menu.showAtPosition(
      triggerRect
        ? { x: triggerRect.right - 8, y: triggerRect.bottom + 6 }
        : { x: event.clientX, y: event.clientY }
    );
  }

  function openIRDataManagementModal(): void {
    const modal = new IRDataManagementModalObsidian(plugin.app, { plugin });
    modal.open();
  }

  async function scanVaultIncrementalReadingDeckFiles(): Promise<void> {
    try {
      const pointStorage = new IRPointStorageService(plugin.app);
      const result = await pointStorage.refreshPointFilesIndexFromVault();
      await recomputeAndRefreshSidebar('ui_refresh');
      const conflictSummary =
        result.duplicateTopicGroups > 0
          ? t('irSidebar.calendar.scanConflictSuffix', { count: result.duplicateTopicGroups })
          : '';
      new Notice(
        t('irSidebar.calendar.scanComplete', {
          scanned: result.scanned,
          topicCount: result.topicCount,
          added: result.added,
          updated: result.updated,
          removed: result.removed,
          conflictSummary
        }),
        result.duplicateTopicGroups > 0 ? 6000 : 4000
      );
      if (result.duplicateTopicGroups > 0) {
        logger.warn("[IRCalendarSidebar] Duplicate topic .irdeck files detected", {
          conflicts: result.conflicts,
        });
      }
    } catch (error) {
      logger.error('[IRCalendarSidebar] Failed to scan vault incremental reading deck files:', error);
      new Notice(t('irSidebar.calendar.scanFailed'));
    }
  }

  function getContinueReadingSuggestionById(
    suggestionId: string,
    suggestions: ContinueReadingSuggestion[] = getContinueReadingSuggestions()
  ): ContinueReadingSuggestion | null {
    return suggestions.find((suggestion) => suggestion.item.id === suggestionId) || null;
  }

  function getSuspendedContinueReadingSuggestionById(
    suggestionId: string,
    suggestions: SuspendedContinueReadingSuggestion[] = getSuspendedContinueReadingSuggestions()
  ): SuspendedContinueReadingSuggestion | null {
    return suggestions.find((suggestion) => suggestion.item.id === suggestionId) || null;
  }

  function buildContinueReadingPanelState(): ContinueReadingPanelState {
    const suggestions = getContinueReadingSuggestions();
    const suspended = getSuspendedContinueReadingSuggestions();
    return {
      suggestions,
      suspended,
      signature: getContinueReadingSuggestionsSignature(suggestions, suspended)
    };
  }

  async function buildContinueReadingSuggestionsModalOptions(
    panelState: ContinueReadingPanelState
  ): Promise<IRContinueReadingSuggestionsModalObsidianOptions> {
    const [suggestionItems, suspendedItems] = await Promise.all([
      buildContinueReadingSuggestionModalItems(panelState.suggestions),
      buildSuspendedContinueReadingModalItems(panelState.suspended)
    ]);

    return {
      suggestions: suggestionItems,
      suspendedItems,
      anchorElement: continueReadingTriggerEl || calendarSidebarEl,
      onOpenSuggestion: async (suggestionId: string) => {
        const scheduledTarget = getContinueReadingSuggestionById(suggestionId, panelState.suggestions);
        const suspendedTarget = getSuspendedContinueReadingSuggestionById(suggestionId, panelState.suspended);
        const target = scheduledTarget?.item || suspendedTarget?.item;
        if (!target) {
          return;
        }

        closeContinueReadingSuggestionsModal('action');
        await openMaterial(target);
      },
      onAddSuggestion: async (suggestionId: string) => {
        const scheduledTarget = getContinueReadingSuggestionById(suggestionId, panelState.suggestions);
        if (scheduledTarget) {
          await addSuggestedMaterialToToday(scheduledTarget.item);
          return;
        }

        const suspendedTarget = getSuspendedContinueReadingSuggestionById(suggestionId, panelState.suspended);
        if (!suspendedTarget) {
          return;
        }

        await restoreSuspendedMaterialToToday(suspendedTarget.item);
      },
      onClose: () => {
        const closedSignature = continueReadingSuggestionsModalOpenSignature;
        const closeReason = continueReadingSuggestionsModalCloseReason;
        continueReadingSuggestionsModalInstance = null;
        continueReadingSuggestionsModalOpenSignature = '';
        continueReadingSuggestionsModalCloseReason = 'dismiss';
        if (closeReason === 'dismiss' && closedSignature) {
          continueReadingSuggestionsModalDismissedSignature = closedSignature;
        }
      }
    };
  }

  function closeContinueReadingSuggestionsModal(reason: 'dismiss' | 'action' | 'refresh' = 'dismiss'): void {
    if (!continueReadingSuggestionsModalInstance) {
      return;
    }

    continueReadingSuggestionsModalCloseReason = reason;
    continueReadingSuggestionsModalInstance.close();
  }

  async function openContinueReadingSuggestionsModal(force = false): Promise<void> {
    if (!shouldOfferContinueReadingSuggestions()) {
      if (continueReadingSuggestionsModalInstance) {
        closeContinueReadingSuggestionsModal('refresh');
      }
      return;
    }

    const panelState = buildContinueReadingPanelState();
    const signature = panelState.signature;
    if (!signature) {
      if (continueReadingSuggestionsModalInstance) {
        closeContinueReadingSuggestionsModal('refresh');
      }
      return;
    }

    if (
      !force &&
      continueReadingSuggestionsModalDismissedSignature &&
      continueReadingSuggestionsModalDismissedSignature === signature
    ) {
      return;
    }

    if (continueReadingSuggestionsModalInstance && continueReadingSuggestionsModalOpenSignature === signature) {
      return;
    }

    await tick();

    if (continueReadingSuggestionsModalInstance) {
      continueReadingSuggestionsModalOpenSignature = signature;
      continueReadingSuggestionsModalInstance.refresh(
        await buildContinueReadingSuggestionsModalOptions(panelState)
      );
      return;
    }

    continueReadingSuggestionsModalOpenSignature = signature;
    continueReadingSuggestionsModalInstance = new IRContinueReadingSuggestionsModalObsidian(
      plugin.app,
      await buildContinueReadingSuggestionsModalOptions(panelState)
    );
    continueReadingSuggestionsModalInstance.open();
  }

  function syncContinueReadingSuggestionsModalVisibility(): void {
    const panelState = buildContinueReadingPanelState();
    if (!panelState.signature || !shouldOfferContinueReadingSuggestions()) {
      if (continueReadingSuggestionsModalInstance) closeContinueReadingSuggestionsModal('refresh');
      return;
    }

    if (continueReadingSuggestionsModalInstance) {
      if (panelState.signature !== continueReadingSuggestionsModalOpenSignature) {
        const nextSignature = panelState.signature;
        continueReadingSuggestionsModalOpenSignature = nextSignature;
        void tick().then(() => {
          void buildContinueReadingSuggestionsModalOptions(panelState).then((options) => {
            if (
              continueReadingSuggestionsModalInstance &&
              continueReadingSuggestionsModalOpenSignature === nextSignature
            ) {
              continueReadingSuggestionsModalInstance.refresh(options);
            }
          });
        });
      }
    }
  }


  function prevMonth() {
    closeSchedulingMenu();
    currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
    void hydrateVisibleMonthHeatmapFromProjection(getActiveDeckIdsForQuery());
  }

  function nextMonth() {
    closeSchedulingMenu();
    currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
    void hydrateVisibleMonthHeatmapFromProjection(getActiveDeckIdsForQuery());
  }

  function goToToday() {
    closeSchedulingMenu();
    currentDate = new Date(today.getFullYear(), today.getMonth(), 1);
    void hydrateVisibleMonthHeatmapFromProjection(getActiveDeckIdsForQuery());
    selectedDate = new Date(today);
    const key = formatDateKey(selectedDate);
    const done = calendarProgressByDate[key] || [];
    processedChunkIds = new Set(done);
    void ensureDoneItemsVisibleForDate(key);
    syncContinueReadingSuggestionsModalVisibility();
  }


  function cancelPendingCalendarReconcile(): void {
    getSharedIRRefreshScheduler(plugin.app).cancelPendingCalendarReconcile();
  }

  function selectDay(date: Date) {
    closeSchedulingMenu();
    markInteractionPressure();
    cancelPendingCalendarReconcile();
    const key = formatDateKey(date);
    clearSelectedDateHydrationCompletedKeys([key]);
    selectedDate = new Date(date);
    const done = calendarProgressByDate[key] || [];
    processedChunkIds = new Set(done);
    void ensureDoneItemsVisibleForDate(key);
    syncContinueReadingSuggestionsModalVisibility();
  }

  function syncSelectionToFocusedDeck(): void {
    const activeDeckId = getActiveDeckFilterId();
    if (!activeDeckId) {
      return;
    }

    const currentKey = formatDateKey(selectedDate);
    if (getVisibleMaterialsForDate(currentKey).length > 0 || getVisiblePinnedForDate(currentKey).length > 0) {
      return;
    }

    const candidateKeys = Array.from(new Set([
      ...Array.from(materialsByDate.keys()),
      ...Array.from(pinnedByDate.keys())
    ]))
      .filter((dateKey) => {
        return getVisibleMaterialsForDate(dateKey).length > 0 || getVisiblePinnedForDate(dateKey).length > 0;
      })
      .sort((left, right) => left.localeCompare(right, 'zh-CN'));

    if (candidateKeys.length === 0) {
      return;
    }

    const todayKey = formatDateKey(today);
    let targetKey = candidateKeys.find((dateKey) => dateKey >= todayKey) || candidateKeys[0];
    if (getVisibleMaterialsForDate(todayKey).length > 0 || getVisiblePinnedForDate(todayKey).length > 0) {
      targetKey = todayKey;
    }

    const targetDate = parseDateKey(targetKey);
    if (!targetDate) {
      return;
    }

    currentDate = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
    selectedDate = targetDate;
    const done = calendarProgressByDate[targetKey] || [];
    processedChunkIds = new Set(done);
    void ensureDoneItemsVisibleForDate(targetKey);
  }


  function isSameDay(d1: Date, d2: Date): boolean {
    return d1.getFullYear() === d2.getFullYear() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getDate() === d2.getDate();
  }


  function openAddReadingTargetModal(): void {
    if (addReadingTargetModalInstance) {
      addReadingTargetModalInstance.close();
      addReadingTargetModalInstance = null;
    }

    addReadingTargetModalInstance = new AddReadingTargetModalObsidian(plugin.app, {
      plugin,
      initialDeckId: getActiveDeckFilterId(),
      scheduleDate: new Date(selectedDate),
      defaultScheduleMode: 'custom',
      onClose: () => {
        addReadingTargetModalInstance = null;
      },
      onAdded: () => {
        void refreshSidebarAfterDataUpdate({
          includeProgress: false,
          priorityDateKeys: [formatDateKey(selectedDate)]
        });
      }
    });
    addReadingTargetModalInstance.open();
  }

  function refreshAfterReadingPointPropertyEdit(): void {
    void refreshSidebarAfterDataUpdate({
      includeProgress: false,
      priorityDateKeys: [formatDateKey(selectedDate)]
    });
  }

  function openRenameReadingPoint(material: ScheduleItem): void {
    void promptRenameReadingPoint(plugin.app, material, refreshAfterReadingPointPropertyEdit);
  }

  function openEditReadingPointTraceLink(material: ScheduleItem): void {
    void openReadingPointTraceLinkPrompt(plugin, material, (result) => {
      if (result.linkChanged && result.savedResumeLink) {
        applyLocalMaterialResumeLinkUpdate(material.id, result.savedResumeLink);
        getWorkspaceSnapshotService().invalidate();
      }
      refreshAfterReadingPointPropertyEdit();
    });
  }

  function openEditReadingPointTags(material: ScheduleItem): void {
    void openReadingPointTagsPrompt(plugin.app, material, refreshAfterReadingPointPropertyEdit);
  }

  function openImportModal(): void {
    if (importModalInstance) {
      importModalInstance.close();
      importModalInstance = null;
    }

    importModalInstance = new MaterialImportModalObsidian(plugin.app, {
      plugin,
      onImportComplete: handleImportComplete,
      onClose: () => {
        importModalInstance = null;
      }
    });
    importModalInstance.open();
  }
  

  function handleImportComplete(result: BatchImportResult): void {
    if (result.errors.length > 0) {
      new Notice(`Import finished: ${result.success} created, ${result.skipped} skipped, ${result.errors.length} failed.`);
    } else if (result.skipped > 0) {
      new Notice(`Import finished: ${result.success} created, ${result.skipped} skipped.`);
    } else {
      new Notice(`Import finished: ${result.success} created.`);
    }

    void refreshSidebarAfterDataUpdate({ includeProgress: false });
  }

  async function getStorage(): Promise<IRStorageService> {
    if (!irStorage) {
      irStorage = new IRStorageService(plugin.app);
    }
    await irStorage.initialize();
    return irStorage;
  }

  async function loadCalendarProgress(): Promise<void> {
    try {
      const storage = await getStorage();
      const progressState = await storage.getCalendarProgressState();
      calendarProgressByDate = progressState.byDate;

      const key = formatDateKey(selectedDate);
      const done = calendarProgressByDate[key] || [];
      processedChunkIds = new Set(done);
      void ensureDoneItemsVisibleForDate(key);
      syncContinueReadingSuggestionsModalVisibility();
    } catch (error) {
      logger.error('[IRCalendarSidebar] Recovered error message.', error);
    }
  }

  async function refreshSidebarData(options: { forceRecompute?: boolean; includeProgress?: boolean } = {}): Promise<void> {
    await loadData({ forceRecompute: options.forceRecompute });
    if (options.includeProgress !== false) {
      void loadCalendarProgress();
    }
  }

  async function restoreExpandedMaterialSiblings(previouslyExpanded: Set<string>): Promise<void> {
    if (previouslyExpanded.size === 0) {
      return;
    }

    const todayKey = formatDateKey(selectedDate);
    const todayItems = materialsByDate.get(todayKey) || [];
    for (const item of todayItems) {
      if (!previouslyExpanded.has(item.id)) {
        continue;
      }

      const siblings = await getSiblingMaterials(item);
      const next = new Map(siblingCache);
      next.set(item.id, siblings);
      siblingCache = next;
    }
  }

  async function refreshSidebarAfterDataUpdate(
    options: {
      forceRecompute?: boolean;
      includeProgress?: boolean;
      priorityDateKeys?: string[];
      deckIds?: string[];
    } = {}
  ): Promise<void> {
    const previouslyExpanded = new Set(expandedMaterialIds);
    siblingCache = new Map();

    const priorityDateKeys = Array.from(
      new Set((options.priorityDateKeys || []).map((key) => String(key || '').trim()).filter(Boolean))
    );
    if (priorityDateKeys.length > 0 && !options.forceRecompute) {
      clearSelectedDateHydrationCompletedKeys(priorityDateKeys);
      await refreshPriorityCalendarDays(priorityDateKeys, { deckIds: options.deckIds });
      await restoreExpandedMaterialSiblings(previouslyExpanded);
      syncContinueReadingSuggestionsModalVisibility();
      return;
    }

    getWorkspaceSnapshotService().invalidate();
    getCalendarQueryService().invalidate();
    getSharedIRProjectionRuntime(plugin.app).markStale();
    getSharedIRRefreshScheduler(plugin.app).cancelPendingCalendarReconcile();
    clearSelectedDateHydrationCompletedKeys();
    await refreshSidebarData(options);
    await restoreExpandedMaterialSiblings(previouslyExpanded);
    syncContinueReadingSuggestionsModalVisibility();
  }

  async function recomputeAndRefreshSidebar(
    reason: UpdatedEventDetail['reason'],
    options?: { deckIds?: string[]; forceRecompute?: boolean; priorityDateKeys?: string[] }
  ): Promise<UpdatedEventDetail> {
    const detail = await recomputeAndBroadcastIRData(plugin.app, reason, {
      deckIds: options?.deckIds,
      leanSchedule: true,
      priorityDateKeys: options?.priorityDateKeys,
    });
    pendingLocalRefreshGeneratedAt = detail.generatedAt;
    try {
      await refreshSidebarAfterDataUpdate({
        forceRecompute: options?.forceRecompute,
        deckIds: options?.deckIds,
        priorityDateKeys: options?.priorityDateKeys ?? detail.priorityDateKeys,
        includeProgress: false,
      });
      lastLocallyHandledBroadcastGeneratedAt = Math.max(
        lastLocallyHandledBroadcastGeneratedAt,
        detail.generatedAt
      );
      return detail;
    } finally {
      if (pendingLocalRefreshGeneratedAt === detail.generatedAt) {
        pendingLocalRefreshGeneratedAt = 0;
      }
    }
  }

  async function recomputeAndAcknowledgeSidebarBroadcast(
    reason: UpdatedEventDetail['reason'],
    options?: { deckIds?: string[] }
  ): Promise<UpdatedEventDetail> {
    const detail = await recomputeAndBroadcastIRData(plugin.app, reason, options);
    lastLocallyHandledBroadcastGeneratedAt = Math.max(
      lastLocallyHandledBroadcastGeneratedAt,
      detail.generatedAt
    );
    return detail;
  }

  function applyLocalMaterialSourcePathUpdate(
    materialId: string,
    nextPath: string,
    options: { previousPath?: string; nextTitle?: string } = {}
  ): void {
    const normalizedId = String(materialId || '').trim();
    const normalizedNextPath = String(nextPath || '').trim();
    if (!normalizedId || !normalizedNextPath) return;

    const updateItem = (item: ScheduleItem): ScheduleItem => {
      if (item.id !== normalizedId) return item;
      return {
        ...item,
        sourceFile: normalizedNextPath,
        ...(options.nextTitle ? { title: options.nextTitle } : {})
      };
    };

    materialsByDate = new Map(
      Array.from(materialsByDate.entries(), ([dateKey, items]) => [
        dateKey,
        items.map(updateItem)
      ])
    );

    pinnedByDate = new Map(
      Array.from(pinnedByDate.entries(), ([dateKey, items]) => [
        dateKey,
        items.map(updateItem)
      ])
    );

    siblingCache = new Map(
      Array.from(siblingCache.entries(), ([cacheKey, items]) => [
        cacheKey,
        items.map(updateItem)
      ])
    );

    const previousPath = String(options.previousPath || '').trim();
    if (previousPath) {
      readingMaterials = readingMaterials.map((entry) =>
        entry.filePath === previousPath
          ? {
              ...entry,
              filePath: normalizedNextPath,
              title: options.nextTitle || entry.title
            }
          : entry
      );
    }
  }

  function applyLocalMaterialResumeLinkUpdate(materialId: string, nextResumeLink: string): void {
    const normalizedId = String(materialId || '').trim();
    const normalizedResumeLink = String(nextResumeLink || '').trim();
    if (!normalizedId || !normalizedResumeLink) return;

    const updateItem = (item: ScheduleItem): ScheduleItem => {
      if (item.id !== normalizedId) return item;
      return {
        ...item,
        resumeLink: normalizedResumeLink
      };
    };

    materialsByDate = new Map(
      Array.from(materialsByDate.entries(), ([dateKey, items]) => [
        dateKey,
        items.map(updateItem)
      ])
    );

    pinnedByDate = new Map(
      Array.from(pinnedByDate.entries(), ([dateKey, items]) => [
        dateKey,
        items.map(updateItem)
      ])
    );

    siblingCache = new Map(
      Array.from(siblingCache.entries(), ([cacheKey, items]) => [
        cacheKey,
        items.map(updateItem)
      ])
    );

    readingMaterials = readingMaterials.map((entry) => {
      const updatedItems = Array.from(materialsByDate.values())
        .flat()
        .filter((item) => item.id === normalizedId);
      const sourcePaths = new Set(
        updatedItems
          .map((item) => normalizePath(String(item.sourceFile || '').trim()))
          .filter(Boolean)
      );
      const entryPath = normalizePath(String(entry.filePath || '').trim());
      if (!entryPath || !sourcePaths.has(entryPath)) {
        return entry;
      }
      return {
        ...entry,
        resumeLink: normalizedResumeLink
      };
    });
  }

  async function resolveScheduleItemOpenResumeLink(
    material: ScheduleItem,
    filePath: string
  ): Promise<string> {
    if (material.resumeLink?.trim()) {
      return material.resumeLink.trim();
    }

    const persistedLink = await resolveReadingPointOpenLink(plugin.app, material);
    if (persistedLink.trim()) {
      return persistedLink.trim();
    }

    const rm = readingMaterials.find(m => m.filePath === filePath);
    if (rm?.resumeLink?.trim()) return rm.resumeLink.trim();

    return filePath;
  }

  async function getChunkScheduleAdapter(): Promise<IRChunkScheduleAdapter> {
    const storage = await getStorage();
    if (!chunkScheduleAdapter) {
      chunkScheduleAdapter = new IRChunkScheduleAdapter(plugin.app, storage);
    }
    return chunkScheduleAdapter;
  }

  async function getPdfBookmarkTaskService(): Promise<IRPdfBookmarkTaskService> {
    if (!pdfBookmarkTaskService) {
      pdfBookmarkTaskService = new IRPdfBookmarkTaskService(plugin.app);
    }
    await pdfBookmarkTaskService.initialize();
    return pdfBookmarkTaskService;
  }

  async function getEpubBookmarkTaskService(): Promise<IREpubBookmarkTaskService> {
    if (!epubBookmarkTaskService) {
      epubBookmarkTaskService = new IREpubBookmarkTaskService(plugin.app);
    }
    await epubBookmarkTaskService.initialize();
    return epubBookmarkTaskService;
  }

  function getEpubStorageService(): IrEpubStorageLike {
    if (!epubStorageService) {
      epubStorageService = getIrEpubStorageService(plugin.app);
    }
    return epubStorageService;
  }

  async function resolveEpubTaskFilePath(task: { sourceId?: string; epubFilePath?: string }): Promise<string> {
    return (
      await getEpubStorageService().resolveSourceFilePath(
        String(task?.sourceId || '').trim() || undefined,
        String(task?.epubFilePath || '').trim() || undefined
      )
    ) || String(task?.epubFilePath || '').trim();
  }

  async function resolveEpubIdentityKey(input: { sourceId?: string; filePath?: string }): Promise<string> {
    const normalizedSourceId = String(input?.sourceId || '').trim();
    if (normalizedSourceId) {
      return normalizedSourceId;
    }
    const normalizedPath = String(input?.filePath || '').trim();
    if (!normalizedPath) {
      return '';
    }
    const sourceEntry = await getEpubStorageService().ensureSourceIdentity(normalizedPath);
    return sourceEntry?.sourceId || normalizedPath;
  }

  async function getPointTagService(): Promise<IRPointTagService> {
    if (!pointTagService) {
      pointTagService = new IRPointTagService(plugin.app);
    }
    await pointTagService.initialize();
    return pointTagService;
  }

  async function getPointWriteService(): Promise<IRPointWriteService> {
    if (!pointWriteService) {
      pointWriteService = new IRPointWriteService(plugin.app);
    }
    return pointWriteService;
  }

  async function getMonitoringService(): Promise<IRMonitoringService> {
    if (!monitoringService) {
      monitoringService = new IRMonitoringService(plugin.app.vault);
      await monitoringService.load();
    }
    return monitoringService;
  }

  async function getV4SchedulerService(): Promise<IRV4SchedulerService> {
    if (!v4SchedulerService) {
      v4SchedulerService = new IRV4SchedulerService(plugin.app);
    }
    await v4SchedulerService.initialize();
    return v4SchedulerService;
  }

  async function resolveScheduleItemToBlockV4(item: ScheduleItem): Promise<IRBlockV4> {
    if (isPdfBookmarkTaskId(item.id)) {
      const pdfService = await getPdfBookmarkTaskService();
      const task = await getWorkspacePdfTaskById(item.id);
      if (task) return pdfService.toBlockV4(task);
    }

    if (isEpubBookmarkTaskId(item.id)) {
      const epubService = await getEpubBookmarkTaskService();
      const task = await getWorkspaceEpubTaskById(item.id);
      if (task) return epubService.toBlockV4(task);
    }

    const chunk = await getWorkspaceChunkById(item.id);
    if (chunk) {
      return {
        id: chunk.chunkId,
        sourcePath: chunk.filePath,
        blockId: chunk.chunkId,
        contentHash: '',
        status: chunk.scheduleStatus || 'new',
        priorityUi: chunk.priorityUi ?? chunk.priorityEff ?? item.priority ?? 5,
        priorityEff: chunk.priorityEff ?? chunk.priorityUi ?? item.priority ?? 5,
        intervalDays: chunk.intervalDays ?? item.intervalDays ?? 1,
        nextRepDate: chunk.nextRepDate ?? item.nextRepDate ?? 0,
        stats: { ...chunk.stats },
        meta: { ...chunk.meta, siblings: { ...(chunk.meta?.siblings || { prev: null, next: null }) } },
        createdAt: chunk.createdAt ?? Date.now(),
        updatedAt: chunk.updatedAt ?? Date.now()
      };
    }

    const legacyBlock = await getWorkspaceLegacyBlockById(item.id);
    if (legacyBlock) {
      return migrateToIRBlockV4(legacyBlock);
    }

    const fallback = createDefaultIRBlockV4(item.id, item.sourceFile, item.id);
    fallback.priorityUi = item.priority ?? 5;
    fallback.priorityEff = item.priority ?? 5;
    fallback.intervalDays = item.intervalDays ?? 1;
    fallback.nextRepDate = item.nextRepDate ?? 0;
    fallback.status = (item.scheduleStatus as any) || 'queued';
    return fallback;
  }

  async function resolveDeckIdForScheduleItem(item: ScheduleItem): Promise<string> {
    if (item.deckId) return resolveCanonicalDeckId(item.deckId);

    if (isPdfBookmarkTaskId(item.id)) {
      const task = await getWorkspacePdfTaskById(item.id);
      return resolveCanonicalDeckId(getTaskTopicId(task) || '') || irDecks[0]?.id || '';
    }

    if (isEpubBookmarkTaskId(item.id)) {
      const task = await getWorkspaceEpubTaskById(item.id);
      return resolveCanonicalDeckId(getTaskTopicId(task) || '') || irDecks[0]?.id || '';
    }

    const chunk = await getWorkspaceChunkById(item.id);
    if (chunk) {
      return resolveCanonicalDeckId(getChunkTopicIds(chunk)[0] || '') || irDecks[0]?.id || '';
    }

    const legacyBlock = await getWorkspaceLegacyBlockById(item.id);
    if (legacyBlock) {
      const matchingDeck = irDecks.find((deck) =>
        (deck.blockIds || []).includes(legacyBlock.id) ||
        String((deck as any)?.path || '').trim() === String((legacyBlock as any)?.deckPath || '').trim()
      );
      return (
        resolveCanonicalDeckId(matchingDeck?.id || String((legacyBlock as any)?.deckPath || '').trim()) ||
        irDecks[0]?.id ||
        ''
      );
    }

    return irDecks[0]?.id || '';
  }

  function resolveCanonicalDeckId(deckIdentifier: string): string {
    const normalized = String(deckIdentifier || '').trim();
    if (!normalized) {
      return '';
    }

    const matchedDeck = irDecks.find(
      (deck) => deck.id === normalized || String((deck as any)?.path || '').trim() === normalized
    );
    return matchedDeck?.id || normalized;
  }

  function getNextUnprocessedMaterial(currentId: string): ScheduleItem | null {
    const list = selectedMaterials;
    if (!list || list.length === 0) return null;

    const startIndex = Math.max(0, list.findIndex(m => m.id === currentId));

    for (let i = startIndex + 1; i < list.length; i++) {
      const m = list[i];
      if (!processedChunkIds.has(m.id)) return m;
    }

    for (let i = 0; i < startIndex; i++) {
      const m = list[i];
      if (!processedChunkIds.has(m.id)) return m;
    }

    return null;
  }


  async function tryResolveRenamedChunkSource(
    material: ScheduleItem,
    originalPath?: string
  ): Promise<string | null> {
    if (
      !material.id ||
      material.sourceType === 'legacy-block' ||
      isPdfBookmarkTaskId(material.id) ||
      isEpubBookmarkTaskId(material.id)
    ) {
      return null;
    }

    try {
      const storage = await getStorage();
      const chunk = await getWorkspaceChunkById(material.id);
      const chunkFilePath = String((chunk as any)?.filePath || '').trim();

      if (chunkFilePath) {
        const existingChunkFile = plugin.app.vault.getAbstractFileByPath(chunkFilePath);
        if (existingChunkFile instanceof TFile) {
          return existingChunkFile.path;
        }
      }

      const matched = plugin.app.vault.getMarkdownFiles().find((candidate) => {
        const cache = plugin.app.metadataCache.getFileCache(candidate);
        const fm = cache?.frontmatter as any;
        const chunkId = String(fm?.chunk_id || '').trim();
        return chunkId === material.id;
      });

      if (!matched) {
        return null;
      }

      if (chunk && (chunk as any).filePath !== matched.path) {
        (chunk as any).filePath = matched.path;
        (chunk as any).updatedAt = Date.now();
        await storage.saveChunkData(chunk);
      }

      applyLocalMaterialSourcePathUpdate(material.id, matched.path, {
        previousPath: originalPath,
        nextTitle: matched.basename
      });
      await recomputeAndAcknowledgeSidebarBroadcast('metadata_renamed');
      return matched.path;
    } catch (error) {
      logger.warn('[IRCalendarSidebar] Recovered warning message.', error);
      return null;
    }
  }

  async function openMaterial(material: ScheduleItem) {
    const materialId = String(material.id || '').trim();
    if (!materialId) {
      return;
    }
    if (openMaterialInFlightId === materialId) {
      return;
    }
    openMaterialInFlightId = materialId;
    try {
      if (await tryOpenReadingPointFromScheduleItem(plugin.app, material)) {
        return;
      }
      if (resolveScheduleItemWebUrl(plugin.app, material)) {
        new Notice(t('irSidebar.calendar.openWebFailed'));
        return;
      }

      const filePath = material.sourceFile;

      if (!filePath) {
        const recoveredPath = await tryResolveRenamedChunkSource(material);
        if (recoveredPath) {
          const contextPath = plugin.app.workspace.getActiveFile()?.path ?? '';
          await plugin.app.workspace.openLinkText(recoveredPath, contextPath, false);
          return;
        }

        logger.warn('[IRCalendarSidebar] Recovered warning message.', material);
        await showMissingSourceDocumentDialog(material);
        return;
      }

      const file = plugin.app.vault.getAbstractFileByPath(filePath);
      if (!(file instanceof TFile)) {
        logger.warn('[IRCalendarSidebar] Recovered warning message.', filePath);

        const recoveredPath = await tryResolveRenamedChunkSource(material, filePath);
        if (recoveredPath) {
          const contextPath = plugin.app.workspace.getActiveFile()?.path ?? '';
          await plugin.app.workspace.openLinkText(recoveredPath, contextPath, false);
          return;
        }

        await showMissingSourceDocumentDialog(material, filePath);
        return;
      }

      const contextPath = plugin.app.workspace.getActiveFile()?.path ?? '';
      const rawLink = await resolveScheduleItemOpenResumeLink(material, filePath);
      const linkToOpen = rawLink.trim().replace(/^!?\[\[/, '').replace(/\]\]$/, '').split('|')[0];
      await plugin.app.workspace.openLinkText(linkToOpen, contextPath, false);
      logger.debug('[IRCalendarSidebar] Recovered debug message.', linkToOpen);
    } catch (error) {
      logger.error('[IRCalendarSidebar] Failed to open block.', error);
      new Notice(t('irSidebar.calendar.openPointFailed'));
    } finally {
      if (openMaterialInFlightId === materialId) {
        openMaterialInFlightId = null;
      }
    }
  }


  interface SearchResultEntry {
    item: ScheduleItem;
    dateKey: string;
  }

  interface ContinueReadingSuggestion {
    item: ScheduleItem;
    dateKey: string;
    dayOffset: number;
    metaText: string;
    score: number;
  }

  interface SuspendedContinueReadingSuggestion {
    item: ScheduleItem;
    metaText: string;
    score: number;
  }

  interface ContinueReadingPanelState {
    suggestions: ContinueReadingSuggestion[];
    suspended: SuspendedContinueReadingSuggestion[];
    signature: string;
  }

  function getScheduleItemDayKey(item: ScheduleItem): string {
    const anchorDayKey = String(item.sourceSequenceAnchorDateKey || '').trim();
    if (anchorDayKey) {
      return anchorDayKey;
    }
    if (item.nextReviewDate) {
      return formatDateKey(item.nextReviewDate);
    }
    if (item.nextRepDate > 0) {
      return formatDateKey(new Date(item.nextRepDate));
    }
    return '';
  }

  function compareScheduleItemsByScheduledDay(left: ScheduleItem, right: ScheduleItem): number {
    const leftDayKey = getScheduleItemDayKey(left);
    const rightDayKey = getScheduleItemDayKey(right);
    const dayCompare = leftDayKey.localeCompare(rightDayKey, 'zh-CN');
    if (dayCompare !== 0) {
      return dayCompare;
    }

    return compareScheduleItemsForDailyQueue(left, right, leftDayKey || undefined);
  }

  function getLegacyBlockDisplayName(block: IRBlock): string | undefined {
    const displayName = Array.isArray(block.headingPath) && block.headingPath.length > 0
      ? String(block.headingPath[block.headingPath.length - 1] || '').trim()
      : '';
    return displayName || undefined;
  }

  function isSuspendedContinueReadingStatus(status: string | undefined | null): boolean {
    const normalizedStatus = String(status || '').trim().toLowerCase();
    return normalizedStatus === 'suspended' || normalizedStatus === 'archived';
  }


  function getIRScheduleParams(): { mBase: number; maxInterval: number; halfLifeDays: number; enableTagGroup: boolean } {
    const ir = plugin.getIncrementalReadingSettings?.() ?? plugin.settings?.incrementalReading;
    return {
      mBase: ir?.defaultIntervalFactor ?? 1.5,
      maxInterval: ir?.maxInterval ?? 365,
      halfLifeDays: ir?.priorityHalfLifeDays ?? 7,
      enableTagGroup: ir?.enableTagGroupPrior !== false
    };
  }

  function normalizeVaultPath(path?: string | null): string {
    return path ? normalizePath(path) : '';
  }

  function formatAssociatedNoteLabel(notePath?: string | null): string {
    const normalized = normalizeVaultPath(notePath);
    if (!normalized) return t('irSidebar.associatedNote.untitled');

    const filename = normalized.split('/').pop() || normalized;
    return (
      filename.replace(/\.excalidraw\.md$/i, '').replace(/\.(?:md|markdown|canvas)$/i, '') || normalized
    );
  }

  function getAssociatedNoteActionLabel(material: ScheduleItem): string {
    const noteLabel = formatAssociatedNoteLabel(getVisibleAssociatedNotePath(material));
    return t('irSidebar.associatedNote.actionOpen', { name: noteLabel });
  }

  function getAssociatedNoteActionTooltip(material: ScheduleItem): string {
    const noteLabel = formatAssociatedNoteLabel(getVisibleAssociatedNotePath(material));
    return t('irSidebar.associatedNote.tooltipOpen', { name: noteLabel });
  }

  function withPointAssociatedNote(material: ScheduleItem, notePath: string | null): ScheduleItem {
    return withPointAssociatedNotes(material, notePath ? [notePath] : []);
  }

  function getAssociatedNotePathsForMaterial(material: ScheduleItem): string[] {
    return resolveAssociatedNotePaths({
      associatedNotePath: material.primaryAssociatedNotePath || material.associatedNotePath,
      associatedNotePaths: material.associatedNotePaths
    });
  }

  function withPointAssociatedNotes(material: ScheduleItem, notePaths: string[]): ScheduleItem {
    const normalizedNotePaths = resolveAssociatedNotePaths({
      associatedNotePaths: notePaths
    });
    const normalizedNotePath = normalizedNotePaths[0] || '';
    return {
      ...material,
      primaryAssociatedNotePath: normalizedNotePath || undefined,
      associatedNotePath: normalizedNotePath || undefined,
      associatedNotePaths: normalizedNotePaths,
      associatedNoteScope: normalizedNotePath ? 'point' : undefined
    };
  }

  function patchAssociatedNoteInItems(items: ScheduleItem[], blockId: string, notePaths: string[]): ScheduleItem[] {
    let changed = false;
    const nextItems = items.map((item) => {
      if (item.id !== blockId) return item;
      changed = true;
      return withPointAssociatedNotes(item, notePaths);
    });
    return changed ? nextItems : items;
  }

  function patchAssociatedNoteInMap(
    source: Map<string, ScheduleItem[]>,
    blockId: string,
    notePaths: string[]
  ): Map<string, ScheduleItem[]> {
    let changed = false;
    const next = new Map<string, ScheduleItem[]>();

    for (const [key, items] of source.entries()) {
      const patchedItems = patchAssociatedNoteInItems(items, blockId, notePaths);
      if (patchedItems !== items) {
        changed = true;
      }
      next.set(key, patchedItems);
    }

    return changed ? next : source;
  }

  function applyLocalAssociatedNoteUpdate(blockId: string, notePaths: string[]): void {
    materialsByDate = patchAssociatedNoteInMap(materialsByDate, blockId, notePaths);
    pinnedByDate = patchAssociatedNoteInMap(pinnedByDate, blockId, notePaths);
    siblingCache = patchAssociatedNoteInMap(siblingCache, blockId, notePaths);

    if (schedulingMenuTarget?.id === blockId) {
      schedulingMenuTarget = withPointAssociatedNotes(schedulingMenuTarget, notePaths);
    }

    if (priorityMenuTarget?.id === blockId) {
      priorityMenuTarget = withPointAssociatedNotes(priorityMenuTarget, notePaths);
    }
  }

  async function persistPointAssociatedNotePaths(material: ScheduleItem, notePaths: string[]): Promise<boolean> {
    const normalizedNotePaths = resolveAssociatedNotePaths({
      associatedNotePaths: notePaths
    });
    const pointWriteService = await getPointWriteService();
    const result = await pointWriteService.updatePointAssociatedNotes(
      resolveScheduleItemWriteTarget(material),
      normalizedNotePaths
    );
    return !!result;
  }

  async function setAssociatedNotePathForMaterial(material: ScheduleItem, notePath: string | null): Promise<void> {
    const normalizedNotePath = notePath ? normalizeVaultPath(notePath) : null;
    await setAssociatedNotePathsForMaterial(material, normalizedNotePath ? [normalizedNotePath] : []);
  }

  async function setAssociatedNotePathsForMaterial(material: ScheduleItem, notePaths: string[]): Promise<void> {
    if (!ensurePremiumFeature(PREMIUM_FEATURES.ASSOCIATED_NOTES)) {
      return;
    }
    if (!canUsePointLinkedNotes(material)) {
      return;
    }

    const normalizedNotePaths = resolveAssociatedNotePaths({
      associatedNotePaths: notePaths
    });
    const currentNotePaths = getAssociatedNotePathsForMaterial(material);

    if (
      normalizedNotePaths.length === currentNotePaths.length &&
      normalizedNotePaths.every((path, index) => path === currentNotePaths[index])
    ) {
      if (normalizedNotePaths.length > 0) {
        new Notice(t('irSidebar.associatedNote.alreadyLinkedSame'), 2600);
      }
      return;
    }

    try {
      const saved = await persistPointAssociatedNotePaths(material, normalizedNotePaths);

      if (!saved) {
        new Notice(t('irSidebar.associatedNote.recordNotFound'), 3200);
        return;
      }

      applyLocalAssociatedNoteUpdate(material.id, normalizedNotePaths);
      new Notice(
        normalizedNotePaths[0]
          ? t('irSidebar.associatedNote.linked', { name: formatAssociatedNoteLabel(normalizedNotePaths[0]) })
          : t('irSidebar.associatedNote.unlinked'),
        2800
      );
      await recomputeAndRefreshSidebar('ui_refresh', { forceRecompute: true });
    } catch (error) {
      logger.error('[IRCalendarSidebar] Recovered error message.', error);
      new Notice(t('irSidebar.associatedNote.setFailed'), 3200);
    }
  }

  async function chooseAssociatedNoteForMaterial(material: ScheduleItem): Promise<void> {
    const file = await pickLinkableVaultNoteFile(plugin.app, {
      placeholder: t('irSidebar.associatedNote.pickerPlaceholder')
    });
    if (!file) return;

    await setAssociatedNotePathForMaterial(material, file.path);
  }

  async function addAssociatedNoteForMaterial(material: ScheduleItem): Promise<void> {
    const existingPaths = new Set(getAssociatedNotePathsForMaterial(material));
    const file = await pickLinkableVaultNoteFile(plugin.app, {
      placeholder: t('irSidebar.associatedNote.pickerPlaceholder')
    });
    if (!file) return;

    const nextPaths = [...existingPaths, file.path];
    await setAssociatedNotePathsForMaterial(material, nextPaths);
  }

  async function setPrimaryAssociatedNoteForMaterial(material: ScheduleItem, notePath: string): Promise<void> {
    const currentPaths = getAssociatedNotePathsForMaterial(material);
    if (currentPaths.length === 0) return;

    const remainingPaths = currentPaths.filter((path) => path !== notePath);
    await setAssociatedNotePathsForMaterial(material, [notePath, ...remainingPaths]);
  }

  async function removeAssociatedNoteForMaterial(material: ScheduleItem, notePath: string): Promise<void> {
    const currentPaths = getAssociatedNotePathsForMaterial(material);
    if (currentPaths.length === 0) return;

    await setAssociatedNotePathsForMaterial(
      material,
      currentPaths.filter((path) => path !== notePath)
    );
  }

  async function openAssociatedNoteByPath(notePath: string): Promise<void> {
    if (!ensurePremiumFeature(PREMIUM_FEATURES.ASSOCIATED_NOTES)) {
      return;
    }
    const opened = await openLinkedVaultNote(plugin.app, notePath);
    if (!(opened instanceof TFile)) {
      new Notice(t('irSidebar.associatedNote.missing'), 3200);
    }
  }

  async function openAssociatedNoteInSidebar(material: ScheduleItem): Promise<void> {
    const notePath = getVisibleAssociatedNotePath(material);
    if (!notePath) {
      new Notice(t('irSidebar.associatedNote.notLinked'), 2600);
      return;
    }

    await openAssociatedNoteByPath(notePath);
  }

  function handleAssociatedNoteClick(event: MouseEvent, material: ScheduleItem) {
    event.preventDefault();
    void openAssociatedNoteInSidebar(material);
  }

  async function createAssociatedNoteForMaterial(
    material: ScheduleItem,
    mode: 'replace' | 'append'
  ): Promise<void> {
    const existingPaths = getAssociatedNotePathsForMaterial(material);
    const preferredFolderPath = resolvePreferredAssociatedNoteFolder(plugin.app, {
      notePaths: existingPaths,
      fallbackFilePath: material.sourceFile
    });
    const baseName = material.displayName || material.title || t('irSidebar.controls.untitled');
    const createdFile = await createAssociatedMarkdownNote(plugin.app, {
      baseName,
      preferredFolderPath
    });

    const nextPaths = mode === 'append' ? [...existingPaths, createdFile.path] : [createdFile.path];
    await setAssociatedNotePathsForMaterial(material, nextPaths);
    await openAssociatedNoteByPath(createdFile.path);
  }

  function buildAssociatedNoteSubmenu(submenu: Menu, material: ScheduleItem) {
    const notePaths = getAssociatedNotePathsForMaterial(material);
    populateAssociatedNoteMenu({
      menu: submenu,
      notePaths,
      getLabel: (notePath) => getLinkedVaultNoteLabel(plugin.app, notePath) || formatAssociatedNoteLabel(notePath),
      onOpen: (notePath) => openAssociatedNoteByPath(notePath),
      onPick: (mode) => (mode === 'append' ? addAssociatedNoteForMaterial(material) : chooseAssociatedNoteForMaterial(material)),
      onCreate: (mode) => createAssociatedNoteForMaterial(material, mode),
      onSetPrimary: (notePath) => setPrimaryAssociatedNoteForMaterial(material, notePath),
      onRemove: (notePath) => removeAssociatedNoteForMaterial(material, notePath),
      onClear: () => setAssociatedNotePathsForMaterial(material, [])
    });
  }


  const SCHEDULING_MENU_ACTIONS = ['intensive', 'normal', 'slow', 'postpone'] as const;
  type SchedulingAction = typeof SCHEDULING_MENU_ACTIONS[number];
  type SchedulingMenuPreviewState = 'idle' | 'loading' | 'ready' | 'error';
  let schedulingMenuPreviewState = $state<SchedulingMenuPreviewState>('idle');
  let schedulingDateByAction = $state<Record<SchedulingAction, string>>({
    intensive: '',
    normal: '',
    slow: '',
    postpone: '',
  });
  let schedulingPreviewLoadToken = 0;

  let schedulingConfig = $derived(
    SCHEDULING_MENU_ACTIONS.map((action) => ({
      action,
      label: t(`irSidebar.scheduling.${action}`),
      color:
        action === 'intensive' ? 'var(--weave-error, #ef4444)'
        : action === 'normal' ? 'var(--weave-success, #10b981)'
        : action === 'slow' ? 'var(--weave-warning, #f59e0b)'
        : 'var(--text-muted, #6b7280)',
      intervalMultiplier:
        action === 'intensive' ? 0.5
        : action === 'normal' ? 1.0
        : action === 'slow' ? 1.8
        : 0,
      isPostpone: action === 'postpone',
    }))
  );

  type SchedulingMenuContext = {
    target: ScheduleItem;
    pinnedKey: string;
  };

  function captureSchedulingMenuContext(): SchedulingMenuContext | null {
    const target = schedulingMenuTarget;
    if (!target) return null;
    return {
      target,
      pinnedKey: schedulingMenuDateKey || formatDateKey(selectedDate),
    };
  }

  function activateSchedulingMenuAction(action: SchedulingAction, event: MouseEvent | PointerEvent) {
    event.preventDefault();
    event.stopPropagation();

    const context = captureSchedulingMenuContext();
    if (!context) {
      logger.warn('[IRCalendarSidebar] Scheduling action ignored: missing menu target');
      return;
    }

    void handleSchedulingAction(action, context);
  }

  function resetSchedulingMenuPreviewState(): void {
    schedulingMenuPreviewState = 'idle';
    schedulingDateByAction = {
      intensive: '',
      normal: '',
      slow: '',
      postpone: '',
    };
    schedulingPreviewByAction = { intensive: null, normal: null, slow: null, postpone: null };
    schedulingMenuTagGroupIntervalFactor = 1;
    schedulingMenuPreparedBlocks = null;
  }

  function closeSchedulingMenu() {
    schedulingMenuOpen = false;
    schedulingMenuTarget = null;
    schedulingMenuAnchor = null;
    schedulingMenuDateKey = '';
    schedulingPreviewFocusAction = 'normal';
    schedulingPreviewLoadToken += 1;
    resetSchedulingMenuPreviewState();
  }

  function openSchedulingMenu(event: MouseEvent, material: ScheduleItem) {
    event.preventDefault();
    event.stopPropagation();
    openSchedulingMenuForAnchor(event.currentTarget as HTMLElement, material);
  }

  function openSchedulingMenuForAnchor(anchor: HTMLElement, material: ScheduleItem) {
    const alreadyOpenForSame = schedulingMenuOpen && schedulingMenuTarget?.id === material.id;
    if (alreadyOpenForSame) {
      closeSchedulingMenu();
      return;
    }

    schedulingMenuTarget = material;
    schedulingMenuAnchor = anchor;
    schedulingMenuDateKey = formatDateKey(selectedDate);
    schedulingMenuOpen = true;
    const loadToken = ++schedulingPreviewLoadToken;
    applySchedulingMenuDatesSync(material);
    void refineSchedulingMenuPreviews(material, loadToken);
  }

  function closePriorityMenu() {
    priorityMenuOpen = false;
    priorityMenuTarget = null;
    priorityMenuAnchor = null;
    priorityPreviewDetails = null;
  }

  function closeDayLoadPopover(): void {
    dayLoadPopoverOpen = false;
  }

  function toggleDayLoadPopover(event: MouseEvent): void {
    event.stopPropagation();
    dayLoadPopoverOpen = !dayLoadPopoverOpen;
  }

  function openPriorityMenuForAnchor(anchor: HTMLElement, material: ScheduleItem) {
    const alreadyOpenForSame = priorityMenuOpen && priorityMenuTarget?.id === material.id;
    if (alreadyOpenForSame) {
      closePriorityMenu();
      return;
    }

    priorityMenuTarget = material;
    priorityMenuAnchor = anchor;
    prioritySliderExpanded = true;
    priorityMenuOpen = true;
    priorityPreviewDetails = null;
  }

  function formatReviewDateTextFromTimestamp(timestamp?: number): string {
    if (!timestamp || timestamp <= 0) return 'No review date';
    return new Date(timestamp).toLocaleDateString();
  }

  function buildPreviewDetails(
    futurePlanPreview: any,
    beforeBlock: IRBlockV4 | null,
    afterBlock: IRBlockV4 | null,
    title: string
  ): PreviewDetails | null {
    if (!afterBlock) return null;

    const beforeDateText = formatReviewDateTextFromTimestamp(beforeBlock?.nextRepDate);
    const afterDateText = afterBlock.nextRepDate > 0
      ? formatSiblingDueDate(afterBlock.nextRepDate)
      : t('irSidebar.controls.unscheduled');
    const changeSummary = futurePlanPreview?.changeSummary;
    const impactedItems: ImpactedPreviewItem[] = (changeSummary?.movedItems || [])
      .filter((item: any) => item.itemId !== afterBlock.id)
      .slice(0, 3)
      .map((item: any) => ({
        id: item.itemId,
        title: item.title || title,
        beforeDateText: item.fromDateKey || 'Unscheduled',
        afterDateText: item.toDateKey || 'Unscheduled',
      }));
    const dayDeltas: PreviewDayDelta[] = (changeSummary?.impactedDays || [])
      .slice(0, 3)
      .map((day: any) => ({
        dateKey: day.dateKey,
        beforeMinutes: day.beforeMinutes,
        afterMinutes: day.afterMinutes
      }));
    const shiftedDays = dayDeltas.length;
    const changedCount = changeSummary?.changedItemCount ?? 0;

    return {
      headline: `Schedule change: ${beforeDateText} -> ${afterDateText}`,
      beforeDateText,
      afterDateText,
      changedItemCount: changedCount,
      impactedDays: shiftedDays,
      impactedItems,
      dayDeltas
    };
  }

  async function handlePriorityPreview(nextUi: number) {
    const target = priorityMenuTarget;
    if (!target) return;
    try {
      const ui = Math.max(0, Math.min(10, nextUi));
      const scheduler = await getV4SchedulerService();
      const block = await resolveScheduleItemToBlockV4(target);
      const deckId = await resolveDeckIdForScheduleItem(target);
      const result = await scheduler.previewPriorityUpdateV4(
        block,
        ui,
        'calendar_sidebar_preview',
        deckId
      );
      const oldUi = target.explanation?.manualPriority ?? target.priority ?? 5;
      const oldEff = block.priorityEff ?? block.priorityUi ?? oldUi;
      const newEff = result.block.priorityEff ?? ui;
      priorityPreviewDetails = buildPriorityChangePreviewDetails({
        beforePriorityUi: oldUi,
        afterPriorityUi: ui,
        beforePriorityEff: oldEff,
        afterPriorityEff: newEff,
        nextRepDate: target.nextRepDate,
      });
    } catch {
      priorityPreviewDetails = null;
    }
  }

  async function loadSchedulingImpactPreviews(
    material: ScheduleItem,
    originalBlock: IRBlockV4,
    loadToken: number
  ): Promise<void> {
    try {
      const deckId = await resolveDeckIdForScheduleItem(material);
      const coordinator = getSharedIRScheduleImpactPreviewCoordinator(plugin.app);
      const advancedSettings = readAdvancedScheduleSettingsSnapshot(plugin.app);
      const scheduler = await getV4SchedulerService();
      const tagGroup = originalBlock.meta?.tagGroup || 'default';
      const profile = await scheduler.getTagGroupService().getProfile(tagGroup);
      const menuBlocks = computeAllScheduleMenuBlocks(originalBlock, {
        block: originalBlock,
        advancedSettings,
        tagGroupIntervalFactor: profile.intervalFactorBase,
      });

      const entries = await Promise.allSettled(
        schedulingConfig.map(async (cfg) => {
          const updatedBlock = menuBlocks[cfg.action];
          const futurePlanPreview = await coordinator.previewBlockMutationImpact(
            originalBlock,
            updatedBlock,
            deckId
          );
          return [
            cfg.action,
            buildPreviewDetails(
              futurePlanPreview,
              originalBlock,
              updatedBlock,
              material.displayName || material.title || material.id
            ),
          ] as const;
        })
      );

      if (loadToken !== schedulingPreviewLoadToken) {
        return;
      }

      const next: Record<SchedulingAction, PreviewDetails | null> = {
        ...schedulingPreviewByAction,
      };
      for (const entry of entries) {
        if (entry.status !== 'fulfilled') {
          continue;
        }
        const [action, preview] = entry.value;
        if (preview) {
          next[action] = preview;
        }
      }
      schedulingPreviewByAction = next;
    } catch (error) {
      logger.debug('[IRCalendarSidebar] Scheduling impact preview skipped:', error);
    }
  }

  function formatSchedulingMenuDate(nextRepDate: number): string {
    return nextRepDate > 0
      ? formatSiblingDueDate(nextRepDate)
      : t('irSidebar.controls.unscheduled');
  }

  function buildSchedulingMenuDatesAndPreviews(
    material: ScheduleItem,
    block: IRBlockV4,
    tagGroupIntervalFactor = 1
  ): {
    dates: Record<SchedulingAction, string>;
    previews: Record<SchedulingAction, PreviewDetails | null>;
  } {
    const advancedSettings = readAdvancedScheduleSettingsSnapshot(plugin.app);
    const menuBlocks = computeAllScheduleMenuBlocks(block, {
      block,
      advancedSettings,
      tagGroupIntervalFactor,
    });
    const title = material.displayName || material.title || material.id;
    const dates = {
      intensive: '',
      normal: '',
      slow: '',
      postpone: '',
    } satisfies Record<SchedulingAction, string>;
    const previews = {
      intensive: null,
      normal: null,
      slow: null,
      postpone: null,
    } as Record<SchedulingAction, PreviewDetails | null>;

    for (const cfg of schedulingConfig) {
      const updatedBlock = menuBlocks[cfg.action];
      dates[cfg.action] = formatSchedulingMenuDate(updatedBlock.nextRepDate);
      previews[cfg.action] = buildPreviewDetails(undefined, block, updatedBlock, title);
    }

    schedulingMenuPreparedBlocks = menuBlocks;

    return { dates, previews };
  }

  /** Tier-A：同步显示安排日期，绝不 await 全库加载。 */
  function applySchedulingMenuDatesSync(material: ScheduleItem): void {
    const block = scheduleItemToPreviewBlockV4(material);
    const { dates, previews } = buildSchedulingMenuDatesAndPreviews(material, block);
    schedulingDateByAction = dates;
    schedulingPreviewByAction = previews;
    schedulingMenuPreviewState = 'ready';
  }

  async function refineSchedulingMenuPreviews(material: ScheduleItem, loadToken: number): Promise<void> {
    try {
      const block = await resolveScheduleItemToBlockV4(material);
      if (loadToken !== schedulingPreviewLoadToken) {
        return;
      }

      let tagGroupIntervalFactor = 1;
      try {
        const scheduler = await getV4SchedulerService();
        const tagGroup = block.meta?.tagGroup || 'default';
        const profile = await scheduler.getTagGroupService().getProfile(tagGroup);
        tagGroupIntervalFactor = Number(profile.intervalFactorBase ?? 1) || 1;
        schedulingMenuTagGroupIntervalFactor = tagGroupIntervalFactor;
      } catch (error) {
        logger.debug('[IRCalendarSidebar] Tag group profile skipped for menu refine:', error);
      }

      if (loadToken !== schedulingPreviewLoadToken) {
        return;
      }

      const { dates, previews } = buildSchedulingMenuDatesAndPreviews(
        material,
        block,
        tagGroupIntervalFactor
      );
      schedulingDateByAction = dates;
      schedulingPreviewByAction = previews;
      schedulingMenuPreviewState = 'ready';

      if (showSchedulingPreview) {
        void loadSchedulingImpactPreviews(material, block, loadToken);
      }
    } catch (error) {
      logger.debug('[IRCalendarSidebar] Scheduling menu refine skipped:', error);
    }
  }

  async function loadSchedulingPreviews(material: ScheduleItem) {
    const loadToken = ++schedulingPreviewLoadToken;
    applySchedulingMenuDatesSync(material);
    void refineSchedulingMenuPreviews(material, loadToken);
  }

  async function handlePriorityUiChange(nextUi: number) {
    const target = priorityMenuTarget;
    if (!target) return;

    try {
      const ui = Math.max(0, Math.min(10, nextUi));
      const oldPriorityUi = target.explanation?.manualPriority ?? target.priority ?? 5;
      const scheduler = await getV4SchedulerService();
      const block = await resolveScheduleItemToBlockV4(target);
      const deckId = await resolveDeckIdForScheduleItem(target);
      const oldEff = block.priorityEff ?? block.priorityUi ?? target.priority ?? 5;
      const result = await scheduler.updatePriorityWithPreviewV4(block, ui, 'calendar_sidebar_slider', deckId);
      const newEff = result.block.priorityEff ?? ui;

      const monitoring = await getMonitoringService();
      monitoring.recordPriorityChange(target.id, oldPriorityUi, ui, oldEff, newEff);
      monitoring.recordDecisionEvent({
        itemId: target.id,
        action: 'change_priority',
        beforeDate: target.nextReviewDate ? target.nextReviewDate.toISOString() : undefined,
        afterDate: target.nextReviewDate ? target.nextReviewDate.toISOString() : undefined,
        beforePriority: oldPriorityUi,
        afterPriority: ui,
        sourceType: 'calendar_sidebar'
      });
      await monitoring.save();

      closePriorityMenu();

      const selectedDateKey = formatDateKey(selectedDate);
      const affectedDateKeys = mergeScheduleItemDateKeys(
        target.id,
        materialsByDate,
        pinnedByDate,
        [selectedDateKey]
      );

      ({ materialsByDate, pinnedByDate, siblingCache } = applyLocalSchedulePriorityPatch({
        materialsByDate,
        pinnedByDate,
        siblingCache,
        itemId: target.id,
        priorityUi: ui,
        priorityEff: newEff,
        dateKeys: affectedDateKeys,
        sortSiblingCacheByDateKey: selectedDateKey,
      }));

      await persistSchedulePriorityDaySlices(
        plugin.app,
        materialsByDate,
        affectedDateKeys,
        deckId ? [deckId] : getActiveDeckIdsForQuery()
      );

      const detail = broadcastPriorityChangeUpdate(plugin.app, {
        deckIds: deckId ? [deckId] : getActiveDeckIdsForQuery(),
        priorityDateKeys: affectedDateKeys,
      });
      lastLocallyHandledBroadcastGeneratedAt = Math.max(
        lastLocallyHandledBroadcastGeneratedAt,
        detail.generatedAt
      );
    } catch (error) {
      logger.error('[IRCalendarSidebar] Recovered error message.', error);
      new Notice(t('irSidebar.notices.prioritySetFailed'));
    }
  }

  async function suspendMaterial(material: ScheduleItem) {
    try {
      const scheduler = await getV4SchedulerService();
      const block = await resolveScheduleItemToBlockV4(material);
      const deckId = await resolveDeckIdForScheduleItem(material);
      await scheduler.suspendBlockWithPreviewV4(block, deckId);
      new Notice(t('irSidebar.notices.suspended'));
      closePriorityMenu();
      closeSchedulingMenu();
      await recomputeAndRefreshSidebar('suspend_block');
    } catch (error) {
      logger.error('[IRCalendarSidebar] Recovered error message.', error);
      new Notice(t('irSidebar.notices.suspendFailed'));
    }
  }

  async function archiveMaterial(material: ScheduleItem) {
    try {
      const scheduler = await getV4SchedulerService();
      const block = await resolveScheduleItemToBlockV4(material);
      const deckId = await resolveDeckIdForScheduleItem(material);
      await scheduler.archiveBlockWithPreviewV4(block, deckId);
      new Notice(t('irSidebar.notices.archived'));
      closePriorityMenu();
      closeSchedulingMenu();
      await recomputeAndRefreshSidebar('archive_block');
    } catch (error) {
      logger.error('[IRCalendarSidebar] Recovered error message.', error);
      new Notice(t('irSidebar.notices.archiveFailed'));
    }
  }

  function getReadingPointBatchService(): IRReadingPointBatchService {
    if (!readingPointBatchService) {
      readingPointBatchService = new IRReadingPointBatchService(plugin.app, {
        resolveBlockV4: resolveScheduleItemToBlockV4,
        onBatchRemoved: removeLocalMaterialReferencesBatch
      });
    }
    return readingPointBatchService;
  }

  function getBatchSelectableMaterials(): ScheduleItem[] {
    if (hasActiveSearch) {
      return searchMatchedEntries.map((entry) => entry.item);
    }
    return selectedMaterials;
  }

  function collectBatchSelectableMaterialMap(): Map<string, ScheduleItem> {
    const map = new Map<string, ScheduleItem>();
    for (const item of getBatchSelectableMaterials()) {
      map.set(item.id, item);
    }
    for (const siblings of siblingCache.values()) {
      for (const sibling of siblings) {
        map.set(sibling.id, sibling);
      }
    }
    return map;
  }

  function resolveBatchOperationTargets(anchor: ScheduleItem): ScheduleItem[] {
    if (batchSelectedIds.size > 0) {
      const selected = Array.from(batchSelectedIds)
        .map((id) => collectBatchSelectableMaterialMap().get(id))
        .filter((item): item is ScheduleItem => Boolean(item));
      if (selected.length > 0) {
        return selected;
      }
    }
    return [anchor];
  }

  function enterBatchSelectionMode(anchor?: ScheduleItem): void {
    batchSelectionMode = true;
    if (anchor?.id) {
      batchSelectedIds = new Set([anchor.id]);
      lastBatchSelectionAnchorId = anchor.id;
    }
  }

  function exitBatchSelectionMode(): void {
    batchSelectionMode = false;
    clearBatchSelection();
  }

  function applyBatchOperationResult(): void {
    exitBatchSelectionMode();
    void recomputeAndRefreshSidebar('ui_refresh');
  }

  function getBatchActionTargets(): ScheduleItem[] {
    return Array.from(batchSelectedIds)
      .map((id) => collectBatchSelectableMaterialMap().get(id))
      .filter((item): item is ScheduleItem => Boolean(item));
  }

  function showBatchActionsMenu(event: MouseEvent): void {
    const targets = getBatchActionTargets();
    if (targets.length === 0) {
      new Notice(t('irSidebar.batch.selectItemsFirst'));
      return;
    }

    const menu = new Menu();
    void populateReadingPointBatchSubmenu(menu, {
      app: plugin.app,
      targets,
      batchService: getReadingPointBatchService(),
      onApplied: applyBatchOperationResult,
      selectionHelpers: false
    });
    menu.showAtPosition({ x: event.clientX, y: event.clientY });
  }

  function toggleBatchSelection(materialId: string, event?: MouseEvent): void {
    if (!batchSelectionMode) {
      batchSelectionMode = true;
    }

    const pool = getBatchSelectableMaterials();
    const normalizedId = String(materialId || '').trim();
    if (!normalizedId) {
      return;
    }

    if (event?.shiftKey && lastBatchSelectionAnchorId) {
      const start = pool.findIndex((item) => item.id === lastBatchSelectionAnchorId);
      const end = pool.findIndex((item) => item.id === normalizedId);
      if (start >= 0 && end >= 0) {
        const [from, to] = start < end ? [start, end] : [end, start];
        const rangeIds = pool.slice(from, to + 1).map((item) => item.id);
        batchSelectedIds = new Set([...batchSelectedIds, ...rangeIds]);
        lastBatchSelectionAnchorId = normalizedId;
        return;
      }
    }

    const next = new Set(batchSelectedIds);
    if (next.has(normalizedId)) {
      next.delete(normalizedId);
    } else {
      next.add(normalizedId);
    }
    batchSelectedIds = next;
    lastBatchSelectionAnchorId = normalizedId;
  }

  function clearBatchSelection(): void {
    batchSelectedIds = new Set();
    lastBatchSelectionAnchorId = null;
  }

  function selectAllDisplayedMaterials(): void {
    batchSelectionMode = true;
    batchSelectedIds = new Set(getBatchSelectableMaterials().map((item) => item.id));
  }

  function isBatchSelected(materialId: string): boolean {
    return batchSelectedIds.has(materialId);
  }

  async function removeMaterial(
    material: ScheduleItem,
    options: { sourceMissing?: boolean } = {}
  ) {
    try {
      const confirmedMessage = options.sourceMissing
        ? t('irSidebar.calendar.removeMessageSourceMissing', { label: getScheduleItemLabel(material) })
        : t('irSidebar.calendar.removeMessage', { label: getScheduleItemLabel(material) });
      const confirmed = await showObsidianConfirm(
        plugin.app,
        confirmedMessage,
        {
          title: t('irSidebar.calendar.removeTitle'),
          confirmText: t('irSidebar.calendar.removeConfirm'),
          confirmClass: 'mod-warning'
        }
      );
      if (!confirmed) {
        return;
      }

      const pointWriteService = await getPointWriteService();
      const target = resolveScheduleItemWriteTarget(material);
      const removed = await pointWriteService.deletePoint({
        id: target.id,
        kind: target.kind
      });
      if (!removed) {
        throw new Error(`Failed to remove reading point: ${material.id}`);
      }

      await removeLocalMaterialReferences(material.id);
      new Notice(t('irSidebar.notices.removed'));
      closePriorityMenu();
      closeSchedulingMenu();
      await recomputeAndRefreshSidebar('ui_refresh');
    } catch (error) {
      logger.error('[IRCalendarSidebar] Recovered error message.', error);
      new Notice(t('irSidebar.notices.removeFailed'));
    }
  }

  async function loadTagGroupSubmenu(sub: Menu, material: ScheduleItem) {
    if (!ensurePremiumFeature(PREMIUM_FEATURES.TAG_GROUPS)) {
      return;
    }
    try {
      const tagService = await getPointTagService();
      const [currentTags, allGroups] = await Promise.all([
        getMaterialReadingPointTags(material),
        tagService.getTagGroups(),
      ]);
      const currentGroupId = await tagService.matchGroupForTags(currentTags);
      const currentGroup = allGroups.find((group) => group.id === currentGroupId);
      const currentGroupName = currentGroup?.name || t('irSidebar.calendar.defaultTagGroup');

      sub.addItem((item) => {
        item
          .setTitle(t('irSidebar.calendar.currentTagGroup', { name: currentGroupName }))
          .setIcon('check-circle')
          .setDisabled(true);
      });

      sub.addItem((item) => {
        item
          .setTitle(
            currentTags.length > 0
              ? t('irSidebar.calendar.currentTags', { tags: currentTags.join(' / ') })
              : t('irSidebar.calendar.noTags')
          )
          .setIcon('hash')
          .setDisabled(true);
      });

      sub.addSeparator();

      if (allGroups.length === 0) {
        sub.addItem((item) => {
          item.setTitle(t('irSidebar.calendar.noTagGroups')).setIcon('inbox').setDisabled(true);
        });
      } else {
        for (const group of allGroups) {
          const matchedTags = normalizeReadingPointTags(group.matchAnyTags || []).filter((candidate) =>
            currentTags.some((tag) => tag.toLowerCase() === candidate.toLowerCase())
          );
          sub.addItem((item) => {
            const suffix = group.id === currentGroupId ? t('irSidebar.tagGroup.currentSuffix') : '';
            const matchHint = matchedTags.length > 0
              ? t('irSidebar.calendar.tagGroupMatch', { tags: matchedTags.join(', ') })
              : '';
            item
              .setTitle(`${group.name}${suffix}${matchHint}`)
              .setIcon(group.id === currentGroupId ? 'check' : 'tags')
              .setDisabled(true);
          });
        }
      }

      sub.addSeparator();
      sub.addItem((item) => {
        item
          .setTitle(t('irSidebar.calendar.tagGroupReadonlyHint'))
          .setIcon('info')
          .setDisabled(true);
      });
    } catch (error) {
      logger.error('[IRCalendarSidebar] Failed to load tag-group submenu:', error);
      sub.addItem((item) => {
        item.setTitle(t('irSidebar.calendar.loadTagGroupsFailed')).setIcon('alert-triangle').setDisabled(true);
      });
    }
  }

  async function openBlockInfo(material: ScheduleItem, position?: { x: number; y: number }) {
    try {
      let blockInfoTarget: any;

      if (isPdfBookmarkTaskId(material.id) || isEpubBookmarkTaskId(material.id)) {
        const isPdf = isPdfBookmarkTaskId(material.id);
        const bookService = isPdf ? await getPdfBookmarkTaskService() : await getEpubBookmarkTaskService();
        const task = await bookService.getTask(material.id);
        if (!task) {
          new Notice(t(isPdf ? 'irSidebar.tagGroup.pdfTaskMissing' : 'irSidebar.tagGroup.epubTaskMissing'));
          return;
        }
        const filePath = isPdf
          ? (task as any).pdfPath
          : await resolveEpubTaskFilePath(task as any);
        const totalReadingTime = await getStoredTimerTotalSeconds(material.id);
        blockInfoTarget = {
          id: task.id,
          filePath: filePath ?? material.sourceFile ?? '',
          state: task.status ?? 'new',
          priority: Math.round(task.priorityUi ?? task.priorityEff ?? material.priority ?? 5),
          priorityUi: task.priorityUi ?? material.priority ?? 5,
          priorityEff: task.priorityEff ?? task.priorityUi ?? 5,
          interval: task.intervalDays ?? 1,
          intervalFactor: 1.5,
          reviewCount: task.stats?.impressions ?? 0,
          totalReadingTime,
          createdAt: new Date(task.createdAt ?? Date.now()).toISOString(),
          updatedAt: new Date(task.updatedAt ?? Date.now()).toISOString(),
          nextReview: task.nextRepDate ? new Date(task.nextRepDate).toISOString() : null,
          nextRepDate: task.nextRepDate,
          headingText: material.title || task.title || '',
          tags: task.tags ?? []
        };
      } else {
        const chunk = await getWorkspaceChunkById(material.id);
        const totalReadingTime = await getStoredTimerTotalSeconds(material.id);

        if (chunk) {
          const scheduleStatus = (chunk as any).scheduleStatus as string;
          const intervalDays = (chunk as any).intervalDays as number;
          const nextRepDate = (chunk as any).nextRepDate as number;
          const priorityUi = (chunk as any).priorityUi as number | undefined;
          const priorityEff = (chunk as any).priorityEff as number;

          blockInfoTarget = {
            id: (chunk as any).chunkId ?? material.id,
            filePath: (chunk as any).filePath ?? material.sourceFile ?? '',
            state: scheduleStatus ?? 'new',
            priority: Math.round(priorityUi ?? priorityEff ?? material.priority ?? 5),
            priorityUi: priorityUi ?? material.priority ?? 5,
            priorityEff: priorityEff,
            interval: intervalDays ?? 1,
            intervalFactor: 1.5,
            reviewCount: (chunk as any).stats?.impressions ?? 0,
            totalReadingTime,
            createdAt: new Date((chunk as any).createdAt ?? Date.now()).toISOString(),
            updatedAt: new Date((chunk as any).updatedAt ?? Date.now()).toISOString(),
            nextReview: nextRepDate ? new Date(nextRepDate).toISOString() : null,
            nextRepDate,
            headingText: material.title || (chunk as any).headingText || '',
            tags: (chunk as any).meta?.tags ?? (chunk as any).tags ?? []
          };
        } else {
          const legacyBlock = await getWorkspaceLegacyBlockById(material.id);
          if (!legacyBlock) {
            new Notice(t('irSidebar.notices.blockMissing'));
            return;
          }

          const migrated = migrateToIRBlockV4(legacyBlock);
          const nextRepDate = Number(migrated.nextRepDate || 0);
          const priorityUi = (legacyBlock as any).priorityUi as number | undefined;
          const priorityEff = (legacyBlock as any).priorityEff as number | undefined;

          blockInfoTarget = {
            id: legacyBlock.id,
            filePath: legacyBlock.filePath ?? material.sourceFile ?? '',
            state: legacyBlock.state ?? 'new',
            priority: Math.round(priorityUi ?? priorityEff ?? material.priority ?? 5),
            priorityUi: priorityUi ?? material.priority ?? 5,
            priorityEff: priorityEff ?? priorityUi ?? material.priority ?? 5,
            interval: legacyBlock.interval ?? migrated.intervalDays ?? 1,
            intervalFactor: legacyBlock.intervalFactor ?? 1.5,
            reviewCount: legacyBlock.reviewCount ?? migrated.stats?.impressions ?? 0,
            totalReadingTime,
            createdAt: legacyBlock.createdAt ?? new Date().toISOString(),
            updatedAt: legacyBlock.updatedAt ?? new Date().toISOString(),
            nextReview: legacyBlock.nextReview ?? (nextRepDate ? new Date(nextRepDate).toISOString() : null),
            nextRepDate,
            headingText: material.title || getLegacyBlockDisplayName(legacyBlock) || '',
            tags: legacyBlock.tags ?? []
          };
        }
      }

      closeBlockInfoModal();
      blockInfoModalContainer = document.createElement('div');
      blockInfoModalContainer.className = 'weave-ir-block-info-modal-container';
      document.body.append(blockInfoModalContainer);

      blockInfoModalInstance = mount(IRBlockInfoModal, {
        target: blockInfoModalContainer,
        props: {
          block: blockInfoTarget as any,
          app: plugin.app,
          position,
          onClose: () => closeBlockInfoModal()
        }
      });
    } catch (error) {
      logger.error('[IRCalendarSidebar] Recovered error message.', error);
      new Notice(t('irSidebar.notices.openFailed'));
    }
  }

  async function setReminderForMaterial(material: ScheduleItem, date: string, time: string) {
    if (!date || !time) {
      new Notice(t('irSidebar.notices.invalidDateTime'));
      return;
    }

    try {
      const reviewDateTime = new Date(`${date}T${time}`);
      if (reviewDateTime <= new Date()) {
        new Notice(t('irSidebar.notices.futureReviewTime'));
        return;
      }

      const scheduler = await getV4SchedulerService();
      const block = await resolveScheduleItemToBlockV4(material);
      const deckId = await resolveDeckIdForScheduleItem(material);
      await scheduler.manualRescheduleBlockWithPreviewV4(
        block,
        {
          nextRepDate: reviewDateTime.getTime(),
          scheduleStatus: 'queued'
        },
        deckId
      );

      new Notice(t('irSidebar.notices.reviewTimeSet', { time: reviewDateTime.toLocaleString() }));
      closeReminderModal();
      await recomputeAndRefreshSidebar('manual_reschedule');

    } catch (error) {
      logger.error('[IRCalendarSidebar] Recovered error message.', error);
      new Notice(t('irSidebar.notices.reviewTimeSetFailed'));
    }
  }

  function isMaterialScheduledAfterToday(material: ScheduleItem): boolean {
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    const dueMs = Number(material.nextRepDate || 0);
    return dueMs > todayEnd.getTime();
  }

  async function addSuggestedMaterialToToday(material: ScheduleItem): Promise<void> {
    if (continueReadingActionIds.has(material.id)) {
      return;
    }

    continueReadingActionIds = new Set([...continueReadingActionIds, material.id]);
    try {
      const scheduler = await getV4SchedulerService();
      const block = await resolveScheduleItemToBlockV4(material);
      const deckId = await resolveDeckIdForScheduleItem(material);
      const now = new Date();
      now.setSeconds(0, 0);

      await scheduler.manualRescheduleBlockWithPreviewV4(
        block,
        {
          nextRepDate: now.getTime(),
          scheduleStatus: 'queued'
        },
        deckId
      );

      new Notice(t('irSidebar.calendar.addedToToday'));
      await recomputeAndRefreshSidebar('manual_reschedule');
    } catch (error) {
      logger.error('[IRCalendarSidebar] Failed to add suggested material to today', error);
      new Notice(t('irSidebar.calendar.addToTodayFailed'));
    } finally {
      const nextIds = new Set(continueReadingActionIds);
      nextIds.delete(material.id);
      continueReadingActionIds = nextIds;
    }
  }

  async function restoreSuspendedMaterialToToday(material: ScheduleItem): Promise<void> {
    if (continueReadingActionIds.has(material.id)) {
      return;
    }

    continueReadingActionIds = new Set([...continueReadingActionIds, material.id]);
    try {
      const scheduler = await getV4SchedulerService();
      const block = await resolveScheduleItemToBlockV4(material);
      const deckId = await resolveDeckIdForScheduleItem(material);

      await scheduler.resumeBlockWithPreviewV4(block, deckId);
      await clearSuspendedMarkersForMaterial(material);

      new Notice(t('irSidebar.calendar.restoredToToday'));
      await recomputeAndRefreshSidebar('manual_reschedule');
    } catch (error) {
      logger.error('[IRCalendarSidebar] Failed to restore suspended material to today', error);
      new Notice(t('irSidebar.calendar.restoreSuspendedFailed'));
    } finally {
      const nextIds = new Set(continueReadingActionIds);
      nextIds.delete(material.id);
      continueReadingActionIds = nextIds;
    }
  }

  function openReminderModal(material: ScheduleItem, position?: { x: number; y: number }) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const initialDate = tomorrow.toISOString().split('T')[0];
    const initialTime = new Date().toTimeString().slice(0, 5);

    closeReminderModal();
    reminderModalContainer = document.createElement('div');
    reminderModalContainer.className = 'weave-ir-review-reminder-modal-container';
    document.body.append(reminderModalContainer);

    reminderModalInstance = mount(IRReviewReminderModal, {
      target: reminderModalContainer,
      props: {
        initialDate,
        initialTime,
        position,
        onCancel: () => closeReminderModal(),
        onConfirm: (date: string, time: string) => {
          void setReminderForMaterial(material, date, time);
        }
      }
    });
  }

  onDestroy(() => {
    clearTimerTicker();
    closeBlockInfoModal();
    closeReminderModal();
    closeContinueReadingSuggestionsModal('refresh');
    importModalInstance?.close();
    importModalInstance = null;
    addReadingTargetModalInstance?.close();
    addReadingTargetModalInstance = null;
    closeActiveReadingPointPrompt();
    analyticsModalInstance?.close();
    analyticsModalInstance = null;
  });

  function openAnalyticsModal() {
    if (!ensurePremiumFeature(PREMIUM_FEATURES.ANALYTICS_VIEW)) {
      return;
    }
    analyticsModalInstance?.close();
    analyticsModalInstance = new IRAnalyticsModalObsidian(plugin.app, {
      plugin,
      onClose: () => {
        analyticsModalInstance = null;
      }
    });
    analyticsModalInstance.open();
  }

  /**

   */
  async function getSiblingMaterials(material: ScheduleItem): Promise<ScheduleItem[]> {
    const sourceFile = material.sourceFile;
    if (!sourceFile) return [];

    const collectedIds = new Set<string>([material.id]);
    const siblings: ScheduleItem[] = [];


    for (const [_dateKey, items] of materialsByDate) {
      for (const item of items) {
        if (collectedIds.has(item.id)) continue;
        if (item.sourceFile !== sourceFile) continue;
        if (!matchesActiveDeckFilter(item)) continue;
        collectedIds.add(item.id);
        siblings.push(item);
      }
    }


    if (sourceFile.toLowerCase().endsWith('.pdf')) {
      try {
        const allTasks = (await getWorkspaceSnapshotService().getWorkspaceData()).pdfTasks;
        for (const task of allTasks) {
          if (collectedIds.has(task.id)) continue;
          if (task.pdfPath !== sourceFile) continue;
          const status = String(task.status || 'new');
          if (status === 'done' || status === 'removed') continue;
          const siblingItem = buildScheduleItemFromPdfTask(task);
          if (!matchesActiveDeckFilter(siblingItem)) continue;
          collectedIds.add(task.id);
          siblings.push(siblingItem);
        }
      } catch (e) {
        logger.warn('[IRCalendarSidebar] Failed to load PDF sibling materials', e);
      }
    } else if (isEpubBookmarkTaskId(material.id) || sourceFile.toLowerCase().endsWith('.epub')) {
      try {
        const identityKey = await resolveEpubIdentityKey({ filePath: sourceFile });
        const allTasks = (await getWorkspaceSnapshotService().getWorkspaceData()).epubTasks;
        for (const task of allTasks) {
          if (collectedIds.has(task.id)) continue;
          const status = String(task.status || 'new');
          if (status === 'done' || status === 'removed') continue;
          if (String(task.epubFilePath || '').trim() !== sourceFile.trim() && String(task.sourceId || '').trim() === '') {
            continue;
          }
          const taskIdentityKey = await resolveEpubIdentityKey({
            sourceId: task.sourceId,
            filePath: task.epubFilePath
          });
          if (identityKey && taskIdentityKey && identityKey !== taskIdentityKey) continue;
          const resolvedFilePath = await resolveEpubTaskFilePath(task);
          const siblingItem = await buildScheduleItemFromEpubTask(task, { resolvedFilePath });
          if (!matchesActiveDeckFilter(siblingItem)) continue;
          collectedIds.add(task.id);
          siblings.push(siblingItem);
        }
      } catch (e) {
        logger.warn('[IRCalendarSidebar] Failed to load EPUB sibling materials', e);
      }
    }


    siblings.sort(compareScheduleItemsByScheduledDay);
    return siblings;
  }

  /**

   */
  async function toggleMaterialExpand(material: ScheduleItem) {
    const id = material.id;
    if (expandedMaterialIds.has(id)) {
      const next = new Set(expandedMaterialIds);
      next.delete(id);
      expandedMaterialIds = next;
      return;
    }

    void ensureMaterialTagsLoaded(material);
    if (siblingCache.has(id)) {
      expandedMaterialIds = new Set([...expandedMaterialIds, id]);
      return;
    }


    loadingSiblings = new Set([...loadingSiblings, id]);
    try {
      const siblings = await getSiblingMaterials(material);
      const next = new Map(siblingCache);
      next.set(id, siblings);
      siblingCache = next;
      expandedMaterialIds = new Set([...expandedMaterialIds, id]);
    } catch (e) {
      logger.error('[IRCalendarSidebar] Recovered error message.', e);
    } finally {
      const ls = new Set(loadingSiblings);
      ls.delete(id);
      loadingSiblings = ls;
    }
  }

  function collectScheduleItemsForDateKeys(
    byDate: Map<string, ScheduleItem[]>,
    dateKeys: string[]
  ): Map<string, ScheduleItem> {
    const uniqueItems = new Map<string, ScheduleItem>();
    for (const dateKey of dateKeys) {
      for (const item of byDate.get(dateKey) || []) {
        uniqueItems.set(item.id, item);
      }
    }
    for (const items of pinnedByDate.values()) {
      for (const item of items) {
        uniqueItems.set(item.id, item);
      }
    }
    return uniqueItems;
  }

  async function refreshReadingPointTagMap(
    byDate: Map<string, ScheduleItem[]>,
    dateKeys?: string[]
  ): Promise<void> {
    const uniqueItems =
      dateKeys && dateKeys.length > 0
        ? collectScheduleItemsForDateKeys(byDate, dateKeys)
        : (() => {
            const allItems = new Map<string, ScheduleItem>();
            for (const items of byDate.values()) {
              for (const item of items) {
                allItems.set(item.id, item);
              }
            }
            for (const items of pinnedByDate.values()) {
              for (const item of items) {
                allItems.set(item.id, item);
              }
            }
            return allItems;
          })();

    if (uniqueItems.size === 0) {
      if (!dateKeys || dateKeys.length === 0) {
        readingPointTagsById = {};
      }
      return;
    }

    const items = Array.from(uniqueItems.values());
    const entries = await runIdleBatchedTasks(
      items,
      async (item) => {
        try {
          return [item.id, await getMaterialReadingPointTags(item)] as const;
        } catch (error) {
          logger.warn('[IRCalendarSidebar] Failed to load reading point tags:', item.id, error);
          return [item.id, []] as const;
        }
      },
      {
        chunkSize: 8,
        budgetMs: 10,
        shouldCancel: () => isCalendarSidebarInteractionPaused(),
      }
    );

    readingPointTagsById = {
      ...readingPointTagsById,
      ...Object.fromEntries(entries),
    };
  }

  function applyCalendarQueryResult(
    queryResult: {
      workspaceData: { decksRecord: Record<string, IRDeck>; blocksRecord: Record<string, IRBlock> };
      readingMaterials: ReadingMaterial[];
      materialsByDate: Map<string, ScheduleItem[]>;
      continueReadingSuspendedItemsPool: ScheduleItem[];
      schedule: { generatedAt: number; days?: Array<{ dateKey: string; loadStats?: IRDailyLoadDayStats }> };
    },
    options?: {
      daySummaries?: Map<string, { totalCount: number }>;
      mergeMaterialsByDate?: boolean;
    }
  ): void {
    const { workspaceData } = queryResult;
    irDecks = Object.values(workspaceData.decksRecord || {});
    allBlocks = [];
    readingMaterials = queryResult.readingMaterials;
    if (options?.mergeMaterialsByDate) {
      materialsByDate = mergeMaterialsByDate(materialsByDate, queryResult.materialsByDate);
      for (const dateKey of queryResult.materialsByDate.keys()) {
        clearSelectedDateHydrationCompletedKeys([dateKey]);
      }
    } else {
      materialsByDate = queryResult.materialsByDate;
      clearSelectedDateHydrationCompletedKeys();
    }
    scheduleDayLoadStatsByDate = new Map(
      (queryResult.schedule.days || [])
        .filter((day) => day.loadStats)
        .map((day) => [day.dateKey, day.loadStats!])
    );
    continueReadingSuspendedItemsPool = queryResult.continueReadingSuspendedItemsPool;
    lastAppliedScheduleGeneratedAt = queryResult.schedule.generatedAt;
    hasHydratedCalendarData = true;
    if (isDegradedReconcileWindow()) {
      setCalendarDataPhase('degraded');
    } else {
      markWarmReadyPhase();
    }
    if (options?.daySummaries && options.daySummaries.size > 0) {
      applyCalendarDaySummaries(options.daySummaries);
    }
    syncCalendarDayCountsFromLoadedMaterials(
      options?.mergeMaterialsByDate
        ? Array.from(queryResult.materialsByDate.keys())
        : Array.from(materialsByDate.keys())
    );
    syncSelectionToFocusedDeck();
  }

  async function getMaterialReadingPointTags(material: ScheduleItem): Promise<string[]> {
    const tagService = await getPointTagService();

    if (isPdfBookmarkTaskId(material.id)) {
      const task = await getWorkspacePdfTaskById(material.id);
      return normalizeReadingPointTags(task?.tags || []);
    }

    if (isEpubBookmarkTaskId(material.id)) {
      const task = await getWorkspaceEpubTaskById(material.id);
      return normalizeReadingPointTags(task?.tags || []);
    }

    if (material.sourceType === 'legacy-block') {
      return [];
    }

    const chunk = await getWorkspaceChunkById(material.id);
    if (!chunk) return [];
    return await tagService.getChunkTags(chunk);
  }

  async function saveMaterialReadingPointTags(material: ScheduleItem, tags: string[]): Promise<boolean> {
    const normalizedTags = normalizeReadingPointTags(tags);
    const pointWriteService = await getPointWriteService();
    const saved = !!(await pointWriteService.updatePointTags(resolveScheduleItemWriteTarget(material), normalizedTags));

    if (saved) {
      readingPointTagsById = {
        ...readingPointTagsById,
        [material.id]: normalizedTags,
      };
    }

    return saved;
  }

  function stripSuspendedReadingPointTags(tags: string[]): string[] {
    return normalizeReadingPointTags(tags).filter((tag) => {
      const normalized = String(tag || '').trim().replace(/^#/, '').toLowerCase();
      return normalized ? !SUSPENDED_READING_POINT_TAG_KEYS.has(normalized) : false;
    });
  }

  async function clearSuspendedMarkersForMaterial(material: ScheduleItem): Promise<void> {
    if (material.sourceType === 'legacy-block') {
      return;
    }

    const currentTags = await getMaterialReadingPointTags(material);
    const nextTags = stripSuspendedReadingPointTags(currentTags);
    const changed =
      nextTags.length !== currentTags.length ||
      nextTags.some((tag, index) => tag !== currentTags[index]);

    if (!changed) {
      return;
    }

    await saveMaterialReadingPointTags(material, nextTags);
  }

  function showMaterialMenuAt(
    menuPosition: { x: number; y: number },
    popoverPosition: { x: number; y: number },
    anchor: HTMLElement,
    material: ScheduleItem
  ) {
    try {
      const menu = new Menu();

      menu.addItem((item) => {
        item
          .setTitle(t('irSidebar.menu.setPriority'))
          .setIcon('star')
          .onClick(() => {
            openPriorityMenuForAnchor(anchor, material);
          });
      });

      menu.addItem((item) => {
        item
          .setTitle(t('irSidebar.menu.setNextReviewTime'))
          .setIcon('calendar-clock')
          .onClick(() => {
            openReminderModal(material, popoverPosition);
          });
      });

      if (isMaterialScheduledAfterToday(material)) {
        menu.addItem((item) => {
          item
            .setTitle(t('irSidebar.menu.pullBackToToday'))
            .setIcon('calendar-arrow-down')
            .onClick(() => {
              void addSuggestedMaterialToToday(material);
            });
        });
      }

      menu.addSeparator();

      menu.addItem((item) => {
        item
          .setTitle(t('irSidebar.menu.renameReadingPoint'))
          .setIcon('pencil')
          .onClick(() => {
            openRenameReadingPoint(material);
          });
      });

      menu.addItem((item) => {
        item
          .setTitle(t('irSidebar.menu.selectReadingPointTopic'))
          .setIcon('layers');
        const topicSubmenu = item.setSubmenu();
        void populateReadingPointTopicSubmenu(
          topicSubmenu,
          plugin.app,
          material,
          refreshAfterReadingPointPropertyEdit
        );
      });

      if (canEditReadingPointLink(material)) {
        menu.addItem((item) => {
          item
            .setTitle(t('irSidebar.menu.editTraceLink'))
            .setIcon('link')
            .onClick(() => {
              openEditReadingPointTraceLink(material);
            });
        });
      }

      menu.addItem((item) => {
        item
          .setTitle(t('irSidebar.menu.view'))
          .setIcon('eye')
          .onClick(() => {
            void openBlockInfo(material, popoverPosition);
          });
      });

      menu.addSeparator();

      if (
        PremiumFeatureGuard.getInstance().canUseFeature(PREMIUM_FEATURES.TAG_GROUPS)
        || shouldShowPremiumFeatureEntry(PREMIUM_FEATURES.TAG_GROUPS)
      ) {
        menu.addItem((item) => {
          if (PremiumFeatureGuard.getInstance().canUseFeature(PREMIUM_FEATURES.TAG_GROUPS)) {
            const tagsDisabled = material.sourceType === 'legacy-block';
            item
              .setTitle(t('irSidebar.menu.editTags'))
              .setIcon('hash')
              .setDisabled(tagsDisabled)
              .onClick(() => {
                if (tagsDisabled) {
                  new Notice(t('irSidebar.calendar.legacyBlockNoTagEdit'));
                  return;
                }
                openEditReadingPointTags(material);
              });
            return;
          }
          item
            .setTitle(premiumMenuTitle(t('irSidebar.menu.editTags'), PREMIUM_FEATURES.TAG_GROUPS))
            .setIcon('hash')
            .onClick(() => {
              ensurePremiumFeature(PREMIUM_FEATURES.TAG_GROUPS);
            });
        });
      }

      if (
        PremiumFeatureGuard.getInstance().canUseFeature(PREMIUM_FEATURES.TAG_GROUPS)
        || shouldShowPremiumFeatureEntry(PREMIUM_FEATURES.TAG_GROUPS)
      ) {
        menu.addItem((item) => {
          if (PremiumFeatureGuard.getInstance().canUseFeature(PREMIUM_FEATURES.TAG_GROUPS)) {
            item
              .setTitle(t('irSidebar.calendar.tagGroupMenu'))
              .setIcon('tags');
            const sub = (item as any).setSubmenu();
            void loadTagGroupSubmenu(sub, material);
            return;
          }
          item
            .setTitle(premiumMenuTitle(t('irSidebar.calendar.tagGroupMenu'), PREMIUM_FEATURES.TAG_GROUPS))
            .setIcon('tags')
            .onClick(() => {
              ensurePremiumFeature(PREMIUM_FEATURES.TAG_GROUPS);
            });
        });
      }

      if (
        canUsePointLinkedNotes(material)
        || shouldShowPremiumFeatureEntry(PREMIUM_FEATURES.ASSOCIATED_NOTES)
      ) {
        menu.addItem((item) => {
          if (
            canUsePointLinkedNotes(material)
            && PremiumFeatureGuard.getInstance().canUseFeature(PREMIUM_FEATURES.ASSOCIATED_NOTES)
          ) {
            item
              .setTitle(t('irSidebar.calendar.linkedNoteMenu'))
              .setIcon('link');
            const sub = (item as any).setSubmenu();
            buildAssociatedNoteSubmenu(sub, material);
            return;
          }
          item
            .setTitle(premiumMenuTitle(t('irSidebar.calendar.linkedNoteMenu'), PREMIUM_FEATURES.ASSOCIATED_NOTES))
            .setIcon('link')
            .onClick(() => {
              ensurePremiumFeature(PREMIUM_FEATURES.ASSOCIATED_NOTES);
            });
        });
      }

      menu.addSeparator();

      menu.addItem((item) => {
        item
          .setTitle(t('irSidebar.menu.batchOperations'))
          .setIcon('copy-check');
        const batchSubmenu = item.setSubmenu();
        void populateReadingPointBatchSubmenu(batchSubmenu, {
          app: plugin.app,
          targets: resolveBatchOperationTargets(material),
          batchService: getReadingPointBatchService(),
          onApplied: applyBatchOperationResult,
          onEnterBatchMode: batchSelectionMode
            ? undefined
            : () => {
                enterBatchSelectionMode(material);
              },
          onSelectAllVisible: () => {
            selectAllDisplayedMaterials();
          },
          onClearSelection: batchSelectedIds.size > 0
            ? () => {
                clearBatchSelection();
              }
            : undefined
        });
      });

      menu.addItem((item) => {
        item
          .setTitle(t('irSidebar.menu.suspend'))
          .setIcon('pause-circle')
          .onClick(() => {
            void suspendMaterial(material);
          });
      });

      menu.addItem((item) => {
        item
          .setTitle(t('irSidebar.menu.archive'))
          .setIcon('archive')
          .onClick(() => {
            void archiveMaterial(material);
          });
      });

      menu.addItem((item) => {
        item
          .setTitle(t('irSidebar.menu.remove'))
          .setIcon('x-circle')
          .onClick(() => {
            void removeMaterial(material);
          });
      });


      if (material.sourceFile?.toLowerCase().endsWith('.pdf')) {
        menu.addSeparator();

        menu.addItem((item) => {
          item
            .setTitle(t('irSidebar.menu.addReadingPoint'))
            .setIcon('bookmark-plus')
            .onClick(() => {
              void openAddReadingPointModal(material);
            });
        });
      }

      menu.addSeparator();

      menu.addItem((item) => {
        item
          .setTitle(t('irSidebar.menu.moreActions'))
          .setIcon('settings');
        const sub = (item as any).setSubmenu();

        sub.addItem((subItem: any) => {
          subItem
            .setTitle(t('irSidebar.menu.continuousReading'))
            .setChecked(continuousReadingEnabled)
            .onClick(() => {
              void setContinuousReadingEnabled(!continuousReadingEnabled);
            });
        });

        sub.addItem((subItem: any) => {
          subItem
            .setTitle(t('irSidebar.menu.showRealtimePreview'))
            .setChecked(showSchedulingPreview)
            .onClick(() => {
              void setShowSchedulingPreviewEnabled(!showSchedulingPreview);
            });
        });

        sub.addItem((subItem: any) => {
          subItem
            .setTitle(t('irSidebar.menu.showReadingPointTypeLabels'))
            .setChecked(showReadingPointTypeLabels)
            .onClick(() => {
              void setShowReadingPointTypeLabelsEnabled(!showReadingPointTypeLabels);
            });
        });
      });

      menu.showAtPosition(menuPosition);
    } catch (error) {
      logger.error('[IRCalendarSidebar] Failed to show material context menu:', error);
    }
  }


  function formatSiblingDueDate(nextRepDate: number): string {
    const due = new Date(nextRepDate);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const diffMs = due.getTime() - now.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return t('irSidebar.controls.overdueDays', { count: Math.abs(diffDays) });
    if (diffDays === 0) return t('irSidebar.controls.dueToday');
    if (diffDays === 1) return t('irSidebar.controls.dueTomorrow');
    return t('irSidebar.controls.dueInDays', { count: diffDays });
  }

  async function openAddReadingPointModal(material: ScheduleItem): Promise<void> {
    try {
      let resolvedDeckId = '';

      if (isPdfBookmarkTaskId(material.id)) {
        const task = await getWorkspacePdfTaskById(material.id);
        resolvedDeckId = resolveCanonicalDeckId(getTaskTopicId(task) || '');
      }

      if (!resolvedDeckId) {
        const workspaceData = await getWorkspaceSnapshotService().getWorkspaceData();
        const chunks = Object.values(workspaceData.chunksRecord || {});

        for (const deck of irDecks) {
          const deckIdentifiers = [deck.id, String((deck as any)?.path || '').trim()].filter(Boolean);
          const match = chunks.find(
            (chunk: any) =>
              chunk.filePath === material.sourceFile &&
              getChunkTopicIds(chunk).some((identifier) => deckIdentifiers.includes(identifier))
          );
          if (match) {
            resolvedDeckId = deck.id;
            break;
          }
        }
      }

      if (!resolvedDeckId && irDecks.length > 0) {
        resolvedDeckId = irDecks[0].id;
      }

      if (!resolvedDeckId) {
        new Notice(t('irSidebar.notices.noDecksAvailable'));
        return;
      }

      arpDeckId = resolvedDeckId;
      arpPdfPath = material.sourceFile;
      arpParentTitle = material.displayName || material.title || 'PDF';
      showAddReadingPointModal = true;
    } catch (error) {
      logger.error('[IRCalendarSidebar] Recovered error message.', error);
      new Notice(t('irSidebar.notices.actionFailedRetry'));
    }
  }

  function handleMaterialContextMenu(event: MouseEvent, anchor: HTMLElement, material: ScheduleItem) {
    event.preventDefault();
    showMaterialMenuAt(
      { x: event.pageX, y: event.pageY },
      { x: event.clientX, y: event.clientY },
      anchor,
      material
    );
  }

  function handleMaterialClick(material: ScheduleItem, event?: MouseEvent) {
    if (batchSelectionMode) {
      event?.preventDefault();
      toggleBatchSelection(material.id, event);
      suppressClickOnce = true;
      return;
    }

    if (event && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      enterBatchSelectionMode(material);
      suppressClickOnce = true;
      return;
    }
    if (suppressClickOnce) {
      suppressClickOnce = false;
      return;
    }
    void openMaterial(material);
  }

  function clearLongPressTimer() {
    if (longPressTimerId !== null) {
      window.clearTimeout(longPressTimerId);
      longPressTimerId = null;
    }
  }

  function handleLongPressStart(event: PointerEvent, anchor: HTMLElement, material: ScheduleItem) {
    if (!Platform.isMobile) return;
    if (event.pointerType === 'mouse') return;
    if (batchSelectionMode) return;

    clearLongPressTimer();

    longPressTriggered = false;
    longPressStartX = event.clientX;
    longPressStartY = event.clientY;

    longPressTimerId = window.setTimeout(() => {
      longPressTriggered = true;
      suppressClickOnce = true;
      showMaterialMenuAt({ x: event.pageX, y: event.pageY }, { x: event.clientX, y: event.clientY }, anchor, material);
    }, 450);
  }

  function handleLongPressMove(event: PointerEvent) {
    if (!Platform.isMobile) return;
    if (longPressTimerId === null) return;

    const dx = event.clientX - longPressStartX;
    const dy = event.clientY - longPressStartY;
    if (Math.hypot(dx, dy) > 12) {
      clearLongPressTimer();
    }
  }

  function handleLongPressEnd(event: PointerEvent) {
    if (!Platform.isMobile) return;
    clearLongPressTimer();
    if (longPressTriggered) {
      event.preventDefault();
    }
    longPressTriggered = false;
  }

  type SchedulingOptimisticRollbackSnapshot = {
    processedChunkIds: Set<string>;
    progressIds: string[];
    materialsSlice: ScheduleItem[];
    pinnedSlice: ScheduleItem[];
  };

  function captureSchedulingOptimisticRollbackSnapshot(
    pinnedKey: string
  ): SchedulingOptimisticRollbackSnapshot {
    return {
      processedChunkIds: new Set(processedChunkIds),
      progressIds: [...(calendarProgressByDate[pinnedKey] || [])],
      materialsSlice: [...(materialsByDate.get(pinnedKey) || [])],
      pinnedSlice: [...(pinnedByDate.get(pinnedKey) || [])],
    };
  }

  function rollbackSchedulingOptimisticUi(
    snapshot: SchedulingOptimisticRollbackSnapshot,
    pinnedKey: string
  ): void {
    processedChunkIds = snapshot.processedChunkIds;
    calendarProgressByDate = {
      ...calendarProgressByDate,
      [pinnedKey]: snapshot.progressIds,
    };
    materialsByDate = new Map(materialsByDate).set(pinnedKey, snapshot.materialsSlice);
    pinnedByDate = new Map(pinnedByDate).set(pinnedKey, snapshot.pinnedSlice);
    syncCalendarDayCountsFromLoadedMaterials([pinnedKey]);
  }

  function resolveOptimisticScheduleMenuBlock(
    target: ScheduleItem,
    action: SchedulingAction,
    preparedBlocks: Record<SchedulingAction, IRBlockV4> | null,
    tagGroupIntervalFactor: number
  ): IRBlockV4 {
    if (preparedBlocks?.[action]) {
      return preparedBlocks[action];
    }
    const previewBlock = scheduleItemToPreviewBlockV4(target);
    return computeScheduleMenuActionBlock(
      previewBlock,
      action,
      buildScheduleModePreviewInput(plugin.app, previewBlock, tagGroupIntervalFactor)
    );
  }

  function applySchedulingOptimisticUi(input: {
    target: ScheduleItem;
    pinnedKey: string;
    updatedBlock: IRBlockV4;
    deckId: string;
  }): ScheduleItem[] {
    const { target, pinnedKey, updatedBlock, deckId } = input;
    const nextRepDate = updatedBlock.nextRepDate;
    const intervalDays = updatedBlock.intervalDays || 1;
    const scheduleStatus = updatedBlock.status;

    processedChunkIds = new Set([...processedChunkIds, target.id]);

    const updated: ScheduleItem = {
      ...target,
      deckId,
      intervalDays,
      scheduleStatus,
      nextRepDate,
      nextReviewDate: nextRepDate > 0 ? new Date(nextRepDate) : null,
    };

    const pinnedList = pinnedByDate.get(pinnedKey) || [];
    const updatedPinnedSlice = [...pinnedList.filter((p) => p.id !== target.id), updated];
    pinnedByDate = new Map(pinnedByDate).set(pinnedKey, updatedPinnedSlice);

    const nextCompletedIds = [...new Set([...(calendarProgressByDate[pinnedKey] || []), target.id])];
    calendarProgressByDate = {
      ...calendarProgressByDate,
      [pinnedKey]: nextCompletedIds,
    };

    const assembledDayQueue = buildAssembledDayQueueForDateKey(pinnedKey, {
      completedIds: nextCompletedIds,
      itemOverrides: new Map([[target.id, updated]]),
    });
    applyLocalDayQueueProjection(pinnedKey, assembledDayQueue);
    markLocalDayQueueRefreshSuppressed(pinnedKey);

    return updatedPinnedSlice;
  }

  async function persistSchedulingActionInBackground(input: {
    target: ScheduleItem;
    pinnedKey: string;
    action: SchedulingAction;
    isPostpone: boolean;
    shouldPauseTargetTimer: boolean;
    nextMaterialId?: string;
    updatedPinnedSlice: ScheduleItem[];
    completedIds: string[];
    optimisticBlock: IRBlockV4;
    tagGroupIntervalFactor: number;
    rollbackSnapshot: SchedulingOptimisticRollbackSnapshot;
  }): Promise<void> {
    const {
      target,
      pinnedKey,
      isPostpone,
      action,
      shouldPauseTargetTimer,
      nextMaterialId,
      updatedPinnedSlice,
      completedIds,
      optimisticBlock,
      tagGroupIntervalFactor,
      rollbackSnapshot,
    } = input;

    try {
      const beforeBlock = await resolveScheduleItemToBlockV4(target);
      const deckId = await resolveDeckIdForScheduleItem(target);
      const previousNextRepDate =
        Number(target.nextRepDate || target.nextReviewDate?.getTime() || 0) || undefined;

      const afterBlock = computeScheduleMenuActionBlock(
        beforeBlock,
        action,
        buildScheduleModePreviewInput(plugin.app, beforeBlock, tagGroupIntervalFactor)
      );

      await persistScheduleMenuActionL0(plugin.app, beforeBlock, afterBlock);
      await recordScheduleMenuActionInteraction(plugin.app, beforeBlock.id);

      let finalPinnedSlice = updatedPinnedSlice;
      if (
        afterBlock.nextRepDate !== optimisticBlock.nextRepDate ||
        (afterBlock.intervalDays || 1) !== (optimisticBlock.intervalDays || 1) ||
        afterBlock.status !== optimisticBlock.status
      ) {
        finalPinnedSlice = applySchedulingOptimisticUi({
          target,
          pinnedKey,
          updatedBlock: afterBlock,
          deckId,
        });
      }

      await finalizeSchedulingActionInBackground({
        target,
        pinnedKey,
        deckId,
        isPostpone,
        action,
        nextRepDate: afterBlock.nextRepDate,
        previousNextRepDate,
        shouldPauseTargetTimer,
        nextMaterialId,
        updatedPinnedSlice: finalPinnedSlice,
        completedIds,
      });
    } catch (error) {
      rollbackSchedulingOptimisticUi(rollbackSnapshot, pinnedKey);
      logger.error('[IRCalendarSidebar] Background scheduling persist failed', error);
      new Notice(t('irSidebar.notices.actionFailedRetry'));
      throw error;
    }
  }

  async function handleSchedulingAction(action: SchedulingAction, context: SchedulingMenuContext) {
    const { target, pinnedKey } = context;
    if (!target) return;

    try {
      const cfg = schedulingConfig.find(c => c.action === action);
      if (!cfg) return;

      const isPostpone = Boolean((cfg as any).isPostpone);
      const tagGroupIntervalFactor =
        schedulingMenuTarget?.id === target.id ? schedulingMenuTagGroupIntervalFactor : 1;
      const preparedBlocks =
        schedulingMenuTarget?.id === target.id ? schedulingMenuPreparedBlocks : null;
      const rollbackSnapshot = captureSchedulingOptimisticRollbackSnapshot(pinnedKey);
      closeSchedulingMenu();

      const shouldPauseTargetTimer = activeReadingTimer?.blockId === target.id;
      const nextMaterial = getNextUnprocessedMaterial(target.id);

      const optimisticBlock = resolveOptimisticScheduleMenuBlock(
        target,
        action,
        preparedBlocks,
        tagGroupIntervalFactor
      );
      const deckId = target.deckId ? resolveCanonicalDeckId(target.deckId) : '';
      const updatedPinnedSlice = applySchedulingOptimisticUi({
        target,
        pinnedKey,
        updatedBlock: optimisticBlock,
        deckId,
      });
      const nextCompletedIds = [...new Set([...(calendarProgressByDate[pinnedKey] || []), target.id])];
      const nextRepDate = optimisticBlock.nextRepDate;
      const intervalDays = optimisticBlock.intervalDays || 1;

      if (isPostpone) {
        new Notice(t('irSidebar.scheduling.postponed', { date: new Date(nextRepDate).toLocaleDateString() }));
      } else {
        const actionLabelMap: Record<string, string> = {
          intensive: t('irSidebar.scheduling.intensive'),
          normal: t('irSidebar.scheduling.normal'),
          slow: t('irSidebar.scheduling.slow'),
          postpone: t('irSidebar.scheduling.postpone')
        };
        const actionLabel = actionLabelMap[action] || action;
        new Notice(t('irSidebar.scheduling.modeApplied', { mode: actionLabel, days: intervalDays }));
      }

      if (nextMaterial) {
        void openMaterial(nextMaterial);
      }

      enqueueScheduleFinalize(plugin.app, async () => {
        await persistSchedulingActionInBackground({
          target,
          pinnedKey,
          action,
          isPostpone,
          shouldPauseTargetTimer,
          nextMaterialId: nextMaterial?.id,
          updatedPinnedSlice,
          completedIds: nextCompletedIds,
          optimisticBlock,
          tagGroupIntervalFactor,
          rollbackSnapshot,
        });
      });
    } catch (error) {
      logger.error('[IRCalendarSidebar] Recovered error message.', error);
      new Notice(t('irSidebar.notices.actionFailedRetry'));
    }
  }

  async function finalizeSchedulingActionInBackground(input: {
    target: ScheduleItem;
    pinnedKey: string;
    deckId: string;
    isPostpone: boolean;
    action: SchedulingAction;
    nextRepDate: number;
    previousNextRepDate?: number;
    shouldPauseTargetTimer: boolean;
    nextMaterialId?: string;
    updatedPinnedSlice: ScheduleItem[];
    completedIds: string[];
  }): Promise<void> {
    const {
      target,
      pinnedKey,
      deckId,
      isPostpone,
      action,
      nextRepDate,
      previousNextRepDate,
      shouldPauseTargetTimer,
      nextMaterialId,
      updatedPinnedSlice,
      completedIds,
    } = input;

    try {
      const storage = await getStorage();
      await storage.addCalendarCompletion(pinnedKey, target.id);

      const dayQueueItems = buildAssembledDayQueueForDateKey(pinnedKey, {
        completedIds,
        itemOverrides: new Map(updatedPinnedSlice.map((item) => [item.id, item])),
      });

      await patchDayQueue(plugin.app, {
        dateKey: pinnedKey,
        items: dayQueueItems,
        completedIds,
        completedIdOrder: completedIds,
        deckIds: deckId ? [deckId] : undefined,
      });

      const priorityDateKeys = collectDueDateKeysForScheduleMutation(
        previousNextRepDate,
        nextRepDate,
        pinnedKey
      );
      void scheduleDebouncedRecomputeAndBroadcastIRData(plugin.app, isPostpone ? 'postpone_block' : 'complete_block', {
        deckIds: deckId ? [deckId] : undefined,
        priorityDateKeys,
        l1PatchedDateKeys: [pinnedKey],
        leanSchedule: true,
      });

      if (shouldPauseTargetTimer) {
        const paused = await pauseActiveReadingTimer(isPostpone ? 'skipped' : 'completed', target.id);
        if (!paused) {
          logger.warn('[IRCalendarSidebar] Recovered warning message.', {
            currentBlockId: target.id,
            nextBlockId: nextMaterialId
          });
        }
      }
    } catch (error) {
      logger.error('[IRCalendarSidebar] Background scheduling refresh failed', error);
    }

    void (async () => {
      try {
        const monitoring = await getMonitoringService();
        monitoring.recordDecisionEvent({
          itemId: target.id,
          action: isPostpone ? 'postpone_block' : `schedule_${action}`,
          beforeDate: target.nextReviewDate ? target.nextReviewDate.toISOString() : undefined,
          afterDate: nextRepDate > 0 ? new Date(nextRepDate).toISOString() : undefined,
          beforePriority: target.explanation?.manualPriority ?? target.priority ?? 5,
          afterPriority: target.explanation?.manualPriority ?? target.priority ?? 5,
          sourceType: 'calendar_sidebar'
        });
        monitoring.recordDecisionOutcome({
          itemId: target.id,
          outcomeType: isPostpone ? 'rescheduled' : 'scheduled',
          completionSource: 'calendar_sidebar',
          beforeDate: target.nextReviewDate ? target.nextReviewDate.toISOString() : undefined,
          afterDate: nextRepDate > 0 ? new Date(nextRepDate).toISOString() : undefined
        });
        await monitoring.save();
      } catch (error) {
        logger.warn('[IRCalendarSidebar] Failed to record scheduling monitoring event', error);
      }
    })();
  }


  async function ensureLazyMetadataForSelectedDate(dateKey: string): Promise<void> {
    const normalized = String(dateKey || '').trim();
    if (!normalized || lazyMetadataLoadedDateKeys.has(normalized)) {
      return;
    }
    lazyMetadataLoadedDateKeys.add(normalized);
    if (getCalendarSidebarSettings().showMaterialTimers) {
      try {
        const history = (await getWorkspaceSnapshotService().getWorkspaceData()).history;
        await loadTimerTotalsFromHistory(history);
      } catch (error) {
        logger.warn('[IRCalendarSidebar] lazy timer load failed:', error);
      }
    }
    void refreshReadingPointTagMap(materialsByDate, [normalized]).catch((error) => {
      logger.warn('[IRCalendarSidebar] lazy tag load failed:', error);
    });
  }

  async function ensureMaterialTagsLoaded(material: ScheduleItem): Promise<void> {
    if (readingPointTagsById[material.id]) {
      return;
    }
    try {
      const tags = await getMaterialReadingPointTags(material);
      readingPointTagsById = {
        ...readingPointTagsById,
        [material.id]: tags,
      };
    } catch (error) {
      logger.warn('[IRCalendarSidebar] Failed to load tags for material:', material.id, error);
    }
  }


  async function loadData(options: { forceRecompute?: boolean } = {}): Promise<void> {
    if (loadDataInFlight) {
      loadDataQueued = true;
      loadDataQueuedForceRecompute = loadDataQueuedForceRecompute || Boolean(options.forceRecompute);
      return loadDataInFlight;
    }

    const requestId = ++loadDataRequestId;
    loadDataInFlight = (async () => {
      const loadStartedAt = Date.now();
      const shouldShowBlockingLoading = !hasHydratedCalendarData;
      if (shouldShowBlockingLoading) {
        setCalendarDataPhase('cold_start_blocking');
        isLoading = true;
        setCalendarLoadStage('heatmap', 6);
      }
      let deckIds: string[] | undefined;
      let priorityDateKeys: string[] = [];
      try {
        const requestedDeckId = getRequestedDeckFilterId();
        deckIds = requestedDeckId ? [requestedDeckId] : undefined;
        const todayKey = formatDateKey(today);
        const selectedKey = formatDateKey(selectedDate);
        priorityDateKeys = Array.from(new Set([todayKey, selectedKey]));
        const monthKey = toCalendarMonthKey(formatDateKey(currentDate));

        setCalendarLoadStage('heatmap', 10);
        const loadResult = await loadIRCalendarView(plugin.app, {
          deckIds,
          priorityDateKeys,
          monthKeys: monthKey ? [monthKey] : [],
          forceRecompute: Boolean(options.forceRecompute),
          isCancelled: () => requestId !== loadDataRequestId,
        });
        if (requestId !== loadDataRequestId) {
          return;
        }

        applyMonthHeatmapLoadResult(loadResult.monthHeatmap);
        markCalendarHeatmapShellReady();

        applyProjectionLoadResult(loadResult.projectionHydrate, priorityDateKeys);
        if (loadResult.projectionHydrate) {
          recordCalendarLoadMetric('index_shell_hydrated', loadStartedAt, {
            requestId,
            source: loadResult.projectionHydrate.source,
          });
        }
        if (!hasHydratedCalendarData && loadResult.projectionHydrate) {
          markCalendarColdStartResolved();
        }

        if (loadResult.tier0) {
          setCalendarLoadStage('tier0_cache', 28);
          applyCalendarQueryResult(loadResult.tier0.result, {
            daySummaries: loadResult.tier0.daySummaries,
          });
          recordCalendarLoadMetric('tier0_hydrated', loadStartedAt, {
            requestId,
            dateCount: loadResult.tier0.result.materialsByDate.size,
          });
        }

        if (loadResult.fullQuery) {
          setCalendarLoadStage('workspace_query', 35);
          applyCalendarQueryResult(loadResult.fullQuery);
          calendarScheduleNeedsRecompute = false;
          markWarmReadyPhase();
          recordCalendarLoadMetric('full_refresh_ready', loadStartedAt, {
            requestId,
            dateCount: loadResult.fullQuery.materialsByDate.size,
          });
          void ensureLazyMetadataForSelectedDate(selectedKey);
          return;
        }

        if (loadResult.fastQuery) {
          setCalendarLoadStage('day_list_assemble', 82);
          let merged = loadResult.fastQuery.materialsByDate;
          if (loadResult.projectionHydrate) {
            merged = mergeMaterialsByDate(merged, loadResult.projectionHydrate.materialsByDate);
          }
          applyCalendarQueryResult({
            ...loadResult.fastQuery,
            materialsByDate: merged,
          });
          recordCalendarLoadMetric('fast_path_ready', loadStartedAt, {
            requestId,
            dateCount: merged.size,
          });
        } else if (loadResult.phase === 'shell_only' || loadResult.phase === 'tier0') {
          recordCalendarLoadMetric('local_shell_deferred_full_query', loadStartedAt, {
            requestId,
            phase: loadResult.phase,
          });
        } else if (loadResult.phase === 'empty' && !hasHydratedCalendarData) {
          markRecoverableErrorPhase();
          recordCalendarLoadMetric('fast_path_timeout', loadStartedAt, { requestId });
          return;
        }

        markWarmReadyPhase();
        scheduleBackgroundCalendarReconcile(
          loadResult.scheduleReconcile.priorityDateKeys,
          loadResult.scheduleReconcile.deckIds,
          'sidebar-load-complete'
        );
        void ensureLazyMetadataForSelectedDate(selectedKey);
      } catch (error) {
        markRecoverableErrorPhase();
        logger.error('[IRCalendarSidebar] Recovered error message.', error);
        recordCalendarLoadMetric('load_failed', loadStartedAt, {
          requestId,
          hasHydratedCalendarData,
        });
      } finally {
        if (requestId === loadDataRequestId) {
          if (shouldShowBlockingLoading) {
            isLoading = false;
            maybeClearCalendarLoadStage();
          }
          void finalizePriorityDatesAfterLoad(priorityDateKeys, deckIds);
        }
      }
    })();

    try {
      await loadDataInFlight;
    } finally {
      loadDataInFlight = null;
      if (loadDataQueued) {
        const queuedForceRecompute = loadDataQueuedForceRecompute;
        loadDataQueued = false;
        loadDataQueuedForceRecompute = false;
        await loadData({ forceRecompute: queuedForceRecompute });
      }
    }
    return;
  }

  onMount(() => {
    applyCalendarSidebarSettingsFromPlugin();
    restoreTimerRuntimeState();
    refreshCalendarBackgroundPauseState();
    unsubscribeProjectionRuntime = getSharedIRProjectionRuntime(plugin.app).subscribe((patch) => {
      if (patch.reconcileFailed) {
        recordReconcileFailure();
        return;
      }
      const priorityDateKeys = Array.from(
        new Set((patch.priorityDateKeys || []).map((key) => String(key || '').trim()).filter(Boolean))
      );
      if (priorityDateKeys.length === 0) {
        return;
      }
      recordReconcileSuccess();
      void applyProjectionPriorityDatePatch(priorityDateKeys, patch.deckIds ?? getActiveDeckIdsForQuery());
    });
    void refreshSidebarData().then(() => {
      void ensureSelectedDateMaterialsLoaded(formatDateKey(selectedDate));
    });
    void refreshRecentSpreadCount();

    const handleVisibilityChange = () => {
      const wasPaused = calendarBackgroundPaused;
      refreshCalendarBackgroundPauseState();
      if (wasPaused && !calendarBackgroundPaused && !loadDataInFlight) {
        getSharedIRRefreshScheduler(plugin.app).scheduleCalendarReconcile({
          deckIds: getActiveDeckIdsForQuery(),
          forceRecompute: false,
          priorityDateKeys: Array.from(
            new Set([formatDateKey(today), formatDateKey(selectedDate)])
          ),
          reason: 'sidebar-visibility-resume',
        });
      }
    };
    const handleActiveLeafChange = () => {
      handleVisibilityChange();
    };
    const handleUserInteractionPressure = () => {
      markInteractionPressure();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    plugin.app.workspace.on('active-leaf-change', handleActiveLeafChange);
    window.addEventListener('pointerdown', handleUserInteractionPressure, { passive: true });
    window.addEventListener('wheel', handleUserInteractionPressure, { passive: true });
    window.addEventListener('keydown', handleUserInteractionPressure);

    const handleDataUpdate = (event: Event) => {
      if (debounceTimer) window.clearTimeout(debounceTimer);
      const detail = (event as CustomEvent<UpdatedEventDetail>).detail;
      debounceTimer = window.setTimeout(async () => {
        const generatedAt = detail?.generatedAt ?? 0;
        if (shouldSuppressSidebarRefreshForDataUpdate(detail)) {
          if (generatedAt > 0) {
            lastLocallyHandledBroadcastGeneratedAt = Math.max(
              lastLocallyHandledBroadcastGeneratedAt,
              generatedAt
            );
          }
          return;
        }
        if (
          generatedAt > 0 &&
          (generatedAt === pendingLocalRefreshGeneratedAt ||
            generatedAt <= lastLocallyHandledBroadcastGeneratedAt)
        ) {
          return;
        }

        if (detail?.reason === 'change_priority') {
          const priorityDateKeys = Array.from(
            new Set((detail.priorityDateKeys || []).map((key) => String(key || '').trim()).filter(Boolean))
          );
          if (priorityDateKeys.length > 0) {
            ({ materialsByDate, pinnedByDate } = await syncScheduleMapsPrioritiesFromWorkspace(
              plugin.app,
              materialsByDate,
              pinnedByDate,
              priorityDateKeys
            ));
          }
          if (generatedAt > 0) {
            lastLocallyHandledBroadcastGeneratedAt = Math.max(
              lastLocallyHandledBroadcastGeneratedAt,
              generatedAt
            );
          }
          return;
        }

        if (isProjectionPrimaryDataUpdate(detail)) {
          if (generatedAt > 0) {
            lastLocallyHandledBroadcastGeneratedAt = Math.max(
              lastLocallyHandledBroadcastGeneratedAt,
              generatedAt
            );
          }
          return;
        }

        if (
          !loadDataInFlight &&
          generatedAt > 0 &&
          generatedAt <= lastAppliedScheduleGeneratedAt
        ) {
          return;
        }

        await refreshSidebarAfterDataUpdate({
          priorityDateKeys: detail?.priorityDateKeys,
          deckIds: detail?.deckIds,
        });
        void refreshRecentSpreadCount();
      }, 100);
    };
    window.addEventListener('Weave:ir-data-updated', handleDataUpdate);
    const handleMaterialFinished = (event: Event) => {
      const detail = (event as CustomEvent<IRMaterialFinishedEventDetail>).detail;
      if (!detail?.blockId) return;
      const currentBlockId = detail.blockId;

      void (async () => {
        if (activeReadingTimer?.blockId === currentBlockId) {
          await pauseActiveReadingTimer(detail.reason === 'skipped' ? 'skipped' : 'completed', currentBlockId);
        }
      })();
    };
    window.addEventListener('Weave:ir-material-finished', handleMaterialFinished as EventListener);

    return () => {
      if (debounceTimer) window.clearTimeout(debounceTimer);
      unsubscribeProjectionRuntime?.();
      unsubscribeProjectionRuntime = null;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      plugin.app.workspace.off('active-leaf-change', handleActiveLeafChange);
      window.removeEventListener('pointerdown', handleUserInteractionPressure);
      window.removeEventListener('wheel', handleUserInteractionPressure);
      window.removeEventListener('keydown', handleUserInteractionPressure);
      window.removeEventListener('Weave:ir-data-updated', handleDataUpdate);
      window.removeEventListener('Weave:ir-material-finished', handleMaterialFinished as EventListener);
    };
  });


  let monthDays = $derived(getCalendarDisplayDays(getMonthDays(currentDate.getFullYear(), currentDate.getMonth())));
  let weekdayLabels = $derived(IR_CALENDAR_WEEKDAY_KEYS.map((key) => ({
    key,
    label: t(`irSidebar.controls.${key}`),
    isWeekend: key === 'weekdaySat' || key === 'weekdaySun'
  })));
  let unfilteredSelectedMaterials = $derived(getSelectedMaterialsBase());
  let selectedMaterials = $derived(getSelectedMaterials());
  let searchableScheduleEntries = $derived(getSearchableScheduleEntries());
  let hasActiveSearch = $derived(Boolean(parsedSearchQuery?.raw.trim()));
  let searchMatchedEntries = $derived(getMatchedSearchEntries());
  let displayedMaterials = $derived.by(() =>
    hasActiveSearch ? searchMatchedEntries.map((entry) => entry.item) : selectedMaterials
  );
  let recentSpreadCount = $state(0);

  async function refreshRecentSpreadCount(): Promise<void> {
    try {
      const monitoring = await getMonitoringService();
      const events = monitoring.getRecentDecisionEvents(80);
      const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      recentSpreadCount = events.filter((event) => {
        if (event.action !== 'horizon_spread' && event.action !== 'load_defer') {
          return false;
        }
        const ts = Date.parse(String(event.timestamp || ''));
        return Number.isFinite(ts) && ts >= weekAgo;
      }).length;
    } catch {
      recentSpreadCount = 0;
    }
  }
  let selectedDayLoadStats = $derived.by(() => {
    if (hasActiveSearch) {
      return null;
    }
    const ir = plugin.getIncrementalReadingSettings?.() ?? plugin.settings?.incrementalReading;
    const baseline = Number(ir?.dailyTimeBudgetMinutes) || 40;
    const stretchPercent = Number(ir?.flowStretchPercent ?? 15);
    const baselineCount = Number(ir?.dailyReadingPointCap) || 15;
    const stretchCount = computeReadingPointStretchCap(
      baselineCount,
      stretchPercent,
      ir?.dailyReadingPointStretchCap
    );
    const maxPerItem = Number(ir?.maxEstimatedMinutesPerItem) || DEFAULT_MAX_ESTIMATED_MINUTES_PER_ITEM;
    const stretchCeiling = computeStretchCeilingMinutes(baseline, stretchPercent);
    const assignedMinutes = selectedMaterials.reduce(
      (sum, item) =>
        sum +
        capItemLoadMinutes(
          Number(item.explanation?.estimatedMinutes ?? 5),
          maxPerItem
        ),
      0
    );
    const assignedCount = selectedMaterials.length;
    const selectedDateKey = formatDateKey(selectedDate);
    const plannedLoadStats = scheduleDayLoadStatsByDate.get(selectedDateKey);
    const overloadLevel = computeDayOverloadLevel({
      assignedMinutes,
      baselineMinutes: baseline,
      stretchCeilingMinutes: stretchCeiling,
      assignedCount,
      baselineCount,
      stretchCountCeiling: stretchCount,
      deferredCount: plannedLoadStats?.deferredCount ?? 0,
    });
    return {
      baseline,
      stretchCeiling,
      assignedMinutes,
      baselineCount,
      stretchCount,
      assignedCount,
      overloadLevel,
      enabled:
        ir?.enableLoadBasedDefer !== false || ir?.enableHorizonSmoothing !== false,
    };
  });
  let displayedMaterialDateKeys = $derived.by(() => {
    const dateKeys = new Map<string, string>();
    if (hasActiveSearch) {
      for (const entry of searchMatchedEntries) {
        dateKeys.set(entry.item.id, entry.dateKey);
      }
      return dateKeys;
    }

    const currentDateKey = formatDateKey(selectedDate);
    for (const item of selectedMaterials) {
      dateKeys.set(item.id, currentDateKey);
    }
    return dateKeys;
  });
  let searchAvailableDecks = $derived.by(() =>
    irDecks.map((deck) => ({
      id: String(deck.id || '').trim(),
      name: String(deck.name || '').trim(),
    }))
  );
  let searchAvailableTags = $derived.by(() =>
    Array.from(
      new Set(
        Object.values(readingPointTagsById)
          .flatMap((tags) => tags || [])
          .map((tag) => String(tag || '').trim())
          .filter(Boolean)
      )
    ).sort((left, right) => left.localeCompare(right, 'zh-CN'))
  );
  let searchAvailablePriorities = $derived.by(() =>
    Array.from(new Set(searchableScheduleEntries.map((entry) => Number(entry.item.priority || 0)))).sort((a, b) => a - b)
  );
  let searchAvailableSources = $derived.by(() =>
    Array.from(
      new Set(
        searchableScheduleEntries
          .map((entry) => String(entry.item.sourceFile || '').trim())
          .filter(Boolean)
      )
    ).sort((left, right) => left.localeCompare(right, 'zh-CN'))
  );
  let searchAvailableStates = $derived.by(() =>
    Array.from(
      new Set(
        searchableScheduleEntries
          .map((entry) => String(entry.item.scheduleStatus || '').trim())
          .filter(Boolean)
      )
    ).sort((left, right) => left.localeCompare(right, 'zh-CN'))
  );
  let searchAvailableYamlKeys = $derived.by(() => {
    const keys = new Set<string>();
    for (const entry of searchableScheduleEntries) {
      for (const key of Object.keys(getScheduleItemFrontmatter(entry.item))) {
        if (key) {
          keys.add(key);
        }
      }
    }
    return Array.from(keys).sort((left, right) => left.localeCompare(right, 'zh-CN'));
  });
  let hasContinueReadingSuggestionOffer = $derived(shouldOfferContinueReadingSuggestions());
  let showCalendarTools = $derived(
    hasContinueReadingSuggestionOffer ||
      calendarDataPhase === 'degraded' ||
      calendarDataPhase === 'error_recoverable'
  );
  let showSelectedDateMaterialsPending = $derived(
    calendarDataPhase === 'cold_start_blocking' &&
    !isLoading &&
    !hasActiveSearch &&
    unfilteredSelectedMaterials.length === 0 &&
    getScheduledCountForDateKey(formatDateKey(selectedDate)) > 0 &&
    !isPriorityDateLoadSatisfied(formatDateKey(selectedDate))
  );
  let showTodayAllDoneHeaderChip = $derived(
    !hasActiveSearch &&
    isSameDay(selectedDate, today) &&
    isSelectedDateReadingComplete()
  );
  let showReadingListPreparing = $derived(
    (isSelectedDatePreparing && calendarDataPhase === 'cold_start_blocking') ||
      showSelectedDateMaterialsPending
  );
  let showReadingListLoading = $derived(isLoading || showReadingListPreparing);
  let showDayLoadInfoButton = $derived(
    !hasActiveSearch &&
    !showReadingListLoading &&
    displayedMaterials.length > 0 &&
    Boolean(selectedDayLoadStats?.enabled)
  );
  let calendarListLoadingMessage = $derived.by(() => {
    if (calendarLoadStage !== 'idle') {
      return t(`irSidebar.loadStage.${calendarLoadStage}`, { percent: calendarListLoadProgressPercent });
    }
    if (isLoading) {
      return t('irSidebar.loadingCalendar');
    }
    if (showReadingListPreparing) {
      return t('irSidebar.preparingDayList');
    }
    return '';
  });
  let showReadingListProgress = $derived(
    showReadingListLoading && calendarListLoadProgressPercent > 0
  );
  let calendarLoadStageStaleHint = $derived.by(() => {
    void calendarLoadStageTick;
    if (calendarLoadStage === 'idle' || !showReadingListLoading) {
      return false;
    }
    return Date.now() - calendarLoadStageUpdatedAt > 12_000;
  });
  let selectedDateTagOptions = $derived(getSelectedDateTagOptions());
  let materialListProps = $derived({
    displayedMaterials,
    hasActiveSearch,
    displayedMaterialDateKeys,
    continuousReadingEnabled,
    expandedMaterialIds,
    loadingSiblings,
    siblingCache,
    processedChunkIds,
    timerBusyBlockId,
    t,
    getDisplayedMaterialDateLabel,
    getScheduleItemDeckName,
    getMaterialExpandButtonLabel,
    getReadingPointTypeIndicator,
    handleMaterialClick,
    openMaterial,
    toggleMaterialExpand,
    handleMaterialContextMenu,
    handleLongPressStart,
    handleLongPressMove,
    handleLongPressEnd,
    openSchedulingMenu,
    hasVisibleAssociatedNote,
    getAssociatedNoteActionLabel,
    getAssociatedNoteActionTooltip,
    handleAssociatedNoteClick,
    isTimerRunningForBlock,
    getDisplayedTimerSeconds,
    getReadingTimerButtonTitle,
    toggleReadingTimer,
    formatCompactTimerDuration,
    formatTimerDuration,
    formatSiblingDueDate,
    batchSelectionMode,
    isBatchSelected,
    toggleBatchSelection
  } satisfies IRCalendarMaterialListProps);
  let monthNumber = $derived(currentDate.getMonth() + 1);
  let monthYear = $derived(currentDate.getFullYear());

  $effect(() => {
    if (calendarLoadStage === 'idle' && !isLoading && !showReadingListPreparing) {
      return;
    }
    const intervalId = window.setInterval(() => {
      calendarLoadStageTick += 1;
    }, 2000);
    return () => window.clearInterval(intervalId);
  });

  $effect(() => {
    if (!showSelectedDateMaterialsPending || isSelectedDatePreparing) {
      return;
    }
    const dateKey = formatDateKey(selectedDate);
    void ensureSelectedDateMaterialsLoaded(dateKey);
  });

  $effect(() => {
    void formatDateKey(selectedDate);
    dayLoadPopoverOpen = false;
  });

  $effect(() => {
    if (!showDayLoadInfoButton && dayLoadPopoverOpen) {
      dayLoadPopoverOpen = false;
    }
  });
</script>

<div
  class="ir-calendar-sidebar"
  class:has-background-wall={Boolean(calendarBackgroundWallImageUrl)}
  class:batch-selection-mode={batchSelectionMode}
  style={`--calendar-background-wall-fade-ratio: ${Number(calendarBackgroundWallFadePercent) / 100};`}
  bind:this={calendarSidebarEl}
>
  <div class="calendar-background-wall" aria-hidden="true">
    {#if calendarBackgroundWallImageUrl}
      <div class="calendar-background-wall__image" style={`background-image: url('${calendarBackgroundWallImageUrl}');`}></div>
      <div class="calendar-background-wall__veil"></div>
      <div class="calendar-background-wall__mist"></div>
    {/if}
  </div>
  <!-- Incremental reading calendar sidebar -->
  <div class="calendar-top-tools nav-header" role="toolbar" aria-label={t('irSidebar.calendar.topToolbarAria')}>
    <div class="calendar-top-actions nav-buttons-container">
      <button
        class="calendar-top-action-btn clickable-icon nav-action-button"
        type="button"
        onclick={() => openAddReadingTargetModal()}
        title={t('irCommands.addReadingTarget')}
        aria-label={t('irCommands.addReadingTarget')}
      >
        <ObsidianIcon name="plus" size="var(--icon-size)" />
      </button>
      <button
        class="calendar-top-action-btn clickable-icon nav-action-button"
        type="button"
        onclick={() => { void scanVaultIncrementalReadingDeckFiles(); }}
        title={t('irSidebar.calendar.scanTopics')}
        aria-label={t('irSidebar.calendar.scanTopics')}
      >
        <ObsidianIcon name="scan-search" size="var(--icon-size)" />
      </button>
      {#if showDayLoadInfoButton}
        <button
          class="calendar-top-action-btn clickable-icon nav-action-button day-load-trigger-btn"
          class:day-load-trigger-btn--warning={selectedDayLoadStats?.overloadLevel === 'warning'}
          class:day-load-trigger-btn--overloaded={selectedDayLoadStats?.overloadLevel === 'overloaded'}
          type="button"
          bind:this={dayLoadTriggerEl}
          onclick={toggleDayLoadPopover}
          title={t('irSidebar.calendar.dayLoadInfoTitle')}
          aria-label={t('irSidebar.calendar.dayLoadInfo')}
          aria-expanded={dayLoadPopoverOpen}
          aria-haspopup="dialog"
        >
          <ObsidianIcon name="gauge" size="var(--icon-size)" />
        </button>
      {/if}
      <button
        class="calendar-top-action-btn clickable-icon nav-action-button"
        type="button"
        class:is-active={showSearchPanel}
        onclick={toggleSearchPanel}
        title={t('irSidebar.calendar.searchMaterials')}
        aria-label={t('irSidebar.calendar.searchMaterials')}
      >
        <ObsidianIcon name="search" size="var(--icon-size)" />
      </button>
      <button
        class="calendar-top-action-btn clickable-icon nav-action-button"
        type="button"
        bind:this={calendarToolsTriggerEl}
        onclick={showMonthCalendarToolsMenu}
        title={t('irSidebar.calendar.moreActions')}
        aria-label={t('irSidebar.calendar.moreActions')}
      >
        <ObsidianIcon name="settings" size="var(--icon-size)" />
      </button>
    </div>
  </div>
  <div class="calendar-header nav-header">
    <div class="calendar-title-group">
      <span class="month-title">
        <span class="month-title__month">{monthNumber}</span>
        <span class="month-title__year">{monthYear}</span>
      </span>
      {#if getActiveDeckFilterName()}
        <span class="month-focus-topic" title={sourceFilePath || getActiveDeckFilterName()}>
          {t('irSidebar.header.topicPrefix')}：{getActiveDeckFilterName()}
        </span>
      {/if}
    </div>
    <div class="calendar-header-actions">
      <div class="month-nav" aria-label={t('irSidebar.title')}>
      <button
        class="calendar-tool-btn clickable-icon nav-btn"
        type="button"
        onclick={prevMonth}
        aria-label={t('irSidebar.header.prevMonth')}
        title={t('irSidebar.header.prevMonth')}
      >
        <ObsidianIcon name="chevron-left" size={14} />
      </button>
      <button class="today-btn clickable-icon" type="button" onclick={goToToday} title={t('irSidebar.header.today')}>{t('irSidebar.header.today')}</button>
      {#if showTodayAllDoneHeaderChip}
        <span
          class="calendar-day-complete-chip"
          role="status"
          aria-live="polite"
          title={t('irSidebar.calendar.todayAllDone')}
        >
          <ObsidianIcon name="check" size={12} />
          <span>{t('irSidebar.calendar.todayAllDoneShort')}</span>
        </span>
      {/if}
      <button
        class="calendar-tool-btn clickable-icon nav-btn"
        type="button"
        onclick={nextMonth}
        aria-label={t('irSidebar.header.nextMonth')}
        title={t('irSidebar.header.nextMonth')}
      >
        <ObsidianIcon name="chevron-right" size={14} />
      </button>
      </div>
      {#if showCalendarTools}
        <div class="calendar-tools nav-buttons-container" role="toolbar" aria-label={t('irSidebar.title')}>
          {#if hasContinueReadingSuggestionOffer}
            <button
              class="today-btn clickable-icon continue-reading-trigger-btn"
              type="button"
              bind:this={continueReadingTriggerEl}
              onclick={() => { void openContinueReadingSuggestionsModal(true); }}
              title={t('irSidebar.calendar.openContinueReading')}
              aria-label={t('irSidebar.calendar.openContinueReading')}
            >
              {t('irSidebar.calendar.suggestionsShort')}
            </button>
          {/if}
          {#if calendarDataPhase === 'degraded'}
            <span
              class="calendar-sync-status calendar-sync-status--degraded"
              aria-live="polite"
              title={t('irSidebar.calendar.performanceGuardTitle')}
            >
              <ObsidianIcon name="gauge" size={14} />
              <span class="calendar-sync-status__label">{t('irSidebar.calendar.performanceGuardLabel')}</span>
            </span>
          {:else if calendarDataPhase === 'error_recoverable'}
            <span
              class="calendar-sync-status calendar-sync-status--recoverable"
              aria-live="polite"
              title={t('irSidebar.calendar.backgroundRetryTitle')}
            >
              <ObsidianIcon name="alert-triangle" size={14} />
              <span class="calendar-sync-status__label">{t('irSidebar.calendar.backgroundRetryLabel')}</span>
            </span>
          {/if}
        </div>
      {/if}
    </div>
  </div>

  {#if showSearchPanel}
    <div class="calendar-search-panel">
      <IRCalendarSearchInput
        bind:value={searchQuery}
        app={plugin.app}
        dataSource="incremental-reading"
        showSortButton={false}
        availableDecks={searchAvailableDecks}
        availableTags={searchAvailableTags}
        availablePriorities={searchAvailablePriorities}
        availableSources={searchAvailableSources}
        availableStates={searchAvailableStates}
        availableYamlKeys={searchAvailableYamlKeys}
        matchCount={hasActiveSearch ? searchMatchedEntries.length : -1}
        totalCount={searchableScheduleEntries.length}
        onSearch={handleSearch}
        onClear={clearSearch}
        placeholder={t('irSidebar.calendar.searchPlaceholder')}
      />
    </div>
  {/if}


  <div class="calendar-grid-container">
    <div class="weekdays">
      {#each weekdayLabels as weekday}
        <span class="weekday" class:weekend={weekday.isWeekend}>{weekday.label}</span>
      {/each}
    </div>
    <div class="calendar-grid">
      {#each monthDays as { date, otherMonth }}
        {@const isToday = isSameDay(date, today)}
        {@const isSelected = isSameDay(date, selectedDate)}
        {@const heatLevel = getHeatLevel(date)}
        {@const dayState = getCalendarDayVisualState(date)}
        <button
          class="day-cell"
          class:other-month={otherMonth}
          class:today={isToday}
          class:selected={isSelected}
          class:has-tasks={dayState.hasTasks}
          class:fully-completed={dayState.isFullyCompleted}
          class:partially-completed={dayState.isPartiallyCompleted}
          class:today-pending={dayState.isTodayPending}
          class:overdue-pending={dayState.isOverduePending}
          onclick={() => selectDay(date)}
          title={getCalendarDayCellTitle(dayState)}
        >
          <span class="day-surface" aria-hidden="true"></span>
          {#if dayState.isFullyCompleted}
            <span class="day-complete-icon" aria-hidden="true">
              <ObsidianIcon name="check" size={14} />
            </span>
          {:else}
            <span class="day-number">{date.getDate()}</span>
          {/if}
          {#if dayState.hasTasks && !dayState.isFullyCompleted}
            <span
              class="day-status-chip"
              class:neutral={!dayState.isTodayPending && !dayState.isOverduePending}
              class:warn={dayState.isTodayPending}
              class:danger={dayState.isOverduePending}
              aria-hidden="true"
            >
              {#if dayState.isOverduePending}
                <ObsidianIcon name="x" size={10} />
              {:else}
                <span class="day-status-dot"></span>
              {/if}
            </span>
          {/if}
          <span class="heat-dot-row" aria-hidden="true">
            {#each getHeatDots(date) as dotIndex}
              <span class="heat-dot level-{heatLevel}" data-dot-index={dotIndex}></span>
            {/each}
          </span>
        </button>
      {/each}
    </div>
  </div>


  <div class="reading-list">
    {#if showReadingListLoading}
      <div
        class="loading-state loading-state--preparing"
        role={showReadingListProgress ? 'progressbar' : 'status'}
        aria-live="polite"
        aria-valuemin={showReadingListProgress ? 0 : undefined}
        aria-valuemax={showReadingListProgress ? 100 : undefined}
        aria-valuenow={showReadingListProgress ? calendarListLoadProgressPercent : undefined}
      >
        <ObsidianIcon name="loader" size={20} />
        <span class="loading-state__message">{calendarListLoadingMessage}</span>
        {#if showReadingListProgress}
          <div class="calendar-load-progress loading-state__progress" aria-hidden="true">
            <div
              class="calendar-load-progress__bar"
              style={`width: ${calendarListLoadProgressPercent}%`}
            ></div>
          </div>
          <span class="loading-state__percent">{calendarListLoadProgressPercent}%</span>
        {/if}
        {#if calendarLoadStageStaleHint}
          <span class="loading-state__hint">{t('irSidebar.loadStage.stillWorking')}</span>
        {/if}
      </div>
    {:else if displayedMaterials.length > 0}
      <IRCalendarMaterialList {...materialListProps} />
    {:else if hasActiveSearch}
      <div class="loading-state search-empty-state">
        <ObsidianIcon name="search" size={20} />
        <span>{t('irSidebar.calendar.searchNoResults')}</span>
        <button
          type="button"
          class="clickable-icon clear-tag-filter-btn"
          onclick={clearSearch}>{t('irSidebar.calendar.clearSearch')}</button>
      </div>
    {:else if unfilteredSelectedMaterials.length > 0 && activeReadingTagFilter}
      <div class="loading-state">
        <ObsidianIcon name="tag" size={20} />
        <span>{t('irSidebar.calendar.tagFilterNoMatch', { tag: activeReadingTagFilter })}</span>
        <button
          type="button"
          class="clickable-icon clear-tag-filter-btn"
          onclick={() => { activeReadingTagFilter = ''; }}>{t('irSidebar.calendar.clearTagFilter')}</button>
      </div>
    {/if}
  </div>

  {#if activeReadingTimer}
    <div class="footer-timer-bar">
      <div class="footer-timer-info">
        <span class="footer-timer-kicker">Active timer</span>
        <span class="footer-timer-title" title={getActiveReadingTimerLabel()}>{getActiveReadingTimerLabel()}</span>
      </div>
      <div class="footer-timer-meta">
        <span class="footer-timer-value">{formatTimerDuration(getDisplayedTimerSeconds(activeReadingTimer.blockId))}</span>
        <button
          type="button"
          class="footer-timer-pause"
          onclick={() => void pauseActiveReadingTimer('manual')}
          title="Pause timer"
        >
          <ObsidianIcon name="pause" size={12} />
        </button>
      </div>
    </div>
  {/if}

  {#if batchSelectionMode}
    <div class="batch-floating-toolbar" role="toolbar" aria-label={t('irSidebar.batch.modeActive')}>
      <span
        class="batch-floating-toolbar__count"
        title={t('irSidebar.batch.selectedCount', { count: batchSelectedIds.size })}
        aria-label={t('irSidebar.batch.selectedCount', { count: batchSelectedIds.size })}
      >
        {batchSelectedIds.size}
      </span>
      <div class="batch-floating-toolbar__actions">
        <button
          type="button"
          class="clickable-icon batch-floating-toolbar__btn"
          onclick={selectAllDisplayedMaterials}
          title={t('irSidebar.batch.selectAllVisible')}
          aria-label={t('irSidebar.batch.selectAllVisible')}
        >
          <ObsidianIcon name="square-check" size={16} />
        </button>
        {#if batchSelectedIds.size > 0}
          <button
            type="button"
            class="clickable-icon batch-floating-toolbar__btn"
            onclick={clearBatchSelection}
            title={t('irSidebar.batch.clearSelection')}
            aria-label={t('irSidebar.batch.clearSelection')}
          >
            <ObsidianIcon name="eraser" size={16} />
          </button>
          <button
            type="button"
            class="clickable-icon batch-floating-toolbar__btn batch-floating-toolbar__btn--primary"
            onclick={(event) => showBatchActionsMenu(event)}
            title={t('irSidebar.batch.openBatchActions')}
            aria-label={t('irSidebar.batch.openBatchActions')}
          >
            <ObsidianIcon name="copy-check" size={16} />
          </button>
        {/if}
        <button
          type="button"
          class="clickable-icon batch-floating-toolbar__btn"
          onclick={exitBatchSelectionMode}
          title={t('irSidebar.batch.exitSelectionMode')}
          aria-label={t('irSidebar.batch.exitSelectionMode')}
        >
          <ObsidianIcon name="x" size={16} />
        </button>
      </div>
    </div>
  {/if}

</div>

<FloatingMenu
  bind:show={priorityMenuOpen}
  anchor={priorityMenuAnchor}
  placement="left-start"
  portal={false}
  onClose={closePriorityMenu}
  class="ir-calendar-priority-menu"
>
  {#snippet children()}
    {#if priorityMenuTarget}
      <div class="ir-calendar-priority-panel">
        <IRPrioritySlider
          value={priorityMenuTarget.priority ?? 5}
          expanded={prioritySliderExpanded}
          onToggle={() => {
            prioritySliderExpanded = !prioritySliderExpanded;
            if (!prioritySliderExpanded) closePriorityMenu();
          }}
          onPreview={handlePriorityPreview}
          onChange={handlePriorityUiChange}
        />
        <IRScheduleImpactPreviewPanel preview={priorityPreviewDetails} />
      </div>
    {/if}
  {/snippet}
</FloatingMenu>

<FloatingMenu
  bind:show={schedulingMenuOpen}
  anchor={schedulingMenuAnchor}
  placement="left-start"
  portal={false}
  onClose={closeSchedulingMenu}
  class="ir-calendar-scheduling-menu"
>
  {#snippet children()}
    {#if schedulingMenuTarget}
      <div class="ir-calendar-scheduling-panel">
        <div class="ir-calendar-scheduling-grid" role="group">
          {#each schedulingConfig as cfg (cfg.action)}
            <button
              type="button"
              class="ir-calendar-scheduling-btn"
              class:is-focused={schedulingPreviewFocusAction === cfg.action}
              onclick={(event) => activateSchedulingMenuAction(cfg.action, event)}
              onmouseenter={() => {
                schedulingPreviewFocusAction = cfg.action;
              }}
              onfocus={() => {
                schedulingPreviewFocusAction = cfg.action;
              }}
            >
              <span class="ir-calendar-scheduling-label" style:color={cfg.color}>{cfg.label}</span>
              {#if schedulingDateByAction[cfg.action]}
                <span class="ir-calendar-scheduling-date">{schedulingDateByAction[cfg.action]}</span>
              {:else if schedulingMenuPreviewState === 'error'}
                <span class="ir-calendar-scheduling-date is-unavailable">{t('irSidebar.scheduling.previewUnavailable')}</span>
              {:else}
                <span class="ir-calendar-scheduling-date is-unavailable">{t('irSidebar.controls.unscheduled')}</span>
              {/if}
            </button>
          {/each}
        </div>
        {#if showSchedulingPreview}
          <IRScheduleImpactPreviewPanel preview={schedulingPreviewByAction[schedulingPreviewFocusAction]} />
        {/if}
      </div>
    {/if}
  {/snippet}
</FloatingMenu>

<FloatingMenu
  bind:show={dayLoadPopoverOpen}
  anchor={dayLoadTriggerEl}
  placement="bottom-end"
  offset={6}
  onClose={closeDayLoadPopover}
  role="dialog"
  class="ir-calendar-day-load-popover"
>
  {#snippet children()}
    {#if selectedDayLoadStats?.enabled}
      <div
        class="day-load-popover-panel"
        class:day-load-popover-panel--warning={selectedDayLoadStats.overloadLevel === 'warning'}
        class:day-load-popover-panel--overloaded={selectedDayLoadStats.overloadLevel === 'overloaded'}
        role="status"
        aria-live="polite"
      >
        <div class="day-load-popover-panel__summary">
          {t('irSidebar.dayLoadSummary', {
            baseline: selectedDayLoadStats.baseline,
            stretch: selectedDayLoadStats.stretchCeiling,
            assigned: selectedDayLoadStats.assignedMinutes,
          })}
        </div>
        <div class="day-load-popover-panel__summary">
          {t('irSidebar.dayLoadCountSummary', {
            assigned: selectedDayLoadStats.assignedCount,
            stretch: selectedDayLoadStats.stretchCount,
            baseline: selectedDayLoadStats.baselineCount,
          })}
        </div>
        {#if recentSpreadCount > 0}
          <div class="day-load-popover-panel__hint">{t('irSidebar.dayLoadSpreadNote', { count: recentSpreadCount })}</div>
        {/if}
        {#if selectedDayLoadStats.overloadLevel === 'warning'}
          <div class="day-load-popover-panel__hint">{t('irSidebar.dayLoadStretchHint')}</div>
        {:else if selectedDayLoadStats.overloadLevel === 'overloaded'}
          <div class="day-load-popover-panel__hint">{t('irSidebar.dayLoadOverloadedHint')}</div>
        {/if}
      </div>
    {/if}
  {/snippet}
</FloatingMenu>


{#if showAddReadingPointModal}
  <AddReadingPointModal
    {plugin}
    deckId={arpDeckId}
    pdfPath={arpPdfPath}
    parentTitle={arpParentTitle}
    onClose={() => { showAddReadingPointModal = false; }}
    onCreated={() => { showAddReadingPointModal = false; }}
  />
{/if}

<style>
  :global(.workspace-leaf-content[data-type^="weave-ir-calendar-view"] > .view-content.weave-ir-calendar-view) {
    padding: 0;
    overflow: hidden;
    --weave-ir-calendar-host-background: var(--weave-surface-background, var(--background-primary));
    background: var(--weave-ir-calendar-host-background);
  }

  :global(.workspace-leaf-content[data-type^="weave-ir-calendar-view"] > .view-content.weave-ir-calendar-view[data-weave-surface-context="sidebar"]) {
    /* 侧边栏里尽量继承 Obsidian/主题提供的宿主背景，避免我们再叠一层“secondary”底色导致偏色。 */
    --weave-ir-calendar-host-background: transparent;
    background: transparent;
  }

  .ir-calendar-sidebar {
    /*
     * 与 EPUB 侧栏一致：优先继承 view-content 宿主背景，避免在特定主题（如 Composer）
     * 被固定的 surface token（例如 background-secondary）拉出色差。
     */
    --weave-ir-sidebar-surface-background: var(
      --weave-ir-calendar-host-background,
      var(--weave-surface-background, var(--background-primary))
    );
    --weave-ir-sidebar-elevated-background: var(--weave-elevated-background, var(--background-primary));
    --calendar-background-wall-fade-ratio: 0.72;
    display: flex;
    flex-direction: column;
    width: 100%;
    max-width: 100%;
    height: 100%;
    min-height: 0;
    padding: 12px;
    background: var(--weave-ir-sidebar-surface-background);
    box-sizing: border-box;
    container-type: inline-size;
    overflow: hidden;
    position: relative;
    isolation: isolate;
  }

  .ir-calendar-sidebar > :not(.calendar-background-wall) {
    position: relative;
    z-index: 1;
  }

  .calendar-background-wall {
    position: absolute;
    inset: 0 0 auto 0;
    height: min(58%, 420px);
    pointer-events: none;
    z-index: 0;
    overflow: hidden;
  }

  .calendar-background-wall__image,
  .calendar-background-wall__veil,
  .calendar-background-wall__mist {
    position: absolute;
    inset: 0;
  }

  .calendar-background-wall__image {
    background-position: center top;
    background-repeat: no-repeat;
    background-size: cover;
    opacity: calc(1 - (var(--calendar-background-wall-fade-ratio) * 0.78));
    transform: scale(calc(1 + (var(--calendar-background-wall-fade-ratio) * 0.04)));
    filter:
      saturate(calc(1 - (var(--calendar-background-wall-fade-ratio) * 0.1)))
      contrast(calc(1 - (var(--calendar-background-wall-fade-ratio) * 0.04)));
    mask-image: linear-gradient(180deg, rgba(0, 0, 0, 0.96) 0%, rgba(0, 0, 0, 0.78) 54%, transparent 100%);
    -webkit-mask-image: linear-gradient(180deg, rgba(0, 0, 0, 0.96) 0%, rgba(0, 0, 0, 0.78) 54%, transparent 100%);
  }

  .calendar-background-wall__veil {
    background:
      linear-gradient(
        180deg,
        color-mix(in srgb, var(--weave-ir-sidebar-surface-background) calc(var(--calendar-background-wall-fade-ratio) * 18%), transparent) 0%,
        color-mix(in srgb, var(--weave-ir-sidebar-surface-background) calc(var(--calendar-background-wall-fade-ratio) * 34%), transparent) 22%,
        color-mix(in srgb, var(--weave-ir-sidebar-surface-background) calc(var(--calendar-background-wall-fade-ratio) * 62%), transparent) 58%,
        var(--weave-ir-sidebar-surface-background) 100%
      );
  }

  .calendar-background-wall__mist {
    background:
      radial-gradient(circle at 14% 14%, color-mix(in srgb, white calc(var(--calendar-background-wall-fade-ratio) * 12%), transparent) 0%, transparent 48%),
      radial-gradient(circle at 86% 22%, color-mix(in srgb, white calc(var(--calendar-background-wall-fade-ratio) * 10%), transparent) 0%, transparent 42%),
      linear-gradient(180deg, transparent 0%, color-mix(in srgb, var(--weave-ir-sidebar-surface-background) calc(var(--calendar-background-wall-fade-ratio) * 12%), transparent) 72%, transparent 100%);
    opacity: calc(var(--calendar-background-wall-fade-ratio) * 0.78);
  }

  .ir-calendar-sidebar.has-background-wall .calendar-grid-container {
    position: relative;
  }


  .calendar-top-tools {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0;
    min-height: var(--header-height);
    margin-bottom: 0;
    padding: var(--size-4-2);
    border-bottom: none;
    background-color: transparent;
    box-sizing: border-box;
  }

  .calendar-top-tools .calendar-top-actions.nav-buttons-container {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--size-2-1);
    width: fit-content;
    max-width: 100%;
    flex-wrap: nowrap;
    margin-inline: auto;
    padding: var(--size-2-1);
    border-radius: var(--radius-m);
    background-color: var(--nav-button-container-bg, var(--background-secondary-alt));
    box-sizing: border-box;
  }

  .calendar-top-tools .calendar-top-action-btn.nav-action-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: var(--size-2-2) var(--size-2-3);
    border: none;
    border-radius: var(--clickable-icon-radius);
    background-color: transparent;
    color: var(--icon-color);
    box-shadow: none;
    opacity: var(--icon-opacity);
    cursor: pointer;
    transition:
      opacity var(--anim-duration-fast) ease-in-out,
      color var(--anim-duration-fast) ease-in-out,
      background-color var(--anim-duration-fast) ease-in-out;
  }

  .calendar-top-tools .calendar-top-action-btn.nav-action-button:hover {
    color: var(--icon-color-hover);
  }

  .calendar-top-tools .calendar-top-action-btn.nav-action-button :global(svg) {
    width: var(--icon-size);
    height: var(--icon-size);
  }

  .calendar-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    margin-bottom: 18px;
    min-width: 0;
  }

  .calendar-header-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 6px;
    flex: 0 0 auto;
    min-width: 0;
    margin-left: auto;
  }

  .month-focus-topic {
    display: inline-flex;
    align-items: center;
    max-width: 100%;
    padding: 2px 8px;
    border-radius: 999px;
    font-size: 11px;
    line-height: 1.4;
    color: var(--text-muted);
    background: color-mix(in srgb, var(--background-modifier-border) 30%, transparent);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .calendar-title-group {
    min-width: 0;
    flex: 1 1 auto;
  }

  .month-title {
    display: inline-flex;
    align-items: baseline;
    gap: 6px;
    min-width: 0;
    white-space: nowrap;
  }

  .month-title__month {
    font-size: 18px;
    font-weight: 560;
    line-height: 1;
    letter-spacing: -0.02em;
    color: color-mix(in srgb, var(--text-normal) 92%, white);
  }

  .month-title__year {
    font-size: 11px;
    font-weight: 650;
    line-height: 1;
    letter-spacing: 0;
    color: color-mix(in srgb, var(--color-orange) 58%, var(--text-normal));
  }

  .calendar-tool-btn {
    width: var(--clickable-icon-size, 32px);
    height: var(--clickable-icon-size, 32px);
    padding: 0;
    border: none;
    background: transparent;
    color: color-mix(in srgb, var(--text-normal) 66%, transparent);
    border-radius: 999px;
    box-shadow: none;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    cursor: pointer;
    transition:
      background-color 0.18s ease,
      color 0.18s ease,
      transform 0.18s ease;
  }

  .calendar-tool-btn:hover {
    color: var(--text-normal);
    background: color-mix(in srgb, var(--background-modifier-hover) 78%, transparent);
  }

  .calendar-tool-btn.active {
    color: var(--text-normal);
    background: var(--background-modifier-hover);
  }

  .calendar-tool-btn:focus-visible {
    outline: 2px solid var(--background-modifier-border-focus, rgba(var(--interactive-accent-rgb), 0.22));
    outline-offset: 1px;
  }

  .calendar-tools {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 2px;
    min-width: 0;
    padding: 2px 4px;
    border-radius: var(--radius-s, 6px);
    background: color-mix(in srgb, var(--background-modifier-hover) 42%, transparent);
  }

  .calendar-sync-status {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    max-width: min(11rem, 42vw);
    height: var(--clickable-icon-size, 32px);
    padding: 0 6px;
    flex-shrink: 1;
    min-width: 0;
    color: var(--interactive-accent);
    opacity: var(--icon-opacity, 0.85);
  }

  .calendar-sync-status__label {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 10px;
    font-weight: 500;
    line-height: 1;
    color: color-mix(in srgb, var(--interactive-accent) 72%, var(--text-muted));
  }

  .calendar-sync-status__percent {
    font-size: 10px;
    font-weight: 600;
    line-height: 1;
    font-variant-numeric: tabular-nums;
    color: color-mix(in srgb, var(--interactive-accent) 82%, var(--text-muted));
  }

  .calendar-sync-status :global(svg) {
    animation: ir-calendar-sync-spin 0.9s linear infinite;
  }

  .calendar-sync-status--degraded {
    color: color-mix(in srgb, var(--color-yellow) 72%, var(--text-muted));
  }

  .calendar-sync-status--recoverable {
    color: color-mix(in srgb, var(--color-orange) 74%, var(--text-muted));
  }

  .calendar-sync-status--degraded .calendar-sync-status__label,
  .calendar-sync-status--recoverable .calendar-sync-status__label {
    color: currentColor;
  }

  .calendar-sync-status--degraded :global(svg),
  .calendar-sync-status--recoverable :global(svg) {
    animation: none;
  }

  @keyframes ir-calendar-sync-spin {
    from {
      transform: rotate(0deg);
    }

    to {
      transform: rotate(360deg);
    }
  }

  .calendar-search-panel {
    margin: 0 0 10px;
  }

  .calendar-search-panel__pending {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin: 0 0 6px;
  }

  .calendar-search-panel__pending-text {
    margin: 0;
    font-size: 11px;
    line-height: 1.4;
    color: var(--text-muted);
  }

  .calendar-load-progress {
    width: 100%;
    height: 3px;
    border-radius: 999px;
    overflow: hidden;
    background: color-mix(in srgb, var(--background-modifier-border) 55%, transparent);
  }

  .calendar-load-progress__bar {
    height: 100%;
    border-radius: inherit;
    background: var(--interactive-accent);
    transition: width 0.22s ease;
  }


  .month-nav {
    display: flex;
    align-items: center;
    gap: 6px;
    flex: 0 0 auto;
    justify-content: flex-end;
    min-width: 0;
    padding: 0;
  }

  .calendar-top-tools .day-load-trigger-btn--warning,
  .calendar-top-tools .day-load-trigger-btn--overloaded {
    opacity: 1;
  }

  .calendar-top-tools .day-load-trigger-btn--warning:hover,
  .calendar-top-tools .day-load-trigger-btn--overloaded:hover {
    color: var(--icon-color-hover);
  }

  .nav-btn {
    color: color-mix(in srgb, var(--text-normal) 58%, transparent);
  }

  .today-btn {
    width: auto;
    min-width: 0;
    height: 22px;
    padding: 0 6px;
    border: none;
    background: transparent;
    box-shadow: none;
    color: color-mix(in srgb, var(--text-normal) 68%, transparent);
    border-radius: 999px;
    font-size: 10px;
    font-weight: 560;
    line-height: 1;
    cursor: pointer;
    transition:
      background-color 0.18s ease,
      color 0.18s ease,
      transform 0.18s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    white-space: nowrap;
  }

  .today-btn:hover {
    color: var(--text-normal);
    background: color-mix(in srgb, var(--background-modifier-hover) 78%, transparent);
  }

  .today-btn:focus-visible {
    outline: 2px solid var(--background-modifier-border-focus, rgba(var(--interactive-accent-rgb), 0.22));
    outline-offset: 1px;
  }

  .calendar-day-complete-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    max-width: min(120px, 100%);
    padding: 2px 8px;
    border-radius: 999px;
    border: 1px solid color-mix(in srgb, var(--color-green) 28%, var(--background-modifier-border));
    background: color-mix(in srgb, var(--color-green) 10%, transparent);
    color: var(--text-muted);
    font-size: 11px;
    line-height: 1.3;
    white-space: nowrap;
  }

  .calendar-day-complete-chip :global(svg) {
    color: var(--color-green);
    flex: 0 0 auto;
  }

  .continue-reading-trigger-btn {
    color: var(--text-normal);
    border: none;
    background: transparent;
  }

  .continue-reading-trigger-btn:hover {
    color: var(--text-normal);
    border: none;
    background: var(--background-modifier-hover);
  }


  .calendar-grid-container {
    background: transparent;
    border-radius: 0;
    padding: 0 0 8px;
    margin-bottom: 10px;
    min-width: 0;
    overflow: clip;
    box-sizing: border-box;
  }

  .weekdays {
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
    gap: 14px;
    margin-bottom: 12px;
    min-width: 0;
  }

  .weekday {
    min-width: 0;
    text-align: center;
    font-size: 8px;
    font-weight: 540;
    letter-spacing: 0.01em;
    color: color-mix(in srgb, var(--text-muted) 96%, var(--text-normal));
    padding: 0;
  }

  .weekday.weekend {
    color: color-mix(in srgb, var(--color-orange) 26%, var(--text-muted));
  }

  .ir-calendar-sidebar.has-background-wall .weekday {
    color: color-mix(in srgb, var(--text-normal) 84%, var(--weave-ir-sidebar-surface-background));
    text-shadow:
      0 1px 2px color-mix(in srgb, var(--weave-ir-sidebar-surface-background) 74%, transparent),
      0 0 1px color-mix(in srgb, var(--weave-ir-sidebar-surface-background) 68%, transparent);
  }

  .ir-calendar-sidebar.has-background-wall .weekday.weekend {
    color: color-mix(in srgb, var(--color-orange) 42%, var(--text-normal));
  }

  .calendar-grid {
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
    gap: 14px;
    min-width: 0;
  }

  .day-cell {
    width: 100%;
    aspect-ratio: 1;
    min-width: 0;
    padding: 0;
    border: 0 !important;
    border-color: transparent !important;
    border-style: solid !important;
    border-width: 0 !important;
    border-image: none !important;
    background: transparent !important;
    border-radius: 0;
    box-shadow: none !important;
    filter: none !important;
    outline: none;
    appearance: none;
    -webkit-appearance: none;
    -moz-appearance: none;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    position: relative;
    transition:
      transform 0.18s ease,
      color 0.18s ease,
      opacity 0.18s ease;
  }

  .day-surface {
    position: absolute;
    top: calc(50% - 1px);
    left: 50%;
    width: 28px;
    height: 28px;
    transform: translate(-50%, -50%);
    border-radius: 999px;
    background: transparent;
    border: 1px solid transparent;
    pointer-events: none;
    transition:
      background-color 0.18s ease,
      border-color 0.18s ease,
      box-shadow 0.18s ease;
  }

  .day-cell:hover {
    background: transparent !important;
    transform: translateY(-1px);
  }

  .day-cell.other-month {
    opacity: 1;
  }

  .day-cell.other-month .day-number {
    color: color-mix(in srgb, var(--text-muted) 86%, var(--weave-ir-sidebar-surface-background));
    opacity: 0.72;
  }

  .day-cell.other-month .day-status-chip,
  .day-cell.other-month .heat-dot-row {
    opacity: 0.52;
  }

  .day-cell.selected {
    background: transparent !important;
  }

  .day-cell.has-tasks.selected .day-surface {
    background: color-mix(in srgb, var(--interactive-accent) 5%, transparent);
    border-color: color-mix(in srgb, var(--interactive-accent) 18%, transparent);
  }

  .day-cell.today-pending .day-surface {
    background: transparent;
    border-color: color-mix(in srgb, var(--color-orange) 22%, transparent);
  }

  .day-cell.has-tasks.today .day-surface,
  .day-cell.has-tasks.selected .day-surface {
    width: 28px;
    height: 28px;
  }

  .day-cell.overdue-pending .day-surface {
    background: transparent;
    border-color: transparent;
  }

  .day-cell.has-tasks.selected .day-number {
    color: color-mix(in srgb, var(--text-normal) 96%, white);
    font-weight: 620;
  }

  .day-cell.has-tasks.selected .heat-dot {
    transform: scale(1.05);
    opacity: 1;
  }

  .day-cell.has-tasks.today .day-number {
    font-weight: 580;
    color: color-mix(in srgb, var(--text-normal) 92%, white);
  }

  .day-cell.has-tasks.selected.today .day-number {
    color: color-mix(in srgb, var(--text-normal) 96%, white);
  }

  .day-cell:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--interactive-accent) 38%, transparent);
    outline-offset: 2px;
    border-radius: 6px;
  }

  .day-number {
    position: relative;
    z-index: 1;
    font-size: 13px;
    font-weight: 560;
    line-height: 1;
    letter-spacing: -0.01em;
    color: color-mix(in srgb, var(--text-normal) 86%, transparent);
    font-variation-settings: "wght" 500;
    text-shadow: none;
  }

  .ir-calendar-sidebar.has-background-wall .day-number {
    color: color-mix(in srgb, var(--text-normal) 94%, var(--weave-ir-sidebar-surface-background));
    text-shadow:
      0 1px 2px color-mix(in srgb, var(--weave-ir-sidebar-surface-background) 76%, transparent),
      0 0 1px color-mix(in srgb, var(--weave-ir-sidebar-surface-background) 62%, transparent);
  }

  .ir-calendar-sidebar.has-background-wall .day-cell.other-month .day-number {
    color: color-mix(in srgb, var(--text-muted) 92%, var(--weave-ir-sidebar-surface-background));
    opacity: 0.78;
  }

  .day-complete-icon {
    position: relative;
    z-index: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    color: color-mix(in srgb, var(--color-green) 88%, black);
  }

  .day-status-chip {
    position: relative;
    z-index: 1;
    min-width: auto;
    height: auto;
    padding: 0;
    border-radius: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 8px;
    font-weight: 600;
    line-height: 1;
    color: var(--text-faint);
    background: transparent;
  }

  .day-status-chip.warn {
    color: color-mix(in srgb, var(--color-orange) 88%, black);
  }

  .day-status-chip.danger {
    color: color-mix(in srgb, var(--color-red) 88%, white);
  }

  .day-status-chip.neutral {
    color: var(--text-faint);
  }

  .day-status-dot {
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: color-mix(in srgb, var(--text-muted) 62%, var(--background-modifier-border));
  }

  .heat-dot-row {
    position: relative;
    z-index: 1;
    min-height: 4px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 3px;
  }


  .heat-dot {
    width: 4px;
    height: 4px;
    border-radius: 50%;
    transition:
      opacity 0.18s ease,
      transform 0.18s ease;
  }

  .heat-dot.level-0 { background: color-mix(in srgb, var(--background-modifier-border) 72%, transparent); opacity: 0.35; }
  .heat-dot.level-1 { background: color-mix(in srgb, var(--color-green) 68%, white); opacity: 0.28; }
  .heat-dot.level-2 { background: color-mix(in srgb, var(--color-green) 80%, white); opacity: 0.42; }
  .heat-dot.level-3 { background: color-mix(in srgb, var(--color-yellow) 78%, white); opacity: 0.5; }
  .heat-dot.level-4 { background: color-mix(in srgb, var(--color-orange) 80%, white); opacity: 0.58; }
  .heat-dot.level-5 { background: color-mix(in srgb, var(--color-red) 80%, white); opacity: 0.64; }

  :global(.workspace-leaf-content[data-type^="weave-ir-calendar-view"] .view-content.weave-ir-calendar-view .day-cell) {
    border: 0 !important;
    border-image: none !important;
    background: transparent !important;
    box-shadow: none !important;
  }

  :global(.workspace-leaf-content[data-type^="weave-ir-calendar-view"] .view-content.weave-ir-calendar-view .day-cell:hover) {
    border: 0 !important;
    background: transparent !important;
    box-shadow: none !important;
  }


  .reading-tag-filter-bar {
    display: flex;
    align-items: center;
    gap: 6px;
    overflow-x: auto;
    padding: 0 0 8px;
    margin-bottom: 4px;
    scrollbar-width: none;
  }

  .reading-tag-filter-bar::-webkit-scrollbar {
    display: none;
  }

  .reading-tag-filter-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
    border: 1px solid var(--background-modifier-border);
    background: var(--weave-ir-sidebar-elevated-background);
    color: var(--text-muted);
    border-radius: 999px;
    padding: 4px 8px;
    font-size: 11px;
    font-weight: 600;
    line-height: 1;
    cursor: pointer;
  }

  .reading-tag-filter-count {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 16px;
    height: 16px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--background-modifier-border) 78%, transparent);
    color: var(--text-faint);
    font-size: 10px;
    padding: 0 4px;
  }

  .reading-tag-filter-chip.active {
    border-color: color-mix(in srgb, var(--interactive-accent) 38%, var(--background-modifier-border));
    background: color-mix(in srgb, var(--interactive-accent) 12%, var(--weave-ir-sidebar-surface-background));
    color: var(--interactive-accent);
  }


  .day-load-trigger-btn--warning {
    color: color-mix(in srgb, var(--color-yellow) 82%, var(--text-muted));
  }

  .day-load-trigger-btn--overloaded {
    color: color-mix(in srgb, var(--color-orange) 86%, var(--text-muted));
  }

  .day-load-trigger-btn--warning:hover,
  .day-load-trigger-btn--overloaded:hover {
    color: var(--text-normal);
  }

  :global(.floating-menu.ir-calendar-day-load-popover) {
    min-width: 240px;
    max-width: min(360px, calc(100vw - 16px));
    border-radius: var(--radius-m, 10px);
    box-shadow:
      0 10px 28px color-mix(in srgb, var(--background-modifier-border) 45%, transparent),
      0 2px 8px rgba(0, 0, 0, 0.08);
  }

  .day-load-popover-panel {
    padding: 10px 12px;
    color: var(--text-muted);
    font-size: var(--font-ui-smaller);
    line-height: var(--line-height-normal);
  }

  .day-load-popover-panel--warning {
    color: var(--text-normal);
  }

  .day-load-popover-panel--overloaded {
    color: var(--text-normal);
  }

  .day-load-popover-panel__summary {
    font-weight: 500;
  }

  .day-load-popover-panel__hint {
    margin-top: 4px;
    color: var(--text-muted);
  }

  .day-load-popover-panel--warning .day-load-popover-panel__summary:first-child {
    color: color-mix(in srgb, var(--color-yellow) 78%, var(--text-normal));
  }

  .day-load-popover-panel--overloaded .day-load-popover-panel__summary:first-child {
    color: color-mix(in srgb, var(--color-orange) 82%, var(--text-normal));
  }

  .reading-list {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 0;
    /* 与 EPUB 目录修复策略一致：列表层不再单独刷底色，直接继承宿主表面，避免出现分层色差。 */
    background: transparent;
    padding: 0;
    min-width: 0;
  }

  .ir-calendar-sidebar.batch-selection-mode .reading-list {
    padding-bottom: 56px;
  }

  .batch-floating-toolbar {
    position: sticky;
    bottom: 0;
    z-index: 5;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin-top: auto;
    padding: 6px 8px;
    border-radius: 12px;
    border: 1px solid color-mix(in srgb, var(--interactive-accent) 28%, var(--background-modifier-border));
    background: color-mix(in srgb, var(--weave-ir-sidebar-elevated-background) 92%, transparent);
    box-shadow:
      0 8px 24px color-mix(in srgb, var(--background-modifier-border) 55%, transparent),
      0 1px 0 color-mix(in srgb, var(--background-modifier-border) 40%, transparent);
    backdrop-filter: blur(10px);
    flex-shrink: 0;
  }

  .batch-floating-toolbar__count {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 28px;
    height: 28px;
    padding: 0 8px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--interactive-accent) 14%, var(--background-modifier-hover));
    color: var(--interactive-accent);
    font-size: 12px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    flex-shrink: 0;
  }

  .batch-floating-toolbar__actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 2px;
    min-width: 0;
    flex: 1;
  }

  .ir-calendar-sidebar button.batch-floating-toolbar__btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    padding: 0;
    border: none;
    box-shadow: none;
    background: transparent;
    border-radius: var(--clickable-icon-radius);
    color: var(--text-muted);
    cursor: pointer;
  }

  .ir-calendar-sidebar button.batch-floating-toolbar__btn:hover {
    color: var(--text-normal);
    background: var(--background-modifier-hover);
  }

  .ir-calendar-sidebar button.batch-floating-toolbar__btn--primary {
    color: var(--interactive-accent);
  }

  .ir-calendar-sidebar button  .batch-floating-toolbar__btn--primary:hover {
    color: var(--interactive-accent);
    background: color-mix(in srgb, var(--interactive-accent) 12%, var(--background-modifier-hover));
  }

  @container (max-width: 340px) {
    .ir-calendar-sidebar {
      padding: 8px;
    }

    .calendar-top-tools {
      padding-inline: 8px;
    }

    .calendar-header {
      gap: 8px;
      margin-bottom: 8px;
    }

    .month-title {
      gap: 6px;
    }

    .month-title__month {
      font-size: 16px;
    }

    .month-title__year {
      font-size: 10px;
    }

    .calendar-tool-btn {
      width: 28px;
      height: 28px;
    }

    .month-nav {
      gap: 4px;
      padding: 0;
    }

    .today-btn {
      height: 28px;
      padding: 0 8px;
      font-size: 10px;
    }

    .calendar-sync-status__label {
      display: none;
    }

    .calendar-sync-status {
      max-width: none;
      padding: 0 4px;
    }

    .calendar-grid-container {
      padding: 0 0 6px;
      margin-bottom: 6px;
    }

    .weekdays,
    .calendar-grid {
      gap: 6px;
    }

    .weekday {
      font-size: 8px;
    }

    .day-number {
      font-size: 11px;
    }

    .day-complete-icon {
      width: 16px;
      height: 16px;
    }

    .day-surface,
    .day-cell.has-tasks.today .day-surface,
    .day-cell.has-tasks.selected .day-surface {
      width: 24px;
      height: 24px;
      top: calc(50% - 1px);
    }

    .heat-dot {
      width: 4px;
      height: 4px;
    }
  }

  @container (max-width: 280px) {
    .ir-calendar-sidebar {
      padding: 6px;
    }

    .calendar-top-tools {
      padding-inline: 6px;
    }

    .calendar-header {
      gap: 4px;
    }

    .month-title {
      gap: 4px;
    }

    .month-title__month {
      font-size: 14px;
    }

    .month-title__year {
      font-size: 10px;
    }

    .calendar-tool-btn {
      width: 26px;
      height: 26px;
    }

    .month-nav {
      gap: 3px;
    }

    .today-btn {
      height: 26px;
      padding: 0 5px;
      font-size: 9px;
    }

    .calendar-grid-container {
      padding: 0 0 4px;
    }

    .day-number {
      font-size: 10px;
    }

    .day-complete-icon {
      width: 14px;
      height: 14px;
    }

    .day-surface,
    .day-cell.has-tasks.today .day-surface,
    .day-cell.has-tasks.selected .day-surface {
      width: 22px;
      height: 22px;
      top: calc(50% - 1px);
    }
  }

  .footer-timer-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 8px 10px;
    margin-top: 8px;
    border-radius: 10px;
    border: 1px solid color-mix(in srgb, var(--interactive-accent) 32%, var(--background-modifier-border));
    background: linear-gradient(
      180deg,
      color-mix(in srgb, var(--interactive-accent) 8%, var(--weave-ir-sidebar-elevated-background)),
      var(--weave-ir-sidebar-surface-background)
    );
  }

  .footer-timer-info {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .footer-timer-kicker {
    font-size: 10px;
    font-weight: 600;
    color: var(--text-faint);
  }

  .footer-timer-title {
    font-size: 12px;
    font-weight: 700;
    color: var(--text-normal);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .footer-timer-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  .footer-timer-value {
    font-size: 12px;
    font-weight: 700;
    color: var(--interactive-accent);
    font-variant-numeric: tabular-nums;
  }

  .footer-timer-pause {
    width: 24px;
    height: 24px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--background-modifier-border);
    border-radius: 7px;
    background: var(--weave-ir-sidebar-elevated-background);
    color: var(--text-muted);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .footer-timer-pause:hover {
    color: var(--text-normal);
    border-color: var(--interactive-accent);
  }

  .loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 24px;
    color: var(--text-muted);
    font-size: 12px;
  }

  .loading-state__message {
    text-align: center;
    line-height: 1.5;
    max-width: min(320px, 100%);
  }

  .loading-state__progress {
    width: min(280px, 100%);
  }

  .loading-state__percent {
    font-size: 11px;
    color: var(--text-faint);
    font-variant-numeric: tabular-nums;
  }

  .loading-state__hint {
    font-size: 11px;
    line-height: 1.45;
    text-align: center;
    color: var(--text-faint);
    max-width: min(320px, 100%);
  }
  
  .ir-calendar-scheduling-menu {
    min-width: 220px;
    z-index: var(--weave-z-menu, 1200);
  }

  :global(.floating-menu.ir-calendar-scheduling-menu) {
    pointer-events: auto;
    min-width: min(240px, calc(100vw - 24px));
    border-radius: var(--radius-m, 10px);
    border: 1px solid var(--background-modifier-border);
    background: var(--background-primary);
    box-shadow: var(--shadow-s);
    overflow: hidden;
  }

  :global(.floating-menu.ir-calendar-scheduling-menu .ir-calendar-scheduling-panel) {
    display: flex;
    flex-direction: column;
    width: 100%;
  }

  :global(.floating-menu.ir-calendar-priority-menu) {
    width: min(360px, calc(100vw - 24px));
    min-width: min(360px, calc(100vw - 24px));
    max-width: calc(100vw - 24px);
    border-radius: 20px;
    border: 1px solid color-mix(in srgb, var(--interactive-accent) 16%, var(--background-modifier-border));
    background: color-mix(in srgb, var(--background-primary) 94%, var(--background-secondary));
    box-shadow:
      0 18px 40px color-mix(in srgb, var(--background-primary) 18%, transparent),
      0 4px 14px rgba(0, 0, 0, 0.08);
    backdrop-filter: blur(10px);
    overflow: hidden;
  }

  :global(.floating-menu.ir-calendar-priority-menu .ir-calendar-priority-panel) {
    display: flex;
    flex-direction: column;
    gap: 0;
    width: 100%;
    background: transparent;
  }

  :global(.floating-menu.ir-calendar-priority-menu .ir-calendar-preview-summary) {
    margin: 0 16px 16px;
    padding: 12px 14px;
    border-radius: 16px;
    border-color: color-mix(in srgb, var(--interactive-accent) 14%, var(--background-modifier-border));
    background: linear-gradient(
      180deg,
      color-mix(in srgb, var(--interactive-accent) 5%, var(--background-secondary)),
      color-mix(in srgb, var(--background-primary) 96%, var(--background-secondary))
    );
    box-shadow: none;
  }

  .ir-calendar-scheduling-grid {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 4px;
  }

  .ir-calendar-scheduling-btn {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    appearance: none;
    -webkit-appearance: none;
    border: none;
    background: transparent;
    border-radius: var(--clickable-icon-radius, 6px);
    min-height: 36px;
    width: 100%;
    padding: 6px 10px;
    cursor: pointer;
    text-align: left;
    box-shadow: none;
    outline: none;
    pointer-events: auto;
    transition: background-color 0.15s ease, color 0.15s ease;
  }

  .ir-calendar-scheduling-btn:hover,
  .ir-calendar-scheduling-btn.is-focused {
    background: var(--background-modifier-hover);
    transform: none;
    box-shadow: none;
  }

  .ir-calendar-scheduling-label {
    font-size: var(--font-ui-small, 13px);
    font-weight: 600;
    color: var(--text-normal);
  }

  .ir-calendar-scheduling-date {
    font-size: var(--font-ui-smaller, 11px);
    color: var(--text-muted);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .ir-calendar-scheduling-date.is-loading {
    opacity: 0.45;
  }

  .ir-calendar-scheduling-date.is-unavailable {
    opacity: 0.55;
    font-style: italic;
  }

  .clear-tag-filter-btn {
    border: none;
    background: transparent;
    color: var(--text-muted);
    border-radius: var(--clickable-icon-radius, 8px);
    padding: 6px 10px;
    font-size: 11px;
    cursor: pointer;
  }

  .clear-tag-filter-btn:hover {
    color: var(--text-normal);
    background: var(--background-modifier-hover);
  }

  .search-empty-state {
    gap: 8px;
  }
</style>
