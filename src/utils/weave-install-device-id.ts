/**
 * 跨插件共用的安装级设备标识（Weave / EPUB / IR 等同进程插件共享）。
 *
 * 读取优先级（长期最优且不过度工程）：
 * 1. window —— 同一窗口内立刻一致，消除双插件冷启动竞态
 * 2. Electron userData 文件 —— 桌面安装级、与库无关
 * 3. localStorage —— 移动端等无 userData 时的应用级回退（通常跨库）
 * 4. 当前库 configDir 旧文件 —— 仅读取并尽量提升到上层，避免继续「一库一台」
 */

import type { App } from "obsidian";
import { normalizePath } from "obsidian";

const DEVICE_ID_FILE_NAME = "weave-install-device-id";
const LOCAL_STORAGE_KEY = "weave-install-device-id";
const GLOBAL_CACHE_KEY = "__weaveCrossPluginInstallDeviceId";

type NodeRequire = (id: string) => unknown;

function getGlobalStore(): Record<string, unknown> {
	return window as unknown as Record<string, unknown>;
}

function readGlobalDeviceId(): string {
	const value = getGlobalStore()[GLOBAL_CACHE_KEY];
	return typeof value === "string" && value.trim().length >= 16 ? value.trim() : "";
}

function writeGlobalDeviceId(id: string): void {
	if (id) {
		getGlobalStore()[GLOBAL_CACHE_KEY] = id;
	}
}

function getNodeRequire(): NodeRequire | null {
	try {
		const req = (window as unknown as { require?: NodeRequire }).require;
		return typeof req === "function" ? req : null;
	} catch {
		return null;
	}
}

function getObsidianUserDataPath(): string {
	try {
		const req = getNodeRequire();
		const electron = req?.("electron") as
			| { app?: { getPath?: (name: string) => string } }
			| undefined;
		const userData = electron?.app?.getPath?.("userData");
		return userData ? String(userData) : "";
	} catch {
		return "";
	}
}

function readUserDataDeviceId(): string {
	const userData = getObsidianUserDataPath();
	if (!userData) {
		return "";
	}

	try {
		const req = getNodeRequire();
		const fs = req?.("fs") as
			| {
					readFileSync?: (path: string, encoding: string) => string;
			  }
			| undefined;
		const path = req?.("path") as { join?: (...parts: string[]) => string } | undefined;
		if (!fs?.readFileSync || !path?.join) {
			return "";
		}
		const existing = String(fs.readFileSync(path.join(userData, DEVICE_ID_FILE_NAME), "utf8") || "").trim();
		return existing.length >= 16 ? existing : "";
	} catch {
		return "";
	}
}

/**
 * 写入 userData。优先排他创建，若已存在则读回磁盘值，避免双写竞态。
 */
function writeUserDataDeviceId(id: string): string {
	const userData = getObsidianUserDataPath();
	if (!userData || !id) {
		return "";
	}

	try {
		const req = getNodeRequire();
		const fs = req?.("fs") as
			| {
					writeFileSync?: (
						path: string,
						data: string,
						options: { encoding: string; flag?: string }
					) => void;
					readFileSync?: (path: string, encoding: string) => string;
			  }
			| undefined;
		const path = req?.("path") as { join?: (...parts: string[]) => string } | undefined;
		if (!fs?.writeFileSync || !path?.join) {
			return "";
		}

		const filePath = path.join(userData, DEVICE_ID_FILE_NAME);
		try {
			fs.writeFileSync(filePath, id, { encoding: "utf8", flag: "wx" });
			return id;
		} catch {
			try {
				const existing = String(fs.readFileSync?.(filePath, "utf8") || "").trim();
				if (existing.length >= 16) {
					return existing;
				}
			} catch {
				// fall through
			}
			fs.writeFileSync(filePath, id, { encoding: "utf8" });
			return id;
		}
	} catch {
		return "";
	}
}

function readLocalStorageDeviceId(): string {
	try {
		const existing = String(window.localStorage?.getItem(LOCAL_STORAGE_KEY) || "").trim();
		return existing.length >= 16 ? existing : "";
	} catch {
		return "";
	}
}

function writeLocalStorageDeviceId(id: string): boolean {
	if (!id) {
		return false;
	}
	try {
		const existing = readLocalStorageDeviceId();
		if (existing) {
			return true;
		}
		window.localStorage?.setItem(LOCAL_STORAGE_KEY, id);
		const confirmed = readLocalStorageDeviceId();
		return confirmed === id || confirmed.length >= 16;
	} catch {
		return false;
	}
}

function getVaultDeviceIdPath(app: App): string {
	return normalizePath(`${app.vault.configDir}/${DEVICE_ID_FILE_NAME}`);
}

async function readVaultDeviceId(app: App): Promise<string> {
	try {
		const adapter = app.vault.adapter;
		const filePath = getVaultDeviceIdPath(app);
		if (!(await adapter.exists(filePath))) {
			return "";
		}
		const existing = String(await adapter.read(filePath)).trim();
		return existing.length >= 16 ? existing : "";
	} catch {
		return "";
	}
}

async function writeVaultDeviceId(app: App, id: string): Promise<boolean> {
	if (!id) {
		return false;
	}
	try {
		const existing = await readVaultDeviceId(app);
		if (existing) {
			return true;
		}
		await app.vault.adapter.write(getVaultDeviceIdPath(app), id);
		return true;
	} catch {
		return false;
	}
}

function remember(id: string): string {
	if (!id) {
		return "";
	}
	writeGlobalDeviceId(id);
	return id;
}

async function loadOrCreateCrossPluginDeviceId(app?: App | null): Promise<string> {
	const fromGlobal = readGlobalDeviceId();
	if (fromGlobal) {
		return fromGlobal;
	}

	const fromUserData = readUserDataDeviceId();
	if (fromUserData) {
		writeLocalStorageDeviceId(fromUserData);
		return remember(fromUserData);
	}

	const fromLocalStorage = readLocalStorageDeviceId();
	if (fromLocalStorage) {
		const promoted = writeUserDataDeviceId(fromLocalStorage) || fromLocalStorage;
		return remember(promoted);
	}

	const fromVault = app ? await readVaultDeviceId(app) : "";
	if (fromVault) {
		const promoted =
			writeUserDataDeviceId(fromVault) ||
			(writeLocalStorageDeviceId(fromVault) ? fromVault : fromVault);
		return remember(promoted);
	}

	const id = crypto.randomUUID();
	const writtenUserData = writeUserDataDeviceId(id);
	if (writtenUserData) {
		writeLocalStorageDeviceId(writtenUserData);
		return remember(writtenUserData);
	}
	if (writeLocalStorageDeviceId(id)) {
		const confirmed = readLocalStorageDeviceId() || id;
		return remember(confirmed);
	}
	if (app && (await writeVaultDeviceId(app, id))) {
		const confirmed = (await readVaultDeviceId(app)) || id;
		return remember(confirmed);
	}
	return "";
}

/**
 * 读取或创建跨插件共享设备 ID。
 */
export async function getOrCreateCrossPluginDeviceId(app?: App | null): Promise<string> {
	const id = await loadOrCreateCrossPluginDeviceId(app);
	return id;
}

/** @internal test-only */
export function resetCrossPluginDeviceIdCacheForTests(): void {
	delete getGlobalStore()[GLOBAL_CACHE_KEY];
	try {
		window.localStorage?.removeItem(LOCAL_STORAGE_KEY);
	} catch {
		// ignore
	}
}
