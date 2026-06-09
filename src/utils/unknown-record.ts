export function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function readString(value: unknown): string {
	return typeof value === "string" ? value.trim() : "";
}

export function readNumber(value: unknown): number {
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : 0;
}

export function readStringArray(value: unknown): string[] {
	if (!Array.isArray(value)) {
		return [];
	}
	return value
		.map((entry) => readString(entry))
		.filter(Boolean);
}

export function readRecordProp(record: Record<string, unknown>, key: string): unknown {
	return record[key];
}

export function readOptionalString(value: unknown): string | undefined {
	const normalized = readString(value);
	return normalized || undefined;
}

export function readStringArrayFromUnknown(value: unknown): string[] {
	if (typeof value === "string") {
		return value
			.split(",")
			.map((entry) => entry.trim())
			.filter(Boolean);
	}
	return readStringArray(value);
}

export function asRecord(value: unknown): Record<string, unknown> | null {
	return isRecord(value) ? value : null;
}
