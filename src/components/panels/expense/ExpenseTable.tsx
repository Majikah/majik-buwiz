/**
 * ExpenseTable.tsx
 *
 * Paginated, sortable, multi-selectable table for ExpenseRecord[].
 *
 * Design notes:
 *   - No crypto logic — ExpenseRecord is a pure domain object.
 *   - Default columns are tuned for expense visibility:
 *       Description | Payee | Category | Doc Type | Expense Date | Amount | Status | Actions
 *   - Column visibility is controllable via visibleColumnKeys.
 *   - Actions: View | Edit (draft only) | Duplicate | Delete
 *   - Bulk: Delete, Export CSV
 *   - effectiveStatus drives the status badge color (draft/approved/partially-refunded/refunded)
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  PencilSimpleIcon,
  ReceiptIcon,
  TrashIcon,
} from "@phosphor-icons/react";
import { ExpenseRecord } from "@/SDK/majik-buwiz-client/src/core/expenses/expense-record";
import { ExpenseCategory, ExpenseDocumentType, ExpenseRecordEffectiveStatus } from "@/SDK/majik-buwiz-client/src/core/expenses/types";

// ---------------------------------------------------------------------------
// Column definition
// ---------------------------------------------------------------------------

export type SortType = "alpha" | "numeric" | "date";

export interface ExpenseColumnDef {
  key: string;
  header: string;
  render: (record: ExpenseRecord) => React.ReactNode;
  sortValue?: (record: ExpenseRecord) => string | number | null | undefined;
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

export interface ExpenseTableProps {
  items: ExpenseRecord[];
  columns?: ExpenseColumnDef[];
  pageSize?: number;
  paginationAt?: "top" | "bottom" | "both";
  onView?: (record: ExpenseRecord) => void;
  onEdit?: (record: ExpenseRecord) => void;
  onDelete?: (record: ExpenseRecord) => void;
  onBulkDelete?: (records: ExpenseRecord[]) => void;
  onDuplicate?: (record: ExpenseRecord) => void;
  onBulkExport?: (mode: "csv", records: ExpenseRecord[]) => void;
  onSelectionChange?: (records: ExpenseRecord[]) => void;
  /** When true, edit action is suppressed regardless of status */
  isReadOnly?: boolean;
  /** Restrict which columns are rendered */
  visibleColumnKeys?: Set<string>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

const fmtCurrency = (n: number, currency = "PHP"): string => {
  try {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
    }).format(n);
  } catch {
    return `${currency} ${n.toFixed(2)}`;
  }
};

const EFFECTIVE_STATUS_COLOR = (
  status: ExpenseRecordEffectiveStatus,
): string => {
  switch (status) {
    case "approved":
      return "var(--exp-approved, #3b9e6a)";
    case "partially-refunded":
      return "var(--exp-partial,   #d4852b)";
    case "refunded":
      return "var(--exp-refunded,  #8b8fa8)";
    case "draft":
    default:
      return "var(--exp-draft,     #8b8fa8)";
  }
};

const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  "cost-of-sales": "Cost of Sales",
  compensation: "Compensation",
  rent: "Rent",
  "professional-fees": "Prof. Fees",
  utilities: "Utilities",
  depreciation: "Depreciation",
  interest: "Interest",
  "taxes-and-licenses": "Taxes & Lic.",
  representation: "Representation",
  transportation: "Transportation",
  communication: "Communication",
  insurance: "Insurance",
  supplies: "Supplies",
  "bad-debts": "Bad Debts",
  "charitable-contributions": "Charitable",
  other: "Other",
};

const DOC_TYPE_LABELS: Record<ExpenseDocumentType, string> = {
  "supplier-invoice": "Supplier Invoice",
  "official-receipt": "Official Receipt",
  "billing-statement": "Billing Statement",
  "utility-bill": "Utility Bill",
  "rent-invoice": "Rent Invoice",
  "professional-fee-invoice": "Prof. Fee Invoice",
  "importation-document": "Importation Doc",
  other: "Other",
};

// ---------------------------------------------------------------------------
// Default columns
// ---------------------------------------------------------------------------

const DEFAULT_COLUMNS: ExpenseColumnDef[] = [
  // ── Description ──────────────────────────────────────────────────────────
  {
    key: "description",
    header: "Description",
    minWidth: "200px",
    sortable: "alpha",
    sortValue: (r) => r.description,
    render: (r) => (
      <DescriptionCell>
        <DescText data-private>{r.description}</DescText>
        {r.tags && r.tags.length > 0 && (
          <TagRow>
            {r.tags.slice(0, 3).map((t) => (
              <MiniTag key={t}>{t}</MiniTag>
            ))}
            {r.tags.length > 3 && (
              <MiniTag $muted>+{r.tags.length - 3}</MiniTag>
            )}
          </TagRow>
        )}
      </DescriptionCell>
    ),
  },

  // ── Payee ─────────────────────────────────────────────────────────────────
  {
    key: "payee",
    header: "Payee",
    minWidth: "150px",
    sortable: "alpha",
    sortValue: (r) => r.payee.legalName,
    render: (r) => (
      <CellColumn>
        <CellText data-private>{r.payee.legalName}</CellText>
        {r.payee.tin && <Muted data-private>TIN {r.payee.tin}</Muted>}
      </CellColumn>
    ),
  },

  // ── Category ─────────────────────────────────────────────────────────────
  {
    key: "category",
    header: "Category",
    minWidth: "130px",
    align: "center",
    sortable: "alpha",
    sortValue: (r) => r.category,
    render: (r) => (
      <CategoryChip>{CATEGORY_LABELS[r.category] ?? r.category}</CategoryChip>
    ),
  },

  // ── Document type ─────────────────────────────────────────────────────────
  {
    key: "documentType",
    header: "Document",
    minWidth: "140px",
    align: "center",
    sortable: "alpha",
    sortValue: (r) => r.documentType,
    render: (r) => (
      <DocTypeChip>
        {DOC_TYPE_LABELS[r.documentType] ?? r.documentType}
      </DocTypeChip>
    ),
  },

  // ── Expense Date ──────────────────────────────────────────────────────────
  {
    key: "expenseDate",
    header: "Date",
    minWidth: "120px",
    sortable: "date",
    sortValue: (r) => new Date(r.expenseDate).getTime(),
    render: (r) => (
      <CellColumn>
        <DateCell data-private>{fmtDate(r.expenseDate)}</DateCell>
        {r.paidAt && (
          <Muted style={{ fontSize: "11px" }} data-private>
            Paid {fmtDate(r.paidAt)}
          </Muted>
        )}
      </CellColumn>
    ),
  },

  // ── Amount ────────────────────────────────────────────────────────────────
  {
    key: "amount",
    header: "Amount",
    minWidth: "140px",
    align: "right",
    sortable: "numeric",
    sortValue: (r) => r.totalAmount,
    render: (r) => (
      <AmountStack>
        <AmountCell data-private>
          {fmtCurrency(r.totalAmount, r.currency)}
        </AmountCell>
        {r.totalRefundedAmount > 0 && (
          <RefundedLine data-private>
            −{fmtCurrency(r.totalRefundedAmount, r.currency)} refunded
          </RefundedLine>
        )}
      </AmountStack>
    ),
  },

  // ── Effective Status ──────────────────────────────────────────────────────
  {
    key: "status",
    header: "Status",
    minWidth: "110px",
    align: "center",
    sortable: "alpha",
    sortValue: (r) => r.effectiveStatus,
    render: (r) => (
      <StatusBadge $color={EFFECTIVE_STATUS_COLOR(r.effectiveStatus)}>
        {r.effectiveStatus.replace("-", " ")}
      </StatusBadge>
    ),
  },
];

// ---------------------------------------------------------------------------
// Sort utility
// ---------------------------------------------------------------------------

function sortItems(
  items: ExpenseRecord[],
  state: SortState | null,
  columns: ExpenseColumnDef[],
): ExpenseRecord[] {
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

// ---------------------------------------------------------------------------
// Bulk bar
// ---------------------------------------------------------------------------

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

const BulkBtn = styled.button<{ $variant?: "danger" | "default" }>`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  font-size: 11px;
  padding: 6px 12px;
  border-radius: ${({ theme }) => theme.borders.radius.medium};
  cursor: pointer;
  transition: all 0.15s;

  ${({ $variant, theme }) =>
    $variant === "danger"
      ? css`
          border: 1px solid ${theme.colors.error}44;
          background: ${theme.colors.error}12;
          color: ${theme.colors.error};
          &:hover {
            background: ${theme.colors.error}22;
          }
        `
      : css`
          border: 1px solid ${theme.colors.primary}44;
          background: ${theme.colors.primarySoft};
          color: ${theme.colors.primary};
          &:hover {
            background: ${theme.colors.primary}22;
          }
        `}
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

// ---------------------------------------------------------------------------
// Cell atoms
// ---------------------------------------------------------------------------

const DescriptionCell = styled.div`
  display: flex;
  flex-direction: column;
  gap: 5px;
`;

const DescText = styled.span`
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  font-size: 13px;
  line-height: 1.35;
`;

const TagRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
`;

const MiniTag = styled.span<{ $muted?: boolean }>`
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  font-size: 10px;
  padding: 1px 6px;
  border-radius: ${({ theme }) => theme.borders.radius.rounded};
  background: ${({ theme, $muted }) =>
    $muted ? theme.colors.secondaryBackground : theme.colors.primarySoft};
  color: ${({ theme, $muted }) =>
    $muted ? theme.colors.textSecondary : theme.colors.primary};
  border: 1px solid
    ${({ theme, $muted }) =>
      $muted ? theme.colors.primary + "18" : theme.colors.primary + "22"};
  opacity: ${({ $muted }) => ($muted ? 0.6 : 1)};
`;

const CellColumn = styled.div`
  display: flex;
  flex-direction: column;
  gap: 5px;
`;

const CellText = styled.span`
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  font-size: 13px;
`;

const Muted = styled.span`
  font-family: ${({ theme }) => theme.typography.fonts.light};
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.55;
`;

const CategoryChip = styled.span`
  display: inline-block;
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  font-size: 10px;
  padding: 2px 9px;
  border-radius: ${({ theme }) => theme.borders.radius.rounded};
  color: ${({ theme }) => theme.colors.primary};
  background: ${({ theme }) => theme.colors.primarySoft};
  border: 1px solid ${({ theme }) => theme.colors.primary}22;
  white-space: nowrap;
`;

const DocTypeChip = styled.span`
  display: inline-block;
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  font-size: 10px;
  padding: 2px 9px;
  border-radius: ${({ theme }) => theme.borders.radius.rounded};
  color: ${({ theme }) => theme.colors.textSecondary};
  background: ${({ theme }) => theme.colors.secondaryBackground};
  border: 1px solid ${({ theme }) => theme.colors.primary}15;
  white-space: nowrap;
`;

const DateCell = styled.span`
  font-family: ${({ theme }) => theme.typography.fonts.light};
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textSecondary};
`;

const AmountStack = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 3px;
`;

const AmountCell = styled.span`
  font-family: ${({ theme }) => theme.typography.fonts.numbers};
  font-size: 13px;
  font-weight: 500;
  letter-spacing: 0.01em;
`;

const RefundedLine = styled.span`
  font-family: ${({ theme }) => theme.typography.fonts.numbers};
  font-size: 10px;
  color: ${({ theme }) => theme.colors.brand.green};
  opacity: 0.8;
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
  border: 1px solid ${({ $color }) => $color}44;
`;

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

const ActionsCell = styled.div`
  display: flex;
  align-items: center;
  gap: 3px;
  justify-content: flex-end;
`;

const ActionBtn = styled.button<{
  $variant?: "danger" | "ghost" | "default";
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

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

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
        {totalItems === 0
          ? "No expenses"
          : `${start}–${end} of ${totalItems}`}
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
// ExpenseTable
// ---------------------------------------------------------------------------

export const ExpenseTable: React.FC<ExpenseTableProps> = ({
  items,
  columns: extraColumns,
  pageSize = 50,
  paginationAt = "both",
  onView,
  onEdit,
  onDelete,
  onBulkDelete,
  onDuplicate,
  onBulkExport,
  onSelectionChange,
  isReadOnly = false,
  visibleColumnKeys,
}) => {
  const [page, setPage] = useState(1);
  const [sortState, setSortState] = useState<SortState | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const columns = useMemo<ExpenseColumnDef[]>(
    () =>
      extraColumns ? [...DEFAULT_COLUMNS, ...extraColumns] : DEFAULT_COLUMNS,
    [extraColumns],
  );

  const activeColumns = useMemo<ExpenseColumnDef[]>(
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

  const handleSort = useCallback((col: ExpenseColumnDef) => {
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

  // ── Selection ──────────────────────────────────────────────────────────────

  const pageIds = useMemo(() => pageItems.map((r) => r.id), [pageItems]);
  const allPageSelected =
    pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));
  const somePageSelected = pageIds.some((id) => selectedIds.has(id));

  const selectAllRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate =
        somePageSelected && !allPageSelected;
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
      onSelectionChange?.(items.filter((r) => next.has(r.id)));
      return next;
    });
  }, [allPageSelected, pageIds, items, onSelectionChange]);

  const toggleRow = useCallback(
    (id: string) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.has(id) ? next.delete(id) : next.add(id);
        onSelectionChange?.(items.filter((r) => next.has(r.id)));
        return next;
      });
    },
    [items, onSelectionChange],
  );

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    onSelectionChange?.([]);
  }, [onSelectionChange]);

  const handleBulkDelete = useCallback(() => {
    const selected = items.filter((r) => selectedIds.has(r.id));
    onBulkDelete?.(selected);
    clearSelection();
  }, [items, selectedIds, onBulkDelete, clearSelection]);

  const selectedCount = selectedIds.size;
  const showTop = paginationAt === "top" || paginationAt === "both";
  const showBottom = paginationAt === "bottom" || paginationAt === "both";

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

      {/* ── Bulk action bar ── */}
      <BulkBar $visible={selectedCount > 0}>
        <BulkCount>
          {selectedCount} expense{selectedCount !== 1 ? "s" : ""} selected
        </BulkCount>
        <ClearSelBtn onClick={clearSelection}>Clear</ClearSelBtn>

        {onBulkExport && (
          <BulkBtn
            onClick={() => {
              const selected = items.filter((r) => selectedIds.has(r.id));
              onBulkExport("csv", selected);
            }}
          >
            <DownloadSimpleIcon size={12} weight="bold" />
            Export to CSV
          </BulkBtn>
        )}

        {onBulkDelete && (
          <BulkBtn $variant="danger" onClick={handleBulkDelete}>
            <TrashIcon size={12} weight="bold" />
            Delete selected
          </BulkBtn>
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

              <Th $align="right" $minWidth="110px">
                Actions
              </Th>
            </tr>
          </THead>

          <TBody>
            {pageItems.length === 0 ? (
              <tr>
                <td colSpan={activeColumns.length + 2}>
                  <EmptyState>
                    <ReceiptIcon size={32} />
                    No expenses found.
                  </EmptyState>
                </td>
              </tr>
            ) : (
              pageItems.map((record) => (
                <Tr key={record.id} $selected={selectedIds.has(record.id)}>
                  <CheckboxTd>
                    <Checkbox
                      checked={selectedIds.has(record.id)}
                      onChange={() => toggleRow(record.id)}
                    />
                  </CheckboxTd>

                  {activeColumns.map((col) => (
                    <Td key={col.key} $align={col.align}>
                      {col.render(record)}
                    </Td>
                  ))}

                  {/* ── Actions ── */}
                  <Td $align="right">
                    <ActionsCell>
                      {/* View — always available */}
                      <ActionBtn
                        title="View"
                        onClick={() => onView?.(record)}
                        disabled={!onView}
                      >
                        <EyeIcon size={14} />
                      </ActionBtn>

                      {/* Edit — only for draft records and when not read-only */}
                      {record.isDraft && !isReadOnly && (
                        <ActionBtn
                          title="Edit"
                          onClick={() => onEdit?.(record)}
                          disabled={!onEdit}
                        >
                          <PencilSimpleIcon size={14} />
                        </ActionBtn>
                      )}

                      {/* Duplicate — always available */}
                      <ActionBtn
                        $variant="ghost"
                        title="Duplicate as new draft"
                        onClick={() => onDuplicate?.(record)}
                        disabled={!onDuplicate}
                      >
                        <CopySimpleIcon size={14} />
                      </ActionBtn>

                      {/* Delete — always available */}
                      <ActionBtn
                        $variant="danger"
                        title="Delete"
                        onClick={() => onDelete?.(record)}
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