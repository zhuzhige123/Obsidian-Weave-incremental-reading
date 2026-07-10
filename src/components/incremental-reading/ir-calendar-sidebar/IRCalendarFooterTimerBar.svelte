<script lang="ts">
  import ObsidianIcon from '../../ui/ObsidianIcon.svelte';

  interface Props {
    timerLabel: string;
    timerDurationLabel: string;
    onPause: () => void;
  }

  let { timerLabel, timerDurationLabel, onPause }: Props = $props();
</script>

<div class="footer-timer-bar">
  <div class="footer-timer-info">
    <span class="footer-timer-kicker">Active timer</span>
    <span class="footer-timer-title" title={timerLabel}>{timerLabel}</span>
  </div>
  <div class="footer-timer-meta">
    <span class="footer-timer-value">{timerDurationLabel}</span>
    <button
      type="button"
      class="footer-timer-pause"
      onclick={onPause}
      title="Pause timer"
      aria-label="Pause timer"
    >
      <ObsidianIcon name="pause" size={12} />
    </button>
  </div>
</div>
