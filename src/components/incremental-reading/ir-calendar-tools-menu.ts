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

interface CalendarMenuItemLike {
	setTitle(title: string): this;
	setIcon(icon: string): this;
	setDisabled(disabled: boolean): this;
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
