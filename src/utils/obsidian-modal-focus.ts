import { focusManager } from "./focus-manager";

type ModalLike = {
	open: (...args: any[]) => any;
	onClose?: (...args: any[]) => any;
};

/**
 * Save focus before an Obsidian modal opens and restore it after the modal closes.
 * This avoids the editor/input focus getting "stuck" after confirm/select dialogs.
 */
export function attachModalFocusRestore<T extends ModalLike>(modal: T): T {
	const originalOpen = modal.open.bind(modal);
	modal.open = ((...args: any[]) => {
		focusManager.saveFocus();
		return originalOpen(...args);
	}) as T["open"];

	const originalOnClose =
		typeof modal.onClose === "function" ? modal.onClose.bind(modal) : undefined;

	modal.onClose = ((...args: any[]) => {
		try {
			const result = originalOnClose?.(...args);
			if (result && typeof (result as Promise<unknown>).finally === "function") {
				return (result as Promise<unknown>).finally(() => {
					focusManager.restoreFocus();
				});
			}

			focusManager.restoreFocus();
			return result;
		} catch (error) {
			focusManager.restoreFocus();
			throw error;
		}
	}) as T["onClose"];

	return modal;
}
