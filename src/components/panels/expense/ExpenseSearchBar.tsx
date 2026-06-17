/**
 * ExpenseSearchBar.tsx
 *
 * Provides:
 *  - Fuse.js fuzzy search across expense fields
 *  - Quick-filter chips: effectiveStatus, category, documentType
 *  - Date range filter (expenseDate or paidAt)
 *  - Column visibility popover
 *
 * Usage in ExpensesManager:
 * ```tsx
 * <ExpenseSearchBar
 *   expenses={expenses}
 *   visibleColumnKeys={visibleColumnKeys}
 *   allColumnKeys={ALL_EXPENSE_COLUMN_KEYS}
 *   onFilter={setFilteredExpenses}
 *   onColumnVisibilityChange={setVisibleColumnKeys}
 * />
 * ```
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
  CalendarDotsIcon,
  CheckIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  SlidersIcon,
  XIcon,
} from "@phosphor-icons/react";
import Fuse from "fuse.js";
import { ExpenseCategory, ExpenseDocumentType, ExpenseRecordEffectiveStatus } from "@/SDK/majik-buwiz-client/src/core/expenses/types";
import { ExpenseRecord } from "@/SDK/majik-buwiz-client/src/core/expenses/expense-record";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ExpenseDateRangeFilter {
  from?: string;
  to?: string;
}

export interface ExpenseActiveFilters {
  effectiveStatus: ExpenseRecordEffectiveStatus | null;
  category: ExpenseCategory | null;
  documentType: ExpenseDocumentType | null;
  dateField: "expenseDate" | "paidAt" | "createdAt";
  dateRange: ExpenseDateRangeFilter | null;
}

export interface ExpenseSearchBarProps {
  expenses: ExpenseRecord[];
  visibleColumnKeys: Set<string>;
  allColumnKeys: { key: string; label: string }[];
  onFilter: (filtered: ExpenseRecord[]) => void;
  onColumnVisibilityChange: (keys: Set<string>) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toSearchable(r: ExpenseRecord) {
  return {
    _raw: r,
    id: r.id,
    description: r.description,
    payeeName: r.payee.legalName,
    payeeTin: r.payee.tin ?? "",
    paidByName: r.paidBy.legalName,
    category: r.category,
    documentType: r.documentType,
    currency: r.currency,
    totalAmount: String(r.totalAmount),
    notes: r.notes ?? "",
    tags: (r.tags ?? []).join(" "),
    expenseDate: r.expenseDate,
    paidAt: r.paidAt ?? "",
    status: r.status,
    effectiveStatus: r.effectiveStatus,
    receiptNumber: r.bir?.receiptNumber ?? "",
    supplierTin: r.bir?.supplierTin ?? "",
  };
}

const EFFECTIVE_STATUS_OPTIONS: ExpenseRecordEffectiveStatus[] = [
  "draft",
  "approved",
  "partially-refunded",
  "refunded",
];

const CATEGORY_OPTIONS: { value: ExpenseCategory; label: string }[] = [
  { value: "cost-of-sales", label: "Cost of Sales" },
  { value: "compensation", label: "Compensation" },
  { value: "rent", label: "Rent" },
  { value: "professional-fees", label: "Prof. Fees" },
  { value: "utilities", label: "Utilities" },
  { value: "depreciation", label: "Depreciation" },
  { value: "interest", label: "Interest" },
  { value: "taxes-and-licenses", label: "Taxes & Lic." },
  { value: "representation", label: "Representation" },
  { value: "transportation", label: "Transportation" },
  { value: "communication", label: "Communication" },
  { value: "insurance", label: "Insurance" },
  { value: "supplies", label: "Supplies" },
  { value: "bad-debts", label: "Bad Debts" },
  { value: "charitable-contributions", label: "Charitable" },
  { value: "other", label: "Other" },
];

const DOC_TYPE_OPTIONS: { value: ExpenseDocumentType; label: string }[] = [
  { value: "supplier-invoice", label: "Supplier Invoice" },
  { value: "official-receipt", label: "Official Receipt" },
  { value: "billing-statement", label: "Billing Statement" },
  { value: "utility-bill", label: "Utility Bill" },
  { value: "rent-invoice", label: "Rent Invoice" },
  { value: "professional-fee-invoice", label: "Prof. Fee Invoice" },
  { value: "importation-document", label: "Importation Doc" },
  { value: "other", label: "Other" },
];

const STATUS_LABEL: Record<ExpenseRecordEffectiveStatus, string> = {
  draft: "Draft",
  approved: "Approved",
  "partially-refunded": "Partial Refund",
  refunded: "Refunded",
};

// ---------------------------------------------------------------------------
// Styled — Shell
// ---------------------------------------------------------------------------

const Bar = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 18px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.secondaryBackground};
  background: ${({ theme }) => theme.colors.primaryBackground};
  flex-wrap: wrap;
  flex-shrink: 0;
`;

// ---------------------------------------------------------------------------
// Styled — Search input
// ---------------------------------------------------------------------------

const SearchWrap = styled.div`
  position: relative;
  flex: 1;
  min-width: 180px;
  max-width: 360px;
`;

const SearchIconWrap = styled.span`
  position: absolute;
  left: 10px;
  top: 50%;
  transform: translateY(-50%);
  display: inline-flex;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.5;
  pointer-events: none;
`;

const ClearBtn = styled.button`
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border: none;
  background: none;
  cursor: pointer;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.45;
  padding: 0;
  border-radius: 50%;
  transition: opacity 0.12s;

  &:hover {
    opacity: 1;
  }
`;

const SearchInput = styled.input`
  width: 100%;
  padding: 7px 30px 7px 32px;
  border-radius: ${({ theme }) => theme.borders.radius.medium};
  border: 1px solid ${({ theme }) => theme.colors.primary}22;
  background: ${({ theme }) => theme.colors.secondaryBackground};
  color: ${({ theme }) => theme.colors.textPrimary};
  font-family: ${({ theme }) => theme.typography.fonts.light};
  font-size: 12px;
  transition:
    border-color 0.15s,
    background 0.15s;
  outline: none;

  &:focus {
    border-color: ${({ theme }) => theme.colors.primary}66;
    background: ${({ theme }) => theme.colors.primarySoft};
  }

  &::placeholder {
    color: ${({ theme }) => theme.colors.textSecondary};
    opacity: 0.45;
  }
`;

// ---------------------------------------------------------------------------
// Styled — Filter chips
// ---------------------------------------------------------------------------

const FilterGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 5px;
  flex-wrap: wrap;
`;

const FilterLabel = styled.span`
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  font-size: 10px;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.5;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 4px;
`;

const FilterChip = styled.button<{ $active: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  border-radius: ${({ theme }) => theme.borders.radius.rounded};
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  font-size: 10px;
  cursor: pointer;
  transition: all 0.12s;
  text-transform: capitalize;
  flex-shrink: 0;

  ${({ $active, theme }) =>
    $active
      ? css`
          background: ${theme.colors.primarySoft};
          color: ${theme.colors.primary};
          border: 1px solid ${theme.colors.primary}44;
        `
      : css`
          background: transparent;
          color: ${theme.colors.textSecondary};
          border: 1px solid ${theme.colors.primary}18;
          opacity: 0.65;

          &:hover {
            background: ${theme.colors.primarySoft};
            color: ${theme.colors.primary};
            border-color: ${theme.colors.primary}33;
            opacity: 1;
          }
        `}
`;

const ChipX = styled.span`
  display: inline-flex;
  align-items: center;
  margin-left: 1px;
  opacity: 0.6;
`;

const Divider = styled.div`
  width: 1px;
  height: 20px;
  background: ${({ theme }) => theme.colors.primary}15;
  flex-shrink: 0;
  align-self: center;
`;

// ---------------------------------------------------------------------------
// Styled — Category / doc type select dropdowns
// ---------------------------------------------------------------------------

const NativeSelect = styled.select`
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  font-size: 10px;
  padding: 3px 22px 3px 8px;
  border-radius: ${({ theme }) => theme.borders.radius.rounded};
  border: 1px solid ${({ theme }) => theme.colors.primary}22;
  background: ${({ theme }) => theme.colors.secondaryBackground};
  color: ${({ theme }) => theme.colors.textSecondary};
  cursor: pointer;
  outline: none;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 10 10'%3E%3Cpath d='M2 3l3 4 3-4' stroke='%238b8fa8' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 6px center;
  transition: all 0.12s;

  &:focus,
  &:hover {
    border-color: ${({ theme }) => theme.colors.primary}44;
    color: ${({ theme }) => theme.colors.primary};
  }
`;

// ---------------------------------------------------------------------------
// Styled — Date range
// ---------------------------------------------------------------------------

const DateRangeWrap = styled.div`
  display: flex;
  align-items: center;
  gap: 5px;
  flex-wrap: wrap;
`;

const DateFieldToggle = styled.div`
  display: inline-flex;
  background: ${({ theme }) => theme.colors.secondaryBackground};
  border: 1px solid ${({ theme }) => theme.colors.primary}18;
  border-radius: ${({ theme }) => theme.borders.radius.medium};
  padding: 2px;
`;

const DateFieldBtn = styled.button<{ $active: boolean }>`
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  font-size: 10px;
  padding: 3px 8px;
  border-radius: calc(${({ theme }) => theme.borders.radius.medium} - 2px);
  border: none;
  cursor: pointer;
  transition: all 0.13s;

  ${({ $active, theme }) =>
    $active
      ? css`
          background: ${theme.gradients.primary};
          color: ${theme.colors.static.white};
        `
      : css`
          background: transparent;
          color: ${theme.colors.textSecondary};
          &:hover {
            background: ${theme.colors.primarySoft};
            color: ${theme.colors.primary};
          }
        `}
`;

const DatePickerAnchor = styled.div`
  position: relative;
`;

const DatePickerBtn = styled.button<{ $active: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  font-size: 10px;
  padding: 4px 9px;
  border-radius: ${({ theme }) => theme.borders.radius.rounded};
  cursor: pointer;
  transition: all 0.12s;

  ${({ $active, theme }) =>
    $active
      ? css`
          background: ${theme.colors.primarySoft};
          color: ${theme.colors.primary};
          border: 1px solid ${theme.colors.primary}44;
        `
      : css`
          background: transparent;
          color: ${theme.colors.textSecondary};
          border: 1px solid ${theme.colors.primary}18;
          opacity: 0.75;

          &:hover {
            background: ${theme.colors.primarySoft};
            color: ${theme.colors.primary};
            border-color: ${theme.colors.primary}33;
            opacity: 1;
          }
        `}
`;

const DateDropdown = styled.div`
  position: absolute;
  top: calc(100% + 5px);
  left: 0;
  z-index: 60;
  min-width: 240px;
  background: ${({ theme }) => theme.colors.secondaryBackground};
  border: 1px solid ${({ theme }) => theme.colors.primary}22;
  border-radius: ${({ theme }) => theme.borders.radius.medium};
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.18);
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const DateDropLabel = styled.label`
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.6;
`;

const DateDropInput = styled.input`
  font-family: ${({ theme }) => theme.typography.fonts.numbers};
  font-size: 12px;
  padding: 6px 9px;
  border-radius: ${({ theme }) => theme.borders.radius.small};
  border: 1px solid ${({ theme }) => theme.colors.primary}28;
  background: ${({ theme }) => theme.colors.primaryBackground};
  color: ${({ theme }) => theme.colors.textPrimary};
  outline: none;
  width: 100%;
  box-sizing: border-box;

  &:focus {
    border-color: ${({ theme }) => theme.colors.primary};
  }
`;

const DateDropRow = styled.div`
  display: flex;
  flex-direction: column;
  gap: 3px;
`;

const DateDropActions = styled.div`
  display: flex;
  gap: 6px;
  padding-top: 2px;
`;

const DateApplyBtn = styled.button`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  font-size: 11px;
  padding: 6px;
  border-radius: ${({ theme }) => theme.borders.radius.small};
  background: ${({ theme }) => theme.gradients.primary};
  border: none;
  color: ${({ theme }) => theme.colors.static.white};
  cursor: pointer;

  &:hover {
    filter: brightness(1.08);
  }
`;

const DateClearBtn = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  font-size: 11px;
  padding: 6px 10px;
  border-radius: ${({ theme }) => theme.borders.radius.small};
  border: 1px solid ${({ theme }) => theme.colors.primary}22;
  background: transparent;
  color: ${({ theme }) => theme.colors.textSecondary};
  cursor: pointer;

  &:hover {
    background: ${({ theme }) => theme.colors.primarySoft};
    color: ${({ theme }) => theme.colors.primary};
  }
`;

// ---------------------------------------------------------------------------
// Styled — Column visibility popover
// ---------------------------------------------------------------------------

const PopoverAnchor = styled.div`
  position: relative;
  flex-shrink: 0;
`;

const ColumnToggleBtn = styled.button<{ $active: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 11px;
  border-radius: ${({ theme }) => theme.borders.radius.medium};
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  font-size: 11px;
  cursor: pointer;
  transition: all 0.12s;
  flex-shrink: 0;

  ${({ $active, theme }) =>
    $active
      ? css`
          background: ${theme.colors.primarySoft};
          color: ${theme.colors.primary};
          border: 1px solid ${theme.colors.primary}44;
        `
      : css`
          background: transparent;
          color: ${theme.colors.textSecondary};
          border: 1px solid ${theme.colors.primary}22;

          &:hover {
            background: ${theme.colors.primarySoft};
            color: ${theme.colors.primary};
            border-color: ${theme.colors.primary}33;
          }
        `}
`;

const Popover = styled.div<{ $open: boolean }>`
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  z-index: 50;
  min-width: 200px;
  background: ${({ theme }) => theme.colors.primaryBackground};
  border: 1px solid ${({ theme }) => theme.colors.primary}22;
  border-radius: ${({ theme }) => theme.borders.radius.medium};
  box-shadow: 0 8px 24px ${({ theme }) => theme.colors.primary}12;
  padding: 8px 0;
  display: ${({ $open }) => ($open ? "block" : "none")};
`;

const PopoverHeader = styled.div`
  padding: 4px 12px 8px;
  font-family: ${({ theme }) => theme.typography.fonts.semibold};
  font-size: 10px;
  color: ${({ theme }) => theme.colors.primary};
  letter-spacing: 0.07em;
  text-transform: uppercase;
  border-bottom: 1px solid ${({ theme }) => theme.colors.primary}12;
  margin-bottom: 4px;
`;

const ColumnRow = styled.label`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 14px;
  cursor: pointer;
  transition: background 0.1s;
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textPrimary};
  user-select: none;

  &:hover {
    background: ${({ theme }) => theme.colors.primarySoft};
  }
`;

const ColumnCheckbox = styled.input.attrs({ type: "checkbox" })`
  width: 13px;
  height: 13px;
  accent-color: ${({ theme }) => theme.colors.primary};
  cursor: pointer;
  flex-shrink: 0;
`;

const PopoverFooter = styled.div`
  padding: 8px 12px 2px;
  border-top: 1px solid ${({ theme }) => theme.colors.primary}12;
  margin-top: 4px;
  display: flex;
  justify-content: flex-end;
`;

const ResetBtn = styled.button`
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  font-size: 10px;
  padding: 4px 10px;
  border-radius: ${({ theme }) => theme.borders.radius.small};
  border: 1px solid ${({ theme }) => theme.colors.primary}22;
  background: transparent;
  color: ${({ theme }) => theme.colors.textSecondary};
  cursor: pointer;
  transition: all 0.12s;

  &:hover {
    background: ${({ theme }) => theme.colors.primarySoft};
    color: ${({ theme }) => theme.colors.primary};
  }
`;

// ---------------------------------------------------------------------------
// ExpenseSearchBar
// ---------------------------------------------------------------------------

export const ExpenseSearchBar: React.FC<ExpenseSearchBarProps> = ({
  expenses,
  visibleColumnKeys,
  allColumnKeys,
  onFilter,
  onColumnVisibilityChange,
}) => {
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<ExpenseActiveFilters>({
    effectiveStatus: null,
    category: null,
    documentType: null,
    dateField: "expenseDate",
    dateRange: null,
  });

  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [fromInput, setFromInput] = useState("");
  const [toInput, setToInput] = useState("");
  const datePickerRef = useRef<HTMLDivElement>(null);

  const [colPopoverOpen, setColPopoverOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // ── Fuse instance ─────────────────────────────────────────────────────────

  const searchableItems = useMemo(() => expenses.map(toSearchable), [expenses]);

  const fuse = useMemo(
    () =>
      new Fuse(searchableItems, {
        keys: [
          { name: "description", weight: 0.3 },
          { name: "payeeName", weight: 0.25 },
          { name: "paidByName", weight: 0.1 },
          { name: "totalAmount", weight: 0.1 },
          { name: "payeeTin", weight: 0.06 },
          { name: "tags", weight: 0.06 },
          { name: "notes", weight: 0.05 },
          { name: "receiptNumber", weight: 0.05 },
          { name: "supplierTin", weight: 0.03 },
        ],
        threshold: 0.38,
        ignoreLocation: true,
        includeScore: true,
        shouldSort: true,
        minMatchCharLength: 2,
        ignoreFieldNorm: true,
      }),
    [searchableItems],
  );

  // ── Combined filter + search effect ──────────────────────────────────────

  useEffect(() => {
    // 1. Fuzzy search
    let result: ExpenseRecord[] =
      query.trim().length >= 2
        ? fuse.search(query).map((r) => r.item._raw)
        : expenses;

    // 2. Effective status
    if (filters.effectiveStatus) {
      const s = filters.effectiveStatus;
      result = result.filter((r) => r.effectiveStatus === s);
    }

    // 3. Category
    if (filters.category) {
      const cat = filters.category;
      result = result.filter((r) => r.category === cat);
    }

    // 4. Document type
    if (filters.documentType) {
      const dt = filters.documentType;
      result = result.filter((r) => r.documentType === dt);
    }

    // 5. Date range
    if (filters.dateRange && (filters.dateRange.from || filters.dateRange.to)) {
      const { from, to } = filters.dateRange;
      result = result.filter((r) => {
        const raw =
          filters.dateField === "expenseDate"
            ? r.expenseDate
            : filters.dateField === "paidAt"
              ? (r.paidAt ?? "")
              : r.createdAt;
        if (!raw) return false;
        if (from && raw < from) return false;
        if (to && raw > to) return false;
        return true;
      });
    }

    onFilter(result);
  }, [query, filters, expenses, fuse, onFilter]);

  // ── Date picker — close on outside click ─────────────────────────────────

  useEffect(() => {
    if (!datePickerOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        datePickerRef.current &&
        !datePickerRef.current.contains(e.target as Node)
      ) {
        setDatePickerOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [datePickerOpen]);

  // ── Column popover — close on outside click ───────────────────────────────

  useEffect(() => {
    if (!colPopoverOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node)
      ) {
        setColPopoverOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [colPopoverOpen]);

  // ── Filter handlers ───────────────────────────────────────────────────────

  const toggleStatus = useCallback((s: ExpenseRecordEffectiveStatus) => {
    setFilters((prev) => ({
      ...prev,
      effectiveStatus: prev.effectiveStatus === s ? null : s,
    }));
  }, []);

  const applyDateRange = useCallback(() => {
    if (!fromInput && !toInput) return;
    setFilters((prev) => ({
      ...prev,
      dateRange: {
        from: fromInput || undefined,
        to: toInput || undefined,
      },
    }));
    setDatePickerOpen(false);
  }, [fromInput, toInput]);

  const clearDateRange = useCallback(() => {
    setFromInput("");
    setToInput("");
    setFilters((prev) => ({ ...prev, dateRange: null }));
    setDatePickerOpen(false);
  }, []);

  // ── Column handlers ───────────────────────────────────────────────────────

  const toggleColumn = useCallback(
    (key: string) => {
      const next = new Set(visibleColumnKeys);
      if (next.has(key)) {
        if (next.size > 1) next.delete(key);
      } else {
        next.add(key);
      }
      onColumnVisibilityChange(next);
    },
    [visibleColumnKeys, onColumnVisibilityChange],
  );

  const resetColumns = useCallback(() => {
    onColumnVisibilityChange(new Set(allColumnKeys.map((c) => c.key)));
  }, [allColumnKeys, onColumnVisibilityChange]);

  const hiddenColumnCount = allColumnKeys.filter(
    (c) => !visibleColumnKeys.has(c.key),
  ).length;

  const formatDateLabel = (iso: string) =>
    new Date(iso).toLocaleDateString("en-PH", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Bar>
      {/* ── Search ── */}
      <SearchWrap>
        <SearchIconWrap>
          <MagnifyingGlassIcon size={13} />
        </SearchIconWrap>
        <SearchInput
          type="text"
          placeholder="Search by description, payee, amount, tags…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {query && (
          <ClearBtn onClick={() => setQuery("")} title="Clear search">
            <XIcon size={10} weight="bold" />
          </ClearBtn>
        )}
      </SearchWrap>

      <Divider />

      {/* ── Status chips ── */}
      <FilterGroup>
        <FilterLabel>
          <FunnelIcon size={10} weight="fill" />
          Status
        </FilterLabel>
        {EFFECTIVE_STATUS_OPTIONS.map((s) => (
          <FilterChip
            key={s}
            $active={filters.effectiveStatus === s}
            onClick={() => toggleStatus(s)}
          >
            {STATUS_LABEL[s]}
            {filters.effectiveStatus === s && (
              <ChipX>
                <XIcon size={8} weight="bold" />
              </ChipX>
            )}
          </FilterChip>
        ))}
      </FilterGroup>

      <Divider />

      {/* ── Category select ── */}
      <FilterGroup>
        <FilterLabel>Category</FilterLabel>
        <NativeSelect
          value={filters.category ?? ""}
          onChange={(e) =>
            setFilters((prev) => ({
              ...prev,
              category: (e.target.value as ExpenseCategory) || null,
            }))
          }
        >
          <option value="">All categories</option>
          {CATEGORY_OPTIONS.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </NativeSelect>
      </FilterGroup>

      <Divider />

      {/* ── Document type select ── */}
      <FilterGroup>
        <FilterLabel>Document</FilterLabel>
        <NativeSelect
          value={filters.documentType ?? ""}
          onChange={(e) =>
            setFilters((prev) => ({
              ...prev,
              documentType: (e.target.value as ExpenseDocumentType) || null,
            }))
          }
        >
          <option value="">All types</option>
          {DOC_TYPE_OPTIONS.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </NativeSelect>
      </FilterGroup>

      <Divider />

      {/* ── Date range ── */}
      <DateRangeWrap>
        <FilterLabel>
          <CalendarDotsIcon size={10} weight="fill" />
          Date
        </FilterLabel>

        <DateFieldToggle>
          <DateFieldBtn
            $active={filters.dateField === "expenseDate"}
            onClick={() =>
              setFilters((prev) => ({
                ...prev,
                dateField: "expenseDate",
                dateRange: null,
              }))
            }
          >
            Expense
          </DateFieldBtn>
          <DateFieldBtn
            $active={filters.dateField === "paidAt"}
            onClick={() =>
              setFilters((prev) => ({
                ...prev,
                dateField: "paidAt",
                dateRange: null,
              }))
            }
          >
            Paid
          </DateFieldBtn>
          <DateFieldBtn
            $active={filters.dateField === "createdAt"}
            onClick={() =>
              setFilters((prev) => ({
                ...prev,
                dateField: "createdAt",
                dateRange: null,
              }))
            }
          >
            Created
          </DateFieldBtn>
        </DateFieldToggle>

        <DatePickerAnchor ref={datePickerRef}>
          <DatePickerBtn
            $active={!!filters.dateRange || datePickerOpen}
            onClick={() => setDatePickerOpen((v) => !v)}
          >
            <CalendarDotsIcon size={11} />
            {filters.dateRange
              ? [
                  filters.dateRange.from
                    ? formatDateLabel(filters.dateRange.from)
                    : "Any",
                  "—",
                  filters.dateRange.to
                    ? formatDateLabel(filters.dateRange.to)
                    : "Any",
                ].join(" ")
              : "Any range"}
            {filters.dateRange && (
              <ChipX
                onClick={(e) => {
                  e.stopPropagation();
                  clearDateRange();
                }}
              >
                <XIcon size={8} weight="bold" />
              </ChipX>
            )}
          </DatePickerBtn>

          {datePickerOpen && (
            <DateDropdown>
              <DateDropRow>
                <DateDropLabel>From</DateDropLabel>
                <DateDropInput
                  type="date"
                  value={fromInput}
                  onChange={(e) => setFromInput(e.target.value)}
                />
              </DateDropRow>
              <DateDropRow>
                <DateDropLabel>To</DateDropLabel>
                <DateDropInput
                  type="date"
                  value={toInput}
                  onChange={(e) => setToInput(e.target.value)}
                />
              </DateDropRow>

              <DateDropRow>
                <DateDropLabel>Quick</DateDropLabel>
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                  {[
                    { label: "Today", days: 0 },
                    { label: "7d", days: 7 },
                    { label: "30d", days: 30 },
                    { label: "90d", days: 90 },
                    { label: "YTD", days: -1 },
                  ].map(({ label, days }) => (
                    <FilterChip
                      key={label}
                      $active={false}
                      onClick={() => {
                        const now = new Date();
                        const to = now.toISOString().slice(0, 10);
                        let from: string;
                        if (days === 0) {
                          from = to;
                        } else if (days === -1) {
                          from = `${now.getFullYear()}-01-01`;
                        } else {
                          const d = new Date(now);
                          d.setDate(d.getDate() - days);
                          from = d.toISOString().slice(0, 10);
                        }
                        setFromInput(from);
                        setToInput(to);
                      }}
                    >
                      {label}
                    </FilterChip>
                  ))}
                </div>
              </DateDropRow>

              <DateDropActions>
                <DateClearBtn onClick={clearDateRange}>Clear</DateClearBtn>
                <DateApplyBtn onClick={applyDateRange}>
                  <CheckIcon size={12} weight="bold" />
                  Apply
                </DateApplyBtn>
              </DateDropActions>
            </DateDropdown>
          )}
        </DatePickerAnchor>
      </DateRangeWrap>

      <Divider />

      {/* ── Column visibility ── */}
      <PopoverAnchor ref={popoverRef}>
        <ColumnToggleBtn
          $active={colPopoverOpen || hiddenColumnCount > 0}
          onClick={() => setColPopoverOpen((v) => !v)}
          title="Toggle columns"
        >
          <SlidersIcon size={12} />
          Columns
          {hiddenColumnCount > 0 && ` (${hiddenColumnCount} hidden)`}
        </ColumnToggleBtn>

        <Popover $open={colPopoverOpen}>
          <PopoverHeader>Visible Columns</PopoverHeader>
          {allColumnKeys.map((col) => (
            <ColumnRow key={col.key}>
              <ColumnCheckbox
                checked={visibleColumnKeys.has(col.key)}
                onChange={() => toggleColumn(col.key)}
              />
              {col.label}
            </ColumnRow>
          ))}
          <PopoverFooter>
            <ResetBtn onClick={resetColumns}>Reset to default</ResetBtn>
          </PopoverFooter>
        </Popover>
      </PopoverAnchor>
    </Bar>
  );
};
