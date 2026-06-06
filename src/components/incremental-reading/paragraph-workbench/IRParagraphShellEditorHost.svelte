<script lang="ts">
	import { onDestroy } from "svelte";
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
		onChange?: (content: string) => void;
	}

	let {
		app,
		active = false,
		sourcePath = "",
		value = "",
		sessionId = "ir-paragraph-workbench",
		fontScale = 100,
		onChange,
	}: Props = $props();

	let hostEl = $state<HTMLElement | null>(null);
	let editor: DetachedLeafEditor | null = null;

	function destroyEditor(): void {
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

	$effect(() => {
		const shouldMount = active;
		const container = hostEl;
		const initialValue = value;
		const path = sourcePath;
		const id = sessionId;

		if (!shouldMount || !container) {
			destroyEditor();
			return;
		}

		container.empty();
		const instance = new DetachedLeafEditor(app, container, {
			value: initialValue,
			sourcePath: path,
			sessionId: id,
			onChange: () => {
				onChange?.(instance.value);
			},
		});
		editor = instance;
		instance.load();

		return () => {
			destroyEditor();
		};
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
	aria-hidden={!active}
></div>
