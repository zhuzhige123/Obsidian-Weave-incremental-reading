import { describe, expect, it } from "vitest";
import { parseDateRange, parseSearchQuery } from "../search-parser";

describe("parseSearchQuery", () => {
	it("parses float priorities without leftover text", () => {
		const query = parseSearchQuery("priority:2.5 deck:Alpha");
		expect(query.priorities).toEqual([2.5]);
		expect(query.decks).toEqual(["Alpha"]);
		expect(query.text).toEqual([]);
	});

	it("parses folder filters and -state exclusions without positive bleed", () => {
		const query = parseSearchQuery(
			'folder:"Books/Fiction" -state:suspended -folder:Archive',
		);
		expect(query.folders).toEqual(["Books/Fiction"]);
		expect(query.states).toEqual([]);
		expect(query.excludeFolders).toEqual(["Archive"]);
		expect(query.excludeStatuses).toEqual(["suspended"]);
	});

	it("does not silently consume card-only accuracy/attempts tokens as filters", () => {
		const query = parseSearchQuery("accuracy:high attempts:3 hello");
		expect(query.text).toEqual(["accuracy:high", "attempts:3", "hello"]);
	});
});

describe("parseDateRange", () => {
	it("makes > and < exclusive of the named day", () => {
		expect(parseDateRange(">2026-07-16")).toEqual({ from: "2026-07-17" });
		expect(parseDateRange("<2026-07-16")).toEqual({ to: "2026-07-15" });
	});

	it("keeps single-day and month ranges inclusive", () => {
		expect(parseDateRange("2026-07-16")).toEqual({
			from: "2026-07-16",
			to: "2026-07-16",
		});
		expect(parseDateRange("2026-07")).toEqual({
			from: "2026-07-01",
			to: "2026-07-31",
		});
	});
});
