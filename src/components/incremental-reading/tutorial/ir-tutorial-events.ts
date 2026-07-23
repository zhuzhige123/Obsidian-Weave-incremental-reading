/**
 * Custom event to open the IR tutorial from commands / settings
 * when the calendar may or may not already be mounted.
 */
export const IR_OPEN_TUTORIAL_EVENT = "weave-ir:open-tutorial";

export type IROpenTutorialEventDetail = {
	initialTab?: string;
};

export function dispatchOpenIRTutorial(detail?: IROpenTutorialEventDetail): void {
	window.dispatchEvent(
		new CustomEvent(IR_OPEN_TUTORIAL_EVENT, {
			detail: detail ?? {},
		}),
	);
}
