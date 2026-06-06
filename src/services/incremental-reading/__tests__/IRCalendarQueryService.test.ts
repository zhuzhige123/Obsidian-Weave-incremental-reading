
import { buildScheduleFingerprint } from "../IRScheduleFingerprint";
import { IRCalendarQueryService } from "../IRCalendarQueryService";

describe("IRCalendarQueryService cache title normalization", () => {
	it("normalizes stale cached pdf and epub items when attaching runtime context", () => {
		const service = new IRCalendarQueryService({} as any);
		const stalePdfItem = {
			id: "pdf-1",
			title: "第一章 / 第二节 / PDF 阅读点",
			sourceFile: "Books/Test.pdf",
			priority: 5,
			intervalDays: 1,
			scheduleStatus: "new",
			nextRepDate: 0,
			nextReviewDate: null,
			sourceType: "pdf",
		} as any;
		const staleEpubItem = {
			id: "epub-1",
			title: "第一部分 / 第二章 / EPUB 阅读点",
			sourceFile: "Books/Test.epub",
			priority: 5,
			intervalDays: 1,
			scheduleStatus: "new",
			nextRepDate: 0,
			nextReviewDate: null,
			sourceType: "epub",
		} as any;
		const legacyItem = {
			id: "legacy-1",
			title: "第一章 / 第二节 / 旧块",
			sourceFile: "Notes/Test.md",
			priority: 5,
			intervalDays: 1,
			scheduleStatus: "new",
			nextRepDate: 0,
			nextReviewDate: null,
			sourceType: "legacy-block",
		} as any;

		const result = (service as any).attachRuntimeContext(
			{
				workspaceData: { generatedAt: 1 } as any,
				readingMaterials: [],
				materialsByDate: new Map([["2026-05-01", [stalePdfItem, legacyItem]]]),
				continueReadingSuspendedItemsPool: [staleEpubItem],
				schedule: { generatedAt: 2, version: 1, deckIds: [], days: [] },
				scope: { deckIds: [], cacheKey: "__all__::__default__", stateKey: "old" },
			},
			{ generatedAt: 1 } as any,
			[],
			{ deckIds: [], cacheKey: "__all__::__default__" }
		);

		expect(result.materialsByDate.get("2026-05-01")?.[0]?.displayName).toBe("PDF 阅读点");
		expect(result.continueReadingSuspendedItemsPool[0]?.displayName).toBe("EPUB 阅读点");
		expect(result.materialsByDate.get("2026-05-01")?.[1]?.displayName).toBeUndefined();
	});

	it("normalizes hydrated disk-cache epub items with missing displayName", () => {
		const service = new IRCalendarQueryService({} as any);
		const hydrated = (service as any).hydrateScheduleItem({
			id: "epub-1",
			title: "第一部分 / 第二章 / EPUB 阅读点",
			sourceFile: "Books/Test.epub",
			priority: 5,
			intervalDays: 1,
			scheduleStatus: "new",
			nextRepDate: 0,
			nextReviewDate: null,
			sourceType: "epub",
		});

		expect(hydrated.displayName).toBe("EPUB 阅读点");
	});

	it("drops disk cache entries from older cache versions", () => {
		const service = new IRCalendarQueryService({} as any);
		const normalized = (service as any).normalizeDiskCacheStore({
			version: "1.2.0",
			lastUpdated: new Date().toISOString(),
			entries: {
				foo: {
					scheduleFingerprint: "w",
					settingsFingerprint: "s",
					savedAt: new Date().toISOString(),
					result: {
						materialsByDate: [],
						continueReadingSuspendedItemsPool: [],
						schedule: { generatedAt: 1, version: 1, deckIds: [], days: [] },
						scope: { deckIds: [], cacheKey: "k" },
					},
				},
			},
		});

		expect(normalized.version).toBe("1.3.0");
		expect(normalized.entries).toEqual({});
	});

	it("builds schedule fingerprint from schedule fields only", () => {
		const baseWorkspace = {
			generatedAt: 1,
			decksRecord: { d1: { id: "d1", blockIds: ["b1"] } },
			blocksRecord: {},
			chunksRecord: {
				c1: {
					chunkId: "c1",
					scheduleStatus: "scheduled",
					nextRepDate: 100,
					priorityEff: 5,
					deckIds: ["d1"],
				},
			},
			sourcesRecord: {},
			history: { sessions: [{ blockId: "x", duration: 99 }] },
			pdfTasks: [],
			epubTasks: [],
		};

		const fingerprintA = buildScheduleFingerprint(baseWorkspace);
		const fingerprintB = buildScheduleFingerprint({
			...baseWorkspace,
			history: { sessions: [{ blockId: "y", duration: 1 }] },
			sourcesRecord: { s1: { sourceId: "s1", originalPath: "a.md" } },
		});
		const fingerprintC = buildScheduleFingerprint({
			...baseWorkspace,
			chunksRecord: {
				c1: {
					...baseWorkspace.chunksRecord.c1,
					nextRepDate: 200,
				},
			},
		});

		expect(fingerprintA).toBe(fingerprintB);
		expect(fingerprintA).not.toBe(fingerprintC);
	});
});
