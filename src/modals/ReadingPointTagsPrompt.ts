import { App, Modal, Notice } from "obsidian";
import { mount, unmount } from "svelte";
import ReadingPointTagsPromptPanel from "../components/incremental-reading/reading-point-edit/ReadingPointTagsPromptPanel.svelte";
import { normalizeReadingPointTags } from "../services/incremental-reading/IRPointTagService";
import { buildSaveInputFromDraft } from "../services/incremental-reading/reading-point-edit/IRReadingPointEditSaveBuilder";
import { IRReadingPointEditService } from "../services/incremental-reading/reading-point-edit/IRReadingPointEditService";
import type { IRReadingPointEditDraft } from "../services/incremental-reading/reading-point-edit/IRReadingPointEditTypes";
import { resolveReadingPointSaveErrorMessage } from "../services/incremental-reading/reading-point-edit/reading-point-modal-utils";
import { i18n } from "../utils/i18n";
import { logger } from "../utils/logger";
import { showObsidianConfirm } from "../utils/obsidian-confirm";

export interface ReadingPointTagsPromptOptions {
	draft: IRReadingPointEditDraft;
	onSaved?: () => void;
}

export class ReadingPointTagsPrompt extends Modal {
	private component: Parameters<typeof unmount>[0] | null = null;
	private tags: string[] = [];
	private initialTagsKey = "";
	private submitting = false;

	constructor(
		app: App,
		private readonly options: ReadingPointTagsPromptOptions,
	) {
		super(app);
		this.tags = [...options.draft.tags];
		this.initialTagsKey = JSON.stringify(normalizeReadingPointTags(this.tags));
	}

	onOpen(): void {
		const { draft } = this.options;
		this.setTitle(i18n.t("irModals.readingPointTags.title"));
		this.modalEl.addClass("weave-reading-point-tags-prompt");

		const intro = this.contentEl.createDiv({ cls: "setting-item-description" });
		intro.setText(i18n.t("irModals.readingPointTags.intro"));

		const panelHost = this.contentEl.createDiv({
			cls: "weave-reading-point-tags-panel-host",
		});
		this.component = mount(ReadingPointTagsPromptPanel, {
			target: panelHost,
			props: {
				app: this.app,
				tags: this.tags,
				disabled: !draft.canEditTags,
				onTagsChange: (nextTags: string[]) => {
					this.tags = nextTags;
				},
			},
		});

		const buttonRow = this.contentEl.createDiv({
			cls: "modal-button-container",
		});
		const cancelButton = buttonRow.createEl("button", {
			text: i18n.t("irModals.common.cancel"),
		});
		cancelButton.onclick = () => {
			void this.requestClose();
		};

		const saveButton = buttonRow.createEl("button", {
			text: i18n.t("irModals.common.save"),
			cls: "mod-cta",
		});
		saveButton.disabled = !draft.canEditTags;
		saveButton.onclick = () => {
			void this.submit();
		};
	}

	private isDirty(): boolean {
		return (
			JSON.stringify(normalizeReadingPointTags(this.tags)) !==
			this.initialTagsKey
		);
	}

	private async requestClose(): Promise<void> {
		if (!this.isDirty()) {
			this.forceClose();
			return;
		}
		const confirmed = await showObsidianConfirm(
			this.app,
			i18n.t("irModals.common.discardChangesMessage"),
			{
				title: i18n.t("irModals.common.discardChangesTitle"),
				confirmText: i18n.t("irModals.common.close"),
				cancelText: i18n.t("irModals.common.continueEditing"),
				confirmClass: "mod-warning",
			},
		);
		if (confirmed) {
			this.forceClose();
		}
	}

	private async submit(): Promise<void> {
		if (this.submitting || !this.options.draft.canEditTags) {
			return;
		}

		if (!this.isDirty()) {
			this.forceClose();
			return;
		}

		this.submitting = true;
		try {
			const service = new IRReadingPointEditService(this.app);
			const result = await service.saveEdit(
				buildSaveInputFromDraft(this.app, this.options.draft, {
					tags: normalizeReadingPointTags(this.tags),
				}),
			);

			if (result.changed) {
				new Notice(i18n.t("irModals.readingPointTags.tagsUpdated"), 2500);
			}
			this.options.onSaved?.();
			this.forceClose();
		} catch (error) {
			logger.error("[ReadingPointTagsPrompt] save failed", error);
			new Notice(resolveReadingPointSaveErrorMessage(error), 3500);
		} finally {
			this.submitting = false;
		}
	}

	close(): void {
		void this.requestClose();
	}

	forceClose(): void {
		super.close();
	}

	onClose(): void {
		if (this.component) {
			void unmount(this.component);
			this.component = null;
		}
		this.contentEl.empty();
	}
}
