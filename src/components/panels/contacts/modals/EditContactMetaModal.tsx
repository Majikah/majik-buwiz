/**
 * modals/EditContactMetaModal.tsx
 *
 * Self-contained sliding dialogue for editing invoice contact metadata.
 * Owns its own dirty ref + validation state — no re-renders leak to parent.
 */

import React, { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

import DynamicSlidingDialogue from "@/components/functional/DynamicSlidingDialogue";

import { MajikBuwizDatabase } from "@/components/majik-context-wrapper/majik-buwiz-database";
import { MajikInvoiceContact } from "@/SDK/majik-buwiz-client/src/core/party/majik-invoice-contact";
import { MajikInvoiceContactMeta } from "@/SDK/majik-buwiz-client/src/core/party/types";
import InvoiceContactSettings from "../../invoice/InvoiceContactSettings";

interface EditContactMetaModalProps {
  isOpen: boolean;
  contact: MajikInvoiceContact | null;
  majik: MajikBuwizDatabase;
  onOpenChange: (open: boolean) => void;
}

export const EditContactMetaModal: React.FC<EditContactMetaModalProps> =
  React.memo(({ isOpen, contact, majik, onOpenChange }) => {
    const metaRef = useRef<MajikInvoiceContactMeta | null>(
      contact?.meta ?? null,
    );
    const [isValid, setIsValid] = useState(false);

    // Sync ref when contact changes (new contact opened)
    if (contact && metaRef.current?.label !== contact.meta?.label) {
      metaRef.current = contact.meta;
    }

    const handleSave = useCallback(async () => {
      const finalMeta = metaRef.current;
      if (!contact || !isValid || !finalMeta) return;

      try {
        await majik.updateContactMeta(contact.id, finalMeta);

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
        metaRef.current = null;
      } catch (err) {
        console.error(err);
        toast.error("Failed to save metadata", { description: `${err}` });
      }
    }, [contact, majik, isValid, onOpenChange]);

    const handleCancel = useCallback(() => {
      onOpenChange(false);
    }, [onOpenChange]);

    return (
      <DynamicSlidingDialogue
        scrollable
        isOpen={isOpen}
        onOpenChange={onOpenChange}
        modal={{
          title: "Edit Account Metadata",
          description: "Edit the full metadata for this account.",
        }}
        buttons={{
          cancel: { text: "Cancel", onClick: handleCancel },
          confirm: {
            text: "Save Changes",
            onClick: handleSave,
            isDisabled: !isValid,
          },
        }}
        preventDragClose
        width={700}
      >
        {isOpen && contact && (
          <InvoiceContactSettings
            majik={majik}
            onChange={(m) => {
              metaRef.current = m;
            }}
            onValidate={setIsValid}
            contactId={contact.id}
          />
        )}
      </DynamicSlidingDialogue>
    );
  });

EditContactMetaModal.displayName = "EditContactMetaModal";
