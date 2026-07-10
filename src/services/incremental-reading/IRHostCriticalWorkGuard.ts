import type { App, Plugin } from "obsidian";
import { runIdleBatchedTasks } from "../../utils/idle-task-queue";
import { logger } from "../../utils/logger";
import {
	WEAVE_MEMORY_STUDY_SESSION_EVENT,
	WEAVE_STUDY_VIEW_TYPE,
	type WeaveMemoryStudySessionDetail,
} from "../weave-integration/weave-host-critical-work";

const DEFERRED_VAULT_WORK_RETRY_MS = 2000;

type VaultBackgroundTask = () => Promise<void>;

/**
 * 当宿主插件（如 Weave 记忆学习）占用主线程敏感路径时，推迟 IR 全库扫描与调度重算。
 * 优先监听跨插件 CustomEvent；并以 workspace 视图类型作为兜底探测。
 */
export class IRHostCriticalWorkGuard {
	private memoryStudyActive = false;
	private deferredVaultTasks: VaultBackgroundTask[] = [];
	private layoutSyncTimer: number | null = null;

	shouldDeferVaultBackgroundWork(): boolean {
		return this.memoryStudyActive;
	}

	register(plugin: Plugin): void {
		const onMemoryStudySession = (event: Event): void => {
			const detail = (event as CustomEvent<WeaveMemoryStudySessionDetail>)
				.detail;
			if (typeof detail?.active !== "boolean") {
				return;
			}
			this.setMemoryStudyActive(detail.active, "event");
		};
		window.addEventListener(
			WEAVE_MEMORY_STUDY_SESSION_EVENT,
			onMemoryStudySession,
		);
		plugin.register(() => {
			window.removeEventListener(
				WEAVE_MEMORY_STUDY_SESSION_EVENT,
				onMemoryStudySession,
			);
		});

		const syncFromWorkspace = (): void => {
			const active =
				plugin.app.workspace.getLeavesOfType(WEAVE_STUDY_VIEW_TYPE).length > 0;
			this.setMemoryStudyActive(active, "workspace");
		};

		plugin.registerEvent(
			plugin.app.workspace.on("layout-change", () => {
				if (this.layoutSyncTimer !== null) {
					window.clearTimeout(this.layoutSyncTimer);
				}
				this.layoutSyncTimer = window.setTimeout(() => {
					this.layoutSyncTimer = null;
					syncFromWorkspace();
				}, 0);
			}),
		);

		syncFromWorkspace();
	}

	runVaultBackgroundWork(task: VaultBackgroundTask): void {
		if (!this.shouldDeferVaultBackgroundWork()) {
			void task().catch((error) => {
				logger.warn(
					"[IRHostCriticalWorkGuard] vault background task failed:",
					error,
				);
			});
			return;
		}
		this.deferredVaultTasks.push(task);
	}

	scheduleVaultBackgroundWorkWhenAllowed(
		task: VaultBackgroundTask,
		retryMs = DEFERRED_VAULT_WORK_RETRY_MS,
	): void {
		if (!this.shouldDeferVaultBackgroundWork()) {
			void task().catch((error) => {
				logger.warn(
					"[IRHostCriticalWorkGuard] vault background task failed:",
					error,
				);
			});
			return;
		}

		const attempt = (): void => {
			if (this.shouldDeferVaultBackgroundWork()) {
				window.setTimeout(attempt, retryMs);
				return;
			}
			void task().catch((error) => {
				logger.warn(
					"[IRHostCriticalWorkGuard] deferred vault background task failed:",
					error,
				);
			});
		};
		window.setTimeout(attempt, retryMs);
	}

	private setMemoryStudyActive(
		active: boolean,
		source: "event" | "workspace",
	): void {
		if (this.memoryStudyActive === active) {
			return;
		}
		this.memoryStudyActive = active;
		logger.debug("[IRHostCriticalWorkGuard] memory study session", {
			active,
			source,
		});
		if (!active) {
			void this.flushDeferredVaultTasks();
		}
	}

	private async flushDeferredVaultTasks(): Promise<void> {
		const tasks = this.deferredVaultTasks.splice(0);
		if (tasks.length === 0) {
			return;
		}
		await runIdleBatchedTasks(
			tasks,
			async (task) => {
				await task();
			},
			{
				chunkSize: 1,
				budgetMs: 12,
				shouldCancel: () => this.shouldDeferVaultBackgroundWork(),
			},
		);
	}
}

const guardByApp = new WeakMap<App, IRHostCriticalWorkGuard>();

export function getSharedIRHostCriticalWorkGuard(
	app: App,
): IRHostCriticalWorkGuard {
	let guard = guardByApp.get(app);
	if (!guard) {
		guard = new IRHostCriticalWorkGuard();
		guardByApp.set(app, guard);
	}
	return guard;
}
