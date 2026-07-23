# Reviewer notes

Standalone Weave Incremental Reading — notes for Obsidian community plugin review.

## Storage and paths

- Plugin data lives under the vault via Obsidian vault/adapter APIs and `plugin.loadData()` / `saveData()`.
- Runtime paths resolve from `app.vault.configDir` and `getPluginPaths(app)`; the plugin does not hardcode `.obsidian` as a fallback.
- UI preference keys use vault-scoped state (`vaultStorage`), not browser `localStorage` / `sessionStorage`.
- Topic / reading-point files are user vault content (for example `.irdeck` topic files and configured reading-point folders), not writes into the plugin install directory.

## Clipboard and DOM helpers

- Clipboard access is centralized in `src/utils/system-clipboard.ts` (web clipboard API with a temporary DOM fallback).
- Temporary DOM nodes (clipboard fallback, color/safe-area probes, floating hosts) use Obsidian `createEl` / `createDiv` on `activeDocument` for popout-window compatibility.
- Immersive paragraph mode, floating menus, and modal portals attach to `activeDocument` (not a hard-coded main-window `document`) so detached leaves keep correct host document semantics.

## Settings

- Settings UI is a Svelte panel for complex scheduling / tag-group / premium sections.
- Simple basic controls and scheduling toggles/sliders/dropdowns/text/button fields mount Obsidian native `Setting` rows (via shared `ObsidianSettingToggle` / `ObsidianSettingSlider` / `ObsidianSettingDropdown` / `ObsidianSettingText` / `ObsidianSettingButton`) so control chrome stays official. Folder pickers, dense subscription-table deck menus, and a few specialized editors remain custom.
- `StandaloneIRSettingsTab.getSettingDefinitions()` provides Obsidian 1.13+ settings search indexing via a single host definition and localized aliases, while older Obsidian builds continue to use `display()`.
- Deep links (premium CTA / in-app navigation) open the settings tab and dispatch `WeaveIncrementalReading:navigate-settings` with a target tab id.

## Premium / license

- Premium gating is feature-flag based inside the plugin; license validation uses network APIs when the user activates a key.
- Device fingerprinting uses Obsidian `Platform` plus browser canvas/WebGL signals; it does not call Node `os` / `fs` or Electron private APIs.

## Interop

- Optional collaboration with Weave main / EPUB reader goes through typed host capability checks (`app.plugins.getPlugin(...)` + duck-typed capability probes), not private Electron bridges.
- ZIP / EPUB / PDF bookmark imports are user-initiated and write into vault data folders only.
