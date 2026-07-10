import type { App, View, WorkspaceLeaf } from "obsidian";
import { readString } from "../../utils/unknown-record";
import { deriveWebPageTitleFromUrl } from "../incremental-reading/ir-web-reading-point";
import { OBSIDIAN_WEB_VIEWER_VIEW_TYPE } from "./obsidian-open-web-url";

export interface WebViewerPageContext {
	url: string;
	title: string;
	leaf: WorkspaceLeaf;
}

type WebViewerViewLike = View & {
	getState?: () => Record<string, unknown>;
	getDisplayText?: () => string;
};

export function readWebViewerUrlFromView(
	view: View | null | undefined,
): string {
	if (!view || view.getViewType?.() !== OBSIDIAN_WEB_VIEWER_VIEW_TYPE) {
		return "";
	}

	const webView = view as WebViewerViewLike & { url?: string };
	const directUrl = String(webView.url || "").trim();
	if (directUrl && !directUrl.startsWith("data:")) {
		return directUrl;
	}

	const state = webView.getState?.() ?? {};
	const url = readString(state.url);
	if (!url || url.startsWith("data:")) {
		return "";
	}

	return url;
}

export function readWebViewerTitleFromView(
	view: View | null | undefined,
	url: string,
): string {
	if (!view || view.getViewType?.() !== OBSIDIAN_WEB_VIEWER_VIEW_TYPE) {
		return deriveWebPageTitleFromUrl(url);
	}

	const webView = view as WebViewerViewLike & { title?: string };
	const directTitle = String(webView.title || "").trim();
	const state = webView.getState?.() ?? {};
	const stateTitle = readString(state.title);
	const displayText = readString(webView.getDisplayText?.());
	const title = directTitle || stateTitle || displayText;
	return title || deriveWebPageTitleFromUrl(url);
}

export function getWebViewerPageContextFromView(
	view: View | null | undefined,
): WebViewerPageContext | null {
	const url = readWebViewerUrlFromView(view);
	if (!url) {
		return null;
	}

	const leaf = view?.leaf;
	if (!leaf) {
		return null;
	}

	return {
		url,
		title: readWebViewerTitleFromView(view, url),
		leaf,
	};
}

export function getActiveWebViewerPageContext(
	app: App,
): WebViewerPageContext | null {
	const workspace = app.workspace as App["workspace"] & {
		getActiveLeaf?: () => import("obsidian").WorkspaceLeaf | null;
	};
	const activeLeaf =
		typeof workspace.getActiveLeaf === "function"
			? workspace.getActiveLeaf()
			: null;
	if (activeLeaf?.view?.getViewType?.() === OBSIDIAN_WEB_VIEWER_VIEW_TYPE) {
		return getWebViewerPageContextFromView(activeLeaf.view);
	}

	for (const leaf of app.workspace.getLeavesOfType(
		OBSIDIAN_WEB_VIEWER_VIEW_TYPE,
	)) {
		const context = getWebViewerPageContextFromView(leaf.view);
		if (context) {
			return context;
		}
	}

	return null;
}
