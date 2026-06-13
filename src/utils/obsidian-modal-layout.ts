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
	titleAccent?: WeaveObsidianModalTitleAccent;
}

export function configureWeaveObsidianModalLayout(
	modal: Modal,
	options: ConfigureWeaveObsidianModalLayoutOptions
): void {
	modal.modalEl.addClass(
		"weave-obsidian-modal-shell",
		...options.modalClass.split(/\s+/).filter(Boolean)
	);
	modal.contentEl.empty();
	modal.contentEl.addClass(
		"weave-obsidian-modal-content-shell",
		...options.contentClass.split(/\s+/).filter(Boolean)
	);

	if (options.titleAccent) {
		modal.titleEl.addClass("with-accent-bar", `accent-${options.titleAccent}`);
	}
}
