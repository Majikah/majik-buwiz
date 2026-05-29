// ─────────────────────────────────────────────────────────────────────────────
// TaxProfileSettingsModal
// ─────────────────────────────────────────────────────────────────────────────

import React, { useCallback, useRef, useState } from "react";

import { MajikBuwizDatabase } from "@/components/majik-context-wrapper/majik-buwiz-database";
import { TaxProfileWizardResult } from "../elements/TaxProfileWizard";
import TaxProfileSettings from "../elements/TaxProfileSettings";
import DynamicSlidingDialogue from "@/components/functional/DynamicSlidingDialogue";

interface TaxProfileSettingsModalProps {
  majik: MajikBuwizDatabase;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm?: (settings: TaxProfileWizardResult) => Promise<void>;
}

export const TaxProfileSettingsModal: React.FC<TaxProfileSettingsModalProps> =
  React.memo(({ open, onOpenChange, onConfirm, majik }) => {
    const [isSaving, setisSaving] = useState(false);

    const taxProfileSettings = useRef<TaxProfileWizardResult | null>(null);

    const handleConfirm = useCallback(async () => {
      if (!majik || !taxProfileSettings.current) return;
      setisSaving(true);
      try {
        // 1. Update active account contact meta (bir + taxProfile fields)
        await majik.updateActiveAccountMeta(
          taxProfileSettings.current.contactMetaPatch,
        );

        // 2. Merge computed taxes into existing invoice defaults
        const existing = await majik.getInvoiceDefaults();
        await majik.setInvoiceDefaults({
          ...(existing ?? {}),
          currency: existing?.currency ?? "PHP",
          defaultTaxes: taxProfileSettings.current.taxes,
        });
        await onConfirm?.(taxProfileSettings.current);
        onOpenChange(false);
      } finally {
        setisSaving(false);
      }
    }, [majik, onConfirm, onOpenChange]);

    return (
      <DynamicSlidingDialogue
        scrollable
        isOpen={open}
        onOpenChange={onOpenChange}
        modal={{
          title: "Tax Profile Settings",
          description:
            "Configure your BIR registration details and default taxes.",
          hide: false,
        }}
        buttons={{
          cancel: {
            text: "Cancel",
            isDisabled: isSaving,
          },
          confirm: {
            text: "Save",
            onClick: handleConfirm,
            isDisabled: !majik || isSaving,
          },
        }}
        preventDragClose
        width={800}
      >
        <TaxProfileSettings
          majik={majik}
          onChange={(v) => {
            taxProfileSettings.current = v;
          }}
        />
      </DynamicSlidingDialogue>
    );
  });

TaxProfileSettingsModal.displayName = "TaxProfileSettingsModal";
