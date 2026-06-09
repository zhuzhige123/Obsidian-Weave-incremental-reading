import type { ActivationCodeData, LicenseEntitlement } from "../types/license";
import { isRecord, readString } from "./unknown-record";

export function isActivationAttempt(value: unknown): value is {
	timestamp: number;
	success: boolean;
	deviceFingerprint: string;
} {
	return (
		isRecord(value) &&
		typeof value.timestamp === "number" &&
		typeof value.success === "boolean" &&
		typeof value.deviceFingerprint === "string"
	);
}

export function readActivationCodeData(value: unknown): ActivationCodeData | null {
	if (!isRecord(value)) {
		return null;
	}

	const userId = readString(value.userId);
	const productId = readString(value.productId);
	const expiresAt = readString(value.expiresAt);
	const issuedAt = readString(value.issuedAt);
	const licenseType =
		value.licenseType === "lifetime" || value.licenseType === "subscription"
			? value.licenseType
			: null;

	if (!userId || !productId || !expiresAt || !issuedAt || !licenseType) {
		return null;
	}

	const maxDevices = typeof value.maxDevices === "number" ? value.maxDevices : 0;
	const features = Array.isArray(value.features)
		? value.features.map((entry) => String(entry))
		: [];

	return {
		userId,
		productId,
		licenseType,
		expiresAt,
		maxDevices,
		features,
		issuedAt,
		entitlements: Array.isArray(value.entitlements)
			? value.entitlements.filter(
					(entry): entry is LicenseEntitlement =>
						entry === "weave-premium" ||
						entry === "epub-premium" ||
						entry === "ir-premium"
				)
			: undefined,
		metadata: isRecord(value.metadata) ? value.metadata : undefined,
	};
}

export function parseActivationCodeDataJson(raw: string): ActivationCodeData | null {
	try {
		return readActivationCodeData(JSON.parse(raw));
	} catch {
		return null;
	}
}
