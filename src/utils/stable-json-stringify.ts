/**
 * 稳定 JSON 序列化（键排序），用于比较两个对象是否「内容等价」。
 * 用于增量阅读专题合并时检测同 point id 下内容是否一致。
 */
export function stableStringifyForMerge(value: unknown): string {
	if (value === null || typeof value !== "object") {
		return JSON.stringify(value);
	}
	if (Array.isArray(value)) {
		return `[${value.map((item) => stableStringifyForMerge(item)).join(",")}]`;
	}
	const record = value as Record<string, unknown>;
	const keys = Object.keys(record).sort((left, right) => left.localeCompare(right, "en"));
	return `{${keys
		.map((key) => `${JSON.stringify(key)}:${stableStringifyForMerge(record[key])}`)
		.join(",")}}`;
}
