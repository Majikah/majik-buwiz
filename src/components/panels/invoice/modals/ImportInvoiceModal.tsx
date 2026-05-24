// ImportInvoiceBackupModal.tsx

import React, { useCallback, useEffect, useMemo, useState, memo } from "react";
import { toast } from "sonner";
import styled from "styled-components";

import DynamicPopUp from "@/components/functional/DynamicPopUp";
import { MajikBuwizDatabase } from "@/components/majik-context-wrapper/majik-buwiz-database";
import type { MajikInvoice } from "@majikah/majik-invoice";
import { ImportInvoiceTable } from "../ImportInvoiceTable";
import { ArchiveIcon } from "@phosphor-icons/react";

// ---------------------------------------------------------------------------
// Styled components (mirrors ImportMJKIModal)
// ---------------------------------------------------------------------------

const ModalBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-height: 120px;
`;

const SummaryBar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-radius: 6px;
  background: ${({ theme }) => theme.colors.primarySoft};
  border: 1px solid ${({ theme }) => theme.colors.primary}18;
`;

const SummaryText = styled.div`
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textPrimary};
  opacity: 0.8;

  span {
    font-family: ${({ theme }) => theme.typography.fonts.numbers};
    font-weight: 600;
    color: ${({ theme }) => theme.colors.primary};
  }
`;

const GlobalActions = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
`;

const GlobalActionsLabel = styled.div`
  font-family: ${({ theme }) => theme.typography.fonts.semibold};
  font-size: 9.5px;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.primary};
  opacity: 0.5;
  margin-right: 4px;
`;

const ActionChip = styled.button`
  background: none;
  border: 1px solid ${({ theme }) => theme.colors.primary}28;
  border-radius: 5px;
  padding: 3px 10px;
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  font-size: 10px;
  color: ${({ theme }) => theme.colors.primary};
  cursor: pointer;
  opacity: 0.7;
  transition:
    opacity 0.12s,
    background 0.12s,
    border-color 0.12s;

  &:hover {
    opacity: 1;
    background: ${({ theme }) => theme.colors.primarySoft};
    border-color: ${({ theme }) => theme.colors.primary}55;
  }

  &:disabled {
    opacity: 0.3;
    cursor: default;
  }
`;

const Divider = styled.div`
  height: 1px;
  background: ${({ theme }) => theme.colors.primary}12;
  margin: 2px 0;
`;

const EmptyNotice = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 2.5rem 1rem;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.4;
  text-align: center;
`;

const EmptyText = styled.div`
  font-family: ${({ theme }) => theme.typography.fonts.light};
  font-size: 12px;
`;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ImportInvoiceBackupModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  majik: MajikBuwizDatabase;
  /**
   * Parsed MajikInvoice instances from the backup blob.
   * The caller (App.tsx listener) handles file picking + readInvoicesBackup(),
   * then passes the result here.
   */
  invoices: MajikInvoice[];
  onSuccess: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const ImportInvoiceBackupModal: React.FC<ImportInvoiceBackupModalProps> =
  memo(({ open, onOpenChange, majik, invoices, onSuccess }) => {
    const [isImporting, setIsImporting] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // ── Partition unique / duplicate ───────────────────────────────────────
    const { uniqueInvoices, duplicateInvoices } = useMemo(() => {
      const unique: MajikInvoice[] = [];
      const duplicates: MajikInvoice[] = [];
      for (const inv of invoices) {
        if (majik.hasInvoice(inv.id)) duplicates.push(inv);
        else unique.push(inv);
      }
      return { uniqueInvoices: unique, duplicateInvoices: duplicates };
    }, [invoices, majik]);

    // ── Default: all unique checked, duplicates unchecked ─────────────────
    useEffect(() => {
      if (open) {
        setSelectedIds(new Set(uniqueInvoices.map((inv) => inv.id)));
      }
    }, [open, uniqueInvoices]);

    // ── Row toggle ─────────────────────────────────────────────────────────
    const handleToggle = useCallback((id: string) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.has(id) ? next.delete(id) : next.add(id);
        return next;
      });
    }, []);

    // ── Group helpers ──────────────────────────────────────────────────────
    const handleSelectGroup = useCallback((group: MajikInvoice[]) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        group.forEach((inv) => next.add(inv.id));
        return next;
      });
    }, []);

    const handleDeselectGroup = useCallback((group: MajikInvoice[]) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        group.forEach((inv) => next.delete(inv.id));
        return next;
      });
    }, []);

    // ── Global quick actions ───────────────────────────────────────────────
    const handleSelectAll = useCallback(() => {
      setSelectedIds(new Set(invoices.map((inv) => inv.id)));
    }, [invoices]);

    const handleSelectUniqueOnly = useCallback(() => {
      setSelectedIds(new Set(uniqueInvoices.map((inv) => inv.id)));
    }, [uniqueInvoices]);

    const handleDeselectAll = useCallback(() => {
      setSelectedIds(new Set());
    }, []);

    // ── Computed helpers ───────────────────────────────────────────────────
    const allSelected =
      invoices.length > 0 && invoices.every((inv) => selectedIds.has(inv.id));

    const uniqueOnlySelected =
      uniqueInvoices.every((inv) => selectedIds.has(inv.id)) &&
      duplicateInvoices.every((inv) => !selectedIds.has(inv.id));

    const selectedDuplicateCount = duplicateInvoices.filter((inv) =>
      selectedIds.has(inv.id),
    ).length;

    // ── Confirm ────────────────────────────────────────────────────────────
    const handleConfirm = useCallback(() => {
      const toImport = invoices.filter((inv) => selectedIds.has(inv.id));

      if (toImport.length === 0) {
        toast.error("No invoices selected", {
          description: "Check at least one invoice to restore.",
        });
        return;
      }

      const run = async (): Promise<string> => {
        setIsImporting(true);

        let imported = 0;
        let overwritten = 0;

        for (const inv of toImport) {
          const isDup = majik.hasInvoice(inv.id);
          await majik.storeInvoice(inv);
          isDup ? overwritten++ : imported++;
        }

        const parts: string[] = [];
        if (imported > 0)
          parts.push(
            `${imported} invoice${imported !== 1 ? "s" : ""} restored`,
          );
        if (overwritten > 0) parts.push(`${overwritten} overwritten`);

        return parts.join(", ") + ".";
      };

      toast.promise(run(), {
        loading: `Restoring ${toImport.length} invoice${toImport.length !== 1 ? "s" : ""}…`,
        success: (msg) => {
          onOpenChange(false);
          onSuccess();
          return msg;
        },
        error: (err) => {
          console.error(err);
          return err instanceof Error ? err.message : "Restore failed.";
        },
        finally: () => setIsImporting(false),
      });
    }, [invoices, selectedIds, majik, onOpenChange, onSuccess]);

    const handleCancel = useCallback(() => onOpenChange(false), [onOpenChange]);

    // ── Confirm button label ───────────────────────────────────────────────
    const confirmLabel = useMemo(() => {
      if (isImporting) return "Restoring…";
      const count = selectedIds.size;
      if (count === 0) return "Restore";
      const overwriteNote =
        selectedDuplicateCount > 0
          ? ` (${selectedDuplicateCount} overwrite${selectedDuplicateCount !== 1 ? "s" : ""})`
          : "";
      return `Restore ${count} Invoice${count !== 1 ? "s" : ""}${overwriteNote}`;
    }, [isImporting, selectedIds.size, selectedDuplicateCount]);

    // ── Render ─────────────────────────────────────────────────────────────
    return (
      <DynamicPopUp
        isOpen={open}
        onOpenChange={onOpenChange}
        scrollable
        modal={{
          title: "Restore Invoice Backup",
          description:
            "Review the invoices loaded from the backup file. Duplicates are shown separately and will overwrite existing records if selected.",
        }}
        buttons={{
          cancel: {
            text: "Cancel",
            onClick: handleCancel,
            isDisabled: isImporting,
          },
          confirm: {
            text: confirmLabel,
            isDisabled: selectedIds.size === 0 || isImporting,
            onClick: handleConfirm,
          },
        }}
      >
        <ModalBody>
          {invoices.length === 0 ? (
            <EmptyNotice>
              <ArchiveIcon size={38} weight="thin" />
              <EmptyText>No invoices were found in the backup file.</EmptyText>
            </EmptyNotice>
          ) : (
            <>
              <SummaryBar>
                <SummaryText>
                  <span>{invoices.length}</span> invoice
                  {invoices.length !== 1 ? "s" : ""} found in backup
                  {duplicateInvoices.length > 0 && (
                    <>
                      {" · "}
                      <span>{duplicateInvoices.length}</span> duplicate
                      {duplicateInvoices.length !== 1 ? "s" : ""} detected
                    </>
                  )}
                </SummaryText>

                <GlobalActions>
                  <GlobalActionsLabel>Select:</GlobalActionsLabel>
                  <ActionChip onClick={handleSelectAll} disabled={allSelected}>
                    All
                  </ActionChip>
                  {duplicateInvoices.length > 0 && (
                    <ActionChip
                      onClick={handleSelectUniqueOnly}
                      disabled={uniqueOnlySelected}
                    >
                      Unique Only
                    </ActionChip>
                  )}
                  <ActionChip
                    onClick={handleDeselectAll}
                    disabled={selectedIds.size === 0}
                  >
                    None
                  </ActionChip>
                </GlobalActions>
              </SummaryBar>

              {uniqueInvoices.length > 0 && (
                <ImportInvoiceTable
                  variant="unique"
                  invoices={uniqueInvoices}
                  selectedIds={selectedIds}
                  onToggle={handleToggle}
                  onSelectAll={() => handleSelectGroup(uniqueInvoices)}
                  onDeselectAll={() => handleDeselectGroup(uniqueInvoices)}
                  maxRows={6}
                />
              )}

              {uniqueInvoices.length > 0 && duplicateInvoices.length > 0 && (
                <Divider />
              )}

              {duplicateInvoices.length > 0 && (
                <ImportInvoiceTable
                  variant="duplicate"
                  invoices={duplicateInvoices}
                  selectedIds={selectedIds}
                  onToggle={handleToggle}
                  onSelectAll={() => handleSelectGroup(duplicateInvoices)}
                  onDeselectAll={() => handleDeselectGroup(duplicateInvoices)}
                  maxRows={4}
                />
              )}
            </>
          )}
        </ModalBody>
      </DynamicPopUp>
    );
  });

ImportInvoiceBackupModal.displayName = "ImportInvoiceBackupModal";
