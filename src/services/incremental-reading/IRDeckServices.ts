import type { App } from "obsidian";
import { IRDeckManager } from "./IRDeckManager";
import { IRStorageService } from "./IRStorageService";

let storageService: IRStorageService | null = null;
let deckManager: IRDeckManager | null = null;
let servicesInitialized = false;
let currentApp: App | null = null;

export function getIRDeckServices(app: App, importFolder?: string) {
	if (currentApp !== app) {
		servicesInitialized = false;
		currentApp = app;
	}

	return {
		get storageService() {
			return storageService;
		},
		get deckManager() {
			return deckManager;
		},
		async init() {
			if (servicesInitialized && storageService && deckManager) {
				return;
			}

			storageService = new IRStorageService(app);
			await storageService.initialize();
			deckManager = new IRDeckManager(app, storageService, importFolder);
			servicesInitialized = true;
		},
	};
}
