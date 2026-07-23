<script lang="ts">
  import { tr } from '../../../utils/i18n';
  import type { IncrementalReadingSettings } from '../../../types/plugin-settings.d';
  import type { IncrementalReadingSettingsHost } from '../types/incremental-reading-settings-host';
  import IRTagGroupManager from './IRTagGroupManager.svelte';
  import ObsidianSettingToggle from '../components/ObsidianSettingToggle.svelte';
  import ObsidianSettingSlider from '../components/ObsidianSettingSlider.svelte';
  import ObsidianSettingDropdown from '../components/ObsidianSettingDropdown.svelte';
  import ObsidianSettingText from '../components/ObsidianSettingText.svelte';
  import {
    DEFAULT_IR_TAG_SOURCE_POLICY,
    DEFAULT_MARKDOWN_TAGS_YAML_KEY,
    LEGACY_MARKDOWN_TAGS_YAML_KEY,
  } from '../../../services/incremental-reading/ir-tag-source-policy';

  type DropdownOption = { id: string; label: string; desc: string };

  interface Props {
    plugin: IncrementalReadingSettingsHost;
    settings: { incrementalReading?: IncrementalReadingSettings };
    agingOptions: DropdownOption[];
    postponeOptions: DropdownOption[];
    handleTagGroupPriorChange: (enabled: boolean) => void;
    handleTagGroupFollowModeChange: (value: string) => void;
    handleMarkdownTagsYamlKeyChange: (value: string) => void;
    handleAgingStrengthChange: (value: string) => void;
    handlePostponeStrategyChange: (value: string) => void;
    handlePriorityHalfLifeChange: (value: number) => void;
    tagGroupTitle?: string;
    tagGroupPriorLabel?: string;
    tagGroupFollowLabel?: string;
    showTagGroupSection?: boolean;
  }

  let {
    plugin,
    settings,
    agingOptions,
    postponeOptions,
    handleTagGroupPriorChange,
    handleTagGroupFollowModeChange,
    handleMarkdownTagsYamlKeyChange,
    handleAgingStrengthChange,
    handlePostponeStrategyChange,
    handlePriorityHalfLifeChange,
    tagGroupTitle,
    tagGroupPriorLabel,
    tagGroupFollowLabel,
    showTagGroupSection = true
  }: Props = $props();

  let t = $derived($tr);
  let markdownTagsYamlKey = $derived(
    settings.incrementalReading?.tagSource?.markdownYamlKey ??
      DEFAULT_IR_TAG_SOURCE_POLICY.markdownYamlKey
  );
  const followModeOptions = $derived([
    { id: 'off', label: t('irSettings.followOff') },
    { id: 'ask', label: t('irSettings.followAsk') },
    { id: 'auto', label: t('irSettings.followAuto') },
  ]);
  const agingDropdownOptions = $derived(
    agingOptions.map((opt) => ({ id: opt.id, label: opt.label })),
  );
  const postponeDropdownOptions = $derived(
    postponeOptions.map((opt) => ({ id: opt.id, label: opt.label })),
  );
</script>

<div class="settings-group">
  <h4 class="group-title with-accent-bar accent-rose">{tagGroupTitle ?? t('irSettings.advancedTitle')}</h4>

  <div class="group-content">
    {#if showTagGroupSection}
      <ObsidianSettingToggle
        name={tagGroupPriorLabel ?? t('irSettings.tagGroupPriorLabel')}
        desc={t('irSettings.tagGroupPriorDesc')}
        value={settings.incrementalReading?.enableTagGroupPrior ?? true}
        onChange={handleTagGroupPriorChange}
      />
    {/if}

    {#if showTagGroupSection && settings.incrementalReading?.enableTagGroupPrior !== false}
      <IRTagGroupManager {plugin} />

      <ObsidianSettingDropdown
        name={tagGroupFollowLabel ?? t('irSettings.tagGroupFollowLabel')}
        desc={t('irSettings.tagGroupFollowDesc')}
        options={followModeOptions}
        value={settings.incrementalReading?.tagGroupFollowMode ?? 'ask'}
        onChange={handleTagGroupFollowModeChange}
      />
    {/if}

    <div class="tag-source-setting">
      <ObsidianSettingText
        name={t('irSettings.tagSourceMarkdownYamlKeyLabel')}
        desc={t('irSettings.tagSourceMarkdownYamlKeyDesc')}
        value={markdownTagsYamlKey}
        placeholder={t('irSettings.tagSourceMarkdownYamlKeyPlaceholder')}
        onChange={handleMarkdownTagsYamlKeyChange}
      />
      <div class="tag-source-presets" role="group" aria-label={t('irSettings.tagSourceMarkdownYamlKeyLabel')}>
        <button
          type="button"
          class="tag-source-preset"
          class:is-active={markdownTagsYamlKey === DEFAULT_MARKDOWN_TAGS_YAML_KEY}
          onclick={() => handleMarkdownTagsYamlKeyChange(DEFAULT_MARKDOWN_TAGS_YAML_KEY)}
        >
          {t('irSettings.tagSourcePresetTags')}
        </button>
        <button
          type="button"
          class="tag-source-preset"
          class:is-active={markdownTagsYamlKey === LEGACY_MARKDOWN_TAGS_YAML_KEY}
          onclick={() => handleMarkdownTagsYamlKeyChange(LEGACY_MARKDOWN_TAGS_YAML_KEY)}
        >
          {t('irSettings.tagSourcePresetWeaveTags')}
        </button>
      </div>
    </div>

    <ObsidianSettingDropdown
      name={t('irSettings.agingStrengthLabel')}
      desc={t('irSettings.agingStrengthDesc')}
      options={agingDropdownOptions}
      value={settings.incrementalReading?.agingStrength ?? 'low'}
      onChange={handleAgingStrengthChange}
    />

    <ObsidianSettingDropdown
      name={t('irSettings.postponeLabel')}
      desc={t('irSettings.postponeDesc')}
      options={postponeDropdownOptions}
      value={settings.incrementalReading?.autoPostponeStrategy ?? 'gentle'}
      onChange={handlePostponeStrategyChange}
    />

    <ObsidianSettingSlider
      name={t('irSettings.priorityHalfLifeLabel')}
      desc={t('irSettings.priorityHalfLifeDesc')}
      min={3}
      max={30}
      step={1}
      value={settings.incrementalReading?.priorityHalfLifeDays ?? 7}
      onChange={handlePriorityHalfLifeChange}
      formatValue={(value) => `${value}${t('irSettings.unitDays')}`}
    />
  </div>
</div>

<style>
  .tag-source-setting {
    display: flex;
    flex-direction: column;
    gap: var(--size-2-2);
  }

  .tag-source-presets {
    display: flex;
    flex-wrap: wrap;
    gap: var(--size-2-1);
    padding-left: 0;
  }

  .tag-source-preset {
    border: 1px solid var(--background-modifier-border);
    background: var(--background-secondary);
    color: var(--text-muted);
    border-radius: var(--radius-s);
    padding: 2px 8px;
    font-size: var(--font-ui-smaller);
    cursor: pointer;
  }

  .tag-source-preset.is-active {
    color: var(--text-normal);
    border-color: var(--interactive-accent);
    background: var(--background-modifier-hover);
  }

  :global(.weave-settings .accent-rose) {
    --accent-color: #f43f5e;
  }

  :global(.weave-settings .with-accent-bar.accent-rose::before) {
    background: linear-gradient(180deg, #f43f5e, #e11d48);
  }
</style>
