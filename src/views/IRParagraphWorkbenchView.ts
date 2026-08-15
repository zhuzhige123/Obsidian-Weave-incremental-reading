import { ItemView, type ViewStateResult, WorkspaceLeaf } from "obsidian";
import type { unmount } from "svelte";
import type { WeavePlugin } from "../main";
import { IR_RUNTIME } from "../services/incremental-reading/ir-runtime";
import type { ParagraphWorkbenchOpenInput } from "../services/incremental-reading/paragraph-workbench/types";
import { labelParagraphWorkbenchSurface } from "../services/incremental-reading/paragraph-workbench/paragraph-workbench-maturity";
import { renderBouncingBallsLoading } from "../utils/bouncing-balls-loading";
import { i18n } from "../utils/i18n";
import { logger } from "../utils/logger";
import { getViewSurfaceTokens } from "../utils/view-location-utils";

export const VIEW_TYPE_IR_PARAGRAPH_WORKBENCH = IR_RUNTIME.viewTypes.workbench;

type IRParagraphWorkbenchViewState = ParagraphWorkbenchOpenInput & {
	displayTitle?: string;
};

type MountedWorkbenchComponent = Parameters<typeof unmount>[0];

export class IRParagraphWorkbenchView extends ItemView {
	private component: MountedWorkbenchComponent | null = null;
	private plugin: WeavePlugin;
	private openInput: ParagraphWorkbenchOpenInput | null = null;
	private isOpen = false;

	constructor(leaf: WorkspaceLeaf, plugin: WeavePlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return VIEW_TYPE_IR_PARAGRAPH_WORKBENCH;
	}

	getDisplayText(): string {
		const title =
			this.openInput?.topicName || this.openInput?.sourcePath?.split("/").pop();
		const base = title
			? `${title} · ${i18n.t("irViews.workbench.paragraphSuffix")}`
			: i18n.t("irViews.workbench.defaultTitle");
		return labelParagraphWorkbenchSurface(base);
	}

	getIcon(): string {
		return "book-open-check";
	}

	allowNoFile(): boolean {
		return true;
	}

	getState(): Record<string, unknown> {
		return {
			...(this.openInput ?? { sourceType: "markdown", sourcePath: "" }),
		};
	}

	async setState(
		state: IRParagraphWorkbenchViewState,
		result: ViewStateResult,
	): Promise<void> {
		await super.setState(state, result);
		const sourcePath = String(state?.sourcePath || "").trim();
		if (!sourcePath) {
			return;
		}
		this.openInput = {
			sourceType: state.sourceType || "markdown",
			sourcePath,
			segmentIndex: state.segmentIndex,
			topicId: state.topicId,
			topicName: state.topicName,
			pointId: state.pointId,
			canvasNodeId: state.canvasNodeId,
			epubCfi: state.epubCfi,
		};
		if (this.isOpen) {
			void this.loadComponentAsync();
		}
	}

	async onOpen(): Promise<void> {
		this.isOpen = true;
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("weave-ir-paragraph-workbench-view");
		this.applySurfaceContext();
		renderBouncingBallsLoading(contentEl, {
			message: i18n.t("irViews.workbench.loading"),
			className: "weave-calendar-loading",
		});
		void this.loadComponentAsync();
	}

	async onClose(): Promise<void> {
		this.isOpen = false;
		if (this.component) {
			const { unmount } = await import("svelte");
			void unmount(this.component);
			this.component = null;
		}
		this.contentEl.empty();
	}

	private applySurfaceContext(): void {
		const surfaceTokens = getViewSurfaceTokens(this.leaf);
		const targets = [this.contentEl, this.contentEl.parentElement].filter(
			Boolean,
		) as HTMLElement[];
		for (const target of targets) {
			target.dataset.weaveSurfaceContext = surfaceTokens.context;
			target.style.setProperty(
				"--weave-surface-background",
				surfaceTokens.surfaceBackground,
			);
			target.style.setProperty(
				"--weave-elevated-background",
				surfaceTokens.elevatedBackground,
			);
		}
	}

	private async loadComponentAsync(): Promise<void> {
		try {
			if (this.component) {
				const { unmount } = await import("svelte");
				void unmount(this.component);
				this.component = null;
			}
			this.contentEl.empty();
			const { mount } = await import("svelte");
			const { default: Component } = await import(
				"../components/incremental-reading/paragraph-workbench/IRParagraphReadingWorkbench.svelte"
			);
			this.component = mount(Component, {
				target: this.contentEl,
				props: {
					plugin: this.plugin,
					initialInput: this.openInput,
				},
			});
			logger.debug("[IRParagraphWorkbenchView] Workbench mounted");
		} catch (error) {
			logger.error(
				"[IRParagraphWorkbenchView] Failed to mount workbench:",
				error,
			);
			this.contentEl.empty();
			this.contentEl.createDiv({
				cls: "error",
				text: i18n.t("irViews.workbench.loadFailed"),
			});
		}
	}
}
