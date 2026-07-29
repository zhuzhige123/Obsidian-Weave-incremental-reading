interface CalendarBackgroundWallMenuOptions {
	backgroundWallTitle: string;
	chooseTitle: string;
	clearTitle: string;
	fadeTitle: string;
	hasImage: boolean;
	onChoose: () => void;
	onClear: () => void;
	onSetFade: () => void;
}

interface CalendarViewModeMenuOption {
	mode: string;
	title: string;
	icon: string;
}

interface CalendarViewModeMenuOptions {
	viewModeTitle: string;
	currentMode: string;
	modes: CalendarViewModeMenuOption[];
	onSelectMode: (mode: string) => void;
}

interface CalendarPointDeckScanMenuOptions {
	scanTitle: string;
	onScan: () => void;
}

interface CalendarFolderSubscriptionSyncMenuOptions {
	syncTitle: string;
	onSync: () => void;
}

interface CalendarDataManagementMenuOptions {
	dataManagementTitle: string;
	onOpenDataManagement: () => void;
}

interface CalendarMaterialImportMenuOptions {
	importTitle: string;
	onOpenImport: () => void;
}

interface CalendarTodayBacklogRebalanceMenuOptions {
	rebalanceTitle: string;
	onRebalance: () => void;
}

interface CalendarMenuItemLike {
	setTitle(title: string): this;
	setIcon(icon: string): this;
	setDisabled(disabled: boolean): this;
	setChecked?(checked: boolean): this;
	onClick(callback: () => void): this;
	setSubmenu?(): CalendarMenuLike;
}

interface CalendarMenuLike {
	addItem(callback: (item: CalendarMenuItemLike) => void): unknown;
}

export function populateCalendarBackgroundWallMenu(
	menu: CalendarMenuLike,
	options: CalendarBackgroundWallMenuOptions,
): void {
	menu.addItem((item) => {
		item.setTitle(options.backgroundWallTitle).setIcon("image");
		const sub = item.setSubmenu?.();

		if (!sub) {
			return;
		}

		sub.addItem((subItem) => {
			subItem
				.setTitle(options.chooseTitle)
				.setIcon("image-plus")
				.onClick(() => {
					options.onChoose();
				});
		});

		sub.addItem((subItem) => {
			subItem
				.setTitle(options.clearTitle)
				.setIcon("image-off")
				.setDisabled(!options.hasImage)
				.onClick(() => {
					options.onClear();
				});
		});

		sub.addItem((subItem) => {
			subItem
				.setTitle(options.fadeTitle)
				.setIcon("sliders-horizontal")
				.onClick(() => {
					options.onSetFade();
				});
		});
	});
}

export function populateCalendarViewModeMenu(
	menu: CalendarMenuLike,
	options: CalendarViewModeMenuOptions,
): void {
	menu.addItem((item) => {
		item.setTitle(options.viewModeTitle).setIcon("calendar");
		const sub = item.setSubmenu?.();

		if (!sub) {
			return;
		}

		for (const mode of options.modes) {
			sub.addItem((subItem) => {
				subItem
					.setTitle(mode.title)
					.setIcon(mode.icon)
					.setChecked?.(mode.mode === options.currentMode)
					.onClick(() => {
						options.onSelectMode(mode.mode);
					});
			});
		}
	});
}

export function populateCalendarPointDeckScanMenu(
	menu: CalendarMenuLike,
	options: CalendarPointDeckScanMenuOptions,
): void {
	menu.addItem((item) => {
		item
			.setTitle(options.scanTitle)
			.setIcon("scan-search")
			.onClick(() => {
				options.onScan();
			});
	});
}

export function populateCalendarFolderSubscriptionSyncMenu(
	menu: CalendarMenuLike,
	options: CalendarFolderSubscriptionSyncMenuOptions,
): void {
	menu.addItem((item) => {
		item
			.setTitle(options.syncTitle)
			.setIcon("refresh-cw")
			.onClick(() => {
				options.onSync();
			});
	});
}

export function populateCalendarMaterialImportMenu(
	menu: CalendarMenuLike,
	options: CalendarMaterialImportMenuOptions,
): void {
	menu.addItem((item) => {
		item
			.setTitle(options.importTitle)
			.setIcon("folder-input")
			.onClick(() => {
				options.onOpenImport();
			});
	});
}

export function populateCalendarTodayBacklogRebalanceMenu(
	menu: CalendarMenuLike,
	options: CalendarTodayBacklogRebalanceMenuOptions,
): void {
	menu.addItem((item) => {
		item
			.setTitle(options.rebalanceTitle)
			.setIcon("list-restart")
			.onClick(() => {
				options.onRebalance();
			});
	});
}

export function populateCalendarDataManagementMenu(
	menu: CalendarMenuLike,
	options: CalendarDataManagementMenuOptions,
): void {
	menu.addItem((item) => {
		item
			.setTitle(options.dataManagementTitle)
			.setIcon("database")
			.onClick(() => {
				options.onOpenDataManagement();
			});
	});
}
