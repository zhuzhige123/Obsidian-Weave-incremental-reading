<script lang="ts">
  import type AnkiObsidianPlugin from '../../../main';
  import AddReadingPointModal from '../AddReadingPointModal.svelte';

  interface Props {
    show?: boolean;
    plugin: AnkiObsidianPlugin;
    deckId: string;
    pdfPath: string;
    parentTitle: string;
    onClose: () => void;
    onCreated: () => void;
  }

  let {
    show = $bindable(false),
    plugin,
    deckId,
    pdfPath,
    parentTitle,
    onClose,
    onCreated,
  }: Props = $props();
</script>

{#if show}
  <AddReadingPointModal
    {plugin}
    deckId={deckId}
    pdfPath={pdfPath}
    parentTitle={parentTitle}
    {onClose}
    {onCreated}
  />
{/if}
