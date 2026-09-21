import { planTabMove, TAB_GROUP_ID_NONE } from "./tab-order.js";

const MENU_ITEM_ID = "manage-shortcuts";
const SHORTCUTS_SETTINGS_URL = "chrome://extensions/shortcuts";

const moveTab = async (offset: number): Promise<void> => {
  const tabs = await chrome.tabs.query({ currentWindow: true });
  const activeTab = tabs.find((tab) => tab.active);
  if (!activeTab || typeof activeTab.id !== "number") {
    return;
  }

  const strip = [...tabs].sort((a, b) => a.index - b.index);
  const hasGroupedTab = strip.some((tab) => tab.groupId !== TAB_GROUP_ID_NONE);
  const collapsedGroupIds = hasGroupedTab
    ? (await chrome.tabGroups.query({ windowId: activeTab.windowId, collapsed: true })).map(
        (group) => group.id
      )
    : [];

  const plan = planTabMove({
    tabs: strip.map((tab) => ({ pinned: tab.pinned, groupId: tab.groupId })),
    activeIndex: activeTab.index,
    offset,
    collapsedGroupIds,
  });

  if (plan === null) {
    return;
  }

  if (plan.kind === "exit") {
    // Leaving a group consumes the press: the tab keeps its slot, so there is no move to make.
    try {
      await chrome.tabs.ungroup(activeTab.id);
    } catch {
      // Tab or group closed between the query and the call; the next press re-reads the strip.
      // The listener is fire-and-forget, so an escaping rejection would surface as an unhandled
      // worker error.
    }
    return;
  }

  if (plan.kind === "join") {
    try {
      await chrome.tabs.group({ groupId: plan.groupId, tabIds: activeTab.id });
    } catch {
      // Group closed between the query and the call, or the strip is mid-drag; the next press
      // re-reads the strip.
      return;
    }
  }

  // A no-op when Chrome keeps the tab at the group's near edge; restores the slot when Chrome
  // appends it to the group's far end.
  await chrome.tabs.move(activeTab.id, { index: plan.index });
};

const togglePinTab = async (): Promise<void> => {
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!activeTab || typeof activeTab.id !== "number") {
    return;
  }

  await chrome.tabs.update(activeTab.id, {
    pinned: !activeTab.pinned,
  });
};

const closeOtherTabs = async (): Promise<void> => {
  const tabs = await chrome.tabs.query({
    currentWindow: true,
    pinned: false,
    active: false,
  });

  const tabIds: number[] = [];
  for (const tab of tabs) {
    if (typeof tab.id === "number") {
      tabIds.push(tab.id);
    }
  }

  if (tabIds.length > 0) {
    await chrome.tabs.remove(tabIds);
  }
};

const handleCommand = async (command: string): Promise<void> => {
  switch (command) {
    case "move-left":
      await moveTab(-1);
      break;
    case "move-right":
      await moveTab(1);
      break;
    case "pin-tab":
      await togglePinTab();
      break;
    case "close-other-tabs":
      await closeOtherTabs();
      break;
  }
};

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: MENU_ITEM_ID,
    title: "Manage keyboard shortcuts",
    contexts: ["action"],
  });
});

chrome.commands.onCommand.addListener((command) => {
  void handleCommand(command);
});

chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId === MENU_ITEM_ID) {
    void chrome.tabs.create({ url: SHORTCUTS_SETTINGS_URL });
  }
});

