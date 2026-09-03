import {
	MarkdownView,
	Menu,
	Notice,
	Plugin,
	TFile,
	TFolder,
	WorkspaceLeaf,
	normalizePath,
} from "obsidian";
import { IRDataManagementModalObsidian } from "./components/incremental-reading/IRDataManagementModalObsidian";
import { dispatchOpenIRTutorial } from "./components/incremental-reading/tutorial/ir-tutorial-events";
import { StandaloneIRSettingsTab } from "./components/settings/StandaloneIRSettingsTab";
import { STANDALONE_IR_SETTINGS_NAVIGATE_EVENT } from "./components/settings/standalone-ir-settings-search";
import {
	clearActiveWeaveParentFolder,
	resolveIRImportFolder,
	setActiveWeaveParentFolder,
} from "./config/paths";
import type { SelectionToIRSubmitPayload } from "./modals/SelectionToIRModal";
import {
	type EpubHostIRCapabilities,
	type EpubHostIncrementalReadingTopicOption,
	type EpubHostReaderCapabilities,
	registerEpubHost,
	unregisterEpubHost,
} from "./services/epub-integration/epub-host";
import { getSharedMarkdownBlockFocusModeService } from "./services/ui/MarkdownBlockFocusModeService";
import { createAnchorManager } from "./services/incremental-reading/AnchorManager";
import {
	type ExistingChunkLike,
	type ExistingMaterialLike,
	applyIncrementalReadingFolderSubscriptionCandidates,
	scanIncrementalReadingFolderSubscriptions,
} from "./services/incremental-reading/IRFolderSubscriptionSyncService";
import {
	countTodayOccupiedReadingPoints,
	sumTodayOccupiedReadingMinutes,
} from "./services/incremental-reading/IRFolderSubscriptionAdmissionService";
import { resolveRemainingDailyAdmissionQuota } from "./services/incremental-reading/IRDailyLoadAllocator";
import { cleanupFolderSubscriptionNonMarkdownAutoSubscribedEntries } from "./services/incremental-reading/folder-subscription-non-md-cleanup";
import { getSharedIRHostCriticalWorkGuard } from "./services/incremental-reading/IRHostCriticalWorkGuard";
import { getSharedIRSourcePathRenameService } from "./services/incremental-reading/IRSourcePathRenameService";
import { migrateIRDataRootIfNeeded } from "./services/incremental-reading/IRDataRootMigration";
import {
	type IREnsureExternalDocumentChunkScheduledOptions,
	IRHostSharedService,
} from "./services/incremental-reading/IRHostSharedService";
import {
	type IRLegacyStorageMigrationExecutionReport,
	IRLegacyStorageMigrationFacade,
	type IRLegacyStorageMigrationSummary,
} from "./services/incremental-reading/IRLegacyStorageMigrationFacade";
import { IROutcomeRecordingService } from "./services/incremental-reading/IROutcomeRecordingService";
import { getSharedIRPointStorageService } from "./services/incremental-reading/IRPointStorageService";
import { IRPointStorageService } from "./services/incremental-reading/IRPointStorageService";
import {
	IRPointTagService,
	isWritingMarkdownReadingTags,
} from "./services/incremental-reading/IRPointTagService";
import { getSharedIRProjectionRuntime } from "./services/incremental-reading/IRProjectionRuntime";
import type {
	IRLearningOutcomeInput,
	IRLearningOutcomeResult,
} from "./services/incremental-reading/ir-outcome-contract";
import {
	generateUniqueVaultFilePath,
	resolveIRReadableMarkdownTargetFolder,
} from "./services/incremental-reading/IRReadableMarkdownPathResolver";
import { recomputeAndBroadcastIRData } from "./services/incremental-reading/IRScheduleRefreshService";
import { IRStorageService } from "./services/incremental-reading/IRStorageService";
import { getSharedIRRefreshScheduler } from "./services/incremental-reading/IRRefreshScheduler";
import {
	type ReadingMaterialManager,
	createReadingMaterialManager,
} from "./services/incremental-reading/ReadingMaterialManager";
import {
	type ReadingMaterialStorage,
	createReadingMaterialStorage,
} from "./services/incremental-reading/ReadingMaterialStorage";
import { replaceSelectionInMarkdownContent } from "./services/incremental-reading/SelectionQuickCreateSourceTransform";
import { shouldTriggerFolderSubscriptionResyncForVaultEvent } from "./services/incremental-reading/folder-subscription-event-trigger";
import { resolveMarkdownFilesForFolderSubscriptionPaths } from "./services/incremental-reading/folder-subscription-vault-scan";
import { IR_RUNTIME } from "./services/incremental-reading/ir-runtime";
import {
	buildDefaultIncrementalReadingSettings,
	normalizeIRCalendarSidebarSettings,
	normalizeIncrementalReadingSettings,
} from "./services/incremental-reading/ir-settings";
import { deriveWebPageTitleFromUrl } from "./services/incremental-reading/ir-web-reading-point";
import type { ParagraphWorkbenchOpenInput } from "./services/incremental-reading/paragraph-workbench/types";
import { labelParagraphWorkbenchSurface } from "./services/incremental-reading/paragraph-workbench/paragraph-workbench-maturity";
import { getActiveWebViewerPageContext } from "./services/obsidian/web-viewer-context";
import { registerIRPremiumFeaturePreviewHost } from "./services/premium/IRPremiumFeaturePreviewHost";
import {
	PREMIUM_FEATURES,
	PremiumFeatureGuard,
} from "./services/premium/PremiumFeatureGuard";
import { ensureIRPremiumFeature } from "./services/premium/ir-premium";
import {
	getCanvasTextCandidatesFromText,
	resolveCanvasMenuNodeId,
} from "./services/ui/canvas-source-locate";
import {
	installWeaveSettingsLayoutObserver,
} from "./utils/weave-settings-layout-classes";
import "./styles/global.css";
import type { CanvasMenuNode } from "./types/canvas-menu-node";
import {
	readCanvasNodeData,
	readCanvasNodeText,
} from "./types/canvas-menu-node";
import { ReadingCategory } from "./types/incremental-reading-types";
import { createDefaultIRDeck } from "./types/ir-types";
import type {
	EffectiveLicenseState,
	LicenseInfo,
	LicenseStore,
	LicensedProduct,
} from "./types/license";
import { DEFAULT_LICENSE_INFO, DEFAULT_LICENSE_STORE } from "./types/license";
import type {
	IRCalendarSidebarSettings,
	IncrementalReadingSettings,
} from "./types/plugin-settings.d";
import {
	type PluginUiLanguagePreference,
	applyPluginUiLanguagePreference,
	i18n,
	initI18n,
	normalizePluginUiLanguagePreference,
	syncI18nWithObsidianLanguage,
} from "./utils/i18n";
import {
	basenameWithoutExtension,
	isIRDeckFilePath,
} from "./utils/ir-internal-data-path";
import {
	LICENSED_PRODUCTS,
	getLegacyPrimaryLicense,
	normalizeLicenseStore,
	resolveEffectiveLicenseState,
} from "./utils/license-state";
import { registerLicenseSyncBridge } from "./utils/license-sync-bridge";
import { licenseManager } from "./utils/licenseManager";
import { logger } from "./utils/logger";
import { safeOpenSettings } from "./utils/obsidian-api-safe";
import { showObsidianConfirm } from "./utils/obsidian-confirm";
import { findCollaboratorEpubHost } from "./utils/obsidian-plugin-registry";
import { getInheritedLicensesFromLegacyWeave } from "./utils/plugin-access";
import { registerExtensionsSafely } from "./utils/register-extensions-safely";
import { markServiceReady } from "./utils/service-ready-event";
import { revealLeaf } from "./utils/workspace-navigation";
import { createYAMLFrontmatterManager } from "./utils/yaml-frontmatter-utils";
import { createContentWithMetadata } from "./utils/yaml-utils";
import { IRCalendarView, VIEW_TYPE_IR_CALENDAR } from "./views/IRCalendarView";
import { IRDeckView, VIEW_TYPE_IRDECK } from "./views/IRDeckView";
import { IRFocusView, VIEW_TYPE_IR_FOCUS } from "./views/IRFocusView";
import {
	IRParagraphWorkbenchView,
	VIEW_TYPE_IR_PARAGRAPH_WORKBENCH,
} from "./views/IRParagraphWorkbenchView";

type StandaloneIRSettings = {
	weaveParentFolder: string;
	incrementalReading: IncrementalReadingSettings;
	license: LicenseInfo;
	licenseState: LicenseStore;
	allowInheritedLicenses: boolean;
	showPremiumFeaturesPreview?: boolean;
	uiLanguage?: PluginUiLanguagePreference;
	/** Persist “don't show again” for the calendar tutorial overlay. */
	calendarTutorialDismissed?: boolean;
	editorModalSize?: {
		rememberLastSize?: boolean;
		enableResize?: boolean;
		width?: number;
		height?: number;
	};
};

type IRQuickCreateSelectionRange = {
	from: { line: number; ch: number };
	to: { line: number; ch: number };
};

type IRQuickCreateContext = {
	file: TFile;
	editor: MarkdownView["editor"] | null;
	selectedText: string;
	selectionRange: IRQuickCreateSelectionRange | null;
	sourceLink?: string;
	replaceSourceSelection?: boolean;
	successNotice?: string;
	initialTitle?: string;
};

const DEFAULT_INCREMENTAL_READING_SETTINGS: IncrementalReadingSettings =
	buildDefaultIncrementalReadingSettings("");

const DEFAULT_STANDALONE_IR_SETTINGS: StandaloneIRSettings = {
	weaveParentFolder: "",
	incrementalReading: DEFAULT_INCREMENTAL_READING_SETTINGS,
	license: DEFAULT_LICENSE_INFO,
	licenseState: DEFAULT_LICENSE_STORE,
	allowInheritedLicenses: true,
	showPremiumFeaturesPreview: false,
	uiLanguage: "auto",
	calendarTutorialDismissed: false,
};

const DEFAULT_DECK_NAME = () => i18n.t("irCommands.defaultDeckName");

export default class StandaloneIncrementalReadingPlugin
	extends Plugin
	implements EpubHostIRCapabilities, EpubHostReaderCapabilities
{
	settings: StandaloneIRSettings = { ...DEFAULT_STANDALONE_IR_SETTINGS };
	dataStorage: Record<string, unknown> | null = null;

	/** 阅读材料兼容层：批量导入、文件化块、YAML 材料元数据仍走此管理器 */
	readingMaterialStorage!: ReadingMaterialStorage;
	readingMaterialManager!: ReadingMaterialManager;

	private workspaceViewsRegistered = false;
	private irCalendarSidebarSettingsCache: IRCalendarSidebarSettings | null =
		null;
	private irHostSharedService: IRHostSharedService | null = null;
	private irOutcomeRecordingService: IROutcomeRecordingService | null = null;
	private irDeckIndexRefreshTimer: number | null = null;
	private pendingIRDeckChangedPaths = new Set<string>();
	private pendingIRDeckRemovedPaths = new Set<string>();
	private markdownReadingTagsSyncTimer: number | null = null;
	private pendingMarkdownReadingTagsPaths = new Set<string>();
	private incrementalReadingFolderSubscriptionResyncTimer: number | null = null;
	private incrementalReadingFolderSubscriptionSyncPromise: Promise<number> | null =
		null;
	/** file-change debounce 窗口内待增量同步的 md 路径（避免整树重扫）。 */
	private pendingFolderSubscriptionResyncPaths = new Set<string>();
	private deferredStartupPromise: Promise<void> | null = null;
	private unregisterPremiumFeaturePreviewHost: (() => void) | null = null;
	private unregisterWeaveSettingsLayoutObserver: (() => void) | null = null;
	private addReadingTargetModalInstance: {
		close: () => void;
	} | null = null;

	async onload(): Promise<void> {
		initI18n();
		this.registerEvent(
			this.app.workspace.on("layout-change", () => {
				try {
					syncI18nWithObsidianLanguage();
				} catch {
					void 0;
				}
			}),
		);
		this.registerDomEvent(window, "focus", () => {
			try {
				syncI18nWithObsidianLanguage();
			} catch {
				void 0;
			}
		});

		await this.loadSettings();
		getSharedMarkdownBlockFocusModeService(this.app).initializeFromSettings();
		await migrateIRDataRootIfNeeded(this);
		applyPluginUiLanguagePreference(this.settings.uiLanguage);
		licenseManager.initializeCloud(this.app);
		this.dataStorage = {};
		markServiceReady("dataStorage");
		getSharedIRHostCriticalWorkGuard(this.app).register(this);

		registerEpubHost(this.app, this);
		PremiumFeatureGuard.getInstance().primeLicenseState({
			product: this.getLicensedProductId(),
			localLicenses: this.getLocalLicenses(),
			inheritedLicenses: this.getInheritedLicenses(),
		});
		void PremiumFeatureGuard.getInstance().initializeForProduct({
			product: this.getLicensedProductId(),
			localLicenses: this.getLocalLicenses(),
			inheritedLicenses: this.getInheritedLicenses(),
		});
		PremiumFeatureGuard.getInstance().setPremiumFeaturesPreview(
			this.settings.showPremiumFeaturesPreview ?? false,
		);
		this.unregisterPremiumFeaturePreviewHost =
			registerIRPremiumFeaturePreviewHost(this.app, () => {
				this.openIRPremiumSettings();
			});
		registerLicenseSyncBridge(this, this);
		this.addSettingTab(new StandaloneIRSettingsTab(this.app, this));
		this.unregisterWeaveSettingsLayoutObserver =
			installWeaveSettingsLayoutObserver(activeDocument.body);
		this.registerWorkspaceViews();
		this.registerIRDeckVaultSync();
		this.registerMarkdownReadingTagsVaultSync();
		this.registerIncrementalReadingFolderSubscriptionWatchers();
		this.registerIRSourcePathRenameWatchers();
		this.registerCanvasNodeContextMenu();
		this.registerEditorSelectionAddToIRMenu();
		void import(
			"./services/incremental-reading/register-web-viewer-pane-menu"
		).then(({ registerWebViewerPaneMenuPatch }) => {
			registerWebViewerPaneMenuPatch(this, this);
		});
		void import(
			"./services/incremental-reading/register-web-viewer-context-menu"
		).then(({ registerWebViewerContextMenuPatch }) => {
			registerWebViewerContextMenuPatch(this, this);
		});

		this.addRibbonIcon("calendar", i18n.t("irCommands.openCalendar"), () => {
			void this.activateIRCalendarView();
		});

		this.addCommand({
			id: "open-ir-calendar",
			name: i18n.t("irCommands.openCalendar"),
			callback: () => {
				void this.activateIRCalendarView();
			},
		});

		this.addCommand({
			id: "create-ir-reading-point-from-selection",
			name: i18n.t("irCommands.createFromSelection"),
			callback: () => {
				void this.runSelectionToIRQuickCreate(
					this.getSelectionContextForIRQuickCreate(),
				);
			},
		});

		this.addCommand({
			id: "create-ir-reading-point-from-web-page",
			name: i18n.t("irCommands.createFromWebPage"),
			checkCallback: (checking) => {
				const pageContext = getActiveWebViewerPageContext(this.app);
				if (!checking && pageContext) {
					void this.runWebPageToIRQuickCreate({
						url: pageContext.url,
						title: pageContext.title,
					});
				}
				return Boolean(pageContext);
			},
		});

		this.addCommand({
			id: "open-ir-paragraph-workbench",
			name: labelParagraphWorkbenchSurface(
				i18n.t("irCommands.openParagraphWorkbench"),
			),
			callback: () => {
				const activeFile = this.app.workspace.getActiveFile();
				if (!(activeFile instanceof TFile)) {
					new Notice(i18n.t("irNotices.openSupportedFileFirst"));
					return;
				}
				const sourceType =
					activeFile.extension === "canvas"
						? "canvas"
						: activeFile.extension === "epub"
						? "epub"
						: "markdown";
				void this.openParagraphReadingWorkbench({
					sourceType,
					sourcePath: activeFile.path,
				});
			},
		});

		this.addCommand({
			id: "sync-subscribed-folders",
			name: i18n.t("irCommands.updateFolderSubscription"),
			callback: () => {
				void this.syncIncrementalReadingFolderSubscriptionFromSettings({
					trigger: "manual",
				});
			},
		});

		this.addCommand({
			id: "add-ir-reading-target-from-selection",
			name: i18n.t("irCommands.addReadingTargetFromSelection"),
			editorCheckCallback: (checking, editor, ctx) => {
				const file = ctx.file;
				const canRun =
					file instanceof TFile && file.extension === "md";
				if (!checking && canRun) {
					void this.runAddReadingTargetFromEditorSelection(editor, file);
				}
				return canRun;
			},
		});

		this.addCommand({
			id: "toggle-markdown-block-focus-mode",
			name: i18n.t("irCommands.toggleMarkdownBlockFocusMode"),
			callback: () => {
				void this.toggleMarkdownBlockFocusMode();
			},
		});

		// 注册完视图与命令后即可恢复 UI；重 I/O 与索引任务放到后台，避免拖慢 Obsidian 启动计时。
		markServiceReady("allCoreServices");
		void getSharedIRProjectionRuntime(this.app).preloadColdStartCaches();
		void getSharedIRRefreshScheduler(this.app).scheduleBootstrap();
		this.deferredStartupPromise = this.runDeferredStartupTasks();
	}

	private async ensureDeferredStartupComplete(): Promise<void> {
		await (this.deferredStartupPromise ?? this.runDeferredStartupTasks());
	}

	private async runDeferredStartupTasks(): Promise<void> {
		try {
			await this.initializeReadingMaterialServices();
			// 启动只读基线：不创建默认专题、不自动迁移改写 .irdeck（避免云同步 mtime 竞态）。
			void getSharedIRPointStorageService(this.app).ensureRuntimeBaseline();
			getSharedIRHostCriticalWorkGuard(this.app).runVaultBackgroundWork(
				async () => {
					await this.refreshIRDeckIndexFromVault({
						trigger: "startup",
						recompute: false,
					});
				},
			);
			// 自愈：清理历史上文件夹订阅误加的图片等非 md 阅读点（不依赖高级功能开关）。
			getSharedIRHostCriticalWorkGuard(this.app).runVaultBackgroundWork(
				async () => {
					const cleanupResult =
						await cleanupFolderSubscriptionNonMarkdownAutoSubscribedEntries(
							this.app,
							{ readingMaterialStorage: this.readingMaterialStorage },
						);
					if (cleanupResult.deletedChunks > 0) {
						await recomputeAndBroadcastIRData(this.app, "ui_refresh");
					}
				},
			);
			// 启动时不做文件夹订阅 apply 写入；仅由用户打开 IR / 设置变更 / 手动同步触发。
		} catch (error) {
			logger.warn("[Standalone IR] 后台启动任务失败", error);
		}
	}

	onunload(): void {
		this.unregisterWeaveSettingsLayoutObserver?.();
		this.unregisterWeaveSettingsLayoutObserver = null;
		this.unregisterPremiumFeaturePreviewHost?.();
		this.unregisterPremiumFeaturePreviewHost = null;
		if (this.irDeckIndexRefreshTimer !== null) {
			window.clearTimeout(this.irDeckIndexRefreshTimer);
			this.irDeckIndexRefreshTimer = null;
		}
		if (this.markdownReadingTagsSyncTimer !== null) {
			window.clearTimeout(this.markdownReadingTagsSyncTimer);
			this.markdownReadingTagsSyncTimer = null;
		}
		if (this.incrementalReadingFolderSubscriptionResyncTimer !== null) {
			window.clearTimeout(this.incrementalReadingFolderSubscriptionResyncTimer);
			this.incrementalReadingFolderSubscriptionResyncTimer = null;
		}
		this.pendingFolderSubscriptionResyncPaths.clear();
		unregisterEpubHost(this.app);
		clearActiveWeaveParentFolder();
		getSharedMarkdownBlockFocusModeService(this.app).destroy();
	}

	private registerWorkspaceViews(): void {
		if (this.workspaceViewsRegistered) {
			return;
		}

		this.registerView(
			VIEW_TYPE_IR_CALENDAR,
			(leaf) => new IRCalendarView(leaf, this),
		);
		this.registerView(VIEW_TYPE_IRDECK, (leaf) => new IRDeckView(leaf, this));
		this.registerView(
			VIEW_TYPE_IR_FOCUS,
			(leaf) => new IRFocusView(leaf, this),
		);
		this.registerView(
			VIEW_TYPE_IR_PARAGRAPH_WORKBENCH,
			(leaf) => new IRParagraphWorkbenchView(leaf, this),
		);
		registerExtensionsSafely(
			this,
			this.app,
			["irdeck"],
			VIEW_TYPE_IRDECK,
			"[Standalone IR]",
			"Weave Incremental Reading ",
		);
		this.workspaceViewsRegistered = true;
	}

	getLicensedProductId(): LicensedProduct {
		return LICENSED_PRODUCTS.IR;
	}

	getLocalLicenses(): LicenseInfo[] {
		return this.settings.licenseState?.localLicenses ?? [];
	}

	getInheritedLicenses(): LicenseInfo[] {
		if (this.settings.allowInheritedLicenses === false) {
			return [];
		}

		return getInheritedLicensesFromLegacyWeave(
			this.app as Parameters<typeof getInheritedLicensesFromLegacyWeave>[0],
		);
	}

	getEffectiveLicenseState(): EffectiveLicenseState {
		return resolveEffectiveLicenseState({
			product: this.getLicensedProductId(),
			localLicenses: this.getLocalLicenses(),
			inheritedLicenses: this.getInheritedLicenses(),
		});
	}

	hasIRPremiumAccess(): boolean {
		return this.getEffectiveLicenseState().isPremiumActive;
	}

	openIRPremiumSettings(): void {
		safeOpenSettings(this.app, this.manifest.id);
		window.setTimeout(() => {
			window.dispatchEvent(
				new CustomEvent(STANDALONE_IR_SETTINGS_NAVIGATE_EVENT, {
					detail: { tab: "license" },
				}),
			);
		}, 100);
	}

	/** Weave 宿主可通过 `app.plugins.getPlugin("weave-incremental-reading")` 调用 */
	async openDataManagementModal(): Promise<void> {
		await this.ensureIRUserWorkspaceReady();
		new IRDataManagementModalObsidian(this.app, {
			plugin: this,
		}).open();
	}

	async inspectLegacyStorageMigration(): Promise<IRLegacyStorageMigrationSummary> {
		return new IRLegacyStorageMigrationFacade(this.app).inspect();
	}

	async executeLegacyStorageMigration(): Promise<IRLegacyStorageMigrationExecutionReport> {
		return new IRLegacyStorageMigrationFacade(this.app).execute();
	}

	async refreshPremiumState(): Promise<void> {
		await PremiumFeatureGuard.getInstance().updateLicenseState({
			product: this.getLicensedProductId(),
			localLicenses: this.getLocalLicenses(),
			inheritedLicenses: this.getInheritedLicenses(),
		});
	}

	private syncLicenseSettings(): boolean {
		const previousSnapshot = JSON.stringify({
			license: this.settings.license,
			licenseState: this.settings.licenseState,
		});
		const normalizedStore = normalizeLicenseStore(
			this.settings.license,
			this.settings.licenseState,
		);
		this.settings.licenseState = normalizedStore;
		this.settings.license = getLegacyPrimaryLicense(
			normalizedStore.localLicenses,
		);
		return (
			JSON.stringify({
				license: this.settings.license,
				licenseState: this.settings.licenseState,
			}) !== previousSnapshot
		);
	}

	async loadSettings(): Promise<void> {
		const loaded =
			(await this.loadData()) as Partial<StandaloneIRSettings> | null;
		this.settings = this.normalizeSettings({
			...DEFAULT_STANDALONE_IR_SETTINGS,
			...(loaded ?? {}),
		});
		const licenseSettingsChanged = this.syncLicenseSettings();
		this.irCalendarSidebarSettingsCache =
			this.normalizeIRCalendarSidebarSettings(
				this.settings.incrementalReading.calendarSidebar,
			);
		setActiveWeaveParentFolder(this.settings.weaveParentFolder);
		if (licenseSettingsChanged) {
			await this.saveData(this.settings);
		}
		PremiumFeatureGuard.getInstance().setPremiumFeaturesPreview(
			this.settings.showPremiumFeaturesPreview ?? false,
		);
	}

	async saveSettings(): Promise<void> {
		this.settings = this.normalizeSettings(this.settings);
		applyPluginUiLanguagePreference(this.settings.uiLanguage);
		this.syncLicenseSettings();
		this.irCalendarSidebarSettingsCache =
			this.normalizeIRCalendarSidebarSettings(
				this.settings.incrementalReading.calendarSidebar,
			);
		PremiumFeatureGuard.getInstance().setPremiumFeaturesPreview(
			this.settings.showPremiumFeaturesPreview ?? false,
		);
		setActiveWeaveParentFolder(this.settings.weaveParentFolder);
		await this.saveData(this.settings);
		await this.refreshPremiumState();
	}

	getEditorModalSizeState(): {
		preset: "small" | "medium" | "large" | "extra-large" | "custom";
		customWidth?: number;
		customHeight?: number;
	} {
		const saved = this.settings.editorModalSize;
		return {
			preset: "custom",
			customWidth: saved?.width ?? 800,
			customHeight: saved?.height ?? 600,
		};
	}

	async saveEditorModalSizeState(state: {
		preset: "small" | "medium" | "large" | "extra-large" | "custom";
		customWidth?: number;
		customHeight?: number;
	}): Promise<void> {
		this.settings.editorModalSize = {
			...this.settings.editorModalSize,
			rememberLastSize: true,
			enableResize: this.settings.editorModalSize?.enableResize ?? true,
			width: state.customWidth,
			height: state.customHeight,
		};
		await this.saveSettings();
	}

	getIncrementalReadingSettings(): IncrementalReadingSettings {
		this.settings = this.normalizeSettings(this.settings);
		const settings = this.settings.incrementalReading;
		const guard = PremiumFeatureGuard.getInstance();
		const hasStrategy = guard.canUseFeature(
			PREMIUM_FEATURES.SCHEDULING_STRATEGY_SETTINGS,
		);
		const hasInterleave = guard.canUseFeature(
			PREMIUM_FEATURES.INTERLEAVE_LEARNING_SETTINGS,
		);
		const hasTagGroups = guard.canUseFeature(PREMIUM_FEATURES.TAG_GROUPS);
		const hasFolderSubscription = guard.canUseFeature(
			PREMIUM_FEATURES.FOLDER_SUBSCRIPTION,
		);
		const hasTimer = guard.canUseFeature(PREMIUM_FEATURES.READING_TIMER);

		return {
			...settings,
			scheduleStrategy: hasStrategy ? settings.scheduleStrategy : "processing",
			interleaveMode: hasInterleave ? settings.interleaveMode : false,
			enableTagGroupPrior: hasTagGroups ? settings.enableTagGroupPrior : false,
			folderSubscription: hasFolderSubscription
				? settings.folderSubscription
				: {
						...(settings.folderSubscription ?? {}),
						rules: [],
				  },
			calendarSidebar: {
				...(settings.calendarSidebar ?? {}),
				showMaterialTimers: hasTimer
					? settings.calendarSidebar?.showMaterialTimers
					: false,
			},
		};
	}

	async saveIncrementalReadingSettings(
		settings: IncrementalReadingSettings,
		options?: { syncFolderSubscription?: boolean },
	): Promise<IncrementalReadingSettings> {
		this.settings.incrementalReading = normalizeIncrementalReadingSettings(
			settings,
			this.settings.weaveParentFolder,
		);
		await this.saveSettings();
		if (options?.syncFolderSubscription) {
			await this.syncIncrementalReadingFolderSubscriptionFromSettings({
				trigger: "settings",
			});
		}
		return this.settings.incrementalReading;
	}

	/** Toggle Markdown focused reading and persist the choice. No default hotkey. */
	async toggleMarkdownBlockFocusMode(): Promise<boolean> {
		const current = this.getIncrementalReadingSettings();
		const nextEnabled = current.markdownBlockFocusModeEnabled !== true;
		await this.saveIncrementalReadingSettings({
			...current,
			markdownBlockFocusModeEnabled: nextEnabled,
		});
		getSharedMarkdownBlockFocusModeService(this.app).onSettingChanged(
			nextEnabled,
		);
		new Notice(
			nextEnabled
				? i18n.t("irNotices.markdownBlockFocusModeEnabled")
				: i18n.t("irNotices.markdownBlockFocusModeDisabled"),
		);
		return nextEnabled;
	}

	async syncIncrementalReadingFolderSubscriptionFromSettings(options?: {
		trigger?: "startup" | "settings" | "file-change" | "manual";
		filePaths?: string[];
	}): Promise<number> {
		const previous =
			this.incrementalReadingFolderSubscriptionSyncPromise ??
			Promise.resolve(0);
		const current = previous
			.catch(() => 0)
			.then(
				async () =>
					await this.performIncrementalReadingFolderSubscriptionSync(options),
			);
		this.incrementalReadingFolderSubscriptionSyncPromise = current;
		try {
			return await current;
		} finally {
			if (this.incrementalReadingFolderSubscriptionSyncPromise === current) {
				this.incrementalReadingFolderSubscriptionSyncPromise = null;
			}
		}
	}

	private async performIncrementalReadingFolderSubscriptionSync(options?: {
		trigger?: "startup" | "settings" | "file-change" | "manual";
		filePaths?: string[];
	}): Promise<number> {
		await this.ensureDeferredStartupComplete();
		const trigger = options?.trigger ?? "manual";
		// 启动路径禁止向 vault 写入阅读点，避免「设置已同步、专题尚未同步」时本地补写抬高 mtime。
		if (trigger === "startup") {
			return 0;
		}
		if (
			!PremiumFeatureGuard.getInstance().canUseFeature(
				PREMIUM_FEATURES.FOLDER_SUBSCRIPTION,
			)
		) {
			if (trigger === "manual") {
				ensureIRPremiumFeature(this.app, PREMIUM_FEATURES.FOLDER_SUBSCRIPTION);
			}
			return 0;
		}
		const folderSubscription =
			this.getIncrementalReadingSettings().folderSubscription;
		const storage = new IRStorageService(this.app);
		await storage.initialize();

		const useIncrementalFileChange =
			trigger === "file-change" && Array.isArray(options?.filePaths);
		const incrementalFiles = useIncrementalFileChange
			? resolveMarkdownFilesForFolderSubscriptionPaths(
					this.app,
					options?.filePaths || [],
			  )
			: null;

		// 非 md 误导入清理只在全量同步路径执行；file-change 增量不需要扫全库 chunk。
		const cleanupResult = useIncrementalFileChange
			? {
					scanned: 0,
					deletedChunks: 0,
					deletedMaterials: 0,
					deletedChunkIds: [] as string[],
					deletedMaterialIds: [] as string[],
					skippedAsSessionComplete: true as const,
			  }
			: await cleanupFolderSubscriptionNonMarkdownAutoSubscribedEntries(
					this.app,
					{
						storage,
						readingMaterialStorage: this.readingMaterialStorage,
					},
			  );

		if (useIncrementalFileChange && (!incrementalFiles || incrementalFiles.length === 0)) {
			return cleanupResult.deletedChunks;
		}

		const decks = Object.values(await storage.getAllDecks()).filter(
			(deck) => !deck.archivedAt,
		);
		const deckById = new Map(
			decks
				.map((deck) => [String(deck.id || "").trim(), deck] as const)
				.filter(([deckId]) => Boolean(deckId)),
		);
		const deckNameById = Object.fromEntries(
			decks.map((deck) => [
				String(deck.id || "").trim(),
				String(deck.name || "").trim() || String(deck.id || "").trim(),
			]),
		);
		const subscriptionSettingsForScan = {
			...folderSubscription,
			rules: (folderSubscription?.rules || []).filter((rule) =>
				deckById.has(String(rule.deckId || "").trim()),
			),
		};

		let chunks: ExistingChunkLike[];
		let materials: ExistingMaterialLike[];
		if (incrementalFiles) {
			chunks = [];
			for (const file of incrementalFiles) {
				const fileChunks = await storage.getChunksByFilePath(file.path);
				for (const chunk of fileChunks) {
					chunks.push(chunk as unknown as ExistingChunkLike);
				}
			}
			materials = this.collectFolderSubscriptionMaterialsForFiles(
				incrementalFiles,
			);
		} else {
			chunks = Object.values(await storage.getAllChunkData()) as unknown as ExistingChunkLike[];
			materials = this.readingMaterialStorage
				.getAllMaterials()
				.map((material) => ({
					uuid: material.uuid,
					filePath: material.filePath,
					readingDeckId: material.readingDeckId,
					topicId: material.topicId,
				}));
		}

		const scanResult = await scanIncrementalReadingFolderSubscriptions({
			app: this.app,
			settings: subscriptionSettingsForScan,
			existingChunks: chunks,
			existingMaterials: materials,
			deckNameById,
			...(incrementalFiles
				? { limitToFiles: incrementalFiles }
				: {}),
		});

		if (scanResult.activeRuleCount === 0) {
			if (cleanupResult.deletedChunks > 0) {
				await recomputeAndBroadcastIRData(this.app, "ui_refresh");
			}
			if (trigger === "manual") {
				new Notice(i18n.t("irNotices.noFolderSubscriptionRules"), 3000);
			}
			return cleanupResult.deletedChunks;
		}

		if (scanResult.pendingCount > 0) {
			const threshold = Number(
				folderSubscription?.importConfirmThreshold ?? 20,
			);
			if (threshold > 0 && scanResult.pendingCount > threshold) {
				const pendingRules = scanResult.ruleSummaries.filter(
					(rule) => rule.pendingCount > 0,
				);
				const confirmed = await showObsidianConfirm(
					this.app,
					pendingRules.length <= 1
						? i18n.t("irMain.confirm.folderSubscriptionBatchSingleRule", {
								pendingCount: scanResult.pendingCount,
								threshold,
								folderPath: pendingRules[0]?.folderPath || "",
								deckName:
									pendingRules[0]?.deckName || pendingRules[0]?.deckId || "",
						  })
						: i18n.t("irMain.confirm.folderSubscriptionBatchMultipleRules", {
								ruleCount: pendingRules.length,
								pendingCount: scanResult.pendingCount,
								threshold,
						  }),
					{
						title: i18n.t("irMain.confirm.folderSubscriptionBatchTitle"),
						confirmText: i18n.t(
							"irMain.confirm.folderSubscriptionBatchConfirm",
						),
						cancelText: i18n.t("irMain.dialog.cancel"),
						confirmClass: "mod-warning",
					},
				);
				if (!confirmed) {
					if (cleanupResult.deletedChunks > 0) {
						await recomputeAndBroadcastIRData(this.app, "ui_refresh");
					}
					return cleanupResult.deletedChunks;
				}
			}
		}

		const pinToToday = folderSubscription?.initialScheduleMode !== "scheduled";
		const irSettings = this.getIncrementalReadingSettings();
		const todayStart = this.getIncrementalReadingTodayStart();
		const endOfToday = new Date(todayStart);
		endOfToday.setHours(23, 59, 59, 999);
		const allChunks = Object.values((await storage.getAllChunkData()) || {});
		const remainingTodaySlots = resolveRemainingDailyAdmissionQuota({
			dailyTimeBudgetMinutes: Number(irSettings.dailyTimeBudgetMinutes) || 40,
			dailyReadingPointCap: Number(irSettings.dailyReadingPointCap) || 15,
			todayOccupiedCount: countTodayOccupiedReadingPoints(
				allChunks,
				endOfToday.getTime(),
			),
			todayOccupiedMinutes: sumTodayOccupiedReadingMinutes(
				allChunks,
				endOfToday.getTime(),
				irSettings.maxEstimatedMinutesPerItem,
			),
			maxEstimatedMinutesPerItem: irSettings.maxEstimatedMinutesPerItem,
		}).admitCount;
		const applyResult =
			await applyIncrementalReadingFolderSubscriptionCandidates({
				candidates: scanResult.candidates.map((candidate) => ({
					...candidate,
					deckName:
						candidate.deckName ||
						deckNameById[String(candidate.rule.deckId || "").trim()] ||
						"",
				})),
				pinToToday,
				remainingTodaySlots,
				getOrCreateMaterial: async (file, options) => {
					const material =
						await this.readingMaterialManager.ensureMaterialForFolderSubscription(
							file,
							{
								...options,
								category: ReadingCategory.Later,
							},
						);
					return { uuid: material.uuid };
				},
				setReadingDeck: async (materialId, deckId) =>
					await this.readingMaterialManager.setReadingDeck(materialId, deckId),
				ensureChunkScheduled: async (file, deckId, deckName, scheduleOptions) =>
					await this.ensureExternalDocumentChunkScheduled(
						file,
						deckId,
						deckName,
						{
							...scheduleOptions,
							existingChunk: scheduleOptions.existingChunk,
							readingMaterialId: scheduleOptions.readingMaterialId,
						},
					),
			});
		const { added, updated, unchanged } = applyResult;

		const changedCount = added + updated;
		const syncedDeckIds = [
			...new Set(
				scanResult.candidates
					.map((candidate) => String(candidate.rule.deckId || "").trim())
					.filter(Boolean),
			),
		];
		if (scanResult.candidates.length > 0 || cleanupResult.deletedChunks > 0) {
			await recomputeAndBroadcastIRData(this.app, "import_materials", {
				deckIds: syncedDeckIds,
			});
		}

		if (trigger === "manual") {
			new Notice(
				i18n.t("irNotices.folderSyncDone", {
					scanned: scanResult.scannedMarkdownCount,
					added,
					updated,
					unchanged,
				}),
				4500,
			);
			const { IRFolderSubscriptionSyncResultModal } = await import(
				"./modals/IRFolderSubscriptionSyncResultModal"
			);
			new IRFolderSubscriptionSyncResultModal(this.app, {
				scannedMarkdownCount: scanResult.scannedMarkdownCount,
				activeRuleCount: scanResult.activeRuleCount,
				ruleSummaries: scanResult.ruleSummaries,
				applyResult,
			}).open();
		} else if (added > 0) {
			new Notice(i18n.t("irNotices.folderSyncAutoAdded", { added }), 3500);
		}

		return changedCount;
	}

	/**
	 * file-change 增量：只收集待评估文件相关的材料索引，避免 getAllMaterials 全量投影。
	 */
	private collectFolderSubscriptionMaterialsForFiles(
		files: TFile[],
	): ExistingMaterialLike[] {
		const byId = new Map<string, ExistingMaterialLike>();
		const pushMaterial = (material: {
			uuid?: string;
			filePath?: string;
			readingDeckId?: string;
			topicId?: string;
		} | null): void => {
			if (!material) {
				return;
			}
			const uuid = String(material.uuid || "").trim();
			if (!uuid || byId.has(uuid)) {
				return;
			}
			byId.set(uuid, {
				uuid,
				filePath: material.filePath,
				readingDeckId: material.readingDeckId,
				topicId: material.topicId,
			});
		};

		for (const file of files) {
			pushMaterial(this.readingMaterialStorage.getMaterialByPath(file.path));
			try {
				const yamlReadingId = String(
					this.app.metadataCache?.getFileCache?.(file)?.frontmatter?.[
						"weave-reading-id"
					] || "",
				).trim();
				if (yamlReadingId) {
					pushMaterial(
						this.readingMaterialStorage.getMaterialById(yamlReadingId),
					);
				}
			} catch {
				/* ignored */
			}
		}

		return [...byId.values()];
	}

	getIRCalendarSidebarSettings(): IRCalendarSidebarSettings {
		if (!this.irCalendarSidebarSettingsCache) {
			this.irCalendarSidebarSettingsCache =
				this.normalizeIRCalendarSidebarSettings(
					this.settings.incrementalReading.calendarSidebar,
				);
		}

		const canUseTimer = PremiumFeatureGuard.getInstance().canUseFeature(
			PREMIUM_FEATURES.READING_TIMER,
		);
		return {
			...this.irCalendarSidebarSettingsCache,
			showMaterialTimers: canUseTimer
				? this.irCalendarSidebarSettingsCache.showMaterialTimers
				: false,
			backgroundWall: {
				...this.irCalendarSidebarSettingsCache.backgroundWall,
			},
		};
	}

	async saveIRCalendarSidebarSettings(
		settings: Partial<IRCalendarSidebarSettings>,
	): Promise<void> {
		const current = this.getIRCalendarSidebarSettings();
		const next = this.normalizeIRCalendarSidebarSettings({
			...current,
			...settings,
			backgroundWall: {
				...(current.backgroundWall ?? {}),
				...(settings.backgroundWall ?? {}),
			},
		});
		this.irCalendarSidebarSettingsCache = next;
		this.settings.incrementalReading.calendarSidebar = next;
		await this.saveSettings();
	}

	async activateIRCalendarView(
		options: {
			preferredLeaf?: WorkspaceLeaf;
			state?: Record<string, unknown>;
		} = {},
	): Promise<void> {
		await this.ensureIRUserWorkspaceReady();

		const { workspace } = this.app;
		let leaf: WorkspaceLeaf | null =
			workspace.getLeavesOfType(VIEW_TYPE_IR_CALENDAR)[0] || null;
		if (!leaf) {
			leaf = workspace.getLeftLeaf(false) ?? workspace.getLeftLeaf(true);
		}
		if (!leaf) {
			throw new Error("ir-calendar-leaf-unavailable");
		}

		try {
			await leaf.setViewState({
				type: VIEW_TYPE_IR_CALENDAR,
				active: true,
				...(options.state ? { state: options.state } : {}),
			});
			revealLeaf(this.app, leaf);
		} finally {
			// Always drop the proxy `.irdeck` leaf after calendar takes over,
			// even if reveal throws.
			if (options.preferredLeaf && options.preferredLeaf !== leaf) {
				options.preferredLeaf.detach();
			}
		}
	}

	async openIRTutorial(initialTab?: string): Promise<void> {
		await this.activateIRCalendarView();
		window.setTimeout(() => {
			dispatchOpenIRTutorial(
				initialTab ? { initialTab } : undefined,
			);
		}, 120);
	}

	async openParagraphReadingWorkbench(
		input: ParagraphWorkbenchOpenInput,
		options: { preferredLeaf?: WorkspaceLeaf } = {},
	): Promise<void> {
		const sourcePath = normalizePath(String(input.sourcePath || "").trim());
		if (!sourcePath) {
			throw new Error("paragraph-workbench-source-empty");
		}

		const { workspace } = this.app;
		const leaf =
			workspace.getLeavesOfType(VIEW_TYPE_IR_PARAGRAPH_WORKBENCH)[0] ||
			options.preferredLeaf ||
			workspace.getLeaf("tab");
		if (!leaf) {
			throw new Error("paragraph-workbench-leaf-unavailable");
		}

		await leaf.setViewState({
			type: VIEW_TYPE_IR_PARAGRAPH_WORKBENCH,
			active: true,
			state: {
				...input,
				sourcePath,
			},
		});

		revealLeaf(this.app, leaf);
	}

	async openIRDeckCalendar(
		filePath: string,
		preferredLeaf?: WorkspaceLeaf,
	): Promise<void> {
		const normalizedPath = normalizePath(String(filePath || "").trim());
		if (!normalizedPath) {
			throw new Error("irdeck-path-empty");
		}

		const fallbackName = basenameWithoutExtension(normalizedPath);
		const pointReadService = await import(
			"./services/incremental-reading/IRPointDataReadService"
		);
		const entry = await new pointReadService.IRPointDataReadService(
			this.app,
		).getPointFileEntryByPath(normalizedPath);
		const focusDeckId = String(entry?.topicId || "").trim();
		if (!focusDeckId) {
			throw new Error("irdeck-topic-unresolved");
		}

		const focusDeckName =
			String(entry?.topicName || "").trim() || fallbackName;

		await this.activateIRCalendarView({
			preferredLeaf,
			state: {
				filePath: normalizedPath,
				focusDeckId,
				focusDeckName,
			},
		});
	}

	async redirectIncrementalReadingToSidebar(options?: {
		deckPath?: string;
		deckName?: string;
		closeLegacyFocusLeaves?: boolean;
	}): Promise<void> {
		const deckPath = normalizePath(String(options?.deckPath || "").trim());
		if (deckPath) {
			try {
				await this.openIRDeckCalendar(deckPath);
			} catch (error) {
				// Legacy focus tabs may carry a stale deckPath; still leave the
				// old view and land on the unscoped calendar instead of hanging.
				logger.warn(
					"[Standalone IR] 旧焦点视图专题解析失败，回退到通用日历:",
					error,
				);
				await this.activateIRCalendarView();
			}
		} else {
			await this.activateIRCalendarView();
		}
		if (options?.closeLegacyFocusLeaves) {
			this.app.workspace.detachLeavesOfType(VIEW_TYPE_IR_FOCUS);
		}
	}

	async openEpubReader(filePath: string): Promise<void> {
		const host = this.getExternalEpubHost();
		if (host?.openEpubReader) {
			await host.openEpubReader(filePath);
			return;
		}

		const { notifyEpubReaderUnavailable } = await import(
			"./utils/epub-reader-access"
		);
		notifyEpubReaderUnavailable(this.app);
	}

	async getAvailableEpubIncrementalReadingTopics(): Promise<
		EpubHostIncrementalReadingTopicOption[]
	> {
		return await this.getIRHostSharedService().getAvailableEpubIncrementalReadingTopics();
	}

	async scheduleEpubChapterForIncrementalReading(options: {
		filePath: string;
		title: string;
		tocHref: string;
		tocLevel: number;
		deckId?: string;
	}): Promise<void> {
		await this.getIRHostSharedService().scheduleEpubChapterForIncrementalReading(
			options,
			this.resolveIRDeckById.bind(this),
			this.pickIRDeck.bind(this),
		);
	}

	async markEpubResumePointFromReader(options: {
		filePath: string;
		cfi: string;
		chapterHref?: string;
		chapterTitle?: string;
		deckId?: string;
	}): Promise<void> {
		await this.getIRHostSharedService().markEpubResumePointFromReader(
			options,
			this.resolveIRDeckById.bind(this),
		);
	}

	/**
	 * Cross-plugin interop: record extract / memory-card / note outcomes onto an IR point.
	 * Weave main (and other hosts) should call this after creating real artifacts.
	 */
	async recordIRLearningOutcome(
		input: IRLearningOutcomeInput,
	): Promise<IRLearningOutcomeResult> {
		return await this.getIROutcomeRecordingService().recordOutcome(input);
	}

	async openIRReadingPointFromExternalSelection(options: {
		filePath: string;
		selectedText: string;
		sourceLink?: string;
		successNotice?: string;
		initialTitle?: string;
	}): Promise<void> {
		const selectedText = String(options.selectedText || "").trim();
		if (!selectedText) {
			new Notice(i18n.t("irNotices.selectTextFirst"), 3000);
			return;
		}

		const sourceLink = String(options.sourceLink || "").trim();
		if (sourceLink) {
			const preferredTitle = this.cleanIRReadingPointTitle(
				String(options.initialTitle || ""),
			);
			const draft = preferredTitle
				? { title: preferredTitle, titleDetected: true }
				: this.deriveIRReadingPointDraftFromSelection(selectedText);
			await this.runAddReadingTargetQuickCreate({
				initialLink: sourceLink,
				initialTitle: draft.title,
			});
			return;
		}

		const file = this.app.vault.getAbstractFileByPath(
			String(options.filePath || "").trim(),
		);
		if (!(file instanceof TFile)) {
			new Notice(i18n.t("irNotices.sourceFileNotFound"), 3000);
			return;
		}

		await this.runSelectionToIRQuickCreate({
			file,
			editor: null,
			selectedText,
			selectionRange: null,
			replaceSourceSelection: false,
			successNotice: options.successNotice,
			initialTitle: String(options.initialTitle || "").trim() || undefined,
		});
	}

	normalizeSelectionQuickCreateFolderPath(folderPath: string): string {
		const raw = String(folderPath || "").trim();
		if (!raw || raw === "/" || raw === ".") {
			return "";
		}
		return normalizePath(raw);
	}

	normalizeImportFolder(folderPath?: string | null): string {
		return resolveIRImportFolder(
			String(folderPath || "").trim(),
			this.settings.weaveParentFolder,
		);
	}

	private getIRHostSharedService(): IRHostSharedService {
		if (!this.irHostSharedService) {
			this.irHostSharedService = new IRHostSharedService(this.app);
		}
		return this.irHostSharedService;
	}

	private getIROutcomeRecordingService(): IROutcomeRecordingService {
		if (!this.irOutcomeRecordingService) {
			this.irOutcomeRecordingService = new IROutcomeRecordingService(this.app);
		}
		return this.irOutcomeRecordingService;
	}

	private normalizeSettings(
		input: Partial<StandaloneIRSettings> | StandaloneIRSettings,
	): StandaloneIRSettings {
		const weaveParentFolder = String(input.weaveParentFolder || "").trim();
		const showPremiumFeaturesPreview =
			input.showPremiumFeaturesPreview === true;
		const uiLanguage = normalizePluginUiLanguagePreference(input.uiLanguage);
		const licenseState = normalizeLicenseStore(
			input.license,
			input.licenseState,
		);
		return {
			weaveParentFolder,
			incrementalReading: normalizeIncrementalReadingSettings(
				input.incrementalReading ?? DEFAULT_INCREMENTAL_READING_SETTINGS,
				weaveParentFolder,
			),
			license: getLegacyPrimaryLicense(licenseState.localLicenses),
			licenseState,
			allowInheritedLicenses: input.allowInheritedLicenses !== false,
			showPremiumFeaturesPreview,
			uiLanguage,
			calendarTutorialDismissed: input.calendarTutorialDismissed === true,
			editorModalSize: input.editorModalSize,
		};
	}

	private normalizeIRCalendarSidebarSettings(
		settings?: Partial<IRCalendarSidebarSettings> | null,
	): IRCalendarSidebarSettings {
		return normalizeIRCalendarSidebarSettings(settings);
	}

	/**
	 * 挂载阅读材料管理器，供导入模态窗与兼容路径使用（原 Weave 主插件在 onload 中注入）。
	 */
	private async initializeReadingMaterialServices(): Promise<void> {
		const storage = createReadingMaterialStorage(this.app);
		await storage.initialize();
		const yamlManager = createYAMLFrontmatterManager(this.app);
		this.readingMaterialStorage = storage;
		this.readingMaterialManager = createReadingMaterialManager(
			this.app,
			storage,
			yamlManager,
		);
		this.readingMaterialManager.setAnchorManager(
			createAnchorManager(this.app, storage, yamlManager),
		);
		markServiceReady("readingMaterialManager");
	}

	/**
	 * 用户首次打开 IR 界面时再准备可写工作区：
	 * - 懒创建默认专题（避免「打开 Obsidian 但同步未完成」时空库误建抬高 mtime）
	 * - 显式跑一次性 vault 维护（迁移/路径规范化/legacy 统一）
	 */
	async ensureIRUserWorkspaceReady(): Promise<void> {
		await this.ensureDeferredStartupComplete();
		await this.ensureDefaultIRDeckExists();
		await getSharedIRPointStorageService(this.app).runDeferredVaultMutations();
	}

	private async ensureDefaultIRDeckExists(): Promise<void> {
		const pointStorage = new IRPointStorageService(this.app);
		if (await pointStorage.hasAnyVaultPointDeck()) {
			return;
		}

		const storage = new IRStorageService(this.app);
		await storage.initialize();
		const deck = createDefaultIRDeck(DEFAULT_DECK_NAME());
		deck.path = deck.id;
		await storage.saveDeck(deck);
		logger.info("[Standalone IR] 已创建默认专题", {
			deckId: deck.id,
			name: deck.name,
		});
	}

	private registerEditorSelectionAddToIRMenu(): void {
		this.registerEvent(
			this.app.workspace.on(
				"editor-menu",
				(menu: Menu, editor, info) => {
					try {
						if (
							!this.shouldShowPremiumEntry(PREMIUM_FEATURES.INCREMENTAL_READING)
						) {
							return;
						}
						const file = info.file;
						if (!(file instanceof TFile) || file.extension !== "md") {
							return;
						}
						const selection = editor.getSelection()?.trim() || "";
						const cursorLine = editor.getLine(editor.getCursor().line);
						if (!selection && !cursorLine?.trim()) {
							return;
						}
						menu.addItem((item) => {
							item
								.setTitle(i18n.t("irCommands.addReadingTargetFromSelection"))
								.setIcon("book-plus")
								.onClick(() => {
									if (
										!this.ensurePremiumFeatureAccess(
											PREMIUM_FEATURES.INCREMENTAL_READING,
											i18n.t("irCommands.premiumBlockedMessage"),
										)
									) {
										return;
									}
									void this.runAddReadingTargetFromEditorSelection(
										editor,
										file,
									);
								});
						});
					} catch (error) {
						logger.error(
							"[Standalone IR] 注册编辑器选区菜单失败:",
							error,
						);
					}
				},
			),
		);
	}

	private registerCanvasNodeContextMenu(): void {
		this.registerEvent(
			this.app.workspace.on(
				"canvas:node-menu",
				(menu: Menu, node: CanvasMenuNode) => {
					try {
						if (
							!this.shouldShowPremiumEntry(PREMIUM_FEATURES.INCREMENTAL_READING)
						) {
							return;
						}

						const nodeContent = readCanvasNodeText(node);
						if (!nodeContent) {
							return;
						}

						menu.addItem((item) => {
							item
								.setTitle(i18n.t("irCommands.addToIr"))
								.setIcon("book-plus")
								.onClick(() => {
									if (
										!this.ensurePremiumFeatureAccess(
											PREMIUM_FEATURES.INCREMENTAL_READING,
											i18n.t("irCommands.premiumBlockedMessage"),
										)
									) {
										return;
									}
									const context = this.buildCanvasNodeIRPointContext(node);
									if (!context) {
										new Notice(i18n.t("irCommands.canvasNodeNoContent"), 3000);
										return;
									}
									void this.runAddReadingTargetQuickCreate({
										initialLink: context.sourceLink,
										initialTitle: context.initialTitle,
										initialCanvasTextCandidates: context.textCandidates,
									});
								});
						});
					} catch (error) {
						logger.error("[Standalone IR] 注册 Canvas 节点菜单失败:", error);
					}
				},
			),
		);
	}

	private registerIncrementalReadingFolderSubscriptionWatchers(): void {
		const handleFileChange = (
			file: TFile,
			eventType: "create" | "rename",
			legacyPath?: string,
		) => {
			void this.handleIncrementalReadingFolderSubscriptionFileChange(
				file,
				eventType,
				legacyPath,
			);
		};

		this.registerEvent(
			this.app.vault.on("create", (file) => {
				if (file instanceof TFile) {
					handleFileChange(file, "create");
				}
			}),
		);
		this.registerEvent(
			this.app.vault.on("rename", (file, oldPath) => {
				if (file instanceof TFile) {
					handleFileChange(file, "rename", oldPath);
				}
			}),
		);
	}

	/**
	 * Vault rename → rewrite persisted IR reading-point source paths
	 * (points / PDF / EPUB / materials), similar to Obsidian wiki-link updates.
	 */
	private registerIRSourcePathRenameWatchers(): void {
		const renameService = getSharedIRSourcePathRenameService(this.app);
		this.registerEvent(
			this.app.vault.on("rename", (file, oldPath) => {
				if (file instanceof TFile || file instanceof TFolder) {
					renameService.handleVaultAbstractRename(file, oldPath);
				}
			}),
		);
	}

	private async handleIncrementalReadingFolderSubscriptionFileChange(
		file: TFile,
		eventType: "create" | "rename",
		legacyPath?: string,
	): Promise<void> {
		try {
			const folderSubscription =
				this.getIncrementalReadingSettings().folderSubscription;
			// Markdown-only contract lives in shouldTrigger… (images/attachments never resync).
			const shouldResync = shouldTriggerFolderSubscriptionResyncForVaultEvent({
				eventType,
				nextPath: file.path,
				previousPath: legacyPath,
				settingsOrRules: folderSubscription,
			});
			if (!shouldResync) {
				return;
			}
			this.scheduleIncrementalReadingFolderSubscriptionResync(file.path);
		} catch (error) {
			logger.warn("[Standalone IR] 订阅文件夹变更处理失败:", error);
		}
	}

	private scheduleIncrementalReadingFolderSubscriptionResync(
		filePath?: string,
	): void {
		const normalizedPath = normalizePath(String(filePath || "").trim());
		if (normalizedPath) {
			this.pendingFolderSubscriptionResyncPaths.add(normalizedPath);
		}
		if (this.incrementalReadingFolderSubscriptionResyncTimer !== null) {
			window.clearTimeout(this.incrementalReadingFolderSubscriptionResyncTimer);
		}
		this.incrementalReadingFolderSubscriptionResyncTimer = window.setTimeout(
			() => {
				this.incrementalReadingFolderSubscriptionResyncTimer = null;
				const pendingPaths = [
					...this.pendingFolderSubscriptionResyncPaths,
				];
				this.pendingFolderSubscriptionResyncPaths.clear();
				getSharedIRHostCriticalWorkGuard(this.app).runVaultBackgroundWork(
					async () => {
						await this.syncIncrementalReadingFolderSubscriptionFromSettings({
							trigger: "file-change",
							filePaths: pendingPaths,
						});
					},
				);
			},
			300,
		);
	}

	private registerIRDeckVaultSync(): void {
		const queuePathChange = (options: {
			path?: string | null;
			previousPath?: string | null;
			deleted?: boolean;
		}) => {
			if (options.previousPath && isIRDeckFilePath(options.previousPath)) {
				const normalizedPrevious = normalizePath(options.previousPath);
				this.pendingIRDeckRemovedPaths.add(normalizedPrevious);
				this.pendingIRDeckChangedPaths.delete(normalizedPrevious);
			}

			if (options.deleted && options.path && isIRDeckFilePath(options.path)) {
				const normalized = normalizePath(options.path);
				this.pendingIRDeckRemovedPaths.add(normalized);
				this.pendingIRDeckChangedPaths.delete(normalized);
			} else if (options.path && isIRDeckFilePath(options.path)) {
				const normalized = normalizePath(options.path);
				this.pendingIRDeckChangedPaths.add(normalized);
				this.pendingIRDeckRemovedPaths.delete(normalized);
			}

			if (
				this.pendingIRDeckChangedPaths.size === 0 &&
				this.pendingIRDeckRemovedPaths.size === 0
			) {
				return;
			}
			this.scheduleIRDeckIndexRefresh();
		};

		this.registerEvent(
			this.app.vault.on("create", (file) => {
				if (file instanceof TFile) {
					queuePathChange({ path: file.path });
				}
			}),
		);
		this.registerEvent(
			this.app.vault.on("modify", (file) => {
				if (file instanceof TFile) {
					queuePathChange({ path: file.path });
				}
			}),
		);
		this.registerEvent(
			this.app.vault.on("delete", (file) => {
				if (file instanceof TFile) {
					queuePathChange({ path: file.path, deleted: true });
				}
			}),
		);
		this.registerEvent(
			this.app.vault.on("rename", (file, oldPath) => {
				if (file instanceof TFile) {
					queuePathChange({ path: file.path, previousPath: oldPath });
				}
			}),
		);
	}

	/**
	 * Vault → IR: when Markdown frontmatter tags change, sync into chunk/point
	 * storage so tag-group matching stays aligned with the configured YAML key.
	 */
	private registerMarkdownReadingTagsVaultSync(): void {
		this.registerEvent(
			this.app.metadataCache.on("changed", (file) => {
				if (!(file instanceof TFile) || file.extension !== "md") {
					return;
				}
				const normalized = normalizePath(file.path);
				if (isWritingMarkdownReadingTags(normalized)) {
					return;
				}
				this.pendingMarkdownReadingTagsPaths.add(normalized);
				this.scheduleMarkdownReadingTagsSync();
			}),
		);
	}

	private scheduleMarkdownReadingTagsSync(): void {
		if (this.markdownReadingTagsSyncTimer !== null) {
			window.clearTimeout(this.markdownReadingTagsSyncTimer);
		}

		this.markdownReadingTagsSyncTimer = window.setTimeout(() => {
			this.markdownReadingTagsSyncTimer = null;
			const paths = Array.from(this.pendingMarkdownReadingTagsPaths);
			this.pendingMarkdownReadingTagsPaths.clear();
			if (paths.length === 0) {
				return;
			}

			getSharedIRHostCriticalWorkGuard(this.app).runVaultBackgroundWork(
				async () => {
					const tagService = new IRPointTagService(this.app);
					let skippedWhileWriting = false;
					for (const path of paths) {
						if (isWritingMarkdownReadingTags(path)) {
							this.pendingMarkdownReadingTagsPaths.add(path);
							skippedWhileWriting = true;
							continue;
						}
						try {
							if (!(await tagService.hasChunksForMarkdownPath(path))) {
								continue;
							}
							await tagService.syncMarkdownChunkTags(path);
						} catch (error) {
							logger.debug(
								`[Standalone IR] Markdown 标签同步失败: ${path}`,
								error,
							);
						}
					}
					if (skippedWhileWriting) {
						this.scheduleMarkdownReadingTagsSync();
					}
				},
			);
		}, 300);
	}

	private scheduleIRDeckIndexRefresh(): void {
		if (this.irDeckIndexRefreshTimer !== null) {
			window.clearTimeout(this.irDeckIndexRefreshTimer);
		}

		this.irDeckIndexRefreshTimer = window.setTimeout(() => {
			this.irDeckIndexRefreshTimer = null;
			const changedPaths = Array.from(this.pendingIRDeckChangedPaths);
			const removedPaths = Array.from(this.pendingIRDeckRemovedPaths);
			this.pendingIRDeckChangedPaths.clear();
			this.pendingIRDeckRemovedPaths.clear();
			getSharedIRHostCriticalWorkGuard(this.app).runVaultBackgroundWork(
				async () => {
					await this.refreshIRDeckIndexFromVault({
						trigger: "vault_change",
						recompute: true,
						changedPaths,
						removedPaths,
					});
				},
			);
		}, 250);
	}

	private async refreshIRDeckIndexFromVault(options: {
		trigger: "startup" | "vault_change";
		recompute: boolean;
		changedPaths?: string[];
		removedPaths?: string[];
	}): Promise<void> {
		try {
			const pointStorage = new IRPointStorageService(this.app);
			const result =
				options.trigger === "vault_change" &&
				((options.changedPaths?.length ?? 0) > 0 ||
					(options.removedPaths?.length ?? 0) > 0)
					? await pointStorage.refreshPointFilesIndexForVaultPaths(
							options.changedPaths || [],
							{
								removedPaths: options.removedPaths,
							},
					  )
					: await pointStorage.refreshPointFilesIndexFromVault();
			const hasIndexChanges =
				result.added > 0 || result.updated > 0 || result.removed > 0;

			if (hasIndexChanges) {
				logger.info("[Standalone IR] 已同步库内 .irdeck 专题索引", {
					trigger: options.trigger,
					scanned: result.scanned,
					topicCount: result.topicCount,
					duplicateTopicGroups: result.duplicateTopicGroups,
					added: result.added,
					updated: result.updated,
					removed: result.removed,
				});
			}

			if (!options.recompute) {
				return;
			}

			// vault_change：即便索引元数据未变，.irdeck 内日程字段也可能被云同步覆盖，
			// 必须失效投影缓存并从 vault 重建，避免 UI 卡在旧 schedule/due/day cache。
			const hasVaultPathTouches =
				options.trigger === "vault_change" &&
				((options.changedPaths?.length ?? 0) > 0 ||
					(options.removedPaths?.length ?? 0) > 0);
			if (!hasIndexChanges && !hasVaultPathTouches) {
				return;
			}

			await recomputeAndBroadcastIRData(this.app, "ui_refresh");
		} catch (error) {
			logger.warn("[Standalone IR] 同步库内 .irdeck 专题索引失败", error);
		}
	}

	private getExternalEpubHost(): EpubHostReaderCapabilities | null {
		return findCollaboratorEpubHost(
			this.app,
			IR_RUNTIME.epubReaderHostPluginIds,
			this,
		);
	}

	private async resolveIRDeckById(
		deckId: string,
	): Promise<{ id: string; name: string } | null> {
		return await this.getIRHostSharedService().resolveIRDeckById(deckId);
	}

	shouldShowPremiumEntry(featureId: string): boolean {
		return PremiumFeatureGuard.getInstance().shouldShowFeatureEntry(featureId);
	}

	ensurePremiumFeatureAccess(
		featureId: string,
		_blockedMessage: string,
	): boolean {
		return ensureIRPremiumFeature(this.app, featureId);
	}

	private async getIRDeckIdentifiers(deck: {
		id: string;
		path?: string;
	}): Promise<string[]> {
		return await this.getIRHostSharedService().getIRDeckIdentifiers(deck);
	}

	private normalizeEpubBookmarkHref(href: string): string {
		return this.getIRHostSharedService().normalizeEpubBookmarkHref(href);
	}

	private async pickIRDeck(): Promise<{ id: string; name: string } | null> {
		return await this.getIRHostSharedService().pickIRDeck();
	}

	private getSelectionContextForIRQuickCreate(): IRQuickCreateContext | null {
		const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
		const activeFile = activeView?.file ?? this.app.workspace.getActiveFile();
		if (!(activeFile instanceof TFile) || activeFile.extension !== "md") {
			return null;
		}

		const editor = activeView?.editor ?? null;
		let selectedText = editor?.getSelection() ?? "";
		let selectionRange: IRQuickCreateSelectionRange | null = null;

		if (editor && selectedText.trim()) {
			selectionRange = {
				from: editor.getCursor("from"),
				to: editor.getCursor("to"),
			};
		}

		if ((!selectedText || !selectedText.trim()) && editor) {
			const cursor = editor.getCursor();
			const line = editor.getLine(cursor.line);
			if (line?.trim()) {
				selectedText = line.trim();
				selectionRange = {
					from: { line: cursor.line, ch: 0 },
					to: { line: cursor.line, ch: line.length },
				};
				editor.setSelection(selectionRange.from, selectionRange.to);
			}
		}

		if (!selectedText || !selectedText.trim()) {
			const windowSelection = window.getSelection()?.toString()?.trim() || "";
			if (!windowSelection) {
				return null;
			}
			selectedText = windowSelection;
			selectionRange = null;
		}

		return {
			file: activeFile,
			editor,
			selectedText: selectedText.trim(),
			selectionRange,
			replaceSourceSelection: true,
		};
	}

	private getActiveCanvasPath(): string | undefined {
		const activeLeaf = this.app.workspace.getMostRecentLeaf?.() ?? null;
		const activeCanvasPath =
			activeLeaf?.view?.getViewType?.() === "canvas"
				? (activeLeaf.view as { file?: { path?: string } }).file?.path
				: undefined;
		if (
			typeof activeCanvasPath === "string" &&
			activeCanvasPath.toLowerCase().endsWith(".canvas")
		) {
			return activeCanvasPath;
		}

		const activeFile = this.app.workspace.getActiveFile();
		if (activeFile?.path?.toLowerCase().endsWith(".canvas")) {
			return activeFile.path;
		}

		const canvasLeaf = this.app.workspace.getLeavesOfType("canvas")[0];
		const canvasPath = (
			canvasLeaf?.view as { file?: { path?: string } } | undefined
		)?.file?.path;
		return typeof canvasPath === "string" &&
			canvasPath.toLowerCase().endsWith(".canvas")
			? canvasPath
			: undefined;
	}

	private getCanvasNodeId(node: CanvasMenuNode): string | undefined {
		return resolveCanvasMenuNodeId(node);
	}

	private buildCanvasNodeSourceLink(node: CanvasMenuNode): string | undefined {
		const canvasPath = this.getActiveCanvasPath();
		if (!canvasPath) {
			return undefined;
		}

		const nodeData = readCanvasNodeData(node);
		const nodeId = this.getCanvasNodeId(node);
		if (!nodeId) {
			return `[[${canvasPath}]]`;
		}

		const x = Number(nodeData?.x);
		const y = Number(nodeData?.y);
		const width = Number(nodeData?.width);
		const height = Number(nodeData?.height);
		const params = new URLSearchParams();

		if (Number.isFinite(x)) params.set("x", String(Math.round(x)));
		if (Number.isFinite(y)) params.set("y", String(Math.round(y)));
		if (Number.isFinite(width)) params.set("w", String(Math.round(width)));
		if (Number.isFinite(height)) params.set("h", String(Math.round(height)));

		const query = params.toString();
		return `[[${canvasPath}#^${nodeId}${query ? `?${query}` : ""}]]`;
	}

	private buildCanvasNodeIRPointContext(node: CanvasMenuNode): {
		sourceLink: string;
		initialTitle: string;
		textCandidates: string[];
	} | null {
		const selectedText = readCanvasNodeText(node);
		if (!selectedText) {
			return null;
		}

		const canvasPath = this.getActiveCanvasPath();
		if (!canvasPath) {
			return null;
		}

		const canvasFile = this.app.vault.getAbstractFileByPath(canvasPath);
		if (!(canvasFile instanceof TFile)) {
			return null;
		}

		const nodeId = this.getCanvasNodeId(node);
		const sourceLink = this.buildCanvasNodeSourceLink(node);
		if (!nodeId || !sourceLink) {
			return null;
		}

		const nodeData = readCanvasNodeData(node);
		let initialTitle = "";
		if (nodeData?.type === "file" && typeof nodeData.file === "string") {
			const basename =
				nodeData.file
					.split("/")
					.pop()
					?.replace(/\.[^.]+$/u, "") || String(nodeData.file || "");
			initialTitle = this.cleanIRReadingPointTitle(basename);
		}
		if (!initialTitle) {
			initialTitle =
				this.deriveIRReadingPointDraftFromSelection(selectedText).title;
		}

		return {
			sourceLink,
			initialTitle,
			textCandidates: getCanvasTextCandidatesFromText(selectedText),
		};
	}

	async runWebSelectionToIRQuickCreate(context: {
		url: string;
		title: string;
		selectedText: string;
	}): Promise<void> {
		const url = String(context?.url || "").trim();
		const selectedText = String(context?.selectedText || "")
			.replace(/\r\n?/g, "\n")
			.trim();
		if (!url) {
			new Notice(i18n.t("irNotices.noWebUrl"), 3000);
			return;
		}
		if (!selectedText) {
			new Notice(i18n.t("irNotices.selectWebTextFirst"), 3000);
			return;
		}

		const preferredTitle = this.cleanIRReadingPointTitle(
			String(context.title || ""),
		);
		const draft = preferredTitle
			? { title: preferredTitle, titleDetected: true }
			: this.deriveIRReadingPointDraftFromSelection(selectedText);

		await this.runAddReadingTargetQuickCreate({
			initialLink: url,
			initialTitle: draft.title,
		});
	}

	async runWebPageToIRQuickCreate(context: {
		url: string;
		title: string;
	}): Promise<void> {
		const url = String(context?.url || "").trim();
		if (!url) {
			new Notice(i18n.t("irNotices.noWebUrl"), 3000);
			return;
		}

		const preferredTitle = this.cleanIRReadingPointTitle(
			String(context.title || ""),
		);
		const draftTitle =
			preferredTitle ||
			deriveWebPageTitleFromUrl(url) ||
			i18n.t("irMain.defaults.webReadingPointTitle");

		await this.runAddReadingTargetQuickCreate({
			initialLink: url,
			initialTitle: draftTitle,
		});
	}

	/**
	 * Ensure / reuse an Obsidian block id for the editor selection (or current line),
	 * then open Add Reading Target with `![[path#^IR-…]]`.
	 */
	async runAddReadingTargetFromEditorSelection(
		editor: MarkdownView["editor"],
		file: TFile,
	): Promise<void> {
		if (
			!this.ensurePremiumFeatureAccess(
				PREMIUM_FEATURES.INCREMENTAL_READING,
				i18n.t("irCommands.premiumBlockedMessage"),
			)
		) {
			return;
		}

		if (!(file instanceof TFile) || file.extension !== "md") {
			new Notice(i18n.t("irNotices.selectMarkdownTextOrLine"), 3000);
			return;
		}

		let selectedText = editor.getSelection() ?? "";
		let from = editor.getCursor("from");
		let to = editor.getCursor("to");

		if (!selectedText.trim()) {
			const cursor = editor.getCursor();
			const line = editor.getLine(cursor.line);
			if (!line?.trim()) {
				new Notice(i18n.t("irNotices.selectMarkdownTextOrLine"), 3000);
				return;
			}
			selectedText = line.trim();
			from = { line: cursor.line, ch: 0 };
			to = { line: cursor.line, ch: line.length };
			editor.setSelection(from, to);
		}

		const {
			buildObsidianEmbedBlockWikiLink,
			ensureBlockIdOnMarkdownSelection,
		} = await import(
			"./services/incremental-reading/paragraph-workbench/paragraph-block-reference"
		);

		const ensured = ensureBlockIdOnMarkdownSelection(
			editor.getValue(),
			from.line,
			to.line,
		);
		if (ensured.changed) {
			editor.setValue(ensured.nextContent);
			try {
				editor.setSelection(from, to);
			} catch {
				// Selection may shift slightly after inserting a trailing blank line.
			}
		}

		const draft = this.deriveIRReadingPointDraftFromSelection(
			selectedText.trim(),
		);
		const initialLink = buildObsidianEmbedBlockWikiLink(
			file.path,
			ensured.blockId,
		);
		await this.runAddReadingTargetQuickCreate({
			initialLink,
			initialTitle: draft.title,
		});
	}

	async runAddReadingTargetQuickCreate(options?: {
		initialLink?: string;
		initialTitle?: string;
		initialDeckId?: string;
		initialCanvasTextCandidates?: string[];
		scheduleDate?: Date;
	}): Promise<void> {
		if (
			!this.ensurePremiumFeatureAccess(
				PREMIUM_FEATURES.INCREMENTAL_READING,
				i18n.t("irCommands.defaultIrName"),
			)
		) {
			return;
		}

		try {
			const { AddReadingTargetModalObsidian } = await import(
				"./components/incremental-reading/AddReadingTargetModalObsidian"
			);
			if (this.addReadingTargetModalInstance) {
				this.addReadingTargetModalInstance.close();
				this.addReadingTargetModalInstance = null;
			}
			const modal = new AddReadingTargetModalObsidian(this.app, {
				plugin: this,
				initialLink: options?.initialLink,
				initialTitle: options?.initialTitle,
				initialDeckId: options?.initialDeckId,
				initialCanvasTextCandidates: options?.initialCanvasTextCandidates,
				scheduleDate: options?.scheduleDate,
				onClose: () => {
					if (this.addReadingTargetModalInstance === modal) {
						this.addReadingTargetModalInstance = null;
					}
				},
			});
			this.addReadingTargetModalInstance = modal;
			modal.open();
		} catch (error) {
			logger.error("[Standalone IR] 打开添加阅读目标窗口失败:", error);
			new Notice(i18n.t("irNotices.openAddModalFailed"), 3000);
		}
	}

	private async runSelectionToIRQuickCreate(
		context: IRQuickCreateContext | null,
	): Promise<void> {
		if (!context) {
			new Notice(i18n.t("irNotices.selectMarkdownTextOrLine"), 3000);
			return;
		}

		try {
			const preferredTitle = this.cleanIRReadingPointTitle(
				String(context.initialTitle || ""),
			);
			const draft = preferredTitle
				? { title: preferredTitle, titleDetected: true }
				: this.deriveIRReadingPointDraftFromSelection(context.selectedText);
			const folderConfig = this.getSelectionQuickCreateFolderConfig(
				context.file.path,
			);
			const storage = new IRStorageService(this.app);
			await storage.initialize();
			const deckOptions = Object.values(await storage.getAllDecks())
				.filter((deck) => !deck.archivedAt)
				.sort((left, right) => left.name.localeCompare(right.name))
				.map((deck) => ({ id: deck.id, name: deck.name }));
			if (deckOptions.length === 0) {
				new Notice(i18n.t("irCommands.noDecksAvailable"), 3000);
				return;
			}
			const preferredDeck = await this.resolvePreferredIRDeckForSelectionSource(
				context.file,
			);

			const { SelectionToIRModal } = await import(
				"./modals/SelectionToIRModal"
			);
			new SelectionToIRModal(this.app, {
				deckOptions,
				initialDeckId: preferredDeck?.id,
				initialTitle: draft.title,
				initialFolder: folderConfig.initialFolder,
				titleDetected: draft.titleDetected,
				onPreferenceChange: async (update) => {
					await this.saveSelectionQuickCreatePreferences(update);
				},
				onSubmit: async (payload) => {
					await this.createIRReadingPointFromSelection(context, payload);
				},
			}).open();
		} catch (error) {
			logger.error("[Standalone IR] 打开阅读点创建窗口失败:", error);
			new Notice(i18n.t("irNotices.openCreateModalFailed"), 3000);
		}
	}

	private cleanIRReadingPointTitle(rawTitle: string): string {
		return this.getIRHostSharedService().cleanIRReadingPointTitle(rawTitle);
	}

	private deriveIRReadingPointDraftFromSelection(selectedText: string): {
		title: string;
		titleDetected: boolean;
	} {
		return this.getIRHostSharedService().deriveIRReadingPointDraftFromSelection(
			selectedText,
		);
	}

	private getSelectionQuickCreateFolderConfig(contextPath?: string): {
		initialFolder: string;
	} {
		return this.getIRHostSharedService().getSelectionQuickCreateFolderConfig(
			this.getIncrementalReadingSettings(),
			contextPath,
		);
	}

	private async saveSelectionQuickCreatePreferences(update: {
		folderPath?: string;
	}): Promise<void> {
		this.settings.incrementalReading = {
			...this.settings.incrementalReading,
			...this.getIRHostSharedService().getUpdatedSelectionQuickCreatePreferences(
				this.settings.incrementalReading,
				update,
			),
		};
		await this.saveSettings();
	}

	private buildIRReadingPointContent(
		title: string,
		body: string,
		options?: { sourceLink?: string },
	): string {
		const safeTitle =
			this.cleanIRReadingPointTitle(title) ||
			i18n.t("irMain.defaults.unnamedReadingPoint");
		const normalizedBody = String(body || "")
			.replace(/\r\n?/g, "\n")
			.trim();
		const markdownBody = normalizedBody
			? `# ${safeTitle}\n\n${normalizedBody}\n`
			: `# ${safeTitle}\n`;
		const sourceLink = String(options?.sourceLink || "").trim();
		return sourceLink
			? createContentWithMetadata({ we_source: sourceLink }, markdownBody)
			: markdownBody;
	}

	private async ensureSelectionQuickCreateFolderExists(
		folderPath: string,
	): Promise<void> {
		const normalizedFolder =
			this.normalizeSelectionQuickCreateFolderPath(folderPath) || "/";
		if (normalizedFolder === "/") {
			return;
		}
		const segments = normalizedFolder.split("/").filter(Boolean);
		let currentPath = "";
		for (const segment of segments) {
			currentPath = currentPath ? `${currentPath}/${segment}` : segment;
			if (!this.app.vault.getAbstractFileByPath(currentPath)) {
				await this.app.vault.createFolder(currentPath);
			}
		}
	}

	private sanitizeIRReadingPointFileName(title: string): string {
		const cleaned = this.cleanIRReadingPointTitle(title)
			.replace(/[\\/:*?"<>|]/g, "_")
			.replace(/\.+$/g, "")
			.trim();
		const truncated =
			cleaned.length > 120 ? cleaned.slice(0, 120).trim() : cleaned;
		return (
			truncated ||
			`${i18n.t("irMain.defaults.readingPointFilePrefix")}-${Date.now()}`
		);
	}

	private async generateUniqueIRReadingPointPath(
		folderPath: string,
		title: string,
	): Promise<string> {
		const normalizedFolder =
			this.normalizeSelectionQuickCreateFolderPath(folderPath) || "/";
		const baseName = this.sanitizeIRReadingPointFileName(title);
		return await generateUniqueVaultFilePath(
			this.app,
			normalizedFolder,
			`${baseName}.md`,
		);
	}

	private async resolvePreferredIRDeckForSelectionSource(
		file: TFile,
	): Promise<{ id: string; name: string } | null> {
		const frontmatter =
			(this.app.metadataCache.getFileCache(file)?.frontmatter as
				| Record<string, unknown>
				| undefined) ?? {};
		const yamlTopicId =
			typeof frontmatter["weave-reading-topic-id"] === "string"
				? String(frontmatter["weave-reading-topic-id"]).trim()
				: "";
		const yamlLegacyDeckId =
			typeof frontmatter["weave-reading-ir-deck-id"] === "string"
				? String(frontmatter["weave-reading-ir-deck-id"]).trim()
				: "";
		const deckId = yamlTopicId || yamlLegacyDeckId;
		if (!deckId) {
			return null;
		}
		return await this.resolveIRDeckById(deckId);
	}

	private getIRReadingPointWikiLinkTarget(file: TFile): string {
		return file.path.replace(/\.md$/i, "");
	}

	private async updateSourceDocumentAfterIRQuickCreate(
		file: TFile,
		link: string,
		selectionRange: IRQuickCreateSelectionRange | null,
		editor: MarkdownView["editor"] | null,
	): Promise<boolean> {
		if (!selectionRange) {
			return false;
		}

		const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (
			editor &&
			activeView?.editor === editor &&
			activeView.file?.path === file.path
		) {
			editor.replaceRange(link, selectionRange.from, selectionRange.to);
			return true;
		}

		const currentContent = await this.app.vault.cachedRead(file);
		const updatedContent = replaceSelectionInMarkdownContent(
			currentContent,
			selectionRange,
			link,
		);
		if (updatedContent !== currentContent) {
			await this.app.vault.modify(file, updatedContent);
		}
		return true;
	}

	private async createIRReadingPointFromSelection(
		context: IRQuickCreateContext,
		payload: SelectionToIRSubmitPayload,
	): Promise<void> {
		const title = this.cleanIRReadingPointTitle(payload.title);
		if (!title) {
			new Notice(i18n.t("irNotices.enterReadingPointTitle"), 3000);
			throw new Error("selection-ir-missing-title");
		}

		const deckId = String(payload.deckId || "").trim();
		if (!deckId) {
			new Notice(i18n.t("irNotices.selectIrDeck"), 3000);
			throw new Error("selection-ir-missing-deck");
		}

		const storage = new IRStorageService(this.app);
		await storage.initialize();
		const rawDeck = await storage.getDeckById(deckId);
		if (!rawDeck || rawDeck.archivedAt) {
			new Notice(i18n.t("irNotices.deckNotFoundOrArchived"), 3000);
			throw new Error("selection-ir-deck-missing");
		}

		const deck = {
			id: deckId,
			name:
				String(rawDeck.name || "").trim() || i18n.t("irCommands.defaultIrName"),
		};
		const folderPath =
			this.normalizeSelectionQuickCreateFolderPath(
				payload.folderPath ||
					resolveIRReadableMarkdownTargetFolder(this.app, {
						lastSelectedFolder:
							this.getIncrementalReadingSettings()
								.selectionQuickCreateLastFolder,
						contextPath: context.file.path,
						allowActiveFileFallback: true,
					}),
			) || "/";
		const body = String(context.selectedText || "")
			.replace(/\r\n?/g, "\n")
			.trim();
		const fileContent = this.buildIRReadingPointContent(title, body, {
			sourceLink: context.sourceLink,
		});
		let createdFile: TFile | null = null;

		try {
			await this.ensureSelectionQuickCreateFolderExists(folderPath);
			const targetPath = await this.generateUniqueIRReadingPointPath(
				folderPath,
				title,
			);
			createdFile = await this.app.vault.create(targetPath, fileContent);

			await this.ensureExternalDocumentChunkScheduled(
				createdFile,
				deck.id,
				deck.name,
			);

			const shouldReplaceSourceSelection =
				context.replaceSourceSelection !== false;
			const createdLink = `[[${this.getIRReadingPointWikiLinkTarget(
				createdFile,
			)}]]`;
			const sourceUpdated = shouldReplaceSourceSelection
				? await this.updateSourceDocumentAfterIRQuickCreate(
						context.file,
						createdLink,
						context.selectionRange,
						context.editor,
				  )
				: false;

			await recomputeAndBroadcastIRData(this.app, "import_materials", {
				deckIds: [deck.id],
			});

			const successNotice = String(context.successNotice || "").trim();
			if (successNotice) {
				new Notice(successNotice, 3500);
			} else if (shouldReplaceSourceSelection) {
				new Notice(
					sourceUpdated
						? i18n.t("irNotices.pointCreatedWithReplace")
						: i18n.t("irNotices.pointCreatedWithoutReplace"),
					3500,
				);
			} else {
				new Notice(i18n.t("irNotices.pointCreated"), 2500);
			}
		} catch (error) {
			logger.error("[Standalone IR] 创建阅读点失败:", error);
			if (createdFile) {
				new Notice(i18n.t("irNotices.fileCreatedButJoinFailed"), 4500);
				return;
			}
			new Notice(i18n.t("irNotices.createPointFailed"), 3000);
			throw error;
		}
	}

	private getIncrementalReadingTodayStart(): Date {
		return this.getIRHostSharedService().getIncrementalReadingTodayStart();
	}

	private getIncrementalReadingDateKey(date: Date): string {
		return this.getIRHostSharedService().getIncrementalReadingDateKey(date);
	}

	private async ensureExternalDocumentChunkScheduled(
		file: TFile,
		deckId: string,
		deckName: string,
		options?: IREnsureExternalDocumentChunkScheduledOptions,
	): Promise<boolean> {
		return await this.getIRHostSharedService().ensureExternalDocumentChunkScheduled(
			file,
			deckId,
			deckName,
			options,
		);
	}
}

export type WeavePlugin = StandaloneIncrementalReadingPlugin;
