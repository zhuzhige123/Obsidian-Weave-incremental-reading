import type { App } from "obsidian";
import { IR_RUNTIME } from "../incremental-reading/ir-runtime";
import { closeIRPremiumFeaturePreview, openIRPremiumFeaturePreview } from "./ir-premium-preview-ui";

export function registerIRPremiumFeaturePreviewHost(
	app: App,
	openSettings: () => void
): () => void {
	const handlePreviewRequest = (event: Event) => {
		const featureId = String(
			(event as CustomEvent<{ featureId?: string }>).detail?.featureId || ""
		).trim();
		if (!featureId) {
			return;
		}
		openIRPremiumFeaturePreview(app, featureId, openSettings);
	};

	const handlePremiumUiStateChanged = () => {
		closeIRPremiumFeaturePreview();
	};

	if (typeof window !== "undefined") {
		window.addEventListener(IR_RUNTIME.events.premiumFeaturePreviewRequest, handlePreviewRequest);
		window.addEventListener(IR_RUNTIME.events.premiumUiStateChanged, handlePremiumUiStateChanged);
	}

	return () => {
		closeIRPremiumFeaturePreview();
		if (typeof window !== "undefined") {
			window.removeEventListener(
				IR_RUNTIME.events.premiumFeaturePreviewRequest,
				handlePreviewRequest
			);
			window.removeEventListener(
				IR_RUNTIME.events.premiumUiStateChanged,
				handlePremiumUiStateChanged
			);
		}
	};
}
