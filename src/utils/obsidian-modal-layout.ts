import type { Modal } from "obsidian";

export type WeaveObsidianModalTitleAccent =
	| "purple"
	| "blue"
	| "green"
	| "cyan"
	| "orange"
	| "pink"
	| "red";

interface ConfigureWeaveObsidianModalLayoutOptions {
	modalClass: string;
	contentClass: string;
	/** 标题左侧插件标识色条；默认 purple，与设置页分组标题一致 */
	titleAccent?: WeaveObsidianModalTitleAccent | false;
}

export function configureWeaveObsidianModalLayout(
	modal: Modal,
	options: ConfigureWeaveObsidianModalLayoutOptions,
): void {
	modal.modalEl.addClass(
		"weave-obsidian-modal-shell",
		...options.modalClass.split(/\s+/).filter(Boolean),
	);
	modal.contentEl.empty();
	modal.contentEl.addClass(
		"weave-obsidian-modal-content-shell",
		...options.contentClass.split(/\s+/).filter(Boolean),
	);

	const titleAccent =
		options.titleAccent === false ? null : options.titleAccent ?? "purple";
	if (titleAccent) {
		modal.titleEl.addClass("with-accent-bar", `accent-${titleAccent}`);
	}
}
