# Chrome Web Store listing

Source of truth for everything typed into the [Developer Dashboard](https://chrome.google.com/webstore/devconsole/).
The Chrome Web Store API v2 exposes only `media.upload`, `publishers.items.publish`, `fetchStatus`,
`fetchReviews`, `cancelSubmission`, and `setPublishedDeployPercentage` — there is no endpoint for listing
copy, category, or graphic assets, so these fields are pasted by hand while CI ships the package.

Item ID: `odmmgahbfhdcpnjccnlcnecoidkhemmg`

## Store listing

- **Item title**: `Hot Tab`
- **Summary** (≤132 chars, identical to `public/manifest.json` `description`): `Keyboard shortcuts for moving, pinning, and closing Chrome tabs`
- **Primary category**: `Functionality & UI` (the item currently sits in Accessibility; if the dashboard does not offer this label, leave the category untouched)
- **Language**: `English`
- **Homepage / Official URL**: `https://github.com/mjquinlan2000/hot-tab`
- **Support URL**: `https://github.com/mjquinlan2000/hot-tab/issues`

### Detailed description

```text
Hot Tab adds the tab-management keyboard shortcuts Chrome never shipped.

Move the active tab left or right, pin or unpin it, or close every other tab in
the window without reaching for the mouse. Moving wraps within a band, so a
pinned tab stays among the pinned tabs and an unpinned tab stays among the
unpinned ones.

Default shortcuts
- Move tab left: Ctrl+Shift+Left (macOS: Control+Shift+Left)
- Move tab right: Ctrl+Shift+Right (macOS: Control+Shift+Right)
- Toggle pin on current tab: Ctrl+Shift+Down (macOS: Control+Shift+Down)
- Close other tabs: Ctrl+Shift+K (macOS: Control+Shift+K)

Every binding is yours to change at chrome://extensions/shortcuts. Click the
toolbar icon to see the shortcuts that are actually active right now, including
ones you have rebound, and to jump straight to those settings.

Built on Manifest V3: no remote code, no analytics, no network requests, and no
data collection of any kind. Hot Tab requests one permission, contextMenus, for
the right-click entry on its own toolbar icon.

Open source (MIT): https://github.com/mjquinlan2000/hot-tab
```

## Privacy practices

### Single purpose

```text
Hot Tab provides keyboard shortcuts for managing tabs in the current window:
move the active tab left or right within its pinned or unpinned band, toggle the
active tab's pinned state, and close the window's other unpinned tabs.
```

### Permission justification — `contextMenus`

```text
The extension registers exactly one context menu item, "Manage keyboard
shortcuts", scoped to its own toolbar action (contexts: ["action"]). Clicking it
opens chrome://extensions/shortcuts. No page, selection, or link contexts are
used. Tab moving, pinning, and closing use chrome.tabs methods that require no
host or "tabs" permission, so no other permission is requested.
```

### Remote code

Select **"No, I am not using remote code."** All code ships inside the package as ES modules compiled by
`tsc`; there is no `eval`, no remotely hosted script, and no `web_accessible_resources`.

### Data usage

Check **none** of the data-type boxes, then certify all three statements:

- Data is not sold to third parties, outside of approved use cases.
- Data is not used or transferred for purposes unrelated to the item's core functionality.
- Data is not used or transferred to determine creditworthiness or for lending purposes.

## Graphic assets

Regenerate with `npm run store:assets`; every file is asserted to be exactly the required pixel size.

|Dashboard field|File|Size|
|---|---|---|
|Screenshot 1|`store/screenshots/01-popup-light.png`|1280x800|
|Screenshot 2|`store/screenshots/02-popup-dark.png`|1280x800|
|Screenshot 3|`store/screenshots/03-popup-macos.png`|1280x800|
|Small promo tile|`store/promo/small-tile-440x280.png`|440x280|

The store icon comes from the packaged `icons/icon128.png`; it is not uploaded separately.

## Release sequencing

Listing edits and the uploaded package share one CWS draft, and `:publish` submits the whole draft:

1. `npm run store:assets`, then commit the generated PNGs and any copy changes here.
2. Paste the copy and upload the images in the dashboard, then **Save draft — do not submit**.
3. Push the `v<version>` tag. CI uploads the package into that same draft and submits it, so the refreshed
   listing and the new package go through one review together.

If the dashboard forces a submit when saving listing changes, let it submit on its own, wait for that review
to clear, then push the tag — two reviews, same end state.

`:publish` always reuses the item's existing visibility settings. If visibility was ever changed manually
without a subsequent manual publish, the API refuses to publish until you publish once from the dashboard.
