import type { App } from "obsidian";
import type { IRBlock } from "../../../types/ir-types";
import { countWords, estimateReadingTime } from "../../../utils/reading-utils";
import { IRStorageService } from "../IRStorageService";

export interface ParagraphTopicQueueProgress {
	queueDone: number;
	queueTotal: number;
}

export function estimateSegmentReadingSeconds(text: string): number {
	const words = countWords(String(text || ""));
	const minutes = estimateReadingTime(words);
	return Math.max(30, Math.round(minutes * 60));
}

function isBlockDueToday(block: IRBlock, todayKey: string): boolean {
	if (block.state === "new") {
		return true;
	}
	if (!block.nextReview) {
		return false;
	}
	const reviewDate = String(block.nextReview).split("T")[0];
	return reviewDate <= todayKey;
}

function isBlockCompletedToday(block: IRBlock, todayKey: string): boolean {
	if (!block.lastReview) {
		return false;
	}
	return String(block.lastReview).split("T")[0] === todayKey;
}

export async function resolveTopicQueueProgress(
	app: App,
	topicId: string
): Promise<ParagraphTopicQueueProgress | null> {
	const normalizedTopicId = String(topicId || "").trim();
	if (!normalizedTopicId) {
		return null;
	}

	const storage = new IRStorageService(app);
	await storage.initialize();
	const deck = await storage.getDeckById(normalizedTopicId);
	if (!deck) {
		return null;
	}

	const blockIdSet = new Set(deck.blockIds || []);
	const todayKey = new Date().toISOString().split("T")[0];
	const dueBlocks: IRBlock[] = [];

	if (blockIdSet.size > 0) {
		const allBlocks = await storage.getAllBlocks();
		for (const blockId of blockIdSet) {
			const block = allBlocks[blockId];
			if (block && isBlockDueToday(block, todayKey)) {
				dueBlocks.push(block);
			}
		}
	} else {
		const deckPath = String(deck.path || normalizedTopicId).trim();
		const allBlocks = Object.values(await storage.getAllBlocks());
		for (const block of allBlocks) {
			if (block.deckPath !== normalizedTopicId && block.deckPath !== deckPath) {
				continue;
			}
			if (isBlockDueToday(block, todayKey)) {
				dueBlocks.push(block);
			}
		}
	}

	const queueTotal = dueBlocks.length;
	const queueDone = dueBlocks.filter((block) => isBlockCompletedToday(block, todayKey)).length;
	return { queueDone, queueTotal };
}

export async function recordLegacyBlockInteraction(
	app: App,
	blockId: string,
	readingTimeSeconds: number
): Promise<void> {
	const normalizedId = String(blockId || "").trim();
	if (!normalizedId) {
		return;
	}

	const storage = new IRStorageService(app);
	await storage.initialize();
	const block = await storage.getBlock(normalizedId);
	if (!block) {
		return;
	}

	const nowIso = new Date().toISOString();
	block.reviewCount = (block.reviewCount || 0) + 1;
	block.lastReview = nowIso;
	block.totalReadingTime = (block.totalReadingTime || 0) + Math.max(0, readingTimeSeconds);
	block.updatedAt = nowIso;
	await storage.saveBlock(block);
}
