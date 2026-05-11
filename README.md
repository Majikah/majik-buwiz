# Majik Buwiz

[![Developed by Zelijah](https://img.shields.io/badge/Developed%20by-Zelijah-red?logo=github&logoColor=white)](https://thezelijah.world) ![GitHub Sponsors](https://img.shields.io/github/sponsors/jedlsf?style=plastic&label=Sponsors&link=https%3A%2F%2Fgithub.com%2Fsponsors%2Fjedlsf)



**Post-Quantum Invoice Management** — secure, offline-first, and just like magic.

Majik Buwiz helps freelancers, consultants, and small business owners create, sign, share, and manage invoices — while keeping full control of their data and privacy. Every invoice is sealed with next-generation cryptography. Your data never leaves your device unless you choose to share it.

<img width="3840" height="2160" alt="MajikBuwiz_SuperHero_4K" src="https://github.com/user-attachments/assets/9e9b4efe-6997-4ab4-acaf-cf96763cc4ea" />

[Read more about Majik Buwiz here](https://majikah.solutions/products/majik-buwiz)

[![Majik Buwiz Thumbnail](https://github.com/user-attachments/assets/9e9b4efe-6997-4ab4-acaf-cf96763cc4ea)](https://apps.microsoft.com/detail/9mzz1gm9238r)

> Click the image to try Majik Message live.

[Read Docs](https://majikah.solutions/products/majik-buwiz/docs)

[![Majik Message Microsoft App Store](https://get.microsoft.com/images/en-us%20light.svg)](https://apps.microsoft.com/detail/9mzz1gm9238r)


Also available on [Microsoft Store](https://apps.microsoft.com/detail/9mzz1gm9238r) for free.




[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE) [![Platform](https://img.shields.io/badge/Platform-Windows-0078D4?logo=windows&logoColor=white)](https://apps.microsoft.com)



---

## Table of Contents

- [Majik Buwiz](#majik-buwiz)
  - [Table of Contents](#table-of-contents)
  - [Why Majik Buwiz](#why-majik-buwiz)
  - [Features](#features)
    - [Invoice Management](#invoice-management)
    - [Financial Dashboard](#financial-dashboard)
    - [Export \& Interoperability](#export--interoperability)
    - [Security \& Data Ownership](#security--data-ownership)
  - [Security \& Cryptography](#security--cryptography)
    - [Dual Digital Signatures (applied to every invoice)](#dual-digital-signatures-applied-to-every-invoice)
    - [Optional Encryption Layer](#optional-encryption-layer)
    - [Key Protection](#key-protection)
  - [Install \& Access](#install--access)
  - [Quick Start](#quick-start)
  - [Export \& Backup](#export--backup)
  - [Sharing \& Secure Exchange](#sharing--secure-exchange)
  - [Related Projects](#related-projects)
    - [@majikah/majik-invoice](#majikahmajik-invoice)
    - [@majikah/majik-key](#majikahmajik-key)
    - [@majikah/majik-signature](#majikahmajik-signature)
    - [@majikah/majik-envelope](#majikahmajik-envelope)
  - [Contributing](#contributing)
  - [License](#license)
  - [Author \& Contact](#author--contact)

---

## Why Majik Buwiz

Most invoicing tools store your data on someone else's servers. Majik Buwiz works the other way around.

- **Offline-first** — your invoices live on your device by default. No account required. No internet needed for full functionality.
- **Secure by design** — every invoice is digitally signed for authenticity and can be optionally encrypted for private sharing.
- **Future-proof cryptography** — uses both well-established and post-quantum algorithms to protect your invoices against current and emerging threats.
- **No payment processing** — Majik Buwiz is strictly an invoicing and secure communication tool. It does not handle payments.
- **Free** — no subscriptions, no usage limits, no hidden fees.

---

## Features

### Invoice Management
- Custom invoice builder with line items, notes, tags, and reference attachments
- Multi-layer tax system — supports VAT, EWT, percentage-based, additive, and withholding taxes
- Automatic calculation of totals, balances, and net payable amounts
- Full invoice lifecycle: `Draft → Issued → Sent → Paid → Void` and more
- Batch operations with advanced filtering and pagination
- Recipient and business contact management

### Financial Dashboard
- Revenue overview: gross, collected, and outstanding
- Tax breakdown: output tax, withholding tax, and effective tax rate
- Overdue alerts and upcoming due date monitoring
- Average payment time tracking
- Invoice size distribution: average, median, largest, smallest
- Client and recipient revenue analytics
- Financial segmentation by invoice status

### Export & Interoperability
- PDF export for professional sharing and printing
- CSV export for accounting tools and bookkeeping imports
- Notes, tags, and reference attachments per invoice

### Security & Data Ownership
- All data stored locally by default — no forced cloud
- User-controlled cryptographic keys, generated and stored on your device
- Tamper-proof invoice sealing via dual digital signatures
- Optional full encryption for confidential invoice sharing
- Secure local identity protected by passphrase hashing

---

## Security & Cryptography

Majik Buwiz uses a hybrid cryptographic architecture that combines classical and post-quantum algorithms — the same class of security recommended by NIST for long-term data protection.

### Dual Digital Signatures (applied to every invoice)
| Algorithm | Type | Purpose |
|---|---|---|
| Ed25519 | Classical | Trusted standard for fast, reliable signing |
| ML-DSA-87 (FIPS-204) | Post-Quantum | Forgery-resistant signing for quantum-resilient authenticity |

### Optional Encryption Layer
| Algorithm | Type | Purpose |
|---|---|---|
| ML-KEM-768 | Post-Quantum | Key encapsulation for secure key exchange |
| AES-256-GCM | Classical | Symmetric encryption of invoice content |

### Key Protection
- Keys are generated and stored locally on your device
- Protected using **Argon2id** passphrase hashing
- Keys are **never transmitted** unless you explicitly export them

> ⚠️ **Important:** Keep a secure backup of your passphrase and key export. Without it, you may permanently lose access to signed or encrypted content.

---

## Install & Access

**Windows (Microsoft Store)**
Search for **"Majik Buwiz"** in the Microsoft Store and follow the install prompts.

**Web App** *(coming soon)*
[https://buwiz.majikah.solutions](https://buwiz.majikah.solutions) — access Majik Buwiz from any modern browser.

---

## Quick Start

1. Open the app and create or unlock your **Majik identity** — protect it with a strong passphrase.
2. Create an invoice: add line items, taxes, notes, and recipient details.
3. Sign the invoice locally, then export as PDF or CSV — or send it securely to a recipient via the built-in exchange.

Invoices are fully editable while in `Draft` status and move through states as your workflow progresses.

---

## Export & Backup

- Export invoice **PDFs** for professional sharing, printing, or email delivery
- Export **CSV** files for spreadsheets and accounting software imports
- Back up your keys and invoice exports to a secure location (encrypted cloud storage or offline drive)

---

## Sharing & Secure Exchange

Majik Buwiz includes a built-in encrypted invoice exchange network:

- Send and receive invoices directly between Majik Buwiz users
- All payloads are **end-to-end encrypted** before transmission
- Uses a **zero-knowledge relay** — the relay service cannot read your invoice contents
- Encrypted invoice data is retained temporarily and **automatically deleted after 30 days** unless updated by participants
- No payment processing — this is strictly a secure communication layer

---

## Related Projects

Majik Buwiz is part of the broader **Majikah** ecosystem of cryptographic libraries.

### [@majikah/majik-invoice](https://www.npmjs.com/package/@majikah/majik-invoice)
Domain model for invoices with an optional cryptographic envelope. Provides two interoperable classes:
- `GeneralInvoice` — pure accounting model with line items, taxes, totals, and projections
- `MajikInvoice` — wrapper that signs and/or encrypts a `GeneralInvoice`

### [@majikah/majik-key](https://www.npmjs.com/package/@majikah/majik-key)
Seed phrase account library — required peer dependency for signing.

### [@majikah/majik-signature](https://www.npmjs.com/package/@majikah/majik-signature)
Hybrid post-quantum content signing and verification library. Combines **Ed25519** and **ML-DSA-87 (FIPS-204)** into a dual-algorithm architecture that produces tamper-proof, forgery-resistant signatures for any content format — plaintext, JSON, PDF, audio, video, or binary.

### [@majikah/majik-envelope](https://www.npmjs.com/package/@majikah/majik-envelope)
Core cryptographic engine for the Majikah platform. Provides a post-quantum secure envelope format handling message encryption, multi-recipient key encapsulation, and transparent compression using NIST-standardized algorithms.

---

## Contributing

Contributions are welcome — whether that's bug reports, feature suggestions, or help expanding platform support.

Reach out via email to get involved: [business@thezelijah.world](mailto:business@thezelijah.world)

---

## License

[Apache-2.0](LICENSE) — free for personal and commercial use.

---

## Author & Contact

Made with 💙 by [@thezelijah](https://github.com/jedlsf)

| | |
|---|---|
| **Developer** | Josef Elijah Fabian |
| **GitHub** | [https://github.com/jedlsf](https://github.com/jedlsf) |
| **Repository** | [https://github.com/Majikah/majik-buwiz](https://github.com/Majikah/majik-buwiz) |
| **Website** | [https://www.thezelijah.world](https://www.thezelijah.world) |
| **Business Email** | [business@thezelijah.world](mailto:business@thezelijah.world) |
