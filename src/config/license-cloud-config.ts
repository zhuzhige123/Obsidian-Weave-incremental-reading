/**
 * 云端许可证 API（与主插件 Weave、EPUB 阅读器共用同一 FC 服务）
 */
export const LICENSE_CLOUD_API_BASE_URL =
	"https://weave-c-license-emylixqfay.cn-hangzhou.fcapp.run";

export const LICENSE_CLOUD_REVALIDATION_DAYS = 7;
export const LICENSE_CLOUD_MAX_DEVICES = 5;
export const LICENSE_CLOUD_CACHE_DAYS = 7;

export function isCloudLicenseConfigured(): boolean {
	const url = LICENSE_CLOUD_API_BASE_URL.trim();
	if (!url) {
		return false;
	}
	if (/YOUR_FC|REPLACE_ME|example\.com/i.test(url)) {
		return false;
	}
	return (
		url.startsWith("https://") ||
		url.startsWith("http://127.0.0.1") ||
		url.startsWith("http://localhost")
	);
}

export function getLicenseCloudApiBaseUrl(): string {
	return LICENSE_CLOUD_API_BASE_URL.replace(/\/+$/, "");
}
