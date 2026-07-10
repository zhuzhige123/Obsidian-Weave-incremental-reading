import type { App } from "obsidian";
import { TFile, TFolder, normalizePath } from "obsidian";
import { IMPORTABLE_EXTENSIONS } from "./material-import-constants";
import type { MaterialImportTreeNode } from "./material-import-types";

export interface MaterialImportFileTreeHelpers {
	buildTreeChildren: (
		folder: TFolder,
		selected?: boolean,
		deep?: boolean,
	) => MaterialImportTreeNode[];
	buildFullTree: () => MaterialImportTreeNode[];
	toggleSelect: (
		nodes: MaterialImportTreeNode[],
		node: MaterialImportTreeNode,
	) => MaterialImportTreeNode[];
	toggleExpand: (
		nodes: MaterialImportTreeNode[],
		node: MaterialImportTreeNode,
	) => MaterialImportTreeNode[];
	findNodeByPath: (
		nodes: MaterialImportTreeNode[],
		path: string,
	) => MaterialImportTreeNode | null;
	countSelectedFiles: (nodes: MaterialImportTreeNode[]) => number;
	getSelectedPaths: (nodes: MaterialImportTreeNode[]) => string[];
	filterTree: (
		nodes: MaterialImportTreeNode[],
		query: string,
	) => MaterialImportTreeNode[];
	ensureFullTreeLoadedForSearch: (
		nodes: MaterialImportTreeNode[],
		searchQuery: string,
		searchFullTreeReady: boolean,
	) => { tree: MaterialImportTreeNode[]; searchFullTreeReady: boolean };
	clearCache: () => void;
}

export function createMaterialImportFileTreeHelpers(
	app: App,
	excludedImportFolderPath: string,
): MaterialImportFileTreeHelpers {
	const folderFileCountCache = new Map<string, number>();

	function isImportableFile(file: TFile): boolean {
		return (
			IMPORTABLE_EXTENSIONS.has(file.extension) && !file.name.startsWith(".")
		);
	}

	function shouldSkipTreeFolder(folder: TFolder): boolean {
		if (folder.path && folder.name.startsWith(".")) {
			return true;
		}

		const normalizedFolderPath = normalizePath(folder.path);
		return (
			normalizedFolderPath === excludedImportFolderPath ||
			normalizedFolderPath.startsWith(`${excludedImportFolderPath}/`)
		);
	}

	function hasDisplayableChildren(folder: TFolder): boolean {
		return folder.children.some((child) => {
			if (child instanceof TFolder) {
				return !shouldSkipTreeFolder(child);
			}
			return child instanceof TFile && isImportableFile(child);
		});
	}

	function sortTreeNodes(
		nodes: MaterialImportTreeNode[],
	): MaterialImportTreeNode[] {
		return nodes.sort((a, b) => {
			if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
			return a.name.localeCompare(b.name, "zh-CN");
		});
	}

	function getLoadedTreeFileCount(nodes: MaterialImportTreeNode[]): number {
		return nodes.reduce((total, node) => {
			if (node.type === "file") {
				return total + 1;
			}
			return total + (node.fileCount ?? 0);
		}, 0);
	}

	function createFileNode(
		file: TFile,
		selected = false,
	): MaterialImportTreeNode {
		return {
			name: file.name,
			path: file.path,
			type: "file",
			children: [],
			childrenLoaded: true,
			hasChildren: false,
			expanded: false,
			selected,
			indeterminate: false,
			fileCount: 1,
		};
	}

	function createFolderNode(
		folder: TFolder,
		selected = false,
		deep = false,
	): MaterialImportTreeNode {
		const children = deep ? buildTreeChildren(folder, selected, true) : [];
		return {
			name: folder.name || "Vault",
			path: folder.path,
			type: "folder",
			children,
			childrenLoaded: deep,
			hasChildren: hasDisplayableChildren(folder),
			expanded: false,
			selected,
			indeterminate: false,
			fileCount: deep ? getLoadedTreeFileCount(children) : null,
		};
	}

	function buildTreeChildren(
		folder: TFolder,
		selected = false,
		deep = false,
	): MaterialImportTreeNode[] {
		const children: MaterialImportTreeNode[] = [];

		for (const child of folder.children) {
			if (child instanceof TFolder) {
				if (shouldSkipTreeFolder(child) || !hasDisplayableChildren(child)) {
					continue;
				}
				children.push(createFolderNode(child, selected, deep));
			} else if (child instanceof TFile && isImportableFile(child)) {
				children.push(createFileNode(child, selected));
			}
		}

		return sortTreeNodes(children);
	}

	function buildFullTree(): MaterialImportTreeNode[] {
		return buildTreeChildren(app.vault.getRoot(), false, true);
	}

	function setNodeSelection(
		node: MaterialImportTreeNode,
		selected: boolean,
	): void {
		node.selected = selected;
		node.indeterminate = false;

		if (node.type === "folder" && node.childrenLoaded) {
			for (const child of node.children) {
				setNodeSelection(child, selected);
			}
		}
	}

	function updateParentStates(nodes: MaterialImportTreeNode[]): void {
		for (const node of nodes) {
			if (
				node.type !== "folder" ||
				!node.childrenLoaded ||
				node.children.length === 0
			) {
				continue;
			}

			updateParentStates(node.children);
			const selCount = node.children.filter((c) => c.selected).length;
			const indeterminateCount = node.children.filter(
				(c) => c.indeterminate,
			).length;
			const totalCount = node.children.length;

			if (selCount === totalCount && indeterminateCount === 0) {
				node.selected = true;
				node.indeterminate = false;
			} else if (selCount === 0 && indeterminateCount === 0) {
				node.selected = false;
				node.indeterminate = false;
			} else {
				node.selected = false;
				node.indeterminate = true;
			}
		}
	}

	function toggleSelect(
		nodes: MaterialImportTreeNode[],
		node: MaterialImportTreeNode,
	): MaterialImportTreeNode[] {
		setNodeSelection(node, !node.selected || node.indeterminate);
		updateParentStates(nodes);
		return [...nodes];
	}

	function loadNodeChildren(node: MaterialImportTreeNode): void {
		if (node.type !== "folder" || node.childrenLoaded) {
			return;
		}

		const folder = app.vault.getAbstractFileByPath(node.path);
		if (!(folder instanceof TFolder)) {
			node.childrenLoaded = true;
			node.hasChildren = false;
			node.children = [];
			return;
		}

		node.children = buildTreeChildren(
			folder,
			node.selected && !node.indeterminate,
			false,
		);
		node.childrenLoaded = true;
		node.hasChildren = node.children.length > 0;
	}

	function toggleExpand(
		nodes: MaterialImportTreeNode[],
		node: MaterialImportTreeNode,
	): MaterialImportTreeNode[] {
		if (node.type !== "folder") {
			return nodes;
		}

		if (!node.childrenLoaded) {
			loadNodeChildren(node);
		}

		node.expanded = !node.expanded;
		return [...nodes];
	}

	function findNodeByPath(
		nodes: MaterialImportTreeNode[],
		path: string,
	): MaterialImportTreeNode | null {
		for (const node of nodes) {
			if (node.path === path) return node;
			if (
				node.type === "folder" &&
				node.childrenLoaded &&
				node.children.length > 0
			) {
				const found = findNodeByPath(node.children, path);
				if (found) return found;
			}
		}
		return null;
	}

	function collectImportableFilePathsFromFolder(
		folder: TFolder,
		paths: Set<string>,
	): void {
		for (const child of folder.children) {
			if (child instanceof TFolder) {
				if (shouldSkipTreeFolder(child)) {
					continue;
				}
				collectImportableFilePathsFromFolder(child, paths);
			} else if (child instanceof TFile && isImportableFile(child)) {
				paths.add(child.path);
			}
		}
	}

	function getFolderFileCount(folderPath: string): number {
		const normalizedPath = normalizePath(folderPath);
		const cached = folderFileCountCache.get(normalizedPath);
		if (cached != null) {
			return cached;
		}

		const folder = app.vault.getAbstractFileByPath(normalizedPath);
		if (!(folder instanceof TFolder)) {
			return 0;
		}

		let count = 0;
		const stack: TFolder[] = [folder];
		while (stack.length > 0) {
			const current = stack.pop();
			if (!current) continue;

			for (const child of current.children) {
				if (child instanceof TFolder) {
					if (!shouldSkipTreeFolder(child)) {
						stack.push(child);
					}
				} else if (child instanceof TFile && isImportableFile(child)) {
					count++;
				}
			}
		}

		folderFileCountCache.set(normalizedPath, count);
		return count;
	}

	function countSelectedFiles(nodes: MaterialImportTreeNode[]): number {
		let count = 0;
		for (const node of nodes) {
			if (node.type === "file") {
				if (node.selected) {
					count++;
				}
				continue;
			}

			if (node.selected && !node.indeterminate) {
				count += getFolderFileCount(node.path);
				continue;
			}

			if (node.childrenLoaded) {
				count += countSelectedFiles(node.children);
			}
		}
		return count;
	}

	function getSelectedPaths(nodes: MaterialImportTreeNode[]): string[] {
		const paths = new Set<string>();
		function collect(nodeList: MaterialImportTreeNode[]): void {
			for (const node of nodeList) {
				if (node.type === "file") {
					if (node.selected) {
						paths.add(node.path);
					}
					continue;
				}

				if (node.selected && !node.indeterminate) {
					const folder = app.vault.getAbstractFileByPath(node.path);
					if (folder instanceof TFolder) {
						collectImportableFilePathsFromFolder(folder, paths);
					}
					continue;
				}

				if (node.childrenLoaded) {
					collect(node.children);
				}
			}
		}
		collect(nodes);
		return Array.from(paths);
	}

	function getExplicitlySelectedFilePaths(
		nodes: MaterialImportTreeNode[],
	): string[] {
		const paths: string[] = [];
		const collect = (
			nodeList: MaterialImportTreeNode[],
			parentSelected: boolean,
		): void => {
			for (const node of nodeList) {
				const fullySelected =
					parentSelected ||
					(node.type === "folder" && node.selected && !node.indeterminate);
				if (node.type === "file") {
					if (node.selected && !parentSelected) {
						paths.push(node.path);
					}
					continue;
				}

				if (fullySelected) {
					continue;
				}

				if (node.childrenLoaded) {
					collect(node.children, false);
				}
			}
		};

		collect(nodes, false);
		return paths;
	}

	function getSelectedRootFolderPaths(
		nodes: MaterialImportTreeNode[],
	): string[] {
		const paths: string[] = [];
		const walk = (
			nodeList: MaterialImportTreeNode[],
			parentSelected: boolean,
		): void => {
			for (const node of nodeList) {
				const isFolder = node.type === "folder";
				const isSelectedRootFolder =
					isFolder && node.selected && !parentSelected && node.path;
				if (isSelectedRootFolder) {
					paths.push(node.path);
				}
				const nextParentSelected =
					parentSelected || (isFolder && node.selected);
				if (isFolder && node.childrenLoaded && node.children.length > 0) {
					walk(node.children, nextParentSelected);
				}
			}
		};
		walk(nodes, false);
		return paths;
	}

	function filterTree(
		nodes: MaterialImportTreeNode[],
		query: string,
	): MaterialImportTreeNode[] {
		const result: MaterialImportTreeNode[] = [];
		for (const node of nodes) {
			if (node.type === "file") {
				if (node.name.toLowerCase().includes(query)) {
					result.push({ ...node });
				}
			} else {
				const filteredChildren = node.childrenLoaded
					? filterTree(node.children, query)
					: [];
				if (
					filteredChildren.length > 0 ||
					node.name.toLowerCase().includes(query)
				) {
					result.push({
						...node,
						children: filteredChildren,
						childrenLoaded: true,
						expanded: true,
					});
				}
			}
		}
		return result;
	}

	function applySelectionSnapshot(
		nodes: MaterialImportTreeNode[],
		selectedFolders: Set<string>,
		selectedFiles: Set<string>,
	): void {
		for (const node of nodes) {
			if (node.type === "folder") {
				if (selectedFolders.has(node.path)) {
					setNodeSelection(node, true);
					continue;
				}
				applySelectionSnapshot(node.children, selectedFolders, selectedFiles);
			} else if (selectedFiles.has(node.path)) {
				node.selected = true;
			}
		}
	}

	function ensureFullTreeLoadedForSearch(
		nodes: MaterialImportTreeNode[],
		searchQuery: string,
		searchFullTreeReady: boolean,
	): { tree: MaterialImportTreeNode[]; searchFullTreeReady: boolean } {
		if (searchFullTreeReady || !searchQuery.trim()) {
			return { tree: nodes, searchFullTreeReady };
		}

		const selectedFolders = new Set(getSelectedRootFolderPaths(nodes));
		const selectedFiles = new Set(getExplicitlySelectedFilePaths(nodes));
		const fullTree = buildFullTree();
		applySelectionSnapshot(fullTree, selectedFolders, selectedFiles);
		updateParentStates(fullTree);
		return { tree: fullTree, searchFullTreeReady: true };
	}

	function clearCache(): void {
		folderFileCountCache.clear();
	}

	return {
		buildTreeChildren,
		buildFullTree,
		toggleSelect,
		toggleExpand,
		findNodeByPath,
		countSelectedFiles,
		getSelectedPaths,
		filterTree,
		ensureFullTreeLoadedForSearch,
		clearCache,
	};
}
