/**
 * Computes the wrapped destination tab index within a window.
 *
 * Banding invariant:
 * - Pinned tabs occupy the leading index block `[0, pinnedCount)`.
 * - Unpinned tabs occupy the trailing index block `[pinnedCount, tabCount)`.
 *
 * Tab wrapping occurs strictly within the active tab's band. Returns null
 * if the band has fewer than 2 tabs, the target destination equals the
 * current index, or input values violate the banding invariants.
 */
export const nextTabIndex = (input: {
  readonly index: number;
  readonly pinned: boolean;
  readonly tabCount: number;
  readonly pinnedCount: number;
  readonly offset: number;
}): number | null => {
  const { index, pinned, tabCount, pinnedCount, offset } = input;

  // Defensive validation against malformed or inconsistent inputs
  if (
    !Number.isInteger(index) ||
    !Number.isInteger(tabCount) ||
    !Number.isInteger(pinnedCount) ||
    !Number.isInteger(offset) ||
    pinnedCount < 0 ||
    tabCount < 0 ||
    pinnedCount > tabCount
  ) {
    return null;
  }

  const bandStart = pinned ? 0 : pinnedCount;
  const bandEnd = pinned ? pinnedCount : tabCount;
  const bandWidth = bandEnd - bandStart;

  // Band must contain at least 2 tabs to move, and index must lie within its band
  if (bandWidth < 2 || index < bandStart || index >= bandEnd) {
    return null;
  }

  const relativeIndex = index - bandStart;
  const destinationOffset = ((relativeIndex + offset) % bandWidth + bandWidth) % bandWidth;
  const destinationIndex = bandStart + destinationOffset;

  if (destinationIndex === index) {
    return null;
  }

  return destinationIndex;
};
