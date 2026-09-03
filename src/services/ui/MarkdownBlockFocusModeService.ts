import {
	type App,
	MarkdownView,
	type WorkspaceLeaf,
} from "obsidian";
import { RangeSetBuilder, StateEffect, StateField } from "@codemirror/state";
import {
	Decoration,
	type DecorationSet,
	EditorView,
	ViewPlugin,
	type ViewUpdate,
} from "@codemirror/view";
import { CURRENT_PLUGIN_ID } from "../../config/plugin-runtime";
import type { IncrementalReadingSettings } from "../../types/plugin-settings.d";
import type { ParsedReadingTarget } from "../incremental-reading/reading-target/IRReadingTargetTypes";
import {
	extractFocusFragmentFromResumeLink,
	type MarkdownBlockFocusRange,
	type MarkdownBlockFocusTarget,
	rangesEqual,
	resolveMarkdownBlockFocusRange,
	resolveSemanticBlockRangeAtLine,
} from "./markdown-block-focus-range";

export const WEAVE_MD_BLOCK_FOCUS_ROOT_CLASS = "weave-ir-md-block-focus";
export const WEAVE_MD_BLOCK_FOCUS_ACTIVE_CLASS =
	"weave-ir-md-block-focus-active";
/** Default opacity for non-focused lines (Border-style). */
export const WEAVE_MD_BLOCK_FOCUS_NORMAL_OPACITY = "0.15";

type FocusRangeEffectValue = MarkdownBlockFocusRange | null;

const setFocusRangeEffect = StateEffect.define<FocusRangeEffectValue>();

const focusRangeField = StateField.define<FocusRangeEffectValue>({
	create: () => null,
	update(value, tr) {
		let next = value;
		for (const effect of tr.effects) {
			if (effect.is(setFocusRangeEffect)) {
				next = effect.value;
			}
		}
		return next;
	},
	provide: (field) =>
		EditorView.decorations.compute([field], (state) => {
			const range = state.field(field);
			if (!range) {
				return Decoration.none;
			}
			return buildActiveLineDecorations(
				state.doc.lines,
				range.fromLine,
				range.toLine,
				(line) => state.doc.line(line).from,
			);
		}),
});

type FocusInteractionHost = {
	onFocusLine: (line: number) => void;
};

const focusHosts = new WeakMap<EditorView, FocusInteractionHost>();

/** Non-media embed cards (callouts / annotation blocks) that need active-class sync. */
const ANNOTATION_EMBED_SELECTOR = ".cm-embed-block:not(.media-embed):not(.image-embed):not(.video-embed)";

function isMediaEmbedElement(el: Element): boolean {
	return Boolean(
		el.closest(
			[
				".media-embed",
				".image-embed",
				".video-embed",
				"video",
				"audio",
				"iframe",
				".cm-embed-block.media-embed",
				".cm-embed-block.image-embed",
				".cm-embed-block.video-embed",
				".internal-embed.media-embed",
				".internal-embed.image-embed",
				".internal-embed.video-embed",
			].join(", "),
		),
	);
}

function resolveLineFromDom(
	view: EditorView,
	el: HTMLElement,
): number | null {
	try {
		const pos = view.posAtDOM(el, 0);
		return view.state.doc.lineAt(pos).number - 1;
	} catch {
		const rect = el.getBoundingClientRect();
		try {
			const pos = view.posAtCoords({
				x: rect.left + Math.min(8, rect.width / 2),
				y: rect.top + 4,
			});
			if (pos != null) {
				return view.state.doc.lineAt(pos).number - 1;
			}
		} catch {
			/* ignore */
		}
	}
	return null;
}

function syncAnnotationEmbedActiveClasses(
	view: EditorView,
	range: MarkdownBlockFocusRange | null,
): void {
	const content = view.contentDOM;
	if (!content) {
		return;
	}

	for (const child of Array.from(
		content.querySelectorAll(ANNOTATION_EMBED_SELECTOR),
	)) {
		if (!child.instanceOf(HTMLElement)) {
			continue;
		}
		// Only direct (or block-level) embed cards under cm-content.
		if (child.parentElement !== content) {
			continue;
		}

		if (!range) {
			child.classList.remove(WEAVE_MD_BLOCK_FOCUS_ACTIVE_CLASS);
			continue;
		}

		const line = resolveLineFromDom(view, child);
		const inRange =
			line != null && line >= range.fromLine && line <= range.toLine;
		child.classList.toggle(WEAVE_MD_BLOCK_FOCUS_ACTIVE_CLASS, inRange);
	}
}

const focusEmbedSyncPlugin = ViewPlugin.fromClass(
	class {
		constructor(private readonly view: EditorView) {
			queueMicrotask(() => this.sync());
		}

		update(update: ViewUpdate): void {
			const rangeChanged = update.transactions.some((tr) =>
				tr.effects.some((effect) => effect.is(setFocusRangeEffect)),
			);
			if (
				rangeChanged ||
				update.docChanged ||
				update.viewportChanged ||
				update.geometryChanged
			) {
				this.sync();
			}
		}

		sync(): void {
			const range = this.view.state.field(focusRangeField, false) ?? null;
			syncAnnotationEmbedActiveClasses(this.view, range);
		}
	},
);

const focusInteractionExtension = [
	focusRangeField,
	focusEmbedSyncPlugin,
	EditorView.updateListener.of((update) => {
		if (!update.selectionSet) {
			return;
		}
		const host = focusHosts.get(update.view);
		if (!host) {
			return;
		}
		const line =
			update.state.doc.lineAt(update.state.selection.main.head).number - 1;
		host.onFocusLine(line);
	}),
	EditorView.domEventHandlers({
		mousedown(event, view) {
			const host = focusHosts.get(view);
			if (!host) {
				return false;
			}
			// Leave videos/images alone: no focus switching from media clicks.
			if (event.target instanceof Element && isMediaEmbedElement(event.target)) {
				return false;
			}

			const target = event.target;
			if (target instanceof Element) {
				const annotation = target.closest(
					ANNOTATION_EMBED_SELECTOR,
				) as HTMLElement | null;
				if (annotation) {
					const line = resolveLineFromDom(view, annotation);
					if (line != null) {
						host.onFocusLine(line);
						return false;
					}
				}
			}

			try {
				const pos = view.posAtCoords({
					x: event.clientX,
					y: event.clientY,
				});
				if (pos != null) {
					host.onFocusLine(view.state.doc.lineAt(pos).number - 1);
				}
			} catch {
				/* ignore */
			}
			return false;
		},
	}),
];

function buildActiveLineDecorations(
	lineCount: number,
	fromLine: number,
	toLine: number,
	lineStart: (oneBasedLine: number) => number,
): DecorationSet {
	const builder = new RangeSetBuilder<Decoration>();
	const start = Math.max(1, Math.min(lineCount, fromLine + 1));
	const end = Math.max(start, Math.min(lineCount, toLine + 1));
	const mark = Decoration.line({
		class: WEAVE_MD_BLOCK_FOCUS_ACTIVE_CLASS,
	});
	for (let line = start; line <= end; line += 1) {
		const from = lineStart(line);
		builder.add(from, from, mark);
	}
	return builder.finish();
}

type EditorViewWithCm = {
	cm?: EditorView;
};

function getEditorView(view: MarkdownView): EditorView | null {
	const editor = view.editor as EditorViewWithCm | undefined;
	const cm = editor?.cm;
	return cm && typeof cm.dispatch === "function" ? cm : null;
}

function isFocusModeEnabled(app: App): boolean {
	const plugin = app.plugins.getPlugin(CURRENT_PLUGIN_ID) as
		| {
				getIncrementalReadingSettings?: () => IncrementalReadingSettings;
				settings?: { incrementalReading?: IncrementalReadingSettings };
		  }
		| null;
	if (!plugin) {
		return false;
	}
	if (typeof plugin.getIncrementalReadingSettings === "function") {
		return (
			plugin.getIncrementalReadingSettings().markdownBlockFocusModeEnabled ===
			true
		);
	}
	return (
		plugin.settings?.incrementalReading?.markdownBlockFocusModeEnabled === true
	);
}

function readLineCount(view: MarkdownView): number {
	try {
		return Math.max(0, view.editor?.lineCount?.() ?? 0);
	} catch {
		return 0;
	}
}

function readEditorContent(view: MarkdownView): string {
	try {
		return String(view.editor?.getValue?.() || "");
	} catch {
		return "";
	}
}

function readCursorLine(view: MarkdownView): number {
	try {
		return Math.max(0, view.editor?.getCursor?.()?.line ?? 0);
	} catch {
		return 0;
	}
}

export class MarkdownBlockFocusModeService {
	private readonly installedViews = new WeakSet<EditorView>();
	private readonly leafRanges = new WeakMap<
		WorkspaceLeaf,
		MarkdownBlockFocusRange | null
	>();
	private readonly previewClickDisposers = new WeakMap<
		WorkspaceLeaf,
		() => void
	>();
	private workspaceHooksRegistered = false;
	private workspaceDisposer: (() => void) | null = null;
	private active = false;

	constructor(private readonly app: App) {}

	destroy(): void {
		this.disable();
	}

	/** Call after settings load so a previously-enabled toggle activates immediately. */
	initializeFromSettings(): void {
		if (isFocusModeEnabled(this.app)) {
			this.enable();
		} else {
			this.disable();
		}
	}

	onSettingChanged(enabled: boolean): void {
		if (enabled) {
			this.enable();
		} else {
			this.disable();
		}
	}

	enable(): void {
		this.active = true;
		this.registerWorkspaceHooks();
		this.syncAllMarkdownLeaves({ seedFromCursor: true });
	}

	disable(): void {
		this.active = false;
		this.unregisterWorkspaceHooks();
		this.clearAll();
	}

	clearAll(): void {
		for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
			this.clearLeaf(leaf);
		}
	}

	/**
	 * IR open path: seed the initial focused block, then user can click freely.
	 */
	async applyForParsedReadingTarget(
		parsed: ParsedReadingTarget,
		options: { delayMs?: number } = {},
	): Promise<boolean> {
		if (!isFocusModeEnabled(this.app)) {
			return false;
		}
		this.active = true;
		this.registerWorkspaceHooks();

		if (
			parsed.kind !== "vault-block" &&
			parsed.kind !== "vault-link" &&
			parsed.kind !== "vault-file"
		) {
			return false;
		}

		const fragment = parsed.blockId
			? `^${parsed.blockId}`
			: extractFocusFragmentFromResumeLink(
					parsed.resumeLink || parsed.rawInput || "",
			  );
		if (parsed.kind === "vault-file" && !fragment) {
			await this.applyAfterOpen(null, options.delayMs ?? 180);
			return true;
		}

		const target: MarkdownBlockFocusTarget = {
			blockId: parsed.blockId || null,
			fragment: fragment || null,
		};
		return await this.applyAfterOpen(target, options.delayMs ?? 180);
	}

	async applyAfterOpen(
		target: MarkdownBlockFocusTarget | null,
		delayMs = 180,
	): Promise<boolean> {
		if (!isFocusModeEnabled(this.app)) {
			return false;
		}
		this.active = true;
		this.registerWorkspaceHooks();

		await new Promise<void>((resolve) => {
			window.setTimeout(resolve, Math.max(0, delayMs));
		});

		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!view?.file) {
			return false;
		}

		if (!target) {
			this.activateMarkdownView(view, {
				seedFromCursor: true,
			});
			return true;
		}

		const lineCount = readLineCount(view);
		const range = resolveMarkdownBlockFocusRange(
			this.app,
			view.file,
			target,
			lineCount,
		);
		this.activateMarkdownView(view, {
			seedRange: range,
			seedFromCursor: !range,
		});
		return Boolean(range);
	}

	private registerWorkspaceHooks(): void {
		if (this.workspaceHooksRegistered) {
			return;
		}
		this.workspaceHooksRegistered = true;

		const onActiveLeaf = this.app.workspace.on("active-leaf-change", () => {
			if (!this.active || !isFocusModeEnabled(this.app)) {
				return;
			}
			const view = this.app.workspace.getActiveViewOfType(MarkdownView);
			if (view) {
				this.activateMarkdownView(view, { seedFromCursor: true });
			}
		});

		const onLayout = this.app.workspace.on("layout-change", () => {
			if (!this.active || !isFocusModeEnabled(this.app)) {
				return;
			}
			this.syncAllMarkdownLeaves({ seedFromCursor: false });
		});

		this.workspaceDisposer = () => {
			this.app.workspace.offref(onActiveLeaf);
			this.app.workspace.offref(onLayout);
		};
	}

	private unregisterWorkspaceHooks(): void {
		this.workspaceDisposer?.();
		this.workspaceDisposer = null;
		this.workspaceHooksRegistered = false;
	}

	private syncAllMarkdownLeaves(options: { seedFromCursor: boolean }): void {
		for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
			const view = leaf.view;
			if (view?.getViewType?.() !== "markdown") {
				continue;
			}
			this.activateMarkdownView(view as MarkdownView, {
				seedFromCursor: options.seedFromCursor,
			});
		}
	}

	private activateMarkdownView(
		view: MarkdownView,
		options: {
			seedFromCursor?: boolean;
			seedRange?: MarkdownBlockFocusRange | null;
		} = {},
	): void {
		if (!this.active || !isFocusModeEnabled(this.app)) {
			this.clearView(view);
			return;
		}
		if (!view.file) {
			return;
		}

		const container = view.containerEl;
		container.addClass(WEAVE_MD_BLOCK_FOCUS_ROOT_CLASS);
		container.style.setProperty(
			"--weave-ir-md-block-focus-normal-opacity",
			WEAVE_MD_BLOCK_FOCUS_NORMAL_OPACITY,
		);

		const existing = this.leafRanges.get(view.leaf);
		let nextRange: MarkdownBlockFocusRange | null =
			options.seedRange ?? existing ?? null;

		if (!nextRange && options.seedFromCursor) {
			nextRange = this.resolveRangeAtLine(view, readCursorLine(view));
		}

		this.bindEditorInteraction(view);
		this.bindPreviewInteraction(view);
		this.applyRangeToView(view, nextRange);
	}

	private bindEditorInteraction(view: MarkdownView): void {
		const editorView = getEditorView(view);
		if (!editorView) {
			return;
		}
		if (!this.installedViews.has(editorView)) {
			editorView.dispatch({
				effects: StateEffect.appendConfig.of(focusInteractionExtension),
			});
			this.installedViews.add(editorView);
		}

		focusHosts.set(editorView, {
			onFocusLine: (line) => {
				if (!this.active || !isFocusModeEnabled(this.app)) {
					return;
				}
				const range = this.resolveRangeAtLine(view, line);
				this.applyRangeToView(view, range);
			},
		});
	}

	private bindPreviewInteraction(view: MarkdownView): void {
		this.previewClickDisposers.get(view.leaf)?.();

		const preview = view.containerEl.querySelector(
			".markdown-preview-view, .markdown-reading-view",
		) as HTMLElement | null;
		if (!preview) {
			this.previewClickDisposers.delete(view.leaf);
			return;
		}

		const onClick = (event: MouseEvent) => {
			if (!this.active || !isFocusModeEnabled(this.app)) {
				return;
			}
			const target = event.target as HTMLElement | null;
			if (!target) {
				return;
			}
			// Videos/images stay normal and must not steal annotation focus.
			if (isMediaEmbedElement(target)) {
				return;
			}
			const block = target.closest(
				".markdown-preview-sizer > :not(.mod-header):not(.mod-footer)",
			) as HTMLElement | null;
			if (!block?.parentElement) {
				return;
			}
			if (isMediaEmbedElement(block)) {
				return;
			}
			const siblings = Array.from(block.parentElement.children).filter(
				(el) =>
					!el.classList.contains("mod-header") &&
					!el.classList.contains("mod-footer") &&
					!isMediaEmbedElement(el),
			) as HTMLElement[];
			const index = siblings.indexOf(block);
			if (index < 0) {
				return;
			}
			siblings.forEach((el) => {
				el.classList.toggle(
					WEAVE_MD_BLOCK_FOCUS_ACTIVE_CLASS,
					el === block,
				);
			});
			this.leafRanges.set(view.leaf, {
				fromLine: index,
				toLine: index,
			});
		};

		preview.addEventListener("click", onClick);
		this.previewClickDisposers.set(view.leaf, () => {
			preview.removeEventListener("click", onClick);
		});
	}

	private resolveRangeAtLine(
		view: MarkdownView,
		line: number,
	): MarkdownBlockFocusRange | null {
		if (!view.file) {
			return null;
		}
		return resolveSemanticBlockRangeAtLine(this.app, view.file, line, {
			lineCount: readLineCount(view),
			content: readEditorContent(view),
		});
	}

	private applyRangeToView(
		view: MarkdownView,
		range: MarkdownBlockFocusRange | null,
	): void {
		const previous = this.leafRanges.get(view.leaf);
		const unchanged = rangesEqual(previous ?? null, range);
		if (!unchanged) {
			this.leafRanges.set(view.leaf, range);
		}

		const editorView = getEditorView(view);
		if (editorView && this.installedViews.has(editorView)) {
			try {
				if (!unchanged || previous === undefined) {
					editorView.dispatch({
						effects: setFocusRangeEffect.of(range),
					});
				}
				syncAnnotationEmbedActiveClasses(editorView, range);
			} catch {
				/* editor may be torn down */
			}
		} else if (range) {
			this.applyPreviewFocusByIndex(view, range.fromLine);
		}
	}

	private applyPreviewFocusByIndex(view: MarkdownView, index: number): void {
		const preview = view.containerEl.querySelector(
			".markdown-preview-sizer",
		) as HTMLElement | null;
		if (!preview) {
			return;
		}
		const children = Array.from(preview.children).filter(
			(el) =>
				!el.classList.contains("mod-header") &&
				!el.classList.contains("mod-footer") &&
				!isMediaEmbedElement(el),
		) as HTMLElement[];
		if (!children.length) {
			return;
		}
		const active =
			children[Math.max(0, Math.min(children.length - 1, index))] || null;
		children.forEach((el) => {
			el.classList.toggle(WEAVE_MD_BLOCK_FOCUS_ACTIVE_CLASS, el === active);
		});
	}

	private clearLeaf(leaf: WorkspaceLeaf): void {
		this.previewClickDisposers.get(leaf)?.();
		this.previewClickDisposers.delete(leaf);
		this.leafRanges.delete(leaf);
		const view = leaf.view;
		if (view?.getViewType?.() === "markdown") {
			this.clearView(view as MarkdownView);
		}
	}

	private clearView(view: MarkdownView): void {
		view.containerEl.removeClass(WEAVE_MD_BLOCK_FOCUS_ROOT_CLASS);
		view.containerEl.style.removeProperty(
			"--weave-ir-md-block-focus-normal-opacity",
		);
		view.containerEl
			.querySelectorAll(`.${WEAVE_MD_BLOCK_FOCUS_ACTIVE_CLASS}`)
			.forEach((el) => {
				el.classList.remove(WEAVE_MD_BLOCK_FOCUS_ACTIVE_CLASS);
			});

		const editorView = getEditorView(view);
		if (editorView) {
			focusHosts.delete(editorView);
			if (this.installedViews.has(editorView)) {
				try {
					editorView.dispatch({
						effects: setFocusRangeEffect.of(null),
					});
				} catch {
					/* ignore */
				}
			}
		}
	}
}

const services = new WeakMap<App, MarkdownBlockFocusModeService>();

export function getSharedMarkdownBlockFocusModeService(
	app: App,
): MarkdownBlockFocusModeService {
	let service = services.get(app);
	if (!service) {
		service = new MarkdownBlockFocusModeService(app);
		services.set(app, service);
	}
	return service;
}
