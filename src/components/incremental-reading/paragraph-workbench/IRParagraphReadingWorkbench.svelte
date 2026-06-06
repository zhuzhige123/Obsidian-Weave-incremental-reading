<script lang="ts">
	import { onMount } from "svelte";
	import { setIcon } from "obsidian";
	import type { WeavePlugin } from "../../../main";
	import { tr } from "../../../utils/i18n";
	import MarkdownRenderer from "../../atoms/MarkdownRenderer.svelte";
	import IRParagraphShellEditorHost from "./IRParagraphShellEditorHost.svelte";
	import {
		PARAGRAPH_PRIORITY_LEVELS,
		PARAGRAPH_SCHEDULE_INTERVAL_DAYS,
		clampParagraphWorkbenchFontScale,
		normalizeParagraphPriorityLevel,
		normalizeParagraphScheduleIntervalDays,
		normalizeParagraphWorkbenchSurfaceStyle,
		normalizeParagraphWorkbenchTransitionStyle,
		resolveParagraphPostponeMinutes,
		resolveParagraphWorkbenchDisplaySettings,
		type ParagraphPriorityLevel,
		type ParagraphScheduleIntervalDays,
	} from "../../../services/incremental-reading/paragraph-workbench/paragraph-reading-shell";
	import { ParagraphWorkbenchService } from "../../../services/incremental-reading/paragraph-workbench/ParagraphWorkbenchService";
	import type {
		ParagraphWorkbenchOpenInput,
		ParagraphWorkbenchSession,
	} from "../../../services/incremental-reading/paragraph-workbench/types";
	import type {
		IRParagraphWorkbenchDisplaySettings,
		IRParagraphWorkbenchSurfaceStyle,
		IRParagraphWorkbenchTransitionStyle,
	} from "../../../types/plugin-settings.d";

	interface Props {
		plugin: WeavePlugin;
		initialInput?: ParagraphWorkbenchOpenInput | null;
	}

	let { plugin, initialInput = null }: Props = $props();

	let t = $derived($tr);
	let workbenchService = $state<ParagraphWorkbenchService | null>(null);
	let session = $state<ParagraphWorkbenchSession | null>(null);
	let display = $derived(workbenchService?.getDisplay() ?? null);
	let currentSegment = $derived(session?.segments?.[session.currentIndex] ?? null);
	let paragraphViewMode = $state<"preview" | "edit">("preview");
	let priorityPanelOpen = $state(false);
	let schedulePanelOpen = $state(false);
	let priorityLevel = $state<ParagraphPriorityLevel>(2);
	let scheduleIntervalDays = $state<ParagraphScheduleIntervalDays>(7);
	let settingsPanelOpen = $state(false);
	let settingsButtonEl = $state<HTMLElement | null>(null);
	let settingsPanelEl = $state<HTMLElement | null>(null);
	let workbenchRootEl = $state<HTMLElement | null>(null);
	let immersive = $state(false);

	let fontScale = $state(resolveParagraphWorkbenchDisplaySettings().fontScale);
	let surfaceStyle = $state<IRParagraphWorkbenchSurfaceStyle>(
		resolveParagraphWorkbenchDisplaySettings().surfaceStyle
	);
	let transitionStyle = $state<IRParagraphWorkbenchTransitionStyle>(
		resolveParagraphWorkbenchDisplaySettings().transitionStyle
	);

	const surfaceOptions: Array<{ value: IRParagraphWorkbenchSurfaceStyle; labelKey: string }> = [
		{ value: "spotlight", labelKey: "irParagraphWorkbench.surfaceStyleSpotlight" },
		{ value: "blend", labelKey: "irParagraphWorkbench.surfaceStyleBlend" },
		{ value: "dashed", labelKey: "irParagraphWorkbench.surfaceStyleDashed" },
	];

	const transitionOptions: Array<{ value: IRParagraphWorkbenchTransitionStyle; labelKey: string }> = [
		{ value: "steady", labelKey: "irParagraphWorkbench.transitionStyleSteady" },
		{ value: "fade", labelKey: "irParagraphWorkbench.transitionStyleFade" },
		{ value: "settle", labelKey: "irParagraphWorkbench.transitionStyleSettle" },
		{ value: "slide", labelKey: "irParagraphWorkbench.transitionStyleSlide" },
	];

	function icon(node: HTMLElement, name: string) {
		setIcon(node, name);
		return {
			update(nextName: string) {
				node.replaceChildren();
				setIcon(node, nextName);
			},
		};
	}

	function syncDisplaySettingsFromPlugin(): void {
		const resolved = resolveParagraphWorkbenchDisplaySettings(
			plugin.settings.incrementalReading?.paragraphWorkbench
		);
		fontScale = resolved.fontScale;
		surfaceStyle = resolved.surfaceStyle;
		transitionStyle = resolved.transitionStyle;
	}

	async function persistDisplaySettings(
		update: Partial<IRParagraphWorkbenchDisplaySettings>
	): Promise<void> {
		const current = resolveParagraphWorkbenchDisplaySettings(
			plugin.settings.incrementalReading?.paragraphWorkbench
		);
		plugin.settings.incrementalReading = {
			...(plugin.settings.incrementalReading ?? {}),
			paragraphWorkbench: {
				...current,
				...update,
			},
		};
		await plugin.saveSettings();
	}

	async function loadSession(input: ParagraphWorkbenchOpenInput | null | undefined): Promise<void> {
		if (!workbenchService) {
			return;
		}
		if (!input) {
			session = null;
			return;
		}
		session = await workbenchService.open(input);
		priorityLevel = workbenchService.getPriorityLevel();
		scheduleIntervalDays = workbenchService.getScheduleIntervalDays();
	}

	$effect(() => {
		workbenchService = new ParagraphWorkbenchService(plugin.app);
	});

	$effect(() => {
		void loadSession(initialInput);
	});

	$effect(() => {
		syncDisplaySettingsFromPlugin();
	});

	function getPostponeButtonLabel(): string {
		const minutes = resolveParagraphPostponeMinutes(display);
		const timeLabel = minutes
			? t("irParagraphWorkbench.postponeTimeMinutes", { minutes })
			: t("irParagraphWorkbench.postponeTimeOneDay");
		return t("irParagraphWorkbench.postponeWithTime", { time: timeLabel });
	}

	function getScheduleNextAppearanceLabel(): string {
		return t("irParagraphWorkbench.scheduleNextAppearance", {
			days: scheduleIntervalDays,
			timeOfDay: t("irParagraphWorkbench.scheduleTimeMorning"),
		});
	}

	function togglePriorityPanel(): void {
		priorityPanelOpen = !priorityPanelOpen;
		if (priorityPanelOpen) {
			schedulePanelOpen = false;
		}
	}

	function toggleSchedulePanel(): void {
		schedulePanelOpen = !schedulePanelOpen;
		if (schedulePanelOpen) {
			priorityPanelOpen = false;
		}
	}

	function toggleSettingsPanel(): void {
		settingsPanelOpen = !settingsPanelOpen;
	}

	function closeSettingsPanel(): void {
		settingsPanelOpen = false;
	}

	function selectPriorityLevel(level: ParagraphPriorityLevel): void {
		priorityLevel = normalizeParagraphPriorityLevel(level);
		workbenchService?.setPriorityLevel(priorityLevel);
		workbenchService?.applyPriority(t("irParagraphWorkbench.prioritySaved"));
	}

	function selectScheduleInterval(days: ParagraphScheduleIntervalDays): void {
		scheduleIntervalDays = normalizeParagraphScheduleIntervalDays(days);
		workbenchService?.setScheduleIntervalDays(scheduleIntervalDays);
		workbenchService?.applyScheduleInterval(t("irParagraphWorkbench.scheduleSaved"));
	}

	async function navigateRelative(direction: -1 | 1): Promise<void> {
		if (!workbenchService) {
			return;
		}
		session = await workbenchService.navigateRelative(direction);
	}

	function toggleParagraphContentViewMode(): void {
		paragraphViewMode = paragraphViewMode === "preview" ? "edit" : "preview";
	}

	function getSegmentNumberLabel(): string {
		const index = display?.segmentIndex ?? session?.currentIndex ?? 0;
		return String(index).padStart(2, "0");
	}

	async function updateFontScale(nextScale: number): Promise<void> {
		const clamped = clampParagraphWorkbenchFontScale(nextScale);
		fontScale = clamped;
		await persistDisplaySettings({ fontScale: clamped });
	}

	async function updateSurfaceStyle(nextStyle: IRParagraphWorkbenchSurfaceStyle): Promise<void> {
		const normalized = normalizeParagraphWorkbenchSurfaceStyle(nextStyle);
		if (normalized === surfaceStyle) {
			return;
		}
		surfaceStyle = normalized;
		await persistDisplaySettings({ surfaceStyle: normalized });
	}

	async function updateTransitionStyle(nextStyle: IRParagraphWorkbenchTransitionStyle): Promise<void> {
		const normalized = normalizeParagraphWorkbenchTransitionStyle(nextStyle);
		if (normalized === transitionStyle) {
			return;
		}
		transitionStyle = normalized;
		await persistDisplaySettings({ transitionStyle: normalized });
	}

	function applyImmersiveClass(active: boolean): void {
		document.body.classList.toggle("weave-ir-immersive-paragraph-mode", active);
		document.documentElement.classList.toggle("weave-ir-immersive-paragraph-mode", active);
	}

	async function setImmersive(active: boolean): Promise<void> {
		if (immersive === active) {
			return;
		}
		immersive = active;
		applyImmersiveClass(active);
		if (active) {
			try {
				const host = workbenchRootEl?.closest(".workspace-leaf-content") ?? document.documentElement;
				if (document.fullscreenElement !== host) {
					await host.requestFullscreen?.();
				}
			} catch {
				// 浏览器拒绝全屏时仍保留 UI 沉浸模式
			}
			return;
		}
		try {
			if (document.fullscreenElement) {
				await document.exitFullscreen?.();
			}
		} catch {}
	}

	async function toggleImmersive(): Promise<void> {
		await setImmersive(!immersive);
	}

	function handleFullscreenChange(): void {
		const active = Boolean(document.fullscreenElement);
		if (!active && immersive) {
			immersive = false;
			applyImmersiveClass(false);
		}
	}

	onMount(() => {
		const handlePointerDown = (event: PointerEvent) => {
			const target = event.target as Node | null;
			if (!settingsPanelOpen) {
				return;
			}
			if (
				(settingsPanelEl && target && settingsPanelEl.contains(target))
				|| (settingsButtonEl && target && settingsButtonEl.contains(target))
			) {
				return;
			}
			closeSettingsPanel();
		};

		document.addEventListener("fullscreenchange", handleFullscreenChange);
		document.addEventListener("pointerdown", handlePointerDown, true);
		return () => {
			document.removeEventListener("fullscreenchange", handleFullscreenChange);
			document.removeEventListener("pointerdown", handlePointerDown, true);
			applyImmersiveClass(false);
		};
	});
</script>

<div
	class="ir-paragraph-workbench weave-app"
	class:is-immersive={immersive}
	data-surface-style={surfaceStyle}
	bind:this={workbenchRootEl}
>
	<header class="ir-paragraph-workbench__header">
		<div class="ir-paragraph-workbench__header-left">
			<button type="button" class="clickable-icon ir-paragraph-workbench__topic-btn">
				<span class="ir-paragraph-workbench__topic-icon" use:icon={"book-plus"}></span>
				<span>{session?.topicName || t("irParagraphWorkbench.selectIrTopic")}</span>
			</button>
		</div>
		<div class="ir-paragraph-workbench__header-right">
			<div class="ir-paragraph-workbench__segment-nav">
				<button type="button" class="clickable-icon ir-paragraph-workbench__segment-btn" onclick={() => void navigateRelative(-1)}>
					{t("irParagraphWorkbench.prevSegment")}
				</button>
				<button type="button" class="clickable-icon ir-paragraph-workbench__segment-btn ir-paragraph-workbench__segment-btn--primary" onclick={() => void navigateRelative(1)}>
					{t("irParagraphWorkbench.nextSegment")}
				</button>
			</div>
			<div class="ir-paragraph-workbench__segment-tools">
				<div class="ir-paragraph-workbench__settings-control">
					<button
						type="button"
						class="clickable-icon ir-paragraph-workbench__segment-icon-btn"
						class:is-active={settingsPanelOpen}
						title={t("irParagraphWorkbench.settingsLabel")}
						aria-label={t("irParagraphWorkbench.settingsLabel")}
						aria-expanded={settingsPanelOpen}
						bind:this={settingsButtonEl}
						onclick={toggleSettingsPanel}
					>
						<span use:icon={"settings"}></span>
					</button>
					{#if settingsPanelOpen}
						<div class="ir-paragraph-workbench__settings-popover" bind:this={settingsPanelEl}>
							<div class="ir-paragraph-workbench__settings-row">
								<div class="ir-paragraph-workbench__settings-title">{t("irParagraphWorkbench.surfaceStyleLabel")}</div>
								<label class="ir-paragraph-workbench__settings-value-wrap">
									<span class="ir-paragraph-workbench__sr-only">{t("irParagraphWorkbench.surfaceStyleLabel")}</span>
									<select
										class="ir-paragraph-workbench__settings-select"
										value={surfaceStyle}
										onchange={(event) => {
											const target = event.currentTarget as HTMLSelectElement;
											void updateSurfaceStyle(target.value as IRParagraphWorkbenchSurfaceStyle);
										}}
									>
										{#each surfaceOptions as option (option.value)}
											<option value={option.value}>{t(option.labelKey)}</option>
										{/each}
									</select>
								</label>
							</div>
							<div class="ir-paragraph-workbench__settings-row">
								<div class="ir-paragraph-workbench__settings-title">{t("irParagraphWorkbench.transitionStyleLabel")}</div>
								<label class="ir-paragraph-workbench__settings-value-wrap">
									<span class="ir-paragraph-workbench__sr-only">{t("irParagraphWorkbench.transitionStyleLabel")}</span>
									<select
										class="ir-paragraph-workbench__settings-select"
										value={transitionStyle}
										onchange={(event) => {
											const target = event.currentTarget as HTMLSelectElement;
											void updateTransitionStyle(target.value as IRParagraphWorkbenchTransitionStyle);
										}}
									>
										{#each transitionOptions as option (option.value)}
											<option value={option.value}>{t(option.labelKey)}</option>
										{/each}
									</select>
								</label>
							</div>
							<div class="ir-paragraph-workbench__settings-row">
								<div class="ir-paragraph-workbench__settings-title">{t("irParagraphWorkbench.fontScaleToggle")}</div>
								<label class="ir-paragraph-workbench__font-slider" aria-label={t("irParagraphWorkbench.fontScaleLabel")}>
									<button
										type="button"
										class="clickable-icon ir-paragraph-workbench__font-step"
										title={t("irParagraphWorkbench.fontScaleDecrease")}
										aria-label={t("irParagraphWorkbench.fontScaleDecrease")}
										onclick={() => void updateFontScale(fontScale - 5)}
									>
										<span>A-</span>
									</button>
									<input
										type="range"
										min="85"
										max="135"
										step="1"
										value={fontScale}
										aria-label={t("irParagraphWorkbench.fontScaleLabel")}
										oninput={(event) => {
											const target = event.currentTarget as HTMLInputElement;
											void updateFontScale(Number(target.value));
										}}
									/>
									<div class="ir-paragraph-workbench__font-scale-value">{fontScale}%</div>
									<button
										type="button"
										class="clickable-icon ir-paragraph-workbench__font-step"
										title={t("irParagraphWorkbench.fontScaleIncrease")}
										aria-label={t("irParagraphWorkbench.fontScaleIncrease")}
										onclick={() => void updateFontScale(fontScale + 5)}
									>
										<span>A+</span>
									</button>
								</label>
							</div>
						</div>
					{/if}
				</div>
				<button
					type="button"
					class="clickable-icon ir-paragraph-workbench__segment-icon-btn"
					title={immersive ? t("irParagraphWorkbench.immersiveExit") : t("irParagraphWorkbench.immersiveEnter")}
					aria-label={immersive ? t("irParagraphWorkbench.immersiveExit") : t("irParagraphWorkbench.immersiveEnter")}
					onclick={() => void toggleImmersive()}
				>
					<span use:icon={immersive ? "minimize" : "maximize"}></span>
				</button>
				<button
					type="button"
					class="clickable-icon ir-paragraph-workbench__segment-icon-btn"
					class:is-active={paragraphViewMode === "edit"}
					title={paragraphViewMode === "edit" ? t("irParagraphWorkbench.viewModePreview") : t("irParagraphWorkbench.viewModeEdit")}
					aria-pressed={paragraphViewMode === "edit"}
					onclick={toggleParagraphContentViewMode}
				>
					<span use:icon={paragraphViewMode === "edit" ? "eye" : "pencil"}></span>
				</button>
			</div>
		</div>
	</header>

	{#if display}
		<section class="ir-paragraph-workbench__top-progress" aria-label={t("irParagraphWorkbench.progressBookPercent", { percent: display.bookPercent })}>
			<div class="ir-paragraph-workbench__top-progress-meta">
				{#if display.estimatedBookMinutes}
					<span>{t("irParagraphWorkbench.progressEstimatedMinutes", { minutes: display.estimatedBookMinutes })}</span>
					<span class="ir-paragraph-workbench__top-progress-sep">·</span>
				{/if}
				<span>{t("irParagraphWorkbench.progressSegment", {
					current: display.segmentIndex,
					total: display.segmentTotal,
				})}</span>
				<span class="ir-paragraph-workbench__top-progress-sep">·</span>
				<span>{t("irParagraphWorkbench.progressBookPercent", { percent: display.bookPercent })}</span>
			</div>
			<div class="ir-paragraph-workbench__top-progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={display.bookPercent}>
				<div class="ir-paragraph-workbench__top-progress-fill" style={`width:${display.bookPercent}%`}></div>
			</div>
			{#if display.topicName || (display.queueDone !== undefined && display.queueTotal !== undefined)}
				<div class="ir-paragraph-workbench__top-progress-sub">
					{#if display.queueDone !== undefined && display.queueTotal !== undefined}
						<span>{t("irParagraphWorkbench.progressTodayQueue", {
							done: display.queueDone,
							total: display.queueTotal,
						})}</span>
					{/if}
					{#if display.topicName}
						<span class="ir-paragraph-workbench__top-progress-topic">{display.topicName}</span>
					{/if}
				</div>
			{/if}
		</section>
	{/if}

	<div class="ir-paragraph-workbench__body">
		<div class="ir-paragraph-workbench__reading-column">
			<div
				class="ir-paragraph-workbench__text-viewport"
				data-content-mode={paragraphViewMode}
				data-surface-style={surfaceStyle}
				data-transition-style={transitionStyle}
			>
				{#if currentSegment}
					<div
						class="ir-paragraph-workbench__text-frame"
						class:is-editor={paragraphViewMode === "edit" && session?.sourceType !== "epub"}
					>
						<div class="ir-paragraph-workbench__segment-badge">{getSegmentNumberLabel()}</div>
						{#if paragraphViewMode === "edit" && session?.sourceType !== "epub" && session && currentSegment}
							<IRParagraphShellEditorHost
								app={plugin.app}
								active={true}
								sourcePath={session.sourcePath}
								value={currentSegment.text}
								fontScale={fontScale}
								sessionId={`ir-paragraph-workbench-${currentSegment.id}`}
							/>
						{:else if session?.sourceType === "epub" && currentSegment.html}
							<div class="ir-paragraph-workbench__text" style={`--weave-paragraph-font-scale:${fontScale / 100};`}>
								{@html currentSegment.html}
							</div>
						{:else}
							<div class="ir-paragraph-workbench__text" style={`--weave-paragraph-font-scale:${fontScale / 100};`}>
								<MarkdownRenderer plugin={plugin} source={currentSegment.text} sourcePath={session?.sourcePath || ""} />
							</div>
						{/if}
					</div>
				{:else}
					<div class="ir-paragraph-workbench__empty">{t("irParagraphWorkbench.empty")}</div>
				{/if}
			</div>
		</div>
	</div>

	<div class="ir-paragraph-workbench__footer-slot">
		<div class="ir-paragraph-workbench__ir-toolbar" aria-label={t("irParagraphWorkbench.title")}>
			<div class="ir-paragraph-workbench__ir-actions">
				<button type="button" class="clickable-icon ir-paragraph-workbench__ir-btn ir-paragraph-workbench__ir-btn--primary" onclick={() => void workbenchService?.pushNextSegment().then((next) => { session = next; })}>
					{t("irParagraphWorkbench.pushNextParagraph")}
				</button>
				<button type="button" class="clickable-icon ir-paragraph-workbench__ir-btn" disabled>
					{t("irParagraphWorkbench.excerptToCard")}
				</button>
				<button type="button" class="clickable-icon ir-paragraph-workbench__ir-btn" onclick={() => void workbenchService?.applyPostpone(t("irParagraphWorkbench.postponeSaved"), t("irParagraphWorkbench.postponeFailed"))}>
					{getPostponeButtonLabel()}
				</button>
				<button type="button" class="clickable-icon ir-paragraph-workbench__ir-btn" onclick={() => workbenchService?.archive(t("irParagraphWorkbench.archiveNotice"))}>
					{t("irParagraphWorkbench.archive")}
				</button>
			</div>
			<div class="ir-paragraph-workbench__ir-meta-actions">
				<button type="button" class="clickable-icon ir-paragraph-workbench__ir-btn ir-paragraph-workbench__ir-btn--meta" class:is-active={priorityPanelOpen} aria-expanded={priorityPanelOpen} onclick={togglePriorityPanel}>
					{t("irParagraphWorkbench.prioritySelect")}
				</button>
				<button type="button" class="clickable-icon ir-paragraph-workbench__ir-btn ir-paragraph-workbench__ir-btn--meta" class:is-active={schedulePanelOpen} aria-expanded={schedulePanelOpen} onclick={toggleSchedulePanel}>
					{t("irParagraphWorkbench.scheduleSelect")}
				</button>
			</div>
		</div>

		{#if priorityPanelOpen}
			<section class="ir-paragraph-workbench__priority-panel" aria-label={t("irParagraphWorkbench.priorityPanelTitle")}>
				<div class="ir-paragraph-workbench__panel-title">{t("irParagraphWorkbench.priorityPanelTitle")}</div>
				<div class="ir-paragraph-workbench__panel-status">
					<span class="ir-paragraph-workbench__panel-status-label">{t("irParagraphWorkbench.priorityCurrent")}</span>
					<strong>{t("irParagraphWorkbench.priorityLevelLabel", { level: priorityLevel })}</strong>
				</div>
				<div class="ir-paragraph-workbench__panel-pills" role="group" aria-label={t("irParagraphWorkbench.priorityPanelTitle")}>
					{#each PARAGRAPH_PRIORITY_LEVELS as level (level)}
						<button type="button" class="clickable-icon ir-paragraph-workbench__panel-pill" class:is-active={priorityLevel === level} aria-pressed={priorityLevel === level} onclick={() => selectPriorityLevel(level)}>
							{t("irParagraphWorkbench.priorityLevelShort", { level })}
						</button>
					{/each}
				</div>
			</section>
		{/if}

		{#if schedulePanelOpen}
			<section class="ir-paragraph-workbench__schedule-panel" aria-label={t("irParagraphWorkbench.schedulePanelTitle")}>
				<div class="ir-paragraph-workbench__panel-title">{t("irParagraphWorkbench.schedulePanelTitle")}</div>
				<div class="ir-paragraph-workbench__panel-status">
					<span class="ir-paragraph-workbench__panel-status-label">{t("irParagraphWorkbench.scheduleNextLabel")}</span>
					<strong>{getScheduleNextAppearanceLabel()}</strong>
				</div>
				<div class="ir-paragraph-workbench__panel-pills" role="group" aria-label={t("irParagraphWorkbench.scheduleIntervalLabel")}>
					{#each PARAGRAPH_SCHEDULE_INTERVAL_DAYS as days (days)}
						<button type="button" class="clickable-icon ir-paragraph-workbench__panel-pill" class:is-active={scheduleIntervalDays === days} aria-pressed={scheduleIntervalDays === days} onclick={() => selectScheduleInterval(days)}>
							{t("irParagraphWorkbench.scheduleIntervalDays", { days })}
						</button>
					{/each}
				</div>
			</section>
		{/if}
	</div>
</div>
