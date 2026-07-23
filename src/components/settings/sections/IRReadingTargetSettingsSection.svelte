<!--
  Reading-target related IR settings (inbox deck + default note-backed).
-->
<script lang="ts">
  import { tr } from '../../../utils/i18n';
  import type { IncrementalReadingSettings } from '../../../types/plugin-settings.d';
  import ObsidianSettingToggle from '../components/ObsidianSettingToggle.svelte';
  import ObsidianSettingDropdown from '../components/ObsidianSettingDropdown.svelte';

  type DeckOption = { id: string; label: string; description?: string };

  interface Props {
    settings: { incrementalReading?: IncrementalReadingSettings };
    deckOptions: DeckOption[];
    onInboxDeckChange: (deckId: string) => void;
    onDefaultNoteBackedChange: (enabled: boolean) => void;
  }

  let {
    settings,
    deckOptions,
    onInboxDeckChange,
    onDefaultNoteBackedChange
  }: Props = $props();

  let t = $derived($tr);

  const inboxOptions = $derived([
    {
      id: '',
      label: t('irSettings.readingTargetInboxEmpty'),
    },
    ...deckOptions.map((option) => ({
      id: option.id,
      label: option.label,
    })),
  ]);
</script>

<div class="settings-group">
  <h4 class="group-title with-accent-bar accent-cyan">{t('irSettings.readingTargetTitle')}</h4>

  <div class="group-content">
    <ObsidianSettingDropdown
      name={t('irSettings.readingTargetInboxLabel')}
      desc={t('irSettings.readingTargetInboxDesc')}
      options={inboxOptions}
      value={settings.incrementalReading?.readingTargetInboxDeckId || ''}
      onChange={onInboxDeckChange}
    />

    <ObsidianSettingToggle
      name={t('irSettings.readingTargetDefaultNoteBackedLabel')}
      desc={t('irSettings.readingTargetDefaultNoteBackedDesc')}
      value={settings.incrementalReading?.readingTargetDefaultNoteBacked === true}
      onChange={onDefaultNoteBackedChange}
    />
  </div>
</div>
