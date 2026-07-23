import type { App } from "obsidian";
import type { IRPointSnapshot } from "../../types/ir-point-storage-types";
import { isHttpUrl } from "../obsidian/obsidian-open-web-url";
import type { IRPointSuggestItem } from "../../modals/IRPointSuggestModal";
import { IR_WEB_CHUNK_META_URL_KEY } from "./ir-web-reading-point";
import { extractReadingPointDisplayName } from "./IRReadingPointTitle";
import {
	buildParentRelationIndex,
	computeParentCompletionProgress,
	type IRPointParentProgress,
	type IRPointParentRelationIndex,
	resolveContinuousReadingRelatedIds,
} from "./IRPointParentRelation";
import { getSharedIRPointStorageService } from "./IRPointStorageService";

export interface IRPointParentRelationRuntime {
	index: IRPointParentRelationIndex;
	progressByParentId: Map<string, IRPointParentProgress>;
	titleByPointId: Map<string, string>;
	snapshotsById: Map<string, IRPointSnapshot>;
}

function pointTitleFromSnapshot(snapshot: IRPointSnapshot): string {
	const raw =
		String(snapshot.point.userData?.title || "").trim() ||
		String(snapshot.point.source?.title || "").trim() ||
		String(snapshot.point.id || "").trim();
	return extractReadingPointDisplayName(raw) || raw || snapshot.point.id;
}

function readPointMetadataString(
	snapshot: IRPointSnapshot,
	key: string,
): string {
	const value = snapshot.point.metadata?.[key];
	return typeof value === "string" ? value.trim() : "";
}

/**
 * Parent picker rows are IR reading points only (never vault file browser).
 * Title = reading-point display name; subtitle = path/URL when it helps disambiguate.
 */
export function formatParentPickerSuggestDisplay(snapshot: IRPointSnapshot): {
	title: string;
	subtitle?: string;
} {
	const pointTitle = pointTitleFromSnapshot(snapshot) || snapshot.point.id;
	const sourcePath = String(snapshot.point.source?.path || "").trim();
	const resumeLink = readPointMetadataString(snapshot, "resumeLink");
	const webUrl = readPointMetadataString(snapshot, IR_WEB_CHUNK_META_URL_KEY);

	const httpHint = [webUrl, resumeLink, sourcePath].find((value) =>
		isHttpUrl(value),
	);
	if (httpHint) {
		return {
			title: pointTitle,
			subtitle: httpHint !== pointTitle ? httpHint : undefined,
		};
	}

	if (sourcePath && sourcePath !== pointTitle) {
		return {
			title: pointTitle,
			subtitle: sourcePath,
		};
	}

	return { title: pointTitle };
}

export function buildParentRelationRuntime(
	snapshots: IRPointSnapshot[],
): IRPointParentRelationRuntime {
	const snapshotsById = new Map<string, IRPointSnapshot>();
	const titleByPointId = new Map<string, string>();
	const relationPoints: Array<{ id: string; parentPointId?: string | null }> =
		[];

	for (const snapshot of snapshots) {
		const id = String(snapshot?.point?.id || "").trim();
		if (!id) {
			continue;
		}
		snapshotsById.set(id, snapshot);
		titleByPointId.set(id, pointTitleFromSnapshot(snapshot));
		relationPoints.push({
			id,
			parentPointId: snapshot.point.relations?.parentPointId,
		});
	}

	const index = buildParentRelationIndex(relationPoints);
	const progressByParentId = new Map<string, IRPointParentProgress>();

	for (const [parentId, childIds] of index.childrenByParentId) {
		const children = childIds.map((childId) => {
			const child = snapshotsById.get(childId)?.point;
			return {
				status: child?.schedule?.status,
				doneReason: child?.schedule?.doneReason,
			};
		});
		progressByParentId.set(parentId, computeParentCompletionProgress(children));
	}

	return {
		index,
		progressByParentId,
		titleByPointId,
		snapshotsById,
	};
}

export async function loadParentRelationRuntime(
	app: App,
): Promise<IRPointParentRelationRuntime> {
	const snapshots =
		await getSharedIRPointStorageService(app).listPointSnapshots();
	return buildParentRelationRuntime(snapshots);
}

/**
 * Candidates for "select parent": every stored IR reading point
 * (md/pdf/epub/web/canvas/weave-backed points, etc.), excluding self/descendants.
 */
export function listParentPickerItems(
	runtime: IRPointParentRelationRuntime,
	options?: {
		excludePointId?: string;
		preferTopicId?: string;
	},
): IRPointSuggestItem[] {
	const excludePointId = String(options?.excludePointId || "").trim();
	const preferTopicId = String(options?.preferTopicId || "").trim();

	const items: IRPointSuggestItem[] = [];
	for (const [id, snapshot] of runtime.snapshotsById) {
		if (excludePointId && id === excludePointId) {
			continue;
		}
		if (
			excludePointId &&
			isDescendantOfParentCandidate(id, excludePointId, runtime.index)
		) {
			continue;
		}

		const display = formatParentPickerSuggestDisplay(snapshot);
		items.push({
			id,
			title: display.title,
			subtitle: display.subtitle,
			topicName: String(snapshot.topicName || "").trim() || undefined,
		});
	}

	items.sort((left, right) => {
		if (preferTopicId) {
			const leftTopic = runtime.snapshotsById.get(left.id)?.topicId || "";
			const rightTopic = runtime.snapshotsById.get(right.id)?.topicId || "";
			const leftPreferred = leftTopic === preferTopicId ? 0 : 1;
			const rightPreferred = rightTopic === preferTopicId ? 0 : 1;
			if (leftPreferred !== rightPreferred) {
				return leftPreferred - rightPreferred;
			}
		}
		return left.title.localeCompare(right.title, "zh-CN");
	});

	return items;
}

/**
 * Reject picking a descendant of `childId` as its parent (would cycle once linked).
 */
export function isDescendantOfParentCandidate(
	candidateParentId: string,
	childId: string,
	index: IRPointParentRelationIndex,
): boolean {
	const stack = [...(index.childrenByParentId.get(childId) || [])];
	const seen = new Set<string>();
	while (stack.length > 0) {
		const current = stack.pop();
		if (!current || seen.has(current)) {
			continue;
		}
		if (current === candidateParentId) {
			return true;
		}
		seen.add(current);
		stack.push(...(index.childrenByParentId.get(current) || []));
	}
	return false;
}

export function filterParentPickerItemsAgainstCycles(
	items: IRPointSuggestItem[],
	childId: string,
	index: IRPointParentRelationIndex,
): IRPointSuggestItem[] {
	const normalizedChildId = String(childId || "").trim();
	if (!normalizedChildId) {
		return items;
	}
	return items.filter(
		(item) =>
			item.id !== normalizedChildId &&
			!isDescendantOfParentCandidate(item.id, normalizedChildId, index),
	);
}

export function getContinuousReadingRelatedIds(
	materialId: string,
	runtime: IRPointParentRelationRuntime | null,
): string[] {
	if (!runtime) {
		return [];
	}
	// Continuous reading tree: only expand explicit children under a parent.
	// Sibling-under-child and same-source peers stay as the fallback in the calendar.
	const related = resolveContinuousReadingRelatedIds(materialId, runtime.index);
	return related.kind === "children" ? related.ids : [];
}
