import type { App } from "obsidian";
import { mount, unmount } from "svelte";
import IRPremiumFeaturePopover from "../../components/premium/IRPremiumFeaturePopover.svelte";
import { PremiumFeatureGuard } from "./PremiumFeatureGuard";

type MountedPopover = Parameters<typeof unmount>[0];

let hostEl: HTMLElement | null = null;
let popoverComponent: MountedPopover | null = null;

export function openIRPremiumFeaturePreview(
	app: App,
	featureId: string,
	openSettings?: () => void
): void {
	const normalizedFeatureId = String(featureId || "").trim();
	if (!normalizedFeatureId) {
		return;
	}

	if (PremiumFeatureGuard.getInstance().canUseFeature(normalizedFeatureId)) {
		return;
	}

	closeIRPremiumFeaturePreview();

	hostEl = document.body.createDiv("weave-ir-premium-feature-preview-host");
	popoverComponent = mount(IRPremiumFeaturePopover, {
		target: hostEl,
		props: {
			open: true,
			featureId: normalizedFeatureId,
			onClose: () => {
				closeIRPremiumFeaturePreview();
			},
			onOpenSettings: () => {
				openSettings?.();
				closeIRPremiumFeaturePreview();
			},
		},
	});

	void app;
}

export function closeIRPremiumFeaturePreview(): boolean {
	let closed = false;

	if (popoverComponent) {
		try {
			void unmount(popoverComponent);
		} catch {
			// ignore
		}
		popoverComponent = null;
		closed = true;
	}

	if (hostEl) {
		try {
			hostEl.remove();
		} catch {
			// ignore
		}
		hostEl = null;
		closed = true;
	}

	return closed;
}
