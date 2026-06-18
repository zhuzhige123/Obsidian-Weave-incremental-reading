import type { Plugin, View } from "obsidian";
import { OBSIDIAN_WEB_VIEWER_VIEW_TYPE } from "../obsidian/obsidian-open-web-url";
import {
	getWebViewerPageContextFromView,
	readWebViewerTitleFromView,
	readWebViewerUrlFromView,
} from "../obsidian/web-viewer-context";
import { PREMIUM_FEATURES } from "../premium/PremiumFeatureGuard";
import { i18n } from "../../utils/i18n";
import { logger } from "../../utils/logger";

type ElectronContextMenuItem =
	| {
			label: string;
			click?: () => void;
			type?: undefined;
	  }
	| {
			type: "separator";
	  };

type WebViewerContextMenuView = View & {
	url?: string;
	title?: string;
	contextMenuItemsForSelection?: (
		selectionText: string,
		isEditable: boolean
	) => ElectronContextMenuItem[];
};

export interface WebViewerIrContextMenuHost {
	shouldShowPremiumEntry(featureId: string): boolean;
	ensurePremiumFeatureAccess(featureId: string, blockedMessage: string): boolean;
	runWebSelectionToIRQuickCreate(context: {
		url: string;
		title: string;
		selectedText: string;
	}): Promise<void>;
}

const patchedPrototypes = new WeakSet<object>();

function resolveWebViewerContextFromView(view: WebViewerContextMenuView): {
	url: string;
	title: string;
} | null {
	const pageContext = getWebViewerPageContextFromView(view);
	if (pageContext) {
		return {
			url: pageContext.url,
			title: pageContext.title,
		};
	}

	const url = readWebViewerUrlFromView(view);
	if (!url) {
		return null;
	}

	return {
		url,
		title: readWebViewerTitleFromView(view, url),
	};
}

export function registerWebViewerContextMenuPatch(
	plugin: Plugin,
	host: WebViewerIrContextMenuHost
): void {
	const tryPatchWebViewerViews = (): void => {
		const leaves = plugin.app.workspace.getLeavesOfType(OBSIDIAN_WEB_VIEWER_VIEW_TYPE);
		for (const leaf of leaves) {
			const view = leaf.view as WebViewerContextMenuView | undefined;
			if (!view) {
				continue;
			}

			const proto = Object.getPrototypeOf(view) as {
				contextMenuItemsForSelection?: (
					selectionText: string,
					isEditable: boolean
				) => ElectronContextMenuItem[];
			};
			if (!proto || patchedPrototypes.has(proto)) {
				continue;
			}

			if (typeof proto.contextMenuItemsForSelection !== "function") {
				continue;
			}

			const original = proto.contextMenuItemsForSelection;

			proto.contextMenuItemsForSelection = function patchedContextMenuItemsForSelection(
				this: WebViewerContextMenuView,
				selectionText: string,
				isEditable: boolean
			): ElectronContextMenuItem[] {
				const items = original.call(this, selectionText, isEditable) ?? [];
				const selectedText = String(selectionText || "").trim();
				if (!selectedText || !host.shouldShowPremiumEntry(PREMIUM_FEATURES.INCREMENTAL_READING)) {
					return items;
				}

				const pageContext = resolveWebViewerContextFromView(this);
				if (!pageContext) {
					return items;
				}

				const irItem: ElectronContextMenuItem = {
					label: i18n.t("irCommands.addToIr"),
					click: () => {
						if (
							!host.ensurePremiumFeatureAccess(
								PREMIUM_FEATURES.INCREMENTAL_READING,
								i18n.t("irCommands.defaultIrName")
							)
						) {
							return;
						}
						void host.runWebSelectionToIRQuickCreate({
							url: pageContext.url,
							title: pageContext.title,
							selectedText,
						});
					},
				};

				return [irItem, { type: "separator" }, ...items];
			};

			patchedPrototypes.add(proto);
			logger.info("[Standalone IR] 已为官方 Web Viewer 选区右键菜单注入「添加到增量阅读」");
		}
	};

	tryPatchWebViewerViews();

	plugin.registerEvent(
		plugin.app.workspace.on("layout-change", () => {
			tryPatchWebViewerViews();
		})
	);
	plugin.registerEvent(
		plugin.app.workspace.on("active-leaf-change", (leaf) => {
			if (leaf?.view?.getViewType?.() === OBSIDIAN_WEB_VIEWER_VIEW_TYPE) {
				tryPatchWebViewerViews();
			}
		})
	);
}
