<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { Menu, Platform } from 'obsidian';
  import type AnkiObsidianPlugin from '../../main';
  import ObsidianIcon from '../ui/ObsidianIcon.svelte';
  import {
    IRAnalyticsService,
    type IRAnalyticsMode,
    type IRAnalyticsSnapshot,
    type IRAnalyticsTimingBucketKey
  } from '../../services/incremental-reading/IRAnalyticsService';
  import { createManagedChartRuntime } from '../../utils/chart-runtime';
  import type { EChartsOption } from '../../utils/echarts-loader';
  import { logger } from '../../utils/logger';
  import { tr } from '../../utils/i18n';

  interface Props {
    plugin: AnkiObsidianPlugin;
  }

  type AnalyticsTab = 'activity' | 'quantity' | 'timing' | 'difficulty' | 'forecast';
  type ChartTab = Exclude<AnalyticsTab, 'activity'>;
  type ChartPayload = {
    snapshot: IRAnalyticsSnapshot;
    activeTab: ChartTab;
  };

  const isMobile = Platform.isMobile;
  const WHEEL_THROTTLE_MS = 180;

  let { plugin }: Props = $props();
  let t = $derived($tr);
  let quickRangeOptions = $derived([
    { value: 7, label: t('irAnalytics.range.last7') },
    { value: 14, label: t('irAnalytics.range.last14') },
    { value: 30, label: t('irAnalytics.range.last30') },
    { value: 60, label: t('irAnalytics.range.last60') },
    { value: 90, label: t('irAnalytics.range.last90') }
  ]);
  let activeTab = $state<AnalyticsTab>('activity');
  let selectedDays = $state(30);
  let selectedMode = $state<IRAnalyticsMode>('overall');
  let selectedSelectionKey = $state('');
  let chartRef = $state<HTMLDivElement | null>(null);
  let analyticsService = $state<IRAnalyticsService | null>(null);
  let snapshot = $state<IRAnalyticsSnapshot | null>(null);
  let isLoading = $state(false);
  let loadError = $state('');
  let loadRequestId = 0;
  let wheelThrottle = false;

  async function getAnalyticsService(): Promise<IRAnalyticsService> {
    if (!analyticsService) {
      analyticsService = new IRAnalyticsService(plugin.app);
      await analyticsService.initialize();
    }
    return analyticsService;
  }

  async function loadAnalytics(): Promise<void> {
    const requestId = ++loadRequestId;
    isLoading = true;
    loadError = '';

    try {
      const service = await getAnalyticsService();
      let nextSnapshot = await service.getSnapshot({
        mode: selectedMode,
        selectionKey: selectedSelectionKey || undefined,
        days: selectedDays
      });

      if (selectedSelectionKey && !nextSnapshot.scopeKey) {
        selectedSelectionKey = '';
        nextSnapshot = await service.getSnapshot({
          mode: selectedMode,
          days: selectedDays
        });
      }

      if (requestId !== loadRequestId) return;
      snapshot = nextSnapshot;
    } catch (error) {
      if (requestId !== loadRequestId) return;
      logger.error('[IRAnalyticsModal] 加载分析数据失败:', error);
      loadError = t('irAnalytics.loadFailed');
      snapshot = null;
    } finally {
      if (requestId !== loadRequestId) return;
      isLoading = false;
    }
  }

  function getTimingBucketColor(
    key: IRAnalyticsTimingBucketKey,
    theme: {
      loadStatusColors: { low: string; normal: string; high: string; overload: string };
      seriesPalette: string[];
    }
  ): string {
    switch (key) {
      case 'overdue_7_plus':
      case 'overdue_2_7':
        return theme.loadStatusColors.overload;
      case 'overdue_lt_2':
      case 'due_today':
        return theme.loadStatusColors.high;
      case 'unscheduled':
        return theme.seriesPalette[4] || theme.loadStatusColors.low;
      default:
        return theme.seriesPalette[0] || theme.loadStatusColors.normal;
    }
  }

  function buildQuantityOption(data: IRAnalyticsSnapshot, theme: any): EChartsOption {
    return {
      color: [theme.seriesPalette[0], theme.seriesPalette[1], theme.seriesPalette[4]],
      tooltip: {
        trigger: 'axis',
        backgroundColor: theme.tooltipBg,
        borderColor: theme.tooltipBorder,
        borderWidth: 1,
        textStyle: { color: theme.textColor },
        confine: true
      },
      legend: {
        top: 6,
        left: 'center',
        textStyle: { color: theme.subTextColor }
      },
      grid: { left: isMobile ? 34 : 44, right: isMobile ? 12 : 20, top: 62, bottom: 28 },
      xAxis: {
        type: 'category',
        data: data.quantityTrend.map((point) => point.label),
        axisLine: { lineStyle: { color: theme.axisLineColor } },
        axisLabel: { color: theme.subTextColor }
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: theme.subTextColor },
        splitLine: { lineStyle: { color: theme.splitLineColor, type: 'dashed' } }
      },
      series: [
        { name: t('irAnalytics.charts.totalMaterials'), type: 'line', smooth: true, data: data.quantityTrend.map((point) => point.totalCount) },
        { name: t('irAnalytics.charts.activeMaterials'), type: 'line', smooth: true, areaStyle: { opacity: 0.12 }, data: data.quantityTrend.map((point) => point.activeCount) },
        { name: t('irAnalytics.charts.closedMaterials'), type: 'line', smooth: true, data: data.quantityTrend.map((point) => point.closedCount) }
      ]
    };
  }

  function buildTimingOption(data: IRAnalyticsSnapshot, theme: any): EChartsOption {
    return {
      color: data.timingBuckets.map((bucket) => getTimingBucketColor(bucket.key, theme)),
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: theme.tooltipBg,
        borderColor: theme.tooltipBorder,
        borderWidth: 1,
        textStyle: { color: theme.textColor },
        confine: true
      },
      grid: { left: isMobile ? 42 : 48, right: isMobile ? 10 : 20, top: 24, bottom: 76 },
      xAxis: {
        type: 'category',
        data: data.timingBuckets.map((bucket) => bucket.label),
        axisLabel: { color: theme.subTextColor, interval: 0, rotate: isMobile ? 32 : 20 },
        axisLine: { lineStyle: { color: theme.axisLineColor } }
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: theme.subTextColor },
        splitLine: { lineStyle: { color: theme.splitLineColor, type: 'dashed' } }
      },
      series: [
        {
          type: 'bar',
          barMaxWidth: 34,
          data: data.timingBuckets.map((bucket) => ({
            value: bucket.count,
            itemStyle: {
              color: getTimingBucketColor(bucket.key, theme),
              borderRadius: [6, 6, 0, 0]
            }
          }))
        }
      ]
    };
  }

  function buildDifficultyOption(data: IRAnalyticsSnapshot, theme: any): EChartsOption {
    return {
      color: [theme.seriesPalette[4]],
      tooltip: {
        trigger: 'item',
        backgroundColor: theme.tooltipBg,
        borderColor: theme.tooltipBorder,
        borderWidth: 1,
        textStyle: { color: theme.textColor },
        confine: true,
        formatter(params: any) {
          const point = params.data as [number, number, number, string, number, number, number, number, number, number, number];
          return [
            `<strong>${point[3]}</strong>`,
            t('irAnalytics.charts.tooltip.effectivePriority', { value: point[0] }),
            t('irAnalytics.charts.tooltip.schedulingUrgency', { value: point[1] }),
            t('irAnalytics.charts.tooltip.counts', { active: point[4], due: point[5], overdue: point[6] }),
            t('irAnalytics.charts.tooltip.readingHours', { hours: point[7] }),
            t('irAnalytics.charts.tooltip.outcomes', { cards: point[8], extracts: point[9], notes: point[10] })
          ].join('<br>');
        }
      },
      grid: { left: isMobile ? 40 : 52, right: isMobile ? 10 : 20, top: 24, bottom: 44 },
      xAxis: {
        type: 'value',
        name: t('irAnalytics.charts.effectivePriority'),
        min: 0,
        max: 10,
        nameTextStyle: { color: theme.subTextColor },
        axisLabel: { color: theme.subTextColor },
        splitLine: { lineStyle: { color: theme.splitLineColor, type: 'dashed' } }
      },
      yAxis: {
        type: 'value',
        name: t('irAnalytics.charts.schedulingUrgency'),
        min: 0,
        max: 10,
        nameTextStyle: { color: theme.subTextColor },
        axisLabel: { color: theme.subTextColor },
        splitLine: { lineStyle: { color: theme.splitLineColor, type: 'dashed' } }
      },
      series: [
        {
          type: 'scatter',
          symbolSize(value: number[]) {
            return value[2];
          },
          markLine: {
            silent: true,
            symbol: 'none',
            label: { show: false },
            lineStyle: { color: theme.axisLineColor, type: 'dashed' },
            data: [{ xAxis: 5 }, { yAxis: 5 }]
          },
          label: {
            show: !isMobile,
            position: 'top',
            color: theme.subTextColor,
            fontSize: 11,
            formatter(params: any) {
              const value = params.data as number[];
              return Number(value?.[0] ?? 0) >= 5 && Number(value?.[1] ?? 0) >= 5 ? value[3] : '';
            }
          },
          labelLayout: { hideOverlap: true, moveOverlap: 'shiftY' },
          emphasis: {
            focus: 'self',
            scale: true,
            label: { show: true, formatter: (params: any) => (params.data as number[])[3] }
          },
          itemStyle: { opacity: 0.82 },
          data: data.difficultyScatter.map((point) => [
            point.x,
            point.y,
            point.size,
            point.label,
            point.itemCount,
            point.dueCount,
            point.overdueCount,
            point.readingHours,
            point.cardsCreated,
            point.extracts,
            point.notesWritten
          ])
        }
      ]
    };
  }

  function buildForecastOption(data: IRAnalyticsSnapshot, theme: any): EChartsOption {
    return {
      color: [theme.seriesPalette[0], theme.seriesPalette[2]],
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: theme.tooltipBg,
        borderColor: theme.tooltipBorder,
        borderWidth: 1,
        textStyle: { color: theme.textColor },
        confine: true
      },
      legend: { top: 6, left: 'center', textStyle: { color: theme.subTextColor } },
      grid: { left: isMobile ? 38 : 48, right: isMobile ? 34 : 52, top: 62, bottom: 30 },
      xAxis: {
        type: 'category',
        data: data.forecast.map((point) => point.label),
        axisLabel: { color: theme.subTextColor },
        axisLine: { lineStyle: { color: theme.axisLineColor } }
      },
      yAxis: [
        {
          type: 'value',
          name: t('irAnalytics.charts.itemCount'),
          nameTextStyle: { color: theme.subTextColor },
          axisLabel: { color: theme.subTextColor },
          splitLine: { lineStyle: { color: theme.splitLineColor, type: 'dashed' } }
        },
        {
          type: 'value',
          name: t('irAnalytics.charts.minutes'),
          nameTextStyle: { color: theme.subTextColor },
          axisLabel: { color: theme.subTextColor }
        }
      ],
      series: [
        {
          name: t('irAnalytics.charts.plannedItems'),
          type: 'bar',
          barMaxWidth: 34,
          data: data.forecast.map((point) => ({
            value: point.itemCount,
            itemStyle: {
              color:
                point.overloadLevel === 'overloaded'
                  ? theme.loadStatusColors.overload
                  : point.overloadLevel === 'warning'
                    ? theme.loadStatusColors.high
                    : theme.seriesPalette[0],
              borderRadius: [6, 6, 0, 0]
            }
          }))
        },
        {
          name: t('irAnalytics.charts.estimatedMinutes'),
          type: 'line',
          yAxisIndex: 1,
          smooth: true,
          data: data.forecast.map((point) => point.totalEstimatedMinutes)
        }
      ]
    };
  }

  const chartRuntime = createManagedChartRuntime<ChartPayload>({
    buildOption(payload, theme): EChartsOption {
      if (payload.activeTab === 'quantity') return buildQuantityOption(payload.snapshot, theme);
      if (payload.activeTab === 'timing') return buildTimingOption(payload.snapshot, theme);
      if (payload.activeTab === 'difficulty') return buildDifficultyOption(payload.snapshot, theme);
      return buildForecastOption(payload.snapshot, theme);
    },
    rangeInteraction: {
      onWheelStep: (step) => adjustQuickRange(step),
      onPinchStep: (step) => adjustQuickRange(step),
      cooldownMs: WHEEL_THROTTLE_MS,
      enabled: () => activeTab !== 'activity'
    }
  });

  function switchTab(tab: AnalyticsTab): void {
    activeTab = tab;
  }

  function adjustQuickRange(step: number): void {
    if (wheelThrottle || activeTab === 'activity') return;
    const currentIndex = quickRangeOptions.findIndex((option) => option.value === selectedDays);
    if (currentIndex < 0) return;
    const nextIndex = Math.max(0, Math.min(quickRangeOptions.length - 1, currentIndex + step));
    if (nextIndex === currentIndex) return;
    wheelThrottle = true;
    selectedDays = quickRangeOptions[nextIndex].value;
    void loadAnalytics();
    window.setTimeout(() => {
      wheelThrottle = false;
    }, WHEEL_THROTTLE_MS);
  }

  function getModeText(mode: IRAnalyticsMode): string {
    if (mode === 'topic') return t('irAnalytics.modes.topic');
    if (mode === 'tag') return t('irAnalytics.modes.tag');
    return t('irAnalytics.modes.overall');
  }

  function getCurrentModeLabel(): string {
    const modeText = getModeText(selectedMode);
    return isMobile ? modeText : t('irAnalytics.modes.modePrefix', { mode: modeText });
  }

  function getCurrentSelectionLabel(): string {
    if (selectedMode === 'overall') {
      return isMobile ? t('irAnalytics.modes.all') : t('irAnalytics.modes.overallNoFilter');
    }
    if (!snapshot?.sources.length) {
      return selectedMode === 'topic'
        ? (isMobile ? t('irAnalytics.modes.noTopicsShort') : t('irAnalytics.modes.noTopics'))
        : (isMobile ? t('irAnalytics.modes.noTagsShort') : t('irAnalytics.modes.noTags'));
    }
    if (!selectedSelectionKey) {
      return isMobile
        ? (selectedMode === 'topic' ? t('irAnalytics.modes.pickTopicShort') : t('irAnalytics.modes.pickTagShort'))
        : (selectedMode === 'topic' ? t('irAnalytics.modes.pickTopic') : t('irAnalytics.modes.pickTag'));
    }
    const option = snapshot.sources.find((item) => item.key === selectedSelectionKey);
    if (!option) {
      return isMobile
        ? (selectedMode === 'topic' ? t('irAnalytics.modes.pickTopicShort') : t('irAnalytics.modes.pickTagShort'))
        : (selectedMode === 'topic' ? t('irAnalytics.modes.pickTopic') : t('irAnalytics.modes.pickTag'));
    }
    if (isMobile) return selectedMode === 'topic' ? option.label : `#${option.label}`;
    return selectedMode === 'topic'
      ? t('irAnalytics.modes.topicPrefix', { label: option.label })
      : t('irAnalytics.modes.tagPrefix', { label: option.label });
  }

  function getCurrentRangeLabel(): string {
    if (isMobile) return t('irAnalytics.range.daysShort', { days: selectedDays });
    return quickRangeOptions.find((option) => option.value === selectedDays)?.label ?? t('irAnalytics.range.daysLabel', { days: selectedDays });
  }

  function showModeMenu(event: MouseEvent): void {
    const menu = new Menu();
    (['overall', 'topic', 'tag'] as IRAnalyticsMode[]).forEach((mode) => {
      menu.addItem((item) => {
        item
          .setTitle(getModeText(mode))
          .setIcon(mode === 'overall' ? 'globe' : mode === 'topic' ? 'layers' : 'tags')
          .setChecked(selectedMode === mode)
          .onClick(() => {
            if (selectedMode === mode) return;
            selectedMode = mode;
            selectedSelectionKey = '';
            void loadAnalytics();
          });
      });
    });
    menu.showAtMouseEvent(event);
  }

  function showSelectionMenu(event: MouseEvent): void {
    if (selectedMode === 'overall') return;
    const menu = new Menu();
    const options = snapshot?.sources || [];
    if (!options.length) {
      menu.addItem((item) => item.setTitle(selectedMode === 'topic' ? t('irAnalytics.modes.noTopics') : t('irAnalytics.modes.noTags')).setIcon('inbox'));
      menu.showAtMouseEvent(event);
      return;
    }
    menu.addItem((item) => {
      item
        .setTitle(selectedMode === 'topic' ? t('irAnalytics.menu.clearTopic') : t('irAnalytics.menu.clearTag'))
        .setIcon('rotate-ccw')
        .setChecked(!selectedSelectionKey)
        .onClick(() => {
          selectedSelectionKey = '';
          void loadAnalytics();
        });
    });
    menu.addSeparator();
    options.forEach((option) => {
      menu.addItem((item) => {
        item
          .setTitle(t('irAnalytics.menu.sourceItem', { label: option.label, active: option.activeCount, due: option.dueCount }))
          .setIcon(selectedMode === 'topic' ? 'layers' : 'tag')
          .setChecked(selectedSelectionKey === option.key)
          .onClick(() => {
            selectedSelectionKey = option.key;
            void loadAnalytics();
          });
      });
    });
    menu.showAtMouseEvent(event);
  }

  function showRangeMenu(event: MouseEvent): void {
    const menu = new Menu();
    quickRangeOptions.forEach((option) => {
      menu.addItem((item) => {
        item
          .setTitle(option.label)
          .setIcon('calendar')
          .setChecked(selectedDays === option.value)
          .onClick(() => {
            if (selectedDays === option.value) return;
            selectedDays = option.value;
            void loadAnalytics();
          });
      });
    });
    menu.showAtMouseEvent(event);
  }

  function getSelectionHintText(): string {
    if (selectedMode === 'overall') return t('irAnalytics.hints.overallStats');
    if (!snapshot?.sources.length) {
      return selectedMode === 'topic' ? t('irAnalytics.hints.noTopicsAvailable') : t('irAnalytics.hints.noTagsAvailable');
    }
    if (!selectedSelectionKey) {
      return selectedMode === 'topic' ? t('irAnalytics.hints.pickTopicFirst') : t('irAnalytics.hints.pickTagFirst');
    }
    const option = snapshot.sources.find((item) => item.key === selectedSelectionKey);
    if (!option) return t('irAnalytics.hints.selectionInvalid');
    return t('irAnalytics.hints.selectionSummary', {
      subtitle: option.subtitle,
      items: option.itemCount,
      active: option.activeCount,
      due: option.dueCount
    });
  }

  function formatMetric(value: number): string {
    if (!Number.isFinite(value)) return '0';
    return Number.isInteger(value) ? String(value) : value.toFixed(1);
  }

  function formatMonitoringText(): string {
    if (!snapshot?.monitoringSummary) return '';
    const summary = snapshot.monitoringSummary;
    return t('irAnalytics.monitoring', {
      scheduled: summary.dailyScheduled,
      completed: summary.dailyCompleted,
      minutes: summary.dailyReadingMinutes,
      rate: summary.linkedOutcomeRate
    });
  }

  function getOutcomeTooltip(kind: 'extracts' | 'cards' | 'notes'): string {
    if (!snapshot) return '';
    if (kind === 'extracts') {
      return t('irAnalytics.outcomes.extractsTooltip', { total: snapshot.overview.extracts, action: snapshot.overview.actionExtracts });
    }
    if (kind === 'cards') {
      return t('irAnalytics.outcomes.cardsTooltip', { total: snapshot.overview.cardsCreated, action: snapshot.overview.actionCardsCreated });
    }
    return t('irAnalytics.outcomes.notesTooltip', { total: snapshot.overview.notesWritten, action: snapshot.overview.actionNotesWritten });
  }

  function getOutcomeActionText(kind: 'extracts' | 'cards' | 'notes'): string {
    if (!snapshot) return '';
    if (kind === 'extracts') return t('irAnalytics.outcomes.actionPeriod', { count: snapshot.overview.actionExtracts });
    if (kind === 'cards') return t('irAnalytics.outcomes.actionPeriod', { count: snapshot.overview.actionCardsCreated });
    return t('irAnalytics.outcomes.actionPeriod', { count: snapshot.overview.actionNotesWritten });
  }

  function hasSelectionRequirementGap(): boolean {
    return selectedMode !== 'overall' && !selectedSelectionKey;
  }

  function getEmptyStateMessage(): string {
    if (selectedMode !== 'overall' && !snapshot?.sources.length) {
      return selectedMode === 'topic' ? t('irAnalytics.empty.noTopicData') : t('irAnalytics.empty.noTagData');
    }
    if (hasSelectionRequirementGap()) {
      return selectedMode === 'topic' ? t('irAnalytics.empty.pickTopic') : t('irAnalytics.empty.pickTag');
    }
    return t('irAnalytics.empty.noData');
  }

  function getEmptyStateDescription(): string {
    if (selectedMode !== 'overall' && !snapshot?.sources.length) {
      return selectedMode === 'topic' ? t('irAnalytics.empty.noTopicDataDesc') : t('irAnalytics.empty.noTagDataDesc');
    }
    if (hasSelectionRequirementGap()) {
      return selectedMode === 'topic' ? t('irAnalytics.empty.pickTopicDesc') : t('irAnalytics.empty.pickTagDesc');
    }
    return t('irAnalytics.empty.tryOtherFilters');
  }

  $effect(() => {
    chartRuntime.setContainer(chartRef);
  });

  $effect(() => {
    if (!snapshot || activeTab === 'activity') return;
    chartRuntime.render({ snapshot, activeTab });
  });

  onMount(() => {
    void loadAnalytics();
    const handleDataUpdated = () => void loadAnalytics();
    window.addEventListener('Weave:ir-data-updated', handleDataUpdated);
    return () => {
      window.removeEventListener('Weave:ir-data-updated', handleDataUpdated);
    };
  });

  onDestroy(() => {
    chartRuntime.dispose();
  });
</script>

<div class="ir-analytics-modal">
  <div class="tabs-header weave-toolbar-tabs">
    <button type="button" class="clickable-icon tab-btn weave-toolbar-tab" class:active={activeTab === 'activity'} onclick={() => switchTab('activity')}>{t('irAnalytics.tabs.activity')}</button>
    <button type="button" class="clickable-icon tab-btn weave-toolbar-tab" class:active={activeTab === 'quantity'} onclick={() => switchTab('quantity')}>{t('irAnalytics.tabs.quantity')}</button>
    <button type="button" class="clickable-icon tab-btn weave-toolbar-tab" class:active={activeTab === 'timing'} onclick={() => switchTab('timing')}>{t('irAnalytics.tabs.timing')}</button>
    <button type="button" class="clickable-icon tab-btn weave-toolbar-tab" class:active={activeTab === 'difficulty'} onclick={() => switchTab('difficulty')}>{t('irAnalytics.tabs.difficulty')}</button>
    <button type="button" class="clickable-icon tab-btn weave-toolbar-tab" class:active={activeTab === 'forecast'} onclick={() => switchTab('forecast')}>{t('irAnalytics.tabs.forecast')}</button>
  </div>

  <div class="toolbar">
    <div class="toolbar-row">
      <label class="control-wrap">
        {#if !isMobile}
          <span class="toolbar-label">{t('irAnalytics.toolbar.mode')}</span>
        {/if}
        <button type="button" class="clickable-icon menu-trigger" onclick={(event) => showModeMenu(event)}>
          <span class="menu-text">{getCurrentModeLabel()}</span>
          <ObsidianIcon name="chevron-down" size={14} />
        </button>
      </label>
      <label class="control-wrap control-wrap--selection">
        {#if !isMobile}
          <span class="toolbar-label">{t('irAnalytics.toolbar.selection')}</span>
        {/if}
        <button type="button" class="clickable-icon menu-trigger" onclick={(event) => showSelectionMenu(event)} disabled={selectedMode === 'overall'}>
          <span class="menu-text">{getCurrentSelectionLabel()}</span>
          <ObsidianIcon name="chevron-down" size={14} />
        </button>
      </label>
      <label class="control-wrap control-wrap--range">
        {#if !isMobile}
          <span class="toolbar-label">{t('irAnalytics.toolbar.timeRange')}</span>
        {/if}
        <button type="button" class="clickable-icon menu-trigger" onclick={(event) => showRangeMenu(event)}>
          <span class="menu-text">{getCurrentRangeLabel()}</span>
          <ObsidianIcon name="chevron-down" size={14} />
        </button>
      </label>
    </div>

    <div class="scope-hint">{getSelectionHintText()}</div>
    {#if activeTab === 'activity' && snapshot?.monitoringSummary}
      <div class="monitoring-note">{formatMonitoringText()}</div>
    {/if}
  </div>

  <div class="analytics-body mod-vertical-scroll">
    {#if isLoading}
      <div class="state-panel state-panel--loading">
        <ObsidianIcon name="loader" size={18} />
        <span>{t('irAnalytics.loading')}</span>
      </div>
    {:else if loadError}
      <div class="state-panel state-panel--error">{loadError}</div>
    {:else if snapshot}
      {#if activeTab === 'activity'}
        <div class="activity-overview-panel">
          <div class="scope-caption">
            <span class="scope-title">{snapshot.scopeLabel}</span>
            <span class="scope-subtitle">
              {#if snapshot.scopeKey}
                {t('irAnalytics.scope.summary', { total: snapshot.overview.totalItems, active: snapshot.overview.activeItems })}
              {:else if selectedMode !== 'overall'}
                {getEmptyStateMessage()}
              {:else}
                {t('irAnalytics.scope.allPoints')}
              {/if}
            </span>
          </div>

          <div class="overview-grid">
            <div class="overview-card"><div class="overview-label">{t('irAnalytics.overview.totalItems')}</div><div class="overview-value">{snapshot.overview.totalItems}</div></div>
            <div class="overview-card"><div class="overview-label">{t('irAnalytics.overview.activeItems')}</div><div class="overview-value">{snapshot.overview.activeItems}</div></div>
            <div class="overview-card"><div class="overview-label">{t('irAnalytics.overview.dueToday')}</div><div class="overview-value">{snapshot.overview.dueToday}</div></div>
            <div class="overview-card"><div class="overview-label">{t('irAnalytics.overview.overdueItems')}</div><div class="overview-value">{snapshot.overview.overdueItems}</div></div>
            <div class="overview-card"><div class="overview-label">{t('irAnalytics.overview.readingHours')}</div><div class="overview-value">{formatMetric(snapshot.overview.totalReadingHours)}</div></div>
            <div class="overview-card"><div class="overview-label">{t('irAnalytics.overview.avgPriority')}</div><div class="overview-value">P{formatMetric(snapshot.overview.avgPriority)}</div></div>
            <div class="overview-card" title={getOutcomeTooltip('extracts')}><div class="overview-label">{t('irAnalytics.overview.extracts')}</div><div class="overview-value">{snapshot.overview.extracts}</div><div class="overview-meta">{getOutcomeActionText('extracts')}</div></div>
            <div class="overview-card" title={getOutcomeTooltip('cards')}><div class="overview-label">{t('irAnalytics.overview.cards')}</div><div class="overview-value">{snapshot.overview.cardsCreated}</div><div class="overview-meta">{getOutcomeActionText('cards')}</div></div>
            <div class="overview-card" title={getOutcomeTooltip('notes')}><div class="overview-label">{t('irAnalytics.overview.notes')}</div><div class="overview-value">{snapshot.overview.notesWritten}</div><div class="overview-meta">{getOutcomeActionText('notes')}</div></div>
          </div>
        </div>
      {:else}
        <div class="chart-stage">
          {#if hasSelectionRequirementGap() || (selectedMode !== 'overall' && !snapshot.sources.length) || (activeTab === 'quantity' && snapshot.quantityTrend.every((point) => point.totalCount === 0 && point.activeCount === 0 && point.closedCount === 0)) || (activeTab === 'timing' && snapshot.timingBuckets.every((point) => point.count === 0)) || (activeTab === 'difficulty' && snapshot.difficultyScatter.length === 0) || (activeTab === 'forecast' && snapshot.forecast.every((point) => point.itemCount === 0 && point.totalEstimatedMinutes === 0))}
            <div class="state-panel state-panel--empty">
              <div class="state-title">{getEmptyStateMessage()}</div>
              <div class="state-description">{getEmptyStateDescription()}</div>
            </div>
          {:else}
            <div class="chart-container" bind:this={chartRef}></div>
          {/if}
        </div>
      {/if}
    {/if}
  </div>
</div>

<style>
  .ir-analytics-modal {
    display: flex;
    flex-direction: column;
    gap: 12px;
    height: 100%;
    min-height: 0;
    padding: 18px;
    background: var(--background-primary);
  }

  .tabs-header {
    width: 100%;
  }

  .tab-btn {
    min-width: 0;
    font-weight: 500;
  }

  .toolbar {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 14px 16px;
    border-radius: 12px;
    border: 1px solid var(--background-modifier-border);
    background: var(--background-secondary);
  }

  .toolbar-row {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }

  .control-wrap {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 200px;
  }

  .control-wrap--selection {
    flex: 1 1 260px;
  }

  .control-wrap--range {
    margin-left: auto;
  }

  .toolbar-label {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-muted);
    white-space: nowrap;
  }

  .menu-trigger {
    display: inline-flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    min-width: 150px;
    min-height: 40px;
    padding: 0 10px;
    border-radius: var(--clickable-icon-radius, 9px);
    border: none;
    box-shadow: none;
    background: transparent;
    color: var(--text-muted);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: background-color 0.15s ease, color 0.15s ease;
  }

  .menu-trigger:hover:not(:disabled) {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }

  .menu-trigger:disabled {
    opacity: 0.72;
    cursor: not-allowed;
  }

  .menu-text {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .scope-hint,
  .monitoring-note {
    padding: 8px 10px;
    border-radius: 10px;
    font-size: 12px;
    line-height: 1.5;
    color: var(--text-muted);
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
  }

  .analytics-body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding-right: 2px;
  }

  .activity-overview-panel {
    flex: 1 0 auto;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .scope-caption {
    padding: 12px 14px;
    border-radius: 11px;
    border: 1px solid var(--background-modifier-border);
    background: var(--background-secondary);
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .scope-title {
    font-size: 15px;
    font-weight: 700;
    color: var(--text-normal);
  }

  .scope-subtitle {
    font-size: 12px;
    color: var(--text-muted);
  }

  .overview-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: 10px;
  }

  .overview-card {
    padding: 12px;
    border-radius: 10px;
    border: 1px solid var(--background-modifier-border);
    background: var(--background-secondary);
  }

  .overview-label {
    font-size: 12px;
    color: var(--text-muted);
  }

  .overview-value {
    margin-top: 6px;
    font-size: 24px;
    font-weight: 700;
    color: var(--text-normal);
  }

  .overview-meta {
    margin-top: 6px;
    font-size: 11px;
    color: var(--text-muted);
  }

  .chart-stage {
    flex: 1 0 auto;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  .chart-container {
    flex: 1;
    width: 100%;
    height: 100%;
    min-height: 420px;
    border-radius: 12px;
    background: var(--background-primary);
  }

  .chart-stage > .state-panel {
    flex: 1;
    min-height: 420px;
  }

  .state-panel {
    display: grid;
    place-items: center;
    gap: 8px;
    min-height: 180px;
    padding: 20px;
    border-radius: 12px;
    border: 1px solid var(--background-modifier-border);
    background: var(--background-secondary);
    color: var(--text-muted);
    text-align: center;
  }

  .state-panel--error {
    color: var(--text-error);
  }

  .state-panel--empty {
    border-style: dashed;
  }

  .state-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-normal);
  }

  .state-description {
    font-size: 12px;
    color: var(--text-muted);
  }

  @media (max-width: 720px) {
    .ir-analytics-modal {
      padding: 14px;
      gap: 10px;
    }

    .toolbar {
      padding: 10px 12px;
      gap: 8px;
    }

    .toolbar-row {
      display: flex;
      flex-wrap: nowrap;
      align-items: center;
      gap: 10px;
      overflow: hidden;
      padding-bottom: 0;
    }

    .control-wrap,
    .control-wrap--range {
      flex: 1 1 0;
      width: 0;
      min-width: 0;
      margin-left: 0;
    }

    .control-wrap--selection {
      flex: 1 1 0;
    }

    .toolbar-label {
      display: none;
    }

    .menu-trigger {
      width: 100%;
      min-width: 0;
      min-height: 30px;
      padding: 4px 0;
      border: none;
      border-radius: 0;
      background: transparent;
      box-shadow: none;
      font-size: 13px;
      font-weight: 600;
      gap: 0;
      justify-content: center;
      color: var(--text-muted);
    }

    .menu-trigger:hover,
    .menu-trigger:focus-visible {
      color: var(--text-normal);
      background: transparent;
      outline: none;
    }

    .menu-trigger :global(svg) {
      display: none;
    }

    .menu-text {
      display: block;
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      text-align: center;
    }

    .menu-trigger:disabled {
      opacity: 0.55;
    }

    .scope-hint,
    .monitoring-note {
      padding: 7px 9px;
      font-size: 11px;
    }

    .analytics-body {
      padding-right: 0;
    }

    .chart-container,
    .chart-stage > .state-panel {
      min-height: 320px;
    }
  }
</style>
