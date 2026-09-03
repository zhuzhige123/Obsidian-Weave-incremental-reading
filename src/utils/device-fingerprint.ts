import { Platform, type App } from "obsidian";
import { getOrCreateCrossPluginDeviceId } from "./weave-install-device-id";

/**
 * 指纹算法版本。
 * v6：去掉时区等易变项；安装 ID 经 globalThis + userData + localStorage 跨插件共享。
 */
export const DEVICE_FINGERPRINT_VERSION = 6;

function getRuntimePlatformLabel(): string {
	if (Platform.isWin) return "win32";
	if (Platform.isMacOS) return "darwin";
	if (Platform.isLinux) return "linux";
	if (Platform.isAndroidApp) return "android";
	if (Platform.isIosApp) return "ios";
	if (Platform.isDesktop || Platform.isDesktopApp) return "desktop";
	if (Platform.isMobile || Platform.isMobileApp) return "mobile";
	return "unknown-platform";
}

/**
 * 仅收集跨库、跨插件稳定的特征。
 * 禁止：app.appId、vault 路径、hostname、时区。
 * 三插件必须保持组件列表与顺序完全一致。
 */
export async function collectStableDeviceComponents(app?: App | null): Promise<string[]> {
	const components: string[] = [];

	const crossPluginId = await getOrCreateCrossPluginDeviceId(app);
	if (crossPluginId) {
		components.push(`weave-install:${crossPluginId}`);
	}

	components.push(getRuntimePlatformLabel());
	components.push(Platform.isMobile ? "mobile-ui" : "desktop-ui");
	components.push(String(navigator.hardwareConcurrency || 0));
	components.push(String(navigator.maxTouchPoints || 0));

	return components.filter((value) => value && value !== "undefined");
}

export async function sha256Hex(message: string): Promise<string> {
	const msgBuffer = new TextEncoder().encode(message);
	const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function generateStableDeviceFingerprint(app: App): Promise<string> {
	const fingerprint = (await collectStableDeviceComponents(app)).join("|");
	return sha256Hex(fingerprint);
}
