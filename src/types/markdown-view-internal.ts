import type { MarkdownView, Scope } from "obsidian";

export type MarkdownSourceModeLike = {
	type?: string;
	sourceMode?: boolean;
	toggleSource?: () => void;
};

export type MarkdownViewInternal = MarkdownView & {
	currentMode?: MarkdownSourceModeLike;
};

export function asMarkdownViewInternal(
	view: MarkdownView | null | undefined,
): MarkdownViewInternal | null {
	return view ?? null;
}

export function readMarkdownViewScope(
	view: MarkdownView | null | undefined,
): Scope | undefined {
	const scope = view?.scope;
	return scope ?? undefined;
}
