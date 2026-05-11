/**
 * AddReferenceModal.tsx
 *
 * Lightweight modal for adding a DocumentReference to an invoice.
 * Owns its own ref so MajikInvoiceDocument (and its future child components)
 * do not need to hold `invoiceReferenceRef` themselves.
 */

import React, { useCallback, useRef, useState } from "react";
import DynamicPopUp from "@/components/functional/DynamicPopUp";
import { InvoiceReferenceForm } from "@/components/panels/invoice/InvoiceReferenceForm";
import type { DocumentReference } from "@majikah/majik-invoice";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface AddReferenceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the completed DocumentReference when the user confirms. */
  onConfirm: (ref: DocumentReference) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const AddReferenceModal: React.FC<AddReferenceModalProps> = React.memo(
  ({ open, onOpenChange, onConfirm }) => {
    const pendingRef = useRef<DocumentReference | null>(null);
    const [isRefValid, setIsRefValid] = useState<boolean>(false);

    const handleClose = useCallback(() => {
      pendingRef.current = null;
      onOpenChange(false);
    }, [onOpenChange]);

    const handleConfirm = useCallback(() => {
      if (!pendingRef.current) return;
      onConfirm(pendingRef.current);
      pendingRef.current = null;
      onOpenChange(false);
    }, [onConfirm, onOpenChange]);

    const handleValid = useCallback((valid: boolean) => {
      setIsRefValid(valid);
    }, []);

    return (
      <DynamicPopUp
        scrollable
        isOpen={open}
        onOpenChange={(o) => {
          if (!o) handleClose();
        }}
        modal={{
          title: "Add Reference",
          description:
            "Add a reference to link this invoice with related documents such as purchase orders, contracts, or prior agreements. This helps provide context, traceability, and clearer documentation for both parties.",
        }}
        buttons={{
          cancel: {
            text: "Cancel",
            onClick: handleClose,
          },
          confirm: {
            text: "Add",
            onClick: handleConfirm,
            isDisabled: !isRefValid,
          },
        }}
      >
        <InvoiceReferenceForm
          onClose={handleClose}
          onChange={(v) => {
            pendingRef.current = v;
          }}
          onValidate={handleValid}
        />
      </DynamicPopUp>
    );
  },
);

AddReferenceModal.displayName = "AddReferenceModal";

export default AddReferenceModal;
