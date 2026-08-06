# Saved library

Signed-in users can save components from the catalog with the bookmark icon in the upper-right corner of a preview.

Open **Account → Saved** to browse saved components. Each saved item includes:

- **Open preview**, which opens the component's canonical page.
- A copy button for the `shadcn` install command.
- A folder selector for organizing the item.

Use **New folder** to create private folders such as `Navigation`, `Forms`, or `Experiments`. A save can be unfiled or placed in one folder at a time. Folders are private and are not published to profile pages.

Moving a save to **Unfiled** keeps the save and only removes its folder assignment.

## Route note

Saved items open `/components/<name>` directly. The rendering-parity gap this note used to describe closed when `/components/<name>` and `/preview/<name>/play` were unified on the same `DemoStage` (`c1af2b53`); `/preview/<name>/play` itself no longer exists, folded into `/components/<name>` (`2026-08-06-play-route-fold`), which now also carries the source and build spec panels that were `/play`'s own.
