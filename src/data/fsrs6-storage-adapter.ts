/**
 * FSRS6 数据存储适配器
 * 处理FSRS6数据的序列化、反序列化和版本迁移
 */

import type { FSRS6Card, PersonalizationData } from "../types/fsrs6-types";
import { FSRS6Error, FSRS6_DEFAULTS } from "../types/fsrs6-types";
import { CardState } from "./types";

type LegacyFSRS6CardData = Omit<Partial<FSRS6Card>, "version"> & {
	version?: string;
	id?: string;
	compressedHistory?: boolean;
	originalHistoryLength?: number;
	historyCompressed?: boolean;
};

type ValidatableFSRS6CardData = Omit<Partial<FSRS6Card>, "version"> & {
	version?: string;
};

type SerializedBatchData = {
	version?: string;
	count?: number;
	serializedAt?: string;
	cards?: LegacyFSRS6CardData[];
};

type SerializedPersonalizationData = Partial<PersonalizationData> & {
	version?: string;
	serializedAt?: string;
};

const CURRENT_VERSION = "6.1.1" as const;
const STORAGE_VERSION_KEY = "fsrs6_storage_version";

/**
 * FSRS6 存储适配器
 */
function isCardState(value: unknown): value is CardState {
	return (
		value === CardState.New ||
		value === CardState.Learning ||
		value === CardState.Review ||
		value === CardState.Relearning
	);
}

function normalizeCardState(value: unknown): CardState {
	return isCardState(value) ? value : CardState.New;
}

function ensureNumber(value: unknown, fallback = 0): number {
	return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/**
 * 序列化FSRS6卡片数据为JSON格式
 */
export function serializeFSRS6Card(card: FSRS6Card): string {
	try {
		const serializedCard = {
			...card,
			version: CURRENT_VERSION,
			serializedAt: new Date().toISOString(),
		};

		return JSON.stringify(serializedCard, null, 2);
	} catch (error) {
		throw new FSRS6Error(
			`Failed to serialize FSRS6 card: ${(error as Error).message}`,
			"SERIALIZATION_ERROR",
			{ cardId: card.due }
		);
	}
}

/**
 * 反序列化JSON数据为FSRS6卡片
 */
export function deserializeFSRS6Card(jsonData: string): FSRS6Card {
	try {
		const data = JSON.parse(jsonData) as LegacyFSRS6CardData;

		// 处理版本兼容性
		if (data.version !== CURRENT_VERSION) {
			return migrateCardData(data);
		}

		// 验证数据完整性
		validateCardData(data);

		return data;
	} catch (error) {
		throw new FSRS6Error(
			`Failed to deserialize FSRS6 card: ${(error as Error).message}`,
			"DESERIALIZATION_ERROR",
			{ jsonData: jsonData.substring(0, 100) }
		);
	}
}

/**
 * 批量序列化卡片数据
 */
export function serializeCardBatch(cards: FSRS6Card[]): string {
	try {
		const batchData = {
			version: CURRENT_VERSION,
			count: cards.length,
			serializedAt: new Date().toISOString(),
			cards: cards.map((card) => ({
				// 压缩复习历史以节省空间
				...compressReviewHistory(card),
			})),
		};

		return JSON.stringify(batchData);
	} catch (error) {
		throw new FSRS6Error(
			`Failed to serialize card batch: ${(error as Error).message}`,
			"BATCH_SERIALIZATION_ERROR",
			{ cardCount: cards.length }
		);
	}
}

/**
 * 批量反序列化卡片数据
 */
export function deserializeCardBatch(jsonData: string): FSRS6Card[] {
	try {
		const batchData = JSON.parse(jsonData) as SerializedBatchData;

		if (!batchData.cards || !Array.isArray(batchData.cards)) {
			throw new Error("Invalid batch data format");
		}

		return batchData.cards.map((cardData) => {
			// 解压复习历史
			const card = decompressReviewHistory(cardData);
			return deserializeFSRS6Card(JSON.stringify(card));
		});
	} catch (error) {
		throw new FSRS6Error(
			`Failed to deserialize card batch: ${(error as Error).message}`,
			"BATCH_DESERIALIZATION_ERROR",
			{ jsonData: jsonData.substring(0, 100) }
		);
	}
}

/**
 * 序列化个性化数据
 */
export function serializePersonalizationData(data: PersonalizationData): string {
	try {
		const serializedData = {
			...data,
			version: CURRENT_VERSION,
			serializedAt: new Date().toISOString(),
		};

		return JSON.stringify(serializedData, null, 2);
	} catch (error) {
		throw new FSRS6Error(
			`Failed to serialize personalization data: ${(error as Error).message}`,
			"PERSONALIZATION_SERIALIZATION_ERROR",
			{ userId: data.userId }
		);
	}
}

/**
 * 反序列化个性化数据
 */
export function deserializePersonalizationData(jsonData: string): PersonalizationData {
	try {
		const data = JSON.parse(jsonData) as SerializedPersonalizationData;

		// 验证个性化数据完整性
		validatePersonalizationData(data);

		return data;
	} catch (error) {
		throw new FSRS6Error(
			`Failed to deserialize personalization data: ${(error as Error).message}`,
			"PERSONALIZATION_DESERIALIZATION_ERROR",
			{ jsonData: jsonData.substring(0, 100) }
		);
	}
}

/**
 * 数据迁移：从旧版本格式迁移到FSRS6
 */
export function migrateCardData(oldData: LegacyFSRS6CardData): FSRS6Card {
	try {
		// 检测数据版本
		const sourceVersion = oldData.version || "unknown";

		let migratedCard: FSRS6Card;

		switch (sourceVersion) {
			case "unknown":
			case "5.0":
			case "5.1":
				migratedCard = migrateFromFSRS5(oldData);
				break;
			case "6.0":
			case "6.1.0":
				migratedCard = migrateFromEarlierFSRS6(oldData);
				break;
			default:
				throw new Error(`Unsupported source version: ${sourceVersion}`);
		}

		// 验证迁移结果
		validateCardData(migratedCard);

		return migratedCard;
	} catch (error) {
		throw new FSRS6Error(`Failed to migrate card: ${(error as Error).message}`, "MIGRATION_ERROR", {
			sourceVersion: oldData.version,
			cardId: oldData.id,
		});
	}
}

/**
 * 从FSRS5格式迁移
 */
function migrateFromFSRS5(fsrs5Data: LegacyFSRS6CardData): FSRS6Card {
	// 扩展17参数到21参数
	const extendedWeights = Array.isArray(fsrs5Data.personalizedWeights)
		? [...fsrs5Data.personalizedWeights]
		: [];
	while (extendedWeights.length < 21) {
		extendedWeights.push(FSRS6_DEFAULTS.DEFAULT_WEIGHTS[extendedWeights.length]);
	}

	return {
		due: fsrs5Data.due ?? new Date().toISOString(),
		stability: ensureNumber(fsrs5Data.stability),
		difficulty: ensureNumber(fsrs5Data.difficulty, 1.3),
		elapsedDays: ensureNumber(fsrs5Data.elapsedDays),
		scheduledDays: ensureNumber(fsrs5Data.scheduledDays),
		reps: ensureNumber(fsrs5Data.reps),
		lapses: ensureNumber(fsrs5Data.lapses),
		state: normalizeCardState(fsrs5Data.state),
		lastReview: fsrs5Data.lastReview,
		retrievability: ensureNumber(fsrs5Data.retrievability),
		reviewHistory: fsrs5Data.reviewHistory,
		version: CURRENT_VERSION,
		personalizedWeights: extendedWeights,
		shortTermMemoryFactor: 1.0,
		longTermStabilityFactor: 1.0,
		memoryPrediction: undefined,
	};
}

/**
 * 从早期FSRS6版本迁移
 */
function migrateFromEarlierFSRS6(fsrs6Data: LegacyFSRS6CardData): FSRS6Card {
	return {
		due: fsrs6Data.due ?? new Date().toISOString(),
		stability: ensureNumber(fsrs6Data.stability),
		difficulty: ensureNumber(fsrs6Data.difficulty, 1.3),
		elapsedDays: ensureNumber(fsrs6Data.elapsedDays),
		scheduledDays: ensureNumber(fsrs6Data.scheduledDays),
		reps: ensureNumber(fsrs6Data.reps),
		lapses: ensureNumber(fsrs6Data.lapses),
		state: normalizeCardState(fsrs6Data.state),
		lastReview: fsrs6Data.lastReview,
		retrievability: ensureNumber(fsrs6Data.retrievability),
		reviewHistory: fsrs6Data.reviewHistory,
		version: CURRENT_VERSION,
		personalizedWeights: fsrs6Data.personalizedWeights,
		memoryPrediction: fsrs6Data.memoryPrediction,
		shortTermMemoryFactor: ensureNumber(fsrs6Data.shortTermMemoryFactor, 1.0),
		longTermStabilityFactor: ensureNumber(fsrs6Data.longTermStabilityFactor, 1.0),
	};
}

/**
 * 验证卡片数据完整性
 */
function validateCardData(data: ValidatableFSRS6CardData): asserts data is FSRS6Card {
	const requiredFields: Array<keyof FSRS6Card> = [
		"due",
		"stability",
		"difficulty",
		"elapsedDays",
		"scheduledDays",
		"reps",
		"lapses",
		"state",
		"retrievability",
	];

	for (const field of requiredFields) {
		if (data[field] === undefined || data[field] === null) {
			throw new Error(`Missing required field: ${field}`);
		}
	}

	if (typeof data.due !== "string") {
		throw new Error("Invalid due format");
	}

	if (
		typeof data.stability !== "number" ||
		typeof data.difficulty !== "number" ||
		typeof data.elapsedDays !== "number" ||
		typeof data.scheduledDays !== "number" ||
		typeof data.reps !== "number" ||
		typeof data.lapses !== "number" ||
		typeof data.retrievability !== "number" ||
		!isCardState(data.state)
	) {
		throw new Error("Invalid card parameter types");
	}

	// 验证数值范围
	if (data.stability < 0 || data.difficulty < 1 || data.difficulty > 10) {
		throw new Error("Invalid card parameter values");
	}
}

/**
 * 验证个性化数据完整性
 */
function validatePersonalizationData(
	data: Partial<PersonalizationData>
): asserts data is PersonalizationData {
	const requiredFields: Array<keyof PersonalizationData> = [
		"userId",
		"dataPoints",
		"personalizedWeights",
	];

	for (const field of requiredFields) {
		if (data[field] === undefined || data[field] === null) {
			throw new Error(`Missing required personalization field: ${field}`);
		}
	}

	if (typeof data.userId !== "string" || typeof data.dataPoints !== "number") {
		throw new Error("Invalid personalization data types");
	}

	if (!Array.isArray(data.personalizedWeights) || data.personalizedWeights.length !== 21) {
		throw new Error("Invalid personalized weights format");
	}
}

/**
 * 压缩复习历史以节省存储空间
 */
function compressReviewHistory(card: FSRS6Card): FSRS6Card & {
	compressedHistory?: boolean;
	originalHistoryLength?: number;
} {
	// 简化实现：保留最近50次复习记录
	const maxHistory = 50;

	if (card.reviewHistory && card.reviewHistory.length > maxHistory) {
		return {
			...card,
			reviewHistory: card.reviewHistory.slice(-maxHistory),
			compressedHistory: true,
			originalHistoryLength: card.reviewHistory.length,
		};
	}

	return card;
}

/**
 * 解压复习历史
 */
function decompressReviewHistory(
	cardData: LegacyFSRS6CardData
): LegacyFSRS6CardData & { historyCompressed?: boolean } {
	if (cardData.compressedHistory) {
		// 标记历史已被压缩，但保持数据完整性
		return {
			...cardData,
			reviewHistory: cardData.reviewHistory || [],
			historyCompressed: true,
		};
	}

	return cardData;
}

/**
 * 数据完整性检查
 */
export function validateDataIntegrity(cards: FSRS6Card[]): {
	isValid: boolean;
	errors: string[];
	warnings: string[];
} {
	const errors: string[] = [];
	const warnings: string[] = [];

	for (const card of cards) {
		try {
			validateCardData(card);
		} catch (error) {
			errors.push(`Failed to validate card: ${(error as Error).message}`);
		}

		// 检查数据一致性
		if (card.reps < card.lapses) {
			warnings.push(`Card has more lapses than reviews: ${card.due}`);
		}

		if (card.stability <= 0 && card.state !== CardState.New) {
			warnings.push(`Non-new card has zero stability: ${card.due}`);
		}
	}

	return {
		isValid: errors.length === 0,
		errors,
		warnings,
	};
}

/**
 * 获取存储统计信息
 */
export function getStorageStats(cards: FSRS6Card[]): {
	totalCards: number;
	averageStability: number;
	averageDifficulty: number;
	totalReviews: number;
	compressionRatio: number;
} {
	if (cards.length === 0) {
		return {
			totalCards: 0,
			averageStability: 0,
			averageDifficulty: 0,
			totalReviews: 0,
			compressionRatio: 0,
		};
	}

	const totalStability = cards.reduce((sum, card) => sum + card.stability, 0);
	const totalDifficulty = cards.reduce((sum, card) => sum + card.difficulty, 0);
	const totalReviews = cards.reduce((sum, card) => sum + card.reps, 0);

	// 计算压缩比率
	const originalSize = JSON.stringify(cards).length;
	const compressedSize = serializeCardBatch(cards).length;
	const compressionRatio = compressedSize / originalSize;

	return {
		totalCards: cards.length,
		averageStability: totalStability / cards.length,
		averageDifficulty: totalDifficulty / cards.length,
		totalReviews,
		compressionRatio,
	};
}

export const FSRS6StorageAdapter = {
	CURRENT_VERSION,
	STORAGE_VERSION_KEY,
	serializeFSRS6Card,
	deserializeFSRS6Card,
	serializeCardBatch,
	deserializeCardBatch,
	serializePersonalizationData,
	deserializePersonalizationData,
	migrateCardData,
	validateDataIntegrity,
	getStorageStats,
};
