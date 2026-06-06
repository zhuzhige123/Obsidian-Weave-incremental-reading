import { App, Modal, Setting } from "obsidian";
import type {
	IRFolderSubscriptionApplyResult,
	IRFolderSubscriptionPendingRuleSummary,
} from "../services/incremental-reading/IRFolderSubscriptionSyncService";

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
		this.setTitle("订阅文件夹更新结果");

		const { scannedMarkdownCount, activeRuleCount, ruleSummaries, applyResult } = this.options;
		const totalMatched = ruleSummaries.reduce((sum, item) => sum + item.matchedCount, 0);

		contentEl.createEl("p", {
			text: `本次扫描 ${scannedMarkdownCount} 个 Markdown 文件，启用 ${activeRuleCount} 条订阅规则，命中 ${totalMatched} 个候选文件。`,
		});
		contentEl.createEl("p", {
			text: `新增 ${applyResult.added}，更新 ${applyResult.updated}，已存在跳过 ${applyResult.unchanged}。`,
		});

		this.renderPathSection(contentEl, "本次新增到增量阅读", applyResult.addedFiles);
		this.renderPathSection(contentEl, "本次已更新的已有材料", applyResult.updatedFiles);
		this.renderPathSection(contentEl, "已存在且未变更", applyResult.unchangedFiles);

		const ruleHost = contentEl.createDiv({ cls: "weave-folder-subscription-sync-result__rules" });
		ruleHost.createEl("h3", { text: "规则命中情况" });
		for (const summary of ruleSummaries) {
			const setting = new Setting(ruleHost)
				.setName(summary.folderPath || "/")
				.setDesc(`专题：${summary.deckName} | 命中 ${summary.matchedCount} | 待新增 ${summary.pendingCount}`);
			setting.setClass("weave-folder-subscription-sync-result__rule-item");
		}

		const footer = contentEl.createDiv({ cls: "weave-folder-subscription-sync-result__footer" });
		footer.createEl("button", { text: "关闭", cls: "mod-cta" }).onclick = () => this.close();
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private renderPathSection(container: HTMLElement, title: string, paths: string[]): void {
		const section = container.createDiv({ cls: "weave-folder-subscription-sync-result__section" });
		section.createEl("h3", { text: title });

		if (paths.length === 0) {
			section.createEl("p", { text: "无" });
			return;
		}

		const list = section.createEl("ul");
		for (const path of paths.slice(0, 30)) {
			list.createEl("li", { text: path });
		}
		if (paths.length > 30) {
			section.createEl("p", { text: `其余 ${paths.length - 30} 个文件未展开显示。` });
		}
	}
}
