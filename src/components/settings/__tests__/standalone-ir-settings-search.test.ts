import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../utils/i18n", () => ({
	i18n: {
		t: (key: string) => {
			const labels: Record<string, string> = {
				"irSettings.standalone.tabs.basic": "Basic",
				"irSettings.standalone.language.title": "Plugin language",
				"irSettings.standalone.language.description": "UI language",
				"irSettings.scheduleTitle": "Core scheduling",
				"irSettings.advancedTitle": "Advanced scheduling",
				"irSettings.tagSourceMarkdownYamlKeyLabel": "Markdown tags YAML key",
				"irSettings.tagSourceMarkdownYamlKeyDesc": "Which YAML key stores tags",
				"irSettings.standalone.tabs.license": "License",
				"irSettings.standalone.tabs.about": "About",
			};
			return labels[key] || key;
		},
	},
}));

describe("standalone-ir-settings-search", () => {
	beforeEach(() => {
		vi.resetModules();
	});

	it("builds searchable aliases from localized labels and english fallbacks", async () => {
		const {
			buildStandaloneIRSettingsSearchAliases,
			listStandaloneIRSettingsSearchEntries,
		} = await import("../standalone-ir-settings-search");

		const aliases = buildStandaloneIRSettingsSearchAliases(["extra-alias"]);
		expect(aliases).toContain("incremental reading");
		expect(aliases).toContain("IR");
		expect(aliases).toContain("Plugin language");
		expect(aliases).toContain("Core scheduling");
		expect(aliases).toContain("Markdown tags YAML key");
		expect(aliases).toContain("language");
		expect(aliases).toContain("extra-alias");

		const entries = listStandaloneIRSettingsSearchEntries();
		expect(entries.some((entry) => entry.tab === "license")).toBe(true);
		expect(entries.some((entry) => entry.tab === "advanced")).toBe(true);
	});

	it("resolves known settings tab ids only", async () => {
		const { resolveStandaloneIRSettingsTabId } = await import(
			"../standalone-ir-settings-search"
		);
		expect(resolveStandaloneIRSettingsTabId("license")).toBe("license");
		expect(resolveStandaloneIRSettingsTabId("core-scheduling")).toBe(
			"core-scheduling",
		);
		expect(resolveStandaloneIRSettingsTabId("nope")).toBeNull();
		expect(resolveStandaloneIRSettingsTabId(null)).toBeNull();
	});
});
