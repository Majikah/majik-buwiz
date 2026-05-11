/**
 * ExchangeSearchBar.tsx
 *
 * Dedicated search + filter bar for InvoiceExchangePanel.
 * Operates on MajikahInvoiceJSON (the raw API shape) rather than MajikInvoice,
 * since exchange lists are fetched from the network.
 *
 * Features:
 *  - Fuse.js fuzzy search across invoice number, issuer, recipient, amount
 *  - Status filter chips   (sent · paid · overdue · cancelled · disputed · draft)
 *  - Mode filter chips     (Signed · Encrypted)
 *  - Sealed filter chip
 *  - Active filter count badge on the filter toggle
 *  - Clear-all button when any filter is active
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import styled, { css } from "styled-components";
import {
  FunnelIcon,
  MagnifyingGlassIcon,
  XIcon,
  CaretDownIcon,
} from "@phosphor-icons/react";
import Fuse from "fuse.js";
import { MajikInvoice } from "@majikah/majik-invoice"; // adjust path to your type

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ExchangeFilterStatus =
  | "draft"
  | "sent"
  | "paid"
  | "overdue"
  | "cancelled"
  | "disputed";

export type ExchangeFilterMode = "signed-only" | "encrypted-and-signed";
export type ExchangeFilterSealed = "sealed" | "unsealed";

export interface ExchangeActiveFilters {
  status: ExchangeFilterStatus | null;
  mode: ExchangeFilterMode | null;
  sealed: ExchangeFilterSealed | null;
}

export interface ExchangeSearchBarProps {
  /** Raw invoice list for the active tab — Fuse runs over this */
  invoices: MajikInvoice[];
  /** Which tab is active — affects placeholder text */
  tab: "inbox" | "sent";
  /** Called whenever the filtered result set changes */
  onFilter: (filtered: MajikInvoice[]) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MODE_LABEL: Record<ExchangeFilterMode, string> = {
  "signed-only": "Signed",
  "encrypted-and-signed": "Encrypted",
};

const STATUS_OPTIONS: ExchangeFilterStatus[] = [
  "sent",
  "paid",
  "overdue",
  "cancelled",
  "disputed",
  "draft",
];

// const MODE_OPTIONS: ExchangeFilterMode[] = [
//   "signed-only",
//   "encrypted-and-signed",
// ];

function toSearchable(inv: MajikInvoice) {
  return {
    _raw: inv,
    id: inv.id ?? "",
    invoiceNumber: inv.public.invoiceNumber ?? "",
    issuerName: inv.public.issuerName ?? "",
    recipientName: inv.public.recipientName ?? "",
    status: inv.public.status ?? "",
    mode: inv.mode ?? "",
    currency: inv.public.currency ?? "",
    amount:
      inv.public.totalAmount != null ? String(inv.public.totalAmount) : "",
  };
}

// ---------------------------------------------------------------------------
// Styled — Shell
// ---------------------------------------------------------------------------

const Bar = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 20px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.primary}0e;
  background: ${({ theme }) => theme.colors.primaryBackground};
  flex-wrap: wrap;
  flex-shrink: 0;
`;

// ---------------------------------------------------------------------------
// Search input
// ---------------------------------------------------------------------------

const SearchWrap = styled.div`
  position: relative;
  flex: 1;
  min-width: 200px;
  max-width: 380px;
`;

const SearchIconWrap = styled.span`
  position: absolute;
  left: 10px;
  top: 50%;
  transform: translateY(-50%);
  display: inline-flex;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.45;
  pointer-events: none;
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
  outline: none;
  transition:
    border-color 0.15s,
    background 0.15s;
  box-sizing: border-box;

  &:focus {
    border-color: ${({ theme }) => theme.colors.primary}55;
    background: ${({ theme }) => theme.colors.primarySoft};
  }

  &::placeholder {
    color: ${({ theme }) => theme.colors.textSecondary};
    opacity: 0.45;
  }
`;

const ClearQueryBtn = styled.button`
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

// ---------------------------------------------------------------------------
// Divider
// ---------------------------------------------------------------------------

const Sep = styled.div`
  width: 1px;
  height: 20px;
  background: ${({ theme }) => theme.colors.primary}12;
  flex-shrink: 0;
  align-self: center;
`;

// ---------------------------------------------------------------------------
// Filter toggle button
// ---------------------------------------------------------------------------

const FilterToggleBtn = styled.button<{ $active: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 11px;
  border-radius: ${({ theme }) => theme.borders.radius.medium};
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  font-size: 11px;
  cursor: pointer;
  transition: all 0.12s;
  white-space: nowrap;
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
          border: 1px solid ${theme.colors.primary}20;
          &:hover {
            background: ${theme.colors.primarySoft};
            color: ${theme.colors.primary};
            border-color: ${theme.colors.primary}33;
          }
        `}
`;

const FilterBadge = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 8px;
  background: ${({ theme }) => theme.colors.primary};
  color: ${({ theme }) => theme.colors.static?.white ?? "#fff"};
  font-size: 9px;
  font-family: ${({ theme }) => theme.typography.fonts.numbers};
  font-weight: 700;
  line-height: 1;
`;

// ---------------------------------------------------------------------------
// Filter chips row
// ---------------------------------------------------------------------------

const FiltersRow = styled.div<{ $visible: boolean }>`
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  width: 100%;
  overflow: hidden;
  max-height: ${({ $visible }) => ($visible ? "120px" : "0")};
  opacity: ${({ $visible }) => ($visible ? 1 : 0)};
  padding-top: ${({ $visible }) => ($visible ? "6px" : "0")};
  transition:
    max-height 0.18s ease,
    opacity 0.15s ease,
    padding 0.15s ease;
`;

const FilterGroupLabel = styled.span`
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  font-size: 9.5px;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.5;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 3px;
`;

const Chip = styled.button<{ $active: boolean; $color?: string }>`
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

  ${({ $active, $color, theme }) =>
    $active
      ? css`
          background: ${$color ? $color + "18" : theme.colors.primarySoft};
          color: ${$color ?? theme.colors.primary};
          border: 1px solid
            ${$color ? $color + "44" : theme.colors.primary + "44"};
        `
      : css`
          background: transparent;
          color: ${theme.colors.textSecondary};
          border: 1px solid ${theme.colors.primary}18;
          opacity: 0.7;
          &:hover {
            background: ${$color ? $color + "10" : theme.colors.primarySoft};
            color: ${$color ?? theme.colors.primary};
            border-color: ${$color
              ? $color + "33"
              : theme.colors.primary + "33"};
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

const ChipGroupSep = styled.div`
  width: 1px;
  height: 16px;
  background: ${({ theme }) => theme.colors.primary}14;
  flex-shrink: 0;
  align-self: center;
`;

const ClearAllBtn = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 9px;
  border-radius: ${({ theme }) => theme.borders.radius.rounded};
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  font-size: 10px;
  cursor: pointer;
  border: 1px solid ${({ theme }) => theme.colors.error}33;
  background: ${({ theme }) => theme.colors.error}0c;
  color: ${({ theme }) => theme.colors.error};
  transition: all 0.12s;
  margin-left: auto;
  flex-shrink: 0;

  &:hover {
    background: ${({ theme }) => theme.colors.error}18;
    border-color: ${({ theme }) => theme.colors.error}55;
  }
`;

// ---------------------------------------------------------------------------
// Status color map (for chip accent colors)
// ---------------------------------------------------------------------------

const STATUS_COLOR: Record<string, string> = {
  sent: "#3b9e6a",
  paid: "#2b7fd4",
  overdue: "#c74e4e",
  cancelled: "#c74e4e",
  disputed: "#d4872b",
  draft: "#8b8fa8",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const ExchangeSearchBar: React.FC<ExchangeSearchBarProps> = ({
  invoices,
  tab,
  onFilter,
}) => {
  const [query, setQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<ExchangeActiveFilters>({
    status: null,
    mode: null,
    sealed: null,
  });

  // ── Fuse instance ─────────────────────────────────────────────────────────

  const searchable = useMemo(() => invoices.map(toSearchable), [invoices]);

  const fuse = useMemo(
    () =>
      new Fuse(searchable, {
        keys: [
          { name: "invoiceNumber", weight: 0.35 },
          { name: "issuerName", weight: 0.22 },
          { name: "recipientName", weight: 0.22 },
          { name: "amount", weight: 0.1 },
          { name: "id", weight: 0.07 },
          { name: "currency", weight: 0.04 },
        ],
        threshold: 0.36,
        ignoreLocation: true,
        includeScore: true,
        shouldSort: true,
        minMatchCharLength: 2,
        ignoreFieldNorm: true,
      }),
    [searchable],
  );

  // ── Combined filter + search effect ──────────────────────────────────────

  useEffect(() => {
    let result: MajikInvoice[] =
      query.trim().length >= 2
        ? fuse.search(query).map((r) => r.item._raw)
        : invoices;

    if (filters.status) {
      const s = filters.status;
      result = result.filter((inv) => inv.public.status?.toLowerCase() === s);
    }

    if (filters.mode) {
      result = result.filter((inv) => inv.mode === filters.mode);
    }

    if (filters.sealed) {
      const want = filters.sealed === "sealed";
      result = result.filter((inv) => (inv.isSealed ?? false) === want);
    }

    onFilter(result);
  }, [query, filters, invoices, fuse, onFilter]);

  // ── Filter toggle helpers ─────────────────────────────────────────────────

  const toggleStatus = useCallback((s: ExchangeFilterStatus) => {
    setFilters((p) => ({ ...p, status: p.status === s ? null : s }));
  }, []);

  const toggleMode = useCallback((m: ExchangeFilterMode) => {
    setFilters((p) => ({ ...p, mode: p.mode === m ? null : m }));
  }, []);

  const toggleSealed = useCallback((v: ExchangeFilterSealed) => {
    setFilters((p) => ({ ...p, sealed: p.sealed === v ? null : v }));
  }, []);

  const clearAll = useCallback(() => {
    setFilters({ status: null, mode: null, sealed: null });
    setQuery("");
  }, []);

  // ── Derived ───────────────────────────────────────────────────────────────

  const activeFilterCount = [
    filters.status,
    filters.mode,
    filters.sealed,
    query.trim().length >= 2 ? "q" : null,
  ].filter(Boolean).length;

  const hasAnyFilter = activeFilterCount > 0;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Bar>
      {/* Search input */}
      <SearchWrap>
        <SearchIconWrap>
          <MagnifyingGlassIcon size={13} />
        </SearchIconWrap>
        <SearchInput
          type="text"
          placeholder={
            tab === "inbox"
              ? "Search by issuer, invoice number, amount…"
              : "Search by recipient, invoice number, amount…"
          }
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {query && (
          <ClearQueryBtn onClick={() => setQuery("")} title="Clear search">
            <XIcon size={10} weight="bold" />
          </ClearQueryBtn>
        )}
      </SearchWrap>

      <Sep />

      {/* Filter toggle */}
      <FilterToggleBtn
        $active={filtersOpen || hasAnyFilter}
        onClick={() => setFiltersOpen((v) => !v)}
      >
        <FunnelIcon
          size={12}
          weight={filtersOpen || hasAnyFilter ? "fill" : "regular"}
        />
        Filters
        {activeFilterCount > 0 && (
          <FilterBadge>{activeFilterCount}</FilterBadge>
        )}
        <CaretDownIcon
          size={10}
          style={{
            transform: filtersOpen ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.15s",
            marginLeft: 1,
          }}
        />
      </FilterToggleBtn>

      {/* Active filter pills (inline, when filters closed) */}
      {!filtersOpen && hasAnyFilter && (
        <>
          {filters.status && (
            <Chip
              $active
              $color={STATUS_COLOR[filters.status]}
              onClick={() => toggleStatus(filters.status!)}
            >
              {filters.status}
              <ChipX>
                <XIcon size={8} weight="bold" />
              </ChipX>
            </Chip>
          )}
          {filters.mode && (
            <Chip $active onClick={() => toggleMode(filters.mode!)}>
              {MODE_LABEL[filters.mode]}
              <ChipX>
                <XIcon size={8} weight="bold" />
              </ChipX>
            </Chip>
          )}
          {filters.sealed && (
            <Chip $active onClick={() => toggleSealed(filters.sealed!)}>
              {filters.sealed}
              <ChipX>
                <XIcon size={8} weight="bold" />
              </ChipX>
            </Chip>
          )}
          <ClearAllBtn onClick={clearAll}>
            <XIcon size={9} weight="bold" />
            Clear all
          </ClearAllBtn>
        </>
      )}

      {/* Expanded filters row */}
      <FiltersRow $visible={filtersOpen}>
        {/* Status */}
        <FilterGroupLabel>Status</FilterGroupLabel>
        {STATUS_OPTIONS.map((s) => (
          <Chip
            key={s}
            $active={filters.status === s}
            $color={STATUS_COLOR[s]}
            onClick={() => toggleStatus(s)}
          >
            {s}
            {filters.status === s && (
              <ChipX>
                <XIcon size={8} weight="bold" />
              </ChipX>
            )}
          </Chip>
        ))}

        {/* <ChipGroupSep /> */}

        {/* Mode */}
        {/* <FilterGroupLabel>Mode</FilterGroupLabel>
        {MODE_OPTIONS.map((m) => (
          <Chip
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
          </Chip>
        ))} */}

        <ChipGroupSep />

        {/* Sealed */}
        <FilterGroupLabel>Seal</FilterGroupLabel>
        {(["sealed", "unsealed"] as ExchangeFilterSealed[]).map((v) => (
          <Chip
            key={v}
            $active={filters.sealed === v}
            onClick={() => toggleSealed(v)}
          >
            {v}
            {filters.sealed === v && (
              <ChipX>
                <XIcon size={8} weight="bold" />
              </ChipX>
            )}
          </Chip>
        ))}

        {hasAnyFilter && (
          <ClearAllBtn onClick={clearAll} style={{ marginLeft: "auto" }}>
            <XIcon size={9} weight="bold" />
            Clear all
          </ClearAllBtn>
        )}
      </FiltersRow>
    </Bar>
  );
};
