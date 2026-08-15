<script lang="ts">
	interface Props {
		message?: string;
		compact?: boolean;
		showMessage?: boolean;
		class?: string;
	}

	let {
		message = "",
		compact = false,
		showMessage = true,
		class: className = "",
	}: Props = $props();
</script>

<div
	class="bouncing-balls-loader{compact ? ' bouncing-balls-loader--compact' : ''} {className}"
	role="status"
	aria-live="polite"
	aria-busy="true"
	aria-label={showMessage && message ? message : undefined}
>
	<div class="bouncing-balls-loader__wrapper" aria-hidden="true">
		<div class="bouncing-balls-loader__circle"></div>
		<div class="bouncing-balls-loader__circle"></div>
		<div class="bouncing-balls-loader__circle"></div>
		<div class="bouncing-balls-loader__shadow"></div>
		<div class="bouncing-balls-loader__shadow"></div>
		<div class="bouncing-balls-loader__shadow"></div>
	</div>
	{#if showMessage && message}
		<div class="bouncing-balls-loader__message">{message}</div>
	{/if}
</div>
