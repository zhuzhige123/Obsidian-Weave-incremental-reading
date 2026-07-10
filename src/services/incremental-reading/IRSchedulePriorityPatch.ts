import type { App } from "obsidian";
import { getSharedIRCalendarQueryService } from "./IRCalendarQueryService";
import type { ScheduleItem } from "./IRCalendarScheduleItem";
import { isEpubBookmarkTaskId } from "./IREpubBookmarkTaskService";
import { isPdfBookmarkTaskId } from "./IRPdfBookmarkTaskService";
import { buildScheduleFingerprintFromWorkspace } from "./IRScheduleFingerprint";
import {
	type IRScheduleSortableItem,
	collectScheduleItemDateKeys,
	patchScheduleItemPriorityFields,
	patchScheduleItemsInMapByDate,
	sortScheduleItemsForDailyQueue,
} from "./IRScheduleItemSort";
import { patchCalendarProjectionDaySlices } from "./IRScheduleRefreshService";
import {
	type IRWorkspaceDataSnapshot,
	getSharedIRWorkspaceSnapshotService,
} from "./IRWorkspaceSnapshotService";

export interface StoredSchedulePriority {
	priorityUi: number;
	priorityEff: number;
}

export interface PriorityChangePreviewDetails {
	headline: string;
	beforeDateText: string;
	afterDateText: string;
	changedItemCount: number;
	impactedDays: number;
	impactedItems: Array<{
		id: string;
		title: string;
		beforeDateText: string;
		afterDateText: string;
	}>;
	dayDeltas: Array<{
		dateKey: string;
		beforeMinutes: number;
		afterMinutes: number;
	}>;
}

export function readStoredPriorityFromWorkspaceSnapshot(
	snapshot: IRWorkspaceDataSnapshot,
	itemId: string,
): StoredSchedulePriority | null {
	const normalizedId = String(itemId || "").trim();
	if (!normalizedId) {
		return null;
	}

	const chunk = snapshot.chunksRecord[normalizedId];
	if (chunk) {
		return {
			priorityUi: Number(chunk.priorityUi ?? chunk.priorityEff ?? 5),
			priorityEff: Number(chunk.priorityEff ?? chunk.priorityUi ?? 5),
		};
	}

	if (isPdfBookmarkTaskId(normalizedId)) {
		const task = snapshot.pdfTasks.find((entry) => entry.id === normalizedId);
		if (!task) {
			return null;
		}
		return {
			priorityUi: Number(task.priorityUi ?? task.priorityEff ?? 5),
			priorityEff: Number(task.priorityEff ?? task.priorityUi ?? 5),
		};
	}

	if (isEpubBookmarkTaskId(normalizedId)) {
		const task = snapshot.epubTasks.find((entry) => entry.id === normalizedId);
		if (!task) {
			return null;
		}
		return {
			priorityUi: Number(task.priorityUi ?? task.priorityEff ?? 5),
			priorityEff: Number(task.priorityEff ?? task.priorityUi ?? 5),
		};
	}

	return null;
}

export function mergeScheduleItemDateKeys(
	itemId: string,
	materialsByDate: Map<string, IRScheduleSortableItem[]>,
	pinnedByDate: Map<string, IRScheduleSortableItem[]>,
	extraDateKeys: string[] = [],
): string[] {
	const keys = new Set(
		collectScheduleItemDateKeys(itemId, materialsByDate, pinnedByDate),
	);
	for (const key of extraDateKeys) {
		const normalized = String(key || "").trim();
		if (normalized) {
			keys.add(normalized);
		}
	}
	return Array.from(keys);
}

export function applyLocalSchedulePriorityPatch<
	T extends IRScheduleSortableItem,
>(input: {
	materialsByDate: Map<string, T[]>;
	pinnedByDate: Map<string, T[]>;
	siblingCache: Map<string, T[]>;
	itemId: string;
	priorityUi: number;
	priorityEff: number;
	dateKeys: string[];
	sortSiblingCacheByDateKey?: string;
}): {
	materialsByDate: Map<string, T[]>;
	pinnedByDate: Map<string, T[]>;
	siblingCache: Map<string, T[]>;
} {
	const dateKeys = input.dateKeys.filter(Boolean);
	const materialsByDate = patchScheduleItemsInMapByDate(
		input.materialsByDate,
		input.itemId,
		input.priorityUi,
		input.priorityEff,
		dateKeys,
	);
	const pinnedByDate = patchScheduleItemsInMapByDate(
		input.pinnedByDate,
		input.itemId,
		input.priorityUi,
		input.priorityEff,
		dateKeys,
	);
	const siblingSortKey = String(
		input.sortSiblingCacheByDateKey || dateKeys[0] || "",
	).trim();
	const siblingCache = new Map(
		Array.from(input.siblingCache.entries(), ([cacheKey, siblings]) => {
			const patched = siblings.map((item) =>
				patchScheduleItemPriorityFields(
					item,
					input.itemId,
					input.priorityUi,
					input.priorityEff,
				),
			) as T[];
			return [
				cacheKey,
				siblingSortKey
					? sortScheduleItemsForDailyQueue(patched, siblingSortKey)
					: patched,
			];
		}),
	);

	return { materialsByDate, pinnedByDate, siblingCache };
}

export async function syncScheduleMapsPrioritiesFromWorkspace<
	T extends ScheduleItem,
>(
	app: App,
	materialsByDate: Map<string, T[]>,
	pinnedByDate: Map<string, T[]>,
	dateKeys: string[],
): Promise<{
	materialsByDate: Map<string, T[]>;
	pinnedByDate: Map<string, T[]>;
}> {
	const normalizedDateKeys = dateKeys
		.map((key) => String(key || "").trim())
		.filter(Boolean);
	if (normalizedDateKeys.length === 0) {
		return { materialsByDate, pinnedByDate };
	}

	const snapshot =
		await getSharedIRWorkspaceSnapshotService(app).getWorkspaceData();
	let nextMaterials = materialsByDate;
	let nextPinned = pinnedByDate;

	for (const dateKey of normalizedDateKeys) {
		const itemIds = new Set<string>();
		for (const item of materialsByDate.get(dateKey) || []) {
			itemIds.add(item.id);
		}
		for (const item of pinnedByDate.get(dateKey) || []) {
			itemIds.add(item.id);
		}

		for (const itemId of itemIds) {
			const stored = readStoredPriorityFromWorkspaceSnapshot(snapshot, itemId);
			if (!stored) {
				continue;
			}
			nextMaterials = patchScheduleItemsInMapByDate(
				nextMaterials,
				itemId,
				stored.priorityUi,
				stored.priorityEff,
				[dateKey],
			);
			nextPinned = patchScheduleItemsInMapByDate(
				nextPinned,
				itemId,
				stored.priorityUi,
				stored.priorityEff,
				[dateKey],
			);
		}
	}

	return { materialsByDate: nextMaterials, pinnedByDate: nextPinned };
}

export async function persistSchedulePriorityDaySlices(
	app: App,
	materialsByDate: Map<string, ScheduleItem[]>,
	dateKeys: string[],
	deckIds?: string[],
): Promise<void> {
	const normalizedDateKeys = dateKeys
		.map((key) => String(key || "").trim())
		.filter(Boolean);
	if (normalizedDateKeys.length === 0) {
		return;
	}

	try {
		const queryService = getSharedIRCalendarQueryService(app);
		const workspaceData =
			await getSharedIRWorkspaceSnapshotService(app).getWorkspaceData();
		const dayPatches = new Map<string, ScheduleItem[]>();
		for (const dateKey of normalizedDateKeys) {
			const items = materialsByDate.get(dateKey);
			if (items && items.length > 0) {
				dayPatches.set(dateKey, [...items]);
			}
		}
		if (dayPatches.size === 0) {
			return;
		}

		await patchCalendarProjectionDaySlices(app, {
			cacheKey: queryService.buildQueryCacheKeyForDeckIds(deckIds, undefined),
			settingsFingerprint: queryService.getSettingsFingerprint(),
			scheduleFingerprint: buildScheduleFingerprintFromWorkspace(workspaceData),
			dayPatches,
		});
	} catch {
		// 投影写入失败不应阻断优先级保存
	}
}

export function buildPriorityChangePreviewDetails(input: {
	beforePriorityUi: number;
	afterPriorityUi: number;
	beforePriorityEff: number;
	afterPriorityEff: number;
	nextRepDate?: number;
}): PriorityChangePreviewDetails {
	const formatReviewDate = (timestamp?: number): string => {
		if (!timestamp || timestamp <= 0) {
			return "No review date";
		}
		return new Date(timestamp).toLocaleDateString();
	};
	const nextRepDate = input.nextRepDate ?? 0;

	return {
		headline: `Priority: P${input.beforePriorityUi} -> P${input.afterPriorityUi}`,
		beforeDateText: formatReviewDate(nextRepDate),
		afterDateText: formatReviewDate(nextRepDate),
		changedItemCount: 0,
		impactedDays: 0,
		impactedItems: [],
		dayDeltas: [],
	};
}
