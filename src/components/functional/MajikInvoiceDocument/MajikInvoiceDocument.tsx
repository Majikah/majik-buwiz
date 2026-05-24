"use client";

/**
 * MajikInvoiceDocument.tsx
 *
 * Versatile invoice document renderer that accepts either a GeneralInvoice
 * (draft mode) or a MajikInvoice (finalized/sealed mode).
 *
 * Mode discrimination:
 *   - `kind: "draft"`  → GeneralInvoice, all crypto UI hidden, edits go
 *                        directly through onChange(updatedGeneralInvoice)
 *   - `kind: "majik"`  → MajikInvoice, integrity panel + crypto controls
 *                        visible, edits trigger reissue+resign via onEdit
 *
 * Design contract:
 *   - In draft mode, onChange is called with the updated GeneralInvoice on
 *     every field change. No MajikInvoice is ever created here.
 *   - In majik mode, onEdit receives the updated GeneralInvoice payload and
 *     the parent (InvoicePanel) is responsible for reissue+resign.
 *   - Sealed invoices are always readonly — no edit, no sign, only verify/decrypt.
 *   - canEdit = kind==="draft" ? !!onChange : (!readonly && !isSealed && !!onEdit)
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import styled, { css } from "styled-components";
import {
  CurrencyCircleDollarIcon,
  FilePdfIcon,
  LockKeyIcon,
  ShieldCheckIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";

import { DatesMeta } from "./DatesMeta";

import { InvoiceHeader } from "./InvoiceHeader";
import { LineItemsTable, fmt } from "./LineItemsTable";
import { PartyBlock } from "./PartyBlock";
import { TotalsBlock } from "./TotalsBlock";

import { GeneralInvoice } from "@majikah/majik-invoice";
import type {
  MajikInvoice,
  GeneralInvoiceInput,
  LineItemInput,
  DocumentReference,
  InvoiceType,
  InvoiceStatus,
  ProofOfPayment,
  Party,
} from "@majikah/majik-invoice";
import { downloadMajikInvoicePDF } from "./MajikInvoicePDF";
import { ProofOfPaymentsBlock } from "./ProofOfPayments";
import { CtrlBtn } from "@/globals/buttons";
import { debounce, downloadBlob } from "@/utils/utils";
import { SignatureBlock, SignerInfo } from "./SignatureBlock";

import InvoicePDFExportDialog, {
  InvoicePDFExportOptions,
} from "@/components/panels/invoice/InvoicePDFExportDialog";

// Decoupled sections
import { IntegrityPanel } from "./IntegrityPanel";
import { InvoiceReferences } from "./InvoiceReferences";
import { NotesTags } from "./NotesTags";
import IssuerCloseBlock from "./IssuerCloseBlock";
import { computeDueDateFromTerm } from "./_utils";
import { MajikBuwizDatabase } from "@/components/majik-context-wrapper/majik-buwiz-database";
import { sendNotification } from "@tauri-apps/plugin-notification";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Styled — Document Shell
// ---------------------------------------------------------------------------

const DocumentWrapper = styled.div<{ $readonly: boolean }>`
  background: ${({ theme }) => theme.colors.primaryBackground};
  border: 1px solid ${({ theme }) => theme.colors.primary}1a;
  border-radius: ${({ theme }) => theme.borders.radius.large};
  padding: 2.25rem 2.5rem;
  font-family: ${({ theme }) => theme.typography.fonts.regular};
  color: ${({ theme }) => theme.colors.textPrimary};
  max-width: 780px;
  margin: 0 auto;
  position: relative;
  box-shadow: ${({ theme }) => theme.shadows.small};

  ${({ $readonly }) =>
    $readonly &&
    css`
      * {
        cursor: default !important;
      }
    `}
`;

const Divider = styled.hr`
  border: none;
  border-top: 1px solid ${({ theme }) => theme.colors.primary}15;
  margin: 1.5rem 0;
`;

const SectionLabel = styled.div`
  font-family: ${({ theme }) => theme.typography.fonts.semibold};
  font-size: 9px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.primary};
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 6px;

  &::after {
    content: "";
    flex: 1;
    height: 1px;
    background: ${({ theme }) => theme.colors.primary}18;
  }
`;

const TwoColGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
  margin-bottom: ${({ theme }) => theme.spacing.medium};

  @media (max-width: ${({ theme }) => theme.breakpoints.tablet}) {
    grid-template-columns: 1fr;
  }
`;

// ---------------------------------------------------------------------------
// Styled — Tax Breakdown
// ---------------------------------------------------------------------------

const TaxRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  padding: 6px 0;
  border-bottom: 1px solid ${({ theme }) => theme.colors.primary}0e;
  color: ${({ theme }) => theme.colors.textSecondary};

  &:last-child {
    border-bottom: none;
  }
`;

const TaxType = styled.span`
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  font-size: 10px;
  padding: 2px 7px;
  border-radius: ${({ theme }) => theme.borders.radius.rounded};
  background: ${({ theme }) => theme.colors.primarySoft};
  color: ${({ theme }) => theme.colors.primary};
  margin-right: 6px;
`;

const TaxAmount = styled.span`
  font-family: ${({ theme }) => theme.typography.fonts.numbers};
  font-size: 12px;
  font-weight: 500;
  color: ${({ theme }) => theme.colors.textPrimary};
`;

const EmptyNote = styled.div`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.5;
  padding: 4px 0;
`;

// ---------------------------------------------------------------------------
// Styled — Encrypted overlay
// ---------------------------------------------------------------------------

const EncOverlay = styled.div`
  border: 1px solid ${({ theme }) => theme.colors.primary}66;
  border-radius: ${({ theme }) => theme.borders.radius.medium};
  padding: 2.5rem 2rem;
  text-align: center;
  background: ${({ theme }) => theme.colors.primarySoft};
  margin: 1.5rem 0;
`;

const EncTitle = styled.div`
  font-family: ${({ theme }) => theme.typography.fonts.semibold};
  font-size: 14px;
  color: ${({ theme }) => theme.colors.primary};
  margin: 10px 0 6px;
`;

const EncSubtitle = styled.div`
  font-family: ${({ theme }) => theme.typography.fonts.light};
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textSecondary};
  margin-bottom: 16px;
  line-height: 1.6;
`;

const RecipientChip = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-family: ${({ theme }) => theme.typography.fonts.numbers};
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textSecondary};
  padding: 4px 10px;
  border: 1px solid ${({ theme }) => theme.colors.primary}33;
  border-radius: ${({ theme }) => theme.borders.radius.rounded};
  margin-bottom: 14px;
`;

// ---------------------------------------------------------------------------
// Styled — Draft banner
// ---------------------------------------------------------------------------

const DraftBanner = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: ${({ theme }) => theme.typography.fonts.regular};
  font-size: 11px;
  padding: 8px 12px;
  border-radius: ${({ theme }) => theme.borders.radius.small};
  background: ${({ theme }) => theme.colors.primarySoft};
  border: 1px solid ${({ theme }) => theme.colors.primary}33;
  color: ${({ theme }) => theme.colors.textSecondary};
  margin-bottom: ${({ theme }) => theme.spacing.small};
`;

const DraftControls = styled.div`
  display: flex;
  justify-content: flex-end;
  margin-bottom: ${({ theme }) => theme.spacing.small};
`;

// ---------------------------------------------------------------------------
// Props — discriminated union
// ---------------------------------------------------------------------------

export type MajikInvoiceDocumentProps =
  | {
      majik: MajikBuwizDatabase;
      kind: "draft";
      /** GeneralInvoice being edited in draft mode */
      invoice: GeneralInvoice;
      /** Called on every field change with the updated GeneralInvoice */
      onChange: (updated: GeneralInvoice) => void;
    }
  | {
      majik: MajikBuwizDatabase;
      kind: "majik";
      /** Finalized MajikInvoice instance */
      invoice: MajikInvoice;
      /** When true, all edit affordances are suppressed (sealed invoices) */
      readonly?: boolean;
      pendingDraft?: GeneralInvoice;
      /**
       * Called with the updated GeneralInvoice payload when the user edits.
       * The parent is responsible for reissue+resign.
       */
      onEdit?: (updated: GeneralInvoice) => void;
      onSign?: () => Promise<void>;
      onSeal?: () => Promise<void>;
      onDecrypt?: () => Promise<void>;
      onVerify?: () => Promise<void>;
      onSecureLock?: () => Promise<void>;
      onAddPayment?: (proof: ProofOfPayment) => void;
      onRemovePayment?: (proof: ProofOfPayment) => void;
      onClearPayments?: () => void;
      /** Called when user closes (seal=false) or closes+seals (seal=true) */
      onCloseInvoice?: (seal?: boolean) => Promise<void>;

      /** Whether the current user is the issuer of this invoice */
      isIssuer?: boolean;

      /** When true, "Close & Seal" button is shown alongside "Close Invoice" */
      canSeal?: boolean;
      /** Phrase user must type to confirm seal. Defaults to "SEAL MY INVOICE" */
      sealConfirmText?: string;

      /**
       * When true AND onSign is provided, renders the SignatureBlock CTA at the
       * bottom of the document. Defaults to false.
       */
      canSign?: boolean;
      /** Info about the key/account that will be used to sign */
      signerInfo?: SignerInfo;
    };

// ---------------------------------------------------------------------------
// Helper — extract GeneralInvoice from either prop shape
// ---------------------------------------------------------------------------

function getGeneralInvoice(
  props: MajikInvoiceDocumentProps,
): GeneralInvoice | null {
  if (props.kind === "draft") return props.invoice;
  const inv = props.invoice;
  if ((props as any).pendingDraft) return (props as any).pendingDraft;
  if (inv.isEncrypted && !inv.hasDecryptedCache) return null;
  return inv.invoice;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const MajikInvoiceDocument: React.FC<MajikInvoiceDocumentProps> = (
  props,
) => {
  const [busy, setBusy] = useState<string | null>(null);

  const isDraft = props.kind === "draft";
  const [isExportingPDF, setIsExportingPDF] = useState(false);

  // ── Derived state ─────────────────────────────────────────────────────────

  const majikInvoice: MajikInvoice | null = isDraft
    ? null
    : (props.invoice as MajikInvoice);
  const isEncryptedLocked = majikInvoice
    ? majikInvoice.isEncrypted && !majikInvoice.hasDecryptedCache
    : false;
  const isSealed = majikInvoice?.isSealed ?? false;

  const canEdit = isDraft
    ? true
    : !!(props as any).onEdit &&
      !(props as any).readonly &&
      !isSealed &&
      !isEncryptedLocked;

  const generalInvoice = getGeneralInvoice(props);

  const lineItemInputs: LineItemInput[] = generalInvoice
    ? generalInvoice.lineItems.map((li) => ({
        id: li.id,
        description: li.description,
        quantity: li.quantity,
        unitPrice: li.unitPrice.toMajor(),
        unit: li.unit,
        taxes: li.taxes.toArray(),
        discount: li.discount,
        accountCode: li.accountCode,
        costCenter: li.costCenter,
        tags: li.tags,
        metadata: li.metadata,
      }))
    : [];

  // ── Mutation helper ───────────────────────────────────────────────────────

  const pendingPatchRef = useRef<Partial<GeneralInvoiceInput>>({});
  const latestInvoiceRef = useRef<GeneralInvoice | null>(generalInvoice);
  const flushUpdatesRef = useRef(
    debounce(() => {
      const invoice = latestInvoiceRef.current;
      if (!invoice) return;

      const patch = pendingPatchRef.current;

      const lineItems: LineItemInput[] = invoice.lineItems.map((li) => ({
        id: li.id,
        description: li.description,
        quantity: li.quantity,
        unitPrice: li.unitPrice.toMajor(),
        unit: li.unit,
        taxes: li.taxes.toArray(),
        discount: li.discount,
        accountCode: li.accountCode,
        costCenter: li.costCenter,
        tags: li.tags,
        metadata: li.metadata,
      }));

      try {
        const updated = GeneralInvoice.create({
          id: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          type: invoice.type,
          status: invoice.status,
          issuer: invoice.issuer,
          recipient: invoice.recipient,
          currency: invoice.currency,
          issueDate: invoice.issueDate,
          dueDate: invoice.dueDate,
          period: invoice.period,
          paymentTerms: invoice.paymentTerms,
          defaultTaxes: invoice.defaultTaxes.toArray(),
          references: invoice.references ? [...invoice.references] : undefined,
          notes: invoice.notes,
          tags: invoice.tags,
          metadata: invoice.metadata,
          lineItems,
          ...patch,
        });

        pendingPatchRef.current = {};

        if (isDraft) {
          (
            props as Extract<MajikInvoiceDocumentProps, { kind: "draft" }>
          ).onChange(updated);
        } else {
          (
            props as Extract<MajikInvoiceDocumentProps, { kind: "majik" }>
          ).onEdit?.(updated);
        }
      } catch (err) {
        // Errors surface in child components' local feedback banners.
        console.error("[MajikInvoiceDocument] flush error:", err);
      }
    }, 150),
  );

  const updatePayload = useCallback(
    (patch: Partial<GeneralInvoiceInput>) => {
      if (!canEdit) return;
      pendingPatchRef.current = { ...pendingPatchRef.current, ...patch };
      flushUpdatesRef.current();
    },
    [canEdit],
  );

  useEffect(() => {
    latestInvoiceRef.current = generalInvoice;
  }, [generalInvoice]);

  useEffect(() => {
    return () => {
      flushUpdatesRef.current.cancel();
    };
  }, []);

  // ── Stable callbacks ──────────────────────────────────────────────────────

  const handleUpdateRef = useCallback(
    (idx: number, patch: Partial<DocumentReference>) => {
      const refs = [...(latestInvoiceRef.current?.references ?? [])];
      refs[idx] = { ...refs[idx], ...patch };
      updatePayload({ references: refs });
    },
    [updatePayload],
  );

  const handleRemoveRef = useCallback(
    (idx: number) => {
      const refs = (latestInvoiceRef.current?.references ?? []).filter(
        (_, j) => j !== idx,
      );
      updatePayload({ references: refs });
    },
    [updatePayload],
  );

  const handleAddRef = useCallback(
    (ref: DocumentReference) => {
      const refs = [...(latestInvoiceRef.current?.references ?? []), ref];
      updatePayload({ references: refs });
    },
    [updatePayload],
  );

  const handleCompanyNameChange = useCallback(
    (v: string) => {
      const issuer = latestInvoiceRef.current?.issuer ?? {
        legalName: generalInvoice?.issuer.legalName,
      };
      updatePayload({ issuer: { ...issuer, legalName: v } });
    },
    [updatePayload],
  );

  const handleTaglineChange = useCallback(
    (v: string) => {
      const issuer = latestInvoiceRef.current?.issuer ?? {
        ...generalInvoice?.issuer,
      };
      updatePayload({
        issuer: {
          ...issuer,
          tradeName: v,
          legalName: issuer.legalName || "",
        },
      });
    },
    [updatePayload],
  );

  const handleInvoiceNumberChange = useCallback(
    (v: string) => updatePayload({ invoiceNumber: v }),
    [updatePayload],
  );

  const handleInvoiceTypeChange = useCallback(
    (v: InvoiceType) => updatePayload({ type: v }),
    [updatePayload],
  );

  const handleStatusChange = useCallback(
    (v: InvoiceStatus) => updatePayload({ status: v }),
    [updatePayload],
  );

  const handleIssuerChange = useCallback(
    (patch: Partial<any>) => {
      const issuer = latestInvoiceRef.current?.issuer ?? {
        ...generalInvoice?.issuer,
      };
      updatePayload({
        issuer: { ...issuer, ...patch, legalName: issuer.legalName || "" },
      });
    },
    [updatePayload],
  );

  const handleRecipientChange = useCallback(
    (patch: Partial<Party>) => {
      const recipient = latestInvoiceRef.current?.recipient ?? {
        ...generalInvoice?.recipient,
      };
      updatePayload({
        recipient: {
          ...recipient,
          ...patch,
          legalName: patch?.legalName || recipient.legalName || "",
        },
      });
    },
    [updatePayload],
  );

  const handleLineItemsChange = useCallback(
    (items: LineItemInput[]) => updatePayload({ lineItems: items }),
    [updatePayload],
  );

  const handleNotesChange = useCallback(
    (v: string) => updatePayload({ notes: v || undefined }),
    [updatePayload],
  );

  const handleAddTag = useCallback(
    (tag: string) => {
      const tags = latestInvoiceRef.current?.tags ?? [];
      if (!tags.includes(tag)) {
        updatePayload({ tags: [...tags, tag] });
      }
    },
    [updatePayload],
  );

  const handleRemoveTag = useCallback(
    (i: number) => {
      const tags = (latestInvoiceRef.current?.tags ?? []).filter(
        (_, idx) => idx !== i,
      );
      updatePayload({ tags });
    },
    [updatePayload],
  );

  useEffect(() => {
    if (!generalInvoice || !canEdit) return;

    // already has due date → don't override user/manual value
    if (generalInvoice.dueDate) return;

    const paymentTerms = generalInvoice.paymentTerms;
    if (!paymentTerms) return;

    const computedDueDate = computeDueDateFromTerm(
      generalInvoice.issueDate,
      generalInvoice.paymentTerms,
    );

    if (!computedDueDate) return;

    updatePayload({
      dueDate: computedDueDate,
    });
  }, [generalInvoice, canEdit, updatePayload]);

  // ── PDF export ────────────────────────────────────────────────────────────

  const handleExportPDF = useCallback(
    async (invoices: MajikInvoice[], options: InvoicePDFExportOptions) => {
      setBusy("pdf");
      try {
        if (isDraft) {
          await downloadMajikInvoicePDF({
            majik: props.majik,
            kind: "draft",
            invoice: props.invoice as GeneralInvoice,
            options,
          });
        } else {
          for (const invoice of invoices) {
            await downloadMajikInvoicePDF({
              majik: props.majik,
              kind: "majik",
              invoice,
              options,
            });
          }
        }
      } catch (err) {
        console.error("[MajikInvoiceDocument] PDF export error:", err);
      } finally {
        setBusy(null);
      }
    },
    [isDraft, props.invoice],
  );

  // ── MJKI export ────────────────────────────────────────────────────────────

  const handleExportMJKI = useCallback(async () => {
    setBusy("pdf");

    const activeAccount = props.majik.getActiveAccount();

    if (!activeAccount) return;
    if (isDraft) return;

    try {
      // If only one invoice, export directly

      const invoice = props.invoice;

      const mjkiArrayBuffer = invoice.toBinary();

      const invoiceFileName = `${invoice.public.issuerName} - ${
        invoice.invoice.issuer.tin || activeAccount.id
      } - ${invoice.public.invoiceNumber} - Invoice`;

      const filePath = await save({
        defaultPath: invoiceFileName,
        filters: [{ name: "Majik Invoice", extensions: ["mjki"] }],
      });

      const blob = new Blob([mjkiArrayBuffer], {
        type: "application/vnd.majikah.invoice",
      });

      if (!filePath) {
        downloadBlob(blob, "mjki", invoiceFileName);
      } else {
        await writeFile(filePath, new Uint8Array(mjkiArrayBuffer));
      }

      toast.success("Invoice Exported", {
        description: `${invoiceFileName} exported successfully.`,
      });

      sendNotification({
        title: "Invoice Exported",
        body: `${invoiceFileName} exported successfully.`,
      });

      return;
    } catch (err) {
      console.error("[MajikInvoiceDocument] MJKI export error:", err);

      toast.error("Export Failed", {
        description: "Failed to export MJKI invoice(s).",
      });
    } finally {
      setBusy(null);
    }
  }, [isDraft, props.invoice]);
  // ── Decrypt (needed in the encrypted overlay, not just IntegrityPanel) ────

  const handleDecryptOverlay = useCallback(async () => {
    if (isDraft || !(props as any).onDecrypt) return;
    await (props as any).onDecrypt();
  }, [isDraft, props]);

  const canDecryptNow =
    !isDraft &&
    !!(props as any).onDecrypt &&
    !!majikInvoice?.isEncrypted &&
    !majikInvoice?.hasDecryptedCache;

  const readonly = isDraft ? false : !!(props as any).readonly;
  const showSignatureBlock =
    !isDraft && !!props?.canSign && !!(props as any)?.onSign;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <DocumentWrapper $readonly={!canEdit}>
      {/* ── Draft mode banner ── */}
      {isDraft && (
        <DraftBanner>
          <WarningCircleIcon
            size={13}
            weight="fill"
            style={{ flexShrink: 0, opacity: 0.6 }}
          />
          Draft — not yet finalized. Changes are in-memory only and will not be
          stored until you finalize.
        </DraftBanner>
      )}

      {isDraft && (
        <DraftControls>
          <CtrlBtn
            onClick={() => setIsExportingPDF(true)}
            disabled={busy === "pdf"}
          >
            <FilePdfIcon size={13} />
            {busy === "pdf" ? "Exporting…" : "Export PDF"}
          </CtrlBtn>
        </DraftControls>
      )}

      {/* ── 1. Header ── */}
      <InvoiceHeader
        companyName={
          generalInvoice?.issuer.legalName ??
          (!isDraft ? (props.invoice as MajikInvoice).public.issuerName : "")
        }
        tagline={generalInvoice?.issuer.tradeName ?? ""}
        invoiceNumber={
          generalInvoice?.invoiceNumber ??
          (!isDraft
            ? ((props.invoice as MajikInvoice).public.invoiceNumber ??
              (props.invoice as MajikInvoice).id.slice(0, 8))
            : "")
        }
        invoiceType={
          generalInvoice?.type ??
          (!isDraft
            ? (props.invoice as MajikInvoice).public.invoiceType
            : undefined)
        }
        status={{
          invoice: generalInvoice?.status,
          security: (props.invoice as MajikInvoice).integrityStatus,
        }}
        displayStatus={
          isDraft ? undefined : (props.invoice as MajikInvoice).displayStatus
        }
        mode={isDraft ? undefined : (props.invoice as MajikInvoice).mode}
        isSealed={isSealed}
        sealedBy={
          !isDraft
            ? (props.invoice as MajikInvoice).integrity.sealInfo?.sealedBy
            : undefined
        }
        sealTimestamp={
          !isDraft
            ? (props.invoice as MajikInvoice).integrity.sealInfo?.sealTimestamp
            : undefined
        }
        readonly={!canEdit}
        onCompanyNameChange={handleCompanyNameChange}
        onTaglineChange={handleTaglineChange}
        onInvoiceNumberChange={handleInvoiceNumberChange}
        onInvoiceTypeChange={handleInvoiceTypeChange}
        onStatusChange={handleStatusChange}
      />

      {/* ── 2. Parties ── */}
      {generalInvoice && (
        <PartyBlock
          majik={props.majik}
          issuer={generalInvoice.issuer}
          recipient={generalInvoice.recipient}
          readonly={!canEdit}
          onIssuerChange={handleIssuerChange}
          onRecipientChange={handleRecipientChange}
        />
      )}

      {/* ── 3. Dates, currency, payment terms ── */}
      {generalInvoice && (
        <DatesMeta
          issueDate={generalInvoice.issueDate}
          dueDate={generalInvoice.dueDate}
          currency={generalInvoice.currency}
          paymentTerms={generalInvoice.paymentTerms}
          period={generalInvoice.period}
          readonly={!canEdit}
          onIssueDateChange={(v) => updatePayload({ issueDate: v })}
          onDueDateChange={(v) => updatePayload({ dueDate: v })}
          onCurrencyChange={(v) => updatePayload({ currency: v })}
          onPaymentTermsChange={(term, computedDueDate) =>
            updatePayload({
              paymentTerms: term,
              ...(computedDueDate !== undefined && {
                dueDate: computedDueDate,
              }),
            })
          }
          onPeriodChange={(v) => updatePayload({ period: v })}
        />
      )}

      {/* ── 4a. Encrypted overlay (locked, majik mode only) ── */}
      {isEncryptedLocked ? (
        <EncOverlay>
          <LockKeyIcon size={30} color="currentColor" />
          <EncTitle>Payload Encrypted</EncTitle>
          <EncSubtitle>
            Line items and amounts are hidden.
            <br />
            Decrypt with a recipient key to view the full invoice.
          </EncSubtitle>
          {majikInvoice?.integrity.contentHash && (
            <RecipientChip>
              <LockKeyIcon size={11} />
              {(majikInvoice.payload as any).recipientFingerprints
                ?.map((fp: string) => fp.slice(0, 10) + "…")
                .join(", ") ?? "recipient encrypted"}
            </RecipientChip>
          )}
          <br />
          <CtrlBtn
            onClick={handleDecryptOverlay}
            disabled={!canDecryptNow || busy === "decrypt"}
          >
            <ShieldCheckIcon size={13} weight="bold" />
            {busy === "decrypt" ? "Decrypting…" : "Decrypt with key"}
          </CtrlBtn>
        </EncOverlay>
      ) : (
        /* ── 4b. Line items + totals ── */
        generalInvoice && (
          <>
            <LineItemsTable
              items={lineItemInputs}
              currency={generalInvoice.currency}
              canEdit={canEdit}
              onChange={handleLineItemsChange}
            />
            <TotalsBlock invoice={generalInvoice} />
          </>
        )
      )}

      <Divider />

      {/* ── 5. Tax breakdown & References ── */}
      {generalInvoice && (
        <TwoColGrid>
          <div>
            <SectionLabel>Tax breakdown</SectionLabel>
            {generalInvoice.taxBreakdown().length === 0 ? (
              <EmptyNote>No tax applied</EmptyNote>
            ) : (
              generalInvoice.taxBreakdown().map((g, i) => (
                <TaxRow key={i}>
                  <span>
                    <TaxType>{g.taxType}</TaxType>
                    {(g.rate * 100).toFixed(0)}%{" "}
                    <span style={{ opacity: 0.5, fontSize: 11 }}>
                      · {g.lineCount} line{g.lineCount > 1 ? "s" : ""}
                    </span>
                  </span>
                  <TaxAmount>
                    {fmt(g.taxAmount, generalInvoice.currency)}
                  </TaxAmount>
                </TaxRow>
              ))
            )}
          </div>

          <div>
            <SectionLabel>References</SectionLabel>
            <InvoiceReferences
              references={[...(generalInvoice.references ?? [])]}
              canEdit={canEdit}
              readonly={readonly}
              onAdd={handleAddRef}
              onUpdate={handleUpdateRef}
              onRemove={handleRemoveRef}
            />
          </div>
        </TwoColGrid>
      )}

      {/* ── 6. Notes & Tags ── */}
      {generalInvoice && (
        <TwoColGrid>
          <div>
            <SectionLabel>Notes & terms</SectionLabel>
          </div>
          <div>
            <SectionLabel>Tags</SectionLabel>
          </div>
          <NotesTags
            notes={generalInvoice.notes ?? ""}
            tags={generalInvoice.tags ?? []}
            canEdit={canEdit}
            onNotesChange={handleNotesChange}
            onAddTag={handleAddTag}
            onRemoveTag={handleRemoveTag}
          />
        </TwoColGrid>
      )}

      {/* ── Proof of Payment ── */}
      {!isDraft && majikInvoice && !majikInvoice.isLocked && (
        <>
          <Divider />
          <SectionLabel>
            <CurrencyCircleDollarIcon size={11} weight="fill" />
            Proof of Payment
          </SectionLabel>
          <ProofOfPaymentsBlock
            invoice={majikInvoice}
            payments={(majikInvoice.payments ?? []) as ProofOfPayment[]}
            invoiceStatus={
              (majikInvoice.payload as any)?.invoice?.status ??
              generalInvoice?.status
            }
            invoiceCurrency={majikInvoice.public?.currency ?? "PHP"}
            invoiceTotal={majikInvoice.invoice.netPayableAmount}
            canEdit={canEdit}
            onAddPayment={props?.onAddPayment}
            onRemovePayment={props?.onRemovePayment}
            onClearPayments={props?.onClearPayments}
          />
        </>
      )}

      {/* ── 7. Integrity Panel — majik mode only ── */}
      {!isDraft && majikInvoice && (
        <>
          <Divider />
          <IntegrityPanel
            invoice={majikInvoice}
            readonly={readonly}
            onRequestPDFExport={() => setIsExportingPDF(true)}
            onRequestMJKIExport={handleExportMJKI}
            onSign={(props as any).onSign}
            onSeal={(props as any).onSeal}
            onVerify={(props as any).onVerify}
            onDecrypt={(props as any).onDecrypt}
            onSecureLock={(props as any).onSecureLock}
          />

          {showSignatureBlock && (
            <>
              <Divider />
              <SignatureBlock
                canSign={props?.canSign}
                onSign={(props as any)?.onSign}
                signerInfo={(props as any)?.signerInfo}
              />
            </>
          )}

          {(props as any).onCloseInvoice && (
            <>
              <Divider />
              <IssuerCloseBlock
                invoice={majikInvoice}
                isIssuer={!!(props as any).isIssuer}
                onCloseInvoice={(props as any).onCloseInvoice}
                canSeal={!!(props as any).canSeal}
                sealConfirmText={(props as any).sealConfirmText}
              />
            </>
          )}
        </>
      )}

      {/* ── PDF export dialog ── */}
      <InvoicePDFExportDialog
        invoices={majikInvoice ? [majikInvoice] : []}
        onExport={handleExportPDF}
        isOpen={isExportingPDF}
        onOpenChange={setIsExportingPDF}
      />
    </DocumentWrapper>
  );
};
