import assert from "node:assert/strict";

const tabOrderUrl = new URL("../dist/js/tab-order.js", import.meta.url);
const { nextTabIndex } = await import(tabOrderUrl.href);

const runTestCase = (label, input, expected) => {
  const actual = nextTabIndex(input);
  assert.strictEqual(
    actual,
    expected,
    `Expected ${label} to return ${expected}, got ${actual}`
  );
  console.log(`PASS: ${label}`);
};

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

console.log("All tab-order smoke tests passed successfully.");
