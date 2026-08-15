import {
	FileView,
	Notice,
	Platform,
	TFile,
	type ViewStateResult,
	WorkspaceLeaf,
} from "obsidian";
import type { WeavePlugin } from "../main";
import { IR_RUNTIME } from "../services/incremental-reading/ir-runtime";
import {
	IR_DECK_FILE_EXTENSION,
	basenameWithoutExtension,
} from "../utils/ir-internal-data-path";
import { renderBouncingBallsLoading } from "../utils/bouncing-balls-loading";
import { i18n } from "../utils/i18n";
import { logger } from "../utils/logger";
import { readString } from "../utils/unknown-record";
import { DeferredLeafRedirectController } from "./DeferredLeafRedirectController";

export const VIEW_TYPE_IRDECK = IR_RUNTIME.viewTypes.deck;

const IR_DECK_EXTENSION = IR_DECK_FILE_EXTENSION.replace(/^\./, "");

/**
 * `.irdeck` 文件入口视图。
 * 按 Obsidian 惯例继承 FileView 绑定文件；实际 UI 延迟重定向到侧边栏月历，
 * 并按该专题的 topicId 过滤阅读点。
 */
export class IRDeckView extends FileView {
	private plugin: WeavePlugin;
	/** Path cache for legacy workspace state before FileView binds `this.file`. */
	private pendingPath = "";
	private isOpen = false;
	/** Sticky after a successful redirect; cleared only on failure so we can retry. */
	private redirectSettled = false;
	private readonly redirectController: DeferredLeafRedirectController;

	constructor(leaf: WorkspaceLeaf, plugin: WeavePlugin) {
		super(leaf);
		this.plugin = plugin;
		this.redirectController = new DeferredLeafRedirectController({
			workspace: plugin.app.workspace,
			leaf,
			shouldRedirect: () =>
				this.isOpen && !!this.resolveBoundPath() && !this.redirectSettled,
			onRedirect: () => {
				void this.redirectToCalendar();
			},
		});
	}

	getViewType(): string {
		return VIEW_TYPE_IRDECK;
	}

	getDisplayText(): string {
		if (Platform.isMobile) {
			return "";
		}

		if (this.file) {
			return this.file.basename || this.file.name || "IRDeck";
		}

		return basenameWithoutExtension(this.pendingPath, "IRDeck");
	}

	getIcon(): string {
		return "calendar";
	}

	canAcceptExtension(extension: string): boolean {
		return extension.toLowerCase() === IR_DECK_EXTENSION;
	}

	getState(): Record<string, unknown> {
		const path = this.resolveBoundPath();
		return {
			...super.getState(),
			// Keep filePath for older workspace layouts that read it explicitly.
			...(path ? { filePath: path } : {}),
		};
	}

	async setState(
		state: Record<string, unknown>,
		result: ViewStateResult,
	): Promise<void> {
		await super.setState(state, result);

		const incomingPath =
			this.file?.path ||
			readString(state?.filePath) ||
			readString(state?.file);
		if (incomingPath) {
			this.pendingPath = incomingPath;
		}

		if (this.isOpen && this.resolveBoundPath()) {
			this.redirectController.request();
		}
	}

	async onLoadFile(file: TFile): Promise<void> {
		await super.onLoadFile(file);
		this.pendingPath = file.path;

		if (this.isOpen) {
			this.redirectController.request();
		}
	}

	async onUnloadFile(file: TFile): Promise<void> {
		await super.onUnloadFile(file);
		if (this.pendingPath === file.path) {
			this.pendingPath = "";
		}
	}

	async onOpen(): Promise<void> {
		this.isOpen = true;
		this.contentEl.empty();
		this.contentEl.addClass("weave-irdeck-view");
		renderBouncingBallsLoading(this.contentEl, {
			message: i18n.t("views.irdeck.loading"),
			className: "weave-irdeck-loading",
		});

		if (this.file?.path) {
			this.pendingPath = this.file.path;
		}

		this.redirectController.start();
	}

	async onClose(): Promise<void> {
		this.isOpen = false;
		this.redirectController.stop();
	}

	private resolveBoundPath(): string {
		return this.file?.path || this.pendingPath;
	}

	private async redirectToCalendar(): Promise<void> {
		const path = this.resolveBoundPath();
		if (!path || this.redirectSettled) {
			return;
		}

		this.redirectSettled = true;
		try {
			await this.plugin.openIRDeckCalendar(path, this.leaf);
		} catch (error) {
			this.redirectSettled = false;
			logger.error("[IRDeckView] 打开 IRDeck 月历失败:", error);
			this.contentEl.empty();
			this.contentEl.createDiv({
				cls: "weave-irdeck-error",
				text: i18n.t("views.irdeck.openFailed"),
			});
			new Notice(i18n.t("views.irdeck.openFailed"));
		}
	}
}
