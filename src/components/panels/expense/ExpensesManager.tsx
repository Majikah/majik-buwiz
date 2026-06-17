/**
 * ExpensesManager.tsx
 *
 * Mode state machine:
 *   "list"      → ExpenseTable + ExpenseSearchBar
 *   "view"      → ExpensePanel (readonly)
 *   "edit"      → ExpensePanel (editable, draft records only)
 *   "new"       → ExpensePanel (blank draft)
 *   "duplicate" → ExpensePanel (pre-filled draft copy)
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import styled, { css } from "styled-components";
import {
  ArrowClockwiseIcon,
  ArrowLeftIcon,
  GearIcon,
  PlusIcon,
  RepeatIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";

import DynamicPopUp from "@/components/functional/DynamicPopUp";
import GuideHelper from "@/components/functional/GuideHelper";
import { MajikBuwizDatabase } from "@/components/majik-context-wrapper/majik-buwiz-database";
import { toast } from "sonner";

import StyledIconButton from "@/components/foundations/StyledIconButton";

import { ExpenseRecord } from "@/SDK/majik-buwiz-client/src/core/expenses/expense-record";
import type { ExpenseRecordStatus } from "@/SDK/majik-buwiz-client/src/core/expenses/types";

import { ExpenseColumnDef, ExpenseTable } from "./ExpenseTable";
import { ExpenseSearchBar } from "./ExpenseSearchBar";
import { ExpenseStatusQuickActions } from "./ExpenseStatusQuickActions";
import ExpensePanel, { ExpensePanelHandle } from "./ExpensePanel";
import { RecurringExpenseManagerModal } from "../recurring-expense/RecurringExpenseManager";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ManagerMode = "list" | "view" | "edit" | "new" | "duplicate";

interface DeleteTarget {
  expenses: ExpenseRecord[];
  kind: "single" | "bulk";
}

// ---------------------------------------------------------------------------
// Column key registry
// ---------------------------------------------------------------------------

/**
 * Must stay in sync with DEFAULT_COLUMNS in ExpenseTable.tsx.
 * Used by ExpenseSearchBar to drive the column-visibility popover.
 */
export const ALL_EXPENSE_COLUMN_KEYS: { key: string; label: string }[] = [
  { key: "description", label: "Description" },
  { key: "payee", label: "Payee" },
  { key: "category", label: "Category" },
  { key: "documentType", label: "Document Type" },
  { key: "expenseDate", label: "Date" },
  { key: "amount", label: "Amount" },
  { key: "status", label: "Status" },
];

const DEFAULT_VISIBLE_KEYS = new Set(ALL_EXPENSE_COLUMN_KEYS.map((c) => c.key));

// ---------------------------------------------------------------------------
// Styled — Shell
// ---------------------------------------------------------------------------

const Root = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  background: ${({ theme }) => theme.colors.primaryBackground};
  color: ${({ theme }) => theme.colors.textPrimary};
`;

const PanelHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 18px 13px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.secondaryBackground};
  flex-shrink: 0;
`;

const HeaderLeft = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const PanelTitle = styled.h2`
  font-size: 14px;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: ${({ theme }) => theme.colors.textPrimary};
  margin: 0;
`;

const PanelSubtitle = styled.p`
  font-family: "Fira Mono", "JetBrains Mono", monospace;
  font-size: 10px;
  color: ${({ theme }) => theme.colors.textSecondary};
  margin: 0;
  opacity: 0.5;
  letter-spacing: 0.03em;
`;

const HeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
`;

// ---------------------------------------------------------------------------
// Styled — Toolbar buttons
// ---------------------------------------------------------------------------

const BackButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  font-size: 12px;
  padding: 7px 13px;
  border-radius: ${({ theme }) => theme.borders.radius.medium};
  border: 1px solid ${({ theme }) => theme.colors.primary}33;
  background: transparent;
  color: ${({ theme }) => theme.colors.textSecondary};
  cursor: pointer;
  transition: all 0.15s;
  flex-shrink: 0;

  &:hover {
    background: ${({ theme }) => theme.colors.primarySoft};
    color: ${({ theme }) => theme.colors.primary};
    border-color: ${({ theme }) => theme.colors.primary};
  }
`;

const ModePill = styled.span<{ $mode: ManagerMode }>`
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  font-size: 10px;
  padding: 2px 9px;
  border-radius: ${({ theme }) => theme.borders.radius.rounded};
  flex-shrink: 0;

  ${({ $mode, theme }) => {
    switch ($mode) {
      case "view":
        return css`
          color: ${theme.colors.textSecondary};
          background: ${theme.colors.primarySoft};
          border: 1px solid ${theme.colors.primary}20;
        `;
      case "edit":
        return css`
          color: ${theme.colors.primary};
          background: ${theme.colors.primarySoft};
          border: 1px solid ${theme.colors.primary}44;
        `;
      case "duplicate":
        return css`
          color: ${theme.colors.primary};
          background: ${theme.colors.primarySoft};
          border: 1px solid ${theme.colors.primary}33;
        `;
      default:
        return css`
          display: none;
        `;
    }
  }}
`;

const OrphanPill = styled.button<{ $active: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  font-size: 10px;
  padding: 2px 8px;
  border-radius: ${({ theme }) => theme.borders.radius.rounded};
  border: 1px solid
    ${({ $active, theme }) =>
      $active ? theme.colors.primary + "44" : theme.colors.error + "66"};
  background: ${({ $active, theme }) =>
    $active ? theme.colors.primarySoft : theme.colors.error + "18"};
  color: ${({ $active, theme }) =>
    $active ? theme.colors.primary : theme.colors.error};
  cursor: pointer;
  transition: all 0.15s;
  flex-shrink: 0;

  &:hover {
    filter: brightness(1.08);
  }
`;

const IconButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  font-size: 12px;
  padding: 7px 13px;
  border-radius: ${({ theme }) => theme.borders.radius.medium};
  border: 1px solid ${({ theme }) => theme.colors.primary}33;
  background: transparent;
  color: ${({ theme }) => theme.colors.textSecondary};
  cursor: pointer;
  transition: all 0.15s;
  flex-shrink: 0;

  &:hover {
    background: ${({ theme }) => theme.colors.primarySoft};
    color: ${({ theme }) => theme.colors.primary};
    border-color: ${({ theme }) => theme.colors.primary};
  }
`;

const NewExpenseButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  font-size: 12px;
  padding: 7px 14px;
  border-radius: ${({ theme }) => theme.borders.radius.medium};
  background: ${({ theme }) => theme.gradients.primary};
  border: 1px solid transparent;
  color: ${({ theme }) => theme.colors.static.white};
  cursor: pointer;
  transition: filter 0.15s;
  flex-shrink: 0;

  &:hover {
    filter: brightness(1.08);
  }
`;

// const ExportButton = styled.button`
//   display: inline-flex;
//   align-items: center;
//   gap: 7px;
//   font-family: ${({ theme }) => theme.typography.fonts.medium};
//   font-size: 12px;
//   padding: 7px 13px;
//   border-radius: ${({ theme }) => theme.borders.radius.medium};
//   border: 1px solid ${({ theme }) => theme.colors.primary}33;
//   background: transparent;
//   color: ${({ theme }) => theme.colors.textSecondary};
//   cursor: pointer;
//   transition: all 0.15s;
//   flex-shrink: 0;

//   &:hover {
//     background: ${({ theme }) => theme.colors.primarySoft};
//     color: ${({ theme }) => theme.colors.primary};
//     border-color: ${({ theme }) => theme.colors.primary};
//   }
// `;

// ---------------------------------------------------------------------------
// Styled — Body
// ---------------------------------------------------------------------------

const Body = styled.div`
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  overflow-y: auto;

  &::-webkit-scrollbar {
    width: 5px;
  }

  &::-webkit-scrollbar-track {
    background: ${({ theme }) => theme.colors.secondaryBackground};
    border-radius: 8px;
  }

  &::-webkit-scrollbar-thumb {
    background: ${({ theme }) => theme.gradients.primary};
    border-radius: 8px;
  }
`;

const CenterState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 12px;
  color: ${({ theme }) => theme.colors.textSecondary};
  font-size: 13px;
  font-family: ${({ theme }) => theme.typography.fonts.light};
  opacity: 0.65;
`;

// ---------------------------------------------------------------------------
// Styled — Delete confirm modal
// ---------------------------------------------------------------------------

const ConfirmBody = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 8px 0 4px;
  text-align: center;
`;

const ConfirmText = styled.p`
  font-size: 13px;
  line-height: 1.65;
  color: ${({ theme }) => theme.colors.textPrimary};
  margin: 0;
  max-width: 340px;
`;

const ConfirmMono = styled.span`
  font-family: ${({ theme }) => theme.typography.fonts.numbers};
  font-size: 12px;
  color: ${({ theme }) => theme.colors.primary};
  background: ${({ theme }) => theme.colors.primarySoft};
  padding: 1px 7px;
  border-radius: ${({ theme }) => theme.borders.radius.small};
`;

const BulkList = styled.ul`
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 160px;
  overflow-y: auto;
  width: 100%;
`;

const BulkItem = styled.li`
  font-family: ${({ theme }) => theme.typography.fonts.numbers};
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textSecondary};
  padding: 4px 10px;
  border-radius: ${({ theme }) => theme.borders.radius.small};
  background: ${({ theme }) => theme.colors.primarySoft};
  text-align: left;
`;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ExpensesManagerProps {
  majik: MajikBuwizDatabase;
  extraColumns?: ExpenseColumnDef[];
  pageSize?: number;
  paginationAt?: "top" | "bottom" | "both";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const ExpensesManager: React.FC<ExpensesManagerProps> = ({
  majik,
  extraColumns,
  pageSize,
  paginationAt,
}) => {
  // ── Expense list ──────────────────────────────────────────────────────────

  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Search / filter / column visibility ───────────────────────────────────

  const [filteredExpenses, setFilteredExpenses] = useState<ExpenseRecord[]>([]);
  const [visibleColumnKeys, setVisibleColumnKeys] =
    useState<Set<string>>(DEFAULT_VISIBLE_KEYS);

  // ── View state ────────────────────────────────────────────────────────────

  const [mode, setMode] = useState<ManagerMode>("list");
  const [activeExpense, setActiveExpense] = useState<ExpenseRecord | null>(
    null,
  );
  const activeExpenseRef = useRef<ExpenseRecord | null>(null);
  const [duplicateDraft, setDuplicateDraft] = useState<ExpenseRecord | null>(
    null,
  );

  // ── Delete dialog ─────────────────────────────────────────────────────────

  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // ── Transition ────────────────────────────────────────────────────────────

  const [isTransitioning, setIsTransitioning] = useState(false);

  // ── Panel ref ─────────────────────────────────────────────────────────────

  const panelRef = useRef<ExpensePanelHandle>(null);

  // ── CSV export state ──────────────────────────────────────────────────────

  // const [selectedExpensesForExport, setSelectedExpensesForExport] = useState<
  //   ExpenseRecord[]
  // >([]);

  // ── Orphan view ───────────────────────────────────────────────────────────

  const [orphanCount, setOrphanCount] = useState(0);
  const [showingOrphans, setShowingOrphans] = useState(false);
  const showingOrphansRef = useRef(false);

  // ── Last-committed guard — prevents panel overwrite by external events ────

  const lastCommittedRef = useRef<string | null>(null);

  const [recurringOpen, setRecurringOpen] = useState(false); // ADD

  // ---------------------------------------------------------------------------
  // Load
  // ---------------------------------------------------------------------------

  const loadExpenses = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [list, count] = await Promise.all([
        showingOrphansRef.current
          ? majik.getExpensesNotOwnedByActiveAccount()
          : majik.listExpensesByActiveAccount(),
        majik.countExpensesNotOwnedByActiveAccount(),
      ]);
      setExpenses(list);
      setOrphanCount(count);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load expenses");
    } finally {
      setLoading(false);
    }
  }, [majik]);

  useEffect(() => {
    loadExpenses();
  }, [loadExpenses]);

  // ── External event listener ───────────────────────────────────────────────

  useEffect(() => {
    if (!majik) return;
    const handler = (updated: any) => {
      (async () => {
        loadExpenses();

        const toSet: ExpenseRecord | null = updated ?? null;

        if (toSet && lastCommittedRef.current === toSet.id) {
          lastCommittedRef.current = null;
        } else {
          setActiveExpense(toSet);
          activeExpenseRef.current = toSet;
          lastCommittedRef.current = null;
        }
      })().catch(console.error);
    };

    majik.on("expense-updated", handler);
    majik.on("expense-created", handler);

    return () => {
      majik.off("expense-updated", handler);
      majik.off("expense-created", handler);
    };
  }, [majik, loadExpenses]);

  // ── Load persisted column visibility ─────────────────────────────────────

  useEffect(() => {
    (async () => {
      try {
        const saved = await majik.getExpenseTableColumns();
        if (saved && saved.length > 0) {
          setVisibleColumnKeys(
            new Set(saved.map((c: ExpenseColumnDef) => c.key)),
          );
        }
      } catch (err) {
        console.warn("[ExpensesManager] Could not load column prefs:", err);
      }
    })();
  }, [majik]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleToggleOrphans = useCallback(() => {
    const next = !showingOrphansRef.current;
    showingOrphansRef.current = next;
    setShowingOrphans(next);
    setFilteredExpenses([]);
    loadExpenses();
  }, [loadExpenses]);

  const handleColumnVisibilityChange = useCallback(
    async (keys: Set<string>) => {
      setVisibleColumnKeys(keys);
      try {
        const payload = Array.from(keys).map(
          (key) => ({ key }) as ExpenseColumnDef,
        );
        await majik.setExpenseTableColumns(payload);
      } catch (err) {
        console.warn("[ExpensesManager] Could not persist column prefs:", err);
      }
    },
    [majik],
  );

  // ── Navigation ────────────────────────────────────────────────────────────

  const handleView = useCallback((exp: ExpenseRecord) => {
    setActiveExpense(exp);
    activeExpenseRef.current = exp;
    setMode("view");
  }, []);

  const handleEdit = useCallback((exp: ExpenseRecord) => {
    setActiveExpense(exp);
    activeExpenseRef.current = exp;
    setMode("edit");
  }, []);

  const handleNewExpense = useCallback(() => {
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

      console.log("[ExpensesManager] Initialized new expense draft:", draft);

      setDuplicateDraft(draft);
      setActiveExpense(null);
      activeExpenseRef.current = null;
      setMode("new");
    } catch (err) {
      console.error("[ExpensesManager] Failed to initialize new expense:", err);
      toast.error(
        err instanceof Error ? err.message : "Failed to create new expense.",
      );
    }
  }, [majik]);

  const handleDuplicate = useCallback(
    async (exp: ExpenseRecord) => {
      try {
        const duplicated = await majik.duplicateExpense(exp);
        setDuplicateDraft(duplicated);
        setActiveExpense(null);
        activeExpenseRef.current = null;
        setMode("duplicate");
      } catch (err) {
        console.error("[ExpensesManager] duplicate failed:", err);
        toast.error(err instanceof Error ? err.message : "Duplicate failed.");
      }
    },
    [majik],
  );

  const handleBack = useCallback(() => {
    setActiveExpense(null);
    activeExpenseRef.current = null;
    setDuplicateDraft(null);
    setMode("list");
    loadExpenses();
  }, [loadExpenses]);

  // ── Panel update (called by ExpensePanel on every save) ───────────────────

  const handlePanelUpdate = useCallback(
    async (updated: ExpenseRecord) => {
      lastCommittedRef.current = updated.id;
      setExpenses((prev) => {
        const exists = prev.some((e) => e.id === updated.id);
        return exists
          ? prev.map((e) => (e.id === updated.id ? updated : e))
          : [updated, ...prev];
      });
      setActiveExpense(updated);
      activeExpenseRef.current = updated;

      // Transition from new/duplicate → edit once saved for the first time
      if (mode === "new" || mode === "duplicate") setMode("edit");
    },
    [mode],
  );

  // ── Status transition (via ExpenseStatusQuickActions) ─────────────────────

  const handleStatusTransition = useCallback(
    async (to: ExpenseRecordStatus) => {
      if (!panelRef.current) {
        console.warn(
          "[ExpensesManager] panelRef not mounted — cannot transition.",
        );
        return;
      }
      setIsTransitioning(true);
      try {
        await panelRef.current.applyStatusTransition(to);
      } catch (err) {
        console.error("[ExpensesManager] status transition failed:", err);
        toast.error(
          err instanceof Error ? err.message : "Status transition failed.",
        );
      } finally {
        setIsTransitioning(false);
      }
    },
    [],
  );

  // ── Refund (from ExpenseStatusQuickActions modal) ─────────────────────────

  const handleRefund = useCallback(
    async (updatedExpense: ExpenseRecord) => {
      try {
        await majik.storeExpense(updatedExpense);
        handlePanelUpdate(updatedExpense);
      } catch (err) {
        console.error("[ExpensesManager] refund failed:", err);
        toast.error(err instanceof Error ? err.message : "Refund failed.");
      }
    },
    [majik, handlePanelUpdate],
  );

  // ── Delete ────────────────────────────────────────────────────────────────

  const handleDeleteRequest = useCallback((exp: ExpenseRecord) => {
    setDeleteTarget({ expenses: [exp], kind: "single" });
  }, []);

  const handleBulkDeleteRequest = useCallback((exps: ExpenseRecord[]) => {
    if (exps.length === 0) return;
    setDeleteTarget({ expenses: exps, kind: "bulk" });
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      for (const exp of deleteTarget.expenses) {
        await majik.removeExpense?.(exp.id);
      }
      const deletedIds = new Set(deleteTarget.expenses.map((e) => e.id));
      setExpenses((prev) => prev.filter((e) => !deletedIds.has(e.id)));
      if (activeExpense && deletedIds.has(activeExpense.id)) {
        setActiveExpense(null);
        activeExpenseRef.current = null;
        setMode("list");
      }
    } catch (err) {
      console.error("[ExpensesManager] delete failed:", err);
      toast.error(err instanceof Error ? err.message : "Delete failed.");
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  }, [deleteTarget, activeExpense, majik]);

  const handleDeleteCancel = useCallback(() => setDeleteTarget(null), []);

  // ── CSV export ────────────────────────────────────────────────────────────

  // const handleExportCSV = useCallback(
  //   (scope: "all" | "selected") => {
  //     const target =
  //       scope === "selected" ? selectedExpensesForExport : filteredExpenses;
  //     majik.exportExpensesCSV?.(target);
  //   },
  //   [selectedExpensesForExport, filteredExpenses, majik],
  // );

  // const handleBulkExport = useCallback(
  //   (_mode: "csv", selected: ExpenseRecord[]) => {
  //     majik.exportExpensesCSV?.(selected);
  //   },
  //   [majik],
  // );

  // ── Derived ───────────────────────────────────────────────────────────────

  const toolbarTitle = useMemo(() => {
    if (mode === "list")
      return showingOrphans ? "Other Accounts' Expenses" : "My Expenses";
    if (mode === "new") return "New Expense";
    if (mode === "duplicate") return "Duplicate Expense";
    return activeExpense?.description ?? "Expense";
  }, [mode, activeExpense, showingOrphans]);

  const listSubtitle = useMemo(() => {
    if (mode !== "list") return activeExpense?.createdAt;
    const total = expenses.length;
    const shown = filteredExpenses.length;
    if (shown === total)
      return `${total} ${total === 1 ? "expense" : "expenses"}`;
    return `${shown} of ${total} ${total === 1 ? "expense" : "expenses"}`;
  }, [mode, expenses.length, filteredExpenses.length, activeExpense]);

  const deleteDialogTitle =
    deleteTarget?.kind === "bulk"
      ? `Delete ${deleteTarget.expenses.length} Expenses`
      : "Delete Expense";

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Root id="section-expenses">
      {mode === "list" ? (
        <GuideHelper docsPath="https://majikah.solutions/products/majik-buwiz/docs/buwiz-expenses-search-filter" />
      ) : (
        <GuideHelper docsPath="https://majikah.solutions/products/majik-buwiz/docs/buwiz-expenses-create-edit" />
      )}

      {/* ── Header ── */}
      <PanelHeader>
        <HeaderLeft>
          <PanelTitle>{toolbarTitle}</PanelTitle>
          <PanelSubtitle id="badge-expenses-count">
            {listSubtitle}
          </PanelSubtitle>
          {mode === "list" && orphanCount > 0 && (
            <OrphanPill $active={showingOrphans} onClick={handleToggleOrphans}>
              {showingOrphans ? (
                <>× Back to mine</>
              ) : (
                <>
                  {orphanCount} expense
                  {orphanCount !== 1 ? "s" : ""} from other accounts
                </>
              )}
            </OrphanPill>
          )}
        </HeaderLeft>

        <HeaderActions>
          {/* ── Quick status transitions (non-list, non-orphan view only) ── */}
          {mode !== "list" && !showingOrphans && activeExpense && (
            <ExpenseStatusQuickActions
              expense={activeExpense}
              onTransition={handleStatusTransition}
              onRefund={handleRefund}
              disabled={isTransitioning}
            />
          )}

          {mode !== "list" && (
            <BackButton onClick={handleBack}>
              <ArrowLeftIcon size={13} weight="bold" />
              Back to list
            </BackButton>
          )}

          {(mode === "view" || mode === "edit" || mode === "duplicate") && (
            <ModePill $mode={mode}>
              {mode === "view"
                ? "Read-only"
                : mode === "duplicate"
                  ? "Duplicate"
                  : "Editing"}
            </ModePill>
          )}

          {mode === "list" && (
            <>
              {/* {selectedExpensesForExport.length > 0 && (
                <ExportButton
                  onClick={() => handleExportCSV("selected")}
                  title={`Export ${selectedExpensesForExport.length} selected expenses to CSV`}
                  id="button-expenses-export-csv-selected"
                >
                  <DownloadSimpleIcon size={13} />
                  Export selected ({selectedExpensesForExport.length})
                </ExportButton>
              )} */}
              {/* 
              <ExportButton
                onClick={() => handleExportCSV("all")}
                title="Export all expenses to CSV"
                id="button-expenses-export-csv"
              >
                <DownloadSimpleIcon size={13} />
                Export CSV
              </ExportButton> */}

              <IconButton
                onClick={loadExpenses}
                title="Refresh list"
                id="button-expenses-refresh"
              >
                <ArrowClockwiseIcon size={13} />
              </IconButton>

              <IconButton
                onClick={() => setRecurringOpen(true)}
                title="Manage recurring expenses"
                id="button-expenses-recurring"
              >
                <RepeatIcon size={13} />
                Recurring
              </IconButton>

              <NewExpenseButton
                onClick={handleNewExpense}
                id="button-expenses-new"
              >
                <PlusIcon size={13} weight="bold" />
                New Expense
              </NewExpenseButton>

              <StyledIconButton
                icon={GearIcon}
                id="button-expense-settings"
                onClick={() => {
                  /* settings modal hook-point */
                }}
                size={24}
                title="Expense Settings"
                aria-description="Configure your default expense preferences."
              />
            </>
          )}
        </HeaderActions>
      </PanelHeader>

      {/* ── Search bar (list mode only) ── */}
      {mode === "list" && !loading && !error && (
        <ExpenseSearchBar
          expenses={expenses}
          visibleColumnKeys={visibleColumnKeys}
          allColumnKeys={ALL_EXPENSE_COLUMN_KEYS}
          onFilter={setFilteredExpenses}
          onColumnVisibilityChange={handleColumnVisibilityChange}
        />
      )}

      {/* ── Body ── */}
      <Body>
        {/* LIST */}
        {mode === "list" &&
          (loading ? (
            <CenterState>
              <ArrowClockwiseIcon size={28} className="spinning" />
              Loading expenses…
            </CenterState>
          ) : error ? (
            <CenterState>
              <WarningCircleIcon size={28} />
              {error}
            </CenterState>
          ) : (
            <ExpenseTable
              items={filteredExpenses}
              columns={extraColumns}
              visibleColumnKeys={visibleColumnKeys}
              pageSize={pageSize}
              paginationAt={paginationAt}
              onView={handleView}
              onEdit={!showingOrphans ? handleEdit : undefined}
              onDelete={handleDeleteRequest}
              onBulkDelete={handleBulkDeleteRequest}
              onDuplicate={handleDuplicate}
              // onBulkExport={handleBulkExport}
              // onSelectionChange={setSelectedExpensesForExport}
              isReadOnly={showingOrphans}
            />
          ))}

        {/* VIEW — readonly */}
        {mode === "view" && activeExpense && (
          <ExpensePanel
            key={`expense-view-${activeExpense.id}`}
            majik={majik}
            initialExpense={activeExpense}
            readonly
            ref={panelRef}
            onUpdate={handlePanelUpdate}
          />
        )}

        {/* EDIT */}
        {mode === "edit" && activeExpense && (
          <ExpensePanel
            key={`expense-edit-${activeExpense.id}`}
            majik={majik}
            initialExpense={activeExpense}
            onUpdate={handlePanelUpdate}
            ref={panelRef}
          />
        )}

        {/* NEW — blank draft, pre-built in the manager */}
        {mode === "new" && duplicateDraft && (
          <ExpensePanel
            key={`new-${duplicateDraft.id}`}
            majik={majik}
            initialDraft={duplicateDraft}
            onUpdate={handlePanelUpdate}
            ref={panelRef}
          />
        )}

        {/* DUPLICATE — pre-filled draft */}
        {mode === "duplicate" && duplicateDraft && (
          <ExpensePanel
            key={`duplicate-${duplicateDraft.id}`}
            majik={majik}
            initialDraft={duplicateDraft}
            onUpdate={handlePanelUpdate}
            ref={panelRef}
          />
        )}
      </Body>

      <RecurringExpenseManagerModal
        isOpen={recurringOpen}
        onOpenChange={setRecurringOpen}
        majik={majik}
      />

      {/* ── Delete confirmation dialog ── */}
      <DynamicPopUp
        isOpen={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) handleDeleteCancel();
        }}
        modal={{
          title: deleteDialogTitle,
          description: "This action cannot be undone.",
        }}
        buttons={{
          cancel: { text: "Cancel", onClick: handleDeleteCancel },
          confirm: {
            text: isDeleting ? "Deleting…" : "Delete",
            onClick: handleDeleteConfirm,
          },
        }}
      >
        <ConfirmBody>
          <WarningCircleIcon size={30} color="var(--color-error, #c74e4e)" />

          {deleteTarget?.kind === "single" ? (
            <ConfirmText>
              Delete expense{" "}
              <ConfirmMono>
                {deleteTarget.expenses[0]?.description?.slice(0, 40) ??
                  deleteTarget.expenses[0]?.id.slice(0, 10)}
              </ConfirmMono>
              ? This cannot be undone.
            </ConfirmText>
          ) : (
            <>
              <ConfirmText>
                Delete the following{" "}
                <strong>{deleteTarget?.expenses.length}</strong> expenses? This
                cannot be undone.
              </ConfirmText>
              <BulkList>
                {(deleteTarget?.expenses ?? []).map((exp) => (
                  <BulkItem key={exp.id}>
                    {exp.description?.slice(0, 50) ?? exp.id.slice(0, 14)}
                  </BulkItem>
                ))}
              </BulkList>
            </>
          )}
        </ConfirmBody>
      </DynamicPopUp>
    </Root>
  );
};
