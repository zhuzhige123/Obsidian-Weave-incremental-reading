import { buildExternalBookmarkTasksRevision, buildScheduleFingerprint } from "../IRScheduleFingerprint";

describe("IRScheduleFingerprint", () => {
	it("ignores history when building schedule fingerprint", () => {
		const base = {
			chunksRecord: {
				c1: {
					chunkId: "c1",
					scheduleStatus: "scheduled",
					nextRepDate: 100,
					priorityEff: 5,
					deckIds: ["d1"],
				},
			},
			blocksRecord: {},
			decksRecord: {},
			pdfTasks: [],
			epubTasks: [],
		};

		expect(
			buildScheduleFingerprint({
				...base,
				history: { sessions: [{ blockId: "x", duration: 99 }] },
			} as any)
		).toBe(buildScheduleFingerprint(base as any));
	});

	it("builds external bookmark task revision from id, updatedAt and linked notes", () => {
		const left = buildExternalBookmarkTasksRevision([
			{ id: "b", updatedAt: 2, meta: { associatedNotePaths: ["Notes/A.md"] } },
			{ id: "a", updatedAt: 1 },
		]);
		const right = buildExternalBookmarkTasksRevision([
			{ id: "a", updatedAt: 1 },
			{ id: "b", updatedAt: 2, meta: { associatedNotePaths: ["Notes/A.md"] } },
		]);
		expect(left).toBe(right);

		const withoutNotes = buildExternalBookmarkTasksRevision([{ id: "a", updatedAt: 1 }]);
		const withNotes = buildExternalBookmarkTasksRevision([
			{ id: "a", updatedAt: 1, meta: { associatedNotePaths: ["Notes/A.md"] } },
		]);
		expect(withoutNotes).not.toBe(withNotes);
	});

	it("changes schedule fingerprint when bookmark linked notes change", () => {
		const base = {
			chunksRecord: {},
			blocksRecord: {},
			decksRecord: {},
			pdfTasks: [],
			epubTasks: [
				{
					id: "epubbm-1",
					status: "scheduled",
					meta: { associatedNotePaths: ["Notes/Before.md"] },
				},
			],
		};
		const updated = {
			...base,
			epubTasks: [
				{
					id: "epubbm-1",
					status: "scheduled",
					meta: { associatedNotePaths: ["Notes/After.md"] },
				},
			],
		};

		expect(buildScheduleFingerprint(base as any)).not.toBe(buildScheduleFingerprint(updated as any));
	});
});
