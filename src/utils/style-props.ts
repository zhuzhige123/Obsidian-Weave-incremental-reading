type StyleTarget = {
	style?: CSSStyleDeclaration;
	setCssProps?: (props: Record<string, string>) => void;
};

export type DynamicStyleProps = Record<string, string | number | null | undefined>;

function toCssPropertyName(property: string): string {
	if (property.startsWith("--")) {
		return property;
	}

	return property.replace(/[A-Z]/g, (segment) => `-${segment.toLowerCase()}`);
}

function normalizeStyleEntries(styles: DynamicStyleProps): {
	props: Record<string, string>;
	remove: string[];
} {
	const props: Record<string, string> = {};
	const remove: string[] = [];

	for (const [property, value] of Object.entries(styles)) {
		const cssProperty = toCssPropertyName(property);
		if (value === null || value === undefined || value === "") {
			remove.push(cssProperty);
			continue;
		}
		props[cssProperty] = String(value);
	}

	return { props, remove };
}

/** Prefer Obsidian `setCssProps` when available; otherwise fall back to CSSOM setProperty. */
export function setElementCssProps(
	target: StyleTarget | null | undefined,
	styles: DynamicStyleProps
): void {
	if (!target) {
		return;
	}

	const { props, remove } = normalizeStyleEntries(styles);
	if (typeof target.setCssProps === "function" && Object.keys(props).length > 0) {
		target.setCssProps(props);
	} else if (Object.keys(props).length > 0) {
		applyStyleProps(target, props);
	}

	for (const property of remove) {
		target.style?.removeProperty(property);
	}
}

export function applyStyleProps(
	target: StyleTarget | null | undefined,
	styles: DynamicStyleProps
): void {
	const style = target?.style;
	if (!style) {
		return;
	}

	for (const [property, value] of Object.entries(styles)) {
		const cssProperty = toCssPropertyName(property);
		if (value === null || value === undefined || value === "") {
			style.removeProperty(cssProperty);
			continue;
		}

		style.setProperty(cssProperty, String(value));
	}
}
