import { describe, expect, it, vi } from "vitest";

vi.mock("../../../utils/i18n", () => ({
	i18n: {
		t: (key: string) => key,
	},
}));

describe("StandaloneIRSettingsTab", () => {
	it("exposes getSettingDefinitions with searchable aliases for Obsidian 1.13+", async () => {
		const { StandaloneIRSettingsTab } = await import(
			"../StandaloneIRSettingsTab"
		);
		const { buildStandaloneIRSettingsSearchAliases } = await import(
			"../standalone-ir-settings-search"
		);

		const plugin = {
			manifest: {
				name: "Weave Incremental Reading",
				description: "Standalone IR settings",
			},
			settings: {},
		};

		const tab = new StandaloneIRSettingsTab({} as never, plugin as never);
		const definitions = tab.getSettingDefinitions();

		expect(definitions).toHaveLength(1);
		expect(definitions[0]?.name).toBe("Weave Incremental Reading");
		expect(definitions[0]?.desc).toBe("Standalone IR settings");
		expect(typeof definitions[0]?.render).toBe("function");
		expect(definitions[0]?.aliases).toEqual(
			expect.arrayContaining(buildStandaloneIRSettingsSearchAliases()),
		);
	});
});
