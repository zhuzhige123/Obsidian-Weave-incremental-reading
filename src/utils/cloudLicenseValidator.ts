import { type RequestUrlResponse, requestUrl } from "obsidian";
import type { App } from "obsidian";
import {
	LICENSE_CLOUD_CACHE_DAYS,
	getLicenseCloudApiBaseUrl,
	isCloudLicenseConfigured,
} from "../config/license-cloud-config";
import { logger } from "../utils/logger";
import { formatCloudLicenseApiError } from "./cloud-license-api-error";
import { vaultStorage } from "./vault-local-storage";

export interface CloudActivationResult {
	success: boolean;
	message?: string;
	devices_count?: number;
	max_devices?: number;
	replaced_old_device?: boolean;
	merged_previous_device?: boolean;
	expires_at?: string;
	error?: string;
	is_network_error?: boolean;
}

export interface CloudValidationResult {
	valid: boolean;
	expires_at?: string;
	devices_count?: number;
	max_devices?: number;
	error?: string;
	is_network_error?: boolean;
}

function parseCloudResponseBody(response: RequestUrlResponse): {
	data: Record<string, unknown> | null;
	parseError?: string;
} {
	const rawText = (response.text ?? "").trim();
	if (!rawText) {
		return { data: null, parseError: "云端返回为空" };
	}

	try {
		return { data: JSON.parse(rawText) as Record<string, unknown> };
	} catch (error) {
		logger.error("云端响应不是合法 JSON:", rawText.slice(0, 300), error);
		return {
			data: null,
			parseError: `云端返回格式异常（HTTP ${response.status}），请检查函数日志`,
		};
	}
}

export class CloudLicenseValidator {
	private readonly cacheKey = "weave_ir_cloud_cache";
	private app: App | null = null;

	setApp(app: App): void {
		this.app = app;
		vaultStorage.setApp(app);
	}

	isConfigured(): boolean {
		return isCloudLicenseConfigured();
	}

	private get cacheTTL(): number {
		return LICENSE_CLOUD_CACHE_DAYS * 24 * 60 * 60 * 1000;
	}

	private get apiBaseUrl(): string {
		return getLicenseCloudApiBaseUrl();
	}

	async activate(
		activationCode: string,
		deviceFingerprint: string,
		email: string,
		platform: string,
		options?: {
			previousDeviceFingerprint?: string;
		},
	): Promise<CloudActivationResult> {
		if (!this.isConfigured()) {
			return {
				success: false,
				error: "云服务未配置，请联系插件维护者完成授权服务器部署",
				is_network_error: false,
			};
		}

		try {
			const previousDeviceFingerprint = String(
				options?.previousDeviceFingerprint || "",
			).trim();
			const response = await requestUrl({
				url: `${this.apiBaseUrl}/activate`,
				method: "POST",
				contentType: "application/json",
				body: JSON.stringify({
					activation_code: activationCode,
					device_fingerprint: deviceFingerprint,
					email: email.toLowerCase().trim(),
					platform,
					...(previousDeviceFingerprint
						? { previous_device_fingerprint: previousDeviceFingerprint }
						: {}),
				}),
				throw: false,
			});

			const parsed = parseCloudResponseBody(response);
			if (!parsed.data) {
				return {
					success: false,
					error: parsed.parseError || "激活失败",
					is_network_error: false,
				};
			}
			const data = parsed.data;

			if (response.status !== 200 || !data.success) {
				return {
					success: false,
					error: formatCloudLicenseApiError(response, data, "激活"),
					is_network_error: false,
				};
			}

			this.clearCache();

			return {
				success: true,
				message: typeof data.message === "string" ? data.message : undefined,
				devices_count:
					typeof data.devices_count === "number"
						? data.devices_count
						: undefined,
				max_devices:
					typeof data.max_devices === "number" ? data.max_devices : undefined,
				replaced_old_device: Boolean(data.replaced_old_device),
				merged_previous_device: Boolean(data.merged_previous_device),
				expires_at:
					typeof data.expires_at === "string" ? data.expires_at : undefined,
			};
		} catch (error) {
			logger.error("激活请求失败:", error);

			const isNetworkError =
				error instanceof TypeError ||
				(error instanceof Error && error.name === "AbortError");

			return {
				success: false,
				error: isNetworkError ? "网络连接失败，请检查网络后重试" : "激活失败",
				is_network_error: isNetworkError,
			};
		}
	}

	async validate(
		activationCode: string,
		deviceFingerprint: string,
		email: string,
		options?: { bypassCache?: boolean },
	): Promise<CloudValidationResult> {
		if (!this.isConfigured()) {
			return {
				valid: false,
				error: "云服务未配置",
				is_network_error: false,
			};
		}

		try {
			if (!options?.bypassCache) {
				const cache = this.getCache();
				if (cache && this.isCacheValid(cache)) {
					return cache.result;
				}
			}

			const response = await requestUrl({
				url: `${this.apiBaseUrl}/validate`,
				method: "POST",
				contentType: "application/json",
				body: JSON.stringify({
					activation_code: activationCode,
					device_fingerprint: deviceFingerprint,
					email: email.toLowerCase().trim(),
				}),
				throw: false,
			});

			const parsed = parseCloudResponseBody(response);
			if (!parsed.data) {
				return {
					valid: false,
					error: parsed.parseError || "验证失败",
					is_network_error: false,
				};
			}
			const data = parsed.data;

			if (response.status !== 200 || !data.valid) {
				return {
					valid: false,
					error: formatCloudLicenseApiError(response, data, "验证"),
					is_network_error: false,
				};
			}

			const result: CloudValidationResult = {
				valid: true,
				expires_at:
					typeof data.expires_at === "string" ? data.expires_at : undefined,
				devices_count:
					typeof data.devices_count === "number"
						? data.devices_count
						: undefined,
				max_devices:
					typeof data.max_devices === "number" ? data.max_devices : undefined,
			};

			this.setCache(result);
			return result;
		} catch (error) {
			logger.error("验证请求失败:", error);

			const isNetworkError =
				error instanceof TypeError ||
				(error instanceof Error && error.name === "AbortError");

			return {
				valid: false,
				error: isNetworkError ? "网络连接失败" : "验证失败",
				is_network_error: isNetworkError,
			};
		}
	}

	private getCache(): {
		result: CloudValidationResult;
		cached_at: number;
	} | null {
		try {
			const cached = vaultStorage.getItem(this.cacheKey);
			return cached
				? (JSON.parse(cached) as {
						result: CloudValidationResult;
						cached_at: number;
				  })
				: null;
		} catch {
			return null;
		}
	}

	private isCacheValid(cache: { cached_at: number }): boolean {
		return Date.now() - cache.cached_at < this.cacheTTL;
	}

	private setCache(result: CloudValidationResult): void {
		try {
			vaultStorage.setItem(
				this.cacheKey,
				JSON.stringify({
					result,
					cached_at: Date.now(),
				}),
			);
		} catch {
			// 忽略存储错误
		}
	}

	clearCache(): void {
		try {
			vaultStorage.removeItem(this.cacheKey);
		} catch {
			// 忽略
		}
	}
}
