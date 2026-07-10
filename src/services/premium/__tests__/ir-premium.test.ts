import { describe, expect, it } from "vitest";
import { initI18n } from "../../../utils/i18n";
import {
	getDefaultIRPremiumFeaturePreviewId,
	getIRPremiumFeaturePreviewContent,
} from "../ir-premium";
import { IR_PREMIUM_FEATURES } from "../ir-premium-features";

describe("getIRPremiumFeaturePreviewContent", () => {
	it("returns full free and premium feature lists", () => {
		initI18n();
		const preview = getIRPremiumFeaturePreviewContent(
			IR_PREMIUM_FEATURES.IMPORT_EXTERNAL_READING_POINTS,
		);

		expect(preview.title.length).toBeGreaterThan(0);
		expect(preview.freeFeatures.length).toBeGreaterThan(1);
		expect(preview.premiumFeatures.length).toBeGreaterThan(1);
		expect(
			preview.premiumFeatures.some(
				(item) =>
					item.featureId === IR_PREMIUM_FEATURES.IMPORT_EXTERNAL_READING_POINTS,
			),
		).toBe(true);
	});

	it("uses the first premium feature as the default preview anchor", () => {
		expect(getDefaultIRPremiumFeaturePreviewId()).toBe(
			IR_PREMIUM_FEATURES.IMPORT_EXTERNAL_READING_POINTS,
		);
	});
});
