import type { App } from "obsidian";

type StringMapLike = Map<string, string> | Record<string, string>;
type UnknownMapLike = Map<string, unknown> | Record<string, unknown>;

export type ObsidianViewRegistry = {
	typeByExtension?: StringMapLike;
	viewByType?: UnknownMapLike;
	viewCreators?: UnknownMapLike;
	views?: UnknownMapLike;
};

type AppWithViewRegistry = App & {
	viewRegistry?: ObsidianViewRegistry;
};

function readMapValue<T>(
	map: Map<string, T> | Record<string, T> | undefined,
	key: string,
): T | null {
	if (!map || !key) {
		return null;
	}

	if (map instanceof Map) {
		return map.get(key) ?? null;
	}

	return map[key] ?? null;
}

export function getObsidianViewRegistry(app: App): ObsidianViewRegistry | null {
	return (app as AppWithViewRegistry).viewRegistry ?? null;
}

export function getRegisteredViewTypeForExtension(
	app: App,
	extension: string,
): string | null {
	const normalizedExtension = extension.trim().toLowerCase();
	if (!normalizedExtension) {
		return null;
	}

	const typeByExtension = getObsidianViewRegistry(app)?.typeByExtension;
	const viewType = readMapValue(typeByExtension, normalizedExtension);
	return typeof viewType === "string" && viewType.trim() ? viewType : null;
}

export function isRegisteredViewType(app: App, viewType: string): boolean {
	const registry = getObsidianViewRegistry(app);
	if (!registry || !viewType) {
		return false;
	}

	const creators =
		registry.viewByType ?? registry.viewCreators ?? registry.views;
	const creator = readMapValue(creators, viewType);
	return Boolean(creator);
}
