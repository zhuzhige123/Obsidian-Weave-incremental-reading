import type { Menu, Plugin, View } from "obsidian";
import { OBSIDIAN_WEB_VIEWER_VIEW_TYPE } from "../obsidian/obsidian-open-web-url";
import { getWebViewerPageContextFromView } from "../obsidian/web-viewer-context";
import { PREMIUM_FEATURES } from "../premium/PremiumFeatureGuard";
import { logger } from "../../utils/logger";

export interface WebViewerIrMenuHost {
	shouldShowPremiumEntry(featureId: string): boolean;
	ensurePremiumFeatureAccess(featureId: string, blockedMessage: string): boolean;
	runWebPageToIRQuickCreate(context: { url: string; title: string }): Promise<void>;
}

const patchedPrototypes = new WeakSet<object>();

export function registerWebViewerPaneMenuPatch(
	plugin: Plugin,
	host: WebViewerIrMenuHost
): void {
	const tryPatchWebViewerViews = (): void => {
		const leaves = plugin.app.workspace.getLeavesOfType(OBSIDIAN_WEB_VIEWER_VIEW_TYPE);
		for (const leaf of leaves) {
			const view = leaf.view;
			if (!view) {
				continue;
			}

			const proto = Object.getPrototypeOf(view) as { onPaneMenu?: (menu: Menu, source: string) => void };
			if (!proto || patchedPrototypes.has(proto)) {
				continue;
			}

			const original =
				typeof proto.onPaneMenu === "function" ? proto.onPaneMenu : undefined;

			proto.onPaneMenu = function patchedWebViewerOnPaneMenu(
				this: View,
				menu: Menu,
				source: string
			) {
				original?.call(this, menu, source);

				if (source !== "more-options") {
					return;
				}
				if (this.getViewType?.() !== OBSIDIAN_WEB_VIEWER_VIEW_TYPE) {
					return;
				}
				if (!host.shouldShowPremiumEntry(PREMIUM_FEATURES.INCREMENTAL_READING)) {
					return;
				}

				const pageContext = getWebViewerPageContextFromView(this);
				if (!pageContext) {
					return;
				}

				menu.addSeparator();
				menu.addItem((item) => {
					item
						.setTitle("添加到增量阅读")
						.setIcon("book-plus")
						.onClick(() => {
							if (
								!host.ensurePremiumFeatureAccess(
									PREMIUM_FEATURES.INCREMENTAL_READING,
									"增量阅读"
								)
							) {
								return;
							}
							void host.runWebPageToIRQuickCreate({
								url: pageContext.url,
								title: pageContext.title,
							});
						});
				});
			};

			patchedPrototypes.add(proto);
			logger.info("[Standalone IR] 已为官方 Web Viewer 注入「添加到增量阅读」菜单");
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
