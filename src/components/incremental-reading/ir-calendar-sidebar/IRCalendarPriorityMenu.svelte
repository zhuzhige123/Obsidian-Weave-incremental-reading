<script lang="ts">
  import FloatingMenu from '../../ui/FloatingMenu.svelte';
  import IRPrioritySlider from '../IRPrioritySlider.svelte';
  import IRScheduleImpactPreviewPanel from '../IRScheduleImpactPreviewPanel.svelte';
  import type { PreviewDetails } from '../ir-schedule-impact-preview-types';
  import type { ScheduleItem } from '../../../services/incremental-reading/IRCalendarScheduleItem';

  interface Props {
    show?: boolean;
    anchor: HTMLElement | null;
    target: ScheduleItem | null;
    priorityPreviewDetails: PreviewDetails | null;
    prioritySliderExpanded?: boolean;
    onClose: () => void;
    onToggleSlider: () => void;
    onPreview: (value: number) => void;
    onChange: (value: number) => void;
  }

  let {
    show = $bindable(false),
    anchor,
    target,
    priorityPreviewDetails,
    prioritySliderExpanded = $bindable(true),
    onClose,
    onToggleSlider,
    onPreview,
    onChange,
  }: Props = $props();
</script>

<FloatingMenu
  bind:show
  {anchor}
  placement="left-start"
  portal={false}
  {onClose}
  class="ir-calendar-priority-menu"
>
  {#snippet children()}
    {#if target}
      <div class="ir-calendar-priority-panel">
        <IRPrioritySlider
          value={target.priority ?? 5}
          expanded={prioritySliderExpanded}
          onToggle={onToggleSlider}
          {onPreview}
          {onChange}
        />
        <IRScheduleImpactPreviewPanel preview={priorityPreviewDetails} />
      </div>
    {/if}
  {/snippet}
</FloatingMenu>
