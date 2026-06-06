<script lang="ts">
  import { CardState } from "../../data/types";

  interface Props {
    state: CardState;
  }

  let { state }: Props = $props();

  const stateMap = {
    [CardState.New]: {
      text: "新卡片",
      color: "var(--color-gray)",
      bg: "color-mix(in srgb, var(--color-gray) 12%, transparent)"
    },
    [CardState.Learning]: {
      text: "学习中",
      color: "var(--color-blue)",
      bg: "color-mix(in srgb, var(--color-blue) 12%, transparent)"
    },
    [CardState.Review]: {
      text: "复习",
      color: "var(--color-green)",
      bg: "color-mix(in srgb, var(--color-green) 12%, transparent)"
    },
    [CardState.Relearning]: {
      text: "再学习",
      color: "var(--color-yellow)",
      bg: "color-mix(in srgb, var(--color-yellow) 12%, transparent)"
    }
  };

  let currentStatus = $derived(
    stateMap[state] || {
      text: "未知",
      color: "var(--color-gray)",
      bg: "color-mix(in srgb, var(--color-gray) 12%, transparent)"
    }
  );
</script>

<span
  class="status-badge"
  style="--status-color: {currentStatus.color}; --status-bg: {currentStatus.bg};"
>
  <span class="status-dot"></span>
  <span class="status-text">{currentStatus.text}</span>
</span>

<style>
  .status-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    min-height: var(--weave-table-pill-height, 22px);
    padding: 0 var(--weave-table-pill-padding-x, 8px);
    border-radius: 999px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.01em;
    white-space: nowrap;
    background: var(--status-bg);
    color: var(--status-color);
    border: 1px solid color-mix(in srgb, var(--status-color) 24%, transparent);
  }

  .status-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--status-color);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--status-color) 12%, transparent);
    flex-shrink: 0;
  }

  .status-text {
    line-height: 1;
  }

  @media (max-width: 768px) {
    .status-badge {
      gap: 4px;
      min-height: 20px;
      padding: 0 7px;
      font-size: 10px;
    }

    .status-dot {
      width: 6px;
      height: 6px;
      box-shadow: 0 0 0 2px color-mix(in srgb, var(--status-color) 12%, transparent);
    }
  }
</style>
