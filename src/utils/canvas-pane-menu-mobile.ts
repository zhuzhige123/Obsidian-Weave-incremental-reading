import type { Plugin } from "obsidian";
import { Platform } from "obsidian";
import type { ItemView, Menu } from "obsidian";
import { logger } from "./logger";
import {
	getLocationToggleIcon,
	getLocationToggleTooltip,
	toggleViewLocation,
} from "./view-location-utils";

type PaneMenuView = ItemView & {
	onPaneMenu?: (menu: Menu, source: string) => void;
};

type PatchedPrototype = {
	proto: PaneMenuView;
	original: ((menu: Menu, source: string) => void) | undefined;
};

/**
 * 给 Obsidian 原生 Canvas 视图的移动端顶部更多菜单追加“移动到侧边栏/内容区”入口。
 * 这里只 patch 原生 canvas 的 onPaneMenu，不影响插件自定义视图。
 */
export function registerMobileCanvasPaneMenuPatch(plugin: Plugin): void {
	const patchedPrototypes: PatchedPrototype[] = [];
	const patchedSet = new WeakSet<object>();

	const tryPatchCanvasViews = (): void => {
		if (!Platform.isMobile) return;

		const canvasLeaves = plugin.app.workspace.getLeavesOfType("canvas");
		for (const leaf of canvasLeaves) {
			const view = leaf.view as PaneMenuView | null;
			if (!view) continue;

			const proto = Object.getPrototypeOf(view) as PaneMenuView | null;
			if (!proto || patchedSet.has(proto)) continue;

			const original = typeof proto.onPaneMenu === "function" ? proto.onPaneMenu : undefined;
			proto.onPaneMenu = function (menu: Menu, source: string): void {
				original?.call(this, menu, source);

				if (!Platform.isMobile) return;
				if (typeof this.getViewType !== "function" || this.getViewType() !== "canvas") return;

				menu.addSeparator();
				menu.addItem((item) => {
					item
						.setTitle(getLocationToggleTooltip(this.leaf))
						.setIcon(getLocationToggleIcon(this.leaf))
						.onClick(async () => {
							await toggleViewLocation(this, "right");
						});
				});
			};

			patchedSet.add(proto);
			patchedPrototypes.push({ proto, original });
			logger.info("[CanvasPaneMenu] 已为原生 Canvas 视图注入移动端位置切换菜单");
		}
	};

	tryPatchCanvasViews();

	plugin.registerEvent(
		plugin.app.workspace.on("layout-change", () => {
			tryPatchCanvasViews();
		})
	);

	plugin.registerEvent(
		plugin.app.workspace.on("active-leaf-change", (leaf) => {
			if (leaf?.view?.getViewType?.() === "canvas") {
				tryPatchCanvasViews();
			}
		})
	);

	plugin.register(() => {
		for (const { proto, original } of patchedPrototypes) {
			if (original) {
				proto.onPaneMenu = original;
			} else {
				(proto as Partial<PaneMenuView>).onPaneMenu = undefined;
			}
		}
	});
}
