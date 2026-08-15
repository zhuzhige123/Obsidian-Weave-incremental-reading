import { fireEvent, render, waitFor } from "@testing-library/svelte";
import { TFolder } from "obsidian";
import { t } from "../../../utils/i18n";
import IRCalendarSearchInput from "../IRCalendarSearchInput.svelte";

const floatingUiMocks = vi.hoisted(() => ({
	computePosition: vi.fn(),
	autoUpdate: vi.fn(),
}));

vi.mock("@floating-ui/dom", () => ({
	computePosition: floatingUiMocks.computePosition,
	autoUpdate: floatingUiMocks.autoUpdate,
	flip: vi.fn(() => ({ name: "flip" })),
	shift: vi.fn(() => ({ name: "shift" })),
	offset: vi.fn(() => ({ name: "offset" })),
}));

vi.mock("../../../utils/vault-local-storage", () => ({
	vaultStorage: {
		getItem: vi.fn(() => null),
		setItem: vi.fn(),
	},
}));

describe("IRCalendarSearchInput", () => {
	beforeEach(() => {
		floatingUiMocks.computePosition.mockResolvedValue({ x: 120, y: 80 });
		floatingUiMocks.autoUpdate.mockImplementation((_anchor, _menu, update) => {
			void update();
			return vi.fn();
		});
		vi.clearAllMocks();
	});

	afterEach(() => {
		document.body
			.querySelectorAll(".floating-menu")
			.forEach((element) => element.remove());
	});

	it("resolves management.cardSearch labels from the translation catalog", () => {
		expect(t("management.cardSearch.searchOptions")).toBe("搜索选项");
		expect(t("management.cardSearch.options.deck")).toBe("deck: 匹配专题");
		expect(t("management.cardSearch.options.readingPointType")).toBe(
			"type: 搜索阅读点类型",
		);
		expect(t("management.cardSearch.menuSections.tag")).toBe("标签");
	});

	it("portals the search panel to body so sidebar overflow cannot clip it", async () => {
		const { container } = render(IRCalendarSearchInput, {
			props: {
				app: {} as any,
			},
		});

		const input = container.querySelector("input") as HTMLInputElement;
		await fireEvent.focus(input);

		await waitFor(() => {
			const floatingMenu = document.body.querySelector(
				".floating-menu.card-search-floating-menu",
			);
			expect(floatingMenu).toBeInTheDocument();
			expect(floatingMenu?.parentElement).toBe(document.body);
			expect(
				floatingMenu?.querySelector(".weave-card-search-dropdown-panel"),
			).toBeInTheDocument();
		});

		expect(
			container.querySelector(".weave-card-search-dropdown-panel"),
		).not.toBeInTheDocument();
	});

	it("mounts official SearchComponent for the main search and folder suggestion panel", async () => {
		const root = new TFolder("/");
		const notes = new TFolder("Notes");
		root.children.push(notes);

		const { container } = render(IRCalendarSearchInput, {
			props: {
				app: {
					vault: {
						getRoot: () => root,
					},
				} as any,
			},
		});

		const mainHost = container.querySelector(".weave-ir-search-host");
		expect(mainHost).toBeTruthy();
		expect(mainHost?.querySelector(".search-input-container")).toBeTruthy();
		expect(mainHost?.querySelector(".search-input-clear-button")).toBeTruthy();

		const input = container.querySelector(
			".weave-ir-search-host .search-input",
		) as HTMLInputElement;
		await fireEvent.focus(input);

		await waitFor(() => {
			expect(
				document.body.querySelector(".floating-menu.card-search-floating-menu"),
			).toBeInTheDocument();
		});

		const folderOption = Array.from(
			document.body.querySelectorAll(".dropdown-item"),
		).find((element) =>
			element.textContent?.includes(t("management.cardSearch.options.folder")),
		);
		expect(folderOption).toBeTruthy();
		await fireEvent.mouseDown(folderOption!);

		await waitFor(() => {
			const panel = document.body.querySelector(
				".floating-menu.card-search-floating-menu .search-suggestion-panel",
			);
			expect(panel).toBeInTheDocument();
			expect(panel?.querySelector(".suggestion-search-input")).toBeNull();
			expect(
				panel?.querySelector(
					".weave-ir-suggestion-search-host .search-input-container",
				),
			).toBeTruthy();
			expect(
				panel?.querySelector(
					".weave-ir-suggestion-search-host .search-input-clear-button",
				),
			).toBeTruthy();
			expect(panel?.textContent).toContain("Notes");
		});
	});

	it("opens a tag list like topics and filters it from the main search input", async () => {
		const { container } = render(IRCalendarSearchInput, {
			props: {
				app: {} as any,
				availableTags: [
					{ name: "alpha", count: 3 },
					{ name: "beta", count: 1 },
					{ name: "gamma", count: 2 },
				],
			},
		});

		const input = container.querySelector("input") as HTMLInputElement;
		await fireEvent.focus(input);

		await waitFor(() => {
			expect(
				document.body.querySelector(".floating-menu.card-search-floating-menu"),
			).toBeInTheDocument();
		});

		const tagOption = Array.from(
			document.body.querySelectorAll(".dropdown-item"),
		).find((element) =>
			element.textContent?.includes(t("management.cardSearch.options.tag")),
		);
		expect(tagOption).toBeTruthy();
		await fireEvent.mouseDown(tagOption!);

		await waitFor(() => {
			const panel = document.body.querySelector(
				".floating-menu.card-search-floating-menu .search-suggestion-panel",
			);
			expect(panel).toBeInTheDocument();
			expect(panel?.textContent).toContain(
				t("management.cardSearch.menuSections.tag"),
			);
			expect(panel?.textContent).toContain("alpha");
			expect(panel?.textContent).toContain("beta");
			expect(panel?.textContent).toContain("gamma");
			// 标签列表不使用独立搜索框；过滤在主搜索框完成
			expect(panel?.querySelector(".suggestion-search-input")).toBeNull();
		});

		expect(input.value).toContain("tag:");

		await fireEvent.input(input, { target: { value: "tag:be" } });

		await waitFor(() => {
			const panel = document.body.querySelector(
				".floating-menu.card-search-floating-menu .search-suggestion-panel",
			);
			expect(panel?.textContent).toContain("beta");
			expect(panel?.textContent).not.toContain("alpha");
			expect(panel?.textContent).not.toContain("gamma");
		});
	});
});
