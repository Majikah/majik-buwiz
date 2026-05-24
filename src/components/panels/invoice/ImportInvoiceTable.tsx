/**
 * ImportInvoiceTable.tsx
 *
 * A lean, checkbox-driven invoice table used exclusively inside ImportMJKIModal.
 * No sorting, no search, no extra fluff — just clear display of invoice data
 * with a selectable checkbox per row.
 *
 * Columns: ☐ | Issuer | Recipient | Invoice # | Issue Date | Status
 */

import { memo, useCallback } from "react";
import styled, { css, keyframes } from "styled-components";
import {
  CheckSquareIcon,
  SquareIcon,
  MinusSquareIcon,
  InvoiceIcon,
  WarningIcon,
} from "@phosphor-icons/react";
import type { MajikInvoice } from "@majikah/majik-invoice";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const fmtDate = (iso?: string | null): string => {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso ?? "—";
  }
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
    case "cancelled":
      return "#c74e4e";
    case "void":
      return "#c74e4e";
    case "disputed":
      return "#d4872b";
    case "sealed":
      return "#9b6fd4";
    default:
      return "#8b8fa8";
  }
};

const getIssuerName = (inv: MajikInvoice): string =>
  inv.public?.issuerName ?? inv.invoice?.issuer?.legalName ?? "Unknown Issuer";

const getRecipientName = (inv: MajikInvoice): string =>
  inv.public?.recipientName ??
  inv.invoice?.recipient?.legalName ??
  "Unknown Recipient";

const getInvoiceNumber = (inv: MajikInvoice): string =>
  inv.public?.invoiceNumber ?? inv.id?.slice(0, 12) ?? "—";

const getIssueDate = (inv: MajikInvoice): string | null =>
  inv.public?.issuedAt ??
  inv.issueDate ??
  (inv.invoice as any)?.issueDate ??
  null;

// ---------------------------------------------------------------------------
// Animations
// ---------------------------------------------------------------------------

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(3px); }
  to   { opacity: 1; transform: translateY(0); }
`;

// ---------------------------------------------------------------------------
// Styled components
// ---------------------------------------------------------------------------

const GRID = "20px 1.6fr 1.4fr 1.1fr 1fr 0.9fr";

const TableWrapper = styled.div`
  display: flex;
  flex-direction: column;
  border: 1px solid ${({ theme }) => theme.colors.primary}18;
  border-radius: ${({ theme }) => theme.borders.radius.medium ?? "8px"};
  overflow: hidden;
  background: ${({ theme }) => theme.colors.secondaryBackground};
`;

// ── Section header ────────────────────────────────────────────────────────

const SectionHeader = styled.div<{ $variant: "unique" | "duplicate" }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 9px 14px 8px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.primary}14;
  background: ${({ theme, $variant }) =>
    $variant === "duplicate"
      ? `${theme.colors.primary}08`
      : theme.colors.secondaryBackground};
`;

const SectionTitle = styled.div<{ $variant: "unique" | "duplicate" }>`
  display: flex;
  align-items: center;
  gap: 7px;
  font-family: ${({ theme }) => theme.typography.fonts.semibold};
  font-size: 10px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: ${({ theme, $variant }) =>
    $variant === "duplicate" ? "#d4872b" : theme.colors.primary};
  opacity: ${({ $variant }) => ($variant === "duplicate" ? 1 : 0.75)};
`;

const SectionBadge = styled.span`
  font-family: ${({ theme }) => theme.typography.fonts.numbers};
  font-size: 9.5px;
  padding: 1px 6px;
  border-radius: 9999px;
  background: ${({ theme }) => theme.colors.primarySoft};
  color: ${({ theme }) => theme.colors.primary};
  opacity: 0.85;
`;

const QuickActions = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
`;

const QuickBtn = styled.button`
  background: none;
  border: 1px solid ${({ theme }) => theme.colors.primary}22;
  border-radius: 4px;
  padding: 2px 8px;
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  font-size: 9px;
  letter-spacing: 0.04em;
  color: ${({ theme }) => theme.colors.primary};
  cursor: pointer;
  opacity: 0.7;
  transition:
    opacity 0.12s,
    background 0.12s;

  &:hover {
    opacity: 1;
    background: ${({ theme }) => theme.colors.primarySoft};
  }

  &:active {
    opacity: 0.8;
  }
`;

// ── Column headers ────────────────────────────────────────────────────────

const TableHead = styled.div`
  display: grid;
  grid-template-columns: ${GRID};
  padding: 6px 14px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.primary}12;
  background: ${({ theme }) => theme.colors.secondaryBackground};
  gap: 8px;
`;

const HeadCell = styled.div<{ $align?: "right" | "center" }>`
  font-family: ${({ theme }) => theme.typography.fonts.semibold};
  font-size: 9px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.primary};
  opacity: 0.5;
  text-align: ${({ $align }) => $align ?? "left"};
  display: flex;
  align-items: center;
  justify-content: ${({ $align }) =>
    $align === "right"
      ? "flex-end"
      : $align === "center"
        ? "center"
        : "flex-start"};
`;

// ── Scroll container ──────────────────────────────────────────────────────

const Scroll = styled.div<{ $maxRows?: number }>`
  max-height: ${({ $maxRows = 5 }) => $maxRows * 40}px;
  overflow-y: auto;

  &::-webkit-scrollbar {
    width: 3px;
  }
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  &::-webkit-scrollbar-thumb {
    background: ${({ theme }) => theme.colors.primary}20;
    border-radius: 4px;
  }
`;

// ── Row ───────────────────────────────────────────────────────────────────

const Row = styled.div<{ $checked: boolean }>`
  display: grid;
  grid-template-columns: ${GRID};
  gap: 8px;
  padding: 8px 14px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.primary}07;
  cursor: pointer;
  align-items: center;
  animation: ${fadeIn} 0.12s ease;
  transition: background 0.1s;

  ${({ theme, $checked }) =>
    $checked &&
    css`
      background: ${theme.colors.primarySoft}44;
    `}

  &:hover {
    background: ${({ theme }) => theme.colors.primarySoft}55;
  }

  &:last-child {
    border-bottom: none;
  }
`;

// ── Checkbox cell ─────────────────────────────────────────────────────────

const CheckCell = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${({ theme }) => theme.colors.primary};
`;

// ── Content cells ─────────────────────────────────────────────────────────

const CellText = styled.div<{ $muted?: boolean }>`
  font-size: 11px;
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: ${({ theme, $muted }) =>
    $muted ? theme.colors.textSecondary : theme.colors.textPrimary};
  opacity: ${({ $muted }) => ($muted ? 0.55 : 1)};
`;

const InvNumCell = styled.div`
  font-size: 10.5px;
  font-family: ${({ theme }) => theme.typography.fonts.numbers};
  font-weight: 600;
  color: ${({ theme }) => theme.colors.primary};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const StatusPill = styled.span<{ $color: string }>`
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  font-size: 9px;
  padding: 2px 6px;
  border-radius: 9999px;
  color: ${({ $color }) => $color};
  background: ${({ $color }) => $color}18;
  border: 1px solid ${({ $color }) => $color}28;
  text-transform: capitalize;
  white-space: nowrap;
`;

// ── Empty state ───────────────────────────────────────────────────────────

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 24px 16px;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.4;
  text-align: center;
`;

const EmptyText = styled.div`
  font-family: ${({ theme }) => theme.typography.fonts.light};
  font-size: 11px;
`;

// ── "Select all" master checkbox in header ────────────────────────────────

const MasterCheck = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${({ theme }) => theme.colors.primary};
  opacity: 0.6;
  transition: opacity 0.12s;

  &:hover {
    opacity: 1;
  }
`;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ImportTableVariant = "unique" | "duplicate";

interface ImportInvoiceTableProps {
  /** Which variant — drives the header color + label */
  variant: ImportTableVariant;
  invoices: MajikInvoice[];
  /** Set of invoice ids currently selected (checked) */
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  /** Max visible rows before scrolling (default 5) */
  maxRows?: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const ImportInvoiceTable = memo(function ImportInvoiceTable({
  variant,
  invoices,
  selectedIds,
  onToggle,
  onSelectAll,
  onDeselectAll,
  maxRows = 5,
}: ImportInvoiceTableProps) {
  const allChecked =
    invoices.length > 0 && invoices.every((inv) => selectedIds.has(inv.id));
  const someChecked = invoices.some((inv) => selectedIds.has(inv.id));
  const noneChecked = !someChecked;

  const label =
    variant === "unique" ? "New Invoices" : "Already Exists — Will Overwrite";

  const handleMasterToggle = useCallback(() => {
    if (allChecked) {
      onDeselectAll();
    } else {
      onSelectAll();
    }
  }, [allChecked, onSelectAll, onDeselectAll]);

  const handleRowClick = useCallback(
    (id: string) => {
      onToggle(id);
    },
    [onToggle],
  );

  return (
    <TableWrapper>
      {/* Section header */}
      <SectionHeader $variant={variant}>
        <SectionTitle $variant={variant}>
          {variant === "duplicate" && <WarningIcon size={11} weight="fill" />}
          {label}
          <SectionBadge>{invoices.length}</SectionBadge>
        </SectionTitle>

        <QuickActions>
          {variant === "duplicate" && (
            <QuickBtn onClick={onDeselectAll} disabled={noneChecked}>
              Skip All
            </QuickBtn>
          )}
          <QuickBtn onClick={onSelectAll} disabled={allChecked}>
            Select All
          </QuickBtn>
          <QuickBtn onClick={onDeselectAll} disabled={noneChecked}>
            Deselect All
          </QuickBtn>
        </QuickActions>
      </SectionHeader>

      {/* Column headers */}
      <TableHead>
        <MasterCheck
          onClick={handleMasterToggle}
          title={allChecked ? "Deselect all" : "Select all"}
        >
          {allChecked ? (
            <CheckSquareIcon size={13} weight="fill" />
          ) : someChecked ? (
            <MinusSquareIcon size={13} weight="fill" />
          ) : (
            <SquareIcon size={13} />
          )}
        </MasterCheck>
        <HeadCell>Issuer</HeadCell>
        <HeadCell>Recipient</HeadCell>
        <HeadCell>Invoice #</HeadCell>
        <HeadCell>Issue Date</HeadCell>
        <HeadCell>Status</HeadCell>
      </TableHead>

      {/* Rows */}
      <Scroll $maxRows={maxRows}>
        {invoices.length === 0 ? (
          <EmptyState>
            <InvoiceIcon size={28} weight="thin" />
            <EmptyText>No invoices in this group.</EmptyText>
          </EmptyState>
        ) : (
          invoices.map((inv) => {
            const checked = selectedIds.has(inv.id);
            const issuer = getIssuerName(inv);
            const recipient = getRecipientName(inv);
            const invNum = getInvoiceNumber(inv);
            const issueDate = fmtDate(getIssueDate(inv));
            const status = inv.status ?? inv.invoice?.status ?? null;

            return (
              <Row
                key={inv.id}
                $checked={checked}
                onClick={() => handleRowClick(inv.id)}
                role="checkbox"
                aria-checked={checked}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === " " || e.key === "Enter") {
                    e.preventDefault();
                    handleRowClick(inv.id);
                  }
                }}
              >
                {/* Checkbox */}
                <CheckCell>
                  {checked ? (
                    <CheckSquareIcon size={13} weight="fill" />
                  ) : (
                    <SquareIcon size={13} />
                  )}
                </CheckCell>

                {/* Issuer */}
                <CellText title={issuer}>{issuer}</CellText>

                {/* Recipient */}
                <CellText $muted title={recipient}>
                  {recipient}
                </CellText>

                {/* Invoice # */}
                <InvNumCell title={invNum}>{invNum}</InvNumCell>

                {/* Issue Date */}
                <CellText $muted>{issueDate}</CellText>

                {/* Status */}
                <div>
                  {status ? (
                    <StatusPill $color={statusColor(status)}>
                      {status}
                    </StatusPill>
                  ) : (
                    <CellText $muted>—</CellText>
                  )}
                </div>
              </Row>
            );
          })
        )}
      </Scroll>
    </TableWrapper>
  );
});

ImportInvoiceTable.displayName = "ImportInvoiceTable";
