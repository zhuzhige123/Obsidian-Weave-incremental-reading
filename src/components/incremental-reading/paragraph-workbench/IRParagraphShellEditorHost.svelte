<script lang="ts" module>
	export interface ParagraphShellEditorApi {
		getValue: () => string;
		setValue: (content: string) => void;
		flush: () => string;
	}
</script>

<script lang="ts">
	import { onDestroy, untrack } from "svelte";
	import type { App } from "obsidian";
	import { DetachedLeafEditor } from "../../../services/editor/DetachedLeafEditor";
	import { logger } from "../../../utils/logger";

	interface Props {
		app: App;
		active?: boolean;
		sourcePath?: string;
		value?: string;
		sessionId?: string;
		fontScale?: number;
		syncTick?: number;
		onChange?: (content: string) => void;
		onReady?: (api: ParagraphShellEditorApi) => void;
	}

	let {
		app,
		active = false,
		sourcePath = "",
		value = "",
		sessionId = "ir-paragraph-workbench",
		fontScale = 100,
		syncTick = 0,
		onChange,
		onReady,
	}: Props = $props();

	let hostEl = $state<HTMLElement | null>(null);
	let editor: DetachedLeafEditor | null = null;
	let changeTimer: number | null = null;
	let applyingExternalValue = false;
	let lastEmittedValue = "";
	let lastAppliedSyncTick = -1;

	function destroyEditor(): void {
		if (changeTimer !== null) {
			window.clearTimeout(changeTimer);
			changeTimer = null;
		}
		if (!editor) {
			return;
		}
		try {
			editor.destroy();
		} catch (error) {
			logger.warn("[IRParagraphShellEditorHost] destroy failed:", error);
		}
		editor = null;
	}

	function emitChange(content: string): void {
		if (applyingExternalValue) {
			return;
		}
		if (content === lastEmittedValue) {
			return;
		}
		lastEmittedValue = content;
		onChange?.(content);
	}

	function scheduleChangeEmit(content: string): void {
		if (changeTimer !== null) {
			window.clearTimeout(changeTimer);
		}
		changeTimer = window.setTimeout(() => {
			changeTimer = null;
			emitChange(content);
		}, 220);
	}

	function getValue(): string {
		return editor?.value ?? value ?? "";
	}

	function setValue(next: string): void {
		const text = String(next ?? "");
		lastEmittedValue = text;
		if (!editor) {
			return;
		}
		if (editor.value === text) {
			return;
		}
		applyingExternalValue = true;
		try {
			editor.setValue(text);
			editor.refresh();
		} finally {
			window.setTimeout(() => {
				applyingExternalValue = false;
			}, 0);
		}
	}

	function flush(): string {
		if (changeTimer !== null) {
			window.clearTimeout(changeTimer);
			changeTimer = null;
		}
		const content = getValue();
		emitChange(content);
		return content;
	}

	const api: ParagraphShellEditorApi = {
		getValue,
		setValue,
		flush,
	};

	// Remount only when identity/path/active changes — not on every value sync.
	$effect(() => {
		const shouldMount = active;
		const container = hostEl;
		const path = sourcePath;
		const id = sessionId;
		const initialValue = untrack(() => value);

		if (!shouldMount || !container) {
			destroyEditor();
			onReady?.(api);
			return;
		}

		container.empty();
		lastEmittedValue = String(initialValue || "");
		lastAppliedSyncTick = untrack(() => syncTick);
		const instance = new DetachedLeafEditor(app, container, {
			value: initialValue,
			sourcePath: path,
			sessionId: id,
			onChange: () => {
				scheduleChangeEmit(instance.value);
			},
		});
		editor = instance;
		instance.load();
		onReady?.(api);

		return () => {
			destroyEditor();
		};
	});

	// Push external source updates (e.g. IR block id) into the live temp editor.
	$effect(() => {
		const tick = syncTick;
		const nextValue = value;
		if (!editor || tick === lastAppliedSyncTick) {
			return;
		}
		lastAppliedSyncTick = tick;
		setValue(nextValue);
	});

	onDestroy(() => {
		destroyEditor();
	});
</script>

<div
	class="ir-paragraph-workbench__editor-host weave-native-editor-shell"
	class:is-active={active}
	style={`--weave-paragraph-font-scale: ${fontScale / 100};`}
	bind:this={hostEl}
></div>
