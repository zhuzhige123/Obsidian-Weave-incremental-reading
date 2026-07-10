import { type App, Menu, Notice } from "obsidian";
import { i18n } from "../../../utils/i18n";
import { logger } from "../../../utils/logger";
import type { ScheduleItem } from "../IRCalendarScheduleItem";
import { IRStorageService } from "../IRStorageService";
import { resolveReadingPointSaveErrorMessage } from "../reading-point-edit/reading-point-modal-utils";
import {
	type IRReadingPointBatchResult,
	IRReadingPointBatchService,
} from "./IRReadingPointBatchService";

export interface ReadingPointBatchSubmenuOptions {
	app: App;
	targets: ScheduleItem[];
	batchService: IRReadingPointBatchService;
	onApplied?: () => void;
	onSelectAllVisible?: () => void;
	onClearSelection?: () => void;
	onEnterBatchMode?: () => void;
	selectionHelpers?: boolean;
}

export async function populateReadingPointBatchSubmenu(
	submenu: Menu,
	options: ReadingPointBatchSubmenuOptions,
): Promise<void> {
	const {
		app,
		targets,
		batchService,
		onApplied,
		onSelectAllVisible,
		onClearSelection,
		onEnterBatchMode,
		selectionHelpers = true,
	} = options;
	const count = targets.length;

	if (selectionHelpers && onEnterBatchMode) {
		submenu.addItem((item) => {
			item
				.setTitle(i18n.t("irSidebar.batch.enterSelectionMode"))
				.setIcon("check-square")
				.onClick(() => {
					onEnterBatchMode();
				});
		});
		submenu.addSeparator();
	}

	if (selectionHelpers) {
		if (count > 1) {
			submenu.addItem((item) => {
				item
					.setTitle(i18n.t("irSidebar.batch.targetCount", { count }))
					.setIcon("check-square")
					.setDisabled(true);
			});
			submenu.addSeparator();
		}

		if (onSelectAllVisible) {
			submenu.addItem((item) => {
				item
					.setTitle(i18n.t("irSidebar.batch.selectAllVisible"))
					.setIcon("square-check")
					.onClick(() => {
						onSelectAllVisible();
					});
			});
		}

		if (onClearSelection) {
			submenu.addItem((item) => {
				item
					.setTitle(i18n.t("irSidebar.batch.clearSelection"))
					.setIcon("x")
					.onClick(() => {
						onClearSelection();
					});
			});
		}

		if (onSelectAllVisible || onClearSelection) {
			submenu.addSeparator();
		}
	}

	submenu.addItem((item) => {
		item
			.setTitle(i18n.t("irSidebar.menu.delete"))
			.setIcon("trash-2")
			.onClick(() => {
				void runBatchMenuAction(
					() => batchService.batchDelete(targets),
					onApplied,
					"delete",
				);
			});
	});

	submenu.addItem((item) => {
		item
			.setTitle(i18n.t("irSidebar.menu.remove"))
			.setIcon("x-circle")
			.onClick(() => {
				void runBatchMenuAction(
					() => batchService.batchRemove(targets),
					onApplied,
					"remove",
				);
			});
	});

	submenu.addItem((item) => {
		item
			.setTitle(i18n.t("irSidebar.menu.moveReadingPointTopic"))
			.setIcon("layers");
		const topicSubmenu = item.setSubmenu();
		void populateBatchTopicSubmenu(
			topicSubmenu,
			app,
			targets,
			batchService,
			onApplied,
		);
	});
}

async function populateBatchTopicSubmenu(
	submenu: Menu,
	app: App,
	targets: ScheduleItem[],
	batchService: IRReadingPointBatchService,
	onApplied?: () => void,
): Promise<void> {
	try {
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

		submenu.addItem((item) => {
			item
				.setTitle(
					i18n.t("irSidebar.batch.moveTopicMenuTitle", {
						count: targets.length,
					}),
				)
				.setDisabled(true);
		});
		submenu.addSeparator();

		for (const deck of decks) {
			submenu.addItem((item) => {
				item.setTitle(deck.name).onClick(() => {
					void runBatchMenuAction(
						() => batchService.batchMoveTopic(targets, deck.id),
						onApplied,
						"move-topic",
					);
				});
			});
		}
	} catch (error) {
		logger.error("[readingPointBatchSubmenu] load topics failed", error);
		submenu.addItem((item) => {
			item
				.setTitle(i18n.t("irServiceNotices.topicSubmenu.loadFailed"))
				.setIcon("alert-triangle")
				.setDisabled(true);
		});
	}
}

async function runBatchMenuAction(
	action: () => Promise<IRReadingPointBatchResult>,
	onApplied: (() => void) | undefined,
	operation: "delete" | "remove" | "move-topic",
): Promise<void> {
	try {
		const result = await action();
		if (result.success > 0) {
			onApplied?.();
		}
	} catch (error) {
		logger.error(`[readingPointBatchSubmenu] batch ${operation} failed`, error);
		const noticeKey =
			operation === "delete"
				? "irSidebar.notices.deleteFailed"
				: operation === "remove"
				? "irSidebar.notices.removeFailed"
				: null;
		new Notice(
			noticeKey
				? i18n.t(noticeKey)
				: resolveReadingPointSaveErrorMessage(error),
			3500,
		);
	}
}
