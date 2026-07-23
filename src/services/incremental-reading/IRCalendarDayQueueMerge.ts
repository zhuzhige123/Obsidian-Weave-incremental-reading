import type { ScheduleItem } from "./IRCalendarScheduleItem";
import { resolveDayQueueForDisplay } from "./IRCalendarDayQueueResolve";

/**
 * 月历日队列合并语义：防止后台 reconcile / 不完整 hydrate 用子集或空切片冲掉 L1 全日队列。
 */

export function collectScheduleItemIds(
	items: Array<{ id?: string } | null | undefined>,
): Set<string> {
	const ids = new Set<string>();
	for (const item of items) {
		const id = String(item?.id || "").trim();
		if (id) {
			ids.add(id);
		}
	}
	return ids;
}

/** incoming 的 id 集合是否为 existing 的真子集（且 existing 更长）。 */
export function isStrictIdSubsetOfExisting(
	existing: Array<{ id?: string }>,
	incoming: Array<{ id?: string }>,
): boolean {
	const existingIds = collectScheduleItemIds(existing);
	const incomingIds = collectScheduleItemIds(incoming);
	if (existingIds.size === 0 || incomingIds.size >= existingIds.size) {
		return false;
	}
	for (const id of incomingIds) {
		if (!existingIds.has(id)) {
			return false;
		}
	}
	return true;
}

/**
 * incoming 是否缺少任一 existing id（含交叉集合：缺旧 id 又带新 id）。
 * 用于 protectAgainstShrink：不得用「不完整覆盖」整日 replace。
 */
export function incomingMissesExistingIds(
	existing: Array<{ id?: string }>,
	incoming: Array<{ id?: string }>,
): boolean {
	const existingIds = collectScheduleItemIds(existing);
	if (existingIds.size === 0) {
		return false;
	}
	const incomingIds = collectScheduleItemIds(incoming);
	for (const id of existingIds) {
		if (!incomingIds.has(id)) {
			return true;
		}
	}
	return false;
}

/**
 * 按 id 合并：保留 existing 中 incoming 未覆盖的项，重叠 id 以 incoming 为准。
 */
export function mergeDayQueueItemsById(
	existing: ScheduleItem[],
	incoming: ScheduleItem[],
): ScheduleItem[] {
	const byId = new Map<string, ScheduleItem>();
	for (const item of existing) {
		const id = String(item?.id || "").trim();
		if (id) {
			byId.set(id, item);
		}
	}
	for (const item of incoming) {
		const id = String(item?.id || "").trim();
		if (id) {
			byId.set(id, item);
		}
	}
	return Array.from(byId.values());
}

function assembleProtectedDayQueue(
	dateKey: string,
	existing: ScheduleItem[],
	incoming: ScheduleItem[],
	completedIdsByDate?: Record<string, string[]>,
): ScheduleItem[] {
	const idMerged = mergeDayQueueItemsById(existing, incoming);
	const completedIds = completedIdsByDate?.[dateKey];
	return completedIds
		? resolveDayQueueForDisplay({
				dateKey,
				materials: idMerged,
				completedIds,
		  })
		: idMerged;
}

export interface MergeMaterialsByDateOptions {
	forceReplaceDateKeys?: Iterable<string>;
	/**
	 * 为 true 时：禁止用空切片或不完整切片整日覆盖非空队列。
	 * 空切片跳过；缺少任一 existing id（真子集或交叉集合）改为按 id 合并，
	 * 避免完成阅读点后列表被冲成「只剩部分项」。
	 */
	protectAgainstShrink?: boolean;
	/** 与 protectAgainstShrink 联用：子集合并后按完成顺序重装配为全日队列形状。 */
	completedIdsByDate?: Record<string, string[]>;
}

/**
 * 合并按日材料 Map。默认行为与历史一致；开启 protectAgainstShrink 后拒绝不完整覆盖。
 */
export function mergeMaterialsByDateMaps(
	base: Map<string, ScheduleItem[]>,
	updates: Map<string, ScheduleItem[]>,
	options?: MergeMaterialsByDateOptions,
): Map<string, ScheduleItem[]> {
	const forceReplace = new Set(
		Array.from(options?.forceReplaceDateKeys || [])
			.map((key) => String(key || "").trim())
			.filter(Boolean),
	);
	const protectAgainstShrink = options?.protectAgainstShrink === true;
	const merged = new Map(base);

	for (const [dateKey, items] of updates) {
		const key = String(dateKey || "").trim();
		if (!key) {
			continue;
		}
		const existing = merged.get(key) || [];
		const incoming = Array.isArray(items) ? items : [];
		const force = forceReplace.has(key);

		if (protectAgainstShrink && existing.length > 0) {
			if (incoming.length === 0) {
				// 不完整 reconcile 常把缺失日写成 []；禁止抹掉已有全日队列。
				continue;
			}
			if (incomingMissesExistingIds(existing, incoming)) {
				merged.set(
					key,
					assembleProtectedDayQueue(
						key,
						existing,
						incoming,
						options?.completedIdsByDate,
					),
				);
				continue;
			}
		}

		if (existing.length === 0 || incoming.length > 0 || force) {
			merged.set(key, incoming);
		}
	}

	return merged;
}
