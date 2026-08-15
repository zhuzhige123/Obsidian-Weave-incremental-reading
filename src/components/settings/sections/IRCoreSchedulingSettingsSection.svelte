<script lang="ts">
  import { tr } from '../../../utils/i18n';
  import type { IncrementalReadingSettings } from '../../../types/plugin-settings.d';
  import ObsidianSettingSlider from '../components/ObsidianSettingSlider.svelte';

  interface Props {
    settings: { incrementalReading?: IncrementalReadingSettings };
    handleTimeBudgetChange: (value: number) => void;
    handleDailyReadingPointCapChange: (value: number) => void;
    handleLearnAheadDaysChange: (value: number) => void;
    handleIntervalFactorChange: (value: number) => void;
    handleReviewThresholdChange: (value: number) => void;
    handleMaxIntervalChange: (value: number) => void;
  }

  let {
    settings,
    handleTimeBudgetChange,
    handleDailyReadingPointCapChange,
    handleLearnAheadDaysChange,
    handleIntervalFactorChange,
    handleReviewThresholdChange,
    handleMaxIntervalChange
  }: Props = $props();

  let t = $derived($tr);
</script>

<div class="settings-group">
  <h4 class="group-title with-accent-bar accent-amber">{t('irSettings.scheduleTitle')}</h4>

  <div class="group-content">
    <ObsidianSettingSlider
      name={t('irSettings.timeBudgetLabel')}
      desc={t('irSettings.timeBudgetDesc')}
      min={10}
      max={120}
      step={10}
      value={settings.incrementalReading?.dailyTimeBudgetMinutes ?? 40}
      onChange={handleTimeBudgetChange}
      formatValue={(value) => `${value}${t('irSettings.unitMinutes')}`}
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

    <ObsidianSettingSlider
      name={t('irSettings.learnAheadLabel')}
      desc={t('irSettings.learnAheadDesc')}
      min={1}
      max={14}
      step={1}
      value={settings.incrementalReading?.learnAheadDays ?? 3}
      onChange={handleLearnAheadDaysChange}
      formatValue={(value) => `${value}${t('irSettings.unitDays')}`}
    />

    <ObsidianSettingSlider
      name={t('irSettings.intervalFactorLabel')}
      desc={t('irSettings.intervalFactorDesc')}
      min={1}
      max={3}
      step={0.1}
      value={settings.incrementalReading?.defaultIntervalFactor ?? 1.5}
      onChange={handleIntervalFactorChange}
      formatValue={(value) => `${value.toFixed(1)}x`}
    />

    <ObsidianSettingSlider
      name={t('irSettings.reviewThresholdLabel')}
      desc={t('irSettings.reviewThresholdDesc')}
      min={3}
      max={14}
      step={1}
      value={settings.incrementalReading?.reviewThreshold ?? 7}
      onChange={handleReviewThresholdChange}
      formatValue={(value) => `${value}${t('irSettings.unitDays')}`}
    />

    <ObsidianSettingSlider
      name={t('irSettings.maxIntervalLabel')}
      desc={t('irSettings.maxIntervalDesc')}
      min={30}
      max={365}
      step={30}
      value={settings.incrementalReading?.maxInterval ?? 365}
      onChange={handleMaxIntervalChange}
      formatValue={(value) => `${value}${t('irSettings.unitDays')}`}
    />
  </div>
</div>

<style>
  :global(.weave-settings .accent-amber) {
    --accent-color: #f59e0b;
  }

  :global(.weave-settings .with-accent-bar.accent-amber::before) {
    background: linear-gradient(180deg, #f59e0b, #d97706);
  }
</style>
