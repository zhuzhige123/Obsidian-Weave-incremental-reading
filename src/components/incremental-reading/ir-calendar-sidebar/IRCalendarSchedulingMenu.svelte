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

  let arrangeConfig = $derived(schedulingConfig.filter((cfg) => !cfg.isPostpone));
  let postponeConfig = $derived(schedulingConfig.filter((cfg) => cfg.isPostpone));
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
        <div class="ir-calendar-scheduling-section" role="group" aria-label={t('irSidebar.scheduling.arrangeSection')}>
          <div class="ir-calendar-scheduling-grid">
            {#each arrangeConfig as cfg (cfg.action)}
              <button
                type="button"
                class="ir-calendar-scheduling-btn"
                class:is-focused={schedulingPreviewFocusAction === cfg.action}
                disabled={cfg.disabled}
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
        </div>

        {#if postponeConfig.length > 0}
          <div class="ir-calendar-scheduling-divider" role="separator"></div>
          <div class="ir-calendar-scheduling-section is-postpone" role="group" aria-label={t('irSidebar.scheduling.postponeSection')}>
            <div class="ir-calendar-scheduling-grid">
              {#each postponeConfig as cfg (cfg.action)}
                <button
                  type="button"
                  class="ir-calendar-scheduling-btn is-postpone"
                  class:is-focused={schedulingPreviewFocusAction === cfg.action}
                  class:is-disabled={cfg.disabled}
                  disabled={cfg.disabled}
                  onclick={(event) => onActivateAction(cfg.action, event)}
                  onmouseenter={() => onFocusAction(cfg.action)}
                  onfocus={() => onFocusAction(cfg.action)}
                >
                  <span class="ir-calendar-scheduling-label-row">
                    <span class="ir-calendar-scheduling-label" style:color={cfg.color}>{cfg.label}</span>
                    {#if cfg.metaText}
                      <span class="ir-calendar-scheduling-count">{cfg.metaText}</span>
                    {/if}
                  </span>
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
          </div>
        {/if}

        {#if showSchedulingPreview}
          <IRScheduleImpactPreviewPanel preview={schedulingPreviewByAction[schedulingPreviewFocusAction]} />
        {/if}
      </div>
    {/if}
  {/snippet}
</FloatingMenu>
