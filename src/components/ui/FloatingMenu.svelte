<!--
  FloatingMenu - 通用浮动菜单组件
  
  功能：
  - 使用 Floating UI 智能定位
  - Portal 到 body，避免被父容器截断
  - 自动边界检测和位置调整
  - 支持自定义样式和动画
-->
<script lang="ts">
  import { logger } from '../../utils/logger';

  import { onMount, onDestroy, tick } from 'svelte';
  import { autoUpdate, computePosition, flip, shift, offset, type Placement } from '@floating-ui/dom';

  interface Props {
    /** 是否显示菜单 */
    show: boolean;
    /** 锚点元素（按钮） */
    anchor: HTMLElement | null;
    /** 首选位置 */
    placement?: Placement;
    /** 与锚点的间距 */
    offset?: number;
    /** 关闭回调 */
    onClose?: () => void;
    /** 可访问性角色 */
    role?: string;
    /** 关联标题元素 */
    ariaLabelledby?: string;
    /** 自定义class */
    class?: string;
    /** 是否 portal 到 body；交互型菜单在部分宿主下可关闭以避免事件丢失 */
    portal?: boolean;
    /** 子内容 */
    children?: any;
  }

  let {
    show = $bindable(),
    anchor,
    placement = 'right-start',
    offset: offsetValue = 8,
    onClose,
    role = 'menu',
    ariaLabelledby,
    class: customClass = '',
    portal = true,
    children
  }: Props = $props();

  // 菜单元素引用
  let menuElement: HTMLElement | null = $state(null);

  // 计算后的位置
  let position = $state({ top: 0, left: 0 });
  let cleanupAutoUpdate: (() => void) | null = null;
  let positionRunId = 0;

  /**
   * Svelte action：将菜单 portal 到 body，并在销毁时回收节点。
   * 禁止在 $effect 中手动 appendChild——那会与 Svelte 5 reconcile 冲突，导致可见菜单丢失事件绑定。
   */
  function portalToBody(node: HTMLElement, enabled: boolean = true) {
    if (!enabled || typeof activeDocument === 'undefined' || !activeDocument.body) {
      return {};
    }

    activeDocument.body.appendChild(node);

    return {
      destroy() {
        if (node.isConnected) {
          node.remove();
        }
      }
    };
  }

  /**
   * 更新菜单位置
   */
  async function updatePosition() {
    if (!show || !anchor || !menuElement) return;

    try {
      const { x, y } = await computePosition(anchor, menuElement, {
        placement,
        middleware: [
          offset(offsetValue),
          flip({
            fallbackPlacements: ['left-start', 'bottom-start', 'top-start', 'right-end', 'left-end']
          }),
          shift({
            padding: 8
          })
        ]
      });

      position = {
        top: y,
        left: x
      };
    } catch (error) {
      logger.error('[FloatingMenu] 定位计算失败:', error);
    }
  }

  function stopAutoPositioning() {
    if (!cleanupAutoUpdate) return;
    cleanupAutoUpdate();
    cleanupAutoUpdate = null;
  }

  async function setupPositioning(runId: number) {
    await tick();

    if (runId !== positionRunId || !show || !anchor || !menuElement) return;

    await updatePosition();

    window.requestAnimationFrame(() => {
      if (runId !== positionRunId) return;
      void updatePosition();
    });

    stopAutoPositioning();
    cleanupAutoUpdate = autoUpdate(anchor, menuElement, () => {
      void updatePosition();
    });
  }

  /**
   * 判断事件是否发生在菜单或锚点内部。
   * 使用 composedPath，避免 portal 到 body 后 contains 偶发失效。
   */
  function isEventInsideMenuOrAnchor(event: Event): boolean {
    if (!menuElement) return false;

    const path = typeof event.composedPath === 'function'
      ? event.composedPath() as EventTarget[]
      : [];
    if (path.length > 0) {
      return path.includes(menuElement) || (anchor != null && path.includes(anchor));
    }

    const target = event.target as Node | null;
    if (!target) return false;
    return menuElement.contains(target) || Boolean(anchor?.contains(target));
  }

  /**
   * 处理点击外部关闭。
   * 必须使用 click 而非 mousedown/pointerdown：否则会在菜单项激活前销毁菜单。
   * 排除 Obsidian 原生 Menu（ObsidianDropdown 使用），其 DOM 渲染在 body 下而非 FloatingMenu 内部。
   */
  function handleClickOutside(event: MouseEvent) {
    if (!show || !menuElement) return;

    if (isEventInsideMenuOrAnchor(event)) {
      return;
    }

    const target = event.target;
    if (target instanceof Element && target.closest('.menu')) {
      return;
    }

    onClose?.();
  }

  function handleKeydown(_event: KeyboardEvent) {
  }

  $effect(() => {
    const isVisible = show;
    const anchorElement = anchor;
    const currentMenuElement = menuElement;
    positionRunId += 1;
    const runId = positionRunId;

    stopAutoPositioning();

    if (!isVisible || !anchorElement || !currentMenuElement) {
      return;
    }

    void setupPositioning(runId);

    return () => {
      if (positionRunId === runId) {
        stopAutoPositioning();
      }
    };
  });

  onMount(() => {
    activeDocument.addEventListener('click', handleClickOutside);
    activeDocument.addEventListener('keydown', handleKeydown);
  });

  onDestroy(() => {
    activeDocument.removeEventListener('click', handleClickOutside);
    activeDocument.removeEventListener('keydown', handleKeydown);
    stopAutoPositioning();
  });
</script>

{#if show}
  <div
    bind:this={menuElement}
    use:portalToBody={portal}
    class="floating-menu weave-floating-menu {customClass}"
    style="top: {position.top}px; left: {position.left}px;"
    role={role}
    aria-hidden={!show}
    aria-labelledby={ariaLabelledby}
  >
    {@render children?.()}
  </div>
{/if}

<style>
  .floating-menu {
    position: fixed;
    background: var(--background-primary);
    border: 1px solid color-mix(in srgb, var(--background-modifier-border) 60%, transparent);
    border-radius: 12px;
    overflow: visible;
    box-shadow: 
      0 8px 24px rgba(0, 0, 0, 0.12),
      0 2px 8px rgba(0, 0, 0, 0.08);
    z-index: var(--weave-z-menu, 1200);
    min-width: 180px;
    max-width: 400px;
    width: max-content;
    backdrop-filter: blur(8px);
    pointer-events: auto;
    
    animation: slideInFade 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    transform-origin: top left;
  }

  @keyframes slideInFade {
    from {
      opacity: 0;
      transform: scale(0.92) translateY(-12px);
    }
    to {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }

  :global(body > .floating-menu.weave-floating-menu) {
    position: fixed !important;
    pointer-events: auto;
  }
</style>
