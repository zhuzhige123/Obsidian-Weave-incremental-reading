import { type App, Menu, TFile, normalizePath } from "obsidian";
import { i18n } from "../../utils/i18n";
import { revealLeaf } from "../../utils/workspace-navigation";
import {
	getLinkableVaultNoteIcon,
	isLinkableVaultNoteFile,
	listLinkableVaultNoteFiles,
} from "./IRLinkedNotePolicy";

export interface AssociatedNoteMenuOptions {
	menu: Menu;
	notePaths: string[];
	getLabel: (notePath: string) => string;
	onOpen: (notePath: string) => void | Promise<void>;
	onPick: (mode: "replace" | "append") => void | Promise<void>;
	onCreate: (mode: "replace" | "append") => void | Promise<void>;
	onSetPrimary: (notePath: string) => void | Promise<void>;
	onRemove: (notePath: string) => void | Promise<void>;
	onClear: () => void | Promise<void>;
	openAllTitle?: string;
}

function untitledNoteLabel(): string {
	return i18n.t("irSidebar.associatedNote.untitled");
}

export function populateAssociatedNoteMenu(
	options: AssociatedNoteMenuOptions,
): void {
	const {
		menu,
		notePaths,
		getLabel,
		onOpen,
		onPick,
		onCreate,
		onSetPrimary,
		onRemove,
		onClear,
		openAllTitle = i18n.t("irSidebar.associatedNote.openLinkedNotes"),
	} = options;

	if (notePaths.length > 0) {
		menu.addItem((item) =>
			item
				.setTitle(
					i18n.t("irSidebar.associatedNote.openPrimaryNote", {
						name: getLabel(notePaths[0]),
					}),
				)
				.setIcon("file-text")
				.onClick(() => {
					void onOpen(notePaths[0]);
				}),
		);

		menu.addItem((item) => {
			item.setTitle(openAllTitle).setIcon("files");
			const subMenu = item.setSubmenu();
			for (const notePath of notePaths) {
				subMenu.addItem((subItem) => {
					subItem
						.setTitle(getLabel(notePath))
						.setIcon(getLinkableVaultNoteIcon(notePath))
						.onClick(() => {
							void onOpen(notePath);
						});
				});
			}
		});

		menu.addSeparator();
	}

	menu.addItem((item) =>
		item
			.setTitle(
				notePaths.length > 0
					? i18n.t("irSidebar.associatedNote.addLinkedNote")
					: i18n.t("irSidebar.associatedNote.menuLink"),
			)
			.setIcon("plus")
			.onClick(() => {
				void onPick(notePaths.length > 0 ? "append" : "replace");
			}),
	);

	menu.addItem((item) =>
		item
			.setTitle(
				notePaths.length > 0
					? i18n.t("irSidebar.associatedNote.createAndAddNote")
					: i18n.t("irSidebar.associatedNote.createAndLinkNote"),
			)
			.setIcon("file-plus")
			.onClick(() => {
				void onCreate(notePaths.length > 0 ? "append" : "replace");
			}),
	);

	if (notePaths.length === 0) {
		return;
	}

	menu.addSeparator();

	menu.addItem((item) => {
		item
			.setTitle(i18n.t("irSidebar.associatedNote.setPrimaryNote"))
			.setIcon("star");
		const subMenu = item.setSubmenu();
		for (const notePath of notePaths) {
			const isPrimary = notePath === notePaths[0];
			subMenu.addItem((subItem) => {
				subItem
					.setTitle(
						`${
							isPrimary
								? i18n.t("irSidebar.associatedNote.primary")
								: i18n.t("irSidebar.associatedNote.setPrimaryNote")
						}: ${getLabel(notePath)}`,
					)
					.setIcon(isPrimary ? "check" : "chevrons-up")
					.setDisabled(isPrimary)
					.onClick(() => {
						if (!isPrimary) {
							void onSetPrimary(notePath);
						}
					});
			});
		}
	});

	menu.addItem((item) => {
		item
			.setTitle(i18n.t("irSidebar.associatedNote.removeLinkedNote"))
			.setIcon("trash");
		const subMenu = item.setSubmenu();
		for (const notePath of notePaths) {
			subMenu.addItem((subItem) => {
				subItem
					.setTitle(getLabel(notePath))
					.setIcon("trash")
					.onClick(() => {
						void onRemove(notePath);
					});
			});
		}
	});

	menu.addSeparator();
	menu.addItem((item) =>
		item
			.setTitle(i18n.t("irSidebar.associatedNote.clearLinkedNotes"))
			.setIcon("x-circle")
			.onClick(() => {
				void onClear();
			}),
	);
}

function sanitizeAssociatedNoteBaseName(rawName: string): string {
	const normalized = String(rawName || "")
		.trim()
		.replace(/[\\/:*?"<>|#^[\]]+/g, " ");
	const compact = normalized.replace(/\s+/g, " ").trim();
	return compact || untitledNoteLabel();
}

async function ensureFolderExists(app: App, folderPath: string): Promise<void> {
	const normalized = normalizePath(folderPath || "");
	if (!normalized) return;

	const parts = normalized.split("/").filter(Boolean);
	let currentPath = "";
	for (const part of parts) {
		currentPath = currentPath ? `${currentPath}/${part}` : part;
		const existing = app.vault.getAbstractFileByPath(currentPath);
		if (!existing) {
			await app.vault.createFolder(currentPath);
		}
	}
}

export function resolvePreferredAssociatedNoteFolder(
	app: App,
	options: {
		notePaths?: string[];
		fallbackFilePath?: string;
	},
): string {
	for (const notePath of options.notePaths || []) {
		const normalizedNotePath = normalizePath(String(notePath || "").trim());
		if (!normalizedNotePath) continue;
		const slashIndex = normalizedNotePath.lastIndexOf("/");
		if (slashIndex > 0) {
			return normalizedNotePath.slice(0, slashIndex);
		}
	}

	const fallbackFilePath = normalizePath(
		String(options.fallbackFilePath || "").trim(),
	);
	if (fallbackFilePath) {
		const slashIndex = fallbackFilePath.lastIndexOf("/");
		if (slashIndex > 0) {
			return fallbackFilePath.slice(0, slashIndex);
		}
	}

	const activeFile = app.workspace.getActiveFile();
	if (activeFile?.parent?.path) {
		return normalizePath(activeFile.parent.path);
	}

	return "";
}

export async function createAssociatedMarkdownNote(
	app: App,
	options: {
		baseName: string;
		preferredFolderPath?: string;
		initialContent?: string;
	},
): Promise<TFile> {
	const folderPath = normalizePath(
		String(options.preferredFolderPath || "").trim(),
	);
	if (folderPath) {
		await ensureFolderExists(app, folderPath);
	}

	const safeBaseName = sanitizeAssociatedNoteBaseName(options.baseName);
	const basePath = folderPath ? `${folderPath}/${safeBaseName}` : safeBaseName;
	let targetPath = normalizePath(`${basePath}.md`);
	let counter = 2;

	while (app.vault.getAbstractFileByPath(targetPath)) {
		targetPath = normalizePath(`${basePath} ${counter}.md`);
		counter += 1;
	}

	const content = String(options.initialContent || "").replace(/\r\n?/g, "\n");
	return await app.vault.create(targetPath, content);
}

function resolveLinkableVaultNoteFile(
	app: App,
	notePath: string,
): TFile | null {
	const normalized = normalizePath(String(notePath || "").trim());
	if (!normalized) {
		return null;
	}

	let file = app.vault.getAbstractFileByPath(normalized);
	if (!(file instanceof TFile) && !/\.[^/.]+$/i.test(normalized)) {
		file = app.vault.getAbstractFileByPath(`${normalized}.md`);
	}

	if (file instanceof TFile && isLinkableVaultNoteFile(file)) {
		return file;
	}

	return null;
}

export async function openLinkedVaultNote(
	app: App,
	notePath: string,
): Promise<TFile | null> {
	const file = resolveLinkableVaultNoteFile(app, notePath);
	if (!file) {
		return null;
	}

	const leaf =
		app.workspace.getRightLeaf(false) || app.workspace.getLeaf("tab");
	await leaf.openFile(file, { active: true });
	revealLeaf(app, leaf);
	return file;
}

export function getLinkedVaultNoteLabel(app: App, notePath: string): string {
	const file = resolveLinkableVaultNoteFile(app, notePath);
	if (file) {
		return file.basename || untitledNoteLabel();
	}

	const normalized = normalizePath(String(notePath || "").trim());
	if (!normalized) {
		return untitledNoteLabel();
	}

	const filename = normalized.split("/").pop() || normalized;
	return (
		filename
			.replace(/\.excalidraw\.md$/i, "")
			.replace(/\.(?:md|markdown|canvas)$/i, "") || untitledNoteLabel()
	);
}

export async function pickLinkableVaultNoteFile(
	app: App,
	options?: {
		placeholder?: string;
		excludePath?: string;
	},
): Promise<TFile | null> {
	const { VaultFileSuggestModal } = await import(
		"../../modals/VaultFileSuggestModal"
	);
	const picker = new VaultFileSuggestModal(app, {
		placeholder: options?.placeholder,
		files: listLinkableVaultNoteFiles(app),
		filter: (file) =>
			isLinkableVaultNoteFile(file) && file.path !== options?.excludePath,
		icon: "files",
		showFileIcon: false,
		showFilePath: false,
	});
	return picker.openAndSelect();
}
