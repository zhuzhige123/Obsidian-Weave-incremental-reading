<!--
  增量阅读设置组件
  职责：处理增量阅读专题的配置（调度、拆分、交错学习、导入设置）
  
  已移除弃用的聚焦阅读模式相关设置
-->
<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { logger } from '../../../utils/logger';
  import { tr } from '../../../utils/i18n';
  import type {
    IncrementalReadingSettings,
    IncrementalReadingFolderSubscriptionInitialScheduleMode,
    IncrementalReadingFolderSubscriptionRule
  } from '../../../types/plugin-settings.d';
  import type { IncrementalReadingSettingsHost } from '../types/incremental-reading-settings-host';
  import TabNavigation from '../../ui/TabNavigation.svelte';
  import { IRStorageService } from '../../../services/incremental-reading/IRStorageService';
  import { IRSettingsEditor } from '../../../services/incremental-reading/IRSettingsEditor';
  import {
    normalizeIncrementalReadingFolderSubscriptionPath,
  } from '../../../services/incremental-reading/folder-subscription-settings';
  import IRAdvancedSchedulingSettingsSection from './IRAdvancedSchedulingSettingsSection.svelte';
  import IRAutoSubscribeSettingsSection from './IRAutoSubscribeSettingsSection.svelte';
  import IRCoreSchedulingSettingsSection from './IRCoreSchedulingSettingsSection.svelte';
  import IRInterleaveSettingsSection from './IRInterleaveSettingsSection.svelte';
  import IRReadingTargetSettingsSection from './IRReadingTargetSettingsSection.svelte';
  import IRStrategySettingsSection from './IRStrategySettingsSection.svelte';
  import SettingsHelpModal from '../components/SettingsHelpModal.svelte';
  import { PremiumFeatureGuard, PREMIUM_FEATURES } from '../../../services/premium/PremiumFeatureGuard';
  import { Notice } from 'obsidian';
  import {
    DEFAULT_MARKDOWN_TAGS_YAML_KEY,
    normalizeIRTagSourcePolicy,
  } from '../../../services/incremental-reading/ir-tag-source-policy';
  import type { IRPremiumFeatureId } from '../../../services/premium/ir-premium-features';
  import { ensureIRPremiumFeature } from '../../../services/premium/ir-premium';

  let t = $derived($tr);

  // importFolder 仅保留给旧导入/复制链路兼容使用，不再控制新正文 Markdown 默认目录。

  let AUTO_SUBSCRIBE_INITIAL_SCHEDULE_MODE_OPTIONS = $derived([
    {
      id: 'today',
      label: t('irSettings.autoSubscribeInitialScheduleTodayLabel'),
      desc: t('irSettings.autoSubscribeInitialScheduleTodayDesc')
    },
    {
      id: 'scheduled',
      label: t('irSettings.autoSubscribeInitialScheduleScheduledLabel'),
      desc: t('irSettings.autoSubscribeInitialScheduleScheduledDesc')
    }
  ]);
  
  // v3.0 调度策略选项
  let STRATEGY_OPTIONS = $derived([
    { id: 'processing', label: t('irSettings.strategyProcessingLabel'), desc: t('irSettings.strategyProcessingDesc') },
    { id: 'reading-list', label: t('irSettings.strategyReadingListLabel'), desc: t('irSettings.strategyReadingListDesc') }
  ]);
  
  // v3.0 aging 强度选项
  let AGING_OPTIONS = $derived([
    { id: 'low', label: t('irSettings.agingLowLabel'), desc: t('irSettings.agingLowDesc') },
    { id: 'medium', label: t('irSettings.agingMediumLabel'), desc: t('irSettings.agingMediumDesc') },
    { id: 'high', label: t('irSettings.agingHighLabel'), desc: t('irSettings.agingHighDesc') }
  ]);
  
  // v3.0 自动后推策略选项
  let POSTPONE_OPTIONS = $derived([
    { id: 'off', label: t('irSettings.postponeOffLabel'), desc: t('irSettings.postponeOffDesc') },
    { id: 'gentle', label: t('irSettings.postponeGentleLabel'), desc: t('irSettings.postponeGentleDesc') },
    { id: 'aggressive', label: t('irSettings.postponeAggressiveLabel'), desc: t('irSettings.postponeAggressiveDesc') }
  ]);

  interface Props {
    plugin: IncrementalReadingSettingsHost;
    showTabs?: boolean;
    forcedTab?: IRSettingsTabId;
    autoSubscribeShowTitle?: boolean;
  }

  type IRSettingsTabId = 'core-scheduling' | 'auto-subscribe' | 'advanced';

  let { plugin, showTabs = true, forcedTab, autoSubscribeShowTitle = true }: Props = $props();
  let settings = $state(untrack(() => plugin.settings));
  let activeTab = $state<IRSettingsTabId>('core-scheduling');
  let showInterleaveHelpModal = $state(false);
  let subscriptionDeckOptions = $state<Array<{ id: string; label: string; description: string }>>([]);
  let settingsEditor = $derived.by(() => new IRSettingsEditor({
    plugin,
    getState: () => settings,
    updateState: (nextState) => {
      settings = nextState;
    }
  }));
  let irSettingsTabs = $derived.by(() => {
    const tabs: Array<{ id: IRSettingsTabId; label: string; icon: string }> = [
      { id: 'core-scheduling', label: t('irSettings.scheduleTitle'), icon: '' },
    ];
    if (shouldShowPremiumFeature(PREMIUM_FEATURES.FOLDER_SUBSCRIPTION)) {
      tabs.splice(1, 0, { id: 'auto-subscribe', label: premiumTitle(t('irSettings.autoSubscribeTitle'), PREMIUM_FEATURES.FOLDER_SUBSCRIPTION), icon: '' });
    }
    if (shouldShowPremiumFeature(PREMIUM_FEATURES.TAG_GROUPS)) {
      tabs.push({ id: 'advanced', label: premiumTitle(t('irSettings.advancedTitle'), PREMIUM_FEATURES.TAG_GROUPS), icon: '' });
    }
    return tabs;
  });
  let visibleTab = $derived(forcedTab ?? activeTab);

  $effect(() => {
    if (forcedTab) {
      return;
    }
    const availableTabs = new Set(irSettingsTabs.map((tab) => tab.id));
    if (!availableTabs.has(activeTab)) {
      activeTab = 'core-scheduling';
    }
  });
  
  // 确保 incrementalReading 设置存在
  $effect(() => {
    settingsEditor.ensureIncrementalReadingSettings();
    settingsEditor.applyNormalizedFolderSubscriptionSettings();
  });

  onMount(() => {
    void loadSubscriptionDeckOptions();
  });

  function ensurePremiumFeature(featureId: string): boolean {
    return ensureIRPremiumFeature(plugin.app, featureId);
  }

  function canUsePremiumFeature(featureId: string): boolean {
    return PremiumFeatureGuard.getInstance().canUseFeature(featureId);
  }

  function shouldShowPremiumFeature(featureId: string): boolean {
    return PremiumFeatureGuard.getInstance().shouldShowFeatureEntry(featureId);
  }

  function premiumTitle(baseTitle: string, featureId: IRPremiumFeatureId): string {
    return PremiumFeatureGuard.getInstance().getFeatureEntryTitle(baseTitle, featureId);
  }

  // 保存设置的统一方法
  async function saveSettings(syncFolderSubscription = false) {
    try {
      await settingsEditor.save(syncFolderSubscription);
    } catch (error) {
      logger.error('保存设置失败:', error);
    }
  }

  async function loadSubscriptionDeckOptions() {
    try {
      const storage = new IRStorageService(plugin.app);
      await storage.initialize();
      const decks = Object.values(await storage.getAllDecks())
        .filter((deck) => !deck.archivedAt)
        .sort((left, right) => String(left.name || '').localeCompare(String(right.name || ''), 'zh-CN'));
      subscriptionDeckOptions = decks.map((deck) => ({
        id: String(deck.id || '').trim(),
        label: String(deck.name || '').trim() || String(deck.id || '').trim(),
        description: ''
      }));
    } catch (error) {
      logger.warn('加载增量阅读专题列表失败:', error);
      subscriptionDeckOptions = [];
    }
  }

  function getFolderSubscriptionSettingsSnapshot() {
    return settingsEditor.getFolderSubscriptionSettingsSnapshot();
  }

  function getFolderSubscriptionRules(): IncrementalReadingFolderSubscriptionRule[] {
    return settingsEditor.getFolderSubscriptionRules();
  }

  function updateFolderSubscriptionSettings(
    updater: (current: ReturnType<typeof getFolderSubscriptionSettingsSnapshot>) => ReturnType<typeof getFolderSubscriptionSettingsSnapshot>
  ) {
    settingsEditor.updateFolderSubscriptionSettings(updater);
  }

  function createEmptyFolderSubscriptionRule(): IncrementalReadingFolderSubscriptionRule {
    return settingsEditor.createEmptyFolderSubscriptionRule();
  }

  function getFolderSubscriptionImportConfirmThreshold(): number {
    return settingsEditor.getFolderSubscriptionImportConfirmThreshold();
  }

  function getFolderSubscriptionInitialScheduleMode(): IncrementalReadingFolderSubscriptionInitialScheduleMode {
    return settingsEditor.getFolderSubscriptionInitialScheduleMode();
  }

  function getSubscriptionDeckOptionsForRule(rule: IncrementalReadingFolderSubscriptionRule) {
    const options = [...subscriptionDeckOptions];
    const deckId = String(rule.deckId || '').trim();
    if (deckId && !options.some((option) => option.id === deckId)) {
      options.unshift({
        id: deckId,
        label: deckId,
        description: ''
      });
    }
    return options;
  }

  async function handleAddFolderSubscriptionRule() {
    if (!ensurePremiumFeature(PREMIUM_FEATURES.FOLDER_SUBSCRIPTION)) {
      return;
    }
    updateFolderSubscriptionSettings((current) => ({
      ...current,
      rules: [...(current.rules || []), createEmptyFolderSubscriptionRule()]
    }));
    await saveSettings();
  }

  async function handleFolderSubscriptionEnabledChange(ruleId: string, enabled: boolean) {
    if (!ensurePremiumFeature(PREMIUM_FEATURES.FOLDER_SUBSCRIPTION)) {
      return;
    }
    updateFolderSubscriptionSettings((current) => ({
      ...current,
      rules: (current.rules || []).map((rule) =>
        rule.id === ruleId
          ? { ...rule, enabled }
          : rule
      )
    }));
    await saveSettings(true);
  }

  async function handleFolderSubscriptionDeckChange(ruleId: string, value: string) {
    if (!ensurePremiumFeature(PREMIUM_FEATURES.FOLDER_SUBSCRIPTION)) {
      return;
    }
    const deckId = String(value || '').trim();
    updateFolderSubscriptionSettings((current) => ({
      ...current,
      rules: (current.rules || []).map((rule) =>
        rule.id === ruleId
          ? { ...rule, deckId }
          : rule
      )
    }));
    await saveSettings(true);
  }

  async function handleFolderSubscriptionInitialScheduleModeChange(value: string) {
    if (!ensurePremiumFeature(PREMIUM_FEATURES.FOLDER_SUBSCRIPTION)) {
      return;
    }
    updateFolderSubscriptionSettings((current) => ({
      ...current,
      initialScheduleMode: value === 'scheduled' ? 'scheduled' : 'today'
    }));
    await saveSettings(true);
  }

  function handleFolderSubscriptionImportConfirmThresholdChange(value: number) {
    if (!ensurePremiumFeature(PREMIUM_FEATURES.FOLDER_SUBSCRIPTION)) {
      return;
    }
    const importConfirmThreshold = Math.max(0, Math.min(200, Math.round(value) || 0));
    updateFolderSubscriptionSettings((current) => ({
      ...current,
      importConfirmThreshold
    }));
    saveSettings();
  }

  async function handleFolderSubscriptionFolderPathChange(ruleId: string, folderPath: string) {
    if (!ensurePremiumFeature(PREMIUM_FEATURES.FOLDER_SUBSCRIPTION)) {
      return;
    }
    const normalizedFolderPath = normalizeIncrementalReadingFolderSubscriptionPath(folderPath);
    const currentRule = getFolderSubscriptionRules().find((rule) => rule.id === ruleId);
    if ((currentRule?.folderPath || '') === normalizedFolderPath) {
      return;
    }

    updateFolderSubscriptionSettings((current) => ({
      ...current,
      rules: (current.rules || []).map((rule) =>
        rule.id === ruleId
          ? { ...rule, folderPath: normalizedFolderPath }
          : rule
      )
    }));
    await saveSettings(true);
  }

  async function removeFolderSubscriptionRule(ruleId: string) {
    if (!ensurePremiumFeature(PREMIUM_FEATURES.FOLDER_SUBSCRIPTION)) {
      return;
    }
    updateFolderSubscriptionSettings((current) => ({
      ...current,
      rules: (current.rules || []).filter((rule) => rule.id !== ruleId)
    }));
    await saveSettings(true);
  }

  // 处理默认间隔因子变更
  function handleIntervalFactorChange(value: number) {
    if (!Number.isNaN(value) && value >= 1.0 && value <= 3.0) {
      settingsEditor.updateIncrementalReading((incrementalReading) => {
        incrementalReading.defaultIntervalFactor = value;
      });
      saveSettings();
    }
  }

  // 处理每日新块上限变更
  function handleDailyNewLimitChange(value: number) {
    if (!Number.isNaN(value) && value >= 0 && value <= 50) {
      settingsEditor.updateIncrementalReading((incrementalReading) => {
        incrementalReading.dailyNewLimit = value;
      });
      saveSettings();
    }
  }

  // 处理每日复习上限变更
  function handleDailyReviewLimitChange(value: number) {
    if (!Number.isNaN(value) && value >= 0 && value <= 200) {
      settingsEditor.updateIncrementalReading((incrementalReading) => {
        incrementalReading.dailyReviewLimit = value;
      });
      saveSettings();
    }
  }

  // 处理交错学习模式变更
  function handleInterleaveModeChange(enabled: boolean) {
    if (!ensurePremiumFeature(PREMIUM_FEATURES.INTERLEAVE_LEARNING_SETTINGS)) {
      return;
    }
    settingsEditor.updateIncrementalReading((incrementalReading) => {
      incrementalReading.interleaveMode = enabled;
    });
    saveSettings();
  }

  // 处理最大连续同主题块数变更
  function handleMaxConsecutiveChange(value: number) {
    if (!ensurePremiumFeature(PREMIUM_FEATURES.INTERLEAVE_LEARNING_SETTINGS)) {
      return;
    }
    if (!Number.isNaN(value) && value >= 1 && value <= 10) {
      settingsEditor.updateIncrementalReading((incrementalReading) => {
        incrementalReading.maxConsecutiveSameTopic = value;
      });
      saveSettings();
    }
  }

  // 处理复习阈值变更
  function handleReviewThresholdChange(value: number) {
    if (!Number.isNaN(value) && value >= 3 && value <= 14) {
      settingsEditor.updateIncrementalReading((incrementalReading) => {
        incrementalReading.reviewThreshold = value;
      });
      saveSettings();
    }
  }

  // 处理最大间隔变更
  function handleMaxIntervalChange(value: number) {
    if (!Number.isNaN(value) && value >= 30 && value <= 365) {
      settingsEditor.updateIncrementalReading((incrementalReading) => {
        incrementalReading.maxInterval = value;
      });
      saveSettings();
    }
  }

  // ============================================
  // v3.0 调度策略处理函数
  // ============================================

  function handleStrategyDropdownChange(value: string) {
    if (!ensurePremiumFeature(PREMIUM_FEATURES.SCHEDULING_STRATEGY_SETTINGS)) {
      return;
    }
    settingsEditor.updateIncrementalReading((incrementalReading) => {
      incrementalReading.scheduleStrategy = value as 'processing' | 'reading-list';
    });
    void saveSettings();
  }

  // 处理每日时间预算变更
  function handleTimeBudgetChange(value: number) {
    if (!ensurePremiumFeature(PREMIUM_FEATURES.SCHEDULING_STRATEGY_SETTINGS)) {
      return;
    }
    if (!Number.isNaN(value) && value >= 10 && value <= 120) {
      settingsEditor.updateIncrementalReading((incrementalReading) => {
        incrementalReading.dailyTimeBudgetMinutes = value;
      });
      saveSettings();
    }
  }

  function handleFlowStretchChange(value: number) {
    if (!ensurePremiumFeature(PREMIUM_FEATURES.SCHEDULING_STRATEGY_SETTINGS)) {
      return;
    }
    if (!Number.isNaN(value) && value >= 0 && value <= 40) {
      settingsEditor.updateIncrementalReading((incrementalReading) => {
        incrementalReading.flowStretchPercent = value;
      });
      saveSettings();
    }
  }

  function handleLoadBasedDeferChange(enabled: boolean) {
    if (!ensurePremiumFeature(PREMIUM_FEATURES.SCHEDULING_STRATEGY_SETTINGS)) {
      return;
    }
    settingsEditor.updateIncrementalReading((incrementalReading) => {
      incrementalReading.enableLoadBasedDefer = enabled;
    });
    saveSettings();
  }

  function handleReadingTargetInboxDeckChange(deckId: string) {
    settingsEditor.updateIncrementalReading((incrementalReading) => {
      incrementalReading.readingTargetInboxDeckId = String(deckId || '').trim();
    });
    void saveSettings();
  }

  function handleReadingTargetDefaultNoteBackedChange(enabled: boolean) {
    settingsEditor.updateIncrementalReading((incrementalReading) => {
      incrementalReading.readingTargetDefaultNoteBacked = enabled === true;
    });
    void saveSettings();
  }

  function handleDailyReadingPointCapChange(value: number) {
    if (!ensurePremiumFeature(PREMIUM_FEATURES.SCHEDULING_STRATEGY_SETTINGS)) {
      return;
    }
    if (!Number.isNaN(value) && value >= 5 && value <= 40) {
      settingsEditor.updateIncrementalReading((incrementalReading) => {
        incrementalReading.dailyReadingPointCap = value;
      });
      saveSettings();
    }
  }

  function handleHorizonSmoothingChange(enabled: boolean) {
    if (!ensurePremiumFeature(PREMIUM_FEATURES.SCHEDULING_STRATEGY_SETTINGS)) {
      return;
    }
    settingsEditor.updateIncrementalReading((incrementalReading) => {
      incrementalReading.enableHorizonSmoothing = enabled;
    });
    saveSettings();
  }

  function handleHorizonSpreadDaysChange(value: number) {
    if (!ensurePremiumFeature(PREMIUM_FEATURES.SCHEDULING_STRATEGY_SETTINGS)) {
      return;
    }
    if (!Number.isNaN(value) && value >= 5 && value <= 14) {
      settingsEditor.updateIncrementalReading((incrementalReading) => {
        incrementalReading.horizonSpreadDays = value;
      });
      saveSettings();
    }
  }

  // 处理每日出现上限变更
  function handleMaxAppearancesChange(value: number) {
    if (!ensurePremiumFeature(PREMIUM_FEATURES.SCHEDULING_STRATEGY_SETTINGS)) {
      return;
    }
    if (!Number.isNaN(value) && value >= 1 && value <= 5) {
      settingsEditor.updateIncrementalReading((incrementalReading) => {
        incrementalReading.maxAppearancesPerDay = value;
      });
      saveSettings();
    }
  }

  // 处理 TagGroup 先验开关
  function handleTagGroupPriorChange(enabled: boolean) {
    if (!ensurePremiumFeature(PREMIUM_FEATURES.TAG_GROUPS)) {
      return;
    }
    settingsEditor.updateIncrementalReading((incrementalReading) => {
      incrementalReading.enableTagGroupPrior = enabled;
    });
    saveSettings();
  }

  function handleTagGroupFollowModeChange(value: string) {
    if (!ensurePremiumFeature(PREMIUM_FEATURES.TAG_GROUPS)) {
      return;
    }
    settingsEditor.updateIncrementalReading((incrementalReading) => {
      incrementalReading.tagGroupFollowMode = value as 'off' | 'ask' | 'auto';
    });
    void saveSettings();
  }

  function handleMarkdownTagsYamlKeyChange(value: string) {
    const previousKey = String(
      settings.incrementalReading?.tagSource?.markdownYamlKey || ''
    ).trim();
    const nextPolicy = normalizeIRTagSourcePolicy({ markdownYamlKey: value });
    settingsEditor.updateIncrementalReading((incrementalReading) => {
      incrementalReading.tagSource = nextPolicy;
    });
    if (
      nextPolicy.markdownYamlKey === DEFAULT_MARKDOWN_TAGS_YAML_KEY &&
      previousKey !== DEFAULT_MARKDOWN_TAGS_YAML_KEY
    ) {
      new Notice(t('irSettings.tagSourceSwitchToTagsWarning'), 8000);
    }
    void saveSettings();
  }

  function handleAgingStrengthDropdownChange(value: string) {
    settingsEditor.updateIncrementalReading((incrementalReading) => {
      incrementalReading.agingStrength = value as 'low' | 'medium' | 'high';
    });
    void saveSettings();
  }

  function handlePostponeStrategyDropdownChange(value: string) {
    settingsEditor.updateIncrementalReading((incrementalReading) => {
      incrementalReading.autoPostponeStrategy = value as 'off' | 'gentle' | 'aggressive';
    });
    void saveSettings();
  }

  // 处理优先级半衰期变更
  function handlePriorityHalfLifeChange(value: number) {
    if (!Number.isNaN(value) && value >= 3 && value <= 30) {
      settingsEditor.updateIncrementalReading((incrementalReading) => {
        incrementalReading.priorityHalfLifeDays = value;
      });
      saveSettings();
    }
  }

  // 处理待读天数变更（统一用于统计和提前阅读范围）
  function handleLearnAheadDaysChange(value: number) {
    if (!Number.isNaN(value) && value >= 1 && value <= 14) {
      settingsEditor.updateIncrementalReading((incrementalReading) => {
        incrementalReading.learnAheadDays = value;
      });
      saveSettings();
    }
  }

</script>

<div class="weave-settings settings-section incremental-reading-settings settings-layout-flat">
  {#if showTabs}
    <div class="incremental-reading-tabs">
      <TabNavigation
        tabs={irSettingsTabs}
        activeTab={activeTab}
        onTabChange={(tabId) => activeTab = tabId as IRSettingsTabId}
      />
    </div>
  {/if}

  <div class="incremental-reading-tab-panel" id={`ir-settings-panel-${visibleTab}`}>
    {#if visibleTab === 'core-scheduling'}
      <div class="incremental-reading-tab-content">
        <IRCoreSchedulingSettingsSection
          {settings}
          {handleDailyNewLimitChange}
          {handleDailyReviewLimitChange}
          {handleLearnAheadDaysChange}
          {handleIntervalFactorChange}
          {handleReviewThresholdChange}
          {handleMaxIntervalChange}
        />

        <IRReadingTargetSettingsSection
          {settings}
          deckOptions={subscriptionDeckOptions}
          onInboxDeckChange={handleReadingTargetInboxDeckChange}
          onDefaultNoteBackedChange={handleReadingTargetDefaultNoteBackedChange}
        />

        <IRStrategySettingsSection
          {settings}
          strategyOptions={STRATEGY_OPTIONS}
          {handleStrategyDropdownChange}
          {handleTimeBudgetChange}
          {handleFlowStretchChange}
          {handleLoadBasedDeferChange}
          {handleDailyReadingPointCapChange}
          {handleHorizonSmoothingChange}
          {handleHorizonSpreadDaysChange}
          {handleMaxAppearancesChange}
          showSection={canUsePremiumFeature(PREMIUM_FEATURES.SCHEDULING_STRATEGY_SETTINGS)}
          strategyTitle={premiumTitle(t('irSettings.strategyTitle'), PREMIUM_FEATURES.SCHEDULING_STRATEGY_SETTINGS)}
          strategyLabel={premiumTitle(t('irSettings.strategyLabel'), PREMIUM_FEATURES.SCHEDULING_STRATEGY_SETTINGS)}
          timeBudgetLabel={premiumTitle(t('irSettings.timeBudgetLabel'), PREMIUM_FEATURES.SCHEDULING_STRATEGY_SETTINGS)}
          maxAppearancesLabel={premiumTitle(t('irSettings.maxAppearancesLabel'), PREMIUM_FEATURES.SCHEDULING_STRATEGY_SETTINGS)}
        />
        {#if shouldShowPremiumFeature(PREMIUM_FEATURES.SCHEDULING_STRATEGY_SETTINGS) && !canUsePremiumFeature(PREMIUM_FEATURES.SCHEDULING_STRATEGY_SETTINGS)}
          <div class="ir-premium-locked-card">
            <div class="ir-premium-locked-card__title with-accent-bar accent-rose">
              {premiumTitle(t('irSettings.strategyTitle'), PREMIUM_FEATURES.SCHEDULING_STRATEGY_SETTINGS)}
            </div>
            <div class="ir-premium-locked-card__desc">{t('irSettings.strategyDesc')}</div>
          </div>
        {/if}
      </div>
    {/if}

    {#if visibleTab === 'auto-subscribe'}
      <div class="incremental-reading-tab-content">
        <IRAutoSubscribeSettingsSection
          app={plugin.app}
          showSection={canUsePremiumFeature(PREMIUM_FEATURES.FOLDER_SUBSCRIPTION)}
          showTitle={autoSubscribeShowTitle}
          titleText={premiumTitle(t('irSettings.autoSubscribeTitle'), PREMIUM_FEATURES.FOLDER_SUBSCRIPTION)}
          addRuleLabel={premiumTitle(t('irSettings.autoSubscribeAddRule'), PREMIUM_FEATURES.FOLDER_SUBSCRIPTION)}
          initialScheduleLabel={premiumTitle(t('irSettings.autoSubscribeInitialScheduleLabel'), PREMIUM_FEATURES.FOLDER_SUBSCRIPTION)}
          confirmThresholdLabel={premiumTitle(t('irSettings.autoSubscribeConfirmThresholdLabel'), PREMIUM_FEATURES.FOLDER_SUBSCRIPTION)}
          rules={getFolderSubscriptionRules()}
          initialScheduleModeOptions={AUTO_SUBSCRIBE_INITIAL_SCHEDULE_MODE_OPTIONS}
          {getSubscriptionDeckOptionsForRule}
          {getFolderSubscriptionInitialScheduleMode}
          {getFolderSubscriptionImportConfirmThreshold}
          {handleAddFolderSubscriptionRule}
          {handleFolderSubscriptionFolderPathChange}
          {handleFolderSubscriptionDeckChange}
          {handleFolderSubscriptionEnabledChange}
          {removeFolderSubscriptionRule}
          {handleFolderSubscriptionInitialScheduleModeChange}
          {handleFolderSubscriptionImportConfirmThresholdChange}
        />
        {#if shouldShowPremiumFeature(PREMIUM_FEATURES.FOLDER_SUBSCRIPTION) && !canUsePremiumFeature(PREMIUM_FEATURES.FOLDER_SUBSCRIPTION)}
          <div class="ir-premium-locked-card">
            <div class="ir-premium-locked-card__title with-accent-bar accent-rose">
              {premiumTitle(t('irSettings.autoSubscribeTitle'), PREMIUM_FEATURES.FOLDER_SUBSCRIPTION)}
            </div>
            <div class="ir-premium-locked-card__desc">{t('irSettings.autoSubscribeFolderDesc')}</div>
          </div>
        {/if}
      </div>
    {/if}

    {#if visibleTab === 'advanced' && shouldShowPremiumFeature(PREMIUM_FEATURES.TAG_GROUPS)}
      <div class="incremental-reading-tab-content">
        {#if canUsePremiumFeature(PREMIUM_FEATURES.TAG_GROUPS)}
          <IRAdvancedSchedulingSettingsSection
            {plugin}
            {settings}
            agingOptions={AGING_OPTIONS}
            postponeOptions={POSTPONE_OPTIONS}
            {handleTagGroupPriorChange}
            {handleTagGroupFollowModeChange}
            {handleMarkdownTagsYamlKeyChange}
            handleAgingStrengthChange={handleAgingStrengthDropdownChange}
            handlePostponeStrategyChange={handlePostponeStrategyDropdownChange}
            {handlePriorityHalfLifeChange}
            tagGroupTitle={premiumTitle(t('irSettings.advancedTitle'), PREMIUM_FEATURES.TAG_GROUPS)}
            tagGroupPriorLabel={premiumTitle(t('irSettings.tagGroupPriorLabel'), PREMIUM_FEATURES.TAG_GROUPS)}
            tagGroupFollowLabel={premiumTitle(t('irSettings.tagGroupFollowLabel'), PREMIUM_FEATURES.TAG_GROUPS)}
            showTagGroupSection={true}
          />
        {:else}
          <div class="ir-premium-locked-card">
            <div class="ir-premium-locked-card__title with-accent-bar accent-rose">
              {premiumTitle(t('irSettings.advancedTitle'), PREMIUM_FEATURES.TAG_GROUPS)}
            </div>
            <div class="ir-premium-locked-card__desc">{t('irSettings.tagGroupPriorDesc')}</div>
          </div>
        {/if}
      </div>
    {/if}
  </div>

  <SettingsHelpModal
    open={showInterleaveHelpModal}
    title={t('irSettings.interleaveHintModalTitle')}
    closeLabel={t('irSettings.interleaveHintCloseLabel')}
    confirmLabel={t('irSettings.interleaveHintConfirm')}
    onClose={() => showInterleaveHelpModal = false}
  >
    <div class="help-item">
      <div class="help-item-title">{t('irSettings.interleaveHintTitle')}</div>
      <p class="help-item-desc">{t('irSettings.interleaveHintSummary')}</p>
      <p class="help-item-desc">{t('irSettings.interleaveHintPriority')}</p>
    </div>

    <div class="help-item">
      <div class="help-item-title">{t('irSettings.maxConsecutiveLabel')}</div>
      <p class="help-item-desc">
        {t('irSettings.interleaveHintThresholdPrefix')}
        <strong>{settings.incrementalReading?.maxConsecutiveSameTopic ?? 3}{t('irSettings.unitBlocks')}</strong>
        {t('irSettings.interleaveHintThresholdSuffix')}
      </p>
      <p class="help-item-desc">{t('irSettings.interleaveHintRange')}</p>
    </div>
  </SettingsHelpModal>

  {#if visibleTab === 'core-scheduling'}
    <div class="incremental-reading-tab-followup">
      <IRInterleaveSettingsSection
        {settings}
        showSection={canUsePremiumFeature(PREMIUM_FEATURES.INTERLEAVE_LEARNING_SETTINGS)}
        interleaveTitle={premiumTitle(t('irSettings.interleaveTitle'), PREMIUM_FEATURES.INTERLEAVE_LEARNING_SETTINGS)}
        interleaveModeLabel={premiumTitle(t('irSettings.interleaveModeLabel'), PREMIUM_FEATURES.INTERLEAVE_LEARNING_SETTINGS)}
        maxConsecutiveLabel={premiumTitle(t('irSettings.maxConsecutiveLabel'), PREMIUM_FEATURES.INTERLEAVE_LEARNING_SETTINGS)}
        onOpenHelp={() => showInterleaveHelpModal = true}
        {handleInterleaveModeChange}
        {handleMaxConsecutiveChange}
      />
      {#if shouldShowPremiumFeature(PREMIUM_FEATURES.INTERLEAVE_LEARNING_SETTINGS) && !canUsePremiumFeature(PREMIUM_FEATURES.INTERLEAVE_LEARNING_SETTINGS)}
        <div class="ir-premium-locked-card">
          <div class="ir-premium-locked-card__title with-accent-bar accent-rose">
            {premiumTitle(t('irSettings.interleaveTitle'), PREMIUM_FEATURES.INTERLEAVE_LEARNING_SETTINGS)}
          </div>
          <div class="ir-premium-locked-card__desc">{t('irSettings.interleaveModeDesc')}</div>
        </div>
      {/if}
    </div>
  {/if}

</div>

  <style>
  .incremental-reading-settings {
    --ir-font-label: var(--font-ui-small);
    --ir-font-desc: var(--font-ui-smaller);
    --ir-font-caption: var(--font-ui-smaller);
    --ir-radius-s: var(--radius-s);
    --ir-space-1: var(--size-4-1);
    --ir-space-2: var(--size-4-2);
    --ir-space-3: var(--size-4-3);
    --ir-space-4: var(--size-4-4);
    --ir-space-6: var(--size-4-6);
    display: flex;
    flex-direction: column;
    gap: var(--ir-space-6);
  }

  .incremental-reading-tabs {
    min-width: 0;
  }

  .incremental-reading-tabs :global(.tab-navigation) {
    background: transparent;
    border-radius: 0;
    padding: 0;
    gap: var(--ir-space-3);
    overflow-x: auto;
    scrollbar-width: none;
    border-bottom: 1px solid var(--background-modifier-border);
  }

  .incremental-reading-tabs :global(.tab-navigation::-webkit-scrollbar) {
    display: none;
  }

  .incremental-reading-tabs :global(.tab-button) {
    appearance: none;
    border: none;
    border-radius: 0;
    box-shadow: none;
    background: transparent;
    color: var(--text-muted);
    padding: var(--ir-space-3) 0 var(--ir-space-3);
    border-bottom: 2px solid transparent;
    font-size: var(--font-ui-small);
    font-weight: 500;
    transform: none;
    transition: color 0.15s ease, border-color 0.15s ease, background-color 0.15s ease;
  }

  .incremental-reading-tabs :global(.tab-button:hover:not(.disabled)) {
    background: transparent;
    color: var(--text-normal);
    border-bottom-color: var(--text-muted);
  }

  .incremental-reading-tabs :global(.tab-button.active) {
    background: transparent;
    color: var(--text-normal);
    border-bottom-color: var(--interactive-accent);
    box-shadow: none;
  }

  .incremental-reading-tabs :global(.tab-button.active:hover:not(.disabled)) {
    background: transparent;
    color: var(--text-normal);
  }

  .incremental-reading-tab-panel,
  .incremental-reading-tab-content,
  .incremental-reading-tab-followup {
    display: flex;
    flex-direction: column;
    gap: var(--ir-space-6);
    min-width: 0;
  }

  /* Keep spacing rhythm consistent with section spacing inside core-scheduling */
  .incremental-reading-tab-followup {
    margin-top: var(--ir-space-6);
  }

  .ir-premium-locked-card {
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--radius-m);
    background: color-mix(in srgb, var(--background-secondary) 90%, transparent);
    padding: var(--ir-space-4);
    display: flex;
    flex-direction: column;
    gap: var(--ir-space-3);
  }

  .ir-premium-locked-card__title {
    font-size: var(--font-ui-medium);
    font-weight: 700;
    color: var(--text-normal);
  }

  .ir-premium-locked-card__title.with-accent-bar {
    position: relative;
    padding-left: 14px;
  }

  .ir-premium-locked-card__title.with-accent-bar::before {
    content: "";
    position: absolute;
    left: 0;
    top: 50%;
    transform: translateY(-50%);
    width: 4px;
    height: 80%;
    border-radius: var(--radius-s);
  }

  .ir-premium-locked-card__title.accent-rose::before {
    background: linear-gradient(180deg, #f43f5e, #e11d48);
  }

  .ir-premium-locked-card__desc {
    font-size: var(--font-ui-small);
    color: var(--text-muted);
    line-height: 1.65;
  }

  /* v3.0 玫瑰色强调条（高级调度） */
  :global(.weave-settings .accent-rose) {
    --accent-color: #f43f5e;
  }

  :global(.weave-settings .with-accent-bar.accent-rose::before) {
    background: linear-gradient(180deg, #f43f5e, #e11d48);
  }

  @media (max-width: 768px) {
    .incremental-reading-tabs :global(.tab-navigation) {
      gap: 0.5rem;
    }
  }

</style>
