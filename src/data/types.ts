// IR plugin shared data stubs — FSRS scheduling types and Card/Deck compatibility shapes.

export { ConflictResolution } from "../services/identifier/types";

export interface FSRSCard {
	due: string;
	stability: number;
	difficulty: number;
	elapsedDays: number;
	scheduledDays: number;
	reps: number;
	lapses: number;
	state: CardState;
	lastReview?: string;
	retrievability: number;
	reviewHistory?: ReviewLog[];
}

export enum CardState {
	New = 0,
	Learning = 1,
	Review = 2,
	Relearning = 3,
}

export enum Rating {
	Again = 1,
	Hard = 2,
	Good = 3,
	Easy = 4,
}

export interface ReviewLog {
	rating: Rating;
	state: CardState;
	due: string;
	stability: number;
	difficulty: number;
	elapsedDays: number;
	lastElapsedDays: number;
	scheduledDays: number;
	review: string;
}

export type Review = ReviewLog;

/** IR runtime Card stub used by calendar/search/point-write bridges. */
export interface Card {
	id?: string;
	uuid: string;
	content: string;
	sourceFile?: string;
	sourceBlock?: string;
	sourceKind?: "markdown" | "pdf" | "epub" | "unknown";
	tags?: string[];
	priority?: number;
	fsrs?: FSRSCard;
	stats?: {
		totalReviews: number;
		totalTime: number;
		averageTime: number;
	};
	metadata?: Record<string, unknown>;
	ir_title?: string;
	ir_source_document_key?: string;
	ir_source_file?: string;
	ir_deck?: string;
	ir_state?: string;
	ir_priority?: number;
	ir_tags?: string[];
	ir_favorite?: boolean;
	ir_next_review?: string | null;
	ir_review_count?: number;
	ir_reading_time?: number;
	ir_notes?: number;
	ir_extract_cards?: number;
	ir_memory_cards?: number;
	ir_source_kind?: "markdown" | "pdf" | "epub" | "unknown";
	ir_source_subunit?: string;
	ir_created?: string;
	/** Legacy Weave card fields — still read from vault JSON during migration. */
	fields?: {
		source_file?: string;
		source_document?: string;
		obsidian_block_link?: string;
	};
	customFields?: Record<string, unknown>;
	cardPurpose?: string;
	sourceDocumentKey?: string;
	sourceSubunitKey?: string;
	outputKind?: string;
	created?: string;
	modified?: string;
}

/** Minimal deck lookup shape for YAML deck-field normalization. */
export interface Deck {
	id: string;
	name: string;
	purpose?: "memory" | "test";
}
