<script lang="ts">
	import { onMount } from 'svelte';
	import { getIRPremiumFeaturePreviewContent } from '../../services/premium/ir-premium';
	import { currentLanguage, tr } from '../../utils/i18n';

	interface Props {
		open: boolean;
		featureId: string | null;
		onClose: () => void;
		onOpenSettings?: () => void;
	}

	let {
		open,
		featureId,
		onClose,
		onOpenSettings,
	}: Props = $props();
	let t = $derived($tr);

	let popoverEl: HTMLDivElement | undefined = $state(undefined);

	let previewContent = $derived.by(() => {
		void $currentLanguage;
		return getIRPremiumFeaturePreviewContent(String(featureId || '').trim());
	});

	function handlePointerDownOutside(event: MouseEvent) {
		if (!open || !popoverEl) {
			return;
		}
		if (popoverEl.contains(event.target as Node)) {
			return;
		}
		onClose();
	}

	function handleKeydown(event: KeyboardEvent) {
		if (!open || !popoverEl) {
			return;
		}
		const target = event.target;
		if (!(target instanceof Node) || !popoverEl.contains(target)) {
			return;
		}
		if (event.key === 'Escape') {
			onClose();
		}
	}

	function focusPopover(): void {
		if (!open || !popoverEl) {
			return;
		}
		try {
			popoverEl.focus({ preventScroll: true });
		} catch {
			popoverEl.focus();
		}
	}

	$effect(() => {
		if (!open) {
			return;
		}
		queueMicrotask(() => focusPopover());
	});

	onMount(() => {
		activeDocument.addEventListener('mousedown', handlePointerDownOutside);
		return () => {
			activeDocument.removeEventListener('mousedown', handlePointerDownOutside);
		};
	});
</script>

{#if open && featureId}
	<div class="weave-ir-premium-feature-popover-overlay">
		<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="weave-ir-premium-feature-popover"
			bind:this={popoverEl}
			tabindex="-1"
			onkeydown={handleKeydown}
		>
			<div class="weave-ir-premium-feature-popover__header">
				<div class="weave-ir-premium-feature-popover__title">{previewContent.title}</div>
				<p class="weave-ir-premium-feature-popover__description">{previewContent.description}</p>
			</div>

			<div class="weave-ir-premium-feature-popover__columns">
				<section class="weave-ir-premium-feature-popover__column">
					<div class="weave-ir-premium-feature-popover__column-title">{t('ir.premium.freeColumnTitle')}</div>
					<div class="weave-ir-premium-feature-popover__feature-list">
						{#each previewContent.freeFeatures as item}
							<div class="weave-ir-premium-feature-popover__feature-item">
								<div class="weave-ir-premium-feature-popover__feature-name">{item.title}</div>
								<div class="weave-ir-premium-feature-popover__feature-desc">{item.description}</div>
							</div>
						{/each}
					</div>
				</section>

				<section class="weave-ir-premium-feature-popover__column weave-ir-premium-feature-popover__column--premium">
					<div class="weave-ir-premium-feature-popover__column-title">{t('ir.premium.premiumColumnTitle')}</div>
					<div class="weave-ir-premium-feature-popover__feature-list">
						{#each previewContent.premiumFeatures as item}
							<div class="weave-ir-premium-feature-popover__feature-item" class:is-active={item.featureId === featureId}>
								<div class="weave-ir-premium-feature-popover__feature-name">{item.title}</div>
								<div class="weave-ir-premium-feature-popover__feature-desc">{item.description}</div>
							</div>
						{/each}
					</div>
				</section>
			</div>

			<div class="weave-ir-premium-feature-popover__actions">
				<button type="button" class="weave-ir-premium-feature-popover__secondary" onclick={onClose}>{t('ir.premium.continueBasicReading')}</button>
				{#if onOpenSettings}
					<button type="button" class="weave-ir-premium-feature-popover__primary" onclick={() => onOpenSettings?.()}>{t('ir.premium.openLicenseSettings')}</button>
				{/if}
			</div>
		</div>
	</div>
{/if}

<style>
	.weave-ir-premium-feature-popover-overlay {
		position: fixed;
		inset: 0;
		z-index: calc(var(--layer-popover, 1000) + 48);
		display: flex;
		align-items: flex-start;
		justify-content: center;
		padding: 48px 20px 20px;
		pointer-events: auto;
	}

	.weave-ir-premium-feature-popover {
		width: min(760px, calc(100vw - 40px));
		max-height: min(78vh, 680px);
		overflow: auto;
		display: flex;
		flex-direction: column;
		gap: var(--size-4-4);
		padding: var(--size-4-4);
		border-radius: var(--modal-radius, var(--radius-l));
		border: 1px solid color-mix(in srgb, var(--background-modifier-border) 74%, transparent);
		background: color-mix(in srgb, var(--background-primary) 94%, var(--background-secondary) 6%);
		box-shadow: var(--shadow-l);
	}

	.weave-ir-premium-feature-popover__header {
		display: flex;
		flex-direction: column;
		gap: var(--size-2-2);
	}

	.weave-ir-premium-feature-popover__title {
		font-size: calc(var(--font-text-size) * 1.15);
		font-weight: 700;
		color: var(--text-normal);
	}

	.weave-ir-premium-feature-popover__description {
		margin: 0;
		color: var(--text-muted);
		line-height: 1.7;
	}

	.weave-ir-premium-feature-popover__columns {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: var(--size-4-3);
	}

	.weave-ir-premium-feature-popover__column {
		display: flex;
		flex-direction: column;
		gap: var(--size-4-2);
		padding: var(--size-4-3);
		border-radius: var(--radius-l);
		background: color-mix(in srgb, var(--background-secondary) 86%, transparent);
		border: 1px solid color-mix(in srgb, var(--background-modifier-border) 76%, transparent);
	}

	.weave-ir-premium-feature-popover__column--premium {
		background: color-mix(in srgb, var(--interactive-accent) 10%, var(--background-secondary) 90%);
	}

	.weave-ir-premium-feature-popover__column-title {
		font-size: var(--font-ui-small);
		font-weight: 700;
		color: var(--text-normal);
	}

	.weave-ir-premium-feature-popover__feature-list {
		display: flex;
		flex-direction: column;
		gap: var(--size-4-2);
	}

	.weave-ir-premium-feature-popover__feature-item {
		display: flex;
		flex-direction: column;
		gap: var(--size-2-2);
		padding: var(--size-2-3) var(--size-4-3);
		border-radius: var(--radius-l);
		background: color-mix(in srgb, var(--background-primary) 88%, transparent);
		border: 1px solid transparent;
	}

	.weave-ir-premium-feature-popover__feature-item.is-active {
		border-color: color-mix(in srgb, var(--interactive-accent) 52%, transparent);
		box-shadow: 0 0 0 1px color-mix(in srgb, var(--interactive-accent) 18%, transparent);
	}

	.weave-ir-premium-feature-popover__feature-name {
		font-size: var(--font-ui-small);
		font-weight: 600;
		color: var(--text-normal);
	}

	.weave-ir-premium-feature-popover__feature-desc {
		font-size: var(--font-ui-smaller);
		line-height: 1.65;
		color: var(--text-muted);
	}

	.weave-ir-premium-feature-popover__actions {
		display: flex;
		justify-content: flex-end;
		gap: var(--size-4-3);
		flex-wrap: wrap;
	}

	.weave-ir-premium-feature-popover__secondary,
	.weave-ir-premium-feature-popover__primary {
		border-radius: var(--radius-s);
		padding: 0.55rem 0.95rem;
		font-size: var(--font-ui-small);
		font-weight: 600;
		cursor: pointer;
	}

	.weave-ir-premium-feature-popover__secondary {
		border: 0;
		background: transparent;
		color: var(--text-muted);
		padding-inline: 0;
	}

	.weave-ir-premium-feature-popover__primary {
		border: 1px solid var(--interactive-accent);
		background: var(--interactive-accent);
		color: var(--text-on-accent);
	}

	.weave-ir-premium-feature-popover__primary:hover {
		background: var(--interactive-accent-hover);
	}

	@media (max-width: 720px) {
		.weave-ir-premium-feature-popover-overlay {
			padding: 20px 12px 12px;
			align-items: stretch;
		}

		.weave-ir-premium-feature-popover {
			width: 100%;
			max-height: none;
		}

		.weave-ir-premium-feature-popover__columns {
			grid-template-columns: 1fr;
		}

		.weave-ir-premium-feature-popover__actions {
			justify-content: space-between;
		}
	}
</style>
