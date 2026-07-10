import type { App } from "obsidian";
import type {
	IRPointSourcePathNormalizationResult,
	IRPointSourcePathScanResult,
} from "../../types/ir-point-source-path-types";
import { logger } from "../../utils/logger";
import { getSharedIRPointStorageService } from "./IRPointStorageService";

export type {
	IRPointSourcePathNormalizationResult,
	IRPointSourcePathScanResult,
} from "../../types/ir-point-source-path-types";

/**
 * 扫描并写回规范化阅读点来源路径（清除 `/`、目录、无扩展名等脏值）。
 */
export class IRPointSourcePathNormalizationService {
	constructor(private readonly app: App) {}

	async scanInvalidSourcePaths(): Promise<IRPointSourcePathScanResult> {
		const pointStorage = getSharedIRPointStorageService(this.app);
		return pointStorage.scanInvalidPointSourcePaths();
	}

	async normalizeAllStoredSourcePaths(): Promise<IRPointSourcePathNormalizationResult> {
		const pointStorage = getSharedIRPointStorageService(this.app);
		const result = await pointStorage.normalizeAllPointSourcePathsOnDisk();
		if (result.filesUpdated > 0) {
			logger.info(
				"[IRPointSourcePathNormalizationService] 已写回规范化来源路径",
				result,
			);
		}
		return result;
	}
}

export function getSharedIRPointSourcePathNormalizationService(
	app: App,
): IRPointSourcePathNormalizationService {
	return new IRPointSourcePathNormalizationService(app);
}
