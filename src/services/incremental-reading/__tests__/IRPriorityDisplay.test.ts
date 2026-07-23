import { describe, expect, it } from "vitest";
import {
	getIRPriorityPalette,
	getIRPriorityStyle,
	getIRPriorityTextColor,
	resolveIRPriorityTier,
} from "../IRPriorityDisplay";

describe("IRPriorityDisplay", () => {
	it("maps continuous priority into four tiers", () => {
		expect(resolveIRPriorityTier(0)).toBe("low");
		expect(resolveIRPriorityTier(3.9)).toBe("low");
		expect(resolveIRPriorityTier(4)).toBe("medium");
		expect(resolveIRPriorityTier(5.9)).toBe("medium");
		expect(resolveIRPriorityTier(6)).toBe("high");
		expect(resolveIRPriorityTier(7.9)).toBe("high");
		expect(resolveIRPriorityTier(8)).toBe("urgent");
		expect(resolveIRPriorityTier(10)).toBe("urgent");
	});

	it("falls back to medium when priority is missing or invalid", () => {
		expect(resolveIRPriorityTier(undefined)).toBe("medium");
		expect(resolveIRPriorityTier(null)).toBe("medium");
		expect(resolveIRPriorityTier(Number.NaN)).toBe("medium");
	});

	it("returns soft pastel palette pairs per tier", () => {
		expect(getIRPriorityPalette(9)).toEqual({
			background: "#FCE8EC",
			text: "#C6284A",
		});
		expect(getIRPriorityPalette(7)).toEqual({
			background: "#FFF3E0",
			text: "#C2760A",
		});
		expect(getIRPriorityPalette(5)).toEqual({
			background: "#EEF6E8",
			text: "#4A7C2C",
		});
		expect(getIRPriorityPalette(2)).toEqual({
			background: "#E8EEF6",
			text: "#4A6FA5",
		});
	});

	it("exposes className aligned with tier for badge CSS", () => {
		expect(getIRPriorityStyle(9.5).className).toBe("urgent");
		expect(getIRPriorityStyle(6.5).className).toBe("high");
		expect(getIRPriorityStyle(4.5).className).toBe("medium");
		expect(getIRPriorityStyle(1).className).toBe("low");
	});

	it("uses muted token when priority text color is unset", () => {
		expect(getIRPriorityTextColor(undefined)).toBe("var(--text-muted)");
		expect(getIRPriorityTextColor(8)).toBe("#C6284A");
	});
});
