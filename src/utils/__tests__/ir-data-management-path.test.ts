import { describe, expect, it } from "vitest";
import { formatIRDataManagementPathLabel } from "../ir-data-management-path";

describe("formatIRDataManagementPathLabel", () => {
	it("shows path relative to canonical dir when under base", () => {
		const result = formatIRDataManagementPathLabel(
			"weave Incremental reading/points/Topic.irdeck",
			"weave Incremental reading/points",
		);
		expect(result.display).toBe("Topic.irdeck");
		expect(result.full).toBe("weave Incremental reading/points/Topic.irdeck");
	});

	it("truncates long paths outside base dir", () => {
		const result = formatIRDataManagementPathLabel(
			"INBOX/Clippings/weave Incremental reading/points/Topic.irdeck",
			"weave Incremental reading/points",
		);
		expect(result.display).toBe("…/points/Topic.irdeck");
	});

	it("keeps short paths as-is", () => {
		const result = formatIRDataManagementPathLabel("Topics/A.irdeck");
		expect(result.display).toBe("Topics/A.irdeck");
	});
});
