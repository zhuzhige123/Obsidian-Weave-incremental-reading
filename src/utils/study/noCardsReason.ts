export type DeckNoCardsReason = "empty" | "all-learned" | "no-due";

interface ResolveDeckNoCardsReasonOptions {
	physicalTotalCards: number;
	isComplete: boolean;
	learningCards: number;
	reviewCards: number;
	newCards: number;
	learnedNewCardsToday: number;
	newCardsPerDay: number;
}

/**
 * 这里只负责“牌组页点击后无卡可学”时的展示分类。
 * 庆祝结算不应该在这里决定，而应该只由学习会话完成事件触发。
 */
export function resolveDeckNoCardsReason({
	physicalTotalCards,
	isComplete,
	learningCards,
	reviewCards,
	newCards,
	learnedNewCardsToday,
	newCardsPerDay,
}: ResolveDeckNoCardsReasonOptions): DeckNoCardsReason {
	if (physicalTotalCards === 0) {
		return "empty";
	}

	if (isComplete && (learningCards > 0 || reviewCards > 0 || newCards === 0)) {
		return "all-learned";
	}

	if (newCards > 0 && learnedNewCardsToday >= newCardsPerDay) {
		return "all-learned";
	}

	return "no-due";
}
