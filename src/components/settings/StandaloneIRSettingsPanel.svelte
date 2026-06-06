<script lang="ts">
  import { onMount } from "svelte";
  import TabNavigation from "../ui/TabNavigation.svelte";
  import type { IncrementalReadingSettingsHost } from "./types/incremental-reading-settings-host";
  import IncrementalReadingSettingsSection from "./sections/IncrementalReadingSettingsSection.svelte";
  import StandaloneIRLicenseSettingsPanel from "./StandaloneIRLicenseSettingsPanel.svelte";
  import { VaultFolderSuggestModal } from "../../modals/VaultFolderSuggestModal";
  import { IRDataManagementModalObsidian } from "../incremental-reading/IRDataManagementModalObsidian";
import {
  PremiumFeatureGuard,
  PREMIUM_FEATURES,
} from "../../services/premium/PremiumFeatureGuard";

  interface Props {
    plugin: IncrementalReadingSettingsHost;
  }

  type StandaloneIRSettingsTabId = "basic" | "core-scheduling" | "advanced" | "license" | "about";

  let { plugin }: Props = $props();
  let activeTab = $state<StandaloneIRSettingsTabId>("basic");
  let stateVersion = $state(0);
  let localDataFolderDraft = $state("");
  let lastFolderDraft = $state("");
  let weaveParentFolderDraft = $state("");
let showPremiumFeaturesPreviewDraft = $state(false);

  function shouldShowPremiumFeatureEntry(featureId: string): boolean {
    return PremiumFeatureGuard.getInstance().shouldShowFeatureEntry(featureId, {
      showPremiumPreview: showPremiumFeaturesPreviewDraft,
    });
  }

  let tabs = $derived.by(() => {
    stateVersion;
    const baseTabs: Array<{ id: StandaloneIRSettingsTabId; label: string; icon: string }> = [
      { id: "basic", label: "基础", icon: "" },
      { id: "core-scheduling", label: "基础调度", icon: "" },
    ];

    const shouldShowAdvancedTab =
      shouldShowPremiumFeatureEntry(PREMIUM_FEATURES.SCHEDULING_STRATEGY_SETTINGS)
      || shouldShowPremiumFeatureEntry(PREMIUM_FEATURES.INTERLEAVE_LEARNING_SETTINGS)
      || shouldShowPremiumFeatureEntry(PREMIUM_FEATURES.TAG_GROUPS);
    if (shouldShowAdvancedTab) {
      baseTabs.push({ id: "advanced", label: "高级调度", icon: "" });
    }

    baseTabs.push(
      { id: "license", label: "授权", icon: "" },
      { id: "about", label: "关于", icon: "" }
    );
    return baseTabs;
  });

  let pluginVersion = $derived.by(() => plugin.manifest?.version || "-");
  let pluginDisplayName = $derived.by(() => plugin.manifest?.name ?? "Weave Incremental Reading");
  const supportedFormats = ["Markdown", "PDF 书签", "EPUB 来源回跳", "Canvas"];
  const contactItems = [
    {
      label: "文档中心",
      href: "https://github.com/zhuzhige123/weave-incremental-reading/tree/main/docs",
    },
    {
      label: "更新日志",
      href: "https://github.com/zhuzhige123/weave-incremental-reading/blob/main/CHANGELOG.md",
    },
    {
      label: "问题反馈",
      href: "https://github.com/zhuzhige123/weave-incremental-reading/issues",
    },
    {
      label: "联系作者",
      href: "mailto:tutaoyuan8@outlook.com?subject=Weave%20Incremental%20Reading%20%E5%8F%8D%E9%A6%88",
    },
  ];
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

  function resetLocalDataFolder(): void {
    localDataFolderDraft = incrementalReadingSettings.importFolder ?? "";
  }

  function resetWeaveParentFolder(): void {
    weaveParentFolderDraft = plugin.settings.weaveParentFolder ?? "";
  }

  function resetLastFolder(): void {
    lastFolderDraft = incrementalReadingSettings.selectionQuickCreateLastFolder ?? "";
  }

  async function chooseFolder(
    anchorEl: HTMLElement | null | undefined,
    placeholder: string,
    onSelected: (value: string) => void,
    commit: () => Promise<void>
  ): Promise<void> {
    const picker = new VaultFolderSuggestModal(plugin.app, {
      placeholder,
      anchorRect: anchorEl?.getBoundingClientRect?.() || undefined
    });
    const folderPath = await picker.openAndSelect();
    if (!folderPath) {
      return;
    }
    onSelected(folderPath);
    await commit();
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
          <div class="standalone-ir-premium-preview-setting-row">
            <div class="standalone-ir-premium-preview-setting-copy">
              <h3 class="standalone-ir-settings-group-title with-accent-bar accent-purple">显示高级功能预览</h3>
              <p class="standalone-ir-settings-group-description">开启后，基础设置页与阅读器中会显示锁定状态的高级功能入口；关闭后全部隐藏。</p>
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
            <h3 class="standalone-ir-settings-group-title with-accent-bar accent-purple">数据文件夹配置</h3>
            <p class="standalone-ir-settings-group-description">集中配置本地数据目录、专题保存路径和阅读点默认位置，确保长期使用中的路径稳定与数据可维护性。</p>
          </div>
          <div class="standalone-ir-storage-list">
            <div class="standalone-ir-storage-row">
              <div class="standalone-ir-storage-info">
                <div class="standalone-ir-storage-name">增量阅读本地数据文件夹</div>
                <p class="standalone-ir-storage-desc">用于选择增量阅读数据在仓库中的本地目录；建议使用独立子目录，便于后续迁移与备份。</p>
              </div>
              <div class="standalone-ir-storage-control">
                <input
                  type="text"
                  placeholder="例如：weave/incremental-reading/local-data"
                  bind:value={localDataFolderDraft}
                  onblur={() => void commitLocalDataFolder()}
                  onkeydown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void commitLocalDataFolder();
                    } else if (event.key === "Escape") {
                      event.preventDefault();
                      resetLocalDataFolder();
                    }
                  }}
                />
                <button
                  type="button"
                  onclick={(event) => {
                    const target = event.currentTarget as HTMLElement | null;
                    void chooseFolder(target, "选择增量阅读本地数据文件夹...", (value) => {
                      localDataFolderDraft = value;
                    }, commitLocalDataFolder);
                  }}
                >选择</button>
              </div>
            </div>

            <div class="standalone-ir-storage-row">
              <div class="standalone-ir-storage-info">
                <div class="standalone-ir-storage-name">数据保存文件夹</div>
                <p class="standalone-ir-storage-desc">用于设置专题 `.irdeck` 与关联数据的默认保存根目录；留空将使用默认 Weave 路径。</p>
              </div>
              <div class="standalone-ir-storage-control">
                <input
                  type="text"
                  placeholder="例如：weave/incremental-reading"
                  bind:value={weaveParentFolderDraft}
                  onblur={() => void commitWeaveParentFolder()}
                  onkeydown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void commitWeaveParentFolder();
                    } else if (event.key === "Escape") {
                      event.preventDefault();
                      resetWeaveParentFolder();
                    }
                  }}
                />
                <button
                  type="button"
                  onclick={(event) => {
                    const target = event.currentTarget as HTMLElement | null;
                    void chooseFolder(target, "选择专题默认保存文件夹...", (value) => {
                      weaveParentFolderDraft = value;
                    }, commitWeaveParentFolder);
                  }}
                >选择</button>
              </div>
            </div>

            <div class="standalone-ir-storage-row">
              <div class="standalone-ir-storage-info">
                <div class="standalone-ir-storage-name">阅读点默认保存文件夹</div>
                <p class="standalone-ir-storage-desc">仅用于新建 Markdown 阅读点（MD 阅读点）的默认保存路径；留空则遵循 Obsidian 新建笔记位置。</p>
              </div>
              <div class="standalone-ir-storage-control">
                <input
                  type="text"
                  placeholder="留空则使用 Obsidian 默认位置"
                  bind:value={lastFolderDraft}
                  onblur={() => void commitLastFolder()}
                  onkeydown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void commitLastFolder();
                    } else if (event.key === "Escape") {
                      event.preventDefault();
                      resetLastFolder();
                    }
                  }}
                />
                <button
                  type="button"
                  onclick={(event) => {
                    const target = event.currentTarget as HTMLElement | null;
                    void chooseFolder(target, "选择阅读点默认保存文件夹...", (value) => {
                      lastFolderDraft = value;
                    }, commitLastFolder);
                  }}
                >选择</button>
              </div>
            </div>

            <div class="standalone-ir-storage-row standalone-ir-storage-row--action">
              <div class="standalone-ir-storage-info">
                <div class="standalone-ir-storage-name">增量阅读数据管理</div>
                <p class="standalone-ir-storage-desc">整理库内 .irdeck 路径、比较重复专题差异、恢复或清理插件备份中的孤立专题文件。</p>
              </div>
              <div class="standalone-ir-storage-control standalone-ir-storage-control--action-only">
                <button type="button" onclick={openDataManagementModal}>打开数据管理</button>
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
            <h3 class="standalone-ir-settings-group-title with-accent-bar accent-cyan">插件信息</h3>
            <p class="standalone-ir-settings-group-description">用于查看独立增量阅读插件当前版本、定位与核心支持能力。</p>
          </div>

          <div class="standalone-ir-about-overview-list">
            <div class="standalone-ir-about-overview-section-label">插件基础信息</div>

            <div class="standalone-ir-about-overview-item">
              <div class="standalone-ir-about-overview-label">插件名称</div>
              <div class="standalone-ir-about-overview-value">{pluginDisplayName}</div>
            </div>

            <div class="standalone-ir-about-overview-item">
              <div class="standalone-ir-about-overview-label">当前版本</div>
              <div class="standalone-ir-about-overview-value">v{pluginVersion}</div>
            </div>

            <div class="standalone-ir-about-overview-item">
              <div class="standalone-ir-about-overview-label">产品定位</div>
              <div class="standalone-ir-about-overview-value">独立增量阅读主控插件</div>
            </div>

            <div class="standalone-ir-about-overview-item">
              <div class="standalone-ir-about-overview-label">协作关系</div>
              <div class="standalone-ir-about-overview-value">可与 Weave 主插件、EPUB 阅读器协同</div>
            </div>

            <div class="standalone-ir-about-overview-section-label standalone-ir-about-overview-section-label--separated">核心能力覆盖</div>
            <div class="standalone-ir-about-overview-item">
              <div class="standalone-ir-about-overview-label">支持范围</div>
              <div class="standalone-ir-about-overview-value">{supportedFormats.join(" / ")}</div>
            </div>
          </div>
        </div>

        <div class="standalone-ir-settings-group">
          <div class="standalone-ir-settings-group-header">
            <h3 class="standalone-ir-settings-group-title with-accent-bar accent-purple">联系与资源</h3>
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

  .standalone-ir-storage-control input[type="text"] {
    flex: 1 1 auto;
    width: 100%;
    max-width: 100%;
  }

  .standalone-ir-storage-control button {
    white-space: nowrap;
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

    .standalone-ir-settings-root :global(.incremental-reading-settings.settings-layout-flat .row) {
      padding: 1rem;
    }

    .standalone-ir-settings-root :global(.incremental-reading-settings.settings-layout-flat .settings-group) {
      padding: 0.9rem;
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
