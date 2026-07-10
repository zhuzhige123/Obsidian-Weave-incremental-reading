import type {
	IncrementalReadingFolderSubscriptionRule,
	IncrementalReadingFolderSubscriptionSettings,
} from "../../types/plugin-settings.d";
import { resolveIncrementalReadingFolderSubscriptionRuleForFile } from "./folder-subscription-settings";

export type FolderSubscriptionVaultEvent = "create" | "rename";

function hasMatchingRule(
	path: string | undefined,
	settingsOrRules?:
		| IncrementalReadingFolderSubscriptionSettings
		| IncrementalReadingFolderSubscriptionRule[]
		| null,
): boolean {
	const normalizedPath = String(path || "").trim();
	if (!normalizedPath) {
		return false;
	}
	return Boolean(
		resolveIncrementalReadingFolderSubscriptionRuleForFile(
			normalizedPath,
			settingsOrRules,
		),
	);
}

/**
 * 自动订阅触发策略（降噪版）：
 * - create：仅当新文件位于订阅规则内时触发
 * - rename：仅当文件从规则外移动到规则内时触发
 * 其它变化（内容修改、规则内重命名等）不触发自动同步
 */
export function shouldTriggerFolderSubscriptionResyncForVaultEvent(options: {
	eventType: FolderSubscriptionVaultEvent;
	nextPath: string;
	previousPath?: string;
	settingsOrRules?:
		| IncrementalReadingFolderSubscriptionSettings
		| IncrementalReadingFolderSubscriptionRule[]
		| null;
}): boolean {
	const { eventType, nextPath, previousPath, settingsOrRules } = options;
	const nextMatched = hasMatchingRule(nextPath, settingsOrRules);
	if (!nextMatched) {
		return false;
	}

	if (eventType === "create") {
		return true;
	}

	const previousMatched = hasMatchingRule(previousPath, settingsOrRules);
	return !previousMatched;
}
