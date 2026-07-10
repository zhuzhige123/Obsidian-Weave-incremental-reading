import { describe, expect, it, vi } from "vitest";
import {
	getEpubReaderInteropFailureMessage,
	hasEpubReaderTocInterop,
	resolveEpubReaderInteropFailure,
} from "../epub-reader-interop";

vi.mock("../../../utils/epub-reader-access", () => ({
	EPUB_READER_PLUGIN_ID: "weave-epub-reader",
	getEpubReaderDisplayName: () => "Weave EPUB 阅读器",
	getEpubReaderPluginAvailability: vi.fn(),
	getEpubReaderUnavailableMessage: vi.fn(() => "未检测到阅读器"),
}));

vi.mock("../../../utils/obsidian-plugin-registry", () => ({
	getObsidianPluginAs: vi.fn(),
}));

vi.mock("../../../utils/i18n", () => ({
	i18n: {
		t: vi.fn((_key: string, params?: Record<string, string>) => {
			if (
				params?.pluginId === "weave-epub-reader" &&
				_key.includes("Outdated")
			) {
				return "请更新阅读器插件";
			}
			return _key;
		}),
	},
}));

import { getEpubReaderPluginAvailability } from "../../../utils/epub-reader-access";
import { getObsidianPluginAs } from "../../../utils/obsidian-plugin-registry";

describe("epub-reader-interop", () => {
	it("detects toc interop when loadPublicationTocItems exists", () => {
		vi.mocked(getObsidianPluginAs).mockReturnValue({
			loadPublicationTocItems: vi.fn(),
		});

		expect(hasEpubReaderTocInterop({} as never)).toBe(true);
		expect(resolveEpubReaderInteropFailure({} as never)).toBeNull();
	});

	it("reports api-missing when plugin loads without toc interop", () => {
		vi.mocked(getObsidianPluginAs).mockReturnValue({
			openEpubReader: vi.fn(),
		});
		vi.mocked(getEpubReaderPluginAvailability).mockReturnValue("available");

		expect(resolveEpubReaderInteropFailure({} as never)).toBe("api-missing");
		expect(getEpubReaderInteropFailureMessage({} as never, "api-missing")).toBe(
			"请更新阅读器插件",
		);
	});
});
