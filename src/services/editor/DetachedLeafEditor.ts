import {
	App,
	Component,
	MarkdownView,
	Platform,
	Scope,
	TFile,
	WorkspaceLeaf,
} from "obsidian";
import {
	asMarkdownViewInternal,
	readMarkdownViewScope,
} from "../../types/markdown-view-internal";
import { DirectoryUtils } from "../../utils/directory-utils";
import { i18n } from "../../utils/i18n";
import { logger } from "../../utils/logger";
import { applyStyleProps } from "../../utils/style-props";
import { readVaultConfigValue } from "../../utils/vault-config";
import { resolveWorkspaceActiveLeaf } from "../../utils/workspace-navigation";
import EditorContextManager from "./EditorContextManager";
import {
	buildDetachedEditorTempFilePath,
	isDetachedEditorTempFilePath,
	resolveDetachedEditorTempFolder,
} from "./editor-temp-file-policy";

export interface DetachedEditorOptions {
	value?: string;
	placeholder?: string;
	/** @deprecated 不再影响临时文件落盘；临时文件固定写入可配置 IR 数据根下的 editor/ */
	sourcePath?: string;
	sessionId?: string;
	onSubmit?: (editor: DetachedLeafEditor) => void;
	onEscape?: (editor: DetachedLeafEditor) => void;
	onChange?: (editor: DetachedLeafEditor) => void;
	onBlur?: (editor: DetachedLeafEditor) => void;
}

/**
 * DetachedLeafEditor
 * 使用真正的 WorkspaceLeaf 实现嵌入式编辑器，确保 100% 的 Obsidian 原生体验（Live Preview、插件支持等）
 */
export class DetachedLeafEditor extends Component {
	private app: App;
	private containerEl: HTMLElement;
	private options: DetachedEditorOptions;
	private leaf: WorkspaceLeaf | null = null;
	private tempFile: TFile | null = null;
	private scope: Scope;
	private editorView: MarkdownView | null = null;
	private readyPromise: Promise<void>;
	private readyResolve: (() => void) | null = null;
	private destroyed = false;
	private focusInHandler: ((ev: FocusEvent) => void) | null = null;
	private focusOutHandler: ((ev: FocusEvent) => void) | null = null;
	private pointerDownCaptureHandler: ((ev: Event) => void) | null = null;
	private contentChromeObserver: MutationObserver | null = null;
	private viewScopePushed = false;
	private prevActiveLeaf: WorkspaceLeaf | null = null;
	private keydownCaptureHandler: ((ev: KeyboardEvent) => void) | null = null;

	// 原始父节点，用于恢复 DOM（虽然通常我们销毁时直接删除）
	private originalParent: HTMLElement | null = null;
	private originalNextSibling: Node | null = null;

	constructor(
		app: App,
		container: HTMLElement,
		options: DetachedEditorOptions = {},
	) {
		super();
		this.app = app;
		this.containerEl = container;
		this.options = options;
		this.scope = new Scope(this.app.scope);

		this.readyPromise = new Promise<void>((resolve) => {
			this.readyResolve = resolve;
		});
	}

	whenReady(): Promise<void> {
		return this.readyPromise;
	}

	private getWorkspaceActiveLeaf(): WorkspaceLeaf | null {
		return resolveWorkspaceActiveLeaf(this.app.workspace);
	}

	private setWorkspaceActiveLeaf(
		leaf: WorkspaceLeaf | null,
		focus: boolean,
	): void {
		if (!leaf) return;
		try {
			const workspace = this.app.workspace as {
				setActiveLeaf?: (
					target: WorkspaceLeaf,
					focus?: boolean | { focus?: boolean },
				) => void;
			};
			if (typeof workspace.setActiveLeaf !== "function") {
				return;
			}

			try {
				const current = this.getWorkspaceActiveLeaf();
				if (current === leaf) return;
			} catch { /* ignored */ }

			try {
				workspace.setActiveLeaf(leaf, { focus });
			} catch {
				workspace.setActiveLeaf(leaf, focus);
			}
		} catch { /* ignored */ }
	}

	private pushViewScope(): void {
		if (this.viewScopePushed) return;
		const scope = readMarkdownViewScope(this.editorView);
		const keymap = this.app.keymap;
		if (!scope || !keymap?.pushScope) return;

		try {
			keymap.pushScope(scope);
			this.viewScopePushed = true;
		} catch { /* ignored */ }
	}

	private popViewScope(): void {
		if (!this.viewScopePushed) return;
		const scope = readMarkdownViewScope(this.editorView);
		const keymap = this.app.keymap;
		if (!scope || !keymap?.popScope) {
			this.viewScopePushed = false;
			return;
		}

		try {
			keymap.popScope(scope);
		} catch { /* ignored */ }
		this.viewScopePushed = false;
	}

	onload(): void {
		void this.initialize();
	}

	private async waitForWorkspaceLayoutReady(): Promise<void> {
		try {
			await new Promise<void>((resolve) => {
				try {
					this.app.workspace.onLayoutReady(() => resolve());
				} catch {
					resolve();
				}
			});
		} catch { /* ignored */ }
	}

	private shouldHidePropertiesInDocument(): boolean {
		try {
			const getCfg = (key: string) => readVaultConfigValue(this.app, key);

			const candidates = [
				getCfg("propertiesInDocument"),
				getCfg("propertiesInDocumentMode"),
				getCfg("propertiesInDocumentDisplay"),
				getCfg("showPropertiesInDocument"),
				getCfg("propertiesInDocumentEnabled"),
			].filter((v) => v !== undefined);

			for (const v of candidates) {
				if (v === false) return true;
				if (v === true) return false;

				if (typeof v === "number") {
					if (v === 0) return true;
					continue;
				}

				if (typeof v === "string") {
					const s = v.toLowerCase();
					if (s === "hidden" || s === "hide" || s === "off" || s === "never")
						return true;
					if (s === "source") return true;
					if (s === "show" || s === "visible" || s === "on" || s === "always")
						return false;
				}
			}

			return false;
		} catch {
			return false;
		}
	}

	private async initialize() {
		try {
			logger.debug("[DetachedLeafEditor] 开始初始化...");

			const activeLeafBeforeInit = this.getWorkspaceActiveLeaf();

			await this.waitForWorkspaceLayoutReady();

			// 1. 准备临时文件
			await this.prepareTempFile();

			if (!this.tempFile) {
				throw new Error("无法创建临时文件");
			}

			// 2. 创建 detached leaf
			this.createLeaf();

			if (!this.leaf) {
				throw new Error("无法创建 WorkspaceLeaf");
			}

			if (
				Platform.isMobile &&
				activeLeafBeforeInit &&
				this.leaf &&
				activeLeafBeforeInit !== this.leaf
			) {
				try {
					this.setWorkspaceActiveLeaf(activeLeafBeforeInit, false);
				} catch { /* ignored */ }
			}

			// 3. 打开文件
			await this.openFileInLeaf();

			// 4. 劫持 DOM 并注入到容器
			await this.hijackDOM();

			// 5. 初始化设置（Live Preview, 快捷键等）
			this.setupEditor();

			if (
				Platform.isMobile &&
				activeLeafBeforeInit &&
				this.leaf &&
				activeLeafBeforeInit !== this.leaf
			) {
				try {
					this.setWorkspaceActiveLeaf(activeLeafBeforeInit, false);
				} catch { /* ignored */ }
			}

			logger.debug("[DetachedLeafEditor] 初始化完成");
		} catch (error) {
			logger.error("[DetachedLeafEditor] 初始化失败:", error);
			// 显示错误信息
			this.containerEl.createDiv({
				text: i18n.t("irServiceNotices.editor.initFailed"),
				cls: "error-message",
			});
		} finally {
			if (this.readyResolve) {
				try {
					this.readyResolve();
				} catch { /* ignored */ }
				this.readyResolve = null;
			}
		}
	}

	private async prepareTempFile() {
		const sessionId = this.options.sessionId || Date.now().toString();
		// 固定写入 {IR 数据根}/editor/，尊重设置中的 weaveParentFolder，不跟源文件同目录。
		const folderPath = resolveDetachedEditorTempFolder(this.app);
		const preferredPath = buildDetachedEditorTempFilePath(
			folderPath,
			`weave-editor-${sessionId}.md`,
		);
		const fallbackPath = buildDetachedEditorTempFilePath(
			folderPath,
			`weave-editor-${Date.now()}.md`,
		);
		const candidatePaths =
			preferredPath === fallbackPath
				? [preferredPath]
				: [preferredPath, fallbackPath];

		if (folderPath) {
			await DirectoryUtils.ensureDirRecursive(
				this.app.vault.adapter,
				folderPath,
			);
		}

		let lastError: unknown = null;
		for (const filePath of candidatePaths) {
			logger.debug("[DetachedLeafEditor] 临时文件路径:", filePath);

			try {
				const file = this.app.vault.getAbstractFileByPath(filePath);
				if (file instanceof TFile) {
					await this.app.vault.modify(file, this.options.value || "");
					this.tempFile = file;
					return;
				}

				this.tempFile = await this.app.vault.create(
					filePath,
					this.options.value || "",
				);
				return;
			} catch (error) {
				lastError = error;
				logger.warn(
					"[DetachedLeafEditor] 创建临时文件失败，尝试备用路径:",
					filePath,
					error,
				);
			}
		}

		logger.error("[DetachedLeafEditor] 创建临时文件失败:", lastError);
		throw lastError instanceof Error
			? lastError
			: new Error("无法创建 DetachedLeafEditor 临时文件");
	}

	private createLeaf() {
		// 使用 createLeafInParent 创建一个位于 rootSplit 的 leaf
		// 这允许我们创建一个"真正的"编辑器实例，但将其隐藏
		const workspace = this.app.workspace;
		const candidates = Platform.isMobile
			? [workspace.rightSplit, workspace.leftSplit, workspace.rootSplit]
			: [workspace.rootSplit];

		const canUseSplit = (split: unknown) => {
			try {
				return (
					!!split &&
					typeof (split as { setDimension?: (size: number) => void })
						.setDimension === "function"
				);
			} catch {
				return false;
			}
		};

		const parentSplit = candidates.find(canUseSplit) || workspace.rootSplit;

		try {
			this.leaf = this.app.workspace.createLeafInParent(parentSplit, 0);
		} catch (e) {
			logger.warn(
				"[DetachedLeafEditor] createLeafInParent 失败，回退到 rootSplit:",
				e,
			);
			try {
				this.leaf = this.app.workspace.createLeafInParent(
					workspace.rootSplit,
					0,
				);
			} catch {
				this.leaf = null;
			}
		}

		if (!this.leaf) {
			return;
		}

		// 立即隐藏，防止闪烁
		const leafEl = (this.leaf as WorkspaceLeaf & { containerEl?: HTMLElement })
			.containerEl;
		if (leafEl) {
			leafEl.dataset.weaveDetachedLeafEditor = "true";
			this.originalParent = leafEl.parentElement;
			this.originalNextSibling = leafEl.nextSibling;

			// 关键：不要使用 display:none，否则 Obsidian 无法正确路由快捷键到 activeLeaf
			// 改为移动到屏幕外，但保持在 DOM 中（参考 ModalEditorManager 的方案）
			applyStyleProps(leafEl, {
				position: "absolute",
				left: "-9999px",
				top: "-9999px",
				width: "1px",
				height: "1px",
				overflow: "hidden",
				"pointer-events": "none",
				display: "block",
				visibility: "visible",
			});
		}
	}

	private async openFileInLeaf() {
		if (!this.leaf || !this.tempFile) return;

		// active: false 防止获得焦点并滚动 workspace
		await this.leaf.openFile(this.tempFile, { active: false });

		if (!(await this.resolveMarkdownView())) {
			try {
				await this.leaf.setViewState({
					type: "markdown",
					state: { file: this.tempFile.path },
					active: false,
				});
			} catch (error) {
				logger.warn(
					"[DetachedLeafEditor] setViewState markdown 回退失败:",
					error,
				);
			}

			if (!(await this.resolveMarkdownView())) {
				logger.error("[DetachedLeafEditor] Leaf 打开的不是 MarkdownView");
			}
		}
	}

	private async resolveMarkdownView(timeout = 2000): Promise<boolean> {
		const start = Date.now();
		while (Date.now() - start < timeout) {
			const view = this.leaf?.view;
			if (view instanceof MarkdownView) {
				this.editorView = view;
				return true;
			}
			await new Promise((resolve) => window.setTimeout(resolve, 50));
		}
		return false;
	}

	private async hijackDOM() {
		if (!this.leaf || !this.editorView) return;

		// 等待编辑器渲染
		await this.waitForEditorReady();

		const view = this.editorView;
		const contentEl = view.contentEl; // 这是包含编辑器的主要元素
		contentEl.dataset.weaveDetachedLeafEditor = "true";

		try {
			contentEl
				.querySelectorAll(".weave-ir-markdown-bottom-toolbar-container")
				.forEach((el) => {
					try {
						(el as HTMLElement).remove();
					} catch { /* ignored */ }
				});
		} catch { /* ignored */ }

		// 清空容器
		this.containerEl.empty();

		// 移动 DOM
		this.containerEl.appendChild(contentEl);

		// 调整样式以适应嵌入
		applyStyleProps(contentEl, {
			display: "block",
			position: "relative",
			width: "100%",
			height: "100%",
			padding: "0",
			margin: "0",
		});

		const removeElNoSpace = (el: HTMLElement | null) => {
			if (!el) return;
			try {
				el.remove();
			} catch {
				try {
					applyStyleProps(el, {
						display: "none",
						height: "0",
						"min-height": "0",
						"max-height": "0",
						margin: "0",
						padding: "0",
						border: "0",
					});
				} catch { /* ignored */ }
			}
		};

		const toggleHideNoSpace = (el: HTMLElement | null, hide: boolean) => {
			if (!el) return;
			try {
				if (hide) {
					applyStyleProps(el, {
						display: "none",
						height: "0",
						"min-height": "0",
						"max-height": "0",
						margin: "0",
						padding: "0",
						border: "0",
					});
				} else {
					applyStyleProps(el, {
						display: "",
						height: "",
						"min-height": "",
						"max-height": "",
						margin: "",
						padding: "",
						border: "",
					});
				}
			} catch { /* ignored */ }
		};

		const applyHideChrome = () => {
			try {
				const headerSelectors = [
					".view-header",
					".view-header-title-container",
					".view-header-title-wrapper",
					".view-header-nav-buttons",
					".view-actions",
					".view-action",
				];

				for (const selector of headerSelectors) {
					const nodes = contentEl.querySelectorAll(selector);
					nodes.forEach((n) => removeElNoSpace(n as HTMLElement));
				}

				const inlineTitleSelectors = [".inline-title-wrapper", ".inline-title"];

				for (const selector of inlineTitleSelectors) {
					const nodes = contentEl.querySelectorAll(selector);
					nodes.forEach((n) => removeElNoSpace(n as HTMLElement));
				}

				const hideProps = this.shouldHidePropertiesInDocument();
				const propsSelectors = [
					".metadata-container",
					".metadata-properties",
					".metadata-container-inner",
					".metadata-properties-heading",
					".metadata-add-property",
					".markdown-source-view .metadata-container",
					".markdown-source-view .metadata-properties",
				];

				for (const selector of propsSelectors) {
					const nodes = contentEl.querySelectorAll(selector);
					nodes.forEach((n) => toggleHideNoSpace(n as HTMLElement, hideProps));
				}
			} catch { /* ignored */ }
		};

		applyHideChrome();

		try {
			if (this.contentChromeObserver) {
				this.contentChromeObserver.disconnect();
			}
			this.contentChromeObserver = new MutationObserver(() => {
				applyHideChrome();
			});
			this.contentChromeObserver.observe(contentEl, {
				childList: true,
				subtree: true,
				attributes: true,
			});
		} catch { /* ignored */ }

		// 隐藏 header 等不需要的元素（如果有）
		// 通常 MarkdownView 的 contentEl 只包含编辑器内容，header 在 view.containerEl 中
		// 但我们需要确保 view.containerEl 的其他部分不干扰

		// 强制刷新布局
		if (view.editor) {
			view.editor.refresh();
		}
	}

	private async waitForEditorReady(timeout = 2000) {
		const start = Date.now();
		while (Date.now() - start < timeout) {
			if (this.editorView?.editor) {
				return;
			}
			await new Promise((resolve) => window.setTimeout(resolve, 50));
		}
		logger.warn("[DetachedLeafEditor] 等待编辑器就绪超时");
	}

	private syncWithPreferredEditorMode(): void {
		if (!this.editorView) return;

		const globalLivePreview = readVaultConfigValue(this.app, "livePreview");
		if (!globalLivePreview) return;

		try {
			if (
				typeof this.editorView.getMode !== "function" ||
				this.editorView.getMode() !== "source"
			) {
				return;
			}

			// Obsidian 公开 API 只能区分 preview/source，无法直接区分
			// source 模式下的 Live Preview 与纯源码模式，这里仅在内部状态明确表示
			// 当前是纯源码模式时，才谨慎地切回 Live Preview。
			const currentMode = asMarkdownViewInternal(this.editorView)?.currentMode;
			if (
				!currentMode ||
				currentMode.type !== "source" ||
				currentMode.sourceMode !== true
			) {
				return;
			}

			if (typeof currentMode.toggleSource !== "function") {
				logger.debug(
					"[DetachedLeafEditor] 当前版本未暴露 toggleSource，跳过 Live Preview 同步",
				);
				return;
			}

			currentMode.toggleSource();
			this.editorView.editor?.refresh?.();
		} catch (error) {
			logger.warn(
				"[DetachedLeafEditor] Live Preview 同步失败，保留当前编辑模式:",
				error,
			);
		}
	}

	private setupEditor() {
		if (!this.editorView) return;

		// 1. 尽量跟随用户的全局 Live Preview 偏好，但仅在明确需要时切换。
		this.syncWithPreferredEditorMode();

		// 2. 注册事件
		this.registerDomEvents();

		// 3. 注册快捷键
		this.registerHotkeys();
	}

	private activateLeafForHotkeys(): void {
		if (!this.leaf) return;

		// 允许移动端激活 Leaf，以便显示原生工具栏
		// if (Platform.isMobile) {
		//   return;
		// }

		this.setWorkspaceActiveLeaf(this.leaf, false);
	}

	private isEventFromPropertiesUI(target: EventTarget | null): boolean {
		try {
			if (!target) return false;

			let el: HTMLElement | null = null;
			if (target instanceof HTMLElement) {
				el = target;
			} else if (
				target instanceof Node &&
				target.parentElement instanceof HTMLElement
			) {
				el = target.parentElement;
			}

			if (!el) return false;

			const hit = el.closest(
				".metadata-container, .metadata-properties, .metadata-container-inner, .metadata-properties-heading, .metadata-add-property",
			);
			return !!hit;
		} catch {
			return false;
		}
	}

	private registerDomEvents() {
		// 监听内容变化
		// 使用 Obsidian 事件或 CodeMirror 事件
		if (this.options.onChange && this.editorView) {
			// @ts-ignore
			this.registerEvent(
				this.app.workspace.on("editor-change", (_editor, info) => {
					if (info === this.editorView) {
						this.options.onChange?.(this);
					}
				}),
			);
		}

		// 焦点事件
		if (this.editorView?.contentEl) {
			if (!this.pointerDownCaptureHandler) {
				this.pointerDownCaptureHandler = (ev) => {
					if (!Platform.isMobile) return;

					try {
						EditorContextManager.getInstance().registerActive(this);
					} catch { /* ignored */ }

					this.pushViewScope();

					// 移动端点击时也要激活 Leaf，触发原生工具栏
					if (!this.prevActiveLeaf) {
						this.prevActiveLeaf = this.getWorkspaceActiveLeaf();
					}
					this.activateLeafForHotkeys();

					const fromProps = this.isEventFromPropertiesUI(ev.target);
					if (!fromProps) {
						try {
							this.editorView?.editor?.focus();
						} catch { /* ignored */ }

						window.requestAnimationFrame(() => {
							try {
								this.editorView?.editor?.focus();
							} catch { /* ignored */ }
						});
					}
				};
			}

			this.editorView.contentEl.addEventListener(
				"pointerdown",
				this.pointerDownCaptureHandler,
				true,
			);
			this.editorView.contentEl.addEventListener(
				"touchstart",
				this.pointerDownCaptureHandler,
				true,
			);

			if (!this.keydownCaptureHandler) {
				this.keydownCaptureHandler = (ev) => {
					if (!(ev.ctrlKey || ev.metaKey || ev.altKey || ev.key === "Tab"))
						return;
					this.activateLeafForHotkeys();
				};
			}

			this.editorView.contentEl.addEventListener(
				"keydown",
				this.keydownCaptureHandler,
				true,
			);

			// 移动端也需要监听焦点事件，确保 Active Leaf 正确切换以显示工具栏
			// 原先仅在桌面端启用，导致移动端焦点切换时工具栏不显示
			if (!this.focusInHandler) {
				this.focusInHandler = (ev) => {
					try {
						EditorContextManager.getInstance().registerActive(this);
					} catch { /* ignored */ }

					this.pushViewScope();

					if (!this.prevActiveLeaf) {
						this.prevActiveLeaf = this.getWorkspaceActiveLeaf();
					}

					this.activateLeafForHotkeys();
					window.requestAnimationFrame(() => {
						this.activateLeafForHotkeys();
					});

					const fromProps = this.isEventFromPropertiesUI(ev.target);
					if (!fromProps) {
						try {
							this.editorView?.editor?.focus();
						} catch { /* ignored */ }
					}
				};
			}

			if (!this.focusOutHandler) {
				this.focusOutHandler = (ev: FocusEvent) => {
					try {
						const next = ev.relatedTarget as HTMLElement | null;
						if (next && this.editorView?.contentEl?.contains(next)) {
							return;
						}
					} catch { /* ignored */ }

					try {
						EditorContextManager.getInstance().unregisterActive(this);
					} catch { /* ignored */ }

					this.popViewScope();

					if (
						this.prevActiveLeaf &&
						this.leaf &&
						this.prevActiveLeaf !== this.leaf
					) {
						this.setWorkspaceActiveLeaf(this.prevActiveLeaf, false);
					}
					this.prevActiveLeaf = null;

					this.options.onBlur?.(this);
				};
			}

			this.editorView.contentEl.addEventListener(
				"focusin",
				this.focusInHandler,
				true,
			);
			this.editorView.contentEl.addEventListener(
				"focusout",
				this.focusOutHandler,
				true,
			);
		}
	}

	private registerHotkeys() {
		this.scope.register(["Mod"], "Enter", () => {
			this.options.onSubmit?.(this);
			return false;
		});

		this.scope.register([], "Escape", () => {
			this.options.onEscape?.(this);
			return false;
		});

		// 必须推入 scope 才能生效吗？
		// Component 会自动管理吗？
		// 我们手动管理 scope
		// 这里可能有问题，因为 editor 本身也有 scope
	}

	// --- Public API ---

	get value(): string {
		return this.editorView?.editor?.getValue() || "";
	}

	setValue(content: string) {
		this.editorView?.editor?.setValue(content);
	}

	focus() {
		this.editorView?.editor?.focus();
	}

	refresh() {
		this.editorView?.editor?.refresh?.();
	}

	getEditor() {
		return this.editorView?.editor;
	}

	// 兼容旧 API
	getCM() {
		// @ts-ignore
		return this.editorView?.editor?.cm;
	}

	onunload() {
		this.destroy();
	}

	destroy() {
		logger.debug("[DetachedLeafEditor] 销毁...");

		this.destroyed = true;

		if (this.readyResolve) {
			try {
				this.readyResolve();
			} catch { /* ignored */ }
			this.readyResolve = null;
		}

		try {
			EditorContextManager.getInstance().unregisterActive(this);
		} catch { /* ignored */ }

		this.popViewScope();

		if (this.prevActiveLeaf && this.leaf && this.prevActiveLeaf !== this.leaf) {
			this.setWorkspaceActiveLeaf(this.prevActiveLeaf, false);
		}
		this.prevActiveLeaf = null;

		try {
			if (this.contentChromeObserver) {
				this.contentChromeObserver.disconnect();
			}
			if (this.editorView?.contentEl && this.pointerDownCaptureHandler) {
				this.editorView.contentEl.removeEventListener(
					"pointerdown",
					this.pointerDownCaptureHandler,
					true,
				);
				this.editorView.contentEl.removeEventListener(
					"touchstart",
					this.pointerDownCaptureHandler,
					true,
				);
			}
			if (this.editorView?.contentEl && this.focusInHandler) {
				this.editorView.contentEl.removeEventListener(
					"focusin",
					this.focusInHandler,
					true,
				);
			}
			if (this.editorView?.contentEl && this.focusOutHandler) {
				this.editorView.contentEl.removeEventListener(
					"focusout",
					this.focusOutHandler,
					true,
				);
			}

			if (this.editorView?.contentEl && this.keydownCaptureHandler) {
				this.editorView.contentEl.removeEventListener(
					"keydown",
					this.keydownCaptureHandler,
					true,
				);
			}
		} catch { /* ignored */ }

		this.contentChromeObserver = null;
		this.pointerDownCaptureHandler = null;
		this.keydownCaptureHandler = null;

		// 1. 恢复 DOM (可选，防止内存泄漏)
		// 如果我们只是 detach leaf，Obsidian 会清理

		// 2. 关闭/Detach Leaf
		if (this.leaf) {
			this.leaf.detach();
			this.leaf = null;
		}

		// 3. 清理临时文件 (可选，或者保留用于恢复)
		const tempFileToDelete = this.tempFile;
		this.tempFile = null;

		if (tempFileToDelete instanceof TFile) {
			const isPluginTemp = isDetachedEditorTempFilePath(tempFileToDelete.path);
			if (isPluginTemp) {
				try {
					this.app.fileManager.trashFile(tempFileToDelete).catch((_err) => {
						logger.warn("[DetachedLeafEditor] 删除临时文件失败:", _err);
					});
				} catch (err) {
					logger.warn("[DetachedLeafEditor] 删除临时文件异常:", err);
				}
			}
		}

		this.containerEl.empty();
	}
}
