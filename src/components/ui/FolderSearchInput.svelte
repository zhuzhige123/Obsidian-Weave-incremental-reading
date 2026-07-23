<script lang="ts">
  import type { App } from "obsidian";
  import { untrack } from "svelte";
  import { FolderSuggest } from "../../utils/FolderSuggest";

  interface Props {
    app: App;
    value: string;
    placeholder?: string;
    savedValue?: string;
    className?: string;
    onInput?: (value: string) => void;
    onCommit: (value: string) => void | Promise<void>;
  }

  let {
    app,
    value,
    placeholder = "",
    savedValue = value,
    className = "",
    onInput,
    onCommit,
  }: Props = $props();

  let draft = $state(untrack(() => value));
  let inputEl = $state<HTMLInputElement | null>(null);
  let suggest: FolderSuggest | null = null;

  $effect(() => {
    draft = value;
  });

  $effect(() => {
    if (!inputEl) {
      suggest?.close();
      suggest = null;
      return;
    }

    suggest?.close();
    const nextSuggest = new FolderSuggest(app, inputEl);
    suggest = nextSuggest;

    return () => {
      nextSuggest.close();
      if (suggest === nextSuggest) {
        suggest = null;
      }
    };
  });

  function handleFocus(): void {
    inputEl?.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function handleBlur(): void {
    void onCommit(draft);
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (event.key === "Enter") {
      event.preventDefault();
      void onCommit(draft);
      return;
    }

    if (event.key === "Escape") {
      const resetValue = savedValue;
      draft = resetValue;
      onInput?.(resetValue);
      inputEl?.blur();
    }
  }

  function handleInput(event: Event): void {
    const nextValue = (event.currentTarget as HTMLInputElement).value;
    draft = nextValue;
    onInput?.(nextValue);
  }
</script>

<div class="folder-search-input-host {className}">
  <div class="search-input-container">
    <input
      bind:this={inputEl}
      type="search"
      spellcheck="false"
      {placeholder}
      value={draft}
      oninput={handleInput}
      onfocus={handleFocus}
      onblur={handleBlur}
      onkeydown={handleKeydown}
    />
  </div>
</div>

<style>
  .folder-search-input-host {
    width: 100%;
    max-width: 100%;
  }

  .folder-search-input-host .search-input-container {
    width: 100%;
    max-width: 100%;
  }

  .folder-search-input-host input[type="search"] {
    width: 100%;
  }
</style>
