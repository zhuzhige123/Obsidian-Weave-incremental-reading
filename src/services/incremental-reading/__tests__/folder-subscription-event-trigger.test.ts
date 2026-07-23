import { describe, expect, it } from "vitest";
import { shouldTriggerFolderSubscriptionResyncForVaultEvent } from "../folder-subscription-event-trigger";

const rules = [
	{
		id: "rule-1",
		enabled: true,
		folderPath: "Inbox/Subscribed",
		deckId: "deck-1",
	},
];

describe("shouldTriggerFolderSubscriptionResyncForVaultEvent", () => {
	it("create 仅在新文件命中订阅规则时触发", () => {
		expect(
			shouldTriggerFolderSubscriptionResyncForVaultEvent({
				eventType: "create",
				nextPath: "Inbox/Subscribed/new.md",
				settingsOrRules: rules,
			}),
		).toBe(true);

		expect(
			shouldTriggerFolderSubscriptionResyncForVaultEvent({
				eventType: "create",
				nextPath: "Elsewhere/new.md",
				settingsOrRules: rules,
			}),
		).toBe(false);
	});

	it("忽略图片与其它非 Markdown 附件的 create/rename", () => {
		expect(
			shouldTriggerFolderSubscriptionResyncForVaultEvent({
				eventType: "create",
				nextPath: "Inbox/Subscribed/cover.png",
				settingsOrRules: rules,
			}),
		).toBe(false);

		expect(
			shouldTriggerFolderSubscriptionResyncForVaultEvent({
				eventType: "rename",
				nextPath: "Inbox/Subscribed/photo.jpg",
				previousPath: "Elsewhere/photo.jpg",
				settingsOrRules: rules,
			}),
		).toBe(false);
	});

	it("rename 仅在外部移入订阅范围时触发", () => {
		expect(
			shouldTriggerFolderSubscriptionResyncForVaultEvent({
				eventType: "rename",
				nextPath: "Inbox/Subscribed/new-name.md",
				previousPath: "Elsewhere/original.md",
				settingsOrRules: rules,
			}),
		).toBe(true);
	});

	it("rename 在订阅范围内重命名不触发", () => {
		expect(
			shouldTriggerFolderSubscriptionResyncForVaultEvent({
				eventType: "rename",
				nextPath: "Inbox/Subscribed/new-name.md",
				previousPath: "Inbox/Subscribed/old-name.md",
				settingsOrRules: rules,
			}),
		).toBe(false);
	});

	it("rename 从订阅范围移出或完全无关都不触发", () => {
		expect(
			shouldTriggerFolderSubscriptionResyncForVaultEvent({
				eventType: "rename",
				nextPath: "Elsewhere/moved-out.md",
				previousPath: "Inbox/Subscribed/inside.md",
				settingsOrRules: rules,
			}),
		).toBe(false);

		expect(
			shouldTriggerFolderSubscriptionResyncForVaultEvent({
				eventType: "rename",
				nextPath: "Elsewhere/b.md",
				previousPath: "Elsewhere/a.md",
				settingsOrRules: rules,
			}),
		).toBe(false);
	});
});
