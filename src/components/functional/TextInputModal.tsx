/**
 * TextInputModal.tsx
 *
 * Reusable modal wrapper around:
 *  - DynamicPopUp
 *  - CustomFormInput
 *
 * Features:
 *  - Internal isolated input state
 *  - Validation support
 *  - Character count
 *  - Loading state
 *  - Reset on open
 *  - Optimized rerender boundary
 *
 * Usage:
 *
 * <TextInputModal
 *   open={reasonModalOpen}
 *   loading={isReasonModalSubmitting}
 *   title="Raise Dispute"
 *   description="Explain the dispute reason."
 *   placeholder="Type reason..."
 *   confirmText="Submit"
 *   required
 *   onClose={closeReasonModal}
 *   onConfirm={async (value) => {
 *     await majik.disputeInvoice(invoice, value);
 *   }}
 * />
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";

import styled from "styled-components";

import DynamicPopUp from "../functional/DynamicPopUp";
import CustomFormInput from "../foundations/CustomFormInput";

// ---------------------------------------------------------------------------
// Styled
// ---------------------------------------------------------------------------

const Body = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const CharacterCount = styled.div`
  font-size: 10px;
  font-family: ${({ theme }) => theme.typography.fonts.light};
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.5;
  text-align: right;
`;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TextInputModalProps {
  open: boolean;

  title: string;
  description?: string;

  placeholder?: string;

  confirmText?: string;
  cancelText?: string;

  required?: boolean;

  loading?: boolean;

  maxChar?: number;

  initialValue?: string;

  onClose: () => void;

  onConfirm: (value: string) => Promise<void> | void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const TextInputModal: React.FC<TextInputModalProps> = React.memo(
  ({
    open,
    title,
    description,
    placeholder,

    confirmText = "Confirm",
    cancelText = "Cancel",

    required = false,

    loading = false,

    maxChar = 1000,

    initialValue = "",

    onClose,
    onConfirm,
  }) => {
    const [value, setValue] = useState(initialValue);
    const [valid, setValid] = useState(!required);

    // -----------------------------------------------------------------------
    // Reset state whenever modal opens
    // -----------------------------------------------------------------------

    useEffect(() => {
      if (open) {
        setValue(initialValue);
        setValid(!required || initialValue.trim().length > 0);
      }
    }, [open, initialValue, required]);

    // -----------------------------------------------------------------------
    // Handlers
    // -----------------------------------------------------------------------

    const handleConfirm = useCallback(async () => {
      await onConfirm(value.trim());
    }, [onConfirm, value]);

    const handleOpenChange = useCallback(
      (next: boolean) => {
        if (!next && !loading) {
          onClose();
        }
      },
      [loading, onClose],
    );

    // -----------------------------------------------------------------------
    // Derived
    // -----------------------------------------------------------------------

    const charCount = useMemo(() => value.trim().length, [value]);

    const confirmDisabled = useMemo(() => {
      if (loading) return true;

      if (required) {
        return !valid || !value.trim();
      }

      return false;
    }, [loading, required, valid, value]);

    // -----------------------------------------------------------------------
    // Render
    // -----------------------------------------------------------------------

    return (
      <DynamicPopUp
        isOpen={open}
        onOpenChange={handleOpenChange}
        modal={{
          title,
          description: description ?? "",
        }}
        buttons={{
          cancel: {
            text: cancelText,
            onClick: onClose,
            isDisabled: loading,
          },

          confirm: {
            text: loading ? "Submitting..." : confirmText,
            onClick: handleConfirm,
            isDisabled: confirmDisabled,
          },
        }}
      >
        <Body>
          <CustomFormInput
            label={title}
            value={value}
            onChange={(v) => setValue(v as string)}
            onValidated={setValid}
            placeholder={placeholder}
            required={required}
            disabled={loading}
            maxChar={maxChar}
            layout="stack"
          />

          <CharacterCount>
            {charCount}/{maxChar} characters
          </CharacterCount>
        </Body>
      </DynamicPopUp>
    );
  },
);

TextInputModal.displayName = "TextInputModal";

export default TextInputModal;
