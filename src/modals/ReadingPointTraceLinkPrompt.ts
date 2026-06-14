import { App, Modal, Notice } from "obsidian";
import { mount, unmount } from "svelte";
import ReadingPointTraceLinkPromptPanel, {
	type ReadingPointTraceLinkPanelState,
} from "../components/incremental-reading/reading-point-edit/ReadingPointTraceLinkPromptPanel.svelte";
import type WeavePlugin from "../main";
import { IRReadingPointEditService } from "../services/incremental-reading/reading-point-edit/IRReadingPointEditService";
import { buildSaveInputFromDraft } from "../services/incremental-reading/reading-point-edit/IRReadingPointEditSaveBuilder";
import type { IRReadingPointEditDraft, IRReadingPointEditSaveResult } from "../services/incremental-reading/reading-point-edit/IRReadingPointEditTypes";
import { resolveReadingPointSaveErrorMessage } from "../services/incremental-reading/reading-point-edit/reading-point-modal-utils";
import { showObsidianConfirm } from "../utils/obsidian-confirm";
import { logger } from "../utils/logger";

export interface ReadingPointTraceLinkPromptOptions {
	plugin: WeavePlugin;
	draft: IRReadingPointEditDraft;
	onSaved?: (result: IRReadingPointEditSaveResult) => void;
}

export class ReadingPointTraceLinkPrompt extends Modal {
	private component: Parameters<typeof unmount>[0] | null = null;
	private panelState: ReadingPointTraceLinkPanelState | null = null;
	private submitting = false;

	constructor(
		app: App,
		private readonly options: ReadingPointTraceLinkPromptOptions
	) {
		super(app);
	}

	onOpen(): void {
		this.setTitle("编辑溯源链接");
		this.modalEl.addClass("weave-reading-point-trace-link-prompt");

		const panelHost = this.contentEl.createDiv({ cls: "weave-reading-point-trace-link-panel-host" });
		this.component = mount(ReadingPointTraceLinkPromptPanel, {
			target: panelHost,
			props: {
				plugin: this.options.plugin,
				draft: this.options.draft,
				onStateChange: (state) => {
					this.panelState = state;
				},
			},
		});

		const buttonRow = this.contentEl.createDiv({ cls: "modal-button-container" });
		const cancelButton = buttonRow.createEl("button", { text: "取消" });
		cancelButton.onclick = () => {
			void this.requestClose();
		};

		const saveButton = buttonRow.createEl("button", { text: "保存", cls: "mod-cta" });
		saveButton.onclick = () => {
			void this.submit();
		};
	}

	private async requestClose(): Promise<void> {
		if (!this.panelState?.dirty) {
			this.forceClose();
			return;
		}
		const confirmed = await showObsidianConfirm(this.app, "有未保存的更改，确定要关闭吗？", {
			title: "放弃更改",
			confirmText: "关闭",
			cancelText: "继续编辑",
			confirmClass: "mod-warning",
		});
		if (confirmed) {
			this.forceClose();
		}
	}

	private async submit(): Promise<void> {
		if (this.submitting || !this.panelState) {
			return;
		}

		if (!this.panelState.dirty) {
			this.forceClose();
			return;
		}

		if (!this.panelState.canSubmit) {
			new Notice("请先修正定位链接", 2500);
			return;
		}

		this.submitting = true;
		try {
			const service = new IRReadingPointEditService(this.app);
			const result = await service.saveEdit(
				buildSaveInputFromDraft(
					this.app,
					this.options.draft,
					{ linkInput: this.panelState.linkInput },
					{
						parsedTarget: this.panelState.parsedTarget,
						preserveScheduleOnLinkChange: this.panelState.preserveScheduleOnLinkChange,
					}
				)
			);

			if (result.changed) {
				new Notice("溯源链接已更新", 2500);
			}
			this.options.onSaved?.(result);
			this.forceClose();
		} catch (error) {
			logger.error("[ReadingPointTraceLinkPrompt] save failed", error);
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
		this.panelState = null;
		this.contentEl.empty();
	}
}
