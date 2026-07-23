<script lang="ts">
	import { setIcon } from "obsidian";
	import {
		IR_TUTORIAL_CONTENT_BY_LANG,
		IR_TUTORIAL_DEFAULT_TAB,
		IR_TUTORIAL_TABS_BY_LANG,
		resolveIRTutorialLanguage,
		type IRTutorialTabId,
	} from "./ir-tutorial-content";
	import { currentLanguage, tr } from "../../../utils/i18n";

	interface Props {
		visible: boolean;
		onClose: () => void;
		initialTab?: IRTutorialTabId;
		showDismissOption?: boolean;
		onDismissPermanently?: () => void;
	}

	let {
		visible,
		onClose,
		initialTab,
		showDismissOption = false,
		onDismissPermanently,
	}: Props = $props();

	let t = $derived($tr);
	let tutorialLanguage = $derived(resolveIRTutorialLanguage($currentLanguage));
	let tutorialTabs = $derived(IR_TUTORIAL_TABS_BY_LANG[tutorialLanguage]);
	let tutorialContent = $derived(IR_TUTORIAL_CONTENT_BY_LANG[tutorialLanguage]);

	let activeTab = $state<IRTutorialTabId>(IR_TUTORIAL_DEFAULT_TAB);

	$effect(() => {
		if (visible) {
			activeTab = initialTab ?? IR_TUTORIAL_DEFAULT_TAB;
		}
	});

	$effect(() => {
		if (!visible) return;
		const body = activeDocument.body;
		body.addClass("weave-ir-tutorial-open");
		return () => {
			body.removeClass("weave-ir-tutorial-open");
		};
	});

	function icon(node: HTMLElement, name: string) {
		setIcon(node, name);
		return {
			update(newName: string) {
				node.replaceChildren();
				setIcon(node, newName);
			},
		};
	}

	function portalToBody(node: HTMLDivElement) {
		activeDocument.body.appendChild(node);
		return {
			destroy() {
				node.remove();
			},
		};
	}

	function switchTab(tab: IRTutorialTabId) {
		activeTab = tab;
	}

	function handleDismissPermanently() {
		onDismissPermanently?.();
	}

	function handleWindowKeydown(event: KeyboardEvent) {
		if (!visible) return;
		if (event.key === "Escape") {
			onClose();
		}
	}
</script>

<svelte:window onkeydown={handleWindowKeydown} />

{#if visible}
	<div class="weave-tutorial-portal" use:portalToBody>
		<div
			class="weave-tutorial-overlay"
			onclick={onClose}
			onkeydown={(event) => event.key === "Escape" && onClose()}
			role="button"
			tabindex="0"
			aria-label={t("irTutorial.close")}
		></div>

		<div
			class="weave-tutorial-panel"
			role="dialog"
			aria-modal="true"
			aria-labelledby="ir-tutorial-title"
		>
			<div class="weave-tutorial-header">
				<div class="weave-tutorial-title-wrap">
					<span id="ir-tutorial-title" class="weave-tutorial-title-text"
						>{t("irTutorial.title")}</span
					>
				</div>
				<button
					type="button"
					class="clickable-icon weave-tutorial-close"
					onclick={onClose}
					aria-label={t("irTutorial.close")}
				>
					<span use:icon={"x"}></span>
				</button>
			</div>

			<div class="weave-tutorial-tabs" role="tablist">
				{#each tutorialTabs as tab}
					<button
						type="button"
						class="clickable-icon"
						class:active={activeTab === tab.id}
						role="tab"
						aria-selected={activeTab === tab.id}
						onclick={() => switchTab(tab.id)}
					>
						{tab.label}
					</button>
				{/each}
			</div>

			<div class="weave-tutorial-scroll">
				<div class="weave-tutorial-body">
					{#each tutorialContent[activeTab] as section, index}
						<div class="weave-tut-section">
							<div class="weave-tut-title">
								<span class="weave-tut-title-text">{section.title}</span>
							</div>
							<div class="weave-tut-text">
								{#if section.paragraphs}
									{#each section.paragraphs as paragraph}
										<p>{paragraph}</p>
									{/each}
								{/if}

								{#if section.listGroups}
									{#each section.listGroups as group}
										{#if group.heading}
											<h4>{group.heading}</h4>
										{/if}
										<ul>
											{#each group.items as item}
												<li>{item}</li>
											{/each}
										</ul>
									{/each}
								{/if}

								{#if section.code}
									<pre>{section.code}</pre>
								{/if}

								{#if section.buttons}
									<div class="weave-tut-btn-list">
										{#each section.buttons as button}
											<div class="weave-tut-btn-item">
												<span class="weave-tut-icon" use:icon={button.icon}></span>
												<span>{button.label}: {button.description}</span>
											</div>
										{/each}
									</div>
								{/if}

								{#if section.links}
									<div class="weave-tut-link-list">
										{#each section.links as link}
											<p>
												<a href={link.url} target="_blank" rel="noopener noreferrer"
													>{link.label}</a
												>
											</p>
										{/each}
									</div>
								{/if}
							</div>
						</div>

						{#if index < tutorialContent[activeTab].length - 1}
							<div class="weave-tut-divider"></div>
						{/if}
					{/each}
				</div>
			</div>

			{#if showDismissOption}
				<div class="weave-tutorial-footer">
					<button
						type="button"
						class="clickable-icon weave-tutorial-dismiss"
						onclick={handleDismissPermanently}
					>
						{t("irTutorial.dontShowAgain")}
					</button>
				</div>
			{/if}
		</div>
	</div>
{/if}
