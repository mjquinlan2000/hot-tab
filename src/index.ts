import webex from 'webextension-polyfill'

const moveTab = async (offset: number) => {
  const tabs = await webex.tabs.query({ currentWindow: true })
  const activeTab = tabs.filter(function (tab) {
    return tab.active;
  })[0];

  const pinnedTabs = tabs.filter(function (tab) {
    return tab.pinned;
  });

  let newIndex = activeTab.index + offset;

  if (activeTab.pinned) {
    if (newIndex >= pinnedTabs.length) {
      newIndex = 0;
    } else if (newIndex < 0) {
      newIndex = pinnedTabs.length - 1;
    }
  } else {
    if (newIndex >= tabs.length) {
      newIndex = pinnedTabs.length;
    } else if (newIndex < pinnedTabs.length) {
      newIndex = tabs.length - 1;
    }
  }

  typeof activeTab.id === "number" ? await webex.tabs.move(activeTab.id, { index: newIndex }) : null;
};

const togglePinTab = async () => {
  const tabs = await webex.tabs.query({ active: true })
  const activeTab = tabs[0];

  const properties = {
    pinned: !activeTab.pinned
  };

  await webex.tabs.update(activeTab.id, properties);
};

const closeOtherTabs = async () => {
  const tabs = await webex.tabs.query({ currentWindow: true, pinned: false, active: false })
  const outer: number[] = []
  
  var tabIds: number[] = tabs.reduce((acc, tab) => {
    if (typeof tab.id === "number") {
      return [tab.id, ...acc]
    } else {
      return acc
    }
  }, outer)

  webex.tabs.remove(tabIds);
};

const commandListener = async (command: string) => {
  console.log("command", command)
  switch (command) {
    case "move-left":
      await moveTab(-1)
      break;
    case "move-right":
      await moveTab(1)
      break
    case "pin-tab":
      await togglePinTab()
      break
    case "close-other-tabs":
      await closeOtherTabs()
      break
  }
}

webex.commands.onCommand.addListener(commandListener)

webex.contextMenus.create({
  id: "manage-shortcuts",
  title: "Manage Keyboard Shortcuts",
  contexts: ["browser_action"]
});
