export const MIN_MOBILE_EDIT_VIEWPORT_HEIGHT = 200;

interface MobileEditViewportHeightOptions {
  viewportHeight: number;
  viewportOffsetTop?: number;
  overlayTop?: number | null;
  minHeight?: number;
}

export function calculateMobileEditViewportHeight({
  viewportHeight,
  viewportOffsetTop = 0,
  overlayTop,
  minHeight = MIN_MOBILE_EDIT_VIEWPORT_HEIGHT
}: MobileEditViewportHeightOptions): number {
  const visibleTop = viewportOffsetTop;
  const visibleBottom = viewportOffsetTop + viewportHeight;
  const contentTop = Math.max(overlayTop ?? visibleTop, visibleTop);

  return Math.max(minHeight, Math.floor(visibleBottom - contentTop));
}
