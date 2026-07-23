import { App, type FuzzyMatch, FuzzySuggestModal } from "obsidian";
import { i18n } from "../utils/i18n";
import {
	ensureSuggestModalTheme,
	markLatestSuggestionContainer,
} from "./suggestModalTheme";

export interface IRPointSuggestItem {
	id: string;
	title: string;
	subtitle?: string;
	topicName?: string;
}

export type IRPointSuggestChoice =
	| { kind: "point"; item: IRPointSuggestItem }
	| { kind: "clear" }
	| { kind: "cancel" };

interface IRPointSuggestModalOptions {
	placeholder?: string;
	items: IRPointSuggestItem[];
	allowClear?: boolean;
	clearLabel?: string;
	clearDescription?: string;
}

type SuggestEntry =
	| { kind: "point"; item: IRPointSuggestItem }
	| { kind: "clear"; label: string; description?: string };

/**
 * Fuzzy picker for canonical IR reading points (e.g. select parent).
 * Renders like Obsidian Quick Switcher: text-only rows, no leading icons.
 */
export class IRPointSuggestModal extends FuzzySuggestModal<SuggestEntry> {
	private readonly entries: SuggestEntry[];
	private resolver: ((choice: IRPointSuggestChoice) => void) | null = null;
	private choice: IRPointSuggestChoice | null = null;
	private settled = false;
	private closeTimer: number | null = null;

	constructor(app: App, options: IRPointSuggestModalOptions) {
		super(app);
		this.entries = [
			...(options.allowClear
				? [
						{
							kind: "clear" as const,
							label:
								options.clearLabel ??
								i18n.t("irModals.pointSuggest.clearLabel"),
							description:
								options.clearDescription ??
								i18n.t("irModals.pointSuggest.clearDescription"),
						},
				  ]
				: []),
			...options.items.map((item) => ({ kind: "point" as const, item })),
		];
		this.setPlaceholder(
			options.placeholder ?? i18n.t("irModals.pointSuggest.placeholder"),
		);
	}

	onOpen(): void {
		void super.onOpen();
		ensureSuggestModalTheme();
		markLatestSuggestionContainer("weave-ir-point-suggest-popover", {
			scopeEl: this.containerEl,
		});
	}

	getItems(): SuggestEntry[] {
		return this.entries;
	}

	getItemText(entry: SuggestEntry): string {
		if (entry.kind === "clear") {
			return `${entry.label} ${entry.description || ""}`.trim();
		}
		return [
			entry.item.title,
			entry.item.subtitle,
			entry.item.topicName,
			entry.item.id,
		]
			.filter(Boolean)
			.join(" ");
	}

	renderSuggestion(match: FuzzyMatch<SuggestEntry>, el: HTMLElement): void {
		el.empty();
		el.addClass("weave-ir-point-suggest-item");
		const entry = match.item;

		if (entry.kind === "clear") {
			el.createDiv({
				cls: "weave-ir-point-suggest-title",
				text: entry.label,
			});
			if (entry.description) {
				el.createDiv({
					cls: "weave-ir-point-suggest-subtitle",
					text: entry.description,
				});
			}
			return;
		}

		el.createDiv({
			cls: "weave-ir-point-suggest-title",
			text: entry.item.title || entry.item.id,
		});
		if (entry.item.subtitle) {
			el.createDiv({
				cls: "weave-ir-point-suggest-subtitle",
				text: entry.item.subtitle,
			});
		}
	}

	onChooseItem(entry: SuggestEntry): void {
		this.choice =
			entry.kind === "clear"
				? { kind: "clear" }
				: { kind: "point", item: entry.item };
		this.resolveOnce(this.choice);
	}

	async waitForChoice(): Promise<IRPointSuggestChoice> {
		return await new Promise((resolve) => {
			this.resolver = resolve;
			this.open();
		});
	}

	onClose(): void {
		if (this.closeTimer !== null) {
			window.clearTimeout(this.closeTimer);
		}
		this.closeTimer = window.setTimeout(() => {
			if (!this.choice) {
				this.resolveOnce({ kind: "cancel" });
			}
		}, 0);
		super.onClose();
	}

	private resolveOnce(value: IRPointSuggestChoice): void {
		if (this.settled) {
			return;
		}
		this.settled = true;
		const resolver = this.resolver;
		this.resolver = null;
		resolver?.(value);
	}
}
