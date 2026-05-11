/**
 * VoidInvoiceModal.tsx
 *
 * Dedicated void confirmation modal. Works for both single and bulk void.
 * Reason is optional. For bulk, the same reason is applied to all invoices.
 */

import React, { useCallback, useState } from "react";
import styled from "styled-components";
import { ProhibitIcon } from "@phosphor-icons/react";
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
  color: ${({ theme }) => theme.colors.error};
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
  background: ${({ theme }) => theme.colors.error}08;
  border: 1px solid ${({ theme }) => theme.colors.error}20;
  margin: 0;
  list-style: none;
  max-height: 140px;
  overflow-y: auto;

  &::-webkit-scrollbar {
    width: 3px;
  }
  &::-webkit-scrollbar-thumb {
    background: ${({ theme }) => theme.colors.error}30;
    border-radius: 4px;
  }
`;

const BulkItem = styled.li`
  font-family: ${({ theme }) => theme.typography.fonts.numbers};
  font-size: 11px;
  color: ${({ theme }) => theme.colors.error};
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

const LabelText = styled.span`
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textSecondary};
`;

const ReasonTextarea = styled.textarea`
  width: 100%;
  min-height: 72px;
  resize: vertical;
  padding: 10px 12px;
  border-radius: ${({ theme }) => theme.borders.radius.medium};
  border: 1px solid ${({ theme }) => theme.colors.primary}22;
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
    border-color: ${({ theme }) => theme.colors.primary}55;
  }
`;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface VoidInvoiceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Single invoice or array for bulk void. */
  invoices: MajikInvoice | MajikInvoice[];
  /** Called with the optional reason string (may be empty). */
  onConfirm: (reason: string) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const VoidInvoiceModal: React.FC<VoidInvoiceModalProps> = React.memo(
  ({ open, onOpenChange, invoices, onConfirm }) => {
    const [reason, setReason] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const isBulk = Array.isArray(invoices);
    const list: MajikInvoice[] = isBulk ? invoices : [invoices];

    const handleClose = useCallback(() => {
      if (isSubmitting) return;
      setReason("");
      onOpenChange(false);
    }, [isSubmitting, onOpenChange]);

    const handleConfirm = useCallback(async () => {
      setIsSubmitting(true);
      try {
        await onConfirm(reason.trim());
        setReason("");
        onOpenChange(false);
      } finally {
        setIsSubmitting(false);
      }
    }, [reason, onConfirm, onOpenChange]);

    const title = isBulk
      ? `Void ${list.length} Invoice${list.length !== 1 ? "s" : ""}`
      : "Void Invoice";

    const description = isBulk
      ? "All selected invoices will be voided. The same reason will be applied to each. This action cannot be undone."
      : "Voiding this invoice will mark it as cancelled. The issuer may restart it if needed.";

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
              ? "Voiding…"
              : isBulk
                ? `Void ${list.length} Invoice${list.length !== 1 ? "s" : ""}`
                : "Void Invoice",
            onClick: handleConfirm,
            isDisabled: isSubmitting,
          },
        }}
      >
        <Body>
          <HeaderRow>
            <IconWrap>
              <ProhibitIcon size={28} weight="duotone" />
            </IconWrap>
            <HeaderText>
              <HeaderTitle>
                {isBulk
                  ? `${list.length} invoice${list.length !== 1 ? "s" : ""} will be voided`
                  : `Invoice ${list[0]?.public?.invoiceNumber ?? list[0]?.id?.slice(0, 10)} will be voided`}
              </HeaderTitle>
              <HeaderSub>
                {isBulk
                  ? "Recipients will see these invoices as void. The issuer can restart any of them individually."
                  : "The recipient will see this invoice as void. You may restart it at any time."}
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
            <LabelText>Reason (optional)</LabelText>
            <ReasonTextarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Duplicate invoice, billing error… (optional)"
              disabled={isSubmitting}
            />
          </ReasonLabel>
        </Body>
      </DynamicPopUp>
    );
  },
);

VoidInvoiceModal.displayName = "VoidInvoiceModal";
