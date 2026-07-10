import { describe, expect, it, vi } from "vitest";
import {
	EPUB_READER_PLUGIN_ID,
	getEpubReaderPluginAvailability,
	getEpubReaderUnavailableMessage,
	isEpubReaderPluginAvailable,
} from "../epub-reader-access";

function createApp(
	installed: Record<string, unknown> = {},
	manifests: Record<string, unknown> = {},
	enabledPluginIds: string[] = Object.keys(installed),
) {
	return {
		plugins: {
			getPlugin: vi.fn((id: string) => installed[id] ?? null),
			manifests,
			enabledPlugins: new Set(enabledPluginIds),
		},
	} as any;
}

describe("epub-reader-access", () => {
	it("detects available epub reader plugin", () => {
		const app = createApp({
			[EPUB_READER_PLUGIN_ID]: { openEpubReader: vi.fn() },
		});
		expect(getEpubReaderPluginAvailability(app)).toBe("available");
		expect(isEpubReaderPluginAvailable(app)).toBe(true);
	});

	it("detects disabled epub reader plugin", () => {
		const app = createApp(
			{},
			{ [EPUB_READER_PLUGIN_ID]: { id: EPUB_READER_PLUGIN_ID } },
			[],
		);
		expect(getEpubReaderPluginAvailability(app)).toBe("disabled");
		expect(getEpubReaderUnavailableMessage(app)).toContain("已安装但未启用");
	});

	it("detects enabled-but-not-loaded epub reader plugin", () => {
		const app = createApp(
			{},
			{ [EPUB_READER_PLUGIN_ID]: { id: EPUB_READER_PLUGIN_ID } },
			[EPUB_READER_PLUGIN_ID],
		);
		expect(getEpubReaderPluginAvailability(app)).toBe("failed");
		expect(getEpubReaderUnavailableMessage(app)).toContain("未能成功加载");
	});
});
