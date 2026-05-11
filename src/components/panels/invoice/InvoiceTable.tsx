/**
 * InvoiceTable.tsx
 *
 * Changes from previous version:
 *  - onDuplicate prop added — shown only for sealed invoices; edit is hidden
 *    for sealed invoices (the action column is now state-aware)
 *  - Sealed badge bug fix: reads inv.isSealed directly (correct) but also
 *    guards fmtAmount with try/catch to prevent throws on encrypted+locked rows
 *  - Action column order: View | Edit (if !sealed) | Duplicate (if sealed) | Delete
 */

import React, { useCallback, useMemo, useRef, useState } from "react";
import styled, { css } from "styled-components";
import {
  CaretDownIcon,
  CaretLeftIcon,
  CaretRightIcon,
  CaretUpDownIcon,
  CaretUpIcon,
  CopySimpleIcon,
  DownloadSimpleIcon,
  EyeIcon,
  LockKeyIcon,
  PencilSimpleIcon,
  SealIcon,
  TrashIcon,
} from "@phosphor-icons/react";
import type { MajikInvoice } from "@majikah/majik-invoice";

// ---------------------------------------------------------------------------
// Column definition
// ---------------------------------------------------------------------------

export type SortType = "alpha" | "numeric" | "date";

export interface InvoiceColumnDef {
  key: string;
  header: string;
  render: (invoice: MajikInvoice) => React.ReactNode;
  sortValue?: (invoice: MajikInvoice) => string | number | null | undefined;
  sortable?: SortType | false;
  minWidth?: string;
  align?: "left" | "center" | "right";
}

// ---------------------------------------------------------------------------
// Internal sort state
// ---------------------------------------------------------------------------

type SortDir = "asc" | "desc";

interface SortState {
  key: string;
  dir: SortDir;
  type: SortType;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface InvoiceTableProps {
  items: MajikInvoice[];
  columns?: InvoiceColumnDef[];
  pageSize?: number;
  paginationAt?: "top" | "bottom" | "both";
  onView?: (invoice: MajikInvoice) => void;
  onEdit?: (invoice: MajikInvoice) => void;
  onDelete?: (invoice: MajikInvoice) => void;
  onBulkDelete?: (invoices: MajikInvoice[]) => void;
  /** Called when user clicks Duplicate on a sealed invoice */
  onDuplicate?: (invoice: MajikInvoice) => void;
  /** When provided, only columns whose key is in this set are rendered. */
  visibleColumnKeys?: Set<string>;
  onBulkExport?: (invoices: MajikInvoice[]) => void;
  onSelectionChange?: (invoices: MajikInvoice[]) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const statusColor = (status: string): string => {
  switch (status?.toLowerCase()) {
    case "issued":
      return "var(--inv-paid,      #2b7fd4)";

    case "draft":
      return "var(--inv-draft,     #8b8fa8)";
    case "paid":
      return "var(--inv-issued,    #3b9e6a)";
    case "overdue":
      return "var(--inv-overdue,   #c74e4e)";
    case "cancelled":
      return "var(--inv-cancelled, #c74e4e)";
    default:
      return "var(--inv-default,   #8b8fa8)";
  }
};

const modeLabel = (mode: string) =>
  mode === "encrypted-and-signed"
    ? "Encrypted"
    : mode === "signed-only"
      ? "Signed"
      : (mode ?? "—");

const fmtDate = (iso?: string | null): string => {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
};

const fmtAmount = (inv: MajikInvoice): string => {
  try {
    // Guard against encrypted+locked invoices — inv.invoice throws
    if (inv.isEncrypted && !inv.hasDecryptedCache) return "—";
    const total = inv.invoice?.totals?.grandTotal;
    if (!total) return "—";
    const major =
      typeof total.toMajor === "function" ? total.toMajor() : Number(total);
    const currency = inv.invoice?.currency || "PHP";
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
    }).format(Number(major));
  } catch {
    return "—";
  }
};

/** Safe accessor: returns null when payload is encrypted and locked */
const safeInvoice = (inv: MajikInvoice) =>
  !inv.isEncrypted || inv.hasDecryptedCache ? inv.invoice : null;

// ---------------------------------------------------------------------------
// Default column definitions
// ---------------------------------------------------------------------------

const DEFAULT_COLUMNS: InvoiceColumnDef[] = [
  {
    key: "invoiceNumber",
    header: "Invoice #",
    minWidth: "130px",
    sortable: "alpha",
    sortValue: (inv) =>
      inv.public?.invoiceNumber ?? safeInvoice(inv)?.invoiceNumber ?? inv.id,
    render: (inv) => (
      <InvoiceNumber>
        {inv.public?.invoiceNumber ??
          safeInvoice(inv)?.invoiceNumber ??
          inv.id.slice(0, 10)}
      </InvoiceNumber>
    ),
  },
  {
    key: "issuer",
    header: "Issuer",
    minWidth: "150px",
    sortable: "alpha",
    sortValue: (inv) =>
      inv.public?.issuerName ?? safeInvoice(inv)?.issuer?.legalName ?? "",
    render: (inv) => {
      const name =
        inv.public?.issuerName ?? safeInvoice(inv)?.issuer?.legalName;
      return <CellText>{name ?? <Muted>—</Muted>}</CellText>;
    },
  },
  {
    key: "recipient",
    header: "Recipient",
    minWidth: "150px",
    sortable: "alpha",
    sortValue: (inv) =>
      safeInvoice(inv)?.recipient?.legalName ?? inv.public.recipientName,
    render: (inv) => {
      const name =
        safeInvoice(inv)?.recipient?.legalName ?? inv.public.recipientName;
      return <CellText>{name ?? <Redacted>Encrypted</Redacted>}</CellText>;
    },
  },
  {
    key: "status",
    header: "Status",
    minWidth: "110px",
    align: "center",
    sortable: "alpha",
    sortValue: (inv) =>
      `${inv.displayStatus} ${inv.isLocked ? "" : `- ${inv.status}`}`,
    render: (inv) => {
      return (
        <StatusBadge $color={statusColor(inv.status)}>{inv.status}</StatusBadge>
      );
    },
  },
  {
    key: "mode",
    header: "Mode",
    minWidth: "120px",
    align: "center",
    sortable: "alpha",
    sortValue: (inv) => inv.mode ?? "",
    render: (inv) => (
      <ModeBadge $encrypted={inv.isEncrypted}>{modeLabel(inv.mode)}</ModeBadge>
    ),
  },
  {
    key: "amount",
    header: "Amount",
    minWidth: "140px",
    align: "right",
    sortable: "numeric",
    sortValue: (inv) => {
      try {
        if (inv.isEncrypted && !inv.hasDecryptedCache) return null;
        const total = inv.invoice?.totals?.grandTotal;
        if (!total) return null;
        return typeof total.toMajor === "function"
          ? Number(total.toMajor())
          : Number(total);
      } catch {
        return null;
      }
    },
    render: (inv) => <AmountCell>{fmtAmount(inv)}</AmountCell>,
  },
  {
    key: "issueDate",
    header: "Issue Date",
    minWidth: "120px",
    sortable: "date",
    sortValue: (inv) => {
      const d = safeInvoice(inv)?.issueDate;
      return d ? new Date(d).getTime() : null;
    },
    render: (inv) => (
      <DateCell>{fmtDate(safeInvoice(inv)?.issueDate)}</DateCell>
    ),
  },
  {
    key: "dueDate",
    header: "Due Date",
    minWidth: "120px",
    sortable: "date",
    sortValue: (inv) => {
      const d = safeInvoice(inv)?.dueDate;
      return d ? new Date(d).getTime() : null;
    },
    render: (inv) => <DateCell>{fmtDate(safeInvoice(inv)?.dueDate)}</DateCell>,
  },
  {
    key: "sealed",
    header: "Seal",
    minWidth: "90px",
    align: "center",
    sortable: "alpha",
    sortValue: (inv) => (inv.isSealed ? "sealed" : "unsealed"),
    render: (inv) =>
      inv.isSealed ? (
        <SealedBadge>
          <LockKeyIcon size={10} weight="fill" /> Sealed
        </SealedBadge>
      ) : (
        <UnsealedDot title="Unsealed" />
      ),
  },
];

// ---------------------------------------------------------------------------
// Sort utility
// ---------------------------------------------------------------------------

function sortItems(
  items: MajikInvoice[],
  state: SortState | null,
  columns: InvoiceColumnDef[],
): MajikInvoice[] {
  if (!state) return items;
  const col = columns.find((c) => c.key === state.key);
  if (!col?.sortValue) return items;

  return [...items].sort((a, b) => {
    const av = col.sortValue!(a);
    const bv = col.sortValue!(b);
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    const cmp =
      state.type === "numeric" || state.type === "date"
        ? (av as number) - (bv as number)
        : String(av).localeCompare(String(bv), undefined, {
            sensitivity: "base",
          });
    return state.dir === "asc" ? cmp : -cmp;
  });
}

// ---------------------------------------------------------------------------
// Pagination helpers
// ---------------------------------------------------------------------------

function buildPageNumbers(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 4) return [1, 2, 3, 4, 5, "…", total];
  if (current >= total - 3)
    return [1, "…", total - 4, total - 3, total - 2, total - 1, total];
  return [1, "…", current - 1, current, current + 1, "…", total];
}

// ---------------------------------------------------------------------------
// Styled — Shell
// ---------------------------------------------------------------------------

const Root = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
`;

const TableScroll = styled.div`
  overflow-x: auto;
  width: 100%;

  &::-webkit-scrollbar {
    height: 5px;
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

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textPrimary};
`;

const THead = styled.thead`
  background: ${({ theme }) => theme.colors.secondaryBackground};
  position: sticky;
  top: 0;
  z-index: 2;
`;

const Th = styled.th<{
  $align?: "left" | "center" | "right";
  $minWidth?: string;
  $sortable?: boolean;
}>`
  padding: 10px 14px;
  text-align: ${({ $align }) => $align ?? "left"};
  font-family: ${({ theme }) => theme.typography.fonts.semibold};
  font-size: 10px;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.primary};
  border-bottom: 1px solid ${({ theme }) => theme.colors.primary}20;
  white-space: nowrap;
  min-width: ${({ $minWidth }) => $minWidth ?? "auto"};
  user-select: none;
  cursor: ${({ $sortable }) => ($sortable ? "pointer" : "default")};

  ${({ $sortable, theme }) =>
    $sortable &&
    css`
      &:hover {
        background: ${theme.colors.primarySoft};
      }
    `}
`;

const ThInner = styled.div<{ $align?: "left" | "center" | "right" }>`
  display: inline-flex;
  align-items: center;
  gap: 5px;
  justify-content: ${({ $align }) =>
    $align === "right"
      ? "flex-end"
      : $align === "center"
        ? "center"
        : "flex-start"};
`;

const SortIconWrap = styled.span<{ $active?: boolean }>`
  display: inline-flex;
  align-items: center;
  opacity: ${({ $active }) => ($active ? 1 : 0.35)};
  flex-shrink: 0;
  transition: opacity 0.12s;
`;

const TBody = styled.tbody``;

const Tr = styled.tr<{ $selected?: boolean }>`
  transition: background 0.1s;
  border-bottom: 1px solid ${({ theme }) => theme.colors.primary}0c;
  background: ${({ $selected, theme }) =>
    $selected ? `${theme.colors.primarySoft}` : "transparent"};

  &:last-child {
    border-bottom: none;
  }
  &:hover {
    background: ${({ theme }) => theme.colors.primarySoft};
  }
`;

const Td = styled.td<{ $align?: "left" | "center" | "right" }>`
  padding: 11px 14px;
  text-align: ${({ $align }) => $align ?? "left"};
  vertical-align: middle;
`;

const CheckboxTh = styled.th`
  width: 40px;
  min-width: 40px;
  padding: 10px 8px 10px 14px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.primary}20;
  background: ${({ theme }) => theme.colors.secondaryBackground};
`;

const CheckboxTd = styled.td`
  width: 40px;
  min-width: 40px;
  padding: 11px 8px 11px 14px;
  vertical-align: middle;
`;

const Checkbox = styled.input.attrs({ type: "checkbox" })`
  width: 14px;
  height: 14px;
  cursor: pointer;
  accent-color: ${({ theme }) => theme.colors.primary};
`;

const BulkBar = styled.div<{ $visible: boolean }>`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 14px;
  background: ${({ theme }) => theme.colors.primarySoft};
  border-bottom: 1px solid ${({ theme }) => theme.colors.primary}22;
  overflow: hidden;
  max-height: ${({ $visible }) => ($visible ? "52px" : "0px")};
  padding-top: ${({ $visible }) => ($visible ? "9px" : "0px")};
  padding-bottom: ${({ $visible }) => ($visible ? "9px" : "0px")};
  opacity: ${({ $visible }) => ($visible ? 1 : 0)};
  pointer-events: ${({ $visible }) => ($visible ? "auto" : "none")};
  transition:
    max-height 0.18s ease,
    opacity 0.15s ease,
    padding 0.15s ease;
`;

const BulkCount = styled.span`
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  font-size: 12px;
  color: ${({ theme }) => theme.colors.primary};
  flex: 1;
`;

const BulkDeleteBtn = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  font-size: 11px;
  padding: 6px 12px;
  border-radius: ${({ theme }) => theme.borders.radius.medium};
  border: 1px solid ${({ theme }) => theme.colors.error}44;
  background: ${({ theme }) => theme.colors.error}12;
  color: ${({ theme }) => theme.colors.error};
  cursor: pointer;
  transition: all 0.15s;
  &:hover {
    background: ${({ theme }) => theme.colors.error}22;
  }
`;

const ClearSelBtn = styled.button`
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  font-size: 11px;
  padding: 6px 10px;
  border-radius: ${({ theme }) => theme.borders.radius.medium};
  border: 1px solid ${({ theme }) => theme.colors.primary}22;
  background: transparent;
  color: ${({ theme }) => theme.colors.textSecondary};
  cursor: pointer;
  transition: all 0.15s;
  &:hover {
    background: ${({ theme }) => theme.colors.primarySoft};
    color: ${({ theme }) => theme.colors.primary};
  }
`;

const BulkExportBtn = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  font-size: 11px;
  padding: 6px 12px;
  border-radius: ${({ theme }) => theme.borders.radius.medium};
  border: 1px solid ${({ theme }) => theme.colors.primary}44;
  background: ${({ theme }) => theme.colors.primarySoft};
  color: ${({ theme }) => theme.colors.primary};
  cursor: pointer;
  transition: all 0.15s;
  &:hover {
    background: ${({ theme }) => theme.colors.primary}22;
  }
`;

// Cell atoms

const InvoiceNumber = styled.span`
  font-family: ${({ theme }) => theme.typography.fonts.numbers};
  font-size: 12px;
  color: ${({ theme }) => theme.colors.primary};
  font-weight: 600;
  letter-spacing: 0.02em;
`;

const CellText = styled.span`
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  font-size: 13px;
`;

const Muted = styled.span`
  opacity: 0.35;
`;

const Redacted = styled.span`
  font-size: 11px;
  opacity: 0.4;
  font-style: italic;
`;

const StatusBadge = styled.span<{ $color: string }>`
  display: inline-block;
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  font-size: 10px;
  padding: 2px 9px;
  border-radius: ${({ theme }) => theme.borders.radius.rounded};
  text-transform: capitalize;
  color: ${({ $color }) => $color};
  background: ${({ $color }) => $color}18;
  border: 1px solid ${({ $color }) => $color};
`;

const ModeBadge = styled.span<{ $encrypted: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  font-size: 10px;
  padding: 2px 9px;
  border-radius: ${({ theme }) => theme.borders.radius.rounded};
  ${({ $encrypted, theme }) =>
    $encrypted
      ? css`
          color: ${theme.colors.primary};
          background: ${theme.colors.primarySoft};
          border: 1px solid ${theme.colors.primary}33;
        `
      : css`
          color: ${theme.colors.textSecondary};
          background: transparent;
          border: 1px solid ${theme.colors.primary}18;
        `}
`;

const AmountCell = styled.span`
  font-family: ${({ theme }) => theme.typography.fonts.numbers};
  font-size: 13px;
  font-weight: 500;
  letter-spacing: 0.01em;
`;

const DateCell = styled.span`
  font-family: ${({ theme }) => theme.typography.fonts.light};
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textSecondary};
`;

const SealedBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  font-size: 10px;
  padding: 2px 8px;
  border-radius: ${({ theme }) => theme.borders.radius.rounded};
  color: ${({ theme }) => theme.colors.primary};
  background: ${({ theme }) => theme.colors.primary}18;
  border: 1px solid ${({ theme }) => theme.colors.primary}33;
`;

const UnsealedDot = styled.span`
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: ${({ theme }) => theme.colors.primary}28;
`;

// Actions

const ActionsCell = styled.div`
  display: flex;
  align-items: center;
  gap: 3px;
  justify-content: flex-end;
`;

const ActionBtn = styled.button<{
  $variant?: "danger" | "muted" | "default" | "ghost";
}>`
  background: none;
  border: none;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: ${({ theme }) => theme.borders.radius.small};
  transition: all 0.12s;
  opacity: 0.5;

  ${({ $variant, theme }) => {
    switch ($variant) {
      case "danger":
        return css`
          color: ${theme.colors.error};
          &:hover:not(:disabled) {
            background: ${theme.colors.error}15;
            opacity: 1;
          }
        `;
      case "muted":
        return css`
          color: ${theme.colors.textSecondary};
          opacity: 0.2;
          cursor: not-allowed;
          pointer-events: none;
        `;
      case "ghost":
        return css`
          color: ${theme.colors.textSecondary};
          &:hover:not(:disabled) {
            background: ${theme.colors.primarySoft};
            opacity: 1;
            color: ${theme.colors.primary};
          }
        `;
      default:
        return css`
          color: ${theme.colors.primary};
          &:hover:not(:disabled) {
            background: ${theme.colors.primarySoft};
            opacity: 1;
          }
        `;
    }
  }}

  &:disabled {
    opacity: 0.18;
    cursor: not-allowed;
    pointer-events: none;
  }
`;

// Pagination

const PaginationBar = styled.div<{ $position: "top" | "bottom" }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 9px 14px;
  background: ${({ theme }) => theme.colors.secondaryBackground};
  border-top: ${({ $position }) => ($position === "bottom" ? "1px" : "0")} solid
    ${({ theme }) => theme.colors.primary}12;
  border-bottom: ${({ $position }) => ($position === "top" ? "1px" : "0")} solid
    ${({ theme }) => theme.colors.primary}12;
`;

const PageInfo = styled.span`
  font-family: ${({ theme }) => theme.typography.fonts.light};
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textSecondary};
`;

const PageControls = styled.div`
  display: flex;
  align-items: center;
  gap: 3px;
`;

const PageBtn = styled.button<{ $active?: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 28px;
  height: 28px;
  padding: 0 6px;
  border-radius: ${({ theme }) => theme.borders.radius.small};
  border: 1px solid
    ${({ $active, theme }) =>
      $active ? theme.colors.primary : theme.colors.primary + "22"};
  background: ${({ $active, theme }) =>
    $active ? theme.colors.primarySoft : "transparent"};
  color: ${({ $active, theme }) =>
    $active ? theme.colors.primary : theme.colors.textSecondary};
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  font-size: 11px;
  cursor: pointer;
  transition: all 0.12s;
  &:hover:not(:disabled) {
    background: ${({ theme }) => theme.colors.primarySoft};
    color: ${({ theme }) => theme.colors.primary};
    border-color: ${({ theme }) => theme.colors.primary};
  }
  &:disabled {
    opacity: 0.28;
    cursor: not-allowed;
  }
`;

const EmptyState = styled.div`
  padding: 4rem 2rem;
  text-align: center;
  font-family: ${({ theme }) => theme.typography.fonts.light};
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.55;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
`;

// ---------------------------------------------------------------------------
// Pagination sub-component
// ---------------------------------------------------------------------------

interface PaginationProps {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  position: "top" | "bottom";
  onPageChange: (p: number) => void;
}

const Pagination: React.FC<PaginationProps> = ({
  page,
  totalPages,
  totalItems,
  pageSize,
  position,
  onPageChange,
}) => {
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalItems);
  const pages = buildPageNumbers(page, totalPages);

  return (
    <PaginationBar $position={position}>
      <PageInfo>
        {totalItems === 0 ? "No invoices" : `${start}–${end} of ${totalItems}`}
      </PageInfo>
      <PageControls>
        <PageBtn onClick={() => onPageChange(page - 1)} disabled={page === 1}>
          <CaretLeftIcon size={12} weight="bold" />
        </PageBtn>
        {pages.map((p, i) =>
          p === "…" ? (
            <PageBtn key={`ell-${i}`} disabled>
              …
            </PageBtn>
          ) : (
            <PageBtn
              key={p}
              $active={p === page}
              onClick={() => onPageChange(p as number)}
            >
              {p}
            </PageBtn>
          ),
        )}
        <PageBtn
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages || totalPages === 0}
        >
          <CaretRightIcon size={12} weight="bold" />
        </PageBtn>
      </PageControls>
    </PaginationBar>
  );
};

// ---------------------------------------------------------------------------
// InvoiceTable
// ---------------------------------------------------------------------------

export const InvoiceTable: React.FC<InvoiceTableProps> = ({
  items,
  columns: extraColumns,
  pageSize = 50,
  paginationAt = "both",
  onView,
  onEdit,
  onDelete,
  onBulkDelete,
  onBulkExport,
  onDuplicate,
  visibleColumnKeys,
  onSelectionChange,
}) => {
  const [page, setPage] = useState(1);
  const [sortState, setSortState] = useState<SortState | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const columns = useMemo<InvoiceColumnDef[]>(
    () =>
      extraColumns ? [...DEFAULT_COLUMNS, ...extraColumns] : DEFAULT_COLUMNS,
    [extraColumns],
  );

  /** Columns filtered by visibility — falls back to all columns if no set given */
  const activeColumns = useMemo<InvoiceColumnDef[]>(
    () =>
      visibleColumnKeys && visibleColumnKeys.size > 0
        ? columns.filter((c) => visibleColumnKeys.has(c.key))
        : columns,
    [columns, visibleColumnKeys],
  );

  const sortedItems = useMemo(
    () => sortItems(items, sortState, activeColumns),
    [items, sortState, activeColumns],
  );

  const totalPages = Math.max(1, Math.ceil(sortedItems.length / pageSize));
  const safePage = Math.min(page, totalPages);

  const pageItems = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return sortedItems.slice(start, start + pageSize);
  }, [sortedItems, safePage, pageSize]);

  const handleSort = useCallback((col: InvoiceColumnDef) => {
    if (!col.sortable) return;
    setSortState((prev) => {
      if (prev?.key === col.key) {
        if (prev.dir === "asc") return { ...prev, dir: "desc" };
        return null;
      }
      return { key: col.key, dir: "asc", type: col.sortable as SortType };
    });
    setPage(1);
  }, []);

  const pageIds = useMemo(() => pageItems.map((inv) => inv.id), [pageItems]);
  const allPageSelected =
    pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));
  const somePageSelected = pageIds.some((id) => selectedIds.has(id));

  const selectAllRef = useRef<HTMLInputElement>(null);
  React.useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = somePageSelected && !allPageSelected;
    }
  }, [somePageSelected, allPageSelected]);

  const toggleAll = useCallback(() => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allPageSelected) {
        pageIds.forEach((id) => next.delete(id));
      } else {
        pageIds.forEach((id) => next.add(id));
      }
      onSelectionChange?.(items.filter((inv) => next.has(inv.id)));
      return next;
    });
  }, [allPageSelected, pageIds, items, onSelectionChange]);

  const toggleRow = useCallback(
    (id: string) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.has(id) ? next.delete(id) : next.add(id);
        onSelectionChange?.(items.filter((inv) => next.has(inv.id)));
        return next;
      });
    },
    [items, onSelectionChange],
  );

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const handleBulkDelete = useCallback(() => {
    const selected = items.filter((inv) => selectedIds.has(inv.id));
    onBulkDelete?.(selected);
    clearSelection();
    onSelectionChange?.([]); // ← selection is now empty
  }, [items, selectedIds, onBulkDelete, clearSelection, onSelectionChange]);

  const showTop = paginationAt === "top" || paginationAt === "both";
  const showBottom = paginationAt === "bottom" || paginationAt === "both";
  const selectedCount = selectedIds.size;

  const paginationProps: Omit<PaginationProps, "position"> = {
    page: safePage,
    totalPages,
    totalItems: sortedItems.length,
    pageSize,
    onPageChange: setPage,
  };

  return (
    <Root>
      {showTop && <Pagination {...paginationProps} position="top" />}

      <BulkBar $visible={selectedCount > 0}>
        <BulkCount>
          {selectedCount} invoice{selectedCount !== 1 ? "s" : ""} selected
        </BulkCount>
        <ClearSelBtn onClick={clearSelection}>Clear</ClearSelBtn>
        {onBulkExport && (
          <BulkExportBtn
            onClick={() => {
              const selected = items.filter((inv) => selectedIds.has(inv.id));
              onBulkExport(selected);
            }}
          >
            <DownloadSimpleIcon size={12} weight="bold" />
            Export selected
          </BulkExportBtn>
        )}

        {onBulkDelete && (
          <BulkDeleteBtn onClick={handleBulkDelete}>
            <TrashIcon size={12} weight="bold" />
            Delete selected
          </BulkDeleteBtn>
        )}
      </BulkBar>

      <TableScroll>
        <Table>
          <THead>
            <tr>
              <CheckboxTh>
                <Checkbox
                  ref={selectAllRef}
                  checked={allPageSelected}
                  onChange={toggleAll}
                />
              </CheckboxTh>

              {activeColumns.map((col) => (
                <Th
                  key={col.key}
                  $align={col.align}
                  $minWidth={col.minWidth}
                  $sortable={!!col.sortable}
                  onClick={() => col.sortable && handleSort(col)}
                >
                  <ThInner $align={col.align}>
                    {col.header}
                    {col.sortable && (
                      <SortIconWrap $active={sortState?.key === col.key}>
                        {sortState?.key === col.key ? (
                          sortState.dir === "asc" ? (
                            <CaretUpIcon size={11} weight="bold" />
                          ) : (
                            <CaretDownIcon size={11} weight="bold" />
                          )
                        ) : (
                          <CaretUpDownIcon size={11} />
                        )}
                      </SortIconWrap>
                    )}
                  </ThInner>
                </Th>
              ))}

              <Th $align="right" $minWidth="120px">
                Actions
              </Th>
            </tr>
          </THead>

          <TBody>
            {pageItems.length === 0 ? (
              <tr>
                <td colSpan={activeColumns.length + 2}>
                  <EmptyState>
                    <SealIcon size={32} />
                    No invoices found.
                  </EmptyState>
                </td>
              </tr>
            ) : (
              pageItems.map((inv) => (
                <Tr key={inv.id} $selected={selectedIds.has(inv.id)}>
                  <CheckboxTd>
                    <Checkbox
                      checked={selectedIds.has(inv.id)}
                      onChange={() => toggleRow(inv.id)}
                    />
                  </CheckboxTd>

                  {activeColumns.map((col) => (
                    <Td key={col.key} $align={col.align}>
                      {col.render(inv)}
                    </Td>
                  ))}

                  <Td $align="right">
                    <ActionsCell>
                      {/* View — always available */}
                      <ActionBtn
                        title="View"
                        onClick={() => onView?.(inv)}
                        disabled={!onView}
                      >
                        <EyeIcon size={14} />
                      </ActionBtn>

                      {/* Edit — only for unsealed invoices */}
                      {!inv.isSealed && (
                        <ActionBtn
                          title="Edit"
                          onClick={() => onEdit?.(inv)}
                          disabled={!onEdit}
                        >
                          <PencilSimpleIcon size={14} />
                        </ActionBtn>
                      )}

                      {/* Duplicate  */}

                      <ActionBtn
                        $variant="ghost"
                        title="Duplicate as new draft"
                        onClick={() => onDuplicate?.(inv)}
                        disabled={!onDuplicate}
                      >
                        <CopySimpleIcon size={14} />
                      </ActionBtn>

                      {/* Delete — always available */}
                      <ActionBtn
                        $variant="danger"
                        title="Delete"
                        onClick={() => onDelete?.(inv)}
                        disabled={!onDelete}
                      >
                        <TrashIcon size={14} />
                      </ActionBtn>
                    </ActionsCell>
                  </Td>
                </Tr>
              ))
            )}
          </TBody>
        </Table>
      </TableScroll>

      {showBottom && <Pagination {...paginationProps} position="bottom" />}
    </Root>
  );
};
