/**
 * RecurringExpenseManagerModal.tsx
 *
 * Wraps the full recurring expense manager UI inside DynamicSlidingDialogue.
 * Designed for 700px width — matches the rest of the app's modal pattern.
 *
 * Usage:
 *   <RecurringExpenseManagerModal
 *     isOpen={open}
 *     onOpenChange={setOpen}
 *     majik={majik}
 *   />
 *
 * Trigger surfaces:
 *   1. ExpensesManager toolbar button
 *   2. ExpensePanel sidebar "Configure Recurring" button
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import DynamicSlidingDialogue from "@/components/functional/DynamicSlidingDialogue";
import DynamicPopUp from "@/components/functional/DynamicPopUp";
import { toast } from "sonner";

import { RecurringExpenseToolbar } from "./RecurringExpenseToolbar";
import type { ViewMode, KanbanGroupBy } from "./RecurringExpenseToolbar";
import { KanbanView } from "./KanbanView";
import { TableView } from "./TableView";

import { MajikBuwizDatabase } from "@/components/majik-context-wrapper/majik-buwiz-database";

import { RecurringExpenseItem } from "@/SDK/majik-buwiz-client/src/core/expenses/recurring/recurring-expense";
import {
  ActualizeExpenseModal,
  ActualizeFormData,
} from "./modals/ActualizeExpenseModal";
import { AddRecurringExpenseModal } from "./modals/AddRecurringExpenseModal";
import Fuse, { IFuseOptions } from "fuse.js";

interface ActualizationResult {
  created: any[];
  skipped: string[];
  ineligible: string[];
  total: number;
}

interface ActualizeOptions {
  month?: string;
  range?: { from: string; to: string };
  strict?: boolean;
}

// ── Styled ───────────────────────────────────────────────────────────────────

const ManagerRoot = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 4px 0 8px;
  min-height: 0;
`;

const ViewArea = styled.div`
  min-height: 320px;
`;

// ── Delete confirm body (reuses app styling, no custom theme) ────────────────

const ConfirmBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 4px 0;
`;

const ConfirmText = styled.p`
  font-size: 13px;
  line-height: 1.6;
  color: ${({ theme }) => theme.colors.textPrimary};
  margin: 0;
`;

const ConfirmMono = styled.span`
  font-family: ${({ theme }) =>
    theme.typography?.fonts?.numbers ?? "monospace"};
  font-size: 12px;
  color: ${({ theme }) => theme.colors.primary};
  background: ${({ theme }) => theme.colors.primarySoft};
  padding: 1px 7px;
  border-radius: ${({ theme }) => theme.borders?.radius?.small ?? "4px"};
`;

// ── Fuse search mapper ────────────────────────────────────────────────────────

function toSearchable(item: RecurringExpenseItem) {
  return {
    _raw: item,
    name: item.name,
    payeeName: item.payee?.legalName ?? "",
    payeeTin: item.payee?.tin ?? "",
    paidByName: item.paidBy?.legalName ?? "",
    category: item.category ?? "",
    frequency: item.frequency ?? "",
    tags: (item.tags ?? []).join(" "),
    description: item.description ?? "",
    status: item.status,
  };
}

const FUSE_OPTIONS: IFuseOptions<ReturnType<typeof toSearchable>> = {
  keys: [
    { name: "name", weight: 0.4 },
    { name: "payeeName", weight: 0.25 },
    { name: "category", weight: 0.12 },
    { name: "tags", weight: 0.1 },
    { name: "description", weight: 0.06 },
    { name: "payeeTin", weight: 0.04 },
    { name: "paidByName", weight: 0.03 },
  ],
  threshold: 0.38,
  ignoreLocation: true,
  includeScore: true,
  shouldSort: true,
  minMatchCharLength: 2,
  ignoreFieldNorm: true,
};

// ── Helpers ──────────────────────────────────────────────────────────────────

type ModalState =
  | { type: "none" }
  | { type: "create" }
  | { type: "edit"; itemId: string }
  | { type: "actualize"; itemId: string }
  | { type: "delete"; itemId: string; itemName: string };

// ── Component ────────────────────────────────────────────────────────────────

interface RecurringExpenseManagerModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  majik: MajikBuwizDatabase;
}

export const RecurringExpenseManagerModal: React.FC<
  RecurringExpenseManagerModalProps
> = ({ isOpen, onOpenChange, majik }) => {
  const rm = majik.recurringExpenseManager;

  // ── Data ────────────────────────────────────────────────────────────────
  const [items, setItems] = useState<RecurringExpenseItem[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("kanban");
  const [kanbanGroupBy, setKanbanGroupBy] =
    useState<KanbanGroupBy>("frequency");
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<ModalState>({ type: "none" });
  const [isActualizing, setIsActualizing] = useState(false);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);

  // ── Load from cache whenever modal opens ───────────────────────────────
  const refresh = useCallback(() => {
    try {
      setItems(rm.listCached());
    } catch {
      toast.error("Failed to load recurring expenses.");
    }
  }, [rm]);

  useEffect(() => {
    if (isOpen) refresh();
  }, [isOpen, refresh]);

  // ── Fuse instance — rebuilds only when items list changes ──────────────────
  const searchableItems = useMemo(() => items.map(toSearchable), [items]);

  const fuse = useMemo(
    () => new Fuse(searchableItems, FUSE_OPTIONS),
    [searchableItems],
  );

  // ── Filtered items — fuzzy search when query ≥ 2 chars ────────────────────
  const filteredItems = useMemo(() => {
    if (!search.trim() || search.trim().length < 2) return items;
    return fuse.search(search).map((r) => r.item._raw);
  }, [items, search, fuse]);

  const stats = useMemo(
    () => ({
      active: items.filter((i) => i.status === "active").length,
      paused: items.filter((i) => i.status === "paused").length,
      ended: items.filter((i) => i.status === "ended").length,
    }),
    [items],
  );

  // ── CRUD ────────────────────────────────────────────────────────────────

  const handleSave = useCallback(
    async (itemData: RecurringExpenseItem) => {
      console.debug("Saving recurring expense item", itemData);
      await rm.save(itemData);
      refresh();
    },
    [rm, refresh],
  );

  const handleDelete = useCallback(async () => {
    if (modal.type !== "delete") return;
    const { itemId, itemName } = modal;
    setIsDeletingId(itemId);
    try {
      await rm.remove(itemId);
      refresh();
      setModal({ type: "none" });
      toast.success(`"${itemName}" deleted.`);
    } catch (err: any) {
      toast.error(err?.message ?? "Delete failed.");
    } finally {
      setIsDeletingId(null);
    }
  }, [modal, rm, refresh]);

  const handlePause = useCallback(
    async (id: string) => {
      try {
        await rm.pause(id);
        refresh();
        toast.success("Expense paused.");
      } catch (err: any) {
        toast.error(err?.message ?? "Failed to pause.");
      }
    },
    [rm, refresh],
  );

  const handleResume = useCallback(
    async (id: string) => {
      try {
        await rm.resume(id);
        refresh();
        toast.success("Expense resumed.");
      } catch (err: any) {
        toast.error(err?.message ?? "Failed to resume.");
      }
    },
    [rm, refresh],
  );

  const handleEnd = useCallback(
    async (id: string) => {
      try {
        await rm.end(id);
        refresh();
        toast.success("Expense ended.");
      } catch (err: any) {
        toast.error(err?.message ?? "Failed to end.");
      }
    },
    [rm, refresh],
  );

  // ── Actualization ────────────────────────────────────────────────────────

  const handleActualize = useCallback(
    async (
      itemId: string,
      data: ActualizeFormData,
    ): Promise<ActualizationResult> => {
      const opts: ActualizeOptions = { strict: data.strict };
      if (data.mode === "month") {
        opts.month = data.month;
      } else {
        opts.range = { from: data.rangeFrom!, to: data.rangeTo! };
      }
      const result = await majik.actualizeRecurringExpense(itemId, opts);
      console.log("Actualization result", result);
      toast.success(
        `Actualized: ${result.created.length} created, ${result.skipped.length} skipped.`,
      );
      return result;
    },
    [majik],
  );

  const handleActualizeAll = useCallback(async () => {
    setIsActualizing(true);
    try {
      const results = await majik.actualizeAllRecurringExpenses();
      let created = 0;
      let skipped = 0;
      results.forEach((r) => {
        created += r.created.length;
        skipped += r.skipped.length;
      });
      toast.success(`Actualized all: ${created} created, ${skipped} skipped.`);
    } catch (err: any) {
      toast.error(err?.message ?? "Actualize all failed.");
    } finally {
      setIsActualizing(false);
    }
  }, [majik]);

  // ── View handlers dispatched to card / table row ─────────────────────────

  const viewHandlers = useMemo(
    () => ({
      onEdit: (id: string) => setModal({ type: "edit", itemId: id }),
      onDelete: (id: string) => {
        const item = items.find((i) => i.id === id);
        if (item) setModal({ type: "delete", itemId: id, itemName: item.name });
      },
      onPause: handlePause,
      onResume: handleResume,
      onEnd: handleEnd,
      onActualize: (id: string) => setModal({ type: "actualize", itemId: id }),
    }),
    [items, handlePause, handleResume, handleEnd],
  );

  const editItem =
    modal.type === "edit" ? items.find((i) => i.id === modal.itemId) : null;
  const actualizeItem =
    modal.type === "actualize"
      ? items.find((i) => i.id === modal.itemId)
      : null;

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── Main sliding dialogue ── */}
      <DynamicSlidingDialogue
        scrollable
        isOpen={isOpen}
        onOpenChange={onOpenChange}
        modal={{
          title: "Recurring Expenses",
          description: `Manage expense templates that repeat on a schedule. ${items.length} template${items.length !== 1 ? "s" : ""}.`,
        }}
        buttons={{
          cancel: { text: "Close", onClick: () => onOpenChange(false) },
          confirm: { text: "Save", hide: true },
        }}
        preventDragClose={modal.type !== "none"}
        width={900}
      >
        <ManagerRoot>
          <RecurringExpenseToolbar
            viewMode={viewMode}
            onViewChange={setViewMode}
            kanbanGroupBy={kanbanGroupBy}
            onKanbanGroupByChange={setKanbanGroupBy}
            onAddNew={() => setModal({ type: "create" })}
            onActualizeAll={handleActualizeAll}
            search={search}
            onSearch={setSearch}
            totalActive={stats.active}
            totalPaused={stats.paused}
            totalEnded={stats.ended}
            isActualizing={isActualizing}
          />

          <ViewArea>
            {viewMode === "kanban" ? (
              <KanbanView
                items={filteredItems}
                groupBy={kanbanGroupBy}
                {...viewHandlers}
              />
            ) : (
              <TableView items={filteredItems} {...viewHandlers} />
            )}
          </ViewArea>
        </ManagerRoot>
      </DynamicSlidingDialogue>

      {/* ── Create ── */}
      {modal.type === "create" && (
        <AddRecurringExpenseModal
          majik={majik}
          open
          onOpenChange={(o) => !o && setModal({ type: "none" })}
          onSave={handleSave}
          onClose={() => setModal({ type: "none" })}
        />
      )}

      {/* ── Edit ── */}
      {modal.type === "edit" && editItem && (
        <AddRecurringExpenseModal
          majik={majik}
          open
          isEditing
          initialData={editItem}
          onOpenChange={(o) => !o && setModal({ type: "none" })}
          onSave={handleSave}
          onClose={() => setModal({ type: "none" })}
        />
      )}

      {/* ── Actualize ── */}
      {modal.type === "actualize" && actualizeItem && (
        <ActualizeExpenseModal
          open
          item={actualizeItem}
          onOpenChange={(o) => !o && setModal({ type: "none" })}
          onSubmit={handleActualize}
        />
      )}

      {/* ── Delete confirm ── */}
      <DynamicPopUp
        isOpen={modal.type === "delete"}
        onOpenChange={(o) => !o && setModal({ type: "none" })}
        modal={{
          title: "Delete Recurring Expense",
          description:
            "This will remove the template. Existing actualized records are unaffected.",
        }}
        buttons={{
          cancel: {
            text: "Cancel",
            onClick: () => setModal({ type: "none" }),
            isDisabled: !!isDeletingId,
          },
          confirm: {
            text: isDeletingId ? "Deleting…" : "Delete",
            onClick: handleDelete,
            isDisabled: !!isDeletingId,
          },
        }}
      >
        <ConfirmBody>
          {modal.type === "delete" && (
            <ConfirmText>
              Delete <ConfirmMono>"{modal.itemName}"</ConfirmMono>? This cannot
              be undone.
            </ConfirmText>
          )}
        </ConfirmBody>
      </DynamicPopUp>
    </>
  );
};
