import { type App, Menu, Notice } from "obsidian";
import { i18n } from "../../../utils/i18n";
import { logger } from "../../../utils/logger";
import type { ScheduleItem } from "../IRCalendarScheduleItem";
import { IRStorageService } from "../IRStorageService";
import { IRReadingPointEditService } from "./IRReadingPointEditService";
import { resolveReadingPointSaveErrorMessage } from "./reading-point-modal-utils";

export async function populateReadingPointTopicSubmenu(
	submenu: Menu,
	app: App,
	material: ScheduleItem,
	onSaved?: () => void,
): Promise<void> {
	try {
		const service = new IRReadingPointEditService(app);
		const draft = await service.loadDraft(material);
		if (!draft) {
			submenu.addItem((item) => {
				item
					.setTitle(i18n.t("irServiceNotices.topicSubmenu.pointNotFound"))
					.setIcon("alert-triangle")
					.setDisabled(true);
			});
			return;
		}

		const storage = new IRStorageService(app);
		await storage.initialize();
		const decks = Object.values(await storage.getAllDecks())
			.filter((deck) => !deck.archivedAt)
			.sort((left, right) => left.name.localeCompare(right.name, "zh-CN"));

		if (decks.length === 0) {
			submenu.addItem((item) => {
				item
					.setTitle(i18n.t("irServiceNotices.topicSubmenu.noTopics"))
					.setIcon("inbox")
					.setDisabled(true);
			});
			return;
		}

		// Obsidian 原生 Menu 会对长标题做省略；勿把「当前专题：完整名称」塞进同一行。
		// 名称单独成行（与列表项宽度一致），避免「测试3」被裁成「测」。
		const currentDeck =
			decks.find((deck) => deck.id === draft.deckId) ?? null;
		const currentTopicName = String(
			currentDeck?.name || draft.deckName || draft.deckId || "",
		).trim();

		submenu.addItem((item) => {
			item
				.setTitle(i18n.t("irServiceNotices.topicSubmenu.currentTopicLabel"))
				.setDisabled(true);
		});
		if (currentTopicName) {
			submenu.addItem((item) => {
				item.setTitle(currentTopicName).setChecked(true).setDisabled(true);
			});
		}
		submenu.addSeparator();

		for (const deck of decks) {
			if (deck.id === draft.deckId) {
				continue;
			}

			submenu.addItem((item) => {
				item.setTitle(deck.name).onClick(async () => {
					try {
						const result = await service.saveTopicChange(material, deck.id);
						if (result.changed) {
							new Notice(
								i18n.t("irServiceNotices.topicSubmenu.movedToTopic", {
									deckName: deck.name,
								}),
								2500,
							);
						}
						onSaved?.();
					} catch (error) {
						logger.error("[readingPointTopicSubmenu] save failed", error);
						new Notice(resolveReadingPointSaveErrorMessage(error), 3500);
					}
				});
			});
		}
	} catch (error) {
		logger.error("[readingPointTopicSubmenu] load failed", error);
		submenu.addItem((item) => {
			item
				.setTitle(i18n.t("irServiceNotices.topicSubmenu.loadFailed"))
				.setIcon("alert-triangle")
				.setDisabled(true);
		});
	}
}
