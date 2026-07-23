<script lang="ts">
  import { onMount } from 'svelte';
  import { vaultStorage } from '../../utils/vault-local-storage';
  import { Menu, TFolder, type App } from 'obsidian';
  import EnhancedIcon from '../ui/EnhancedIcon.svelte';
  import FloatingMenu from '../ui/FloatingMenu.svelte';
  import { ICON_NAMES } from '../../icons/index.js';
  import { logger } from '../../utils/logger';
  import {
    filterTagSuggestionItems,
    normalizeTagSuggestionOptions,
  } from '../../utils/tag-suggest';
  import { tr } from '../../utils/i18n';
  import { SCHEDULE_ITEM_TYPE_BADGES } from '../../services/incremental-reading/IRCalendarScheduleItemTypeBadge';
  import { formatCalendarDateKey } from './ir-calendar-date';

  const SEARCH_HISTORY_DATA_SOURCE = 'incremental-reading';

  type TagSuggestionOption = string | { name: string; count?: number };
  /** 月历搜索仅需展示名称；不必绑定完整 Deck 模型。 */
  interface SearchDeckOption {
    id: string;
    name: string;
  }

  interface Props {
    value?: string;
    placeholder?: string;
    onSearch?: (query: string) => void;
    onClear?: () => void;
    onSort?: (field: string) => void;
    app: App;
    availableDecks?: SearchDeckOption[];
    availableTags?: TagSuggestionOption[];
    availablePriorities?: number[];
    availableReadingPointTypes?: string[];
    availableSources?: string[];
    availableStates?: string[];
    availableYamlKeys?: string[];
    // 匹配计数
    matchCount?: number;
    totalCount?: number;
    // 排序状态
    sortField?: string;
    sortDirection?: 'asc' | 'desc';
    showSortButton?: boolean;
  }

  let {
    value = $bindable(''),
    placeholder = '',
    onSearch,
    onClear,
    onSort,
    app,
    availableDecks = [],
    availableTags = [],
    availablePriorities = [],
    availableReadingPointTypes = [...SCHEDULE_ITEM_TYPE_BADGES],
    availableSources = [],
    availableStates = [],
    availableYamlKeys = [],
    matchCount = -1,
    totalCount = -1,
    sortField = 'created',
    sortDirection = 'desc',
    showSortButton = false
  }: Props = $props();

  let inputRef: HTMLInputElement | null = $state(null);
  let containerRef: HTMLDivElement | null = $state(null);
  let searchHistory = $state<string[]>([]);
  let menuShown = $state(false);
  let showDropdown = $state(false);
  let anchorWidth = $state(0);
  let activeMenu: Menu | null = null;
  let activeSuggestionPanel = $state<'folder' | 'source' | 'tag' | null>(null);
  let suggestionQuery = $state('');
  let suggestionInputRef: HTMLInputElement | null = $state(null);
  let t = $derived($tr);
  let resolvedPlaceholder = $derived(placeholder || t('management.cardSearch.defaultPlaceholder'));

  const normalizedAvailableTags = $derived.by(() => {
    return normalizeTagSuggestionOptions(availableTags || []);
  });

  /** 标签建议由主搜索框 `tag:` 后缀实时过滤（对齐专题列表，无独立搜索框）。 */
  const tagSuggestionItems = $derived.by(() => {
    if (activeSuggestionPanel !== 'tag') {
      return [];
    }
    // 读取 value，保证主搜索框输入时列表可响应式刷新
    void value;
    return filterTagSuggestionItems(
      normalizedAvailableTags,
      getTagFilterQuery(),
      40,
    );
  });

  // 搜索选项定义
  const baseSearchOptions = $derived.by(() => [
    { prefix: 'deck:', label: t('management.cardSearch.options.deck'), afterInsert: () => showDeckSuggestions() },
    { prefix: 'tag:', label: t('management.cardSearch.options.tag'), afterInsert: () => showTagSuggestions() },
    { prefix: 'folder:', label: t('management.cardSearch.options.folder'), afterInsert: () => openFolderPicker() },
    { prefix: 'priority:', label: t('management.cardSearch.options.priority'), afterInsert: () => showPrioritySuggestions() },
    { prefix: 'source:', label: t('management.cardSearch.options.source'), afterInsert: () => showSourceSuggestions() },
    { prefix: 'created:', label: t('management.cardSearch.options.created'), afterInsert: () => showDateSuggestions('created') },
    { prefix: 'modified:', label: t('management.cardSearch.options.modified'), afterInsert: () => showDateSuggestions('modified') },
    { prefix: 'due:', label: t('management.cardSearch.options.due'), afterInsert: () => showDateSuggestions('due') },
    { prefix: 'yaml:', label: t('management.cardSearch.options.yaml'), afterInsert: () => showYamlSuggestions() },
  ]);

  const dataSourceOptions = $derived.by(() => [
    ...baseSearchOptions,
    {
      prefix: 'type:',
      label: t('management.cardSearch.options.readingPointType'),
      afterInsert: () => showReadingPointTypeSuggestions()
    },
    { prefix: 'state:', label: t('management.cardSearch.options.state'), afterInsert: () => showStateSuggestions() },
  ]);

  function handleInputFocus() {
    updateAnchorWidth();
    showDropdown = true;
  }

  function updateAnchorWidth() {
    anchorWidth = containerRef?.getBoundingClientRect().width ?? 0;
  }

  function getDropdownStyle(): string {
    const width = Math.max(220, Math.round(anchorWidth || 0));
    return `width:min(${width}px, calc(100vw - 16px));`;
  }

  function handleDropdownClose() {
    showDropdown = false;
    activeSuggestionPanel = null;
    suggestionQuery = '';
    closeActiveMenu();
  }

  function handleSearchHistorySelect(historyItem: string, e: MouseEvent) {
    if ((e.target as HTMLElement).closest('.dropdown-item-remove')) {
      e.preventDefault();
      return;
    }

    e.preventDefault();
    value = historyItem;
    onSearch?.(value);
    handleDropdownClose();
  }

  function removeHistoryItem(item: string, e: MouseEvent) {
    e.preventDefault();
    searchHistory = searchHistory.filter(h => h !== item);
    saveSearchHistory();
  }

  function clearAllHistory(e: MouseEvent) {
    e.preventDefault();
    searchHistory = [];
    saveSearchHistory();
  }

  onMount(() => {
    try {
      const saved = vaultStorage.getItem(`weave-search-history-${SEARCH_HISTORY_DATA_SOURCE}`);
      if (saved) {
        searchHistory = JSON.parse(saved);
      }
    } catch (error) {
      logger.error(t('management.cardSearch.loadHistoryFailed'), error);
    }

    return () => {
      closeActiveMenu();
    };
  });

  $effect(() => {
    if (!containerRef) return;

    const resizeObserver = new ResizeObserver(() => {
      updateAnchorWidth();
    });
    updateAnchorWidth();
    resizeObserver.observe(containerRef);

    return () => {
      resizeObserver.disconnect();
    };
  });

  // 保存搜索历史
  function saveSearchHistory() {
    try {
      vaultStorage.setItem(`weave-search-history-${SEARCH_HISTORY_DATA_SOURCE}`, JSON.stringify(searchHistory));
    } catch (error) {
      logger.error(t('management.cardSearch.saveHistoryFailed'), error);
    }
  }

  // 添加到搜索历史
  function addToHistory(query: string) {
    if (!query.trim()) return;
    
    searchHistory = searchHistory.filter(item => item !== query);
    searchHistory.unshift(query);
    if (searchHistory.length > 20) {
      searchHistory = searchHistory.slice(0, 20);
    }
    
    saveSearchHistory();
  }

  // 处理输入
  function handleInput(e: Event) {
    const target = e.target as HTMLInputElement;
    value = target.value;
    onSearch?.(value);
    
    // 检测是否输入了搜索前缀
    checkAndShowSuggestions();
  }

  function getCurrentSearchToken(): string {
    if (!inputRef) return '';

    const cursorPos = inputRef.selectionStart || 0;
    const textBeforeCursor = value.slice(0, cursorPos);
    const words = textBeforeCursor.split(/\s+/);
    return words[words.length - 1] ?? '';
  }

  function getSuggestionQuery(prefix: string): string {
    const token = getCurrentSearchToken();
    if (!token.toLowerCase().startsWith(prefix)) {
      return '';
    }

    return token
      .slice(prefix.length)
      .trim()
      .replace(/^['"]+/, '')
      .replace(/['"]+$/, '');
  }

  /** 标签过滤查询：优先光标所在 token；光标不可靠时回退到 value 末尾的 tag: 片段。 */
  function getTagFilterQuery(): string {
    const token = getCurrentSearchToken();
    if (token.toLowerCase().startsWith('tag:')) {
      return token
        .slice(4)
        .trim()
        .replace(/^['"]+/, '')
        .replace(/['"]+$/, '');
    }

    const trailing = value.match(/(?:^|\s)(tag:[^\s]*)$/i)?.[1] ?? '';
    if (!trailing.toLowerCase().startsWith('tag:')) {
      return '';
    }

    return trailing
      .slice(4)
      .trim()
      .replace(/^['"]+/, '')
      .replace(/['"]+$/, '');
  }

  // 检测并显示建议
  function checkAndShowSuggestions() {
    const lastWord = getCurrentSearchToken();
    const normalizedWord = lastWord.toLowerCase();

    if (normalizedWord.startsWith('tag:')) {
      // 与专题列表同构：展示标签列表；继续在主搜索框输入则实时过滤
      openTagSuggestionPanel();
    } else if (lastWord.endsWith('folder:')) {
      openFolderPicker();
    } else if (lastWord.endsWith('deck:')) {
      showDeckSuggestions();
    } else if (lastWord.endsWith('priority:')) {
      showPrioritySuggestions();
    } else if (lastWord.endsWith('type:')) {
      showReadingPointTypeSuggestions();
    } else if (lastWord.endsWith('source:')) {
      showSourceSuggestions();
    } else if (lastWord.endsWith('state:')) {
      showStateSuggestions();
    } else if (lastWord.endsWith('created:')) {
      showDateSuggestions('created');
    } else if (lastWord.endsWith('modified:')) {
      showDateSuggestions('modified');
    } else if (lastWord.endsWith('due:')) {
      showDateSuggestions('due');
    } else if (lastWord.endsWith('yaml:')) {
      showYamlSuggestions();
    } else {
      closeActiveMenu();
      if (activeSuggestionPanel === 'tag') {
        activeSuggestionPanel = null;
      }
    }
  }

  function collectFolders(): string[] {
    const folders = new Set<string>(['/']);

    function walk(folder: TFolder) {
      for (const child of folder.children) {
        if (child instanceof TFolder) {
          folders.add(child.path);
          walk(child);
        }
      }
    }

    walk(app.vault.getRoot());
    return Array.from(folders).sort((a, b) => a.localeCompare(b, 'zh-CN'));
  }

  function openFolderPicker() {
    showDropdown = false;
    closeActiveMenu();
    activeSuggestionPanel = 'folder';
    suggestionQuery = '';
    window.setTimeout(() => {
      suggestionInputRef?.focus();
      suggestionInputRef?.select();
    }, 0);
  }

  function getSuggestionPanelTitle(): string {
    if (activeSuggestionPanel === 'folder') {
      return t('management.cardSearch.folderPanelTitle');
    }
    if (activeSuggestionPanel === 'tag') {
      // 与专题 Menu 标题「专题」对齐，使用短标题「标签」
      return t('management.cardSearch.menuSections.tag');
    }
    return t('management.cardSearch.sourcePanelTitle');
  }

  function getSuggestionItems(): string[] {
    const normalizedQuery = suggestionQuery.trim().toLowerCase();

    if (activeSuggestionPanel === 'folder') {
      const folders = collectFolders();
      return normalizedQuery
        ? folders.filter((item) => getSuggestionItemLabel(item).toLowerCase().includes(normalizedQuery))
        : folders;
    }
    if (activeSuggestionPanel === 'source') {
      const sources = availableSources.slice(0, 100);
      return normalizedQuery
        ? sources.filter((item) => getSuggestionItemLabel(item).toLowerCase().includes(normalizedQuery))
        : sources;
    }
    return [];
  }

  function getSuggestionItemLabel(item: string): string {
    if (activeSuggestionPanel === 'folder') {
      return item === '/' ? t('management.cardSearch.vaultRoot') : item;
    }
    const fileName = item.split('/').pop() || item;
    return `${fileName} · ${item}`;
  }

  function handleSuggestionItemSelect(item: string, e: MouseEvent) {
    e.preventDefault();
    replaceLastWord(`"${item}"`);
    activeSuggestionPanel = null;
    suggestionQuery = '';
  }

  function handleTagSuggestionSelect(tag: string, e: MouseEvent) {
    e.preventDefault();
    replaceLastWord(tag);
    activeSuggestionPanel = null;
  }

  function openSourceSuggestionPanel() {
    showDropdown = false;
    closeActiveMenu();
    activeSuggestionPanel = 'source';
    suggestionQuery = '';
    window.setTimeout(() => {
      suggestionInputRef?.focus();
      suggestionInputRef?.select();
    }, 0);
  }

  function openTagSuggestionPanel() {
    showDropdown = false;
    closeActiveMenu();
    activeSuggestionPanel = 'tag';
    // 焦点留在主搜索框，便于继续输入并实时过滤标签列表
    window.setTimeout(() => {
      inputRef?.focus();
    }, 0);
  }

  function closeActiveMenu() {
    if (!activeMenu) return;

    const menu = activeMenu;
    activeMenu = null;
    menuShown = false;
    menu.hide();
    menu.close();
  }

  function showMenuSafe(menu: Menu) {
    if (!containerRef) return;
    activeSuggestionPanel = null;
    closeActiveMenu();
    activeMenu = menu;
    menuShown = true;
    const rect = containerRef.getBoundingClientRect();
    menu.onHide(() => {
      if (activeMenu === menu) {
        activeMenu = null;
        menuShown = false;
      }
    });
    menu.showAtPosition({ x: rect.left, y: rect.bottom + 2 });
  }

  function showStateSuggestions() {
    if (!containerRef || menuShown) return;
    const menu = new Menu();
    (menu as any).app = app;
    menu.addItem((item) => {
      item.setTitle(t('management.cardSearch.menuSections.readingState'));
      item.setDisabled(true);
    });
    const values = availableStates.length > 0
      ? availableStates
      : ['new', 'queued', 'scheduled', 'active', 'suspended', 'done', 'removed'];
    values.slice(0, 20).forEach((v) => {
      menu.addItem((item) => {
        item.setTitle(v);
        item.onClick(() => {
          replaceLastWord(v);
        });
      });
    });
    showMenuSafe(menu);
  }

  function showDateSuggestions(dateType: 'created' | 'modified' | 'due') {
    if (!containerRef || menuShown) return;
    const menu = new Menu();
    (menu as any).app = app;

    const titleMap = {
      created: t('management.cardSearch.dateMenus.created'),
      modified: t('management.cardSearch.dateMenus.modified'),
      due: t('management.cardSearch.dateMenus.due')
    };
    menu.addItem((item) => {
      item.setTitle(titleMap[dateType]);
      item.setDisabled(true);
    });

    const now = new Date();
    const todayStr = formatCalendarDateKey(now);
    const thisMonthStr = todayStr.slice(0, 7);
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthStr = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}`;
    const thisYearStart = `${now.getFullYear()}-01-01`;
    const weekEndStr = formatCalendarDateKey(
      new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7),
    );

    const presets = dateType === 'due'
      ? [
          { label: t('management.cardSearch.dateMenus.dueToday', { date: todayStr }), value: todayStr },
          { label: t('management.cardSearch.dateMenus.overdue'), value: `<${todayStr}` },
          { label: t('management.cardSearch.dateMenus.dueThisWeek'), value: `${todayStr}..${weekEndStr}` },
          { label: t('management.cardSearch.dateMenus.dueThisMonth', { month: thisMonthStr }), value: thisMonthStr },
        ]
      : [
          { label: t('management.cardSearch.dateMenus.today', { date: todayStr }), value: todayStr },
          { label: t('management.cardSearch.dateMenus.thisMonth', { month: thisMonthStr }), value: thisMonthStr },
          { label: t('management.cardSearch.dateMenus.lastMonth', { month: lastMonthStr }), value: lastMonthStr },
          { label: t('management.cardSearch.dateMenus.thisYear'), value: `${thisYearStart}..${todayStr}` },
          { label: t('management.cardSearch.dateMenus.range'), value: `${thisYearStart}..${todayStr}` },
        ];
    presets.forEach(({ label, value: v }) => {
      menu.addItem((item) => {
        item.setTitle(label);
        item.onClick(() => { replaceLastWord(v); });
      });
    });
    showMenuSafe(menu);
  }

  // 显示 YAML 属性建议
  function showYamlSuggestions() {
    if (!containerRef || menuShown) return;
    const menu = new Menu();
    (menu as any).app = app;
    menu.addItem((item) => {
      item.setTitle(t('management.cardSearch.menuSections.yamlFilter'));
      item.setDisabled(true);
    });
    menu.addItem((item) => {
      item.setTitle(t('management.cardSearch.menuSections.yamlInputFormat'));
      item.setDisabled(true);
    });

    const yamlKeys = availableYamlKeys.length > 0 ? availableYamlKeys : ['author', 'page', 'Color', 'Date', 'Annotation Type'];
    yamlKeys.slice(0, 20).forEach((key) => {
      menu.addItem((item) => {
        item.setTitle(`yaml:${key}:`);
        item.onClick(() => {
          replaceLastWord(`${key}:`);
        });
      });
    });
    showMenuSafe(menu);
  }

  // 显示标签建议（结构对齐专题列表；过滤走主搜索框）
  function showTagSuggestions() {
    openTagSuggestionPanel();
  }

  // 显示牌组建议
  function showDeckSuggestions() {
    if (!containerRef || menuShown) return;
    const menu = new Menu();
    (menu as any).app = app;
    menu.addItem((item) => {
      item.setTitle(t('management.cardSearch.menuSections.deck'));
      item.setDisabled(true);
    });
    availableDecks.slice(0, 20).forEach((deck) => {
      menu.addItem((item) => {
        item.setTitle(deck.name);
        item.onClick(() => {
          replaceLastWord(`"${deck.name}"`);
        });
      });
    });
    showMenuSafe(menu);
  }

  // 显示优先级建议
  function showPrioritySuggestions() {
    if (!containerRef || menuShown) return;
    const menu = new Menu();
    (menu as any).app = app;
    menu.addItem((item) => {
      item.setTitle(t('management.cardSearch.menuSections.priority'));
      item.setDisabled(true);
    });
    availablePriorities.forEach((priority) => {
      menu.addItem((item) => {
        item.setTitle(`${priority}`);
        item.onClick(() => {
          replaceLastWord(`${priority}`);
        });
      });
    });
    showMenuSafe(menu);
  }

  function showReadingPointTypeSuggestions() {
    if (!containerRef || menuShown) return;
    const menu = new Menu();
    (menu as any).app = app;
    menu.addItem((item) => {
      item.setTitle(t('management.cardSearch.menuSections.readingPointType'));
      item.setDisabled(true);
    });
    availableReadingPointTypes.forEach((type) => {
      menu.addItem((item) => {
        item.setTitle(type);
        item.onClick(() => {
          replaceLastWord(type);
        });
      });
    });
    showMenuSafe(menu);
  }

  // 显示来源建议
  function showSourceSuggestions() {
    openSourceSuggestionPanel();
  }

  // 替换最后一个词
  function replaceLastWord(replacement: string) {
    if (!inputRef) return;
    
    const cursorPos = inputRef.selectionStart || 0;
    const textBeforeCursor = value.slice(0, cursorPos);
    const textAfterCursor = value.slice(cursorPos);
    
    const words = textBeforeCursor.split(/\s+/);
    words[words.length - 1] = words[words.length - 1].replace(/[^:]*$/, replacement);
    
    const joined = words.join(' ') + ' ';
    const trimmedAfter = textAfterCursor.trimStart();
    const newValue = joined + trimmedAfter;
    const newCursorPos = joined.length;
    
    value = newValue;
    
    window.setTimeout(() => {
      if (inputRef) {
        inputRef.focus();
        inputRef.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
    
    onSearch?.(value);
  }

  // 清除搜索
  function handleClear() {
    closeActiveMenu();
    value = '';
    onClear?.();
    onSearch?.('');
    inputRef?.focus();
  }

  // 显示排序菜单（独立菜单，从排序图标触发）
  function showSortMenu(e: MouseEvent) {
    e.preventDefault();
    
    if (!containerRef || menuShown) return;
    
    const menu = new Menu();
    (menu as any).app = app;
    
    const sortFields = [
      { field: 'created', label: t('management.cardSearch.sortFields.created') },
      { field: 'modified', label: t('management.cardSearch.sortFields.modified') },
      { field: 'front', label: t('management.cardSearch.sortFields.front') },
      { field: 'back', label: t('management.cardSearch.sortFields.back') },
      { field: 'deck', label: t('management.cardSearch.sortFields.deck') },
      { field: 'tags', label: t('management.cardSearch.sortFields.tags') },
      { field: 'status', label: t('management.cardSearch.sortFields.status') },
    ];
    
    sortFields.forEach(({ field, label }) => {
      menu.addItem((item) => {
        if (sortField === field) {
          item.setChecked(true);
          item.setTitle(sortDirection === 'asc' ? `${label} ↑` : `${label} ↓`);
        } else {
          item.setTitle(label);
        }
        item.onClick(() => {
          onSort?.(field);
        });
      });
    });
    
    showMenuSafe(menu);
  }
  
  // 插入前缀到搜索框
  function insertPrefix(prefix: string) {
    if (!inputRef) return;
    
    // 如果搜索框为空或以空格结尾，直接添加
    if (!value || value.endsWith(' ')) {
      value = value + prefix;
    } else {
      // 否则先加空格再添加
      value = value + ' ' + prefix;
    }
    
    // 聚焦并将光标移到末尾
    window.setTimeout(() => {
      if (inputRef) {
        inputRef.focus();
        inputRef.setSelectionRange(value.length, value.length);
      }
    }, 0);
    
    onSearch?.(value);
  }

  // 处理回车
  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      addToHistory(value);
      handleDropdownClose();
    } else if (e.key === 'Escape') {
      handleDropdownClose();
      inputRef?.blur();
    } else if (e.key === ':') {
      // 输入冒号后延迟检查
      window.setTimeout(() => {
        checkAndShowSuggestions();
      }, 50);
    }
  }
</script>

<div class="card-search-container" bind:this={containerRef}>
  <div class="search-input-wrapper">
    <div class="search-icon">
      <EnhancedIcon name={ICON_NAMES.SEARCH} size={16} />
    </div>
    
    <input
      bind:this={inputRef}
      type="text"
      class="search-input"
      placeholder={resolvedPlaceholder}
      value={value}
      oninput={handleInput}
      onkeydown={handleKeydown}
      onfocus={handleInputFocus}
    />
    
    {#if value && matchCount >= 0}
      <span class="match-count">{matchCount}{totalCount >= 0 ? `/${totalCount}` : ''}</span>
    {/if}

    {#if value}
      <div
        class="clickable-icon clear-button"
        role="button"
        tabindex="-1"
        onclick={handleClear}
        onkeydown={(e) => { if (e.key === 'Enter') handleClear(); }}
        aria-label={t('management.cardSearch.clearSearch')}
      >
        <EnhancedIcon name={ICON_NAMES.TIMES} size={14} />
      </div>
    {/if}

    {#if showSortButton}
      <div
        class="clickable-icon filter-button"
        role="button"
        tabindex="-1"
        onclick={showSortMenu}
        onkeydown={(e) => { if (e.key === 'Enter') showSortMenu(e as unknown as MouseEvent); }}
        aria-label={t('management.cardSearch.sort')}
        title={t('management.cardSearch.sortOptions')}
      >
        <EnhancedIcon name={ICON_NAMES.SORT} size={14} />
      </div>
    {/if}
  </div>

  <FloatingMenu
    show={showDropdown}
    anchor={containerRef}
    placement="bottom-start"
    offset={4}
    onClose={handleDropdownClose}
    class="card-search-floating-menu"
  >
    {#snippet children()}
      <div class="search-dropdown weave-card-search-dropdown-panel" style={getDropdownStyle()}>
        <div class="dropdown-section">
          <div class="dropdown-section-header">{t('management.cardSearch.searchOptions')}</div>
          {#each dataSourceOptions as opt}
            <div
              class="dropdown-item"
              role="button"
              tabindex="-1"
              onmousedown={(e) => {
                e.preventDefault();
                insertPrefix(opt.prefix);
                showDropdown = false;
                if (opt.afterInsert) window.setTimeout(opt.afterInsert, 100);
              }}
            >
              <span class="dropdown-item-label">{opt.label}</span>
            </div>
          {/each}
        </div>

        {#if searchHistory.length > 0}
          <div class="dropdown-divider"></div>
          <div class="dropdown-section">
            <div class="dropdown-section-header">{t('management.cardSearch.searchHistory')}<span
                class="dropdown-clear-all"
                role="button"
                tabindex="-1"
                onmousedown={clearAllHistory}
              >{t('management.cardSearch.clearHistory')}</span></div>
            {#each searchHistory.slice(0, 10) as historyItem}
              <div
                class="dropdown-item"
                role="button"
                tabindex="-1"
                onmousedown={(e) => handleSearchHistorySelect(historyItem, e)}
              >
                <span class="dropdown-item-label">{historyItem}</span>
                <span
                  class="dropdown-item-remove"
                  role="button"
                  tabindex="-1"
                  onmousedown={(e) => {
                    e.preventDefault();
                    removeHistoryItem(historyItem, e);
                  }}
                  aria-label={t('management.cardSearch.deleteHistoryItem')}
                >
                  <EnhancedIcon name={ICON_NAMES.TIMES} size={10} />
                </span>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    {/snippet}
  </FloatingMenu>

  <FloatingMenu
    show={activeSuggestionPanel !== null}
    anchor={containerRef}
    placement="bottom-start"
    offset={4}
    onClose={() => {
      activeSuggestionPanel = null;
    }}
    class="card-search-floating-menu"
  >
    {#snippet children()}
      <div class="search-dropdown search-suggestion-panel weave-card-search-dropdown-panel" style={getDropdownStyle()}>
        <div class="dropdown-section">
          <div class="dropdown-section-header">{getSuggestionPanelTitle()}</div>
          {#if activeSuggestionPanel === 'tag'}
            {#if tagSuggestionItems.length === 0}
              <div class="dropdown-empty-state">
                {t('management.cardSearch.noTags')}
              </div>
            {:else}
              {#each tagSuggestionItems as item}
                <div
                  class="dropdown-item"
                  role="button"
                  tabindex="-1"
                  onmousedown={(e) => handleTagSuggestionSelect(item.tag, e)}
                >
                  <span class="dropdown-item-label">{item.tag}</span>
                </div>
              {/each}
            {/if}
          {:else}
            <div class="suggestion-search-box">
              <input
                bind:this={suggestionInputRef}
                type="text"
                class="suggestion-search-input"
                placeholder={activeSuggestionPanel === 'folder'
                  ? t('management.cardSearch.searchFolderPlaceholder')
                  : t('management.cardSearch.searchSourcePlaceholder')}
                bind:value={suggestionQuery}
              />
              {#if suggestionQuery}
                <button
                  type="button"
                  class="clickable-icon suggestion-search-clear"
                  onclick={() => {
                    suggestionQuery = '';
                    suggestionInputRef?.focus();
                  }}
                  aria-label={t('management.cardSearch.clearSuggestionSearch')}
                >
                  <EnhancedIcon name={ICON_NAMES.TIMES} size={12} />
                </button>
              {/if}
            </div>
            {#if getSuggestionItems().length === 0}
              <div class="dropdown-empty-state">
                {activeSuggestionPanel === 'folder'
                  ? t('management.cardSearch.noFolders')
                  : t('management.cardSearch.noSources')}
              </div>
            {:else}
              {#each getSuggestionItems() as item}
                <div
                  class="dropdown-item dropdown-item--multiline"
                  role="button"
                  tabindex="-1"
                  onmousedown={(e) => handleSuggestionItemSelect(item, e)}
                >
                  <span class="dropdown-item-label dropdown-item-label--multiline">
                    {getSuggestionItemLabel(item)}
                  </span>
                </div>
              {/each}
            {/if}
          {/if}
        </div>
      </div>
    {/snippet}
  </FloatingMenu>
</div>

<style>
  .card-search-container {
    position: relative;
    width: 100%;
  }

  .search-input-wrapper {
    position: relative;
    display: flex;
    align-items: center;
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    padding: 0 8px;
    transition: all 0.2s ease;
    z-index: 1;
  }

  .search-input-wrapper:focus-within {
    border-color: var(--interactive-accent);
    box-shadow: 0 0 0 2px var(--background-modifier-border-focus);
  }

  .search-icon {
    display: flex;
    align-items: center;
    color: var(--text-muted);
    margin-right: 8px;
  }

  .search-input {
    flex: 1;
    border: none;
    background: transparent;
    padding: 8px 4px;
    font-size: 14px;
    color: var(--text-normal);
    outline: none;
  }

  .search-input::placeholder {
    color: var(--text-faint);
  }

  .match-count {
    font-size: 0.75rem;
    color: var(--text-muted);
    white-space: nowrap;
    flex-shrink: 0;
    padding: 0 4px;
  }

  .clear-button {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 4px;
    background: transparent;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    border-radius: 4px;
    transition: all 0.2s ease;
  }

  .clear-button:hover {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }

  .filter-button {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 4px;
    background: transparent;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    border-radius: 4px;
    transition: all 0.2s ease;
    flex-shrink: 0;
    box-shadow: none;
    outline: none;
    -webkit-appearance: none;
    appearance: none;
  }

  .filter-button:hover {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }

  /* portal 面板实底见 src/styles/card-search-portal.css */

  .dropdown-section {
    padding: 4px 0;
  }

  .dropdown-section-header {
    padding: 6px 12px 4px;
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.03em;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .dropdown-clear-all {
    font-size: 0.7rem;
    font-weight: 400;
    color: var(--text-faint);
    cursor: pointer;
    text-transform: none;
    letter-spacing: normal;
  }

  .dropdown-clear-all:hover {
    color: var(--text-accent);
  }

  .dropdown-divider {
    height: 1px;
    background: var(--background-modifier-border);
    margin: 2px 8px;
  }

  .dropdown-item {
    display: flex;
    align-items: center;
    width: 100%;
    padding: 6px 12px;
    background: transparent;
    border: none;
    border-radius: 0;
    color: var(--text-normal);
    font-size: 0.8125rem;
    cursor: pointer;
    text-align: left;
    transition: background 0.1s ease;
    gap: 8px;
    box-shadow: none;
    outline: none;
    -webkit-appearance: none;
    appearance: none;
  }

  .dropdown-item:hover {
    background: var(--background-modifier-hover);
  }

  .dropdown-item-label {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .dropdown-item--multiline {
    align-items: flex-start;
    padding-top: 10px;
    padding-bottom: 10px;
  }

  .dropdown-item-label--multiline {
    white-space: normal;
    line-height: 1.5;
    word-break: break-word;
  }

  .dropdown-empty-state {
    padding: 12px;
    color: var(--text-muted);
    font-size: 0.8125rem;
  }

  .suggestion-search-box {
    position: relative;
    padding: 6px 12px 8px;
  }

  .suggestion-search-input {
    width: 100%;
    min-height: 36px;
    padding: 8px 34px 8px 12px;
    border: 1px solid var(--background-modifier-border);
    border-radius: 10px;
    background: var(--background-primary);
    color: var(--text-normal);
    font-size: 0.875rem;
    outline: none;
  }

  .suggestion-search-input:focus {
    border-color: var(--interactive-accent);
    box-shadow: 0 0 0 2px var(--background-modifier-border-focus);
  }

  .suggestion-search-clear {
    position: absolute;
    top: 50%;
    right: 20px;
    transform: translateY(-50%);
    width: 20px;
    height: 20px;
    padding: 0;
    border: none;
    border-radius: 999px;
    background: transparent;
    color: var(--text-faint);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  }

  .suggestion-search-clear:hover {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }

  .dropdown-item-remove {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    padding: 0;
    background: transparent;
    border: none;
    color: var(--text-faint);
    cursor: pointer;
    border-radius: 3px;
    flex-shrink: 0;
    opacity: 0;
    transition: all 0.15s ease;
  }

  .dropdown-item:hover .dropdown-item-remove {
    opacity: 1;
  }

  .dropdown-item-remove:hover {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }
</style>
