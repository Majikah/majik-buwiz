import type { Tour } from "shepherd.js";

/**
 * launchTutorialOnboarding
 *
 * Full new-user onboarding tour for Majik Buwiz.
 *
 * Tab element IDs:
 * #tab-accounts   #tab-contacts   #tab-sign   #tab-verify
 */
export function launchTutorialOnboarding(
  tour: Tour,
  completeTutorialFn?: () => void,
): void {
  const completeTutorial = (): void => {
    tour.complete();
    completeTutorialFn?.();
  };

  // ── Step 1: Welcome ────────────────────────────────────────────────────────
  tour.addStep({
    id: "onboarding-welcome",
    title: "Welcome to Majik Buwiz 👋",
    text: `
      <p>Majik Buwiz is a <strong>hybrid post-quantum</strong> digital signature application. 
      It proves content authenticity and detects tampering using two independent algorithms: 
      <strong>Ed25519</strong> (classical) and <strong>ML-DSA-87</strong> (post-quantum, NIST FIPS-204).</p>
    `,
    buttons: [
      { text: "Skip Tour", action: completeTutorial, secondary: true },
      { text: "Let's Go →", action: tour.next },
    ],
  });

  tour.addStep({
    id: "onboarding-overview",
    title: "Offline Ready",
    text: `
      <p>Everything runs <strong>entirely offline</strong>. No server required. Your keys and files 
      never leave your device.</p>
      <p>This quick tour walks you through the 4 main tabs to get you started.</p>
    `,
    buttons: [
      { text: "Skip Tour", action: completeTutorial, secondary: true },
      { text: "← Back", action: tour.back },
      { text: "Next →", action: tour.next },
    ],
  });

  // ── Step 2: Accounts tab ───────────────────────────────────────────────────
  tour.addStep({
    id: "onboarding-tab-accounts",
    title: "Accounts — Your Cryptographic Identity",
    text: `
      <p>Before you can sign anything, you need an account. This is your <strong>Majik Key</strong>.</p>
      <ul>
        <li>Generate a new <strong>12-word seed phrase</strong> (BIP-39) to derive your signing keys</li>
        <li>Your private keys are encrypted locally with <strong>Argon2id</strong> and protected by your passphrase</li>
        <li>Manage up to 25 local accounts for different signing contexts (work, personal, etc.)</li>
        <li>Hover over an account to copy your <strong>Invite Key</strong> to share with others</li>
      </ul>
      <p><em>Critical: Back up your seed phrase! It is the ONLY way to recover your signing keys.</em></p>
    `,
    attachTo: { element: "#tab-accounts", on: "bottom" },
    buttons: [
      { text: "Skip Tour", action: completeTutorial, secondary: true },
      { text: "← Back", action: tour.back },
      { text: "Next →", action: tour.next },
    ],
  });

  // ── Step 3: Contacts tab ───────────────────────────────────────────────────
  tour.addStep({
    id: "onboarding-tab-contacts",
    title: "Contacts — Your Trusted Directory",
    text: `
      <p>Contacts store the public keys of people you trust. You need these to securely verify 
      who signed a file.</p>
      <ul>
        <li>Add a contact by pasting their <strong>Invite Key</strong></li>
        <li>Organize contacts using <strong>groups</strong> for better management</li>
        <li>Contacts only contain public keys—they cannot be used to forge signatures</li>
        <li>Assign your own display names to keep your directory organized</li>
      </ul>
      <p><em>Having someone in your contacts allows you to use the trusted "Contact Verification" path later.</em></p>
    `,
    attachTo: { element: "#tab-contacts", on: "bottom" },
    buttons: [
      { text: "Skip Tour", action: completeTutorial, secondary: true },
      { text: "← Back", action: tour.back },
      { text: "Next →", action: tour.next },
    ],
  });

  // ── Step 4: Sign tab ───────────────────────────────────────────────────────
  tour.addStep({
    id: "onboarding-tab-sign",
    title: "Sign — Protect Content Integrity",
    text: `
      <p>Embed hybrid post-quantum signatures directly into any file or text. Any byte change 
      will immediately invalidate the signature.</p>
      <ul>
        <li><strong>File Mode:</strong> Sign PDFs, images, audio, video, or any other binary. Signatures embed directly into native metadata (Tier 1) or a universal trailer (Tier 2).</li>
        <li><strong>Text Mode:</strong> Sign plain text to generate a detached base64 signature.</li>
        <li><strong>Batch Mode:</strong> Drop an entire folder or ZIP archive. Majik Buwiz will independently sign <em>each individual file</em> inside.</li>
      </ul>
      <p><em>A signed file remains in its original format. A signed PDF is still a PDF!</em></p>
    `,
    attachTo: { element: "#tab-sign", on: "bottom" },
    buttons: [
      { text: "Skip Tour", action: completeTutorial, secondary: true },
      { text: "← Back", action: tour.back },
      { text: "Next →", action: tour.next },
    ],
  });

  // ── Step 5: Verify tab ─────────────────────────────────────────────────────
  tour.addStep({
    id: "onboarding-tab-verify",
    title: "Verify — Prove Authenticity",
    text: `
      <p>Check if a file or text is authentic and unmodified. Verification requires both the 
      Ed25519 and ML-DSA-87 signatures to pass.</p>
      <ul>
        <li><strong>Two Trust Models:</strong> Verify against a known Contact (trusted path) or use Self-reported keys (TOFU — trust on first use).</li>
        <li>Instantly see verdicts: <span style="color: #22c55e;">Verified</span>, <span style="color: #ef4444;">Tampered</span>, or <span style="color: #f59e0b;">Unknown Signer</span>.</li>
        <li>Batch verify entire folders to see exactly which files pass or fail.</li>
      </ul>
      <p><em>Verification is fully public. You don't need a private key to verify a signature.</em></p>
    `,
    attachTo: { element: "#tab-verify", on: "bottom" },
    buttons: [
      { text: "Skip Tour", action: completeTutorial, secondary: true },
      { text: "← Back", action: tour.back },
      { text: "Next →", action: tour.next },
    ],
  });

  // ── Step 6: Wrap-up ────────────────────────────────────────────────────────
  tour.addStep({
    id: "onboarding-complete",
    title: "You're all set! 🔐",
    text: `
      <p>Here's the fast path to start signing:</p>
      <ol>
        <li>Go to the <strong>Accounts tab</strong> and create your first identity.</li>
        <li>Securely back up your 12-word seed phrase.</li>
        <li>Go to the <strong>Sign tab</strong>, drop in a file, and click Sign!</li>
      </ol>
      <p>Ready to secure your files against both classical and quantum threats?</p>
    `,
    buttons: [{ text: "Start Using Majik Buwiz", action: completeTutorial }],
  });

  tour.start();
}
