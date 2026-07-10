import type { EventRef, Menu, Plugin, Scope } from "obsidian";
import type { CanvasMenuNode } from "./canvas-menu-node";

type CodeMirrorLineHandle = object;

type CodeMirrorEditorState = {
	selection: { main: { from: number; to: number } };
	doc: { length: number; toString(): string };
	sliceDoc(from: number, to: number): string;
};

type CodeMirrorEditorCompat = {
	addLineClass: (
		line: number | CodeMirrorLineHandle,
		where: string,
		className: string,
	) => CodeMirrorLineHandle;
	removeLineClass: (
		line: number | CodeMirrorLineHandle,
		where: string,
		className: string,
	) => void;
	state: CodeMirrorEditorState;
	dispatch: (transaction: {
		changes: { from: number; to: number; insert: string };
		selection?: { anchor: number };
	}) => void;
};

declare module "obsidian" {
	interface App {
		plugins: {
			getPlugin(id: string): Plugin | null;
		};
		keymap?: {
			pushScope?: (scope: Scope) => void;
			popScope?: (scope: Scope) => void;
		};
		setting?: {
			open?: () => void;
			openTabById?: (tabId: string) => void;
		};
	}

	interface Notice {
		isShown?: boolean | (() => boolean);
	}

	interface Vault {
		getConfig?: (key: string) => unknown;
	}

	interface Workspace {
		on(
			name: "canvas:node-menu",
			callback: (menu: Menu, node: CanvasMenuNode) => void,
		): EventRef;
		on(name: string, callback: (...args: unknown[]) => void): EventRef;
	}

	interface WorkspaceLeaf {
		containerEl: HTMLElement;
	}

	interface MenuItem {
		setSubmenu(): Menu;
	}

	interface Editor {
		cm?: CodeMirrorEditorCompat;
	}
}
