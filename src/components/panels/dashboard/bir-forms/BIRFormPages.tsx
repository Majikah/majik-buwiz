/**
 * @file BIRFormPages.tsx
 *
 * react-pdf/renderer pages for each BIR form output.
 * Appended to MajikBuwizSummaryDocument when filing mode is active.
 *
 * Each page mirrors the logical structure of the BIR form —
 * not a pixel-perfect reproduction, but a readable, auditable layout
 * that groups items the same way the actual form does.
 *
 * Pages exported:
 *   BIRFormPage1701Q  — Quarterly Income Tax Return
 *   BIRFormPage1701A  — Annual Income Tax Return
 *   BIRFormPage2550M  — Monthly VAT Declaration
 *   BIRFormPage2550Q  — Quarterly VAT Return
 *   BIRFormPage2551Q  — Quarterly Percentage Tax Return
 *   renderBIRFormPage — dispatcher, call this from the document
 */

import React from "react";
import { Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { Form1701QOutput } from "@/SDK/majik-buwiz-client/src/core/accounting/adapters/forms/form-1701q";
import type { Form1701AOutput } from "@/SDK/majik-buwiz-client/src/core/accounting/adapters/forms/form-1701a";
import type { Form2550MFilingOutput } from "@/SDK/majik-buwiz-client/src/core/accounting/adapters/forms/form-2550m";
import type { Form2550QFilingOutput } from "@/SDK/majik-buwiz-client/src/core/accounting/adapters/forms/form-2550q";
import type { Form2551QOutput } from "@/SDK/majik-buwiz-client/src/core/accounting/adapters/forms/form-2551q";
import type { BaseFilingOutput } from "@/SDK/majik-buwiz-client/src/core/accounting/types";

// ---------------------------------------------------------------------------
// Colours — reuse same palette as MajikBuwizSummaryDocument
// ---------------------------------------------------------------------------

const C = {
  ink: "#151515",
  inkFaint: "#514f4f",
  brand: "#ea7f05",
  brandSoft: "#f8eee2",
  brandMid: "#f2e0cb",
  green: "#9b9e00",
  red: "#ff471e",
  border: "#f2e0cb",
  borderLight: "#f8eee2",
  white: "#f8eee2",
  pageBackground: "#f8eee2",
  blue: "#002968",
  blueSoft: "#EBF3FC",
  amber: "#ea7f05",
  amberSoft: "#FFF3E0",
  sectionLabel: "#514f4f",
} as const;

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

function fmtPHP(n: number): string {
  try {
    const abs = Math.abs(n);
    const sign = n < 0 ? "-" : "";
    return `${sign}PHP ${new Intl.NumberFormat("en-PH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(abs)}`;
  } catch {
    return `PHP ${n.toFixed(2)}`;
  }
}

function fmtPct(n: number): string {
  return `${(n * 100).toFixed(2)}%`;
}

// ---------------------------------------------------------------------------
// StyleSheet
// ---------------------------------------------------------------------------

const S = StyleSheet.create({
  page: {
    backgroundColor: C.pageBackground,
    paddingTop: 36,
    paddingBottom: 52,
    paddingHorizontal: 40,
    fontFamily: "Helvetica",
    fontSize: 9,
    color: C.ink,
  },

  // Header
  pageHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
    paddingBottom: 10,
    borderBottomWidth: 2,
    borderBottomColor: C.brand,
  },
  pageHeaderTitle: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: C.brand,
  },
  pageHeaderSub: { fontSize: 7, color: C.inkFaint, marginTop: 2 },
  pageHeaderBadge: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 0.5,
    color: C.white,
    backgroundColor: C.brand,
    paddingVertical: 2,
    paddingHorizontal: 7,
    borderRadius: 3,
  },

  // Taxpayer info block
  taxpayerBlock: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
    backgroundColor: C.white,
    borderRadius: 5,
    border: `1pt solid ${C.border}`,
    padding: 10,
  },
  taxpayerCell: { flex: 1 },
  taxpayerLabel: { fontSize: 7, color: C.inkFaint, marginBottom: 2 },
  taxpayerValue: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: C.ink,
  },

  // Section
  sectionTitle: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: C.sectionLabel,
    marginBottom: 5,
    marginTop: 8,
  },

  // Line item table
  lineTable: {
    backgroundColor: C.white,
    borderRadius: 5,
    border: `1pt solid ${C.border}`,
    marginBottom: 8,
    overflow: "hidden",
  },
  lineTableHeader: {
    flexDirection: "row",
    backgroundColor: C.brand,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  lineTableHeaderCell: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: C.white,
    letterSpacing: 0.3,
  },
  lineRow: {
    flexDirection: "row",
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.borderLight,
  },
  lineRowAlt: { backgroundColor: C.brandSoft },
  lineRowTotal: { backgroundColor: C.brandMid },
  lineLabel: { fontSize: 8, color: C.ink },
  lineItem: { fontSize: 7, color: C.inkFaint },
  lineValue: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: C.ink,
    textAlign: "right",
  },
  lineValueMuted: {
    fontSize: 7,
    color: C.inkFaint,
    textAlign: "right",
  },

  // Summary box
  summaryBox: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: C.white,
    borderRadius: 5,
    border: `1pt solid ${C.border}`,
    padding: 10,
  },
  summaryLabel: { fontSize: 7, color: C.inkFaint, marginBottom: 3 },
  summaryValue: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: C.ink,
    letterSpacing: -0.3,
  },
  summaryValueGreen: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: C.green,
    letterSpacing: -0.3,
  },
  summaryValueRed: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: C.red,
    letterSpacing: -0.3,
  },
  summaryValueAmber: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: C.amber,
    letterSpacing: -0.3,
  },
  summaryStripe: {
    height: 3,
    borderRadius: 2,
    marginBottom: 7,
  },

  // Validation issues
  validationBox: {
    marginTop: 8,
    padding: 8,
    borderRadius: 4,
    border: `1pt solid ${C.amber}`,
    backgroundColor: C.amberSoft,
  },
  validationTitle: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: C.amber,
    marginBottom: 4,
  },
  validationItem: { fontSize: 7, color: C.ink, marginBottom: 2 },

  // Footer
  footer: {
    position: "absolute",
    bottom: 18,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: C.borderLight,
    paddingTop: 5,
  },
  footerText: { fontSize: 7, color: C.inkFaint },

  // Two-col
  twoCol: { flexDirection: "row", gap: 8 },
  col: { flex: 1 },

  // Reconciliation
  reconBox: {
    marginTop: 8,
    padding: 8,
    borderRadius: 4,
    border: `1pt solid ${C.border}`,
    backgroundColor: C.white,
  },
  reconTitle: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: C.ink,
    marginBottom: 4,
  },
  reconRow: {
    flexDirection: "row",
    paddingVertical: 2,
    borderBottomWidth: 1,
    borderBottomColor: C.borderLight,
  },
});

// ---------------------------------------------------------------------------
// Shared sub-components
// ---------------------------------------------------------------------------

const BIRPageHeader: React.FC<{
  formCode: string;
  formTitle: string;
  periodLabel: string;
  badgeLabel: string;
}> = ({ formCode, formTitle, periodLabel, badgeLabel }) => (
  <View style={S.pageHeader} fixed>
    <View>
      <Text style={S.pageHeaderTitle}>
        {formCode} — {formTitle}
      </Text>
      <Text style={S.pageHeaderSub}>
        {periodLabel} · Generated by Majik Buwiz
      </Text>
    </View>
    <Text style={S.pageHeaderBadge}>{badgeLabel}</Text>
  </View>
);

const TaxpayerBlock: React.FC<{
  tin: string;
  legalName: string;
  rdoCode: string;
  taxYear: number;
}> = ({ tin, legalName, rdoCode, taxYear }) => (
  <View style={S.taxpayerBlock}>
    <View style={S.taxpayerCell}>
      <Text style={S.taxpayerLabel}>Taxpayer / Registered Name</Text>
      <Text style={S.taxpayerValue}>{legalName}</Text>
    </View>
    <View style={[S.taxpayerCell, { maxWidth: 130 }]}>
      <Text style={S.taxpayerLabel}>TIN</Text>
      <Text style={S.taxpayerValue}>{tin}</Text>
    </View>
    <View style={[S.taxpayerCell, { maxWidth: 70 }]}>
      <Text style={S.taxpayerLabel}>RDO</Text>
      <Text style={S.taxpayerValue}>{rdoCode}</Text>
    </View>
    <View style={[S.taxpayerCell, { maxWidth: 70 }]}>
      <Text style={S.taxpayerLabel}>Tax Year</Text>
      <Text style={S.taxpayerValue}>{taxYear}</Text>
    </View>
  </View>
);

const LineRow: React.FC<{
  item: string;
  label: string;
  value: string;
  alt?: boolean;
  total?: boolean;
  muted?: boolean;
}> = ({ item, label, value, alt, total, muted }) => (
  <View
    style={[S.lineRow, alt ? S.lineRowAlt : {}, total ? S.lineRowTotal : {}]}
  >
    <Text style={[S.lineItem, { width: 36 }]}>{item}</Text>
    <Text
      style={[
        S.lineLabel,
        { flex: 1 },
        total ? { fontFamily: "Helvetica-Bold" } : {},
      ]}
    >
      {label}
    </Text>
    <Text style={muted ? S.lineValueMuted : S.lineValue}>{value}</Text>
  </View>
);

const SummaryCards: React.FC<{
  cards: Array<{
    label: string;
    value: string;
    stripe: string;
    variant?: "default" | "green" | "red" | "amber";
  }>;
}> = ({ cards }) => (
  <View style={S.summaryBox}>
    {cards.map((c, i) => (
      <View key={i} style={S.summaryCard}>
        <View style={[S.summaryStripe, { backgroundColor: c.stripe }]} />
        <Text style={S.summaryLabel}>{c.label}</Text>
        <Text
          style={
            c.variant === "green"
              ? S.summaryValueGreen
              : c.variant === "red"
                ? S.summaryValueRed
                : c.variant === "amber"
                  ? S.summaryValueAmber
                  : S.summaryValue
          }
        >
          {c.value}
        </Text>
      </View>
    ))}
  </View>
);

const ValidationIssues: React.FC<{ output: BaseFilingOutput }> = ({
  output,
}) => {
  const issues = output.validation.issues.filter(
    (i) => i.severity === "error" || i.severity === "warning",
  );
  if (issues.length === 0) return null;

  return (
    <View style={S.validationBox}>
      <Text style={S.validationTitle}>
        {output.validation.errors.length > 0
          ? `${output.validation.errors.length} Validation Error(s)`
          : `${output.validation.warnings.length} Warning(s)`}
      </Text>
      {issues.slice(0, 6).map((issue, i) => (
        <Text key={i} style={S.validationItem}>
          [{issue.severity.toUpperCase()}] {issue.code}
          {issue.field ? ` (${issue.field})` : ""}: {issue.message}
        </Text>
      ))}
      {issues.length > 6 && (
        <Text style={S.validationItem}>
          ...and {issues.length - 6} more issue(s).
        </Text>
      )}
    </View>
  );
};

const BIRPageFooter: React.FC<{ formCode: string; period: string }> = ({
  formCode,
  period,
}) => (
  <View style={S.footer} fixed>
    <Text style={S.footerText}>BIR Form {formCode}</Text>
    <Text style={S.footerText}>{period} · Majik Buwiz</Text>
    <Text
      style={S.footerText}
      render={({
        pageNumber,
        totalPages,
      }: {
        pageNumber: number;
        totalPages: number;
      }) => `Page ${pageNumber} of ${totalPages}`}
    />
  </View>
);

// ---------------------------------------------------------------------------
// Form 1701Q page
// ---------------------------------------------------------------------------

export const BIRFormPage1701Q: React.FC<{ output: Form1701QOutput }> = ({
  output,
}) => {
  const f = output.filer;
  const s = output.spouse;
  const periodLabel = output.period.quarter
    ? `Q${output.period.quarter} ${output.period.year}`
    : `FY ${output.period.year}`;

  return (
    <Page size="A4" style={S.page} wrap>
      <BIRPageHeader
        formCode="1701Q"
        formTitle="Quarterly Income Tax Return"
        periodLabel={periodLabel}
        badgeLabel={`Q${output.quarter} ${output.taxYear}`}
      />

      <TaxpayerBlock
        tin={output.taxpayer.tin}
        legalName={output.taxpayer.legalName}
        rdoCode={output.taxpayer.rdoCode}
        taxYear={output.taxYear}
      />

      {/* Part I info */}
      <View style={S.twoCol}>
        <View style={S.col}>
          <Text style={S.sectionTitle}>Return Info</Text>
          <View style={S.lineTable}>
            <LineRow
              item="—"
              label="Tax Rate Election"
              value={
                output.taxRateElection === "graduated" ? "Graduated" : "Flat 8%"
              }
            />
            <LineRow
              item="—"
              label="Deduction Method"
              value={output.deductionMethod.toUpperCase()}
              alt
            />
            <LineRow item="—" label="Quarter" value={`Q${output.quarter}`} />
            <LineRow
              item="—"
              label="Amended Return"
              value={output.isAmended ? "Yes" : "No"}
              alt
            />
          </View>
        </View>
        <View style={S.col}>
          <Text style={S.sectionTitle}>Deduction Detail</Text>
          <View style={S.lineTable}>
            {output.deductionDetail.method === "osd" ? (
              <>
                <LineRow item="—" label="Method" value="OSD (40%)" />
                <LineRow
                  item="—"
                  label="OSD Base"
                  value={fmtPHP(output.deductionDetail.osdBase ?? 0)}
                  alt
                />
                <LineRow
                  item="—"
                  label="OSD Amount"
                  value={fmtPHP(output.deductionDetail.osdAmount ?? 0)}
                />
              </>
            ) : (
              <>
                <LineRow item="—" label="Method" value="Itemized" />
                <LineRow
                  item="—"
                  label="Itemized Total"
                  value={fmtPHP(output.deductionDetail.itemizedTotal ?? 0)}
                  alt
                />
                <LineRow
                  item="—"
                  label="Representation Cap"
                  value={fmtPHP(output.deductionDetail.representationCap ?? 0)}
                />
                <LineRow
                  item="—"
                  label="Representation Allowed"
                  value={fmtPHP(
                    output.deductionDetail.representationAllowed ?? 0,
                  )}
                  alt
                />
              </>
            )}
          </View>
        </View>
      </View>

      {/* Part II — Filer column */}
      <Text style={S.sectionTitle}>
        Part II — Income Declaration (Column A: Filer
        {s ? " | Column B: Spouse" : ""})
      </Text>
      <View style={S.lineTable}>
        <View style={S.lineTableHeader}>
          <Text style={[S.lineTableHeaderCell, { width: 36 }]}>Item</Text>
          <Text style={[S.lineTableHeaderCell, { flex: 1 }]}>Description</Text>
          <Text
            style={[S.lineTableHeaderCell, { width: 120, textAlign: "right" }]}
          >
            Column A (Filer)
          </Text>
          {s && (
            <Text
              style={[
                S.lineTableHeaderCell,
                { width: 120, textAlign: "right" },
              ]}
            >
              Column B (Spouse)
            </Text>
          )}
        </View>

        {[
          {
            item: "26",
            label: "Gross Sales/Revenues/Receipts/Fees",
            a: f.grossRevenues,
            b: s?.grossRevenues,
          },
          { item: "27", label: "GPP Income", a: f.gppIncome, b: s?.gppIncome },
          {
            item: "28",
            label: "Total Revenues (26 + 27)",
            a: f.totalRevenues,
            b: s?.totalRevenues,
          },
          {
            item: "29",
            label: "Less: Cost of Sales/Service",
            a: f.costOfSales,
            b: s?.costOfSales,
          },
          {
            item: "30",
            label: "Gross Income from Operations (28 - 29)",
            a: f.grossIncomeFromOperations,
            b: s?.grossIncomeFromOperations,
          },
          {
            item: "31",
            label: "Add: Other Income",
            a: f.otherIncome,
            b: s?.otherIncome,
          },
          {
            item: "32",
            label: "Total Gross Income (30 + 31)",
            a: f.totalGrossIncome,
            b: s?.totalGrossIncome,
          },
          {
            item: "33",
            label: "Less: Allowable Deductions",
            a: f.deductions,
            b: s?.deductions,
          },
          {
            item: "34",
            label: "Taxable Income This Quarter (32 - 33)",
            a: f.taxableIncomeThisQuarter,
            b: s?.taxableIncomeThisQuarter,
          },
          {
            item: "35",
            label: "Add: Taxable Income Previous Quarter(s)",
            a: f.taxableIncomePreviousQuarters,
            b: s?.taxableIncomePreviousQuarters,
          },
          {
            item: "36",
            label: "Taxable Income To Date (34 + 35)",
            a: f.taxableIncomeToDate,
            b: s?.taxableIncomeToDate,
          },
          { item: "37", label: "Income Tax Due", a: f.taxDue, b: s?.taxDue },
        ].map((row, i) => (
          <View
            key={row.item}
            style={[
              S.lineRow,
              i % 2 === 1 ? S.lineRowAlt : {},
              row.item === "37" ? S.lineRowTotal : {},
            ]}
          >
            <Text style={[S.lineItem, { width: 36 }]}>{row.item}</Text>
            <Text style={[S.lineLabel, { flex: 1 }]}>{row.label}</Text>
            <Text style={[S.lineValue, { width: 120 }]}>{fmtPHP(row.a)}</Text>
            {s && (
              <Text style={[S.lineValue, { width: 120 }]}>
                {row.b !== undefined ? fmtPHP(row.b) : "—"}
              </Text>
            )}
          </View>
        ))}
      </View>

      {/* Item 38 credits */}
      <Text style={S.sectionTitle}>Item 38 — Tax Credits / Payments</Text>
      <View style={S.lineTable}>
        {[
          {
            item: "38A",
            label: "Prior Year's Excess Credits",
            a: f.priorYearExcessCredits,
          },
          {
            item: "38C",
            label: "Tax Payments for Previous Quarter(s)",
            a: f.priorQuarterPayments,
          },
          {
            item: "38E",
            label: "CWT Withheld Previous Quarter(s)",
            a: f.cwtPreviousQuarters,
          },
          {
            item: "38G",
            label: "CWT Withheld This Quarter (Form 2307)",
            a: f.cwtThisQuarter,
          },
          {
            item: "38I",
            label: "Tax Paid in Previously Filed Return",
            a: f.taxPaidAmended,
          },
          {
            item: "38K",
            label: "Other Payments (Form 0605)",
            a: f.otherPayments,
          },
          {
            item: "38M",
            label: "Total Tax Credits / Payments",
            a: f.totalCredits,
          },
        ].map((row, i) => (
          <View
            key={row.item}
            style={[
              S.lineRow,
              i % 2 === 1 ? S.lineRowAlt : {},
              row.item === "38M" ? S.lineRowTotal : {},
            ]}
          >
            <Text style={[S.lineItem, { width: 36 }]}>{row.item}</Text>
            <Text style={[S.lineLabel, { flex: 1 }]}>{row.label}</Text>
            <Text style={[S.lineValue, { width: 120 }]}>{fmtPHP(row.a)}</Text>
            {s && <Text style={[S.lineValue, { width: 120 }]}>—</Text>}
          </View>
        ))}
      </View>

      {/* Summary cards */}
      <SummaryCards
        cards={[
          {
            label: "Tax Due (Item 37)",
            value: fmtPHP(f.taxDue),
            stripe: C.brand,
          },
          {
            label: "Total Credits (Item 38M)",
            value: fmtPHP(f.totalCredits),
            stripe: C.green,
            variant: "green",
          },
          {
            label: f.isOverpayment
              ? "Overpayment (Item 39)"
              : "Tax Payable (Item 39)",
            value: fmtPHP(f.taxPayableOrOverpayment),
            stripe: f.isOverpayment ? C.green : C.red,
            variant: f.isOverpayment ? "green" : "red",
          },
          {
            label: "Total Amount Payable (Item 41)",
            value: fmtPHP(f.totalAmountPayable),
            stripe: f.totalAmountPayable === 0 ? C.green : C.brand,
            variant: f.totalAmountPayable === 0 ? "green" : "amber",
          },
        ]}
      />

      {s && (
        <View style={{ marginTop: 6 }}>
          <Text style={{ fontSize: 8, color: C.inkFaint }}>
            Item 41C — Aggregate Amount Payable (41A + 41B):{" "}
            <Text style={{ fontFamily: "Helvetica-Bold", color: C.ink }}>
              {fmtPHP(output.aggregateAmountPayable)}
            </Text>
          </Text>
        </View>
      )}

      <ValidationIssues output={output} />
      <BIRPageFooter formCode="1701Q" period={periodLabel} />
    </Page>
  );
};

// ---------------------------------------------------------------------------
// Form 1701A page
// ---------------------------------------------------------------------------

export const BIRFormPage1701A: React.FC<{ output: Form1701AOutput }> = ({
  output,
}) => {
  const periodLabel = `FY ${output.taxYear}`;
  const pII = output.partII;
  const pIVC = output.partIVC;
  const pIVA = output.partIVA;
  const pIVB = output.partIVB;

  return (
    <Page size="A4" style={S.page} wrap>
      <BIRPageHeader
        formCode="1701A"
        formTitle="Annual Income Tax Return"
        periodLabel={periodLabel}
        badgeLabel={`FY ${output.taxYear}`}
      />

      <TaxpayerBlock
        tin={output.taxpayer.tin}
        legalName={output.taxpayer.legalName}
        rdoCode={output.taxpayer.rdoCode}
        taxYear={output.taxYear}
      />

      {/* Return info */}
      <View style={S.twoCol}>
        <View style={S.col}>
          <Text style={S.sectionTitle}>Return Info</Text>
          <View style={S.lineTable}>
            <LineRow
              item="—"
              label="Tax Rate Election"
              value={
                output.taxRateElection === "graduated" ? "Graduated" : "Flat 8%"
              }
            />
            <LineRow
              item="—"
              label="Deduction Method"
              value={output.deductionMethod.toUpperCase()}
              alt
            />
            <LineRow
              item="—"
              label="Amended Return"
              value={output.isAmended ? "Yes" : "No"}
            />
            <LineRow
              item="—"
              label="Payment Mode"
              value={
                pII.paymentMode === "installment"
                  ? "Installment (50/50)"
                  : "Full"
              }
              alt
            />
          </View>
        </View>

        {/* Reconciliation summary */}
        <View style={S.col}>
          <Text style={S.sectionTitle}>Quarterly Reconciliation</Text>
          <View style={S.lineTable}>
            <LineRow
              item="—"
              label="Quarters Found"
              value={`${output.reconciliation.quartersFound} of 4`}
            />
            <LineRow
              item="—"
              label="Reconciled"
              value={
                output.reconciliation.matched
                  ? "✓ Matched"
                  : "⚠ Differences found"
              }
              alt
            />
            <LineRow
              item="—"
              label="Missing Quarters"
              value={
                output.reconciliation.quartersMissing.length === 0
                  ? "None"
                  : `Q${output.reconciliation.quartersMissing.join(", Q")}`
              }
            />
            <LineRow
              item="—"
              label="Tolerance"
              value={`PHP ${output.reconciliation.tolerance.toFixed(2)}`}
              alt
            />
          </View>
        </View>
      </View>

      {/* Part IV-A or Part IV-B */}
      {pIVA && (
        <>
          <Text style={S.sectionTitle}>
            Part IV-A — Graduated Income Tax Computation
          </Text>
          <View style={S.lineTable}>
            {[
              {
                item: "36",
                label: "Gross Sales/Revenues/Receipts/Fees",
                v: pIVA.grossRevenues,
              },
              {
                item: "37",
                label: "Less: Sales Returns, Allowances and Discounts",
                v: pIVA.salesReturnsAndDiscounts,
              },
              {
                item: "38",
                label: "Net Sales/Revenues/Receipts/Fees (36 - 37)",
                v: pIVA.netSales,
              },
              {
                item: "39",
                label: "Less: Allowable Deductions",
                v: pIVA.deductions,
              },
              {
                item: "40",
                label: "Net Income from Operations (38 - 39)",
                v: pIVA.netIncome,
              },
              { item: "41", label: "Other Income", v: pIVA.otherIncome },
              { item: "43", label: "GPP Income", v: pIVA.gppIncome },
              {
                item: "44",
                label: "Total Other Income (41 + 43)",
                v: pIVA.totalOtherIncome,
              },
              {
                item: "45",
                label: "Total Taxable Income (40 + 44)",
                v: pIVA.totalTaxableIncome,
              },
              {
                item: "46",
                label: "Tax Due (from rate table)",
                v: pIVA.taxDue,
              },
            ].map((r, i) => (
              <LineRow
                key={r.item}
                item={r.item}
                label={r.label}
                value={fmtPHP(r.v)}
                alt={i % 2 === 1}
                total={r.item === "46"}
              />
            ))}
          </View>
        </>
      )}

      {pIVB && (
        <>
          <Text style={S.sectionTitle}>
            Part IV-B — 8% Flat Income Tax Computation
          </Text>
          <View style={S.lineTable}>
            {[
              {
                item: "47",
                label: "Gross Sales/Revenues/Receipts/Fees",
                v: pIVB.grossRevenues,
              },
              {
                item: "48",
                label: "Less: Sales Returns, Allowances and Discounts",
                v: pIVB.salesReturnsAndDiscounts,
              },
              { item: "49", label: "Net Sales (47 - 48)", v: pIVB.netSales },
              {
                item: "53",
                label: "Total Taxable Income",
                v: pIVB.totalTaxableIncome,
              },
              {
                item: "54",
                label: "Less: Allowable Deduction (₱250,000)",
                v: pIVB.allowableDeduction,
              },
              {
                item: "55",
                label: "Taxable Income (53 - 54)",
                v: pIVB.taxableIncome,
              },
              { item: "56", label: "Tax Due (55 × 8%)", v: pIVB.taxDue },
            ].map((r, i) => (
              <LineRow
                key={r.item}
                item={r.item}
                label={r.label}
                value={fmtPHP(r.v)}
                alt={i % 2 === 1}
                total={r.item === "56"}
              />
            ))}
          </View>
        </>
      )}

      {/* Part IV-C credits */}
      <Text style={S.sectionTitle}>Part IV-C — Tax Credits / Payments</Text>
      <View style={S.lineTable}>
        {[
          {
            item: "57",
            label: "Prior Year's Excess Credits",
            v: pIVC.priorYearExcessCredits,
          },
          {
            item: "58",
            label: "Tax Payments for First Three Quarters",
            v: pIVC.firstThreeQuarterPayments,
          },
          {
            item: "59",
            label: "CWT Withheld — First Three Quarters",
            v: pIVC.cwtFirstThreeQuarters,
          },
          {
            item: "60",
            label: "CWT Withheld — Q4 per Form 2307",
            v: pIVC.cwtQ4,
          },
          {
            item: "61",
            label: "Tax Paid in Previously Filed Return (amended)",
            v: pIVC.taxPaidAmended,
          },
          {
            item: "62",
            label: "Foreign Tax Credits",
            v: pIVC.foreignTaxCredits,
          },
          {
            item: "63",
            label: "Other Tax Credits / Payments",
            v: pIVC.otherTaxCredits,
          },
          {
            item: "64",
            label: "Total Tax Credits / Payments",
            v: pIVC.totalCredits,
          },
          {
            item: "65",
            label: `${pIVC.isOverpayment ? "Overpayment" : "Net Tax Payable"} (Item 20 - Item 64)`,
            v: pIVC.netTaxable,
          },
        ].map((r, i) => (
          <LineRow
            key={r.item}
            item={r.item}
            label={r.label}
            value={fmtPHP(r.v)}
            alt={i % 2 === 1}
            total={r.item === "64" || r.item === "65"}
          />
        ))}
      </View>

      {/* Part II */}
      <Text style={S.sectionTitle}>Part II — Total Tax Payable</Text>
      <View style={S.lineTable}>
        {[
          { item: "20", label: "Tax Due (from Part IV)", v: pII.taxDue },
          { item: "21", label: "Total Tax Credits", v: pII.totalCredits },
          {
            item: "22",
            label: `${pII.isOverpayment ? "Overpayment" : "Tax Payable"} (20 - 21)`,
            v: pII.taxPayable,
          },
          {
            item: "23",
            label: "Less: 2nd Installment Portion (50%)",
            v: pII.secondInstallmentPortion,
          },
          {
            item: "24",
            label: "Amount Due Upon Filing",
            v: pII.amountDueUponFiling,
          },
          { item: "25", label: "Surcharge", v: pII.surcharge },
          { item: "26", label: "Interest", v: pII.interest },
          { item: "27", label: "Compromise", v: pII.compromise },
          {
            item: "28",
            label: "Total Penalties (25 + 26 + 27)",
            v: pII.totalPenalties,
          },
          {
            item: "29",
            label: "Total Amount Payable / (Overpayment)",
            v: pII.totalAmountPayable,
          },
        ].map((r, i) => (
          <LineRow
            key={r.item}
            item={r.item}
            label={r.label}
            value={fmtPHP(r.v)}
            alt={i % 2 === 1}
            total={r.item === "29"}
          />
        ))}
      </View>

      <SummaryCards
        cards={[
          {
            label: "Total Tax Due",
            value: fmtPHP(pII.taxDue),
            stripe: C.brand,
          },
          {
            label: "Total Credits",
            value: fmtPHP(pII.totalCredits),
            stripe: C.green,
            variant: "green",
          },
          {
            label: pII.isOverpayment ? "Overpayment" : "Amount Due Upon Filing",
            value: fmtPHP(pII.amountDueUponFiling),
            stripe: pII.isOverpayment ? C.green : C.red,
            variant: pII.isOverpayment ? "green" : "red",
          },
          {
            label: "2nd Installment (Jul 15)",
            value: fmtPHP(pII.secondInstallmentAmount),
            stripe: C.amber,
            variant: "amber",
          },
        ]}
      />

      <ValidationIssues output={output} />
      <BIRPageFooter formCode="1701A" period={periodLabel} />
    </Page>
  );
};

// ---------------------------------------------------------------------------
// Form 2550M page
// ---------------------------------------------------------------------------

export const BIRFormPage2550M: React.FC<{ output: Form2550MFilingOutput }> = ({
  output,
}) => {
  const periodLabel = output.period.month
    ? `Month ${output.period.month} ${output.period.year}`
    : `${output.period.year}`;
  const p1 = output.partI;
  const p2 = output.partII;
  const p3 = output.partIII;
  const p4 = output.partIV;

  return (
    <Page size="A4" style={S.page} wrap>
      <BIRPageHeader
        formCode="2550M"
        formTitle="Monthly VAT Declaration"
        periodLabel={periodLabel}
        badgeLabel={`Month ${output.month} ${output.taxYear}`}
      />

      <TaxpayerBlock
        tin={output.taxpayer.tin}
        legalName={output.taxpayer.legalName}
        rdoCode={output.taxpayer.rdoCode}
        taxYear={output.taxYear}
      />

      <View style={S.twoCol}>
        {/* Part I — Output VAT */}
        <View style={S.col}>
          <Text style={S.sectionTitle}>Part I — Output VAT</Text>
          <View style={S.lineTable}>
            <LineRow
              item="—"
              label="Vatable Sales (excl. VAT)"
              value={fmtPHP(p1.vatableSales.amount)}
            />
            <LineRow
              item="—"
              label="Output VAT (12%)"
              value={fmtPHP(p1.vatableSales.outputVat)}
              alt
            />
            <LineRow
              item="—"
              label="Zero-Rated Sales"
              value={fmtPHP(p1.zeroRatedSales.amount)}
            />
            <LineRow
              item="—"
              label="Exempt Sales"
              value={fmtPHP(p1.exemptSales.amount)}
              alt
            />
            <LineRow
              item="—"
              label="Total Sales"
              value={fmtPHP(p1.totalSales)}
              total
            />
            <LineRow
              item="—"
              label="Total Output VAT"
              value={fmtPHP(p1.totalOutputVat)}
              total
            />
          </View>
        </View>

        {/* Part II — Input VAT */}
        <View style={S.col}>
          <Text style={S.sectionTitle}>Part II — Input VAT</Text>
          <View style={S.lineTable}>
            <LineRow
              item="—"
              label="Beginning Excess Input VAT"
              value={fmtPHP(p2.beginningExcessInputVat)}
            />
            <LineRow
              item="—"
              label="Input VAT — Capital Goods"
              value={fmtPHP(p2.currentInputVat.totalCapitalGoods)}
              alt
            />
            <LineRow
              item="—"
              label="Input VAT — Other Goods"
              value={fmtPHP(p2.currentInputVat.totalGoodsOtherThanCapital)}
            />
            <LineRow
              item="—"
              label="Input VAT — Services"
              value={fmtPHP(p2.currentInputVat.totalServices)}
              alt
            />
            <LineRow
              item="—"
              label="Total Available Input VAT"
              value={fmtPHP(p2.totalAvailableInputVat)}
              total
            />
            <LineRow
              item="—"
              label="Less: Input VAT on Exempt Sales"
              value={fmtPHP(p2.inputVatOnExemptSales)}
            />
            <LineRow
              item="—"
              label="Net Creditable Input VAT"
              value={fmtPHP(p2.netCreditableInputVat)}
              total
            />
          </View>
        </View>
      </View>

      {/* Part III */}
      <Text style={S.sectionTitle}>Part III — VAT Payable</Text>
      <View style={S.lineTable}>
        <LineRow item="—" label="Output VAT" value={fmtPHP(p3.outputVat)} />
        <LineRow
          item="—"
          label="Less: Creditable Input VAT"
          value={fmtPHP(p3.creditableInputVat)}
          alt
        />
        <LineRow
          item="—"
          label="Less: VAT Withheld on Goods"
          value={fmtPHP(p3.vatWithheldOnGoods)}
        />
        <LineRow
          item="—"
          label="Less: VAT Withheld on Services"
          value={fmtPHP(p3.vatWithheldOnServices)}
          alt
        />
        <LineRow
          item="—"
          label="Total VAT Withheld"
          value={fmtPHP(p3.totalVatWithheld)}
        />
        <LineRow
          item="—"
          label={
            p3.isExcessInput
              ? "Excess Input VAT (carry forward)"
              : "VAT Payable"
          }
          value={fmtPHP(p3.isExcessInput ? p3.excessInputVat : p3.vatPayable)}
          total
        />
      </View>

      {/* Part IV */}
      <Text style={S.sectionTitle}>Part IV — Summary</Text>
      <View style={S.lineTable}>
        <LineRow item="—" label="VAT Payable" value={fmtPHP(p4.vatPayable)} />
        <LineRow
          item="—"
          label="Less: Tax Paid on Previous Return (amended)"
          value={fmtPHP(p4.taxPaidAmended)}
          alt
        />
        <LineRow item="—" label="Surcharge" value={fmtPHP(p4.surcharge)} />
        <LineRow item="—" label="Interest" value={fmtPHP(p4.interest)} alt />
        <LineRow item="—" label="Compromise" value={fmtPHP(p4.compromise)} />
        <LineRow
          item="—"
          label="Total Amount Due"
          value={fmtPHP(p4.totalAmountDue)}
          total
        />
      </View>

      <SummaryCards
        cards={[
          {
            label: "Output VAT",
            value: fmtPHP(p1.totalOutputVat),
            stripe: C.brand,
          },
          {
            label: "Net Creditable Input VAT",
            value: fmtPHP(p2.netCreditableInputVat),
            stripe: C.green,
            variant: "green",
          },
          {
            label: p3.isExcessInput
              ? "Excess Input VAT (carry fwd)"
              : "VAT Payable",
            value: fmtPHP(p3.isExcessInput ? p3.excessInputVat : p3.vatPayable),
            stripe: p3.isExcessInput ? C.green : C.red,
            variant: p3.isExcessInput ? "green" : "red",
          },
          {
            label: "Total Amount Due",
            value: fmtPHP(p4.totalAmountDue),
            stripe: C.amber,
            variant: "amber",
          },
        ]}
      />

      <ValidationIssues output={output} />
      <BIRPageFooter formCode="2550M" period={periodLabel} />
    </Page>
  );
};

// ---------------------------------------------------------------------------
// Form 2550Q page
// ---------------------------------------------------------------------------

export const BIRFormPage2550Q: React.FC<{ output: Form2550QFilingOutput }> = ({
  output,
}) => {
  const periodLabel = `Q${output.quarter} ${output.taxYear}`;
  const p1 = output.partI;
  const p2 = output.partII;
  const p3 = output.partIII;
  const p4 = output.partIV;
  const recon = output.reconciliation;

  return (
    <Page size="A4" style={S.page} wrap>
      <BIRPageHeader
        formCode="2550Q"
        formTitle="Quarterly Value-Added Tax Return"
        periodLabel={periodLabel}
        badgeLabel={`Q${output.quarter} ${output.taxYear}`}
      />

      <TaxpayerBlock
        tin={output.taxpayer.tin}
        legalName={output.taxpayer.legalName}
        rdoCode={output.taxpayer.rdoCode}
        taxYear={output.taxYear}
      />

      <View style={S.twoCol}>
        <View style={S.col}>
          <Text style={S.sectionTitle}>Part I — Output VAT</Text>
          <View style={S.lineTable}>
            <LineRow
              item="—"
              label="Vatable Sales (excl. VAT)"
              value={fmtPHP(p1.vatableSales.amount)}
            />
            <LineRow
              item="—"
              label="Output VAT (12%)"
              value={fmtPHP(p1.vatableSales.outputVat)}
              alt
            />
            <LineRow
              item="—"
              label="Zero-Rated Sales"
              value={fmtPHP(p1.zeroRatedSales.amount)}
            />
            <LineRow
              item="—"
              label="Exempt Sales"
              value={fmtPHP(p1.exemptSales.amount)}
              alt
            />
            <LineRow
              item="—"
              label="Total Sales"
              value={fmtPHP(p1.totalSales)}
              total
            />
            <LineRow
              item="—"
              label="Total Output VAT"
              value={fmtPHP(p1.totalOutputVat)}
              total
            />
          </View>
        </View>

        <View style={S.col}>
          <Text style={S.sectionTitle}>Part II — Input VAT</Text>
          <View style={S.lineTable}>
            <LineRow
              item="—"
              label="Beginning Excess Input VAT"
              value={fmtPHP(p2.beginningExcessInputVat)}
            />
            <LineRow
              item="—"
              label="Input VAT — Capital Goods"
              value={fmtPHP(p2.currentInputVat.totalCapitalGoods)}
              alt
            />
            <LineRow
              item="—"
              label="Input VAT — Other Goods"
              value={fmtPHP(p2.currentInputVat.totalGoodsOtherThanCapital)}
            />
            <LineRow
              item="—"
              label="Input VAT — Services"
              value={fmtPHP(p2.currentInputVat.totalServices)}
              alt
            />
            <LineRow
              item="—"
              label="Total Available Input VAT"
              value={fmtPHP(p2.totalAvailableInputVat)}
              total
            />
            <LineRow
              item="—"
              label="Less: Input VAT on Exempt Sales"
              value={fmtPHP(p2.inputVatOnExemptSales)}
            />
            <LineRow
              item="—"
              label="Net Creditable Input VAT"
              value={fmtPHP(p2.netCreditableInputVat)}
              total
            />
            <LineRow
              item="—"
              label="Capital Goods Source"
              value={
                p2.capitalGoodsSource === "inherited-from-monthly"
                  ? "Monthly 2550M"
                  : "Direct"
              }
              muted
            />
          </View>
        </View>
      </View>

      <Text style={S.sectionTitle}>Part III — VAT Payable</Text>
      <View style={S.lineTable}>
        <LineRow item="—" label="Output VAT" value={fmtPHP(p3.outputVat)} />
        <LineRow
          item="—"
          label="Less: Creditable Input VAT"
          value={fmtPHP(p3.creditableInputVat)}
          alt
        />
        <LineRow
          item="—"
          label="Total VAT Withheld (Government)"
          value={fmtPHP(p3.totalVatWithheld)}
        />
        <LineRow
          item="—"
          label={
            p3.isExcessInput
              ? "Excess Input VAT (carry forward)"
              : "VAT Payable"
          }
          value={fmtPHP(p3.isExcessInput ? p3.excessInputVat : p3.vatPayable)}
          total
        />
      </View>

      <Text style={S.sectionTitle}>
        Part IV — Summary with Monthly Payment Credit
      </Text>
      <View style={S.lineTable}>
        <LineRow
          item="—"
          label="Gross Quarterly VAT Payable"
          value={fmtPHP(p4.grossVatPayable)}
        />
        <LineRow
          item="—"
          label="Less: Monthly Payments Already Made (2550M)"
          value={fmtPHP(p4.monthlyPaymentsAlreadyMade)}
          alt
        />
        <LineRow
          item="—"
          label={p4.isOverpayment ? "Overpayment" : "Balance VAT Payable"}
          value={fmtPHP(p4.balanceVatPayable)}
          total
        />
        <LineRow
          item="—"
          label="Total Penalties"
          value={fmtPHP(p4.totalPenalties)}
        />
        <LineRow
          item="—"
          label="Total Amount Due"
          value={fmtPHP(p4.totalAmountDue)}
          total
        />
      </View>

      {/* Monthly breakdown */}
      {p4.monthlyPaymentBreakdown.length > 0 && (
        <>
          <Text style={S.sectionTitle}>Monthly Payment Breakdown</Text>
          <View style={S.lineTable}>
            {p4.monthlyPaymentBreakdown.map((m, i) => (
              <LineRow
                key={m.month}
                item={`M${m.month}`}
                label={`Month ${m.month} — 2550M Payment`}
                value={fmtPHP(m.amountPaid)}
                alt={i % 2 === 1}
              />
            ))}
          </View>
        </>
      )}

      {/* Reconciliation */}
      {recon.monthsFound > 0 && (
        <View style={S.reconBox}>
          <Text style={S.reconTitle}>
            Monthly Reconciliation —{" "}
            {recon.matched ? "✓ All fields matched" : "⚠ Differences found"}{" "}
            (tolerance: PHP {recon.tolerance.toFixed(2)})
          </Text>
          {recon.fields.map((f, i) => (
            <View
              key={f.field}
              style={[
                S.reconRow,
                i % 2 === 1 ? { backgroundColor: C.brandSoft } : {},
              ]}
            >
              <Text style={[S.lineItem, { flex: 1 }]}>{f.field}</Text>
              <Text style={[S.lineItem, { width: 90, textAlign: "right" }]}>
                Direct: {fmtPHP(f.directAmount)}
              </Text>
              <Text style={[S.lineItem, { width: 90, textAlign: "right" }]}>
                Monthly: {fmtPHP(f.monthlyAmount)}
              </Text>
              <Text
                style={[
                  S.lineItem,
                  {
                    width: 50,
                    textAlign: "right",
                    color: f.matched ? C.green : C.red,
                  },
                ]}
              >
                {f.matched ? "✓" : `Δ ${fmtPHP(f.difference)}`}
              </Text>
            </View>
          ))}
        </View>
      )}

      <SummaryCards
        cards={[
          {
            label: "Output VAT",
            value: fmtPHP(p1.totalOutputVat),
            stripe: C.brand,
          },
          {
            label: "Net Input VAT",
            value: fmtPHP(p2.netCreditableInputVat),
            stripe: C.green,
            variant: "green",
          },
          {
            label: "Monthly Already Paid",
            value: fmtPHP(p4.monthlyPaymentsAlreadyMade),
            stripe: C.blue,
          },
          {
            label: "Total Amount Due",
            value: fmtPHP(p4.totalAmountDue),
            stripe: p4.totalAmountDue === 0 ? C.green : C.red,
            variant: p4.totalAmountDue === 0 ? "green" : "red",
          },
        ]}
      />

      <ValidationIssues output={output} />
      <BIRPageFooter formCode="2550Q" period={periodLabel} />
    </Page>
  );
};

// ---------------------------------------------------------------------------
// Form 2551Q page
// ---------------------------------------------------------------------------

export const BIRFormPage2551Q: React.FC<{ output: Form2551QOutput }> = ({
  output,
}) => {
  const periodLabel = `Q${output.quarter} ${output.taxYear}`;
  const p = output.partII;
  const s = output.summary;

  return (
    <Page size="A4" style={S.page} wrap>
      <BIRPageHeader
        formCode="2551Q"
        formTitle="Quarterly Percentage Tax Return"
        periodLabel={periodLabel}
        badgeLabel={`Q${output.quarter} ${output.taxYear}`}
      />

      <TaxpayerBlock
        tin={output.taxpayer.tin}
        legalName={output.taxpayer.legalName}
        rdoCode={output.taxpayer.rdoCode}
        taxYear={output.taxYear}
      />

      <View style={S.twoCol}>
        <View style={S.col}>
          <Text style={S.sectionTitle}>Return Info</Text>
          <View style={S.lineTable}>
            <LineRow
              item="—"
              label="Applied Rate"
              value={fmtPct(output.appliedRate)}
            />
            <LineRow
              item="—"
              label="CREATE Act Rate (1%)"
              value={output.isCreateActRate ? "Yes" : "No"}
              alt
            />
            <LineRow
              item="—"
              label="Filing Deadline"
              value={output.filingDeadline}
            />
            <LineRow
              item="—"
              label="Amended"
              value={output.isAmended ? "Yes" : "No"}
              alt
            />
          </View>
        </View>
        <View style={S.col}>
          <Text style={S.sectionTitle}>Credits</Text>
          <View style={S.lineTable}>
            <LineRow
              item="19"
              label="Total Tax Due"
              value={fmtPHP(p.totalTaxDue)}
              total
            />
            <LineRow
              item="20A"
              label="CWT Withheld"
              value={fmtPHP(p.cwtWithheld)}
              alt
            />
            <LineRow
              item="20B"
              label="Tax Paid (Previous Return)"
              value={fmtPHP(p.taxPaidAmended)}
            />
            <LineRow
              item="21"
              label="Total Credits"
              value={fmtPHP(p.totalCredits)}
              total
            />
            <LineRow
              item="22"
              label={p.isOverpayment ? "Overpayment" : "Tax Payable"}
              value={fmtPHP(p.taxPayable)}
              total
            />
          </View>
        </View>
      </View>

      {/* Part II transaction rows */}
      <Text style={S.sectionTitle}>Part II — Transaction Rows</Text>
      <View style={S.lineTable}>
        <View style={S.lineTableHeader}>
          <Text style={[S.lineTableHeaderCell, { width: 36 }]}>Item</Text>
          <Text style={[S.lineTableHeaderCell, { flex: 1.5 }]}>
            Classification
          </Text>
          <Text style={[S.lineTableHeaderCell, { width: 50 }]}>ATC</Text>
          <Text
            style={[S.lineTableHeaderCell, { width: 100, textAlign: "right" }]}
          >
            Taxable Amount
          </Text>
          <Text
            style={[S.lineTableHeaderCell, { width: 50, textAlign: "right" }]}
          >
            Rate
          </Text>
          <Text
            style={[S.lineTableHeaderCell, { width: 90, textAlign: "right" }]}
          >
            Tax Due
          </Text>
        </View>
        {p.rows.map((row, i) => (
          <View
            key={row.itemLabel}
            style={[S.lineRow, i % 2 === 1 ? S.lineRowAlt : {}]}
          >
            <Text style={[S.lineItem, { width: 36 }]}>{row.itemLabel}</Text>
            <Text style={[S.lineLabel, { flex: 1.5 }]}>
              {row.classification || "—"}
            </Text>
            <Text style={[S.lineItem, { width: 50 }]}>{row.atcCode}</Text>
            <Text style={[S.lineValue, { width: 100 }]}>
              {fmtPHP(row.taxableAmount)}
            </Text>
            <Text style={[S.lineValueMuted, { width: 50 }]}>
              {fmtPct(row.taxRate)}
            </Text>
            <Text style={[S.lineValue, { width: 90 }]}>
              {fmtPHP(row.taxDue)}
            </Text>
          </View>
        ))}
        <LineRow
          item="19"
          label="Total Tax Due"
          value={fmtPHP(p.totalTaxDue)}
          total
        />
      </View>

      {/* Summary */}
      <Text style={S.sectionTitle}>Summary — Penalties & Total</Text>
      <View style={S.lineTable}>
        <LineRow item="23A" label="Surcharge" value={fmtPHP(s.surcharge)} />
        <LineRow item="23B" label="Interest" value={fmtPHP(s.interest)} alt />
        <LineRow item="23C" label="Compromise" value={fmtPHP(s.compromise)} />
        <LineRow
          item="23D"
          label="Total Penalties"
          value={fmtPHP(s.totalPenalties)}
          total
        />
        <LineRow
          item="24"
          label="Total Amount Payable / (Overpayment)"
          value={fmtPHP(s.totalAmountPayable)}
          total
        />
      </View>

      <SummaryCards
        cards={[
          {
            label: "Total Tax Due (Item 19)",
            value: fmtPHP(p.totalTaxDue),
            stripe: C.brand,
          },
          {
            label: "Total Credits (Item 21)",
            value: fmtPHP(p.totalCredits),
            stripe: C.green,
            variant: "green",
          },
          {
            label: p.isOverpayment ? "Overpayment" : "Tax Payable (Item 22)",
            value: fmtPHP(p.taxPayable),
            stripe: p.isOverpayment ? C.green : C.red,
            variant: p.isOverpayment ? "green" : "red",
          },
          {
            label: "Total Amount Payable (Item 24)",
            value: fmtPHP(s.totalAmountPayable),
            stripe: C.amber,
            variant: "amber",
          },
        ]}
      />

      <ValidationIssues output={output} />
      <BIRPageFooter formCode="2551Q" period={periodLabel} />
    </Page>
  );
};

// ---------------------------------------------------------------------------
// Dispatcher — call from MajikBuwizSummaryDocument
// ---------------------------------------------------------------------------

export type SupportedBIROutput =
  | Form1701QOutput
  | Form1701AOutput
  | Form2550MFilingOutput
  | Form2550QFilingOutput
  | Form2551QOutput;

export function renderBIRFormPage(
  output: SupportedBIROutput,
): React.ReactElement | null {
  switch (output.formCode) {
    case "1701Q":
      return <BIRFormPage1701Q output={output as Form1701QOutput} />;
    case "1701A":
      return <BIRFormPage1701A output={output as Form1701AOutput} />;
    case "2550M":
      return <BIRFormPage2550M output={output as Form2550MFilingOutput} />;
    case "2550Q":
      return <BIRFormPage2550Q output={output as Form2550QFilingOutput} />;
    case "2551Q":
      return <BIRFormPage2551Q output={output as Form2551QOutput} />;
    default:
      return null;
  }
}
