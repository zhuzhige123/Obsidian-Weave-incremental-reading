<script lang="ts">
  import FloatingMenu from '../../ui/FloatingMenu.svelte';
  import IRScheduleImpactPreviewPanel from '../IRScheduleImpactPreviewPanel.svelte';
  import type { ScheduleItem } from '../../../services/incremental-reading/IRCalendarScheduleItem';
  import type {
    IRCalendarSchedulingAction,
    IRCalendarSchedulingDateByAction,
    IRCalendarSchedulingMenuConfigItem,
    IRCalendarSchedulingMenuPreviewState,
    IRCalendarSchedulingPreviewByAction,
  } from './ir-calendar-scheduling-menu-types';

  interface Props {
    show?: boolean;
    anchor: HTMLElement | null;
    target: ScheduleItem | null;
    schedulingConfig: IRCalendarSchedulingMenuConfigItem[];
    schedulingDateByAction: IRCalendarSchedulingDateByAction;
    schedulingPreviewFocusAction: IRCalendarSchedulingAction;
    schedulingMenuPreviewState: IRCalendarSchedulingMenuPreviewState;
    schedulingPreviewByAction: IRCalendarSchedulingPreviewByAction;
    showSchedulingPreview: boolean;
    t: (key: string, vars?: Record<string, string | number>) => string;
    onClose: () => void;
    onActivateAction: (action: IRCalendarSchedulingAction, event: MouseEvent) => void;
    onFocusAction: (action: IRCalendarSchedulingAction) => void;
  }

  let {
    show = $bindable(false),
    anchor,
    target,
    schedulingConfig,
    schedulingDateByAction,
    schedulingPreviewFocusAction = $bindable('normal'),
    schedulingMenuPreviewState,
    schedulingPreviewByAction,
    showSchedulingPreview,
    t,
    onClose,
    onActivateAction,
    onFocusAction,
  }: Props = $props();
</script>

<FloatingMenu
  bind:show
  {anchor}
  placement="left-start"
  portal={false}
  {onClose}
  class="ir-calendar-scheduling-menu"
>
  {#snippet children()}
    {#if target}
      <div class="ir-calendar-scheduling-panel">
        <div class="ir-calendar-scheduling-grid" role="group">
          {#each schedulingConfig as cfg (cfg.action)}
            <button
              type="button"
              class="ir-calendar-scheduling-btn"
              class:is-focused={schedulingPreviewFocusAction === cfg.action}
              onclick={(event) => onActivateAction(cfg.action, event)}
              onmouseenter={() => onFocusAction(cfg.action)}
              onfocus={() => onFocusAction(cfg.action)}
            >
              <span class="ir-calendar-scheduling-label" style:color={cfg.color}>{cfg.label}</span>
              {#if schedulingDateByAction[cfg.action]}
                <span class="ir-calendar-scheduling-date">{schedulingDateByAction[cfg.action]}</span>
              {:else if schedulingMenuPreviewState === 'error'}
                <span class="ir-calendar-scheduling-date is-unavailable">{t('irSidebar.scheduling.previewUnavailable')}</span>
              {:else}
                <span class="ir-calendar-scheduling-date is-unavailable">{t('irSidebar.controls.unscheduled')}</span>
              {/if}
            </button>
          {/each}
        </div>
        {#if showSchedulingPreview}
          <IRScheduleImpactPreviewPanel preview={schedulingPreviewByAction[schedulingPreviewFocusAction]} />
        {/if}
      </div>
    {/if}
  {/snippet}
</FloatingMenu>
