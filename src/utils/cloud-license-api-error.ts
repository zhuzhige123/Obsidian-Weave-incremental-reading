import type { RequestUrlResponse } from "obsidian";
import {
	ACTIVATION_EMAIL_BOUND_USER_MESSAGE,
	sanitizeCloudLicenseUserMessage,
} from "./activation-privacy";

export function formatCloudLicenseApiError(
	response: RequestUrlResponse,
	data: Record<string, unknown> | null,
	fallbackVerb: "激活" | "验证" = "激活",
): string {
	if (data) {
		if (data.error_code === "EMAIL_ALREADY_BOUND") {
			return ACTIVATION_EMAIL_BOUND_USER_MESSAGE;
		}

		if (typeof data.error === "string" && data.error.trim()) {
			const sanitized = sanitizeCloudLicenseUserMessage(data.error);
			if (
				sanitized.includes("Signature mismatch") ||
				sanitized.includes("OTSAuthFailed")
			) {
				return "表格存储鉴权失败：请在函数计算环境变量中检查 ALICLOUD_ACCESS_KEY_ID / ALICLOUD_ACCESS_KEY_SECRET 是否与 RAM 子账号匹配，并确认该账号有 weave-activation 的 OTS 读写权限。";
			}
			return sanitized;
		}

		const message = typeof data.Message === "string" ? data.Message : "";
		const code = typeof data.Code === "string" ? data.Code : "";

		if (code === "CAExited" || response.status === 412) {
			if (
				message.includes("Cannot find module") &&
				message.includes("index.mjs")
			) {
				return '云端授权服务未正确部署：服务器找不到入口文件。请用 node scripts\\pack-fc-zip.mjs lite 重新打包并上传，启动命令改为 node index.mjs；部署后访问 /health 应返回 {"ok":true}。';
			}
			const firstLine = message.split(/\r?\n/)[0]?.trim();
			if (firstLine) {
				return `云端授权服务异常（${
					code || `HTTP ${response.status}`
				}）：${firstLine}`;
			}
		}

		if (
			message.includes("Signature mismatch") ||
			message.includes("OTSAuthFailed")
		) {
			return "表格存储鉴权失败：请在函数计算环境变量中检查 ALICLOUD_ACCESS_KEY_ID / ALICLOUD_ACCESS_KEY_SECRET 是否与 RAM 子账号匹配，并确认该账号有 weave-activation 的 OTS 读写权限。";
		}

		if (message.trim()) {
			return sanitizeCloudLicenseUserMessage(message.split(/\r?\n/)[0].trim());
		}
	}

	if (response.status === 412) {
		return "云端授权服务未启动（HTTP 412）。请在函数计算控制台重新上传代码包，并确认 /health 可正常访问。";
	}

	return `${fallbackVerb}失败（HTTP ${response.status}）`;
}
