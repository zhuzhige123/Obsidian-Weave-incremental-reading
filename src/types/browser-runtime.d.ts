export {};

type NetworkInformationLike = {
	effectiveType?: string;
	downlink?: number;
};

type ObsidianWindowApp = {
	appId?: string;
};

type NodeOsModule = {
	platform?: () => string;
	arch?: () => string;
	hostname?: () => string;
};

declare global {
	/** Obsidian active webview document (eslint obsidianmd/no-forbidden-ui-globals). */
	const activeDocument: Document;

	interface Navigator {
		deviceMemory?: number;
		connection?: NetworkInformationLike;
	}

	interface Window {
		app?: ObsidianWindowApp;
		require?: (moduleId: string) => NodeOsModule;
		webkitAudioContext?: typeof AudioContext;
		gc?: () => void;
		__weaveFocusManager?: {
			destroy(): void;
		} | null;
		__weaveFocusManagerCleanup?: (() => void) | null;
	}

	interface WindowEventMap {
		"Weave:license-changed": CustomEvent;
	}
}
