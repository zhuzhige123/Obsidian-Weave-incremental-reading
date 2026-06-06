import { App, Modal } from "obsidian";
import { mount, unmount } from "svelte";
import type WeavePlugin from "../../main";
import { configureWeaveObsidianModalLayout } from "../../utils/obsidian-modal-layout";
import IRDataManagementModal from "./IRDataManagementModal.svelte";

export interface IRDataManagementModalObsidianOptions {
	plugin: WeavePlugin;
	onClose?: () => void;
}

export class IRDataManagementModalObsidian extends Modal {
	private component: Parameters<typeof unmount>[0] | null = null;
	private readonly options: IRDataManagementModalObsidianOptions;

	constructor(app: App, options: IRDataManagementModalObsidianOptions) {
		super(app);
		this.options = options;
	}

	onOpen() {
		this.setTitle("增量阅读数据管理");
		configureWeaveObsidianModalLayout(this, {
			modalClass: "weave-ir-data-management-modal",
			contentClass: "weave-ir-data-management-modal-content",
		});

		this.component = mount(IRDataManagementModal, {
			target: this.contentEl,
			props: {
				plugin: this.options.plugin,
				onClose: () => this.close(),
			},
		});
	}

	onClose() {
		if (this.component) {
			void unmount(this.component);
			this.component = null;
		}

		this.contentEl.empty();
		this.options.onClose?.();
	}
}
