<script lang="ts">
  import type { App } from 'obsidian';
  import IRCalendarSearchInput from '../IRCalendarSearchInput.svelte';

  interface SearchDeckOption {
    id: string;
    name: string;
  }

  interface Props {
    app: App;
    searchQuery?: string;
    t: (key: string, vars?: Record<string, string | number>) => string;
    availableDecks: SearchDeckOption[];
    availableTags: Array<string | { name: string; count?: number }>;
    availablePriorities: number[];
    availableSources: string[];
    availableStates: string[];
    availableYamlKeys: string[];
    hasActiveSearch: boolean;
    searchMatchedCount: number;
    searchableTotalCount: number;
    onSearch: (query: string) => void;
    onClear: () => void;
  }

  let {
    app,
    searchQuery = $bindable(''),
    t,
    availableDecks,
    availableTags,
    availablePriorities,
    availableSources,
    availableStates,
    availableYamlKeys,
    hasActiveSearch,
    searchMatchedCount,
    searchableTotalCount,
    onSearch,
    onClear,
  }: Props = $props();
</script>

<div class="calendar-search-panel">
  <IRCalendarSearchInput
    bind:value={searchQuery}
    {app}
    showSortButton={false}
    {availableDecks}
    {availableTags}
    {availablePriorities}
    {availableSources}
    {availableStates}
    {availableYamlKeys}
    matchCount={hasActiveSearch ? searchMatchedCount : -1}
    totalCount={searchableTotalCount}
    {onSearch}
    {onClear}
    placeholder={t('irSidebar.calendar.searchPlaceholder')}
  />
</div>
