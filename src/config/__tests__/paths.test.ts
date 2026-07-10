import { describe, expect, it } from "vitest";
import { toVaultAdapterPath } from "../../config/paths";

describe("toVaultAdapterPath", () => {
	it("keeps vault-relative plugin paths unchanged", () => {
		expect(
			toVaultAdapterPath(
				{ vault: { configDir: ".obsidian" } },
				".obsidian/plugins/weave-epub-reader/cache/epub-paragraph-mode-positions.json",
			),
		).toBe(
			".obsidian/plugins/weave-epub-reader/cache/epub-paragraph-mode-positions.json",
		);
	});

	it("strips Windows absolute prefixes before adapter writes", () => {
		expect(
			toVaultAdapterPath(
				{ vault: { configDir: "C:/Vault/.obsidian" } },
				"C:/Vault/.obsidian/plugins/weave-epub-reader/cache/epub-paragraph-mode-positions.json",
			),
		).toBe(
			".obsidian/plugins/weave-epub-reader/cache/epub-paragraph-mode-positions.json",
		);
	});
});
