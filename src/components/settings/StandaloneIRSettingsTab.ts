import type { App, Plugin } from "obsidian";
import { PluginSettingTab } from "obsidian";
import {
	STANDALONE_IR_SETTINGS_NAVIGATE_EVENT,
	buildStandaloneIRSettingsSearchAliases,
	resolveStandaloneIRSettingsTabId,
	type StandaloneIRSettingsTabId,
} from "./standalone-ir-settings-search";
import type { IncrementalReadingSettingsHost } from "./types/incremental-reading-settings-host";

type StandaloneIRSettingsPlugin = Plugin & IncrementalReadingSettingsHost;

/**
 * Obsidian 1.13+ declarative settings / search indexing shape.
 * Kept structural so older `obsidian` typings still compile.
 */
type IRSettingDefinition = {
	name: string;
	desc?: string;
	aliases?: string[];
	render?: (setting: { settingEl: HTMLElement }) => void;
	action?: () => void;
};

export class StandaloneIRSettingsTab extends PluginSettingTab {
	plugin: StandaloneIRSettingsPlugin;
	private mountedComponent: Parameters<
		typeof import("svelte").unmount
	>[0] | null = null;
	private renderToken = 0;
	private pendingInitialTab: StandaloneIRSettingsTabId | null = null;

	constructor(app: App, plugin: StandaloneIRSettingsPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	/**
	 * Obsidian 1.13+: used for settings search indexing and rendering.
	 * Older builds ignore this and continue to call {@link display}.
	 *
	 * One host definition keeps a single Svelte composition while aliases make
	 * major settings discoverable in Obsidian's global settings search.
	 */
	getSettingDefinitions(): IRSettingDefinition[] {
		const pluginName =
			this.plugin.manifest?.name || "Weave Incremental Reading";
		const pluginDescription =
			this.plugin.manifest?.description ||
			"Incremental reading settings for topics, scheduling, and source tracing.";

		return [
			{
				name: pluginName,
				desc: pluginDescription,
				aliases: buildStandaloneIRSettingsSearchAliases(),
				render: () => {
					void this.renderDisplay();
				},
			},
		];
	}

	display(): void {
		void this.renderDisplay();
	}

	hide(): void {
		void this.teardownMountedComponent();
	}

	/** Open the settings panel focused on a specific tab (premium CTA, commands). */
	openTab(tab: StandaloneIRSettingsTabId): void {
		this.pendingInitialTab = tab;
		void this.renderDisplay();
		window.setTimeout(() => {
			window.dispatchEvent(
				new CustomEvent(STANDALONE_IR_SETTINGS_NAVIGATE_EVENT, {
					detail: { tab },
				}),
			);
		}, 0);
	}

	private async teardownMountedComponent(): Promise<void> {
		const component = this.mountedComponent;
		this.mountedComponent = null;
		if (!component) {
			return;
		}
		try {
			const { unmount } = await import("svelte");
			await unmount(component);
		} catch {
			// Ignore unmount races while switching settings tabs.
		}
	}

	private async renderDisplay(): Promise<void> {
		const token = ++this.renderToken;
		await this.teardownMountedComponent();
		if (token !== this.renderToken) {
			return;
		}

		const { containerEl } = this;
		containerEl.empty();
		containerEl.addClass("weave-ir-settings-tab");

		const initialTab =
			resolveStandaloneIRSettingsTabId(this.pendingInitialTab) || undefined;
		this.pendingInitialTab = null;

		const { mount } = await import("svelte");
		if (token !== this.renderToken) {
			return;
		}

		const { default: Component } = await import(
			"./StandaloneIRSettingsPanel.svelte"
		);
		if (token !== this.renderToken) {
			return;
		}

		this.mountedComponent = mount(Component, {
			target: containerEl,
			props: {
				plugin: this.plugin,
				initialTab,
			},
		});
	}
}
