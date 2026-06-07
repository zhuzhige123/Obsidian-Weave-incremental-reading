import type { EventRef, Menu, Plugin } from "obsidian";
import type { CanvasMenuNode } from "./canvas-menu-node";

declare module "obsidian" {
	interface App {
		plugins: {
			getPlugin(id: string): Plugin | null;
		};
	}

	interface Workspace {
		on(
			name: "canvas:node-menu",
			callback: (menu: Menu, node: CanvasMenuNode) => void
		): EventRef;
	}

	interface MenuItem {
		setSubmenu(): Menu;
	}
}

export {};
