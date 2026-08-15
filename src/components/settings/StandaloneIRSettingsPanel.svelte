<script lang="ts">
  import { onMount, untrack } from "svelte";
  import { Menu } from "obsidian";
  import TabNavigation from "../ui/TabNavigation.svelte";
  import type { IncrementalReadingSettingsHost } from "./types/incremental-reading-settings-host";
  import IncrementalReadingSettingsSection from "./sections/IncrementalReadingSettingsSection.svelte";
  import StandaloneIRLicenseSettingsPanel from "./StandaloneIRLicenseSettingsPanel.svelte";
  import FolderSearchInput from "../ui/FolderSearchInput.svelte";
  import ObsidianSettingToggle from "./components/ObsidianSettingToggle.svelte";
  import ObsidianSettingDropdown from "./components/ObsidianSettingDropdown.svelte";
  import {
    PremiumFeatureGuard,
    PREMIUM_FEATURES,
  } from "../../services/premium/PremiumFeatureGuard";
  import { openObsidianWebUrl } from "../../services/obsidian/obsidian-open-web-url";
  import {
    applyPluginUiLanguagePreference,
    LANGUAGE_OPTION_LABEL_KEYS,
    PLUGIN_UI_LANGUAGE_OPTIONS,
    tr,
    type PluginUiLanguagePreference,
  } from "../../utils/i18n";
  import {
    STANDALONE_IR_SETTINGS_NAVIGATE_EVENT,
    resolveStandaloneIRSettingsTabId,
    type StandaloneIRSettingsTabId,
  } from "./standalone-ir-settings-search";

  const QQ_PUBLIC_GROUP_URL = "https://qm.qq.com/q/9uyMPAFLXO";
  const OTHER_GROUPS_DOCS_URL =
    "https://iwi05cktlph.feishu.cn/wiki/GJiZwgcU8icgF9k8p3pcVAjcngg";
  const WEAVE_WEBSITE_URL =
    "https://zhuzhige123.github.io/obsidian-weave-website/#pricing";

  interface Props {
    plugin: IncrementalReadingSettingsHost;
    initialTab?: StandaloneIRSettingsTabId;
  }

  let { plugin, initialTab }: Props = $props();
  let t = $derived($tr);
  let activeTab = $state<StandaloneIRSettingsTabId>(
    untrack(() => initialTab ?? "basic"),
  );
  let stateVersion = $state(0);
  let lastFolderDraft = $state("");
  let weaveParentFolderDraft = $state("");
  let showPremiumFeaturesPreviewDraft = $state(false);
  let uiLanguageDraft = $state<PluginUiLanguagePreference>("auto");

  function languageOptionLabel(option: PluginUiLanguagePreference): string {
    return t(LANGUAGE_OPTION_LABEL_KEYS[option]);
  }

  let languageOptions = $derived(
    PLUGIN_UI_LANGUAGE_OPTIONS.map((option) => ({
      id: option,
      label: languageOptionLabel(option),
    })),
  );

  function shouldShowPremiumFeatureEntry(featureId: string): boolean {
    return PremiumFeatureGuard.getInstance().shouldShowFeatureEntry(featureId, {
      showPremiumPreview: showPremiumFeaturesPreviewDraft,
    });
  }

  let tabs = $derived.by(() => {
    stateVersion;
    const baseTabs: Array<{ id: StandaloneIRSettingsTabId; label: string; icon: string }> = [
      { id: "basic", label: t("irSettings.standalone.tabs.basic"), icon: "" },
      { id: "core-scheduling", label: t("irSettings.standalone.tabs.coreScheduling"), icon: "" },
    ];

    const shouldShowAdvancedTab =
      shouldShowPremiumFeatureEntry(PREMIUM_FEATURES.SCHEDULING_STRATEGY_SETTINGS)
      || shouldShowPremiumFeatureEntry(PREMIUM_FEATURES.INTERLEAVE_LEARNING_SETTINGS)
      || shouldShowPremiumFeatureEntry(PREMIUM_FEATURES.TAG_GROUPS);
    if (shouldShowAdvancedTab) {
      baseTabs.push({ id: "advanced", label: t("irSettings.standalone.tabs.advanced"), icon: "" });
    }

    baseTabs.push(
      { id: "license", label: t("irSettings.standalone.tabs.license"), icon: "" },
      { id: "about", label: t("irSettings.standalone.tabs.about"), icon: "" }
    );
    return baseTabs;
  });

  let pluginVersion = $derived.by(() => plugin.manifest?.version || "-");
  let pluginDisplayName = $derived.by(() => plugin.manifest?.name ?? "Weave Incremental Reading");
  let pluginDisplayVersion = $derived.by(() =>
    pluginVersion === "-" ? pluginVersion : `v${pluginVersion}`,
  );
  let supportedFormats = $derived([
    t("irSettings.standalone.supportedFormats.markdown"),
    t("irSettings.standalone.supportedFormats.pdfBookmark"),
    t("irSettings.standalone.supportedFormats.epubSource"),
    t("irSettings.standalone.supportedFormats.canvas"),
  ]);
  let aboutOverviewItems = $derived.by(() => [
    {
      label: t("irSettings.standalone.about.supportedFormats"),
      value: supportedFormats.join(" / "),
    },
    {
      label: t("irSettings.standalone.about.overview"),
      value: t("irSettings.standalone.about.overviewValue"),
    },
  ]);
  type ContactLinkItem = {
    kind: "link";
    label: string;
    href: string;
  };
  type ContactMenuItem = {
    kind: "menu";
    label: string;
  };
  type ContactItem = ContactLinkItem | ContactMenuItem;

  let contactItems = $derived<ContactItem[]>([
    {
      kind: "link",
      label: t("irSettings.standalone.about.contacts.website"),
      href: WEAVE_WEBSITE_URL,
    },
    {
      kind: "link",
      label: t("irSettings.standalone.about.contacts.changelog"),
      href: "https://github.com/zhuzhige123/Obsidian-Weave-incremental-reading/blob/main/CHANGELOG.md",
    },
    {
      kind: "menu",
      label: t("irSettings.standalone.about.contacts.community"),
    },
    {
      kind: "link",
      label: t("irSettings.standalone.about.contacts.author"),
      href: "mailto:tutaoyuan8@outlook.com?subject=Weave%20Incremental%20Reading%20%E5%8F%8D%E9%A6%88",
    },
  ]);

  function showCommunityFeedbackMenu(event: MouseEvent) {
    const menu = new Menu();
    menu.addItem((item) => {
      item
        .setTitle(t("irSettings.standalone.about.contacts.communityMenu.qqPublic"))
        .setIcon("message-circle")
        .onClick(() => {
          void openObsidianWebUrl(plugin.app, QQ_PUBLIC_GROUP_URL);
        });
    });
    menu.addItem((item) => {
      item
        .setTitle(t("irSettings.standalone.about.contacts.communityMenu.otherInDocs"))
        .setIcon("book-open")
        .onClick(() => {
          void openObsidianWebUrl(plugin.app, OTHER_GROUPS_DOCS_URL);
        });
    });
    menu.showAtMouseEvent(event);
  }
  let incrementalReadingSettings = $derived.by(() => {
    stateVersion;
    return plugin.getIncrementalReadingSettings();
  });

  $effect(() => {
    stateVersion;
    lastFolderDraft = incrementalReadingSettings.selectionQuickCreateLastFolder ?? "";
    weaveParentFolderDraft = plugin.settings.weaveParentFolder ?? "";
    showPremiumFeaturesPreviewDraft = plugin.settings.showPremiumFeaturesPreview ?? false;
    uiLanguageDraft = plugin.settings.uiLanguage ?? "auto";
  });

  $effect(() => {
    const availableTabIds = new Set(tabs.map((tab) => tab.id));
    if (!availableTabIds.has(activeTab)) {
      activeTab = "basic";
    }
  });

  onMount(() => {
    if (initialTab) {
      const resolved = resolveStandaloneIRSettingsTabId(initialTab);
      if (resolved) {
        activeTab = resolved;
      }
    }

    const handleNavigateSettings = (event: Event) => {
      const detail = (event as CustomEvent<{ tab?: string }>).detail;
      const resolved = resolveStandaloneIRSettingsTabId(detail?.tab);
      if (resolved) {
        activeTab = resolved;
      }
    };

    window.addEventListener(STANDALONE_IR_SETTINGS_NAVIGATE_EVENT, handleNavigateSettings);
    return () => {
      window.removeEventListener(STANDALONE_IR_SETTINGS_NAVIGATE_EVENT, handleNavigateSettings);
    };
  });

  async function save(): Promise<void> {
    await plugin.saveSettings();
    stateVersion += 1;
  }

  async function updateIncrementalReadingField(
    updater: (settings: NonNullable<typeof plugin.settings.incrementalReading>) => void
  ): Promise<void> {
    const next = {
      ...incrementalReadingSettings,
    };
    updater(next);
    await plugin.saveIncrementalReadingSettings(next);
    stateVersion += 1;
  }

  async function updateRootSettings(
    updater: (settings: typeof plugin.settings) => void
  ): Promise<void> {
    updater(plugin.settings);
    await save();
  }

  async function commitUiLanguage(nextValue: PluginUiLanguagePreference): Promise<void> {
    uiLanguageDraft = nextValue;
    applyPluginUiLanguagePreference(nextValue);
    await updateRootSettings((settings) => {
      settings.uiLanguage = nextValue;
    });
  }

  async function commitPremiumFeaturesPreviewEnabled(enabled: boolean): Promise<void> {
    showPremiumFeaturesPreviewDraft = enabled;
    PremiumFeatureGuard.getInstance().setPremiumFeaturesPreview(enabled);
    await updateRootSettings((settings) => {
      (settings as any).showPremiumFeaturesPreview = enabled;
    });
  }

  function handleTabChange(tabId: string): void {
    activeTab = tabId as StandaloneIRSettingsTabId;
  }


  async function commitLastFolder(): Promise<void> {
    const nextValue = lastFolderDraft.trim();
    if (nextValue === (incrementalReadingSettings.selectionQuickCreateLastFolder ?? "")) {
      return;
    }
    await updateIncrementalReadingField((settings) => {
      settings.selectionQuickCreateLastFolder = nextValue;
    });
  }

  async function commitWeaveParentFolder(): Promise<void> {
    const nextValue = weaveParentFolderDraft.trim();
    if (nextValue === (plugin.settings.weaveParentFolder ?? "")) {
      return;
    }
    // 单一数据根：importFolder 不再单独配置，一律由数据根推导（{root}/IR）
    await updateRootSettings((settings) => {
      settings.weaveParentFolder = nextValue;
      if (settings.incrementalReading) {
        settings.incrementalReading.importFolder = "";
      }
    });
  }
</script>

<div class="standalone-ir-settings-root weave-settings">
  <div class="standalone-ir-settings-tabs">
    <TabNavigation
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={handleTabChange}
      variant="plain"
    />
  </div>

  <div class="standalone-ir-settings-tab-panel" id={`standalone-ir-settings-panel-${activeTab}`}>
    {#if activeTab === "core-scheduling" || activeTab === "advanced"}
      <IncrementalReadingSettingsSection
        {plugin}
        showTabs={false}
        forcedTab={activeTab as "core-scheduling" | "advanced"}
      />
    {/if}

    {#if activeTab === "basic"}
      <section class="standalone-ir-settings-section">
        <div class="standalone-ir-settings-group standalone-ir-settings-group--panel">
          <div class="standalone-ir-settings-group-header">
            <h3 class="standalone-ir-settings-group-title with-accent-bar accent-purple">{t("irSettings.standalone.language.title")}</h3>
            <p class="standalone-ir-settings-group-description">{t("irSettings.standalone.language.description")}</p>
          </div>
          <div class="standalone-ir-storage-row">
            <div class="standalone-ir-storage-info">
              <div class="standalone-ir-storage-name">{t("irSettings.standalone.language.title")}</div>
            </div>
            <div class="standalone-ir-storage-control">
              <ObsidianSettingDropdown
                compact
                options={languageOptions}
                value={uiLanguageDraft}
                onChange={(value) => {
                  void commitUiLanguage(value as PluginUiLanguagePreference);
                }}
              />
            </div>
          </div>
        </div>

        <div class="standalone-ir-settings-group standalone-ir-settings-group--panel">
          <div class="standalone-ir-premium-preview-setting-row">
            <div class="standalone-ir-premium-preview-setting-copy">
              <h3 class="standalone-ir-settings-group-title with-accent-bar accent-purple">{t("irSettings.standalone.premiumPreview.title")}</h3>
              <p class="standalone-ir-settings-group-description">{t("irSettings.standalone.premiumPreview.description")}</p>
            </div>
            <ObsidianSettingToggle
              compact
              value={showPremiumFeaturesPreviewDraft}
              onChange={(enabled) => {
                void commitPremiumFeaturesPreviewEnabled(enabled);
              }}
            />
          </div>
        </div>

        <div class="standalone-ir-settings-group standalone-ir-settings-group--panel">
          <div class="standalone-ir-settings-group-header">
            <h3 class="standalone-ir-settings-group-title with-accent-bar accent-purple">{t("irSettings.standalone.dataFolders.title")}</h3>
            <p class="standalone-ir-settings-group-description">{t("irSettings.standalone.dataFolders.description")}</p>
          </div>
          <div class="standalone-ir-storage-list">
            <div class="standalone-ir-storage-row">
              <div class="standalone-ir-storage-info">
                <div class="standalone-ir-storage-name">{t("irSettings.standalone.dataFolders.saveFolderName")}</div>
                <p class="standalone-ir-storage-desc">{t("irSettings.standalone.dataFolders.saveFolderDesc")}</p>
              </div>
              <div class="standalone-ir-storage-control">
                <FolderSearchInput
                  app={plugin.app}
                  value={weaveParentFolderDraft}
                  savedValue={plugin.settings.weaveParentFolder ?? ''}
                  placeholder={t("irSettings.standalone.dataFolders.saveFolderPlaceholder")}
                  onInput={(value) => {
                    weaveParentFolderDraft = value;
                  }}
                  onCommit={async (value) => {
                    weaveParentFolderDraft = value;
                    await commitWeaveParentFolder();
                  }}
                />
              </div>
            </div>

            <div class="standalone-ir-storage-row">
              <div class="standalone-ir-storage-info">
                <div class="standalone-ir-storage-name">{t("irSettings.standalone.dataFolders.readingPointFolderName")}</div>
                <p class="standalone-ir-storage-desc">{t("irSettings.standalone.dataFolders.readingPointFolderDesc")}</p>
              </div>
              <div class="standalone-ir-storage-control">
                <FolderSearchInput
                  app={plugin.app}
                  value={lastFolderDraft}
                  savedValue={incrementalReadingSettings.selectionQuickCreateLastFolder ?? ''}
                  placeholder={t("irSettings.standalone.dataFolders.readingPointPlaceholder")}
                  onInput={(value) => {
                    lastFolderDraft = value;
                  }}
                  onCommit={async (value) => {
                    lastFolderDraft = value;
                    await commitLastFolder();
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {#if shouldShowPremiumFeatureEntry(PREMIUM_FEATURES.FOLDER_SUBSCRIPTION)}
          <IncrementalReadingSettingsSection
            {plugin}
            showTabs={false}
            forcedTab="auto-subscribe"
            autoSubscribeShowTitle={true}
          />
        {/if}
      </section>
    {/if}

    {#if activeTab === "license"}
      <section class="standalone-ir-settings-section">
        <StandaloneIRLicenseSettingsPanel {plugin} />
      </section>
    {/if}

    {#if activeTab === "about"}
      <section class="standalone-ir-settings-section standalone-ir-settings-section--about">
        <div class="standalone-ir-settings-group">
          <div class="standalone-ir-settings-group-header">
            <h3 class="standalone-ir-settings-group-title with-accent-bar accent-cyan">{t("irSettings.standalone.about.panelTitle")}</h3>
            <p class="standalone-ir-settings-group-description">{t("irSettings.standalone.about.panelDescription")}</p>
          </div>

          <div class="standalone-ir-about-overview-list">
            <div class="standalone-ir-about-overview-section-label">{t("irSettings.standalone.about.pluginInfo")}</div>
            <div class="standalone-ir-about-overview-item">
              <div class="standalone-ir-about-overview-label">{t("irSettings.standalone.about.pluginName")}</div>
              <div class="standalone-ir-about-overview-value">{pluginDisplayName}</div>
            </div>
            <div class="standalone-ir-about-overview-item">
              <div class="standalone-ir-about-overview-label">{t("irSettings.standalone.about.version")}</div>
              <div class="standalone-ir-about-overview-value">{pluginDisplayVersion}</div>
            </div>
            <div class="standalone-ir-about-overview-item">
              <div class="standalone-ir-about-overview-label">{t("irSettings.standalone.about.series")}</div>
              <div class="standalone-ir-about-overview-value">{t("irSettings.standalone.about.seriesValue")}</div>
            </div>
            <div class="standalone-ir-about-overview-item">
              <div class="standalone-ir-about-overview-label">{t("irSettings.standalone.about.platform")}</div>
              <div class="standalone-ir-about-overview-value">{t("irSettings.standalone.about.platformValue")}</div>
            </div>
            <div class="standalone-ir-about-overview-item">
              <div class="standalone-ir-about-overview-label">{t("irSettings.standalone.about.licensedDevices")}</div>
              <div class="standalone-ir-about-overview-value">{t("irSettings.standalone.about.licensedDevicesValue")}</div>
            </div>

            <div class="standalone-ir-about-overview-section-label standalone-ir-about-overview-section-label--separated">
              {t("irSettings.standalone.about.capabilityOverview")}
            </div>
            {#each aboutOverviewItems as item}
              <div class="standalone-ir-about-overview-item">
                <div class="standalone-ir-about-overview-label">{item.label}</div>
                <div class="standalone-ir-about-overview-value">{item.value}</div>
              </div>
            {/each}
          </div>
        </div>

        <div class="standalone-ir-settings-group standalone-ir-settings-group--panel">
          <div class="standalone-ir-settings-group-header">
            <h3 class="standalone-ir-settings-group-title with-accent-bar accent-purple">{t("irSettings.standalone.about.contactsTitle")}</h3>
          </div>

          <div class="standalone-ir-about-links">
            {#each contactItems as item}
              {#if item.kind === "link"}
                <a
                  class="standalone-ir-about-link"
                  href={item.href}
                  target={item.href.startsWith("http") ? "_blank" : undefined}
                  rel={item.href.startsWith("http") ? "noopener noreferrer" : undefined}
                >
                  {item.label}
                </a>
              {:else}
                <button
                  type="button"
                  class="clickable-icon standalone-ir-about-link"
                  onclick={showCommunityFeedbackMenu}
                >
                  {item.label}
                </button>
              {/if}
            {/each}
          </div>
        </div>
      </section>
    {/if}
  </div>
</div>

<style>
  .standalone-ir-settings-root {
    /* Semantic typography scale for this settings panel */
    --standalone-ir-font-size-title: var(--font-ui-medium, 1rem);
    --standalone-ir-font-size-label: var(--font-ui-small, 0.95rem);
    --standalone-ir-font-size-desc: var(--font-ui-smaller, 0.85rem);
    --standalone-ir-space-1: var(--size-4-1);
    --standalone-ir-space-2: var(--size-4-2);
    --standalone-ir-space-3: var(--size-4-3);
    --standalone-ir-space-4: var(--size-4-4);
    --standalone-ir-space-6: var(--size-4-6);
    --standalone-ir-radius-s: var(--radius-s);
    --standalone-ir-radius-m: var(--radius-m);
    --standalone-ir-radius-l: var(--radius-l);
    display: flex;
    flex-direction: column;
    gap: var(--standalone-ir-space-4);
    padding: var(--standalone-ir-space-1) 0 var(--standalone-ir-space-6);
  }

  .standalone-ir-settings-tabs {
    min-width: 0;
  }

  .standalone-ir-settings-tabs :global(.tab-navigation) {
    background: transparent;
    border: none;
    border-radius: 0;
    padding: 0;
    gap: 0.35rem;
    overflow-x: auto;
    scrollbar-width: none;
  }

  .standalone-ir-settings-tabs :global(.tab-navigation::-webkit-scrollbar) {
    display: none;
  }

  .standalone-ir-settings-tab-panel {
    display: flex;
    flex-direction: column;
    gap: var(--standalone-ir-space-6);
    min-width: 0;
    padding-inline: 0.5rem;
  }

  .standalone-ir-settings-section,
  .standalone-ir-settings-group {
    display: flex;
    flex-direction: column;
    gap: var(--standalone-ir-space-3);
    min-width: 0;
  }

  .standalone-ir-settings-section--about > .standalone-ir-settings-group {
    gap: var(--standalone-ir-space-1);
  }

  .standalone-ir-settings-group--panel {
    padding: var(--standalone-ir-space-4);
    border: 1px solid var(--background-modifier-border);
    border-radius: 18px;
    background: color-mix(in oklab, var(--background-primary), var(--background-secondary) 26%);
    gap: var(--standalone-ir-space-3);
  }

  .standalone-ir-settings-section {
    gap: var(--standalone-ir-space-6);
  }

  .standalone-ir-settings-group-header {
    display: flex;
    flex-direction: column;
    gap: var(--standalone-ir-space-1);
  }

  .standalone-ir-settings-section--about .standalone-ir-settings-group-header {
    gap: 0.35rem;
    padding-bottom: 0.4rem;
  }

  .standalone-ir-settings-group-title {
    margin: 0;
    font-size: var(--standalone-ir-font-size-title);
    font-weight: 600;
    color: var(--text-normal);
    line-height: 1.4;
  }

  .standalone-ir-settings-group-title.with-accent-bar {
    position: relative;
    padding-left: 16px;
  }

  .standalone-ir-settings-group-title.with-accent-bar::before {
    content: "";
    position: absolute;
    left: 0;
    top: 50%;
    transform: translateY(-50%);
    width: 4px;
    height: 80%;
    border-radius: var(--standalone-ir-radius-s);
  }

  .standalone-ir-settings-group-title.accent-purple::before {
    background: linear-gradient(135deg, rgba(168, 85, 247, 0.8), rgba(147, 51, 234, 0.6));
  }

  .standalone-ir-settings-group-title.accent-cyan::before {
    background: linear-gradient(135deg, rgba(6, 182, 212, 0.8), rgba(14, 165, 233, 0.6));
  }

  .standalone-ir-settings-group-description {
    margin: 0;
    font-size: var(--standalone-ir-font-size-desc);
    color: var(--text-muted);
    line-height: 1.55;
  }

  .standalone-ir-storage-list {
    display: flex;
    flex-direction: column;
    gap: var(--standalone-ir-space-3);
    min-width: 0;
  }

  .standalone-ir-storage-row {
    border-radius: var(--standalone-ir-radius-m);
    background: var(--background-secondary);
    padding: var(--standalone-ir-space-4) var(--standalone-ir-space-6);
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
  }

  .standalone-ir-storage-info {
    min-width: 0;
    flex: 1 1 auto;
  }

  .standalone-ir-storage-name {
    margin: 0;
    padding: 0;
    text-indent: 0;
    font-size: var(--standalone-ir-font-size-label);
    font-weight: 600;
    line-height: 1.4;
  }

  .standalone-ir-storage-desc {
    margin: var(--standalone-ir-space-1) 0 0;
    font-size: var(--standalone-ir-font-size-desc);
    color: var(--text-muted);
    line-height: 1.55;
  }

  .standalone-ir-storage-control {
    display: flex;
    align-items: center;
    gap: var(--standalone-ir-space-2);
    flex: 0 1 clamp(16rem, 42%, 24rem);
    width: clamp(16rem, 42%, 24rem);
    max-width: 100%;
  }

  .standalone-ir-storage-control :global(.ir-obsidian-setting-dropdown-host) {
    width: 100%;
  }

  .standalone-ir-storage-control :global(.ir-obsidian-setting-dropdown-host .dropdown) {
    width: 100%;
    max-width: 100%;
  }

  .standalone-ir-premium-preview-setting-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--standalone-ir-space-4);
  }

  .standalone-ir-premium-preview-setting-copy {
    display: flex;
    flex-direction: column;
    gap: var(--standalone-ir-space-1);
    min-width: 0;
  }


  .standalone-ir-settings-root :global(.incremental-reading-settings) {
    gap: 0;
    padding: 0;
  }

  .standalone-ir-settings-root :global(.incremental-reading-settings .incremental-reading-tab-content),
  .standalone-ir-settings-root :global(.incremental-reading-settings .incremental-reading-tab-followup) {
    gap: var(--standalone-ir-space-6);
  }

  .standalone-ir-settings-root :global(.incremental-reading-settings .incremental-reading-tab-panel) {
    gap: var(--standalone-ir-space-6);
  }

  .standalone-ir-settings-root :global(.incremental-reading-settings.settings-layout-flat .settings-group) {
    padding: var(--standalone-ir-space-4);
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--standalone-ir-radius-l);
    background: color-mix(in oklab, var(--background-primary), var(--background-secondary) 26%);
    box-shadow: none;
    gap: 0.25rem;
  }

  .standalone-ir-settings-root :global(.incremental-reading-settings.settings-layout-flat .group-content) {
    gap: var(--standalone-ir-space-3);
  }

  .standalone-ir-settings-root :global(.incremental-reading-settings.settings-layout-flat .group-header),
  .standalone-ir-settings-root :global(.incremental-reading-settings.settings-layout-flat .group-title) {
    margin-bottom: 0;
  }

  .standalone-ir-settings-root :global(.incremental-reading-settings.settings-layout-flat .group-header) {
    gap: var(--standalone-ir-space-1);
    padding-bottom: 0.4rem;
  }

  .standalone-ir-settings-root :global(.incremental-reading-settings.settings-layout-flat .row) {
    border: none;
    border-radius: var(--standalone-ir-radius-m);
    background: var(--background-secondary);
    padding: var(--standalone-ir-space-4) var(--standalone-ir-space-6);
  }

  .standalone-ir-settings-root :global(.incremental-reading-settings.settings-layout-flat .row:last-child) {
    border-bottom: none;
  }

  .standalone-ir-settings-root :global(.incremental-reading-settings .group-title) {
    margin: 0;
    font-size: var(--standalone-ir-font-size-title);
    line-height: 1.4;
  }

  .standalone-ir-settings-root :global(.incremental-reading-settings .group-header) {
    margin-bottom: 0.35rem;
  }

  .standalone-ir-settings-root :global(.incremental-reading-settings .group-description) {
    margin: 0;
    font-size: var(--standalone-ir-font-size-desc);
    line-height: 1.55;
  }

  .standalone-ir-settings-root :global(.incremental-reading-settings .label-with-desc > label) {
    font-size: var(--standalone-ir-font-size-label);
    font-weight: 500;
    line-height: 1.4;
  }

  .standalone-ir-settings-root :global(.incremental-reading-settings .label-with-desc > .desc) {
    font-size: var(--standalone-ir-font-size-desc);
    line-height: 1.5;
  }

  .standalone-ir-settings-root :global(.incremental-reading-settings .strategy-hint) {
    margin: 0;
    padding: var(--standalone-ir-space-4) var(--standalone-ir-space-4);
    background: var(--background-secondary);
    border-radius: var(--standalone-ir-radius-m);
    color: var(--text-muted);
  }

  .standalone-ir-settings-root :global(.incremental-reading-settings .subscription-rules-list) {
    margin-bottom: 0;
  }

  .standalone-ir-about-overview-list {
    display: flex;
    flex-direction: column;
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--radius-m, 12px);
    background: var(--background-secondary);
    overflow: hidden;
  }

  .standalone-ir-about-overview-section-label {
    padding: 0.75rem 1.25rem;
    color: var(--text-muted);
    font-size: var(--standalone-ir-font-size-desc);
    font-weight: 600;
    line-height: 1.4;
    background: color-mix(in oklab, var(--background-secondary), var(--background-primary) 28%);
  }

  .standalone-ir-about-overview-section-label--separated {
    border-top: 1px solid var(--background-modifier-border);
  }

  .standalone-ir-about-overview-item {
    display: grid;
    grid-template-columns: minmax(7.5rem, 10rem) minmax(0, 1fr);
    gap: 1rem;
    padding: 1rem 1.25rem;
  }

  .standalone-ir-about-overview-item + .standalone-ir-about-overview-item {
    border-top: 1px solid var(--background-modifier-border);
  }

  .standalone-ir-about-overview-label {
    color: var(--text-normal);
    font-weight: 600;
    font-size: var(--standalone-ir-font-size-label);
    line-height: 1.5;
  }

  .standalone-ir-about-overview-value {
    color: var(--text-muted);
    font-size: var(--standalone-ir-font-size-desc);
    line-height: 1.65;
  }

  .standalone-ir-about-links {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: var(--standalone-ir-space-1) var(--standalone-ir-space-3);
    width: 100%;
  }

  .standalone-ir-about-link {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    width: 100%;
    height: auto;
    min-height: 0;
    padding: 0.4rem 0.45rem;
    border: none;
    border-radius: var(--radius-m, 8px);
    background: transparent;
    color: var(--text-muted);
    font: inherit;
    line-height: inherit;
    cursor: pointer;
    text-decoration: none;
    box-shadow: none;
    transition: color 0.15s ease, background-color 0.15s ease;
    text-align: center;
  }

  .standalone-ir-settings-root button.standalone-ir-about-link.clickable-icon,
  .standalone-ir-settings-root button.standalone-ir-about-link.clickable-icon:hover,
  .standalone-ir-settings-root button.standalone-ir-about-link.clickable-icon:focus,
  .standalone-ir-settings-root button.standalone-ir-about-link.clickable-icon:active {
    appearance: none;
    -webkit-appearance: none;
    border: none;
    border-width: 0;
    box-shadow: none;
    background: transparent;
    background-color: transparent;
  }

  .standalone-ir-about-link:hover,
  .standalone-ir-settings-root button.standalone-ir-about-link.clickable-icon:hover,
  .standalone-ir-settings-root button.standalone-ir-about-link.clickable-icon:focus {
    color: var(--text-normal);
    background: var(--background-modifier-hover);
    background-color: var(--background-modifier-hover);
  }

  @media (max-width: 720px) {
    .standalone-ir-settings-tabs :global(.tab-navigation) {
      gap: 0.5rem;
    }

    .standalone-ir-storage-row {
      padding: 1rem;
      flex-direction: column;
      align-items: stretch;
    }

    .standalone-ir-storage-control {
      width: 100%;
      max-width: 100%;
      flex-basis: auto;
    }

    .standalone-ir-premium-preview-setting-row {
      flex-direction: column;
      align-items: stretch;
      gap: var(--standalone-ir-space-3);
    }

    .standalone-ir-premium-preview-setting-row :global(.ir-obsidian-setting-toggle-host) {
      align-self: flex-end;
    }

    .standalone-ir-settings-root :global(.incremental-reading-settings.settings-layout-flat .row) {
      padding: 1rem;
    }

    .standalone-ir-settings-root :global(.incremental-reading-settings.settings-layout-flat .settings-group) {
      padding: 0.9rem;
    }

    .standalone-ir-settings-root :global(.incremental-reading-settings.settings-layout-flat .row.row-has-desc) {
      align-items: stretch;
    }

    .standalone-ir-about-overview-item {
      grid-template-columns: 1fr;
      gap: 0.35rem;
    }

    .standalone-ir-about-links {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 480px) {
    .standalone-ir-about-links {
      grid-template-columns: 1fr;
    }
  }
</style>
