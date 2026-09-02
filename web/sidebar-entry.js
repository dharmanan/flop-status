// Small, framework-free helper for one specific lifecycle bug: the app shell's
// language switch replaces the whole `.product-sidebar` node, which silently
// detaches any nav entry (Mailbox / Agent Network / Deals) a module had already
// inserted into the old one. `ensureSidebarEntry` re-creates and re-inserts the
// entry only when it is actually missing/disconnected, in the right position
// relative to whichever sibling entries currently exist — otherwise it returns
// the existing, still-connected entry unchanged (idempotent, no duplicates).
//
// Kept dependency-free (no DOM globals, no other module imports) so it is
// directly unit-testable without a browser/jsdom environment.

export function ensureSidebarEntry(sidebar, existingEntry, makeEntry, beforeSelectors) {
  if (existingEntry && existingEntry.isConnected) return existingEntry;
  const entry = makeEntry();
  let reference = null;
  for (const selector of beforeSelectors) {
    reference = sidebar.querySelector(selector);
    if (reference) break;
  }
  sidebar.insertBefore(entry, reference);
  return entry;
}
