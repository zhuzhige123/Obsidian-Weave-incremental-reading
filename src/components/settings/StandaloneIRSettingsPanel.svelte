<script lang="ts">
  import { onMount } from "svelte";
  import TabNavigation from "../ui/TabNavigation.svelte";
  import type { IncrementalReadingSettingsHost } from "./types/incremental-reading-settings-host";
  import IncrementalReadingSettingsSection from "./sections/IncrementalReadingSettingsSection.svelte";
  import StandaloneIRLicenseSettingsPanel from "./StandaloneIRLicenseSettingsPanel.svelte";
  import FolderSearchInput from "../ui/FolderSearchInput.svelte";
  import { IRDataManagementModalObsidian } from "../incremental-reading/IRDataManagementModalObsidian";
  import {
    PremiumFeatureGuard,
    PREMIUM_FEATURES,
  } from "../../services/premium/PremiumFeatureGuard";
  import {
    applyPluginUiLanguagePreference,
    PLUGIN_UI_LANGUAGE_OPTIONS,
    tr,
    type PluginUiLanguagePreference,
  } from "../../utils/i18n";

  interface Props {
    plugin: IncrementalReadingSettingsHost;
  }

  type StandaloneIRSettingsTabId = "basic" | "core-scheduling" | "advanced" | "license" | "about";

  let { plugin }: Props = $props();
  let t = $derived($tr);
  let activeTab = $state<StandaloneIRSettingsTabId>("basic");
  let stateVersion = $state(0);
  let localDataFolderDraft = $state("");
  let lastFolderDraft = $state("");
  let weaveParentFolderDraft = $state("");
  let showPremiumFeaturesPreviewDraft = $state(false);
  let uiLanguageDraft = $state<PluginUiLanguagePreference>("auto");

  const languageOptionLabels: Record<PluginUiLanguagePreference, () => string> = {
    auto: () => t("irSettings.standalone.language.auto"),
    "zh-CN": () => t("irSettings.standalone.language.zhCN"),
    "en-US": () => t("irSettings.standalone.language.enUS"),
  };

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
  let supportedFormats = $derived([
    t("irSettings.standalone.supportedFormats.markdown"),
    t("irSettings.standalone.supportedFormats.pdfBookmark"),
    t("irSettings.standalone.supportedFormats.epubSource"),
    t("irSettings.standalone.supportedFormats.canvas"),
  ]);
  let contactItems = $derived([
    {
      label: t("irSettings.standalone.about.contacts.docs"),
      href: "https://github.com/zhuzhige123/weave-incremental-reading/tree/main/docs",
    },
    {
      label: t("irSettings.standalone.about.contacts.changelog"),
      href: "https://github.com/zhuzhige123/Obsidian-Weave-incremental-reading/blob/main/CHANGELOG.md",
    },
    {
      label: t("irSettings.standalone.about.contacts.feedback"),
      href: "https://github.com/zhuzhige123/weave-incremental-reading/issues",
    },
    {
      label: t("irSettings.standalone.about.contacts.author"),
      href: "mailto:tutaoyuan8@outlook.com?subject=Weave%20Incremental%20Reading%20%E5%8F%8D%E9%A6%88",
    },
  ]);
  let incrementalReadingSettings = $derived.by(() => {
    stateVersion;
    return plugin.getIncrementalReadingSettings();
  });

  $effect(() => {
    stateVersion;
    localDataFolderDraft = incrementalReadingSettings.importFolder ?? "";
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
    const handleNavigateSettings = (event: Event) => {
      const detail = (event as CustomEvent<{ tab?: StandaloneIRSettingsTabId }>).detail;
      if (detail?.tab === "license") {
        activeTab = "license";
      }
    };

    window.addEventListener("WeaveIncrementalReading:navigate-settings", handleNavigateSettings);
    return () => {
      window.removeEventListener("WeaveIncrementalReading:navigate-settings", handleNavigateSettings);
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

  async function commitLocalDataFolder(): Promise<void> {
    const nextValue = localDataFolderDraft.trim();
    if (nextValue === (incrementalReadingSettings.importFolder ?? "")) {
      return;
    }
    await updateIncrementalReadingField((settings) => {
      settings.importFolder = nextValue;
    });
  }

  async function commitWeaveParentFolder(): Promise<void> {
    const nextValue = weaveParentFolderDraft.trim();
    if (nextValue === (plugin.settings.weaveParentFolder ?? "")) {
      return;
    }
    await updateRootSettings((settings) => {
      settings.weaveParentFolder = nextValue;
    });
  }

  function openDataManagementModal(): void {
    new IRDataManagementModalObsidian(plugin.app, {
      plugin: plugin as import("../../main").default,
    }).open();
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
              <select
                class="standalone-ir-language-select"
                value={uiLanguageDraft}
                onchange={(event) => {
                  const nextValue = (event.currentTarget as HTMLSelectElement).value as PluginUiLanguagePreference;
                  void commitUiLanguage(nextValue);
                }}
              >
                {#each PLUGIN_UI_LANGUAGE_OPTIONS as option}
                  <option value={option}>{languageOptionLabels[option]()}</option>
                {/each}
              </select>
            </div>
          </div>
        </div>

        <div class="standalone-ir-settings-group standalone-ir-settings-group--panel">
          <div class="standalone-ir-premium-preview-setting-row">
            <div class="standalone-ir-premium-preview-setting-copy">
              <h3 class="standalone-ir-settings-group-title with-accent-bar accent-purple">{t("irSettings.standalone.premiumPreview.title")}</h3>
              <p class="standalone-ir-settings-group-description">{t("irSettings.standalone.premiumPreview.description")}</p>
            </div>
            <label class="modern-switch">
              <input
                type="checkbox"
                checked={showPremiumFeaturesPreviewDraft}
                onchange={(e) => {
                  void commitPremiumFeaturesPreviewEnabled((e.target as HTMLInputElement).checked);
                }}
              />
              <span class="switch-slider"></span>
            </label>
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
                <div class="standalone-ir-storage-name">{t("irSettings.standalone.dataFolders.localDataName")}</div>
                <p class="standalone-ir-storage-desc">{t("irSettings.standalone.dataFolders.localDataDesc")}</p>
              </div>
              <div class="standalone-ir-storage-control">
                <FolderSearchInput
                  app={plugin.app}
                  value={localDataFolderDraft}
                  savedValue={incrementalReadingSettings.importFolder ?? ''}
                  placeholder={t("irSettings.standalone.dataFolders.localDataPlaceholder")}
                  onInput={(value) => {
                    localDataFolderDraft = value;
                  }}
                  onCommit={async (value) => {
                    localDataFolderDraft = value;
                    await commitLocalDataFolder();
                  }}
                />
              </div>
            </div>

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

            <div class="standalone-ir-storage-row standalone-ir-storage-row--action">
              <div class="standalone-ir-storage-info">
                <div class="standalone-ir-storage-name">{t("irSettings.standalone.dataFolders.dataMgmtName")}</div>
                <p class="standalone-ir-storage-desc">{t("irSettings.standalone.dataFolders.dataMgmtDesc")}</p>
              </div>
              <div class="standalone-ir-storage-control standalone-ir-storage-control--action-only">
                <button type="button" onclick={openDataManagementModal}>{t("irSettings.standalone.dataFolders.openDataMgmt")}</button>
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
            <h3 class="standalone-ir-settings-group-title with-accent-bar accent-cyan">{t("irSettings.standalone.about.pluginInfoTitle")}</h3>
            <p class="standalone-ir-settings-group-description">{t("irSettings.standalone.about.pluginInfoDesc")}</p>
          </div>

          <div class="standalone-ir-about-overview-list">
            <div class="standalone-ir-about-overview-section-label">{t("irSettings.standalone.about.basicInfoSection")}</div>

            <div class="standalone-ir-about-overview-item">
              <div class="standalone-ir-about-overview-label">{t("irSettings.standalone.about.name")}</div>
              <div class="standalone-ir-about-overview-value">{pluginDisplayName}</div>
            </div>

            <div class="standalone-ir-about-overview-item">
              <div class="standalone-ir-about-overview-label">{t("irSettings.standalone.about.version")}</div>
              <div class="standalone-ir-about-overview-value">v{pluginVersion}</div>
            </div>

            <div class="standalone-ir-about-overview-item">
              <div class="standalone-ir-about-overview-label">{t("irSettings.standalone.about.positioning")}</div>
              <div class="standalone-ir-about-overview-value">{t("irSettings.standalone.about.positioningValue")}</div>
            </div>

            <div class="standalone-ir-about-overview-item">
              <div class="standalone-ir-about-overview-label">{t("irSettings.standalone.about.collaboration")}</div>
              <div class="standalone-ir-about-overview-value">{t("irSettings.standalone.about.collaborationValue")}</div>
            </div>

            <div class="standalone-ir-about-overview-section-label standalone-ir-about-overview-section-label--separated">{t("irSettings.standalone.about.capabilitiesSection")}</div>
            <div class="standalone-ir-about-overview-item">
              <div class="standalone-ir-about-overview-label">{t("irSettings.standalone.about.supportScope")}</div>
              <div class="standalone-ir-about-overview-value">{supportedFormats.join(" / ")}</div>
            </div>
          </div>
        </div>

        <div class="standalone-ir-settings-group">
          <div class="standalone-ir-settings-group-header">
            <h3 class="standalone-ir-settings-group-title with-accent-bar accent-purple">{t("irSettings.standalone.about.contactsTitle")}</h3>
          </div>

          <div class="standalone-ir-about-links">
            {#each contactItems as item}
              <a
                class="standalone-ir-about-link"
                href={item.href}
                target={item.href.startsWith("http") ? "_blank" : undefined}
                rel={item.href.startsWith("http") ? "noopener noreferrer" : undefined}
              >
                {item.label}
              </a>
            {/each}
          </div>
        </div>
      </section>
    {/if}
  </div>
</div>

<style>
  .standalone-ir-storage-control select.standalone-ir-language-select {
    min-width: 12rem;
    max-width: 100%;
  }

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

  .standalone-ir-settings-group--panel {
    padding: var(--standalone-ir-space-4);
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--standalone-ir-radius-l);
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

  .standalone-ir-storage-control--action-only {
    justify-content: flex-end;
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
    border-radius: var(--standalone-ir-radius-m);
    background: var(--background-secondary);
    overflow: hidden;
  }

  .standalone-ir-about-overview-section-label {
    padding: var(--standalone-ir-space-3) var(--standalone-ir-space-4);
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
    gap: var(--standalone-ir-space-4);
    padding: var(--standalone-ir-space-4) var(--standalone-ir-space-4);
  }

  .standalone-ir-about-overview-item + .standalone-ir-about-overview-item {
    border-top: 1px solid var(--background-modifier-border);
  }

  .standalone-ir-about-overview-label {
    color: var(--text-normal);
    font-weight: 600;
    line-height: 1.5;
  }

  .standalone-ir-about-overview-value {
    color: var(--text-muted);
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
    padding: var(--standalone-ir-space-2) var(--standalone-ir-space-2);
    border: none;
    border-radius: var(--standalone-ir-radius-s);
    background: transparent;
    color: var(--text-muted);
    text-decoration: none;
    transition: color 0.15s ease, background-color 0.15s ease;
    text-align: center;
  }

  .standalone-ir-about-link:hover {
    color: var(--text-normal);
    background: var(--background-modifier-hover);
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

    .standalone-ir-premium-preview-setting-row .modern-switch {
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

    .standalone-ir-settings-root :global(.incremental-reading-settings .ir-dropdown-compact) {
      flex: 1 1 auto;
      width: 100%;
      max-width: 100%;
      margin-left: 0;
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
