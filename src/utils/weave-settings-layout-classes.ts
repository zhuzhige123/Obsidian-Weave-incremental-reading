const WEAVE_SETTINGS_ROOT_SELECTOR = ".weave-settings";

function annotateSettingItems(root: ParentNode): void {
	root.querySelectorAll<HTMLElement>(
		`${WEAVE_SETTINGS_ROOT_SELECTOR} .setting-item.mod-toggle`,
	).forEach((item) => {
		item.classList.toggle(
			"mod-has-description",
			item.querySelector(".setting-item-description") !== null,
		);
	});

	root.querySelectorAll<HTMLElement>(`${WEAVE_SETTINGS_ROOT_SELECTOR} .setting-item`).forEach(
		(item) => {
			item.classList.toggle(
				"has-toggle-switch",
				item.querySelector(".toggle-switch") !== null,
			);
			item.classList.toggle(
				"has-setting-description",
				item.querySelector(".setting-description") !== null,
			);
		},
	);
}

function annotateSettingRows(root: ParentNode): void {
	root.querySelectorAll<HTMLElement>(`${WEAVE_SETTINGS_ROOT_SELECTOR} .row`).forEach((row) => {
		row.classList.toggle(
			"row-has-desc",
			row.querySelector(".label-with-desc") !== null,
		);
		row.classList.toggle(
			"row-has-modern-switch",
			row.querySelector(".modern-switch") !== null,
		);
		row.classList.toggle(
			"row-has-checkbox-toggle",
			row.querySelector(".checkbox-container.mod-toggle") !== null,
		);
		row.classList.toggle(
			"row-has-dropdown",
			row.querySelector(".obsidian-dropdown-trigger") !== null,
		);
		row.classList.toggle(
			"row-has-select",
			row.querySelector("select") !== null,
		);
		row.classList.toggle(
			"row-has-number-input",
			row.querySelector(".number-input-compact") !== null,
		);
	});
}

export function annotateWeaveSettingsLayout(root: ParentNode = activeDocument.body): void {
	if (!root) {
		return;
	}
	annotateSettingItems(root);
	annotateSettingRows(root);
}

let annotateScheduled = false;

export function scheduleWeaveSettingsLayoutClasses(
	root: ParentNode = activeDocument.body,
): void {
	if (annotateScheduled) {
		return;
	}
	annotateScheduled = true;
	window.requestAnimationFrame(() => {
		annotateScheduled = false;
		annotateWeaveSettingsLayout(root);
	});
}

export function installWeaveSettingsLayoutObserver(
	root: ParentNode = activeDocument.body,
): () => void {
	if (typeof MutationObserver === "undefined") {
		scheduleWeaveSettingsLayoutClasses(root);
		return () => undefined;
	}

	const observer = new MutationObserver(() => {
		scheduleWeaveSettingsLayoutClasses(root);
	});
	observer.observe(root, { childList: true, subtree: true });
	scheduleWeaveSettingsLayoutClasses(root);
	return () => observer.disconnect();
}
