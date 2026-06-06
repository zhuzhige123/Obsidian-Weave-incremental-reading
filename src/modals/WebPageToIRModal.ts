import { App, Menu, Modal, Setting } from "obsidian";

export interface WebPageToIRSubmitPayload {
	title: string;
	deckId: string;
}

interface WebPageToIRModalOptions {
	url: string;
	deckOptions: Array<{ id: string; name: string }>;
	initialDeckId?: string;
	initialTitle: string;
	titleDetected: boolean;
	selectedText?: string;
	onSubmit: (payload: WebPageToIRSubmitPayload) => Promise<void>;
}

export class WebPageToIRModal extends Modal {
	private readonly options: WebPageToIRModalOptions;
	private draftTitle: string;
	private selectedDeckId: string;
	private titleInputEl: HTMLInputElement | null = null;
	private deckButtonEl: HTMLButtonElement | null = null;
	private createButtonEl: HTMLButtonElement | null = null;
	private creating = false;

	constructor(app: App, options: WebPageToIRModalOptions) {
		super(app);
		this.options = options;
		this.draftTitle = options.initialTitle;
		this.selectedDeckId = String(options.initialDeckId || "").trim();
	}

	onOpen(): void {
		this.titleEl.setText("添加到增量阅读");
		this.modalEl.addClass("weave-selection-to-ir-modal", "weave-web-page-to-ir-modal");

		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("weave-selection-to-ir-modal-content");

		const urlPanelEl = contentEl.createDiv({ cls: "weave-selection-to-ir-panel" });
		urlPanelEl.createDiv({
			cls: "setting-item-name",
			text: "网页链接",
		});
		urlPanelEl.createEl("div", {
			cls: "setting-item-description weave-web-page-to-ir-url",
			text: this.options.url,
		});

		const selectedText = String(this.options.selectedText || "").replace(/\r\n?/g, "\n").trim();
		if (selectedText) {
			const selectionPanelEl = contentEl.createDiv({ cls: "weave-selection-to-ir-panel" });
			selectionPanelEl.createDiv({
				cls: "setting-item-name",
				text: "选区摘录",
			});
			selectionPanelEl.createEl("div", {
				cls: "setting-item-description weave-web-page-to-ir-selection",
				text: selectedText.length > 280 ? `${selectedText.slice(0, 280)}…` : selectedText,
			});
		}

		const headerPanelEl = contentEl.createDiv({ cls: "weave-selection-to-ir-panel" });
		const deckToolbarEl = headerPanelEl.createDiv({ cls: "weave-selection-to-ir-toolbar" });
		const deckInfoEl = deckToolbarEl.createDiv({ cls: "weave-selection-to-ir-toolbar-info" });
		deckInfoEl.createDiv({
			text: "所属专题",
			cls: "setting-item-name",
		});
		deckInfoEl.createDiv({
			text: "选择该网页阅读点要加入的增量阅读专题。",
			cls: "setting-item-description",
		});

		this.deckButtonEl = deckToolbarEl.createEl("button", {
			text: this.getDeckButtonText(),
		});
		this.applyPickerButtonStyle(this.deckButtonEl);
		this.deckButtonEl.addEventListener("click", (evt) => {
			this.showDeckMenu(evt as MouseEvent);
		});

		const titleDesc = selectedText
			? this.options.titleDetected
				? "已从选区自动提取标题，你可以继续修改。"
				: "未检测到明确标题，已根据选区内容生成默认名称。"
			: this.options.titleDetected
				? "已使用当前网页标题，你可以继续修改。"
				: "未能读取网页标题，已根据链接生成默认名称。";

		new Setting(contentEl)
			.setName("阅读点名称")
			.setDesc(titleDesc)
			.addText((text) => {
				text.setValue(this.draftTitle);
				text.setPlaceholder("输入阅读点名称");
				text.inputEl.addClass("weave-selection-to-ir-title-input");
				this.titleInputEl = text.inputEl;
				text.onChange((value) => {
					this.draftTitle = value;
					this.syncCreateButtonState();
				});
			});

		const footerEl = contentEl.createDiv({ cls: "weave-selection-to-ir-footer" });
		const cancelButton = footerEl.createEl("button", { text: "取消" });
		cancelButton.addEventListener("click", () => this.close());

		this.createButtonEl = footerEl.createEl("button", { text: "确认添加" });
		this.createButtonEl.classList.add("mod-cta");
		this.createButtonEl.addEventListener("click", () => {
			void this.handleCreate();
		});
		this.syncCreateButtonState();

		this.scope.register([], "Enter", (evt: KeyboardEvent) => {
			if (evt.metaKey || evt.ctrlKey) {
				evt.preventDefault();
				void this.handleCreate();
			}
		});

		window.setTimeout(() => {
			this.titleInputEl?.focus();
			this.titleInputEl?.select();
		}, 0);
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private getDeckButtonText(): string {
		const selectedDeck = this.options.deckOptions.find((deck) => deck.id === this.selectedDeckId);
		return selectedDeck ? `专题：${selectedDeck.name}` : "选择增量阅读专题";
	}

	private applyPickerButtonStyle(buttonEl: HTMLButtonElement): void {
		buttonEl.addClass("weave-selection-to-ir-picker-button");
	}

	private showDeckMenu(evt: MouseEvent): void {
		const menu = new Menu();

		for (const deck of this.options.deckOptions) {
			menu.addItem((item) => {
				item
					.setTitle(deck.name)
					.setChecked(deck.id === this.selectedDeckId)
					.onClick(() => {
						this.selectedDeckId = deck.id;
						if (this.deckButtonEl) {
							this.deckButtonEl.textContent = this.getDeckButtonText();
						}
						this.syncCreateButtonState();
					});
			});
		}

		menu.showAtMouseEvent(evt);
	}

	private async handleCreate(): Promise<void> {
		if (this.creating || !this.selectedDeckId) {
			return;
		}

		this.draftTitle = this.titleInputEl?.value ?? this.draftTitle;
		if (!this.draftTitle.trim()) {
			this.syncCreateButtonState();
			return;
		}

		this.creating = true;
		if (this.createButtonEl) {
			this.createButtonEl.disabled = true;
			this.createButtonEl.textContent = "添加中...";
		}

		try {
			await this.options.onSubmit({
				title: this.draftTitle,
				deckId: this.selectedDeckId,
			});
			this.close();
		} catch {
			// Caller surfaces user-facing notices.
		} finally {
			this.creating = false;
			if (this.createButtonEl) {
				this.createButtonEl.textContent = "确认添加";
			}
			this.syncCreateButtonState();
		}
	}

	private syncCreateButtonState(): void {
		if (!this.createButtonEl) {
			return;
		}

		const title = (this.titleInputEl?.value ?? this.draftTitle).trim();
		this.createButtonEl.disabled = this.creating || !this.selectedDeckId || !title;
	}
}
