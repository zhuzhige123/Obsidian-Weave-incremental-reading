import { App, Menu, Modal, Setting } from "obsidian";
import type { IRDeck } from "../types/ir-types";

export interface IRParagraphAddToTopicSubmitPayload {
	deckId: string;
	title: string;
}

interface IRParagraphAddToTopicModalOptions {
	deckOptions: IRDeck[];
	initialDeckId?: string;
	initialTitle: string;
	titleDetected: boolean;
	onCreateDeck: (name: string) => Promise<IRDeck>;
	onSubmit: (payload: IRParagraphAddToTopicSubmitPayload) => Promise<void>;
}

export class IRParagraphAddToTopicModal extends Modal {
	private readonly options: IRParagraphAddToTopicModalOptions;
	private deckOptions: IRDeck[];
	private draftTitle: string;
	private selectedDeckId: string;
	private titleInputEl: HTMLInputElement | null = null;
	private deckButtonEl: HTMLButtonElement | null = null;
	private submitButtonEl: HTMLButtonElement | null = null;
	private newDeckInputEl: HTMLInputElement | null = null;
	private showNewDeckInput = false;
	private creatingDeck = false;
	private submitting = false;

	constructor(app: App, options: IRParagraphAddToTopicModalOptions) {
		super(app);
		this.options = options;
		this.deckOptions = [...options.deckOptions];
		this.draftTitle = options.initialTitle;
		this.selectedDeckId = String(options.initialDeckId || "").trim();
	}

	onOpen(): void {
		this.titleEl.setText("添加到增量阅读专题");
		this.modalEl.addClass("weave-ir-paragraph-add-to-topic-modal");

		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("weave-ir-paragraph-add-to-topic-modal-content");

		const deckToolbarEl = contentEl.createDiv({ cls: "weave-selection-to-ir-toolbar" });
		const deckInfoEl = deckToolbarEl.createDiv({ cls: "weave-selection-to-ir-toolbar-info" });
		deckInfoEl.createDiv({ text: "所属专题", cls: "setting-item-name" });
		deckInfoEl.createDiv({
			text: "选择已有专题，或新建一个专题后再添加当前段落。",
			cls: "setting-item-description",
		});

		this.deckButtonEl = deckToolbarEl.createEl("button", {
			text: this.getDeckButtonText(),
		});
		this.deckButtonEl.addClass("weave-selection-to-ir-picker-button");
		this.deckButtonEl.addEventListener("click", (evt) => {
			this.showDeckMenu(evt as MouseEvent);
		});

		const newDeckRow = contentEl.createDiv({ cls: "weave-ir-paragraph-new-deck-row" });
		if (this.showNewDeckInput) {
			this.renderNewDeckInput(newDeckRow);
		} else {
			const createDeckBtn = newDeckRow.createEl("button", { text: "新建专题" });
			createDeckBtn.addClass("mod-cta");
			createDeckBtn.addEventListener("click", () => {
				this.showNewDeckInput = true;
				newDeckRow.empty();
				this.renderNewDeckInput(newDeckRow);
			});
		}

		const titleDesc = this.options.titleDetected
			? "已从当前段落中自动提取标题，你可以继续修改。"
			: "未检测到明确标题，已先用段落前缀生成标题。";

		new Setting(contentEl)
			.setName("标题")
			.setDesc(titleDesc)
			.addText((text) => {
				text.setValue(this.draftTitle);
				text.setPlaceholder("输入阅读点标题");
				this.titleInputEl = text.inputEl;
				text.onChange((value) => {
					this.draftTitle = value;
					this.syncSubmitButtonState();
				});
			});

		const footerEl = contentEl.createDiv({ cls: "weave-selection-to-ir-footer" });
		const cancelButton = footerEl.createEl("button", { text: "取消" });
		cancelButton.addEventListener("click", () => this.close());

		this.submitButtonEl = footerEl.createEl("button", { text: "添加到专题" });
		this.submitButtonEl.classList.add("mod-cta");
		this.submitButtonEl.addEventListener("click", () => {
			void this.handleSubmit();
		});
		this.syncSubmitButtonState();

		window.setTimeout(() => {
			this.titleInputEl?.focus();
			this.titleInputEl?.select();
		}, 0);
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private renderNewDeckInput(container: HTMLElement): void {
		container.empty();
		const inputWrap = container.createDiv({ cls: "weave-ir-paragraph-new-deck-input-wrap" });
		this.newDeckInputEl = inputWrap.createEl("input", {
			type: "text",
			placeholder: "输入新专题名称",
		});
		this.newDeckInputEl.addEventListener("keydown", (evt) => {
			if (evt.key === "Enter") {
				evt.preventDefault();
				void this.handleCreateDeck();
			}
		});

		const createBtn = container.createEl("button", { text: "创建" });
		createBtn.addClass("mod-cta");
		createBtn.addEventListener("click", () => {
			void this.handleCreateDeck();
		});

		const cancelBtn = container.createEl("button", { text: "取消" });
		cancelBtn.addEventListener("click", () => {
			this.showNewDeckInput = false;
			this.newDeckInputEl = null;
			this.onOpen();
		});

		window.setTimeout(() => this.newDeckInputEl?.focus(), 0);
	}

	private getDeckButtonText(): string {
		const selectedDeck = this.deckOptions.find((deck) => deck.id === this.selectedDeckId);
		return selectedDeck ? `专题：${selectedDeck.name}` : "选择增量阅读专题";
	}

	private showDeckMenu(evt: MouseEvent): void {
		const menu = new Menu();
		if (this.deckOptions.length === 0) {
			menu.addItem((item) => {
				item.setTitle("暂无专题，请先新建").setDisabled(true);
			});
		}

		for (const deck of this.deckOptions) {
			menu.addItem((item) => {
				item
					.setTitle(deck.name)
					.setChecked(deck.id === this.selectedDeckId)
					.onClick(() => {
						this.selectedDeckId = deck.id;
						if (this.deckButtonEl) {
							this.deckButtonEl.textContent = this.getDeckButtonText();
						}
						this.syncSubmitButtonState();
					});
			});
		}

		menu.showAtMouseEvent(evt);
	}

	private async handleCreateDeck(): Promise<void> {
		if (this.creatingDeck) {
			return;
		}
		const name = String(this.newDeckInputEl?.value || "").trim();
		if (!name) {
			return;
		}

		this.creatingDeck = true;
		try {
			const created = await this.options.onCreateDeck(name);
			this.deckOptions = [...this.deckOptions, created].sort((left, right) =>
				left.name.localeCompare(right.name)
			);
			this.selectedDeckId = created.id;
			this.showNewDeckInput = false;
			if (this.deckButtonEl) {
				this.deckButtonEl.textContent = this.getDeckButtonText();
			}
			this.syncSubmitButtonState();
		} finally {
			this.creatingDeck = false;
		}
	}

	private async handleSubmit(): Promise<void> {
		if (this.submitting || !this.selectedDeckId) {
			return;
		}

		this.draftTitle = String(this.titleInputEl?.value || this.draftTitle).trim();
		if (!this.draftTitle) {
			this.syncSubmitButtonState();
			return;
		}

		this.submitting = true;
		if (this.submitButtonEl) {
			this.submitButtonEl.disabled = true;
			this.submitButtonEl.textContent = "添加中...";
		}

		try {
			await this.options.onSubmit({
				deckId: this.selectedDeckId,
				title: this.draftTitle,
			});
			this.close();
		} finally {
			this.submitting = false;
			if (this.submitButtonEl) {
				this.submitButtonEl.textContent = "添加到专题";
			}
			this.syncSubmitButtonState();
		}
	}

	private syncSubmitButtonState(): void {
		if (!this.submitButtonEl) {
			return;
		}
		const title = String(this.titleInputEl?.value ?? this.draftTitle).trim();
		this.submitButtonEl.disabled = this.submitting || !this.selectedDeckId || !title;
	}
}
