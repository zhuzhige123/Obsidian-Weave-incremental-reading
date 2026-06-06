import { fireEvent, render, waitFor } from '@testing-library/svelte';
import { t } from '../../utils/i18n';
import IRCalendarSearchInput from './IRCalendarSearchInput.svelte';

const floatingUiMocks = vi.hoisted(() => ({
  computePosition: vi.fn(),
  autoUpdate: vi.fn(),
}));

vi.mock('@floating-ui/dom', () => ({
  computePosition: floatingUiMocks.computePosition,
  autoUpdate: floatingUiMocks.autoUpdate,
  flip: vi.fn(() => ({ name: 'flip' })),
  shift: vi.fn(() => ({ name: 'shift' })),
  offset: vi.fn(() => ({ name: 'offset' })),
}));

vi.mock('../../utils/vault-local-storage', () => ({
  vaultStorage: {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
  },
}));

describe('IRCalendarSearchInput', () => {
  beforeEach(() => {
    floatingUiMocks.computePosition.mockResolvedValue({ x: 120, y: 80 });
    floatingUiMocks.autoUpdate.mockImplementation((_anchor, _menu, update) => {
      void update();
      return vi.fn();
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    document.body.querySelectorAll('.floating-menu').forEach((element) => element.remove());
  });

  it('resolves management.cardSearch labels from the translation catalog', () => {
    expect(t('management.cardSearch.searchOptions')).toBe('搜索选项');
    expect(t('management.cardSearch.options.deck')).toBe('deck: 匹配专题');
  });

  it('portals the search panel to body so sidebar overflow cannot clip it', async () => {
    const { container } = render(IRCalendarSearchInput, {
      props: {
        app: {} as any,
        dataSource: 'incremental-reading',
      },
    });

    const input = container.querySelector('input') as HTMLInputElement;
    await fireEvent.focus(input);

    await waitFor(() => {
      const floatingMenu = document.body.querySelector('.floating-menu.card-search-floating-menu');
      expect(floatingMenu).toBeInTheDocument();
      expect(floatingMenu?.parentElement).toBe(document.body);
      expect(floatingMenu?.querySelector('.weave-card-search-dropdown-panel')).toBeInTheDocument();
    });

    expect(container.querySelector('.weave-card-search-dropdown-panel')).not.toBeInTheDocument();
  });
});
