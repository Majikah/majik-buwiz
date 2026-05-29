/**
 * TaxProfileWizardModal.tsx
 *
 * Memoized modal wrapper around TaxProfileWizard.
 * Handles saving both contactMeta and invoiceDefaults on confirm.
 *
 * Usage:
 *   <TaxProfileWizardModal
 *     majik={majik}
 *     open={open}
 *     onOpenChange={setOpen}
 *     onConfirm={async () => { ... }}
 *   />
 */

import React, { useCallback, useRef, useState } from "react";
import DynamicPopUp from "@/components/functional/DynamicPopUp";
import {
  TaxProfileWizard,
  type TaxProfileWizardResult,
} from "../elements/TaxProfileWizard";
import type { MajikBuwizDatabase } from "@/components/majik-context-wrapper/majik-buwiz-database";
import { toast } from "sonner";

interface TaxProfileWizardModalProps {
  majik: MajikBuwizDatabase;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after successful save with the final result */
  onConfirm?: (result: TaxProfileWizardResult) => Promise<void> | void;
}

export const TaxProfileWizardModal: React.FC<TaxProfileWizardModalProps> =
  React.memo(({ majik, open, onOpenChange, onConfirm }) => {
    const [isSaving, setIsSaving] = useState(false);

    // Ref holds the latest wizard result so the confirm handler
    // doesn't close over stale state
    const resultRef = useRef<TaxProfileWizardResult | null>(null);

    // Track whether wizard has reached the review step and "Save" was clicked
    const [wizardDone, setWizardDone] = useState(false);

    const handleWizardComplete = useCallback(
      (result: TaxProfileWizardResult) => {
        resultRef.current = result;
        setWizardDone(true);
      },
      [],
    );

    const handleConfirm = useCallback(async () => {
      if (!resultRef.current) return;

      const result = resultRef.current;
      setIsSaving(true);

      const run = async () => {
        // 1. Update active account contact meta (bir + taxProfile fields)
        await majik.updateActiveAccountMeta(result.contactMetaPatch);

        // 2. Merge computed taxes into existing invoice defaults
        const existing = await majik.getInvoiceDefaults();
        await majik.setInvoiceDefaults({
          ...(existing ?? {}),
          currency: existing?.currency ?? "PHP",
          defaultTaxes: result.taxes,
        });

        await onConfirm?.(result);
      };

      toast.promise(run(), {
        loading: "Saving tax profile…",
        success: () => {
          onOpenChange(false);
          setWizardDone(false);
          resultRef.current = null;
          return "Tax profile saved";
        },
        error: (e) => e?.message ?? "Failed to save tax profile",
        finally: () => setIsSaving(false),
      });
    }, [majik, onConfirm, onOpenChange]);

    const handleOpenChange = useCallback(
      (next: boolean) => {
        if (!next) {
          // Reset local state on close
          setWizardDone(false);
          resultRef.current = null;
        }
        onOpenChange(next);
      },
      [onOpenChange],
    );

    return (
      <DynamicPopUp
        scrollable
        isOpen={open}
        onOpenChange={handleOpenChange}
        modal={{
          title: "Tax Profile Setup",
          description:
            "Configure your BIR registration details and default taxes.",
        }}
        buttons={{
          cancel: {
            text: "Cancel",
            isDisabled: isSaving,
          },
          confirm: {
            text: isSaving ? "Saving…" : "Save",
            onClick: handleConfirm,
            // Enable confirm only once wizard completes
            isDisabled: !wizardDone || isSaving,
          },
        }}
      >
        <TaxProfileWizard
          majik={majik}
          compact={false}
          onComplete={handleWizardComplete}
          onSkip={() => handleOpenChange(false)}
        />
      </DynamicPopUp>
    );
  });

TaxProfileWizardModal.displayName = "TaxProfileWizardModal";

export default TaxProfileWizardModal;
