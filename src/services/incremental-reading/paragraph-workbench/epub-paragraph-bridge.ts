import type { App } from "obsidian";
import type {
	EpubParagraphWorkbenchBridge,
	EpubParagraphWorkbenchSnapshot,
} from "./types";

const EPUB_READER_PLUGIN_ID = "weave-epub-reader";

export function getEpubParagraphWorkbenchBridge(
	app: App,
): EpubParagraphWorkbenchBridge | null {
	const plugin = (
		app as App & { plugins?: { getPlugin?: (id: string) => unknown } }
	).plugins?.getPlugin?.(EPUB_READER_PLUGIN_ID) as
		| {
				getEpubParagraphWorkbenchBridge?: () => EpubParagraphWorkbenchBridge | null;
		  }
		| undefined;
	if (!plugin?.getEpubParagraphWorkbenchBridge) {
		return null;
	}
	return plugin.getEpubParagraphWorkbenchBridge() ?? null;
}

export function getEpubParagraphSnapshot(
	app: App,
	filePath: string,
): EpubParagraphWorkbenchSnapshot | null {
	return getEpubParagraphWorkbenchBridge(app)?.getSnapshot(filePath) ?? null;
}

export async function navigateEpubParagraphRelative(
	app: App,
	filePath: string,
	direction: -1 | 1,
): Promise<boolean> {
	const bridge = getEpubParagraphWorkbenchBridge(app);
	if (!bridge?.navigateRelative) {
		return false;
	}
	return bridge.navigateRelative(filePath, direction);
}
