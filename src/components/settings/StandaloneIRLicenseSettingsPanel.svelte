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

  interface Props {
    plugin: any;
  }

  let { plugin }: Props = $props();
  let t = $derived($tr);

  let stateVersion = $state(0);
  let isRemoving = $state(false);

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
</script>

<section class="standalone-ir-license-settings-panel">
  <div class="standalone-ir-license-settings-card">
    <div class="standalone-ir-license-settings-header">
      <h3 class="section-title with-accent-bar accent-purple">{t("about.license.title")}</h3>
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

  @media (max-width: 720px) {
    .standalone-ir-license-settings-card {
      padding: var(--size-4-3);
      border-radius: var(--radius-m);
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
