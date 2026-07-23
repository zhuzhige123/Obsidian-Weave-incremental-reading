/**
 * Parent–child reading-point relations (`relations.parentPointId`).
 * Scheduling stays flat; continuous reading + progress UI consume this tree.
 */

export interface IRPointParentProgress {
	totalChildren: number;
	completedChildren: number;
	/** Integer 0–100 */
	percent: number;
}

export interface IRPointParentRelationIndex {
	parentByChildId: Map<string, string>;
	childrenByParentId: Map<string, string[]>;
}

export function normalizeParentPointId(value: unknown): string | null {
	const normalized =
		typeof value === "string"
			? value.trim()
			: typeof value === "number" || typeof value === "boolean"
				? String(value).trim()
				: "";
	return normalized || null;
}

export function isPointCompletedForParentProgress(
	status: unknown,
	doneReason?: unknown,
): boolean {
	const normalizedStatus =
		typeof status === "string"
			? status.trim().toLowerCase()
			: "";
	if (normalizedStatus === "done" || normalizedStatus === "archived") {
		return true;
	}
	const reason =
		typeof doneReason === "string"
			? doneReason.trim().toLowerCase()
			: "";
	return reason === "completed" || reason === "archived";
}

export function computeParentCompletionProgress(
	children: Array<{ status?: unknown; doneReason?: unknown }>,
): IRPointParentProgress {
	const active = (Array.isArray(children) ? children : []).filter((child) => {
		const status =
			typeof child?.status === "string"
				? child.status.trim().toLowerCase()
				: "";
		return status !== "removed";
	});
	const totalChildren = active.length;
	const completedChildren = active.filter((child) =>
		isPointCompletedForParentProgress(child?.status, child?.doneReason),
	).length;
	const percent =
		totalChildren <= 0
			? 0
			: Math.round((completedChildren / totalChildren) * 100);
	return { totalChildren, completedChildren, percent };
}

export function wouldCreateParentCycle(
	childId: string,
	nextParentId: string | null,
	parentByPointId: Map<string, string | null | undefined> | Record<string, string | null | undefined>,
): boolean {
	const normalizedChildId = String(childId || "").trim();
	const normalizedParentId = normalizeParentPointId(nextParentId);
	if (!normalizedChildId || !normalizedParentId) {
		return false;
	}
	if (normalizedChildId === normalizedParentId) {
		return true;
	}

	const readParent = (pointId: string): string | null => {
		if (parentByPointId instanceof Map) {
			return normalizeParentPointId(parentByPointId.get(pointId));
		}
		return normalizeParentPointId(parentByPointId[pointId]);
	};

	const seen = new Set<string>([normalizedChildId]);
	let cursor: string | null = normalizedParentId;
	while (cursor) {
		if (seen.has(cursor)) {
			return true;
		}
		seen.add(cursor);
		cursor = readParent(cursor);
	}
	return false;
}

export function buildParentRelationIndex(
	points: Array<{ id: string; parentPointId?: string | null }>,
): IRPointParentRelationIndex {
	const parentByChildId = new Map<string, string>();
	const childrenByParentId = new Map<string, string[]>();

	for (const point of points) {
		const childId = String(point?.id || "").trim();
		const parentId = normalizeParentPointId(point?.parentPointId);
		if (!childId || !parentId || childId === parentId) {
			continue;
		}
		parentByChildId.set(childId, parentId);
		const siblings = childrenByParentId.get(parentId) || [];
		siblings.push(childId);
		childrenByParentId.set(parentId, siblings);
	}

	for (const [parentId, childIds] of childrenByParentId) {
		childrenByParentId.set(
			parentId,
			[...new Set(childIds)].sort((left, right) => left.localeCompare(right)),
		);
	}

	return { parentByChildId, childrenByParentId };
}

/**
 * Continuous-reading expand targets:
 * - parent with children → those children
 * - child with siblings → other children under the same parent
 * - otherwise → caller falls back to same-source siblings
 */
export function resolveContinuousReadingRelatedIds(
	materialId: string,
	index: IRPointParentRelationIndex,
): { kind: "children" | "siblings" | "none"; ids: string[] } {
	const normalizedId = String(materialId || "").trim();
	if (!normalizedId) {
		return { kind: "none", ids: [] };
	}

	const children = index.childrenByParentId.get(normalizedId);
	if (children && children.length > 0) {
		return { kind: "children", ids: [...children] };
	}

	const parentId = index.parentByChildId.get(normalizedId);
	if (!parentId) {
		return { kind: "none", ids: [] };
	}

	const siblings = (index.childrenByParentId.get(parentId) || []).filter(
		(id) => id !== normalizedId,
	);
	if (siblings.length === 0) {
		return { kind: "none", ids: [] };
	}
	return { kind: "siblings", ids: siblings };
}
