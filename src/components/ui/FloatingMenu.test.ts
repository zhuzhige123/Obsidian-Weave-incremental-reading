import { fireEvent, render, waitFor } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';

const floatingUiMocks = vi.hoisted(() => ({
  computePosition: vi.fn(),
  autoUpdate: vi.fn()
}));

vi.mock('@floating-ui/dom', () => ({
  computePosition: floatingUiMocks.computePosition,
  autoUpdate: floatingUiMocks.autoUpdate,
  flip: vi.fn(() => ({ name: 'flip' })),
  shift: vi.fn(() => ({ name: 'shift' })),
  offset: vi.fn(() => ({ name: 'offset' }))
}));

import FloatingMenu from './FloatingMenu.svelte';

function createTextSnippet(text: string) {
  return createRawSnippet(() => ({
    render: () => `<span>${text}</span>`,
    setup: () => {}
  }));
}

describe('FloatingMenu', () => {
  let anchor: HTMLButtonElement;

  beforeEach(() => {
    anchor = document.createElement('button');
    anchor.textContent = 'anchor';
    document.body.appendChild(anchor);

    floatingUiMocks.computePosition.mockResolvedValue({ x: 120, y: 80 });
    floatingUiMocks.autoUpdate.mockImplementation((_anchor, _menu, update) => {
      void update();
      return vi.fn();
    });
  });

  afterEach(() => {
    anchor.remove();
    document.body.querySelectorAll('.floating-menu').forEach((element) => element.remove());
    vi.clearAllMocks();
  });

  it('portals the menu to body and applies the computed position', async () => {
    render(FloatingMenu, {
      props: {
        show: true,
        anchor,
        children: createTextSnippet('Hint content')
      }
    });

    await waitFor(() => {
      const menu = document.body.querySelector('.floating-menu') as HTMLElement | null;
      expect(menu).toBeInTheDocument();
      expect(menu?.parentElement).toBe(document.body);
    });

    const menu = document.body.querySelector('.floating-menu') as HTMLElement;
    await waitFor(() => {
      expect(menu.style.left).toBe('120px');
      expect(menu.style.top).toBe('80px');
    });

    expect(floatingUiMocks.autoUpdate).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when clicking outside the menu and anchor', async () => {
    const onClose = vi.fn();

    render(FloatingMenu, {
      props: {
        show: true,
        anchor,
        onClose,
        children: createTextSnippet('Hint content')
      }
    });

    await waitFor(() => {
      expect(document.body.querySelector('.floating-menu')).toBeInTheDocument();
    });

    await fireEvent.mouseDown(document.body);

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
