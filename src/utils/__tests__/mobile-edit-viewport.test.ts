import { calculateMobileEditViewportHeight, MIN_MOBILE_EDIT_VIEWPORT_HEIGHT } from '../mobile-edit-viewport';

describe('calculateMobileEditViewportHeight', () => {
  it('减去编辑层顶部偏移，保持初始内容位于 Obsidian 顶部栏下方', () => {
    expect(
      calculateMobileEditViewportHeight({
        viewportHeight: 700,
        viewportOffsetTop: 0,
        overlayTop: 48
      })
    ).toBe(652);
  });

  it('键盘弹出后继续基于可见视口底部计算高度', () => {
    expect(
      calculateMobileEditViewportHeight({
        viewportHeight: 420,
        viewportOffsetTop: 0,
        overlayTop: 48
      })
    ).toBe(372);
  });

  it('不会把位于可见区之上的 overlayTop 再次重复扣减', () => {
    expect(
      calculateMobileEditViewportHeight({
        viewportHeight: 420,
        viewportOffsetTop: 24,
        overlayTop: 8
      })
    ).toBe(420);
  });

  it('在异常情况下仍保留最小可编辑高度', () => {
    expect(
      calculateMobileEditViewportHeight({
        viewportHeight: 120,
        viewportOffsetTop: 0,
        overlayTop: 160
      })
    ).toBe(MIN_MOBILE_EDIT_VIEWPORT_HEIGHT);
  });
});
