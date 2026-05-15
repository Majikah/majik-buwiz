import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import styled, { css } from "styled-components";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { CaretDownIcon, CaretRightIcon } from "@phosphor-icons/react";
import { toast } from "sonner";

import type { MajikInvoice as MajikInvoiceType } from "@majikah/majik-invoice";
import {
  ALL_CSV_COLUMNS,
  CSVColumn,
  CSVColumnGroup,
  DEFAULT_CSV_COLUMNS,
} from "@majikah/majik-invoice/dist/core/csv-export";

// Re-use the same styled dialog primitives the rest of the app uses
import {
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogOverlay,
  DialogTitle,
} from "@/globals/styled-dialogs";
import { MajikBuwizDatabase } from "@/components/majik-context-wrapper/majik-buwiz-database";
import { save } from "@tauri-apps/plugin-dialog";
import { downloadBlob } from "@/utils/utils";
import { writeFile } from "@tauri-apps/plugin-fs";
import { sendNotification } from "@tauri-apps/plugin-notification";
import GuideHelper from "@/components/functional/GuideHelper";

// ---------------------------------------------------------------------------
// Group metadata
// ---------------------------------------------------------------------------

const GROUP_META: Record<
  CSVColumnGroup,
  { label: string; defaultCollapsed?: boolean }
> = {
  identity: { label: "Identity" },
  parties: { label: "Parties" },
  dates: { label: "Dates" },
  totals: { label: "Totals" },
  payment: { label: "Payment" },
  line_items: { label: "Line Items", defaultCollapsed: true },
  accounting: { label: "Accounting", defaultCollapsed: true },
  meta: { label: "Meta", defaultCollapsed: true },
  tax: { label: "Tax Breakdown", defaultCollapsed: true },
};

const GROUP_ORDER: CSVColumnGroup[] = [
  "identity",
  "parties",
  "dates",
  "totals",
  "payment",
  "line_items",
  "accounting",
  "tax",
  "meta",
];

// ---------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------

const ESSENTIALS_KEYS = new Set(DEFAULT_CSV_COLUMNS.map((c) => c.key));

const ACCOUNTING_KEYS = new Set<string>([
  "id",
  "invoiceNumber",
  "type",
  "status",
  "issuerName",
  "issuerTin",
  "recipientName",
  "recipientTin",
  "issueDate",
  "dueDate",
  "currency",
  "subtotal",
  "taxTotal",
  "withholdingTotal",
  "grandTotal",
  "netPayable",
  "taxTypes",
  "costCenters",
  "accountCodes",
  "paymentStatus",
  "totalPaid",
  "amountDue",
]);

const ALL_KEYS = new Set(ALL_CSV_COLUMNS.map((c) => c.key));

type Preset = "essentials" | "full" | "accounting" | "custom";

function keysForPreset(preset: Preset): Set<string> {
  if (preset === "essentials") return new Set(ESSENTIALS_KEYS);
  if (preset === "full") return new Set(ALL_KEYS);
  if (preset === "accounting") return new Set(ACCOUNTING_KEYS);
  return new Set();
}

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface GroupState {
  open: boolean;
  checkedKeys: Set<string>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildGroupMap(columns: CSVColumn[]): Map<CSVColumnGroup, CSVColumn[]> {
  const map = new Map<CSVColumnGroup, CSVColumn[]>();
  for (const col of columns) {
    const existing = map.get(col.group) ?? [];
    existing.push(col);
    map.set(col.group, existing);
  }
  return map;
}

function initGroupStates(
  groupMap: Map<CSVColumnGroup, CSVColumn[]>,
  selectedKeys: Set<string>,
): Map<CSVColumnGroup, GroupState> {
  const states = new Map<CSVColumnGroup, GroupState>();
  for (const [group, cols] of groupMap) {
    const meta = GROUP_META[group];
    states.set(group, {
      open: !(meta?.defaultCollapsed ?? false),
      checkedKeys: new Set(
        cols.filter((c) => selectedKeys.has(c.key)).map((c) => c.key),
      ),
    });
  }
  return states;
}

function collectAllSelectedKeys(
  states: Map<CSVColumnGroup, GroupState>,
): Set<string> {
  const keys = new Set<string>();
  for (const state of states.values()) {
    for (const k of state.checkedKeys) keys.add(k);
  }
  return keys;
}

// ---------------------------------------------------------------------------
// Styled — shell
// ---------------------------------------------------------------------------

const Body = styled.div`
  display: flex;
  flex-direction: column;
`;

const ScrollRegion = styled.div`
  overflow-y: auto;
  max-height: 420px;

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

// ── Preset strip ──────────────────────────────────────────────────────────────

const PresetStrip = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  background: ${({ theme }) => theme.colors.secondaryBackground};
  border-bottom: 1px solid ${({ theme }) => theme.colors.primary}18;
  flex-wrap: wrap;
  flex-shrink: 0;
`;

const PresetLabel = styled.span`
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textSecondary};
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  flex-shrink: 0;
`;

const PresetBtn = styled.button<{ $active?: boolean }>`
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  font-size: 11px;
  padding: 4px 12px;
  border-radius: ${({ theme }) => theme.borders.radius.small};
  cursor: pointer;
  transition: all 0.13s;
  flex-shrink: 0;

  ${({ $active, theme }) =>
    $active
      ? css`
          background: ${theme.colors.primarySoft};
          border: 1px solid ${theme.colors.primary}55;
          color: ${theme.colors.primary};
        `
      : css`
          background: transparent;
          border: 1px solid ${theme.colors.primary}22;
          color: ${theme.colors.textSecondary};
          &:hover {
            background: ${theme.colors.primarySoft};
            color: ${theme.colors.primary};
            border-color: ${theme.colors.primary}44;
          }
        `}
`;

const Spacer = styled.span`
  flex: 1;
`;

const SelectAllBtn = styled.button`
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  font-size: 11px;
  padding: 4px 10px;
  border-radius: ${({ theme }) => theme.borders.radius.small};
  border: 1px solid ${({ theme }) => theme.colors.primary}22;
  background: transparent;
  color: ${({ theme }) => theme.colors.textSecondary};
  cursor: pointer;
  transition: all 0.13s;
  flex-shrink: 0;

  &:hover {
    background: ${({ theme }) => theme.colors.primarySoft};
    color: ${({ theme }) => theme.colors.primary};
    border-color: ${({ theme }) => theme.colors.primary}44;
  }
`;

// ── Group list ────────────────────────────────────────────────────────────────

const GroupList = styled.div`
  display: flex;
  flex-direction: column;
  padding: 4px 0;
`;

const GroupDivider = styled.div`
  height: 1px;
  background: ${({ theme }) => theme.colors.primary}10;
  margin: 0 16px;
`;

const GroupHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 16px;
  cursor: pointer;
  user-select: none;
  transition: background 0.12s;
  &:hover {
    background: ${({ theme }) => theme.colors.primarySoft};
  }
`;

const GroupCaret = styled.span`
  display: inline-flex;
  align-items: center;
  width: 10px;
  flex-shrink: 0;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.5;
`;

const GroupCheckboxStyled = styled.input.attrs({ type: "checkbox" })`
  width: 13px;
  height: 13px;
  margin: 0;
  cursor: pointer;
  flex-shrink: 0;
  accent-color: ${({ theme }) => theme.colors.primary};
`;

const GroupName = styled.span`
  font-family: ${({ theme }) => theme.typography.fonts.semibold};
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: ${({ theme }) => theme.colors.textSecondary};
`;

const GroupCount = styled.span`
  font-family: ${({ theme }) => theme.typography.fonts.numbers};
  font-size: 10px;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.5;
  margin-left: 2px;
`;

const GroupBody = styled.div<{ $open: boolean }>`
  display: ${({ $open }) => ($open ? "grid" : "none")};
  grid-template-columns: 1fr 1fr 1fr;
  padding: 2px 16px 10px 34px;
`;

const ColItem = styled.label`
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 4px 6px;
  cursor: pointer;
  border-radius: ${({ theme }) => theme.borders.radius.small};
  transition: background 0.1s;
  &:hover {
    background: ${({ theme }) => theme.colors.primarySoft};
  }
`;

const ColCheckbox = styled.input.attrs({ type: "checkbox" })`
  width: 13px;
  height: 13px;
  margin: 0;
  flex-shrink: 0;
  cursor: pointer;
  accent-color: ${({ theme }) => theme.colors.primary};
`;

const ColLabel = styled.span<{ $checked: boolean }>`
  font-size: 12px;
  font-family: ${({ theme }) => theme.typography.fonts.regular};
  color: ${({ $checked, theme }) =>
    $checked ? theme.colors.textPrimary : theme.colors.textSecondary};
`;

// ── Footer ────────────────────────────────────────────────────────────────────

const Footer = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 11px 20px;
  border-top: 1px solid ${({ theme }) => theme.colors.primary}12;
  background: ${({ theme }) => theme.colors.secondaryBackground};
  flex-shrink: 0;
`;

const FooterLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`;

const SelectedCount = styled.span`
  font-family: ${({ theme }) => theme.typography.fonts.numbers};
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textSecondary};
`;

const ScopeBadge = styled.span`
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  font-size: 10px;
  padding: 2px 8px;
  border-radius: ${({ theme }) => theme.borders.radius.rounded};
  background: ${({ theme }) => theme.colors.primarySoft};
  border: 1px solid ${({ theme }) => theme.colors.primary}33;
  color: ${({ theme }) => theme.colors.primary};
`;

const FooterActions = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

// AlertDialog.Cancel is a Radix primitive that handles ESC / outside-click
// dismissal correctly — styled to match the app's secondary button.
const CancelBtn = styled(AlertDialog.Cancel)`
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  font-size: 12px;
  padding: 7px 16px;
  border-radius: ${({ theme }) => theme.borders.radius.medium};
  border: 1px solid ${({ theme }) => theme.colors.primary}33;
  background: transparent;
  color: ${({ theme }) => theme.colors.textSecondary};
  cursor: pointer;
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

// Plain button — NOT AlertDialog.Action — so Radix does not auto-close on click.
// We close manually via onOpenChange(false) at the end of the async export.
const ExportBtn = styled.button`
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  font-size: 12px;
  padding: 7px 16px;
  border-radius: ${({ theme }) => theme.borders.radius.medium};
  background: ${({ theme }) => theme.gradients.primary};
  border: 1px solid transparent;
  color: ${({ theme }) => theme.colors.static.white};
  cursor: pointer;
  transition:
    filter 0.15s,
    opacity 0.15s;

  &:hover:not(:disabled) {
    filter: brightness(1.08);
  }
  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
`;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface CSVExportDialogProps {
  majik: MajikBuwizDatabase;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  invoices: MajikInvoiceType[];
  scope?: "all" | "selected";
  extraColumns?: CSVColumn[];
}

// ---------------------------------------------------------------------------
// GroupCheckboxWithIndeterminate
// ---------------------------------------------------------------------------

interface GroupCheckboxProps {
  checked: boolean;
  indeterminate: boolean;
  onChange: (checked: boolean) => void;
  onClick: (e: React.MouseEvent<HTMLInputElement>) => void;
}

const GroupCheckboxWithIndeterminate: React.FC<GroupCheckboxProps> = ({
  checked,
  indeterminate,
  onChange,
  onClick,
}) => {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);

  return (
    <GroupCheckboxStyled
      ref={ref}
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      onClick={onClick}
    />
  );
};

// ---------------------------------------------------------------------------
// CSVExportDialog
// ---------------------------------------------------------------------------

export const CSVExportDialog: React.FC<CSVExportDialogProps> = ({
  majik,
  isOpen,
  onOpenChange,
  invoices,
  scope = "all",
  extraColumns = [],
}) => {
  const allColumns = useMemo(
    () => [...ALL_CSV_COLUMNS, ...extraColumns],
    [extraColumns],
  );

  const groupMap = useMemo(() => buildGroupMap(allColumns), [allColumns]);

  const [preset, setPreset] = useState<Preset>("essentials");
  const [groupStates, setGroupStates] = useState<
    Map<CSVColumnGroup, GroupState>
  >(() => initGroupStates(groupMap, ESSENTIALS_KEYS));
  const [isExporting, setIsExporting] = useState(false);

  // Reset on open — use a prev ref so we only fire on the false→true edge,
  // not on every render while already open.
  const prevIsOpen = useRef(false);
  useEffect(() => {
    if (isOpen && !prevIsOpen.current) {
      setPreset("essentials");
      setGroupStates(initGroupStates(groupMap, ESSENTIALS_KEYS));
      setIsExporting(false);
    }
    prevIsOpen.current = isOpen;
  }, [isOpen, groupMap]);

  // ── Derived ──────────────────────────────────────────────────────────────

  const totalSelected = useMemo(() => {
    let n = 0;
    for (const s of groupStates.values()) n += s.checkedKeys.size;
    return n;
  }, [groupStates]);

  const allChecked = totalSelected === allColumns.length;

  // ── Handlers ─────────────────────────────────────────────────────────────

  const applyPreset = useCallback(
    (p: Preset) => {
      setPreset(p);
      setGroupStates(initGroupStates(groupMap, keysForPreset(p)));
    },
    [groupMap],
  );

  const handleSelectAll = useCallback(() => {
    const target = allChecked
      ? new Set<string>()
      : new Set(allColumns.map((c) => c.key));
    setPreset(allChecked ? "custom" : "full");
    setGroupStates(initGroupStates(groupMap, target));
  }, [allChecked, allColumns, groupMap]);

  const toggleGroupOpen = useCallback((group: CSVColumnGroup) => {
    setGroupStates((prev) => {
      const next = new Map(prev);
      const s = next.get(group)!;
      next.set(group, { ...s, open: !s.open });
      return next;
    });
  }, []);

  const handleGroupCheck = useCallback(
    (group: CSVColumnGroup, checked: boolean, e: React.MouseEvent) => {
      e.stopPropagation();
      const cols = groupMap.get(group) ?? [];
      setGroupStates((prev) => {
        const next = new Map(prev);
        const s = next.get(group)!;
        next.set(group, {
          ...s,
          checkedKeys: checked ? new Set(cols.map((c) => c.key)) : new Set(),
        });
        return next;
      });
      setPreset("custom");
    },
    [groupMap],
  );

  const handleColCheck = useCallback(
    (group: CSVColumnGroup, key: string, checked: boolean) => {
      setGroupStates((prev) => {
        const next = new Map(prev);
        const s = next.get(group)!;
        const newKeys = new Set(s.checkedKeys);
        checked ? newKeys.add(key) : newKeys.delete(key);
        next.set(group, { ...s, checkedKeys: newKeys });
        return next;
      });
      setPreset("custom");
    },
    [],
  );

  // Export — we own the close entirely. ExportBtn is a plain <button>, not
  // AlertDialog.Action, so Radix never auto-closes on click.
  const handleExport = useCallback(async () => {
    const selectedKeys = collectAllSelectedKeys(groupStates);
    if (selectedKeys.size === 0) {
      toast.error("Select at least one column to export.");
      return;
    }

    const columns = allColumns.filter((c) => selectedKeys.has(c.key));
    setIsExporting(true);

    try {
      // const result = await MajikInvoice.batchExportToCSV(invoices, { columns });

      const result = await majik.batchExportInvoicesToCSV(invoices, {
        columns,
      });

      const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8;" });

      const defaultFileName = `invoices-${scope === "selected" ? "selected" : "all"}-${new Date().toISOString().slice(0, 10)}.csv`;

      const filePath = await save({
        defaultPath: defaultFileName,
        filters: [{ name: "Invoices CSV", extensions: ["csv"] }],
      });

      if (!filePath) {
        downloadBlob(blob, "csv", defaultFileName);
      } else {
        const ab = await blob.arrayBuffer();
        await writeFile(filePath, new Uint8Array(ab));
      }

      if (result.errors.length > 0) {
        const errorMessage = `${result.errors.length} invoice${result.errors.length !== 1 ? "s" : ""} could not be exported.`;
        toast.error(errorMessage);
        sendNotification({
          title: "Some invoices failed to export",
          body: errorMessage,
        });
      }
      if (result.partialExports.length > 0) {
        toast.warning(
          `${result.partialExports.length} encrypted invoice${result.partialExports.length !== 1 ? "s" : ""} exported with public fields only.`,
        );
      }
      if (result.success) {
        const successMessage = `Exported ${result.count} invoice${result.count !== 1 ? "s" : ""} to CSV.`;
        toast.success(successMessage);
        sendNotification({
          title: "CSV Export Successful",
          body: successMessage,
        });
      }

      onOpenChange(false); // safe — we're the only one calling this
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "CSV export failed.");
    } finally {
      setIsExporting(false);
    }
  }, [groupStates, allColumns, invoices, scope, onOpenChange]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <AlertDialog.Root open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <DialogOverlay />
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Export to CSV</DialogTitle>
            <DialogDescription>
              Select which fields to include. Encrypted locked invoices will
              export public fields only.
            </DialogDescription>
          </DialogHeader>

          <Body>
            <GuideHelper docsPath="https://majikah.solutions/products/majik-buwiz/docs/buwiz-invoices-export" />
            {/* ── Preset strip ── */}
            <PresetStrip>
              <PresetLabel>Preset:</PresetLabel>
              <PresetBtn
                $active={preset === "essentials"}
                onClick={() => applyPreset("essentials")}
              >
                Essentials
              </PresetBtn>
              <PresetBtn
                $active={preset === "full"}
                onClick={() => applyPreset("full")}
              >
                Full Export
              </PresetBtn>
              <PresetBtn
                $active={preset === "accounting"}
                onClick={() => applyPreset("accounting")}
              >
                Accounting
              </PresetBtn>
              <Spacer />
              <SelectAllBtn onClick={handleSelectAll}>
                {allChecked ? "Deselect all" : "Select all"}
              </SelectAllBtn>
            </PresetStrip>

            {/* ── Scrollable group list ── */}
            <ScrollRegion>
              <GroupList>
                {GROUP_ORDER.filter((g) => groupMap.has(g)).map(
                  (group, idx) => {
                    const cols = groupMap.get(group)!;
                    const state = groupStates.get(group);
                    if (!state) return null;

                    const checkedCount = state.checkedKeys.size;
                    const allInGroup = checkedCount === cols.length;
                    const someInGroup =
                      checkedCount > 0 && checkedCount < cols.length;

                    return (
                      <React.Fragment key={group}>
                        {idx > 0 && <GroupDivider />}
                        <div>
                          <GroupHeader onClick={() => toggleGroupOpen(group)}>
                            <GroupCaret>
                              {state.open ? (
                                <CaretDownIcon size={10} weight="bold" />
                              ) : (
                                <CaretRightIcon size={10} weight="bold" />
                              )}
                            </GroupCaret>

                            <GroupCheckboxWithIndeterminate
                              checked={allInGroup}
                              indeterminate={someInGroup}
                              onChange={(checked) =>
                                handleGroupCheck(group, checked, {
                                  stopPropagation: () => {},
                                } as React.MouseEvent)
                              }
                              onClick={(e) =>
                                handleGroupCheck(
                                  group,
                                  someInGroup || !allInGroup,
                                  e,
                                )
                              }
                            />

                            <GroupName>
                              {GROUP_META[group]?.label ?? group}
                            </GroupName>
                            <GroupCount>
                              {checkedCount} / {cols.length}
                            </GroupCount>
                          </GroupHeader>

                          <GroupBody $open={state.open}>
                            {cols.map((col) => {
                              const checked = state.checkedKeys.has(col.key);
                              return (
                                <ColItem key={col.key}>
                                  <ColCheckbox
                                    checked={checked}
                                    onChange={(e) =>
                                      handleColCheck(
                                        group,
                                        col.key,
                                        e.target.checked,
                                      )
                                    }
                                  />
                                  <ColLabel $checked={checked}>
                                    {col.label}
                                  </ColLabel>
                                </ColItem>
                              );
                            })}
                          </GroupBody>
                        </div>
                      </React.Fragment>
                    );
                  },
                )}
              </GroupList>
            </ScrollRegion>

            {/* ── Footer ── */}
            <Footer>
              <FooterLeft>
                <SelectedCount>
                  {totalSelected} column{totalSelected !== 1 ? "s" : ""}{" "}
                  selected
                </SelectedCount>
                <ScopeBadge>
                  {scope === "selected"
                    ? `${invoices.length} selected invoice${invoices.length !== 1 ? "s" : ""}`
                    : `${invoices.length} invoice${invoices.length !== 1 ? "s" : ""}`}
                </ScopeBadge>
              </FooterLeft>
              <FooterActions>
                <CancelBtn disabled={isExporting}>Cancel</CancelBtn>
                <ExportBtn
                  onClick={handleExport}
                  disabled={isExporting || totalSelected === 0}
                >
                  {isExporting ? "Exporting…" : "Export CSV"}
                </ExportBtn>
              </FooterActions>
            </Footer>
          </Body>
        </DialogContent>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
};

export default CSVExportDialog;
