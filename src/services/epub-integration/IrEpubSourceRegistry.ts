import { type App, TFile, normalizePath } from "obsidian";
import { getPluginPathsById, getV2Paths, normalizeWeaveParentFolder } from "../../config/paths";
import { DirectoryUtils } from "../../utils/directory-utils";
import { logger } from "../../utils/logger";
import { getEpubRuntime } from "./epub-runtime";
import { isSupportedBookFile, isSupportedBookPath } from "./book-format";
import type { EpubSourceRegistryEntry, IrEpubStorageLike } from "./ir-epub-storage-types";

interface EpubReaderLocalDataFile {
	version: 1;
	updatedAt: number;
	sourceRegistry?: EpubSourceRegistryEntry[];
}

/**
 * IR 侧 EPUB 来源身份的最小读写层：仅维护 sourceId ↔ 文件路径映射，
 * 与阅读器插件共享同一套 epub-reader-data / epub-source-registry 数据格式。
 */
export class IrEpubSourceRegistry implements IrEpubStorageLike {
	private readonly app: App;
	private readonly basePath: string;
	private readonly unifiedDataPath: string;
	private localDataCache: EpubReaderLocalDataFile | null = null;
	private writeLock: Promise<void> = Promise.resolve();

	constructor(app: App) {
		this.app = app;
		const runtime = getEpubRuntime();
		const pluginCandidates = [...runtime.collaboratorHostPluginIds, runtime.pluginId]
			.filter((value, index, list): value is string => Boolean(value) && list.indexOf(value) === index)
			.map((pluginId) => (app as { plugins?: { getPlugin?: (id: string) => unknown } }).plugins?.getPlugin?.(pluginId));
		const parentFolder = normalizeWeaveParentFolder(
			pluginCandidates
				.map(
					(plugin) =>
						(plugin as { settings?: { weaveParentFolder?: string } } | undefined)?.settings
							?.weaveParentFolder
				)
				.find((folder): folder is string => Boolean(folder && String(folder).trim()))
		);
		this.basePath = getV2Paths(parentFolder).ir.epub;
		this.unifiedDataPath = normalizePath(
			getPluginPathsById(app, runtime.pluginId).state.incrementalReading.epubReaderData
		);
	}

	async ensureSourceIdentity(
		filePath: string,
		options: { preferredSourceId?: string } = {}
	): Promise<EpubSourceRegistryEntry | null> {
		const normalizedPath = normalizePath(filePath || "");
		if (!normalizedPath || !(await this.hasExistingBookFile(normalizedPath))) {
			return null;
		}

		const registry = await this.loadSourceRegistry();
		const byPath = registry.find((entry) => entry.filePath === normalizedPath);
		const byPreferredId = options.preferredSourceId
			? registry.find((entry) => entry.sourceId === options.preferredSourceId)
			: undefined;
		const currentStat = await this.getExistingFileStat(normalizedPath);
		const matchesCurrentStat = (entry?: EpubSourceRegistryEntry): boolean =>
			Boolean(
				entry &&
					currentStat &&
					entry.filePath === normalizedPath &&
					entry.sourceSize === currentStat.size &&
					entry.sourceMtime === currentStat.mtime
			);

		if (matchesCurrentStat(byPreferredId)) {
			return byPreferredId || null;
		}
		if (matchesCurrentStat(byPath)) {
			return byPath || null;
		}

		const sourceFingerprint = await this.computeSourceFingerprint(normalizedPath);
		const byFingerprint = sourceFingerprint
			? registry.find((entry) => entry.sourceFingerprint === sourceFingerprint)
			: undefined;

		const target = byPreferredId || byPath || byFingerprint;
		const sourceId = target?.sourceId || this.generateSourceId();
		const nextEntry = await this.buildSourceRegistryEntry(normalizedPath, sourceId, sourceFingerprint);
		if (!nextEntry) {
			return null;
		}

		const unchanged =
			target &&
			target.sourceId === nextEntry.sourceId &&
			target.filePath === nextEntry.filePath &&
			target.sourceFingerprint === nextEntry.sourceFingerprint &&
			target.sourceSize === nextEntry.sourceSize &&
			target.sourceMtime === nextEntry.sourceMtime &&
			target.lastKnownPath === nextEntry.lastKnownPath;
		if (unchanged) {
			return target;
		}

		const nextRegistry = registry.filter((entry) => entry.sourceId !== sourceId);
		nextRegistry.push(nextEntry);
		await this.saveSourceRegistry(nextRegistry);
		return nextEntry;
	}

	async resolveSourceFilePath(sourceId?: string, fallbackFilePath?: string): Promise<string | null> {
		const normalizedFallback = normalizePath(fallbackFilePath || "");
		if (sourceId) {
			const registry = await this.loadSourceRegistry();
			const registryEntry = registry.find((entry) => entry.sourceId === sourceId);
			if (registryEntry?.filePath && (await this.hasExistingBookFile(registryEntry.filePath))) {
				return registryEntry.filePath;
			}
			if (normalizedFallback && (await this.hasExistingBookFile(normalizedFallback))) {
				await this.ensureSourceIdentity(normalizedFallback, { preferredSourceId: sourceId });
				return normalizedFallback;
			}
		}
		if (normalizedFallback && (await this.hasExistingBookFile(normalizedFallback))) {
			return normalizedFallback;
		}
		return null;
	}

	private async loadSourceRegistry(): Promise<EpubSourceRegistryEntry[]> {
		const unifiedData = await this.readUnifiedLocalReaderData();
		if ((await this.hasUnifiedLocalDataFile()) && Array.isArray(unifiedData.sourceRegistry)) {
			return this.normalizeSourceRegistryEntries(unifiedData.sourceRegistry);
		}
		return (await this.readLegacySourceRegistry()) ?? [];
	}

	private async saveSourceRegistry(entries: EpubSourceRegistryEntry[]): Promise<void> {
		const normalizedEntries = this.normalizeSourceRegistryEntries(entries);
		await this.updateUnifiedLocalReaderData((localData) => {
			localData.sourceRegistry = normalizedEntries;
		});
	}

	private async readLegacySourceRegistry(): Promise<EpubSourceRegistryEntry[] | null> {
		const registryPath = `${this.basePath}/epub-source-registry.json`;
		const adapter = this.app.vault.adapter;
		if (!(await adapter.exists(registryPath))) {
			return null;
		}
		try {
			const content = await adapter.read(registryPath);
			return this.normalizeSourceRegistryEntries(JSON.parse(content));
		} catch (error) {
			logger.warn("[IrEpubSourceRegistry] Failed to read epub-source-registry.json:", error);
			return null;
		}
	}

	private async readUnifiedLocalReaderData(): Promise<EpubReaderLocalDataFile> {
		if (this.localDataCache) {
			return this.localDataCache;
		}
		const adapter = this.app.vault.adapter;
		if (!(await adapter.exists(this.unifiedDataPath))) {
			this.localDataCache = { version: 1, updatedAt: 0 };
			return this.localDataCache;
		}
		try {
			const content = await adapter.read(this.unifiedDataPath);
			const parsed = JSON.parse(content) as EpubReaderLocalDataFile;
			this.localDataCache = {
				version: 1,
				updatedAt: typeof parsed.updatedAt === "number" ? parsed.updatedAt : 0,
				sourceRegistry: Array.isArray(parsed.sourceRegistry) ? parsed.sourceRegistry : undefined,
			};
		} catch (error) {
			logger.warn("[IrEpubSourceRegistry] Failed to parse epub-reader-data.json:", error);
			this.localDataCache = { version: 1, updatedAt: 0 };
		}
		return this.localDataCache;
	}

	private async hasUnifiedLocalDataFile(): Promise<boolean> {
		return this.app.vault.adapter.exists(this.unifiedDataPath);
	}

	private async updateUnifiedLocalReaderData(updater: (data: EpubReaderLocalDataFile) => void): Promise<void> {
		const doWrite = async () => {
			const current = JSON.parse(
				JSON.stringify(await this.readUnifiedLocalReaderData())
			) as EpubReaderLocalDataFile;
			updater(current);
			current.updatedAt = Date.now();
			this.localDataCache = current;
			await DirectoryUtils.ensureDirForFile(this.app.vault.adapter, this.unifiedDataPath);
			await this.app.vault.adapter.write(this.unifiedDataPath, JSON.stringify(current));
		};
		this.writeLock = this.writeLock.then(doWrite, doWrite);
		await this.writeLock;
	}

	private normalizeSourceRegistryEntries(value: unknown): EpubSourceRegistryEntry[] {
		if (!Array.isArray(value)) {
			return [];
		}
		return value
			.filter((entry): entry is Partial<EpubSourceRegistryEntry> => Boolean(entry && typeof entry === "object"))
			.map((entry) => ({
				sourceId: String(entry.sourceId || "").trim(),
				filePath: normalizePath(String(entry.filePath || "").trim()),
				sourceFingerprint:
					typeof entry.sourceFingerprint === "string" ? entry.sourceFingerprint : undefined,
				sourceSize: typeof entry.sourceSize === "number" ? entry.sourceSize : undefined,
				sourceMtime: typeof entry.sourceMtime === "number" ? entry.sourceMtime : undefined,
				lastSeenAt: typeof entry.lastSeenAt === "number" ? entry.lastSeenAt : 0,
				lastKnownPath:
					typeof entry.lastKnownPath === "string"
						? normalizePath(String(entry.lastKnownPath).trim())
						: undefined,
			}))
			.filter((entry) => Boolean(entry.sourceId));
	}

	private generateSourceId(): string {
		return `epubsrc-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
	}

	private async computeSourceFingerprint(filePath: string): Promise<string | undefined> {
		const normalizedPath = normalizePath(filePath || "");
		if (!normalizedPath) {
			return undefined;
		}
		const adapter = this.app.vault.adapter as {
			readBinary?: (path: string) => Promise<ArrayBuffer | Uint8Array>;
		};
		if (typeof adapter.readBinary !== "function" || typeof crypto?.subtle?.digest !== "function") {
			return undefined;
		}
		try {
			const binary = await adapter.readBinary(normalizedPath);
			const input = binary instanceof Uint8Array ? binary : new Uint8Array(binary);
			const buffer = input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength) as ArrayBuffer;
			const digest = await crypto.subtle.digest("SHA-256", buffer);
			return Array.from(new Uint8Array(digest))
				.map((value) => value.toString(16).padStart(2, "0"))
				.join("");
		} catch {
			return undefined;
		}
	}

	private async buildSourceRegistryEntry(
		filePath: string,
		sourceId: string,
		sourceFingerprint?: string
	): Promise<EpubSourceRegistryEntry | null> {
		const normalizedPath = normalizePath(filePath || "");
		if (!normalizedPath || !(await this.hasExistingBookFile(normalizedPath))) {
			return null;
		}
		const file = this.app.vault.getAbstractFileByPath(normalizedPath);
		const now = Date.now();
		let sourceSize = file instanceof TFile ? file.stat.size : undefined;
		let sourceMtime = file instanceof TFile ? file.stat.mtime : undefined;
		const adapter = this.app.vault.adapter as {
			stat?: (path: string) => Promise<{ size?: number; mtime?: number }>;
		};
		if (
			(sourceSize === undefined || sourceMtime === undefined) &&
			typeof adapter.stat === "function"
		) {
			try {
				const stat = await adapter.stat(normalizedPath);
				if (sourceSize === undefined && typeof stat?.size === "number") {
					sourceSize = stat.size;
				}
				if (sourceMtime === undefined && typeof stat?.mtime === "number") {
					sourceMtime = stat.mtime;
				}
			} catch {
				// noop
			}
		}
		return {
			sourceId,
			filePath: normalizedPath,
			sourceFingerprint,
			sourceSize,
			sourceMtime,
			lastSeenAt: now,
			lastKnownPath: normalizedPath,
		};
	}

	private async getExistingFileStat(filePath: string): Promise<{ size?: number; mtime?: number } | null> {
		const normalizedPath = normalizePath(filePath || "");
		if (!normalizedPath || !(await this.hasExistingBookFile(normalizedPath))) {
			return null;
		}
		const file = this.app.vault.getAbstractFileByPath(normalizedPath);
		return {
			size: file instanceof TFile ? file.stat.size : undefined,
			mtime: file instanceof TFile ? file.stat.mtime : undefined,
		};
	}

	private async hasExistingBookFile(filePath: string): Promise<boolean> {
		const normalizedPath = normalizePath(filePath || "");
		if (!isSupportedBookPath(normalizedPath)) {
			return false;
		}
		const file = this.app.vault.getAbstractFileByPath(normalizedPath);
		if (file instanceof TFile && isSupportedBookFile(file)) {
			return true;
		}
		const adapter = this.app.vault.adapter as { exists?: (path: string) => Promise<boolean> };
		if (typeof adapter.exists !== "function") {
			return false;
		}
		try {
			return await adapter.exists(normalizedPath);
		} catch {
			return false;
		}
	}
}
