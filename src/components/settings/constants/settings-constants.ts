/**
 * Modal layout constants for ResizableModal (MaterialImport fallback).
 * Standalone IR — no main-plugin settings tabs or AI/Anki defaults.
 */

import { t } from "../../../utils/i18n";

export function getModalSizePresets() {
	return {
		small: { width: 600, height: 400, label: t("settingsConstants.modalSize.small") },
		medium: { width: 700, height: 500, label: t("settingsConstants.modalSize.medium") },
		large: { width: 800, height: 600, label: t("settingsConstants.modalSize.large") },
		"extra-large": { width: 1000, height: 700, label: t("settingsConstants.modalSize.extraLarge") },
		custom: { width: 800, height: 600, label: t("settingsConstants.modalSize.custom") },
	};
}

export const MODAL_SIZE_LIMITS = {
	MIN_WIDTH: 400,
	MAX_WIDTH: 1400,
	MIN_HEIGHT: 300,
	MAX_HEIGHT: 900,
	RESIZE_HANDLE_SIZE: 8,
} as const;
