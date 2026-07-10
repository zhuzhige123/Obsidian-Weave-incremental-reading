import type { App } from "obsidian";
import { logger } from "../../utils/logger";
import { mergePriorityDateKeys } from "./IRCalendarProjectionUtils";
import type {
	RecomputeOptions,
	ScheduleRecomputeReason,
} from "./IRScheduleKernel";
import {
	type UpdatedEventDetail,
	recomputeAndBroadcastIRData,
} from "./IRScheduleRefreshService";

const DEFAULT_DEBOUNCE_MS = 750;

const SCOPED_DEBOUNCE_REASONS = new Set<ScheduleRecomputeReason>([
	"complete_block",
	"postpone_block",
	"manual_reschedule",
]);

type PendingRecompute = {
	reason: ScheduleRecomputeReason;
	deckIds: Set<string>;
	priorityDateKeys: Set<string>;
	l1PatchedDateKeys: Set<string>;
	leanSchedule: boolean;
};

function shouldDebounceReason(reason: ScheduleRecomputeReason): boolean {
	return SCOPED_DEBOUNCE_REASONS.has(reason);
}

export class IRScheduleRecomputeCoordinator {
	private pending: PendingRecompute | null = null;
	private debounceTimer: number | null = null;
	private flushPromise: Promise<UpdatedEventDetail> | null = null;
	private flushResolvers: Array<{
		resolve: (detail: UpdatedEventDetail) => void;
		reject: (error: unknown) => void;
	}> = [];

	constructor(
		private readonly app: App,
		private readonly debounceMs = DEFAULT_DEBOUNCE_MS,
	) {}

	scheduleRecompute(
		reason: ScheduleRecomputeReason,
		options?: RecomputeOptions,
	): Promise<UpdatedEventDetail> {
		if (!shouldDebounceReason(reason)) {
			return recomputeAndBroadcastIRData(this.app, reason, options);
		}

		this.mergePending(reason, options);
		return new Promise<UpdatedEventDetail>((resolve, reject) => {
			this.flushResolvers.push({ resolve, reject });
			this.scheduleFlush();
		});
	}

	private mergePending(
		reason: ScheduleRecomputeReason,
		options?: RecomputeOptions,
	): void {
		if (!this.pending) {
			this.pending = {
				reason,
				deckIds: new Set<string>(),
				priorityDateKeys: new Set<string>(),
				l1PatchedDateKeys: new Set<string>(),
				leanSchedule: options?.leanSchedule !== false,
			};
		}

		this.pending.reason = reason;
		if (options?.leanSchedule === false) {
			this.pending.leanSchedule = false;
		}

		for (const deckId of options?.deckIds || []) {
			const normalized = String(deckId || "").trim();
			if (normalized) {
				this.pending.deckIds.add(normalized);
			}
		}

		for (const dateKey of options?.priorityDateKeys || []) {
			const normalized = String(dateKey || "").trim();
			if (normalized) {
				this.pending.priorityDateKeys.add(normalized);
			}
		}

		for (const dateKey of options?.l1PatchedDateKeys || []) {
			const normalized = String(dateKey || "").trim();
			if (normalized) {
				this.pending.l1PatchedDateKeys.add(normalized);
			}
		}
	}

	private scheduleFlush(): void {
		if (this.debounceTimer !== null) {
			window.clearTimeout(this.debounceTimer);
		}

		this.debounceTimer = window.setTimeout(() => {
			this.debounceTimer = null;
			void this.flushPending();
		}, this.debounceMs);
	}

	private async flushPending(): Promise<void> {
		if (this.flushPromise) {
			await this.flushPromise;
			return;
		}

		const pending = this.pending;
		const resolvers = this.flushResolvers.splice(0);
		this.pending = null;

		if (!pending || resolvers.length === 0) {
			return;
		}

		const deckIds = Array.from(pending.deckIds);
		const priorityDateKeys = mergePriorityDateKeys(
			Array.from(pending.priorityDateKeys),
			[],
		);
		const l1PatchedDateKeys = Array.from(pending.l1PatchedDateKeys);

		this.flushPromise = recomputeAndBroadcastIRData(this.app, pending.reason, {
			deckIds: deckIds.length > 0 ? deckIds : undefined,
			priorityDateKeys:
				priorityDateKeys.length > 0 ? priorityDateKeys : undefined,
			l1PatchedDateKeys:
				l1PatchedDateKeys.length > 0 ? l1PatchedDateKeys : undefined,
			leanSchedule: pending.leanSchedule,
		});

		try {
			const detail = await this.flushPromise;
			for (const { resolve } of resolvers) {
				resolve(detail);
			}
		} catch (error) {
			logger.error(
				"[IRScheduleRecomputeCoordinator] debounced recompute failed",
				error,
			);
			for (const { reject } of resolvers) {
				reject(error);
			}
		} finally {
			this.flushPromise = null;
		}
	}
}

const coordinatorByApp = new WeakMap<App, IRScheduleRecomputeCoordinator>();

export function getSharedIRScheduleRecomputeCoordinator(
	app: App,
): IRScheduleRecomputeCoordinator {
	let coordinator = coordinatorByApp.get(app);
	if (!coordinator) {
		coordinator = new IRScheduleRecomputeCoordinator(app);
		coordinatorByApp.set(app, coordinator);
	}
	return coordinator;
}

/** 对 complete/postpone 等操作 debounce 合并 L2 重算；其它 reason 立即重算。 */
export function scheduleDebouncedRecomputeAndBroadcastIRData(
	app: App,
	reason: ScheduleRecomputeReason,
	options?: RecomputeOptions,
): Promise<UpdatedEventDetail> {
	return getSharedIRScheduleRecomputeCoordinator(app).scheduleRecompute(
		reason,
		options,
	);
}
