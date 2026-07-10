/**
 * 增量阅读日历视图
 * 显示在Obsidian全局侧边栏中的月历面板
 * 上方为月历热力图，下方为选中日期的阅读材料列表
 */

import {
	type EventRef,
	ItemView,
	type ViewStateResult,
	WorkspaceLeaf,
} from "obsidian";
import type { unmount } from "svelte";
import type { WeavePlugin } from "../main";
import {
	IR_RUNTIME,
	getIncrementalReadingPlugin,
} from "../services/incremental-reading/ir-runtime";
import {
	PREMIUM_FEATURES,
	PremiumFeatureGuard,
} from "../services/premium/PremiumFeatureGuard";
import {
	getDefaultIRPremiumFeaturePreviewId,
	requestIRPremiumFeaturePreview,
} from "../services/premium/ir-premium";
import { i18n } from "../utils/i18n";
import { logger } from "../utils/logger";
import { getViewSurfaceTokens } from "../utils/view-location-utils";

export const VIEW_TYPE_IR_CALENDAR = IR_RUNTIME.viewTypes.calendar;

type MountedIRCalendarComponent = Parameters<typeof unmount>[0];

type IRCalendarViewState = {
	filePath?: string;
	file?: string;
	focusDeckId?: string;
	focusDeckName?: string;
};

export class IRCalendarView extends ItemView {
	private component: MountedIRCalendarComponent | null = null;
	private plugin: WeavePlugin;
	private layoutChangeRef: EventRef | null = null;
	private premiumUnsubscribe: (() => void) | null = null;
	private focusDeckId = "";
	private focusDeckName = "";
	private sourceFilePath = "";
	private isOpen = false;

	constructor(leaf: WorkspaceLeaf, plugin: WeavePlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	/**
	 * 获取视图类型标识
	 */
	getViewType(): string {
		return VIEW_TYPE_IR_CALENDAR;
	}

	/**
	 * 获取视图显示名称
	 */
	getDisplayText(): string {
		return this.focusDeckName || i18n.t("irViews.calendar.defaultTitle");
	}

	/**
	 * 获取视图图标
	 */
	getIcon(): string {
		return "calendar";
	}

	getState(): IRCalendarViewState {
		return {
			filePath: this.sourceFilePath,
			file: this.sourceFilePath,
			focusDeckId: this.focusDeckId,
			focusDeckName: this.focusDeckName,
		};
	}

	async setState(
		state: IRCalendarViewState,
		result: ViewStateResult,
	): Promise<void> {
		await super.setState(state, result);

		this.sourceFilePath = String(state?.filePath || state?.file || "").trim();
		this.focusDeckId = String(state?.focusDeckId || "").trim();
		this.focusDeckName = String(state?.focusDeckName || "").trim();

		if (this.isOpen) {
			// 工作区恢复阶段会同步等待 setState() 返回，若这里继续等待 allCoreServices，
			// 会和 main.ts 中依赖 onLayoutReady 的存储初始化形成循环等待，直接拖慢启动。
			void this.loadComponentAsync();
		}
	}

	/**
	 * 视图打开时调用
	 */
	async onOpen(): Promise<void> {
		this.isOpen = true;
		logger.debug("[IRCalendarView] Opening calendar view");

		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("weave-ir-calendar-view");
		this.applySurfaceContext();
		this.layoutChangeRef = this.app.workspace.on("layout-change", () => {
			this.applySurfaceContext();
		});

		this.subscribePremiumState();
		if (!this.canUseIncrementalReading()) {
			this.renderPremiumLock(contentEl);
			return;
		}

		// 显示加载占位符
		contentEl.createDiv({
			cls: "weave-calendar-loading",
			text: i18n.t("irViews.calendar.loading"),
		});

		// 异步加载组件
		void this.loadComponentAsync();
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

	/**
	 * 渲染高级功能锁定提示
	 */
	private canUseIncrementalReading(): boolean {
		return PremiumFeatureGuard.getInstance().canUseFeature(
			PREMIUM_FEATURES.INCREMENTAL_READING,
		);
	}

	private subscribePremiumState(): void {
		this.premiumUnsubscribe?.();
		this.premiumUnsubscribe =
			PremiumFeatureGuard.getInstance().isPremiumActive.subscribe(() => {
				if (!this.isOpen) {
					return;
				}

				void this.refreshPremiumPresentation();
			});
	}

	private async refreshPremiumPresentation(): Promise<void> {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("weave-ir-calendar-view");
		this.applySurfaceContext();

		if (!this.canUseIncrementalReading()) {
			this.renderPremiumLock(contentEl);
			return;
		}

		contentEl.createDiv({
			cls: "weave-calendar-loading",
			text: i18n.t("irViews.calendar.loading"),
		});
		await this.loadComponentAsync();
	}

	private renderPremiumLock(container: HTMLElement): void {
		container.createDiv({
			cls: "weave-calendar-loading",
			text: i18n.t("irViews.calendar.loadingFeatureHelp"),
		});
		requestIRPremiumFeaturePreview(
			this.app,
			getDefaultIRPremiumFeaturePreviewId(),
		);
	}

	/**
	 * 异步加载组件
	 */
	private async loadComponentAsync(): Promise<void> {
		try {
			if (!this.canUseIncrementalReading()) {
				return;
			}

			await this.waitForPluginReady();

			if (this.component) {
				const { unmount } = await import("svelte");
				void unmount(this.component);
				this.component = null;
			}

			this.contentEl.empty();

			const { mount } = await import("svelte");
			const { default: Component } = await import(
				"../components/incremental-reading/IRCalendarSidebar.svelte"
			);
			this.component = mount(Component, {
				target: this.contentEl,
				props: {
					plugin: this.plugin,
					initialDeckId: this.focusDeckId,
					initialDeckName: this.focusDeckName,
					sourceFilePath: this.sourceFilePath,
				},
			});

			logger.debug("[IRCalendarView] Calendar component mounted");
		} catch (error) {
			logger.error("[IRCalendarView] Failed to mount calendar:", error);
			this.contentEl.empty();
			this.contentEl.createDiv({
				cls: "error",
				text: i18n.t("irViews.calendar.loadFailed"),
			});
		}
	}

	/**
	 * 等待日历视图真正可安全取数。
	 * 仅有 dataStorage 还不够，workspace 恢复期还需要宿主插件已经能被 runtime 稳定反查。
	 */
	private async waitForPluginReady(): Promise<void> {
		if (this.isPluginReady()) {
			return;
		}

		logger.debug("[IRCalendarView] 等待独立 IR 插件完成初始化...");

		try {
			const { waitForServiceReady } = await import(
				"../utils/service-ready-event"
			);
			await waitForServiceReady("allCoreServices", 15000);
			logger.debug(
				"[IRCalendarView] allCoreServices 已就绪，继续确认插件注册状态",
			);
		} catch (_error) {
			logger.warn("[IRCalendarView] 事件等待超时，回退到轮询检查");
		}

		const maxAttempts = 40;
		const interval = 100;

		for (let i = 0; i < maxAttempts; i++) {
			if (this.isPluginReady()) {
				logger.debug(
					`[IRCalendarView] 插件初始化已就绪（轮询 ${i * interval}ms）`,
				);
				return;
			}
			await new Promise((resolve) => window.setTimeout(resolve, interval));
		}

		logger.warn("[IRCalendarView] 插件初始化超时，继续尝试挂载日历视图");
	}

	private isPluginReady(): boolean {
		if (!this.plugin.dataStorage) {
			return false;
		}

		const runtimePlugin = getIncrementalReadingPlugin(this.app);
		return runtimePlugin === this.plugin;
	}

	/**
	 * 视图关闭时调用
	 */
	async onClose(): Promise<void> {
		this.isOpen = false;
		logger.debug("[IRCalendarView] Closing calendar view");

		if (this.premiumUnsubscribe) {
			this.premiumUnsubscribe();
			this.premiumUnsubscribe = null;
		}

		if (this.layoutChangeRef) {
			this.app.workspace.offref(this.layoutChangeRef);
			this.layoutChangeRef = null;
		}

		if (this.component) {
			const { unmount } = await import("svelte");
			void unmount(this.component);
			this.component = null;
		}
	}
}
