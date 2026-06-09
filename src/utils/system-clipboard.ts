import { applyStyleProps } from "./style-props";

function writeWithExecCommand(text: string): boolean {
	if (typeof document === "undefined" || !activeDocument.body) {
		return false;
	}

	const textarea = activeDocument.createElement("textarea");
	textarea.value = text;
	textarea.setAttribute("readonly", "true");
	applyStyleProps(textarea, {
		position: "fixed",
		opacity: "0",
		pointerEvents: "none",
	});
	activeDocument.body.appendChild(textarea);
	textarea.select();
	textarea.setSelectionRange(0, text.length);

	try {
		const execCommand = (
			activeDocument as { execCommand?: (commandId: string) => boolean }
		).execCommand;
		return execCommand?.call(activeDocument, "copy") ?? false;
	} finally {
		textarea.remove();
	}
}

/** Read plain text from the system clipboard (Obsidian community guideline entrypoint). */
export async function readSystemClipboardText(): Promise<string> {
	if (typeof navigator !== "undefined" && navigator.clipboard?.readText) {
		try {
			return String((await navigator.clipboard.readText()) || "");
		} catch {
			// Clipboard read may require user gesture or permission.
		}
	}

	return "";
}

/** Write plain text to the system clipboard with DOM fallback. */
export async function writeSystemClipboardText(text: string): Promise<boolean> {
	const normalized = String(text ?? "");

	if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
		try {
			await navigator.clipboard.writeText(normalized);
			return true;
		} catch {
			// Fall back to DOM copy when async clipboard write is unavailable.
		}
	}

	try {
		return writeWithExecCommand(normalized);
	} catch {
		return false;
	}
}
