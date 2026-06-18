import { App, Modal } from "obsidian";
import { mount, unmount } from "svelte";
import type WeavePlugin from "../../main";
import { configureWeaveObsidianModalLayout } from "../../utils/obsidian-modal-layout";
import { i18n } from "../../utils/i18n";
import AddReadingTargetModal from "./AddReadingTargetModal.svelte";

import type { ReadingTargetScheduleMode } from "../../services/incremental-reading/reading-target/IRReadingTargetScheduleDate";

export interface AddReadingTargetModalObsidianOptions {
	plugin: WeavePlugin;
	initialLink?: string;
	initialTitle?: string;
	initialDeckId?: string;
	scheduleDate?: Date;
	defaultScheduleMode?: ReadingTargetScheduleMode;
	onClose?: () => void;
	onAdded?: () => void;
}

export class AddReadingTargetModalObsidian extends Modal {
	private component: Parameters<typeof unmount>[0] | null = null;
	private footerEl: HTMLElement | null = null;
	private readonly options: AddReadingTargetModalObsidianOptions;

	constructor(app: App, options: AddReadingTargetModalObsidianOptions) {
		super(app);
		this.options = options;
	}

	onOpen(): void {
		this.setTitle(i18n.t("irAddTarget.title"));
		configureWeaveObsidianModalLayout(this, {
			modalClass: "weave-add-reading-target-modal",
			contentClass: "weave-add-reading-target-modal-content",
		});

		this.footerEl = this.modalEl.createDiv({
			cls: "weave-add-reading-target-modal-footer",
		});
		this.contentEl.insertAdjacentElement("afterend", this.footerEl);

		this.component = mount(AddReadingTargetModal, {
			target: this.contentEl,
			props: {
				plugin: this.options.plugin,
				initialLink: this.options.initialLink || "",
				initialTitle: this.options.initialTitle || "",
				initialDeckId: this.options.initialDeckId || "",
				initialScheduleDate: this.options.scheduleDate || new Date(),
				defaultScheduleMode: this.options.defaultScheduleMode,
				footerEl: this.footerEl,
				onClose: () => this.close(),
				onAdded: () => {
					this.options.onAdded?.();
				},
			},
		});
	}

	onClose(): void {
		if (this.component) {
			void unmount(this.component);
			this.component = null;
		}
		if (this.footerEl) {
			this.footerEl.remove();
			this.footerEl = null;
		}
		this.contentEl.empty();
		this.options.onClose?.();
	}
}
