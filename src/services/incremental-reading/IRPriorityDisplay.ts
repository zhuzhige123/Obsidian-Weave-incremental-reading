/**
 * 连续优先级 (0–10) 的四档展示映射。
 * 档位：紧急 / 高 / 中 / 低 —— 色相拉开，匹配 soft badge 的浅底+深字。
 */

export type IRPriorityTier = "urgent" | "high" | "medium" | "low";

export interface IRPriorityPalette {
	/** 徽章 / 强调文字色 */
	text: string;
	/** 极浅底色 */
	background: string;
}

export interface IRPriorityTierStyle extends IRPriorityPalette {
	tier: IRPriorityTier;
	/** CSS 类名片段：priority-badge.{className} */
	className: IRPriorityTier;
}

/** 紧急 8.0–10 */
const URGENT: IRPriorityPalette = {
	background: "#FCE8EC",
	text: "#C6284A",
};

/** 高 6.0–7.9 */
const HIGH: IRPriorityPalette = {
	background: "#FFF3E0",
	text: "#C2760A",
};

/** 中 4.0–5.9 */
const MEDIUM: IRPriorityPalette = {
	background: "#EEF6E8",
	text: "#4A7C2C",
};

/** 低 0–3.9 */
const LOW: IRPriorityPalette = {
	background: "#E8EEF6",
	text: "#4A6FA5",
};

const PALETTE_BY_TIER: Record<IRPriorityTier, IRPriorityPalette> = {
	urgent: URGENT,
	high: HIGH,
	medium: MEDIUM,
	low: LOW,
};

/** 快捷预设代表值（四档各一点） */
export const IR_PRIORITY_PRESET_VALUES: ReadonlyArray<{
	tier: IRPriorityTier;
	value: number;
}> = [
	{ tier: "low", value: 2.5 },
	{ tier: "medium", value: 5 },
	{ tier: "high", value: 7 },
	{ tier: "urgent", value: 10 },
];

export function resolveIRPriorityTier(
	priority: number | undefined | null,
): IRPriorityTier {
	if (priority === undefined || priority === null) {
		return "medium";
	}
	const value = Number(priority);
	if (!Number.isFinite(value)) {
		return "medium";
	}
	if (value >= 8) return "urgent";
	if (value >= 6) return "high";
	if (value >= 4) return "medium";
	return "low";
}

export function getIRPriorityPalette(
	priority: number | undefined | null,
): IRPriorityPalette {
	return PALETTE_BY_TIER[resolveIRPriorityTier(priority)];
}

export function getIRPriorityStyle(
	priority: number | undefined | null,
): IRPriorityTierStyle {
	const tier = resolveIRPriorityTier(priority);
	return {
		tier,
		className: tier,
		...PALETTE_BY_TIER[tier],
	};
}

/** 仅文字色（信息窗数值着色等） */
export function getIRPriorityTextColor(
	priority: number | undefined | null,
): string {
	if (priority === undefined || priority === null) {
		return "var(--text-muted)";
	}
	return getIRPriorityPalette(priority).text;
}
