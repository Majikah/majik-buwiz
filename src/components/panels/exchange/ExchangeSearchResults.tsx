/**
 * ExchangeSearchResults.tsx
 *
 * Standalone results list for InvoiceExchangePanel.
 *
 * Behaviour:
 *   - When `results` prop is provided AND `hasQuery` is true  → renders the results array
 *   - When `hasQuery` is false (empty search)                 → renders the most recent
 *     `defaultCount` invoices from `allInvoices`, sorted by issue date desc
 *
 * Props:
 *   results       — output of ExchangeSearchBar (filtered/searched invoices)
 *   allInvoices   — full unfiltered list for the "recent" fallback
 *   hasQuery      — pass `query.trim().length >= 2` from the parent
 *   tab           — "inbox" | "sent" (drives party-name column label)
 *   onSelect      — called when the user clicks a row
 *   defaultCount  — how many recents to show when no search is active (default: 10)
 *   loading       — optional loading state drives skeleton/spinner
 *   selectedId    — optional; highlights the currently open invoice
 *
 * Usage:
 * ```tsx
 * <ExchangeSearchBar
 *   invoices={rawList}
 *   tab={tab}
 *   onFilter={setFilteredList}
 *   onQueryChange={setQuery}
 * />
 * <ExchangeSearchResults
 *   results={filteredList}
 *   allInvoices={rawList}
 *   hasQuery={query.trim().length >= 2}
 *   tab={tab}
 *   onSelect={openDetail}
 *   selectedId={selectedInv?.id}
 * />
 * ```
 */

import { memo, useCallback, useMemo, useState } from "react";
import styled, { css, keyframes } from "styled-components";
import {
  LockKeyIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  ArrowsDownUpIcon,
  InvoiceIcon,
} from "@phosphor-icons/react";
import type { MajikInvoice } from "@majikah/majik-invoice";

const VARIANT_CONFIG = {
  default: {
    rowHeight: "10px 20px",
    grid: "2fr 1.4fr 1fr 1.2fr 90px",
    fontSize: {
      party: "12px",
      sub: "10px",
      invoice: "11px",
      date: "10px",
      amount: "12px",
    },
    showFlags: true,
    showSubline: true,
    sectionPadding: "8px 20px 6px",
  },

  compact: {
    rowHeight: "7px 14px",
    grid: "1.8fr 1.1fr 0.8fr 1fr",
    fontSize: {
      party: "11px",
      sub: "9px",
      invoice: "10px",
      date: "9px",
      amount: "11px",
    },
    showFlags: false,
    showSubline: false,
    sectionPadding: "6px 14px 4px",
  },
} as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ExchangeSearchResultsVariant = "default" | "compact";

type ExchangeTab = "inbox" | "sent";
type SortKey = "date" | "amount" | "party" | "status";
type SortDir = "asc" | "desc";

interface SortState {
  key: SortKey;
  dir: SortDir;
}

export interface ExchangeSearchResultsProps {
  variant: ExchangeSearchResultsVariant;
  /** Output from ExchangeSearchBar — filtered/searched invoices */
  results: MajikInvoice[];
  /** Full unfiltered list — used for the "recent" fallback when no query */
  allInvoices: MajikInvoice[];
  /** True when the search bar has an active query (>= 2 chars) or chip filter */
  hasQuery: boolean;
  tab: ExchangeTab;
  onSelect: (inv: MajikInvoice) => void;
  /** How many recents to show when hasQuery is false (default: 10) */
  defaultCount?: number;
  loading?: boolean;
  /** Currently selected invoice id — highlights the row */
  selectedId?: string | null;

  selectionMode?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (invoice: MajikInvoice) => void;

  hiddenInvoiceIds?: Set<string>;
  disabledInvoiceIds?: Set<string>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const fmtDate = (iso?: string | null): string => {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / 86_400_000);
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7)
      return d.toLocaleDateString(undefined, { weekday: "short" });
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
  } catch {
    return iso ?? "—";
  }
};

const fmtAmount = (inv: MajikInvoice): string => {
  if (inv.isEncrypted && inv.isLocked) {
    try {
      const t = inv.public.totalAmount;
      if (t == null) return "—";
      const major =
        typeof (t as any).toMajor === "function"
          ? (t as any).toMajor()
          : Number(t);
      const currency = inv.public?.currency ?? "PHP";
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency,
        minimumFractionDigits: 2,
      }).format(Number(major));
    } catch {
      return "Encrypted";
    }
  }
  const canRead = !inv.isEncrypted || inv.hasDecryptedCache;
  const payload = canRead ? inv.invoice : null;

  try {
    const t =
      payload?.totals?.grandTotal ??
      payload?.totalAmount ??
      inv.public?.totalAmount;
    if (t == null) return "—";
    const major =
      typeof (t as any).toMajor === "function"
        ? (t as any).toMajor()
        : Number(t);
    const currency = inv.public?.currency ?? payload?.currency ?? "PHP";
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
    }).format(Number(major));
  } catch {
    return "—";
  }
};

const getAmountNum = (inv: MajikInvoice): number => {
  if (inv.isEncrypted && inv.isLocked) return 0;
  const canRead = !inv.isEncrypted || inv.hasDecryptedCache;
  const payload = canRead ? inv.invoice : null;
  try {
    const t =
      payload?.totals?.grandTotal ??
      payload?.totalAmount ??
      inv.public?.totalAmount;
    if (t == null) return 0;
    const major =
      typeof (t as any).toMajor === "function"
        ? (t as any).toMajor()
        : Number(t);
    return Number(major);
  } catch {
    return 0;
  }
};

const getIssueDate = (inv: MajikInvoice): number => {
  const iso =
    inv.public?.issuedAt ??
    inv.issueDate ??
    (inv.invoice as any)?.issueDate ??
    null;
  return iso ? new Date(iso).getTime() : 0;
};

const getPartyName = (inv: MajikInvoice, tab: ExchangeTab): string =>
  tab === "inbox"
    ? (inv.public?.issuerName ?? "Unknown Issuer")
    : (inv.public?.recipientName ?? "Unknown Recipient");

const statusColor = (status?: string | null): string => {
  switch (status?.toLowerCase()) {
    case "issued":
      return "#3b9e6a";
    case "draft":
      return "#8b8fa8";
    case "paid":
      return "#2b7fd4";
    case "overdue":
      return "#c74e4e";
    case "cancelled":
      return "#c74e4e";
    case "void":
      return "#c74e4e";
    case "disputed":
      return "#d4872b";
    default:
      return "#8b8fa8";
  }
};

// ---------------------------------------------------------------------------
// Animations
// ---------------------------------------------------------------------------

const fadeUp = keyframes`
  from { opacity: 0; transform: translateY(4px); }
  to   { opacity: 1; transform: translateY(0); }
`;

const shimmer = keyframes`
  0%   { background-position: -400px 0; }
  100% { background-position: 400px 0; }
`;

// ---------------------------------------------------------------------------
// Styled components
// ---------------------------------------------------------------------------

const Root = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
`;

// ── Section label (e.g. "Recent" vs "Results") ───────────────────────────

const SectionLabel = styled.div<{ $padding: string }>`
  padding: ${({ $padding }) => $padding};
  font-family: ${({ theme }) => theme.typography.fonts.semibold};
  font-size: 9.5px;
  letter-spacing: 0.09em;
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.primary};
  opacity: 0.55;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const SectionCount = styled.span`
  font-family: ${({ theme }) => theme.typography.fonts.numbers};
  font-size: 9px;
  opacity: 0.6;
`;

// ── Table header ─────────────────────────────────────────────────────────

const TableHead = styled.div<{ $grid: string }>`
  display: grid;
  grid-template-columns: ${({ $grid }) => $grid};
  padding: 0 20px;
  background: ${({ theme }) => theme.colors.secondaryBackground};
  border-bottom: 1px solid ${({ theme }) => theme.colors.primary}18;
  flex-shrink: 0;
`;

const HeadCell = styled.button<{ $align?: "right" }>`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 8px 0;
  background: none;
  border: none;
  cursor: pointer;
  font-family: ${({ theme }) => theme.typography.fonts.semibold};
  font-size: 9.5px;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.primary};
  opacity: 0.7;
  text-align: ${({ $align }) => $align ?? "left"};
  justify-content: ${({ $align }) =>
    $align === "right" ? "flex-end" : "flex-start"};
  user-select: none;
  transition: opacity 0.12s;

  &:hover {
    opacity: 1;
  }
`;

const SortIcon = styled.span<{ $active: boolean }>`
  display: inline-flex;
  opacity: ${({ $active }) => ($active ? 1 : 0.3)};
  transition: opacity 0.12s;
`;

// ── Scroll container ─────────────────────────────────────────────────────

const Scroll = styled.div`
  flex: 1;
  overflow-y: auto;

  &::-webkit-scrollbar {
    width: 4px;
  }
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  &::-webkit-scrollbar-thumb {
    background: ${({ theme }) => theme.colors.primary}18;
    border-radius: 4px;
  }
`;

// ── Row ──────────────────────────────────────────────────────────────────
const Row = styled.div<{
  $selected: boolean;
  $multiSelected?: boolean;
  $disabled?: boolean;
  $grid: string;
  $padding: string;
}>`
  display: grid;
  grid-template-columns: ${({ $grid }) => $grid};
  padding: ${({ $padding }) => $padding};
  border-bottom: 1px solid ${({ theme }) => theme.colors.primary}07;
  cursor: ${({ $disabled }) => ($disabled ? "not-allowed" : "pointer")};
  transition:
    background 0.1s,
    opacity 0.1s;
  animation: ${fadeUp} 0.13s ease;
  align-items: center;

  opacity: ${({ $disabled }) => ($disabled ? 0.45 : 1)};

  ${({ theme, $selected, $multiSelected }) =>
    ($selected || $multiSelected) &&
    css`
      background: ${theme.colors.primarySoft};
      border-left: 2px solid ${theme.colors.primary};
      padding-left: 18px;
    `}

  &:hover {
    background: ${({ theme, $disabled }) =>
      !$disabled && `${theme.colors.primarySoft}55`};
  }

  &:last-child {
    border-bottom: none;
  }
`;

// ── Row cells ────────────────────────────────────────────────────────────

const CellParty = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
`;

const PartyName = styled.div<{ $fontSize: string }>`
  font-size: ${({ $fontSize }) => $fontSize};
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: ${({ theme }) => theme.colors.textPrimary};
`;

const PartySub = styled.div<{ $fontSize: string }>`
  font-size: ${({ $fontSize }) => $fontSize};
  opacity: 0.4;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const CellNum = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
`;

const InvNum = styled.span<{ $fontSize: string }>`
  font-size: ${({ $fontSize }) => $fontSize};
  font-family: ${({ theme }) => theme.typography.fonts.numbers};
  color: ${({ theme }) => theme.colors.primary};
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const InvDate = styled.span<{ $fontSize: string }>`
  font-size: ${({ $fontSize }) => $fontSize};
  font-family: ${({ theme }) => theme.typography.fonts.light};
  color: ${({ theme }) => theme.colors.textSecondary};
`;

const StatusPill = styled.span<{ $color: string }>`
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  font-size: 9px;
  padding: 2px 7px;
  border-radius: ${({ theme }) => theme.borders.radius.rounded};
  color: ${({ $color }) => $color};
  background: ${({ $color }) => $color}18;
  border: 1px solid ${({ $color }) => $color}28;
  text-transform: capitalize;
  width: fit-content;
`;

const CellAmount = styled.div<{
  $encrypted?: boolean;
  $fontSize: string;
}>`
  font-size: ${({ $fontSize }) => $fontSize};
  font-family: ${({ theme }) => theme.typography.fonts.numbers};
  font-weight: 500;
  text-align: right;
  color: ${({ $encrypted, theme }) =>
    $encrypted ? theme.colors.textSecondary : theme.colors.textPrimary};
  font-style: ${({ $encrypted }) => ($encrypted ? "italic" : "normal")};
`;

const CellFlags = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 4px;
  flex-wrap: wrap;
`;

const MiniPill = styled.span`
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  font-size: 9px;
  padding: 1px 5px;
  border-radius: ${({ theme }) => theme.borders.radius.rounded};
  color: ${({ theme }) => theme.colors.primary};
  background: ${({ theme }) => theme.colors.primarySoft};
  border: 1px solid ${({ theme }) => theme.colors.primary}22;
  display: inline-flex;
  align-items: center;
  gap: 3px;
`;

// ── Empty / loading states ────────────────────────────────────────────────

const EmptyState = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  opacity: 0.35;
  color: ${({ theme }) => theme.colors.textSecondary};
  text-align: center;
  padding: 3rem 2rem;
`;

const EmptyText = styled.div`
  font-family: ${({ theme }) => theme.typography.fonts.light};
  font-size: 12px;
  line-height: 1.75;
  white-space: pre-line;
`;

// Skeleton row
const SkeletonRow = styled.div<{ $grid: string; $padding: string }>`
  display: grid;
  grid-template-columns: ${({ $grid }) => $grid};
  padding: ${({ $padding }) => $padding};
  border-bottom: 1px solid ${({ theme }) => theme.colors.primary}07;
  align-items: center;
  gap: 0;
`;

const SkeletonCell = styled.div<{ $w?: string }>`
  height: 10px;
  width: ${({ $w }) => $w ?? "70%"};
  border-radius: 4px;
  background: linear-gradient(
    90deg,
    ${({ theme }) => theme.colors.primarySoft}44 25%,
    ${({ theme }) => theme.colors.primarySoft}99 50%,
    ${({ theme }) => theme.colors.primarySoft}44 75%
  );
  background-size: 400px 100%;
  animation: ${shimmer} 1.4s ease infinite;
`;

// ---------------------------------------------------------------------------
// Skeleton placeholder rows
// ---------------------------------------------------------------------------

const SKELETON_WIDTHS = ["68%", "55%", "44%", "72%", "50%"];

const SkeletonRows = memo(function SkeletonRows({
  count = 6,
  grid,
  padding,
}: {
  count?: number;
  grid: string;
  padding: string;
}) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <SkeletonRow key={i} $grid={grid} $padding={padding}>
          <SkeletonCell $w={SKELETON_WIDTHS[i % 5]} />
          <SkeletonCell $w="58%" />
          <SkeletonCell $w="44%" />
          <SkeletonCell $w="66%" />
          <SkeletonCell $w="32%" />
        </SkeletonRow>
      ))}
    </>
  );
});

// ---------------------------------------------------------------------------
// Sort icon helper
// ---------------------------------------------------------------------------

function SortIndicator({
  active,
  dir,
}: {
  sortKey: SortKey;
  active: boolean;
  dir: SortDir;
}) {
  if (!active) {
    return (
      <SortIcon $active={false}>
        <ArrowsDownUpIcon size={9} />
      </SortIcon>
    );
  }
  return (
    <SortIcon $active={true}>
      {dir === "asc" ? (
        <ArrowUpIcon size={9} weight="bold" />
      ) : (
        <ArrowDownIcon size={9} weight="bold" />
      )}
    </SortIcon>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const ExchangeSearchResults = memo(function ExchangeSearchResults({
  variant,
  results,
  allInvoices,
  hasQuery,
  tab,
  onSelect,
  defaultCount = 10,
  loading = false,
  selectedId,
  disabledInvoiceIds,
  hiddenInvoiceIds,
  onToggleSelect,
  selectedIds,
  selectionMode,
}: ExchangeSearchResultsProps) {
  const ui = useMemo(() => VARIANT_CONFIG[variant], [variant]);
  // ── Internal sort state ───────────────────────────────────────────────────
  const [sort, setSort] = useState<SortState>({ key: "date", dir: "desc" });

  const toggleSort = useCallback((key: SortKey) => {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "desc" },
    );
  }, []);

  // ── Determine which list to display ──────────────────────────────────────
  // When no active query → show `defaultCount` most-recent from allInvoices
  // When active query    → show results (already filtered by parent)
  const baseList = useMemo(() => {
    if (!hasQuery) {
      return [...allInvoices]
        .sort((a, b) => getIssueDate(b) - getIssueDate(a))
        .slice(0, defaultCount);
    }
    return results;
  }, [hasQuery, results, allInvoices, defaultCount]);

  // ── Apply sort ────────────────────────────────────────────────────────────
  const displayList = useMemo(() => {
    return [...baseList].sort((a, b) => {
      let cmp = 0;
      switch (sort.key) {
        case "date":
          cmp = getIssueDate(a) - getIssueDate(b);
          break;
        case "amount":
          cmp = getAmountNum(a) - getAmountNum(b);
          break;
        case "party":
          cmp = getPartyName(a, tab).localeCompare(getPartyName(b, tab));
          break;
        case "status":
          cmp = (a.status ?? "").localeCompare(b.status ?? "");
          break;
      }
      return sort.dir === "asc" ? cmp : -cmp;
    });
  }, [baseList, sort, tab]);

  const filteredDisplayList = useMemo(() => {
    return displayList.filter((inv) => !hiddenInvoiceIds?.has(inv.id));
  }, [displayList, hiddenInvoiceIds]);
  // ── Section label ─────────────────────────────────────────────────────────
  const sectionLabel = !hasQuery ? `Recent · last ${defaultCount}` : `Results`;

  const handleRowClick = useCallback(
    (inv: MajikInvoice) => {
      if (disabledInvoiceIds?.has(inv.id)) return;

      if (selectionMode) {
        onToggleSelect?.(inv);
        return;
      }

      onSelect(inv);
    },
    [disabledInvoiceIds, selectionMode, onToggleSelect, onSelect],
  );

  const handlePartySort = useCallback(() => toggleSort("party"), [toggleSort]);
  const handleDateSort = useCallback(() => toggleSort("date"), [toggleSort]);
  const handleStatusSort = useCallback(
    () => toggleSort("status"),
    [toggleSort],
  );
  const handleAmountSort = useCallback(
    () => toggleSort("amount"),
    [toggleSort],
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Root>
      <SectionLabel $padding={ui.sectionPadding}>
        {sectionLabel}
        {!loading && (
          <SectionCount>
            {filteredDisplayList.length} invoice
            {filteredDisplayList.length !== 1 ? "s" : ""}
          </SectionCount>
        )}
      </SectionLabel>

      {/* Column headers */}
      <TableHead $grid={ui.grid}>
        <HeadCell onClick={handlePartySort}>
          {tab === "inbox" ? "Issuer" : "Recipient"}
          <SortIndicator
            sortKey="party"
            active={sort.key === "party"}
            dir={sort.dir}
          />
        </HeadCell>
        <HeadCell onClick={handleDateSort}>
          Invoice # / Date
          <SortIndicator
            sortKey="date"
            active={sort.key === "date"}
            dir={sort.dir}
          />
        </HeadCell>
        <HeadCell onClick={handleStatusSort}>
          Status
          <SortIndicator
            sortKey="status"
            active={sort.key === "status"}
            dir={sort.dir}
          />
        </HeadCell>
        <HeadCell $align="right" onClick={handleAmountSort}>
          Amount
          <SortIndicator
            sortKey="amount"
            active={sort.key === "amount"}
            dir={sort.dir}
          />
        </HeadCell>
        {ui.showFlags && <HeadCell $align="right">Flags</HeadCell>}
      </TableHead>

      <Scroll>
        {loading ? (
          <SkeletonRows
            count={defaultCount > 6 ? 8 : defaultCount}
            grid={ui.grid}
            padding={ui.rowHeight}
          />
        ) : filteredDisplayList.length === 0 ? (
          <EmptyState>
            <InvoiceIcon size={42} weight="thin" />
            <EmptyText>
              {hasQuery
                ? "No invoices matched your search.\nTry a different term or clear the filter."
                : "No publishable invoices found. Only issued invoices can be published. Reset or restart the invoice first."}
            </EmptyText>
          </EmptyState>
        ) : (
          filteredDisplayList.map((inv) => {
            const isEnc = inv.isEncrypted && inv.isLocked;
            const party = getPartyName(inv, tab);
            const invNum =
              inv.public?.invoiceNumber ?? inv.id?.slice(0, 10) ?? "—";
            const issueAt = inv.public?.issuedAt ?? inv.issueDate ?? null;
            const disabled = disabledInvoiceIds?.has(inv.id) ?? false;

            const isOpened = !!selectedId && selectedId === inv.id;

            const isMultiSelected = selectedIds?.has(inv.id) ?? false;
            return (
              <Row
                $grid={ui.grid}
                $padding={ui.rowHeight}
                key={inv.id}
                $selected={isOpened}
                $multiSelected={isMultiSelected}
                $disabled={disabled}
                onClick={() => handleRowClick(inv)}
                tabIndex={disabled ? -1 : 0}
                role="button"
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleRowClick(inv);
                  }
                }}
              >
                {/* Party */}
                <CellParty>
                  <PartyName $fontSize={ui.fontSize.party} title={party}>
                    {party}
                  </PartyName>
                  {ui.showSubline && inv.public?.currency && (
                    <PartySub $fontSize={ui.fontSize.sub}>
                      {inv.public.currency}
                    </PartySub>
                  )}
                </CellParty>

                {/* Invoice # + date */}
                <CellNum>
                  <InvNum $fontSize={ui.fontSize.invoice}>{invNum}</InvNum>
                  <InvDate $fontSize={ui.fontSize.date}>
                    {fmtDate(issueAt)}
                  </InvDate>
                </CellNum>

                {/* Status */}
                <div>
                  {inv.status && (
                    <StatusPill $color={statusColor(inv.status)}>
                      {inv.status}
                    </StatusPill>
                  )}
                </div>

                {/* Amount */}
                <CellAmount
                  $encrypted={isEnc && !inv.public?.totalAmount}
                  $fontSize={ui.fontSize.amount}
                >
                  {fmtAmount(inv)}
                </CellAmount>

                {/* Flags */}

                {ui.showFlags && (
                  <CellFlags>
                    {inv.isEncrypted && (
                      <MiniPill>
                        <LockKeyIcon size={7} weight="fill" />
                        {isEnc ? "Enc" : "Dec"}
                      </MiniPill>
                    )}
                    {inv.isSealed && (
                      <MiniPill>
                        <LockKeyIcon size={7} weight="fill" />
                        Sealed
                      </MiniPill>
                    )}
                  </CellFlags>
                )}
              </Row>
            );
          })
        )}
      </Scroll>
    </Root>
  );
});
