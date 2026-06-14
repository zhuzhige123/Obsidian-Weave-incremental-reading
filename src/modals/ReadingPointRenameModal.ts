import { App, Modal, Notice } from "obsidian";
import { IRReadingPointEditService } from "../services/incremental-reading/reading-point-edit/IRReadingPointEditService";
import { buildSaveInputFromDraft } from "../services/incremental-reading/reading-point-edit/IRReadingPointEditSaveBuilder";
import type { IRReadingPointEditDraft } from "../services/incremental-reading/reading-point-edit/IRReadingPointEditTypes";
import { resolveReadingPointSaveErrorMessage } from "../services/incremental-reading/reading-point-edit/reading-point-modal-utils";
import { logger } from "../utils/logger";

export interface ReadingPointRenameModalOptions {
	draft: IRReadingPointEditDraft;
	onSaved?: () => void;
}

/**
 * Obsidian 原生风格重命名模态窗（与文件重命名同类：标题 + 输入框 + 保存/取消）。
 */
export class ReadingPointRenameModal extends Modal {
	private inputEl!: HTMLInputElement;
	private hintEl!: HTMLElement;
	private saveButtonEl!: HTMLButtonElement;
	private submitting = false;

	constructor(
		app: App,
		private readonly options: ReadingPointRenameModalOptions
	) {
		super(app);
	}

	onOpen(): void {
		this.setTitle("重命名");
		this.modalEl.addClass("weave-reading-point-rename-modal");

		const fieldEl = this.contentEl.createDiv({ cls: "weave-reading-point-rename-field" });
		this.inputEl = fieldEl.createEl("input", {
			type: "text",
			cls: "weave-reading-point-rename-input",
			attr: { spellcheck: "false" },
		});
		this.inputEl.value = this.options.draft.title;

		this.hintEl = fieldEl.createDiv({
			cls: "setting-item-description weave-reading-point-rename-hint",
		});

		const buttonRow = this.contentEl.createDiv({ cls: "modal-button-container" });

		this.saveButtonEl = buttonRow.createEl("button", { text: "保存", cls: "mod-cta" });
		this.saveButtonEl.onclick = () => {
			void this.submit();
		};

		const cancelButton = buttonRow.createEl("button", { text: "取消" });
		cancelButton.onclick = () => {
			this.close();
		};

		this.inputEl.addEventListener("input", () => {
			this.hintEl.empty();
			this.hintEl.removeClass("mod-warning");
		});

		this.inputEl.addEventListener("keydown", (event) => {
			if (event.key === "Enter") {
				event.preventDefault();
				void this.submit();
			}
		});

		this.inputEl.focus();
		this.inputEl.select();
	}

	private async showDuplicateHint(title: string): Promise<void> {
		const service = new IRReadingPointEditService(this.app);
		const matches = await service.findDuplicateTitleMatches({
			deckId: this.options.draft.deckId,
			title,
			excludePointId: this.options.draft.pointId,
		});

		this.hintEl.empty();
		this.hintEl.removeClass("mod-warning");
		if (matches.length > 0) {
			this.hintEl.setText(`同专题已有同名阅读点：${matches[0].title}`);
			this.hintEl.addClass("mod-warning");
		}
	}

	private async submit(): Promise<void> {
		if (this.submitting) {
			return;
		}

		const title = this.inputEl.value.trim();
		if (!title) {
			new Notice("标题不能为空", 2500);
			return;
		}

		if (title === this.options.draft.title.trim()) {
			this.close();
			return;
		}

		this.submitting = true;
		this.saveButtonEl.disabled = true;
		try {
			await this.showDuplicateHint(title);

			const service = new IRReadingPointEditService(this.app);
			const result = await service.saveEdit(
				buildSaveInputFromDraft(this.app, this.options.draft, {
					title,
					titleManuallyEdited: true,
				})
			);

			if (result.changed) {
				new Notice("已重命名", 2500);
			}
			this.options.onSaved?.();
			this.close();
		} catch (error) {
			logger.error("[ReadingPointRenameModal] save failed", error);
			new Notice(resolveReadingPointSaveErrorMessage(error), 3500);
		} finally {
			this.submitting = false;
			this.saveButtonEl.disabled = false;
		}
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
