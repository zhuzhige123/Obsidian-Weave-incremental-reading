import type { App } from "obsidian";
import { getObsidianPluginAs } from "../../utils/obsidian-plugin-registry";
import { WEAVE_MAIN_PLUGIN_ID } from "../../utils/weave-reader-access";

export interface WeaveCreateCardModalInput {
	initialContent?: string;
	cardMetadata?: {
		sourceFile?: string;
		sourceBlock?: string;
		/** IR reading point id; Weave should echo this when reporting outcomes. */
		irPointId?: string;
		[key: string]: unknown;
	};
	onSuccess?: (card: { id?: string }) => void;
	onCancel?: () => void;
}

/**
 * After Weave creates a real card, call IR:
 * `app.plugins.plugins["weave-incremental-reading"]?.recordIRLearningOutcome?.({
 *   pointId, kind: "memory-card" | "extract", artifactId: card.id
 * })`
 * See `.codex/skills/incremental-reading-dev/references/ir-outcome-contract.md`.
 */

export interface WeaveMemoryHostCapabilities {
	openCreateCardModal?: (input: WeaveCreateCardModalInput) => Promise<void>;
}

export interface ResolvedWeaveMemoryHost {
	openCreateCardModal: (input: WeaveCreateCardModalInput) => Promise<void>;
}

export function resolveWeaveMemoryHost(
	app: App,
): ResolvedWeaveMemoryHost | null {
	const host = getObsidianPluginAs<WeaveMemoryHostCapabilities>(
		app,
		WEAVE_MAIN_PLUGIN_ID,
	);
	const openCreateCardModal = host?.openCreateCardModal;
	if (typeof openCreateCardModal !== "function") {
		return null;
	}
	return { openCreateCardModal: openCreateCardModal.bind(host) };
}

export function isWeaveMemoryHostAvailable(app: App): boolean {
	const host = resolveWeaveMemoryHost(app);
	return typeof host?.openCreateCardModal === "function";
}
