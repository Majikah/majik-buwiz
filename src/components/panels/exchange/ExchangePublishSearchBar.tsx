/**
 * ExchangePublishSearchBar.tsx
 *
 * Fuzzy search bar for InvoiceExchangePanel. Replaces the previous stub.
 *
 * Searches across:
 *   - Invoice ID (partial)
 *   - Invoice number
 *   - Issuer legal name + trade name
 *   - Recipient legal name + trade name
 *   - Status
 *   - Amount (formatted + raw)
 *
 * Usage:
 * ```tsx
 * <ExchangePublishSearchBar
 *   invoices={rawList}
 *   tab={tab}
 *   onFilter={setFilteredList}
 *   onQueryChange={setQuery}   // optional — if parent needs the raw query string
 * />
 * ```
 *
 * Emits the full unfiltered list when query is empty (no chip selections either).
 */

import { memo, useCallback, useEffect, useMemo, useState } from "react";
import styled, { css, keyframes } from "styled-components";
import { MagnifyingGlassIcon, XIcon } from "@phosphor-icons/react";
import Fuse, { FuseOptionKey, IFuseOptions } from "fuse.js";
import type { MajikInvoice } from "@majikah/majik-invoice";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type QuickFilter =
  | "all"
  | "issued"
  | "paid"
  | "overdue"
  | "disputed"
  | "draft"
  | "void";

export interface ExchangePublishSearchBarProps {
  invoices: MajikInvoice[];
  onFilter: (filtered: MajikInvoice[]) => void;
  /** Optional — notifies parent of the raw query string */
  onQueryChange?: (query: string) => void;
  placeholder?: string;
}

// ---------------------------------------------------------------------------
// Search document builder
// ---------------------------------------------------------------------------

interface SearchDoc {
  _raw: MajikInvoice;
  id: string;
  invoiceNumber: string;
  issuerLegal: string;
  issuerTrade: string;
  recipientLegal: string;
  recipientTrade: string;
  status: string;
  amount: string;
  currency: string;
}

/**
 * Safely extracts the decrypted payload if available, else falls back to
 * the public metadata only.
 */
function buildDoc(inv: MajikInvoice): SearchDoc {
  const canRead = !inv.isEncrypted || inv.hasDecryptedCache;
  const payload = canRead ? inv.invoice : null;

  // Amount — try to resolve to a human-readable string
  const amount = (() => {
    try {
      if (!payload) return "";
      const t = payload.totals?.grandTotal ?? payload.totalAmount;
      if (!t) return "";
      const major =
        typeof (t as any).toMajor === "function"
          ? (t as any).toMajor()
          : Number(t);
      return String(major);
    } catch {
      return String(inv.public?.totalAmount ?? "");
    }
  })();

  return {
    _raw: inv,
    id: inv.id ?? "",
    invoiceNumber:
      inv.public?.invoiceNumber ?? payload?.invoiceNumber ?? inv.id ?? "",
    // Issuer
    issuerLegal:
      inv.public?.issuerName ??
      payload?.issuer?.legalName ??
      payload?.issuer?.email ??
      "",
    issuerTrade: payload?.issuer?.tradeName ?? "",
    // Recipient
    recipientLegal:
      inv.public?.recipientName ??
      payload?.recipient?.legalName ??
      payload?.recipient?.email ??
      "",
    recipientTrade: payload?.recipient?.tradeName ?? "",
    // Status
    status: inv.status ?? inv.displayStatus ?? payload?.status ?? "",
    // Financials
    amount,
    currency: inv.public?.currency ?? payload?.currency ?? "",
  };
}

// ---------------------------------------------------------------------------
// Fuse config
// ---------------------------------------------------------------------------

const FUSE_KEYS: FuseOptionKey<SearchDoc>[] = [
  { name: "invoiceNumber", weight: 0.3 },
  { name: "issuerLegal", weight: 0.18 },
  { name: "issuerTrade", weight: 0.12 },
  { name: "recipientLegal", weight: 0.18 },
  { name: "recipientTrade", weight: 0.12 },
  { name: "status", weight: 0.06 },
  { name: "amount", weight: 0.02 },
  { name: "currency", weight: 0.01 },
  { name: "id", weight: 0.01 },
];

const FUSE_OPTIONS: IFuseOptions<SearchDoc> = {
  keys: FUSE_KEYS,
  threshold: 0.36,
  ignoreLocation: true,
  includeScore: true,
  shouldSort: true,
  minMatchCharLength: 2,
  useExtendedSearch: false,
  ignoreFieldNorm: true,
};

// ---------------------------------------------------------------------------
// Quick-filter config
// ---------------------------------------------------------------------------

const QUICK_FILTERS: { key: QuickFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "issued", label: "Issued" },
  { key: "paid", label: "Paid" },
  { key: "overdue", label: "Overdue" },
  { key: "disputed", label: "Disputed" },
  { key: "draft", label: "Draft" },
  { key: "void", label: "Void" },
];

// ---------------------------------------------------------------------------
// Animations
// ---------------------------------------------------------------------------

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(-3px); }
  to   { opacity: 1; transform: translateY(0); }
`;

// ---------------------------------------------------------------------------
// Styled components
// ---------------------------------------------------------------------------

const Bar = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0;
  flex-shrink: 0;
  background: ${({ theme }) => theme.colors.primaryBackground};
  border-bottom: 1px solid ${({ theme }) => theme.colors.primary}0d;
`;

const SearchRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 18px 0px;
`;

const SearchWrap = styled.div`
  position: relative;
  flex: 1;
`;

const SearchIcon = styled.span`
  position: absolute;
  left: 10px;
  top: 50%;
  transform: translateY(-50%);
  display: inline-flex;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.4;
  pointer-events: none;
`;

const Input = styled.input`
  width: 100%;
  padding: 7px 32px 7px 32px;
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
    opacity: 0.4;
  }
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
    opacity: 0.9;
  }
`;

const ResultCount = styled.span`
  font-family: ${({ theme }) => theme.typography.fonts.numbers};
  font-size: 10px;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.45;
  white-space: nowrap;
  flex-shrink: 0;
`;

// ── Quick filter chips ────────────────────────────────────────────────────

const ChipRow = styled.div`
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 0 18px 9px;
  overflow-x: auto;
  animation: ${fadeIn} 0.14s ease;

  /* hide scrollbar but keep scroll */
  scrollbar-width: none;
  &::-webkit-scrollbar {
    display: none;
  }
`;

const Chip = styled.button<{ $active: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 2px 9px;
  border-radius: ${({ theme }) => theme.borders.radius.rounded};
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  font-size: 10px;
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
          border: 1px solid ${theme.colors.primary}18;
          opacity: 0.65;

          &:hover {
            background: ${theme.colors.primarySoft}88;
            color: ${theme.colors.primary};
            border-color: ${theme.colors.primary}30;
            opacity: 1;
          }
        `}
`;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const ExchangePublishSearchBar = memo(function ExchangePublishSearchBar({
  invoices,
  onFilter,
  onQueryChange,
  placeholder,
}: ExchangePublishSearchBarProps) {
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<QuickFilter>("all");

  // Re-expose query to parent when it changes
  useEffect(() => {
    onQueryChange?.(query);
  }, [query, onQueryChange]);

  // Build search documents — memoised on invoices reference
  const docs = useMemo(() => invoices.map(buildDoc), [invoices]);

  // Fuse instance — rebuilds only when docs change
  const fuse = useMemo(() => new Fuse(docs, FUSE_OPTIONS), [docs]);

  // Combined filter + search → emit to parent
  useEffect(() => {
    // 1. Fuzzy search (only if query is long enough)
    let results: MajikInvoice[] =
      query.trim().length >= 2
        ? fuse.search(query).map((r) => r.item._raw)
        : invoices;

    // 2. Quick-filter chip (hard status filter on top of search)
    if (activeFilter !== "all") {
      results = results.filter((inv) => {
        const status =
          inv.status?.toLowerCase() ??
          inv.displayStatus?.toLowerCase() ??
          inv.invoice?.status?.toLowerCase() ??
          "";
        return status === activeFilter;
      });
    }

    onFilter(results);
  }, [query, activeFilter, invoices, fuse, onFilter]);

  // Reset filter when tab changes
  useEffect(() => {
    setQuery("");
    setActiveFilter("all");
  }, []);

  const handleClear = useCallback(() => {
    setQuery("");
  }, []);

  const handleChip = useCallback((key: QuickFilter) => {
    setActiveFilter((prev) => (prev === key ? "all" : key));
  }, []);

  const resolvedPlaceholder =
    placeholder ?? "Search by recipient, invoice #, amount, status…";

  return (
    <Bar>
      <SearchRow>
        <SearchWrap>
          <SearchIcon>
            <MagnifyingGlassIcon size={13} />
          </SearchIcon>
          <Input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={resolvedPlaceholder}
            autoComplete="off"
            spellCheck={false}
          />
          {query && (
            <ClearBtn onClick={handleClear} title="Clear">
              <XIcon size={10} weight="bold" />
            </ClearBtn>
          )}
        </SearchWrap>

        {query.trim().length >= 2 && (
          <ResultCount>
            {/* Parent controls actual count; this is just a hint label */}
            Searching…
          </ResultCount>
        )}
      </SearchRow>

      {/* Quick-filter chips */}
      <ChipRow>
        {QUICK_FILTERS.map(({ key, label }) => (
          <Chip
            key={key}
            $active={activeFilter === key}
            onClick={() => handleChip(key)}
          >
            {label}
            {activeFilter === key && key !== "all" && (
              <XIcon size={7} weight="bold" />
            )}
          </Chip>
        ))}
      </ChipRow>
    </Bar>
  );
});
