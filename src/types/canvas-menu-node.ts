export type CanvasNodeData = {
	type?: string;
	text?: string;
	label?: string;
	file?: string;
	url?: string;
	x?: number;
	y?: number;
	width?: number;
	height?: number;
	id?: string;
};

export type CanvasMenuNode = {
	getData?: () => CanvasNodeData;
	id?: string;
	unknownData?: {
		id?: string;
	};
};

export function readCanvasNodeData(node: CanvasMenuNode | null | undefined): CanvasNodeData | null {
	if (!node) {
		return null;
	}

	const data = typeof node.getData === "function" ? node.getData() : node;
	return data && typeof data === "object" ? data : null;
}

export function readCanvasNodeText(node: CanvasMenuNode | null | undefined): string {
	const nodeData = readCanvasNodeData(node);
	if (!nodeData) {
		return "";
	}

	if (nodeData.type === "text" && typeof nodeData.text === "string") {
		return nodeData.text.trim();
	}
	if (nodeData.type === "file" && typeof nodeData.file === "string") {
		const filePath = nodeData.file.trim();
		return filePath ? `![[${filePath}]]` : "";
	}
	if (nodeData.type === "link" && typeof nodeData.url === "string") {
		return nodeData.url.trim();
	}

	return "";
}
