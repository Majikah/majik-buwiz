/**
 * ExchangeInvoiceTable.tsx
 *
 * Fixed-column invoice table for the Exchange Panel.
 * - Columns: Issuer/Recipient · Invoice # · Sent Date · Status · Amount · Actions
 * - Always reads from inv.public.* (encrypted-safe); falls back gracefully
 * - Checkboxes + bulk bar: issuers → Void + Delete; recipients → Dispute
 * - Per-row actions: issuers → View | Void | Delete; recipients → View | Dispute
 * - Void/Delete/Dispute modals are inline; ExchangeDeleteModal handles
 *   force-void-and-delete for mixed (voided + non-voided) selections
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import styled, { css, keyframes } from "styled-components";
import {
  ArrowClockwiseIcon,
  CaretDownIcon,
  CaretLeftIcon,
  CaretRightIcon,
  CaretUpDownIcon,
  CaretUpIcon,
  DownloadSimpleIcon,
  EyeIcon,
  ProhibitIcon,
  TrashIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";
import type { MajikInvoice } from "@majikah/majik-invoice";
import { DisputeInvoiceModal } from "./modals/DisputeInvoiceModal";
import { VoidInvoiceModal } from "./modals/VoidInvoiceModal";
import { ExchangeDeleteModal } from "./modals/ExchangeDeleteModal";
import { DateTime } from "luxon";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SortDir = "asc" | "desc";
type SortKey = "party" | "invoiceNumber" | "sentDate" | "status" | "amount";

interface SortState {
  key: SortKey;
  dir: SortDir;
}

type ModalTarget =
  | { kind: "void"; invoices: MajikInvoice[] }
  | { kind: "dispute"; invoices: MajikInvoice[] }
  | { kind: "delete"; invoices: MajikInvoice[] }
  | null;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ExchangeInvoiceTableProps {
  /** Invoices to display (already filtered/paginated by parent). */
  items: MajikInvoice[];
  /** Which tab we're on — determines "party" column label and per-row actions. */
  tab: "inbox" | "sent";
  /** Whether the current user is an issuer of any shown invoices. */
  isIssuer: (inv: MajikInvoice) => boolean;
  pageSize?: number;
  loading?: boolean;

  // ── Per-row handlers ──────────────────────────────────────────────────────
  onView: (inv: MajikInvoice) => void;
  /** Void one invoice with an optional reason string. */
  onVoid: (inv: MajikInvoice, reason: string) => Promise<void>;
  /** Delete one or more invoices. removeLocally = cloud+local; forceVoid = void first. */
  onDelete: (
    invoices: MajikInvoice[],
    removeLocally: boolean,
    forceVoid: boolean,
  ) => Promise<void>;
  /** Dispute one or more invoices with a required reason. */
  onDispute: (invoices: MajikInvoice[], reason: string) => Promise<void>;

  // ── Bulk handlers ─────────────────────────────────────────────────────────
  onBulkVoid?: (invoices: MajikInvoice[], reason: string) => Promise<void>;
  onBulkExport?: (invoices: MajikInvoice[]) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** All lifecycle data lives in inv.public — safe for encrypted invoices. */
const pub = (inv: MajikInvoice) => inv.public ?? {};

const fmtAmount = (inv: MajikInvoice): string => {
  // Always try public first — safe for encrypted invoices
  try {
    const t = pub(inv).totalAmount;
    if (t != null) {
      const major =
        typeof (t as any).toMajor === "function"
          ? (t as any).toMajor()
          : Number(t);
      const currency = pub(inv).currency ?? "PHP";
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency,
        minimumFractionDigits: 2,
      }).format(Number(major));
    }
  } catch {
    // fall through to decrypted payload below
  }

  // Decrypted payload available?
  if (!inv.isEncrypted || inv.hasDecryptedCache) {
    try {
      const payload = inv.invoice;
      const t = payload?.totals?.grandTotal ?? payload?.totalAmount;
      if (t != null) {
        const major =
          typeof (t as any).toMajor === "function"
            ? (t as any).toMajor()
            : Number(t);
        const currency = payload?.currency ?? pub(inv).currency ?? "PHP";
        return new Intl.NumberFormat(undefined, {
          style: "currency",
          currency,
          minimumFractionDigits: 2,
        }).format(Number(major));
      }
    } catch {
      // ignore
    }
  }

  return "—";
};

const copyToClipboard = (text: string, label = "Copied") => {
  navigator.clipboard.writeText(text).then(() =>
    toast.success(label, {
      duration: 1500,
      description: text,
      id: `toast-copy-${text}`,
    }),
  );
};

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
    case "void":
    case "cancelled":
      return "#c74e4e";
    case "disputed":
      return "#d4872b";
    case "partial":
      return "#9e7a3b";
    case "sent":
      return "#3b9e6a";
    case "viewed":
      return "#3b8e9e";
    default:
      return "#8b8fa8";
  }
};

/**
 * Returns true when every invoice in the array shares the same public.status.
 * Useful for bulk action guards.
 */
export const allSameStatus = (invoices: MajikInvoice[]): boolean => {
  if (invoices.length === 0) return true;
  const first = pub(invoices[0]).status;
  return invoices.every((inv) => pub(inv).status === first);
};

/**
 * Returns true when every invoice in the array has public.status === "void".
 */
export const allVoided = (invoices: MajikInvoice[]): boolean =>
  invoices.length > 0 && invoices.every((inv) => pub(inv).status === "void");

// ---------------------------------------------------------------------------
// Animations
// ---------------------------------------------------------------------------

const fadeUp = keyframes`
  from { opacity: 0; transform: translateY(4px); }
  to   { opacity: 1; transform: translateY(0); }
`;

const spin = keyframes`
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
`;

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
// Styled — shell
// ---------------------------------------------------------------------------

const Root = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  flex: 1;
  overflow: hidden;
`;

const TableScroll = styled.div`
  flex: 1;
  overflow-y: auto;
  overflow-x: auto;

  &::-webkit-scrollbar {
    width: 4px;
    height: 4px;
  }
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  &::-webkit-scrollbar-thumb {
    background: ${({ theme }) => theme.colors.primary}18;
    border-radius: 4px;
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
  $sortable?: boolean;
  $minWidth?: string;
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
  user-select: none;
  min-width: ${({ $minWidth }) => $minWidth ?? "auto"};
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

const SortIcon = styled.span<{ $active: boolean }>`
  display: inline-flex;
  align-items: center;
  opacity: ${({ $active }) => ($active ? 1 : 0.3)};
  transition: opacity 0.12s;
  flex-shrink: 0;
`;

const CheckboxTh = styled.th`
  width: 40px;
  min-width: 40px;
  padding: 10px 8px 10px 14px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.primary}20;
  background: ${({ theme }) => theme.colors.secondaryBackground};
`;

const TBody = styled.tbody``;

const Tr = styled.tr<{ $selected?: boolean }>`
  border-bottom: 1px solid ${({ theme }) => theme.colors.primary}08;
  background: ${({ $selected, theme }) =>
    $selected ? theme.colors.primarySoft : "transparent"};
  transition: background 0.1s;
  animation: ${fadeUp} 0.13s ease;

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
// Styled — cells
// ---------------------------------------------------------------------------

const PartyName = styled.div`
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textPrimary};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 180px;
`;

const PartySub = styled.div`
  font-family: ${({ theme }) => theme.typography.fonts.light};
  font-size: 10px;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.55;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 180px;
`;

const InvNum = styled.div`
  font-family: ${({ theme }) => theme.typography.fonts.numbers};
  font-size: 12px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.primary};
  letter-spacing: 0.02em;
`;

const DateText = styled.div`
  font-family: ${({ theme }) => theme.typography.fonts.light};
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textSecondary};
`;

const StatusPill = styled.span<{ $color: string }>`
  display: inline-block;
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  font-size: 9.5px;
  padding: 2px 8px;
  border-radius: ${({ theme }) => theme.borders.radius.rounded};
  text-transform: capitalize;
  color: ${({ $color }) => $color};
  background: ${({ $color }) => $color}16;
  border: 1px solid ${({ $color }) => $color}28;
`;

const AmountText = styled.div`
  font-family: ${({ theme }) => theme.typography.fonts.numbers};
  font-size: 12px;
  font-weight: 500;
  text-align: right;
`;

// ---------------------------------------------------------------------------
// Styled — actions
// ---------------------------------------------------------------------------

const ActionsCell = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 2px;
`;

const ActionBtn = styled.button<{ $variant?: "default" | "danger" | "warn" }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: ${({ theme }) => theme.borders.radius.small};
  border: none;
  background: none;
  cursor: pointer;
  transition: all 0.12s;
  opacity: 0.45;

  ${({ $variant, theme }) => {
    switch ($variant) {
      case "danger":
        return css`
          color: ${theme.colors.error};
          &:hover:not(:disabled) {
            background: ${theme.colors.error}14;
            opacity: 1;
          }
        `;
      case "warn":
        return css`
          color: ${theme.colors.primary};
          &:hover:not(:disabled) {
            background: ${theme.colors.primary}14;
            opacity: 1;
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
    opacity: 0.15;
    cursor: not-allowed;
  }
`;

// ---------------------------------------------------------------------------
// Styled — bulk bar
// ---------------------------------------------------------------------------

const BulkBar = styled.div<{ $visible: boolean }>`
  display: flex;
  align-items: center;
  gap: 8px;
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

const BulkBtn = styled.button<{
  $variant?: "default" | "danger" | "warn" | "ghost";
}>`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  font-size: 11px;
  padding: 6px 12px;
  border-radius: ${({ theme }) => theme.borders.radius.medium};
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;

  ${({ $variant, theme }) => {
    switch ($variant) {
      case "danger":
        return css`
          border: 1px solid ${theme.colors.error}44;
          background: ${theme.colors.error}10;
          color: ${theme.colors.error};
          &:hover {
            background: ${theme.colors.error}1e;
          }
        `;
      case "warn":
        return css`
          border: 1px solid ${theme.colors.primary}44;
          background: ${theme.colors.primary}10;
          color: ${theme.colors.primary};
          &:hover {
            background: ${theme.colors.primary}1e;
          }
        `;
      case "ghost":
        return css`
          border: 1px solid ${theme.colors.primary}22;
          background: transparent;
          color: ${theme.colors.textSecondary};
          &:hover {
            background: ${theme.colors.primarySoft};
            color: ${theme.colors.primary};
          }
        `;
      default:
        return css`
          border: 1px solid ${theme.colors.primary}44;
          background: ${theme.colors.primarySoft};
          color: ${theme.colors.primary};
          &:hover {
            background: ${theme.colors.primary}18;
          }
        `;
    }
  }}
`;

const ClearBtn = styled.button`
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  font-size: 11px;
  padding: 5px 10px;
  border-radius: ${({ theme }) => theme.borders.radius.medium};
  border: 1px solid ${({ theme }) => theme.colors.primary}22;
  background: transparent;
  color: ${({ theme }) => theme.colors.textSecondary};
  cursor: pointer;
  transition: all 0.14s;
  &:hover {
    background: ${({ theme }) => theme.colors.primarySoft};
    color: ${({ theme }) => theme.colors.primary};
  }
`;

// ---------------------------------------------------------------------------
// Styled — pagination
// ---------------------------------------------------------------------------

const PagBar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 9px 14px;
  border-top: 1px solid ${({ theme }) => theme.colors.primary}0e;
  background: ${({ theme }) => theme.colors.secondaryBackground};
  flex-shrink: 0;
`;

const PagInfo = styled.span`
  font-family: ${({ theme }) => theme.typography.fonts.light};
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textSecondary};
`;

const PagControls = styled.div`
  display: flex;
  gap: 3px;
  align-items: center;
`;

const PagBtn = styled.button<{ $active?: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 28px;
  height: 28px;
  padding: 0 6px;
  border-radius: ${({ theme }) => theme.borders.radius.small};
  border: 1px solid
    ${({ $active, theme }) =>
      $active ? theme.colors.primary : `${theme.colors.primary}22`};
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
    opacity: 0.25;
    cursor: not-allowed;
  }
`;

// ---------------------------------------------------------------------------
// Styled — empty / loading
// ---------------------------------------------------------------------------

const CenterState = styled.div`
  padding: 4rem 2rem;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  opacity: 0.4;
  color: ${({ theme }) => theme.colors.textSecondary};
`;

const CenterText = styled.div`
  font-family: ${({ theme }) => theme.typography.fonts.light};
  font-size: 12px;
  line-height: 1.75;
`;

const Spinner = styled(ArrowClockwiseIcon)`
  animation: ${spin} 0.7s linear infinite;
`;

// ---------------------------------------------------------------------------
// Inner pagination component
// ---------------------------------------------------------------------------

interface PaginationProps {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (p: number) => void;
}

const Pagination: React.FC<PaginationProps> = ({
  page,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
}) => {
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalItems);
  const pages = buildPageNumbers(page, totalPages);

  return (
    <PagBar>
      <PagInfo>
        {totalItems === 0 ? "No invoices" : `${start}–${end} of ${totalItems}`}
      </PagInfo>
      <PagControls>
        <PagBtn onClick={() => onPageChange(page - 1)} disabled={page === 1}>
          <CaretLeftIcon size={11} weight="bold" />
        </PagBtn>
        {pages.map((p, i) =>
          p === "…" ? (
            <PagBtn key={`ell-${i}`} disabled>
              …
            </PagBtn>
          ) : (
            <PagBtn
              key={p}
              $active={p === page}
              onClick={() => onPageChange(p as number)}
            >
              {p}
            </PagBtn>
          ),
        )}
        <PagBtn
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages || totalPages === 0}
        >
          <CaretRightIcon size={11} weight="bold" />
        </PagBtn>
      </PagControls>
    </PagBar>
  );
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const ExchangeInvoiceTable: React.FC<ExchangeInvoiceTableProps> =
  React.memo(
    ({
      items,
      tab,
      isIssuer,
      pageSize = 25,
      loading = false,
      onView,
      onVoid,
      onDelete,
      onDispute,
      onBulkVoid,
      onBulkExport,
    }) => {
      // ── Sort ────────────────────────────────────────────────────────────────
      const [sort, setSort] = useState<SortState>({
        key: "sentDate",
        dir: "desc",
      });

      const toggleSort = useCallback((key: SortKey) => {
        setSort((prev) =>
          prev.key === key
            ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
            : { key, dir: "desc" },
        );
      }, []);

      // ── Pagination ──────────────────────────────────────────────────────────
      const [page, setPage] = useState(1);

      // ── Selection ───────────────────────────────────────────────────────────
      const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
      const selectAllRef = useRef<HTMLInputElement>(null);

      // ── Modal target ────────────────────────────────────────────────────────
      const [modalTarget, setModalTarget] = useState<ModalTarget>(null);

      // ── Sort ────────────────────────────────────────────────────────────────
      const sortedItems = useMemo(() => {
        return [...items].sort((a, b) => {
          let cmp = 0;
          switch (sort.key) {
            case "party":
              cmp = (
                (tab === "inbox" ? pub(a).issuerName : pub(a).recipientName) ??
                ""
              ).localeCompare(
                (tab === "inbox" ? pub(b).issuerName : pub(b).recipientName) ??
                  "",
              );
              break;
            case "invoiceNumber":
              cmp = (pub(a).invoiceNumber ?? "").localeCompare(
                pub(b).invoiceNumber ?? "",
              );
              break;
            case "sentDate": {
              const da = a.sentDate
                ? a.sentDate.getTime()
                : pub(a).issuedAt
                  ? new Date(pub(a).issuedAt!).getTime()
                  : 0;
              const db = b.sentDate
                ? b.sentDate.getTime()
                : pub(b).issuedAt
                  ? new Date(pub(b).issuedAt!).getTime()
                  : 0;
              cmp = da - db;
              break;
            }
            case "status":
              cmp = (pub(a).status ?? "").localeCompare(pub(b).status ?? "");
              break;
            case "amount":
              cmp =
                Number(pub(a).totalAmount ?? 0) -
                Number(pub(b).totalAmount ?? 0);
              break;
          }
          return sort.dir === "asc" ? cmp : -cmp;
        });
      }, [items, sort, tab]);

      const totalPages = Math.max(1, Math.ceil(sortedItems.length / pageSize));
      const safePage = Math.min(page, totalPages);

      const pageItems = useMemo(() => {
        const start = (safePage - 1) * pageSize;
        return sortedItems.slice(start, start + pageSize);
      }, [sortedItems, safePage, pageSize]);

      const pageIds = useMemo(
        () => pageItems.map((inv) => inv.id),
        [pageItems],
      );
      const allPageSelected =
        pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));
      const somePageSelected = pageIds.some((id) => selectedIds.has(id));

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
          return next;
        });
      }, [allPageSelected, pageIds]);

      const toggleRow = useCallback((id: string) => {
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.has(id) ? next.delete(id) : next.add(id);
          return next;
        });
      }, []);

      const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

      const selectedInvoices = useMemo(
        () => items.filter((inv) => selectedIds.has(inv.id)),
        [items, selectedIds],
      );

      // ── Determine role of the viewer for selected invoices ──────────────────
      // Bulk issuer actions require all selected to be issuable by this user.
      // We gate on the first invoice for simplicity (mixed ownership is unusual).
      const selectedAreIssuer = useMemo(
        () =>
          selectedInvoices.length > 0 &&
          selectedInvoices.every((inv) => isIssuer(inv)),
        [selectedInvoices, isIssuer],
      );

      const selectedAreRecipient = useMemo(
        () =>
          selectedInvoices.length > 0 &&
          selectedInvoices.every((inv) => !isIssuer(inv)),
        [selectedInvoices, isIssuer],
      );

      /**
       * Subset of selected issuer invoices that are NOT already voided.
       * Used for the bulk void button label and the invoices passed to VoidInvoiceModal.
       * Already-voided invoices in the selection are silently skipped.
       */
      const voidableSelected = useMemo(
        () =>
          selectedInvoices.filter(
            (inv) => isIssuer(inv) && pub(inv).status !== "void",
          ),
        [selectedInvoices, isIssuer],
      );

      /**
       * Subset of selected recipient invoices that can still be disputed.
       * Mirrors the per-row disable logic: excludes "disputed", "void", and "paid".
       *
       * Behaviour:
       * - All selected already disputed/paid/void → button hidden entirely.
       * - Mix of disputable + non-disputable → button shown with the count of
       *   disputable invoices only; non-disputable ones are silently skipped.
       */
      const disputableSelected = useMemo(
        () =>
          selectedInvoices.filter((inv) => {
            const s = pub(inv).status;
            return (
              !isIssuer(inv) && s !== "disputed" && s !== "void" && s !== "paid"
            );
          }),
        [selectedInvoices, isIssuer],
      );

      const selectedCount = selectedIds.size;

      // ── Modal openers ───────────────────────────────────────────────────────
      const openVoid = useCallback(
        (invoices: MajikInvoice[]) =>
          setModalTarget({ kind: "void", invoices }),
        [],
      );

      const openDispute = useCallback(
        (invoices: MajikInvoice[]) =>
          setModalTarget({ kind: "dispute", invoices }),
        [],
      );

      const openDelete = useCallback(
        (invoices: MajikInvoice[]) =>
          setModalTarget({ kind: "delete", invoices }),
        [],
      );

      const closeModal = useCallback(() => setModalTarget(null), []);
      const handleCopyClipboard = useCallback((input: any) => {
        copyToClipboard(input, "Amount copied");
      }, []);

      // ── SortArrow helper ────────────────────────────────────────────────────
      const SortArrow = ({ k }: { k: SortKey }) => (
        <SortIcon $active={sort.key === k}>
          {sort.key === k ? (
            sort.dir === "asc" ? (
              <CaretUpIcon size={11} weight="bold" />
            ) : (
              <CaretDownIcon size={11} weight="bold" />
            )
          ) : (
            <CaretUpDownIcon size={11} />
          )}
        </SortIcon>
      );

      // ── Render ──────────────────────────────────────────────────────────────

      return (
        <>
          <Root>
            {/* Bulk action bar */}
            <BulkBar $visible={selectedCount > 0}>
              <BulkCount>
                {selectedCount} invoice{selectedCount !== 1 ? "s" : ""} selected
              </BulkCount>

              <ClearBtn onClick={clearSelection}>Clear</ClearBtn>

              {onBulkExport && (
                <BulkBtn
                  $variant="ghost"
                  onClick={() => onBulkExport(selectedInvoices)}
                >
                  <DownloadSimpleIcon size={12} weight="bold" />
                  Export
                </BulkBtn>
              )}

              {/* Issuer-only bulk actions */}
              {selectedAreIssuer && (
                <>
                  {/* Only shown when at least one selected invoice is not yet voided */}
                  {voidableSelected.length > 0 && (
                    <BulkBtn
                      $variant="warn"
                      onClick={() => openVoid(voidableSelected)}
                    >
                      <ProhibitIcon size={12} weight="bold" />
                      Void {voidableSelected.length}
                    </BulkBtn>
                  )}

                  <BulkBtn
                    $variant="danger"
                    onClick={() => openDelete(selectedInvoices)}
                  >
                    <TrashIcon size={12} weight="bold" />
                    Delete {selectedCount}
                  </BulkBtn>
                </>
              )}

              {/* Recipient-only bulk actions */}
              {/* Only shown when at least one selected invoice is still disputable.
                  If all selected are already disputed/void/paid, the button is hidden. */}
              {selectedAreRecipient && disputableSelected.length > 0 && (
                <BulkBtn
                  $variant="warn"
                  onClick={() => openDispute(disputableSelected)}
                >
                  <WarningCircleIcon size={12} weight="bold" />
                  Dispute {disputableSelected.length}
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

                    <Th
                      $sortable
                      $minWidth="160px"
                      onClick={() => toggleSort("party")}
                    >
                      <ThInner>
                        {tab === "inbox" ? "Issuer" : "Recipient"}
                        <SortArrow k="party" />
                      </ThInner>
                    </Th>

                    <Th
                      $sortable
                      $minWidth="130px"
                      onClick={() => toggleSort("invoiceNumber")}
                    >
                      <ThInner>
                        Invoice #<SortArrow k="invoiceNumber" />
                      </ThInner>
                    </Th>

                    <Th
                      $sortable
                      $minWidth="110px"
                      onClick={() => toggleSort("sentDate")}
                    >
                      <ThInner>
                        Sent <SortArrow k="sentDate" />
                      </ThInner>
                    </Th>

                    <Th
                      $sortable
                      $minWidth="110px"
                      onClick={() => toggleSort("status")}
                    >
                      <ThInner>
                        Status <SortArrow k="status" />
                      </ThInner>
                    </Th>

                    <Th
                      $sortable
                      $align="right"
                      $minWidth="130px"
                      onClick={() => toggleSort("amount")}
                    >
                      <ThInner $align="right">
                        Amount <SortArrow k="amount" />
                      </ThInner>
                    </Th>

                    <Th $align="right" $minWidth="100px">
                      Actions
                    </Th>
                  </tr>
                </THead>

                <TBody>
                  {loading && pageItems.length === 0 ? (
                    <tr>
                      <td colSpan={7}>
                        <CenterState>
                          <Spinner size={28} />
                          <CenterText>Loading…</CenterText>
                        </CenterState>
                      </td>
                    </tr>
                  ) : pageItems.length === 0 ? (
                    <tr>
                      <td colSpan={7}>
                        <CenterState>
                          <CenterText>No invoices found.</CenterText>
                        </CenterState>
                      </td>
                    </tr>
                  ) : (
                    pageItems.map((inv) => {
                      const invIsIssuer = isIssuer(inv);
                      const status = pub(inv).status;
                      const party =
                        tab === "inbox"
                          ? (pub(inv).issuerName ?? "—")
                          : (pub(inv).recipientName ?? "—");
                      const currency = pub(inv).currency ?? "PHP";

                      // Sent date: use the new getter, fall back to issuedAt
                      const sentDate =
                        (inv.sentDate ?? pub(inv).issuedAt)
                          ? DateTime.fromJSDate(inv.sentDate).toRelative()
                          : "—";

                      return (
                        <Tr key={inv.id} $selected={selectedIds.has(inv.id)}>
                          <CheckboxTd>
                            <Checkbox
                              checked={selectedIds.has(inv.id)}
                              onChange={() => toggleRow(inv.id)}
                            />
                          </CheckboxTd>

                          {/* Party */}
                          <Td
                            onClick={() => onView(inv)}
                            style={{ cursor: "pointer" }}
                          >
                            <PartyName title={party} data-private>{party}</PartyName>
                            <PartySub data-private>{currency}</PartySub>
                          </Td>

                          {/* Invoice number */}
                          <Td
                            onClick={() => onView(inv)}
                            style={{ cursor: "pointer" }}
                          >
                            <InvNum data-private>
                              {pub(inv).invoiceNumber ?? inv.id?.slice(0, 10)}
                            </InvNum>
                          </Td>

                          {/* Sent date */}
                          <Td>
                            <DateText>{sentDate}</DateText>
                          </Td>

                          {/* Status — from public */}
                          <Td>
                            {status ? (
                              <StatusPill $color={statusColor(status)} data-private>
                                {status}
                              </StatusPill>
                            ) : (
                              <StatusPill $color={statusColor(undefined)} data-private>
                                unknown
                              </StatusPill>
                            )}
                          </Td>

                          {/* Amount */}
                          <Td
                            $align="right"
                            onClick={() =>
                              handleCopyClipboard(inv.public.totalAmount)
                            }
                            style={{ cursor: "pointer" }}
                            data-private
                          >
                            <AmountText>{fmtAmount(inv)}</AmountText>
                          </Td>

                          {/* Actions */}
                          <Td $align="right">
                            <ActionsCell>
                              {/* View — always */}
                              <ActionBtn
                                title="View"
                                onClick={() => onView(inv)}
                              >
                                <EyeIcon size={14} />
                              </ActionBtn>

                              {invIsIssuer ? (
                                <>
                                  {/* Void — hidden when already voided */}
                                  {status !== "void" && (
                                    <ActionBtn
                                      $variant="warn"
                                      title="Void invoice"
                                      onClick={() => openVoid([inv])}
                                    >
                                      <ProhibitIcon size={14} />
                                    </ActionBtn>
                                  )}

                                  {/* Delete */}
                                  <ActionBtn
                                    $variant="danger"
                                    title={
                                      status !== "void"
                                        ? "Force void & delete"
                                        : "Delete invoice"
                                    }
                                    onClick={() => openDelete([inv])}
                                  >
                                    <TrashIcon size={14} />
                                  </ActionBtn>
                                </>
                              ) : (
                                /* Dispute — recipient only */
                                <ActionBtn
                                  $variant="warn"
                                  title="Dispute invoice"
                                  onClick={() => openDispute([inv])}
                                  disabled={
                                    status === "disputed" ||
                                    status === "void" ||
                                    status === "paid"
                                  }
                                >
                                  <WarningCircleIcon size={14} />
                                </ActionBtn>
                              )}
                            </ActionsCell>
                          </Td>
                        </Tr>
                      );
                    })
                  )}
                </TBody>
              </Table>
            </TableScroll>

            <Pagination
              page={safePage}
              totalPages={totalPages}
              totalItems={sortedItems.length}
              pageSize={pageSize}
              onPageChange={setPage}
            />
          </Root>

          {/* ── Void modal ── */}
          <VoidInvoiceModal
            open={modalTarget?.kind === "void"}
            onOpenChange={(o) => {
              if (!o) closeModal();
            }}
            invoices={modalTarget?.kind === "void" ? modalTarget.invoices : []}
            onConfirm={async (reason: string) => {
              if (!modalTarget || modalTarget.kind !== "void") return;
              const invs = modalTarget.invoices;
              if (invs.length === 1) {
                await onVoid(invs[0], reason);
              } else {
                await onBulkVoid?.(invs, reason);
              }
              clearSelection();
            }}
          />

          {/* ── Dispute modal ── */}
          <DisputeInvoiceModal
            open={modalTarget?.kind === "dispute"}
            onOpenChange={(o) => {
              if (!o) closeModal();
            }}
            invoices={
              modalTarget?.kind === "dispute" ? modalTarget.invoices : []
            }
            onConfirm={async (reason) => {
              if (!modalTarget || modalTarget.kind !== "dispute") return;
              await onDispute(modalTarget.invoices, reason);
              clearSelection();
            }}
          />

          {/* ── Delete modal ── */}
          <ExchangeDeleteModal
            open={modalTarget?.kind === "delete"}
            onOpenChange={(o) => {
              if (!o) closeModal();
            }}
            invoices={
              modalTarget?.kind === "delete" ? modalTarget.invoices : []
            }
            onConfirm={async (removeLocally, forceVoid) => {
              if (!modalTarget || modalTarget.kind !== "delete") return;
              await onDelete(modalTarget.invoices, removeLocally, forceVoid);
              clearSelection();
            }}
          />
        </>
      );
    },
  );

ExchangeInvoiceTable.displayName = "ExchangeInvoiceTable";
