<script lang="ts">
  import { tr } from '../../../utils/i18n';
  import type { IncrementalReadingSettings } from '../../../types/plugin-settings.d';
  import ObsidianSettingSlider from '../components/ObsidianSettingSlider.svelte';

  interface Props {
    settings: { incrementalReading?: IncrementalReadingSettings };
    handleDailyNewLimitChange: (value: number) => void;
    handleDailyReviewLimitChange: (value: number) => void;
    handleLearnAheadDaysChange: (value: number) => void;
    handleIntervalFactorChange: (value: number) => void;
    handleReviewThresholdChange: (value: number) => void;
    handleMaxIntervalChange: (value: number) => void;
  }

  let {
    settings,
    handleDailyNewLimitChange,
    handleDailyReviewLimitChange,
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
      name={t('irSettings.dailyNewLabel')}
      desc={t('irSettings.dailyNewDesc')}
      min={0}
      max={50}
      step={5}
      value={settings.incrementalReading?.dailyNewLimit ?? 20}
      onChange={handleDailyNewLimitChange}
      formatValue={(value) => String(value)}
    />

    <ObsidianSettingSlider
      name={t('irSettings.dailyReviewLabel')}
      desc={t('irSettings.dailyReviewDesc')}
      min={0}
      max={200}
      step={10}
      value={settings.incrementalReading?.dailyReviewLimit ?? 50}
      onChange={handleDailyReviewLimitChange}
      formatValue={(value) => String(value)}
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
