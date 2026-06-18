import { App, Menu, Modal, Setting } from "obsidian";
import type { IRDeck } from "../types/ir-types";
import { i18n } from "../utils/i18n";

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
		this.titleEl.setText(i18n.t("irModals.paragraphAddToTopic.title"));
		this.modalEl.addClass("weave-ir-paragraph-add-to-topic-modal");

		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("weave-ir-paragraph-add-to-topic-modal-content");

		const deckToolbarEl = contentEl.createDiv({ cls: "weave-selection-to-ir-toolbar" });
		const deckInfoEl = deckToolbarEl.createDiv({ cls: "weave-selection-to-ir-toolbar-info" });
		deckInfoEl.createDiv({ text: i18n.t("irModals.paragraphAddToTopic.deckName"), cls: "setting-item-name" });
		deckInfoEl.createDiv({
			text: i18n.t("irModals.paragraphAddToTopic.deckDesc"),
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
			const createDeckBtn = newDeckRow.createEl("button", { text: i18n.t("irModals.paragraphAddToTopic.newTopic") });
			createDeckBtn.addClass("mod-cta");
			createDeckBtn.addEventListener("click", () => {
				this.showNewDeckInput = true;
				newDeckRow.empty();
				this.renderNewDeckInput(newDeckRow);
			});
		}

		const titleDesc = this.options.titleDetected
			? i18n.t("irModals.paragraphAddToTopic.titleDetected")
			: i18n.t("irModals.paragraphAddToTopic.titleFallback");

		new Setting(contentEl)
			.setName(i18n.t("irModals.common.title"))
			.setDesc(titleDesc)
			.addText((text) => {
				text.setValue(this.draftTitle);
				text.setPlaceholder(i18n.t("irModals.paragraphAddToTopic.titlePlaceholder"));
				this.titleInputEl = text.inputEl;
				text.onChange((value) => {
					this.draftTitle = value;
					this.syncSubmitButtonState();
				});
			});

		const footerEl = contentEl.createDiv({ cls: "weave-selection-to-ir-footer" });
		const cancelButton = footerEl.createEl("button", { text: i18n.t("irModals.common.cancel") });
		cancelButton.addEventListener("click", () => this.close());

		this.submitButtonEl = footerEl.createEl("button", { text: i18n.t("irModals.paragraphAddToTopic.submit") });
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
			placeholder: i18n.t("irModals.paragraphAddToTopic.newTopicPlaceholder"),
		});
		this.newDeckInputEl.addEventListener("keydown", (evt) => {
			if (evt.key === "Enter") {
				evt.preventDefault();
				void this.handleCreateDeck();
			}
		});

		const createBtn = container.createEl("button", { text: i18n.t("irModals.common.create") });
		createBtn.addClass("mod-cta");
		createBtn.addEventListener("click", () => {
			void this.handleCreateDeck();
		});

		const cancelBtn = container.createEl("button", { text: i18n.t("irModals.common.cancel") });
		cancelBtn.addEventListener("click", () => {
			this.showNewDeckInput = false;
			this.newDeckInputEl = null;
			this.onOpen();
		});

		window.setTimeout(() => this.newDeckInputEl?.focus(), 0);
	}

	private getDeckButtonText(): string {
		const selectedDeck = this.deckOptions.find((deck) => deck.id === this.selectedDeckId);
		return selectedDeck
			? i18n.t("irModals.common.topicLabel", { name: selectedDeck.name })
			: i18n.t("irModals.common.selectTopic");
	}

	private showDeckMenu(evt: MouseEvent): void {
		const menu = new Menu();
		if (this.deckOptions.length === 0) {
			menu.addItem((item) => {
				item.setTitle(i18n.t("irModals.common.noTopicsYet")).setDisabled(true);
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
			this.submitButtonEl.textContent = i18n.t("irModals.common.adding");
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
				this.submitButtonEl.textContent = i18n.t("irModals.paragraphAddToTopic.submit");
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
