// ─────────────────────────────────────────────────────────────────────────────
// AddRefundModal
// ─────────────────────────────────────────────────────────────────────────────

import React, { useCallback, useRef, useState } from "react";
import DynamicPopUp from "@/components/functional/DynamicPopUp";
import { ExpenseRecord } from "@/SDK/majik-buwiz-client/src/core/expenses/expense-record";
import { RefundRecord } from "@/SDK/majik-buwiz-client/src/core/expenses/types";
import { ExpenseRefundForm } from "../forms/ExpenseRefundForm";

interface AddRefundModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expense: ExpenseRecord;
  onConfirm: (refund: Omit<RefundRecord, "id">) => Promise<void>;
}

export const AddRefundModal: React.FC<AddRefundModalProps> = React.memo(
  ({ open, onOpenChange, expense, onConfirm }) => {
    const [isAdding, setIsAdding] = useState(false);
    const [refundValid, setRefundValid] = useState(false);

    const refundRecordRef = useRef<Omit<RefundRecord, "id"> | null>(null);

    // ── Amount hints ──────────────────────────────────────────────────────────
    // Both are plain numbers on ExpenseRecord — no Money wrapper, no .toMajor()
    // refundableAmount already accounts for prior refunds: max(0, total - refunded)

    const { totalAmount, refundableAmount, currency } = expense;

    // ── Confirm ───────────────────────────────────────────────────────────────

    const handleConfirm = useCallback(async () => {
      if (!refundRecordRef.current) return;
      setIsAdding(true);
      try {
        await onConfirm(refundRecordRef.current);
        onOpenChange(false);
      } finally {
        setIsAdding(false);
      }
    }, [onConfirm, onOpenChange]);

    // ── Render ────────────────────────────────────────────────────────────────

    return (
      <DynamicPopUp
        scrollable
        isOpen={open}
        onOpenChange={onOpenChange}
        modal={{
          title: "Record Refund",
          description:
            "Log a refund for this expense. Partial refunds are supported — the expense status will update automatically based on the total amount refunded.",
        }}
        buttons={{
          cancel: {
            text: "Cancel",
            isDisabled: isAdding,
          },
          confirm: {
            text: isAdding ? "Processing…" : "Record Refund",
            onClick: handleConfirm,
            isDisabled: isAdding || !refundValid,
          },
        }}
      >
        <ExpenseRefundForm
          displayCurrency={currency}
          expenseTotal={totalAmount}
          amountRemaining={refundableAmount}
          onChange={(refund) => {
            refundRecordRef.current = refund;
          }}
          onValidate={setRefundValid}
        />
      </DynamicPopUp>
    );
  },
);

AddRefundModal.displayName = "AddRefundModal";
