<script lang="ts">
  import { tr } from '../../../utils/i18n';
  import type { IncrementalReadingSettings } from '../../../types/plugin-settings.d';
  import ObsidianDropdown from '../../ui/ObsidianDropdown.svelte';

  type StrategyOption = { id: string; label: string; desc: string };

  interface Props {
    settings: { incrementalReading?: IncrementalReadingSettings };
    strategyOptions: StrategyOption[];
  handleStrategyDropdownChange: (value: string) => void;
  handleTimeBudgetChange: (event: Event) => void;
  handleFlowStretchChange: (event: Event) => void;
  handleLoadBasedDeferChange: (event: Event) => void;
  handleDailyReadingPointCapChange: (event: Event) => void;
  handleHorizonSmoothingChange: (event: Event) => void;
  handleHorizonSpreadDaysChange: (event: Event) => void;
  handleMaxAppearancesChange: (event: Event) => void;
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
</script>

{#if showSection}
<div class="settings-group">
  <h4 class="group-title with-accent-bar accent-purple">{strategyTitle ?? t('irSettings.strategyTitle')} <span class="badge">v3.0</span></h4>

  <div class="group-content">
    <div class="row">
      <div class="label-with-desc">
        <label for="irScheduleStrategy">{strategyLabel ?? t('irSettings.strategyLabel')}</label>
        <p class="desc">{t('irSettings.strategyDesc')}</p>
      </div>
      <div class="ir-dropdown-compact">
        <ObsidianDropdown
          options={strategyOptions.map((opt) => ({ id: opt.id, label: opt.label, description: opt.desc }))}
          value={settings.incrementalReading?.scheduleStrategy ?? 'processing'}
          onchange={handleStrategyDropdownChange}
        />
      </div>
    </div>

    <div class="strategy-hint">
      {#if settings.incrementalReading?.scheduleStrategy === 'reading-list'}
        {t('irSettings.strategyHintReadingList')}
      {:else}
        {t('irSettings.strategyHintProcessing')}
      {/if}
    </div>

    <div class="row">
      <div class="label-with-desc">
        <label for="irTimeBudget">{timeBudgetLabel ?? t('irSettings.timeBudgetLabel')}</label>
        <p class="desc">{t('irSettings.timeBudgetDesc')}</p>
      </div>
      <div class="slider-container">
        <input
          id="irTimeBudget"
          type="range"
          min="10"
          max="120"
          step="10"
          value={settings.incrementalReading?.dailyTimeBudgetMinutes ?? 40}
          class="modern-slider"
          oninput={handleTimeBudgetChange}
        />
        <span class="slider-value">{settings.incrementalReading?.dailyTimeBudgetMinutes ?? 40}{t('irSettings.unitMinutes')}</span>
      </div>
    </div>

    <div class="row">
      <div class="label-with-desc">
        <label for="irFlowStretch">{t('irSettings.flowStretchLabel')}</label>
        <p class="desc">{t('irSettings.flowStretchDesc')}</p>
      </div>
      <div class="slider-container">
        <input
          id="irFlowStretch"
          type="range"
          min="0"
          max="40"
          step="5"
          value={settings.incrementalReading?.flowStretchPercent ?? 15}
          class="modern-slider"
          oninput={handleFlowStretchChange}
          disabled={settings.incrementalReading?.enableLoadBasedDefer === false}
        />
        <span class="slider-value">{settings.incrementalReading?.flowStretchPercent ?? 15}%</span>
      </div>
    </div>

    <div class="row">
      <div class="label-with-desc">
        <label for="irEnableLoadDefer">{t('irSettings.enableLoadDeferLabel')}</label>
        <p class="desc">{t('irSettings.enableLoadDeferDesc')}</p>
      </div>
      <label class="modern-switch">
        <input
          id="irEnableLoadDefer"
          type="checkbox"
          checked={settings.incrementalReading?.enableLoadBasedDefer !== false}
          onchange={handleLoadBasedDeferChange}
        />
        <span class="switch-slider"></span>
      </label>
    </div>

    <div class="row">
      <div class="label-with-desc">
        <label for="irDailyReadingPointCap">{t('irSettings.dailyReadingPointCapLabel')}</label>
        <p class="desc">{t('irSettings.dailyReadingPointCapDesc')}</p>
      </div>
      <div class="slider-container">
        <input
          id="irDailyReadingPointCap"
          type="range"
          min="5"
          max="40"
          step="1"
          value={settings.incrementalReading?.dailyReadingPointCap ?? 15}
          class="modern-slider"
          oninput={handleDailyReadingPointCapChange}
        />
        <span class="slider-value">{settings.incrementalReading?.dailyReadingPointCap ?? 15}{t('irSettings.unitItems')}</span>
      </div>
    </div>

    <div class="row">
      <div class="label-with-desc">
        <label for="irEnableHorizonSmoothing">{t('irSettings.enableHorizonSmoothingLabel')}</label>
        <p class="desc">{t('irSettings.enableHorizonSmoothingDesc')}</p>
      </div>
      <label class="modern-switch">
        <input
          id="irEnableHorizonSmoothing"
          type="checkbox"
          checked={settings.incrementalReading?.enableHorizonSmoothing !== false}
          onchange={handleHorizonSmoothingChange}
        />
        <span class="switch-slider"></span>
      </label>
    </div>

    <div class="row">
      <div class="label-with-desc">
        <label for="irHorizonSpreadDays">{t('irSettings.horizonSpreadDaysLabel')}</label>
        <p class="desc">{t('irSettings.horizonSpreadDaysDesc')}</p>
      </div>
      <div class="slider-container">
        <input
          id="irHorizonSpreadDays"
          type="range"
          min="5"
          max="14"
          step="1"
          value={settings.incrementalReading?.horizonSpreadDays ?? 7}
          class="modern-slider"
          oninput={handleHorizonSpreadDaysChange}
          disabled={settings.incrementalReading?.enableHorizonSmoothing === false}
        />
        <span class="slider-value">{settings.incrementalReading?.horizonSpreadDays ?? 7}{t('irSettings.unitDays')}</span>
      </div>
    </div>

    {#if settings.incrementalReading?.scheduleStrategy !== 'reading-list'}
      <div class="row">
        <div class="label-with-desc">
          <label for="irMaxAppearances">{maxAppearancesLabel ?? t('irSettings.maxAppearancesLabel')}</label>
          <p class="desc">{t('irSettings.maxAppearancesDesc')}</p>
        </div>
        <div class="slider-container">
          <input
            id="irMaxAppearances"
            type="range"
            min="1"
            max="5"
            step="1"
            value={settings.incrementalReading?.maxAppearancesPerDay ?? 2}
            class="modern-slider"
            oninput={handleMaxAppearancesChange}
          />
          <span class="slider-value">{settings.incrementalReading?.maxAppearancesPerDay ?? 2}{t('irSettings.unitTimes')}</span>
        </div>
      </div>
    {/if}
  </div>
</div>
{/if}

<style>
  .label-with-desc {
    display: flex;
    flex-direction: column;
    gap: var(--size-4-1);
    min-width: 0;
  }

  .label-with-desc > label {
    margin: 0;
    font-size: var(--ir-font-label, var(--font-ui-small));
    font-weight: 600;
    line-height: var(--line-height-tight);
    color: var(--text-normal);
  }

  .label-with-desc > .desc {
    margin: 0;
    font-size: var(--ir-font-desc, var(--font-ui-smaller));
    line-height: var(--line-height-normal);
    color: var(--text-muted);
  }

  .ir-dropdown-compact {
    flex: 0 0 220px;
    width: 220px;
    max-width: 100%;
    margin-left: auto;
  }

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

  :global(.accent-purple) {
    --accent-color: #8b5cf6;
  }

  :global(.with-accent-bar.accent-purple::before) {
    background: linear-gradient(180deg, #8b5cf6, #7c3aed);
  }

  @media (max-width: 768px) {
    .ir-dropdown-compact {
      flex: 1 1 auto;
      width: 100%;
      max-width: 100%;
      margin-left: 0;
    }
  }
</style>
