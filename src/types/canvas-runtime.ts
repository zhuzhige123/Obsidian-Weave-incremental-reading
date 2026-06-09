import type { TFile } from "obsidian";
import type { CanvasMenuNode, CanvasNodeData } from "./canvas-menu-node";

export type CanvasRuntimeNode = CanvasMenuNode & {
	nodeEl?: HTMLElement;
	contentEl?: HTMLElement;
	containerEl?: HTMLElement;
	el?: HTMLElement;
	text?: string;
	file?: string;
	label?: string;
	unknownData?: CanvasNodeData & {
		text?: string;
		file?: string;
	};
};

export type CanvasRuntime = {
	nodes?: Map<string, CanvasRuntimeNode>;
	selectOnly: (node: CanvasRuntimeNode) => void;
	zoomToSelection: () => void;
};

export type CanvasViewLike = {
	file?: TFile | null;
	canvas?: CanvasRuntime;
};

export function readCanvasNodeElement(node: CanvasRuntimeNode): HTMLElement | null {
	const candidates = [node.nodeEl, node.contentEl, node.containerEl, node.el];
	for (const candidate of candidates) {
		if (candidate instanceof HTMLElement) {
			return candidate;
		}
	}
	return null;
}
