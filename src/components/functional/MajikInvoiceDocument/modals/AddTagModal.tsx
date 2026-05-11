/**
 * AddTagModal.tsx
 *
 * Lightweight modal for adding a single tag to an invoice.
 * Uses CustomInputField with `regex="alphanumeric-code"` to preserve
 * the same validation behaviour that MajikInvoiceDocument used inline.
 */

import React, { useCallback, useRef, useState } from "react";
import DynamicPopUp from "@/components/functional/DynamicPopUp";
import CustomInputField from "@/components/foundations/CustomInputField";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface AddTagModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the trimmed tag string when the user confirms. */
  onConfirm: (tag: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const AddTagModal: React.FC<AddTagModalProps> = React.memo(
  ({ open, onOpenChange, onConfirm }) => {
    const [value, setValue] = useState("");
    const valueRef = useRef("");

    const handleClose = useCallback(() => {
      setValue("");
      valueRef.current = "";
      onOpenChange(false);
    }, [onOpenChange]);

    const handleConfirm = useCallback(() => {
      const trimmed = valueRef.current.trim();
      if (!trimmed) return;
      onConfirm(trimmed);
      setValue("");
      valueRef.current = "";
      onOpenChange(false);
    }, [onConfirm, onOpenChange]);

    const handleChange = useCallback((v: string) => {
      setValue(v);
      valueRef.current = v;
    }, []);

    return (
      <DynamicPopUp
        scrollable
        isOpen={open}
        onOpenChange={(o) => {
          if (!o) handleClose();
        }}
        modal={{
          title: "Add Tag",
          description:
            "Add a tag to categorize and organize this invoice for easier filtering and retrieval.",
        }}
        buttons={{
          cancel: {
            text: "Cancel",
            onClick: handleClose,
          },
          confirm: {
            text: "Add",
            onClick: handleConfirm,
            isDisabled: !value.trim(),
          },
        }}
      >
        <CustomInputField
          label="Label / Name"
          onChange={handleChange}
          currentValue={value}
          maxChar={100}
          regex="alphanumeric-code"
        />
      </DynamicPopUp>
    );
  },
);

AddTagModal.displayName = "AddTagModal";

export default AddTagModal;
