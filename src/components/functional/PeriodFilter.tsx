/**
 * @file PeriodFilter.tsx
 *
 * Period selector for BuwizDashboardPanel.
 *
 * Extensions over v1:
 *  - Multi-year presets: 2Y, 3Y, 5Y
 *  - Quarter + year picker ("Q1 2024", "Q3 2025", …)
 *  - Date mode toggle: "issued" vs "filing"
 *    In "filing" mode the selected range is interpreted as a BIR filing
 *    window. The `onDateModeChange` callback lets the parent re-filter
 *    invoices accordingly.
 *  - BIRTaxPeriod integration for the quarter picker
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import styled, { css, keyframes } from "styled-components";
import {
  CalendarDotsIcon,
  CaretDownIcon,
  CaretLeftIcon,
  CaretRightIcon,
  CheckIcon,
  ClockIcon,
  ReceiptIcon,
  SealCheckIcon,
} from "@phosphor-icons/react";

import { BIRQuarter, BIRReturnType, BIRTaxPeriod } from "@/SDK/bir-tax-period";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DateRange {
  from: Date;
  to: Date;
}

export type PresetKey =
  | "annual"
  | "quarterly"
  | "monthly"
  | "weekly"
  | "daily"
  | "last24h"
  | "last12h"
  | "last3h"
  | "last1h"
  | "2year"
  | "3year"
  | "5year"
  | "custom"
  | `bir_q${BIRQuarter}_${number}`; // e.g. "bir_q1_2024"

export type DateMode = "issued" | "filing";

export interface PeriodFilterProps {
  value: DateRange;
  activePreset: PresetKey;
  /**
   * Whether the range represents invoice issued dates or BIR filing dates.
   * Defaults to "issued".
   */
  dateMode?: DateMode;
  /**
   * Which BIR return schedule to use when dateMode === "filing".
   * Defaults to "income_quarterly".
   */
  birReturnType?: BIRReturnType;
  onChange: (range: DateRange, preset: PresetKey) => void;
  onDateModeChange?: (mode: DateMode) => void;
  onBirReturnTypeChange?: (returnType: BIRReturnType) => void;
}

// ---------------------------------------------------------------------------
// Preset definitions
// ---------------------------------------------------------------------------

interface PresetDef {
  key: PresetKey;
  label: string;
  short: string;
  isTime?: boolean;
  isMultiYear?: boolean;
  resolve: () => DateRange;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

const PRESETS: PresetDef[] = [
  {
    key: "annual",
    label: "This Year",
    short: "YTD",
    resolve: () => {
      const now = new Date();
      return { from: new Date(now.getFullYear(), 0, 1), to: now };
    },
  },
  {
    key: "quarterly",
    label: "This Quarter",
    short: "QTD",
    resolve: () => {
      const now = new Date();
      const q = Math.floor(now.getMonth() / 3);
      return { from: new Date(now.getFullYear(), q * 3, 1), to: now };
    },
  },
  {
    key: "monthly",
    label: "This Month",
    short: "MTD",
    resolve: () => {
      const now = new Date();
      return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: now };
    },
  },
  {
    key: "weekly",
    label: "This Week",
    short: "WTD",
    resolve: () => {
      const now = new Date();
      const day = now.getDay();
      const mon = new Date(now);
      mon.setDate(now.getDate() - ((day + 6) % 7));
      return { from: startOfDay(mon), to: now };
    },
  },
  {
    key: "daily",
    label: "Today",
    short: "Today",
    resolve: () => {
      const now = new Date();
      return { from: startOfDay(now), to: now };
    },
  },
  {
    key: "2year",
    label: "Last 2 Years",
    short: "2Y",
    isMultiYear: true,
    resolve: () => {
      const now = new Date();
      return {
        from: new Date(now.getFullYear() - 2, now.getMonth(), now.getDate()),
        to: now,
      };
    },
  },
  {
    key: "3year",
    label: "Last 3 Years",
    short: "3Y",
    isMultiYear: true,
    resolve: () => {
      const now = new Date();
      return {
        from: new Date(now.getFullYear() - 3, now.getMonth(), now.getDate()),
        to: now,
      };
    },
  },
  {
    key: "5year",
    label: "Last 5 Years",
    short: "5Y",
    isMultiYear: true,
    resolve: () => {
      const now = new Date();
      return {
        from: new Date(now.getFullYear() - 5, now.getMonth(), now.getDate()),
        to: now,
      };
    },
  },
  // ── time-based ──
  {
    key: "last24h",
    label: "Last 24 Hours",
    short: "24h",
    isTime: true,
    resolve: () => {
      const now = new Date();
      return { from: new Date(now.getTime() - 24 * 3_600_000), to: now };
    },
  },
  {
    key: "last12h",
    label: "Last 12 Hours",
    short: "12h",
    isTime: true,
    resolve: () => {
      const now = new Date();
      return { from: new Date(now.getTime() - 12 * 3_600_000), to: now };
    },
  },
  {
    key: "last3h",
    label: "Last 3 Hours",
    short: "3h",
    isTime: true,
    resolve: () => {
      const now = new Date();
      return { from: new Date(now.getTime() - 3 * 3_600_000), to: now };
    },
  },
  {
    key: "last1h",
    label: "Last Hour",
    short: "1h",
    isTime: true,
    resolve: () => {
      const now = new Date();
      return { from: new Date(now.getTime() - 3_600_000), to: now };
    },
  },
];

// ---------------------------------------------------------------------------
// BIR return type options (for the filing-mode selector)
// ---------------------------------------------------------------------------

interface ReturnTypeOption {
  value: BIRReturnType;
  label: string;
  short: string;
}

const RETURN_TYPE_OPTIONS: ReturnTypeOption[] = [
  {
    value: "income_quarterly",
    label: "Quarterly Income Tax (1701Q/1702Q)",
    short: "1701Q",
  },
  {
    value: "income_annual",
    label: "Annual Income Tax (1701/1702)",
    short: "1701",
  },
  { value: "vat_quarterly", label: "Quarterly VAT (2550Q)", short: "2550Q" },
  { value: "vat_monthly", label: "Monthly VAT (2550M)", short: "2550M" },
  {
    value: "withholding",
    label: "Quarterly Withholding (1601-EQ)",
    short: "1601Q",
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toInputDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

function fmt(d: Date): string {
  return d.toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function fmtShort(d: Date): string {
  return d.toLocaleDateString("en-PH", { month: "short", year: "numeric" });
}

// const QUARTER_LABELS: Record<BIRQuarter, string> = {
//   1: "Q1 (Jan–Mar)",
//   2: "Q2 (Apr–Jun)",
//   3: "Q3 (Jul–Sep)",
//   4: "Q4 (Oct–Dec)",
// };

function buildBirPresetKey(q: BIRQuarter, year: number): PresetKey {
  return `bir_q${q}_${year}` as PresetKey;
}

function parseBirPresetKey(
  key: PresetKey,
): { q: BIRQuarter; year: number } | null {
  const m = /^bir_q(\d)_(\d{4})$/.exec(key);
  if (!m) return null;
  return { q: Number(m[1]) as BIRQuarter, year: Number(m[2]) };
}

const FILING_YEAR_OFFSET = 1;

const getMaxAllowedYear = (mode: DateMode) => {
  const currentYear = new Date().getFullYear();
  return mode === "filing" ? currentYear + FILING_YEAR_OFFSET : currentYear;
};

/** Year range for the quarter picker: current year going back 5 years. */
function buildYearList(maxYear: number): number[] {
  const years: number[] = [];
  for (let y = maxYear; y >= maxYear - 5; y--) years.push(y);
  return years;
}

// ---------------------------------------------------------------------------
// Animations
// ---------------------------------------------------------------------------

const popIn = keyframes`
  from { opacity: 0; transform: translateY(-6px) scale(0.97); }
  to   { opacity: 1; transform: translateY(0)   scale(1);    }
`;

// ---------------------------------------------------------------------------
// Styled components
// ---------------------------------------------------------------------------

const Wrapper = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
`;

// ── Mode toggle (issued / filing) ──────────────────────────────────────────

const ModeToggle = styled.div`
  display: inline-flex;
  align-items: center;
  background: ${({ theme }) => theme.colors.secondaryBackground};
  border: 1px solid ${({ theme }) => theme.colors.primary}18;
  border-radius: ${({ theme }) => theme.borders.radius.medium};
  padding: 3px;
  gap: 2px;
`;

const ModeBtn = styled.button<{ $active: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  font-size: 10px;
  padding: 5px 9px;
  border-radius: calc(${({ theme }) => theme.borders.radius.medium} - 2px);
  border: none;
  cursor: pointer;
  transition: all 0.14s;
  white-space: nowrap;

  ${({ $active, theme }) =>
    $active
      ? css`
          background: ${theme.gradients.primary};
          color: ${theme.colors.static.white};
          box-shadow: 0 1px 6px ${theme.colors.primary}44;
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

// ── Preset strip ───────────────────────────────────────────────────────────

const PresetStrip = styled.div`
  display: flex;
  align-items: center;
  gap: 3px;
  background: ${({ theme }) => theme.colors.secondaryBackground};
  border: 1px solid ${({ theme }) => theme.colors.primary}18;
  border-radius: ${({ theme }) => theme.borders.radius.medium};
  padding: 3px;
`;

const Divider = styled.div`
  width: 1px;
  height: 18px;
  background: ${({ theme }) => theme.colors.primary}18;
  flex-shrink: 0;
  margin: 0 2px;
`;

const PresetBtn = styled.button<{
  $active: boolean;
  $time?: boolean;
  $multiYear?: boolean;
}>`
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  font-size: 11px;
  padding: 5px 9px;
  border-radius: calc(${({ theme }) => theme.borders.radius.medium} - 2px);
  border: none;
  cursor: pointer;
  transition: all 0.14s;
  white-space: nowrap;

  ${({ $active, $time, $multiYear, theme }) =>
    $active
      ? css`
          background: ${theme.gradients.primary};
          color: ${theme.colors.static.white};
          box-shadow: 0 1px 6px ${theme.colors.primary}44;
        `
      : css`
          background: transparent;
          color: ${$time || $multiYear
            ? theme.colors.textSecondary
            : theme.colors.textPrimary};
          &:hover {
            background: ${theme.colors.primarySoft};
            color: ${theme.colors.primary};
          }
        `}
`;

// ── Dropdown anchor / shared ───────────────────────────────────────────────

const DropdownAnchor = styled.div`
  position: relative;
`;

const Dropdown = styled.div<{ $width?: number }>`
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  z-index: 200;
  min-width: ${({ $width = 280 }) => $width}px;
  background: ${({ theme }) => theme.colors.secondaryBackground};
  border: 1px solid ${({ theme }) => theme.colors.primary}22;
  border-radius: ${({ theme }) => theme.borders.radius.medium};
  box-shadow: 0 12px 36px rgba(0, 0, 0, 0.22);
  padding: 14px;
  animation: ${popIn} 0.16s ease;
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const DropLabel = styled.label`
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.65;
`;

// ── Custom date inputs ─────────────────────────────────────────────────────

const DateInputRow = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const DateInput = styled.input`
  font-family: ${({ theme }) => theme.typography.fonts.numbers};
  font-size: 12px;
  padding: 7px 10px;
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

const ApplyBtn = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  font-size: 12px;
  padding: 8px;
  border-radius: ${({ theme }) => theme.borders.radius.medium};
  background: ${({ theme }) => theme.gradients.primary};
  border: none;
  color: ${({ theme }) => theme.colors.static.white};
  cursor: pointer;

  &:hover {
    filter: brightness(1.08);
  }
`;

// ── Quarter picker ─────────────────────────────────────────────────────────

const QuarterPickerWrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const YearNav = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
`;

const YearNavBtn = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: 1px solid ${({ theme }) => theme.colors.primary}22;
  border-radius: ${({ theme }) => theme.borders.radius.small};
  background: transparent;
  color: ${({ theme }) => theme.colors.textSecondary};
  cursor: pointer;
  transition: all 0.12s;

  &:hover:not(:disabled) {
    background: ${({ theme }) => theme.colors.primarySoft};
    color: ${({ theme }) => theme.colors.primary};
    border-color: ${({ theme }) => theme.colors.primary}44;
  }

  &:disabled {
    opacity: 0.3;
    cursor: default;
  }
`;

const YearLabel = styled.span`
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textPrimary};
  flex: 1;
  text-align: center;
`;

const QuarterGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 6px;
`;

const QuarterBtn = styled.button<{ $active: boolean; $disabled?: boolean }>`
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  font-size: 11px;
  padding: 9px 10px;
  border-radius: ${({ theme }) => theme.borders.radius.small};
  border: 1px solid
    ${({ $active, theme }) =>
      $active ? theme.colors.primary : `${theme.colors.primary}22`};
  cursor: ${({ $disabled }) => ($disabled ? "default" : "pointer")};
  transition: all 0.13s;
  text-align: left;
  line-height: 1.35;
  opacity: ${({ $disabled }) => ($disabled ? 0.35 : 1)};

  ${({ $active, theme }) =>
    $active
      ? css`
          background: ${theme.gradients.primary};
          color: ${theme.colors.static.white};
          box-shadow: 0 1px 6px ${theme.colors.primary}44;
        `
      : css`
          background: ${theme.colors.primaryBackground};
          color: ${theme.colors.textPrimary};
          &:hover:not(:disabled) {
            background: ${theme.colors.primarySoft};
            border-color: ${theme.colors.primary}44;
            color: ${theme.colors.primary};
          }
        `}
`;

const QuarterBtnSub = styled.div`
  font-family: "Fira Mono", "JetBrains Mono", monospace;
  font-size: 9px;
  opacity: 0.6;
  margin-top: 2px;
`;

// ── Return type selector (inside filing-mode dropdown) ────────────────────

const ReturnTypeGrid = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const ReturnTypeBtn = styled.button<{ $active: boolean }>`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  border-radius: ${({ theme }) => theme.borders.radius.small};
  border: 1px solid
    ${({ $active, theme }) =>
      $active ? theme.colors.primary : `${theme.colors.primary}18`};
  background: ${({ $active, theme }) =>
    $active ? theme.colors.primarySoft : "transparent"};
  color: ${({ $active, theme }) =>
    $active ? theme.colors.primary : theme.colors.textPrimary};
  cursor: pointer;
  transition: all 0.13s;
  text-align: left;

  &:hover {
    border-color: ${({ theme }) => theme.colors.primary}44;
    background: ${({ theme }) => theme.colors.primarySoft};
    color: ${({ theme }) => theme.colors.primary};
  }
`;

const ReturnTypeShort = styled.span`
  font-family: "Fira Mono", "JetBrains Mono", monospace;
  font-size: 10px;
  min-width: 36px;
  opacity: 0.75;
`;

const ReturnTypeLabel = styled.span`
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  font-size: 11px;
  flex: 1;
`;

// ── Deadline badge (shown when a BIR quarter is selected + filing mode) ────

const DeadlineBadge = styled.div<{ $overdue: boolean }>`
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 5px 9px;
  border-radius: ${({ theme }) => theme.borders.radius.small};
  background: ${({ $overdue }) =>
    $overdue ? "rgba(199,78,78,0.10)" : "rgba(58,175,122,0.10)"};
  border: 1px solid
    ${({ $overdue }) =>
      $overdue ? "rgba(199,78,78,0.3)" : "rgba(58,175,122,0.3)"};
  font-family: "Fira Mono", "JetBrains Mono", monospace;
  font-size: 10px;
  color: ${({ $overdue }) => ($overdue ? "#c74e4e" : "#3aaf7a")};
`;

// ── Custom / Quarter button ────────────────────────────────────────────────

const CustomButton = styled.button<{ $active: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  font-size: 11px;
  padding: 6px 12px;
  border-radius: ${({ theme }) => theme.borders.radius.medium};
  border: 1px solid
    ${({ $active, theme }) =>
      $active ? theme.colors.primary : `${theme.colors.primary}33`};
  background: ${({ $active, theme }) =>
    $active ? theme.colors.primarySoft : "transparent"};
  color: ${({ $active, theme }) =>
    $active ? theme.colors.primary : theme.colors.textSecondary};
  cursor: pointer;
  transition: all 0.14s;
  white-space: nowrap;

  &:hover {
    border-color: ${({ theme }) => theme.colors.primary};
    color: ${({ theme }) => theme.colors.primary};
    background: ${({ theme }) => theme.colors.primarySoft};
  }
`;

const RangeSummary = styled.span`
  font-family: "Fira Mono", "JetBrains Mono", monospace;
  font-size: 10px;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.7;
  white-space: nowrap;
`;

// ── Section separator inside dropdown ─────────────────────────────────────

const DropSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const DropSectionTitle = styled.div`
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.5;
  padding-bottom: 2px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.primary}14;
`;

// ---------------------------------------------------------------------------
// Quarter Picker sub-component
// ---------------------------------------------------------------------------

interface QuarterPickerProps {
  activePreset: PresetKey;
  dateMode: DateMode;
  birReturnType: BIRReturnType;
  onSelect: (range: DateRange, preset: PresetKey) => void;
  onClose: () => void;
  viewYear: number;
  setViewYear: React.Dispatch<React.SetStateAction<number>>;
}

const QuarterPicker: React.FC<QuarterPickerProps> = ({
  activePreset,
  dateMode,
  birReturnType,
  onSelect,
  onClose,
  viewYear,
  setViewYear,
}) => {
  const maxYear = getMaxAllowedYear(dateMode);
  const yearList = buildYearList(maxYear);
  const minYear = yearList[yearList.length - 1];

  const handleQ = useCallback(
    (q: BIRQuarter) => {
      const period = BIRTaxPeriod.fromQuarter(q, viewYear);
      const range =
        dateMode === "filing"
          ? period.filingRange(birReturnType)
          : period.range;
      onSelect(range, buildBirPresetKey(q, viewYear));
      onClose();
    },
    [viewYear, dateMode, birReturnType, onSelect, onClose],
  );

  const activeQ = parseBirPresetKey(activePreset);
  const annualOnly = dateMode === "filing" && birReturnType === "income_annual";

  const handleYearSelect = useCallback(() => {
    const from = new Date(viewYear, 0, 1, 0, 0, 0, 0);
    const to = new Date(viewYear, 11, 31, 23, 59, 59, 999);
    onSelect({ from, to }, "annual");
    onClose();
  }, [viewYear, onSelect, onClose]);

  return (
    <QuarterPickerWrap>
      <YearNav>
        <YearNavBtn
          onClick={() => setViewYear((y) => y - 1)}
          disabled={viewYear <= minYear}
          aria-label="Previous year"
        >
          <CaretLeftIcon size={11} />
        </YearNavBtn>
        <YearLabel>{viewYear}</YearLabel>
        <YearNavBtn
          onClick={() => setViewYear((y) => y + 1)}
          disabled={viewYear >= maxYear}
          aria-label="Next year"
        >
          <CaretRightIcon size={11} />
        </YearNavBtn>
      </YearNav>

      {annualOnly ? (
        <QuarterGrid>
          {(() => {
            const isFutureYear = viewYear > new Date().getFullYear();
            const from = new Date(viewYear, 0, 1);
            const to = new Date(viewYear, 11, 31, 23, 59, 59, 999);
            return (
              <QuarterBtn
                key={`year-${viewYear}`}
                $active={false}
                $disabled={dateMode !== "filing" ? isFutureYear : false}
                disabled={dateMode !== "filing" ? isFutureYear : false}
                onClick={handleYearSelect}
                title={`Select ${viewYear} (Jan 1 – Dec 31)`}
              >
                Year {viewYear}
                <QuarterBtnSub>
                  {fmt(from).replace(`, ${viewYear}`, "")} –{" "}
                  {fmt(to).replace(`, ${viewYear}`, "")}
                </QuarterBtnSub>
              </QuarterBtn>
            );
          })()}
        </QuarterGrid>
      ) : (
        <QuarterGrid>
          {([1, 2, 3, 4] as BIRQuarter[]).map((q) => {
            const period = BIRTaxPeriod.fromQuarter(q, viewYear);
            const range =
              dateMode === "filing"
                ? period.filingRange(birReturnType)
                : period.range;
            const deadline = period.getDeadline(birReturnType);
            const isActive = activeQ?.q === q && activeQ?.year === viewYear;
            const isFuture = range.from > new Date();

            return (
              <QuarterBtn
                key={q}
                $active={isActive}
                $disabled={isFuture}
                disabled={isFuture}
                onClick={() => handleQ(q)}
                title={`Deadline: ${deadline.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}`}
              >
                Q{q}
                <QuarterBtnSub>
                  {fmt(range.from).replace(`, ${viewYear}`, "")} –{" "}
                  {fmt(range.to).replace(`, ${viewYear}`, "")}
                </QuarterBtnSub>
              </QuarterBtn>
            );
          })}
        </QuarterGrid>
      )}
    </QuarterPickerWrap>
  );
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

type DropdownView = "none" | "custom" | "quarter" | "filing";

export const PeriodFilter: React.FC<PeriodFilterProps> = ({
  value,
  activePreset,
  dateMode = "issued",
  birReturnType = "income_quarterly",
  onChange,
  onDateModeChange,
  onBirReturnTypeChange,
}) => {
  const [openView, setOpenView] = useState<DropdownView>("none");
  const [customFrom, setCustomFrom] = useState(toInputDate(value.from));
  const [customTo, setCustomTo] = useState(toInputDate(value.to));
  const anchorRef = useRef<HTMLDivElement>(null);

  const [viewYear, setViewYear] = useState(() =>
    Math.min(new Date().getFullYear(), getMaxAllowedYear(dateMode)),
  );

  // Close dropdown on outside click
  useEffect(() => {
    if (openView === "none") return;
    const handler = (e: MouseEvent) => {
      if (anchorRef.current && !anchorRef.current.contains(e.target as Node)) {
        setOpenView("none");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [openView]);

  const handlePreset = useCallback(
    (preset: PresetDef) => {
      onChange(preset.resolve(), preset.key);
      setOpenView("none");
    },
    [onChange],
  );

  const handleApplyCustom = useCallback(() => {
    const from = new Date(customFrom);
    const to = new Date(customTo);
    if (isNaN(from.getTime()) || isNaN(to.getTime())) return;
    if (from > to) return;
    onChange({ from, to }, "custom");
    setOpenView("none");
  }, [customFrom, customTo, onChange]);

  const handleModeToggle = useCallback(
    (mode: DateMode) => {
      onDateModeChange?.(mode);

      const maxYear = getMaxAllowedYear(mode);

      setViewYear((y) => Math.min(y, maxYear));

      const parsed = parseBirPresetKey(activePreset);
      if (parsed) {
        const period = BIRTaxPeriod.fromQuarter(parsed.q, parsed.year);
        const range =
          mode === "filing" ? period.filingRange(birReturnType) : period.range;

        onChange(range, activePreset);
      }
    },
    [onDateModeChange, activePreset, birReturnType, onChange],
  );

  const handleReturnType = useCallback(
    (rt: BIRReturnType) => {
      onBirReturnTypeChange?.(rt);
      // Re-resolve if a quarter is active
      const parsed = parseBirPresetKey(activePreset);
      if (parsed && dateMode === "filing") {
        const period = BIRTaxPeriod.fromQuarter(parsed.q, parsed.year);
        onChange(period.filingRange(rt), activePreset);
      }
    },
    [onBirReturnTypeChange, activePreset, dateMode, onChange],
  );

  // ── Derived BIR deadline info when a quarter is selected ─────────────────
  const activeBirParsed = parseBirPresetKey(activePreset);
  const activeBirDeadline = activeBirParsed
    ? BIRTaxPeriod.fromQuarter(
        activeBirParsed.q,
        activeBirParsed.year,
      ).getDeadline(birReturnType)
    : null;
  const isDeadlineOverdue = activeBirDeadline
    ? new Date() > activeBirDeadline
    : false;

  const calendarPresets = PRESETS.filter((p) => !p.isTime && !p.isMultiYear);
  const multiYearPresets = PRESETS.filter((p) => p.isMultiYear);
  const timePresets = PRESETS.filter((p) => p.isTime);

  const isCustomActive = activePreset === "custom";
  const isQuarterActive = !!activeBirParsed;
  const isBirActive = dateMode === "filing";

  const activeReturnTypeOption = RETURN_TYPE_OPTIONS.find(
    (o) => o.value === birReturnType,
  );

  const isAnnualFiling =
    dateMode === "filing" && birReturnType === "income_annual";

  return (
    <Wrapper>
      {/* ── Date mode toggle ── */}
      <ModeToggle>
        <ModeBtn
          $active={dateMode === "issued"}
          onClick={() => handleModeToggle("issued")}
          title="Filter by invoice issue date"
        >
          <CalendarDotsIcon size={11} />
          Issued
        </ModeBtn>
        <ModeBtn
          $active={dateMode === "filing"}
          onClick={() => handleModeToggle("filing")}
          title="Filter by BIR filing period"
        >
          <ReceiptIcon size={11} />
          Filing
        </ModeBtn>
      </ModeToggle>

      {/* ── Preset strip ── */}
      <PresetStrip>
        {calendarPresets.map((p) => (
          <PresetBtn
            key={p.key}
            $active={activePreset === p.key}
            onClick={() => handlePreset(p)}
            title={p.label}
          >
            {p.short}
          </PresetBtn>
        ))}

        <Divider />

        {multiYearPresets.map((p) => (
          <PresetBtn
            key={p.key}
            $active={activePreset === p.key}
            $multiYear
            onClick={() => handlePreset(p)}
            title={p.label}
          >
            {p.short}
          </PresetBtn>
        ))}

        <Divider />

        {timePresets.map((p) => (
          <PresetBtn
            key={p.key}
            $active={activePreset === p.key}
            $time
            onClick={() => handlePreset(p)}
            title={p.label}
          >
            <ClockIcon size={10} style={{ marginRight: 2 }} />
            {p.short}
          </PresetBtn>
        ))}
      </PresetStrip>

      {/* ── Anchor for all dropdowns ── */}
      <DropdownAnchor ref={anchorRef}>
        {/* ── Quarter picker button ── */}
        <div style={{ display: "flex", gap: 6 }}>
          <CustomButton
            $active={isQuarterActive || openView === "quarter"}
            onClick={() =>
              setOpenView((v) => (v === "quarter" ? "none" : "quarter"))
            }
            title={
              isAnnualFiling
                ? "Select Tax Year"
                : "Select a specific BIR quarter"
            }
          >
            <SealCheckIcon size={12} />
            {isAnnualFiling
              ? `Year ${value.from.getFullYear()}`
              : isQuarterActive
                ? `Q${activeBirParsed!.q} ${activeBirParsed!.year}`
                : "Quarter"}
            <CaretDownIcon size={10} />
          </CustomButton>

          {/* ── Filing return type (only in filing mode) ── */}
          {isBirActive && (
            <CustomButton
              $active={openView === "filing"}
              onClick={() =>
                setOpenView((v) => (v === "filing" ? "none" : "filing"))
              }
              title="Select BIR return type"
            >
              <ReceiptIcon size={12} />
              {activeReturnTypeOption?.short ?? "Return"}
              <CaretDownIcon size={10} />
            </CustomButton>
          )}

          {/* ── Custom range button ── */}
          <CustomButton
            $active={isCustomActive || openView === "custom"}
            onClick={() =>
              setOpenView((v) => (v === "custom" ? "none" : "custom"))
            }
          >
            <CalendarDotsIcon size={12} />
            {isCustomActive
              ? `${fmtShort(value.from)} — ${fmtShort(value.to)}`
              : "Custom"}
            <CaretDownIcon size={10} />
          </CustomButton>
        </div>

        {/* ── Quarter picker dropdown ── */}
        {openView === "quarter" && (
          <Dropdown $width={260}>
            <DropSection>
              <DropSectionTitle>Select Quarter</DropSectionTitle>
              <QuarterPicker
                activePreset={activePreset}
                dateMode={dateMode}
                birReturnType={birReturnType}
                onSelect={onChange}
                onClose={() => setOpenView("none")}
                setViewYear={setViewYear}
                viewYear={viewYear}
              />
            </DropSection>

            {/* Show deadline info if filing mode */}
            {isBirActive && activeBirParsed && activeBirDeadline && (
              <DeadlineBadge $overdue={isDeadlineOverdue}>
                <SealCheckIcon size={12} />
                Deadline:{" "}
                {activeBirDeadline.toLocaleDateString("en-PH", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
                {isDeadlineOverdue ? " · Overdue" : ""}
              </DeadlineBadge>
            )}
          </Dropdown>
        )}

        {/* ── Return type dropdown ── */}
        {openView === "filing" && (
          <Dropdown $width={320}>
            <DropSection>
              <DropSectionTitle>BIR Return Type</DropSectionTitle>
              <ReturnTypeGrid>
                {RETURN_TYPE_OPTIONS.map((opt) => (
                  <ReturnTypeBtn
                    key={opt.value}
                    $active={birReturnType === opt.value}
                    onClick={() => {
                      handleReturnType(opt.value);
                      setOpenView("none");
                    }}
                  >
                    <ReturnTypeShort>{opt.short}</ReturnTypeShort>
                    <ReturnTypeLabel>{opt.label}</ReturnTypeLabel>
                    {birReturnType === opt.value && (
                      <CheckIcon size={12} weight="bold" />
                    )}
                  </ReturnTypeBtn>
                ))}
              </ReturnTypeGrid>
            </DropSection>
          </Dropdown>
        )}

        {/* ── Custom date range dropdown ── */}
        {openView === "custom" && (
          <Dropdown $width={280}>
            <DateInputRow>
              <DropLabel>From</DropLabel>
              <DateInput
                type="datetime-local"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
              />
            </DateInputRow>
            <DateInputRow>
              <DropLabel>To</DropLabel>
              <DateInput
                type="datetime-local"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
              />
            </DateInputRow>
            <ApplyBtn onClick={handleApplyCustom}>
              <CheckIcon size={13} weight="bold" />
              Apply Range
            </ApplyBtn>
          </Dropdown>
        )}
      </DropdownAnchor>

      {/* ── Range summary ── */}
      <RangeSummary>
        {fmt(value.from)} — {fmt(value.to)}
        {dateMode === "filing" && (
          <span style={{ opacity: 0.6 }}>
            {" "}
            · {activeReturnTypeOption?.short ?? ""} filing
          </span>
        )}
      </RangeSummary>
    </Wrapper>
  );
};

export default PeriodFilter;
