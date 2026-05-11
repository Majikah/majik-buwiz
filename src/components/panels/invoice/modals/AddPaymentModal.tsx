// ─────────────────────────────────────────────────────────────────────────────
// AddPaymentModal
// ─────────────────────────────────────────────────────────────────────────────

import DynamicPopUp from "@/components/functional/DynamicPopUp";

import { MajikInvoice, ProofOfPayment } from "@majikah/majik-invoice";
import React, { useCallback, useRef, useState } from "react";
import { InvoicePaymentForm } from "../InvoicePaymentForm";

interface AddPaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: MajikInvoice;
  onConfirm: (proof: ProofOfPayment) => Promise<void>;
}

export const AddPaymentModal: React.FC<AddPaymentModalProps> = React.memo(
  ({ open, onOpenChange, invoice, onConfirm }) => {
    const [isAdding, setisAdding] = useState(false);
    const [paymentValid, setPaymentValid] = useState(false);

    const paymentProofRef = useRef<ProofOfPayment | null>(null);

    // ── Amount hints ──────────────────────────────────────────────────────────

    const invoiceTotal = invoice
      ? (() => {
          try {
            return invoice.invoice.totals.netPayable;
          } catch {
            return undefined;
          }
        })()
      : undefined;

    const amountPaid = invoice?.totalPaid;
    const amountRemaining =
      invoiceTotal !== undefined && amountPaid !== null
        ? invoiceTotal.subtract(amountPaid).toMajor()
        : undefined;

    const handleConfirm = useCallback(async () => {
      if (!invoice || !paymentProofRef.current) return;
      setisAdding(true);
      try {
        await onConfirm(paymentProofRef.current);
        onOpenChange(false);
      } finally {
        setisAdding(false);
      }
    }, [invoice, onConfirm, onOpenChange]);

    return (
      <DynamicPopUp
        scrollable
        isOpen={open}
        onOpenChange={onOpenChange}
        modal={{
          title: "Record Payment",
          description:
            "Log a payment for this invoice. You can record either a partial or full payment, and the invoice status will update automatically based on the total amount covered.",
        }}
        buttons={{
          cancel: {
            text: "Cancel",
            isDisabled: isAdding,
          },
          confirm: {
            text: isAdding ? "Processing…" : "Record Payment",
            onClick: handleConfirm,
            isDisabled: !invoice || isAdding || !paymentValid,
          },
        }}
      >
        <InvoicePaymentForm
          invoiceCurrency={invoice?.public.currency ?? "PHP"}
          invoiceTotal={invoiceTotal?.toMajor()}
          amountRemaining={amountRemaining}
          onChange={(proof) => {
            paymentProofRef.current = proof;
          }}
          onValidate={setPaymentValid}
        />
      </DynamicPopUp>
    );
  },
);

AddPaymentModal.displayName = "AddPaymentModal";
