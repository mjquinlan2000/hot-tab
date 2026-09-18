# Chrome Web Store listing

Source of truth for everything typed into the [Developer Dashboard](https://chrome.google.com/webstore/devconsole/).
The Chrome Web Store API v2 exposes only `media.upload`, `publishers.items.publish`, `fetchStatus`,
`fetchReviews`, `cancelSubmission`, and `setPublishedDeployPercentage` — there is no endpoint for listing
copy, category, or graphic assets, so these fields are pasted by hand while CI ships the package.

Item ID: `odmmgahbfhdcpnjccnlcnecoidkhemmg`

## Store listing

- **Item title**: `Hot Tab`
- **Summary** (≤132 chars, identical to `public/manifest.json` `description`): `store/copy/summary.txt`
- **Primary category**: `Functionality & UI` (the item currently sits in Accessibility; if the dashboard does not offer this label, leave the category untouched)
- **Language**: `English`
- **Homepage / Official URL**: `https://github.com/mjquinlan2000/hot-tab`
- **Support URL**: `https://github.com/mjquinlan2000/hot-tab/issues`

### Detailed description

Paste `store/copy/detailed-description.txt` verbatim.

The Chrome Web Store renders these fields as plain text — no Markdown, no HTML. Newlines are preserved, so
each paragraph in that file is a single unwrapped line and reflows to the listing width; the `-` bullets are
literal hyphens, not list markup. Keep the copy in the `.txt` files rather than inline here so what you paste
is exactly what is committed.

## Privacy practices

### Single purpose

Paste `store/copy/single-purpose.txt` verbatim.

### Permission justification — `contextMenus`

Paste `store/copy/permission-contextmenus.txt` verbatim.

### Remote code

Select **"No, I am not using remote code."** All code ships inside the package as ES modules compiled by
`tsc`; there is no `eval`, no remotely hosted script, and no `web_accessible_resources`.

### Data usage

Check **none** of the data-type boxes, then certify all three statements:

- Data is not sold to third parties, outside of approved use cases.
- Data is not used or transferred for purposes unrelated to the item's core functionality.
- Data is not used or transferred to determine creditworthiness or for lending purposes.

## Graphic assets

Regenerate with `npm run store:assets`; each file is asserted to be exactly the required pixel size and a
24-bit PNG with no alpha channel, which is what the dashboard accepts.

|Dashboard field|File|Size|
|---|---|---|
|Screenshot 1|`store/screenshots/01-manage-hotkeys.png`|1280x800|
|Screenshot 2|`store/screenshots/02-customize-shortcuts.png`|1280x800|
|Screenshot 3|`store/screenshots/03-native-glyphs.png`|1280x800|
|Small promo tile|`store/promo/small-tile-440x280.png`|440x280|
|Marquee promo tile (optional)|`store/promo/marquee-1400x560.png`|1400x560|

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
