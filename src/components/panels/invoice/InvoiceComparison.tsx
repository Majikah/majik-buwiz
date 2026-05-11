"use client";

/**
 * InvoiceComparison.tsx
 *
 * Compares two MajikInvoice instances.
 *
 * Same-ID mode ("from → to"):
 *   - Left panel:  properties that changed in the older (from) invoice
 *   - Right panel: properties that changed in the newer (to) invoice
 *   - Bottom panel (bento): properties unchanged across both
 *
 * Different-ID mode (direct comparison):
 *   - Left panel:  summary of invoice A
 *   - Right panel: summary of invoice B
 *   - No bottom panel
 *
 * Source-based override (comparisonSource prop):
 *   When provided, overrides the timestamp-based from/to ordering and renders
 *   explicit source labels (e.g. "From Cloud → To Local") instead of
 *   "older / newer". Works in both same-ID and different-ID modes.
 */

import React, { useMemo } from "react";
import styled, { css, keyframes } from "styled-components";
import {
  ArrowRightIcon,
  ArrowsLeftRightIcon,
  CalendarBlankIcon,
  CheckCircleIcon,
  ClockIcon,
  CurrencyCircleDollarIcon,
  EqualsIcon,
  HashIcon,
  LockKeyIcon,
  MinusCircleIcon,
  PenNibIcon,
  ScalesIcon,
  ShieldCheckIcon,
  SealIcon,
  TagIcon,
  UserIcon,
  WarningCircleIcon,
  ArrowUpIcon,
  DotOutlineIcon,
  FileTextIcon,
  LinkSimpleIcon,
  CloudIcon,
  HardDrivesIcon,
  DeviceMobileIcon,
  DatabaseIcon,
  ArrowsClockwiseIcon,
} from "@phosphor-icons/react";
import { GeneralInvoice, MajikInvoice } from "@majikah/majik-invoice";

// ---------------------------------------------------------------------------
// Source types
// ---------------------------------------------------------------------------

export type InvoiceSource = "cloud" | "local" | "device" | "database";

export interface ComparisonSource {
  /** The source label/type for the left (from) invoice */
  from: InvoiceSource | string;
  /** The source label/type for the right (to) invoice */
  to: InvoiceSource | string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtCurrency(amount: number | undefined, currency: string): string {
  if (amount == null) return "—";
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

function fmtDate(iso: string | undefined | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function fmtDateTime(iso: string | undefined | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function resolveGeneralInvoice(inv: MajikInvoice): GeneralInvoice | null {
  try {
    if (inv.isEncrypted && !inv.hasDecryptedCache) return null;
    return inv.invoice;
  } catch {
    return null;
  }
}

/**
 * Returns a display label and icon for a given source value.
 * Falls back gracefully for arbitrary string sources.
 */
function resolveSourceMeta(source: InvoiceSource | string): {
  label: string;
  Icon: React.FC<{ size: number; weight?: string; color?: string }>;
} {
  switch (source) {
    case "cloud":
      return { label: "Cloud", Icon: CloudIcon as any };
    case "local":
      return { label: "Local", Icon: HardDrivesIcon as any };
    case "device":
      return { label: "Device", Icon: DeviceMobileIcon as any };
    case "database":
      return { label: "Database", Icon: DatabaseIcon as any };
    default: {
      // Capitalise the first character of arbitrary string sources
      const label =
        String(source).charAt(0).toUpperCase() + String(source).slice(1);
      return { label, Icon: ArrowsClockwiseIcon as any };
    }
  }
}

// ---------------------------------------------------------------------------
// Diff engine
// ---------------------------------------------------------------------------

interface FieldEntry {
  key: string;
  label: string;
  fromVal: string;
  toVal: string;
  changed: boolean;
  icon?: React.ReactNode;
}

function buildFieldEntries(
  a: MajikInvoice,
  b: MajikInvoice,
  giA: GeneralInvoice | null,
  giB: GeneralInvoice | null,
): FieldEntry[] {
  const pub = (inv: MajikInvoice) => inv.public;

  const entries: FieldEntry[] = [
    {
      key: "issuerName",
      label: "Issuer",
      fromVal: pub(a).issuerName ?? "—",
      toVal: pub(b).issuerName ?? "—",
      changed: pub(a).issuerName !== pub(b).issuerName,
      icon: <UserIcon size={11} weight="fill" />,
    },
    {
      key: "recipientName",
      label: "Recipient",
      fromVal: pub(a).recipientName ?? "—",
      toVal: pub(b).recipientName ?? "—",
      changed: pub(a).recipientName !== pub(b).recipientName,
      icon: <UserIcon size={11} />,
    },
    {
      key: "invoiceNumber",
      label: "Invoice #",
      fromVal: pub(a).invoiceNumber ?? "—",
      toVal: pub(b).invoiceNumber ?? "—",
      changed: pub(a).invoiceNumber !== pub(b).invoiceNumber,
      icon: <HashIcon size={11} weight="bold" />,
    },
    {
      key: "invoiceType",
      label: "Type",
      fromVal: pub(a).invoiceType.toUpperCase() ?? "—",
      toVal: pub(b).invoiceType.toUpperCase() ?? "—",
      changed: pub(a).invoiceType !== pub(b).invoiceType,
      icon: <FileTextIcon size={11} />,
    },
    {
      key: "status",
      label: "Status",
      fromVal: pub(a).status.toUpperCase() ?? "—",
      toVal: pub(b).status.toUpperCase() ?? "—",
      changed: pub(a).status !== pub(b).status,
      icon: <DotOutlineIcon size={11} weight="fill" />,
    },
    {
      key: "currency",
      label: "Currency",
      fromVal: pub(a).currency ?? "—",
      toVal: pub(b).currency ?? "—",
      changed: pub(a).currency !== pub(b).currency,
      icon: <CurrencyCircleDollarIcon size={11} />,
    },
    {
      key: "totalAmount",
      label: "Grand Total",
      fromVal: fmtCurrency(pub(a).totalAmount, pub(a).currency),
      toVal: fmtCurrency(pub(b).totalAmount, pub(b).currency),
      changed: pub(a).totalAmount !== pub(b).totalAmount,
      icon: <CurrencyCircleDollarIcon size={11} weight="fill" />,
    },
    {
      key: "paymentStatus",
      label: "Payment",
      fromVal: pub(a).paymentStatus.toUpperCase() ?? "—",
      toVal: pub(b).paymentStatus.toUpperCase() ?? "—",
      changed: pub(a).paymentStatus !== pub(b).paymentStatus,
      icon: <CheckCircleIcon size={11} />,
    },
    {
      key: "issuedAt",
      label: "Issue Date",
      fromVal: fmtDate(pub(a).issuedAt),
      toVal: fmtDate(pub(b).issuedAt),
      changed: pub(a).issuedAt !== pub(b).issuedAt,
      icon: <CalendarBlankIcon size={11} />,
    },
    {
      key: "dueDate",
      label: "Due Date",
      fromVal: fmtDate(pub(a).dueDate),
      toVal: fmtDate(pub(b).dueDate),
      changed: pub(a).dueDate !== pub(b).dueDate,
      icon: <CalendarBlankIcon size={11} weight="fill" />,
    },
    {
      key: "mode",
      label: "Mode",
      fromVal: a.mode,
      toVal: b.mode,
      changed: a.mode !== b.mode,
      icon: <LockKeyIcon size={11} />,
    },
    {
      key: "sigCount",
      label: "Signatures",
      fromVal: String(a.signatureCount),
      toVal: String(b.signatureCount),
      changed: a.signatureCount !== b.signatureCount,
      icon: <PenNibIcon size={11} />,
    },
    {
      key: "isSealed",
      label: "Sealed",
      fromVal: a.isSealed ? "Yes" : "No",
      toVal: b.isSealed ? "Yes" : "No",
      changed: a.isSealed !== b.isSealed,
      icon: <SealIcon size={11} />,
    },
  ];

  // GeneralInvoice fields when available
  if (giA && giB) {
    entries.push(
      {
        key: "lineItemCount",
        label: "Line Items",
        fromVal: String(giA.lineItemCount),
        toVal: String(giB.lineItemCount),
        changed: giA.lineItemCount !== giB.lineItemCount,
        icon: <TagIcon size={11} />,
      },
      {
        key: "subtotal",
        label: "Subtotal",
        fromVal: fmtCurrency(giA.subtotalAmount, giA.currency),
        toVal: fmtCurrency(giB.subtotalAmount, giB.currency),
        changed: giA.subtotalAmount !== giB.subtotalAmount,
        icon: <CurrencyCircleDollarIcon size={11} />,
      },
      {
        key: "taxAmount",
        label: "Tax",
        fromVal: fmtCurrency(giA.taxAmount, giA.currency),
        toVal: fmtCurrency(giB.taxAmount, giB.currency),
        changed: giA.taxAmount !== giB.taxAmount,
        icon: <ScalesIcon size={11} />,
      },
      {
        key: "notes",
        label: "Notes",
        fromVal: giA.notes
          ? giA.notes.slice(0, 60) + (giA.notes.length > 60 ? "…" : "")
          : "—",
        toVal: giB.notes
          ? giB.notes.slice(0, 60) + (giB.notes.length > 60 ? "…" : "")
          : "—",
        changed: giA.notes !== giB.notes,
        icon: <FileTextIcon size={11} />,
      },
    );

    const aRefs =
      (giA.references ?? []).map((r) => `${r.type}:${r.number}`).join(", ") ||
      "—";
    const bRefs =
      (giB.references ?? []).map((r) => `${r.type}:${r.number}`).join(", ") ||
      "—";
    entries.push({
      key: "references",
      label: "References",
      fromVal: aRefs,
      toVal: bRefs,
      changed: aRefs !== bRefs,
      icon: <LinkSimpleIcon size={11} />,
    });
  }

  return entries;
}

// ---------------------------------------------------------------------------
// Animations
// ---------------------------------------------------------------------------

const fadeUp = keyframes`
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
`;

const pulse = keyframes`
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.45; }
`;

// ---------------------------------------------------------------------------
// Tokens — these are additional local tokens that sit on top of theme
// ---------------------------------------------------------------------------

const CHANGED_FROM = "#f97316"; // amber-500 — "from" / old value accent
const CHANGED_TO = "#22c55e"; // green-500 — "to"  / new value accent
const SAME_ACCENT = "#6366f1"; // indigo-500 — unchanged accent
const COMPARE_A = "#3b82f6"; // blue-500 — side A in direct compare
const COMPARE_B = "#a855f7"; // purple-500 — side B in direct compare

// Source-mode accent overrides
const SOURCE_FROM = "#f97316"; // amber — "from" source
const SOURCE_TO = "#06b6d4"; // cyan — "to" source

// ---------------------------------------------------------------------------
// Root & layout
// ---------------------------------------------------------------------------

const Root = styled.div`
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: ${({ theme }) => theme.colors.primaryBackground};
  font-family: ${({ theme }) => theme.typography.fonts.regular};
  color: ${({ theme }) => theme.colors.textPrimary};
`;

const TopRow = styled.div`
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  flex: 1;
  min-height: 0;
  overflow: hidden;
`;

const BottomRow = styled.div`
  border-top: 1px solid ${({ theme }) => theme.colors.primary}18;
  animation: ${fadeUp} 340ms cubic-bezier(0.22, 1, 0.36, 1) both;
  animation-delay: 120ms;
`;

// ---------------------------------------------------------------------------
// Divider column
// ---------------------------------------------------------------------------

const DividerCol = styled.div`
  width: 1px;
  background: ${({ theme }) => theme.colors.primary}18;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const DividerBadge = styled.div<{ $mode: "diff" | "compare" | "source" }>`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 30px;
  height: 30px;
  border-radius: 50%;
  border: 1px solid ${({ theme }) => theme.colors.primary}25;
  background: ${({ theme }) => theme.colors.primaryBackground};
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${({ theme }) => theme.colors.textSecondary};
  z-index: 2;
  box-shadow: ${({ theme }) => theme.shadows.small};
`;

// ---------------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------------

const Panel = styled.div<{
  $accent: string;
  $side?: "left" | "right" | "bottom";
}>`
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: ${fadeUp} 300ms cubic-bezier(0.22, 1, 0.36, 1) both;
  animation-delay: ${({ $side }) =>
    $side === "left" ? "0ms" : $side === "right" ? "60ms" : "120ms"};

  border-top: 2px solid ${({ $accent }) => $accent};
`;

const PanelHeader = styled.div<{ $accent: string }>`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 18px 10px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.primary}10;
  flex-shrink: 0;
`;

const PanelTitle = styled.div<{ $accent: string }>`
  font-family: ${({ theme }) => theme.typography.fonts.semibold};
  font-size: 10px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: ${({ $accent }) => $accent};
`;

const PanelMeta = styled.div`
  font-family: ${({ theme }) => theme.typography.fonts.numbers};
  font-size: 10px;
  color: ${({ theme }) => theme.colors.textSecondary};
  margin-left: auto;
`;

const PanelBody = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 10px 18px 14px;

  /* thin scrollbar */
  scrollbar-width: thin;
  scrollbar-color: ${({ theme }) => theme.colors.primary}28 transparent;
  &::-webkit-scrollbar {
    width: 4px;
  }
  &::-webkit-scrollbar-thumb {
    background: ${({ theme }) => theme.colors.primary}28;
    border-radius: 2px;
  }
`;

// ---------------------------------------------------------------------------
// Source badge — shown in the panel header when comparisonSource is set
// ---------------------------------------------------------------------------

const SourceBadge = styled.div<{ $accent: string }>`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  font-size: 9px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  padding: 2px 7px 2px 5px;
  border-radius: ${({ theme }) => theme.borders.radius.rounded};
  background: ${({ $accent }) => $accent}18;
  color: ${({ $accent }) => $accent};
  border: 1px solid ${({ $accent }) => $accent}30;
  flex-shrink: 0;
`;

// ---------------------------------------------------------------------------
// Field rows
// ---------------------------------------------------------------------------

const FieldRow = styled.div<{ $changed?: boolean; $accent?: string }>`
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 7px 0;
  border-bottom: 1px solid ${({ theme }) => theme.colors.primary}08;

  &:last-child {
    border-bottom: none;
  }
`;

const FieldIcon = styled.div<{ $color: string }>`
  color: ${({ $color }) => $color};
  flex-shrink: 0;
  margin-top: 2px;
  opacity: 0.75;
`;

const FieldLabel = styled.div`
  font-family: ${({ theme }) => theme.typography.fonts.light};
  font-size: 10px;
  letter-spacing: 0.03em;
  color: ${({ theme }) => theme.colors.textSecondary};
  min-width: 72px;
  flex-shrink: 0;
  margin-top: 1px;
`;

const FieldValue = styled.div<{ $accent?: string; $changed?: boolean }>`
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  font-size: 12px;
  color: ${({ theme, $accent, $changed }) =>
    $changed && $accent ? $accent : theme.colors.textPrimary};
  word-break: break-word;
  flex: 1;

  ${({ $changed }) =>
    $changed &&
    css`
      font-family: ${({ theme }: any) => theme.typography.fonts.semibold};
    `}
`;

const ChangedDot = styled.span<{ $color: string }>`
  display: inline-block;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: ${({ $color }) => $color};
  margin-right: 5px;
  flex-shrink: 0;
  animation: ${pulse} 2s ease-in-out infinite;
`;

// ---------------------------------------------------------------------------
// Summary strip
// ---------------------------------------------------------------------------

const SummaryStrip = styled.div<{ $accent: string }>`
  margin: 0 18px 14px;
  border-radius: ${({ theme }) => theme.borders.radius.medium};
  background: ${({ $accent }) => $accent}0c;
  border: 1px solid ${({ $accent }) => $accent}28;
  padding: 10px 12px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px 16px;
`;

const SummaryItem = styled.div`
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
`;

const SummaryLabel = styled.span`
  font-family: ${({ theme }) => theme.typography.fonts.light};
  color: ${({ theme }) => theme.colors.textSecondary};
  font-size: 10px;
`;

const SummaryValue = styled.span<{ $accent?: string; $bold?: boolean }>`
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  color: ${({ theme, $accent }) => $accent ?? theme.colors.textPrimary};
  font-size: 11px;
  font-weight: ${({ $bold }) => ($bold ? 600 : 400)};
`;

const WinnerBadge = styled.div<{ $accent: string }>`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-family: ${({ theme }) => theme.typography.fonts.semibold};
  font-size: 9px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  padding: 2px 7px;
  border-radius: ${({ theme }) => theme.borders.radius.rounded};
  background: ${({ $accent }) => $accent}18;
  color: ${({ $accent }) => $accent};
  border: 1px solid ${({ $accent }) => $accent}30;
`;

// ---------------------------------------------------------------------------
// Bottom panel section header
// ---------------------------------------------------------------------------

const SectionHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 18px 6px;
  font-family: ${({ theme }) => theme.typography.fonts.semibold};
  font-size: 9px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.textSecondary};

  &::after {
    content: "";
    flex: 1;
    height: 1px;
    background: ${({ theme }) => theme.colors.primary}12;
  }
`;

const BottomGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 0;
  padding: 0 18px 14px;
`;

const SameFieldRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: ${({ theme }) => theme.borders.radius.small};

  &:hover {
    background: ${({ theme }) => theme.colors.primary}06;
  }
`;

const SameFieldLabel = styled.div`
  font-family: ${({ theme }) => theme.typography.fonts.light};
  font-size: 10px;
  color: ${({ theme }) => theme.colors.textSecondary};
  min-width: 70px;
  flex-shrink: 0;
`;

const SameFieldValue = styled.div`
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textPrimary};
  word-break: break-word;
`;

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 6px;
  color: ${({ theme }) => theme.colors.textSecondary};
  font-size: 12px;
  opacity: 0.5;
  text-align: center;
  padding: 20px;
`;

// ---------------------------------------------------------------------------
// Encrypted notice
// ---------------------------------------------------------------------------

const EncNotice = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 10px;
  color: ${({ theme }) => theme.colors.textSecondary};
  background: ${({ theme }) => theme.colors.primarySoft};
  border: 1px solid ${({ theme }) => theme.colors.primary}22;
  border-radius: ${({ theme }) => theme.borders.radius.small};
  padding: 5px 10px;
  margin: 8px 18px 0;
  flex-shrink: 0;
`;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface InvoiceComparisonProps {
  /** Two MajikInvoice instances to compare */
  invoiceA: MajikInvoice;
  invoiceB: MajikInvoice;
  /**
   * Optional source-based override for the from/to direction.
   *
   * When provided:
   * - `invoiceA` is always treated as the "from" (left) invoice
   * - `invoiceB` is always treated as the "to" (right) invoice
   * - Timestamp-based ordering is ignored entirely
   * - Panel headers display source labels (e.g. "Cloud → Local")
   *   instead of "FROM (older)" / "TO (newer)"
   *
   * Built-in source types: "cloud" | "local" | "device" | "database"
   * Any arbitrary string is also accepted and will be displayed as-is.
   *
   * @example
   * // Show a cloud-to-local sync comparison
   * <InvoiceComparison
   *   invoiceA={cloudInvoice}
   *   invoiceB={localInvoice}
   *   comparisonSource={{ from: "cloud", to: "local" }}
   * />
   */
  comparisonSource?: ComparisonSource;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const InvoiceComparison: React.FC<InvoiceComparisonProps> = ({
  invoiceA,
  invoiceB,
  comparisonSource,
}) => {
  const isSameInvoice = invoiceA.id === invoiceB.id;
  const isSourceMode = comparisonSource != null;

  // Determine from/to:
  // - Source mode: invoiceA is always "from", invoiceB is always "to"
  // - Same-ID mode: order by updatedAt timestamp
  // - Different-ID mode: left=A, right=B (no reordering)
  const [left, right] = useMemo(() => {
    if (isSourceMode) return [invoiceA, invoiceB];

    if (!isSameInvoice) return [invoiceA, invoiceB];

    const tsA = new Date(invoiceA.updatedAt).getTime();
    const tsB = new Date(invoiceB.updatedAt).getTime();
    return tsA <= tsB ? [invoiceA, invoiceB] : [invoiceB, invoiceA];
  }, [invoiceA, invoiceB, isSameInvoice, isSourceMode]);

  const giLeft = useMemo(() => resolveGeneralInvoice(left), [left]);
  const giRight = useMemo(() => resolveGeneralInvoice(right), [right]);

  const fields = useMemo(
    () => buildFieldEntries(left, right, giLeft, giRight),
    [left, right, giLeft, giRight],
  );

  const changedFields = fields.filter((f) => f.changed);
  const sameFields = fields.filter((f) => !f.changed);

  // Quick summary derivations
  const leftAmount = left.public.totalAmount ?? 0;
  const rightAmount = right.public.totalAmount ?? 0;
  const leftCurrency = left.public.currency ?? "PHP";

  const leftIsNewer =
    new Date(left.updatedAt).getTime() >= new Date(right.updatedAt).getTime();
  const leftIsGreater = leftAmount >= rightAmount;

  // Accent colours
  const leftAccent = isSourceMode
    ? SOURCE_FROM
    : isSameInvoice
      ? CHANGED_FROM
      : COMPARE_A;
  const rightAccent = isSourceMode
    ? SOURCE_TO
    : isSameInvoice
      ? CHANGED_TO
      : COMPARE_B;

  // Panel labels
  const fromMeta = isSourceMode
    ? resolveSourceMeta(comparisonSource!.from)
    : null;
  const toMeta = isSourceMode ? resolveSourceMeta(comparisonSource!.to) : null;

  const leftTitle = isSourceMode
    ? `From ${fromMeta!.label}`
    : isSameInvoice
      ? "FROM (older)"
      : "Invoice A";

  const rightTitle = isSourceMode
    ? `To ${toMeta!.label}`
    : isSameInvoice
      ? "TO (newer)"
      : "Invoice B";

  // ── Render field list ────────────────────────────────────────────────────
  const renderFields = (
    side: "left" | "right",
    entries: FieldEntry[],
    accent: string,
  ) => {
    const valKey = side === "left" ? "fromVal" : "toVal";
    // In source mode, show all changed fields (same behaviour as same-ID diff mode)
    const displayEntries =
      isSameInvoice || isSourceMode ? changedFields : entries;

    if (displayEntries.length === 0) {
      return (
        <EmptyState>
          <CheckCircleIcon size={22} />
          No changes detected
        </EmptyState>
      );
    }

    return displayEntries.map((f) => (
      <FieldRow key={f.key} $changed={f.changed}>
        <FieldIcon $color={accent}>{f.icon}</FieldIcon>
        <FieldLabel>{f.label}</FieldLabel>
        <FieldValue
          $accent={accent}
          $changed={f.changed && (isSameInvoice || isSourceMode)}
        >
          {f.changed && (isSameInvoice || isSourceMode) && (
            <ChangedDot $color={accent} />
          )}
          {f[valKey]}
        </FieldValue>
      </FieldRow>
    ));
  };

  // ── Summary strip ────────────────────────────────────────────────────────
  const renderSummary = (
    inv: MajikInvoice,
    isLeft: boolean,
    accent: string,
  ) => {
    const isNewer = isLeft ? leftIsNewer : !leftIsNewer;
    const isGreater = isLeft ? leftIsGreater : !leftIsGreater;
    const amountDiff = Math.abs(leftAmount - rightAmount);

    return (
      <SummaryStrip $accent={accent}>
        {/* Recency — hidden in source mode since ordering is explicit */}
        {!isSameInvoice && !isSourceMode && (
          <SummaryItem>
            <ClockIcon size={11} weight="fill" color={accent} />
            <SummaryLabel>Updated</SummaryLabel>
            <SummaryValue>{fmtDateTime(inv.updatedAt)}</SummaryValue>
            {isNewer && (
              <WinnerBadge $accent={accent}>
                <ArrowUpIcon size={8} weight="bold" /> Newer
              </WinnerBadge>
            )}
          </SummaryItem>
        )}

        {/* In source mode, show the timestamp but without a "Newer" badge */}
        {isSourceMode && (
          <SummaryItem>
            <ClockIcon size={11} weight="fill" color={accent} />
            <SummaryLabel>Updated</SummaryLabel>
            <SummaryValue>{fmtDateTime(inv.updatedAt)}</SummaryValue>
          </SummaryItem>
        )}

        {/* Amount */}
        <SummaryItem>
          <CurrencyCircleDollarIcon size={11} weight="fill" color={accent} />
          <SummaryLabel>Total</SummaryLabel>
          <SummaryValue $bold>
            {fmtCurrency(inv.public.totalAmount, inv.public.currency)}
          </SummaryValue>
          {isGreater && leftAmount !== rightAmount && (
            <WinnerBadge $accent={accent}>
              <ArrowUpIcon size={8} weight="bold" /> Higher
            </WinnerBadge>
          )}
        </SummaryItem>

        {/* Amount delta — for direct compare and source mode */}
        {(!isSameInvoice || isSourceMode) &&
          leftAmount !== rightAmount &&
          isLeft && (
            <SummaryItem>
              <ScalesIcon size={11} color={accent} />
              <SummaryLabel>Δ amount</SummaryLabel>
              <SummaryValue $accent={accent}>
                {fmtCurrency(amountDiff, leftCurrency)}
              </SummaryValue>
            </SummaryItem>
          )}

        {/* Signatures */}
        <SummaryItem>
          <PenNibIcon size={11} color={accent} />
          <SummaryLabel>Sigs</SummaryLabel>
          <SummaryValue>{inv.signatureCount}</SummaryValue>
        </SummaryItem>

        {/* Seal */}
        <SummaryItem>
          <SealIcon size={11} color={accent} />
          <SummaryLabel>Sealed</SummaryLabel>
          <SummaryValue>{inv.isSealed ? "Yes" : "No"}</SummaryValue>
          {inv.isSealed && (
            <WinnerBadge $accent={accent}>
              <ShieldCheckIcon size={8} weight="fill" /> Finalized
            </WinnerBadge>
          )}
        </SummaryItem>

        {/* Encryption */}
        <SummaryItem>
          <LockKeyIcon size={11} color={accent} />
          <SummaryLabel>Mode</SummaryLabel>
          <SummaryValue>
            {inv.isEncrypted ? "Encrypted" : "Plaintext"}
          </SummaryValue>
        </SummaryItem>

        {/* Status */}
        <SummaryItem>
          <DotOutlineIcon size={11} weight="fill" color={accent} />
          <SummaryLabel>Invoice</SummaryLabel>
          <SummaryValue>{inv.public.status ?? "—"}</SummaryValue>
        </SummaryItem>

        {/* Payment */}
        <SummaryItem>
          <CheckCircleIcon
            size={11}
            weight={inv.public.paymentStatus === "settled" ? "fill" : "regular"}
            color={accent}
          />
          <SummaryLabel>Payment</SummaryLabel>
          <SummaryValue>{inv.public.paymentStatus ?? "—"}</SummaryValue>
        </SummaryItem>
      </SummaryStrip>
    );
  };

  // ── Divider icon ─────────────────────────────────────────────────────────
  const dividerMode = isSourceMode
    ? "source"
    : isSameInvoice
      ? "diff"
      : "compare";

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Root>
      <TopRow>
        {/* ── Left panel ── */}
        <Panel $accent={leftAccent} $side="left">
          <PanelHeader $accent={leftAccent}>
            {isSourceMode ? (
              // Render the resolved source icon
              React.createElement(fromMeta!.Icon, {
                size: 12,
                weight: "fill",
                color: leftAccent,
              })
            ) : isSameInvoice ? (
              <MinusCircleIcon size={12} color={leftAccent} weight="fill" />
            ) : (
              <ArrowsLeftRightIcon size={12} color={leftAccent} />
            )}
            <PanelTitle $accent={leftAccent}>{leftTitle}</PanelTitle>

            {/* Source badge rendered alongside the title */}
            {isSourceMode && (
              <SourceBadge $accent={leftAccent}>
                {React.createElement(fromMeta!.Icon, { size: 8 })}
                {fromMeta!.label}
              </SourceBadge>
            )}

            <PanelMeta>{fmtDateTime(left.updatedAt)}</PanelMeta>
          </PanelHeader>

          {left.isEncrypted && !left.hasDecryptedCache && (
            <EncNotice>
              <LockKeyIcon size={10} />
              Encrypted — some fields unavailable without decryption
            </EncNotice>
          )}

          {renderSummary(left, true, leftAccent)}

          <PanelBody>{renderFields("left", fields, leftAccent)}</PanelBody>
        </Panel>

        {/* ── Centre divider ── */}
        <DividerCol>
          <DividerBadge $mode={dividerMode}>
            <ArrowRightIcon size={12} weight="bold" />
          </DividerBadge>
        </DividerCol>

        {/* ── Right panel ── */}
        <Panel $accent={rightAccent} $side="right">
          <PanelHeader $accent={rightAccent}>
            {isSourceMode ? (
              React.createElement(toMeta!.Icon, {
                size: 12,
                weight: "fill",
                color: rightAccent,
              })
            ) : isSameInvoice ? (
              <CheckCircleIcon size={12} color={rightAccent} weight="fill" />
            ) : (
              <ArrowsLeftRightIcon size={12} color={rightAccent} />
            )}
            <PanelTitle $accent={rightAccent}>{rightTitle}</PanelTitle>

            {isSourceMode && (
              <SourceBadge $accent={rightAccent}>
                {React.createElement(toMeta!.Icon, { size: 8 })}
                {toMeta!.label}
              </SourceBadge>
            )}

            <PanelMeta>{fmtDateTime(right.updatedAt)}</PanelMeta>
          </PanelHeader>

          {right.isEncrypted && !right.hasDecryptedCache && (
            <EncNotice>
              <LockKeyIcon size={10} />
              Encrypted — some fields unavailable without decryption
            </EncNotice>
          )}

          {renderSummary(right, false, rightAccent)}

          <PanelBody>{renderFields("right", fields, rightAccent)}</PanelBody>
        </Panel>
      </TopRow>

      {/* ── Bottom panel — same invoice or source mode ── */}
      {(isSameInvoice || isSourceMode) && (
        <BottomRow>
          <Panel $accent={SAME_ACCENT} $side="bottom">
            <PanelHeader $accent={SAME_ACCENT}>
              <EqualsIcon size={12} color={SAME_ACCENT} weight="bold" />
              <PanelTitle $accent={SAME_ACCENT}>
                Unchanged — {sameFields.length} shared propert
                {sameFields.length === 1 ? "y" : "ies"}
              </PanelTitle>
              <PanelMeta>
                {changedFields.length} changed · id: {left.id.slice(0, 12)}…
              </PanelMeta>
            </PanelHeader>

            {sameFields.length === 0 ? (
              <EmptyState style={{ height: 60 }}>
                <WarningCircleIcon size={16} />
                All properties differ between versions
              </EmptyState>
            ) : (
              <>
                <SectionHeader>
                  <EqualsIcon size={9} weight="bold" color={SAME_ACCENT} />
                  Shared values
                </SectionHeader>
                <BottomGrid>
                  {sameFields.map((f) => (
                    <SameFieldRow key={f.key}>
                      <FieldIcon $color={SAME_ACCENT}>{f.icon}</FieldIcon>
                      <SameFieldLabel>{f.label}</SameFieldLabel>
                      <SameFieldValue>{f.fromVal}</SameFieldValue>
                    </SameFieldRow>
                  ))}
                </BottomGrid>
              </>
            )}
          </Panel>
        </BottomRow>
      )}
    </Root>
  );
};

export default InvoiceComparison;
