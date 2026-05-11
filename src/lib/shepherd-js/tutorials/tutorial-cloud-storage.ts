import type { Tour } from 'shepherd.js'

export function launchTutorialCloudStorage(tour: Tour, completeTutorialFn?: () => void): void {
  const completeTutorial = (): void => {
    tour.complete()
    completeTutorialFn?.()
  }

  // ── Step 1: Welcome ─────────────────────────────────────────────────────────
  // No attachTo — floats centered. Sets context before pointing at anything.
  tour.addStep({
    id: 'my-files-welcome',
    title: 'Welcome to My Files',
    text: "My Files is your encrypted cloud storage. Every file you store here is sealed with post-quantum encryption before it ever leaves your device — Majikah's servers only see the locked binary, never your content.",
    buttons: [
      { text: 'End Tour', action: completeTutorial, secondary: true },
      { text: 'Next', action: tour.next }
    ]
  })

  // ── Step 2: Storage Quota ───────────────────────────────────────────────────
  // Attaches to the Card inside UserFileQuota.
  tour.addStep({
    id: 'my-files-quota',
    title: 'Storage Quota',
    text: "This card shows your current storage usage. You get 500 MB of free permanent storage. The bar turns amber at 70% and red at 90% so you always know how much room you have left. Temporary files don't count against this limit — only permanent ones do.",
    attachTo: { element: '#file-vault-quota-card', on: 'bottom' },
    buttons: [
      { text: 'End Tour', action: completeTutorial, secondary: true },
      { text: 'Back', action: tour.back },
      { text: 'Next', action: tour.next }
    ]
  })

  // ── Step 3: Drop Zone ───────────────────────────────────────────────────────
  // The dashed drag-and-drop upload area inside ScrollBody.
  tour.addStep({
    id: 'my-files-drop-zone',
    title: 'Drop Zone',
    text: 'Drag one or more files directly onto this area to add them to your upload queue. Files are encrypted locally on your device the moment they land here — before anything is sent anywhere. Each file can be up to 100 MB.',
    attachTo: { element: '#my-files-drop-zone', on: 'bottom' },
    buttons: [
      { text: 'End Tour', action: completeTutorial, secondary: true },
      { text: 'Back', action: tour.back },
      { text: 'Next', action: tour.next }
    ]
  })

  // ── Step 4: Upload Button ───────────────────────────────────────────────────
  // The AccentBtn in the toolbar — same action as clicking the drop zone.
  tour.addStep({
    id: 'my-files-upload-btn',
    title: 'Upload Button',
    text: 'Prefer a file picker over drag-and-drop? This button opens your system file browser. You can select multiple files at once — each gets its own entry in the pending queue.',
    attachTo: { element: '#my-files-upload-btn', on: 'bottom' },
    buttons: [
      { text: 'End Tour', action: completeTutorial, secondary: true },
      { text: 'Back', action: tour.back },
      { text: 'Next', action: tour.next }
    ]
  })

  // ── Step 5: Pending Queue ───────────────────────────────────────────────────
  // Conditionally rendered — only exists when pendingFiles.length > 0.
  // Tour step describes it conceptually so it's useful even with an empty queue.
  tour.addStep({
    id: 'my-files-pending-section',
    title: 'Upload Queue',
    text: "After dropping or selecting files, they appear here in a staging queue. Each row shows the filename, file size, and an encrypting… badge while the local encryption runs. Once encrypted you'll see controls to set who can decrypt it, choose permanent or temporary storage, pick a TTL if temporary, and hit Confirm to send it to the cloud.",
    buttons: [
      { text: 'End Tour', action: completeTutorial, secondary: true },
      { text: 'Back', action: tour.back },
      { text: 'Next', action: tour.next }
    ]
  })

  // ── Step 6: Filter Tabs ─────────────────────────────────────────────────────
  // The full TabBar — All / Permanent / Temporary / Shared / Attachments.
  tour.addStep({
    id: 'my-files-tab-bar',
    title: 'Filter Tabs',
    text: 'Use these tabs to filter your file list. All shows everything. Permanent shows files that count toward your 500 MB quota. Temporary shows files with an expiry date. Shared shows files currently published for web access. Attachments shows files linked to thread messages.',
    attachTo: { element: '#my-files-tab-bar', on: 'bottom' },
    buttons: [
      { text: 'End Tour', action: completeTutorial, secondary: true },
      { text: 'Back', action: tour.back },
      { text: 'Next', action: tour.next }
    ]
  })

  // ── Step 7: Search ──────────────────────────────────────────────────────────
  // The SearchContainer div — covers icon, input, and clear button.
  tour.addStep({
    id: 'my-files-search',
    title: 'Search',
    text: 'Fuzzy search across your file list by filename, MIME type, or context. Results are ranked by relevance score so the closest match always comes first. Hit the × to clear the query and return to your sorted list.',
    attachTo: { element: '#my-files-search', on: 'bottom' },
    buttons: [
      { text: 'End Tour', action: completeTutorial, secondary: true },
      { text: 'Back', action: tour.back },
      { text: 'Next', action: tour.next }
    ]
  })

  // ── Step 8: Sort ────────────────────────────────────────────────────────────
  // The sort SmBtn — cycles date → name → size.
  tour.addStep({
    id: 'my-files-sort-btn',
    title: 'Sort',
    text: 'Click this button to cycle the sort order: Date (newest first) → Name (alphabetical) → Size (largest first). The current sort key is shown on the button. Sort is disabled while a search query is active — Fuse.js handles ordering by relevance score instead.',
    attachTo: { element: '#my-files-sort-btn', on: 'bottom' },
    buttons: [
      { text: 'End Tour', action: completeTutorial, secondary: true },
      { text: 'Back', action: tour.back },
      { text: 'Next', action: tour.next }
    ]
  })

  // ── Step 9: View Toggle ─────────────────────────────────────────────────────
  // The ViewToggle wrapper — covers both List and Grid buttons.
  tour.addStep({
    id: 'my-files-view-toggle',
    title: 'List or Grid',
    text: "Switch between list view — one row per file with metadata inline — and grid view, which shows files as cards. Grid view is handy when you have a lot of images or want a quick visual overview of what's stored.",
    attachTo: { element: '#my-files-view-toggle', on: 'bottom' },
    buttons: [
      { text: 'End Tour', action: completeTutorial, secondary: true },
      { text: 'Back', action: tour.back },
      { text: 'Next', action: tour.next }
    ]
  })

  // ── Step 10: File List ──────────────────────────────────────────────────────
  // The stable wrapper div that always exists around the list/grid/skeletons.
  tour.addStep({
    id: 'my-files-file-list',
    title: 'Your Files',
    text: 'Your uploaded files appear here, 10 per page. Each row shows the filename, upload date, storage type (Permanent or Temp · expiry), and file size. Hover a row to reveal the action buttons: Download (arrow), Copy Share Link (copy icon), Publish / Unpublish (globe), and Delete (trash). Clicking a row selects it for bulk actions.',
    attachTo: { element: '#my-files-file-list', on: 'top' },
    buttons: [
      { text: 'End Tour', action: completeTutorial, secondary: true },
      { text: 'Back', action: tour.back },
      { text: 'Next', action: tour.next }
    ]
  })

  // ── Step 11: Bulk Actions ───────────────────────────────────────────────────
  // The sticky ActionBar — only rendered when selectedIds.size > 0.
  // Described without requiring selection state during the tour.
  tour.addStep({
    id: 'my-files-action-bar',
    title: 'Bulk Actions',
    text: 'When you click one or more file rows to select them, a sticky action bar appears here at the bottom of the panel. It shows how many files are selected and lets you Download, Copy Link, Publish, or Delete all of them in one go. Bulk Publish gives each selected file its own unique share token.',
    buttons: [
      { text: 'End Tour', action: completeTutorial, secondary: true },
      { text: 'Back', action: tour.back },
      { text: 'Next', action: tour.next }
    ]
  })

  // ── Step 12: What "Published" Really Means — finish ─────────────────────────
  // No attachTo — conceptual closing step before finishing the tour.
  tour.addStep({
    id: 'my-files-publish-explained',
    title: 'Published ≠ Decryptable',
    text: "One last thing worth knowing: publishing a file makes the encrypted binary downloadable via a public URL — it does not make the contents readable by anyone. The file is still a sealed .mjkb protected by ML-KEM-768 + AES-256-GCM. Only the recipient accounts you specified at encryption time can ever open it. Think of publishing as putting the locked box on the web — the lock itself doesn't change.",
    buttons: [
      { text: 'End Tour', action: completeTutorial, secondary: true },
      { text: 'Back', action: tour.back },
      { text: 'Finish Tour', action: completeTutorial }
    ]
  })

  tour.start()
}
