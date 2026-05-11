/**
 * modals/ConfirmationModals.tsx
 *
 * Groups simple confirmation-style modals that have minimal or no internal
 * form state.  Each is memoized and only re-renders when its own props change.
 */

import React, { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

import { MajikUniversalID } from "@majikah/majik-universal-id";
import { MajikBuwizDatabase } from "@/components/majik-context-wrapper/majik-buwiz-database";
import { MajikInvoiceContactMeta } from "@/SDK/majik-buwiz-client/src/core/party/types";
import DynamicPopUp from "@/components/functional/DynamicPopUp";
import DynamicAlertBanner from "@/components/foundations/DynamicAlertBanner";
import InvoiceContactSettings from "@/components/panels/invoice/InvoiceContactSettings";

// ─────────────────────────────────────────────────────────────────────────────
// RemoveKeyModal
// ─────────────────────────────────────────────────────────────────────────────

interface RemoveKeyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void>;
}

export const RemoveKeyModal: React.FC<RemoveKeyModalProps> = React.memo(
  ({ open, onOpenChange, onConfirm }) => {
    const [isRemoving, setIsRemoving] = useState(false);

    const handleConfirm = useCallback(async () => {
      setIsRemoving(true);
      try {
        await onConfirm();
        onOpenChange(false);
      } finally {
        setIsRemoving(false);
      }
    }, [onConfirm, onOpenChange]);

    return (
      <DynamicPopUp
        scrollable
        isOpen={open}
        onOpenChange={onOpenChange}
        modal={{
          title: "Remove Key Account",
          description:
            "This removes your local Majik Key account from this device. Your MUID and online identity remain intact — you can re-import this account at any time using your seed backup.",
        }}
        buttons={{
          cancel: { text: "Cancel", isDisabled: isRemoving },
          confirm: {
            text: isRemoving ? "Removing…" : "Remove Account",
            onClick: handleConfirm,
            isDisabled: isRemoving,
          },
        }}
      >
        <DynamicAlertBanner
          level="danger"
          title="Warning"
          description="Make sure you have your backup ZIP before continuing. Without it you will not be able to re-import this account."
        />
      </DynamicPopUp>
    );
  },
);

RemoveKeyModal.displayName = "RemoveKeyModal";

// ─────────────────────────────────────────────────────────────────────────────
// DeleteUIDModal
// ─────────────────────────────────────────────────────────────────────────────

interface DeleteUIDModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  uid: MajikUniversalID | null;
  onConfirm: () => Promise<void>;
}

export const DeleteUIDModal: React.FC<DeleteUIDModalProps> = React.memo(
  ({ open, onOpenChange, uid, onConfirm }) => {
    const [isDeleting, setIsDeleting] = useState(false);
    const isVerified = uid?.isVerified ?? false;

    const handleConfirm = useCallback(async () => {
      if (!uid) return;
      setIsDeleting(true);
      try {
        await onConfirm();
        onOpenChange(false);
      } finally {
        setIsDeleting(false);
      }
    }, [uid, onConfirm, onOpenChange]);

    return (
      <DynamicPopUp
        scrollable
        isOpen={open}
        onOpenChange={onOpenChange}
        modal={{
          title: isVerified ? "Revoke Universal ID?" : "Delete Universal ID?",
          description: isVerified
            ? "This permanently revokes your verified Universal ID. Your tier, verification history, and bound key will be lost. This cannot be undone."
            : "This deletes your Universal ID. The setup wizard will open so you can recreate it with updated information.",
        }}
        buttons={{
          cancel: { text: "Cancel", isDisabled: isDeleting },
          confirm: {
            text: isDeleting
              ? isVerified
                ? "Revoking…"
                : "Deleting…"
              : isVerified
                ? "Yes, Revoke"
                : "Yes, Delete",
            onClick: handleConfirm,
            isDisabled: !uid || isDeleting,
          },
        }}
      >
        {isVerified ? (
          <DynamicAlertBanner
            level="danger"
            title="Irreversible"
            description="Your verified identity and all trust signals will be permanently destroyed."
          />
        ) : (
          <DynamicAlertBanner
            level="info"
            title="Info"
            description="The setup wizard will open automatically after deletion."
          />
        )}
      </DynamicPopUp>
    );
  },
);

DeleteUIDModal.displayName = "DeleteUIDModal";

// ─────────────────────────────────────────────────────────────────────────────
// EditMetaModal
// ─────────────────────────────────────────────────────────────────────────────

interface EditMetaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  majik: MajikBuwizDatabase;
  initialMeta: MajikInvoiceContactMeta | null;
  accountId: string | null;
  onSuccess: () => void;
}

export const EditMetaModal: React.FC<EditMetaModalProps> = React.memo(
  ({ open, onOpenChange, majik, initialMeta, accountId, onSuccess }) => {
    const metaRef = useRef<MajikInvoiceContactMeta | null>(initialMeta);
    const [isValid, setIsValid] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Sync ref when initialMeta changes (modal opened with new account)
    React.useEffect(() => {
      metaRef.current = initialMeta;
    }, [initialMeta]);

    const handleConfirm = useCallback(async () => {
      const finalMeta = metaRef.current;
      if (!accountId || !isValid || !finalMeta) return;
      setIsSaving(true);
      try {
        await majik.updateContactMeta(accountId, finalMeta);
        const defaults = (await majik.getInvoiceDefaults()) ?? {
          currency: "PHP",
          defaultTaxes: [{ rate: 0.12, taxType: "VAT", jurisdiction: "PH" }],
          paymentTerms: "net30",
          invoiceNumberPrefix: "INV-",
          invoiceNumberCounter: 1,
        };
        await majik.setInvoiceDefaults({
          ...defaults,
          issuer: {
            ...defaults.issuer,
            address: finalMeta.address,
            email: finalMeta.email,
            legalName: finalMeta.legalName,
            natureOfBusiness: finalMeta.natureOfBusiness,
            tin: finalMeta.tin,
            tradeName: finalMeta.tradeName,
            taxIdType: finalMeta.taxIdType,
            phone: finalMeta.phone,
            taxExempt: finalMeta.taxExempt,
            taxExemptRef: finalMeta.taxExemptRef,
            website: finalMeta.website,
          },
        });
        toast.success("Account metadata saved");
        onOpenChange(false);
        onSuccess();
      } catch (err) {
        console.error(err);
        toast.error("Failed to save metadata", { description: `${err}` });
      } finally {
        setIsSaving(false);
      }
    }, [accountId, isValid, majik, onOpenChange, onSuccess]);

    return (
      <DynamicPopUp
        scrollable
        isOpen={open}
        onOpenChange={onOpenChange}
        modal={{
          title: "Edit Account Metadata",
          description: "Edit the full metadata for this account.",
        }}
        buttons={{
          cancel: {
            text: "Cancel",
            onClick: () => onOpenChange(false),
            isDisabled: isSaving,
          },
          confirm: {
            text: isSaving ? "Saving…" : "Save Changes",
            onClick: handleConfirm,
            isDisabled: !isValid || isSaving,
          },
        }}
      >
        {initialMeta && (
          <InvoiceContactSettings
            majik={majik}
            onChange={(m) => {
              metaRef.current = m;
            }}
            onValidate={setIsValid}
          />
        )}
      </DynamicPopUp>
    );
  },
);

EditMetaModal.displayName = "EditMetaModal";
