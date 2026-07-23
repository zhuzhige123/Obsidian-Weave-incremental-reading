import { App, Modal, Notice } from "obsidian";
import { IRDeckManager } from "../services/incremental-reading/IRDeckManager";
import { IRStorageService } from "../services/incremental-reading/IRStorageService";
import type { IRDeck } from "../types/ir-types";
import { i18n } from "../utils/i18n";
import { logger } from "../utils/logger";

export interface CreateIRTopicModalOptions {
	onCreated?: (deck: IRDeck) => void | Promise<void>;
	onClose?: () => void;
}

/**
 * 新建增量阅读专题（轻量名称模态窗）。
 * 交互对齐 Weave「新建牌组」：从所属专题菜单底部打开独立创建窗。
 */
export class CreateIRTopicModal extends Modal {
	private inputEl!: HTMLInputElement;
	private createButtonEl!: HTMLButtonElement;
	private submitting = false;
	private readonly options: CreateIRTopicModalOptions;

	constructor(app: App, options: CreateIRTopicModalOptions = {}) {
		super(app);
		this.options = options;
	}

	onOpen(): void {
		this.setTitle(i18n.t("irAddTarget.deck.createTopicTitle"));
		this.modalEl.addClass("weave-create-ir-topic-modal");

		const fieldEl = this.contentEl.createDiv({
			cls: "weave-create-ir-topic-field",
		});
		fieldEl.createDiv({
			text: i18n.t("irAddTarget.deck.nameLabel"),
			cls: "setting-item-name",
		});

		this.inputEl = fieldEl.createEl("input", {
			type: "text",
			cls: "weave-create-ir-topic-input",
			attr: {
				spellcheck: "false",
				placeholder: i18n.t("irAddTarget.deck.namePlaceholder"),
			},
		});

		const buttonRow = this.contentEl.createDiv({
			cls: "modal-button-container",
		});

		const cancelButton = buttonRow.createEl("button", {
			text: i18n.t("irModals.common.cancel"),
		});
		cancelButton.onclick = () => {
			this.close();
		};

		this.createButtonEl = buttonRow.createEl("button", {
			text: i18n.t("irModals.common.create"),
			cls: "mod-cta",
		});
		this.createButtonEl.onclick = () => {
			void this.submit();
		};

		this.inputEl.addEventListener("keydown", (event) => {
			if (event.key === "Enter") {
				event.preventDefault();
				void this.submit();
			}
		});

		window.setTimeout(() => {
			this.inputEl.focus();
			this.inputEl.select();
		}, 0);
	}

	private async submit(): Promise<void> {
		if (this.submitting) {
			return;
		}

		const name = this.inputEl.value.trim();
		if (!name) {
			new Notice(i18n.t("irAddTarget.deck.emptyName"), 2500);
			return;
		}

		this.submitting = true;
		this.createButtonEl.disabled = true;
		this.inputEl.disabled = true;
		try {
			const storage = new IRStorageService(this.app);
			await storage.initialize();
			const deckManager = new IRDeckManager(this.app, storage);
			const deck = await deckManager.createDeck(name);
			await Promise.resolve(this.options.onCreated?.(deck));
			this.close();
		} catch (error) {
			logger.error("[CreateIRTopicModal] create failed", error);
			new Notice(i18n.t("irAddTarget.deck.createFailed"), 3500);
		} finally {
			this.submitting = false;
			this.createButtonEl.disabled = false;
			this.inputEl.disabled = false;
		}
	}

	onClose(): void {
		this.contentEl.empty();
		this.options.onClose?.();
	}
}

let activeCreateIRTopicModal: CreateIRTopicModal | null = null;

/** 打开新建专题模态窗；若已有实例则先关闭再建。 */
export function openCreateIRTopicModal(params: {
	app: App;
	onCreated?: (deck: IRDeck) => void | Promise<void>;
}): void {
	activeCreateIRTopicModal?.close();
	activeCreateIRTopicModal = new CreateIRTopicModal(params.app, {
		onCreated: (deck) => {
			void Promise.resolve(params.onCreated?.(deck));
		},
		onClose: () => {
			activeCreateIRTopicModal = null;
		},
	});
	activeCreateIRTopicModal.open();
}
