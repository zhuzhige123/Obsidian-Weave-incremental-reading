import type { App } from "obsidian";
import { logger } from "../../utils/logger";
import { getSharedIRCalendarQueryService } from "./IRCalendarQueryService";
import { getSharedIRScheduleIndexService } from "./IRScheduleIndexService";

const WARMUP_IDLE_TIMEOUT_MS = 5000;
const WARMUP_FALLBACK_DELAY_MS = 500;

function getLocalTodayDateKey(): string {
	const now = new Date();
	const year = now.getFullYear();
	const month = String(now.getMonth() + 1).padStart(2, "0");
	const day = String(now.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

/**
 * 在插件启动后于空闲时预热工作区快照与月历查询，缩短重启后首次打开月历的等待时间。
 */
export function scheduleIRWorkspaceWarmup(app: App): void {
	const runWarmup = (): void => {
		void (async () => {
			const startedAt = Date.now();
			try {
				const calendarQuery = getSharedIRCalendarQueryService(app);
				const todayKey = getLocalTodayDateKey();
				await calendarQuery.tryGetTier0CalendarResult({
					priorityDateKeys: [todayKey],
				});
				await calendarQuery.getCalendarQueryResult({
					reason: "ui_refresh",
					includeReadingMaterials: false,
					preferDiskCache: true,
					priorityDateKeys: [todayKey],
				});
				void calendarQuery
					.getCalendarQueryResult({
						reason: "ui_refresh",
						includeReadingMaterials: true,
						preferDiskCache: false,
						priorityDateKeys: [todayKey],
					})
					.catch(() => undefined);
				void getSharedIRScheduleIndexService(app)
					.getScheduleSources()
					.catch(() => undefined);
				logger.debug("[IRWorkspaceWarmup] warmup ready", {
					durationMs: Date.now() - startedAt,
				});
			} catch (error) {
				logger.debug("[IRWorkspaceWarmup] warmup skipped", error);
			}
		})();
	};

	if (typeof window !== "undefined" && typeof window.requestIdleCallback === "function") {
		window.requestIdleCallback(() => runWarmup(), { timeout: WARMUP_IDLE_TIMEOUT_MS });
		return;
	}

	window.setTimeout(runWarmup, WARMUP_FALLBACK_DELAY_MS);
}
