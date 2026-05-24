"use client";

/**
 * MajikInvoicePDF.tsx
 *
 * Standalone react-pdf/renderer template for MajikInvoice / GeneralInvoice.
 *
 * Fixes applied (rev 2):
 *   1. Company name wraps properly — left header column is flex:1/shrink:1,
 *      company Text has no fixedWidth so it line-wraps naturally.
 *   2. Invoice title + number are right-aligned via alignItems:"flex-end".
 *   3. Currency formatted as "PHP 4.00" (ISO code prefix) — avoids the
 *      currency symbol glyphs absent from Helvetica's PDF subset (renders as +-).
 *   4. Integrity / Signature / Proof-of-Payment always start on Page 2 via
 *      a hard <Page> split, keeping the commercial page clean at all times.
 *
 * Paper: A4 — 595 x 842 pt.
 */

import React from "react";
import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
  pdf,
  Font,
} from "@react-pdf/renderer";

import type {
  GeneralInvoice,
  PaymentTerms,
  ProofOfPayment,
} from "@majikah/majik-invoice";
import type { MajikInvoice } from "@majikah/majik-invoice";
import type { TaxBreakdownEntry } from "@majikah/majik-invoice";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
import { getPaymentTermMeta } from "./_utils";
import { toast } from "sonner";
import { InvoicePDFExportOptions } from "@/components/panels/invoice/InvoicePDFExportDialog";
import { MajikBuwizDatabase } from "@/components/majik-context-wrapper/majik-buwiz-database";

type InvoiceRenderOptions = {
  showSealBanner: boolean;
  showLineItems: boolean;
  showTaxBreakdown: boolean;
  showReferences: boolean;
  showNotes: boolean;
  showTags: boolean;
  showIntegrityPage: boolean;
  showPaymentsPage: boolean;
  encryptedMode: boolean;
};

Font.registerHyphenationCallback((word) => [word]);

// ---------------------------------------------------------------------------
// Colour palette
// ---------------------------------------------------------------------------

const C = {
  ink: "#151515",
  inkLight: "#555555",
  inkFaint: "#999999",
  brand: "#1A1A2E",
  brandSoft: "#F0F0F8",
  green: "#2D8C5E",
  border: "#DDDDDD",
  borderLight: "#EEEEEE",
  white: "#FFFFFF",
  pageBackground: "#FAFAFA",
  sectionLabel: "#888888",
} as const;

// ---------------------------------------------------------------------------
// Currency formatter
//
// FIX 3: react-pdf's embedded Helvetica subset does not contain the peso sign
// (PHP), euro sign, pound sign etc., causing them to render as +- artefacts.
// Solution: format the number only, then prepend the ISO 4217 code as plain
// ASCII text. "PHP 4.00" is unambiguous and prints correctly in all PDF viewers.
// ---------------------------------------------------------------------------

function fmt(amount: number, currency: string): string {
  try {
    const n = new Intl.NumberFormat("en-PH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Math.abs(amount));
    return `${amount < 0 ? "-" : ""}${currency} ${n}`;
  } catch {
    return `${currency} ${Math.abs(amount).toFixed(2)}`;
  }
}

function fmtDate(iso?: string | null): string {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleDateString("en-PH", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const S = StyleSheet.create({
  // ── Pages ──────────────────────────────────────────────────────────────
  page: {
    backgroundColor: C.pageBackground,
    paddingTop: 36,
    paddingBottom: 52,
    paddingHorizontal: 40,
    fontFamily: "Helvetica",
    fontSize: 9,
    color: C.ink,
  },

  // ── Card shell ─────────────────────────────────────────────────────────
  card: {
    backgroundColor: C.white,
    borderRadius: 6,
    border: `1pt solid ${C.border}`,
    padding: 24,
    marginBottom: 10,
  },

  // ── Layout helpers ─────────────────────────────────────────────────────
  row: { flexDirection: "row", alignItems: "flex-start" },
  col: { flexDirection: "column" },
  flex1: { flex: 1 },

  // ── Section label ──────────────────────────────────────────────────────
  sectionLabel: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: C.sectionLabel,
    marginBottom: 6,
  },

  divider: {
    borderBottomWidth: 1,
    borderBottomColor: C.borderLight,
    marginVertical: 10,
  },

  // ── Header (FIX 1 + 2) ─────────────────────────────────────────────────
  //
  // FIX 1: headerLeft has flex:1 + flexShrink:1 so the column compresses
  //        when the company name is long, forcing text to wrap rather than
  //        overflow into the INVOICE title column.
  // FIX 2: headerRight has alignItems:"flex-end" so INVOICE title, invoice
  //        number and badges are all right-aligned.
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 14,
  },
  headerLeft: {
    flex: 1,
    flexShrink: 1,
    flexDirection: "column",
    paddingRight: 16, // gap before right column
  },
  headerRight: {
    flexShrink: 0,
    flexDirection: "column",
    alignItems: "flex-end",
  },
  companyName: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    color: C.ink,
    marginBottom: 2,

    // react-pdf wraps Text automatically when the container width is constrained.
  },
  tradeName: {
    fontSize: 9,
    color: C.inkLight,
    marginBottom: 1,
  },
  invoiceTitle: {
    fontSize: 22,
    fontFamily: "Helvetica-Bold",
    color: C.brand,
    textAlign: "right",
  },
  invoiceNumber: {
    fontSize: 9,
    color: C.inkLight,
    textAlign: "right",
    marginTop: 2,
  },
  badgeRow: {
    flexDirection: "row",
    gap: 5,
    marginTop: 6,
    justifyContent: "flex-end",
  },
  badge: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 3,
    color: C.white,
    backgroundColor: C.brand,
  },
  badgeGreen: { backgroundColor: C.green },
  badgeGrey: { backgroundColor: C.inkFaint },

  // ── Seal banner ────────────────────────────────────────────────────────
  sealBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.green + "18",
    borderRadius: 4,
    border: `1pt solid ${C.green}44`,
    paddingVertical: 5,
    paddingHorizontal: 10,
    marginBottom: 10,
  },
  sealBannerText: {
    fontSize: 8,
    color: C.green,
    fontFamily: "Helvetica-Bold",
  },
  sealBannerSub: {
    fontSize: 7,
    color: C.inkLight,
    marginTop: 1,
  },

  // ── Party block ────────────────────────────────────────────────────────
  partyGrid: { flexDirection: "row", gap: 16, marginBottom: 10 },
  partyCol: { flex: 1, flexDirection: "column" },
  partyName: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: C.ink,
    marginBottom: 2,
  },
  partyLine: { fontSize: 8, color: C.inkLight, lineHeight: 1.5 },

  // ── Dates / meta ───────────────────────────────────────────────────────
  metaGrid: { flexDirection: "row", gap: 12, marginBottom: 10 },
  metaCell: { flexDirection: "column", flex: 1 },
  metaLabel: { fontSize: 7, color: C.sectionLabel, marginBottom: 2 },
  metaValue: { fontSize: 9, fontFamily: "Helvetica-Bold", color: C.ink },

  // ── Line items table ───────────────────────────────────────────────────
  tableWrap: { marginBottom: 10 },
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: C.brand,
    borderRadius: 4,
    paddingVertical: 5,
    paddingHorizontal: 6,
    marginBottom: 1,
  },
  tableHeaderCell: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: C.white,
    letterSpacing: 0.4,
  },
  tableDataRow: {
    flexDirection: "row",
    paddingVertical: 5,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: C.borderLight,
  },
  tableDataRowAlt: { backgroundColor: C.brandSoft },
  tableCell: { fontSize: 8, color: C.ink },
  tableCellMono: { fontSize: 8, color: C.ink, fontFamily: "Helvetica" },
  tableCellFaint: { fontSize: 7, color: C.inkFaint, marginTop: 1 },

  colDesc: { flex: 3.5 },
  colQty: { flex: 1, textAlign: "right" },
  colUnit: { flex: 0.8, textAlign: "center" },
  colPrice: { flex: 1.4, textAlign: "right" },
  colDiscount: { flex: 1.2, textAlign: "right" },
  colTax: { flex: 1.5, textAlign: "right" },
  colTotal: { flex: 1.4, textAlign: "right" },

  // ── Totals ─────────────────────────────────────────────────────────────
  totalsSection: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 4,
    marginBottom: 10,
  },
  totalsTable: { width: 260, flexDirection: "column" },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: C.borderLight,
  },
  totalsRowBold: { borderBottomWidth: 0, paddingTop: 6 },
  totalsLabel: { fontSize: 8, color: C.inkLight, flex: 1 },
  totalsValue: {
    fontSize: 8,
    fontFamily: "Helvetica",
    color: C.ink,
    textAlign: "right",
  },
  totalsBoldLabel: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: C.ink,
    flex: 1,
  },
  totalsBoldValue: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: C.ink,
    textAlign: "right",
  },

  // ── Tax breakdown ──────────────────────────────────────────────────────
  taxRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
    borderBottomWidth: 1,
    borderBottomColor: C.borderLight,
  },
  taxLeft: { flexDirection: "row", alignItems: "center", gap: 4, flex: 1 },
  taxTypeBadge: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: C.brand,
    backgroundColor: C.brandSoft,
    paddingVertical: 1,
    paddingHorizontal: 4,
    borderRadius: 2,
  },
  taxDesc: { fontSize: 7, color: C.inkLight },
  taxAmount: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: C.ink,
    textAlign: "right",
  },

  // ── References ─────────────────────────────────────────────────────────
  refRow: {
    flexDirection: "row",
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: C.borderLight,
    gap: 8,
  },
  refType: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: C.brand,
    backgroundColor: C.brandSoft,
    paddingVertical: 1,
    paddingHorizontal: 4,
    borderRadius: 2,
    marginBottom: 2,
  },
  refNumber: { fontSize: 8, fontFamily: "Helvetica-Bold", color: C.ink },
  refMeta: { fontSize: 7, color: C.inkFaint, marginTop: 1 },

  // ── Notes / Tags ───────────────────────────────────────────────────────
  notesText: { fontSize: 8, color: C.inkLight, lineHeight: 1.6 },
  tagWrap: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 4 },
  tag: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: C.brand,
    backgroundColor: C.brandSoft,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 10,
    border: `0.5pt solid ${C.brand}33`,
  },

  // ── Integrity / Signatures ─────────────────────────────────────────────
  integrityGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 10,
  },
  integrityCell: { width: "45%", flexDirection: "column" },
  integrityLabel: { fontSize: 7, color: C.sectionLabel, marginBottom: 2 },
  integrityValue: { fontSize: 8, fontFamily: "Helvetica-Bold", color: C.ink },
  integrityMono: {
    fontSize: 7,
    fontFamily: "Helvetica",
    color: C.inkFaint,
    wordBreak: "break-all",
  },
  sigRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: C.borderLight,
    gap: 8,
  },
  sigLabel: { fontSize: 8, fontFamily: "Helvetica-Bold", color: C.ink },
  sigMeta: { fontSize: 7, color: C.inkFaint, marginTop: 1 },
  sigBadge: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: C.green,
    backgroundColor: C.green + "18",
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 3,
  },
  sigTime: { fontSize: 7, color: C.inkFaint, textAlign: "right", marginTop: 2 },
  pendingChip: {
    fontSize: 7,
    color: C.inkLight,
    backgroundColor: C.brandSoft,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 10,
    border: `0.5pt solid ${C.brand}33`,
  },

  // ── Proof of Payment ───────────────────────────────────────────────────
  popRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: C.borderLight,
    gap: 8,
  },
  popLabel: { fontSize: 8, fontFamily: "Helvetica-Bold", color: C.ink },
  popMeta: { fontSize: 7, color: C.inkFaint, marginTop: 1 },
  popAmount: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: C.green,
    textAlign: "right",
  },

  // ── Two-column grid ────────────────────────────────────────────────────
  twoCol: { flexDirection: "row", gap: 16, marginBottom: 10 },
  twoColLeft: { flex: 1 },
  twoColRight: { flex: 1 },

  // ── Page 2 compact header ──────────────────────────────────────────────
  page2Header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.borderLight,
  },
  page2Left: { flexDirection: "column" },
  page2Right: { flexDirection: "column", alignItems: "flex-end" },
  page2Company: { fontSize: 11, fontFamily: "Helvetica-Bold", color: C.ink },
  page2Sub: { fontSize: 8, color: C.inkFaint, marginTop: 2 },
  page2Title: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: C.brand,
    textAlign: "right",
  },
  page2InvNum: {
    fontSize: 8,
    color: C.inkFaint,
    textAlign: "right",
    marginTop: 2,
  },

  // ── Footer ─────────────────────────────────────────────────────────────
  footer: {
    position: "absolute",
    bottom: 18,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: C.borderLight,
    paddingTop: 5,
  },
  footerText: { fontSize: 7, color: C.inkFaint },
});

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

// ── Page 1 Header ────────────────────────────────────────────────────────────

interface HeaderProps {
  companyName: string;
  tradeName?: string;
  invoiceType: string;
  invoiceNumber?: string;
  status?: string;
  isSealed?: boolean;
  mode?: string;
}

const InvoicePDFHeader: React.FC<HeaderProps> = ({
  companyName,
  tradeName,
  invoiceType,
  invoiceNumber,
  status,
  isSealed,
  mode,
}) => (
  <View style={S.headerRow}>
    {/* Left — flex:1 + shrink so long names compress and wrap */}
    <View style={S.headerLeft}>
      <Text style={S.companyName}>{companyName}</Text>
      {tradeName ? <Text style={S.tradeName}>{tradeName}</Text> : null}
    </View>

    {/* Right — alignItems:flex-end keeps INVOICE / # / badges right-aligned */}
    <View style={S.headerRight}>
      <Text style={S.invoiceTitle}>INVOICE</Text>
      {invoiceNumber ? (
        <Text style={S.invoiceNumber}>#{invoiceNumber}</Text>
      ) : null}
      <View style={S.badgeRow}>
        {invoiceType ? (
          <Text style={S.badge}>{invoiceType.toUpperCase()}</Text>
        ) : null}
        {status ? (
          <Text style={[S.badge, S.badgeGrey]}>{status.toUpperCase()}</Text>
        ) : null}
        {isSealed ? <Text style={[S.badge, S.badgeGreen]}>SEALED</Text> : null}
        {mode ? (
          <Text style={[S.badge, S.badgeGrey]}>{mode.toUpperCase()}</Text>
        ) : null}
      </View>
    </View>
  </View>
);

// ── Page 2 compact header ─────────────────────────────────────────────────────

interface Page2HeaderProps {
  companyName: string;
  invoiceNumber?: string;
  label: string;
}

const Page2Header: React.FC<Page2HeaderProps> = ({
  companyName,
  invoiceNumber,
  label,
}) => (
  <View style={S.page2Header}>
    <View style={S.page2Left}>
      <Text style={S.page2Company}>{companyName}</Text>
      <Text style={S.page2Sub}>{label}</Text>
    </View>
    <View style={S.page2Right}>
      <Text style={S.page2Title}>INVOICE</Text>
      {invoiceNumber ? (
        <Text style={S.page2InvNum}>#{invoiceNumber}</Text>
      ) : null}
    </View>
  </View>
);

// ── Seal banner ──────────────────────────────────────────────────────────────

const SealBanner: React.FC<{ sealedBy?: string; sealTimestamp?: string }> = ({
  sealedBy,
  sealTimestamp,
}) => (
  <View style={S.sealBanner}>
    <View style={S.col}>
      <Text style={S.sealBannerText}>
        Sealed - Immutable. No further modifications or signatures permitted.
      </Text>
      {(sealedBy || sealTimestamp) && (
        <Text style={S.sealBannerSub}>
          {sealedBy ? `Sealed by: ${sealedBy}` : ""}
          {sealedBy && sealTimestamp ? "   " : ""}
          {sealTimestamp ? `on ${fmtDate(sealTimestamp)}` : ""}
        </Text>
      )}
    </View>
  </View>
);

// ── Party block ──────────────────────────────────────────────────────────────

const PartyPDFBlock: React.FC<{
  issuer: GeneralInvoice["issuer"];
  recipient: GeneralInvoice["recipient"];
}> = ({ issuer, recipient }) => {
  const addrStr = (a: typeof issuer.address) =>
    a
      ? [a.line1, a.line2, a.city, a.stateOrProvince, a.postalCode, a.country]
          .filter(Boolean)
          .join(", ")
      : null;

  return (
    <View style={S.partyGrid}>
      <View style={S.partyCol}>
        <Text style={S.sectionLabel}>From</Text>
        <Text style={S.partyName}>{issuer.legalName}</Text>
        {issuer.tradeName ? (
          <Text style={S.partyLine}>{issuer.tradeName}</Text>
        ) : null}
        {issuer.tin ? <Text style={S.partyLine}>TIN: {issuer.tin}</Text> : null}
        {issuer.email ? <Text style={S.partyLine}>{issuer.email}</Text> : null}
        {issuer.phone ? <Text style={S.partyLine}>{issuer.phone}</Text> : null}
        {addrStr(issuer.address) ? (
          <Text style={S.partyLine}>{addrStr(issuer.address)}</Text>
        ) : null}
        {issuer.website ? (
          <Text style={S.partyLine}>{issuer.website}</Text>
        ) : null}
      </View>

      <View
        style={{
          width: 1,
          backgroundColor: C.borderLight,
          marginHorizontal: 4,
        }}
      />

      <View style={S.partyCol}>
        <Text style={S.sectionLabel}>Bill To</Text>
        <Text style={S.partyName}>{recipient.legalName}</Text>
        {recipient.tradeName ? (
          <Text style={S.partyLine}>{recipient.tradeName}</Text>
        ) : null}
        {recipient.tin ? (
          <Text style={S.partyLine}>TIN: {recipient.tin}</Text>
        ) : null}
        {recipient.email ? (
          <Text style={S.partyLine}>{recipient.email}</Text>
        ) : null}
        {recipient.phone ? (
          <Text style={S.partyLine}>{recipient.phone}</Text>
        ) : null}
        {addrStr(recipient.address) ? (
          <Text style={S.partyLine}>{addrStr(recipient.address)}</Text>
        ) : null}
      </View>
    </View>
  );
};

// ── Dates / meta ─────────────────────────────────────────────────────────────

const DatesPDFMeta: React.FC<{
  issueDate?: string;
  dueDate?: string;
  currency: string;
  paymentTerms?: PaymentTerms;
  period?: { start: string; end: string };
}> = ({ issueDate, dueDate, currency, paymentTerms, period }) => (
  <View style={S.metaGrid}>
    <View style={S.metaCell}>
      <Text style={S.metaLabel}>Issue Date</Text>
      <Text style={S.metaValue}>{fmtDate(issueDate)}</Text>
    </View>
    <View style={S.metaCell}>
      <Text style={S.metaLabel}>Due Date</Text>
      <Text style={S.metaValue}>{dueDate ? fmtDate(dueDate) : "-"}</Text>
    </View>
    <View style={S.metaCell}>
      <Text style={S.metaLabel}>Currency</Text>
      <Text style={S.metaValue}>{currency}</Text>
    </View>
    {paymentTerms && (
      <View style={S.metaCell}>
        <Text style={S.metaLabel}>Payment Terms</Text>
        <Text style={S.metaValue}>
          {getPaymentTermMeta(paymentTerms).title} ({paymentTerms.toUpperCase()}
          )
        </Text>
      </View>
    )}
    {period && (
      <View style={S.metaCell}>
        <Text style={S.metaLabel}>Period</Text>
        <Text style={S.metaValue}>
          {fmtDate(period.start)} - {fmtDate(period.end)}
        </Text>
      </View>
    )}
  </View>
);

// ── Line items table ──────────────────────────────────────────────────────────

const LineItemsPDFTable: React.FC<{
  items: GeneralInvoice["lineItems"];
  currency: string;
}> = ({ items, currency }) => (
  <View style={S.tableWrap}>
    <View style={S.tableHeaderRow} fixed>
      <Text style={[S.tableHeaderCell, S.colDesc]}>Description</Text>
      <Text style={[S.tableHeaderCell, S.colQty]}>Qty</Text>
      <Text style={[S.tableHeaderCell, S.colUnit]}>Unit</Text>
      <Text style={[S.tableHeaderCell, S.colPrice]}>Unit Price</Text>
      <Text style={[S.tableHeaderCell, S.colDiscount]}>Discount</Text>
      <Text style={[S.tableHeaderCell, S.colTax]}>Tax</Text>
      <Text style={[S.tableHeaderCell, S.colTotal]}>Line Total</Text>
    </View>

    {items.map((item, i) => {
      const isAlt = i % 2 === 1;
      const unitPrice = item.unitPrice.toMajor();
      const lineTotal = item.lineTotal.toMajor();
      const discountAmt = item.discountAmount.toMajor();
      const taxAmt = item.additiveTaxAmount.toMajor();
      const taxSummary = item.taxes
        .toArray()
        .map((t) => `${t.taxType} ${(t.rate * 100).toFixed(0)}%`)
        .join(" + ");

      return (
        <View
          key={item.id}
          style={[S.tableDataRow, isAlt ? S.tableDataRowAlt : {}]}
          wrap={false}
        >
          <View style={[S.colDesc, S.col]}>
            <Text style={S.tableCell}>{item.description}</Text>
            {item.unit && item.unit !== item.description ? (
              <Text style={S.tableCellFaint}>{item.unit}</Text>
            ) : null}
            {item.accountCode ? (
              <Text style={S.tableCellFaint}>Acct: {item.accountCode}</Text>
            ) : null}
            {item.tags && item.tags.length > 0 ? (
              <Text style={S.tableCellFaint}>{item.tags.join(", ")}</Text>
            ) : null}
          </View>
          <Text style={[S.tableCell, S.colQty]}>{item.quantity}</Text>
          <Text style={[S.tableCell, S.colUnit]}>{item.unit ?? "-"}</Text>
          <Text style={[S.tableCellMono, S.colPrice]}>
            {fmt(unitPrice, currency)}
          </Text>
          <Text style={[S.tableCellMono, S.colDiscount]}>
            {discountAmt > 0 ? `-${fmt(discountAmt, currency)}` : "-"}
          </Text>
          <View style={[S.colTax, S.col]}>
            <Text style={S.tableCellMono}>
              {taxAmt > 0 ? fmt(taxAmt, currency) : "-"}
            </Text>
            {taxSummary ? (
              <Text style={S.tableCellFaint}>{taxSummary}</Text>
            ) : null}
          </View>
          <Text style={[S.tableCellMono, S.colTotal]}>
            {fmt(lineTotal, currency)}
          </Text>
        </View>
      );
    })}
  </View>
);

// ── Totals ───────────────────────────────────────────────────────────────────

const TotalsPDFBlock: React.FC<{ invoice: GeneralInvoice }> = ({ invoice }) => {
  const cur = invoice.currency;
  const totals = invoice.totals;
  const subtotal = totals.subtotal.toMajor();
  const discountTotal = totals.discountTotal.toMajor();
  const taxTotal = totals.taxTotal.toMajor();
  const withholdingTotal = totals.withholdingTotal?.toMajor() ?? 0;
  const grandTotal = totals.grandTotal.toMajor();
  const netPayable =
    totals.netPayable?.toMajor() ?? grandTotal - withholdingTotal;

  return (
    <View style={S.totalsSection}>
      <View style={S.totalsTable}>
        <View style={S.totalsRow}>
          <Text style={S.totalsLabel}>Subtotal</Text>
          <Text style={S.totalsValue}>{fmt(subtotal, cur)}</Text>
        </View>
        {discountTotal > 0 && (
          <View style={S.totalsRow}>
            <Text style={S.totalsLabel}>Discount</Text>
            <Text style={S.totalsValue}>-{fmt(discountTotal, cur)}</Text>
          </View>
        )}
        {taxTotal > 0 && (
          <View style={S.totalsRow}>
            <Text style={S.totalsLabel}>Tax (additive)</Text>
            <Text style={S.totalsValue}>{fmt(taxTotal, cur)}</Text>
          </View>
        )}
        <View style={[S.totalsRow, S.totalsRowBold]}>
          <Text style={S.totalsBoldLabel}>Grand Total</Text>
          <Text style={S.totalsBoldValue}>{fmt(grandTotal, cur)}</Text>
        </View>
        {withholdingTotal > 0 && (
          <>
            <View style={S.totalsRow}>
              <Text style={S.totalsLabel}>Less: Withholding Tax</Text>
              <Text style={S.totalsValue}>-{fmt(withholdingTotal, cur)}</Text>
            </View>
            <View style={[S.totalsRow, S.totalsRowBold]}>
              <Text style={S.totalsBoldLabel}>Net Payable</Text>
              <Text style={S.totalsBoldValue}>{fmt(netPayable, cur)}</Text>
            </View>
          </>
        )}
      </View>
    </View>
  );
};

// ── Tax breakdown ─────────────────────────────────────────────────────────────

const TaxBreakdownPDF: React.FC<{
  entries: TaxBreakdownEntry[];
  currency: string;
}> = ({ entries, currency }) => (
  <View>
    {entries.length === 0 ? (
      <Text style={{ fontSize: 8, color: C.inkFaint }}>No tax applied.</Text>
    ) : (
      entries.map((g, i) => (
        <View key={i} style={S.taxRow}>
          <View style={S.taxLeft}>
            <Text style={S.taxTypeBadge}>{g.taxType}</Text>
            <Text style={S.taxDesc}>
              {(g.rate * 100).toFixed(0)}% · {g.behaviour} · {g.lineCount} line
              {g.lineCount > 1 ? "s" : ""}
            </Text>
          </View>
          <Text style={S.taxAmount}>{fmt(g.taxAmount, currency)}</Text>
        </View>
      ))
    )}
  </View>
);

// ── References ───────────────────────────────────────────────────────────────

const ReferencesPDF: React.FC<{ references: GeneralInvoice["references"] }> = ({
  references,
}) => (
  <View>
    {!references || references.length === 0 ? (
      <Text style={{ fontSize: 8, color: C.inkFaint }}>No references.</Text>
    ) : (
      references.map((ref, i) => (
        <View key={i} style={S.refRow} wrap={false}>
          <View style={S.col}>
            <Text style={S.refType}>{ref.type}</Text>
            <Text style={S.refNumber}>{ref.number}</Text>
            {ref.date ? (
              <Text style={S.refMeta}>{fmtDate(ref.date)}</Text>
            ) : null}
            {ref.notes ? <Text style={S.refMeta}>{ref.notes}</Text> : null}
          </View>
        </View>
      ))
    )}
  </View>
);

// ── Integrity / signatures ────────────────────────────────────────────────────

const IntegrityPDF: React.FC<{ majikInvoice: MajikInvoice }> = ({
  majikInvoice,
}) => {
  const { integrity } = majikInvoice;
  return (
    <View>
      <View style={S.integrityGrid}>
        <View style={S.integrityCell}>
          <Text style={S.integrityLabel}>Mode</Text>
          <Text style={S.integrityValue}>
            {majikInvoice.mode.toUpperCase()}
          </Text>
        </View>
        <View style={S.integrityCell}>
          <Text style={S.integrityLabel}>Status</Text>
          <Text style={S.integrityValue}>
            {majikInvoice.integrityStatus.toUpperCase()}
          </Text>
        </View>
        <View style={S.integrityCell}>
          <Text style={S.integrityLabel}>Signatures</Text>
          <Text style={S.integrityValue}>
            {integrity.signatures.length === 0
              ? "None"
              : `${integrity.signatures.length} attached`}
          </Text>
        </View>
        <View style={S.integrityCell}>
          <Text style={S.integrityLabel}>Sealed</Text>
          <Text style={S.integrityValue}>
            {integrity.isSealed ? "Yes" : "No"}
          </Text>
        </View>
        <View style={{ width: "100%" }}>
          <Text style={S.integrityLabel}>
            Content Hash ({integrity.hashAlgorithm.toUpperCase()})
          </Text>
          <Text style={S.integrityMono}>{integrity.contentHash}</Text>
        </View>
        {integrity.isSealed && integrity.sealInfo && (
          <>
            <View style={S.integrityCell}>
              <Text style={S.integrityLabel}>Sealed By</Text>
              <Text style={S.integrityMono}>{integrity.sealInfo.sealedBy}</Text>
            </View>
            <View style={S.integrityCell}>
              <Text style={S.integrityLabel}>Seal Hash</Text>
              <Text style={S.integrityMono}>{integrity.sealInfo.sealHash}</Text>
            </View>
            <View style={S.integrityCell}>
              <Text style={S.integrityLabel}>Seal Timestamp</Text>
              <Text style={S.integrityValue}>
                {fmtDate(integrity.sealInfo.sealTimestamp)}
              </Text>
            </View>
          </>
        )}
      </View>

      <Text style={[S.sectionLabel, { marginTop: 6 }]}>
        Attached Signatures
      </Text>
      {integrity.signatures.length === 0 ? (
        <Text style={{ fontSize: 8, color: C.inkFaint }}>
          No signatures attached.
        </Text>
      ) : (
        integrity.signatures.map((sig, i) => (
          <View key={i} style={S.sigRow} wrap={false}>
            <View style={[S.col, S.flex1]}>
              <Text style={S.sigLabel}>{sig.signerId}</Text>
              <Text style={S.sigMeta}>
                {(sig as any).algorithm ?? "Ed25519 + ML-DSA-87"}
              </Text>
              <Text style={S.sigMeta}>Hash: {sig.contentHash}</Text>
            </View>
            <View style={[S.col, { alignItems: "flex-end" }]}>
              <Text style={S.sigBadge}>signed</Text>
              <Text style={S.sigTime}>
                {new Date(sig.timestamp).toLocaleString("en-PH")}
              </Text>
            </View>
          </View>
        ))
      )}

      {majikInvoice.pendingSigners.length > 0 && (
        <View style={{ marginTop: 6 }}>
          <Text style={[S.sectionLabel, { marginBottom: 4 }]}>
            Awaiting Signatures ({majikInvoice.pendingSigners.length})
          </Text>
          <View style={S.tagWrap}>
            {majikInvoice.pendingSigners.map((ps) => (
              <Text key={ps.signerId} style={S.pendingChip}>
                {ps.signerId}
              </Text>
            ))}
          </View>
        </View>
      )}
    </View>
  );
};

// ── Proof of Payment ──────────────────────────────────────────────────────────

const ProofOfPaymentPDF: React.FC<{
  entries: ProofOfPayment[];
  currency: string;
}> = ({ entries, currency }) => (
  <View>
    {entries.length === 0 ? (
      <Text style={{ fontSize: 8, color: C.inkFaint }}>
        No payment recorded.
      </Text>
    ) : (
      entries.map((pop, i) => (
        <View key={pop.id ?? i} style={S.popRow} wrap={false}>
          <View style={[S.col, S.flex1]}>
            <Text style={S.popLabel}>{pop.method.toUpperCase()}</Text>
            <Text style={S.popMeta}>Ref: {pop.reference}</Text>
            <Text style={S.popMeta}>Settled: {fmtDate(pop.settledAt)}</Text>
            {pop.proofUrl ? (
              <Text style={S.popMeta}>{pop.proofUrl}</Text>
            ) : null}
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={S.popAmount}>{fmt(pop.amount, currency)}</Text>
            <Text style={S.popMeta}>{pop.currency}</Text>
          </View>
        </View>
      ))
    )}
  </View>
);

// ── Shared footer ─────────────────────────────────────────────────────────────

const PDFFooter: React.FC<{ invoiceNumber?: string; companyName: string }> = ({
  invoiceNumber,
  companyName,
}) => (
  <View style={S.footer} fixed>
    <Text style={S.footerText}>{companyName}</Text>
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
    <Text style={S.footerText}>
      {invoiceNumber ? `Invoice #${invoiceNumber}` : ""}
    </Text>
  </View>
);

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export type MajikInvoicePDFProps =
  | {
      majik: MajikBuwizDatabase;
      kind: "draft";
      invoice: GeneralInvoice;
      options?: InvoicePDFExportOptions;
    }
  | {
      majik: MajikBuwizDatabase;
      kind: "majik";
      invoice: MajikInvoice;
      options?: InvoicePDFExportOptions;
    };

// ---------------------------------------------------------------------------
// Main Document
//
// FIX 4: Integrity / PoP are always on their own dedicated Page 2 in majik
// mode, achieved with a hard <Page> element split rather than break hints.
// This guarantees the commercial page is never crowded regardless of how many
// line items or signatures exist, and the crypto page always starts clean.
// Draft mode emits only Page 1 (no crypto content to show).
// ---------------------------------------------------------------------------

export const MajikInvoicePDFDocument: React.FC<MajikInvoicePDFProps> = (
  props,
) => {
  const generalInvoice: GeneralInvoice | null =
    props.kind === "draft"
      ? props.invoice
      : props.invoice.isEncrypted && !props.invoice.hasDecryptedCache
        ? null
        : props.invoice.invoice;

  const majikInvoice: MajikInvoice | null =
    props.kind === "majik" ? props.invoice : null;

  const isSealed = majikInvoice?.isSealed ?? false;
  const isEncryptedLocked =
    !!majikInvoice?.isEncrypted && !!majikInvoice?.isLocked;

  const companyName =
    generalInvoice?.issuer.legalName ?? majikInvoice?.public.issuerName ?? "";
  const invoiceNumber =
    generalInvoice?.invoiceNumber ?? majikInvoice?.public.invoiceNumber ?? "";
  const currency =
    generalInvoice?.currency ?? majikInvoice?.public.currency ?? "PHP";

  const options: InvoiceRenderOptions = {
    showSealBanner: majikInvoice?.isSealed ?? false,
    showLineItems: !isEncryptedLocked,
    showTaxBreakdown:
      !!props.options?.includeTaxBreakdown && !isEncryptedLocked,
    showReferences: !!props.options?.includeReferences && !isEncryptedLocked,
    showNotes: !!props.options?.includeNotes && !isEncryptedLocked,
    showTags: !!props.options?.includeTags && !isEncryptedLocked,
    showIntegrityPage:
      !!props.options?.includeCryptographicProof && !!majikInvoice,
    showPaymentsPage: !!props.options?.includePaymentProofs && !!majikInvoice,
    encryptedMode: isEncryptedLocked,
  };

  return (
    <Document
      title={invoiceNumber ? `Invoice #${invoiceNumber}` : "Invoice"}
      author={companyName}
      creator="Majikah Invoice"
      producer="@majikah/majik-invoice"
    >
      {/* ================================================================
          PAGE 1 — Commercial content
          ================================================================ */}
      <Page size="A4" style={S.page} wrap>
        <InvoicePDFHeader
          companyName={companyName}
          tradeName={generalInvoice?.issuer.tradeName}
          invoiceType={
            generalInvoice?.type ?? majikInvoice?.public.invoiceType ?? ""
          }
          invoiceNumber={invoiceNumber}
          status={
            props.kind === "draft"
              ? generalInvoice?.status
              : majikInvoice?.status
          }
          isSealed={isSealed}
          mode={majikInvoice?.mode}
        />

        <View style={S.divider} />

        {options.showSealBanner && (
          <SealBanner
            sealedBy={majikInvoice?.integrity.sealInfo?.sealedBy}
            sealTimestamp={majikInvoice?.integrity.sealInfo?.sealTimestamp}
          />
        )}

        {generalInvoice && (
          <View style={S.card}>
            <PartyPDFBlock
              issuer={generalInvoice.issuer}
              recipient={generalInvoice.recipient}
            />
          </View>
        )}

        {generalInvoice && (
          <DatesPDFMeta
            issueDate={generalInvoice.issueDate}
            dueDate={generalInvoice.dueDate}
            currency={generalInvoice.currency}
            paymentTerms={generalInvoice.paymentTerms}
            period={generalInvoice.period}
          />
        )}

        <View style={S.divider} />

        {isEncryptedLocked ? (
          <View
            style={{
              padding: 24,
              backgroundColor: C.brandSoft,
              borderRadius: 6,
              border: `1pt solid ${C.brand}33`,
              marginBottom: 10,
              alignItems: "center",
            }}
          >
            <Text
              style={{
                fontSize: 11,
                fontFamily: "Helvetica-Bold",
                color: C.brand,
                marginBottom: 4,
              }}
            >
              Payload Encrypted
            </Text>
            <Text
              style={{ fontSize: 8, color: C.inkLight, textAlign: "center" }}
            >
              Line items and amounts are protected by ML-KEM-768 + AES-256-GCM
              encryption. Decrypt with a recipient key to view the full invoice.
            </Text>
          </View>
        ) : generalInvoice ? (
          <>
            <View style={S.card} wrap>
              <Text style={S.sectionLabel}>Line Items</Text>
              <LineItemsPDFTable
                items={generalInvoice.lineItems}
                currency={generalInvoice.currency}
              />
            </View>

            <TotalsPDFBlock invoice={generalInvoice} />

            <View style={S.divider} />

            <View style={S.twoCol} wrap>
              {options.showTaxBreakdown && (
                <View style={S.twoColLeft}>
                  <Text style={S.sectionLabel}>Tax Breakdown</Text>
                  <TaxBreakdownPDF
                    entries={generalInvoice.taxBreakdown()}
                    currency={generalInvoice.currency}
                  />
                </View>
              )}

              {options.showReferences && (
                <View style={S.twoColRight}>
                  <Text style={S.sectionLabel}>References</Text>
                  <ReferencesPDF references={generalInvoice.references} />
                </View>
              )}
            </View>

            <View style={S.twoCol} wrap>
              {options.showNotes && (
                <View style={S.twoColLeft}>
                  <Text style={S.sectionLabel}>Notes &amp; Terms</Text>
                  {generalInvoice.notes ? (
                    <Text style={S.notesText}>{generalInvoice.notes}</Text>
                  ) : (
                    <Text style={{ fontSize: 8, color: C.inkFaint }}>-</Text>
                  )}
                </View>
              )}

              {options.showTags && (
                <View style={S.twoColRight}>
                  <Text style={S.sectionLabel}>Tags</Text>
                  {(generalInvoice.tags ?? []).length > 0 ? (
                    <View style={S.tagWrap}>
                      {(generalInvoice.tags ?? []).map((tag, idx) => (
                        <Text key={idx} style={S.tag}>
                          {tag}
                        </Text>
                      ))}
                    </View>
                  ) : (
                    <Text style={{ fontSize: 8, color: C.inkFaint }}>-</Text>
                  )}
                </View>
              )}
            </View>
          </>
        ) : null}

        <PDFFooter invoiceNumber={invoiceNumber} companyName={companyName} />
      </Page>

      {/* ================================================================
          PAGE 2 — Cryptographic record (majik mode only)
          Always a separate page — commercial content is never mixed with
          cryptographic proof regardless of how short Page 1 content is.
          ================================================================ */}
      {majikInvoice &&
        (options.showIntegrityPage || options.showPaymentsPage) && (
          <Page size="A4" style={S.page} wrap>
            {options.showIntegrityPage && (
              <>
                <Page2Header
                  companyName={companyName}
                  invoiceNumber={invoiceNumber}
                  label="Cryptographic Record — Ed25519 + ML-DSA-87"
                />

                <View style={S.card} wrap>
                  <Text style={S.sectionLabel}>Integrity — MajikInvoice</Text>
                  <IntegrityPDF majikInvoice={majikInvoice} />
                </View>
              </>
            )}

            {!options.showIntegrityPage && options.showPaymentsPage && (
              <Page2Header
                companyName={companyName}
                invoiceNumber={invoiceNumber}
                label="Proof of Payment"
              />
            )}

            {options.showPaymentsPage && (
              <>
                <View style={S.divider} />

                <View style={S.card} wrap>
                  <Text style={S.sectionLabel}>Proof of Payment</Text>
                  <ProofOfPaymentPDF
                    entries={majikInvoice.payments ?? []}
                    currency={currency}
                  />
                </View>
              </>
            )}

            <PDFFooter
              invoiceNumber={invoiceNumber}
              companyName={companyName}
            />
          </Page>
        )}
    </Document>
  );
};

// ---------------------------------------------------------------------------
// Filename builder
// ---------------------------------------------------------------------------

function buildFilename(props: MajikInvoicePDFProps): string {
  const issuer =
    props.kind === "draft"
      ? props.invoice.issuer.legalName
      : (props.invoice.public?.issuerName ?? "Invoice");
  const recipient =
    props.kind === "draft"
      ? props.invoice.recipient.legalName
      : (props.invoice.public?.recipientName ?? "");
  const num =
    props.kind === "draft"
      ? (props.invoice.invoiceNumber ?? "")
      : (props.invoice.public?.invoiceNumber ?? "");

  return (
    [issuer, recipient && `for ${recipient}`, num && `#${num}`]
      .filter(Boolean)
      .join(" - ")
      .replace(/[/\\?%*:|"<>]/g, "_")
      .trim() + ".pdf"
  );
}

// ---------------------------------------------------------------------------
// Export utilities
// ---------------------------------------------------------------------------

export async function buildMajikInvoiceBlob(
  props: MajikInvoicePDFProps,
): Promise<Blob> {
  return pdf(<MajikInvoicePDFDocument {...props} />).toBlob();
}

export async function downloadMajikInvoicePDF(
  props: MajikInvoicePDFProps,
  filename?: string,
): Promise<void> {
  let blob = await buildMajikInvoiceBlob(props);

  const filePath = await save({
    defaultPath: filename ?? buildFilename(props),
    filters: [{ name: "Majik Invoice PDF", extensions: ["pdf"] }],
  });

  if (!filePath) {
    // User cancelled — fall back to browser download
    toast.error("Download Cancelled");
    return;
  } else {
    if (props.kind === "majik") {
      const activeAccount = props.majik.getActiveAccountKey();
      if (activeAccount) {
        if (
          props.invoice.integrity.signatures[0].signerId ===
          activeAccount.fingerprint
        ) {
          const invoice = props.invoice;

          const signedFile = await props.majik.signFile(blob, {
            expectedSigners: invoice.integrity.expectedSigners,
          });

          blob = signedFile.blob;
        }
      }
    }

    const arrayBuffer = await blob.arrayBuffer();
    await writeFile(filePath, new Uint8Array(arrayBuffer));
  }
}
