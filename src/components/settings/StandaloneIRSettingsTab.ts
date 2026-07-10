import type { App, Plugin } from "obsidian";
import { PluginSettingTab } from "obsidian";
import type { IncrementalReadingSettingsHost } from "./types/incremental-reading-settings-host";

type StandaloneIRSettingsPlugin = Plugin & IncrementalReadingSettingsHost;

export class StandaloneIRSettingsTab extends PluginSettingTab {
	plugin: StandaloneIRSettingsPlugin;

	constructor(app: App, plugin: StandaloneIRSettingsPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		void this.renderDisplay();
	}

	private async renderDisplay(): Promise<void> {
		const { containerEl } = this;
		containerEl.empty();

		const { mount } = await import("svelte");
		const { default: Component } = await import(
			"./StandaloneIRSettingsPanel.svelte"
		);
		mount(Component, {
			target: containerEl,
			props: {
				plugin: this.plugin,
			},
		});
	}
}
