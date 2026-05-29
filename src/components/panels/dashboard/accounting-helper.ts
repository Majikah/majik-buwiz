/**
 * @file tax-computation-helper.ts
 *
 * Bridges BuwizDashboardPanel state (PeriodFilter selections)
 * to TaxAccountant / adapter instantiation.
 *
 * Drop this next to BuwizDashboardPanel.tsx and import from it.
 */

import {
  FilingContextBuilder,
  FilingPeriodHelper,
} from "@/SDK/majik-buwiz-client/src/core/accounting/filing-context";
import { TaxAccountant } from "@/SDK/majik-buwiz-client/src/core/accounting/tax-accounting";
import { Form1701QAdapter } from "@/SDK/majik-buwiz-client/src/core/accounting/adapters/forms/form-1701q";
import { Form1701AAdapter } from "@/SDK/majik-buwiz-client/src/core/accounting/adapters/forms/form-1701a";
import { Form2550MAdapter } from "@/SDK/majik-buwiz-client/src/core/accounting/adapters/forms/form-2550m";
import { Form2550QAdapter } from "@/SDK/majik-buwiz-client/src/core/accounting/adapters/forms/form-2550q";
import { Form2551QAdapter } from "@/SDK/majik-buwiz-client/src/core/accounting/adapters/forms/form-2551q";

import type { BIRReturnType } from "@/SDK/bir-tax-period";
import type { MajikInvoice } from "@majikah/majik-invoice";
import type {
  DateRange,
  PresetKey,
} from "@/components/functional/PeriodFilter";
import type {
  TaxpayerProfile,
  PeriodFilingContext,
  FilingPeriod,
  BaseFilingOutput,
} from "@/SDK/majik-buwiz-client/src/core/accounting/types";
import { FilingExportConfig } from "./modals/FilingConfigModal";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TaxComputationInput {
  activePreset: PresetKey;
  birReturnType: BIRReturnType;
  range: DateRange;
  invoices: MajikInvoice[];
  profile: TaxpayerProfile;
  currency?: string;
  /**
   * Placeholder for expenses — wire up your expense source here later.
   * The builder accepts an empty array safely.
   */
  expenses?: PeriodFilingContext["expenses"];
  /** Adapter-specific config collected from FilingConfigModal */
  adapterConfig?: FilingExportConfig["adapterConfig"];
}

export interface TaxComputationResult {
  output: BaseFilingOutput;
  summary: ReturnType<typeof TaxAccountant.prototype.summarize>;
  formCode: string;
  period: FilingPeriod;
  /** Human-readable description of what was computed */
  description: string;
}

export class TaxComputationError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "UNSUPPORTED_RETURN_TYPE"
      | "UNSUPPORTED_PRESET"
      | "NO_PERIOD"
      | "ADAPTER_ERROR",
  ) {
    super(message);
    this.name = "TaxComputationError";
  }
}

// ---------------------------------------------------------------------------
// Period resolution
// ---------------------------------------------------------------------------

/**
 * Derives a FilingPeriod from the active PeriodFilter state.
 *
 * Priority:
 *  1. bir_q{n}_{year} preset → quarter-specific period
 *  2. annual / 2year / 3year / 5year presets → annual period for current year
 *  3. quarterly preset → current quarter of current year
 *  4. monthly preset → current month of current year
 *  5. custom / weekly / daily / time → derive from range dates
 */
export function resolveFilingPeriod(
  activePreset: PresetKey,
  range: DateRange,
  birReturnType: BIRReturnType,
): FilingPeriod {
  // ── bir_q{n}_{year} preset ─────────────────────────────────────────────
  const birMatch = /^bir_q(\d)_(\d{4})$/.exec(activePreset);
  if (birMatch) {
    const quarter = Number(birMatch[1]) as 1 | 2 | 3 | 4;
    const year = Number(birMatch[2]);

    if (birReturnType === "income_annual") {
      return FilingPeriodHelper.annual(year);
    }
    if (birReturnType === "vat_monthly") {
      // The quarter picker doesn't resolve to a single month — use month 1 of the quarter.
      // User should switch to custom range for monthly VAT.
      const monthOffset = (quarter - 1) * 3 + 1;
      return FilingPeriodHelper.month(year, monthOffset);
    }
    return FilingPeriodHelper.quarter(year, quarter);
  }
  // Derive year/month from the selected range (start of the range is authoritative)
  const fromYear = range.from.getFullYear();
  const fromMonth = range.from.getMonth() + 1;

  // ── annual / multi-year → use the start-of-range year for annual filing
  if (
    activePreset === "annual" ||
    activePreset === "2year" ||
    activePreset === "3year" ||
    activePreset === "5year"
  ) {
    if (birReturnType === "income_annual") {
      // In filing mode the UI selects a filing year; the income tax annual
      // period corresponds to the previous tax year (filed next year).
      return FilingPeriodHelper.annual(fromYear);
    }
    if (birReturnType === "vat_quarterly") {
      return FilingPeriodHelper.annual(fromYear);
    }
    // Fall through to quarter/month below for quarterly returns on multi-year
  }

  if (activePreset === "quarterly") {
    const quarter = (Math.floor((fromMonth - 1) / 3) + 1) as 1 | 2 | 3 | 4;

    if (birReturnType === "income_annual") {
      return FilingPeriodHelper.annual(fromYear - 1);
    }
    if (birReturnType === "vat_monthly") {
      return FilingPeriodHelper.month(fromYear, fromMonth);
    }
    return FilingPeriodHelper.quarter(fromYear, quarter);
  }

  if (activePreset === "monthly") {
    const month = fromMonth;
    if (birReturnType === "vat_monthly") {
      return FilingPeriodHelper.month(fromYear, month);
    }
    // Quarterly forms on a monthly filter → use the quarter that contains this month
    const quarter = (Math.floor((month - 1) / 3) + 1) as 1 | 2 | 3 | 4;
    if (birReturnType === "income_annual") {
      return FilingPeriodHelper.annual(fromYear - 1);
    }
    return FilingPeriodHelper.quarter(fromYear, quarter);
  }

  // ── Fallback: derive from range dates
  if (birReturnType === "income_annual") {
    return FilingPeriodHelper.annual(fromYear - 1);
  }
  if (birReturnType === "vat_monthly") {
    return FilingPeriodHelper.month(fromYear, fromMonth);
  }

  // Quarterly default
  const quarter = (Math.floor((fromMonth - 1) / 3) + 1) as 1 | 2 | 3 | 4;
  return FilingPeriodHelper.quarter(fromYear, quarter);
}

// ---------------------------------------------------------------------------
// Adapter factory
// ---------------------------------------------------------------------------

/**
 * Instantiates the correct BIR form adapter for the selected return type
 * and derived filing period.
 */
export function createAdapter(
  birReturnType: BIRReturnType,
  period: FilingPeriod,
  adapterConfig?: FilingExportConfig["adapterConfig"],
): ReturnType<typeof _createAdapterInternal> {
  return _createAdapterInternal(birReturnType, period, adapterConfig);
}

function _createAdapterInternal(
  birReturnType: BIRReturnType,
  period: FilingPeriod,
  adapterConfig?: FilingExportConfig["adapterConfig"],
) {
  switch (birReturnType) {
    case "income_quarterly": {
      const quarter = period.quarter ?? 1;
      return new Form1701QAdapter({ quarter, ...adapterConfig });
    }

    case "income_annual": {
      return new Form1701AAdapter({
        // deductionMethodOverride: "osd",
        // paymentMode: "installment",
        ...adapterConfig,
      });
    }

    case "vat_monthly": {
      return new Form2550MAdapter({ ...adapterConfig });
    }

    case "vat_quarterly": {
      const quarter = period.quarter ?? 1;
      return new Form2550QAdapter({ quarter, ...adapterConfig });
    }

    case "percentage_quarterly": {
      const quarter = period.quarter ?? 1;
      return new Form2551QAdapter({ quarter, ...adapterConfig });
    }

    case "withholding": {
      // 1601-EQ (quarterly withholding) — the adapter doesn't exist in the
      // codebase yet; fall through to a helpful error.
      throw new TaxComputationError(
        "Form 1601-EQ (Quarterly Withholding) adapter is not yet implemented. " +
          "Select a different return type.",
        "UNSUPPORTED_RETURN_TYPE",
      );
    }

    default:
      throw new TaxComputationError(
        `Unsupported BIR return type: "${birReturnType}".`,
        "UNSUPPORTED_RETURN_TYPE",
      );
  }
}

// ---------------------------------------------------------------------------
// Description helpers
// ---------------------------------------------------------------------------

const RETURN_TYPE_LABELS: Record<BIRReturnType, string> = {
  income_quarterly: "Quarterly Income Tax (1701Q)",
  income_annual: "Annual Income Tax (1701A)",
  vat_quarterly: "Quarterly VAT (2550Q)",
  vat_monthly: "Monthly VAT (2550M)",
  percentage_quarterly: "Quarterly Percentage Tax (2551Q)",
  withholding: "Quarterly Withholding (1601-EQ)",
};

function periodLabel(period: FilingPeriod): string {
  if (period.quarter) return `Q${period.quarter} ${period.year}`;
  if (period.month) {
    const name = new Date(period.year, period.month - 1, 1).toLocaleString(
      "en-PH",
      { month: "long" },
    );
    return `${name} ${period.year}`;
  }
  return `FY ${period.year}`;
}

// ---------------------------------------------------------------------------
// Main computation function
// ---------------------------------------------------------------------------

/**
 * Resolves the period + adapter, builds the filing context, and runs
 * TaxAccountant.prepare(). Returns a typed result object or throws.
 *
 * Usage in BuwizDashboardPanel:
 *
 *   const result = await computeTax({
 *     activePreset,
 *     birReturnType,
 *     range,
 *     invoices,
 *     profile,
 *     currency,
 *     expenses: [],   // placeholder — wire up later
 *   });
 *
 *   console.log(result.output);
 *   console.log(result.summary);
 */
export async function computeTax(
  input: TaxComputationInput,
): Promise<TaxComputationResult> {
  const {
    activePreset,
    birReturnType,
    range,
    invoices,
    profile,
    currency = "PHP",
    expenses = [], // placeholder
    adapterConfig,
  } = input;

  // 1. Derive filing period from PeriodFilter state
  const period = resolveFilingPeriod(activePreset, range, birReturnType);

  // 2. Instantiate the right adapter
  const adapter = createAdapter(birReturnType, period, adapterConfig);

  // 3. Build the filing context
  //    FilingContextBuilder filters invoices by period.start – period.end,
  //    resolves encrypted invoices gracefully, and validates the profile.
  const context = await FilingContextBuilder.from({
    profile,
    period,
    taxYear: period.year,
    currency,
    invoices: invoices as any, // MajikInvoice[] satisfies ResolvableInvoice[]
    expenses,
    options: {
      // dryRun: true lets compute() proceed even with non-fatal warnings
      // (e.g. missing prior quarter outputs on Q2+).
      // Set to false when you want strict validation.
      dryRun: true,
    },
  }).build();

  // 4. Run TaxAccountant
  const ta = TaxAccountant.init({ adapter: adapter as any, context });
  const output = ta.prepare();
  const summary = ta.summarize();

  const description = `${RETURN_TYPE_LABELS[birReturnType]} · ${periodLabel(period)}`;

  return { output, summary, formCode: adapter.formCode, period, description };
}
