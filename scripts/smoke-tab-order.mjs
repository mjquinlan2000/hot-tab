import assert from "node:assert/strict";

const tabOrderUrl = new URL("../dist/js/tab-order.js", import.meta.url);
const { nextTabIndex, planTabMove } = await import(tabOrderUrl.href);

const runTestCase = (label, input, expected) => {
  const actual = nextTabIndex(input);
  assert.strictEqual(
    actual,
    expected,
    `Expected ${label} to return ${expected}, got ${actual}`
  );
  console.log(`PASS: ${label}`);
};

const runPlanCase = (label, input, expected) => {
  const actual = planTabMove(input);
  assert.deepStrictEqual(
    actual,
    expected,
    `Expected ${label} to return ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
  );
  console.log(`PASS: ${label}`);
};

const u = { pinned: false, groupId: -1 };
const p = { pinned: true, groupId: -1 };
const g = (id) => ({ pinned: false, groupId: id });

// 1. Regression test: unpinned tab at index 2 moving left wraps to 4
runTestCase(
  "regression: unpinned tab at index 2 moving left wraps to 4 (tabCount: 5, pinnedCount: 2)",
  { index: 2, pinned: false, tabCount: 5, pinnedCount: 2, offset: -1 },
  4
);

// 2. unpinned tab at index 4 moving right wraps to 2
runTestCase(
  "unpinned tab at index 4 moving right wraps to 2 (tabCount: 5, pinnedCount: 2)",
  { index: 4, pinned: false, tabCount: 5, pinnedCount: 2, offset: 1 },
  2
);

// 3. unpinned tab at index 2 moving right is 3
runTestCase(
  "unpinned tab at index 2 moving right is 3 (tabCount: 5, pinnedCount: 2)",
  { index: 2, pinned: false, tabCount: 5, pinnedCount: 2, offset: 1 },
  3
);

// 4. unpinned tab at index 3 moving left is 2
runTestCase(
  "unpinned tab at index 3 moving left is 2 (tabCount: 5, pinnedCount: 2)",
  { index: 3, pinned: false, tabCount: 5, pinnedCount: 2, offset: -1 },
  2
);

// 5. pinned tab at index 0 moving left wraps to 1
runTestCase(
  "pinned tab at index 0 moving left wraps to 1 (tabCount: 5, pinnedCount: 2)",
  { index: 0, pinned: true, tabCount: 5, pinnedCount: 2, offset: -1 },
  1
);

// 6. pinned tab at index 1 moving right wraps to 0
runTestCase(
  "pinned tab at index 1 moving right wraps to 0 (tabCount: 5, pinnedCount: 2)",
  { index: 1, pinned: true, tabCount: 5, pinnedCount: 2, offset: 1 },
  0
);

// 7. a lone pinned tab (tabCount: 3, pinnedCount: 1, index: 0, pinned) returns null in both directions
runTestCase(
  "lone pinned tab moving left returns null (tabCount: 3, pinnedCount: 1)",
  { index: 0, pinned: true, tabCount: 3, pinnedCount: 1, offset: -1 },
  null
);
runTestCase(
  "lone pinned tab moving right returns null (tabCount: 3, pinnedCount: 1)",
  { index: 0, pinned: true, tabCount: 3, pinnedCount: 1, offset: 1 },
  null
);

// 8. a single-tab window (tabCount: 1, pinnedCount: 0, index: 0) returns null
runTestCase(
  "single-tab window moving left returns null (tabCount: 1, pinnedCount: 0)",
  { index: 0, pinned: false, tabCount: 1, pinnedCount: 0, offset: -1 },
  null
);
runTestCase(
  "single-tab window moving right returns null (tabCount: 1, pinnedCount: 0)",
  { index: 0, pinned: false, tabCount: 1, pinnedCount: 0, offset: 1 },
  null
);

// 9. all tabs pinned (tabCount: 3, pinnedCount: 3), index 2 moving right wraps to 0
runTestCase(
  "all tabs pinned, index 2 moving right wraps to 0 (tabCount: 3, pinnedCount: 3)",
  { index: 2, pinned: true, tabCount: 3, pinnedCount: 3, offset: 1 },
  0
);

// 10. malformed input (pinnedCount: 9, tabCount: 3) returns null rather than throwing
runTestCase(
  "malformed input (pinnedCount: 9, tabCount: 3) returns null",
  { index: 0, pinned: false, tabCount: 3, pinnedCount: 9, offset: 1 },
  null
);

// 11. Regression: moving toward a 2+ tab group joins it in place instead of skipping its outer tab
runPlanCase(
  "regression: tab left of a 2-tab group joins the group without moving",
  { tabs: [u, g(7), g(7)], activeIndex: 0, offset: 1, collapsedGroupIds: [] },
  { kind: "join", groupId: 7, index: 0 }
);

// 12. Regression: moving toward a single-tab group joins it instead of jumping past it
runPlanCase(
  "regression: tab left of a single-tab group joins the group without moving",
  { tabs: [u, g(7)], activeIndex: 0, offset: 1, collapsedGroupIds: [] },
  { kind: "join", groupId: 7, index: 0 }
);

// 13. Leftward join
runPlanCase(
  "tab right of a group moving left joins the group without moving",
  { tabs: [g(7), g(7), u], activeIndex: 2, offset: -1, collapsedGroupIds: [] },
  { kind: "join", groupId: 7, index: 2 }
);

// 14. Once inside a group, presses walk through it one tab at a time
runPlanCase(
  "tab at a group's first slot steps to the group's second slot",
  { tabs: [u, g(7), g(7), u], activeIndex: 1, offset: 1, collapsedGroupIds: [] },
  { kind: "move", index: 2 }
);

// 15. Leaving a group consumes the press: the tab keeps its slot and is only ungrouped
runPlanCase(
  "tab at a group's last slot leaves the group in place",
  { tabs: [u, g(7), g(7), u], activeIndex: 2, offset: 1, collapsedGroupIds: [] },
  { kind: "exit" }
);
runPlanCase(
  "tab at a group's first slot leaves the group in place moving left",
  { tabs: [u, g(7), g(7), u], activeIndex: 1, offset: -1, collapsedGroupIds: [] },
  { kind: "exit" }
);
runPlanCase(
  "grouped tab wrapping across the band leaves the group instead of wrapping",
  { tabs: [u, g(7), g(7)], activeIndex: 2, offset: 1, collapsedGroupIds: [] },
  { kind: "exit" }
);
runPlanCase(
  "grouped tab facing a collapsed group leaves its own group first",
  { tabs: [g(7), g(9), g(9)], activeIndex: 0, offset: 1, collapsedGroupIds: [9] },
  { kind: "exit" }
);

// 16. Group-to-group: the first press leaves the old group, a later press joins the new one
runPlanCase(
  "tab at a group's edge facing another group leaves its own group first",
  { tabs: [g(7), g(7), g(8), g(8)], activeIndex: 1, offset: 1, collapsedGroupIds: [] },
  { kind: "exit" }
);
runPlanCase(
  "ungrouped tab between two groups joins the one it moves toward",
  { tabs: [g(7), u, g(8), g(8)], activeIndex: 1, offset: 1, collapsedGroupIds: [] },
  { kind: "join", groupId: 8, index: 1 }
);

// 17. A collapsed group is stepped over whole in a single press
runPlanCase(
  "collapsed group is stepped over rightward in one press",
  { tabs: [u, g(7), g(7), g(7), u], activeIndex: 0, offset: 1, collapsedGroupIds: [7] },
  { kind: "move", index: 3 }
);
runPlanCase(
  "collapsed group is stepped over leftward in one press",
  { tabs: [g(7), g(7), u], activeIndex: 2, offset: -1, collapsedGroupIds: [7] },
  { kind: "move", index: 0 }
);
runPlanCase(
  "collapsed group run ending at the strip edge lands on the last group tab",
  { tabs: [u, g(7), g(7)], activeIndex: 0, offset: 1, collapsedGroupIds: [7] },
  { kind: "move", index: 2 }
);

// 18. Wrapping to the far band edge never joins a group
runPlanCase(
  "wrap-around destination never joins a group",
  { tabs: [g(7), g(7), u], activeIndex: 2, offset: 1, collapsedGroupIds: [] },
  { kind: "move", index: 0 }
);

// 19. The pinned band wraps within itself and ignores groups entirely
runPlanCase(
  "pinned tab wraps within the pinned band and ignores groups",
  { tabs: [p, p, g(7), g(7)], activeIndex: 1, offset: 1, collapsedGroupIds: [] },
  { kind: "move", index: 0 }
);

// 20. A single-tab band cannot move
runPlanCase(
  "lone unpinned tab beside a pinned tab returns null",
  { tabs: [p, u], activeIndex: 1, offset: -1, collapsedGroupIds: [] },
  null
);

console.log("All tab-order smoke tests passed successfully.");
