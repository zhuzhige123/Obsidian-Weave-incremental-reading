import { describe, expect, it, vi } from "vitest";
import { EpubError } from "../epub-error";
import { loadEpubTocForIrImport } from "../ir-epub-toc-loader";

vi.mock("../epub-reader-interop", () => ({
	getEpubReaderInteropHost: vi.fn(),
	resolveEpubReaderInteropFailure: vi.fn(),
	getEpubReaderInteropFailureMessage: vi.fn(),
}));

import {
	getEpubReaderInteropFailureMessage,
	getEpubReaderInteropHost,
	resolveEpubReaderInteropFailure,
} from "../epub-reader-interop";

describe("loadEpubTocForIrImport", () => {
	it("delegates to reader plugin when interop API is available", async () => {
		const loadPublicationTocItems = vi.fn(async () => [
			{ id: "1", label: "Chapter 1", href: "chapter1.xhtml", level: 1 },
		]);
		vi.mocked(getEpubReaderInteropHost).mockReturnValue({ loadPublicationTocItems });

		const items = await loadEpubTocForIrImport({} as never, "Books/demo.epub");

		expect(loadPublicationTocItems).toHaveBeenCalledWith("Books/demo.epub");
		expect(items).toHaveLength(1);
	});

	it("throws EpubError when reader is installed but API is missing", async () => {
		vi.mocked(getEpubReaderInteropHost).mockReturnValue({ openEpubReader: vi.fn() } as never);
		vi.mocked(resolveEpubReaderInteropFailure).mockReturnValue("api-missing");
		vi.mocked(getEpubReaderInteropFailureMessage).mockReturnValue("请更新阅读器插件");

		await expect(loadEpubTocForIrImport({} as never, "Books/demo.epub")).rejects.toMatchObject({
			code: "reader_interop_unavailable",
			message: "请更新阅读器插件",
		} satisfies Partial<EpubError>);
	});
});
