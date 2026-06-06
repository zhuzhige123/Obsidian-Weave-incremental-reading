import { compareGridTimelineEntries } from '../grid-timeline-utils';

describe('compareGridTimelineEntries', () => {
	it('sorts newer days before older days', () => {
		const newer = {
			daySortValue: Date.parse('2026-04-09T00:00:00.000Z'),
			timestamp: Date.parse('2026-04-09T09:00:00.000Z'),
			uuid: 'newer'
		};
		const older = {
			daySortValue: Date.parse('2026-04-08T00:00:00.000Z'),
			timestamp: Date.parse('2026-04-08T23:00:00.000Z'),
			uuid: 'older'
		};

		expect(compareGridTimelineEntries(newer, older)).toBeLessThan(0);
	});

	it('sorts newer cards first within the same day', () => {
		const justCreated = {
			daySortValue: Date.parse('2026-04-09T00:00:00.000Z'),
			timestamp: Date.parse('2026-04-09T15:30:00.000Z'),
			uuid: 'new-card'
		};
		const olderToday = {
			daySortValue: Date.parse('2026-04-09T00:00:00.000Z'),
			timestamp: Date.parse('2026-04-09T09:00:00.000Z'),
			uuid: 'old-card'
		};

		expect(compareGridTimelineEntries(justCreated, olderToday)).toBeLessThan(0);
	});

	it('uses uuid as a stable tie breaker', () => {
		const a = {
			daySortValue: Date.parse('2026-04-09T00:00:00.000Z'),
			timestamp: Date.parse('2026-04-09T09:00:00.000Z'),
			uuid: 'a-card'
		};
		const b = {
			daySortValue: Date.parse('2026-04-09T00:00:00.000Z'),
			timestamp: Date.parse('2026-04-09T09:00:00.000Z'),
			uuid: 'b-card'
		};

		expect(compareGridTimelineEntries(a, b)).toBeLessThan(0);
	});
});
