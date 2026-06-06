import { migrateSourceFields, parseYAMLFromContent } from '../yaml-utils';

describe('migrateSourceFields', () => {
	it('preserves extra sources when migrating we_source arrays', () => {
		const content = `---
we_source:
  - [[notes/source]]
  - [[Books/demo.epub#weave-cfi=readium%3Aabc|Demo]]
we_block: ^block-1
---
Body`;

		const result = migrateSourceFields(content);
		const yaml = parseYAMLFromContent(result.content);

		expect(result.migrated).toBe(true);
		expect(yaml.we_source).toEqual([
			'![[notes/source#^block-1]]',
			'[[Books/demo.epub#weave-cfi=readium%3Aabc|Demo]]',
		]);
		expect(yaml.we_block).toBeUndefined();
	});

	it('removes we_block without rewriting the array when any source already has a block id', () => {
		const content = `---
we_source:
  - ![[notes/source#^existing-block]]
  - [[Books/demo.epub#weave-cfi=readium%3Aabc|Demo]]
we_block: ^stale-block
---
Body`;

		const result = migrateSourceFields(content);
		const yaml = parseYAMLFromContent(result.content);

		expect(result.migrated).toBe(true);
		expect(yaml.we_source).toEqual([
			'![[notes/source#^existing-block]]',
			'[[Books/demo.epub#weave-cfi=readium%3Aabc|Demo]]',
		]);
		expect(yaml.we_block).toBeUndefined();
	});
});
