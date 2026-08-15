/**
 * Sync DOM helper for view-shell loading placeholders.
 * Matches Weave main-plugin BouncingBallsLoader visuals via shared CSS.
 */

export type BouncingBallsLoadingOptions = {
	message?: string;
	compact?: boolean;
	className?: string;
};

export function renderBouncingBallsLoading(
	parent: HTMLElement,
	options: BouncingBallsLoadingOptions = {},
): HTMLElement {
	const { message = "", compact = false, className = "" } = options;
	const classes = [
		"bouncing-balls-loader",
		compact ? "bouncing-balls-loader--compact" : "",
		className,
	]
		.filter(Boolean)
		.join(" ");

	const root = parent.createDiv({ cls: classes });
	root.setAttribute("role", "status");
	root.setAttribute("aria-live", "polite");
	root.setAttribute("aria-busy", "true");
	if (message) {
		root.setAttribute("aria-label", message);
	}

	const wrapper = root.createDiv({ cls: "bouncing-balls-loader__wrapper" });
	wrapper.setAttribute("aria-hidden", "true");
	for (let i = 0; i < 3; i++) {
		wrapper.createDiv({ cls: "bouncing-balls-loader__circle" });
	}
	for (let i = 0; i < 3; i++) {
		wrapper.createDiv({ cls: "bouncing-balls-loader__shadow" });
	}

	if (message) {
		root.createDiv({
			cls: "bouncing-balls-loader__message",
			text: message,
		});
	}

	return root;
}
