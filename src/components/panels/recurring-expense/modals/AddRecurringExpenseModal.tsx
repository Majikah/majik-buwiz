/**
 * AddRecurringExpenseModal.tsx
 *
 * DynamicPopUp-wrapped form for creating or editing a RecurringExpenseItem.
 * Contains a Wizard / Advanced mode switcher in the modal header area.
 *
 * Pattern matches AddRefundModal — uses DynamicPopUp, owns a ref for the
 * form payload, exposes isValid to gate the confirm button.
 */

import React, { useCallback, useRef, useState } from "react";
import DynamicPopUp from "@/components/functional/DynamicPopUp";
import {
  WizardMode,
  type RecurringExpenseFormData,
  INITIAL_DATA,
} from "../forms/WizardMode";
import { AdvancedMode } from "../forms/AdvancedMode";

import { RecurringExpenseItem } from "@/SDK/majik-buwiz-client/src/core/expenses/recurring/recurring-expense";
import { MajikBuwizDatabase } from "@/components/majik-context-wrapper/majik-buwiz-database";
import { toast } from "sonner";
import { GearIcon, MagicWandIcon } from "@phosphor-icons/react";
import { ModeBar, ModeBtn, ModeToggle } from "../shared/atoms";

// ── Helpers ───────────────────────────────────────────────────────────────────

type InputMode = "wizard" | "advanced";

const mapItemToFormData = (
  item: RecurringExpenseItem,
): Partial<RecurringExpenseFormData> => ({
  id: item.id,
  name: item.name,
  description: item.description ?? "",
  amount: item.amount,
  currency: item.currency ?? "PHP",
  documentType: item.documentType,
  schedule: {
    anchor: { ...(item.schedule?.anchor as any) },
    startDate:
      item.schedule?.startDate ?? new Date().toISOString().slice(0, 10),
    endDate: item.schedule?.endDate,
  },
  category: item.category ?? "other",
  payee: item.payee ?? { legalName: "" },
  paidBy: item.paidBy ?? { legalName: "" },
  tags: item.tags ?? [],
  bir: item.bir,
  lineItems: item.lineItems ? [...item.lineItems] : undefined,
});

/* buildItemFromForm removed — use RecurringExpenseItem.create(formData).toJSON() instead */

// ── Component ─────────────────────────────────────────────────────────────────

interface AddRecurringExpenseModalProps {
  majik: MajikBuwizDatabase;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (item: RecurringExpenseItem) => Promise<void>;
  onClose: () => void;
  isEditing?: boolean;
  initialData?: RecurringExpenseItem;
}

export const AddRecurringExpenseModal: React.FC<AddRecurringExpenseModalProps> =
  React.memo(
    ({
      majik,
      open,
      onOpenChange,
      onSave,
      onClose,
      isEditing,
      initialData,
    }) => {
      // Default: wizard for new, advanced for editing
      const [inputMode, setInputMode] = useState<InputMode>(
        isEditing ? "advanced" : "wizard",
      );
      const [isSaving, setIsSaving] = useState(false);
      const [isValid, setIsValid] = useState(false);

      // Hold either an instance (when editing) or a draft form payload.
      const formItemRef = useRef<RecurringExpenseItem | undefined>(initialData);
      const draftRef = useRef<RecurringExpenseFormData>({
        ...INITIAL_DATA,
        ...(initialData ? mapItemToFormData(initialData) : {}),
      });

      const handleChange = useCallback(
        (data: RecurringExpenseFormData | RecurringExpenseItem) => {
          // Forms will send either a RecurringExpenseItem instance (when
          // operating in class-based edit mode) or a plain form-data object
          // for new-item creation. Keep both refs in sync.
          if (
            (data as RecurringExpenseItem)?.toJSON &&
            typeof (data as any).toJSON === "function"
          ) {
            formItemRef.current = data as RecurringExpenseItem;
            draftRef.current = {
              ...INITIAL_DATA,
              ...(formItemRef.current
                ? mapItemToFormData(formItemRef.current)
                : {}),
            } as RecurringExpenseFormData;
          } else {
            draftRef.current = data as RecurringExpenseFormData;
          }
        },
        [],
      );

      const handleValidate = useCallback((valid: boolean) => {
        setIsValid(valid);
      }, []);
      // lineItems: item.lineItems ? [...item.lineItems] : undefined,

      const handleConfirm = useCallback(async () => {
        if (!isValid) return;
        const currentAccount = majik.getActiveAccount();

        if (!currentAccount) {
          toast.error("A valid Majik Key is required to create expenses.");
          return;
        }
        setIsSaving(true);
        try {
          // If we have an edited instance from the form, use it directly.
          // Otherwise construct a new instance from the draft form data.
          let created: RecurringExpenseItem;
          if (isEditing && formItemRef.current) {
            created = formItemRef.current;
          } else if (formItemRef.current) {
            // Form may have produced an instance even for non-editing flows
            created = formItemRef.current;
          } else {
            created = RecurringExpenseItem.create({
              ...draftRef.current,
              accountId: currentAccount.fingerprint,
            });
          }

          // Persist using the JSON representation
          await onSave(created);
          onClose();
        } catch (err: any) {
          // Surface error without closing
          console.error("[AddRecurringExpenseModal] save failed:", err);
        } finally {
          setIsSaving(false);
        }
      }, [isValid, isEditing, initialData?.id, onSave, onClose]);

      return (
        <DynamicPopUp
          scrollable
          isOpen={open}
          onOpenChange={onOpenChange}
          modal={{
            title: isEditing
              ? "Edit Recurring Expense"
              : "New Recurring Expense",
            description: isEditing
              ? "Update this recurring expense template."
              : "Create a new recurring expense template.",
          }}
          width={800}
          buttons={{
            cancel: { text: "Cancel", isDisabled: isSaving },
            confirm: {
              text: isSaving
                ? "Saving…"
                : isEditing
                  ? "Save Changes"
                  : "Create Expense",
              onClick: handleConfirm,
              isDisabled: isSaving || !isValid,
            },
          }}
        >
          {/* Mode switcher */}
          <ModeBar>
            <ModeToggle>
              <ModeBtn
                $active={inputMode === "wizard"}
                onClick={() => setInputMode("wizard")}
              >
                <MagicWandIcon size={13} /> Wizard
              </ModeBtn>
              <ModeBtn
                $active={inputMode === "advanced"}
                onClick={() => setInputMode("advanced")}
              >
                <GearIcon size={13} /> Advanced
              </ModeBtn>
            </ModeToggle>
          </ModeBar>

          {inputMode === "wizard" ? (
            <WizardMode
              initialData={initialData}
              onChange={handleChange}
              onValidate={handleValidate}
              onAdvancedMode={() => setInputMode("advanced")}
              isEditing={isEditing}
            />
          ) : (
            <AdvancedMode
              initialData={initialData}
              onChange={handleChange}
              onValidate={handleValidate}
              onWizardMode={() => setInputMode("wizard")}
              isEditing={isEditing}
            />
          )}
        </DynamicPopUp>
      );
    },
  );

AddRecurringExpenseModal.displayName = "AddRecurringExpenseModal";
