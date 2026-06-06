import type { IRBlockStats } from "../../types/ir-types";

export interface IRCognitiveProfile {
	importanceScore: number;
	memoryPrioritySignalScore: number;
	urgencyScore: number;
	difficultyScore: number;
	stalenessScore: number;
	engagementScore: number;
	continuityScore: number;
	fatiguePenalty: number;
	manualBiasScore: number;
	timeCostScore: number;
	loadPenalty: number;
	volatilityPenalty: number;
	compositeScore: number;
}

export interface IRCognitiveProfileInput {
	scheduleStatus: string;
	nextRepDate: number;
	manualPriority?: number;
	effectivePriority?: number;
	memoryPrioritySignal?: number;
	intervalDays?: number;
	estimatedMinutes: number;
	stats?: Partial<IRBlockStats> & {
		impressions?: number;
		extracts?: number;
		cardsCreated?: number;
		notesWritten?: number;
	};
	nowMs: number;
	continuityHint?: number;
}

export interface IRUtilityContext {
	loadRatio?: number;
	volatilityPenalty?: number;
	fatiguePenalty?: number;
}

export interface IRUtilityBreakdown {
	contributions: {
		importance: number;
		urgency: number;
		staleness: number;
		engagement: number;
		continuity: number;
		manualBias: number;
	};
	penalties: {
		difficulty: number;
		timeCost: number;
		load: number;
		fatigue: number;
		volatility: number;
	};
	totalScore: number;
}

function clampScore(value: number, min = 0, max = 10): number {
	return Math.max(min, Math.min(max, value));
}

function roundScore(value: number): number {
	return Math.round(value * 10) / 10;
}

export class IRCognitiveProfileService {
	computeProfile(input: IRCognitiveProfileInput): IRCognitiveProfile {
		const overdueDays =
			input.nextRepDate > 0 && input.nextRepDate < input.nowMs
				? (input.nowMs - input.nextRepDate) / (24 * 60 * 60 * 1000)
				: 0;
		const impressions = input.stats?.impressions ?? 0;
		const outputs =
			(input.stats?.extracts ?? 0) +
			(input.stats?.cardsCreated ?? 0) +
			(input.stats?.notesWritten ?? 0);
		const manualBiasScore = clampScore(input.manualPriority ?? 0);
		const effectivePriority = clampScore(input.effectivePriority ?? input.manualPriority ?? 5);
		const memoryPrioritySignalScore = roundScore(clampScore(input.memoryPrioritySignal ?? 0));
		const hasMemoryPrioritySignal = typeof input.memoryPrioritySignal === "number";
		const importanceScore = roundScore(
			clampScore(
				effectivePriority * (hasMemoryPrioritySignal ? 0.5 : 0.65) +
					manualBiasScore * (hasMemoryPrioritySignal ? 0.2 : 0.35) +
					memoryPrioritySignalScore * (hasMemoryPrioritySignal ? 0.3 : 0)
			)
		);
		const urgencyBase = input.nextRepDate <= 0 ? 6 : 4;
		const urgencyScore = roundScore(clampScore(urgencyBase + overdueDays * 1.5));
		const intervalFactor =
			input.intervalDays && input.intervalDays > 1 ? Math.min(2, input.intervalDays / 7) : 0;
		const difficultyScore = roundScore(
			clampScore(
				3 +
					Math.min(2.5, input.estimatedMinutes / 2) +
					Math.max(0, 2 - impressions * 0.2) +
					intervalFactor +
					(input.scheduleStatus === "new" ? 1 : 0)
			)
		);
		const stalenessScore = roundScore(
			clampScore((overdueDays > 0 ? Math.min(4, overdueDays) : 0) + Math.min(3, intervalFactor))
		);
		const engagementRate = outputs / Math.max(1, impressions || 1);
		const engagementScore = roundScore(clampScore(engagementRate * 8));
		const continuityScore = roundScore(clampScore(input.continuityHint ?? 0));
		const fatiguePenalty = roundScore(
			clampScore(input.estimatedMinutes >= 8 ? 2 : input.estimatedMinutes >= 5 ? 1 : 0)
		);
		const timeCostScore = roundScore(clampScore(input.estimatedMinutes / 2));
		const loadPenalty = 0;
		const volatilityPenalty = 0;
		const compositeScore = this.computeUtility({
			importanceScore,
			memoryPrioritySignalScore,
			urgencyScore,
			difficultyScore,
			stalenessScore,
			engagementScore,
			continuityScore,
			fatiguePenalty,
			manualBiasScore,
			timeCostScore,
			loadPenalty,
			volatilityPenalty,
			compositeScore: 0,
		});

		return {
			importanceScore,
			memoryPrioritySignalScore,
			urgencyScore,
			difficultyScore,
			stalenessScore,
			engagementScore,
			continuityScore,
			fatiguePenalty,
			manualBiasScore,
			timeCostScore,
			loadPenalty,
			volatilityPenalty,
			compositeScore,
		};
	}

	computeUtility(profile: IRCognitiveProfile, context?: IRUtilityContext): number {
		return this.computeUtilityBreakdown(profile, context).totalScore;
	}

	computeUtilityBreakdown(
		profile: IRCognitiveProfile,
		context?: IRUtilityContext
	): IRUtilityBreakdown {
		const loadPenalty = clampScore(
			context?.loadRatio ? context.loadRatio * 4 : profile.loadPenalty
		);
		const fatiguePenalty = clampScore(context?.fatiguePenalty ?? profile.fatiguePenalty);
		const volatilityPenalty = clampScore(context?.volatilityPenalty ?? profile.volatilityPenalty);
		const contributions = {
			importance: roundScore(profile.importanceScore * 0.24),
			urgency: roundScore(profile.urgencyScore * 0.22),
			staleness: roundScore(profile.stalenessScore * 0.14),
			engagement: roundScore(profile.engagementScore * 0.1),
			continuity: roundScore(profile.continuityScore * 0.08),
			manualBias: roundScore(profile.manualBiasScore * 0.12),
		};
		const penalties = {
			difficulty: roundScore(profile.difficultyScore * 0.08),
			timeCost: roundScore(profile.timeCostScore * 0.06),
			load: roundScore(loadPenalty * 0.08),
			fatigue: roundScore(fatiguePenalty * 0.05),
			volatility: roundScore(volatilityPenalty * 0.05),
		};
		const score =
			contributions.importance +
			contributions.urgency +
			contributions.staleness +
			contributions.engagement +
			contributions.continuity +
			contributions.manualBias -
			penalties.difficulty -
			penalties.timeCost -
			penalties.load -
			penalties.fatigue -
			penalties.volatility;

		return {
			contributions,
			penalties,
			totalScore: roundScore(clampScore(score, 0, 10)),
		};
	}
}

export function createIRCognitiveProfileService(): IRCognitiveProfileService {
	return new IRCognitiveProfileService();
}
