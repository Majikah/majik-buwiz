/**
 * InvoiceSearchBar.tsx
 *
 * Provides:
 *  - Fuse.js fuzzy search across invoice fields
 *  - Quick-filter chips: status, sealed state, mode
 *  - Column visibility popover (persisted via majik.setInvoiceTableColumns)
 *
 * Usage in InvoicesManager:
 * ```tsx
 * <InvoiceSearchBar
 *   invoices={invoices}
 *   visibleColumnKeys={visibleColumnKeys}
 *   allColumnKeys={ALL_COLUMN_KEYS}
 *   onFilter={setFilteredInvoices}
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
  FunnelIcon,
  MagnifyingGlassIcon,
  SlidersIcon,
  XIcon,
} from "@phosphor-icons/react";
import Fuse from "fuse.js";
import type { MajikInvoice } from "@majikah/majik-invoice";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type InvoiceFilterStatus =
  | "draft"
  | "issued"
  | "paid"
  | "overdue"
  | "cancelled";

export type InvoiceFilterSealed = "sealed" | "unsealed";
export type InvoiceFilterMode = "signed-only" | "encrypted-and-signed";

export interface InvoiceActiveFilters {
  status: InvoiceFilterStatus | null;
  sealed: InvoiceFilterSealed | null;
  mode: InvoiceFilterMode | null;
}

export interface InvoiceSearchBarProps {
  invoices: MajikInvoice[];
  /** Keys of columns that are currently visible */
  visibleColumnKeys: Set<string>;
  /** All available column keys (drives the column toggle list) */
  allColumnKeys: { key: string; label: string }[];
  /** Called whenever the filtered result set changes */
  onFilter: (filtered: MajikInvoice[]) => void;
  /** Called when the user toggles a column on/off */
  onColumnVisibilityChange: (keys: Set<string>) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Safe payload accessor — returns null for encrypted+locked invoices */
const safeInvoice = (inv: MajikInvoice) =>
  !inv.isEncrypted || inv.hasDecryptedCache ? inv.invoice : null;

/** Flatten an invoice into a searchable plain object */
function toSearchable(inv: MajikInvoice) {
  const payload = safeInvoice(inv);
  const total = (() => {
    try {
      if (!payload) return "";
      const t = payload.totals?.grandTotal;
      if (!t) return "";
      const major = typeof t.toMajor === "function" ? t.toMajor() : Number(t);
      return String(major);
    } catch {
      return "";
    }
  })();

  return {
    _raw: inv,
    id: inv.id,
    invoiceNumber:
      inv.public?.invoiceNumber ?? payload?.invoiceNumber ?? inv.id,
    issuerName: inv.public?.issuerName ?? payload?.issuer?.legalName ?? "",
    recipientName: payload?.recipient?.legalName ?? inv.public.recipientName,
    status: inv.status ?? "",
    displayStatus: inv.displayStatus ?? "",
    mode: inv.mode ?? "",
    amount: total,
    currency: payload?.currency ?? "",
    tags: (payload?.tags ?? []).join(" "),
    notes: payload?.notes ?? "",
    issueDate: payload?.issueDate ?? "",
    dueDate: payload?.dueDate ?? "",
  };
}

const STATUS_OPTIONS: InvoiceFilterStatus[] = [
  "draft",
  "issued",
  "paid",
  "overdue",
  "cancelled",
];

const SEALED_OPTIONS: InvoiceFilterSealed[] = ["sealed", "unsealed"];

const MODE_OPTIONS: InvoiceFilterMode[] = [
  "signed-only",
  "encrypted-and-signed",
];

const MODE_LABEL: Record<InvoiceFilterMode, string> = {
  "signed-only": "Signed",
  "encrypted-and-signed": "Encrypted",
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
// Styled — Filter group
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
// Styled — Column toggle popover
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
// InvoiceSearchBar
// ---------------------------------------------------------------------------

export const InvoiceSearchBar: React.FC<InvoiceSearchBarProps> = ({
  invoices,
  visibleColumnKeys,
  allColumnKeys,
  onFilter,
  onColumnVisibilityChange,
}) => {
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<InvoiceActiveFilters>({
    status: null,
    sealed: null,
    mode: null,
  });
  const [colPopoverOpen, setColPopoverOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // ── Fuse instance ─────────────────────────────────────────────────────────

  const searchableItems = useMemo(() => invoices.map(toSearchable), [invoices]);

  const fuse = useMemo(
    () =>
      new Fuse(searchableItems, {
        keys: [
          { name: "invoiceNumber", weight: 0.35 },
          { name: "issuerName", weight: 0.2 },
          { name: "recipientName", weight: 0.18 },
          { name: "amount", weight: 0.1 },
          { name: "id", weight: 0.07 },
          { name: "currency", weight: 0.03 },
          { name: "tags", weight: 0.04 },
          { name: "notes", weight: 0.03 },
        ],
        threshold: 0.38,
        ignoreLocation: true,
        includeScore: true,
        shouldSort: true,
        minMatchCharLength: 2,
        useExtendedSearch: false,
        ignoreFieldNorm: true,
      }),
    [searchableItems],
  );

  // ── Combined filter + search ──────────────────────────────────────────────

  useEffect(() => {
    // 1. Fuzzy search
    let result: MajikInvoice[] =
      query.trim().length >= 2
        ? fuse.search(query).map((r) => r.item._raw)
        : invoices;

    // 2. Hard filters
    if (filters.status) {
      const s = filters.status;
      result = result.filter((inv) => {
        const payload = safeInvoice(inv);
        return (
          inv.status?.toLowerCase() === s ||
          payload?.status?.toLowerCase() === s
        );
      });
    }

    if (filters.sealed) {
      const isSealed = filters.sealed === "sealed";
      result = result.filter((inv) => inv.isSealed === isSealed);
    }

    if (filters.mode) {
      const m = filters.mode;
      result = result.filter((inv) => inv.mode === m);
    }

    onFilter(result);
  }, [query, filters, invoices, fuse, onFilter]);

  // ── Filter chip toggles ───────────────────────────────────────────────────

  const toggleStatus = useCallback((s: InvoiceFilterStatus) => {
    setFilters((prev) => ({
      ...prev,
      status: prev.status === s ? null : s,
    }));
  }, []);

  const toggleSealed = useCallback((s: InvoiceFilterSealed) => {
    setFilters((prev) => ({
      ...prev,
      sealed: prev.sealed === s ? null : s,
    }));
  }, []);

  const toggleMode = useCallback((m: InvoiceFilterMode) => {
    setFilters((prev) => ({
      ...prev,
      mode: prev.mode === m ? null : m,
    }));
  }, []);

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

  // ── Column toggle ─────────────────────────────────────────────────────────

  const toggleColumn = useCallback(
    (key: string) => {
      const next = new Set(visibleColumnKeys);
      if (next.has(key)) {
        // Always keep at least one column visible
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

  // ── Derived ───────────────────────────────────────────────────────────────

  const hiddenColumnCount = allColumnKeys.filter(
    (c) => !visibleColumnKeys.has(c.key),
  ).length;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Bar>
      {/* ── Search input ── */}
      <SearchWrap>
        <SearchIconWrap>
          <MagnifyingGlassIcon size={13} />
        </SearchIconWrap>
        <SearchInput
          type="text"
          placeholder="Search by number, issuer, recipient, amount…"
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

      {/* ── Status filters ── */}
      <FilterGroup>
        <FilterLabel>
          <FunnelIcon size={10} weight="fill" />
          Status
        </FilterLabel>
        {STATUS_OPTIONS.map((s) => (
          <FilterChip
            key={s}
            $active={filters.status === s}
            onClick={() => toggleStatus(s)}
          >
            {s}
            {filters.status === s && (
              <ChipX>
                <XIcon size={8} weight="bold" />
              </ChipX>
            )}
          </FilterChip>
        ))}
      </FilterGroup>

      <Divider />

      {/* ── Sealed filters ── */}
      <FilterGroup>
        {SEALED_OPTIONS.map((s) => (
          <FilterChip
            key={s}
            $active={filters.sealed === s}
            onClick={() => toggleSealed(s)}
          >
            {s}
            {filters.sealed === s && (
              <ChipX>
                <XIcon size={8} weight="bold" />
              </ChipX>
            )}
          </FilterChip>
        ))}
      </FilterGroup>

      <Divider />

      {/* ── Mode filters ── */}
      <FilterGroup>
        {MODE_OPTIONS.map((m) => (
          <FilterChip
            key={m}
            $active={filters.mode === m}
            onClick={() => toggleMode(m)}
          >
            {MODE_LABEL[m]}
            {filters.mode === m && (
              <ChipX>
                <XIcon size={8} weight="bold" />
              </ChipX>
            )}
          </FilterChip>
        ))}
      </FilterGroup>

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
