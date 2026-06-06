import manifest from "../../manifest.json";
import type { LicensedProduct } from "../types/license";

export const CURRENT_PLUGIN_ID = manifest.id as LicensedProduct;
export const CURRENT_PLUGIN_NAME = manifest.name;
export const CURRENT_PLUGIN_VERSION = manifest.version;
export const CURRENT_PLUGIN_DISPLAY_VERSION = `v${CURRENT_PLUGIN_VERSION}`;

export const LEGACY_WEAVE_PRODUCT_IDS = new Set<string>([
	"weave",
	"weave-obsidian-plugin",
	"tuanki-obsidian-plugin",
]);

export const SUPPORTED_ACTIVATION_PRODUCT_IDS = new Set<string>([
	...LEGACY_WEAVE_PRODUCT_IDS,
	CURRENT_PLUGIN_ID,
]);

export const LICENSE_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAuFbE7080dfi90uTpCncI
n9wCXxPwz2r485ckXN0HO7yawwZTcSPf9I03GUg0EeyCj378AgnFUcj7GZ14Cnox
aCFhKje/u9PwBkUGiEb9Cgu6KkY29S1BPFZC9FBYE/N9Ymkw/vPZbR+0/4c8Uhu7
ou+Do+2e+C7s3UVBKRnXea4E54v/mGPOWttjvF+vwStg/x3hvDjIcfMqg3s74OVt
2vJqfOoVvqNnEVzx4wEPnAi5xD5p4Bxz2gXDlzRL+6HV2n55fdBJou+avIihxwUM
KiqnLPDZDoj1QmooLvpFj3j7/9dWyUfbKmJv3D1+hmdbeltKDYZJc9WdIU+v7Bmi
+wIDAQAB
-----END PUBLIC KEY-----`;
