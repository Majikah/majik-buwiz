/**
 * @file FilingSection.tsx
 *
 * Renders the BIR filing-specific cards section inside BuwizDashboardPanel.
 * Only shown when dateMode === "filing".
 *
 * The section:
 *   1. Runs computeTax() against the current invoices / period / returnType
 *   2. Switches on formCode to render form-specific stat cards
 *   3. Shows a loading skeleton and error state
 *   4. Updates whenever activePreset / birReturnType / invoices change
 *
 * Usage inside BuwizDashboardPanel:
 *
 *   {dateMode === "filing" && (
 *     <FilingSection
 *       activePreset={activePreset}
 *       birReturnType={birReturnType}
 *       range={range}
 *       invoices={invoices}
 *       profile={profile}
 *       currency={currency}
 *     />
 *   )}
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import styled, { keyframes } from "styled-components";
import {
  ArrowRightIcon,
  BankIcon,
  CalendarCheckIcon,
  ChartBarIcon,
  CheckCircleIcon,
  CurrencyCircleDollarIcon,
  InfoIcon,
  PercentIcon,
  ReceiptIcon,
  SealCheckIcon,
  SealWarningIcon,
  WarningCircleIcon,
  XCircleIcon,
} from "@phosphor-icons/react";

import { computeTax, resolveFilingPeriod } from "./accounting-helper";
import type { TaxComputationResult } from "./accounting-helper";
import type { BIRReturnType } from "@/SDK/bir-tax-period";
import type { MajikInvoice } from "@majikah/majik-invoice";
import type {
  DateRange,
  PresetKey,
} from "@/components/functional/PeriodFilter";
import type { TaxpayerProfile } from "@/SDK/majik-buwiz-client/src/core/accounting/types";
import type { Form1701QOutput } from "@/SDK/majik-buwiz-client/src/core/accounting/adapters/forms/form-1701q";
import type { Form1701AOutput } from "@/SDK/majik-buwiz-client/src/core/accounting/adapters/forms/form-1701a";
import type { Form2550MFilingOutput } from "@/SDK/majik-buwiz-client/src/core/accounting/adapters/forms/form-2550m";
import type { Form2550QFilingOutput } from "@/SDK/majik-buwiz-client/src/core/accounting/adapters/forms/form-2550q";
import type { Form2551QOutput } from "@/SDK/majik-buwiz-client/src/core/accounting/adapters/forms/form-2551q";
import theme from "@/globals/theme";
import { ExpenseRecord } from "@/SDK/majik-buwiz-client/src/core/expenses/expense-record";

// ---------------------------------------------------------------------------
// Formatters (local — same as dashboard)
// ---------------------------------------------------------------------------

function fmtCurrency(amount: number, currency = "PHP"): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function fmtPct(n: number): string {
  return `${(n * 100).toFixed(2)}%`;
}

// ---------------------------------------------------------------------------
// Animations
// ---------------------------------------------------------------------------

const shimmer = keyframes`
  0%   { background-position: -200% 0; }
  100% { background-position:  200% 0; }
`;

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
`;

// ---------------------------------------------------------------------------
// Layout wrappers
// ---------------------------------------------------------------------------

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  animation: ${fadeIn} 0.3s ease both;
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

// ── Stat card ───────────────────────────────────────────────────────────────

const Card = styled.div<{
  $variant?: "default" | "success" | "danger" | "warn" | "muted" | "info";
  $highlight?: boolean;
}>`
  position: relative;
  border-radius: ${({ theme }) => theme.borders.radius.medium};
  background: ${({ theme }) => theme.colors.secondaryBackground};
  border: 1px solid
    ${({ $highlight, theme }) =>
      $highlight ? `${theme.colors.primary}44` : `${theme.colors.primary}14`};
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  overflow: hidden;
  transition: border-color 0.15s;

  &::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 2px;
    border-radius: ${({ theme }) => theme.borders.radius.medium}
      ${({ theme }) => theme.borders.radius.medium} 0 0;
    background: ${({ $variant, theme }) => {
      switch ($variant) {
        case "success":
          return "#3aaf7a";
        case "danger":
          return "#c74e4e";
        case "warn":
          return "#d4860a";
        case "info":
          return "#4a9ad4";
        case "muted":
          return `${theme.colors.textSecondary}44`;
        default:
          return theme.gradients.primary;
      }
    }};
  }
`;

const CardIconWrap = styled.div<{ $variant?: string }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: ${({ theme }) => theme.borders.radius.small};
  flex-shrink: 0;
  background: ${({ $variant, theme }) => {
    switch ($variant) {
      case "success":
        return "rgba(58,175,122,0.12)";
      case "danger":
        return "rgba(199,78,78,0.12)";
      case "warn":
        return "rgba(212,134,10,0.12)";
      case "info":
        return "rgba(74,154,212,0.12)";
      default:
        return theme.colors.primarySoft;
    }
  }};
  color: ${({ $variant, theme }) => {
    switch ($variant) {
      case "success":
        return "#3aaf7a";
      case "danger":
        return "#c74e4e";
      case "warn":
        return "#d4860a";
      case "info":
        return "#4a9ad4";
      default:
        return theme.colors.primary;
    }
  }};
`;

const CardTop = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const CardLabel = styled.div`
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  font-size: 10px;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.75;
`;

const CardValue = styled.div<{ $size?: "sm" | "md" | "lg"; $color?: string }>`
  font-family: "Fira Mono", "JetBrains Mono", monospace;
  font-size: ${({ $size }) =>
    $size === "sm" ? "14px" : $size === "lg" ? "24px" : "20px"};
  font-weight: 700;
  letter-spacing: -0.02em;
  color: ${({ $color, theme }) => $color ?? theme.colors.textPrimary};
  line-height: 1.1;
`;

const CardSub = styled.div`
  font-size: 10px;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.6;
`;

// ── Inline key-value row (inside a card) ────────────────────────────────────

const KVRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 0;
  border-bottom: 1px solid ${({ theme }) => theme.colors.primary}0d;

  &:last-child {
    border-bottom: none;
  }
`;

const KVLabel = styled.span`
  font-size: 10px;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.7;
`;

const KVValue = styled.span<{ $color?: string }>`
  font-family: "Fira Mono", "JetBrains Mono", monospace;
  font-size: 10px;
  color: ${({ $color, theme }) => $color ?? theme.colors.textPrimary};
  font-weight: 600;
`;

// ── Progress bar ─────────────────────────────────────────────────────────────

const ProgressWrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const ProgressLabel = styled.div`
  display: flex;
  justify-content: space-between;
  font-size: 9px;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.6;
`;

const ProgressTrack = styled.div`
  height: 5px;
  border-radius: 99px;
  background: ${({ theme }) => theme.colors.primarySoft};
  overflow: hidden;
`;

const ProgressFill = styled.div<{ $pct: number; $color?: string }>`
  height: 100%;
  width: ${({ $pct }) => Math.min(100, Math.max(0, $pct))}%;
  border-radius: 99px;
  background: ${({ $color, theme }) => $color ?? theme.gradients.primary};
  transition: width 0.5s ease;
`;

// ── Mini bar chart ───────────────────────────────────────────────────────────

const BarChart = styled.div`
  display: flex;
  align-items: flex-end;
  gap: 5px;
  height: 48px;
  padding-top: 8px;
`;

const Bar = styled.div<{ $h: number; $color: string; $active?: boolean }>`
  flex: 1;
  height: ${({ $h }) => $h}%;
  min-height: 3px;
  border-radius: 3px 3px 0 0;
  background: ${({ $color }) => $color};
  opacity: ${({ $active }) => ($active ? 1 : 0.4)};
  transition:
    height 0.4s ease,
    opacity 0.2s;
  cursor: default;
  position: relative;

  &:hover {
    opacity: 1;
  }
`;

const BarLabel = styled.div`
  display: flex;
  gap: 5px;
  margin-top: 4px;
`;

const BarLabelItem = styled.span`
  flex: 1;
  text-align: center;
  font-size: 8px;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.55;
`;

// ── Status badge ─────────────────────────────────────────────────────────────

const Badge = styled.span<{ $color: string; $bg: string }>`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 7px;
  border-radius: 99px;
  font-size: 9px;
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  color: ${({ $color }) => $color};
  background: ${({ $bg }) => $bg};
  border: 1px solid ${({ $color }) => $color}33;
`;

// ── Wide detail card ─────────────────────────────────────────────────────────

const DetailCard = styled(Card)`
  grid-column: span 2;

  @media (max-width: 1100px) {
    grid-column: span 1;
  }
`;

// ── Skeleton ─────────────────────────────────────────────────────────────────

const SkeletonBlock = styled.div<{ $h?: number; $w?: string }>`
  height: ${({ $h = 14 }) => $h}px;
  width: ${({ $w = "100%" }) => $w};
  border-radius: 4px;
  background: linear-gradient(
    90deg,
    ${({ theme }) => theme.colors.secondaryBackground} 25%,
    ${({ theme }) => theme.colors.primarySoft} 50%,
    ${({ theme }) => theme.colors.secondaryBackground} 75%
  );
  background-size: 200% 100%;
  animation: ${shimmer} 1.4s infinite linear;
`;

const SkeletonCard = styled(Card)`
  gap: 10px;
  min-height: 90px;
`;

// ── Error banner ─────────────────────────────────────────────────────────────

const ErrorBanner = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  border-radius: ${({ theme }) => theme.borders.radius.medium};
  background: rgba(199, 78, 78, 0.07);
  border: 1px solid rgba(199, 78, 78, 0.2);
  font-size: 11px;
  color: #c74e4e;
`;

// ── Period info banner ────────────────────────────────────────────────────────

const PeriodBanner = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  border-radius: ${({ theme }) => theme.borders.radius.medium};
  background: ${({ theme }) => theme.colors.primarySoft};
  border: 1px solid ${({ theme }) => theme.colors.primary}22;
  font-size: 10px;
  font-family: "Fira Mono", "JetBrains Mono", monospace;
  color: ${({ theme }) => theme.colors.textSecondary};
`;

// ---------------------------------------------------------------------------
// Helper sub-components
// ---------------------------------------------------------------------------

const StatCard: React.FC<{
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  variant?: "default" | "success" | "danger" | "warn" | "muted" | "info";
  iconVariant?: string;
  highlight?: boolean;
  color?: string;
  children?: React.ReactNode;
}> = ({
  label,
  value,
  sub,
  icon,
  variant,
  iconVariant,
  highlight,
  color,
  children,
}) => (
  <Card $variant={variant} $highlight={highlight}>
    <CardTop>
      <CardIconWrap $variant={iconVariant ?? variant}>{icon}</CardIconWrap>
      <CardLabel>{label}</CardLabel>
    </CardTop>
    <CardValue $color={color}>{value}</CardValue>
    {sub && <CardSub>{sub}</CardSub>}
    {children}
  </Card>
);

// ---------------------------------------------------------------------------
// Per-form card groups
// ---------------------------------------------------------------------------

const Cards1701Q: React.FC<{
  output: Form1701QOutput;
  currency: string;
}> = ({ output, currency }) => {
  const f = output.filer;
  const deductionLabel =
    output.deductionMethod === "osd"
      ? `OSD — ${fmtCurrency(output.deductionDetail.osdAmount ?? 0, currency)}`
      : `Itemized — ${fmtCurrency(output.deductionDetail.itemizedTotal ?? 0, currency)}`;

  const quarterColors = ["#4a9ad4", "#d4860a", "#8b6cd8", "#3aaf7a"];
  const maxTaxable = Math.max(f.taxableIncomeToDate, 1);
  // Approximate per-quarter share — Q1 is the full to-date for Q1,
  // for Q2+ we show this quarter's share vs prior
  //   const thisQShare = f.taxableIncomeThisQuarter;
  const priorShare = f.taxableIncomePreviousQuarters;

  return (
    <>
      {/* Row 1 — main KPIs */}
      <CardGrid $cols={4}>
        <StatCard
          label="Taxable Income To Date"
          value={fmtCurrency(f.taxableIncomeToDate, currency)}
          sub={`This quarter: ${fmtCurrency(f.taxableIncomeThisQuarter, currency)}`}
          icon={<ChartBarIcon size={14} weight="duotone" />}
        />
        <StatCard
          label="Income Tax Due"
          value={fmtCurrency(f.taxDue, currency)}
          sub={`${output.taxRateElection === "graduated" ? "Graduated rate" : "Flat 8%"}`}
          icon={<ReceiptIcon size={14} weight="duotone" />}
          variant="warn"
        />
        <StatCard
          label="Total Credits"
          value={fmtCurrency(f.totalCredits, currency)}
          sub={`EWT: ${fmtCurrency(f.cwtThisQuarter, currency)} · Prior Qtr: ${fmtCurrency(f.priorQuarterPayments, currency)}`}
          icon={<CheckCircleIcon size={14} weight="duotone" />}
          variant="success"
        />
        <StatCard
          label={f.isOverpayment ? "Overpayment" : "Total Amount Payable"}
          value={fmtCurrency(f.totalAmountPayable, currency)}
          sub={
            f.isOverpayment
              ? "Excess to carry forward"
              : `Item 41 · Q${output.quarter} ${output.taxYear}`
          }
          icon={
            f.isOverpayment ? (
              <CheckCircleIcon size={14} weight="duotone" />
            ) : (
              <BankIcon size={14} weight="duotone" />
            )
          }
          variant={
            f.isOverpayment
              ? "success"
              : f.totalAmountPayable === 0
                ? "muted"
                : "danger"
          }
          highlight={!f.isOverpayment && f.totalAmountPayable > 0}
          color={
            f.isOverpayment
              ? "#3aaf7a"
              : f.totalAmountPayable === 0
                ? undefined
                : "#c74e4e"
          }
        />
      </CardGrid>

      {/* Row 2 — detail cards */}
      <CardGrid $cols={4}>
        {/* Deduction detail */}
        <Card>
          <CardTop>
            <CardIconWrap>
              <PercentIcon size={14} weight="duotone" />
            </CardIconWrap>
            <CardLabel>Deductions</CardLabel>
          </CardTop>
          <CardValue $size="sm">{deductionLabel}</CardValue>
          <CardSub>
            {output.deductionMethod === "osd"
              ? `Base: ${fmtCurrency(output.deductionDetail.osdBase ?? 0, currency)} × 40%`
              : `Representation cap: ${fmtCurrency(output.deductionDetail.representationCap ?? 0, currency)}`}
          </CardSub>
        </Card>

        {/* Revenue breakdown */}
        <Card>
          <CardTop>
            <CardIconWrap>
              <CurrencyCircleDollarIcon size={14} weight="duotone" />
            </CardIconWrap>
            <CardLabel>Revenue</CardLabel>
          </CardTop>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 2,
              marginTop: 4,
            }}
          >
            <KVRow>
              <KVLabel>Gross</KVLabel>
              <KVValue>{fmtCurrency(f.grossRevenues, currency)}</KVValue>
            </KVRow>
            <KVRow>
              <KVLabel>GPP Income</KVLabel>
              <KVValue>{fmtCurrency(f.gppIncome, currency)}</KVValue>
            </KVRow>
            <KVRow>
              <KVLabel>Other Income</KVLabel>
              <KVValue>{fmtCurrency(f.otherIncome, currency)}</KVValue>
            </KVRow>
            <KVRow>
              <KVLabel>Total Gross</KVLabel>
              <KVValue $color={theme.colors.primary}>
                {fmtCurrency(f.totalGrossIncome, currency)}
              </KVValue>
            </KVRow>
          </div>
        </Card>

        {/* Taxable income accumulation progress */}
        <Card>
          <CardTop>
            <CardIconWrap>
              <ChartBarIcon size={14} weight="duotone" />
            </CardIconWrap>
            <CardLabel>Quarter Accumulation</CardLabel>
          </CardTop>
          <div style={{ marginTop: 4 }}>
            <BarChart>
              {[1, 2, 3, 4].map((q) => {
                // For the current quarter, show the split of prior + this quarter.
                // For other quarters, show proportionally.
                let h = 0;
                if (q === output.quarter) {
                  h = Math.round((f.taxableIncomeToDate / maxTaxable) * 100);
                } else if (q < output.quarter) {
                  // Prior quarters — we know their cumulative share, approximate evenly
                  h = Math.round(
                    (priorShare /
                      Math.max(output.quarter - 1, 1) /
                      maxTaxable) *
                      100,
                  );
                }
                return (
                  <Bar
                    key={q}
                    $h={Math.max(h, 3)}
                    $color={quarterColors[q - 1]}
                    $active={q === output.quarter}
                    title={`Q${q}${q === output.quarter ? ` (current): ${fmtCurrency(f.taxableIncomeThisQuarter, currency)}` : ""}`}
                  />
                );
              })}
            </BarChart>
            <BarLabel>
              {[1, 2, 3, 4].map((q) => (
                <BarLabelItem key={q}>Q{q}</BarLabelItem>
              ))}
            </BarLabel>
          </div>
          <CardSub>Prior quarters: {fmtCurrency(priorShare, currency)}</CardSub>
        </Card>

        {/* Spouse column quick summary */}
        {output.spouse ? (
          <Card>
            <CardTop>
              <CardIconWrap>
                <BankIcon size={14} weight="duotone" />
              </CardIconWrap>
              <CardLabel>Spouse (Column B)</CardLabel>
            </CardTop>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 2,
                marginTop: 4,
              }}
            >
              <KVRow>
                <KVLabel>Tax Due</KVLabel>
                <KVValue>{fmtCurrency(output.spouse.taxDue, currency)}</KVValue>
              </KVRow>
              <KVRow>
                <KVLabel>Credits</KVLabel>
                <KVValue>
                  {fmtCurrency(output.spouse.totalCredits, currency)}
                </KVValue>
              </KVRow>
              <KVRow>
                <KVLabel>Payable</KVLabel>
                <KVValue
                  $color={
                    output.spouse.totalAmountPayable > 0 ? "#c74e4e" : "#3aaf7a"
                  }
                >
                  {fmtCurrency(output.spouse.totalAmountPayable, currency)}
                </KVValue>
              </KVRow>
              <KVRow>
                <KVLabel>Aggregate (41C)</KVLabel>
                <KVValue $color="#d4860a">
                  {fmtCurrency(output.aggregateAmountPayable, currency)}
                </KVValue>
              </KVRow>
            </div>
          </Card>
        ) : (
          <StatCard
            label="Return Status"
            value={output.isAmended ? "Amended" : "Original"}
            sub={`${output.validation.errors.length} error(s) · ${output.validation.warnings.length} warning(s)`}
            icon={
              output.validation.errors.length > 0 ? (
                <SealWarningIcon size={14} weight="duotone" />
              ) : (
                <SealCheckIcon size={14} weight="duotone" />
              )
            }
            variant={output.validation.errors.length > 0 ? "danger" : "success"}
          />
        )}
      </CardGrid>
    </>
  );
};

// ---------------------------------------------------------------------------

const Cards1701A: React.FC<{
  output: Form1701AOutput;
  currency: string;
}> = ({ output, currency }) => {
  const pII = output.partII;
  const pIVC = output.partIVC;
  const recon = output.reconciliation;

  const partIV = output.partIVA ?? output.partIVB;
  const grossRevenues = partIV?.grossRevenues ?? 0;
  const taxableIncome =
    output.partIVA?.totalTaxableIncome ?? output.partIVB?.taxableIncome ?? 0;

  return (
    <>
      <CardGrid $cols={4}>
        <StatCard
          label="Annual Gross Revenue"
          value={fmtCurrency(grossRevenues, currency)}
          sub={`Taxable income: ${fmtCurrency(taxableIncome, currency)}`}
          icon={<CurrencyCircleDollarIcon size={14} weight="duotone" />}
        />
        <StatCard
          label="Annual Tax Due"
          value={fmtCurrency(pII.taxDue, currency)}
          sub={`${output.taxRateElection === "graduated" ? "Graduated rate" : "Flat 8%"} · ${output.deductionMethod.toUpperCase()}`}
          icon={<ReceiptIcon size={14} weight="duotone" />}
          variant="warn"
        />
        <StatCard
          label="Total Credits"
          value={fmtCurrency(pII.totalCredits, currency)}
          sub={`Q1-Q3 payments: ${fmtCurrency(pIVC.firstThreeQuarterPayments, currency)}`}
          icon={<CheckCircleIcon size={14} weight="duotone" />}
          variant="success"
        />
        <StatCard
          label={pII.isOverpayment ? "Overpayment" : "Total Amount Payable"}
          value={fmtCurrency(pII.totalAmountPayable, currency)}
          sub={
            pII.paymentMode === "installment" && !pII.isOverpayment
              ? `1st: ${fmtCurrency(pII.amountDueUponFiling, currency)} · 2nd (Jul 15): ${fmtCurrency(pII.secondInstallmentAmount, currency)}`
              : pII.isOverpayment
                ? "Excess to carry forward"
                : "Due upon filing"
          }
          icon={<BankIcon size={14} weight="duotone" />}
          variant={
            pII.isOverpayment
              ? "success"
              : pII.totalAmountPayable === 0
                ? "muted"
                : "danger"
          }
          highlight={!pII.isOverpayment && pII.totalAmountPayable > 0}
          color={
            pII.isOverpayment
              ? "#3aaf7a"
              : pII.totalAmountPayable === 0
                ? undefined
                : "#c74e4e"
          }
        />
      </CardGrid>

      <CardGrid $cols={4}>
        {/* Installment breakdown */}
        {!pII.isOverpayment && pII.paymentMode === "installment" && (
          <Card>
            <CardTop>
              <CardIconWrap $variant="warn">
                <CalendarCheckIcon size={14} weight="duotone" />
              </CardIconWrap>
              <CardLabel>Installment Schedule</CardLabel>
            </CardTop>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 2,
                marginTop: 4,
              }}
            >
              <KVRow>
                <KVLabel>1st (Apr 15)</KVLabel>
                <KVValue $color="#d4860a">
                  {fmtCurrency(pII.amountDueUponFiling, currency)}
                </KVValue>
              </KVRow>
              <KVRow>
                <KVLabel>2nd (Jul 15)</KVLabel>
                <KVValue $color="#d4860a">
                  {fmtCurrency(pII.secondInstallmentAmount, currency)}
                </KVValue>
              </KVRow>
              <KVRow>
                <KVLabel>Penalties</KVLabel>
                <KVValue
                  $color={pII.totalPenalties > 0 ? "#c74e4e" : undefined}
                >
                  {fmtCurrency(pII.totalPenalties, currency)}
                </KVValue>
              </KVRow>
            </div>
          </Card>
        )}

        {/* Credits breakdown */}
        <Card>
          <CardTop>
            <CardIconWrap $variant="success">
              <CheckCircleIcon size={14} weight="duotone" />
            </CardIconWrap>
            <CardLabel>Credits Breakdown</CardLabel>
          </CardTop>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 2,
              marginTop: 4,
            }}
          >
            <KVRow>
              <KVLabel>Prior Year Excess</KVLabel>
              <KVValue>
                {fmtCurrency(pIVC.priorYearExcessCredits, currency)}
              </KVValue>
            </KVRow>
            <KVRow>
              <KVLabel>Q1-Q3 Payments</KVLabel>
              <KVValue>
                {fmtCurrency(pIVC.firstThreeQuarterPayments, currency)}
              </KVValue>
            </KVRow>
            <KVRow>
              <KVLabel>CWT Q1-Q3</KVLabel>
              <KVValue>
                {fmtCurrency(pIVC.cwtFirstThreeQuarters, currency)}
              </KVValue>
            </KVRow>
            <KVRow>
              <KVLabel>CWT Q4</KVLabel>
              <KVValue>{fmtCurrency(pIVC.cwtQ4, currency)}</KVValue>
            </KVRow>
            <KVRow>
              <KVLabel>Foreign Tax Credits</KVLabel>
              <KVValue>{fmtCurrency(pIVC.foreignTaxCredits, currency)}</KVValue>
            </KVRow>
          </div>
        </Card>

        {/* Quarterly reconciliation */}
        <DetailCard>
          <CardTop>
            <CardIconWrap $variant={recon.matched ? "success" : "warn"}>
              {recon.matched ? (
                <SealCheckIcon size={14} weight="duotone" />
              ) : (
                <SealWarningIcon size={14} weight="duotone" />
              )}
            </CardIconWrap>
            <CardLabel>Quarterly Reconciliation</CardLabel>
            <Badge
              $color={recon.matched ? "#3aaf7a" : "#d4860a"}
              $bg={
                recon.matched ? "rgba(58,175,122,0.1)" : "rgba(212,134,10,0.1)"
              }
            >
              {recon.matched
                ? "Matched"
                : `${recon.fields.filter((f) => !f.matched).length} diff(s)`}
            </Badge>
          </CardTop>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 2,
              marginTop: 4,
            }}
          >
            <KVRow>
              <KVLabel>Quarters Found</KVLabel>
              <KVValue>{recon.quartersFound} of 4</KVValue>
            </KVRow>
            <KVRow>
              <KVLabel>Missing</KVLabel>
              <KVValue
                $color={
                  recon.quartersMissing.length > 0 ? "#d4860a" : undefined
                }
              >
                {recon.quartersMissing.length === 0
                  ? "None"
                  : `Q${recon.quartersMissing.join(", Q")}`}
              </KVValue>
            </KVRow>
            {recon.fields.slice(0, 3).map((field) => (
              <KVRow key={field.field}>
                <KVLabel>{field.field}</KVLabel>
                <KVValue $color={field.matched ? undefined : "#c74e4e"}>
                  {field.matched
                    ? "✓ matched"
                    : `Δ ${fmtCurrency(field.difference, currency)}`}
                </KVValue>
              </KVRow>
            ))}
          </div>

          {/* Mini bar: direct vs quarterly taxable income */}
          {recon.fields.length > 0 &&
            (() => {
              const taxable = recon.fields.find(
                (f) => f.field === "taxableIncome",
              );
              if (!taxable) return null;
              const max = Math.max(
                taxable.directAmount,
                taxable.quarterlyAmount,
                1,
              );
              return (
                <div style={{ marginTop: 6 }}>
                  <ProgressWrap>
                    <ProgressLabel>
                      <span>Direct path</span>
                      <span>{fmtCurrency(taxable.directAmount, currency)}</span>
                    </ProgressLabel>
                    <ProgressTrack>
                      <ProgressFill
                        $pct={(taxable.directAmount / max) * 100}
                        $color="#4a9ad4"
                      />
                    </ProgressTrack>
                  </ProgressWrap>
                  <ProgressWrap style={{ marginTop: 4 }}>
                    <ProgressLabel>
                      <span>Quarterly sum</span>
                      <span>
                        {fmtCurrency(taxable.quarterlyAmount, currency)}
                      </span>
                    </ProgressLabel>
                    <ProgressTrack>
                      <ProgressFill
                        $pct={(taxable.quarterlyAmount / max) * 100}
                        $color="#8b6cd8"
                      />
                    </ProgressTrack>
                  </ProgressWrap>
                </div>
              );
            })()}
        </DetailCard>
      </CardGrid>
    </>
  );
};

// ---------------------------------------------------------------------------

const Cards2550M: React.FC<{
  output: Form2550MFilingOutput;
  currency: string;
}> = ({ output, currency }) => {
  const p1 = output.partI;
  const p2 = output.partII;
  const p3 = output.partIII;

  const totalSales = Math.max(p1.totalSales, 1);
  const vatableShare = p1.vatableSales.amount / totalSales;
  const zeroRatedShare = p1.zeroRatedSales.amount / totalSales;
  const exemptShare = p1.exemptSales.amount / totalSales;

  return (
    <>
      <CardGrid $cols={4}>
        <StatCard
          label="Total Sales"
          value={fmtCurrency(p1.totalSales, currency)}
          sub={`Vatable: ${fmtCurrency(p1.vatableSales.amount, currency)}`}
          icon={<CurrencyCircleDollarIcon size={14} weight="duotone" />}
        />
        <StatCard
          label="Output VAT"
          value={fmtCurrency(p1.totalOutputVat, currency)}
          sub={`12% of vatable sales`}
          icon={<ReceiptIcon size={14} weight="duotone" />}
          variant="warn"
        />
        <StatCard
          label="Net Creditable Input VAT"
          value={fmtCurrency(p2.netCreditableInputVat, currency)}
          sub={`Available: ${fmtCurrency(p2.totalAvailableInputVat, currency)}`}
          icon={<CheckCircleIcon size={14} weight="duotone" />}
          variant="success"
        />
        <StatCard
          label={p3.isExcessInput ? "Excess Input (carry fwd)" : "VAT Payable"}
          value={fmtCurrency(
            p3.isExcessInput ? p3.excessInputVat : p3.vatPayable,
            currency,
          )}
          sub={
            p3.isExcessInput
              ? "To be applied next month"
              : `Month ${output.month} · ${output.taxYear}`
          }
          icon={
            p3.isExcessInput ? (
              <ArrowRightIcon size={14} weight="duotone" />
            ) : (
              <BankIcon size={14} weight="duotone" />
            )
          }
          variant={
            p3.isExcessInput ? "info" : p3.vatPayable === 0 ? "muted" : "danger"
          }
          color={
            p3.isExcessInput
              ? "#4a9ad4"
              : p3.vatPayable > 0
                ? "#c74e4e"
                : undefined
          }
          highlight={!p3.isExcessInput && p3.vatPayable > 0}
        />
      </CardGrid>

      <CardGrid $cols={4}>
        {/* Sales classification breakdown */}
        <Card>
          <CardTop>
            <CardIconWrap>
              <PercentIcon size={14} weight="duotone" />
            </CardIconWrap>
            <CardLabel>Sales Classification</CardLabel>
          </CardTop>
          <div style={{ marginTop: 4 }}>
            <ProgressWrap>
              <ProgressLabel>
                <span>Vatable (12%)</span>
                <span>{fmtPct(vatableShare)}</span>
              </ProgressLabel>
              <ProgressTrack>
                <ProgressFill $pct={vatableShare * 100} $color="#d4860a" />
              </ProgressTrack>
            </ProgressWrap>
            <ProgressWrap style={{ marginTop: 4 }}>
              <ProgressLabel>
                <span>Zero-Rated (0%)</span>
                <span>{fmtPct(zeroRatedShare)}</span>
              </ProgressLabel>
              <ProgressTrack>
                <ProgressFill $pct={zeroRatedShare * 100} $color="#4a9ad4" />
              </ProgressTrack>
            </ProgressWrap>
            <ProgressWrap style={{ marginTop: 4 }}>
              <ProgressLabel>
                <span>Exempt</span>
                <span>{fmtPct(exemptShare)}</span>
              </ProgressLabel>
              <ProgressTrack>
                <ProgressFill $pct={exemptShare * 100} $color="#7a8bad" />
              </ProgressTrack>
            </ProgressWrap>
          </div>
        </Card>

        {/* Input VAT breakdown */}
        <Card>
          <CardTop>
            <CardIconWrap $variant="success">
              <CheckCircleIcon size={14} weight="duotone" />
            </CardIconWrap>
            <CardLabel>Input VAT Sources</CardLabel>
          </CardTop>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 2,
              marginTop: 4,
            }}
          >
            <KVRow>
              <KVLabel>Beginning Balance</KVLabel>
              <KVValue>
                {fmtCurrency(p2.beginningExcessInputVat, currency)}
              </KVValue>
            </KVRow>
            <KVRow>
              <KVLabel>Capital Goods</KVLabel>
              <KVValue>
                {fmtCurrency(p2.currentInputVat.totalCapitalGoods, currency)}
              </KVValue>
            </KVRow>
            <KVRow>
              <KVLabel>Other Goods</KVLabel>
              <KVValue>
                {fmtCurrency(
                  p2.currentInputVat.totalGoodsOtherThanCapital,
                  currency,
                )}
              </KVValue>
            </KVRow>
            <KVRow>
              <KVLabel>Services</KVLabel>
              <KVValue>
                {fmtCurrency(p2.currentInputVat.totalServices, currency)}
              </KVValue>
            </KVRow>
            <KVRow>
              <KVLabel>Non-creditable (Exempt)</KVLabel>
              <KVValue $color="#c74e4e">
                -{fmtCurrency(p2.inputVatOnExemptSales, currency)}
              </KVValue>
            </KVRow>
          </div>
        </Card>

        {/* VAT payable vs input */}
        <Card>
          <CardTop>
            <CardIconWrap $variant={p3.isExcessInput ? "info" : "warn"}>
              <BankIcon size={14} weight="duotone" />
            </CardIconWrap>
            <CardLabel>Output vs Input</CardLabel>
          </CardTop>
          <div style={{ marginTop: 4 }}>
            <ProgressWrap>
              <ProgressLabel>
                <span>Output VAT</span>
                <span>{fmtCurrency(p1.totalOutputVat, currency)}</span>
              </ProgressLabel>
              <ProgressTrack>
                <ProgressFill
                  $pct={
                    (p1.totalOutputVat /
                      Math.max(
                        p1.totalOutputVat,
                        p2.netCreditableInputVat,
                        1,
                      )) *
                    100
                  }
                  $color="#d4860a"
                />
              </ProgressTrack>
            </ProgressWrap>
            <ProgressWrap style={{ marginTop: 4 }}>
              <ProgressLabel>
                <span>Net Input VAT</span>
                <span>{fmtCurrency(p2.netCreditableInputVat, currency)}</span>
              </ProgressLabel>
              <ProgressTrack>
                <ProgressFill
                  $pct={
                    (p2.netCreditableInputVat /
                      Math.max(
                        p1.totalOutputVat,
                        p2.netCreditableInputVat,
                        1,
                      )) *
                    100
                  }
                  $color="#3aaf7a"
                />
              </ProgressTrack>
            </ProgressWrap>
          </div>
          <CardSub style={{ marginTop: 4 }}>
            {p3.isExcessInput
              ? `Input exceeds output by ${fmtCurrency(p3.excessInputVat, currency)}`
              : `Net VAT due: ${fmtCurrency(p3.vatPayable, currency)}`}
          </CardSub>
        </Card>

        {/* VAT withheld */}
        <StatCard
          label="Return Status"
          value={
            p3.totalVatWithheld > 0
              ? `${fmtCurrency(p3.totalVatWithheld, currency)} withheld`
              : "No Gov't Withholding"
          }
          sub={`${output.isAmended ? "Amended return" : "Original return"} · Month ${output.month}`}
          icon={<SealCheckIcon size={14} weight="duotone" />}
          variant={output.validation.errors.length > 0 ? "danger" : "success"}
        />
      </CardGrid>
    </>
  );
};

// ---------------------------------------------------------------------------

const Cards2550Q: React.FC<{
  output: Form2550QFilingOutput;
  currency: string;
}> = ({ output, currency }) => {
  const p1 = output.partI;
  const p2 = output.partII;
  //   const p3 = output.partIII;
  const p4 = output.partIV;
  const recon = output.reconciliation;

  const quarterMonths = {
    1: [1, 2, 3],
    2: [4, 5, 6],
    3: [7, 8, 9],
    4: [10, 11, 12],
  }[output.quarter as 1 | 2 | 3 | 4];

  const maxMonthlyPayment = Math.max(
    ...p4.monthlyPaymentBreakdown.map((m) => m.amountPaid),
    1,
  );

  return (
    <>
      <CardGrid $cols={4}>
        <StatCard
          label="Quarterly Output VAT"
          value={fmtCurrency(p1.totalOutputVat, currency)}
          sub={`Total sales: ${fmtCurrency(p1.totalSales, currency)}`}
          icon={<ReceiptIcon size={14} weight="duotone" />}
          variant="warn"
        />
        <StatCard
          label="Net Creditable Input VAT"
          value={fmtCurrency(p2.netCreditableInputVat, currency)}
          sub={`${p2.capitalGoodsSource === "inherited-from-monthly" ? "Inherited from 2550M" : "Direct computation"}`}
          icon={<CheckCircleIcon size={14} weight="duotone" />}
          variant="success"
        />
        <StatCard
          label="Monthly Already Paid"
          value={fmtCurrency(p4.monthlyPaymentsAlreadyMade, currency)}
          sub={`${recon.monthsFound} of 3 monthly returns found`}
          icon={<CalendarCheckIcon size={14} weight="duotone" />}
          variant="info"
        />
        <StatCard
          label={p4.isOverpayment ? "Overpayment" : "Balance VAT Payable"}
          value={fmtCurrency(p4.totalAmountDue, currency)}
          sub={
            p4.isOverpayment
              ? `Excess: ${fmtCurrency(p4.overpaymentAmount, currency)}`
              : `After ${fmtCurrency(p4.monthlyPaymentsAlreadyMade, currency)} monthly payments`
          }
          icon={<BankIcon size={14} weight="duotone" />}
          variant={
            p4.isOverpayment
              ? "success"
              : p4.totalAmountDue === 0
                ? "muted"
                : "danger"
          }
          highlight={!p4.isOverpayment && p4.totalAmountDue > 0}
          color={
            p4.isOverpayment
              ? "#3aaf7a"
              : p4.totalAmountDue > 0
                ? "#c74e4e"
                : undefined
          }
        />
      </CardGrid>

      <CardGrid $cols={4}>
        {/* Monthly payment breakdown mini-chart */}
        <Card>
          <CardTop>
            <CardIconWrap $variant="info">
              <ChartBarIcon size={14} weight="duotone" />
            </CardIconWrap>
            <CardLabel>Monthly Payment Breakdown</CardLabel>
          </CardTop>
          <BarChart>
            {quarterMonths.map((month) => {
              const entry = p4.monthlyPaymentBreakdown.find(
                (m) => m.month === month,
              );
              const amount = entry?.amountPaid ?? 0;
              const h = Math.round((amount / maxMonthlyPayment) * 100);
              return (
                <Bar
                  key={month}
                  $h={Math.max(h, amount > 0 ? 10 : 3)}
                  $color={amount > 0 ? "#4a9ad4" : "#7a8bad"}
                  $active={amount > 0}
                  title={`Month ${month}: ${fmtCurrency(amount, currency)}`}
                />
              );
            })}
          </BarChart>
          <BarLabel>
            {quarterMonths.map((m) => (
              <BarLabelItem key={m}>M{m}</BarLabelItem>
            ))}
          </BarLabel>
          <CardSub>
            {recon.monthsMissing.length > 0
              ? `Missing: Month ${recon.monthsMissing.join(", ")}`
              : "All months found"}
          </CardSub>
        </Card>

        {/* Reconciliation */}
        <Card>
          <CardTop>
            <CardIconWrap $variant={recon.matched ? "success" : "warn"}>
              {recon.matched ? (
                <SealCheckIcon size={14} weight="duotone" />
              ) : (
                <SealWarningIcon size={14} weight="duotone" />
              )}
            </CardIconWrap>
            <CardLabel>Monthly Reconciliation</CardLabel>
            <Badge
              $color={recon.matched ? "#3aaf7a" : "#d4860a"}
              $bg={
                recon.matched ? "rgba(58,175,122,0.1)" : "rgba(212,134,10,0.1)"
              }
            >
              {recon.matched
                ? "Matched"
                : `${recon.fields.filter((f) => !f.matched).length} diff(s)`}
            </Badge>
          </CardTop>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 2,
              marginTop: 4,
            }}
          >
            {recon.fields.map((field) => (
              <KVRow key={field.field}>
                <KVLabel>{field.field}</KVLabel>
                <KVValue $color={field.matched ? undefined : "#c74e4e"}>
                  {field.matched
                    ? "✓"
                    : `Δ ${fmtCurrency(field.difference, currency)}`}
                </KVValue>
              </KVRow>
            ))}
          </div>
        </Card>

        {/* Sales breakdown progress */}
        <Card>
          <CardTop>
            <CardIconWrap>
              <PercentIcon size={14} weight="duotone" />
            </CardIconWrap>
            <CardLabel>Sales Mix</CardLabel>
          </CardTop>
          <div style={{ marginTop: 4 }}>
            {[
              { label: "Vatable", v: p1.vatableSales.amount, color: "#d4860a" },
              {
                label: "Zero-Rated",
                v: p1.zeroRatedSales.amount,
                color: "#4a9ad4",
              },
              { label: "Exempt", v: p1.exemptSales.amount, color: "#7a8bad" },
            ].map(({ label, v, color }) => (
              <ProgressWrap key={label} style={{ marginBottom: 4 }}>
                <ProgressLabel>
                  <span>{label}</span>
                  <span>{fmtCurrency(v, currency)}</span>
                </ProgressLabel>
                <ProgressTrack>
                  <ProgressFill
                    $pct={(v / Math.max(p1.totalSales, 1)) * 100}
                    $color={color}
                  />
                </ProgressTrack>
              </ProgressWrap>
            ))}
          </div>
        </Card>

        {/* VAT payable buildup */}
        <StatCard
          label="Gross vs Balance Due"
          value={fmtCurrency(p4.grossVatPayable, currency)}
          sub={`Less ${fmtCurrency(p4.monthlyPaymentsAlreadyMade, currency)} monthly → Balance: ${fmtCurrency(p4.balanceVatPayable, currency)}`}
          icon={<BankIcon size={14} weight="duotone" />}
          variant="muted"
        >
          <ProgressWrap style={{ marginTop: 4 }}>
            <ProgressTrack>
              <ProgressFill
                $pct={
                  p4.grossVatPayable > 0
                    ? (p4.monthlyPaymentsAlreadyMade / p4.grossVatPayable) * 100
                    : 100
                }
                $color="#3aaf7a"
              />
            </ProgressTrack>
          </ProgressWrap>
          <ProgressLabel style={{ marginTop: 2 }}>
            <span style={{ fontSize: 9 }}>
              {p4.grossVatPayable > 0
                ? `${fmtPct(p4.monthlyPaymentsAlreadyMade / p4.grossVatPayable)} already paid via 2550M`
                : "No gross payable"}
            </span>
          </ProgressLabel>
        </StatCard>
      </CardGrid>
    </>
  );
};

// ---------------------------------------------------------------------------

const Cards2551Q: React.FC<{
  output: Form2551QOutput;
  currency: string;
}> = ({ output, currency }) => {
  const p = output.partII;
  const s = output.summary;

  const totalTaxable = p.rows.reduce((sum, r) => sum + r.taxableAmount, 0);

  return (
    <>
      <CardGrid $cols={4}>
        <StatCard
          label="Total Gross Receipts"
          value={fmtCurrency(totalTaxable, currency)}
          sub={`${p.rows.length} transaction row(s)`}
          icon={<CurrencyCircleDollarIcon size={14} weight="duotone" />}
        />
        <StatCard
          label="Percentage Tax Due"
          value={fmtCurrency(p.totalTaxDue, currency)}
          sub={
            output.isCreateActRate
              ? "1% CREATE Act rate (temporary)"
              : `${fmtPct(output.appliedRate)} standard rate`
          }
          icon={<PercentIcon size={14} weight="duotone" />}
          variant={output.isCreateActRate ? "info" : "warn"}
        />
        <StatCard
          label="Total Credits"
          value={fmtCurrency(p.totalCredits, currency)}
          sub={`CWT withheld: ${fmtCurrency(p.cwtWithheld, currency)}`}
          icon={<CheckCircleIcon size={14} weight="duotone" />}
          variant="success"
        />
        <StatCard
          label={p.isOverpayment ? "Overpayment" : "Total Amount Payable"}
          value={fmtCurrency(s.totalAmountPayable, currency)}
          sub={`Due: ${output.filingDeadline} · Q${output.quarter} ${output.taxYear}`}
          icon={<BankIcon size={14} weight="duotone" />}
          variant={
            p.isOverpayment
              ? "success"
              : s.totalAmountPayable === 0
                ? "muted"
                : "danger"
          }
          highlight={!p.isOverpayment && s.totalAmountPayable > 0}
          color={
            p.isOverpayment
              ? "#3aaf7a"
              : s.totalAmountPayable > 0
                ? "#c74e4e"
                : undefined
          }
        />
      </CardGrid>

      {/* Transaction rows detail */}
      {p.rows.length > 0 && (
        <CardGrid $cols={4}>
          {p.rows.map((row) => (
            <Card key={row.itemLabel}>
              <CardTop>
                <Badge $color="#4a9ad4" $bg="rgba(74,154,212,0.1)">
                  {row.atcCode}
                </Badge>
                <CardLabel>{row.itemLabel}</CardLabel>
              </CardTop>
              <CardValue $size="sm">
                {fmtCurrency(row.taxDue, currency)}
              </CardValue>
              <CardSub>
                {row.classification || "—"} ·{" "}
                {fmtCurrency(row.taxableAmount, currency)} ×{" "}
                {fmtPct(row.taxRate)}
                {row.isCreateActRate ? " (CREATE Act 1%)" : ""}
              </CardSub>
            </Card>
          ))}

          {/* Deadline reminder */}
          <StatCard
            label="Filing Deadline"
            value={output.filingDeadline}
            sub={`${output.isCreateActRate ? "CREATE Act 1% rate applies" : "Standard 3% rate"}`}
            icon={<CalendarCheckIcon size={14} weight="duotone" />}
            variant={
              new Date() > new Date(output.filingDeadline) ? "danger" : "info"
            }
          />
        </CardGrid>
      )}
    </>
  );
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface FilingSectionProps {
  activePreset: PresetKey;
  birReturnType: BIRReturnType;
  range: DateRange;
  invoices: MajikInvoice[];
  expenses: ExpenseRecord[];
  profile: TaxpayerProfile | null;
  currency: string;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export const FilingSection: React.FC<FilingSectionProps> = ({
  activePreset,
  birReturnType,
  range,
  invoices,
  expenses,
  profile,
  currency,
}) => {
  const [result, setResult] = useState<TaxComputationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Debounce recomputation — avoid hammering on every keystroke / filter change.
  // We use a ref to track the latest input hash so stale async results are dropped.
  const runIdRef = useRef(0);

  const inputHash = useMemo(
    () =>
      [
        activePreset,
        birReturnType,
        range.from.toISOString().slice(0, 10),
        range.to.toISOString().slice(0, 10),
        invoices.length,
        expenses.length,
        profile?.tin ?? "",
      ].join("|"),
    [activePreset, birReturnType, range, invoices.length, profile],
  );

  useEffect(() => {
    if (!profile) return;

    const id = ++runIdRef.current;
    setLoading(true);
    setError(null);

    // Small delay so rapid filter changes don't each trigger a computation
    const timer = setTimeout(async () => {
      try {
        const res = await computeTax({
          activePreset,
          birReturnType,
          range,
          invoices,
          profile,
          currency,
          expenses,
        });

        // Discard stale result if a newer run started
        if (runIdRef.current !== id) return;
        setResult(res);
      } catch (err) {
        if (runIdRef.current !== id) return;
        setError(err instanceof Error ? err.message : "Tax computation failed");
      } finally {
        if (runIdRef.current === id) setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputHash]);

  // ── Resolve period label ────────────────────────────────────────────────
  const periodLabel = useMemo(() => {
    if (!profile) return "";
    try {
      const p = resolveFilingPeriod(activePreset, range, birReturnType);
      if (p.quarter) return `Q${p.quarter} ${p.year}`;
      if (p.month) {
        const name = new Date(p.year, p.month - 1, 1).toLocaleString("en-PH", {
          month: "long",
        });
        return `${name} ${p.year}`;
      }
      return `FY ${p.year}`;
    } catch {
      return activePreset;
    }
  }, [activePreset, range, birReturnType, profile]);

  const RETURN_LABELS: Record<BIRReturnType, string> = {
    income_quarterly: "1701Q — Quarterly Income Tax",
    income_annual: "1701A — Annual Income Tax",
    vat_quarterly: "2550Q — Quarterly VAT",
    vat_monthly: "2550M — Monthly VAT",
    percentage_quarterly: "2551Q — Quarterly Percentage Tax",
    withholding: "1601-EQ — Quarterly Withholding",
  };

  // ── Profile guard ───────────────────────────────────────────────────────
  if (!profile) return null;

  // ── Skeleton ─────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <Wrapper>
        <SectionLabel>
          <ReceiptIcon size={12} />
          {RETURN_LABELS[birReturnType]} · {periodLabel}
        </SectionLabel>
        <CardGrid $cols={4}>
          {[0, 1, 2, 3].map((i) => (
            <SkeletonCard key={i}>
              <SkeletonBlock $h={10} $w="50%" />
              <SkeletonBlock $h={22} $w="75%" />
              <SkeletonBlock $h={9} $w="60%" />
            </SkeletonCard>
          ))}
        </CardGrid>
      </Wrapper>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────
  if (error) {
    return (
      <Wrapper>
        <SectionLabel>
          <ReceiptIcon size={12} />
          {RETURN_LABELS[birReturnType]} · {periodLabel}
        </SectionLabel>
        <ErrorBanner>
          <WarningCircleIcon size={16} weight="duotone" />
          <span>
            <strong>Tax computation error: </strong>
            {error}
          </span>
        </ErrorBanner>
      </Wrapper>
    );
  }

  if (!result) return null;

  const { output } = result;

  // ── Form-specific cards ─────────────────────────────────────────────────
  const renderCards = () => {
    switch (output.formCode) {
      case "1701Q":
        return (
          <Cards1701Q output={output as Form1701QOutput} currency={currency} />
        );
      case "1701A":
        return (
          <Cards1701A output={output as Form1701AOutput} currency={currency} />
        );
      case "2550M":
        return (
          <Cards2550M
            output={output as Form2550MFilingOutput}
            currency={currency}
          />
        );
      case "2550Q":
        return (
          <Cards2550Q
            output={output as Form2550QFilingOutput}
            currency={currency}
          />
        );
      case "2551Q":
        return (
          <Cards2551Q output={output as Form2551QOutput} currency={currency} />
        );
      default:
        return null;
    }
  };

  // Validation issues summary
  const hasErrors = output.validation.errors.length > 0;
  const hasWarnings = output.validation.warnings.length > 0;

  return (
    <Wrapper>
      {/* Section header */}
      <SectionLabel>
        <ReceiptIcon size={12} />
        {RETURN_LABELS[birReturnType]} · {periodLabel}
        {hasErrors && (
          <Badge $color="#c74e4e" $bg="rgba(199,78,78,0.1)">
            <XCircleIcon size={9} />
            {output.validation.errors.length} error
            {output.validation.errors.length !== 1 ? "s" : ""}
          </Badge>
        )}
        {!hasErrors && hasWarnings && (
          <Badge $color="#d4860a" $bg="rgba(212,134,10,0.1)">
            <WarningCircleIcon size={9} />
            {output.validation.warnings.length} warning
            {output.validation.warnings.length !== 1 ? "s" : ""}
          </Badge>
        )}
        {!hasErrors && !hasWarnings && (
          <Badge $color="#3aaf7a" $bg="rgba(58,175,122,0.1)">
            <SealCheckIcon size={9} />
            Ready
          </Badge>
        )}
      </SectionLabel>

      {/* Period context */}
      <PeriodBanner>
        <InfoIcon size={11} />
        Computed for {periodLabel} · {invoices.length} invoice
        {invoices.length !== 1 ? "s" : ""} loaded · {output.formCode} · dryRun
        mode
      </PeriodBanner>

      {renderCards()}
    </Wrapper>
  );
};

export default FilingSection;
