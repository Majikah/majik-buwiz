// ─────────────────────────────────────────────────────────────────────────────
// ClearPaymentModal
// ─────────────────────────────────────────────────────────────────────────────

import DynamicAlertBanner from "@/components/foundations/DynamicAlertBanner";
import DynamicPopUp from "@/components/functional/DynamicPopUp";
import { ProofOfPaymentsBlock } from "@/components/functional/MajikInvoiceDocument/ProofOfPayments";
import { MajikInvoice } from "@majikah/majik-invoice";
import React, { useCallback, useState } from "react";

interface ClearPaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: MajikInvoice;
  onConfirm: () => Promise<void>;
}

export const ClearPaymentModal: React.FC<ClearPaymentModalProps> = React.memo(
  ({ open, onOpenChange, invoice, onConfirm }) => {
    const [isClearing, setIsClearing] = useState(false);

    const handleConfirm = useCallback(async () => {
      if (!invoice) return;
      setIsClearing(true);
      try {
        await onConfirm();
        onOpenChange(false);
      } finally {
        setIsClearing(false);
      }
    }, [invoice, onConfirm, onOpenChange]);

    return (
      <DynamicPopUp
        scrollable
        isOpen={open}
        onOpenChange={onOpenChange}
        modal={{
          title: "Clear all payments?",
          description:
            "This will remove all recorded payments for this invoice, drop all existing signatures, and reissue it as a Sent invoice. Any partial or completed payments will be cleared.",
        }}
        buttons={{
          cancel: {
            text: "Cancel",
            isDisabled: isClearing,
          },
          confirm: {
            text: isClearing ? "Clearing…" : "Yes, Clear Payments",
            onClick: handleConfirm,
            isDisabled: !invoice || isClearing,
          },
        }}
      >
        <DynamicAlertBanner
          level="danger"
          title="This action cannot be undone"
          description="All payment records and signatures tied to this invoice will be permanently removed."
        />
        {!invoice.isLocked && (
          <ProofOfPaymentsBlock
            invoice={invoice}
            invoiceCurrency={invoice.public?.currency || "PHP"}
            payments={invoice.payments ?? []}
            canEdit={false}
          />
        )}
      </DynamicPopUp>
    );
  },
);

ClearPaymentModal.displayName = "ClearPaymentModal";
