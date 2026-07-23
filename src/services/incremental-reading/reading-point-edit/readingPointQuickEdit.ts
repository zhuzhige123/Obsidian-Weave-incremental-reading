import { type App, Modal, Notice } from "obsidian";
import type WeavePlugin from "../../../main";
import { ReadingPointRenameModal } from "../../../modals/ReadingPointRenameModal";
import { ReadingPointTagsPrompt } from "../../../modals/ReadingPointTagsPrompt";
import { ReadingPointTraceLinkPrompt } from "../../../modals/ReadingPointTraceLinkPrompt";
import { i18n } from "../../../utils/i18n";
import { logger } from "../../../utils/logger";
import type { ScheduleItem } from "../IRCalendarScheduleItem";
import { canEditReadingPointLink } from "./IRReadingPointEditLinkResolver";
import { IRReadingPointEditService } from "./IRReadingPointEditService";
import type { IRReadingPointEditSaveResult } from "./IRReadingPointEditTypes";

let activePrompt: Modal | null = null;

function trackPrompt(modal: Modal): void {
	activePrompt?.close();
	activePrompt = modal;
	const originalOnClose = modal.onClose?.bind(modal);
	modal.onClose = () => {
		originalOnClose?.();
		if (activePrompt === modal) {
			activePrompt = null;
		}
	};
}

export function closeActiveReadingPointPrompt(): void {
	if (!activePrompt) {
		return;
	}
	if (
		activePrompt instanceof ReadingPointTraceLinkPrompt ||
		activePrompt instanceof ReadingPointTagsPrompt
	) {
		activePrompt.forceClose();
	} else {
		activePrompt.close();
	}
	activePrompt = null;
}

async function loadDraftOrNotify(app: App, material: ScheduleItem) {
	const service = new IRReadingPointEditService(app);
	const draft = await service.loadDraft(material);
	if (!draft) {
		new Notice(i18n.t("irServiceNotices.quickEdit.pointNotFoundDeleted"), 3000);
		return null;
	}
	return draft;
}

export async function promptRenameReadingPoint(
	app: App,
	material: ScheduleItem,
	onSaved?: () => void,
): Promise<void> {
	try {
		const draft = await loadDraftOrNotify(app, material);
		if (!draft) {
			return;
		}

		const modal = new ReadingPointRenameModal(app, { draft, onSaved });
		trackPrompt(modal);
		modal.open();
	} catch (error) {
		logger.error("[readingPointQuickEdit] rename failed", error);
		new Notice(i18n.t("irServiceNotices.quickEdit.openRenameFailed"), 3000);
	}
}

export async function openReadingPointTraceLinkPrompt(
	plugin: WeavePlugin,
	material: ScheduleItem,
	onSaved?: (result: IRReadingPointEditSaveResult) => void,
): Promise<void> {
	try {
		if (!canEditReadingPointLink(material)) {
			new Notice(
				i18n.t("irServiceNotices.quickEdit.traceLinkUnsupported"),
				3000,
			);
			return;
		}

		const draft = await loadDraftOrNotify(plugin.app, material);
		if (!draft || !draft.canEditLink) {
			if (draft && !draft.canEditLink) {
				new Notice(
					i18n.t("irServiceNotices.quickEdit.traceLinkUnsupported"),
					3000,
				);
			}
			return;
		}

		const modal = new ReadingPointTraceLinkPrompt(plugin.app, {
			plugin,
			draft,
			onSaved,
		});
		trackPrompt(modal);
		modal.open();
	} catch (error) {
		logger.error("[readingPointQuickEdit] trace link prompt failed", error);
		new Notice(i18n.t("irServiceNotices.quickEdit.openTraceLinkFailed"), 3000);
	}
}

export async function openReadingPointTagsPrompt(
	app: App,
	material: ScheduleItem,
	onSaved?: (tags: string[]) => void,
): Promise<void> {
	try {
		const draft = await loadDraftOrNotify(app, material);
		if (!draft) {
			return;
		}

		if (!draft.canEditTags) {
			new Notice(i18n.t("irServiceNotices.quickEdit.tagsUnsupported"), 3000);
			return;
		}

		const modal = new ReadingPointTagsPrompt(app, { draft, onSaved });
		trackPrompt(modal);
		modal.open();
	} catch (error) {
		logger.error("[readingPointQuickEdit] tags prompt failed", error);
		new Notice(i18n.t("irServiceNotices.quickEdit.openTagsFailed"), 3000);
	}
}
