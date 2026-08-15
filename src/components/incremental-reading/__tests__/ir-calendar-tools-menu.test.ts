import { Menu, type MenuItem } from "../../../tests/mocks/obsidian";
import {
	populateCalendarBackgroundWallMenu,
	populateCalendarFolderSubscriptionSyncMenu,
	populateCalendarMaterialImportMenu,
	populateCalendarPointDeckScanMenu,
	populateCalendarTodayBacklogRebalanceMenu,
	populateCalendarViewModeMenu,
} from "../ir-calendar-tools-menu";

type TrackingMenu = Menu & {
	findItemByTitle(title: string): MenuItem | undefined;
};

describe("populateCalendarBackgroundWallMenu", () => {
	it("统一保留背景墙子菜单结构", () => {
		const menu = new Menu() as TrackingMenu;
		const onChoose = vi.fn();
		const onClear = vi.fn();
		const onSetFade = vi.fn();

		populateCalendarBackgroundWallMenu(menu, {
			backgroundWallTitle: "背景墙",
			chooseTitle: "选择图片",
			clearTitle: "清除图片",
			fadeTitle: "设置淡化 70%",
			hasImage: true,
			onChoose,
			onClear,
			onSetFade,
		});

		const submenu = menu
			.findItemByTitle("背景墙")
			?.getSubmenu() as TrackingMenu | null;
		expect(submenu).toBeTruthy();

		submenu?.findItemByTitle("选择图片")?.trigger();
		submenu?.findItemByTitle("清除图片")?.trigger();
		submenu?.findItemByTitle("设置淡化 70%")?.trigger();

		expect(onChoose).toHaveBeenCalledTimes(1);
		expect(onClear).toHaveBeenCalledTimes(1);
		expect(onSetFade).toHaveBeenCalledTimes(1);
	});

	it("在没有背景图时禁用清除动作", () => {
		const menu = new Menu() as TrackingMenu;

		populateCalendarBackgroundWallMenu(menu, {
			backgroundWallTitle: "背景墙",
			chooseTitle: "选择图片",
			clearTitle: "清除图片",
			fadeTitle: "设置淡化 70%",
			hasImage: false,
			onChoose: vi.fn(),
			onClear: vi.fn(),
			onSetFade: vi.fn(),
		});

		const submenu = menu
			.findItemByTitle("背景墙")
			?.getSubmenu() as TrackingMenu | null;
		expect(submenu).toBeTruthy();
		expect(submenu?.findItemByTitle("选择图片")).toBeTruthy();
		expect(submenu?.findItemByTitle("清除图片")?.isDisabled()).toBe(true);
		expect(submenu?.findItemByTitle("设置淡化 70%")).toBeTruthy();
	});
});

describe("populateCalendarViewModeMenu", () => {
	it("用父项子菜单承载三种月历视图并勾选当前模式", () => {
		const menu = new Menu() as TrackingMenu;
		const onSelectMode = vi.fn();

		populateCalendarViewModeMenu(menu, {
			viewModeTitle: "月历视图",
			currentMode: "one-row",
			modes: [
				{ mode: "one-row", title: "单行月历视图", icon: "minus" },
				{ mode: "two-row", title: "双行月历视图", icon: "list" },
				{ mode: "full", title: "完整月历视图", icon: "calendar" },
			],
			onSelectMode,
		});

		const parent = menu.findItemByTitle("月历视图");
		const submenu = parent?.getSubmenu() as TrackingMenu | null;
		expect(submenu).toBeTruthy();
		expect(submenu?.findItemByTitle("单行月历视图")?.isChecked()).toBe(true);
		expect(submenu?.findItemByTitle("双行月历视图")?.isChecked()).toBe(false);
		expect(submenu?.findItemByTitle("完整月历视图")?.isChecked()).toBe(false);

		submenu?.findItemByTitle("双行月历视图")?.trigger();
		expect(onSelectMode).toHaveBeenCalledWith("two-row");
	});
});

describe("populateCalendarPointDeckScanMenu", () => {
	it("提供扫描库中增量阅读专题文件入口", () => {
		const menu = new Menu() as TrackingMenu;
		const onScan = vi.fn();

		populateCalendarPointDeckScanMenu(menu, {
			scanTitle: "扫描库中增量阅读专题文件",
			onScan,
		});

		menu.findItemByTitle("扫描库中增量阅读专题文件")?.trigger();
		expect(onScan).toHaveBeenCalledTimes(1);
	});
});

describe("populateCalendarFolderSubscriptionSyncMenu", () => {
	it("提供更新订阅文件夹入口", () => {
		const menu = new Menu() as TrackingMenu;
		const onSync = vi.fn();

		populateCalendarFolderSubscriptionSyncMenu(menu, {
			syncTitle: "更新订阅文件夹",
			onSync,
		});

		menu.findItemByTitle("更新订阅文件夹")?.trigger();
		expect(onSync).toHaveBeenCalledTimes(1);
	});
});

describe("populateCalendarMaterialImportMenu", () => {
	it("提供导入阅读材料入口", () => {
		const menu = new Menu() as TrackingMenu;
		const onOpenImport = vi.fn();

		populateCalendarMaterialImportMenu(menu, {
			importTitle: "导入阅读材料",
			onOpenImport,
		});

		menu.findItemByTitle("导入阅读材料")?.trigger();
		expect(onOpenImport).toHaveBeenCalledTimes(1);
	});
});

describe("populateCalendarTodayBacklogRebalanceMenu", () => {
	it("提供整理今日积压入口", () => {
		const menu = new Menu() as TrackingMenu;
		const onRebalance = vi.fn();

		populateCalendarTodayBacklogRebalanceMenu(menu, {
			rebalanceTitle: "整理今日积压…",
			onRebalance,
		});

		menu.findItemByTitle("整理今日积压…")?.trigger();
		expect(onRebalance).toHaveBeenCalledTimes(1);
	});
});
