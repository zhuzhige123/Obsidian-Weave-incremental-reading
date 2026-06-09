import {
	Menu,
	MarkdownView,
	Notice,
	Plugin,
	TFile,
	WorkspaceLeaf,
	normalizePath,
} from "obsidian";
import "./styles/global.css";
import { resolveIRImportFolder } from "./config/paths";
import type { SelectionToIRSubmitPayload } from "./modals/SelectionToIRModal";
import type { WebPageToIRSubmitPayload } from "./modals/WebPageToIRModal";
import { registerExtensionsSafely } from "./utils/register-extensions-safely";
import {
	registerEpubHost,
	unregisterEpubHost,
	type EpubHostIRCapabilities,
	type EpubHostIncrementalReadingTopicOption,
	type EpubHostReaderCapabilities,
} from "./services/epub-integration/epub-host";
import {
	IRHostSharedService,
	type IREnsureExternalDocumentChunkScheduledOptions,
} from "./services/incremental-reading/IRHostSharedService";
import type { ParagraphWorkbenchOpenInput } from "./services/incremental-reading/paragraph-workbench/types";
import { IR_RUNTIME } from "./services/incremental-reading/ir-runtime";
import { revealLeaf } from "./utils/workspace-navigation";
import {
	generateUniqueVaultFilePath,
	resolveIRReadableMarkdownTargetFolder,
} from "./services/incremental-reading/IRReadableMarkdownPathResolver";
import { recomputeAndBroadcastIRData } from "./services/incremental-reading/IRScheduleRefreshService";
import { scheduleIRWorkspaceWarmup } from "./services/incremental-reading/IRWorkspaceWarmup";
import { IRPointStorageService } from "./services/incremental-reading/IRPointStorageService";
import { IRStorageService } from "./services/incremental-reading/IRStorageService";
import { createAnchorManager } from "./services/incremental-reading/AnchorManager";
import {
	createReadingMaterialManager,
	type ReadingMaterialManager,
} from "./services/incremental-reading/ReadingMaterialManager";
import {
	createReadingMaterialStorage,
	type ReadingMaterialStorage,
} from "./services/incremental-reading/ReadingMaterialStorage";
import { ReadingCategory } from "./types/incremental-reading-types";
import { replaceSelectionInMarkdownContent } from "./services/incremental-reading/SelectionQuickCreateSourceTransform";
import { PremiumFeatureGuard, PREMIUM_FEATURES } from "./services/premium/PremiumFeatureGuard";
import { registerIRPremiumFeaturePreviewHost } from "./services/premium/IRPremiumFeaturePreviewHost";
import { ensureIRPremiumFeature } from "./services/premium/ir-premium";
import type {
	EffectiveLicenseState,
	LicenseInfo,
	LicenseStore,
	LicensedProduct,
} from "./types/license";
import { DEFAULT_LICENSE_INFO, DEFAULT_LICENSE_STORE } from "./types/license";
import { getInheritedLicensesFromLegacyWeave } from "./utils/plugin-access";
import { findCollaboratorEpubHost } from "./utils/obsidian-plugin-registry";
import type { CanvasMenuNode } from "./types/canvas-menu-node";
import { readCanvasNodeData, readCanvasNodeText } from "./types/canvas-menu-node";
import {
	getLegacyPrimaryLicense,
	LICENSED_PRODUCTS,
	normalizeLicenseStore,
	resolveEffectiveLicenseState,
} from "./utils/license-state";
import { registerLicenseSyncBridge } from "./utils/license-sync-bridge";
import { IRDataManagementModalObsidian } from "./components/incremental-reading/IRDataManagementModalObsidian";
import {
	IRLegacyStorageMigrationFacade,
	type IRLegacyStorageMigrationExecutionReport,
	type IRLegacyStorageMigrationSummary,
} from "./services/incremental-reading/IRLegacyStorageMigrationFacade";
import { licenseManager } from "./utils/licenseManager";
import { safeOpenSettings } from "./utils/obsidian-api-safe";
import {
	getCanvasTextCandidatesFromText,
	resolveCanvasMenuNodeId,
} from "./services/ui/canvas-source-locate";
import {
	createDefaultChunkFileData,
	createDefaultIRDeck,
	DEFAULT_IR_BLOCK_META,
	generateChunkId,
	generateSourceId,
	type IRBlockMeta,
} from "./types/ir-types";
import type {
	IncrementalReadingSettings,
	IRCalendarSidebarSettings,
} from "./types/plugin-settings.d";
import { markServiceReady } from "./utils/service-ready-event";
import { createYAMLFrontmatterManager } from "./utils/yaml-frontmatter-utils";
import { initI18n, syncI18nWithObsidianLanguage } from "./utils/i18n";
import { logger } from "./utils/logger";
import { createContentWithMetadata } from "./utils/yaml-utils";
import { IRCalendarView, VIEW_TYPE_IR_CALENDAR } from "./views/IRCalendarView";
import { IRDeckView, VIEW_TYPE_IRDECK } from "./views/IRDeckView";
import { IRFocusView, VIEW_TYPE_IR_FOCUS } from "./views/IRFocusView";
import {
	IRParagraphWorkbenchView,
	VIEW_TYPE_IR_PARAGRAPH_WORKBENCH,
} from "./views/IRParagraphWorkbenchView";
import { StandaloneIRSettingsTab } from "./components/settings/StandaloneIRSettingsTab";
import {
	buildDefaultIncrementalReadingSettings,
	normalizeIRCalendarSidebarSettings,
	normalizeIncrementalReadingSettings,
} from "./services/incremental-reading/ir-settings";
import {
	applyIncrementalReadingFolderSubscriptionCandidates,
	scanIncrementalReadingFolderSubscriptions,
	type ExistingChunkLike,
} from "./services/incremental-reading/IRFolderSubscriptionSyncService";
import { shouldTriggerFolderSubscriptionResyncForVaultEvent } from "./services/incremental-reading/folder-subscription-event-trigger";
import { showObsidianConfirm } from "./utils/obsidian-confirm";
import { getActiveWebViewerPageContext } from "./services/obsidian/web-viewer-context";
import {
	buildWebReadingPointMarkdown,
	deriveWebPageTitleFromUrl,
} from "./services/incremental-reading/ir-web-reading-point";

type StandaloneIRSettings = {
	weaveParentFolder: string;
	incrementalReading: IncrementalReadingSettings;
	license: LicenseInfo;
	licenseState: LicenseStore;
	allowInheritedLicenses: boolean;
	showPremiumFeaturesPreview?: boolean;
	deckCardStyle?: string;
	editorModalSize?: {
		rememberLastSize?: boolean;
		enableResize?: boolean;
		width?: number;
		height?: number;
	};
	ankiConnect?: Record<string, unknown> & {
		incrementalSyncState?: unknown;
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
};

const DEFAULT_DECK_NAME = "默认专题";

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
	private irCalendarSidebarSettingsCache: IRCalendarSidebarSettings | null = null;
	private irHostSharedService: IRHostSharedService | null = null;
	private irDeckIndexRefreshTimer: number | null = null;
	private incrementalReadingFolderSubscriptionResyncTimer: number | null = null;
	private incrementalReadingFolderSubscriptionSyncPromise: Promise<number> | null = null;
	private deferredStartupPromise: Promise<void> | null = null;
	private unregisterPremiumFeaturePreviewHost: (() => void) | null = null;

	async onload(): Promise<void> {
		initI18n();
		this.registerEvent(this.app.workspace.on("layout-change", () => {
			try {
				syncI18nWithObsidianLanguage();
			} catch {
				void 0;
			}
		}));
		this.registerDomEvent(window, "focus", () => {
			try {
				syncI18nWithObsidianLanguage();
			} catch {
				void 0;
			}
		});

		await this.loadSettings();
		licenseManager.initializeCloud(this.app);
		this.dataStorage = {};
		markServiceReady("dataStorage");

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
			this.settings.showPremiumFeaturesPreview ?? false
		);
		this.unregisterPremiumFeaturePreviewHost = registerIRPremiumFeaturePreviewHost(this.app, () => {
			this.openIRPremiumSettings();
		});
		registerLicenseSyncBridge(this, this);
		this.addSettingTab(new StandaloneIRSettingsTab(this.app, this));
		this.registerWorkspaceViews();
		this.registerIRDeckVaultSync();
		this.registerIncrementalReadingFolderSubscriptionWatchers();
		this.registerCanvasNodeContextMenu();
		void import("./services/incremental-reading/register-web-viewer-pane-menu").then(
			({ registerWebViewerPaneMenuPatch }) => {
				registerWebViewerPaneMenuPatch(this, this);
			}
		);
		void import("./services/incremental-reading/register-web-viewer-context-menu").then(
			({ registerWebViewerContextMenuPatch }) => {
				registerWebViewerContextMenuPatch(this, this);
			}
		);

		this.addRibbonIcon("calendar", "打开增量阅读日历", () => {
			void this.activateIRCalendarView();
		});

		this.addCommand({
			id: "open-ir-calendar",
			name: "打开增量阅读日历",
			callback: () => {
				void this.activateIRCalendarView();
			},
		});

		this.addCommand({
			id: "open-active-irdeck",
			name: "打开当前 IRDeck",
			checkCallback: (checking) => {
				const activeFile = this.app.workspace.getActiveFile();
				const canOpen = activeFile instanceof TFile && activeFile.extension === "irdeck";
				if (!checking && canOpen) {
					void this.openIRDeckCalendar(activeFile.path);
				}
				return canOpen;
			},
		});

		this.addCommand({
			id: "create-ir-reading-point-from-selection",
			name: "从当前选区创建增量阅读点",
			callback: () => {
				void this.runSelectionToIRQuickCreate(this.getSelectionContextForIRQuickCreate());
			},
		});

		this.addCommand({
			id: "create-ir-reading-point-from-web-page",
			name: "从当前网页添加到增量阅读",
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
			name: "打开增量阅读段落工作台",
			callback: () => {
				const activeFile = this.app.workspace.getActiveFile();
				if (!(activeFile instanceof TFile)) {
					new Notice("请先打开 Markdown、Canvas 或 EPUB 文件");
					return;
				}
				const sourceType = activeFile.extension === "canvas"
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
			name: "更新订阅文件夹",
			callback: () => {
				void this.syncIncrementalReadingFolderSubscriptionFromSettings({ trigger: "manual" });
			},
		});

		// 注册完视图与命令后即可恢复 UI；重 I/O 与索引任务放到后台，避免拖慢 Obsidian 启动计时。
		markServiceReady("allCoreServices");
		scheduleIRWorkspaceWarmup(this.app);
		this.deferredStartupPromise = this.runDeferredStartupTasks();
	}

	private async ensureDeferredStartupComplete(): Promise<void> {
		await (this.deferredStartupPromise ?? this.runDeferredStartupTasks());
	}

	private async runDeferredStartupTasks(): Promise<void> {
		try {
			await this.initializeReadingMaterialServices();
			await this.ensureDefaultIRDeckExists();
			void this.refreshIRDeckIndexFromVault({ trigger: "startup", recompute: false });
			void this.syncIncrementalReadingFolderSubscriptionFromSettings({ trigger: "startup" });
		} catch (error) {
			logger.warn("[Standalone IR] 后台启动任务失败", error);
		}
	}

	onunload(): void {
		this.unregisterPremiumFeaturePreviewHost?.();
		this.unregisterPremiumFeaturePreviewHost = null;
		if (this.irDeckIndexRefreshTimer !== null) {
			window.clearTimeout(this.irDeckIndexRefreshTimer);
			this.irDeckIndexRefreshTimer = null;
		}
		if (this.incrementalReadingFolderSubscriptionResyncTimer !== null) {
			window.clearTimeout(this.incrementalReadingFolderSubscriptionResyncTimer);
			this.incrementalReadingFolderSubscriptionResyncTimer = null;
		}
		unregisterEpubHost(this.app);
	}

	private registerWorkspaceViews(): void {
		if (this.workspaceViewsRegistered) {
			return;
		}

		this.registerView(VIEW_TYPE_IR_CALENDAR, (leaf) => new IRCalendarView(leaf, this));
		this.registerView(VIEW_TYPE_IRDECK, (leaf) => new IRDeckView(leaf, this));
		this.registerView(VIEW_TYPE_IR_FOCUS, (leaf) => new IRFocusView(leaf, this));
		this.registerView(
			VIEW_TYPE_IR_PARAGRAPH_WORKBENCH,
			(leaf) => new IRParagraphWorkbenchView(leaf, this)
		);
		registerExtensionsSafely(
			this,
			this.app,
			["irdeck"],
			VIEW_TYPE_IRDECK,
			"[Standalone IR]",
			"Weave Incremental Reading "
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
			this.app as Parameters<typeof getInheritedLicensesFromLegacyWeave>[0]
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
				new CustomEvent("WeaveIncrementalReading:navigate-settings", {
					detail: { tab: "license" },
				})
			);
		}, 100);
	}

	/** Weave 宿主可通过 `app.plugins.getPlugin("weave-incremental-reading")` 调用 */
	openDataManagementModal(): void {
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
			this.settings.licenseState
		);
		this.settings.licenseState = normalizedStore;
		this.settings.license = getLegacyPrimaryLicense(normalizedStore.localLicenses);
		return (
			JSON.stringify({
				license: this.settings.license,
				licenseState: this.settings.licenseState,
			}) !== previousSnapshot
		);
	}

	async loadSettings(): Promise<void> {
		const loaded = (await this.loadData()) as Partial<StandaloneIRSettings> | null;
		this.settings = this.normalizeSettings({
			...DEFAULT_STANDALONE_IR_SETTINGS,
			...(loaded ?? {}),
		});
		const licenseSettingsChanged = this.syncLicenseSettings();
		this.irCalendarSidebarSettingsCache = this.normalizeIRCalendarSidebarSettings(
			this.settings.incrementalReading.calendarSidebar
		);
		if (licenseSettingsChanged) {
			await this.saveData(this.settings);
		}
		PremiumFeatureGuard.getInstance().setPremiumFeaturesPreview(
			this.settings.showPremiumFeaturesPreview ?? false
		);
	}

	async saveSettings(): Promise<void> {
		this.settings = this.normalizeSettings(this.settings);
		this.syncLicenseSettings();
		this.irCalendarSidebarSettingsCache = this.normalizeIRCalendarSidebarSettings(
			this.settings.incrementalReading.calendarSidebar
		);
		PremiumFeatureGuard.getInstance().setPremiumFeaturesPreview(
			this.settings.showPremiumFeaturesPreview ?? false
		);
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
		const hasStrategy = guard.canUseFeature(PREMIUM_FEATURES.SCHEDULING_STRATEGY_SETTINGS);
		const hasInterleave = guard.canUseFeature(PREMIUM_FEATURES.INTERLEAVE_LEARNING_SETTINGS);
		const hasTagGroups = guard.canUseFeature(PREMIUM_FEATURES.TAG_GROUPS);
		const hasFolderSubscription = guard.canUseFeature(PREMIUM_FEATURES.FOLDER_SUBSCRIPTION);
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
				showMaterialTimers: hasTimer ? settings.calendarSidebar?.showMaterialTimers : false,
			},
		};
	}

	async saveIncrementalReadingSettings(
		settings: IncrementalReadingSettings,
		options?: { syncFolderSubscription?: boolean }
	): Promise<IncrementalReadingSettings> {
		this.settings.incrementalReading = normalizeIncrementalReadingSettings(
			settings,
			this.settings.weaveParentFolder
		);
		await this.saveSettings();
		if (options?.syncFolderSubscription) {
			await this.syncIncrementalReadingFolderSubscriptionFromSettings({ trigger: "settings" });
		}
		return this.settings.incrementalReading;
	}

	async syncIncrementalReadingFolderSubscriptionFromSettings(options?: {
		trigger?: "startup" | "settings" | "file-change" | "manual";
	}): Promise<number> {
		const previous = this.incrementalReadingFolderSubscriptionSyncPromise ?? Promise.resolve(0);
		const current = previous
			.catch(() => 0)
			.then(async () => await this.performIncrementalReadingFolderSubscriptionSync(options));
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
	}): Promise<number> {
		await this.ensureDeferredStartupComplete();
		const trigger = options?.trigger ?? "manual";
		if (!PremiumFeatureGuard.getInstance().canUseFeature(PREMIUM_FEATURES.FOLDER_SUBSCRIPTION)) {
			if (trigger === "manual") {
				ensureIRPremiumFeature(this.app, PREMIUM_FEATURES.FOLDER_SUBSCRIPTION);
			}
			return 0;
		}
		const folderSubscription = this.getIncrementalReadingSettings().folderSubscription;
		const storage = new IRStorageService(this.app);
		await storage.initialize();

		const decks = Object.values(await storage.getAllDecks()).filter((deck) => !deck.archivedAt);
		const deckById = new Map(
			decks.map((deck) => [String(deck.id || "").trim(), deck] as const).filter(([deckId]) => Boolean(deckId))
		);
		const deckNameById = Object.fromEntries(
			decks.map((deck) => [
				String(deck.id || "").trim(),
				String(deck.name || "").trim() || String(deck.id || "").trim(),
			])
		);
		const subscriptionSettingsForScan = {
			...folderSubscription,
			rules: (folderSubscription?.rules || []).filter((rule) =>
				deckById.has(String(rule.deckId || "").trim())
			),
		};
		const chunks = Object.values(await storage.getAllChunkData());
		const materials = this.readingMaterialStorage.getAllMaterials().map((material) => ({
			uuid: material.uuid,
			filePath: material.filePath,
			readingDeckId: material.readingDeckId,
			topicId: material.topicId,
		}));
		const scanResult = await scanIncrementalReadingFolderSubscriptions({
			app: this.app,
			settings: subscriptionSettingsForScan,
			existingChunks: chunks as unknown as ExistingChunkLike[],
			existingMaterials: materials,
			deckNameById,
		});

		if (scanResult.activeRuleCount === 0) {
			if (trigger === "manual") {
				new Notice("尚未配置可用的订阅文件夹规则，或所选专题已不存在", 3000);
			}
			return 0;
		}

		if (scanResult.pendingCount > 0 && trigger !== "file-change") {
			const threshold = Number(folderSubscription?.importConfirmThreshold ?? 20);
			if (threshold > 0 && scanResult.pendingCount > threshold) {
				const pendingRules = scanResult.ruleSummaries.filter((rule) => rule.pendingCount > 0);
				const confirmed = await showObsidianConfirm(
					this.app,
					pendingRules.length <= 1
						? `检测到订阅文件夹中有 ${scanResult.pendingCount} 个待新增阅读材料，超过当前阈值 ${threshold}。\n文件夹：${pendingRules[0]?.folderPath || ""}\n专题：${pendingRules[0]?.deckName || pendingRules[0]?.deckId || ""}\n\n确认后再批量新增。`
						: `检测到 ${pendingRules.length} 条订阅规则下共有 ${scanResult.pendingCount} 个待新增阅读材料，超过当前阈值 ${threshold}。\n\n确认后再批量新增。`,
					{
						title: "确认批量新增阅读材料",
						confirmText: "确认新增",
						cancelText: "取消",
						confirmClass: "mod-warning",
					}
				);
				if (!confirmed) {
					return 0;
				}
			}
		}

		const pinToToday = folderSubscription?.initialScheduleMode !== "scheduled";
		const applyResult = await applyIncrementalReadingFolderSubscriptionCandidates({
			candidates: scanResult.candidates.map((candidate) => ({
				...candidate,
				deckName: candidate.deckName || deckNameById[String(candidate.rule.deckId || "").trim()] || "",
			})),
			pinToToday,
			getOrCreateMaterial: async (file, options) => {
				const material = await this.readingMaterialManager.ensureMaterialForFolderSubscription(file, {
					...options,
					category: ReadingCategory.Later,
				});
				return { uuid: material.uuid };
			},
			setReadingDeck: async (materialId, deckId) =>
				await this.readingMaterialManager.setReadingDeck(materialId, deckId),
			ensureChunkScheduled: async (file, deckId, deckName, scheduleOptions) =>
				await this.ensureExternalDocumentChunkScheduled(file, deckId, deckName, {
					...scheduleOptions,
					existingChunk: scheduleOptions.existingChunk,
					readingMaterialId: scheduleOptions.readingMaterialId,
				}),
		});
		const { added, updated, unchanged } = applyResult;

		const changedCount = added + updated;
		const syncedDeckIds = [
			...new Set(
				scanResult.candidates
					.map((candidate) => String(candidate.rule.deckId || "").trim())
					.filter(Boolean)
			),
		];
		if (scanResult.candidates.length > 0) {
			await recomputeAndBroadcastIRData(this.app, "import_materials", {
				deckIds: syncedDeckIds,
			});
		}

		if (trigger === "manual") {
			new Notice(
				`订阅文件夹更新完成：扫描 ${scanResult.scannedMarkdownCount} 个 Markdown 文件，新增 ${added}，更新 ${updated}，跳过 ${unchanged}`,
				4500
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
			new Notice(`订阅文件夹已自动同步：新增 ${added}`, 3500);
		}

		return changedCount;
	}

	getIRCalendarSidebarSettings(): IRCalendarSidebarSettings {
		if (!this.irCalendarSidebarSettingsCache) {
			this.irCalendarSidebarSettingsCache = this.normalizeIRCalendarSidebarSettings(
				this.settings.incrementalReading.calendarSidebar
			);
		}

		const canUseTimer = PremiumFeatureGuard.getInstance().canUseFeature(
			PREMIUM_FEATURES.READING_TIMER
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

	async saveIRCalendarSidebarSettings(settings: Partial<IRCalendarSidebarSettings>): Promise<void> {
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

	async activateIRCalendarView(options: {
		preferredLeaf?: WorkspaceLeaf;
		state?: Record<string, unknown>;
	} = {}): Promise<void> {
		const { workspace } = this.app;
		let leaf: WorkspaceLeaf | null = workspace.getLeavesOfType(VIEW_TYPE_IR_CALENDAR)[0] || null;
		if (!leaf) {
			leaf = workspace.getLeftLeaf(false) ?? workspace.getLeftLeaf(true);
		}
		if (!leaf) {
			throw new Error("ir-calendar-leaf-unavailable");
		}

		await leaf.setViewState({
			type: VIEW_TYPE_IR_CALENDAR,
			active: true,
			...(options.state ? { state: options.state } : {}),
		});
		if (options.preferredLeaf && options.preferredLeaf !== leaf) {
			options.preferredLeaf.detach();
		}

		revealLeaf(this.app, leaf);
	}

	async openParagraphReadingWorkbench(
		input: ParagraphWorkbenchOpenInput,
		options: { preferredLeaf?: WorkspaceLeaf } = {}
	): Promise<void> {
		const sourcePath = normalizePath(String(input.sourcePath || "").trim());
		if (!sourcePath) {
			throw new Error("paragraph-workbench-source-empty");
		}

		const { workspace } = this.app;
		let leaf =
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

	async openIRDeckCalendar(filePath: string, preferredLeaf?: WorkspaceLeaf): Promise<void> {
		const normalizedPath = normalizePath(String(filePath || "").trim());
		if (!normalizedPath) {
			throw new Error("irdeck-path-empty");
		}

		let focusDeckId = "";
		let focusDeckName = normalizedPath.split("/").pop()?.replace(/\.irdeck$/i, "") || "";
		try {
			const pointReadService = await import("./services/incremental-reading/IRPointDataReadService");
			const entry = await new pointReadService.IRPointDataReadService(this.app).getPointFileEntryByPath(
				normalizedPath
			);
			focusDeckId = String(entry?.topicId || "").trim();
			focusDeckName = String(entry?.topicName || "").trim() || focusDeckName;
		} catch (error) {
			logger.warn("[Standalone IR] 解析 IRDeck 失败，将回退到通用日历:", error);
		}

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
		await this.activateIRCalendarView();
		if (options?.closeLegacyFocusLeaves) {
			this.app.workspace.detachLeavesOfType(VIEW_TYPE_IR_FOCUS);
		}
	}

	async openEpubReader(filePath: string): Promise<void> {
		const host = this.getExternalEpubHost();
		if (!host?.openEpubReader) {
			new Notice("未找到可协作的 EPUB 阅读器插件", 3000);
			return;
		}
		await host.openEpubReader(filePath);
	}

	async getAvailableEpubIncrementalReadingTopics(): Promise<EpubHostIncrementalReadingTopicOption[]> {
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
			this.pickIRDeck.bind(this)
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
			this.resolveIRDeckById.bind(this)
		);
	}

	async openIRReadingPointFromExternalSelection(options: {
		filePath: string;
		selectedText: string;
		sourceLink?: string;
		successNotice?: string;
		initialTitle?: string;
	}): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(String(options.filePath || "").trim());
		if (!(file instanceof TFile)) {
			new Notice("未找到对应的源文件，无法创建阅读点", 3000);
			return;
		}

		const selectedText = String(options.selectedText || "").trim();
		if (!selectedText) {
			new Notice("请先选中文本后再创建阅读点", 3000);
			return;
		}

		await this.runSelectionToIRQuickCreate({
			file,
			editor: null,
			selectedText,
			selectionRange: null,
			sourceLink: String(options.sourceLink || "").trim() || undefined,
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
		return resolveIRImportFolder(String(folderPath || "").trim(), this.settings.weaveParentFolder);
	}

	private getIRHostSharedService(): IRHostSharedService {
		if (!this.irHostSharedService) {
			this.irHostSharedService = new IRHostSharedService(this.app);
		}
		return this.irHostSharedService;
	}

	private normalizeSettings(
		input: Partial<StandaloneIRSettings> | StandaloneIRSettings
	): StandaloneIRSettings {
		const weaveParentFolder = String(input.weaveParentFolder || "").trim();
		const showPremiumFeaturesPreview = input.showPremiumFeaturesPreview === true;
		const licenseState = normalizeLicenseStore(input.license, input.licenseState);
		return {
			weaveParentFolder,
			incrementalReading: normalizeIncrementalReadingSettings(
				input.incrementalReading ?? DEFAULT_INCREMENTAL_READING_SETTINGS,
				weaveParentFolder
			),
			license: getLegacyPrimaryLicense(licenseState.localLicenses),
			licenseState,
			allowInheritedLicenses: input.allowInheritedLicenses !== false,
			showPremiumFeaturesPreview,
			deckCardStyle: input.deckCardStyle,
			editorModalSize: input.editorModalSize,
		};
	}

	private normalizeIRCalendarSidebarSettings(
		settings?: Partial<IRCalendarSidebarSettings> | null
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
		this.readingMaterialManager = createReadingMaterialManager(this.app, storage, yamlManager);
		this.readingMaterialManager.setAnchorManager(createAnchorManager(this.app, storage, yamlManager));
		markServiceReady("readingMaterialManager");
	}

	private async ensureDefaultIRDeckExists(): Promise<void> {
		const pointStorage = new IRPointStorageService(this.app);
		if (await pointStorage.hasAnyVaultPointDeck()) {
			return;
		}

		const storage = new IRStorageService(this.app);
		await storage.initialize();
		const deck = createDefaultIRDeck(DEFAULT_DECK_NAME);
		deck.path = deck.id;
		await storage.saveDeck(deck);
		logger.info("[Standalone IR] 已创建默认专题", { deckId: deck.id, name: deck.name });
	}

	private registerCanvasNodeContextMenu(): void {
		this.registerEvent(
			this.app.workspace.on("canvas:node-menu", (menu: Menu, node: CanvasMenuNode) => {
				try {
					if (!this.shouldShowPremiumEntry(PREMIUM_FEATURES.INCREMENTAL_READING)) {
						return;
					}

					const nodeContent = readCanvasNodeText(node);
					if (!nodeContent) {
						return;
					}

					menu.addItem((item) => {
						item.setTitle("添加到增量阅读专题");
						item.setIcon("book-plus");
						const submenu = item.setSubmenu();
						void this.buildCanvasIRDeckSubmenu(submenu, node);
					});
				} catch (error) {
					logger.error("[Standalone IR] 注册 Canvas 节点菜单失败:", error);
				}
			})
		);
	}

	private registerIncrementalReadingFolderSubscriptionWatchers(): void {
		const handleFileChange = (
			file: TFile,
			eventType: "create" | "rename",
			legacyPath?: string
		) => {
			void this.handleIncrementalReadingFolderSubscriptionFileChange(file, eventType, legacyPath);
		};

		this.registerEvent(
			this.app.vault.on("create", (file) => {
				if (file instanceof TFile) {
					handleFileChange(file, "create");
				}
			})
		);
		this.registerEvent(
			this.app.vault.on("rename", (file, oldPath) => {
				if (file instanceof TFile) {
					handleFileChange(file, "rename", oldPath);
				}
			})
		);
	}

	private async handleIncrementalReadingFolderSubscriptionFileChange(
		file: TFile,
		eventType: "create" | "rename",
		legacyPath?: string
	): Promise<void> {
		try {
			const folderSubscription = this.getIncrementalReadingSettings().folderSubscription;
			if (file.extension !== "md") {
				return;
			}
			const shouldResync = shouldTriggerFolderSubscriptionResyncForVaultEvent({
				eventType,
				nextPath: file.path,
				previousPath: legacyPath,
				settingsOrRules: folderSubscription,
			});
			if (!shouldResync) {
				return;
			}
			this.scheduleIncrementalReadingFolderSubscriptionResync();
		} catch (error) {
			logger.warn("[Standalone IR] 订阅文件夹变更处理失败:", error);
		}
	}

	private scheduleIncrementalReadingFolderSubscriptionResync(): void {
		if (this.incrementalReadingFolderSubscriptionResyncTimer !== null) {
			window.clearTimeout(this.incrementalReadingFolderSubscriptionResyncTimer);
		}
		this.incrementalReadingFolderSubscriptionResyncTimer = window.setTimeout(() => {
			this.incrementalReadingFolderSubscriptionResyncTimer = null;
			void this.syncIncrementalReadingFolderSubscriptionFromSettings({ trigger: "file-change" });
		}, 300);
	}

	private registerIRDeckVaultSync(): void {
		const scheduleRefreshForPathChange = (nextPath?: string | null, previousPath?: string | null) => {
			if (!this.isIRDeckPath(nextPath) && !this.isIRDeckPath(previousPath)) {
				return;
			}
			this.scheduleIRDeckIndexRefresh();
		};

		this.registerEvent(this.app.vault.on("create", (file) => scheduleRefreshForPathChange(file?.path)));
		this.registerEvent(this.app.vault.on("modify", (file) => scheduleRefreshForPathChange(file?.path)));
		this.registerEvent(this.app.vault.on("delete", (file) => scheduleRefreshForPathChange(file?.path)));
		this.registerEvent(
			this.app.vault.on("rename", (file, oldPath) =>
				scheduleRefreshForPathChange(file?.path, oldPath)
			)
		);
	}

	private isIRDeckPath(path?: string | null): boolean {
		return String(path || "")
			.trim()
			.toLowerCase()
			.endsWith(".irdeck");
	}

	private scheduleIRDeckIndexRefresh(): void {
		if (this.irDeckIndexRefreshTimer !== null) {
			window.clearTimeout(this.irDeckIndexRefreshTimer);
		}

		this.irDeckIndexRefreshTimer = window.setTimeout(() => {
			this.irDeckIndexRefreshTimer = null;
			void this.refreshIRDeckIndexFromVault({ trigger: "vault_change", recompute: true });
		}, 250);
	}

	private async refreshIRDeckIndexFromVault(options: {
		trigger: "startup" | "vault_change";
		recompute: boolean;
	}): Promise<void> {
		try {
			const pointStorage = new IRPointStorageService(this.app);
			const result = await pointStorage.refreshPointFilesIndexFromVault();
			const hasIndexChanges = result.added > 0 || result.updated > 0 || result.removed > 0;

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

			if (!options.recompute || !hasIndexChanges) {
				return;
			}

			await recomputeAndBroadcastIRData(this.app, "ui_refresh");
		} catch (error) {
			logger.warn("[Standalone IR] 同步库内 .irdeck 专题索引失败", error);
		}
	}

	private getExternalEpubHost(): EpubHostReaderCapabilities | null {
		return findCollaboratorEpubHost(this.app, IR_RUNTIME.collaboratorHostPluginIds, this);
	}

	private async resolveIRDeckById(deckId: string): Promise<{ id: string; name: string } | null> {
		return await this.getIRHostSharedService().resolveIRDeckById(deckId);
	}

	shouldShowPremiumEntry(featureId: string): boolean {
		return PremiumFeatureGuard.getInstance().shouldShowFeatureEntry(featureId);
	}

	ensurePremiumFeatureAccess(featureId: string, _blockedMessage: string): boolean {
		return ensureIRPremiumFeature(this.app, featureId);
	}

	private async getIRDeckIdentifiers(deck: { id: string; path?: string }): Promise<string[]> {
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
		const canvasPath = (canvasLeaf?.view as { file?: { path?: string } } | undefined)?.file?.path;
		return typeof canvasPath === "string" && canvasPath.toLowerCase().endsWith(".canvas")
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
		canvasFile: TFile;
		nodeId: string;
		selectedText: string;
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
				nodeData.file.split("/").pop()?.replace(/\.[^.]+$/u, "") || String(nodeData.file || "");
			initialTitle = this.cleanIRReadingPointTitle(basename);
		}
		if (!initialTitle) {
			initialTitle = this.deriveIRReadingPointDraftFromSelection(selectedText).title;
		}

		return {
			canvasFile,
			nodeId,
			selectedText,
			sourceLink,
			initialTitle,
			textCandidates: getCanvasTextCandidatesFromText(selectedText),
		};
	}

	private buildCanvasIRSourceId(canvasPath: string): string {
		const normalizedPath = normalizePath(String(canvasPath || "").trim()).toLowerCase();
		const readableName =
			normalizedPath
				.split("/")
				.pop()
				?.replace(/\.canvas$/i, "")
				.replace(/[^a-z0-9]+/gi, "-")
				.replace(/^-+|-+$/g, "")
				.toLowerCase() || "canvas";
		let hash = 0;
		for (let index = 0; index < normalizedPath.length; index += 1) {
			hash = (hash * 31 + normalizedPath.charCodeAt(index)) | 0;
		}
		return `canvas-src-${readableName}-${Math.abs(hash).toString(36)}`;
	}

	private buildCanvasReadingPointScheduleMeta(
		context: {
			pointTitle: string;
			resumeLink: string;
			canvasNodeId: string;
			canvasTextCandidates: string[];
		},
		existingMeta?: IRBlockMeta
	): IRBlockMeta {
		const todayStart = this.getIncrementalReadingTodayStart();
		const todayDateKey = this.getIncrementalReadingDateKey(todayStart);
		const baseMeta = existingMeta ?? DEFAULT_IR_BLOCK_META;

		return {
			...baseMeta,
			priorityLog: baseMeta.priorityLog ?? DEFAULT_IR_BLOCK_META.priorityLog,
			siblings: baseMeta.siblings ?? DEFAULT_IR_BLOCK_META.siblings,
			tagGroup: baseMeta.tagGroup ?? DEFAULT_IR_BLOCK_META.tagGroup,
			externalDocument: true,
			pointTitle: context.pointTitle,
			resumeLink: context.resumeLink,
			canvasNodeId: context.canvasNodeId,
			canvasTextCandidates: context.canvasTextCandidates,
			sourceSequenceLocked: true,
			sourceSequenceAnchorDateKey: todayDateKey,
		};
	}

	private async ensureCanvasNodeReadingPointScheduled(
		context: {
			canvasFile: TFile;
			nodeId: string;
			selectedText: string;
			sourceLink: string;
			initialTitle: string;
			textCandidates: string[];
		},
		deckId: string,
		deckName: string
	): Promise<"created" | "updated" | "unchanged"> {
		const storage = new IRStorageService(this.app);
		await storage.initialize();
		const chunks = await storage.getAllChunkData();
		const normalizedCanvasPath = normalizePath(context.canvasFile.path);
		const todayStart = this.getIncrementalReadingTodayStart();
		const todayStartMs = todayStart.getTime();
		const now = Date.now();
		const existing = Object.values(chunks).find((chunk) => {
			const chunkPath = normalizePath(chunk.filePath.trim());
			const chunkNodeId = String(chunk.meta?.canvasNodeId || "").trim();
			return chunkPath === normalizedCanvasPath && chunkNodeId === context.nodeId;
		});

		if (existing) {
			const existingMeta = { ...(existing.meta || {}) };
			const existingDeckIds = Array.isArray(existing.deckIds) ? existing.deckIds : [];
			const existingTopicIds = Array.isArray(existing.topicIds) ? existing.topicIds : [];
			const existingStatus = String(existing.scheduleStatus || "").trim();
			const shouldResetDueAt =
				existingStatus === "removed" ||
				existingStatus === "done" ||
				existingStatus === "suspended" ||
				!existingStatus ||
				!Number(existing.nextRepDate || 0);
			let changed = false;

			if (existingDeckIds.length !== 1 || existingDeckIds[0] !== deckId) {
				existing.deckIds = [deckId];
				changed = true;
			}
			if (existingTopicIds.length !== 1 || existingTopicIds[0] !== deckId) {
				existing.topicIds = [deckId];
				changed = true;
			}
			if (existing.topicTag !== `#IR_deck_${deckName}`) {
				existing.topicTag = `#IR_deck_${deckName}`;
				changed = true;
			}
			if (existing.deckTag !== `#IR_deck_${deckName}`) {
				existing.deckTag = `#IR_deck_${deckName}`;
				changed = true;
			}
			if (shouldResetDueAt && existing.nextRepDate !== todayStartMs) {
				existing.nextRepDate = todayStartMs;
				changed = true;
			}
			if (!existing.intervalDays) {
				existing.intervalDays = 1;
				changed = true;
			}
			if (shouldResetDueAt && existing.scheduleStatus !== "new") {
				existing.scheduleStatus = "new";
				changed = true;
			}
			const nextMeta = this.buildCanvasReadingPointScheduleMeta(
				{
					pointTitle: context.initialTitle,
					resumeLink: context.sourceLink,
					canvasNodeId: context.nodeId,
					canvasTextCandidates: context.textCandidates,
				},
				existingMeta
			);
			if (JSON.stringify(existingMeta) !== JSON.stringify(nextMeta)) {
				changed = true;
			}
			if (!changed) {
				return "unchanged";
			}

			existing.updatedAt = now;
			existing.meta = nextMeta;
			await storage.saveChunkData(existing);
			return "updated";
		}

		const chunkId = generateChunkId();
		const sourceId = this.buildCanvasIRSourceId(context.canvasFile.path) || generateSourceId();
		const chunk = createDefaultChunkFileData(chunkId, sourceId, context.canvasFile.path);
		chunk.topicIds = [deckId];
		chunk.deckIds = [deckId];
		chunk.topicTag = `#IR_deck_${deckName}`;
		chunk.deckTag = `#IR_deck_${deckName}`;
		chunk.updatedAt = now;
		chunk.nextRepDate = todayStartMs;
		chunk.meta = this.buildCanvasReadingPointScheduleMeta({
			pointTitle: context.initialTitle,
			resumeLink: context.sourceLink,
			canvasNodeId: context.nodeId,
			canvasTextCandidates: context.textCandidates,
		});
		await storage.saveChunkData(chunk);
		return "created";
	}

	private async buildCanvasIRDeckSubmenu(submenu: Menu, node: CanvasMenuNode): Promise<void> {
		try {
			const context = this.buildCanvasNodeIRPointContext(node);
			if (!context) {
				submenu.addItem((subItem) => {
					subItem.setTitle("当前节点暂无可用内容").setDisabled(true);
				});
				return;
			}

			const storage = new IRStorageService(this.app);
			await storage.initialize();
			const decks = Object.values(await storage.getAllDecks())
				.filter((deck) => !deck.archivedAt)
				.sort((a, b) => a.name.localeCompare(b.name));

			if (decks.length === 0) {
				submenu.addItem((subItem) => {
					subItem.setTitle("暂无可用增量阅读专题").setDisabled(true);
				});
				return;
			}

			for (const deck of decks) {
				submenu.addItem((subItem) => {
					subItem.setTitle(deck.name).onClick(async () => {
						await this.addCanvasNodeAsIRReadingPoint(context, deck.id, deck.name);
					});
				});
			}
		} catch (error) {
			logger.error("[Standalone IR] 加载 Canvas 增量阅读专题列表失败:", error);
			submenu.addItem((subItem) => {
				subItem.setTitle("加载增量阅读专题失败").setDisabled(true);
			});
		}
	}

	private async addCanvasNodeAsIRReadingPoint(
		context: {
			canvasFile: TFile;
			nodeId: string;
			selectedText: string;
			sourceLink: string;
			initialTitle: string;
			textCandidates: string[];
		},
		deckId: string,
		deckName: string
	): Promise<void> {
		if (
			!this.ensurePremiumFeatureAccess(
				PREMIUM_FEATURES.INCREMENTAL_READING,
				"增量阅读是高级功能，请激活许可证后使用"
			)
		) {
			return;
		}

		try {
			const result = await this.ensureCanvasNodeReadingPointScheduled(context, deckId, deckName);
			const [{ getSharedIRWorkspaceSnapshotService }, { getSharedIRCalendarQueryService }] =
				await Promise.all([
					import("./services/incremental-reading/IRWorkspaceSnapshotService"),
					import("./services/incremental-reading/IRCalendarQueryService"),
				]);
			getSharedIRWorkspaceSnapshotService(this.app).invalidate();
			getSharedIRCalendarQueryService(this.app).invalidate();
			await recomputeAndBroadcastIRData(this.app, "ui_refresh", {
				deckIds: [deckId],
			});
			new Notice(
				result === "created"
					? `已添加到 Weave 增量阅读专题「${deckName}」`
					: result === "updated"
						? `已更新到 Weave 增量阅读专题「${deckName}」`
						: `该节点已存在于 Weave 增量阅读专题「${deckName}」`
			);
		} catch (error) {
			logger.error("[Standalone IR] 添加 Canvas 节点到增量阅读失败:", error);
			new Notice("添加到 Weave 增量阅读失败", 3000);
		}
	}

	async runWebSelectionToIRQuickCreate(context: {
		url: string;
		title: string;
		selectedText: string;
	}): Promise<void> {
		const url = String(context?.url || "").trim();
		const selectedText = String(context?.selectedText || "").replace(/\r\n?/g, "\n").trim();
		if (!url) {
			new Notice("未获取到当前网页链接", 3000);
			return;
		}
		if (!selectedText) {
			new Notice("请先选中网页文本后再添加", 3000);
			return;
		}

		if (
			!this.ensurePremiumFeatureAccess(
				PREMIUM_FEATURES.INCREMENTAL_READING,
				"增量阅读"
			)
		) {
			return;
		}

		try {
			const draft = this.deriveIRReadingPointDraftFromSelection(selectedText);
			const storage = new IRStorageService(this.app);
			await storage.initialize();
			const deckOptions = Object.values(await storage.getAllDecks())
				.filter((deck) => !deck.archivedAt)
				.sort((left, right) => left.name.localeCompare(right.name))
				.map((deck) => ({ id: deck.id, name: deck.name }));
			if (deckOptions.length === 0) {
				new Notice("暂无可用增量阅读专题", 3000);
				return;
			}

			const { WebPageToIRModal } = await import("./modals/WebPageToIRModal");
			new WebPageToIRModal(this.app, {
				url,
				deckOptions,
				initialTitle: draft.title,
				titleDetected: draft.titleDetected,
				selectedText,
				onSubmit: async (payload) => {
					await this.createIRReadingPointFromWebPage(url, payload, { selectedText });
				},
			}).open();
		} catch (error) {
			logger.error("[Standalone IR] 打开网页选区阅读点创建窗口失败:", error);
			new Notice("打开添加窗口失败，请重试", 3000);
		}
	}

	async runWebPageToIRQuickCreate(context: { url: string; title: string }): Promise<void> {
		const url = String(context?.url || "").trim();
		if (!url) {
			new Notice("未获取到当前网页链接", 3000);
			return;
		}

		if (
			!this.ensurePremiumFeatureAccess(
				PREMIUM_FEATURES.INCREMENTAL_READING,
				"增量阅读"
			)
		) {
			return;
		}

		try {
			const preferredTitle = this.cleanIRReadingPointTitle(String(context.title || ""));
			const draftTitle =
				preferredTitle || deriveWebPageTitleFromUrl(url) || "网页阅读点";
			const storage = new IRStorageService(this.app);
			await storage.initialize();
			const deckOptions = Object.values(await storage.getAllDecks())
				.filter((deck) => !deck.archivedAt)
				.sort((left, right) => left.name.localeCompare(right.name))
				.map((deck) => ({ id: deck.id, name: deck.name }));
			if (deckOptions.length === 0) {
				new Notice("暂无可用增量阅读专题", 3000);
				return;
			}

			const { WebPageToIRModal } = await import("./modals/WebPageToIRModal");
			new WebPageToIRModal(this.app, {
				url,
				deckOptions,
				initialTitle: draftTitle,
				titleDetected: Boolean(preferredTitle),
				onSubmit: async (payload) => {
					await this.createIRReadingPointFromWebPage(url, payload);
				},
			}).open();
		} catch (error) {
			logger.error("[Standalone IR] 打开网页阅读点创建窗口失败:", error);
			new Notice("打开添加窗口失败，请重试", 3000);
		}
	}

	private async runSelectionToIRQuickCreate(context: IRQuickCreateContext | null): Promise<void> {
		if (!context) {
			new Notice("请先在 Markdown 文档中选中文本，或将光标放在有内容的行", 3000);
			return;
		}

		try {
			const preferredTitle = this.cleanIRReadingPointTitle(String(context.initialTitle || ""));
			const draft = preferredTitle
				? { title: preferredTitle, titleDetected: true }
				: this.deriveIRReadingPointDraftFromSelection(context.selectedText);
			const folderConfig = this.getSelectionQuickCreateFolderConfig(context.file.path);
			const storage = new IRStorageService(this.app);
			await storage.initialize();
			const deckOptions = Object.values(await storage.getAllDecks())
				.filter((deck) => !deck.archivedAt)
				.sort((left, right) => left.name.localeCompare(right.name))
				.map((deck) => ({ id: deck.id, name: deck.name }));
			if (deckOptions.length === 0) {
				new Notice("暂无可用增量阅读专题", 3000);
				return;
			}
			const preferredDeck = await this.resolvePreferredIRDeckForSelectionSource(context.file);

			const { SelectionToIRModal } = await import("./modals/SelectionToIRModal");
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
			new Notice("打开阅读点创建窗口失败，请重试", 3000);
		}
	}

	private cleanIRReadingPointTitle(rawTitle: string): string {
		return this.getIRHostSharedService().cleanIRReadingPointTitle(rawTitle);
	}

	private deriveIRReadingPointDraftFromSelection(selectedText: string): {
		title: string;
		titleDetected: boolean;
	} {
		return this.getIRHostSharedService().deriveIRReadingPointDraftFromSelection(selectedText);
	}

	private getSelectionQuickCreateFolderConfig(contextPath?: string): { initialFolder: string } {
		return this.getIRHostSharedService().getSelectionQuickCreateFolderConfig(
			this.getIncrementalReadingSettings(),
			contextPath
		);
	}

	private async saveSelectionQuickCreatePreferences(update: {
		folderPath?: string;
	}): Promise<void> {
		this.settings.incrementalReading = {
			...this.settings.incrementalReading,
			...this.getIRHostSharedService().getUpdatedSelectionQuickCreatePreferences(
				this.settings.incrementalReading,
				update
			),
		};
		await this.saveSettings();
	}

	private buildIRReadingPointContent(title: string, body: string, options?: { sourceLink?: string }): string {
		const safeTitle = this.cleanIRReadingPointTitle(title) || "未命名阅读点";
		const normalizedBody = String(body || "").replace(/\r\n?/g, "\n").trim();
		const markdownBody = normalizedBody ? `# ${safeTitle}\n\n${normalizedBody}\n` : `# ${safeTitle}\n`;
		const sourceLink = String(options?.sourceLink || "").trim();
		return sourceLink ? createContentWithMetadata({ we_source: sourceLink }, markdownBody) : markdownBody;
	}

	private async ensureSelectionQuickCreateFolderExists(folderPath: string): Promise<void> {
		const normalizedFolder = this.normalizeSelectionQuickCreateFolderPath(folderPath) || "/";
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
		const truncated = cleaned.length > 120 ? cleaned.slice(0, 120).trim() : cleaned;
		return truncated || `阅读点-${Date.now()}`;
	}

	private async generateUniqueIRReadingPointPath(folderPath: string, title: string): Promise<string> {
		const normalizedFolder = this.normalizeSelectionQuickCreateFolderPath(folderPath) || "/";
		const baseName = this.sanitizeIRReadingPointFileName(title);
		return await generateUniqueVaultFilePath(this.app, normalizedFolder, `${baseName}.md`);
	}

	private async resolvePreferredIRDeckForSelectionSource(
		file: TFile
	): Promise<{ id: string; name: string } | null> {
		const frontmatter =
			(this.app.metadataCache.getFileCache(file)?.frontmatter as Record<string, unknown> | undefined) ?? {};
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
		editor: MarkdownView["editor"] | null
	): Promise<boolean> {
		if (!selectionRange) {
			return false;
		}

		const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (editor && activeView?.editor === editor && activeView.file?.path === file.path) {
			editor.replaceRange(link, selectionRange.from, selectionRange.to);
			return true;
		}

		const currentContent = await this.app.vault.cachedRead(file);
		const updatedContent = replaceSelectionInMarkdownContent(currentContent, selectionRange, link);
		if (updatedContent !== currentContent) {
			await this.app.vault.modify(file, updatedContent);
		}
		return true;
	}

	private async createIRReadingPointFromWebPage(
		url: string,
		payload: WebPageToIRSubmitPayload,
		options?: { selectedText?: string }
	): Promise<void> {
		const normalizedUrl = String(url || "").trim();
		const selectedText = String(options?.selectedText || "").replace(/\r\n?/g, "\n").trim();
		const title = this.cleanIRReadingPointTitle(payload.title);
		if (!title) {
			new Notice("请输入阅读点名称", 3000);
			throw new Error("web-ir-missing-title");
		}

		const deckId = String(payload.deckId || "").trim();
		if (!deckId) {
			new Notice("请选择增量阅读专题", 3000);
			throw new Error("web-ir-missing-deck");
		}

		const storage = new IRStorageService(this.app);
		await storage.initialize();
		const rawDeck = await storage.getDeckById(deckId);
		if (!rawDeck || rawDeck.archivedAt) {
			new Notice("所选专题不存在或已归档", 3000);
			throw new Error("web-ir-deck-missing");
		}

		const deck = {
			id: deckId,
			name: String(rawDeck.name || "").trim() || "增量阅读",
		};
		const folderPath =
			this.normalizeSelectionQuickCreateFolderPath(
				resolveIRReadableMarkdownTargetFolder(this.app, {
					lastSelectedFolder: this.getIncrementalReadingSettings().selectionQuickCreateLastFolder,
					allowActiveFileFallback: false,
				})
			) || "/";
		const fileContent = buildWebReadingPointMarkdown(title, normalizedUrl, { selectedText });
		let createdFile: TFile | null = null;

		try {
			await this.ensureSelectionQuickCreateFolderExists(folderPath);
			const targetPath = await this.generateUniqueIRReadingPointPath(folderPath, title);
			createdFile = await this.app.vault.create(targetPath, fileContent);

			await this.ensureExternalDocumentChunkScheduled(createdFile, deck.id, deck.name, {
				pinToToday: true,
				resumeLink: normalizedUrl,
				webUrl: normalizedUrl,
				webSelectionExcerpt: selectedText || undefined,
			});

			await recomputeAndBroadcastIRData(this.app, "import_materials", {
				deckIds: [deck.id],
			});

			new Notice(`已添加到增量阅读专题「${deck.name}」`, 3500);
		} catch (error) {
			logger.error("[Standalone IR] 从网页创建阅读点失败:", error);
			if (createdFile) {
				new Notice("阅读点文件已创建，但加入增量阅读失败，请检查控制台日志", 4500);
				return;
			}
			new Notice("添加失败，请重试", 3000);
			throw error;
		}
	}

	private async createIRReadingPointFromSelection(
		context: IRQuickCreateContext,
		payload: SelectionToIRSubmitPayload
	): Promise<void> {
		const title = this.cleanIRReadingPointTitle(payload.title);
		if (!title) {
			new Notice("请输入阅读点标题", 3000);
			throw new Error("selection-ir-missing-title");
		}

		const deckId = String(payload.deckId || "").trim();
		if (!deckId) {
			new Notice("请选择增量阅读专题", 3000);
			throw new Error("selection-ir-missing-deck");
		}

		const storage = new IRStorageService(this.app);
		await storage.initialize();
		const rawDeck = await storage.getDeckById(deckId);
		if (!rawDeck || rawDeck.archivedAt) {
			new Notice("所选专题不存在或已归档", 3000);
			throw new Error("selection-ir-deck-missing");
		}

		const deck = {
			id: deckId,
			name: String(rawDeck.name || "").trim() || "增量阅读",
		};
		const folderPath =
			this.normalizeSelectionQuickCreateFolderPath(
				payload.folderPath ||
					resolveIRReadableMarkdownTargetFolder(this.app, {
						lastSelectedFolder: this.getIncrementalReadingSettings().selectionQuickCreateLastFolder,
						contextPath: context.file.path,
						allowActiveFileFallback: true,
					})
			) || "/";
		const body = String(context.selectedText || "").replace(/\r\n?/g, "\n").trim();
		const fileContent = this.buildIRReadingPointContent(title, body, {
			sourceLink: context.sourceLink,
		});
		let createdFile: TFile | null = null;

		try {
			await this.ensureSelectionQuickCreateFolderExists(folderPath);
			const targetPath = await this.generateUniqueIRReadingPointPath(folderPath, title);
			createdFile = await this.app.vault.create(targetPath, fileContent);

			await this.ensureExternalDocumentChunkScheduled(createdFile, deck.id, deck.name);

			const shouldReplaceSourceSelection = context.replaceSourceSelection !== false;
			const createdLink = `[[${this.getIRReadingPointWikiLinkTarget(createdFile)}]]`;
			const sourceUpdated = shouldReplaceSourceSelection
				? await this.updateSourceDocumentAfterIRQuickCreate(
						context.file,
						createdLink,
						context.selectionRange,
						context.editor
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
					sourceUpdated ? "阅读点已创建，并已替换源文档选区" : "阅读点已创建，但未能自动替换源文档选区",
					3500
				);
			} else {
				new Notice("阅读点已创建", 2500);
			}
		} catch (error) {
			logger.error("[Standalone IR] 创建阅读点失败:", error);
			if (createdFile) {
				new Notice("阅读点文件已创建，但加入增量阅读失败，请检查控制台日志", 4500);
				return;
			}
			new Notice("创建阅读点失败，请重试", 3000);
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
		options?: IREnsureExternalDocumentChunkScheduledOptions
	): Promise<boolean> {
		return await this.getIRHostSharedService().ensureExternalDocumentChunkScheduled(
			file,
			deckId,
			deckName,
			options
		);
	}
}

export type WeavePlugin = StandaloneIncrementalReadingPlugin;
