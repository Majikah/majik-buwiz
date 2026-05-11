import type { Tour } from 'shepherd.js'

export function launchTutorialFileVault(tour: Tour, completeTutorialFn?: () => void): void {
  const completeTutorial = (): void => {
    tour.complete()
    completeTutorialFn?.()
  }

  // ── Step 1: Welcome ─────────────────────────────────────────────────────────
  // No attachTo — floats centered. Sets the stage before pointing at anything.
  tour.addStep({
    id: 'file-vault-welcome',
    title: 'Welcome to File Vault',
    text: 'File Vault lets you encrypt and decrypt any file locally using post-quantum encryption. Everything happens on your device — no internet required.',
    buttons: [
      { text: 'End Tour', action: completeTutorial, secondary: true },
      { text: 'Next', action: tour.next }
    ]
  })

  // ── Step 2: Whole panel overview ────────────────────────────────────────────
  // Attaches to the root component so users can see the full layout before
  // we drill into individual sections.
  tour.addStep({
    id: 'file-vault-overview',
    title: 'Two Panels, One Pipeline',
    text: 'File Vault is split into two panels. The left is your input — where you load the file. The right is your output — where you watch the encryption or decryption happen and download the result.',
    attachTo: { element: '#section-file-vault', on: 'top' },
    buttons: [
      { text: 'End Tour', action: completeTutorial, secondary: true },
      { text: 'Back', action: tour.back },
      { text: 'Next', action: tour.next }
    ]
  })

  // ── Step 3: Mode toggle ─────────────────────────────────────────────────────
  // The Encrypt / Decrypt pill switcher in the content header.
  tour.addStep({
    id: 'file-vault-mode-toggle',
    title: 'Encrypt or Decrypt',
    text: "Use this toggle to switch modes. Blue means Encrypt — you're sealing a file into a .mjkb binary. Green means Decrypt — you're opening one. The entire interface updates when you switch.",
    attachTo: { element: '#file-vault-mode-toggle', on: 'bottom' },
    buttons: [
      { text: 'End Tour', action: completeTutorial, secondary: true },
      { text: 'Back', action: tour.back },
      { text: 'Next', action: tour.next }
    ]
  })

  // ── Step 4: Input pane ──────────────────────────────────────────────────────
  // Left EditorPane — header + drop zone + footer as a unit.
  tour.addStep({
    id: 'file-vault-input-pane',
    title: 'Input Panel',
    text: 'This is where your source file goes. In Encrypt mode it accepts any of 130+ supported formats — images, video, audio, documents, code, archives, and more. In Decrypt mode it only accepts valid .mjkb binaries.',
    attachTo: { element: '#file-vault-input-pane', on: 'right' },
    buttons: [
      { text: 'End Tour', action: completeTutorial, secondary: true },
      { text: 'Back', action: tour.back },
      { text: 'Next', action: tour.next }
    ]
  })

  // ── Step 5: Drop zone ───────────────────────────────────────────────────────
  // The interactive drag-and-drop area inside the input pane.
  tour.addStep({
    id: 'file-vault-drop-zone',
    title: 'Drop Zone',
    text: "Drag and drop a file directly onto this area, or click anywhere inside it to open a file picker. Once loaded, you'll see the filename, size, and MIME type — along with a green chip confirming the format is supported.",
    attachTo: { element: '#file-vault-drop-zone', on: 'right' },
    buttons: [
      { text: 'End Tour', action: completeTutorial, secondary: true },
      { text: 'Back', action: tour.back },
      { text: 'Next', action: tour.next }
    ]
  })

  // ── Step 6: Input footer ────────────────────────────────────────────────────
  // Browse File + Clear buttons at the bottom of the input pane.
  tour.addStep({
    id: 'file-vault-input-footer',
    title: 'Browse & Clear',
    text: 'Prefer a file picker over drag-and-drop? Use Browse File to open one directly. Clear removes the current file so you can start fresh.',
    attachTo: { element: '#file-vault-input-footer', on: 'top' },
    buttons: [
      { text: 'End Tour', action: completeTutorial, secondary: true },
      { text: 'Back', action: tour.back },
      { text: 'Next', action: tour.next }
    ]
  })

  // ── Step 7: Output pane ─────────────────────────────────────────────────────
  // Right EditorPane — progress tracker + result card.
  tour.addStep({
    id: 'file-vault-output-pane',
    title: 'Output Panel',
    text: "This panel shows what's happening. During processing, you'll see a live progress bar and step-by-step indicators: Hash → Compress → ML-KEM encapsulate → AES-GCM encrypt (or the reverse for decryption). Once done, it displays the result details — output filename, cipher, sizes, and SHA-256 hash.",
    attachTo: { element: '#file-vault-output-pane', on: 'left' },
    buttons: [
      { text: 'End Tour', action: completeTutorial, secondary: true },
      { text: 'Back', action: tour.back },
      { text: 'Next', action: tour.next }
    ]
  })

  // ── Step 8: Output footer ───────────────────────────────────────────────────
  // Encrypt/Decrypt action button + Download button.
  tour.addStep({
    id: 'file-vault-output-footer',
    title: 'Run & Download',
    text: "Once your file is loaded, hit Encrypt or Decrypt here to kick off the pipeline. When it's done, Download .mjkb saves your encrypted binary — or Download File gives you back the original. The .mjkb you download is safe to share anywhere; only authorized recipients can open it.",
    attachTo: { element: '#file-vault-output-footer', on: 'top' },
    buttons: [
      { text: 'End Tour', action: completeTutorial, secondary: true },
      { text: 'Back', action: tour.back },
      { text: 'Finish Tour', action: completeTutorial }
    ]
  })

  tour.start()
}
