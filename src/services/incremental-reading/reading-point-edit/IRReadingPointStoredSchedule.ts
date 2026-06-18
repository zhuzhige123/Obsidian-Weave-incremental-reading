import type { App } from "obsidian";
import { migrateToIRBlockV4 } from "../../../types/ir-types";
import {
	IREpubBookmarkTaskService,
	isEpubBookmarkTaskId,
} from "../IREpubBookmarkTaskService";
import {
	IRPdfBookmarkTaskService,
	isPdfBookmarkTaskId,
} from "../IRPdfBookmarkTaskService";
import { IRPointDataReadService } from "../IRPointDataReadService";
import { IRStorageService } from "../IRStorageService";

export interface IRReadingPointStoredSchedule {
	priority: number;
	nextRepDate: number;
	deckId: string;
}

export async function resolveReadingPointStoredSchedule(
	app: App,
	pointId: string
): Promise<IRReadingPointStoredSchedule | null> {
	const normalizedPointId = String(pointId || "").trim();
	if (!normalizedPointId) {
		return null;
	}

	const storage = new IRStorageService(app);
	const pointRead = new IRPointDataReadService(app);
	const pointStorage = pointRead.getPointStorage();
	await Promise.all([storage.initialize(), pointStorage.initialize()]);

	const [snapshot, topicIds] = await Promise.all([
		pointStorage.getPointSnapshotById(normalizedPointId),
		pointRead.getPointTopicIds(normalizedPointId),
	]);

	if (isPdfBookmarkTaskId(normalizedPointId)) {
		const pdfService = new IRPdfBookmarkTaskService(app);
		await pdfService.initialize();
		const task = await pdfService.getTask(normalizedPointId);
		if (!task) {
			return null;
		}
		return {
			priority: Number(task.priorityUi ?? task.priorityEff ?? 5),
			nextRepDate: Number(task.nextRepDate || 0),
			deckId: String(topicIds[0] || task.topicId || task.deckId || "").trim(),
		};
	}

	if (isEpubBookmarkTaskId(normalizedPointId)) {
		const epubService = new IREpubBookmarkTaskService(app);
		await epubService.initialize();
		const task = await epubService.getTask(normalizedPointId);
		if (!task) {
			return null;
		}
		return {
			priority: Number(task.priorityUi ?? task.priorityEff ?? 5),
			nextRepDate: Number(task.nextRepDate || 0),
			deckId: String(topicIds[0] || task.topicId || task.deckId || "").trim(),
		};
	}

	const chunk = await storage.getChunkData(normalizedPointId);
	if (chunk) {
		return {
			priority: Number(chunk.priorityUi ?? chunk.priorityEff ?? 5),
			nextRepDate: Number(chunk.nextRepDate || 0),
			deckId: String(topicIds[0] || chunk.topicIds?.[0] || chunk.deckIds?.[0] || "").trim(),
		};
	}

	const block = await storage.getBlock(normalizedPointId);
	if (block) {
		const migrated = migrateToIRBlockV4(block);
		return {
			priority: Number(block.priorityUi ?? block.priorityEff ?? 5),
			nextRepDate: Number(migrated.nextRepDate || 0),
			deckId: String(topicIds[0] || block.deckPath || "").trim(),
		};
	}

	if (!snapshot) {
		return null;
	}

	return {
		priority: Number(snapshot.point.schedule.manualPriority ?? snapshot.point.schedule.priorityScore ?? 5),
		nextRepDate: Number(
			snapshot.point.schedule.nextReviewAt
				? Date.parse(snapshot.point.schedule.nextReviewAt)
				: 0
		),
		deckId: String(topicIds[0] || snapshot.topicId || "").trim(),
	};
}
