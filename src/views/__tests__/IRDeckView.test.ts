vi.mock("obsidian", async () => {
	const actual = await vi.importActual<typeof import("../../tests/mocks/obsidian")>(
		"../../tests/mocks/obsidian",
	);

	const createContentEl = () => {
		const el = document.createElement("div") as HTMLDivElement & {
			empty: () => void;
			addClass: (...classes: string[]) => void;
			createDiv: (options?: {
				cls?: string;
				text?: string;
			}) => HTMLDivElement;
		};
		el.empty = () => {
			el.innerHTML = "";
		};
		el.addClass = (...classes: string[]) => {
			el.classList.add(...classes);
		};
		el.createDiv = (options) => {
			const div = document.createElement("div");
			if (options?.cls) {
				div.className = options.cls;
			}
			if (options?.text) {
				div.textContent = options.text;
			}
			el.appendChild(div);
			return div;
		};
		return el;
	};

	class FileView extends actual.ItemView {
		file: InstanceType<typeof actual.TFile> | null = null;
		contentEl = createContentEl();

		canAcceptExtension(_extension: string): boolean {
			return false;
		}

		async onLoadFile(file: InstanceType<typeof actual.TFile>): Promise<void> {
			this.file = file;
		}

		async onUnloadFile(_file: InstanceType<typeof actual.TFile>): Promise<void> {
			this.file = null;
		}

		getState(): Record<string, unknown> {
			return { file: this.file?.path || "" };
		}
	}

	return {
		...actual,
		FileView,
		Notice: vi.fn(),
		Platform: { isMobile: false, isDesktop: true },
	};
});

vi.mock("../../utils/i18n", () => ({
	i18n: {
		t: (key: string) => key,
	},
}));

vi.mock("../../utils/logger", () => ({
	logger: {
		debug: vi.fn(),
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
	},
}));

vi.mock("../../services/incremental-reading/ir-runtime", () => ({
	IR_RUNTIME: {
		viewTypes: {
			deck: "weave-irdeck-file-standalone",
		},
	},
}));

import { TFile } from "obsidian";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IRDeckView } from "../IRDeckView";

describe("IRDeckView", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	function createView(openIRDeckCalendar: ReturnType<typeof vi.fn>) {
		const leaf = { id: "deck-leaf" };
		const workspace = {
			layoutReady: true,
			activeLeaf: leaf,
			getMostRecentLeaf: () => leaf,
			on: vi.fn(() => ({})),
			offref: vi.fn(),
			onLayoutReady: vi.fn((cb: () => void) => cb()),
		};
		const plugin = {
			app: { workspace },
			openIRDeckCalendar,
		};
		const view = new IRDeckView(leaf as never, plugin as never);
		(view as any).app = plugin.app;
		return view;
	}

	it("keeps redirect sticky after a successful open", async () => {
		const openIRDeckCalendar = vi.fn().mockResolvedValue(undefined);
		const view = createView(openIRDeckCalendar);
		const file = new TFile("Topics/Demo.irdeck");

		await view.onOpen();
		await view.onLoadFile(file);
		await vi.runAllTimersAsync();

		expect(openIRDeckCalendar).toHaveBeenCalledTimes(1);
		expect(openIRDeckCalendar).toHaveBeenCalledWith(
			"Topics/Demo.irdeck",
			expect.anything(),
		);

		(view as any).redirectController.request();
		await vi.runAllTimersAsync();
		expect(openIRDeckCalendar).toHaveBeenCalledTimes(1);

		await view.onClose();
	});

	it("allows retry after openIRDeckCalendar fails", async () => {
		const openIRDeckCalendar = vi
			.fn()
			.mockRejectedValueOnce(new Error("boom"))
			.mockResolvedValueOnce(undefined);
		const view = createView(openIRDeckCalendar);
		const file = new TFile("Topics/Demo.irdeck");

		await view.onOpen();
		await view.onLoadFile(file);
		await vi.runAllTimersAsync();
		expect(openIRDeckCalendar).toHaveBeenCalledTimes(1);

		(view as any).redirectController.request();
		await vi.runAllTimersAsync();
		expect(openIRDeckCalendar).toHaveBeenCalledTimes(2);

		await view.onClose();
	});

	it("accepts only the irdeck extension", () => {
		const view = createView(vi.fn());
		expect(view.canAcceptExtension("irdeck")).toBe(true);
		expect(view.canAcceptExtension("md")).toBe(false);
	});
});
