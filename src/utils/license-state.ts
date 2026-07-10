import {
	type ActivationCodeData,
	DEFAULT_LICENSE_INFO,
	DEFAULT_LICENSE_STORE,
	type EffectiveLicenseState,
	type LicenseEntitlement,
	type LicenseInfo,
	type LicenseSource,
	type LicenseStore,
	type LicensedProduct,
} from "../types/license";

export const LICENSED_PRODUCTS = {
	WEAVE: "weave",
	EPUB: "weave-epub-reader",
	IR: "weave-incremental-reading",
} as const satisfies Record<string, LicensedProduct>;

export const LICENSE_ENTITLEMENTS = {
	WEAVE_PREMIUM: "weave-premium",
	EPUB_PREMIUM: "epub-premium",
	IR_PREMIUM: "ir-premium",
} as const satisfies Record<string, LicenseEntitlement>;

const LEGACY_WEAVE_PRODUCT_IDS = new Set<string>([
	"weave",
	"weave-obsidian-plugin",
	"tuanki-obsidian-plugin",
]);

const EPUB_PRODUCT_IDS = new Set<string>([LICENSED_PRODUCTS.EPUB]);

const IR_PRODUCT_IDS = new Set<string>([LICENSED_PRODUCTS.IR]);

function dedupeStrings(values: Array<string | null | undefined>): string[] {
	const seen = new Set<string>();
	const result: string[] = [];
	for (const value of values) {
		const normalized = typeof value === "string" ? value.trim() : "";
		if (!normalized || seen.has(normalized)) {
			continue;
		}
		seen.add(normalized);
		result.push(normalized);
	}
	return result;
}

export function normalizeEntitlements(
	values: Array<string | null | undefined>,
): LicenseEntitlement[] {
	const deduped = dedupeStrings(values);
	return deduped.filter(
		(value): value is LicenseEntitlement =>
			value === LICENSE_ENTITLEMENTS.WEAVE_PREMIUM ||
			value === LICENSE_ENTITLEMENTS.EPUB_PREMIUM ||
			value === LICENSE_ENTITLEMENTS.IR_PREMIUM,
	);
}

export function mapProductIdToEntitlements(
	productId: string | undefined,
): LicenseEntitlement[] {
	const normalized = String(productId || "").trim();
	if (!normalized) {
		return [];
	}

	if (LEGACY_WEAVE_PRODUCT_IDS.has(normalized)) {
		return [
			LICENSE_ENTITLEMENTS.WEAVE_PREMIUM,
			LICENSE_ENTITLEMENTS.IR_PREMIUM,
		];
	}

	if (EPUB_PRODUCT_IDS.has(normalized)) {
		return [LICENSE_ENTITLEMENTS.EPUB_PREMIUM];
	}

	if (IR_PRODUCT_IDS.has(normalized)) {
		return [LICENSE_ENTITLEMENTS.IR_PREMIUM];
	}

	return [];
}

export function mapActivationDataToEntitlements(
	data: ActivationCodeData,
): LicenseEntitlement[] {
	return normalizeEntitlements([
		...(Array.isArray(data.entitlements) ? data.entitlements : []),
		...(Array.isArray(data.features) ? data.features : []),
		...mapProductIdToEntitlements(data.productId),
	]);
}

export function normalizeLicenseInfo(
	value: Partial<LicenseInfo> | null | undefined,
	options?: {
		source?: LicenseSource;
		sourcePluginId?: string;
	},
): LicenseInfo {
	const raw = value ?? {};
	const activationCode =
		typeof raw.activationCode === "string" ? raw.activationCode.trim() : "";
	const source = options?.source ?? raw.source ?? "local";
	const sourcePluginId = options?.sourcePluginId ?? raw.sourcePluginId;
	const entitlements = normalizeEntitlements([
		...(Array.isArray(raw.entitlements) ? raw.entitlements : []),
		...(Array.isArray(raw.features) ? raw.features : []),
		...mapProductIdToEntitlements(raw.issuedProductId),
	]);

	return {
		...DEFAULT_LICENSE_INFO,
		...raw,
		activationCode,
		isActivated: Boolean(raw.isActivated && activationCode),
		activatedAt: typeof raw.activatedAt === "string" ? raw.activatedAt : "",
		deviceFingerprint:
			typeof raw.deviceFingerprint === "string" ? raw.deviceFingerprint : "",
		expiresAt: typeof raw.expiresAt === "string" ? raw.expiresAt : "",
		productVersion:
			typeof raw.productVersion === "string" ? raw.productVersion : "",
		licenseType:
			raw.licenseType === "subscription" ? "subscription" : "lifetime",
		boundEmail: typeof raw.boundEmail === "string" ? raw.boundEmail : undefined,
		cloudSync: raw.cloudSync,
		fingerprintVersion:
			typeof raw.fingerprintVersion === "number"
				? raw.fingerprintVersion
				: undefined,
		userId: typeof raw.userId === "string" ? raw.userId : undefined,
		maxDevices: typeof raw.maxDevices === "number" ? raw.maxDevices : undefined,
		features: Array.isArray(raw.features)
			? dedupeStrings(raw.features)
			: undefined,
		entitlements,
		issuedProductId:
			typeof raw.issuedProductId === "string" ? raw.issuedProductId : undefined,
		source,
		sourcePluginId:
			typeof sourcePluginId === "string" ? sourcePluginId : undefined,
		metadata:
			raw.metadata && typeof raw.metadata === "object"
				? raw.metadata
				: undefined,
	};
}

export function hasMeaningfulLicense(
	value: Partial<LicenseInfo> | null | undefined,
): boolean {
	if (!value) {
		return false;
	}

	return Boolean(
		(typeof value.activationCode === "string" && value.activationCode.trim()) ||
			value.isActivated ||
			(typeof value.activatedAt === "string" && value.activatedAt) ||
			(typeof value.expiresAt === "string" && value.expiresAt),
	);
}

export function dedupeLicenses(licenses: LicenseInfo[]): LicenseInfo[] {
	const seen = new Set<string>();
	const result: LicenseInfo[] = [];

	for (const license of licenses) {
		const normalized = normalizeLicenseInfo(license, {
			source: license.source,
			sourcePluginId: license.sourcePluginId,
		});
		const key = `${normalized.activationCode}::${
			normalized.source ?? "local"
		}::${normalized.sourcePluginId ?? ""}`;
		if (!normalized.activationCode || seen.has(key)) {
			continue;
		}
		seen.add(key);
		result.push(normalized);
	}

	return result;
}

function hasActivatedLegacyLicense(
	legacyLicense: Partial<LicenseInfo> | null | undefined,
): boolean {
	if (!hasMeaningfulLicense(legacyLicense)) {
		return false;
	}

	const normalized = normalizeLicenseInfo(legacyLicense);
	return Boolean(normalized.activationCode && normalized.isActivated);
}

export function normalizeLicenseStore(
	legacyLicense: Partial<LicenseInfo> | null | undefined,
	rawStore: Partial<LicenseStore> | null | undefined,
): LicenseStore {
	const hasExplicitLocalLicenses = Array.isArray(rawStore?.localLicenses);
	const hasPersistedStoreMarker = typeof rawStore?.updatedAt === "string";
	const wasExplicitlyCleared =
		typeof rawStore?.localLicensesClearedAt === "string";
	const rawLicenses: Partial<LicenseInfo>[] = hasExplicitLocalLicenses
		? rawStore.localLicenses ?? []
		: [];
	const normalizedLicenses = dedupeLicenses(
		rawLicenses.map((license) => normalizeLicenseInfo(license)),
	);

	if (normalizedLicenses.length > 0) {
		return {
			localLicenses: normalizedLicenses,
			updatedAt:
				typeof rawStore?.updatedAt === "string"
					? rawStore.updatedAt
					: undefined,
		};
	}

	if (hasExplicitLocalLicenses && hasPersistedStoreMarker) {
		if (wasExplicitlyCleared || !hasActivatedLegacyLicense(legacyLicense)) {
			return {
				localLicenses: [],
				updatedAt: rawStore?.updatedAt,
				localLicensesClearedAt: rawStore?.localLicensesClearedAt,
			};
		}
	}

	if (hasActivatedLegacyLicense(legacyLicense)) {
		const migrated = normalizeLicenseInfo(legacyLicense);
		if (migrated.activationCode) {
			return {
				localLicenses: [migrated],
				updatedAt: new Date().toISOString(),
			};
		}
	}

	if (hasMeaningfulLicense(legacyLicense)) {
		const migrated = normalizeLicenseInfo(legacyLicense);
		if (migrated.activationCode) {
			return {
				localLicenses: [migrated],
				updatedAt: new Date().toISOString(),
			};
		}
	}

	return {
		...DEFAULT_LICENSE_STORE,
	};
}

export function getPrimaryLicense(licenses: LicenseInfo[]): LicenseInfo | null {
	const activated = licenses.find(
		(license) => license.isActivated && license.activationCode,
	);
	if (activated) {
		return activated;
	}
	return licenses.find((license) => license.activationCode) ?? null;
}

export function getLegacyPrimaryLicense(licenses: LicenseInfo[]): LicenseInfo {
	return getPrimaryLicense(licenses) ?? DEFAULT_LICENSE_INFO;
}

export function cloneLicenseAsInherited(
	license: LicenseInfo,
	sourcePluginId: string,
): LicenseInfo {
	return normalizeLicenseInfo(license, {
		source: "inherited",
		sourcePluginId,
	});
}

export function licenseHasEntitlement(
	license: LicenseInfo | null | undefined,
	entitlement: LicenseEntitlement,
): boolean {
	return Boolean(license?.entitlements?.includes(entitlement));
}

export function licenseAppliesToProduct(
	license: LicenseInfo | null | undefined,
	product: LicensedProduct,
): boolean {
	if (!license?.activationCode || !license.isActivated) {
		return false;
	}

	if (product === LICENSED_PRODUCTS.WEAVE) {
		return licenseHasEntitlement(license, LICENSE_ENTITLEMENTS.WEAVE_PREMIUM);
	}

	if (product === LICENSED_PRODUCTS.EPUB) {
		return (
			licenseHasEntitlement(license, LICENSE_ENTITLEMENTS.EPUB_PREMIUM) ||
			licenseHasEntitlement(license, LICENSE_ENTITLEMENTS.WEAVE_PREMIUM)
		);
	}

	return (
		licenseHasEntitlement(license, LICENSE_ENTITLEMENTS.IR_PREMIUM) ||
		licenseHasEntitlement(license, LICENSE_ENTITLEMENTS.WEAVE_PREMIUM)
	);
}

export function resolveEffectiveLicenseState(input: {
	product: LicensedProduct;
	localLicenses?: LicenseInfo[];
	inheritedLicenses?: LicenseInfo[];
}): EffectiveLicenseState {
	const localLicenses = dedupeLicenses(input.localLicenses ?? []);
	const inheritedLicenses = dedupeLicenses(input.inheritedLicenses ?? []);
	const activeLicenses = [...localLicenses, ...inheritedLicenses].filter(
		(license) => licenseAppliesToProduct(license, input.product),
	);
	const entitlements = normalizeEntitlements(
		activeLicenses.flatMap((license) => license.entitlements ?? []),
	);

	return {
		product: input.product,
		localLicenses,
		inheritedLicenses,
		activeLicenses,
		entitlements,
		primaryLicense: getPrimaryLicense(activeLicenses),
		isPremiumActive: activeLicenses.length > 0,
	};
}

export function getProductFromPluginId(
	pluginId: string | undefined,
): LicensedProduct {
	if (pluginId === LICENSED_PRODUCTS.EPUB) {
		return LICENSED_PRODUCTS.EPUB;
	}
	if (pluginId === LICENSED_PRODUCTS.IR) {
		return LICENSED_PRODUCTS.IR;
	}
	return LICENSED_PRODUCTS.WEAVE;
}
