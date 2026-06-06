import {
	ensureSuggestModalTheme as ensureBaseSuggestModalTheme,
	markLatestSuggestionContainer,
} from "./suggestModalTheme";

export function ensureWeaveSuggestModalTheme(): void {
	ensureBaseSuggestModalTheme();
}

export { markLatestSuggestionContainer };
