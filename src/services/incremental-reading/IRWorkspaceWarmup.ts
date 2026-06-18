import type { App } from "obsidian";
import { logger } from "../../utils/logger";
import { getSharedIRRefreshScheduler } from "./IRRefreshScheduler";

/**
 * @deprecated 由 IRRefreshScheduler 接管；保留导出以兼容旧调用点。
 */
export function scheduleIRWorkspaceWarmup(app: App): void {
	void getSharedIRRefreshScheduler(app).scheduleBootstrap();
	logger.debug("[IRWorkspaceWarmup] delegated to IRRefreshScheduler");
}
