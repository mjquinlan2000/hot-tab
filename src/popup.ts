const SHORTCUTS_SETTINGS_URL = "chrome://extensions/shortcuts";

export const COMMAND_ORDER = [
  "move-left",
  "move-right",
  "pin-tab",
  "close-other-tabs",
] as const;

const MAC_MODIFIER_PATTERN = /^([⌃⌥⇧⌘]+)(.*)$/u;

export const splitShortcut = (shortcut: string): string[] => {
  const result: string[] = [];
  const parts = shortcut.split("+");

  for (const rawPart of parts) {
    const part = rawPart.trim();
    if (part.length === 0) {
      continue;
    }

    const match = part.match(MAC_MODIFIER_PATTERN);
    if (match && match[1]) {
      const modifiers = Array.from(match[1]);
      result.push(...modifiers);
      const remainder = (match[2] ?? "").trim();
      if (remainder.length > 0) {
        result.push(remainder);
      }
    } else {
      result.push(part);
    }
  }

  return result;
};

const getCommandOrderIndex = (name: string | undefined): number => {
  if (name === undefined) {
    return COMMAND_ORDER.length;
  }
  const index = COMMAND_ORDER.findIndex((commandName) => commandName === name);
  return index === -1 ? COMMAND_ORDER.length : index;
};

const renderShortcuts = async (): Promise<void> => {
  const shortcutList = document.getElementById("shortcut-list");
  const shortcutRowTemplate = document.getElementById("shortcut-row");
  const shortcutEmpty = document.getElementById("shortcut-empty");
  const manageShortcutsButton = document.getElementById("manage-shortcuts");

  if (manageShortcutsButton instanceof HTMLButtonElement) {
    manageShortcutsButton.addEventListener("click", () => {
      void chrome.tabs.create({ url: SHORTCUTS_SETTINGS_URL });
      window.close();
    });
  }

  if (
    !(shortcutList instanceof HTMLUListElement) ||
    !(shortcutRowTemplate instanceof HTMLTemplateElement)
  ) {
    return;
  }

  const commands = await chrome.commands.getAll();
  const describableCommands = commands.filter((command) => {
    return typeof command.description === "string" && command.description.trim().length > 0;
  });

  describableCommands.sort((a, b) => {
    const indexA = getCommandOrderIndex(a.name);
    const indexB = getCommandOrderIndex(b.name);
    return indexA - indexB;
  });

  if (describableCommands.length === 0) {
    if (shortcutEmpty instanceof HTMLElement) {
      shortcutEmpty.hidden = false;
    }
    return;
  }

  const fragment = document.createDocumentFragment();

  for (const command of describableCommands) {
    const rowInstance = shortcutRowTemplate.content.cloneNode(true);
    if (!(rowInstance instanceof DocumentFragment)) {
      continue;
    }

    const row = rowInstance.querySelector(".shortcut");
    const label = rowInstance.querySelector(".shortcut__label");
    const keys = rowInstance.querySelector(".shortcut__keys");

    if (
      !(row instanceof HTMLLIElement) ||
      !(label instanceof HTMLElement) ||
      !(keys instanceof HTMLElement)
    ) {
      continue;
    }

    label.textContent = command.description ?? "";

    const shortcutText = command.shortcut?.trim() ?? "";
    const keyParts = splitShortcut(shortcutText);
    if (keyParts.length === 0) {
      const unsetSpan = document.createElement("span");
      unsetSpan.className = "shortcut__unset";
      unsetSpan.textContent = "Not set";
      keys.appendChild(unsetSpan);
    } else {
      for (const part of keyParts) {
        const kbd = document.createElement("kbd");
        kbd.textContent = part;
        keys.appendChild(kbd);
      }
    }

    fragment.appendChild(rowInstance);
  }

  shortcutList.replaceChildren(fragment);
};

document.addEventListener("DOMContentLoaded", () => {
  void renderShortcuts();
});
