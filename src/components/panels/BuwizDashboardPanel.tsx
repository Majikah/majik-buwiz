/**
 * @file BuwizDashboardPanel.tsx
 *
 * Main invoice analytics dashboard for Majik Buwiz.
 * Displays revenue, tax, payment, and invoice health metrics
 * for a selected time period across all invoices.
 *
 * Dependencies:
 *  - styled-components
 *  - @phosphor-icons/react (suffix-Icon convention)
 *  - @majikah/majik-invoice (MajikInvoice, GeneralInvoice types)
 *  - ./PeriodFilter
 *  - react-hot-toast (for copy feedback)
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import styled, { keyframes } from "styled-components";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  BankIcon,
  CalendarBlankIcon,
  ChartBarIcon,
  ChartLineUpIcon,
  ChartPieSliceIcon,
  CheckCircleIcon,
  ClockCountdownIcon,
  CopyIcon,
  CurrencyCircleDollarIcon,
  FilePdfIcon,
  FileTextIcon,
  FunnelIcon,
  InfoIcon,
  LockIcon,
  MinusCircleIcon,
  PercentIcon,
  ReceiptIcon,
  SealWarningIcon,
  UsersIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";

import { MajikInvoice } from "@majikah/majik-invoice";
import {
  DateMode,
  DateRange,
  PeriodFilter,
  PresetKey,
} from "@/components/functional/PeriodFilter";
import { MajikBuwizDatabase } from "../majik-context-wrapper/majik-buwiz-database";
import GuideHelper from "../functional/GuideHelper";
import { toast } from "sonner";
import { BIRReturnType, getBIRFilingWindow } from "@/SDK/bir-tax-period";
import { downloadMajikBuwizSummaryPDF } from "./invoice/MajikBuwizSummaryDocument";
import { CtrlBtn } from "@/globals/buttons";
import DynamicPlaceholder from "../foundations/DynamicPlaceholder";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function startOfYear(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), 0, 1);
}

function inRange(
  inv: MajikInvoice,
  range: DateRange,
  dateMode: DateMode = "issued",
  birReturnType: BIRReturnType = "income_quarterly",
): boolean {
  let raw: string | null = null;
  try {
    raw = inv.invoice.issueDate;
  } catch {
    raw = inv.public.issuedAt ?? null;
  }
  if (!raw) return false;

  if (dateMode === "issued") {
    // Original behaviour: check if issue date is within the selected range.
    const d = new Date(raw);
    return d >= range.from && d <= range.to;
  }

  // Filing mode: derive the BIR filing window for this invoice's issue date,
  // then check if that filing window *overlaps* the selected range.
  // An invoice is "in scope" for a filing period if its issue date falls
  // inside the BIR period that corresponds to the selected range.
  // Simplest correct approach: check if the invoice's issue date falls
  // within the filing window that the SELECTED range represents.
  // i.e., the user picked "Q3 2024 (filing)" → range = { Jul 1, Sep 30 }
  // We want invoices whose issue date falls in Jul–Sep 2024.
  // getBIRFilingWindow tells us which quarter the invoice BELONGS to.
  // So: invoice is included if its BIR filing window overlaps the selected range.
  const issueDate = new Date(raw);
  const invoiceFilingWindow = getBIRFilingWindow(issueDate, birReturnType);

  // Overlap check: two ranges overlap if A.from <= B.to && A.to >= B.from
  return (
    invoiceFilingWindow.from <= range.to && invoiceFilingWindow.to >= range.from
  );
}

function fmtCurrency(amount: number, currency = "PHP"): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function fmtNumber(n: number): string {
  return new Intl.NumberFormat("en-PH").format(n);
}

function fmtPercent(n: number): string {
  return `${(n * 100).toFixed(2)}%`;
}

function fmtDays(n: number | null): string {
  if (n === null) return "—";
  return `${n.toFixed(1)}d`;
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard", {
      duration: 1800,
      style: { fontSize: 12 },
    });
  } catch {
    toast.error("Copy failed");
  }
}

// ---------------------------------------------------------------------------
// Animations
// ---------------------------------------------------------------------------

const fadeUp = keyframes`
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0);   }
`;

// ---------------------------------------------------------------------------
// Root layout
// ---------------------------------------------------------------------------

const Root = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  background: ${({ theme }) => theme.colors.primaryBackground};
  color: ${({ theme }) => theme.colors.textPrimary};
`;

// ── Header ─────────────────────────────────────────────────────────────────
const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  padding: 14px 20px 13px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.secondaryBackground};
  flex-shrink: 0;
`;

const HeaderLeft = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const PanelTitle = styled.h2`
  font-size: 14px;
  font-weight: 700;
  letter-spacing: -0.01em;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 7px;
  color: ${({ theme }) => theme.colors.textPrimary};
`;

const PanelSubtitle = styled.p`
  font-family: "Fira Mono", "JetBrains Mono", monospace;
  font-size: 10px;
  color: ${({ theme }) => theme.colors.textSecondary};
  margin: 0;
  opacity: 0.5;
  letter-spacing: 0.03em;
`;

// ── Scroll body ────────────────────────────────────────────────────────────
const ScrollBody = styled.div`
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 28px;
  overflow-y: auto;
  padding-bottom: 3em;

  &::-webkit-scrollbar {
    width: 5px;
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

// ── Section ────────────────────────────────────────────────────────────────
const Section = styled.div<{ $delay?: number }>`
  display: flex;
  flex-direction: column;
  gap: 10px;
  animation: ${fadeUp} 0.3s ease both;
  animation-delay: ${({ $delay = 0 }) => $delay}ms;
`;

const SectionLabel = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  font-family: "Fira Mono", "JetBrains Mono", monospace;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.55;
`;

const CardGrid = styled.div<{ $cols?: number }>`
  display: grid;
  grid-template-columns: repeat(${({ $cols = 4 }) => $cols}, minmax(0, 1fr));
  gap: 10px;

  @media (max-width: 1100px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  @media (max-width: 640px) {
    grid-template-columns: repeat(1, minmax(0, 1fr));
  }
`;

// ── Stat Card ──────────────────────────────────────────────────────────────
const Card = styled.div<{
  $accent?: string;
  $variant?: "default" | "danger" | "success" | "warn" | "muted";
}>`
  position: relative;
  border-radius: ${({ theme }) => theme.borders.radius.medium};
  background: ${({ theme }) => theme.colors.secondaryBackground};
  border: 1px solid ${({ theme }) => theme.colors.primary}14;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow: visible;
  transition: border-color 0.15s;
  z-index: 0;

  &:hover {
    z-index: 10;
    border-color: ${({ theme }) => theme.colors.primary}33;
  }

  &::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 2px;
    border-radius: ${({ theme }) => theme.borders.radius.medium}
      ${({ theme }) => theme.borders.radius.medium} 0 0;
    background: ${({ $accent, $variant, theme }) => {
      if ($accent) return $accent;
      switch ($variant) {
        case "danger":
          return "var(--color-error, #c74e4e)";
        case "success":
          return "#3aaf7a";
        case "warn":
          return "#d4860a";
        case "muted":
          return `${theme.colors.textSecondary}44`;
        default:
          return theme.gradients.primary;
      }
    }};
  }
`;

const CardHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const CardIconWrap = styled.div<{ $variant?: string }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: ${({ theme }) => theme.borders.radius.small};
  background: ${({ $variant, theme }) => {
    switch ($variant) {
      case "danger":
        return "rgba(199, 78, 78, 0.12)";
      case "success":
        return "rgba(58, 175, 122, 0.12)";
      case "warn":
        return "rgba(212, 134, 10, 0.12)";
      case "muted":
        return `${theme.colors.textSecondary}14`;
      default:
        return theme.colors.primarySoft;
    }
  }};
  color: ${({ $variant, theme }) => {
    switch ($variant) {
      case "danger":
        return "var(--color-error, #c74e4e)";
      case "success":
        return "#3aaf7a";
      case "warn":
        return "#d4860a";
      case "muted":
        return theme.colors.textSecondary;
      default:
        return theme.colors.primary;
    }
  }};
  flex-shrink: 0;
`;

const CardLabel = styled.div`
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.75;
  display: flex;
  align-items: center;
  gap: 4px;
`;

// ── Copyable value ─────────────────────────────────────────────────────────
const CardValueWrap = styled.div`
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  width: fit-content;

  &:hover .copy-hint {
    opacity: 1;
  }
`;

const CardValue = styled.div`
  font-family: "Fira Mono", "JetBrains Mono", monospace;
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: ${({ theme }) => theme.colors.textPrimary};
  line-height: 1;
`;

const CopyHint = styled.span`
  opacity: 0;
  transition: opacity 0.15s;
  color: ${({ theme }) => theme.colors.textSecondary};
  display: inline-flex;
  align-items: center;
`;

const CardSub = styled.div`
  font-family: ${({ theme }) => theme.typography.fonts.light};
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.6;
`;

// ── Tooltip ────────────────────────────────────────────────────────────────
const TooltipWrap = styled.div`
  position: relative;
  display: inline-flex;
  align-items: center;
`;

const TooltipBubble = styled.div`
  position: absolute;
  top: calc(100% + 7px);
  left: 50%;
  transform: translateX(-95%);
  background: ${({ theme }) => theme.colors.primaryBackground};
  border: 1px solid ${({ theme }) => theme.colors.primary}28;
  border-radius: ${({ theme }) => theme.borders.radius.small};
  padding: 8px 11px;
  font-family: ${({ theme }) => theme.typography.fonts.light};
  font-size: 11px;
  line-height: 1.55;
  color: ${({ theme }) => theme.colors.textPrimary};
  width: 220px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
  z-index: 300;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.14s;

  ${TooltipWrap}:hover & {
    opacity: 1;
  }
`;

const InfoBtn = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border: none;
  background: transparent;
  color: ${({ theme }) => theme.colors.textSecondary};
  cursor: default;
  opacity: 0.45;
  padding: 0;

  &:hover {
    opacity: 0.85;
  }
`;

// ── Status breakdown ───────────────────────────────────────────────────────
const StatusRow = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 8px;
`;

const StatusPill = styled.div<{ $color: string }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 9px 12px;
  border-radius: ${({ theme }) => theme.borders.radius.medium};
  background: ${({ theme }) => theme.colors.secondaryBackground};
  border: 1px solid ${({ $color }) => $color}28;
`;

const StatusDot = styled.span<{ $color: string }>`
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: ${({ $color }) => $color};
  flex-shrink: 0;
`;

const StatusName = styled.span`
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textPrimary};
  flex: 1;
  margin-left: 7px;
  text-transform: capitalize;
`;

const StatusCount = styled.span`
  font-family: "Fira Mono", "JetBrains Mono", monospace;
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textSecondary};
`;

// ── Chart placeholder ──────────────────────────────────────────────────────
const ChartPlaceholder = styled.div<{ $height?: number }>`
  height: ${({ $height = 160 }) => $height}px;
  border-radius: ${({ theme }) => theme.borders.radius.medium};
  background: ${({ theme }) => theme.colors.secondaryBackground};
  border: 1px dashed ${({ theme }) => theme.colors.primary}22;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.5;
  font-size: 12px;
  font-family: ${({ theme }) => theme.typography.fonts.light};
`;

// ── Top recipients ─────────────────────────────────────────────────────────
const RecipientTable = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const RecipientRow = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`;

const RecipientBar = styled.div<{ $pct: number }>`
  flex: 1;
  height: 5px;
  border-radius: 99px;
  background: ${({ theme }) => theme.colors.primarySoft};
  overflow: hidden;

  &::after {
    content: "";
    display: block;
    height: 100%;
    width: ${({ $pct }) => $pct}%;
    background: ${({ theme }) => theme.gradients.primary};
    border-radius: 99px;
    transition: width 0.5s ease;
  }
`;

const RecipientMeta = styled.div`
  display: flex;
  flex-direction: column;
  min-width: 130px;
`;

const RecipientName = styled.span`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textPrimary};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const RecipientSub = styled.span`
  font-family: "Fira Mono", "JetBrains Mono", monospace;
  font-size: 10px;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.6;
`;

const RecipientAmt = styled.span`
  font-family: "Fira Mono", "JetBrains Mono", monospace;
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textSecondary};
  flex-shrink: 0;
`;

// ── Tax / data table ────────────────────────────────────────────────────────
const DataTable = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0;
  border-radius: ${({ theme }) => theme.borders.radius.medium};
  overflow: hidden;
  border: 1px solid ${({ theme }) => theme.colors.primary}14;
`;

const DataTableHeader = styled.div<{ $cols: string }>`
  display: grid;
  grid-template-columns: ${({ $cols }) => $cols};
  padding: 8px 14px;
  background: ${({ theme }) => theme.colors.secondaryBackground};
  font-family: "Fira Mono", "JetBrains Mono", monospace;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.7;
  border-bottom: 1px solid ${({ theme }) => theme.colors.primary}14;
`;

const DataTableRow = styled.div<{ $alt?: boolean; $cols: string }>`
  display: grid;
  grid-template-columns: ${({ $cols }) => $cols};
  padding: 10px 14px;
  background: ${({ $alt, theme }) =>
    $alt ? `${theme.colors.primary}06` : theme.colors.primaryBackground};
  font-size: 12px;
  transition: background 0.12s;

  &:hover {
    background: ${({ theme }) => theme.colors.primarySoft};
  }
`;

const DataCell = styled.span<{
  $mono?: boolean;
  $right?: boolean;
  $muted?: boolean;
}>`
  font-family: ${({ $mono }) =>
    $mono ? '"Fira Mono", "JetBrains Mono", monospace' : "inherit"};
  font-size: ${({ $mono }) => ($mono ? "11px" : "12px")};
  color: ${({ $muted, theme }) =>
    $muted ? theme.colors.textSecondary : theme.colors.textPrimary};
  text-align: ${({ $right }) => ($right ? "right" : "left")};
  opacity: ${({ $muted }) => ($muted ? 0.65 : 1)};
`;

// ── Highlight banner (for alerts like overdue / due soon) ───────────────────
const AlertBanner = styled.div<{ $variant: "danger" | "warn" }>`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  border-radius: ${({ theme }) => theme.borders.radius.medium};
  background: ${({ $variant }) =>
    $variant === "danger" ? "rgba(199,78,78,0.08)" : "rgba(212,134,10,0.08)"};
  border: 1px solid
    ${({ $variant }) =>
      $variant === "danger" ? "rgba(199,78,78,0.25)" : "rgba(212,134,10,0.25)"};
  font-size: 12px;
  color: ${({ $variant }) => ($variant === "danger" ? "#c74e4e" : "#d4860a")};
`;

// ── Wide two-col layout ────────────────────────────────────────────────────
const TwoCol = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;

  @media (max-width: 860px) {
    grid-template-columns: 1fr;
  }
`;

// ── Empty state ────────────────────────────────────────────────────────────
const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  gap: 12px;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.5;
  font-size: 13px;
  font-family: ${({ theme }) => theme.typography.fonts.light};
  text-align: center;
`;

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const Tooltip: React.FC<{ tip: string }> = ({ tip }) => (
  <TooltipWrap>
    <InfoBtn type="button" aria-label="Info">
      <InfoIcon size={13} />
    </InfoBtn>
    <TooltipBubble>{tip}</TooltipBubble>
  </TooltipWrap>
);

interface CopyValueProps {
  value: string;
  children: React.ReactNode;
  color?: string;
  dataPrivate?: boolean;
}

const CopyValue: React.FC<CopyValueProps> = ({
  value,
  children,
  color,
  dataPrivate = true,
}) => (
  <CardValueWrap
    onClick={() => copyToClipboard(value)}
    title="Click to copy"
    role="button"
    tabIndex={0}
    onKeyDown={(e) => e.key === "Enter" && copyToClipboard(value)}
    data-private={dataPrivate ? "true" : undefined}
  >
    <CardValue style={color ? { color } : undefined}>{children}</CardValue>
    <CopyHint className="copy-hint">
      <CopyIcon size={13} />
    </CopyHint>
  </CardValueWrap>
);

const STATUS_COLORS: Record<string, string> = {
  draft: "#7a8bad",
  issued: "#4a9ad4",
  sent: "#4a9ad4",
  viewed: "#8b6cd8",
  partial: "#d4860a",
  paid: "#3aaf7a",
  overdue: "#c74e4e",
  void: "#556070",
  disputed: "#c74e4e",
};

function statusColor(s: string): string {
  return STATUS_COLORS[s] ?? "#7a8bad";
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BuwizDashboardPanelProps {
  majik: MajikBuwizDatabase;
  currency?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const BuwizDashboardPanel: React.FC<BuwizDashboardPanelProps> = ({
  majik,
  currency = "PHP",
}) => {
  const [range, setRange] = useState<DateRange>({
    from: startOfYear(),
    to: new Date(),
  });
  const [activePreset, setActivePreset] = useState<PresetKey>("annual");
  const [dateMode, setDateMode] = useState<DateMode>("issued");
  const [birReturnType, setBirReturnType] =
    useState<BIRReturnType>("income_quarterly");

  const [invoices, setInvoices] = useState<MajikInvoice[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [, setError] = useState<string | null>(null);

  const [isExporting, setIsExporting] = useState<boolean>(false);

  const loadInvoices = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const currentKey = majik.getActiveAccountKey();

      if (currentKey?.isLocked) {
        const invoices = majik.listInvoices();
        setInvoices(invoices);
      } else {
        const { decrypted } = await majik.decryptCachedInvoices();
        setInvoices(decrypted);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load invoices");
    } finally {
      setLoading(false);
    }
  }, [majik]);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  // ── Listen for account changes ─────────────────────────────────────────────
  useEffect(() => {
    if (!majik) return;

    const handler = async () => {
      await loadInvoices();
    };

    majik.on("unlock", handler);

    return () => {
      majik.off("unlock", handler);
    };
  }, [majik, loadInvoices]);

  const handlePeriodChange = useCallback((r: DateRange, preset: PresetKey) => {
    setRange(r);
    setActivePreset(preset);
  }, []);

  const stats = useMemo(() => {
    const filtered = invoices.filter((inv) =>
      inRange(inv, range, dateMode, birReturnType),
    );
    const computed = MajikInvoice.computeDashboardStats(filtered, {
      dueSoonDays: 7,
    });
    return {
      ...computed,
      unpaidAmount: computed.unpaidAmount ?? computed.totalOutstanding ?? 0,
    };
  }, [invoices, range, dateMode, birReturnType]);

  const maxRecipient = stats.topRecipients[0]?.totalAmount ?? 1;
  const collectionRate =
    stats.totalAmount > 0 ? stats.paidAmount / stats.totalAmount : 0;
  const overdueRate =
    stats.totalAmount > 0 ? stats.overdueAmount / stats.totalAmount : 0;

  const TABLE_COLS_4 = "1fr 100px 110px 110px";
  const TABLE_COLS_STATUS = "1fr 80px 120px 110px";

  const handleExportPDF = async () => {
    const run = async (): Promise<string> => {
      setIsExporting(true);
      const defaults = await majik.getInvoiceDefaults();
      const currentAccount = majik.getActiveAccount();

      if (!currentAccount) throw new Error("Please setup your account first");

      await downloadMajikBuwizSummaryPDF({
        stats: stats,
        business: {
          name: defaults?.issuer?.legalName || currentAccount.meta.legalName,
          tagline: defaults?.tagline,
          tin: defaults?.issuer?.tin || currentAccount.meta.tin,
        },
        period: { from: range.from, to: range.to, label: "Period" },
      });

      return "Invoice Summary PDF exported successfully";
    };

    toast.promise(run(), {
      loading: `Generating Summary Report…`,
      success: (m) => {
        return m;
      },
      error: (err) =>
        err instanceof Error ? err.message : "PDF export failed.",
      finally: () => setIsExporting(false),
    });
  };

  if (loading) {
    return (
      <DynamicPlaceholder loading={loading}>
        Loading invoices…
      </DynamicPlaceholder>
    );
  }

  return (
    <Root id="section-dashboard">
      <GuideHelper docsPath="https://majikah.solutions/products/majik-buwiz/docs/dashboard" />

      {/* ── Header ── */}
      <Header>
        <HeaderLeft>
          <PanelTitle>
            <ChartLineUpIcon size={16} weight="duotone" />
            Dashboard Overview
          </PanelTitle>
          <PanelSubtitle data-private="true">
            {stats.total} invoice{stats.total !== 1 ? "s" : ""} in period ·{" "}
            {fmtCurrency(stats.totalAmount, currency)} gross
            {stats.oldestInvoiceDate && stats.newestInvoiceDate && (
              <>
                {" "}
                · {fmtDate(stats.oldestInvoiceDate)} –{" "}
                {fmtDate(stats.newestInvoiceDate)}
              </>
            )}
          </PanelSubtitle>
          <CtrlBtn onClick={handleExportPDF} disabled={isExporting}>
            <FilePdfIcon size={13} />
            {isExporting ? "Exporting…" : "Export PDF"}
          </CtrlBtn>
        </HeaderLeft>

        <PeriodFilter
          value={range}
          activePreset={activePreset}
          dateMode={dateMode}
          birReturnType={birReturnType}
          onChange={handlePeriodChange}
          onDateModeChange={setDateMode}
          onBirReturnTypeChange={setBirReturnType}
        />
      </Header>

      {/* ── Body ── */}
      <ScrollBody>
        {stats.total === 0 ? (
          <EmptyState>
            <ReceiptIcon size={40} />
            <div>No invoices in this period.</div>
            <div style={{ fontSize: 11, opacity: 0.7 }}>
              Try adjusting the date range or creating new invoices.
            </div>
          </EmptyState>
        ) : (
          <>
            {/* ── Alerts: overdue + due soon ── */}
            {(stats.overdueCount > 0 || stats.dueSoonCount > 0) && (
              <Section $delay={0}>
                <SectionLabel>
                  <WarningCircleIcon size={12} />
                  Attention Required
                </SectionLabel>
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 8 }}
                >
                  {stats.overdueCount > 0 && (
                    <AlertBanner $variant="danger">
                      <WarningCircleIcon size={16} weight="duotone" />
                      <span>
                        <strong>{stats.overdueCount}</strong> overdue invoice
                        {stats.overdueCount !== 1 ? "s" : ""} totalling{" "}
                        <strong data-private="true">
                          {fmtCurrency(stats.overdueAmount, currency)}
                        </strong>{" "}
                        — immediate follow-up recommended.
                      </span>
                    </AlertBanner>
                  )}
                  {stats.dueSoonCount > 0 && (
                    <AlertBanner $variant="warn">
                      <ClockCountdownIcon size={16} weight="duotone" />
                      <span>
                        <strong>{stats.dueSoonCount}</strong> invoice
                        {stats.dueSoonCount !== 1 ? "s" : ""} due within the
                        next 7 days.
                      </span>
                    </AlertBanner>
                  )}
                </div>
              </Section>
            )}

            {/* ── Revenue at a Glance ── */}
            <Section $delay={40}>
              <SectionLabel>
                <CurrencyCircleDollarIcon size={12} />
                Revenue at a Glance
              </SectionLabel>

              <CardGrid $cols={4}>
                {/* Gross Revenue */}
                <Card>
                  <CardHeader>
                    <CardIconWrap>
                      <ChartLineUpIcon size={15} weight="duotone" />
                    </CardIconWrap>
                    <CardLabel>
                      Gross Revenue
                      <Tooltip tip="Total invoice value (grand totals) for all invoices in the selected period. Includes tax." />
                    </CardLabel>
                  </CardHeader>
                  <CopyValue value={fmtCurrency(stats.totalAmount, currency)}>
                    {fmtCurrency(stats.totalAmount, currency)}
                  </CopyValue>
                  <CardSub>{fmtNumber(stats.total)} invoices</CardSub>
                </Card>

                {/* Collected */}
                <Card $variant="success">
                  <CardHeader>
                    <CardIconWrap $variant="success">
                      <CheckCircleIcon size={15} weight="duotone" />
                    </CardIconWrap>
                    <CardLabel>
                      Collected
                      <Tooltip tip="Cash actually received: sum of all proof-of-payment amounts across accessible invoices." />
                    </CardLabel>
                  </CardHeader>
                  <CopyValue
                    value={fmtCurrency(stats.totalCollected, currency)}
                    color="#3aaf7a"
                  >
                    {fmtCurrency(stats.totalCollected, currency)}
                  </CopyValue>
                  <CardSub>
                    {fmtPercent(collectionRate)} collection rate ·{" "}
                    {stats.paidCount} paid
                  </CardSub>
                </Card>

                {/* Outstanding */}
                <Card $variant="warn">
                  <CardHeader>
                    <CardIconWrap $variant="warn">
                      <ClockCountdownIcon size={15} weight="duotone" />
                    </CardIconWrap>
                    <CardLabel>
                      Outstanding
                      <Tooltip tip="Sum of amountDue across accessible invoices — the balance customers still owe." />
                    </CardLabel>
                  </CardHeader>
                  <CopyValue
                    value={fmtCurrency(stats.totalOutstanding, currency)}
                    color="#d4860a"
                  >
                    {fmtCurrency(stats.totalOutstanding, currency)}
                  </CopyValue>
                  <CardSub>
                    {fmtCurrency(stats.unpaidAmount, currency)} unpaid gross
                  </CardSub>
                </Card>

                {/* Overdue */}
                <Card $variant="danger">
                  <CardHeader>
                    <CardIconWrap $variant="danger">
                      <WarningCircleIcon size={15} weight="duotone" />
                    </CardIconWrap>
                    <CardLabel>
                      Overdue
                      <Tooltip tip="Invoices past their due date that remain unpaid." />
                    </CardLabel>
                  </CardHeader>
                  <CopyValue
                    value={fmtCurrency(stats.overdueAmount, currency)}
                    color="#c74e4e"
                  >
                    {fmtCurrency(stats.overdueAmount, currency)}
                  </CopyValue>
                  <CardSub>
                    {fmtPercent(overdueRate)} of gross · {stats.overdueCount}{" "}
                    invoices
                  </CardSub>
                </Card>
              </CardGrid>
            </Section>

            {/* ── Invoice Sizing ── */}
            <Section $delay={80}>
              <SectionLabel>
                <ChartBarIcon size={12} />
                Invoice Sizing
              </SectionLabel>

              <CardGrid $cols={4}>
                {/* Avg Invoice Value */}
                <Card>
                  <CardHeader>
                    <CardIconWrap>
                      <ChartBarIcon size={15} weight="duotone" />
                    </CardIconWrap>
                    <CardLabel>
                      Average Value
                      <Tooltip tip="Grand total divided by invoice count for the period." />
                    </CardLabel>
                  </CardHeader>
                  <CopyValue
                    value={fmtCurrency(stats.avgInvoiceValue, currency)}
                  >
                    {fmtCurrency(stats.avgInvoiceValue, currency)}
                  </CopyValue>
                  <CardSub>per invoice</CardSub>
                </Card>

                {/* Median Invoice Value */}
                <Card>
                  <CardHeader>
                    <CardIconWrap>
                      <ChartPieSliceIcon size={15} weight="duotone" />
                    </CardIconWrap>
                    <CardLabel>
                      Median Value
                      <Tooltip tip="Middle-value invoice in the period — less skewed by outliers than the average." />
                    </CardLabel>
                  </CardHeader>
                  <CopyValue
                    value={fmtCurrency(stats.medianInvoiceValue, currency)}
                  >
                    {fmtCurrency(stats.medianInvoiceValue, currency)}
                  </CopyValue>
                  <CardSub>50th percentile</CardSub>
                </Card>

                {/* Largest Invoice */}
                <Card>
                  <CardHeader>
                    <CardIconWrap>
                      <ArrowUpIcon size={15} weight="duotone" />
                    </CardIconWrap>
                    <CardLabel>
                      Largest Invoice
                      <Tooltip tip="The highest single invoice grand total in the period." />
                    </CardLabel>
                  </CardHeader>
                  <CopyValue
                    value={fmtCurrency(stats.largestInvoice, currency)}
                  >
                    {fmtCurrency(stats.largestInvoice, currency)}
                  </CopyValue>
                  <CardSub>peak transaction</CardSub>
                </Card>

                {/* Smallest Invoice */}
                <Card>
                  <CardHeader>
                    <CardIconWrap>
                      <ArrowDownIcon size={15} weight="duotone" />
                    </CardIconWrap>
                    <CardLabel>
                      Smallest Invoice
                      <Tooltip tip="The lowest single invoice grand total in the period." />
                    </CardLabel>
                  </CardHeader>
                  <CopyValue
                    value={fmtCurrency(stats.smallestInvoice, currency)}
                  >
                    {fmtCurrency(stats.smallestInvoice, currency)}
                  </CopyValue>
                  <CardSub>minimum transaction</CardSub>
                </Card>
              </CardGrid>
            </Section>

            {/* ── Tax & Withholding ── */}
            <Section $delay={120}>
              <SectionLabel>
                <ReceiptIcon size={12} />
                Tax & Withholding
              </SectionLabel>

              <CardGrid $cols={4}>
                {/* Output Tax */}
                <Card>
                  <CardHeader>
                    <CardIconWrap>
                      <ReceiptIcon size={15} weight="duotone" />
                    </CardIconWrap>
                    <CardLabel>
                      Output Tax
                      <Tooltip tip="Total additive taxes (VAT, GST, excise) across all invoices. This is the tax you owe from sales." />
                    </CardLabel>
                  </CardHeader>
                  <CopyValue value={fmtCurrency(stats.taxCollected, currency)}>
                    {fmtCurrency(stats.taxCollected, currency)}
                  </CopyValue>
                  <CardSub>
                    effective rate: {fmtPercent(stats.effectiveTaxRate)}
                  </CardSub>
                </Card>

                {/* EWT Withheld */}
                <Card>
                  <CardHeader>
                    <CardIconWrap>
                      <MinusCircleIcon size={15} weight="duotone" />
                    </CardIconWrap>
                    <CardLabel>
                      EWT Withheld
                      <Tooltip tip="Expanded Withholding Tax buyers will deduct. Reduces your cash inflow, not the invoice total." />
                    </CardLabel>
                  </CardHeader>
                  <CopyValue
                    value={fmtCurrency(stats.withholdingTotal, currency)}
                  >
                    {fmtCurrency(stats.withholdingTotal, currency)}
                  </CopyValue>
                  <CardSub>buyer withholds on remittance</CardSub>
                </Card>

                {/* Net Payable */}
                <Card $variant="success">
                  <CardHeader>
                    <CardIconWrap $variant="success">
                      <BankIcon size={15} weight="duotone" />
                    </CardIconWrap>
                    <CardLabel>
                      Net Payable
                      <Tooltip tip="Grand total minus EWT — the actual cash you expect to receive." />
                    </CardLabel>
                  </CardHeader>
                  <CopyValue
                    value={fmtCurrency(stats.netPayable, currency)}
                    color="#3aaf7a"
                  >
                    {fmtCurrency(stats.netPayable, currency)}
                  </CopyValue>
                  <CardSub>after EWT deductions</CardSub>
                </Card>

                {/* Effective Tax Rate */}
                <Card>
                  <CardHeader>
                    <CardIconWrap>
                      <PercentIcon size={15} weight="duotone" />
                    </CardIconWrap>
                    <CardLabel>
                      Effective Tax Rate
                      <Tooltip tip="Weighted average output tax rate: total output tax ÷ total subtotal." />
                    </CardLabel>
                  </CardHeader>
                  <CopyValue
                    value={`${(stats.effectiveTaxRate * 100).toFixed(2)}%`}
                  >
                    {(stats.effectiveTaxRate * 100).toFixed(2)}%
                  </CopyValue>
                  <CardSub>blended across all invoices</CardSub>
                </Card>
              </CardGrid>

              {/* Discounts row */}
              <CardGrid $cols={4}>
                <Card>
                  <CardHeader>
                    <CardIconWrap>
                      <PercentIcon size={15} weight="duotone" />
                    </CardIconWrap>
                    <CardLabel>
                      Discounts Given
                      <Tooltip tip="Sum of all discount amounts applied across line items. Revenue you chose not to collect." />
                    </CardLabel>
                  </CardHeader>
                  <CopyValue value={fmtCurrency(stats.discountGiven, currency)}>
                    {fmtCurrency(stats.discountGiven, currency)}
                  </CopyValue>
                  <CardSub>applied to line items</CardSub>
                </Card>

                {/* Avg Days to Payment */}
                <Card>
                  <CardHeader>
                    <CardIconWrap>
                      <ClockCountdownIcon size={15} weight="duotone" />
                    </CardIconWrap>
                    <CardLabel>
                      Avg Days to Payment
                      <Tooltip tip="Average number of days from issue date to first proof-of-payment settlement." />
                    </CardLabel>
                  </CardHeader>
                  <CopyValue value={fmtDays(stats.avgDaysToPayment)}>
                    {fmtDays(stats.avgDaysToPayment)}
                  </CopyValue>
                  <CardSub>issue → first settlement</CardSub>
                </Card>
              </CardGrid>
            </Section>

            {/* ── Invoice Status Breakdown ── */}
            <Section $delay={160}>
              <SectionLabel>
                <FunnelIcon size={12} />
                Invoice Status Breakdown
              </SectionLabel>

              <StatusRow>
                {Object.entries(stats.byStatus).map(([status, count]) => (
                  <StatusPill key={status} $color={statusColor(status)}>
                    <StatusDot $color={statusColor(status)} />
                    <StatusName>{status}</StatusName>
                    <StatusCount data-private="true">{count}</StatusCount>
                  </StatusPill>
                ))}
              </StatusRow>

              <ChartPlaceholder $height={140}>
                <ChartPieSliceIcon size={28} />
                <span>Status distribution chart coming soon</span>
                {/* <span style={{ fontSize: 10, opacity: 0.6 }}>
                  Plug in your preferred charting library
                </span> */}
              </ChartPlaceholder>

              {/* Amount by status table */}
              <DataTable>
                <DataTableHeader $cols={TABLE_COLS_STATUS}>
                  <span>Status</span>
                  <span style={{ textAlign: "right" }}>Count</span>
                  <span style={{ textAlign: "right" }}>Total Value</span>
                  <span style={{ textAlign: "right" }}>% of Gross</span>
                </DataTableHeader>
                {Object.entries(stats.byStatusAmount)
                  .sort((a, b) => b[1] - a[1])
                  .map(([status, amount], i) => (
                    <DataTableRow
                      key={status}
                      $alt={i % 2 === 1}
                      $cols={TABLE_COLS_STATUS}
                    >
                      <DataCell>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 7,
                          }}
                        >
                          <span
                            style={{
                              width: 7,
                              height: 7,
                              borderRadius: "50%",
                              background: statusColor(status),
                              display: "inline-block",
                              flexShrink: 0,
                            }}
                          />
                          <span style={{ textTransform: "capitalize" }}>
                            {status}
                          </span>
                        </span>
                      </DataCell>
                      <DataCell $mono $right data-private="true">
                        {stats.byStatus[status] ?? 0}
                      </DataCell>
                      <DataCell $mono $right data-private="true">
                        {fmtCurrency(amount, currency)}
                      </DataCell>
                      <DataCell $mono $right $muted>
                        {stats.totalAmount > 0
                          ? fmtPercent(amount / stats.totalAmount)
                          : "—"}
                      </DataCell>
                    </DataTableRow>
                  ))}
              </DataTable>
            </Section>

            {/* ── Revenue Trend + Top Recipients ── */}
            <Section $delay={200}>
              <SectionLabel>
                <ChartLineUpIcon size={12} />
                Revenue Trend & Top Recipients
              </SectionLabel>

              <TwoCol>
                <ChartPlaceholder $height={220}>
                  <ChartLineUpIcon size={28} />
                  <span>Revenue trend chart coming soon</span>
                  <span style={{ fontSize: 10, opacity: 0.6 }}>
                    Daily / weekly / monthly bucketing
                  </span>
                </ChartPlaceholder>

                <Card>
                  <CardLabel style={{ marginBottom: 4 }}>
                    Top Recipients by Revenue
                    <Tooltip tip="Your highest-billing clients ranked by total invoice value. Includes paid and outstanding." />
                  </CardLabel>
                  <CardSub style={{ marginBottom: 8 }}>
                    {stats.uniqueRecipientCount} unique recipient
                    {stats.uniqueRecipientCount !== 1 ? "s" : ""} in period
                  </CardSub>
                  {stats.topRecipients.length === 0 ? (
                    <CardSub>No data</CardSub>
                  ) : (
                    <RecipientTable>
                      {stats.topRecipients.map((r) => (
                        <RecipientRow key={r.name}>
                          <RecipientMeta>
                            <RecipientName title={r.name} data-private="true">
                              {r.name}
                            </RecipientName>
                            <RecipientSub data-private="true">
                              {r.count} inv ·{" "}
                              {fmtCurrency(r.paidAmount, currency)} paid
                            </RecipientSub>
                          </RecipientMeta>
                          <RecipientBar
                            $pct={(r.totalAmount / maxRecipient) * 100}
                          />
                          <RecipientAmt data-private="true">
                            {fmtCurrency(r.totalAmount, currency)}
                          </RecipientAmt>
                        </RecipientRow>
                      ))}
                    </RecipientTable>
                  )}
                </Card>
              </TwoCol>
            </Section>

            {/* ── Tax Type Breakdown ── */}
            {stats.taxBreakdown.length > 0 && (
              <Section $delay={240}>
                <SectionLabel>
                  <ReceiptIcon size={12} />
                  Tax Type Breakdown
                </SectionLabel>

                <DataTable>
                  <DataTableHeader $cols={TABLE_COLS_4}>
                    <span>Tax Type</span>
                    <span style={{ textAlign: "right" }}>Rate</span>
                    <span style={{ textAlign: "right" }}>Tax Amount</span>
                    <span style={{ textAlign: "right" }}>% of Tax Total</span>
                  </DataTableHeader>
                  {stats.taxBreakdown.map((t, i) => (
                    <DataTableRow
                      key={t.taxType}
                      $alt={i % 2 === 1}
                      $cols={TABLE_COLS_4}
                    >
                      <DataCell>{t.taxType}</DataCell>
                      <DataCell $mono $right $muted>
                        {fmtPercent(t.rate)}
                      </DataCell>
                      <DataCell $mono $right data-private="true">
                        {fmtCurrency(t.amount, currency)}
                      </DataCell>
                      <DataCell $mono $right $muted>
                        {stats.taxCollected > 0
                          ? fmtPercent(t.amount / stats.taxCollected)
                          : "—"}
                      </DataCell>
                    </DataTableRow>
                  ))}
                </DataTable>
              </Section>
            )}

            {/* ── Relationships & Metadata ── */}
            <Section $delay={280}>
              <SectionLabel>
                <UsersIcon size={12} />
                Relationships & Period Info
              </SectionLabel>

              <CardGrid $cols={4}>
                {/* Unique Recipients */}
                <Card>
                  <CardHeader>
                    <CardIconWrap>
                      <UsersIcon size={15} weight="duotone" />
                    </CardIconWrap>
                    <CardLabel>
                      Unique Recipients
                      <Tooltip tip="Number of distinct clients/recipients billed in this period." />
                    </CardLabel>
                  </CardHeader>
                  <CopyValue value={String(stats.uniqueRecipientCount)}>
                    {fmtNumber(stats.uniqueRecipientCount)}
                  </CopyValue>
                  <CardSub>clients billed</CardSub>
                </Card>

                {/* Unique Issuers */}
                <Card>
                  <CardHeader>
                    <CardIconWrap>
                      <FileTextIcon size={15} weight="duotone" />
                    </CardIconWrap>
                    <CardLabel>
                      Unique Issuers
                      <Tooltip tip="Number of distinct issuers (entities) that created invoices in this period." />
                    </CardLabel>
                  </CardHeader>
                  <CopyValue value={String(stats.uniqueIssuerCount)}>
                    {fmtNumber(stats.uniqueIssuerCount)}
                  </CopyValue>
                  <CardSub>issuing entities</CardSub>
                </Card>

                {/* Oldest Invoice */}
                <Card>
                  <CardHeader>
                    <CardIconWrap>
                      <CalendarBlankIcon size={15} weight="duotone" />
                    </CardIconWrap>
                    <CardLabel>
                      Oldest Invoice
                      <Tooltip tip="Issue date of the earliest invoice in this filtered set." />
                    </CardLabel>
                  </CardHeader>
                  <CopyValue value={fmtDate(stats.oldestInvoiceDate)}>
                    <CardValue style={{ fontSize: 16 }}>
                      {fmtDate(stats.oldestInvoiceDate)}
                    </CardValue>
                  </CopyValue>
                  <CardSub>earliest in period</CardSub>
                </Card>

                {/* Newest Invoice */}
                <Card>
                  <CardHeader>
                    <CardIconWrap>
                      <CalendarBlankIcon size={15} weight="duotone" />
                    </CardIconWrap>
                    <CardLabel>
                      Newest Invoice
                      <Tooltip tip="Issue date of the most recent invoice in this filtered set." />
                    </CardLabel>
                  </CardHeader>
                  <CopyValue value={fmtDate(stats.newestInvoiceDate)}>
                    <CardValue style={{ fontSize: 16 }}>
                      {fmtDate(stats.newestInvoiceDate)}
                    </CardValue>
                  </CopyValue>
                  <CardSub>latest in period</CardSub>
                </Card>
              </CardGrid>
            </Section>

            {/* ── Invoice Health ── */}
            <Section $delay={320}>
              <SectionLabel>
                <SealWarningIcon size={12} />
                Invoice Health
              </SectionLabel>

              <CardGrid $cols={4}>
                {/* Partial payments */}
                <Card $variant="warn">
                  <CardHeader>
                    <CardIconWrap $variant="warn">
                      <ChartPieSliceIcon size={15} weight="duotone" />
                    </CardIconWrap>
                    <CardLabel>
                      Partial
                      <Tooltip tip="Invoices that have received some payment but are not yet fully settled." />
                    </CardLabel>
                  </CardHeader>
                  <CopyValue
                    value={fmtCurrency(stats.partialAmount, currency)}
                    color="#d4860a"
                  >
                    {fmtCurrency(stats.partialAmount, currency)}
                  </CopyValue>
                  <CardSub>
                    {stats.partialCount} invoice
                    {stats.partialCount !== 1 ? "s" : ""}
                  </CardSub>
                </Card>

                {/* Drafts */}
                <Card $variant="muted">
                  <CardHeader>
                    <CardIconWrap $variant="muted">
                      <FileTextIcon size={15} weight="duotone" />
                    </CardIconWrap>
                    <CardLabel>
                      Drafts
                      <Tooltip tip="Invoices still in draft — not yet issued to a recipient." />
                    </CardLabel>
                  </CardHeader>
                  <CopyValue value={String(stats.draftCount)}>
                    {fmtNumber(stats.draftCount)}
                  </CopyValue>
                  <CardSub>not yet issued</CardSub>
                </Card>

                {/* Encrypted / Locked */}
                <Card $variant="muted">
                  <CardHeader>
                    <CardIconWrap $variant="muted">
                      <LockIcon size={15} weight="duotone" />
                    </CardIconWrap>
                    <CardLabel>
                      Encrypted
                      <Tooltip tip="Invoices that are encrypted and haven't been decrypted. Detailed financials are unavailable for these." />
                    </CardLabel>
                  </CardHeader>
                  <CopyValue value={String(stats.encryptedCount)}>
                    {fmtNumber(stats.encryptedCount)}
                  </CopyValue>
                  <CardSub>locked, no detail access</CardSub>
                </Card>

                {/* Unsigned */}
                <Card $variant="muted">
                  <CardHeader>
                    <CardIconWrap $variant="muted">
                      <SealWarningIcon size={15} weight="duotone" />
                    </CardIconWrap>
                    <CardLabel>
                      Unsigned
                      <Tooltip tip="Invoices that have not yet been cryptographically signed." />
                    </CardLabel>
                  </CardHeader>
                  <CopyValue value={String(stats.unsignedCount)}>
                    {fmtNumber(stats.unsignedCount)}
                  </CopyValue>
                  <CardSub>no signature</CardSub>
                </Card>
              </CardGrid>
            </Section>
          </>
        )}
      </ScrollBody>
    </Root>
  );
};

export default BuwizDashboardPanel;
