import type { App } from "obsidian";
import {
	isIRDeckGhostPointSnapshot,
	shouldExcludeScheduleItemBySource,
} from "../../utils/ir-internal-data-path";
import { logger } from "../../utils/logger";
import { filterScheduleItemsForCalendarDate } from "./IRCalendarCommittedDueMaterials";
import type { IRCalendarDaySummary } from "./IRCalendarDayIndexService";
import {
	buildScheduleItemFromChunkData,
	buildScheduleItemFromEpubTask,
	buildScheduleItemFromPdfTask,
	type ScheduleItem,
} from "./IRCalendarScheduleItem";
import { scheduleIRDeckGhostPointCleanup } from "./IRDeckGhostPointCleanup";
import { getSharedIRDueDateIndexService } from "./IRDueDateIndexService";
import {
	buildLegacyChunkFromPointSnapshot,
	buildLegacyEpubTaskFromPointSnapshot,
	buildLegacyPdfTaskFromPointSnapshot,
	getStoredPointKind,
} from "./IRLegacyTaskCompatAdapter";
import { getSharedIRPointStorageService } from "./IRPointStorageService";
import { getSharedIRScheduleIndexService } from "./IRScheduleIndexService";
import { mergeDayQueueItemsById } from "./IRCalendarDayQueueMerge";
import { assembleScheduleItemsForDailyQueue } from "./IRScheduleItemSort";

function getLocalTodayDateKey(): string {
	const now = new Date();
	const year = now.getFullYear();
	const month = String(now.getMonth() + 1).padStart(2, "0");
	const day = String(now.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

export interface IRDueDateDayHydrateOptions {
	dateKeys: string[];
	deckIds?: string[];
	/** 当日已完成顺序（calendar-progress），用于沉底合并。 */
	completedIdsByDate?: Record<string, string[]>;
	/**
	 * 是否允许对 warm schedule 未命中的 id 逐个读 .irdeck snapshot。
	 * 冷启动首屏必须为 false：数百逾期点串行读盘可达数十秒。
	 */
	allowPointSnapshotFallback?: boolean;
	/** 测试/对账可注入；默认本地今天。过去日会按此键排除开放逾期。 */
	todayKey?: string;
}

export interface IRDueDateDayHydrateResult {
	materialsByDate: Map<string, ScheduleItem[]>;
	daySummaries: Map<string, IRCalendarDaySummary>;
	hydratedDateKeys: string[];
}

/**
 * 日列表与 due（+ 可选已完成）ID 集合是否对齐。
 * - due 中任一项缺失 → 不完整（过去日可关闭：开放逾期故意不挂回）
 * - 列表中存在既不在 due 也不在 completed 的 id → 计划槽污染
 * - 关闭 requireAllDueIds 时仍要求 completedIds 均在列表中
 */
export function areDayMaterialIdsAlignedWithDue(
	items: Array<{ id?: string }>,
	dueIds: string[],
	completedIds: string[] = [],
	options?: { requireAllDueIds?: boolean },
): boolean {
	const requireAllDueIds = options?.requireAllDueIds !== false;
	const itemIds = new Set(
		items.map((item) => String(item.id || "").trim()).filter(Boolean),
	);
	const dueSet = new Set(
		dueIds.map((id) => String(id || "").trim()).filter(Boolean),
	);
	const allowed = new Set(dueSet);
	for (const id of completedIds) {
		const normalized = String(id || "").trim();
		if (normalized) {
			allowed.add(normalized);
		}
	}
	if (requireAllDueIds) {
		for (const id of dueSet) {
			if (!itemIds.has(id)) {
				return false;
			}
		}
	} else {
		for (const id of completedIds) {
			const normalized = String(id || "").trim();
			if (normalized && !itemIds.has(normalized)) {
				return false;
			}
		}
	}
	for (const id of itemIds) {
		if (!allowed.has(id)) {
			return false;
		}
	}
	return true;
}

function normalizeDeckIdSet(deckIds: string[] | undefined): Set<string> | null {
	const normalized = Array.from(
		new Set((deckIds || []).map((id) => String(id || "").trim()).filter(Boolean)),
	);
	return normalized.length > 0 ? new Set(normalized) : null;
}

function matchesDeckFilter(
	item: ScheduleItem,
	deckIds: Set<string> | null,
): boolean {
	if (!deckIds) {
		return true;
	}
	const deckId = String(item.deckId || "").trim();
	// 牌组过滤开启时：无 deckId 视为不匹配，避免漏进其它专题视图。
	if (!deckId) {
		return false;
	}
	return deckIds.has(deckId);
}

/**
 * 从 due 倒排索引 O(k) 装配优先日列表，不经 PlanGenerator / 全库 lean 重算。
 * 用于投影壳缺失或不完整时补洞，落实「完成时已写入 nextRepDate，打开只需加载」。
 */
export async function hydratePriorityDatesFromDueIndex(
	app: App,
	options: IRDueDateDayHydrateOptions,
): Promise<IRDueDateDayHydrateResult> {
	const dateKeys = Array.from(
		new Set(
			(options.dateKeys || [])
				.map((key) => String(key || "").trim())
				.filter(Boolean),
		),
	);
	const empty: IRDueDateDayHydrateResult = {
		materialsByDate: new Map(),
		daySummaries: new Map(),
		hydratedDateKeys: [],
	};
	if (dateKeys.length === 0) {
		return empty;
	}

	const dueIndex = getSharedIRDueDateIndexService(app);
	const scheduleIndex = getSharedIRScheduleIndexService(app);
	const pointStorage = getSharedIRPointStorageService(app);
	const deckIds = normalizeDeckIdSet(options.deckIds);
	const allowPointSnapshotFallback = options.allowPointSnapshotFallback === true;
	const todayKey =
		String(options.todayKey || "").trim() || getLocalTodayDateKey();

	const warmSources = await scheduleIndex.peekWarmScheduleSources();
	const chunksById = new Map(
		(warmSources?.chunks || []).map((chunk) => [
			String(chunk.chunkId || "").trim(),
			chunk,
		]),
	);
	const pdfById = new Map(
		(warmSources?.pdfTasks || []).map((task) => [
			String(task.id || "").trim(),
			task,
		]),
	);
	const epubById = new Map(
		(warmSources?.epubTasks || []).map((task) => [
			String(task.id || "").trim(),
			task,
		]),
	);

	const materialsByDate = new Map<string, ScheduleItem[]>();
	const daySummaries = new Map<string, IRCalendarDaySummary>();
	const hydratedDateKeys: string[] = [];
	const resolvedCache = new Map<string, ScheduleItem | null>();
	const ghostPointIds: string[] = [];
	let skippedSnapshotFallback = 0;

	const resolveItem = async (pointId: string): Promise<ScheduleItem | null> => {
		const normalizedId = String(pointId || "").trim();
		if (!normalizedId) {
			return null;
		}
		if (resolvedCache.has(normalizedId)) {
			return resolvedCache.get(normalizedId) || null;
		}

		let item: ScheduleItem | null = null;
		const chunk = chunksById.get(normalizedId);
		if (chunk) {
			item = buildScheduleItemFromChunkData(chunk, normalizedId);
		} else if (pdfById.has(normalizedId)) {
			item = buildScheduleItemFromPdfTask(pdfById.get(normalizedId)!);
		} else if (epubById.has(normalizedId)) {
			item = await buildScheduleItemFromEpubTask(epubById.get(normalizedId)!);
		} else if (!allowPointSnapshotFallback) {
			skippedSnapshotFallback += 1;
			resolvedCache.set(normalizedId, null);
			return null;
		} else {
			try {
				await pointStorage.initialize();
				const snapshot = await pointStorage.getPointSnapshotById(normalizedId);
				if (snapshot) {
					if (isIRDeckGhostPointSnapshot(snapshot)) {
						ghostPointIds.push(normalizedId);
						resolvedCache.set(normalizedId, null);
						return null;
					}
					const kind = getStoredPointKind(snapshot);
					if (kind === "pdf") {
						item = buildScheduleItemFromPdfTask(
							buildLegacyPdfTaskFromPointSnapshot(snapshot),
						);
					} else if (kind === "epub") {
						item = await buildScheduleItemFromEpubTask(
							buildLegacyEpubTaskFromPointSnapshot(snapshot),
						);
					} else {
						const { chunk: legacyChunk } =
							buildLegacyChunkFromPointSnapshot(snapshot);
						item = buildScheduleItemFromChunkData(legacyChunk, normalizedId);
					}
				}
			} catch (error) {
				logger.debug(
					`[IRDueDateDayHydrate] snapshot resolve failed: ${normalizedId}`,
					error,
				);
			}
		}

		if (
			item &&
			(shouldExcludeScheduleItemBySource(item) ||
				!matchesDeckFilter(item, deckIds))
		) {
			if (item && shouldExcludeScheduleItemBySource(item)) {
				ghostPointIds.push(normalizedId);
			}
			item = null;
		}
		resolvedCache.set(normalizedId, item);
		return item;
	};

	for (const dateKey of dateKeys) {
		const dueIds = await dueIndex.getCalendarDuePointIdsForDate(dateKey);
		const completedOrder = Array.from(
			new Set(
				(options.completedIdsByDate?.[dateKey] || [])
					.map((id) => String(id || "").trim())
					.filter(Boolean),
			),
		);
		const completedIdSet = new Set(completedOrder);
		const idOrder = Array.from(new Set([...dueIds, ...completedOrder]));
		if (idOrder.length === 0) {
			continue;
		}

		const resolvedItems: ScheduleItem[] = [];
		for (const id of idOrder) {
			const item = await resolveItem(id);
			if (item) {
				resolvedItems.push(item);
			}
		}
		// 过去日：开放逾期只属于今天，不得因 due 倒排再挂回承诺日。
		const items =
			dateKey < todayKey
				? filterScheduleItemsForCalendarDate(
						resolvedItems,
						dateKey,
						todayKey,
						completedIdSet,
					)
				: resolvedItems;
		if (items.length === 0) {
			continue;
		}

		const assembled = assembleScheduleItemsForDailyQueue(items, dateKey, {
			completedIds: completedIdSet,
			completedIdOrder: completedOrder,
		});
		materialsByDate.set(dateKey, assembled);
		daySummaries.set(dateKey, { totalCount: assembled.length });
		hydratedDateKeys.push(dateKey);
	}

	if (hydratedDateKeys.length > 0) {
		logger.debug("[IRDueDateDayHydrate] hydrated from due index", {
			dateKeys: hydratedDateKeys,
			itemCounts: hydratedDateKeys.map(
				(key) => materialsByDate.get(key)?.length ?? 0,
			),
			fromWarmScheduleIndex: Boolean(warmSources),
			skippedSnapshotFallback,
		});
	}

	if (ghostPointIds.length > 0) {
		scheduleIRDeckGhostPointCleanup(app, ghostPointIds);
	}

	return { materialsByDate, daySummaries, hydratedDateKeys };
}

/**
 * 将 due 索引补洞合并进已有投影：缺项、多项污染或不对齐时整日替换。
 */
export async function mergeDueIndexIntoPriorityProjection(
	app: App,
	input: {
		deckIds?: string[];
		dateKeys: string[];
		materialsByDate: Map<string, ScheduleItem[]>;
		daySummaries: Map<string, IRCalendarDaySummary>;
		completedIdsByDate?: Record<string, string[]>;
		allowPointSnapshotFallback?: boolean;
		todayKey?: string;
	},
): Promise<{
	materialsByDate: Map<string, ScheduleItem[]>;
	daySummaries: Map<string, IRCalendarDaySummary>;
	filledDateKeys: string[];
}> {
	const dateKeys = Array.from(
		new Set(
			input.dateKeys.map((key) => String(key || "").trim()).filter(Boolean),
		),
	);
	const todayKey =
		String(input.todayKey || "").trim() || getLocalTodayDateKey();
	const dueIndex = getSharedIRDueDateIndexService(app);
	await dueIndex.warmDiskCache();
	// due 未就绪（空闩）时禁止对账/清空：否则会把 day-index 壳抹成今日空白。
	if (dueIndex.isMemoryStoreEmpty()) {
		return {
			materialsByDate: input.materialsByDate,
			daySummaries: input.daySummaries,
			filledDateKeys: [],
		};
	}

	const materialsByDate = new Map(input.materialsByDate);
	const daySummaries = new Map(input.daySummaries);
	const filledDateKeys: string[] = [];
	const needsFill: string[] = [];

	for (const dateKey of dateKeys) {
		const existing = materialsByDate.get(dateKey) || [];
		const dueIds = await dueIndex.getCalendarDuePointIdsForDate(dateKey);
		const completedIds = input.completedIdsByDate?.[dateKey] || [];
		const completedIdSet = new Set(
			completedIds.map((id) => String(id || "").trim()).filter(Boolean),
		);
		const isPastDay = dateKey < todayKey;
		const existingScoped = isPastDay
			? filterScheduleItemsForCalendarDate(
					existing,
					dateKey,
					todayKey,
					completedIdSet,
				)
			: existing;

		// 过去日先剥离误挂的开放逾期，避免仅靠 hydrate 才能纠正。
		if (isPastDay && existingScoped.length !== existing.length) {
			materialsByDate.set(dateKey, existingScoped);
			daySummaries.set(dateKey, { totalCount: existingScoped.length });
			filledDateKeys.push(dateKey);
		}

		if (
			dueIds.length === 0 &&
			areDayMaterialIdsAlignedWithDue(existingScoped, dueIds, completedIds, {
				requireAllDueIds: !isPastDay,
			})
		) {
			continue;
		}
		if (
			!areDayMaterialIdsAlignedWithDue(existingScoped, dueIds, completedIds, {
				requireAllDueIds: !isPastDay,
			})
		) {
			needsFill.push(dateKey);
		}
	}

	if (needsFill.length === 0) {
		return {
			materialsByDate,
			daySummaries,
			filledDateKeys,
		};
	}

	const hydrated = await hydratePriorityDatesFromDueIndex(app, {
		dateKeys: needsFill,
		deckIds: input.deckIds,
		completedIdsByDate: input.completedIdsByDate,
		allowPointSnapshotFallback: input.allowPointSnapshotFallback,
		todayKey,
	});

	for (const dateKey of needsFill) {
		const items = hydrated.materialsByDate.get(dateKey) || [];
		const dueIds = await dueIndex.getCalendarDuePointIdsForDate(dateKey);
		const existing = materialsByDate.get(dateKey) || [];
		const completedIds = input.completedIdsByDate?.[dateKey] || [];
		const completedIdSet = new Set(
			completedIds.map((id) => String(id || "").trim()).filter(Boolean),
		);
		const isPastDay = dateKey < todayKey;
		// due 确认有数据且该日无 due、hydrate 也为空：清空计划槽污染。
		// 若仍有 existing 材料但 due 未就绪，已在上方 isMemoryStoreEmpty 短路，不会走到这里。
		if (items.length === 0 && dueIds.length === 0) {
			if (existing.length === 0) {
				materialsByDate.set(dateKey, []);
				daySummaries.set(dateKey, { totalCount: 0 });
				if (!filledDateKeys.includes(dateKey)) {
					filledDateKeys.push(dateKey);
				}
			}
			continue;
		}
		if (items.length === 0) {
			continue;
		}

		// warm-only hydrate 常漏解析部分 due id：若 existing 仍持有这些 id，按 id 合并而非整日替换。
		// 过去日禁止把「展示日≠该日」的开放逾期从 existing 合并回来。
		const hydratedIds = new Set(
			items.map((item) => String(item.id || "").trim()).filter(Boolean),
		);
		const dueIdSet = new Set(
			dueIds.map((id) => String(id || "").trim()).filter(Boolean),
		);
		const existingEligible = isPastDay
			? filterScheduleItemsForCalendarDate(
					existing,
					dateKey,
					todayKey,
					completedIdSet,
				)
			: existing;
		const existingPreservesMissedDue = existingEligible.some((item) => {
			const id = String(item.id || "").trim();
			return Boolean(id && dueIdSet.has(id) && !hydratedIds.has(id));
		});
		const nextItems = existingPreservesMissedDue
			? assembleScheduleItemsForDailyQueue(
					mergeDayQueueItemsById(existingEligible, items),
					dateKey,
					{
						completedIds,
						completedIdOrder: completedIds,
					},
			  )
			: items;

		materialsByDate.set(dateKey, nextItems);
		daySummaries.set(dateKey, { totalCount: nextItems.length });
		if (!filledDateKeys.includes(dateKey)) {
			filledDateKeys.push(dateKey);
		}
	}

	return { materialsByDate, daySummaries, filledDateKeys };
}
