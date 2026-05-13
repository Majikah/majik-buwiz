"use client";

/**
 * ProofOfPaymentsBlock.tsx
 *
 * Displays all recorded ProofOfPayment entries for a MajikInvoice.
 *
 * Behaviours:
 *   - Shows a warning banner when invoice status is "paid" or "partial"
 *     but no payment records exist, with an inline "Add Payment" CTA.
 *   - Renders a summary card per payment entry with method, reference,
 *     settlement date, amount, and optional proof URL.
 *   - When `canEdit` is true, exposes an "Add Payment" button below the
 *     list (even when entries exist — supports multiple partial payments).
 *   - Integrates InvoicePaymentForm inside a DynamicPopUp modal.
 *   - Calls `onAddPayment(proof)` — the parent (InvoicePanel) is
 *     responsible for persisting the record to the MajikInvoice.
 */

import React, { useRef, useState } from "react";
import styled from "styled-components";
import {
  BankIcon,
  CheckCircleIcon,
  ClockIcon,
  CurrencyCircleDollarIcon,
  LinkSimpleIcon,
  PlusIcon,
  WarningCircleIcon,
  WalletIcon,
  TrashIcon,
} from "@phosphor-icons/react";

import type { MajikInvoice, ProofOfPayment } from "@majikah/majik-invoice";
import type { InvoiceStatus } from "@majikah/majik-invoice";

import DynamicPopUp from "../DynamicPopUp";
import { InvoicePaymentForm } from "@/components/panels/invoice/InvoicePaymentForm";
import ConfirmationButton from "@/components/foundations/ConfirmationButton";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PAYMENT_METHOD_META: Record<
  string,
  { label: string; icon: React.ReactNode }
> = {
  bank_transfer: {
    label: "Bank Transfer",
    icon: <BankIcon size={12} weight="fill" />,
  },
  wire: { label: "Wire Transfer", icon: <BankIcon size={12} weight="fill" /> },
  ewallet: {
    label: "E-Wallet",
    icon: <WalletIcon size={12} weight="fill" />,
  },
  cash: {
    label: "Cash",
    icon: <CurrencyCircleDollarIcon size={12} weight="fill" />,
  },
  check: {
    label: "Check",
    icon: <CurrencyCircleDollarIcon size={12} weight="fill" />,
  },
  credit_card: {
    label: "Credit Card",
    icon: <WalletIcon size={12} weight="fill" />,
  },
  debit_card: {
    label: "Debit Card",
    icon: <WalletIcon size={12} weight="fill" />,
  },
  crypto: {
    label: "Cryptocurrency",
    icon: <CurrencyCircleDollarIcon size={12} weight="fill" />,
  },
  paypal: {
    label: "PayPal",
    icon: <WalletIcon size={12} weight="fill" />,
  },
};

function getMethodMeta(method: string) {
  return (
    PAYMENT_METHOD_META[method] ?? {
      label:
        method.charAt(0).toUpperCase() + method.slice(1).replace(/_/g, " "),
      icon: <CurrencyCircleDollarIcon size={12} weight="fill" />,
    }
  );
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function fmtAmount(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

// ---------------------------------------------------------------------------
// Styled
// ---------------------------------------------------------------------------

// ── Warning banner ────────────────────────────────────────────────────────────

const MissingPaymentBanner = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 14px;
  border-radius: ${({ theme }) => theme.borders.radius.small};
  background: ${({ theme }) => theme.colors.error}0c;
  border: 1px solid ${({ theme }) => theme.colors.error}33;
  margin-bottom: ${({ theme }) => theme.spacing.medium};
`;

const BannerIcon = styled.div`
  flex-shrink: 0;
  color: ${({ theme }) => theme.colors.error};
  margin-top: 1px;
`;

const BannerBody = styled.div`
  flex: 1;
  min-width: 0;
`;

const BannerTitle = styled.div`
  font-family: ${({ theme }) => theme.typography.fonts.semibold};
  font-size: 12px;
  color: ${({ theme }) => theme.colors.error};
  margin-bottom: 2px;
`;

const BannerDesc = styled.div`
  font-family: ${({ theme }) => theme.typography.fonts.light};
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textSecondary};
  line-height: 1.5;
`;

const BannerAction = styled.button`
  flex-shrink: 0;
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  font-size: 11px;
  padding: 5px 11px;
  border-radius: ${({ theme }) => theme.borders.radius.small};
  background: ${({ theme }) => theme.colors.error}14;
  border: 1px solid ${({ theme }) => theme.colors.error}44;
  color: ${({ theme }) => theme.colors.error};
  cursor: pointer;
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  transition: background ${({ theme }) => theme.animations.duration.short};
  align-self: center;

  &:hover {
    background: ${({ theme }) => theme.colors.error}22;
  }
`;

// ── Entry list ────────────────────────────────────────────────────────────────

const EntryList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const EntryCard = styled.div`
  border: 1px solid ${({ theme }) => theme.colors.primary}18;
  border-radius: ${({ theme }) => theme.borders.radius.medium};
  padding: 10px 12px;
  background: ${({ theme }) => theme.colors.secondaryBackground};
  display: flex;
  align-items: center;
  gap: 10px;

  /* Reveal the remove button on hover */
  &:hover > [data-remove] {
    opacity: 1;
    pointer-events: auto;
  }
`;

// NEW — sits at the far right, hidden until EntryCard is hovered
const EntryRemoveButton = styled.div`
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: ${({ theme }) => theme.borders.radius.small};
  border: none;
  background: ${({ theme }) => theme.colors.error}14;
  color: ${({ theme }) => theme.colors.error};
  cursor: pointer;
  opacity: 0;
  pointer-events: none;
  transition:
    opacity ${({ theme }) => theme.animations.duration.short},
    background ${({ theme }) => theme.animations.duration.short};

  &:hover {
    background: ${({ theme }) => theme.colors.error}28;
  }
`;

const EntryIconWrap = styled.div`
  flex-shrink: 0;
  width: 30px;
  height: 30px;
  border-radius: ${({ theme }) => theme.borders.radius.small};
  background: ${({ theme }) => theme.colors.primarySoft};
  color: ${({ theme }) => theme.colors.primary};
  display: flex;
  align-items: center;
  justify-content: center;
`;

const EntryMain = styled.div`
  flex: 1;
  min-width: 0;
`;

const EntryMethodRow = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 2px;
`;

const EntryMethod = styled.span`
  font-family: ${({ theme }) => theme.typography.fonts.semibold};
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textPrimary};
`;

const EntryRef = styled.span`
  font-family: ${({ theme }) => theme.typography.fonts.numbers};
  font-size: 10px;
  color: ${({ theme }) => theme.colors.textSecondary};
  background: ${({ theme }) => theme.colors.primarySoft};
  padding: 1px 6px;
  border-radius: ${({ theme }) => theme.borders.radius.rounded};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 180px;
`;

const EntryMeta = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
`;

const EntryMetaItem = styled.span`
  font-family: ${({ theme }) => theme.typography.fonts.light};
  font-size: 10px;
  color: ${({ theme }) => theme.colors.textSecondary};
  display: inline-flex;
  align-items: center;
  gap: 3px;
`;

const EntryProofLink = styled.a`
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  font-size: 10px;
  color: ${({ theme }) => theme.colors.primary};
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  opacity: 0.7;

  &:hover {
    opacity: 1;
    text-decoration: underline;
  }
`;

const EntryAmountCol = styled.div`
  flex-shrink: 0;
  text-align: right;
`;

const EntryAmount = styled.div`
  font-family: ${({ theme }) => theme.typography.fonts.numbers};
  font-size: 13px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.brand?.green ?? "#2D8C5E"};
`;

const EntrySettledBadge = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  font-size: 9px;
  color: ${({ theme }) => theme.colors.brand?.green ?? "#2D8C5E"};
  margin-top: 2px;
  justify-content: flex-end;
`;

// ── Empty state ───────────────────────────────────────────────────────────────

const EmptyNote = styled.div`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.5;
  padding: 4px 0 8px;
`;

// ── Summary row ───────────────────────────────────────────────────────────────

const SummaryRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 10px;
  margin-top: 4px;
  border-top: 1px solid ${({ theme }) => theme.colors.primary}12;
`;

const SummaryLabel = styled.span`
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textSecondary};
`;

const SummaryAmount = styled.span<{ $overpaid?: boolean }>`
  font-family: ${({ theme }) => theme.typography.fonts.numbers};
  font-size: 12px;
  font-weight: 600;
  color: ${({ theme, $overpaid }) =>
    $overpaid ? theme.colors.error : (theme.colors.brand?.green ?? "#2D8C5E")};
`;

// ── Add button ────────────────────────────────────────────────────────────────

const AddPaymentButton = styled.button`
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  font-size: 11px;
  color: ${({ theme }) => theme.colors.primary};
  border: none;
  background: none;
  cursor: pointer;
  padding: 5px 0;
  margin-top: 6px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  transition: opacity ${({ theme }) => theme.animations.duration.short};

  &:hover {
    opacity: 0.7;
  }

  &:disabled {
    display: none;
  }
`;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ProofOfPaymentsBlockProps {
  invoice: MajikInvoice;
  payments: ProofOfPayment[];
  invoiceStatus?: InvoiceStatus;
  invoiceCurrency: string;
  /** Grand total in major units — used for remaining calculation */
  invoiceTotal?: number;
  /** When true, "Add payment" affordance is shown */
  canEdit?: boolean;
  /** Called with the new ProofOfPayment the parent should persist */
  onAddPayment?: (proof: ProofOfPayment) => void;
  onRemovePayment?: (proof: ProofOfPayment) => void;
  onClearPayments?: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const ProofOfPaymentsBlockComponent: React.FC<ProofOfPaymentsBlockProps> = ({
  invoice,
  payments,
  invoiceStatus,
  invoiceCurrency,
  invoiceTotal,
  canEdit = false,
  onAddPayment,
  onRemovePayment,
  onClearPayments,
}) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [paymentValid, setPaymentValid] = useState(false);
  const paymentProofRef = useRef<ProofOfPayment | null>(null);

  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  const amountRemaining =
    invoiceTotal !== undefined
      ? Math.max(0, invoiceTotal - totalPaid)
      : undefined;

  // Status is "paid" or "partial" but zero records — warn
  const isMissingProof =
    (invoiceStatus === "paid" || invoiceStatus === "partial") &&
    payments.length === 0;

  const handleConfirm = () => {
    if (!paymentProofRef.current) return;
    onAddPayment?.(paymentProofRef.current);
    paymentProofRef.current = null;
    setPaymentValid(false);
    setModalOpen(false);
  };

  const handleCancel = () => {
    paymentProofRef.current = null;
    setPaymentValid(false);
    setModalOpen(false);
  };

  // Derive whether this looks like a partial payment intent
  const isPartialIntent =
    invoiceStatus === "partial" ||
    (amountRemaining !== undefined && amountRemaining > 0 && totalPaid > 0);

  return (
    <>
      {/* ── Missing proof warning ── */}
      {isMissingProof && (
        <MissingPaymentBanner>
          <BannerIcon>
            <WarningCircleIcon size={15} weight="fill" />
          </BannerIcon>
          <BannerBody>
            <BannerTitle>No payment records found</BannerTitle>
            <BannerDesc>
              This invoice is marked as <strong>{invoiceStatus}</strong> but has
              no recorded proof of payment. Add a payment record to document
              this transaction.
            </BannerDesc>
          </BannerBody>
          {canEdit && onAddPayment && (
            <BannerAction onClick={() => setModalOpen(true)}>
              <PlusIcon size={11} weight="bold" />
              Add Payment
            </BannerAction>
          )}
        </MissingPaymentBanner>
      )}

      {/* ── Entry list ── */}
      <EntryList>
        {payments.length === 0 && !isMissingProof ? (
          <EmptyNote>No payment records.</EmptyNote>
        ) : (
          payments.map((pop, i) => {
            const meta = getMethodMeta(pop.method);
            return (
              <EntryCard key={pop.id ?? i}>
                <EntryIconWrap>{meta.icon}</EntryIconWrap>

                <EntryMain>
                  <EntryMethodRow>
                    <EntryMethod data-private>{meta.label}</EntryMethod>
                    <EntryRef title={pop.reference} data-private>
                      {pop.reference}
                    </EntryRef>
                  </EntryMethodRow>
                  <EntryMeta>
                    <EntryMetaItem>
                      <ClockIcon size={9} />
                      {fmtDate(pop.settledAt)}
                    </EntryMetaItem>
                    {pop.proofUrl && (
                      <EntryProofLink
                        href={pop.proofUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        data-private
                      >
                        <LinkSimpleIcon size={9} />
                        Proof
                      </EntryProofLink>
                    )}
                  </EntryMeta>
                </EntryMain>

                <EntryAmountCol>
                  <EntryAmount data-private>
                    {fmtAmount(pop.amount, pop.currency)}
                  </EntryAmount>
                  <EntrySettledBadge>
                    <CheckCircleIcon size={9} weight="fill" />
                    settled
                  </EntrySettledBadge>
                </EntryAmountCol>
                {onRemovePayment && canEdit && (
                  <EntryRemoveButton data-remove>
                    <ConfirmationButton
                      onClick={() => onRemovePayment?.(pop)}
                      strict
                      alertTextTitle="Remove Payment"
                      descriptionText="Are you sure you want to remove this payment?"
                      type="icon"
                      icon={{
                        icon: TrashIcon,
                        size: 24,
                      }}
                      text="Clear Payments"
                      disabled={!canEdit || !onRemovePayment}
                    />
                  </EntryRemoveButton>
                )}
              </EntryCard>
            );
          })
        )}
      </EntryList>

      {/* ── Paid total summary (when multiple entries) ── */}
      {payments.length > 1 && invoiceTotal !== undefined && (
        <SummaryRow>
          <SummaryLabel>Total paid</SummaryLabel>
          <SummaryAmount $overpaid={totalPaid > invoiceTotal} data-private>
            {fmtAmount(totalPaid, invoiceCurrency)}
            {totalPaid > invoiceTotal && " (overpaid)"}
          </SummaryAmount>
        </SummaryRow>
      )}

      {/* ── Add payment button (non-warning path) ── */}
      {canEdit && onAddPayment && !isMissingProof && (
        <AddPaymentButton
          onClick={() => setModalOpen(true)}
          disabled={!!invoice.isFullyPaid}
        >
          <PlusIcon size={11} weight="bold" /> Add payment
        </AddPaymentButton>
      )}

      {/* ──Clear payments button  ── */}
      <SummaryRow>
        {canEdit &&
          onClearPayments &&
          !!invoice.payments &&
          invoice.payments.length > 0 && (
            <ConfirmationButton
              onClick={() => onClearPayments()}
              strict
              alertTextTitle="Clear Payments"
              requiredText={"CLEAR ALL PAYMENTS"}
              type="action"
              icon={{
                icon: TrashIcon,
                size: 24,
              }}
              text="Clear Payments"
            />
          )}
      </SummaryRow>

      {/* ── Payment modal ── */}
      <DynamicPopUp
        scrollable
        isOpen={modalOpen}
        onOpenChange={(open) => {
          if (!open) handleCancel();
        }}
        modal={{
          title: isPartialIntent ? "Record Partial Payment" : "Record Payment",
          description: isPartialIntent
            ? "Log a partial payment. The invoice status will update automatically based on the total amount covered."
            : "Record the full payment details. The invoice will be marked as paid once the total is covered.",
        }}
        buttons={{
          cancel: { text: "Cancel", onClick: handleCancel },
          confirm: {
            text: "Record Payment",
            onClick: handleConfirm,
            isDisabled: !paymentValid,
          },
        }}
      >
        <InvoicePaymentForm
          invoiceCurrency={invoiceCurrency}
          invoiceTotal={invoiceTotal}
          amountRemaining={amountRemaining}
          onChange={(proof) => {
            paymentProofRef.current = proof;
          }}
          onValidate={setPaymentValid}
        />
      </DynamicPopUp>
    </>
  );
};

export const ProofOfPaymentsBlock = React.memo(ProofOfPaymentsBlockComponent);
