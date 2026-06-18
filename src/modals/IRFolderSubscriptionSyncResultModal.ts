import { App, Modal, Setting } from "obsidian";
import type {
	IRFolderSubscriptionApplyResult,
	IRFolderSubscriptionPendingRuleSummary,
} from "../services/incremental-reading/IRFolderSubscriptionSyncService";
import { i18n } from "../utils/i18n";

interface IRFolderSubscriptionSyncResultModalOptions {
	scannedMarkdownCount: number;
	activeRuleCount: number;
	ruleSummaries: IRFolderSubscriptionPendingRuleSummary[];
	applyResult: IRFolderSubscriptionApplyResult;
}

export class IRFolderSubscriptionSyncResultModal extends Modal {
	private readonly options: IRFolderSubscriptionSyncResultModalOptions;

	constructor(app: App, options: IRFolderSubscriptionSyncResultModalOptions) {
		super(app);
		this.options = options;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		this.setTitle(i18n.t("irModals.folderSubscriptionSyncResult.title"));

		const { scannedMarkdownCount, activeRuleCount, ruleSummaries, applyResult } = this.options;
		const totalMatched = ruleSummaries.reduce((sum, item) => sum + item.matchedCount, 0);

		contentEl.createEl("p", {
			text: i18n.t("irModals.folderSubscriptionSyncResult.scanSummary", {
				scanned: scannedMarkdownCount,
				rules: activeRuleCount,
				matched: totalMatched,
			}),
		});
		contentEl.createEl("p", {
			text: i18n.t("irModals.folderSubscriptionSyncResult.applySummary", {
				added: applyResult.added,
				updated: applyResult.updated,
				unchanged: applyResult.unchanged,
			}),
		});

		this.renderPathSection(
			contentEl,
			i18n.t("irModals.folderSubscriptionSyncResult.sectionAdded"),
			applyResult.addedFiles
		);
		this.renderPathSection(
			contentEl,
			i18n.t("irModals.folderSubscriptionSyncResult.sectionUpdated"),
			applyResult.updatedFiles
		);
		this.renderPathSection(
			contentEl,
			i18n.t("irModals.folderSubscriptionSyncResult.sectionUnchanged"),
			applyResult.unchangedFiles
		);

		const ruleHost = contentEl.createDiv({ cls: "weave-folder-subscription-sync-result__rules" });
		ruleHost.createEl("h3", { text: i18n.t("irModals.folderSubscriptionSyncResult.rulesHeading") });
		for (const summary of ruleSummaries) {
			const setting = new Setting(ruleHost)
				.setName(summary.folderPath || "/")
				.setDesc(
					i18n.t("irModals.folderSubscriptionSyncResult.ruleDesc", {
						deckName: summary.deckName,
						matched: summary.matchedCount,
						pending: summary.pendingCount,
					})
				);
			setting.setClass("weave-folder-subscription-sync-result__rule-item");
		}

		const footer = contentEl.createDiv({ cls: "weave-folder-subscription-sync-result__footer" });
		footer
			.createEl("button", { text: i18n.t("irModals.common.close"), cls: "mod-cta" })
			.onclick = () => this.close();
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private renderPathSection(container: HTMLElement, title: string, paths: string[]): void {
		const section = container.createDiv({ cls: "weave-folder-subscription-sync-result__section" });
		section.createEl("h3", { text: title });

		if (paths.length === 0) {
			section.createEl("p", { text: i18n.t("irModals.folderSubscriptionSyncResult.none") });
			return;
		}

		const list = section.createEl("ul");
		for (const path of paths.slice(0, 30)) {
			list.createEl("li", { text: path });
		}
		if (paths.length > 30) {
			section.createEl("p", {
				text: i18n.t("irModals.folderSubscriptionSyncResult.moreFiles", { count: paths.length - 30 }),
			});
		}
	}
}
