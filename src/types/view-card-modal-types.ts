/**
 * Shared tab definition used by IR settings and data-management surfaces.
 */

export type TabId = "info" | "stats" | "curve";

export interface TabDefinition {
	id: TabId | (string & {});
	label: string;
	icon: string;
	disabled?: boolean;
}
