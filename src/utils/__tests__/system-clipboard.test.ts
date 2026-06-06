import { describe, expect, it, vi } from "vitest";
import { writeSystemClipboardText } from "../system-clipboard";

describe("system-clipboard", () => {
	it("writes text through navigator.clipboard when available", async () => {
		const writeText = vi.fn().mockResolvedValue(undefined);
		vi.stubGlobal("navigator", {
			clipboard: { writeText },
		});

		await expect(writeSystemClipboardText("hello")).resolves.toBe(true);
		expect(writeText).toHaveBeenCalledWith("hello");
	});
});
