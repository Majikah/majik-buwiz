/**
 * DeleteInvoiceModal.tsx
 *
 * Dedicated void confirmation modal. Works for both single and bulk void.
 * Reason is optional. For bulk, the same reason is applied to all invoices.
 */

import React, { useCallback, useState } from "react";
import styled from "styled-components";
import type { MajikInvoice } from "@majikah/majik-invoice";
import DynamicPopUp from "@/components/functional/DynamicPopUp";
import { HardDrivesIcon, TrashIcon } from "@phosphor-icons/react";

// ---------------------------------------------------------------------------
// Delete modal body styles
// ---------------------------------------------------------------------------

const DeleteModalBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 4px 0 8px;
`;

const DeleteOption = styled.button`
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 14px;
  border-radius: ${({ theme }) => theme.borders.radius.medium};
  border: 1px solid ${({ theme }) => theme.colors.primary}18;
  background: transparent;
  cursor: pointer;
  text-align: left;
  transition: all 0.14s ease;
  width: 100%;

  &:hover {
    background: ${({ theme }) => theme.colors.primarySoft}55;
    border-color: ${({ theme }) => theme.colors.primary}33;
  }
`;

const DeleteOptionIcon = styled.div<{ $danger: boolean }>`
  color: ${({ $danger, theme }) =>
    $danger ? theme.colors.error : theme.colors.primary};
  flex-shrink: 0;
  margin-top: 1px;
`;

const DeleteOptionText = styled.div`
  display: flex;
  flex-direction: column;
  gap: 3px;
`;

const DeleteOptionTitle = styled.div<{ $danger?: boolean }>`
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  font-size: 12px;
  color: ${({ $danger, theme }) =>
    $danger ? theme.colors.error : theme.colors.textPrimary};
`;

const DeleteOptionSub = styled.div`
  font-family: ${({ theme }) => theme.typography.fonts.light};
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.7;
`;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface DeleteInvoiceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Single invoice or array for bulk void. */
  invoice: MajikInvoice;
  /** Called with the optional reason string (may be empty). */
  onConfirm: (removeLocally: boolean) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const DeleteInvoiceModal: React.FC<DeleteInvoiceModalProps> = React.memo(
  ({ open, onOpenChange, onConfirm }) => {
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleClose = useCallback(() => {
      if (isSubmitting) return;
      onOpenChange(false);
    }, [isSubmitting, onOpenChange]);

    const handleConfirm = useCallback(
      async (removeLocally: boolean) => {
        setIsSubmitting(true);
        try {
          await onConfirm(removeLocally);
          onOpenChange(false);
        } finally {
          setIsSubmitting(false);
        }
      },
      [onConfirm, onOpenChange],
    );

    return (
      <DynamicPopUp
        scrollable={false}
        isOpen={open}
        onOpenChange={(o) => {
          if (!o) handleClose();
        }}
        modal={{
          title: "Delete Invoice",
          description:
            "This will permanently remove the invoice from the cloud. This action cannot be undone.",
        }}
        buttons={{
          cancel: {
            text: "Cancel",
            onClick: handleClose,
            isDisabled: isSubmitting,
          },
          confirm: {
            text: "Delete from Cloud Only",
            onClick: () => handleConfirm(false),
            isDisabled: isSubmitting,
          },
        }}
      >
        <DeleteModalBody>
          <DeleteOption onClick={() => handleConfirm(false)}>
            <DeleteOptionIcon $danger={false}>
              <HardDrivesIcon size={16} weight="duotone" />
            </DeleteOptionIcon>
            <DeleteOptionText>
              <DeleteOptionTitle>Delete from Cloud only</DeleteOptionTitle>
              <DeleteOptionSub>
                The invoice remains in your local storage for reference.
              </DeleteOptionSub>
            </DeleteOptionText>
          </DeleteOption>

          <DeleteOption onClick={() => handleConfirm(true)}>
            <DeleteOptionIcon $danger>
              <TrashIcon size={16} weight="duotone" />
            </DeleteOptionIcon>
            <DeleteOptionText>
              <DeleteOptionTitle $danger>
                Delete from Cloud &amp; Local
              </DeleteOptionTitle>
              <DeleteOptionSub>
                Permanently removes the invoice everywhere. Cannot be recovered.
              </DeleteOptionSub>
            </DeleteOptionText>
          </DeleteOption>
        </DeleteModalBody>
      </DynamicPopUp>
    );
  },
);

DeleteInvoiceModal.displayName = "DeleteInvoiceModal";
