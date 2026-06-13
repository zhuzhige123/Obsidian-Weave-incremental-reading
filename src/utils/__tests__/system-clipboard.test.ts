import { describe, expect, it, vi } from "vitest";
import { readSystemClipboardText, writeSystemClipboardText } from "../system-clipboard";

describe("system-clipboard", () => {
	it("writes text through navigator.clipboard when available", async () => {
		const writeText = vi.fn().mockResolvedValue(undefined);
		vi.stubGlobal("navigator", {
			clipboard: { writeText },
		});

		await expect(writeSystemClipboardText("hello")).resolves.toBe(true);
		expect(writeText).toHaveBeenCalledWith("hello");
	});

	it("reads text through navigator.clipboard when available", async () => {
		const readText = vi.fn().mockResolvedValue(" pasted ");
		vi.stubGlobal("navigator", {
			clipboard: { readText },
		});

		await expect(readSystemClipboardText()).resolves.toBe(" pasted ");
		expect(readText).toHaveBeenCalledTimes(1);
	});

	it("returns empty string when clipboard read is denied", async () => {
		const readText = vi.fn().mockRejectedValue(new Error("denied"));
		vi.stubGlobal("navigator", {
			clipboard: { readText },
		});

		await expect(readSystemClipboardText()).resolves.toBe("");
	});
});
