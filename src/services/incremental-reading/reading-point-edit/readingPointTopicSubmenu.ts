import { type App, Menu, Notice } from "obsidian";
import { i18n } from "../../../utils/i18n";
import { logger } from "../../../utils/logger";
import type { IRDeck } from "../../../types/ir-types";
import type { ScheduleItem } from "../IRCalendarScheduleItem";
import { IRStorageService } from "../IRStorageService";
import { IRReadingPointEditService } from "./IRReadingPointEditService";
import { buildSaveInputFromDraft } from "./IRReadingPointEditSaveBuilder";
import { resolveReadingPointSaveErrorMessage } from "./reading-point-modal-utils";

function uiText(zh: string, en: string): string {
	return i18n.getCurrentLanguage() === "zh-CN" ? zh : en;
}

export async function populateReadingPointTopicSubmenu(
	submenu: Menu,
	app: App,
	material: ScheduleItem,
	onSaved?: () => void
): Promise<void> {
	try {
		const service = new IRReadingPointEditService(app);
		const draft = await service.loadDraft(material);
		if (!draft) {
			submenu.addItem((item) => {
				item
					.setTitle(uiText("未找到该阅读点", "Reading point not found"))
					.setIcon("alert-triangle")
					.setDisabled(true);
			});
			return;
		}

		const storage = new IRStorageService(app);
		await storage.initialize();
		const decks = Object.values(await storage.getAllDecks())
			.filter((deck) => !deck.archivedAt)
			.sort((left, right) => left.name.localeCompare(right.name, "zh-CN")) as IRDeck[];

		if (decks.length === 0) {
			submenu.addItem((item) => {
				item
					.setTitle(uiText("暂无可用的增量阅读专题", "No incremental reading topics available"))
					.setIcon("inbox")
					.setDisabled(true);
			});
			return;
		}

		submenu.addItem((item) => {
			item
				.setTitle(
					uiText(
						`当前专题：${draft.deckName || draft.deckId}`,
						`Current topic: ${draft.deckName || draft.deckId}`
					)
				)
				.setDisabled(true);
		});
		submenu.addSeparator();

		for (const deck of decks) {
			if (deck.id === draft.deckId) {
				continue;
			}

			submenu.addItem((item) => {
				item.setTitle(deck.name).onClick(async () => {
					try {
						const result = await service.saveEdit(
							buildSaveInputFromDraft(app, draft, { deckId: deck.id })
						);
						if (result.changed) {
							new Notice(
								uiText(`已移动到专题：${deck.name}`, `Moved to topic: ${deck.name}`),
								2500
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
				.setTitle(uiText("加载专题列表失败", "Failed to load topics"))
				.setIcon("alert-triangle")
				.setDisabled(true);
		});
	}
}
