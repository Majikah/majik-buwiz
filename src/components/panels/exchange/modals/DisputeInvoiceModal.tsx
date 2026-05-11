/**
 * DisputeInvoiceModal.tsx
 *
 * Dedicated dispute modal. Works for both single and bulk dispute.
 * Reason is required. For bulk, the same reason is applied to all invoices.
 * Only available to recipients.
 */

import React, { useCallback, useState } from "react";
import styled from "styled-components";
import { WarningCircleIcon } from "@phosphor-icons/react";
import type { MajikInvoice } from "@majikah/majik-invoice";
import DynamicPopUp from "@/components/functional/DynamicPopUp";

// ---------------------------------------------------------------------------
// Styled
// ---------------------------------------------------------------------------

const Body = styled.div`
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 2px 0 6px;
`;

const HeaderRow = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 12px;
`;

const IconWrap = styled.div`
  flex-shrink: 0;
  margin-top: 1px;
  color: ${({ theme }) => theme.colors.primary};
`;

const HeaderText = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const HeaderTitle = styled.div`
  font-family: ${({ theme }) => theme.typography.fonts.semibold};
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textPrimary};
`;

const HeaderSub = styled.div`
  font-family: ${({ theme }) => theme.typography.fonts.light};
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textSecondary};
  line-height: 1.6;
  opacity: 0.8;
`;

const BulkList = styled.ul`
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 12px;
  border-radius: ${({ theme }) => theme.borders.radius.medium};
  background: ${({ theme }) => theme.colors.primary}08;
  border: 1px solid ${({ theme }) => theme.colors.primary}22;
  margin: 0;
  list-style: none;
  max-height: 140px;
  overflow-y: auto;

  &::-webkit-scrollbar {
    width: 3px;
  }
  &::-webkit-scrollbar-thumb {
    background: ${({ theme }) => theme.colors.primary}30;
    border-radius: 4px;
  }
`;

const BulkItem = styled.li`
  font-family: ${({ theme }) => theme.typography.fonts.numbers};
  font-size: 11px;
  color: ${({ theme }) => theme.colors.primary};
  opacity: 0.85;

  &::before {
    content: "·  ";
    opacity: 0.5;
  }
`;

const ReasonLabel = styled.label`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const LabelRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const LabelText = styled.span`
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textSecondary};
`;

const RequiredBadge = styled.span`
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  font-size: 9.5px;
  padding: 1px 6px;
  border-radius: ${({ theme }) => theme.borders.radius.rounded};
  color: ${({ theme }) => theme.colors.primary};
  background: ${({ theme }) => theme.colors.primary}14;
  border: 1px solid ${({ theme }) => theme.colors.primary}28;
`;

const ReasonTextarea = styled.textarea<{ $hasError: boolean }>`
  width: 100%;
  min-height: 80px;
  resize: vertical;
  padding: 10px 12px;
  border-radius: ${({ theme }) => theme.borders.radius.medium};
  border: 1px solid
    ${({ $hasError, theme }) =>
      $hasError ? `${theme.colors.primary}55` : `${theme.colors.primary}22`};
  background: ${({ theme }) => theme.colors.secondaryBackground};
  color: ${({ theme }) => theme.colors.textPrimary};
  font-family: ${({ theme }) => theme.typography.fonts.light};
  font-size: 12px;
  line-height: 1.55;
  transition: border-color 0.14s;
  box-sizing: border-box;

  &::placeholder {
    color: ${({ theme }) => theme.colors.textSecondary};
    opacity: 0.45;
  }

  &:focus {
    outline: none;
    border-color: ${({ $hasError, theme }) =>
      $hasError ? `${theme.colors.primary}88` : `${theme.colors.primary}55`};
  }
`;

const CharHint = styled.span<{ $empty: boolean }>`
  font-family: ${({ theme }) => theme.typography.fonts.light};
  font-size: 10px;
  color: ${({ $empty, theme }) =>
    $empty ? theme.colors.primary : theme.colors.textSecondary};
  opacity: ${({ $empty }) => ($empty ? 1 : 0.55)};
  text-align: right;
`;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface DisputeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Single invoice or array for bulk dispute. */
  invoices: MajikInvoice | MajikInvoice[];
  /** Called with the required reason string (non-empty). */
  onConfirm: (reason: string) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const DisputeInvoiceModal: React.FC<DisputeModalProps> = React.memo(
  ({ open, onOpenChange, invoices, onConfirm }) => {
    const [reason, setReason] = useState("");
    const [touched, setTouched] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const isBulk = Array.isArray(invoices);
    const list: MajikInvoice[] = isBulk ? invoices : [invoices];

    const isEmpty = reason.trim().length === 0;
    const showError = touched && isEmpty;

    const handleClose = useCallback(() => {
      if (isSubmitting) return;
      setReason("");
      setTouched(false);
      onOpenChange(false);
    }, [isSubmitting, onOpenChange]);

    const handleConfirm = useCallback(async () => {
      setTouched(true);
      if (isEmpty) return;

      setIsSubmitting(true);
      try {
        await onConfirm(reason.trim());
        setReason("");
        setTouched(false);
        onOpenChange(false);
      } finally {
        setIsSubmitting(false);
      }
    }, [isEmpty, reason, onConfirm, onOpenChange]);

    const title = isBulk
      ? `Dispute ${list.length} Invoice${list.length !== 1 ? "s" : ""}`
      : "Raise a Dispute";

    const description = isBulk
      ? "All selected invoices will be disputed. The same reason will be recorded on each and the issuers will be notified."
      : "Describe the reason for your dispute. This will be recorded on the invoice and the issuer will be notified.";

    return (
      <DynamicPopUp
        scrollable
        isOpen={open}
        onOpenChange={(o) => {
          if (!o) handleClose();
        }}
        modal={{ title, description }}
        buttons={{
          cancel: {
            text: "Cancel",
            onClick: handleClose,
            isDisabled: isSubmitting,
          },
          confirm: {
            text: isSubmitting
              ? "Submitting…"
              : isBulk
                ? `Dispute ${list.length} Invoice${list.length !== 1 ? "s" : ""}`
                : "Submit Dispute",
            onClick: handleConfirm,
            isDisabled: isSubmitting || (touched && isEmpty) || !reason?.trim(),
          },
        }}
      >
        <Body>
          <HeaderRow>
            <IconWrap>
              <WarningCircleIcon size={28} weight="duotone" />
            </IconWrap>
            <HeaderText>
              <HeaderTitle>
                {isBulk
                  ? `${list.length} invoice${list.length !== 1 ? "s" : ""} will be disputed`
                  : `Invoice ${list[0]?.public?.invoiceNumber ?? list[0]?.id?.slice(0, 10)} will be disputed`}
              </HeaderTitle>
              <HeaderSub>
                {isBulk
                  ? "The issuer of each invoice will be able to see your dispute reason and respond."
                  : "The issuer will be able to see your dispute reason and respond by resolving or reissuing."}
              </HeaderSub>
            </HeaderText>
          </HeaderRow>

          {isBulk && (
            <BulkList>
              {list.map((inv) => (
                <BulkItem key={inv.id}>
                  {inv.public?.invoiceNumber ?? inv.id?.slice(0, 14)}
                </BulkItem>
              ))}
            </BulkList>
          )}

          <ReasonLabel>
            <LabelRow>
              <LabelText>Dispute reason</LabelText>
              <RequiredBadge>Required</RequiredBadge>
            </LabelRow>
            <ReasonTextarea
              $hasError={showError}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              onBlur={() => setTouched(true)}
              placeholder="e.g. Incorrect amount, services not rendered, duplicate billing…"
              disabled={isSubmitting}
            />
            {showError && (
              <CharHint $empty={true}>
                A reason is required to raise a dispute.
              </CharHint>
            )}
          </ReasonLabel>
        </Body>
      </DynamicPopUp>
    );
  },
);

DisputeInvoiceModal.displayName = "DisputeInvoiceModal";
