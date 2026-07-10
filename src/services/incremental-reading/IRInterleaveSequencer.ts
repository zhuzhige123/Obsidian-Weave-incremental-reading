import type { IRScheduleSortableItem } from "./IRScheduleItemSort";

export type IRInterleaveProfile = "off" | "soft" | "related-soft";

export interface IRInterleaveSequencerOptions {
	maxConsecutiveSameTopic?: number;
	maxTopicSharePercent?: number;
}

function resolveTopicKey(
	item: IRScheduleSortableItem & { topicKey?: string; sourceFile?: string },
): string {
	return (
		String(item.topicKey || item.sourceFile || item.id || "").trim() ||
		"unknown"
	);
}

function resolveRelatedGroup(
	item: IRScheduleSortableItem & {
		topicKey?: string;
		tagGroupId?: string;
		sourceFile?: string;
	},
): string {
	const tagGroup = String(item.tagGroupId || "").trim();
	if (tagGroup && tagGroup !== "default") {
		return `tag:${tagGroup}`;
	}
	return resolveTopicKey(item);
}

function areRelated(
	left: IRScheduleSortableItem & {
		topicKey?: string;
		tagGroupId?: string;
		sourceFile?: string;
	},
	right: IRScheduleSortableItem & {
		topicKey?: string;
		tagGroupId?: string;
		sourceFile?: string;
	},
): boolean {
	return resolveRelatedGroup(left) === resolveRelatedGroup(right);
}

/**
 * 在优先级大致有序的前提下做软交错，不改变成员集合。
 */
export function sequenceItemsForDailyReading<T extends IRScheduleSortableItem>(
	items: T[],
	profile: IRInterleaveProfile,
	options?: IRInterleaveSequencerOptions,
): T[] {
	if (profile === "off" || items.length <= 2) {
		return items;
	}

	const maxRun = Math.max(1, options?.maxConsecutiveSameTopic ?? 3);
	const maxTopicShare = Math.max(
		40,
		Math.min(90, options?.maxTopicSharePercent ?? 60),
	);
	const sequenced = [...items];
	const total = sequenced.length;

	for (let index = 1; index < sequenced.length; index++) {
		const current = sequenced[index];
		const previous = sequenced[index - 1];
		if (!current || !previous) {
			continue;
		}

		let runLength = 1;
		for (let back = index - 2; back >= 0; back--) {
			const earlier = sequenced[back];
			if (!earlier) {
				break;
			}
			if (profile === "related-soft") {
				if (!areRelated(earlier, current)) {
					break;
				}
			} else if (resolveTopicKey(earlier) !== resolveTopicKey(current)) {
				break;
			}
			runLength += 1;
		}

		const sameTopicCount = sequenced
			.slice(0, index + 1)
			.filter(
				(item) => resolveTopicKey(item) === resolveTopicKey(current),
			).length;
		const topicShare = total > 0 ? (sameTopicCount / total) * 100 : 0;
		const needsSwap = runLength >= maxRun || topicShare > maxTopicShare;
		if (!needsSwap) {
			continue;
		}

		let swapIndex = -1;
		for (let candidate = index + 1; candidate < sequenced.length; candidate++) {
			const next = sequenced[candidate];
			if (!next) {
				continue;
			}
			if (profile === "related-soft") {
				if (!areRelated(next, current) && !areRelated(next, previous)) {
					swapIndex = candidate;
					break;
				}
			} else if (resolveTopicKey(next) !== resolveTopicKey(current)) {
				swapIndex = candidate;
				break;
			}
		}

		if (swapIndex > index) {
			const temp = sequenced[index];
			sequenced[index] = sequenced[swapIndex];
			sequenced[swapIndex] = temp;
		}
	}

	return sequenced;
}
