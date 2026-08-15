import { describe, expect, it } from "vitest";
import { renderBouncingBallsLoading } from "../bouncing-balls-loading";

describe("renderBouncingBallsLoading", () => {
	it("renders centered bounce markup with message", () => {
		const parent = document.createElement("div");
		const root = renderBouncingBallsLoading(parent, {
			message: "正在加载日历...",
			className: "weave-calendar-loading",
		});

		expect(parent.children).toHaveLength(1);
		expect(root.classList.contains("bouncing-balls-loader")).toBe(true);
		expect(root.classList.contains("weave-calendar-loading")).toBe(true);
		expect(root.getAttribute("role")).toBe("status");
		expect(root.querySelectorAll(".bouncing-balls-loader__circle")).toHaveLength(3);
		expect(root.querySelectorAll(".bouncing-balls-loader__shadow")).toHaveLength(3);
		expect(root.querySelector(".bouncing-balls-loader__message")?.textContent).toBe(
			"正在加载日历...",
		);
	});

	it("supports compact mode without message", () => {
		const parent = document.createElement("div");
		const root = renderBouncingBallsLoading(parent, { compact: true });

		expect(root.classList.contains("bouncing-balls-loader--compact")).toBe(true);
		expect(root.querySelector(".bouncing-balls-loader__message")).toBeNull();
	});
});
