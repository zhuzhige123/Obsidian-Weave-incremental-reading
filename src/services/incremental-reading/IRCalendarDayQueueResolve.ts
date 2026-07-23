import type { ScheduleItem } from "./IRCalendarScheduleItem";
import { assembleScheduleItemsForDailyQueue } from "./IRScheduleItemSort";

/**
 * pinned 在日队列中的角色：
 * - merge：历史日 — pinned 为已完成 hydrate 主源，与 materials 并集
 * - completed_gapfill：活跃日过渡 — 仅补齐 materials 缺失的已完成实体
 * - ignore：活跃日 L1 全日队列 — 只读 materials（+ overrides）
 */
export type DayQueuePinnedRole = "merge" | "completed_gapfill" | "ignore";

export interface ResolveDayQueueForDisplayInput {
	dateKey: string;
	/** 投影 / due 活跃队列；L1 patch 后应为含已完成沉底的全日队列。 */
	materials?: Iterable<ScheduleItem>;
	/** 历史日 hydrate；活跃日不应再作为列表主源。 */
	pinned?: Iterable<ScheduleItem>;
	/** calendar-progress 完成顺序。 */
	completedIds?: Iterable<string>;
	itemOverrides?: Map<string, ScheduleItem>;
	pinnedRole?: DayQueuePinnedRole;
}

function normalizeCompletedIds(completedIds?: Iterable<string>): string[] {
	return Array.from(
		new Set(
			Array.from(completedIds || [])
				.map((id) => String(id || "").trim())
				.filter(Boolean),
		),
	);
}

function collectItemsById(
	items: Iterable<ScheduleItem> | undefined,
): Map<string, ScheduleItem> {
	const byId = new Map<string, ScheduleItem>();
	for (const item of items || []) {
		const id = String(item?.id || "").trim();
		if (id) {
			byId.set(id, item);
		}
	}
	return byId;
}

/**
 * 按 pinnedRole 选出可并入展示队列的 pinned 项。
 */
export function selectPinnedItemsForDayQueue(input: {
	materials: Iterable<ScheduleItem>;
	pinned: Iterable<ScheduleItem>;
	completedIds?: Iterable<string>;
	pinnedRole?: DayQueuePinnedRole;
}): ScheduleItem[] {
	const role = input.pinnedRole || "merge";
	if (role === "ignore") {
		return [];
	}
	const pinned = Array.from(input.pinned || []);
	if (role === "merge") {
		return pinned;
	}
	const materialIds = new Set(collectItemsById(input.materials).keys());
	const completed = new Set(normalizeCompletedIds(input.completedIds));
	return pinned.filter((item) => {
		const id = String(item?.id || "").trim();
		return Boolean(id && completed.has(id) && !materialIds.has(id));
	});
}

/**
 * 月历阅读材料列表的唯一装配入口。
 *
 * 契约：
 * - 活跃日（ignore / completed_gapfill）：materials 为全日队列真相
 * - 历史日（merge）：pinned 承载已完成 hydrate
 * - 最终形状 = assemble(completedIds) 的全日队列
 */
export function resolveDayQueueForDisplay(
	input: ResolveDayQueueForDisplayInput,
): ScheduleItem[] {
	const dateKey = String(input.dateKey || "").trim();
	if (!dateKey) {
		return [];
	}

	const completedIds = normalizeCompletedIds(input.completedIds);
	const materials = Array.from(input.materials || []);
	const pinned = selectPinnedItemsForDayQueue({
		materials,
		pinned: input.pinned || [],
		completedIds,
		pinnedRole: input.pinnedRole,
	});

	const byId = collectItemsById(materials);
	for (const item of pinned) {
		const id = String(item?.id || "").trim();
		if (id) {
			byId.set(id, item);
		}
	}
	for (const [rawId, item] of input.itemOverrides || []) {
		const id = String(rawId || item?.id || "").trim();
		if (id && item) {
			byId.set(id, item);
		}
	}

	return assembleScheduleItemsForDailyQueue([...byId.values()], dateKey, {
		completedIds,
		completedIdOrder: completedIds,
	});
}

/**
 * 从按日 Map 解析展示队列（侧栏 / 测试共用）。
 */
export function resolveDayQueueFromDateMaps(input: {
	dateKey: string;
	materialsByDate: Map<string, ScheduleItem[]>;
	pinnedByDate: Map<string, ScheduleItem[]>;
	completedIdsByDate: Record<string, string[]>;
	itemOverrides?: Map<string, ScheduleItem>;
	itemFilter?: (item: ScheduleItem) => boolean;
	pinnedRole?: DayQueuePinnedRole;
}): ScheduleItem[] {
	const dateKey = String(input.dateKey || "").trim();
	if (!dateKey) {
		return [];
	}
	const filter = input.itemFilter;
	const materials = (input.materialsByDate.get(dateKey) || []).filter((item) =>
		filter ? filter(item) : true,
	);
	const pinned = (input.pinnedByDate.get(dateKey) || []).filter((item) =>
		filter ? filter(item) : true,
	);
	return resolveDayQueueForDisplay({
		dateKey,
		materials,
		pinned,
		completedIds: input.completedIdsByDate[dateKey] || [],
		itemOverrides: input.itemOverrides,
		pinnedRole: input.pinnedRole,
	});
}

/**
 * 活跃日 vs 历史日的默认 pinned 角色。
 */
export function resolvePinnedRoleForDateKey(
	dateKey: string,
	today: Date,
	isPast: (dateKey: string, today: Date) => boolean,
): DayQueuePinnedRole {
	return isPast(dateKey, today) ? "merge" : "ignore";
}

/**
 * 日队列是否仍覆盖全部「未完成」。
 */
export function dayQueueHasPendingCoverage(input: {
	queue: Array<{ id?: string }>;
	baselinePendingIds: Iterable<string>;
	completedIds?: Iterable<string>;
}): boolean {
	const completed = new Set(normalizeCompletedIds(input.completedIds));
	const present = new Set(
		input.queue.map((item) => String(item.id || "").trim()).filter(Boolean),
	);
	for (const raw of input.baselinePendingIds) {
		const id = String(raw || "").trim();
		if (!id || completed.has(id)) {
			continue;
		}
		if (!present.has(id)) {
			return false;
		}
	}
	return true;
}
