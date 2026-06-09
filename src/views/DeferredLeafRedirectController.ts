import type { EventRef, Workspace, WorkspaceLeaf } from "obsidian";

type WorkspaceLike = Pick<
	Workspace,
	"layoutReady" | "activeLeaf" | "on" | "offref" | "onLayoutReady"
> & {
	getActiveLeaf?: () => WorkspaceLeaf | null;
};

type DeferredLeafRedirectControllerOptions = {
	workspace: WorkspaceLike;
	leaf: WorkspaceLeaf;
	shouldRedirect: () => boolean;
	onRedirect: () => void;
	delayMs?: number;
};

/**
 * 延迟代理视图的重定向，避免在工作区恢复阶段就对后台标签页做重操作。
 */
export class DeferredLeafRedirectController {
	private readonly workspace: WorkspaceLike;
	private readonly leaf: WorkspaceLeaf;
	private readonly shouldRedirect: () => boolean;
	private readonly onRedirect: () => void;
	private readonly delayMs: number;
	private activeLeafChangeRef: EventRef | null = null;
	private redirectTimer: number | null = null;
	private started = false;
	private disposed = false;

	constructor(options: DeferredLeafRedirectControllerOptions) {
		this.workspace = options.workspace;
		this.leaf = options.leaf;
		this.shouldRedirect = options.shouldRedirect;
		this.onRedirect = options.onRedirect;
		this.delayMs = options.delayMs ?? 0;
	}

	start(): void {
		if (this.started) {
			return;
		}

		this.started = true;
		this.disposed = false;

		if (typeof this.workspace.on === "function") {
			this.activeLeafChangeRef = this.workspace.on("active-leaf-change", (leaf) => {
				if (leaf === this.leaf) {
					this.request();
				}
			});
		}

		if (!this.isLayoutReady() && typeof this.workspace.onLayoutReady === "function") {
			try {
				this.workspace.onLayoutReady(() => {
					if (this.disposed) {
						return;
					}

					this.request();
				});
			} catch {}
		}

		this.request();
	}

	stop(): void {
		this.disposed = true;
		this.clearTimer();

		if (this.activeLeafChangeRef && typeof this.workspace.offref === "function") {
			this.workspace.offref(this.activeLeafChangeRef);
		}
		this.activeLeafChangeRef = null;
		this.started = false;
	}

	request(): void {
		if (this.disposed || this.redirectTimer || !this.shouldRedirect()) {
			return;
		}

		if (!this.isLayoutReady() || !this.isActiveLeaf()) {
			return;
		}

		this.redirectTimer = window.setTimeout(() => {
			this.redirectTimer = null;
			if (this.disposed || !this.shouldRedirect()) {
				return;
			}

			if (!this.isLayoutReady() || !this.isActiveLeaf()) {
				return;
			}

			this.onRedirect();
		}, this.delayMs);
	}

	private clearTimer(): void {
		if (!this.redirectTimer) {
			return;
		}

		window.clearTimeout(this.redirectTimer);
		this.redirectTimer = null;
	}

	private isLayoutReady(): boolean {
		return !!this.workspace.layoutReady;
	}

	private isActiveLeaf(): boolean {
		const activeLeaf =
			typeof this.workspace.getActiveLeaf === "function"
				? this.workspace.getActiveLeaf()
				: null;

		return activeLeaf === this.leaf;
	}
}
