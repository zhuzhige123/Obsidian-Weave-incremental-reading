<script lang="ts">
  import EnhancedActivationForm from "./components/EnhancedActivationForm.svelte";
  import EnhancedLicenseStatusCard from "./components/EnhancedLicenseStatusCard.svelte";
  import {
    getPluginEffectiveLicenseState,
    getPluginActivationRemovalKind,
    removePluginActivation,
  } from "../../utils/plugin-license";
  import { emitWeaveLicenseChanged } from "../../utils/license-sync-bridge";
  import { showObsidianConfirm } from "../../utils/obsidian-confirm";
  import { showNotification } from "../../utils/notifications";
  import { tr } from "../../utils/i18n";
  import {
    LIFETIME_LICENSE_PAYPAL_READER_PURCHASE_URL,
    LIFETIME_LICENSE_PURCHASE_URL,
    WEAVE_SERIES_PAYPAL_PURCHASE_URL,
  } from "../../config/plugin-runtime";
  import { ACTIVATION_HELP_TEXT } from "./constants/activation-constants";
  import { openObsidianWebUrl } from "../../services/obsidian/obsidian-open-web-url";
  import { Menu } from "obsidian";
  import { onMount } from "svelte";

  const supportEmail = ACTIVATION_HELP_TEXT.CONTACT_INFO.email;

  interface Props {
    plugin: any;
  }

  let { plugin }: Props = $props();
  let t = $derived($tr);

  let stateVersion = $state(0);
  let isRemoving = $state(false);
  let communityPromoOpen = $state(false);
  let communityPromoPopoverEl = $state<HTMLDivElement | null>(null);

  function refreshSnapshot(): void {
    stateVersion += 1;
  }

  let effectiveLicenseState = $derived.by(() => {
    stateVersion;
    return getPluginEffectiveLicenseState(plugin);
  });

  let currentLicense = $derived.by(() => {
    stateVersion;
    return effectiveLicenseState.primaryLicense || plugin.settings?.license || null;
  });

  async function save(): Promise<void> {
    await plugin.saveSettings();
    refreshSnapshot();
  }

  async function resetLicense(): Promise<void> {
    if (isRemoving) {
      return;
    }

    const removalKind = getPluginActivationRemovalKind(plugin, { disableInheritedLicenses: true });

    if (removalKind === "none") {
      await plugin.refreshPremiumState?.();
      refreshSnapshot();
      showNotification(t("about.license.notices.noRecord"), "info");
      return;
    }

    const confirmed = await showObsidianConfirm(
      plugin.app,
      t("about.license.notices.resetConfirm"),
      { title: t("about.license.notices.resetConfirmTitle") }
    );

    if (!confirmed) {
      return;
    }

    isRemoving = true;

    try {
      const result = removePluginActivation(plugin, { disableInheritedLicenses: true });
      await plugin.saveSettings();
      emitWeaveLicenseChanged(plugin.app);

      const nextState = result.nextState;
      refreshSnapshot();

      if (nextState.isPremiumActive) {
        showNotification(t("about.license.notices.verifyFailed"), "error");
        return;
      }

      if (result.removalKind === "inherited-only") {
        showNotification(t('about.license.notices.inheritedDisabled'), "success");
        return;
      }

      showNotification(t("about.license.notices.resetSuccess"), "success");
    } catch {
      showNotification(t("about.license.notices.verifyFailed"), "error");
    } finally {
      isRemoving = false;
    }
  }

  function attachMenuApp(menu: Menu): void {
    (menu as Menu & { app?: typeof plugin.app }).app = plugin.app;
  }

  function openPurchaseUrl(url: string): void {
    const normalized = String(url || "").trim();
    if (!normalized) {
      return;
    }
    if (normalized.startsWith("mailto:")) {
      activeWindow.open(normalized);
      return;
    }
    void openObsidianWebUrl(plugin.app, normalized);
  }

  function openCommunityPromoPopover(): void {
    communityPromoOpen = true;
  }

  function closeCommunityPromoPopover(): void {
    communityPromoOpen = false;
  }

  function openDeveloperSupportEmail(subject: string): void {
    openPurchaseUrl(`mailto:${supportEmail}?subject=${encodeURIComponent(subject)}`);
  }

  function handleCommunityPromoPointerDown(event: MouseEvent): void {
    if (!communityPromoOpen || !communityPromoPopoverEl) {
      return;
    }
    const target = event.target;
    if (target instanceof Node && communityPromoPopoverEl.contains(target)) {
      return;
    }
    closeCommunityPromoPopover();
  }

  function handleCommunityPromoKeydown(event: KeyboardEvent): void {
    if (!communityPromoOpen) {
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      closeCommunityPromoPopover();
    }
  }

  $effect(() => {
    if (!communityPromoOpen || !communityPromoPopoverEl) {
      return;
    }
    queueMicrotask(() => {
      try {
        communityPromoPopoverEl?.focus({ preventScroll: true });
      } catch {
        communityPromoPopoverEl?.focus();
      }
    });
  });

  onMount(() => {
    activeDocument.addEventListener("mousedown", handleCommunityPromoPointerDown);
    activeDocument.addEventListener("keydown", handleCommunityPromoKeydown);
    return () => {
      activeDocument.removeEventListener("mousedown", handleCommunityPromoPointerDown);
      activeDocument.removeEventListener("keydown", handleCommunityPromoKeydown);
    };
  });

  function showPurchaseMenu(event: MouseEvent): void {
    const menu = new Menu();
    attachMenuApp(menu);

    menu.addItem((item) => {
      item.setTitle(t("about.license.purchaseOptionMainland"));
      item.setIcon("store");
      item.onClick(() => {
        openPurchaseUrl(LIFETIME_LICENSE_PURCHASE_URL);
      });
    });

    menu.addItem((item) => {
      item.setTitle(t("about.license.purchaseOptionPaypal"));
      item.setIcon("globe");
      const subMenu = item.setSubmenu();
      attachMenuApp(subMenu);

      subMenu.addItem((subItem) => {
        subItem.setTitle(t("about.license.purchaseOptionPaypalReader"));
        subItem.setIcon("book-open");
        subItem.onClick(() => {
          openPurchaseUrl(LIFETIME_LICENSE_PAYPAL_READER_PURCHASE_URL);
        });
      });

      subMenu.addItem((subItem) => {
        subItem.setTitle(t("about.license.purchaseOptionPaypalSeries"));
        subItem.setIcon("layers");
        subItem.onClick(() => {
          openPurchaseUrl(WEAVE_SERIES_PAYPAL_PURCHASE_URL);
        });
      });
    });

    menu.addItem((item) => {
      item.setTitle(t("about.license.purchaseOptionCommunityPromo"));
      item.setIcon("megaphone");
      item.onClick(() => {
        activeWindow.setTimeout(() => {
          openCommunityPromoPopover();
        }, 0);
      });
    });

    menu.addSeparator();

    menu.addItem((item) => {
      item.setTitle(
        t("about.license.purchaseOptionEmailSupport", { email: supportEmail })
      );
      item.setIcon("mail");
      item.onClick(() => {
        openDeveloperSupportEmail("Weave Incremental Reading purchase support");
      });
    });

    menu.showAtMouseEvent(event);
  }
</script>

<section class="standalone-ir-license-settings-panel">
  <div class="standalone-ir-license-settings-card">
    <div class="standalone-ir-license-settings-header">
      <div class="section-title-row">
        <h3 class="section-title with-accent-bar accent-purple">{t("about.license.title")}</h3>
        <button
          type="button"
          class="clickable-icon license-purchase-link"
          onclick={showPurchaseMenu}
        >
          {t("about.license.purchaseLink")}
        </button>
      </div>
      <p class="section-description">{t('about.license.notices.standaloneDescription')}</p>
    </div>

    <div class="standalone-ir-license-settings-content">
    {#if effectiveLicenseState.isPremiumActive}
      <EnhancedLicenseStatusCard
        license={currentLicense}
        app={plugin.app}
        effectiveState={effectiveLicenseState}
        showActions={true}
        onReset={resetLicense}
      />
    {/if}

    {#if !effectiveLicenseState.isPremiumActive}
      <EnhancedActivationForm
        {plugin}
        onSave={save}
        showHeader={false}
        displayState={effectiveLicenseState}
        standalone={false}
      />
    {/if}
    </div>
  </div>

  {#if communityPromoOpen}
    <div class="ir-license-community-promo-overlay" role="presentation">
      <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
      <div
        class="ir-license-community-promo-popover"
        bind:this={communityPromoPopoverEl}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ir-license-community-promo-title"
        tabindex="-1"
      >
        <div class="ir-license-community-promo-header">
          <h4 id="ir-license-community-promo-title" class="ir-license-community-promo-title">
            {t("about.license.purchaseCommunityPromoTitle")}
          </h4>
          <button
            type="button"
            class="clickable-icon ir-license-community-promo-close"
            aria-label={t("about.license.purchaseCommunityPromoClose")}
            title={t("about.license.purchaseCommunityPromoClose")}
            onclick={closeCommunityPromoPopover}
          >
            ×
          </button>
        </div>
        <p class="ir-license-community-promo-body">
          {t("about.license.purchaseCommunityPromoBody")}
        </p>
        <div class="ir-license-community-promo-actions">
          <button
            type="button"
            class="clickable-icon ir-license-community-promo-email"
            onclick={() =>
              openDeveloperSupportEmail("Weave community promotion activation code")
            }
          >
            {t("about.license.purchaseCommunityPromoEmail")}
          </button>
          <button
            type="button"
            class="clickable-icon ir-license-community-promo-dismiss"
            onclick={closeCommunityPromoPopover}
          >
            {t("about.license.purchaseCommunityPromoClose")}
          </button>
        </div>
      </div>
    </div>
  {/if}
</section>

<style>
  .standalone-ir-license-settings-panel {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .standalone-ir-license-settings-card {
    display: flex;
    flex-direction: column;
    gap: var(--size-4-4);
    padding: var(--size-4-4);
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--radius-l);
    background: color-mix(in oklab, var(--background-primary), var(--background-secondary) 26%);
  }

  .standalone-ir-license-settings-header {
    display: flex;
    flex-direction: column;
    gap: var(--size-4-1);
    min-width: 0;
  }

  .section-title-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--size-4-3);
    min-width: 0;
  }

  .section-title-row .section-title {
    flex: 1 1 auto;
    min-width: 0;
  }

  .standalone-ir-license-settings-panel button.clickable-icon.license-purchase-link,
  .standalone-ir-license-settings-panel button.clickable-icon.license-purchase-link:hover,
  .standalone-ir-license-settings-panel button.clickable-icon.license-purchase-link:focus,
  .standalone-ir-license-settings-panel button.clickable-icon.license-purchase-link:active {
    appearance: none;
    -webkit-appearance: none;
    -moz-appearance: none;
    border: none;
    border-width: 0;
    border-color: transparent;
    box-shadow: none;
    outline: none;
    background: transparent;
    background-color: transparent;
  }

  .standalone-ir-license-settings-panel button.clickable-icon.license-purchase-link {
    flex-shrink: 0;
    margin: 0;
    padding: 0;
    width: auto;
    height: auto;
    min-width: 0;
    min-height: 0;
    font: inherit;
    font-size: var(--font-ui-smaller, 0.85rem);
    color: var(--text-accent);
    text-decoration: none;
    white-space: nowrap;
    cursor: pointer;
  }

  .standalone-ir-license-settings-panel button.clickable-icon.license-purchase-link:hover {
    color: var(--text-accent-hover, var(--text-accent));
    opacity: 0.88;
  }

  .standalone-ir-license-settings-content {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: var(--size-4-4);
  }

  .section-title {
    margin: 0;
    font-size: var(--font-ui-medium);
    font-weight: 600;
    color: var(--text-normal);
  }

  .section-title.with-accent-bar {
    position: relative;
    padding-left: 16px;
  }

  .section-title.with-accent-bar::before {
    content: "";
    position: absolute;
    left: 0;
    top: 50%;
    transform: translateY(-50%);
    width: 4px;
    height: 80%;
    border-radius: var(--radius-s);
  }

  .section-title.accent-purple::before {
    background: linear-gradient(135deg, rgba(168, 85, 247, 0.8), rgba(147, 51, 234, 0.6));
  }

  .section-description {
    margin: 0;
    font-size: var(--font-ui-smaller, 0.85rem);
    color: var(--text-muted);
    line-height: 1.55;
  }

  .standalone-ir-license-settings-content :global(.enhanced-activation-form .activation-form) {
    gap: 1.1rem;
  }

  .standalone-ir-license-settings-content :global(.enhanced-activation-form .input-section:not(:first-child)) {
    display: grid;
    grid-template-columns: minmax(7rem, 9rem) minmax(0, 1fr);
    column-gap: 1rem;
    row-gap: 0.35rem;
    align-items: start;
  }

  .standalone-ir-license-settings-content :global(.enhanced-activation-form .input-section:not(:first-child) .input-label) {
    display: block;
    grid-column: 1;
    padding-top: 0.4rem;
  }

  .standalone-ir-license-settings-content :global(.enhanced-activation-form .input-section:not(:first-child) .input-hint) {
    display: none;
  }

  .standalone-ir-license-settings-content :global(.enhanced-activation-form .input-section:not(:first-child) .email-input),
  .standalone-ir-license-settings-content :global(.enhanced-activation-form .input-section:not(:first-child) .email-hint) {
    grid-column: 2;
    width: 100%;
  }

  .standalone-ir-license-settings-content :global(.enhanced-activation-form .action-section) {
    justify-content: flex-end;
  }

  .ir-license-community-promo-overlay {
    position: fixed;
    inset: 0;
    z-index: var(--layer-popover, 30);
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding: 72px 20px 20px;
    background: color-mix(in srgb, var(--background-primary) 28%, transparent);
    pointer-events: auto;
  }

  .ir-license-community-promo-popover {
    width: min(28rem, calc(100vw - 40px));
    max-height: min(70vh, 28rem);
    overflow: auto;
    display: flex;
    flex-direction: column;
    gap: var(--size-4-3, 0.75rem);
    padding: var(--size-4-4, 1rem);
    border-radius: var(--modal-radius, var(--radius-l, 12px));
    border: 1px solid var(--background-modifier-border);
    background: var(--background-primary);
    box-shadow: var(--shadow-l);
  }

  .ir-license-community-promo-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--size-4-2, 0.5rem);
  }

  .ir-license-community-promo-title {
    margin: 0;
    flex: 1 1 auto;
    min-width: 0;
    font-size: var(--font-ui-medium, 1rem);
    font-weight: 600;
    line-height: 1.4;
    color: var(--text-normal);
  }

  .ir-license-community-promo-body {
    margin: 0;
    font-size: var(--font-ui-small, 0.95rem);
    line-height: 1.65;
    color: var(--text-muted);
    white-space: pre-wrap;
  }

  .ir-license-community-promo-actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: var(--size-4-2, 0.5rem);
  }

  .standalone-ir-license-settings-panel button.clickable-icon.ir-license-community-promo-close,
  .standalone-ir-license-settings-panel button.clickable-icon.ir-license-community-promo-email,
  .standalone-ir-license-settings-panel button.clickable-icon.ir-license-community-promo-dismiss,
  .standalone-ir-license-settings-panel button.clickable-icon.ir-license-community-promo-close:hover,
  .standalone-ir-license-settings-panel button.clickable-icon.ir-license-community-promo-email:hover,
  .standalone-ir-license-settings-panel button.clickable-icon.ir-license-community-promo-dismiss:hover,
  .standalone-ir-license-settings-panel button.clickable-icon.ir-license-community-promo-close:focus,
  .standalone-ir-license-settings-panel button.clickable-icon.ir-license-community-promo-email:focus,
  .standalone-ir-license-settings-panel button.clickable-icon.ir-license-community-promo-dismiss:focus,
  .standalone-ir-license-settings-panel button.clickable-icon.ir-license-community-promo-close:active,
  .standalone-ir-license-settings-panel button.clickable-icon.ir-license-community-promo-email:active,
  .standalone-ir-license-settings-panel button.clickable-icon.ir-license-community-promo-dismiss:active {
    appearance: none;
    -webkit-appearance: none;
    -moz-appearance: none;
    border: none;
    border-width: 0;
    border-color: transparent;
    box-shadow: none;
    outline: none;
    background: transparent;
    background-color: transparent;
  }

  .standalone-ir-license-settings-panel button.clickable-icon.ir-license-community-promo-close {
    flex-shrink: 0;
    width: var(--icon-size, 1.25rem);
    height: var(--icon-size, 1.25rem);
    margin: 0;
    padding: 0;
    font-size: 1.1rem;
    line-height: 1;
    color: var(--text-muted);
    cursor: pointer;
  }

  .standalone-ir-license-settings-panel button.clickable-icon.ir-license-community-promo-email,
  .standalone-ir-license-settings-panel button.clickable-icon.ir-license-community-promo-dismiss {
    width: auto;
    height: auto;
    min-width: 0;
    min-height: 0;
    margin: 0;
    padding: 0.2rem 0.45rem;
    font: inherit;
    font-size: var(--font-ui-small, 0.95rem);
    color: var(--text-accent);
    cursor: pointer;
  }

  .standalone-ir-license-settings-panel button.clickable-icon.ir-license-community-promo-dismiss {
    color: var(--text-muted);
  }

  .standalone-ir-license-settings-panel button.clickable-icon.ir-license-community-promo-close:hover,
  .standalone-ir-license-settings-panel button.clickable-icon.ir-license-community-promo-email:hover,
  .standalone-ir-license-settings-panel button.clickable-icon.ir-license-community-promo-dismiss:hover {
    background-color: var(--background-modifier-hover);
    border-radius: var(--clickable-icon-radius, var(--radius-s, 4px));
  }

  @media (max-width: 720px) {
    .standalone-ir-license-settings-card {
      padding: var(--size-4-3);
      border-radius: var(--radius-m);
    }

    .section-title-row {
      flex-wrap: wrap;
      row-gap: var(--size-4-1);
    }

    .standalone-ir-license-settings-panel button.clickable-icon.license-purchase-link {
      white-space: normal;
    }

    .standalone-ir-license-settings-content :global(.enhanced-activation-form .input-section:not(:first-child)) {
      grid-template-columns: 1fr;
      row-gap: 0.25rem;
    }

    .standalone-ir-license-settings-content :global(.enhanced-activation-form .input-section:not(:first-child) .input-label),
    .standalone-ir-license-settings-content :global(.enhanced-activation-form .input-section:not(:first-child) .email-input),
    .standalone-ir-license-settings-content :global(.enhanced-activation-form .input-section:not(:first-child) .email-hint) {
      grid-column: 1;
    }

    .standalone-ir-license-settings-content :global(.enhanced-activation-form .action-section) {
      justify-content: center;
    }
  }
</style>
