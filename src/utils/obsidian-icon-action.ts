import { setIcon } from "obsidian";
import { resolveObsidianIconName } from "../icons/obsidian-icon-resolver";

/** Apply Obsidian setIcon directly on a button/element (native nav-action-button pattern). */
export function obsidianIcon(node: HTMLElement, name: string) {
	setIcon(node, resolveObsidianIconName(name));
	return {
		update(newName: string) {
			node.replaceChildren();
			setIcon(node, resolveObsidianIconName(newName));
		},
	};
}
