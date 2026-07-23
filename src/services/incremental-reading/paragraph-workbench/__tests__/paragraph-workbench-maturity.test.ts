import { afterEach, describe, expect, it, vi } from "vitest";

describe("paragraph-workbench-maturity", () => {
	afterEach(() => {
		vi.resetModules();
		vi.doUnmock("../../../../utils/i18n");
	});

	it("labels surfaces with the experimental badge while maturity is experimental", async () => {
		vi.doMock("../../../../utils/i18n", () => ({
			i18n: {
				t: (key: string) =>
					key === "irParagraphWorkbench.experimentalBadge"
						? "Experimental"
						: key,
			},
		}));

		const {
			isParagraphWorkbenchExperimental,
			labelParagraphWorkbenchSurface,
			PARAGRAPH_WORKBENCH_MATURITY,
		} = await import("../paragraph-workbench-maturity");

		expect(PARAGRAPH_WORKBENCH_MATURITY).toBe("experimental");
		expect(isParagraphWorkbenchExperimental()).toBe(true);
		expect(labelParagraphWorkbenchSurface("Paragraph workbench")).toBe(
			"Paragraph workbench · Experimental",
		);
	});

	it("returns empty labels unchanged", async () => {
		vi.doMock("../../../../utils/i18n", () => ({
			i18n: {
				t: () => "Experimental",
			},
		}));

		const { labelParagraphWorkbenchSurface } = await import(
			"../paragraph-workbench-maturity"
		);
		expect(labelParagraphWorkbenchSurface("")).toBe("");
		expect(labelParagraphWorkbenchSurface("   ")).toBe("");
	});
});
