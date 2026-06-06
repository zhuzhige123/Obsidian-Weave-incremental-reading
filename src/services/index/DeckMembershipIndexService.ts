import { getPluginPaths } from "../../config/paths";
import type { Card, Deck } from "../../data/types";
import type { WeavePlugin } from "../../main";
import { DirectoryUtils } from "../../utils/directory-utils";
import { logger } from "../../utils/logger";
import { getCardDeckIds } from "../../utils/yaml-utils";

const DECK_MEMBERSHIP_INDEX_VERSION = 1;

type DeckLookup = Pick<Deck, "id" | "name">;

interface DeckMembershipIndexSnapshot {
	version: number;
	updatedAt: string;
	initialized: boolean;
	fullRebuildRequired: boolean;
	dirtyDeckIds: string[];
	deckToCardUUIDs: Record<string, string[]>;
}

export interface DeckMembershipIndexState {
	hasSnapshot: boolean;
	initialized: boolean;
	fullRebuildRequired: boolean;
	isDeckDirty: boolean;
	cardUUIDs: string[];
}

export class DeckMembershipIndexService {
	private writeChain: Promise<void> = Promise.resolve();

	constructor(private plugin: WeavePlugin) {}

	private get adapter() {
		return this.plugin.app.vault.adapter;
	}

	private get indexRoot(): string {
		return getPluginPaths(this.plugin.app).indices.root;
	}

	private get indexPath(): string {
		return getPluginPaths(this.plugin.app).indices.deckMembership;
	}

	async initialize(): Promise<void> {
		await DirectoryUtils.ensureDirRecursive(this.adapter, this.indexRoot);
	}

	async getDeckState(deckId: string): Promise<DeckMembershipIndexState> {
		const { snapshot, exists } = await this.readSnapshot();
		return {
			hasSnapshot: exists,
			initialized: snapshot.initialized,
			fullRebuildRequired: snapshot.fullRebuildRequired,
			isDeckDirty: snapshot.dirtyDeckIds.includes(deckId),
			cardUUIDs: [...(snapshot.deckToCardUUIDs[deckId] || [])],
		};
	}

	async markFullRebuildRequired(): Promise<void> {
		await this.mutateSnapshot((_snapshot) => ({
			..._snapshot,
			fullRebuildRequired: true,
		}));
	}

	async markDecksDirty(deckIds: string[]): Promise<void> {
		const normalizedDeckIds = Array.from(new Set(deckIds.filter(Boolean)));
		if (normalizedDeckIds.length === 0) {
			return;
		}

		await this.mutateSnapshot((snapshot) => ({
			...snapshot,
			dirtyDeckIds: Array.from(new Set([...snapshot.dirtyDeckIds, ...normalizedDeckIds])),
		}));
	}

	async removeDeck(deckId: string): Promise<void> {
		if (!deckId) {
			return;
		}

		await this.mutateSnapshot((_snapshot) => {
			const deckToCardUUIDs = { ..._snapshot.deckToCardUUIDs };
			delete deckToCardUUIDs[deckId];

			return {
				..._snapshot,
				dirtyDeckIds: _snapshot.dirtyDeckIds.filter((_id) => _id !== deckId),
				deckToCardUUIDs,
			};
		});
	}

	async removeCards(cardUUIDs: string[]): Promise<void> {
		const uniqueUUIDs = new Set(cardUUIDs.filter(Boolean));
		if (uniqueUUIDs.size === 0) {
			return;
		}

		await this.mutateSnapshot((_snapshot) => {
			const deckSets = this.toDeckSets(_snapshot.deckToCardUUIDs);
			for (const uuids of deckSets.values()) {
				for (const uuid of uniqueUUIDs) {
					uuids.delete(uuid);
				}
			}

			return {
				..._snapshot,
				fullRebuildRequired: _snapshot.fullRebuildRequired || !_snapshot.initialized,
				deckToCardUUIDs: this.fromDeckSets(deckSets),
			};
		});
	}

	async updateCards(cards: Card[], decks: DeckLookup[]): Promise<void> {
		const normalizedCards = cards.filter((card) => Boolean(card?.uuid));
		if (normalizedCards.length === 0) {
			return;
		}

		await this.mutateSnapshot((_snapshot) => {
			const deckSets = this.toDeckSets(_snapshot.deckToCardUUIDs);
			const affectedDeckIds = new Set<string>();

			for (const card of normalizedCards) {
				for (const [deckId, uuids] of deckSets.entries()) {
					if (uuids.delete(card.uuid)) {
						affectedDeckIds.add(deckId);
					}
				}

				const { deckIds } = getCardDeckIds(card, decks, { fallbackToReferences: false });
				for (const deckId of deckIds) {
					if (!deckId) {
						continue;
					}

					let uuids = deckSets.get(deckId);
					if (!uuids) {
						uuids = new Set<string>();
						deckSets.set(deckId, uuids);
					}
					uuids.add(card.uuid);
					affectedDeckIds.add(deckId);
				}
			}

			const dirtyDeckIds = new Set(_snapshot.dirtyDeckIds);
			for (const deckId of affectedDeckIds) {
				dirtyDeckIds.delete(deckId);
			}

			return {
				..._snapshot,
				fullRebuildRequired: _snapshot.fullRebuildRequired || !_snapshot.initialized,
				dirtyDeckIds: Array.from(dirtyDeckIds),
				deckToCardUUIDs: this.fromDeckSets(deckSets),
			};
		});
	}

	async rebuildFromCards(cards: Card[], decks: DeckLookup[]): Promise<void> {
		const deckSets = new Map<string, Set<string>>();

		for (const card of cards) {
			if (!card?.uuid) {
				continue;
			}

			const { deckIds } = getCardDeckIds(card, decks, { fallbackToReferences: false });
			for (const deckId of deckIds) {
				if (!deckId) {
					continue;
				}

				let uuids = deckSets.get(deckId);
				if (!uuids) {
					uuids = new Set<string>();
					deckSets.set(deckId, uuids);
				}
				uuids.add(card.uuid);
			}
		}

		await this.mutateSnapshot(() => ({
			version: DECK_MEMBERSHIP_INDEX_VERSION,
			updatedAt: new Date().toISOString(),
			initialized: true,
			fullRebuildRequired: false,
			dirtyDeckIds: [],
			deckToCardUUIDs: this.fromDeckSets(deckSets),
		}));
	}

	private createEmptySnapshot(): DeckMembershipIndexSnapshot {
		return {
			version: DECK_MEMBERSHIP_INDEX_VERSION,
			updatedAt: "",
			initialized: false,
			fullRebuildRequired: false,
			dirtyDeckIds: [],
			deckToCardUUIDs: {},
		};
	}

	private normalizeSnapshot(
		snapshot?: Partial<DeckMembershipIndexSnapshot> | null
	): DeckMembershipIndexSnapshot {
		const normalized: DeckMembershipIndexSnapshot = {
			version: DECK_MEMBERSHIP_INDEX_VERSION,
			updatedAt: typeof snapshot?.updatedAt === "string" ? snapshot.updatedAt : "",
			initialized: snapshot?.initialized === true,
			fullRebuildRequired: snapshot?.fullRebuildRequired === true,
			dirtyDeckIds: Array.from(new Set((snapshot?.dirtyDeckIds || []).filter(Boolean))),
			deckToCardUUIDs: {},
		};

		const rawDeckMap = snapshot?.deckToCardUUIDs || {};
		for (const [deckId, uuids] of Object.entries(rawDeckMap)) {
			if (!deckId || !Array.isArray(uuids)) {
				continue;
			}

			const normalizedUUIDs = Array.from(new Set(uuids.filter(Boolean)));
			if (normalizedUUIDs.length > 0) {
				normalized.deckToCardUUIDs[deckId] = normalizedUUIDs;
			}
		}

		return normalized;
	}

	private async readSnapshot(): Promise<{
		snapshot: DeckMembershipIndexSnapshot;
		exists: boolean;
	}> {
		try {
			const exists = await this.adapter.exists(this.indexPath);
			if (!exists) {
				return {
					snapshot: this.createEmptySnapshot(),
					exists: false,
				};
			}

			const raw = await this.adapter.read(this.indexPath);
			return {
				snapshot: this.normalizeSnapshot(JSON.parse(raw) as Partial<DeckMembershipIndexSnapshot>),
				exists: true,
			};
		} catch (error) {
			logger.warn("[DeckMembershipIndex] 读取索引失败，将回退为未初始化状态", error);
			return {
				snapshot: this.createEmptySnapshot(),
				exists: false,
			};
		}
	}

	private async writeSnapshot(snapshot: DeckMembershipIndexSnapshot): Promise<void> {
		await this.initialize();
		await this.adapter.write(this.indexPath, JSON.stringify(snapshot));
	}

	private async mutateSnapshot(
		mutator: (
			snapshot: DeckMembershipIndexSnapshot
		) => DeckMembershipIndexSnapshot | Promise<DeckMembershipIndexSnapshot>
	): Promise<DeckMembershipIndexSnapshot> {
		let nextSnapshot = this.createEmptySnapshot();

		const run = async () => {
			const { snapshot } = await this.readSnapshot();
			nextSnapshot = this.normalizeSnapshot(await mutator(snapshot));
			nextSnapshot.updatedAt = new Date().toISOString();
			await this.writeSnapshot(nextSnapshot);
		};

		this.writeChain = this.writeChain.then(run, run);
		await this.writeChain;
		return nextSnapshot;
	}

	private toDeckSets(deckToCardUUIDs: Record<string, string[]>): Map<string, Set<string>> {
		return new Map(
			Object.entries(deckToCardUUIDs).map(([deckId, uuids]) => [deckId, new Set(uuids)] as const)
		);
	}

	private fromDeckSets(deckSets: Map<string, Set<string>>): Record<string, string[]> {
		const deckToCardUUIDs: Record<string, string[]> = {};
		for (const [deckId, uuids] of deckSets.entries()) {
			if (!deckId || uuids.size === 0) {
				continue;
			}
			deckToCardUUIDs[deckId] = Array.from(uuids);
		}
		return deckToCardUUIDs;
	}
}

let deckMembershipIndexServiceInstance: DeckMembershipIndexService | null = null;

export function getDeckMembershipIndexService(plugin?: WeavePlugin): DeckMembershipIndexService {
	if (!deckMembershipIndexServiceInstance && plugin) {
		deckMembershipIndexServiceInstance = new DeckMembershipIndexService(plugin);
	}

	if (!deckMembershipIndexServiceInstance) {
		throw new Error("DeckMembershipIndexService not initialized");
	}

	return deckMembershipIndexServiceInstance;
}

export function initDeckMembershipIndexService(plugin: WeavePlugin): DeckMembershipIndexService {
	deckMembershipIndexServiceInstance = new DeckMembershipIndexService(plugin);
	return deckMembershipIndexServiceInstance;
}
