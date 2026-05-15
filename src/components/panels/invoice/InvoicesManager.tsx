/**
 * InvoicesManager.tsx
 *
 * Mode state machine:
 *   "list" → InvoiceTable
 *   "view" → InvoicePanel (readonly)
 *   "edit" → InvoicePanel (editable) — blocked for sealed invoices
 *   "new"  → InvoicePanel (blank draft)
 *   "duplicate" → InvoicePanel (pre-filled draft from a sealed invoice,
 *                  stripped of invoice number, date reset to now)
 *
 * Search / filter / column-visibility:
 *   - InvoiceSearchBar sits below the PanelHeader (list mode only)
 *   - filteredInvoices is derived from invoices via Fuse + hard filters
 *   - visibleColumnKeys persisted via majik.setInvoiceTableColumns()
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
  DownloadSimpleIcon,
  LockKeyIcon,
  PlusIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";

import type { InvoiceStatus, MajikInvoice } from "@majikah/majik-invoice";
import { GeneralInvoice } from "@majikah/majik-invoice";

import { InvoiceTable, type InvoiceColumnDef } from "./InvoiceTable";
import { InvoicePanel, InvoicePanelHandle } from "../InvoicePanel";
import { InvoiceSearchBar } from "./InvoiceSearchBar";
import DynamicPopUp from "@/components/functional/DynamicPopUp";
import GuideHelper from "@/components/functional/GuideHelper";
import { StatusQuickActions } from "./InvoiceStatusQuickActions";
import { MajikBuwizDatabase } from "@/components/majik-context-wrapper/majik-buwiz-database";
import { toast } from "sonner";
import CSVExportDialog from "./CSVExportDialog";
import { CtrlBtn } from "@/globals/buttons";
import { launchTourMyInvoices } from "@/lib/shepherd-js/tutorials/tutorial-my-invoices";
import { useShepherd } from "@/lib/shepherd-js/use-shepherd";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ManagerMode = "list" | "view" | "edit" | "new" | "duplicate";

interface DeleteTarget {
  invoices: MajikInvoice[];
  kind: "single" | "bulk";
}

// ---------------------------------------------------------------------------
// Column keys
// ---------------------------------------------------------------------------

/**
 * Canonical list of all default column keys with their display labels.
 * Used by InvoiceSearchBar to drive the column-visibility popover.
 * Must stay in sync with DEFAULT_COLUMNS in InvoiceTable.tsx.
 */
export const ALL_INVOICE_COLUMN_KEYS: { key: string; label: string }[] = [
  { key: "invoiceNumber", label: "Invoice #" },
  { key: "issuer", label: "Issuer" },
  { key: "recipient", label: "Recipient" },
  { key: "status", label: "Status" },
  { key: "mode", label: "Mode" },
  { key: "amount", label: "Amount" },
  { key: "issueDate", label: "Issue Date" },
  { key: "dueDate", label: "Due Date" },
  { key: "sealed", label: "Seal" },
];

const DEFAULT_VISIBLE_KEYS = new Set(ALL_INVOICE_COLUMN_KEYS.map((c) => c.key));

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

// ─── Panel header ─────────────────────────────────────────────────────────────
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
// Styled — Toolbar
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

const NewInvoiceButton = styled.button`
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

const ExportButton = styled.button`
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

// ---------------------------------------------------------------------------
// Styled — Loading / error
// ---------------------------------------------------------------------------

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
// Styled — Delete confirm modal body
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

export interface InvoicesManagerProps {
  majik: MajikBuwizDatabase;
  extraColumns?: InvoiceColumnDef[];
  pageSize?: number;
  paginationAt?: "top" | "bottom" | "both";
  isAdmin?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const InvoicesManager: React.FC<InvoicesManagerProps> = ({
  majik,
  extraColumns,
  pageSize,
  paginationAt,
  isAdmin = true,
}) => {
  const tour = useShepherd();
  // ── Invoice list ──────────────────────────────────────────────────────────

  const [invoices, setInvoices] = useState<MajikInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Search / filter / column visibility ───────────────────────────────────

  const [filteredInvoices, setFilteredInvoices] = useState<MajikInvoice[]>([]);
  const [visibleColumnKeys, setVisibleColumnKeys] =
    useState<Set<string>>(DEFAULT_VISIBLE_KEYS);

  // ── View state ────────────────────────────────────────────────────────────

  const [mode, setMode] = useState<ManagerMode>("list");
  const [activeInvoice, setActiveInvoice] = useState<MajikInvoice | null>(null);
  // Keep a ref to the live active invoice so we can update it in-place
  // without forcing remounts. The `activeInvoice` state is used for
  // rendering metadata; `activeInvoiceRef` is the authoritative object
  // reference that can be mutated or replaced when updates arrive.
  const activeInvoiceRef = useRef<MajikInvoice | null>(null);

  const [duplicateDraft, setDuplicateDraft] = useState<GeneralInvoice | null>(
    null,
  );

  // ── Delete dialog ─────────────────────────────────────────────────────────

  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [isTransitioning, setIsTransitioning] = useState<boolean>(false);

  const panelRef = useRef<InvoicePanelHandle>(null);

  const [csvDialogOpen, setCsvDialogOpen] = useState(false);
  const [csvScope, setCsvScope] = useState<"all" | "selected">("all");
  const [csvInvoices, setCsvInvoices] = useState<MajikInvoice[]>([]);
  const [selectedInvoicesForExport, setSelectedInvoicesForExport] = useState<
    MajikInvoice[]
  >([]);

  // ── Load invoices ─────────────────────────────────────────────────────────

  const loadInvoices = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = majik.listInvoices();
      setInvoices(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load invoices");
    } finally {
      setLoading(false);
    }
  }, [majik]);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  const lastCommittedRef = useRef<string | null>(null);

  // Clone a MajikInvoice while preserving non-enumerable properties
  // (e.g., internal decrypted cache). We copy property descriptors so
  // symbol/private fields and non-enumerable props are retained.
  const cloneWithDescriptors = useCallback(<T extends object>(obj: T): T => {
    const clone = Object.create(Object.getPrototypeOf(obj));
    for (const key of Reflect.ownKeys(obj)) {
      const desc = Object.getOwnPropertyDescriptor(obj, key as PropertyKey);
      if (desc) Object.defineProperty(clone, key as PropertyKey, desc);
    }
    return clone as T;
  }, []);

  // Ensure the provided MajikInvoice is decrypted (if possible) and return
  // the decrypted instance. If decryption fails, return the original object.
  const ensureDecrypted = useCallback(
    async (inv: MajikInvoice | null): Promise<MajikInvoice | null> => {
      if (!inv) return null;
      if (inv.isEncrypted && !inv.hasDecryptedCache) {
        try {
          // Unlock / decrypt in-place via the client which emits events
          const unlocked = await majik.unlockInvoice(inv);
          return unlocked;
        } catch (err) {
          console.warn("[InvoicesManager] failed to decrypt invoice:", err);
          return inv;
        }
      }
      return inv;
    },
    [majik],
  );
  // Event handler — only push refresh if the update is truly external
  useEffect(() => {
    if (!majik) return;
    const handler = (updated: any) => {
      // run async decryption and state updates without blocking the emitter
      (async () => {
        loadInvoices();

        const maybe = (updated as MajikInvoice) ?? null;
        const decrypted = await ensureDecrypted(maybe);

        // Clone to ensure new identity so children receive updated props
        const toSet = decrypted ? cloneWithDescriptors(decrypted) : null;

        // If this update was the one the panel just committed, consume the
        // marker and skip updating the mounted panel state — the panel is the
        // authoritative source in that moment and already applied the change.
        if (toSet && lastCommittedRef.current === toSet.id) {
          lastCommittedRef.current = null;
        } else {
          setActiveInvoice(toSet as MajikInvoice | null);
          activeInvoiceRef.current = toSet as MajikInvoice | null;

          // Only notify the mounted panel if this wasn't triggered by the panel
          // itself. Prefer the new `receiveUpdate` imperative method; fall
          // back to `refresh` if it's not implemented by the panel.
          if (toSet && lastCommittedRef.current !== toSet.id) {
            if (typeof panelRef.current?.receiveUpdate === "function") {
              await panelRef.current.receiveUpdate(toSet);
            } else {
              await panelRef.current?.refresh(toSet);
            }
          }

          // Reset after consuming so future external updates on same id still work
          lastCommittedRef.current = null;
        }
      })().catch((e) => console.error(e));
    };
    majik.on("invoice-updated", handler);
    majik.on("invoice-created", handler);
    return () => {
      majik.off("invoice-updated", handler);
      majik.off("invoice-created", handler);
    };
  }, [majik, ensureDecrypted, loadInvoices]);

  // ── Load persisted column visibility ─────────────────────────────────────

  useEffect(() => {
    (async () => {
      try {
        const saved = await majik.getInvoiceTableColumns();
        if (saved && saved.length > 0) {
          // saved is InvoiceColumnDef[] — extract keys
          const keys = saved.map((c: InvoiceColumnDef) => c.key);
          setVisibleColumnKeys(new Set(keys));
        }
        // else: leave DEFAULT_VISIBLE_KEYS in place
      } catch (err) {
        // Non-fatal — fall back to defaults silently
        console.warn("[InvoicesManager] Could not load column prefs:", err);
      }
    })();
  }, [majik]);

  // ── Persist column visibility on change ──────────────────────────────────

  const handleColumnVisibilityChange = useCallback(
    async (keys: Set<string>) => {
      setVisibleColumnKeys(keys);
      try {
        // Persist as InvoiceColumnDef[] (only key matters for storage)
        const payload = Array.from(keys).map(
          (key) => ({ key }) as InvoiceColumnDef,
        );
        await majik.setInvoiceTableColumns(payload);
      } catch (err) {
        console.warn("[InvoicesManager] Could not persist column prefs:", err);
      }
    },
    [majik],
  );

  // ── Derive visible extra columns ──────────────────────────────────────────

  /**
   * Build the filtered column list to pass to InvoiceTable.
   * extraColumns are always shown (they come from the host app, not the
   * default set), so we only filter DEFAULT columns here.
   *
   * InvoiceTable merges extraColumns onto the end of DEFAULT_COLUMNS
   * internally, so we need to pass a custom `columns` prop that replaces the
   * defaults. We rebuild that merged list with visibility applied.
   */
  const visibleExtraColumns = useMemo<InvoiceColumnDef[] | undefined>(() => {
    // If no extra columns and all default columns are visible, pass undefined
    // so InvoiceTable uses its own DEFAULT_COLUMNS untouched.
    if (
      !extraColumns &&
      visibleColumnKeys.size === ALL_INVOICE_COLUMN_KEYS.length
    ) {
      return undefined;
    }
    return extraColumns;
  }, [extraColumns, visibleColumnKeys]);

  // ---------------------------------------------------------------------------
  // Navigation
  // ---------------------------------------------------------------------------

  const handleView = useCallback(
    (inv: MajikInvoice) => {
      (async () => {
        const decrypted = await ensureDecrypted(inv);
        const toSet = decrypted ? cloneWithDescriptors(decrypted) : inv;
        setActiveInvoice(toSet as MajikInvoice);
        activeInvoiceRef.current = toSet as MajikInvoice;
        setMode("view");
      })().catch(console.error);
    },
    [ensureDecrypted],
  );

  const handleEdit = useCallback(
    (inv: MajikInvoice) => {
      if (inv.isSealed) return;
      (async () => {
        const decrypted = await ensureDecrypted(inv);
        const toSet = decrypted ? cloneWithDescriptors(decrypted) : inv;
        setActiveInvoice(toSet as MajikInvoice);
        activeInvoiceRef.current = toSet as MajikInvoice;
        setMode("edit");
      })().catch(console.error);
    },
    [ensureDecrypted],
  );

  const handleNewInvoice = useCallback(() => {
    setActiveInvoice(null);
    activeInvoiceRef.current = null;
    setDuplicateDraft(null);
    setMode("new");
  }, []);

  const handleDuplicate = useCallback(async (inv: MajikInvoice) => {
    try {
      const source = await majik.duplicateInvoice(inv);

      const draft = source.invoice;

      setDuplicateDraft(draft);
      setActiveInvoice(null);
      activeInvoiceRef.current = null;
      setMode("duplicate");
    } catch (err) {
      console.error("[InvoicesManager] duplicate failed:", err);
    }
  }, []);

  const handleBack = useCallback(() => {
    const lockedInvoice = activeInvoice?.secureLock();
    if (lockedInvoice) {
      // Store the lock state directly, don't go through handlePanelUpdate
      majik.storeInvoice(lockedInvoice).catch(console.error);
      setInvoices((prev) =>
        prev.map((inv) => (inv.id === lockedInvoice.id ? lockedInvoice : inv)),
      );
    }
    setActiveInvoice(null);
    activeInvoiceRef.current = null;
    setDuplicateDraft(null);
    setMode("list");
    loadInvoices();
  }, [activeInvoice, majik, loadInvoices]);

  // ── onUpdate from InvoicePanel ────────────────────────────────────────────
  // In InvoicesManager.tsx — handlePanelUpdate
  const handlePanelUpdate = useCallback(
    async (updated: MajikInvoice) => {
      const toUse =
        updated.isEncrypted && updated.isLocked
          ? ((await ensureDecrypted(updated)) ?? updated)
          : updated;

      const cloned = cloneWithDescriptors(toUse);

      lastCommittedRef.current = cloned.id;
      setInvoices((prev) => {
        const exists = prev.some((inv) => inv.id === cloned.id);
        return exists
          ? prev.map((inv) => (inv.id === cloned.id ? cloned : inv))
          : [cloned, ...prev];
      });
      setActiveInvoice(cloned);
      activeInvoiceRef.current = cloned;

      if (mode === "new" || mode === "duplicate") setMode("edit");
    },
    [mode, ensureDecrypted, cloneWithDescriptors],
  );
  const handleStatusTransition = useCallback(async (to: InvoiceStatus) => {
    if (!panelRef.current) {
      console.warn(
        "[InvoicesManager] panelRef not mounted — cannot transition.",
      );
      return;
    }
    setIsTransitioning(true);
    try {
      await panelRef.current.applyStatusTransition(to);
    } catch (err) {
      console.error("[InvoicesManager] status transition failed:", err);
      toast.error(
        err instanceof Error ? err.message : "Status transition failed.",
      );
    } finally {
      setIsTransitioning(false);
    }
  }, []);

  const handleRestart = useCallback(async () => {
    const invoice = activeInvoice;
    if (!invoice) return;

    if (invoice.isEncrypted && !invoice.hasDecryptedCache) {
      toast.error("Decrypt the invoice before restarting.");
      return;
    }

    setIsTransitioning(true);
    try {
      // resendInvoice resets status to draft → issued → sent and re-signs fresh
      const result = await majik.restartInvoice(invoice);
      setActiveInvoice(result);
      toast.success("Invoice restarted and reissued.");
    } catch (err) {
      console.error("[handleRestart] failed:", err);
      toast.error(err instanceof Error ? err.message : "Restart failed.");
    } finally {
      setIsTransitioning(false);
    }
  }, [activeInvoice, majik]);

  const handlePayment = useCallback(async (updatedGi: GeneralInvoice) => {
    if (!panelRef.current) {
      console.warn(
        "[InvoicesManager] panelRef not mounted — cannot apply payment.",
      );
      return;
    }
    setIsTransitioning(true);
    try {
      await panelRef.current.applyPayment(updatedGi);
    } catch (err) {
      console.error("[InvoicesManager] payment failed:", err);
      toast.error(
        err instanceof Error ? err.message : "Payment recording failed.",
      );
    } finally {
      setIsTransitioning(false);
    }
  }, []);

  // ── Delete ────────────────────────────────────────────────────────────────

  const handleDeleteRequest = useCallback((inv: MajikInvoice) => {
    setDeleteTarget({ invoices: [inv], kind: "single" });
  }, []);

  const handleBulkDeleteRequest = useCallback((invs: MajikInvoice[]) => {
    if (invs.length === 0) return;
    setDeleteTarget({ invoices: invs, kind: "bulk" });
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      for (const inv of deleteTarget.invoices) {
        await majik.removeInvoice?.(inv.id);
      }
      const deletedIds = new Set(deleteTarget.invoices.map((inv) => inv.id));
      setInvoices((prev) => prev.filter((inv) => !deletedIds.has(inv.id)));
      if (activeInvoice && deletedIds.has(activeInvoice.id)) {
        setActiveInvoice(null);
        activeInvoiceRef.current = null;
        setMode("list");
      }
    } catch (err) {
      console.error("[InvoicesManager] delete failed:", err);
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  }, [deleteTarget, activeInvoice, majik]);

  const handleDeleteCancel = useCallback(() => {
    setDeleteTarget(null);
  }, []);

  const handleExportAll = useCallback(() => {
    setCsvInvoices(filteredInvoices);
    setCsvScope("all");
    setCsvDialogOpen(true);
  }, [filteredInvoices]);

  const handleExportSelected = useCallback((selected: MajikInvoice[]) => {
    setCsvInvoices(selected);
    setCsvScope("selected");
    setCsvDialogOpen(true);
  }, []);

  const handleSync = useCallback(
    async (source: "local" | "cloud") => {
      const invoice = activeInvoice;
      if (!invoice) return;

      setIsTransitioning(true);
      try {
        switch (source) {
          case "local": {
            // Push the locally stored copy to the cloud
            const local = await majik.getInvoice(invoice.id);
            if (!local) throw new Error("Local invoice not found.");
            const updated = await majik.updateInvoice(local);
            setActiveInvoice(null);
            setActiveInvoice(updated);
            toast.success("Local copy synced to cloud.");
            break;
          }
          case "cloud": {
            // Pull a fresh copy from cloud and overwrite local
            const remote = await majik.getInvoiceRemote(invoice.id, true);
            await majik.storeInvoice(remote);
            setActiveInvoice(null);
            setActiveInvoice(remote);
            toast.success("Cloud copy synced to local.");
            break;
          }
        }
      } catch (err) {
        console.error("[handleSync] failed:", err);
        toast.error(err instanceof Error ? err.message : "Sync failed.");
      } finally {
        setIsTransitioning(false);
      }
    },
    [activeInvoice, majik],
  );

  // ── handleFetchRemote — for the sync drawer ───────────────────────────────

  const handleFetchRemote = useCallback(async (): Promise<MajikInvoice> => {
    const invoice = activeInvoice;
    if (!invoice) throw new Error("No invoice selected.");

    try {
      const fetchedInvoice = await majik.getInvoiceRemote(invoice.id, true);
      return fetchedInvoice;
    } catch (err: any) {
      if (err.code === "NOT_FOUND") {
        toast.error("Sync Failed", {
          description: "This invoice is not yet uploaded to the cloud.",
          id: "toast-fetch-invoice-not-found",
        });
        throw err;
      } else {
        toast.error("Sync Failed", {
          description: err.message,
          id: "toast-fetch-invoice-error",
        });
        throw err;
      }
    }
  }, [activeInvoice, majik]);

  const handleSwitchSignedOnly = useCallback(async () => {
    const invoice = activeInvoice;
    if (!invoice) return;

    setIsTransitioning(true);
    try {
      const result = await majik.switchInvoiceMode(
        invoice,
        "signed-only",
        undefined,
        { dropSignatures: false },
      );
      setActiveInvoice(result);
      toast.success("Invoice is now Signed Only.");
    } catch (err) {
      console.error("[handleSwitchSignedOnly] failed:", err);
      toast.error(err instanceof Error ? err.message : "Mode switch failed.");
    } finally {
      setIsTransitioning(false);
    }
  }, [activeInvoice, majik]);

  const handleSwitchEncrypted = useCallback(async () => {
    const invoice = activeInvoice;
    if (!invoice) return;

    setIsTransitioning(true);
    try {
      const result = await majik.switchInvoiceMode(
        invoice,
        "encrypted-and-signed",
        undefined,
        { dropSignatures: false },
      );
      setActiveInvoice(result);
      toast.success("Invoice is now Encrypted and Signed.");
    } catch (err) {
      console.error("[handleSwitchEncrypted] failed:", err);
      toast.error(err instanceof Error ? err.message : "Mode switch failed.");
    } finally {
      setIsTransitioning(false);
    }
  }, [activeInvoice, majik]);

  // ── Derived ───────────────────────────────────────────────────────────────

  const toolbarTitle = useMemo(() => {
    if (mode === "list") return "My Invoices";
    if (mode === "new") return "New Invoice";
    if (mode === "duplicate") return "Duplicate Invoice";
    return (
      activeInvoice?.public?.invoiceNumber ??
      activeInvoice?.id.slice(0, 10) ??
      "Invoice"
    );
  }, [mode, activeInvoice]);

  const deleteDialogTitle =
    deleteTarget?.kind === "bulk"
      ? `Delete ${deleteTarget.invoices.length} Invoices`
      : "Delete Invoice";

  // ── Subtitle for list mode — reflects filtered count ─────────────────────

  const listSubtitle = useMemo(() => {
    if (mode !== "list") return activeInvoice?.public.issuedAt;
    const total = invoices.length;
    const shown = filteredInvoices.length;
    if (shown === total)
      return `${total} ${total === 1 ? "invoice" : "invoices"}`;
    return `${shown} of ${total} ${total === 1 ? "invoice" : "invoices"}`;
  }, [mode, invoices.length, filteredInvoices.length, activeInvoice]);

  const [userCanSign, setUserCanSign] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const checkPermission = async () => {
      if (!activeInvoice) {
        setUserCanSign(false);
        return;
      }

      try {
        const result = await majik.canSignInvoice(activeInvoice);

        if (!cancelled) {
          setUserCanSign(result.permitted);
        }
      } catch (err) {
        if (!cancelled) {
          setUserCanSign(false);
        }
      }
    };

    checkPermission();

    return () => {
      cancelled = true;
    };
  }, [activeInvoice]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Root id="section-invoices">
      {mode === "list" ? (
        <GuideHelper
          docsPath="https://majikah.solutions/products/majik-buwiz/docs/buwiz-invoices-search-filter"
          startTour={() => launchTourMyInvoices(tour)}
        />
      ) : (
        <GuideHelper docsPath="https://majikah.solutions/products/majik-buwiz/docs/buwiz-invoices-create-edit" />
      )}
      {/* ── Header ── */}
      <PanelHeader>
        <HeaderLeft>
          <PanelTitle>{toolbarTitle}</PanelTitle>
          <PanelSubtitle id="badge-invoices-count">{listSubtitle}</PanelSubtitle>
        </HeaderLeft>

        <HeaderActions>
          {/* ── Quick status transitions (non-list, non-sealed modes) ── */}
          {mode !== "list" &&
            (!activeInvoice?.isSealed ||
              (isAdmin && activeInvoice?.public?.status === "void")) &&
            activeInvoice && (
              <StatusQuickActions
                onTransition={handleStatusTransition}
                onPayment={handlePayment}
                onRestart={handleRestart}
                disabled={isTransitioning}
                isAdmin={isAdmin}
                majikInvoice={activeInvoice}
                onFetchRemote={handleFetchRemote}
                onSync={handleSync}
              />
            )}

          {/* ── Quick mode switching ── */}
          {mode !== "list" &&
            activeInvoice &&
            (activeInvoice.isEncrypted ? (
              <>
                <CtrlBtn $variant="ghost" onClick={handleSwitchSignedOnly}>
                  <LockKeyIcon size={13} weight="bold" />
                  Switch to Signed Only
                </CtrlBtn>
              </>
            ) : (
              <>
                <CtrlBtn $variant="ghost" onClick={handleSwitchEncrypted}>
                  <LockKeyIcon size={13} weight="bold" />
                  Switch to Encrypted
                </CtrlBtn>
              </>
            ))}

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
              {selectedInvoicesForExport.length > 0 && (
                <ExportButton
                  onClick={() =>
                    handleExportSelected(selectedInvoicesForExport)
                  }
                  title={`Export ${selectedInvoicesForExport.length} selected invoices to CSV`}
                >
                  <DownloadSimpleIcon size={13} />
                  Export selected ({selectedInvoicesForExport.length})
                </ExportButton>
              )}

              <ExportButton
                onClick={handleExportAll}
                title="Export all invoices to CSV"
                id="button-invoices-export-csv"
              >
                <DownloadSimpleIcon size={13} />
                Export CSV
              </ExportButton>

              <IconButton onClick={loadInvoices} title="Refresh list" id="button-invoices-refresh">
                <ArrowClockwiseIcon size={13} />
              </IconButton>

              <NewInvoiceButton onClick={handleNewInvoice} id="button-invoices-new">
                <PlusIcon size={13} weight="bold" />
                New Invoice
              </NewInvoiceButton>
            </>
          )}
        </HeaderActions>
      </PanelHeader>

      {/* ── Search bar (list mode only) ── */}
      {mode === "list" && !loading && !error && (
        <InvoiceSearchBar
          invoices={invoices}
          visibleColumnKeys={visibleColumnKeys}
          allColumnKeys={ALL_INVOICE_COLUMN_KEYS}
          onFilter={setFilteredInvoices}
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
              Loading invoices…
            </CenterState>
          ) : error ? (
            <CenterState>
              <WarningCircleIcon size={28} />
              {error}
            </CenterState>
          ) : (
            <InvoiceTable
              items={filteredInvoices}
              columns={visibleExtraColumns}
              visibleColumnKeys={visibleColumnKeys}
              pageSize={pageSize}
              paginationAt={paginationAt}
              onView={handleView}
              onEdit={handleEdit}
              onDelete={handleDeleteRequest}
              onBulkDelete={handleBulkDeleteRequest}
              onDuplicate={handleDuplicate}
              onBulkExport={handleExportSelected}
              onSelectionChange={setSelectedInvoicesForExport}
            />
          ))}

        {/* VIEW — readonly */}
        {mode === "view" && activeInvoice && (
          <InvoicePanel
            key={`invoice-${activeInvoice.id}`}
            majik={majik}
            initialInvoice={activeInvoice}
            readonly
            ref={panelRef}
            onUpdate={handlePanelUpdate}
            canSign={userCanSign}
          />
        )}

        {/* EDIT */}
        {mode === "edit" && activeInvoice && (
          <InvoicePanel
            key={`invoice-${activeInvoice.id}`}
            majik={majik}
            initialInvoice={activeInvoice}
            onUpdate={handlePanelUpdate}
            ref={panelRef}
            canSign={userCanSign}
          />
        )}

        {/* NEW — blank draft */}
        {mode === "new" && (
          <InvoicePanel
            key="new-invoice"
            majik={majik}
            onUpdate={handlePanelUpdate}
          />
        )}

        {/* DUPLICATE — pre-filled draft */}
        {mode === "duplicate" && duplicateDraft && (
          <InvoicePanel
            key={`duplicate-${Date.now()}`}
            majik={majik}
            initialDraft={duplicateDraft}
            onUpdate={handlePanelUpdate}
          />
        )}
      </Body>

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
              Delete invoice{" "}
              <ConfirmMono>
                {deleteTarget.invoices[0]?.public?.invoiceNumber ??
                  deleteTarget.invoices[0]?.id.slice(0, 10)}
              </ConfirmMono>
              ? This cannot be undone.
            </ConfirmText>
          ) : (
            <>
              <ConfirmText>
                Delete the following{" "}
                <strong>{deleteTarget?.invoices.length}</strong> invoices? This
                cannot be undone.
              </ConfirmText>
              <BulkList>
                {(deleteTarget?.invoices ?? []).map((inv) => (
                  <BulkItem key={inv.id}>
                    {inv.public?.invoiceNumber ?? inv.id.slice(0, 14)}
                  </BulkItem>
                ))}
              </BulkList>
            </>
          )}
        </ConfirmBody>
      </DynamicPopUp>

      <CSVExportDialog
        majik={majik}
        isOpen={csvDialogOpen}
        onOpenChange={setCsvDialogOpen}
        invoices={csvInvoices}
        scope={csvScope}
      />
    </Root>
  );
};
