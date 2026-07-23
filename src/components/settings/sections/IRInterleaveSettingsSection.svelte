<script lang="ts">
  import { tr } from '../../../utils/i18n';
  import type { IncrementalReadingSettings } from '../../../types/plugin-settings.d';
  import SettingsHelpTriggerButton from '../components/SettingsHelpTriggerButton.svelte';
  import ObsidianSettingToggle from '../components/ObsidianSettingToggle.svelte';
  import ObsidianSettingSlider from '../components/ObsidianSettingSlider.svelte';

  interface Props {
    settings: { incrementalReading?: IncrementalReadingSettings };
    onOpenHelp: () => void;
    handleInterleaveModeChange: (enabled: boolean) => void;
    handleMaxConsecutiveChange: (value: number) => void;
    showSection?: boolean;
    interleaveTitle?: string;
    interleaveModeLabel?: string;
    maxConsecutiveLabel?: string;
  }

  let {
    settings,
    onOpenHelp,
    handleInterleaveModeChange,
    handleMaxConsecutiveChange,
    showSection = true,
    interleaveTitle,
    interleaveModeLabel,
    maxConsecutiveLabel
  }: Props = $props();

  let t = $derived($tr);
</script>

{#if showSection}
<div class="settings-group">
  <div class="group-header">
    <h4 class="group-title with-accent-bar accent-green">{interleaveTitle ?? t('irSettings.interleaveTitle')}</h4>
    <SettingsHelpTriggerButton
      label={t('irSettings.interleaveHintModalTitle')}
      onClick={onOpenHelp}
    />
  </div>

  <div class="group-content">
    <ObsidianSettingToggle
      name={interleaveModeLabel ?? t('irSettings.interleaveModeLabel')}
      desc={t('irSettings.interleaveModeDesc')}
      value={settings.incrementalReading?.interleaveMode ?? true}
      onChange={handleInterleaveModeChange}
    />

    {#if settings.incrementalReading?.interleaveMode !== false}
      <ObsidianSettingSlider
        name={maxConsecutiveLabel ?? t('irSettings.maxConsecutiveLabel')}
        desc={t('irSettings.maxConsecutiveDesc')}
        min={1}
        max={10}
        step={1}
        value={settings.incrementalReading?.maxConsecutiveSameTopic ?? 3}
        onChange={handleMaxConsecutiveChange}
        formatValue={(value) => `${value}${t('irSettings.unitBlocks')}`}
      />
    {/if}
  </div>
</div>
{/if}

<style>
  .settings-group .group-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--size-4-3);
    padding-bottom: 0.4rem;
    flex-direction: row;
  }

  .settings-group .group-header > .group-title {
    flex: 1;
    min-width: 0;
    margin: 0;
  }

  .settings-group .group-header :global(.settings-help-trigger) {
    margin-left: auto;
    align-self: center;
  }

  :global(.weave-settings .accent-green) {
    --accent-color: #10b981;
  }

  :global(.weave-settings .with-accent-bar.accent-green::before) {
    background: linear-gradient(180deg, #10b981, #059669);
  }
</style>
