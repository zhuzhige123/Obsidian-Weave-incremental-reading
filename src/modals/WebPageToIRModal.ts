import { App, Menu, Modal, Setting } from "obsidian";
import { i18n } from "../utils/i18n";

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
		this.titleEl.setText(i18n.t("irModals.webPageToIr.title"));
		this.modalEl.addClass("weave-selection-to-ir-modal", "weave-web-page-to-ir-modal");

		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("weave-selection-to-ir-modal-content");

		const urlPanelEl = contentEl.createDiv({ cls: "weave-selection-to-ir-panel" });
		urlPanelEl.createDiv({
			cls: "setting-item-name",
			text: i18n.t("irModals.webPageToIr.webLink"),
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
				text: i18n.t("irModals.webPageToIr.selectionExcerpt"),
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
			text: i18n.t("irModals.webPageToIr.deckName"),
			cls: "setting-item-name",
		});
		deckInfoEl.createDiv({
			text: i18n.t("irModals.webPageToIr.deckDesc"),
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
				? i18n.t("irModals.webPageToIr.titleFromSelectionDetected")
				: i18n.t("irModals.webPageToIr.titleFromSelectionFallback")
			: this.options.titleDetected
				? i18n.t("irModals.webPageToIr.titleFromPageDetected")
				: i18n.t("irModals.webPageToIr.titleFromPageFallback");

		new Setting(contentEl)
			.setName(i18n.t("irModals.webPageToIr.readingPointName"))
			.setDesc(titleDesc)
			.addText((text) => {
				text.setValue(this.draftTitle);
				text.setPlaceholder(i18n.t("irModals.webPageToIr.readingPointNamePlaceholder"));
				text.inputEl.addClass("weave-selection-to-ir-title-input");
				this.titleInputEl = text.inputEl;
				text.onChange((value) => {
					this.draftTitle = value;
					this.syncCreateButtonState();
				});
			});

		const footerEl = contentEl.createDiv({ cls: "weave-selection-to-ir-footer" });
		const cancelButton = footerEl.createEl("button", { text: i18n.t("irModals.common.cancel") });
		cancelButton.addEventListener("click", () => this.close());

		this.createButtonEl = footerEl.createEl("button", { text: i18n.t("irModals.webPageToIr.confirmAdd") });
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
		return selectedDeck
			? i18n.t("irModals.common.topicLabel", { name: selectedDeck.name })
			: i18n.t("irModals.common.selectTopic");
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
			this.createButtonEl.textContent = i18n.t("irModals.common.adding");
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
				this.createButtonEl.textContent = i18n.t("irModals.webPageToIr.confirmAdd");
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
