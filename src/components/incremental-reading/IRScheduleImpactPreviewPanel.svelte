<script lang="ts">
  export interface ImpactedPreviewItem {
    id: string;
    title: string;
    beforeDateText: string;
    afterDateText: string;
  }

  export interface PreviewDayDelta {
    dateKey: string;
    beforeMinutes: number;
    afterMinutes: number;
  }

  export interface PreviewDetails {
    headline: string;
    beforeDateText: string;
    afterDateText: string;
    changedItemCount: number;
    impactedDays: number;
    impactedItems: ImpactedPreviewItem[];
    dayDeltas: PreviewDayDelta[];
  }

  interface Props {
    preview: PreviewDetails | null;
  }

  let { preview }: Props = $props();
</script>

{#if preview}
  <div class="ir-calendar-preview-summary">
    <div class="preview-kicker">实时预览</div>
    <div class="preview-headline">
      <span class="preview-headline-label">调整后</span>
      <span class="preview-headline-value">{preview.beforeDateText} -> {preview.afterDateText}</span>
    </div>
    {#if preview.changedItemCount > 0 || preview.impactedDays > 0}
      <div class="preview-meta">
        {#if preview.changedItemCount > 0}
          <span class="preview-chip">联动 {preview.changedItemCount} 项</span>
        {/if}
        {#if preview.impactedDays > 0}
          <span class="preview-chip">影响未来 {preview.impactedDays} 天</span>
        {/if}
      </div>
    {/if}
    {#if preview.impactedItems.length > 0}
      <div class="preview-section">
        <div class="preview-section-title">联动阅读点</div>
        {#each preview.impactedItems as item}
          <div class="preview-row">
            <span class="preview-name">{item.title}</span>
            <span class="preview-change">{item.beforeDateText} -> {item.afterDateText}</span>
          </div>
        {/each}
      </div>
    {/if}
    {#if preview.dayDeltas.length > 0}
      <div class="preview-section">
        <div class="preview-section-title">负载预览</div>
        {#each preview.dayDeltas as day}
          <div class="preview-row">
            <span class="preview-name">{day.dateKey}</span>
            <span class="preview-change">{day.beforeMinutes.toFixed(1)} -> {day.afterMinutes.toFixed(1)} 分钟</span>
          </div>
        {/each}
      </div>
    {/if}
  </div>
{/if}

<style>
  .ir-calendar-preview-summary {
    margin: 6px 10px 10px;
    padding: 10px 12px;
    border-radius: 12px;
    border: 1px solid var(--background-modifier-border);
    background: linear-gradient(
      180deg,
      var(--weave-elevated-background, var(--background-secondary)),
      var(--weave-surface-background, var(--background-primary))
    );
    color: var(--text-muted);
    font-size: 11px;
    line-height: 1.45;
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.06);
  }

  .preview-kicker {
    color: var(--text-faint);
    font-size: 10px;
    letter-spacing: 0.04em;
    margin-bottom: 6px;
  }

  .preview-headline {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 8px;
    color: var(--text-normal);
    margin-bottom: 6px;
  }

  .preview-headline-label {
    font-weight: 600;
  }

  .preview-headline-value {
    font-weight: 700;
  }

  .preview-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 8px;
  }

  .preview-chip {
    display: inline-flex;
    align-items: center;
    padding: 2px 8px;
    border-radius: 999px;
    background: var(--background-modifier-hover);
    color: var(--text-muted);
    font-size: 10px;
    font-weight: 600;
  }

  .preview-section + .preview-section {
    margin-top: 10px;
  }

  .preview-section-title {
    margin-bottom: 4px;
    color: var(--text-faint);
    font-size: 10px;
    font-weight: 600;
  }

  .preview-row {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    margin-top: 4px;
  }

  .preview-name {
    color: var(--text-normal);
    min-width: 0;
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .preview-change {
    color: var(--text-muted);
    flex-shrink: 0;
  }

  @media (max-width: 768px) {
    .ir-calendar-preview-summary {
      margin-left: 6px;
      margin-right: 6px;
      padding: 10px;
    }

    .preview-row {
      flex-direction: column;
      gap: 2px;
    }

    .preview-change {
      flex-shrink: 1;
    }
  }
</style>
