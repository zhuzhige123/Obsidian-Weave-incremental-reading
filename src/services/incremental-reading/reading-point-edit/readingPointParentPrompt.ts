import { type App, Notice } from "obsidian";
import { IRPointSuggestModal } from "../../../modals/IRPointSuggestModal";
import { i18n } from "../../../utils/i18n";
import { logger } from "../../../utils/logger";
import type { ScheduleItem } from "../IRCalendarScheduleItem";
import {
	listParentPickerItems,
	loadParentRelationRuntime,
} from "../IRPointParentRelationRuntime";
import { getSharedIRPointStorageService } from "../IRPointStorageService";
import { broadcastIRDataUpdated } from "../IRScheduleRefreshService";

export async function promptSelectParentReadingPoint(
	app: App,
	material: ScheduleItem,
	onSaved?: () => void,
): Promise<void> {
	try {
		const pointId = String(material.id || "").trim();
		if (!pointId) {
			new Notice(i18n.t("irServiceNotices.quickEdit.pointNotFoundDeleted"), 3000);
			return;
		}

		const storage = getSharedIRPointStorageService(app);
		const snapshot = await storage.getPointSnapshotById(pointId);
		if (!snapshot) {
			new Notice(i18n.t("irServiceNotices.quickEdit.pointNotFoundDeleted"), 3000);
			return;
		}

		const runtime = await loadParentRelationRuntime(app);
		const items = listParentPickerItems(runtime, {
			excludePointId: pointId,
			preferTopicId: String(snapshot.topicId || material.deckId || "").trim(),
		});

		const currentParentId =
			String(snapshot.point.relations?.parentPointId || "").trim() || null;
		const currentParentTitle = currentParentId
			? runtime.titleByPointId.get(currentParentId) || currentParentId
			: "";

		const picker = new IRPointSuggestModal(app, {
			items,
			allowClear: true,
			placeholder: i18n.t("irModals.pointSuggest.placeholder"),
			clearLabel: i18n.t("irModals.pointSuggest.clearLabel"),
			clearDescription: currentParentTitle
				? i18n.t("irModals.pointSuggest.clearDescriptionWithCurrent", {
						title: currentParentTitle,
				  })
				: i18n.t("irModals.pointSuggest.clearDescription"),
		});

		const choice = await picker.waitForChoice();
		if (choice.kind === "cancel") {
			return;
		}

		const nextParentId = choice.kind === "clear" ? null : choice.item.id;
		const previousParentId = currentParentId;
		if (nextParentId === previousParentId) {
			return;
		}

		const ok = await storage.updatePointParentId(pointId, nextParentId);
		if (!ok) {
			new Notice(i18n.t("irServiceNotices.quickEdit.selectParentFailed"), 3000);
			return;
		}

		broadcastIRDataUpdated(app, {
			reason: "metadata_changed",
			invalidationScope: "none",
		});

		if (nextParentId) {
			const parentTitle =
				runtime.titleByPointId.get(nextParentId) ||
				(choice.kind === "point" ? choice.item.title : nextParentId);
			new Notice(
				i18n.t("irServiceNotices.quickEdit.parentSet", {
					title: parentTitle,
				}),
				2500,
			);
		} else {
			new Notice(i18n.t("irServiceNotices.quickEdit.parentCleared"), 2500);
		}

		onSaved?.();
	} catch (error) {
		logger.error("[readingPointParent] select parent failed", error);
		new Notice(i18n.t("irServiceNotices.quickEdit.openSelectParentFailed"), 3000);
	}
}
