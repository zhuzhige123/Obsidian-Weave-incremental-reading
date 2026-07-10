import type { App } from "obsidian";
import { i18n } from "../../utils/i18n";
import { IR_RUNTIME } from "../incremental-reading/ir-runtime";
import { PremiumFeatureGuard } from "./PremiumFeatureGuard";
import { IR_PREMIUM_BENEFIT_FEATURE_ORDER } from "./ir-premium-features";

export interface IRFeatureTierPreviewItem {
	title: string;
	description: string;
	featureId?: string;
}

const IR_FREE_FEATURE_KEYS = [
	"calendarAndMarkdown",
	"topicQueue",
	"basicScheduling",
	"markdownImport",
	"readingPointOps",
	"dataManagement",
] as const;

function buildIRFreeFeaturePreviewItems(): IRFeatureTierPreviewItem[] {
	return IR_FREE_FEATURE_KEYS.map((key) => ({
		title: i18n.t(`ir.premium.freeFeatures.${key}.title`),
		description: i18n.t(`ir.premium.freeFeatures.${key}.description`),
	}));
}

function buildIRPremiumFeaturePreviewMeta(): Record<
	typeof IR_PREMIUM_BENEFIT_FEATURE_ORDER[number],
	IRFeatureTierPreviewItem
> {
	return Object.fromEntries(
		IR_PREMIUM_BENEFIT_FEATURE_ORDER.map((featureId) => [
			featureId,
			{
				featureId,
				title: i18n.t(`ir.premium.premiumFeatures.${featureId}.title`),
				description: i18n.t(
					`ir.premium.premiumFeatures.${featureId}.description`,
				),
			},
		]),
	) as Record<
		typeof IR_PREMIUM_BENEFIT_FEATURE_ORDER[number],
		IRFeatureTierPreviewItem
	>;
}

export function getIRFeatureTierPreview(): {
	freeFeatures: IRFeatureTierPreviewItem[];
	premiumFeatures: IRFeatureTierPreviewItem[];
} {
	const freeFeatures = buildIRFreeFeaturePreviewItems();
	const premiumFeaturePreviewMeta = buildIRPremiumFeaturePreviewMeta();
	return {
		freeFeatures,
		premiumFeatures: IR_PREMIUM_BENEFIT_FEATURE_ORDER.map(
			(featureId) => premiumFeaturePreviewMeta[featureId],
		),
	};
}

export function getIRPremiumFeaturePreviewContent(featureId: string): {
	title: string;
	description: string;
	freeFeatures: IRFeatureTierPreviewItem[];
	premiumFeatures: IRFeatureTierPreviewItem[];
} {
	const freeFeatures = buildIRFreeFeaturePreviewItems();
	const premiumFeaturePreviewMeta = buildIRPremiumFeaturePreviewMeta();
	const normalizedFeatureId = String(featureId || "").trim();
	const featurePreview =
		premiumFeaturePreviewMeta[
			normalizedFeatureId as typeof IR_PREMIUM_BENEFIT_FEATURE_ORDER[number]
		];
	return {
		title: featurePreview?.title ?? i18n.t("ir.premium.defaultTitle"),
		description:
			featurePreview?.description ?? i18n.t("ir.premium.defaultDescription"),
		freeFeatures,
		premiumFeatures: IR_PREMIUM_BENEFIT_FEATURE_ORDER.map(
			(currentFeatureId) => premiumFeaturePreviewMeta[currentFeatureId],
		),
	};
}

export function requestIRPremiumFeaturePreview(
	_app: App,
	featureId: string,
): void {
	const normalizedFeatureId = String(featureId || "").trim();
	if (!normalizedFeatureId || typeof window === "undefined") {
		return;
	}

	window.dispatchEvent(
		new CustomEvent(IR_RUNTIME.events.premiumFeaturePreviewRequest, {
			detail: { featureId: normalizedFeatureId },
		}),
	);
}

export function ensureIRPremiumFeature(app: App, featureId: string): boolean {
	if (PremiumFeatureGuard.getInstance().canUseFeature(featureId)) {
		return true;
	}

	requestIRPremiumFeaturePreview(app, featureId);
	return false;
}

export function getDefaultIRPremiumFeaturePreviewId(): string {
	return IR_PREMIUM_BENEFIT_FEATURE_ORDER[0];
}
