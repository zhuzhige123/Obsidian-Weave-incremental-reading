import type { App } from "obsidian";

export function isObsidianProtocolUrl(value: string): boolean {
	return /^obsidian:\/\//i.test(String(value || "").trim());
}

/** 从 bare URL、Markdown 外链或 wikilink 中提取可打开的链接文本。 */
export function resolveResumeLinkForOpen(raw: string): string {
	const trimmed = String(raw || "").trim();
	if (!trimmed) {
		return "";
	}
	if (isObsidianProtocolUrl(trimmed)) {
		return trimmed;
	}

	const protocolMatches = [...trimmed.matchAll(/\((obsidian:\/\/[^)]+)\)/gi)];
	if (protocolMatches.length > 0) {
		return protocolMatches[protocolMatches.length - 1][1];
	}

	return trimmed
		.replace(/^!?\[\[/, "")
		.replace(/\]\]$/, "")
		.split("|")[0]
		.trim();
}

/**
 * 触发 Obsidian 内置 obsidian:// 协议处理（等同点击 Markdown 外链）。
 * 不可对协议 URL 使用 workspace.openLinkText，否则会误走 vault 路径解析并触发非法字符报错。
 */
export function openObsidianProtocolUrl(_app: App, url: string): boolean {
	const normalized = resolveResumeLinkForOpen(url);
	if (!isObsidianProtocolUrl(normalized)) {
		return false;
	}
	if (typeof activeDocument === "undefined") {
		return false;
	}

	const anchor = activeDocument.body.createEl("a", {
		cls: "internal-link weave-protocol-open-anchor",
		attr: { href: normalized },
	});
	anchor.click();
	anchor.remove();
	return true;
}

/** @deprecated Use {@link resolveResumeLinkForOpen} */
export const resolveLinkTextForOpen = resolveResumeLinkForOpen;

export async function openResumeLink(
	app: App,
	rawLink: string,
): Promise<boolean> {
	const linkToOpen = resolveResumeLinkForOpen(rawLink);
	if (!linkToOpen) {
		return false;
	}
	if (isObsidianProtocolUrl(linkToOpen)) {
		return openObsidianProtocolUrl(app, linkToOpen);
	}

	const contextPath = app.workspace.getActiveFile()?.path ?? "";
	await app.workspace.openLinkText(linkToOpen, contextPath, false);
	return true;
}
