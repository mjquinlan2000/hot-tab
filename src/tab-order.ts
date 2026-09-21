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

/** Mirrors `chrome.tabGroups.TAB_GROUP_ID_NONE`; redeclared so this module stays runnable in Node. */
export const TAB_GROUP_ID_NONE = -1;

export interface TabStripEntry {
  readonly pinned: boolean;
  readonly groupId: number;
}

/**
 * `move`: call `chrome.tabs.move` to `index`.
 * `join`: call `chrome.tabs.group` for `groupId`, then `chrome.tabs.move` back to `index`
 * (the tab's current index) because Chrome may relocate a newly grouped tab to the group's far edge.
 * `exit`: call `chrome.tabs.ungroup` and nothing else. It carries no index on purpose: the tab
 * leaves the group in place, so any follow-up move would be the swap this rule exists to avoid.
 */
export type TabMovePlan =
  | { readonly kind: "move"; readonly index: number }
  | { readonly kind: "join"; readonly groupId: number; readonly index: number }
  | { readonly kind: "exit" };

/**
 * Resolves one move-hotkey press into a concrete tab-strip operation.
 *
 * Moving toward an adjacent expanded group joins that group in place; subsequent presses walk
 * through it positionally. Pressing outward from a group's edge tab leaves the group in place
 * rather than swapping with the tab outside it. A collapsed group is one visual chip, so it is
 * stepped over whole in a single press. Wrap-around and multi-step offsets stay purely positional.
 */
export const planTabMove = (input: {
  readonly tabs: readonly TabStripEntry[];
  readonly activeIndex: number;
  readonly offset: number;
  readonly collapsedGroupIds: readonly number[];
}): TabMovePlan | null => {
  const { tabs, activeIndex, offset, collapsedGroupIds } = input;

  if (!Number.isInteger(activeIndex) || activeIndex < 0 || activeIndex >= tabs.length) {
    return null;
  }

  const active = tabs[activeIndex];

  // The pinned prefix run, not a count of pinned tabs: a malformed strip cannot forge a band.
  let pinnedCount = 0;
  while (pinnedCount < tabs.length && tabs[pinnedCount].pinned) {
    pinnedCount += 1;
  }

  const destination = nextTabIndex({
    index: activeIndex,
    pinned: active.pinned,
    tabCount: tabs.length,
    pinnedCount,
    offset,
  });
  if (destination === null) {
    return null;
  }

  const step = Math.sign(offset);
  const isSingleStep = Math.abs(offset) === 1;
  const isAdjacent = destination === activeIndex + step;

  // At a group's edge, one press leaves the group and keeps the slot instead of swapping with the
  // tab beyond the group. A band wrap also leaves the group's span, so it exits first too.
  if (
    isSingleStep &&
    active.groupId !== TAB_GROUP_ID_NONE &&
    (!isAdjacent || tabs[destination].groupId !== active.groupId)
  ) {
    return { kind: "exit" };
  }

  // Wrap destinations and multi-step offsets stay purely positional.
  if (!isSingleStep || !isAdjacent) {
    return { kind: "move", index: destination };
  }

  const neighbor = tabs[destination];
  if (neighbor.groupId === TAB_GROUP_ID_NONE || neighbor.groupId === active.groupId) {
    return { kind: "move", index: destination };
  }

  if (collapsedGroupIds.includes(neighbor.groupId)) {
    // Pinned tabs are always ungrouped, so this run terminates inside the unpinned band.
    let edge = destination;
    while (
      edge + step >= 0 &&
      edge + step < tabs.length &&
      tabs[edge + step].groupId === neighbor.groupId
    ) {
      edge += step;
    }
    return { kind: "move", index: edge };
  }

  return { kind: "join", groupId: neighbor.groupId, index: activeIndex };
};
