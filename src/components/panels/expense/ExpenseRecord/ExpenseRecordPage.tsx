"use client";

/**
 * ExpenseRecordPage.tsx
 *
 * Versatile expense record renderer that accepts either a draft or
 * an approved/refunded ExpenseRecord.
 *
 * Mode discrimination:
 *   - `kind: "draft"`    → editable, changes fire onChange(updatedInput)
 *   - `kind: "view"`     → readonly display of any status
 *
 * Design contract:
 *   - Draft mode: onChange is called on every debounced field change
 *     with a partial ExpenseRecordInput patch.
 *   - View mode: the record is readonly; lifecycle actions (approve,
 *     markRefunded, addRefund, removeRefund, duplicate) are surfaced
 *     via optional callbacks when the caller provides them.
 *   - Refunds are always displayed; adding/removing refunds in view
 *     mode requires the record to be approved and the callbacks to
 *     be provided.
 *   - No crypto logic — ExpenseRecord is a pure domain object.
 *
 * Subcomponents used:
 *   ExpenseHeader, ExpenseParties, ExpenseDates, ExpenseLineItems,
 *   ExpenseTotals, ExpenseBIR, ExpenseRefunds, ExpenseReferences,
 *   ExpenseNotesAndTags, ExpenseActions
 */

import React, { useCallback, useEffect, useRef } from "react";
import styled, { css } from "styled-components";
import {
  CurrencyCircleDollarIcon,
  ReceiptIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";

import { ExpenseHeader } from "./ExpenseHeader";
import { ExpenseParties } from "./ExpenseParties";
import { ExpenseDates } from "./ExpenseDates";
import { ExpenseLineItems } from "./ExpenseLineItems";
import { ExpenseTotals } from "./ExpenseTotals";
import { ExpenseBIR } from "./ExpenseBIR";
import { ExpenseRefunds } from "./ExpenseRefunds";
import { ExpenseReferences } from "./ExpenseReferences";
import { ExpenseNotesAndTags } from "./ExpenseNotesAndTags";
import { ExpenseActions } from "./ExpenseActions";

import type {
  CurrencyCode,
  DocumentReference,
  ISODateString,
  LineItemInput,
  Party,
} from "@majikah/majik-invoice";
import { debounce } from "@/utils/utils"; // adjust import path
import { ExpenseRecord } from "@/SDK/majik-buwiz-client/src/core/expenses/expense-record";
import {
  BIRContext,
  ExpenseCategory,
  ExpenseDocumentType,
  ExpenseRecordInput,
  RefundRecord,
} from "@/SDK/majik-buwiz-client/src/core/expenses/types";

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
  max-width: 950px;
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
// Draft banner
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

// ---------------------------------------------------------------------------
// Props — discriminated union
// ---------------------------------------------------------------------------

export type ExpenseRecordPageProps =
  | {
      kind: "draft";
      /**
       * The ExpenseRecord being edited in draft mode.
       * Must be a draft-status record (status === "draft").
       */
      record: ExpenseRecord;
      /** Called on every debounced field change with a partial input patch. */
      onChange: (patch: Partial<ExpenseRecordInput>) => void;
    }
  | {
      kind: "view";
      /** Any ExpenseRecord — draft, approved, or refunded. */
      record: ExpenseRecord;
      /**
       * When provided and the record is a draft, enables editing.
       * Calls onEdit with the patch on every debounced field change.
       */
      onEdit?: (patch: Partial<ExpenseRecordInput>) => void;
      /** Approve the expense (draft → approved). */
      onApprove?: () => Promise<void> | void;
      /** Mark as fully refunded (approved → refunded). */
      onMarkRefunded?: () => Promise<void> | void;
      /** Record a partial/full refund event. */
      onAddRefund?: (refund: Omit<RefundRecord, "id">) => void;
      /** Remove a previously recorded refund by ID. */
      onRemoveRefund?: (refundId: string) => void;
      /** Create a copy of this record as a new draft. */
      onDuplicate?: () => Promise<void> | void;
    };

// ---------------------------------------------------------------------------
// Determine if a given props shape allows editing
// ---------------------------------------------------------------------------

function resolveCanEdit(props: ExpenseRecordPageProps): boolean {
  if (props.kind === "draft") return true;
  return (
    props.record.isDraft &&
    !!(props as Extract<ExpenseRecordPageProps, { kind: "view" }>).onEdit
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const ExpenseRecordPage: React.FC<ExpenseRecordPageProps> = (props) => {
  const { record } = props;
  console.debug("Rendering ExpenseRecordPage with record:", record);
  const canEdit = resolveCanEdit(props);
  const isDraft = props.kind === "draft";

  // ── Mutation helper ───────────────────────────────────────────────────────
  //
  // Collects patches from child components and flushes them as a single
  // debounced call to the parent's onChange / onEdit handler.
  // Mirrors the approach in MajikInvoiceDocument.
  // ─────────────────────────────────────────────────────────────────────────

  const pendingPatchRef = useRef<Partial<ExpenseRecordInput>>({});
  const latestRecordRef = useRef<ExpenseRecord>(record);

  const flushRef = useRef(
    debounce(() => {
      const patch = pendingPatchRef.current;
      pendingPatchRef.current = {};

      if (isDraft) {
        (props as Extract<ExpenseRecordPageProps, { kind: "draft" }>).onChange(
          patch,
        );
      } else {
        (props as Extract<ExpenseRecordPageProps, { kind: "view" }>).onEdit?.(
          patch,
        );
      }
    }, 150),
  );

  const updatePayload = useCallback(
    (patch: Partial<ExpenseRecordInput>) => {
      if (!canEdit) return;
      pendingPatchRef.current = { ...pendingPatchRef.current, ...patch };
      flushRef.current();
    },
    [canEdit],
  );

  useEffect(() => {
    latestRecordRef.current = record;
  }, [record]);

  useEffect(() => {
    return () => {
      flushRef.current.cancel();
    };
  }, []);

  // ── Stable field-level callbacks ──────────────────────────────────────────

  const handleDescriptionChange = useCallback(
    (v: string) => updatePayload({ description: v }),
    [updatePayload],
  );

  const handleDocumentTypeChange = useCallback(
    (v: ExpenseDocumentType) => updatePayload({ documentType: v }),
    [updatePayload],
  );

  const handleCategoryChange = useCallback(
    (v: ExpenseCategory) => {
      updatePayload({ category: v });
    },
    [updatePayload],
  );

  const handlePayeeChange = useCallback(
    (patch: Partial<Party>) => {
      const payee = {
        ...latestRecordRef.current.payee,
        ...patch,
        legalName:
          patch.legalName ?? latestRecordRef.current.payee.legalName ?? "",
      };
      updatePayload({ payee });
    },
    [updatePayload],
  );

  const handlePaidByChange = useCallback(
    (patch: Partial<Party>) => {
      const paidBy = {
        ...latestRecordRef.current.paidBy,
        ...patch,
        legalName:
          patch.legalName ?? latestRecordRef.current.paidBy.legalName ?? "",
      };
      updatePayload({ paidBy });
    },
    [updatePayload],
  );

  const handleExpenseDateChange = useCallback(
    (v: ISODateString) => updatePayload({ expenseDate: v }),
    [updatePayload],
  );

  const handlePaidAtChange = useCallback(
    (v: ISODateString | undefined) => updatePayload({ paidAt: v }),
    [updatePayload],
  );

  const handleCurrencyChange = useCallback(
    (v: CurrencyCode) => updatePayload({ currency: v }),
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
      const tags = latestRecordRef.current.tags ?? [];
      if (!tags.includes(tag)) updatePayload({ tags: [...tags, tag] });
    },
    [updatePayload],
  );

  const handleRemoveTag = useCallback(
    (i: number) => {
      const tags = (latestRecordRef.current.tags ?? []).filter(
        (_, idx) => idx !== i,
      );
      updatePayload({ tags });
    },
    [updatePayload],
  );

  const handleAddRef = useCallback(
    (ref: DocumentReference) => {
      const refs = [...(latestRecordRef.current.references ?? []), ref];
      updatePayload({ references: refs });
    },
    [updatePayload],
  );

  const handleRemoveRef = useCallback(
    (type: string, number: string) => {
      const refs = (latestRecordRef.current.references ?? []).filter(
        (r) => !(r.type === type && r.number === number),
      );
      updatePayload({ references: refs });
    },
    [updatePayload],
  );

  const handleBIRChange = useCallback(
    (patch: Partial<BIRContext>) => {
      const bir = { ...(latestRecordRef.current.bir ?? {}), ...patch };
      updatePayload({ bir });
    },
    [updatePayload],
  );

  const handleBIRAttach = useCallback(
    () => updatePayload({ bir: {} }),
    [updatePayload],
  );

  const handleBIRRemove = useCallback(
    () => updatePayload({ bir: undefined }),
    [updatePayload],
  );

  // ── Refund callbacks (view mode only) ─────────────────────────────────────

  const viewProps = !isDraft
    ? (props as Extract<ExpenseRecordPageProps, { kind: "view" }>)
    : null;

  const canAddRefund =
    !!viewProps?.onAddRefund && record.isApproved && !record.isRefunded;

  // ── Line items as input shape ─────────────────────────────────────────────

  const lineItemInputs: LineItemInput[] = (record.lineItems ?? []).map(
    (li) => ({ ...li }),
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <DocumentWrapper $readonly={!canEdit}>
      {/* ── Draft banner ── */}
      {isDraft && (
        <DraftBanner>
          <WarningCircleIcon
            size={13}
            weight="fill"
            style={{ flexShrink: 0, opacity: 0.6 }}
          />
          Draft — not yet approved. Changes are in-memory only and will not be
          stored until saved.
        </DraftBanner>
      )}

      {/* ── 1. Header ── */}
      <ExpenseHeader
        description={record.description}
        documentType={record.documentType}
        category={record.category}
        effectiveStatus={record.effectiveStatus}
        recordId={record.id}
        readonly={!canEdit}
        onDescriptionChange={handleDescriptionChange}
        onDocumentTypeChange={handleDocumentTypeChange}
        onCategoryChange={handleCategoryChange}
      />

      {/* ── 2. Parties ── */}
      <ExpenseParties
        payee={record.payee}
        paidBy={record.paidBy}
        readonly={!canEdit}
        onPayeeChange={handlePayeeChange}
        onPaidByChange={handlePaidByChange}
      />

      {/* ── 3. Dates & currency ── */}
      <ExpenseDates
        expenseDate={record.expenseDate}
        paidAt={record.paidAt}
        currency={record.currency}
        readonly={!canEdit}
        onExpenseDateChange={handleExpenseDateChange}
        onPaidAtChange={handlePaidAtChange}
        onCurrencyChange={handleCurrencyChange}
      />

      <Divider />

      {/* ── 4. Line items (optional) + Totals ── */}
      {(record.hasLineItems || canEdit) && (
        <ExpenseLineItems
          items={lineItemInputs}
          currency={record.currency}
          canEdit={canEdit}
          onChange={handleLineItemsChange}
        />
      )}

      <ExpenseTotals record={record} />

      <Divider />

      {/* ── 5. Tax breakdown column + References ── */}
      <TwoColGrid>
        <div>
          <SectionLabel>
            <ReceiptIcon size={11} weight="fill" />
            BIR Context
          </SectionLabel>
          <ExpenseBIR
            bir={record.bir}
            readonly={!canEdit}
            canEdit={canEdit}
            onBIRChange={handleBIRChange}
            onBIRAttach={handleBIRAttach}
            onBIRRemove={handleBIRRemove}
          />
        </div>

        <div>
          <SectionLabel>References</SectionLabel>
          <ExpenseReferences
            references={record.references ?? []}
            canEdit={canEdit}
            readonly={!canEdit}
            onAdd={handleAddRef}
            onRemove={handleRemoveRef}
          />
        </div>
      </TwoColGrid>

      <Divider />

      {/* ── 6. Notes & Tags ── */}
      <TwoColGrid>
        <div>
          <SectionLabel>Notes</SectionLabel>
        </div>
        <div>
          <SectionLabel>Tags</SectionLabel>
        </div>
        <ExpenseNotesAndTags
          notes={record.notes ?? ""}
          tags={record.tags ?? []}
          canEdit={canEdit}
          onNotesChange={handleNotesChange}
          onAddTag={handleAddTag}
          onRemoveTag={handleRemoveTag}
        />
      </TwoColGrid>

      {/* ── 7. Refunds (view mode, approved records) ── */}
      {!isDraft && (
        <>
          <Divider />
          <SectionLabel>
            <CurrencyCircleDollarIcon size={11} weight="fill" />
            Refunds
          </SectionLabel>
          <ExpenseRefunds
            refunds={record.refunds}
            currency={record.currency}
            refundableAmount={record.refundableAmount}
            isRefunded={record.isRefunded}
            canAddRefund={canAddRefund}
            onAddRefund={viewProps?.onAddRefund ?? (() => {})}
            onRemoveRefund={viewProps?.onRemoveRefund ?? (() => {})}
          />
        </>
      )}

      {/* ── 8. Lifecycle actions ── */}
      {!isDraft &&
        (viewProps?.onApprove ||
          viewProps?.onMarkRefunded ||
          viewProps?.onDuplicate) && (
          <>
            <Divider />
            <ExpenseActions
              status={record.status}
              isDraft={record.isDraft}
              isApproved={record.isApproved}
              isRefunded={record.isRefunded}
              onApprove={viewProps?.onApprove}
              onMarkRefunded={viewProps?.onMarkRefunded}
              onDuplicate={viewProps?.onDuplicate}
            />
          </>
        )}
    </DocumentWrapper>
  );
};
