import {
	createContentWithMetadata,
	getCardMetadata,
	parseYAMLFromContent,
	setCardProperties,
} from "../yaml-utils";

describe("yaml created field normalization", () => {
	it("writes created instead of legacy we_created when creating content", () => {
		const content = createContentWithMetadata(
			{ we_created: "2026-04-09T12:00:00.000Z" },
			"Body"
		);
		const yaml = parseYAMLFromContent(content);

		expect(yaml.created).toBe("2026-04-09T12:00:00.000Z");
		expect(yaml.we_created).toBeUndefined();
	});

	it("migrates legacy we_created to created when updating YAML", () => {
		const content = `---
we_type: basic
we_created: 2026-04-09T12:00:00.000Z
---
Body`;

		const nextContent = setCardProperties(content, { we_priority: 3 });
		const yaml = parseYAMLFromContent(nextContent);

		expect(yaml.created).toBe("2026-04-09T12:00:00.000Z");
		expect(yaml.we_created).toBeUndefined();
		expect(yaml.we_priority).toBe(3);
	});

	it("reads legacy we_created through the canonical created field", () => {
		const content = `---
we_created: 2026-04-09T12:00:00.000Z
---
Body`;

		const metadata = getCardMetadata(content);

		expect(metadata.created).toBe("2026-04-09T12:00:00.000Z");
		expect(metadata.we_created).toBeUndefined();
	});
});
