import type { App } from "obsidian";
import type { IncrementalReadingPluginHost } from "../../types/incremental-reading-plugin-host";
import { getObsidianPluginAs } from "../../utils/obsidian-plugin-registry";

export interface IRRuntimeConfig {
	pluginId: string;
	pluginDirName: string;
	viewTypes: {
		calendar: string;
		deck: string;
		focus: string;
		workbench: string;
	};
	events: {
		premiumFeaturePreviewRequest: string;
		premiumUiStateChanged: string;
	};
	collaboratorHostPluginIds: string[];
}

declare const __WEAVE_IR_STANDALONE__: boolean;

const isStandalone = typeof __WEAVE_IR_STANDALONE__ !== "undefined" && __WEAVE_IR_STANDALONE__;

export const IR_RUNTIME: IRRuntimeConfig = {
	pluginId: isStandalone ? "weave-incremental-reading" : "weave",
	pluginDirName: isStandalone ? "weave-incremental-reading" : "weave",
	viewTypes: {
		calendar: isStandalone ? "weave-ir-calendar-view-standalone" : "weave-ir-calendar-view",
		deck: isStandalone ? "weave-irdeck-file-standalone" : "weave-irdeck-file",
		focus: isStandalone ? "weave-ir-focus-view-standalone" : "weave-ir-focus-view",
		workbench: isStandalone
			? "weave-ir-paragraph-workbench-standalone"
			: "weave-ir-paragraph-workbench",
	},
	events: {
		premiumFeaturePreviewRequest: isStandalone
			? "WeaveIncrementalReading:premium-feature-preview-request"
			: "Weave:premium-feature-preview-request",
		premiumUiStateChanged: isStandalone
			? "WeaveIncrementalReading:premium-ui-state-changed"
			: "Weave:premium-ui-state-changed",
	},
	collaboratorHostPluginIds: isStandalone ? ["weave", "weave-epub-reader"] : [],
};

export function getIRRuntime(): IRRuntimeConfig {
	return IR_RUNTIME;
}

export function getIncrementalReadingPlugin(app: App): IncrementalReadingPluginHost | null {
	const primary = getObsidianPluginAs<IncrementalReadingPluginHost>(app, IR_RUNTIME.pluginId);
	if (primary) {
		return primary;
	}

	for (const pluginId of IR_RUNTIME.collaboratorHostPluginIds) {
		const collaborator = getObsidianPluginAs<IncrementalReadingPluginHost>(app, pluginId);
		if (collaborator) {
			return collaborator;
		}
	}

	return getObsidianPluginAs<IncrementalReadingPluginHost>(app, "weave");
}
