<script lang="ts">
  import type { App } from "obsidian";
  import { SearchComponent } from "obsidian";
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
  let searchHostEl = $state<HTMLDivElement | null>(null);
  let searchComponent: SearchComponent | null = null;
  let suppressSearchChange = false;
  let suggest: FolderSuggest | null = null;

  function syncSearchComponentValue(nextValue: string): void {
    if (!searchComponent) {
      return;
    }
    if (searchComponent.getValue() === nextValue) {
      return;
    }
    suppressSearchChange = true;
    searchComponent.setValue(nextValue);
    suppressSearchChange = false;
  }

  $effect(() => {
    draft = value;
    syncSearchComponentValue(value);
  });

  $effect(() => {
    const host = searchHostEl;
    if (!host) {
      return;
    }

    host.replaceChildren();
    const search = new SearchComponent(host);
    searchComponent = search;
    inputEl = search.inputEl;

    untrack(() => {
      search.setPlaceholder(placeholder || "");
      search.setValue(draft || "");
    });

    search.onChange((nextValue) => {
      if (suppressSearchChange) {
        return;
      }
      draft = nextValue;
      onInput?.(nextValue);
    });

    search.inputEl.spellcheck = false;
    search.inputEl.addEventListener("focus", handleFocus);
    search.inputEl.addEventListener("blur", handleBlur);
    search.inputEl.addEventListener("keydown", handleKeydown);

    return () => {
      search.inputEl.removeEventListener("focus", handleFocus);
      search.inputEl.removeEventListener("blur", handleBlur);
      search.inputEl.removeEventListener("keydown", handleKeydown);
      if (inputEl === search.inputEl) {
        inputEl = null;
      }
      if (searchComponent === search) {
        searchComponent = null;
      }
      host.replaceChildren();
    };
  });

  $effect(() => {
    searchComponent?.setPlaceholder(placeholder || "");
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
      syncSearchComponentValue(resetValue);
      onInput?.(resetValue);
      inputEl?.blur();
    }
  }
</script>

<div class="folder-search-input-host {className}">
  <div class="folder-search-component-host" bind:this={searchHostEl}></div>
</div>

<style>
  .folder-search-input-host {
    width: 100%;
    max-width: 100%;
  }

  .folder-search-component-host {
    width: 100%;
    max-width: 100%;
  }

  .folder-search-component-host :global(.search-input-container) {
    width: 100%;
    max-width: 100%;
  }

  .folder-search-component-host :global(.search-input-clear-button) {
    display: flex !important;
    opacity: 1 !important;
    pointer-events: auto !important;
  }
</style>
