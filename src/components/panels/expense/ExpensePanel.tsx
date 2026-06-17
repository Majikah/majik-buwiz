/**
 * ExpensePanel.tsx — expense-centric editor/viewer.
 *
 * This panel uses `ExpenseRecord` as the domain model and `ExpenseRecordPage`
 * for the document UI. Finalizing an expense simply stores it via `majik.storeExpense`.
 * All crypto/signing/encryption paths were removed; invoice settings are
 * replaced with a recurring-expense placeholder.
 */

import {
  useState,
  useEffect,
  useCallback,
  useImperativeHandle,
  forwardRef,
} from "react";
import styled from "styled-components";
import {
  GearIcon,
  ArrowClockwiseIcon,
  CheckCircleIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";
import { toast } from "sonner";

import { ExpenseRecord } from "@/SDK/majik-buwiz-client/src/core/expenses/expense-record";
import type {
  ExpenseRecordInput,
  ExpenseRecordStatus,
} from "@/SDK/majik-buwiz-client/src/core/expenses/types";

import { ExpenseRecordPage } from "./ExpenseRecord/ExpenseRecordPage";
import DynamicPopUp from "@/components/functional/DynamicPopUp";
import { MajikBuwizDatabase } from "@/components/majik-context-wrapper/majik-buwiz-database";
import { RecurringExpenseManagerModal } from "../recurring-expense/RecurringExpenseManager";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PanelState = "draft" | "finalized";

// ---------------------------------------------------------------------------
// Styled
// ---------------------------------------------------------------------------

const PanelRoot = styled.div`
  display: flex;
  height: auto;
  background: ${({ theme }) => theme.colors.primaryBackground};
  color: ${({ theme }) => theme.colors.textPrimary};
`;

const Sidebar = styled.aside`
  width: 280px;
  border-right: 1px solid ${({ theme }) => theme.colors.primary}15;
  background: ${({ theme }) => theme.colors.secondaryBackground};
  display: flex;
  flex-direction: column;
  padding: 1.5rem;
  gap: 1.25rem;
  overflow-y: auto;
`;

const MainContent = styled.main`
  flex: 1;
  padding: 2rem;
  background: ${({ theme }) => theme.colors.primaryBackground};
`;

const Section = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const Label = styled.div`
  font-size: 11px;
  font-family: ${({ theme }) => theme.typography.fonts.semibold};
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: ${({ theme }) => theme.colors.primary};
  display: flex;
  align-items: center;
  gap: 6px;
`;

const InfoBox = styled.div`
  padding: 12px;
  background: ${({ theme }) => theme.colors.primarySoft};
  border-radius: ${({ theme }) => theme.borders.radius.medium};
  font-size: 12px;
  line-height: 1.5;
  color: ${({ theme }) => theme.colors.textSecondary};
  border-left: 3px solid ${({ theme }) => theme.colors.primary};
`;

const PrimaryButton = styled.button`
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  font-size: 12px;
  padding: 9px 14px;
  border-radius: ${({ theme }) => theme.borders.radius.medium};
  background: ${({ theme }) => theme.gradients.primary};
  border: 1px solid transparent;
  color: ${({ theme }) => theme.colors.static.white};
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  width: 100%;
  transition: filter 0.15s;

  &:hover:not(:disabled) {
    filter: brightness(1.08);
  }
  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
`;

const GhostButton = styled.button`
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  font-size: 12px;
  padding: 9px 14px;
  border-radius: ${({ theme }) => theme.borders.radius.medium};
  background: transparent;
  border: 1px solid ${({ theme }) => theme.colors.primary}33;
  color: ${({ theme }) => theme.colors.textSecondary};
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  width: 100%;
  transition: all 0.15s;

  &:hover:not(:disabled) {
    background: ${({ theme }) => theme.colors.primarySoft};
    color: ${({ theme }) => theme.colors.primary};
    border-color: ${({ theme }) => theme.colors.primary};
  }
  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
`;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ExpensePanelHandle {
  refresh: (record?: ExpenseRecord | null) => Promise<void>;
  receiveUpdate: (record: ExpenseRecord) => Promise<void>;
  applyStatusTransition: (to: ExpenseRecordStatus) => Promise<void>;
}

interface ExpensePanelProps {
  majik: MajikBuwizDatabase;
  initialExpense?: ExpenseRecord;
  initialDraft?: ExpenseRecord;
  readonly?: boolean;
  onUpdate?: (updated: ExpenseRecord) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const ExpensePanel = forwardRef<ExpensePanelHandle, ExpensePanelProps>(
  function ExpensePanel(
    { majik, initialExpense, initialDraft, readonly = false, onUpdate },
    ref,
  ) {
    const deriveInitialState = (): PanelState =>
      initialExpense ? "finalized" : "draft";

    const [panelState, setPanelState] =
      useState<PanelState>(deriveInitialState);
    const [workingDraft, setWorkingDraft] = useState<ExpenseRecord | null>(
      () =>
        initialDraft ??
        (initialExpense && initialExpense.status === "draft"
          ? initialExpense
          : null),
    );
    const expense = initialExpense ?? null;

    const [isDirty, setIsDirty] = useState(false);
    // const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState<boolean>(
      !initialExpense && !initialDraft,
    );

    // Finalize
    const [isConfigureOpen, setIsConfigureOpen] = useState(false);
    const [isFinalizing, setIsFinalizing] = useState(false);
    const [finalizeError, setFinalizeError] = useState<string | null>(null);

    const [recurringOpen, setRecurringOpen] = useState(false);

    // Init draft when nothing is provided
    useEffect(() => {
      if (initialExpense) {
        setPanelState("finalized");
        setWorkingDraft(
          initialExpense.status === "draft" ? initialExpense : null,
        );
        setIsLoading(false);
        return;
      }

      if (initialDraft) {
        setWorkingDraft(initialDraft);
        setIsLoading(false);
        return;
      }

      async function initDraft() {
        const currentAccount = majik.getActiveAccount();

        if (!currentAccount) {
          toast.error("A valid Majik Key is required to create expenses.");
          return;
        }

        const accountMeta = currentAccount.meta;

        try {
          // Build with lineItems so totalAmount is derived — bypasses the
          // "totalAmount must be > 0" validation guard on single-amount records.
          const draft = ExpenseRecord.create({
            category: "other",
            documentType: "official-receipt",
            description: "New expense",
            payee: { legalName: "Vendor" },
            paidBy: { ...accountMeta, legalName: accountMeta?.legalName ?? "" },
            currency: "PHP",
            lineItems: [
              {
                id: crypto.randomUUID(),
                description: "New line item",
                quantity: 1,
                unitPrice: 0,
              },
            ],
            accountId: currentAccount.fingerprint,
          });

          setWorkingDraft(draft);
        } catch (err) {
          console.error("Failed to initialize draft expense", err);
        } finally {
          setIsLoading(false);
        }
      }

      initDraft();
    }, [majik, initialExpense, initialDraft]);

    // Draft change handler
    const handleDraftChange = useCallback(
      (patch: Partial<ExpenseRecordInput>) => {
        if (!workingDraft) return;
        console.debug("Applying draft patch:", patch);
        try {
          const merged: any = {
            id: workingDraft.id,
            accountId: (workingDraft as any).accountId ?? undefined,
            category: patch.category ?? workingDraft.category,
            documentType: patch.documentType ?? workingDraft.documentType,
            description: patch.description ?? workingDraft.description,
            payee: patch.payee ?? workingDraft.payee,
            paidBy: patch.paidBy ?? workingDraft.paidBy,
            currency: patch.currency ?? workingDraft.currency,
            expenseDate: patch.expenseDate ?? workingDraft.expenseDate,
            paidAt: patch.paidAt ?? workingDraft.paidAt,
            totalAmount: patch.totalAmount ?? workingDraft.totalAmount,
            lineItems:
              patch.lineItems ?? (workingDraft as any).lineItems ?? undefined,
            status: workingDraft.status,
            bir: patch.bir ?? (workingDraft as any).bir,
            paymentTerms:
              patch.paymentTerms ?? (workingDraft as any).paymentTerms,
            period: patch.period ?? (workingDraft as any).period,
            references: patch.references ?? (workingDraft as any).references,
            notes: patch.notes ?? (workingDraft as any).notes,
            tags: patch.tags ?? (workingDraft as any).tags,
            metadata: patch.metadata ?? (workingDraft as any).metadata,
          };

          const updated = ExpenseRecord.create(merged);
          setWorkingDraft(updated);
          setIsDirty(true);
        } catch (err: any) {
          console.error("Invalid draft patch:", err);
          toast.error(err instanceof Error ? err.message : "Invalid change");
        }
      },
      [workingDraft],
    );

    const handleDiscardChanges = useCallback(async () => {
      if (expense) {
        setWorkingDraft(expense.status === "draft" ? expense : null);
      } else if (initialDraft) {
        setWorkingDraft(initialDraft);
      }
      setIsDirty(false);
    }, [expense, initialDraft]);

    // Finalize / save
    const handleFinalizeClick = () => {
      setFinalizeError(null);
      setIsConfigureOpen(true);
    };

    const handleConfigureConfirm = async () => {
      if (!workingDraft) return;
      setIsFinalizing(true);
      setFinalizeError(null);
      try {
        console.debug("Finalizing expense:", workingDraft);
        await majik.storeExpense(workingDraft);
        setPanelState("finalized");
        setIsConfigureOpen(false);
        setIsDirty(false);
        onUpdate?.(workingDraft);
      } catch (err: any) {
        console.error("Save failed:", err);
        setFinalizeError(err instanceof Error ? err.message : "Save failed.");
      } finally {
        setIsFinalizing(false);
      }
    };

    // View actions
    const handleApprove = useCallback(async () => {
      if (!expense) return;
      try {
        const updated = expense.approve();
        await majik.storeExpense(updated);
        onUpdate?.(updated);
      } catch (err: any) {
        console.error("Approve failed:", err);
        toast.error(err instanceof Error ? err.message : "Approve failed.");
      }
    }, [expense, majik, onUpdate]);

    const handleMarkRefunded = useCallback(async () => {
      if (!expense) return;
      try {
        const updated = expense.markAsRefunded();
        await majik.storeExpense(updated);
        onUpdate?.(updated);
      } catch (err: any) {
        console.error("Mark refunded failed:", err);
        toast.error(err instanceof Error ? err.message : "Operation failed.");
      }
    }, [expense, majik, onUpdate]);

    const handleAddRefund = useCallback(
      async (refund: any) => {
        if (!expense) return;
        try {
          const updated = expense.addRefund(refund);
          await majik.storeExpense(updated);
          onUpdate?.(updated);
        } catch (err: any) {
          console.error("Add refund failed:", err);
          toast.error(
            err instanceof Error ? err.message : "Add refund failed.",
          );
        }
      },
      [expense, majik, onUpdate],
    );

    const handleRemoveRefund = useCallback(
      async (refundId: string) => {
        if (!expense) return;
        try {
          const updated = expense.removeRefund(refundId);
          await majik.storeExpense(updated);
          onUpdate?.(updated);
        } catch (err: any) {
          console.error("Remove refund failed:", err);
          toast.error(err instanceof Error ? err.message : "Remove failed.");
        }
      },
      [expense, majik, onUpdate],
    );

    const handleDuplicate = useCallback(async () => {
      try {
        const source = expense ?? workingDraft;
        if (!source) return;
        const dup = await majik.duplicateExpense(source);
        setWorkingDraft(dup);
        setPanelState("draft");
        setIsDirty(true);
      } catch (err) {
        console.error("Duplicate failed:", err);
        toast.error(err instanceof Error ? err.message : "Duplicate failed.");
      }
    }, [expense, workingDraft, majik]);

    // Imperative handle
    useImperativeHandle(
      ref,
      () => ({
        refresh: async (rec?: ExpenseRecord | null) => {
          if (!rec) {
            setPanelState("draft");
            setWorkingDraft(initialDraft ?? null);
            setIsDirty(false);
            return;
          }
          setPanelState("finalized");
          setWorkingDraft(rec.status === "draft" ? rec : null);
          setIsDirty(false);
        },
        receiveUpdate: async (rec: ExpenseRecord) => {
          if (isDirty) return;
          setPanelState("finalized");
          setWorkingDraft(rec.status === "draft" ? rec : null);
          setIsLoading(false);
        },
        async applyStatusTransition(to: ExpenseRecordStatus) {
          if (panelState !== "finalized") {
            throw new Error(
              `[ExpensePanel] Cannot transition status in panel state "${panelState}".`,
            );
          }
          const target = expense ?? workingDraft;
          if (!target) throw new Error("[ExpensePanel] No ExpenseRecord.");
          try {
            const updated = target.withStatus(to);
            await majik.storeExpense(updated);
            setIsDirty(false);
            setWorkingDraft(updated.status === "draft" ? updated : null);
            onUpdate?.(updated);
          } catch (err) {
            throw err;
          }
        },
      }),
      [panelState, expense, workingDraft, majik, isDirty, onUpdate],
    );

    if (isLoading) {
      return (
        <PanelRoot style={{ alignItems: "center", justifyContent: "center" }}>
          <ArrowClockwiseIcon size={32} className="spinning" />
        </PanelRoot>
      );
    }

    return (
      <PanelRoot>
        {!readonly && (
          <Sidebar>
            <Section>
              <Label>
                <GearIcon size={14} /> Recurring Expenses
              </Label>
              <InfoBox>
                Manage recurring expense templates — create, pause, or actualize
                them into real expense records.
              </InfoBox>
              <GhostButton onClick={() => setRecurringOpen(true)}>
                Manage Recurring Expenses
              </GhostButton>
            </Section>

            {panelState === "draft" && (
              <Section>
                <Label>
                  <CheckCircleIcon size={14} /> Ready to save
                </Label>
                <InfoBox>
                  Draft changes are in-memory. Save to persist this expense to
                  storage.
                </InfoBox>
                <PrimaryButton
                  onClick={handleFinalizeClick}
                  disabled={!workingDraft || isFinalizing}
                >
                  <CheckCircleIcon size={13} /> Save Expense
                </PrimaryButton>
                {isDirty && (
                  <GhostButton onClick={handleDiscardChanges}>
                    Discard
                  </GhostButton>
                )}
              </Section>
            )}

            <Section style={{ marginTop: "auto" }}>
              <Label>Integrity</Label>
              <div style={{ fontSize: 12, opacity: 0.8 }}>
                {panelState === "draft" ? "Draft — not saved" : "Stored"}
              </div>
              {expense && (
                <div
                  style={{
                    fontSize: 10,
                    fontFamily: "monospace",
                    wordBreak: "break-all",
                  }}
                >
                  ID: {expense.id}
                </div>
              )}
            </Section>
          </Sidebar>
        )}

        <MainContent>
          {panelState === "draft" && workingDraft ? (
            <ExpenseRecordPage
              kind="draft"
              record={workingDraft}
              onChange={handleDraftChange}
            />
          ) : panelState === "finalized" && expense ? (
            <ExpenseRecordPage
              kind="view"
              record={expense}
              onEdit={(patch) => {
                if ((expense as any).status !== "draft") return;
                try {
                  const merged: any = {
                    id: expense.id,
                    accountId: (expense as any).accountId ?? undefined,
                    category: patch.category ?? expense.category,
                    documentType: patch.documentType ?? expense.documentType,
                    description: patch.description ?? expense.description,
                    payee: patch.payee ?? expense.payee,
                    paidBy: patch.paidBy ?? expense.paidBy,
                    currency: patch.currency ?? expense.currency,
                    expenseDate: patch.expenseDate ?? expense.expenseDate,
                    paidAt: patch.paidAt ?? expense.paidAt,
                    totalAmount: patch.totalAmount ?? expense.totalAmount,
                    lineItems:
                      patch.lineItems ??
                      (expense as any).lineItems ??
                      undefined,
                    status: expense.status,
                    bir: patch.bir ?? (expense as any).bir,
                    paymentTerms:
                      patch.paymentTerms ?? (expense as any).paymentTerms,
                    period: patch.period ?? (expense as any).period,
                    references: patch.references ?? (expense as any).references,
                    notes: patch.notes ?? (expense as any).notes,
                    tags: patch.tags ?? (expense as any).tags,
                    metadata: patch.metadata ?? (expense as any).metadata,
                  };
                  const updated = ExpenseRecord.create(merged);
                  majik.storeExpense(updated).then(() => onUpdate?.(updated));
                } catch (err: any) {
                  toast.error(
                    err instanceof Error ? err.message : "Invalid change",
                  );
                }
              }}
              onApprove={handleApprove}
              onMarkRefunded={handleMarkRefunded}
              onAddRefund={handleAddRefund}
              onRemoveRefund={handleRemoveRefund}
              onDuplicate={handleDuplicate}
            />
          ) : null}
        </MainContent>

        <DynamicPopUp
          isOpen={isConfigureOpen}
          onOpenChange={(open) => {
            if (!open) setIsConfigureOpen(false);
          }}
          modal={{
            title: "Save Expense",
            description: "Persist this expense to storage.",
          }}
          buttons={{
            cancel: {
              text: "Cancel",
              onClick: () => setIsConfigureOpen(false),
            },
            confirm: {
              text: isFinalizing ? "Saving…" : "Save",
              onClick: handleConfigureConfirm,
            },
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <InfoBox>
              Saving will persist this expense record to your local store.
            </InfoBox>
            {finalizeError && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  color: "var(--color-error)",
                }}
              >
                <WarningCircleIcon size={14} /> {finalizeError}
              </div>
            )}
          </div>
        </DynamicPopUp>

        <RecurringExpenseManagerModal
          isOpen={recurringOpen}
          onOpenChange={setRecurringOpen}
          majik={majik}
        />
      </PanelRoot>
    );
  },
);

export default ExpensePanel;
