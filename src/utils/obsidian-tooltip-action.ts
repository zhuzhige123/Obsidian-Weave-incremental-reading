import { setTooltip } from "obsidian";

/** Svelte action：绑定 Obsidian 原生 tooltip */
export function obsidianTooltipAction(
	node: HTMLElement,
	text: string,
): { update(nextText: string): void } {
	setTooltip(node, text);
	return {
		update(nextText: string) {
			setTooltip(node, nextText);
		},
	};
}
