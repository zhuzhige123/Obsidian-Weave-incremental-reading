import { App, TFile, TFolder } from "../../../tests/mocks/obsidian";
import {
	applyIncrementalReadingFolderSubscriptionCandidates,
	scanIncrementalReadingFolderSubscriptions,
} from "../IRFolderSubscriptionSyncService";

function buildFolder(path: string, children: Array<TFile | TFolder>): TFolder {
	const folder = new TFolder(path);
	folder.children = children;
	return folder;
}

describe("scanIncrementalReadingFolderSubscriptions", () => {
	it("只处理需要补齐的候选，并跳过已完整订阅到目标专题的文件", async () => {
		const app = new App();
		const inboxFile = new TFile("Inbox/Subscribed/article-a.md");
		const nestedFile = new TFile("Inbox/Subscribed/Nested/article-b.md");
		const syncedFile = new TFile("Inbox/Subscribed/synced.md");
		const irFile = new TFile("Inbox/Subscribed/already-ir.md");

		const nestedFolder = buildFolder("Inbox/Subscribed/Nested", [nestedFile]);
		const subscribedFolder = buildFolder("Inbox/Subscribed", [
			inboxFile,
			syncedFile,
			irFile,
			nestedFolder,
		]);
		app.vault.getAbstractFileByPath.mockImplementation((path: string) => {
			if (path === "Inbox/Subscribed") return subscribedFolder;
			if (path === "Inbox/Subscribed/Nested") return nestedFolder;
			return null;
		});
		app.metadataCache.getFileCache.mockImplementation((file: TFile) => {
			if (file.path === irFile.path) {
				return { frontmatter: { weave_type: "ir-point" } };
			}
			if (file.path === syncedFile.path) {
				return { frontmatter: { "weave-reading-id": "mat-synced" } };
			}
			return null;
		});

		const result = await scanIncrementalReadingFolderSubscriptions({
			app: app as any,
			settings: {
				rules: [
					{
						id: "rule-root",
						enabled: true,
						folderPath: "Inbox/Subscribed",
						deckId: "deck-root",
					},
					{
						id: "rule-nested",
						enabled: true,
						folderPath: "Inbox/Subscribed/Nested",
						deckId: "deck-nested",
					},
				],
				importConfirmThreshold: 20,
				initialScheduleMode: "today",
			},
			existingChunks: [
				{
					filePath: inboxFile.path,
					deckIds: ["deck-other"],
					topicIds: ["deck-other"],
					scheduleStatus: "new",
					nextRepDate: Date.now(),
				},
				{
					filePath: syncedFile.path,
					deckIds: ["deck-root"],
					topicIds: ["deck-root"],
					scheduleStatus: "new",
					nextRepDate: Date.now(),
					meta: { readingMaterialId: "mat-synced" },
				},
			],
			existingMaterials: [
				{
					uuid: "mat-synced",
					filePath: syncedFile.path,
					readingDeckId: "deck-root",
				},
			],
			deckNameById: {
				"deck-root": "根专题",
				"deck-nested": "嵌套专题",
			},
		});

		expect(result.scannedMarkdownCount).toBe(4);
		expect(result.activeRuleCount).toBe(2);
		expect(result.pendingCount).toBe(2);
		expect(result.candidates).toHaveLength(2);

		const inboxCandidate = result.candidates.find(
			(entry) => entry.file.path === inboxFile.path,
		);
		const nestedCandidate = result.candidates.find(
			(entry) => entry.file.path === nestedFile.path,
		);
		expect(inboxCandidate?.syncGaps).toContain("chunk_deck_mismatch");
		expect(nestedCandidate?.syncGaps).toEqual([
			"missing_material",
			"missing_chunk",
		]);
		expect(
			result.candidates.some((entry) => entry.file.path === syncedFile.path),
		).toBe(false);

		expect(result.ruleSummaries).toEqual([
			{
				ruleId: "rule-root",
				folderPath: "Inbox/Subscribed",
				deckId: "deck-root",
				deckName: "根专题",
				matchedCount: 2,
				pendingCount: 1,
			},
			{
				ruleId: "rule-nested",
				folderPath: "Inbox/Subscribed/Nested",
				deckId: "deck-nested",
				deckName: "嵌套专题",
				matchedCount: 1,
				pendingCount: 1,
			},
		]);
	});

	it("扫描结果不包含订阅文件夹内的图片等非 Markdown 文件", async () => {
		const app = new App();
		const article = new TFile("Inbox/Subscribed/article.md");
		const image = new TFile("Inbox/Subscribed/cover.png");
		const pdf = new TFile("Inbox/Subscribed/slides.pdf");

		const subscribedFolder = buildFolder("Inbox/Subscribed", [
			article,
			image,
			pdf,
		]);
		app.vault.getAbstractFileByPath.mockImplementation((path: string) => {
			if (path === "Inbox/Subscribed") return subscribedFolder;
			return null;
		});

		const result = await scanIncrementalReadingFolderSubscriptions({
			app: app as any,
			settings: {
				rules: [
					{
						id: "rule-1",
						enabled: true,
						folderPath: "Inbox/Subscribed",
						deckId: "deck-1",
					},
				],
			},
			existingChunks: [],
			existingMaterials: [],
			deckNameById: { "deck-1": "专题 A" },
		});

		expect(result.scannedMarkdownCount).toBe(1);
		expect(result.pendingCount).toBe(1);
		expect(result.candidates.map((entry) => entry.file.path)).toEqual([
			"Inbox/Subscribed/article.md",
		]);
	});

	it("应用订阅候选时会先补齐阅读材料和 YAML，再写入专题与调度", async () => {
		const file = new TFile("Inbox/Subscribed/article-a.md");
		const getOrCreateMaterial = vi.fn(async () => ({ uuid: "mat-1" }));
		const setReadingDeck = vi.fn(async () => true);
		const ensureChunkScheduled = vi.fn(async () => true);

		const result = await applyIncrementalReadingFolderSubscriptionCandidates({
			candidates: [
				{
					file,
					rule: {
						id: "rule-1",
						enabled: true,
						folderPath: "Inbox/Subscribed",
						deckId: "deck-1",
					},
					deckName: "专题 A",
					hasChunkRecord: false,
					isFullySubscribed: false,
					needsSync: true,
					syncGaps: ["missing_material", "missing_chunk"],
					existsAlready: false,
				},
			],
			pinToToday: true,
			remainingTodaySlots: 10,
			getOrCreateMaterial,
			setReadingDeck,
			ensureChunkScheduled,
		});

		expect(result).toEqual({
			added: 1,
			updated: 0,
			unchanged: 0,
			addedFiles: ["Inbox/Subscribed/article-a.md"],
			updatedFiles: [],
			unchangedFiles: [],
		});
		expect(setReadingDeck).toHaveBeenCalledWith("mat-1", "deck-1");
		expect(ensureChunkScheduled).toHaveBeenCalledWith(
			file,
			"deck-1",
			"专题 A",
			expect.objectContaining({
				readingMaterialId: "mat-1",
				pinToToday: true,
				pendingAdmission: false,
			}),
		);
	});

	it("添加到今天：批量新材料全部钉今天，不进入待放出", async () => {
		const files = [
			new TFile("Inbox/Subscribed/a.md"),
			new TFile("Inbox/Subscribed/b.md"),
			new TFile("Inbox/Subscribed/c.md"),
		];
		const getOrCreateMaterial = vi.fn(async (file: TFile) => ({
			uuid: `mat-${file.basename}`,
		}));
		const setReadingDeck = vi.fn(async () => true);
		const ensureChunkScheduled = vi.fn(async () => true);

		await applyIncrementalReadingFolderSubscriptionCandidates({
			candidates: files.map((file) => ({
				file,
				rule: {
					id: "rule-1",
					enabled: true,
					folderPath: "Inbox/Subscribed",
					deckId: "deck-1",
				},
				deckName: "专题 A",
				hasChunkRecord: false,
				isFullySubscribed: false,
				needsSync: true,
				syncGaps: ["missing_material", "missing_chunk"],
				existsAlready: false,
			})),
			pinToToday: true,
			remainingTodaySlots: 10,
			getOrCreateMaterial,
			setReadingDeck,
			ensureChunkScheduled,
		});

		expect(ensureChunkScheduled).toHaveBeenCalledTimes(3);
		for (const call of ensureChunkScheduled.mock.calls) {
			expect(call[3]).toEqual(
				expect.objectContaining({
					pinToToday: true,
					pendingAdmission: false,
				}),
			);
		}
	});

	it("添加到今天：超出剩余名额的部分进入待放出", async () => {
		const files = [
			new TFile("Inbox/Subscribed/a.md"),
			new TFile("Inbox/Subscribed/b.md"),
			new TFile("Inbox/Subscribed/c.md"),
		];
		const getOrCreateMaterial = vi.fn(async (file: TFile) => ({
			uuid: `mat-${file.basename}`,
		}));
		const setReadingDeck = vi.fn(async () => true);
		const ensureChunkScheduled = vi.fn(async () => true);

		await applyIncrementalReadingFolderSubscriptionCandidates({
			candidates: files.map((file) => ({
				file,
				rule: {
					id: "rule-1",
					enabled: true,
					folderPath: "Inbox/Subscribed",
					deckId: "deck-1",
				},
				deckName: "专题 A",
				hasChunkRecord: false,
				isFullySubscribed: false,
				needsSync: true,
				syncGaps: ["missing_material", "missing_chunk"],
				existsAlready: false,
			})),
			pinToToday: true,
			remainingTodaySlots: 1,
			getOrCreateMaterial,
			setReadingDeck,
			ensureChunkScheduled,
		});

		const optionsList = ensureChunkScheduled.mock.calls.map(
			(call) =>
				call[3] as {
					pinToToday: boolean;
					pendingAdmission?: boolean;
				},
		);
		expect(optionsList.filter((o) => o.pinToToday && !o.pendingAdmission)).toHaveLength(
			1,
		);
		expect(optionsList.filter((o) => o.pendingAdmission)).toHaveLength(2);
	});

	it("按算法正常调度：批量新材料入库待放出，不预填未来 due", async () => {
		const files = [
			new TFile("Inbox/Subscribed/a.md"),
			new TFile("Inbox/Subscribed/b.md"),
			new TFile("Inbox/Subscribed/c.md"),
		];
		const getOrCreateMaterial = vi.fn(async (file: TFile) => ({
			uuid: `mat-${file.basename}`,
		}));
		const setReadingDeck = vi.fn(async () => true);
		const ensureChunkScheduled = vi.fn(async () => true);

		await applyIncrementalReadingFolderSubscriptionCandidates({
			candidates: files.map((file) => ({
				file,
				rule: {
					id: "rule-1",
					enabled: true,
					folderPath: "Inbox/Subscribed",
					deckId: "deck-1",
				},
				deckName: "专题 A",
				hasChunkRecord: false,
				isFullySubscribed: false,
				needsSync: true,
				syncGaps: ["missing_material", "missing_chunk"],
				existsAlready: false,
			})),
			pinToToday: false,
			getOrCreateMaterial,
			setReadingDeck,
			ensureChunkScheduled,
		});

		expect(ensureChunkScheduled).toHaveBeenCalledTimes(3);
		const optionsList = ensureChunkScheduled.mock.calls.map((call) => {
			const options = call[3] as {
				pinToToday: boolean;
				pendingAdmission?: boolean;
				sourceSequenceGroup?: string;
				sourceSequenceOrder?: number;
				scheduleDate?: Date;
			};
			expect(options.pinToToday).toBe(false);
			expect(options.pendingAdmission).toBe(true);
			expect(options.scheduleDate).toBeUndefined();
			expect(String(options.sourceSequenceGroup || "")).toContain(
				"folder-sub-",
			);
			return options.sourceSequenceOrder;
		});
		expect(optionsList).toEqual([1, 2, 3]);
	});

	it("应用阶段也会跳过非 Markdown 候选，避免误创建阅读点", async () => {
		const image = new TFile("Inbox/Subscribed/cover.png");
		const getOrCreateMaterial = vi.fn(async () => ({ uuid: "mat-1" }));
		const setReadingDeck = vi.fn(async () => true);
		const ensureChunkScheduled = vi.fn(async () => true);

		const result = await applyIncrementalReadingFolderSubscriptionCandidates({
			candidates: [
				{
					file: image,
					rule: {
						id: "rule-1",
						enabled: true,
						folderPath: "Inbox/Subscribed",
						deckId: "deck-1",
					},
					deckName: "专题 A",
					hasChunkRecord: false,
					isFullySubscribed: false,
					needsSync: true,
					syncGaps: ["missing_material", "missing_chunk"],
					existsAlready: false,
				},
			],
			pinToToday: true,
			getOrCreateMaterial,
			setReadingDeck,
			ensureChunkScheduled,
		});

		expect(result).toEqual({
			added: 0,
			updated: 0,
			unchanged: 0,
			addedFiles: [],
			updatedFiles: [],
			unchangedFiles: [],
		});
		expect(getOrCreateMaterial).not.toHaveBeenCalled();
		expect(setReadingDeck).not.toHaveBeenCalled();
		expect(ensureChunkScheduled).not.toHaveBeenCalled();
	});

	it("仅有 weave-reading-id、无材料与 chunk 时仍会进入待同步候选", async () => {
		const app = new App();
		const subscribedFile = new TFile("Inbox/Subscribed/with-reading-id.md");

		const subscribedFolder = buildFolder("Inbox/Subscribed", [subscribedFile]);
		app.vault.getAbstractFileByPath.mockImplementation((path: string) => {
			if (path === "Inbox/Subscribed") return subscribedFolder as any;
			return null;
		});
		app.metadataCache.getFileCache.mockImplementation((file: TFile) => {
			if (file.path === subscribedFile.path) {
				return { frontmatter: { "weave-reading-id": "tk-ir-1779244549788" } };
			}
			return null;
		});

		const result = await scanIncrementalReadingFolderSubscriptions({
			app: app as any,
			settings: {
				rules: [
					{
						id: "rule-1",
						enabled: true,
						folderPath: "Inbox/Subscribed",
						deckId: "deck-1",
					},
				],
			},
			existingChunks: [],
			existingMaterials: [],
			deckNameById: { "deck-1": "专题 A" },
		});

		expect(result.pendingCount).toBe(1);
		expect(result.candidates).toHaveLength(1);
		expect(result.candidates[0]?.syncGaps).toEqual([
			"missing_material",
			"missing_chunk",
		]);
	});

	it("limitToFiles 只评估指定文件，不扫整棵订阅树", async () => {
		const app = new App();
		const target = new TFile("Inbox/Subscribed/new.md");
		const sibling = new TFile("Inbox/Subscribed/old.md");
		const subscribedFolder = buildFolder("Inbox/Subscribed", [target, sibling]);
		app.vault.getAbstractFileByPath.mockImplementation((path: string) => {
			if (path === "Inbox/Subscribed") return subscribedFolder;
			if (path === target.path) return target;
			if (path === sibling.path) return sibling;
			return null;
		});

		const result = await scanIncrementalReadingFolderSubscriptions({
			app: app as any,
			settings: {
				rules: [
					{
						id: "rule-1",
						enabled: true,
						folderPath: "Inbox/Subscribed",
						deckId: "deck-1",
					},
				],
			},
			existingChunks: [],
			existingMaterials: [],
			deckNameById: { "deck-1": "专题 A" },
			limitToFiles: [target],
		});

		expect(result.scannedMarkdownCount).toBe(1);
		expect(result.pendingCount).toBe(1);
		expect(result.candidates.map((entry) => entry.file.path)).toEqual([
			target.path,
		]);
	});

	it("limitToFilePaths 忽略规则外路径与非 md", async () => {
		const app = new App();
		const inside = new TFile("Inbox/Subscribed/new.md");
		const outside = new TFile("Elsewhere/other.md");
		app.vault.getAbstractFileByPath.mockImplementation((path: string) => {
			if (path === inside.path) return inside;
			if (path === outside.path) return outside;
			return null;
		});

		const result = await scanIncrementalReadingFolderSubscriptions({
			app: app as any,
			settings: {
				rules: [
					{
						id: "rule-1",
						enabled: true,
						folderPath: "Inbox/Subscribed",
						deckId: "deck-1",
					},
				],
			},
			existingChunks: [],
			existingMaterials: [],
			deckNameById: { "deck-1": "专题 A" },
			limitToFilePaths: [
				inside.path,
				outside.path,
				"Inbox/Subscribed/cover.png",
				"Inbox/Subscribed/missing.md",
			],
		});

		expect(result.scannedMarkdownCount).toBe(1);
		expect(result.candidates.map((entry) => entry.file.path)).toEqual([
			inside.path,
		]);
	});
});
