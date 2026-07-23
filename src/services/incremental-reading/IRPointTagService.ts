import { type App, TFile, normalizePath } from "obsidian";
import type { IRChunkFileData, IRTagGroup } from "../../types/ir-types";
import { readIncrementalReadingSettings } from "../../utils/ir-plugin-host-access";
import { createYAMLFrontmatterManager } from "../../utils/yaml-frontmatter-utils";
import {
	type IREpubBookmarkTask,
	IREpubBookmarkTaskService,
	isEpubBookmarkTaskId,
} from "./IREpubBookmarkTaskService";
import {
	type IRPdfBookmarkTask,
	IRPdfBookmarkTaskService,
	isPdfBookmarkTaskId,
} from "./IRPdfBookmarkTaskService";
import { IRStorageService } from "./IRStorageService";
import { IRTagGroupService, matchTagGroupByTags } from "./IRTagGroupService";
import { getSharedIRPointStorageService } from "./IRPointStorageService";
import {
	LEGACY_MARKDOWN_TAGS_YAML_KEY,
	readTagsFromFrontmatterRecord,
	resolveMarkdownTagsYamlKeyFromSettings,
} from "./ir-tag-source-policy";

/** @deprecated Use resolveMarkdownTagsYamlKeyFromSettings / LEGACY_MARKDOWN_TAGS_YAML_KEY */
export const READING_POINT_TAGS_YAML_KEY = LEGACY_MARKDOWN_TAGS_YAML_KEY;

/** Paths currently being written by IR → vault; skip YAML→IR sync for these. */
const writingMarkdownTagPaths = new Set<string>();

export function isWritingMarkdownReadingTags(filePath: string): boolean {
	return writingMarkdownTagPaths.has(
		normalizePath(String(filePath || "").trim()),
	);
}

export function normalizeReadingPointTags(tags: string[]): string[] {
	const ordered = new Map<string, string>();
	for (const rawTag of Array.isArray(tags) ? tags : []) {
		// Strip leading # so storage matches tag-suggest / search / tag-group keys
		const label = String(rawTag || "")
			.trim()
			.replace(/^#+/, "");
		const key = label.toLowerCase();
		if (!key || ordered.has(key)) continue;
		ordered.set(key, label);
	}
	return Array.from(ordered.values());
}

/**
 * Resolve reading-point tags with the same precedence as the right-click
 * "Edit tags" modal (`IRReadingPointEditService.loadTags`):
 * 1. PDF / EPUB task tags
 * 2. Unified point `userData.tags` when a point snapshot exists (canonical)
 * 3. Chunk / markdown YAML tags fallback when canonical is empty
 *    (heals pre-fix rows where sync had not yet written into userData)
 */
export async function resolveReadingPointTags(params: {
	materialId: string;
	sourceType?: string | null;
	pdfTaskTags?: string[] | null;
	epubTaskTags?: string[] | null;
	/** Present when a point snapshot was loaded (even if tags are empty). */
	hasPointSnapshot?: boolean;
	pointUserDataTags?: string[] | null;
	getChunkTags?: () => Promise<string[]>;
}): Promise<string[]> {
	const materialId = String(params.materialId || "").trim();
	if (!materialId) {
		return [];
	}

	if (isPdfBookmarkTaskId(materialId)) {
		return normalizeReadingPointTags(params.pdfTaskTags || []);
	}

	if (isEpubBookmarkTaskId(materialId)) {
		return normalizeReadingPointTags(params.epubTaskTags || []);
	}

	if (params.sourceType === "legacy-block") {
		return [];
	}

	if (params.hasPointSnapshot) {
		const fromPoint = normalizeReadingPointTags(params.pointUserDataTags || []);
		if (fromPoint.length > 0 || !params.getChunkTags) {
			return fromPoint;
		}
		// Empty canonical + dual-write present: prefer dual-write so search finds
		// tags saved before syncChunkPoint wrote YAML tags into userData.
		return normalizeReadingPointTags(await params.getChunkTags());
	}

	if (params.getChunkTags) {
		return normalizeReadingPointTags(await params.getChunkTags());
	}

	return [];
}

export class IRPointTagService {
	private readonly storage: IRStorageService;
	private readonly pdfService: IRPdfBookmarkTaskService;
	private readonly epubService: IREpubBookmarkTaskService;
	private readonly tagGroupService: IRTagGroupService;
	private readonly yamlManager: ReturnType<typeof createYAMLFrontmatterManager>;

	constructor(private readonly app: App) {
		this.storage = new IRStorageService(app);
		this.pdfService = new IRPdfBookmarkTaskService(app);
		this.epubService = new IREpubBookmarkTaskService(app);
		this.tagGroupService = new IRTagGroupService(app);
		this.yamlManager = createYAMLFrontmatterManager(app);
	}

	async initialize(): Promise<void> {
		await Promise.all([
			this.storage.initialize(),
			this.pdfService.initialize(),
			this.epubService.initialize(),
			this.tagGroupService.initialize(),
		]);
	}

	resolveMarkdownTagsYamlKey(): string {
		return resolveMarkdownTagsYamlKeyFromSettings(
			readIncrementalReadingSettings(this.app),
		);
	}

	isWritingMarkdownTags(filePath: string): boolean {
		return isWritingMarkdownReadingTags(filePath);
	}

	async readMarkdownReadingTags(filePath: string): Promise<string[]> {
		const normalizedPath = normalizePath(String(filePath || "").trim());
		if (!normalizedPath.toLowerCase().endsWith(".md")) {
			return [];
		}
		const file = this.app.vault.getAbstractFileByPath(normalizedPath);
		if (!(file instanceof TFile)) {
			return [];
		}
		const cache = this.app.metadataCache.getFileCache(file);
		return normalizeReadingPointTags(
			readTagsFromFrontmatterRecord(
				(cache?.frontmatter as Record<string, unknown> | undefined) || {},
				this.resolveMarkdownTagsYamlKey(),
			),
		);
	}

	async writeMarkdownReadingTags(
		filePath: string,
		tags: string[],
	): Promise<string[]> {
		const normalizedPath = normalizePath(String(filePath || "").trim());
		const file = this.app.vault.getAbstractFileByPath(normalizedPath);
		if (!(file instanceof TFile)) {
			throw new Error(`Markdown file not found: ${normalizedPath}`);
		}

		const normalizedTags = normalizeReadingPointTags(tags);
		const yamlKey = this.resolveMarkdownTagsYamlKey();
		writingMarkdownTagPaths.add(normalizedPath);
		try {
			await this.yamlManager.updateFrontmatterTagsProperty(
				file,
				yamlKey,
				normalizedTags,
			);
			return normalizedTags;
		} finally {
			window.setTimeout(() => {
				writingMarkdownTagPaths.delete(normalizedPath);
			}, 500);
		}
	}

	async getChunkTags(chunk: IRChunkFileData): Promise<string[]> {
		const filePath = normalizePath(String(chunk?.filePath || "").trim());
		if (filePath.toLowerCase().endsWith(".md")) {
			const markdownTags = await this.readMarkdownReadingTags(filePath);
			if (markdownTags.length > 0) {
				return markdownTags;
			}
		}
		return normalizeReadingPointTags(
			((chunk as { tags?: string[] }).tags || []).map((tag) => String(tag)),
		);
	}

	async saveChunkTags(
		chunkId: string,
		tags: string[],
	): Promise<IRChunkFileData | null> {
		await this.initialize();
		const chunk = await this.storage.getChunkData(chunkId);
		if (!chunk) return null;

		const normalizedTags = normalizeReadingPointTags(tags);
		const filePath = normalizePath(String(chunk.filePath || "").trim());
		if (filePath.toLowerCase().endsWith(".md")) {
			await this.writeMarkdownReadingTags(filePath, normalizedTags);
		}

		const nextGroupId = await this.matchGroupForTags(normalizedTags);
		const updatedChunk = {
			...chunk,
			tags: normalizedTags,
			meta: {
				...chunk.meta,
				tagGroup: nextGroupId,
			},
			updatedAt: Date.now(),
		};
		await this.storage.saveChunkData(updatedChunk as IRChunkFileData);
		return updatedChunk as IRChunkFileData & { tags?: string[] };
	}

	async savePdfTaskTags(
		taskId: string,
		tags: string[],
	): Promise<IRPdfBookmarkTask | null> {
		await this.initialize();
		const task = await this.pdfService.getTask(taskId);
		if (!task) return null;
		const normalizedTags = normalizeReadingPointTags(tags);
		const nextGroupId = await this.matchGroupForTags(normalizedTags);
		return await this.pdfService.updateTask(taskId, {
			tags: normalizedTags,
			meta: {
				...task.meta,
				tagGroup: nextGroupId,
			},
		});
	}

	async saveEpubTaskTags(
		taskId: string,
		tags: string[],
	): Promise<IREpubBookmarkTask | null> {
		await this.initialize();
		const task = await this.epubService.getTask(taskId);
		if (!task) return null;
		const normalizedTags = normalizeReadingPointTags(tags);
		const nextGroupId = await this.matchGroupForTags(normalizedTags);
		return await this.epubService.updateTask(taskId, {
			tags: normalizedTags,
			meta: {
				...task.meta,
				tagGroup: nextGroupId,
			},
		});
	}

	async matchGroupForTags(tags: string[]): Promise<string> {
		await this.tagGroupService.initialize();
		const allGroups = await this.tagGroupService.getAllGroups();
		return matchTagGroupByTags(allGroups, tags);
	}

	async getAllKnownTags(): Promise<string[]> {
		await this.initialize();
		const chunks = Object.values(await this.storage.getAllChunkData());
		const [pdfTasks, epubTasks, groups, snapshots] = await Promise.all([
			this.pdfService.getAllTasks(),
			this.epubService.getAllTasks(),
			this.tagGroupService.getAllGroups(),
			getSharedIRPointStorageService(this.app).listPointSnapshots(),
		]);

		const collected = new Set<string>();
		for (const chunk of chunks) {
			for (const tag of (chunk as { tags?: string[] }).tags || []) {
				const normalized = normalizeReadingPointTags([String(tag)]);
				if (normalized[0]) collected.add(normalized[0]);
			}
		}
		for (const task of [...pdfTasks, ...epubTasks]) {
			for (const tag of normalizeReadingPointTags(task.tags || [])) {
				collected.add(tag);
			}
		}
		for (const snapshot of snapshots) {
			for (const tag of normalizeReadingPointTags(
				snapshot.point?.userData?.tags || [],
			)) {
				collected.add(tag);
			}
		}
		for (const group of groups) {
			for (const tag of normalizeReadingPointTags(group.matchAnyTags || [])) {
				collected.add(tag);
			}
		}

		return Array.from(collected).sort((a, b) => a.localeCompare(b, "zh-CN"));
	}

	/**
	 * Pull Markdown YAML tags into IR chunk + point storage (vault → IR).
	 * Does not write back to YAML.
	 */
	async syncMarkdownChunkTags(filePath: string): Promise<boolean> {
		await this.initialize();
		const normalizedPath = normalizePath(String(filePath || "").trim());
		if (!normalizedPath.toLowerCase().endsWith(".md")) {
			return false;
		}
		if (this.isWritingMarkdownTags(normalizedPath)) {
			return false;
		}

		const affectedChunks = await this.storage.getChunksByFilePath(normalizedPath);
		if (affectedChunks.length === 0) {
			return false;
		}

		const nextTags = await this.readMarkdownReadingTags(normalizedPath);
		const nextGroupId = await this.matchGroupForTags(nextTags);
		let changed = false;
		const pointStorage = getSharedIRPointStorageService(this.app);

		for (const chunk of affectedChunks) {
			const currentTags = normalizeReadingPointTags(
				((chunk as { tags?: string[] }).tags || []).map((tag) => String(tag)),
			);
			const currentGroupId = String(chunk.meta?.tagGroup || "default");
			const tagsChanged =
				currentTags.length !== nextTags.length ||
				currentTags.some((tag, index) => tag !== nextTags[index]);
			if (!tagsChanged && currentGroupId === nextGroupId) {
				continue;
			}

			const updatedChunk = {
				...chunk,
				tags: nextTags,
				meta: {
					...chunk.meta,
					tagGroup: nextGroupId,
				},
				updatedAt: Date.now(),
			};
			await this.storage.saveChunkData(updatedChunk as IRChunkFileData);
			await pointStorage.syncChunkPoint(updatedChunk as IRChunkFileData, {
				preserveExisting: true,
			});
			changed = true;
		}

		return changed;
	}

	/** Fast path for vault sync: skip non-IR markdown without reading YAML. */
	async hasChunksForMarkdownPath(filePath: string): Promise<boolean> {
		await this.initialize();
		return this.storage.hasChunksForFilePath(filePath);
	}

	async getTagGroups(): Promise<IRTagGroup[]> {
		await this.tagGroupService.initialize();
		return await this.tagGroupService.getAllGroups();
	}
}
