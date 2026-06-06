import {
	evaluateFolderSubscriptionSyncState,
	isFolderSubscriptionPendingNewEntry,
} from "./folder-subscription-sync-state";

describe("evaluateFolderSubscriptionSyncState", () => {
	it("仅有 YAML 阅读 id、无材料与 chunk 时仍需同步", () => {
		const state = evaluateFolderSubscriptionSyncState({
			targetDeckId: "deck-a",
			existingMaterial: null,
			existingChunk: null,
		});

		expect(state.needsSync).toBe(true);
		expect(state.syncGaps).toEqual(["missing_material", "missing_chunk"]);
		expect(isFolderSubscriptionPendingNewEntry(state.syncGaps)).toBe(true);
	});

	it("有 weave-reading-id 对应材料但未入目标专题时需要同步", () => {
		const state = evaluateFolderSubscriptionSyncState({
			targetDeckId: "deck-a",
			existingMaterial: {
				uuid: "tk-ir-1",
				readingDeckId: "deck-b",
			},
			existingChunk: null,
		});

		expect(state.syncGaps).toContain("material_deck_mismatch");
		expect(state.syncGaps).toContain("missing_chunk");
		expect(state.needsSync).toBe(true);
	});

	it("chunk 未绑定 weave-reading-id 时仍需同步", () => {
		const state = evaluateFolderSubscriptionSyncState({
			targetDeckId: "deck-a",
			existingMaterial: {
				uuid: "tk-ir-1779244549788",
				readingDeckId: "deck-a",
			},
			existingChunk: {
				filePath: "Inbox/note.md",
				deckIds: ["deck-a"],
				topicIds: ["deck-a"],
				scheduleStatus: "new",
				nextRepDate: Date.now(),
				meta: { readingMaterialId: "wrong-source-id" },
			},
		});

		expect(state.syncGaps).toContain("chunk_material_unlinked");
		expect(state.needsSync).toBe(true);
	});

	it("材料与 chunk 均已归属目标专题且调度有效时视为完整订阅", () => {
		const state = evaluateFolderSubscriptionSyncState({
			targetDeckId: "deck-a",
			existingMaterial: {
				uuid: "tk-ir-1",
				readingDeckId: "deck-a",
			},
			existingChunk: {
				filePath: "Inbox/note.md",
				deckIds: ["deck-a"],
				topicIds: ["deck-a"],
				scheduleStatus: "new",
				nextRepDate: Date.now(),
				meta: { readingMaterialId: "tk-ir-1" },
			},
		});

		expect(state.isFullySubscribed).toBe(true);
		expect(state.needsSync).toBe(false);
	});
});
