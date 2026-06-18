import { describe, expect, it } from "vitest";
import { formatIRDataManagementPathLabel } from "../ir-data-management-path";

describe("formatIRDataManagementPathLabel", () => {
	it("shows path relative to canonical dir when under base", () => {
		const result = formatIRDataManagementPathLabel(
			"weave/incremental-reading/points/Topic.irdeck",
			"weave/incremental-reading/points"
		);
		expect(result.display).toBe("Topic.irdeck");
		expect(result.full).toBe("weave/incremental-reading/points/Topic.irdeck");
	});

	it("truncates long paths outside base dir", () => {
		const result = formatIRDataManagementPathLabel(
			"INBOX/Clippings/weave/incremental-reading/points/Topic.irdeck",
			"weave/incremental-reading/points"
		);
		expect(result.display).toBe("…/points/Topic.irdeck");
	});

	it("keeps short paths as-is", () => {
		const result = formatIRDataManagementPathLabel("Topics/A.irdeck");
		expect(result.display).toBe("Topics/A.irdeck");
	});
});
