// components/expenses/modals/LineItemTaxModal.tsx
import React, { useCallback, useRef, useState } from "react";
import DynamicPopUp from "@/components/functional/DynamicPopUp";
import type { LineItemInput } from "@majikah/majik-invoice";
import type { TaxDetail } from "@majikah/majik-invoice";
import { TaxManager } from "@majikah/majik-invoice";
import { LineItemTaxForm } from "../forms/LineItemTaxForm";


interface LineItemTaxModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lineItem: LineItemInput;
  currency: string;
  onSave: (updatedItem: LineItemInput) => void;
}

export const LineItemTaxModal: React.FC<LineItemTaxModalProps> = React.memo(
  ({ open, onOpenChange, lineItem, currency, onSave }) => {
    const [isValid, setIsValid] = useState(true);

    // Initialise from the line item's current taxes, normalised through
    // TaxManager so we always work with a clean TaxDetail[]
    const taxesRef = useRef<TaxDetail[]>(
      TaxManager.coerce(lineItem.taxes).toArray(),
    );

    const handleConfirm = useCallback(() => {
      onSave({ ...lineItem, taxes: taxesRef.current });
      onOpenChange(false);
    }, [lineItem, onSave, onOpenChange]);

    const handleTaxChange = useCallback((taxes: TaxDetail[]) => {
      taxesRef.current = taxes;
    }, []);

    return (
      <DynamicPopUp
        scrollable
        isOpen={open}
        onOpenChange={onOpenChange}
        modal={{
          title: "Edit Line Item Taxes",
          description: `Configure the taxes for "${lineItem.description || "this line item"}". Changes apply to this item only.`,
        }}
        buttons={{
          cancel: { text: "Cancel" },
          confirm: {
            text: "Apply",
            onClick: handleConfirm,
            isDisabled: !isValid,
          },
        }}
      >
        <LineItemTaxForm
          taxes={TaxManager.coerce(lineItem.taxes).toArray()}
          currency={currency}
          lineItem={lineItem}
          onChange={handleTaxChange}
          onValidate={setIsValid}
        />
      </DynamicPopUp>
    );
  },
);

LineItemTaxModal.displayName = "LineItemTaxModal";
