/**
 * 行号到 DOM 元素的映射器
 *
 * 核心职责：
 * - 将源码行号转换为对应的 .cm-line DOM 元素
 * - 处理虚拟滚动场景（行不在 DOM 中）
 * - 处理换行场景（一行源码对应多个 DOM 元素）
 *
 * @module services/incremental-reading/LineDOMMapper
 * @version 1.0.0
 */

import { MarkdownView } from "obsidian";

/**
 * 行号到 DOM 元素映射器接口
 */
export interface LineDOMMapper {
	/**
	 * 获取指定行号对应的 DOM 元素
	 *
	 * @param lineNumber 源码行号 (0-based)
	 * @param position 'start' 返回第一个元素，'end' 返回最后一个元素
	 * @returns DOM 元素，如果行不存在返回 null
	 */
	getLineElement(lineNumber: number, position: "start" | "end"): HTMLElement | null;

	/**
	 * 获取指定行号范围的边界 DOM 元素
	 *
	 * @param startLine 起始行号 (0-based)
	 * @param endLine 结束行号 (0-based)
	 * @returns 起始和结束 DOM 元素
	 */
	getBlockBoundaryElements(
		startLine: number,
		endLine: number
	): {
		startElement: HTMLElement | null;
		endElement: HTMLElement | null;
	};

	/**
	 * 获取聚焦块的实际边界矩形
	 * 考虑块内所有元素（包括图片等嵌入内容）
	 *
	 * @param startLine 起始行号 (0-based)
	 * @param endLine 结束行号 (0-based)
	 * @returns 边界矩形，如果无法获取返回 null
	 */
	getBlockBoundingRect(startLine: number, endLine: number): DOMRect | null;

	/**
	 * 确保指定行在视口中可见
	 * 用于处理虚拟滚动场景
	 *
	 * @param lineNumber 行号 (0-based)
	 */
	ensureLineVisible(lineNumber: number): void;

	/**
	 * 使缓存失效
	 * 在内容变化后调用
	 */
	invalidateCache(): void;

	/**
	 * 销毁映射器，清理资源
	 */
	destroy(): void;
}

/**
 * 缓存条目
 */
interface CacheEntry {
	element: HTMLElement;
	timestamp: number;
}

/**
 * LineDOMMapper 实现
 *
 * 使用 CodeMirror 6 的 domAtPos API 获取 DOM 位置，
 * 然后向上查找 .cm-line 元素
 */
export class LineDOMMapperImpl implements LineDOMMapper {
	private view: MarkdownView;
	private cache: Map<string, CacheEntry> = new Map();
	private cacheTimeout = 1000; // 缓存有效期 1 秒

	constructor(view: MarkdownView) {
		this.view = view;
	}

	/**
	 * 获取指定行号对应的 DOM 元素
	 */
	getLineElement(lineNumber: number, position: "start" | "end"): HTMLElement | null {
		// 检查缓存
		const cacheKey = `${lineNumber}-${position}`;
		const cached = this.cache.get(cacheKey);
		if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
			// 验证缓存的元素仍然在 DOM 中
			if (document.contains(cached.element)) {
				return cached.element;
			}
		}

		const editor = this.view.editor;
		// @ts-ignore - 访问 CodeMirror 6 内部 API
		const cm = editor.cm;
		if (!cm) return null;

		try {
			const doc = cm.state.doc;
			const totalLines = doc.lines;

			// 确保行号有效 (CodeMirror 6 行号从 1 开始)
			const cmLineNumber = Math.max(1, Math.min(lineNumber + 1, totalLines));
			const lineInfo = doc.line(cmLineNumber);

			// 根据 position 选择字符位置
			const charPos = position === "start" ? lineInfo.from : lineInfo.to;

			// 使用 domAtPos 获取 DOM 位置
			// 第二个参数：-1 表示偏向左侧，1 表示偏向右侧
			const side = position === "start" ? -1 : 1;
			const domPos = cm.domAtPos(charPos, side);

			if (!domPos || !domPos.node) {
				return null;
			}

			// 向上查找 .cm-line 元素
			const element = this.findCmLineElement(domPos.node as Node);

			// 更新缓存
			if (element) {
				this.cache.set(cacheKey, {
					element,
					timestamp: Date.now(),
				});
			}

			return element;
		} catch (_e) {
			return null;
		}
	}

	/**
	 * 获取指定行号范围的边界 DOM 元素
	 *
	 * 对于结束行，需要特别处理可能存在的嵌入内容（如图片）
	 * 因为嵌入内容可能渲染在 .cm-line 之后
	 */
	getBlockBoundaryElements(
		startLine: number,
		endLine: number
	): {
		startElement: HTMLElement | null;
		endElement: HTMLElement | null;
	} {
		const startElement = this.getLineElement(startLine, "start");
		let endElement = this.getLineElement(endLine, "end");

		// 检查结束行之后是否有嵌入内容（如图片）
		// 这些内容可能在 .cm-embed-block 或 .internal-embed 中
		if (endElement) {
			// 向后查找所有连续的嵌入元素
			let current = endElement.nextElementSibling;
			while (current && this.isEmbedElement(current as HTMLElement)) {
				endElement = current as HTMLElement;
				current = current.nextElementSibling;
			}
		}

		return {
			startElement,
			endElement,
		};
	}

	/**
	 * 获取聚焦块的实际边界矩形
	 * 考虑块内所有元素（包括图片等嵌入内容）
	 */
	getBlockBoundingRect(startLine: number, endLine: number): DOMRect | null {
		const { startElement, endElement } = this.getBlockBoundaryElements(startLine, endLine);

		if (!startElement || !endElement) return null;

		const startRect = startElement.getBoundingClientRect();
		const endRect = endElement.getBoundingClientRect();

		// 合并两个矩形
		const top = Math.min(startRect.top, endRect.top);
		const bottom = Math.max(startRect.bottom, endRect.bottom);
		const left = Math.min(startRect.left, endRect.left);
		const right = Math.max(startRect.right, endRect.right);

		return new DOMRect(left, top, right - left, bottom - top);
	}

	/**
	 * 检查元素是否是嵌入内容（图片、视频等）
	 */
	private isEmbedElement(element: HTMLElement): boolean {
		if (!element) return false;

		// 检查常见的嵌入内容类名
		const embedClasses = [
			"cm-embed-block",
			"internal-embed",
			"image-embed",
			"media-embed",
			"cm-widget",
		];

		return embedClasses.some((cls) => element.classList.contains(cls));
	}

	/**
	 * 确保指定行在视口中可见
	 */
	ensureLineVisible(lineNumber: number): void {
		const editor = this.view.editor;
		editor.scrollIntoView(
			{
				from: { line: lineNumber, ch: 0 },
				to: { line: lineNumber, ch: 0 },
			},
			true
		);
	}

	/**
	 * 使缓存失效
	 */
	invalidateCache(): void {
		this.cache.clear();
	}

	/**
	 * 销毁映射器
	 */
	destroy(): void {
		this.cache.clear();
	}

	/**
	 * 从给定节点向上查找 .cm-line 元素
	 */
	private findCmLineElement(node: Node): HTMLElement | null {
		let current: Node | null = node;

		while (current) {
			if (current instanceof HTMLElement && current.classList.contains("cm-line")) {
				return current;
			}
			current = current.parentNode;
		}

		return null;
	}
}

/**
 * 创建 LineDOMMapper 实例
 */
export function createLineDOMMapper(view: MarkdownView): LineDOMMapper {
	return new LineDOMMapperImpl(view);
}
