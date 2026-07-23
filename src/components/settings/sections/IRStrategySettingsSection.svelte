<script lang="ts">
  import { tr } from '../../../utils/i18n';
  import type { IncrementalReadingSettings } from '../../../types/plugin-settings.d';
  import ObsidianSettingToggle from '../components/ObsidianSettingToggle.svelte';
  import ObsidianSettingSlider from '../components/ObsidianSettingSlider.svelte';
  import ObsidianSettingDropdown from '../components/ObsidianSettingDropdown.svelte';

  type StrategyOption = { id: string; label: string; desc: string };

  interface Props {
    settings: { incrementalReading?: IncrementalReadingSettings };
    strategyOptions: StrategyOption[];
    handleStrategyDropdownChange: (value: string) => void;
    handleTimeBudgetChange: (value: number) => void;
    handleFlowStretchChange: (value: number) => void;
    handleLoadBasedDeferChange: (enabled: boolean) => void;
    handleDailyReadingPointCapChange: (value: number) => void;
    handleHorizonSmoothingChange: (enabled: boolean) => void;
    handleHorizonSpreadDaysChange: (value: number) => void;
    handleMaxAppearancesChange: (value: number) => void;
    showSection?: boolean;
    strategyTitle?: string;
    strategyLabel?: string;
    timeBudgetLabel?: string;
    maxAppearancesLabel?: string;
  }

  let {
    settings,
    strategyOptions,
    handleStrategyDropdownChange,
    handleTimeBudgetChange,
    handleFlowStretchChange,
    handleLoadBasedDeferChange,
    handleDailyReadingPointCapChange,
    handleHorizonSmoothingChange,
    handleHorizonSpreadDaysChange,
    handleMaxAppearancesChange,
    showSection = true,
    strategyTitle,
    strategyLabel,
    timeBudgetLabel,
    maxAppearancesLabel
  }: Props = $props();

  let t = $derived($tr);
  const strategyDropdownOptions = $derived(
    strategyOptions.map((opt) => ({ id: opt.id, label: opt.label })),
  );
</script>

{#if showSection}
<div class="settings-group">
  <h4 class="group-title with-accent-bar accent-purple">{strategyTitle ?? t('irSettings.strategyTitle')} <span class="badge">v3.0</span></h4>

  <div class="group-content">
    <ObsidianSettingDropdown
      name={strategyLabel ?? t('irSettings.strategyLabel')}
      desc={t('irSettings.strategyDesc')}
      options={strategyDropdownOptions}
      value={settings.incrementalReading?.scheduleStrategy ?? 'processing'}
      onChange={handleStrategyDropdownChange}
    />

    <div class="strategy-hint">
      {#if settings.incrementalReading?.scheduleStrategy === 'reading-list'}
        {t('irSettings.strategyHintReadingList')}
      {:else}
        {t('irSettings.strategyHintProcessing')}
      {/if}
    </div>

    <ObsidianSettingSlider
      name={timeBudgetLabel ?? t('irSettings.timeBudgetLabel')}
      desc={t('irSettings.timeBudgetDesc')}
      min={10}
      max={120}
      step={10}
      value={settings.incrementalReading?.dailyTimeBudgetMinutes ?? 40}
      onChange={handleTimeBudgetChange}
      formatValue={(value) => `${value}${t('irSettings.unitMinutes')}`}
    />

    <ObsidianSettingSlider
      name={t('irSettings.flowStretchLabel')}
      desc={t('irSettings.flowStretchDesc')}
      min={0}
      max={40}
      step={5}
      value={settings.incrementalReading?.flowStretchPercent ?? 15}
      disabled={settings.incrementalReading?.enableLoadBasedDefer === false}
      onChange={handleFlowStretchChange}
      formatValue={(value) => `${value}%`}
    />

    <ObsidianSettingToggle
      name={t('irSettings.enableLoadDeferLabel')}
      desc={t('irSettings.enableLoadDeferDesc')}
      value={settings.incrementalReading?.enableLoadBasedDefer !== false}
      onChange={handleLoadBasedDeferChange}
    />

    <ObsidianSettingSlider
      name={t('irSettings.dailyReadingPointCapLabel')}
      desc={t('irSettings.dailyReadingPointCapDesc')}
      min={5}
      max={40}
      step={1}
      value={settings.incrementalReading?.dailyReadingPointCap ?? 15}
      onChange={handleDailyReadingPointCapChange}
      formatValue={(value) => `${value}${t('irSettings.unitItems')}`}
    />

    <ObsidianSettingToggle
      name={t('irSettings.enableHorizonSmoothingLabel')}
      desc={t('irSettings.enableHorizonSmoothingDesc')}
      value={settings.incrementalReading?.enableHorizonSmoothing !== false}
      onChange={handleHorizonSmoothingChange}
    />

    <ObsidianSettingSlider
      name={t('irSettings.horizonSpreadDaysLabel')}
      desc={t('irSettings.horizonSpreadDaysDesc')}
      min={5}
      max={14}
      step={1}
      value={settings.incrementalReading?.horizonSpreadDays ?? 7}
      disabled={settings.incrementalReading?.enableHorizonSmoothing === false}
      onChange={handleHorizonSpreadDaysChange}
      formatValue={(value) => `${value}${t('irSettings.unitDays')}`}
    />

    {#if settings.incrementalReading?.scheduleStrategy !== 'reading-list'}
      <ObsidianSettingSlider
        name={maxAppearancesLabel ?? t('irSettings.maxAppearancesLabel')}
        desc={t('irSettings.maxAppearancesDesc')}
        min={1}
        max={5}
        step={1}
        value={settings.incrementalReading?.maxAppearancesPerDay ?? 2}
        onChange={handleMaxAppearancesChange}
        formatValue={(value) => `${value}${t('irSettings.unitTimes')}`}
      />
    {/if}
  </div>
</div>
{/if}

<style>
  .badge {
    display: inline-block;
    padding: calc(var(--size-2-1) * 0.5) var(--size-2-2);
    font-size: var(--ir-font-caption, var(--font-ui-smaller));
    font-weight: 600;
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    border-radius: var(--ir-radius-s, var(--radius-s));
    margin-left: var(--size-4-2);
    vertical-align: middle;
    line-height: 1.2;
  }

  .strategy-hint {
    padding: var(--size-4-2) var(--size-4-3);
    margin: var(--size-4-2) 0;
    background: var(--background-secondary);
    border-radius: var(--ir-radius-s, var(--radius-s));
    font-size: var(--ir-font-desc, var(--font-ui-smaller));
    color: var(--text-muted);
    line-height: var(--line-height-normal);
  }

  :global(.weave-settings .accent-purple) {
    --accent-color: #8b5cf6;
  }

  :global(.weave-settings .with-accent-bar.accent-purple::before) {
    background: linear-gradient(180deg, #8b5cf6, #7c3aed);
  }
</style>
