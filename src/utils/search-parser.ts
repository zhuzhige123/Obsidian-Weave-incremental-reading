/**
 * 卡片搜索解析器
 * 支持基于卡片数据的搜索语法
 */

export interface DateRange {
	from?: string; // ISO date string (YYYY-MM-DD)
	to?: string; // ISO date string (YYYY-MM-DD)
}

/** YAML 属性筛选 */
export interface YamlFilter {
	key: string;
	value: string;
}

export interface SearchQuery {
	// 基础搜索
	text: string[]; // 普通文本搜索

	// 卡片属性
	decks: string[]; // deck: 牌组名称
	tags: string[]; // tag: 标签
	priorities: number[]; // priority: 优先级
	types: string[]; // type: 题型
	sources: string[]; // source: 来源文档
	folders: string[]; // folder: 来源文件夹

	statuses: string[];
	states: string[];
	accuracies: string[];
	attempts: number[];
	errors: string[];

	// 日期范围筛选
	dateRanges: DateRange[]; // created:YYYY-MM-DD..YYYY-MM-DD
	modifiedRanges: DateRange[]; // modified:YYYY-MM-DD..YYYY-MM-DD
	dueRanges: DateRange[]; // due:YYYY-MM-DD..YYYY-MM-DD
	// YAML 属性筛选
	yamlFilters: YamlFilter[]; // yaml:key:value

	// 否定搜索（-前缀排除）
	excludeDecks: string[];
	excludeTags: string[];
	excludeTypes: string[];
	excludeSources: string[];
	excludeFolders: string[];
	excludeStatuses: string[];
	excludeText: string[];

	// 原始查询
	raw: string;
}

/**
 * 解析搜索查询
 */
export function parseSearchQuery(query: string): SearchQuery {
	const result: SearchQuery = {
		text: [],
		decks: [],
		tags: [],
		priorities: [],
		types: [],
		sources: [],
		folders: [],
		statuses: [],
		states: [],
		accuracies: [],
		attempts: [],
		errors: [],
		dateRanges: [],
		modifiedRanges: [],
		dueRanges: [],
		yamlFilters: [],
		excludeDecks: [],
		excludeTags: [],
		excludeTypes: [],
		excludeSources: [],
		excludeFolders: [],
		excludeStatuses: [],
		excludeText: [],
		raw: query,
	};

	if (!query.trim()) {
		return result;
	}

	// 收集所有已匹配区间 [start, end)，最后提取剩余文本
	const matchedRanges: [number, number][] = [];

	function execAll(pattern: RegExp, handler: (m: RegExpExecArray) => void) {
		pattern.lastIndex = 0;
		let m: RegExpExecArray | null;
		while ((m = pattern.exec(query)) !== null) {
			handler(m);
			matchedRanges.push([m.index, m.index + m[0].length]);
		}
	}

	// 提取各前缀
	execAll(/deck:"([^"]+)"|deck:(\S+)/g, (m) => {
		result.decks.push(m[1] || m[2]);
	});

	execAll(/tag:(\S+)/g, (m) => {
		let tagValue = m[1];
		if (tagValue.startsWith("#")) tagValue = tagValue.slice(1);
		result.tags.push(tagValue);
	});

	execAll(/priority:(\d+)/g, (m) => {
		result.priorities.push(parseInt(m[1]));
	});

	execAll(/type:(\S+)/g, (m) => {
		result.types.push(m[1]);
	});

	execAll(/source:"([^"]+)"|source:(\S+)/g, (m) => {
		result.sources.push(m[1] || m[2]);
	});

	execAll(/folder:"([^"]+)"|folder:(\S+)/g, (m) => {
		result.folders.push(m[1] || m[2]);
	});

	execAll(/status:(\S+)/g, (m) => {
		result.statuses.push(m[1]);
	});

	execAll(/state:(\S+)/g, (m) => {
		result.states.push(m[1]);
	});

	execAll(/accuracy:"([^"]+)"|accuracy:(\S+)/g, (m) => {
		result.accuracies.push(m[1] || m[2]);
	});

	execAll(/attempts:(\d+)/g, (m) => {
		result.attempts.push(parseInt(m[1]));
	});

	execAll(/error:(\S+)/g, (m) => {
		result.errors.push(m[1]);
	});

	execAll(/created:"([^"]+)"|created:(\S+)/g, (m) => {
		const raw = m[1] || m[2];
		const dateRange = parseDateRange(raw);
		if (dateRange) {
			result.dateRanges.push(dateRange);
		}
	});

	execAll(/modified:"([^"]+)"|modified:(\S+)/g, (m) => {
		const raw = m[1] || m[2];
		const dateRange = parseDateRange(raw);
		if (dateRange) {
			result.modifiedRanges.push(dateRange);
		}
	});

	execAll(/due:"([^"]+)"|due:(\S+)/g, (m) => {
		const raw = m[1] || m[2];
		const dateRange = parseDateRange(raw);
		if (dateRange) {
			result.dueRanges.push(dateRange);
		}
	});

	execAll(/yaml:(?:"([^"]+)"|([^\s:]+)):(?:"([^"]+)"|(\S+))/g, (m) => {
		const key = m[1] || m[2];
		const value = m[3] || m[4];
		if (key && value) {
			result.yamlFilters.push({ key, value });
		}
	});

	// 否定搜索：-prefix:value
	execAll(/-deck:"([^"]+)"|-deck:(\S+)/g, (m) => {
		result.excludeDecks.push(m[1] || m[2]);
	});
	execAll(/-tag:(\S+)/g, (m) => {
		let v = m[1];
		if (v.startsWith("#")) v = v.slice(1);
		result.excludeTags.push(v);
	});
	execAll(/-type:(\S+)/g, (m) => {
		result.excludeTypes.push(m[1]);
	});
	execAll(/-source:"([^"]+)"|-source:(\S+)/g, (m) => {
		result.excludeSources.push(m[1] || m[2]);
	});
	execAll(/-folder:"([^"]+)"|-folder:(\S+)/g, (m) => {
		result.excludeFolders.push(m[1] || m[2]);
	});
	execAll(/-status:(\S+)/g, (m) => {
		result.excludeStatuses.push(m[1]);
	});

	// 基于位置提取剩余文本（未被任何前缀匹配的部分）
	matchedRanges.sort((a, b) => a[0] - b[0]);
	let remaining = "";
	let pos = 0;
	for (const [start, end] of matchedRanges) {
		if (start > pos) {
			remaining += query.slice(pos, start);
		}
		pos = Math.max(pos, end);
	}
	if (pos < query.length) {
		remaining += query.slice(pos);
	}

	const textParts = remaining
		.trim()
		.split(/\s+/)
		.filter((part) => part.length > 0);

	for (const part of textParts) {
		if (part.startsWith("-") && part.length > 1) {
			result.excludeText.push(part.slice(1));
		} else {
			result.text.push(part);
		}
	}

	return result;
}

/**
 * 解析日期范围字符串
 * 支持格式：
 * - YYYY-MM-DD..YYYY-MM-DD  起止日期
 * - >YYYY-MM-DD             晚于指定日期
 * - <YYYY-MM-DD             早于指定日期
 * - YYYY-MM                 指定月份
 * - YYYY-MM-DD              指定单天
 */
function parseDateRange(raw: string): DateRange | null {
	if (!raw) return null;

	// 起止范围: 2024-01-01..2024-12-31
	if (raw.includes("..")) {
		const [from, to] = raw.split("..");
		return { from: from || undefined, to: to || undefined };
	}

	// 大于: >2024-01-01
	if (raw.startsWith(">")) {
		return { from: raw.slice(1) };
	}

	// 小于: <2024-12-31
	if (raw.startsWith("<")) {
		return { to: raw.slice(1) };
	}

	// 月份: 2024-01 → 2024-01-01..2024-01-31
	if (/^\d{4}-\d{2}$/.test(raw)) {
		const [year, month] = raw.split("-").map(Number);
		const lastDay = new Date(year, month, 0).getDate();
		return {
			from: `${raw}-01`,
			to: `${raw}-${String(lastDay).padStart(2, "0")}`,
		};
	}

	// 单天: 2024-01-15
	if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
		return { from: raw, to: raw };
	}

	return null;
}
