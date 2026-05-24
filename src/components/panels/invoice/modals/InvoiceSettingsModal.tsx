// ─────────────────────────────────────────────────────────────────────────────
// InvoiceSettingsModal
// ─────────────────────────────────────────────────────────────────────────────

import DynamicPopUp from "@/components/functional/DynamicPopUp";

import React, { useCallback, useRef, useState } from "react";
import { InvoiceSettings } from "../InvoiceSettings";
import { InvoiceDefaults } from "@/SDK/majik-buwiz-client/src";
import { MajikBuwizDatabase } from "@/components/majik-context-wrapper/majik-buwiz-database";

interface InvoiceSettingsModalProps {
  majik: MajikBuwizDatabase;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm?: (settings: InvoiceDefaults) => Promise<void>;
}

export const InvoiceSettingsModal: React.FC<InvoiceSettingsModalProps> =
  React.memo(({ open, onOpenChange, onConfirm, majik }) => {
    const [isSaving, setisSaving] = useState(false);

    const invoiceSettingsRef = useRef<InvoiceDefaults | null>(null);

    const handleConfirm = useCallback(async () => {
      if (!majik || !invoiceSettingsRef.current) return;
      setisSaving(true);
      try {
        await majik.setInvoiceDefaults(invoiceSettingsRef.current);
        await onConfirm?.(invoiceSettingsRef.current);
        onOpenChange(false);
      } finally {
        setisSaving(false);
      }
    }, [majik, onConfirm, onOpenChange]);

    return (
      <DynamicPopUp
        scrollable
        isOpen={open}
        onOpenChange={onOpenChange}
        modal={{
          title: "Invoice Settings",
          description: "Configure your default invoice preferences.",
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
      >
        <InvoiceSettings
          majik={majik}
          onClose={() => onOpenChange(false)}
          onChange={(v) => {
            invoiceSettingsRef.current = v;
          }}
        />
      </DynamicPopUp>
    );
  });

InvoiceSettingsModal.displayName = "InvoiceSettingsModal";
