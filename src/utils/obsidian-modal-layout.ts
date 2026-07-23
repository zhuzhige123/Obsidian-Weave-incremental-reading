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
	/**
	 * 在 Obsidian 原生标题栏挂载右侧操作区（与标题同行：左标题、右操作）。
	 * 与 Weave ResizableModal `headerActions` / `weave-modal-header-toolbar` 对齐。
	 */
	headerActions?: boolean;
}

const HEADER_ROW_CLASS = "weave-obsidian-modal-header-row";
const HEADER_ACTIONS_CLASS = "weave-obsidian-modal-header-actions";

/**
 * 确保原生 Modal 标题与右侧 header actions 同一行：
 * [标题] …… [actions] [关闭按钮]
 * 可被多次调用；已存在则复用。
 */
export function ensureWeaveObsidianModalHeaderActions(
	modal: Modal,
): HTMLElement {
	const existing = modal.modalEl.querySelector<HTMLElement>(
		`.${HEADER_ACTIONS_CLASS}`,
	);
	if (existing) {
		return existing;
	}

	let headerRow = modal.modalEl.querySelector<HTMLElement>(
		`.${HEADER_ROW_CLASS}`,
	);
	if (!headerRow) {
		headerRow = modal.modalEl.createDiv({ cls: HEADER_ROW_CLASS });
		// 把标题行插到 titleEl 原位置，再把 titleEl 收进同一行左侧
		modal.titleEl.before(headerRow);
		headerRow.appendChild(modal.titleEl);
	}

	const host = headerRow.createDiv({
		cls: `${HEADER_ACTIONS_CLASS} weave-modal-header-toolbar`,
	});

	modal.modalEl.addClass("has-weave-header-actions");
	return host;
}

/** 关闭时拆掉标题行包装，还原 titleEl 到 modalEl，避免下次 open 结构错乱。 */
export function teardownWeaveObsidianModalHeaderActions(modal: Modal): void {
	const headerRow = modal.modalEl.querySelector<HTMLElement>(
		`.${HEADER_ROW_CLASS}`,
	);
	if (headerRow) {
		headerRow.before(modal.titleEl);
		headerRow.remove();
	} else {
		modal.modalEl
			.querySelector(`.${HEADER_ACTIONS_CLASS}`)
			?.remove();
	}
	modal.modalEl.removeClass("has-weave-header-actions");
}

export function configureWeaveObsidianModalLayout(
	modal: Modal,
	options: ConfigureWeaveObsidianModalLayoutOptions,
): { headerActionsEl: HTMLElement | null } {
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

	const headerActionsEl = options.headerActions
		? ensureWeaveObsidianModalHeaderActions(modal)
		: null;

	return { headerActionsEl };
}
