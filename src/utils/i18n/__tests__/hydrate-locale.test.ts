import { describe, expect, it } from "vitest";

import {
	applyFlatOverlay,
	flattenTranslationTree,
} from "../hydrate-locale";
import type { TranslationKey } from "../types";

describe("hydrate-locale", () => {
	it("flattens nested trees to dotted keys", () => {
		const tree: TranslationKey = {
			common: { close: "Close", nested: { ok: "OK" } },
		};
		expect(flattenTranslationTree(tree)).toEqual({
			"common.close": "Close",
			"common.nested.ok": "OK",
		});
	});

	it("overlays flat translations without dropping base keys", () => {
		const base: TranslationKey = {
			common: { close: "Close", retry: "Retry" },
		};
		const result = applyFlatOverlay(base, {
			"common.close": "閉じる",
		});
		expect(result).toEqual({
			common: { close: "閉じる", retry: "Retry" },
		});
		// Base must remain unchanged.
		expect(base).toEqual({
			common: { close: "Close", retry: "Retry" },
		});
	});
});
