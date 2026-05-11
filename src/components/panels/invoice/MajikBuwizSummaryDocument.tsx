"use client";

/**
 * MajikBuwizSummaryDocument.tsx
 *
 * React-PDF/renderer financial summary document for Majik Buwiz.
 *
 * Renders a multi-page A4 PDF summary report from DashboardStats.
 * Includes native SVG charts (bar, donut, horizontal bar) — no external
 * chart library required. All charts use react-pdf's built-in SVG primitives.
 *
 * Pages:
 *   1. Cover — business identity, period, headline KPIs
 *   2. Revenue & Collections — gross, collected, outstanding, overdue + donut
 *   3. Tax & Withholding — output tax, EWT, net payable, breakdown table
 *   4. Invoice Health — status breakdown, sizing metrics, horizontal bar chart
 *   5. Client Intelligence — top recipients ranked bar chart + table
 *   6. Appendix — raw status table, metadata, generation info
 *
 * Usage:
 * ```tsx
 * import {
 *   MajikBuwizSummaryDocument,
 *   downloadMajikBuwizSummaryPDF,
 * } from "./MajikBuwizSummaryDocument";
 *
 * // Render
 * <PDFViewer><MajikBuwizSummaryDocument stats={stats} currency="PHP" /></PDFViewer>
 *
 * // Download (Tauri)
 * await downloadMajikBuwizSummaryPDF({ stats, currency: "PHP", period: { label: "FY 2025" } });
 * ```
 *
 * Paper: A4 — 595 × 842 pt
 */

import React from "react";
import {
  Document,
  Font,
  Page,
  StyleSheet,
  Svg,
  Circle,
  Rect,
  Line,
  Text,
  View,
  pdf,
  Image as PDFImage,
} from "@react-pdf/renderer";
import type { DashboardStats } from "@majikah/majik-invoice";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
import { toast } from "sonner";
import { Asset_Logo_150px } from "@/assets";

Font.registerHyphenationCallback((word) => [word]);

// ---------------------------------------------------------------------------
// Colour palette — matches Majikah brand
// ---------------------------------------------------------------------------

const C = {
  ink: "#151515",
  inkLight: "#272525",
  inkFaint: "#514f4f",
  brand: "#ea7f05",
  brandMid: "#f2e0cb",
  brandSoft: "#f8eee2",
  brandAccent: "#ea7f05",
  green: "#9b9e00",
  greenSoft: "#cdce96",
  amber: "#ea7f05",
  amberSoft: "#FFF3E0",
  red: "#ff471e",
  redSoft: "#FDEAEA",
  blue: "#002968",
  blueSoft: "#EBF3FC",
  purple: "#6B5DD3",
  purpleSoft: "#F0EDFC",
  border: "#f2e0cb",
  borderLight: "#f8eee2",
  white: "#f8eee2",
  pageBackground: "#f8eee2",
  sectionLabel: "#514f4f",
  coverBg: "#151515",
  coverAccent: "#ea7f05",
} as const;

// ---------------------------------------------------------------------------
// Chart colours (for pie/donut slices, bars etc.)
// ---------------------------------------------------------------------------

const CHART_COLORS = [
  C.brandAccent,
  C.green,
  C.amber,
  C.red,
  C.purple,
  C.blue,
  "#E67E22",
  "#16A085",
  "#8E44AD",
  "#2C3E50",
];

const STATUS_CHART_COLORS: Record<string, string> = {
  paid: C.green,
  partial: C.amber,
  overdue: C.red,
  issued: C.blue,
  sent: C.blue,
  viewed: C.purple,
  draft: C.inkFaint,
  void: "#556070",
  disputed: C.red,
};

// ---------------------------------------------------------------------------
// Formatters (ASCII-safe currency — same fix as MajikInvoicePDF)
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

function fmtShort(amount: number, currency: string): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? "-" : "";
  if (abs >= 1_000_000)
    return `${sign}${currency} ${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}${currency} ${(abs / 1_000).toFixed(1)}K`;
  return fmt(amount, currency);
}

function fmtN(n: number): string {
  return new Intl.NumberFormat("en-PH").format(n);
}

function fmtPct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

function fmtDate(iso: string | null | undefined): string {
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

function fmtDateShort(iso: string | null | undefined): string {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleDateString("en-PH", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

function fmtDays(n: number | null): string {
  if (n === null) return "-";
  return `${n.toFixed(1)} days`;
}

// ---------------------------------------------------------------------------
// StyleSheet
// ---------------------------------------------------------------------------

const S = StyleSheet.create({
  // ── Pages ────────────────────────────────────────────────────────────────
  page: {
    backgroundColor: C.pageBackground,
    paddingTop: 36,
    paddingBottom: 52,
    paddingHorizontal: 40,
    fontFamily: "Helvetica",
    fontSize: 9,
    color: C.ink,
  },
  coverPage: {
    backgroundColor: C.coverBg,
    paddingTop: 0,
    paddingBottom: 0,
    paddingHorizontal: 0,
    fontFamily: "Helvetica",
    fontSize: 9,
    color: C.white,
  },

  // ── Layout ──────────────────────────────────────────────────────────────
  row: { flexDirection: "row" },
  col: { flexDirection: "column" },
  flex1: { flex: 1 },
  spacer: { flex: 1 },

  // ── Page header (non-cover) ──────────────────────────────────────────────
  pageHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 18,
    paddingBottom: 10,
    borderBottomWidth: 2,
    borderBottomColor: C.brand,
  },
  pageHeaderLeft: { flexDirection: "column" },
  pageHeaderRight: { flexDirection: "column", alignItems: "flex-end" },
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

  // ── Section label ────────────────────────────────────────────────────────
  sectionLabel: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 0.9,
    textTransform: "uppercase",
    color: C.sectionLabel,
    marginBottom: 8,
  },

  divider: {
    borderBottomWidth: 1,
    borderBottomColor: C.borderLight,
    marginVertical: 10,
  },
  dividerThick: {
    borderBottomWidth: 2,
    borderBottomColor: C.brand,
    marginVertical: 12,
  },

  // ── Cards ────────────────────────────────────────────────────────────────
  card: {
    backgroundColor: C.white,
    borderRadius: 6,
    border: `1pt solid ${C.border}`,
    padding: 16,
    marginBottom: 10,
  },
  cardNoPad: {
    backgroundColor: C.white,
    borderRadius: 6,
    border: `1pt solid ${C.border}`,
    marginBottom: 10,
    overflow: "hidden",
  },

  // ── KPI metric blocks ────────────────────────────────────────────────────
  kpiGrid4: { flexDirection: "row", gap: 8, marginBottom: 10 },
  kpiGrid3: { flexDirection: "row", gap: 10, marginBottom: 10 },
  kpiGrid2: { flexDirection: "row", gap: 10, marginBottom: 10 },
  kpiCard: {
    flex: 1,
    backgroundColor: C.white,
    borderRadius: 6,
    border: `1pt solid ${C.border}`,
    padding: 12,
    flexDirection: "column",
    gap: 4,
  },
  kpiLabel: { fontSize: 7, color: C.sectionLabel, letterSpacing: 0.3 },
  kpiValue: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: C.ink,
    letterSpacing: -0.3,
  },
  kpiSub: { fontSize: 7, color: C.inkFaint },
  kpiStripe: {
    height: 3,
    borderRadius: 1,
    marginBottom: 8,
  },

  // ── Table ────────────────────────────────────────────────────────────────
  tableHeader: {
    flexDirection: "row",
    backgroundColor: C.brand,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  tableHeaderCell: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: C.white,
    letterSpacing: 0.4,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.borderLight,
  },
  tableRowAlt: {
    backgroundColor: C.brandSoft,
  },
  tableCell: { fontSize: 8, color: C.ink },
  tableCellMono: { fontSize: 8, color: C.ink, fontFamily: "Helvetica" },
  tableCellFaint: { fontSize: 7, color: C.inkFaint },
  tableCellRight: { textAlign: "right" },
  tableCellBold: { fontFamily: "Helvetica-Bold" },

  // ── Two-col layout ────────────────────────────────────────────────────────
  twoCol: { flexDirection: "row", gap: 10, marginBottom: 10 },
  twoColLeft: { flex: 1 },
  twoColRight: { flex: 1 },

  threeCol: { flexDirection: "row", gap: 8, marginBottom: 10 },
  threeColItem: { flex: 1 },

  // ── Footer ───────────────────────────────────────────────────────────────
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

  // ── Status pill ───────────────────────────────────────────────────────────
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
    marginTop: 1,
  },

  // ── Highlight box ─────────────────────────────────────────────────────────
  highlightBox: {
    borderRadius: 5,
    padding: 10,
    marginBottom: 8,
  },
  alertBox: {
    borderRadius: 5,
    padding: 10,
    marginBottom: 8,
    border: `1px solid ${C.red}`,
    backgroundColor: C.redSoft,
  },
  warnBox: {
    borderRadius: 5,
    padding: 10,
    marginBottom: 8,
    border: `1px solid ${C.amber}`,
    backgroundColor: C.amberSoft,
  },
  successBox: {
    borderRadius: 5,
    padding: 10,
    marginBottom: 8,
    border: `1px solid ${C.green}`,
    backgroundColor: C.greenSoft,
  },
});

// ---------------------------------------------------------------------------
// SVG Chart Components
// All charts are pure SVG — no DOM, no external library.
// ---------------------------------------------------------------------------

/**
 * Donut chart — segments are drawn as SVG arcs.
 * data: [{ label, value, color }]
 */
interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

const DonutChart: React.FC<{
  data: DonutSegment[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerSub?: string;
}> = ({ data, size = 110, thickness = 22 }) => {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return null;

  const cx = size / 2;
  const cy = size / 2;
  const r = (size - thickness) / 2;

  // Build arcs
  const segments: React.ReactElement[] = [];
  let startAngle = -Math.PI / 2; // start at top

  data.forEach((seg, i) => {
    if (seg.value <= 0) return;
    const pct = seg.value / total;
    const sweep = pct * 2 * Math.PI;
    const endAngle = startAngle + sweep;

    // Arc flags
    // const largeArc = sweep > Math.PI ? 1 : 0;

    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);

    // const d = [`M ${x1} ${y1}`, `A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`].join(
    //   " ",
    // );

    segments.push(
      <Line
        key={i}
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={seg.color}
        strokeWidth={0}
      />,
    );

    // react-pdf SVG doesn't support <path>, so we use overlapping thick arcs
    // drawn as stroke on a circle — we approximate each segment with a
    // stroked arc via a series of short lines for compatibility.
    // We use a simpler workaround: render thick Circle strokes with dasharray.
    // The circumference is 2πr; each segment offset + length = fraction of circ.
    const circ = 2 * Math.PI * r;
    const dashLen = pct * circ;
    // const dashOffset =
    //   circ *
    //   (0.25 -
    //     data
    //       .slice(0, i)
    //       .reduce((s, d) => s + (d.value > 0 ? d.value / total : 0), 0));

    segments.push(
      <Circle
        key={`seg-${i}`}
        cx={cx}
        cy={cy}
        r={r}
        stroke={seg.color}
        strokeWidth={thickness}
        strokeDasharray={`${dashLen} ${circ - dashLen}`}
        // strokeDashoffset={dashOffset * circ}
        fill="none"
      />,
    );

    startAngle = endAngle;
  });

  return (
    <Svg width={size} height={size}>
      {/* Background ring */}
      <Circle
        cx={cx}
        cy={cy}
        r={r}
        stroke={C.borderLight}
        strokeWidth={thickness}
        fill="none"
      />
      {segments}
      {/* Center text — approximated with positioned Text */}
    </Svg>
  );
};

/**
 * Horizontal bar chart.
 * data: [{ label, value, color? }]
 */
interface HBarItem {
  label: string;
  value: number;
  subLabel?: string;
  color?: string;
}

const HorizontalBarChart: React.FC<{
  data: HBarItem[];
  maxValue?: number;
  width?: number;
  barHeight?: number;
  formatValue?: (v: number) => string;
}> = ({
  data,
  maxValue,
  width = 300,
  barHeight = 14,
  formatValue = (v) => String(v),
}) => {
  const max = maxValue ?? Math.max(...data.map((d) => d.value), 1);
  const labelWidth = 90;
  const valueWidth = 60;
  const barWidth = width - labelWidth - valueWidth - 8;
  const rowHeight = barHeight + 10;
  const height = data.length * rowHeight + 4;

  return (
    <Svg width={width} height={height}>
      {data.map((item, i) => {
        const y = i * rowHeight;
        const fillW = Math.max((item.value / max) * barWidth, 0);
        const color = item.color ?? CHART_COLORS[i % CHART_COLORS.length];
        return (
          <React.Fragment key={i}>
            {/* Track */}
            <Rect
              x={labelWidth}
              y={y + 2}
              width={barWidth}
              height={barHeight - 2}
              rx={3}
              fill={C.borderLight}
            />
            {/* Fill */}
            {fillW > 0 && (
              <Rect
                x={labelWidth}
                y={y + 2}
                width={fillW}
                height={barHeight - 2}
                rx={3}
                fill={color}
              />
            )}
            {/* Label */}
            <Text
              x={labelWidth - 5}
              y={y + barHeight - 4}
              style={{
                fontSize: 7,
                fontFamily: "Helvetica",
                fill: C.inkLight,
                textAnchor: "end",
              }}
            >
              {item.label.length > 14
                ? item.label.slice(0, 13) + "…"
                : item.label}
            </Text>
            {/* Value */}
            <Text
              x={labelWidth + barWidth + 5}
              y={y + barHeight - 4}
              style={{
                fontSize: 7,
                fontFamily: "Helvetica-Bold",
                fill: C.ink,
              }}
            >
              {formatValue(item.value)}
            </Text>
          </React.Fragment>
        );
      })}
    </Svg>
  );
};

/**
 * Vertical bar chart — for simple count/amount comparisons.
 */
interface VBarItem {
  label: string;
  value: number;
  color?: string;
}

const VerticalBarChart: React.FC<{
  data: VBarItem[];
  width?: number;
  height?: number;
  formatValue?: (v: number) => string;
}> = ({ data, width = 280, height = 100, formatValue = (v) => String(v) }) => {
  const max = Math.max(...data.map((d) => d.value), 1);
  const chartH = height - 30; // reserve space for labels below
  const barW = Math.floor((width - 20) / data.length) - 6;
  const gap = 6;
  const startX = 10;

  return (
    <Svg width={width} height={height}>
      {/* Baseline */}
      <Line
        x1={startX}
        y1={chartH}
        x2={width - 10}
        y2={chartH}
        stroke={C.border}
        strokeWidth={1}
      />
      {data.map((item, i) => {
        const barH = Math.max((item.value / max) * chartH * 0.9, 2);
        const x = startX + i * (barW + gap);
        const y = chartH - barH;
        const color = item.color ?? CHART_COLORS[i % CHART_COLORS.length];
        const label =
          item.label.length > 7 ? item.label.slice(0, 6) + "…" : item.label;

        return (
          <React.Fragment key={i}>
            <Rect x={x} y={y} width={barW} height={barH} rx={2} fill={color} />
            {/* Value above bar */}
            <Text
              x={x + barW / 2}
              y={y - 3}
              style={{
                fontSize: 6,
                fontFamily: "Helvetica-Bold",
                fill: C.ink,
                textAnchor: "middle",
              }}
            >
              {formatValue(item.value)}
            </Text>
            {/* X-axis label */}
            <Text
              x={x + barW / 2}
              y={chartH + 10}
              style={{
                fontSize: 6,
                fontFamily: "Helvetica",
                fill: C.inkLight,
                textAnchor: "middle",
              }}
            >
              {label}
            </Text>
          </React.Fragment>
        );
      })}
    </Svg>
  );
};

/**
 * Simple stacked bar — shows two values (e.g. collected vs outstanding).
 */
const StackedProgressBar: React.FC<{
  segments: Array<{ value: number; color: string; label: string }>;
  width?: number;
  height?: number;
  total: number;
}> = ({ segments, width = 400, height = 14, total }) => {
  if (total <= 0) return null;
  let xOffset = 0;

  return (
    <Svg width={width} height={height + 4}>
      {/* Background */}
      <Rect
        x={0}
        y={2}
        width={width}
        height={height}
        rx={4}
        fill={C.borderLight}
      />
      {segments.map((seg, i) => {
        const w = Math.max((seg.value / total) * width, 0);
        const el = (
          <Rect
            key={i}
            x={xOffset}
            y={2}
            width={w}
            height={height}
            rx={i === 0 ? 4 : 0}
            fill={seg.color}
          />
        );
        xOffset += w;
        return el;
      })}
    </Svg>
  );
};

// ---------------------------------------------------------------------------
// Legend row helper
// ---------------------------------------------------------------------------

const LegendRow: React.FC<{
  items: Array<{ label: string; color: string; value?: string }>;
}> = ({ items }) => (
  <View
    style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 8 }}
  >
    {items.map((item, i) => (
      <View
        key={i}
        style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
      >
        <View
          style={{
            width: 8,
            height: 8,
            borderRadius: 2,
            backgroundColor: item.color,
          }}
        />
        <Text style={{ fontSize: 7, color: C.inkLight }}>
          {item.label}
          {item.value ? ` — ${item.value}` : ""}
        </Text>
      </View>
    ))}
  </View>
);

// ---------------------------------------------------------------------------
// Shared footer
// ---------------------------------------------------------------------------

const DocFooter: React.FC<{
  businessName?: string;
  reportLabel: string;
}> = ({ businessName, reportLabel }) => (
  <View style={S.footer} fixed>
    <Text style={S.footerText}>{businessName ?? "Majik Buwiz"}</Text>
    <Text style={S.footerText}>{reportLabel}</Text>
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
// Page header (non-cover pages)
// ---------------------------------------------------------------------------

const PageHeader: React.FC<{
  title: string;
  subtitle?: string;
  badgeLabel?: string;
  periodLabel?: string;
}> = ({ title, subtitle, badgeLabel, periodLabel }) => (
  <View style={S.pageHeader} fixed>
    <View style={S.pageHeaderLeft}>
      <Text style={S.pageHeaderTitle}>{title}</Text>
      {subtitle && <Text style={S.pageHeaderSub}>{subtitle}</Text>}
    </View>
    <View style={{ flexDirection: "column", alignItems: "flex-end", gap: 3 }}>
      {badgeLabel && <Text style={S.pageHeaderBadge}>{badgeLabel}</Text>}
      {periodLabel && (
        <Text style={{ fontSize: 7, color: C.inkFaint }}>{periodLabel}</Text>
      )}
    </View>
  </View>
);

// ---------------------------------------------------------------------------
// KPI card
// ---------------------------------------------------------------------------

const KPICard: React.FC<{
  label: string;
  value: string;
  sub?: string;
  stripeColor?: string;
}> = ({ label, value, sub, stripeColor }) => (
  <View style={S.kpiCard}>
    {stripeColor && (
      <View style={[S.kpiStripe, { backgroundColor: stripeColor }]} />
    )}
    <Text style={S.kpiLabel}>{label}</Text>
    <Text style={S.kpiValue}>{value}</Text>
    {sub && <Text style={S.kpiSub}>{sub}</Text>}
  </View>
);

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface MajikBuwizSummaryDocumentProps {
  stats: DashboardStats;
  currency?: string;
  /**
   * The period the data was filtered by in the dashboard.
   * If omitted, derived from oldest/newest invoice dates.
   */
  period?: {
    label: string;
    from?: Date;
    to?: Date;
  };
  /**
   * Business identity for cover page branding.
   */
  business?: {
    name: string;
    tin?: string;
    tagline?: string;
    logo?: string;
  };
  /**
   * Name of the person/system that generated this report.
   */
  generatedBy?: string;
}

// ---------------------------------------------------------------------------
// Cover page
// ---------------------------------------------------------------------------

const CoverPage: React.FC<{
  stats: DashboardStats;
  currency: string;
  periodLabel: string;
  periodRange: string;
  business?: MajikBuwizSummaryDocumentProps["business"];
  generatedOn: string;
  generatedBy?: string;
}> = ({
  stats,
  currency,
  periodLabel,
  periodRange,
  business,
  generatedOn,
  generatedBy,
}) => (
  <Page size="A4" style={S.coverPage}>
    {/* Top decorative band */}
    <View
      style={{
        backgroundColor: C.coverAccent,
        height: 6,
        width: "100%",
      }}
    />

    {/* Main cover area */}
    <View
      style={{
        flex: 1,
        paddingHorizontal: 48,
        paddingTop: 60,
        paddingBottom: 40,
        flexDirection: "column",
      }}
    >
      {/* Logo / brand mark */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          marginBottom: 48,
        }}
      >
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            backgroundColor: C.coverAccent,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <PDFImage
            src={business?.logo || Asset_Logo_150px}
            style={{
              width: 36,
              height: 36,
              backgroundColor: "transparent",
              objectFit: "cover",
              alignItems: "center",
              justifyContent: "center",
            }}
          />
        </View>
        <View>
          <Text
            style={{
              fontSize: 12,
              fontFamily: "Helvetica-Bold",
              color: C.white,
            }}
          >
            Majik Buwiz
          </Text>
          <Text style={{ fontSize: 8, color: C.brandMid, marginTop: 3 }}>
            by Majikah Information Technology Solutions
          </Text>
        </View>
      </View>

      {/* Main title block */}
      <View style={{ marginBottom: 32 }}>
        <Text
          style={{
            fontSize: 32,
            fontFamily: "Helvetica-Bold",
            color: C.white,
            letterSpacing: -0.5,
            lineHeight: 1.15,
            marginBottom: 8,
          }}
        >
          Financial{"\n"}Summary Report
        </Text>
        <View
          style={{
            width: 48,
            height: 3,
            backgroundColor: C.coverAccent,
            borderRadius: 2,
            marginBottom: 16,
          }}
        />
        <Text style={{ fontSize: 13, color: "#AAAACC", marginBottom: 4 }}>
          {periodLabel}
        </Text>
        <Text style={{ fontSize: 9, color: "#7777AA" }}>{periodRange}</Text>
      </View>

      {/* Business identity */}
      {business && (
        <View
          style={{
            backgroundColor: "rgba(255,255,255,0.05)",
            borderRadius: 8,
            border: `1px solid ${C.inkFaint}`,
            padding: 16,
            marginBottom: 32,
          }}
        >
          <Text
            style={{
              fontSize: 15,
              fontFamily: "Helvetica-Bold",
              color: C.white,
              marginBottom: 4,
            }}
          >
            {business.name}
          </Text>
          {business.tin && (
            <Text style={{ fontSize: 8, color: "#8888BB", marginBottom: 2 }}>
              TIN: {business.tin}
            </Text>
          )}
          {business.tagline && (
            <Text style={{ fontSize: 8, color: "#8888BB" }}>
              {business.tagline}
            </Text>
          )}
        </View>
      )}

      {/* Headline KPIs on cover */}
      <View style={{ flexDirection: "row", gap: 12, marginBottom: 40 }}>
        {[
          {
            label: "Total Invoices",
            value: fmtN(stats.total),
            color: C.coverAccent,
          },
          {
            label: "Gross Revenue",
            value: fmtShort(stats.totalAmount, currency),
            color: C.green,
          },
          {
            label: "Collected",
            value: fmtShort(stats.totalCollected, currency),
            color: C.greenSoft,
          },
          {
            label: "Output Tax",
            value: fmtShort(stats.taxCollected, currency),
            color: C.brandAccent,
          },
        ].map((kpi, i) => (
          <View
            key={i}
            style={{
              flex: 1,
              borderTopWidth: 2,
              borderTopColor: kpi.color,
              paddingTop: 10,
            }}
          >
            <Text
              style={{
                fontSize: 16,
                fontFamily: "Helvetica-Bold",
                color: C.white,
                marginBottom: 2,
              }}
            >
              {kpi.value}
            </Text>
            <Text style={{ fontSize: 7, color: C.brandSoft }}>{kpi.label}</Text>
          </View>
        ))}
      </View>

      {/* Spacer */}
      <View style={{ flex: 1 }} />

      {/* Footer meta */}
      <View
        style={{
          borderTopWidth: 1,
          borderTopColor: "rgba(255,255,255,0.1)",
          paddingTop: 12,
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "flex-end",
        }}
      >
        <View>
          <Text style={{ fontSize: 7, color: C.brandMid }}>Generated on</Text>
          <Text style={{ fontSize: 8, color: C.brandMid }}>{generatedOn}</Text>
          {generatedBy && (
            <Text style={{ fontSize: 7, color: C.brandMid, marginTop: 2 }}>
              by {generatedBy}
            </Text>
          )}
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={{ fontSize: 7, color: C.brandMid }}>Powered by</Text>
          <Text
            style={{
              fontSize: 9,
              fontFamily: "Helvetica-Bold",
              color: C.brandMid,
            }}
          >
            Majikah Information Technology Solutions
          </Text>
        </View>
      </View>
    </View>

    {/* Bottom accent */}
    <View
      style={{ backgroundColor: C.coverAccent, height: 4, width: "100%" }}
    />
  </Page>
);

// ---------------------------------------------------------------------------
// Page 2 — Revenue & Collections
// ---------------------------------------------------------------------------

const RevenuePage: React.FC<{
  stats: DashboardStats;
  currency: string;
  periodLabel: string;
  footer: React.ReactElement;
}> = ({ stats, currency, periodLabel, footer }) => {
  const collectionRate =
    stats.totalAmount > 0 ? stats.totalCollected / stats.totalAmount : 0;
  const overdueRate =
    stats.totalAmount > 0 ? stats.overdueAmount / stats.totalAmount : 0;

  const progressSegments = [
    { value: stats.paidAmount, color: C.green, label: "Paid" },
    { value: stats.partialAmount, color: C.amber, label: "Partial" },
    { value: stats.overdueAmount, color: C.red, label: "Overdue" },
    {
      value: Math.max(
        stats.totalAmount -
          stats.paidAmount -
          stats.partialAmount -
          stats.overdueAmount,
        0,
      ),
      color: C.blue,
      label: "Other",
    },
  ].filter((s) => s.value > 0);

  const donutData: DonutSegment[] = [
    { label: "Collected", value: stats.totalCollected, color: C.green },
    {
      label: "Outstanding",
      value: Math.max(stats.totalOutstanding, 0),
      color: C.amber,
    },
    { label: "Overdue", value: stats.overdueAmount, color: C.red },
  ].filter((d) => d.value > 0);

  return (
    <Page size="A4" style={S.page} wrap>
      <PageHeader
        title="Revenue & Collections"
        subtitle="Gross revenue, payment settlement, and outstanding balances"
        badgeLabel="REVENUE"
        periodLabel={periodLabel}
      />

      {/* Top KPI row */}
      <View style={S.kpiGrid4}>
        <KPICard
          label="Gross Revenue"
          value={fmtShort(stats.totalAmount, currency)}
          sub={`${fmtN(stats.total)} invoices`}
          stripeColor={C.brandAccent}
        />
        <KPICard
          label="Collected"
          value={fmtShort(stats.totalCollected, currency)}
          sub={`${fmtPct(collectionRate)} rate`}
          stripeColor={C.green}
        />
        <KPICard
          label="Outstanding"
          value={fmtShort(stats.totalOutstanding, currency)}
          sub={`${stats.paidCount} fully paid`}
          stripeColor={C.amber}
        />
        <KPICard
          label="Overdue"
          value={fmtShort(stats.overdueAmount, currency)}
          sub={`${fmtPct(overdueRate)} of gross`}
          stripeColor={C.red}
        />
      </View>

      {/* Stacked progress bar */}
      <View style={S.card}>
        <Text style={S.sectionLabel}>Revenue Composition</Text>
        <StackedProgressBar
          segments={progressSegments}
          total={stats.totalAmount}
          width={455}
          height={16}
        />
        <LegendRow
          items={progressSegments.map((s) => ({
            label: s.label,
            color: s.color,
            value: fmtPct(s.value / stats.totalAmount),
          }))}
        />
      </View>

      {/* Two-column: Donut + Metrics */}
      <View style={S.twoCol}>
        {/* Donut chart */}
        <View style={[S.card, { flex: 1, alignItems: "center" }]}>
          <Text style={[S.sectionLabel, { marginBottom: 12 }]}>
            Collection Breakdown
          </Text>
          <DonutChart data={donutData} size={120} thickness={24} />
          <LegendRow
            items={donutData.map((d) => ({
              label: d.label,
              color: d.color,
              value: fmtPct(
                d.value / (donutData.reduce((s, x) => s + x.value, 0) || 1),
              ),
            }))}
          />
        </View>

        {/* Payment metrics */}
        <View style={[S.card, { flex: 1 }]}>
          <Text style={S.sectionLabel}>Settlement Metrics</Text>
          <View style={S.divider} />

          {[
            {
              label: "Avg Days to Payment",
              value: fmtDays(stats.avgDaysToPayment),
              sub: "Issue → first settlement",
            },
            {
              label: "Avg Invoice Value",
              value: fmt(stats.avgInvoiceValue, currency),
              sub: "Mean grand total",
            },
            {
              label: "Median Invoice Value",
              value: fmt(stats.medianInvoiceValue, currency),
              sub: "50th percentile",
            },
            {
              label: "Largest Invoice",
              value: fmt(stats.largestInvoice, currency),
              sub: "Peak transaction",
            },
            {
              label: "Smallest Invoice",
              value: fmt(stats.smallestInvoice, currency),
              sub: "Minimum transaction",
            },
          ].map((row, i) => (
            <View
              key={i}
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                paddingVertical: 6,
                borderBottomWidth: 1,
                borderBottomColor: C.borderLight,
              }}
            >
              <View>
                <Text style={[S.tableCell, { fontFamily: "Helvetica" }]}>
                  {row.label}
                </Text>
                <Text style={S.tableCellFaint}>{row.sub}</Text>
              </View>
              <Text style={[S.tableCellMono, { fontFamily: "Helvetica-Bold" }]}>
                {row.value}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* Alert boxes */}
      {stats.overdueCount > 0 && (
        <View style={S.alertBox}>
          <Text
            style={{
              fontSize: 8,
              fontFamily: "Helvetica-Bold",
              color: C.red,
              marginBottom: 2,
            }}
          >
            Overdue Alert
          </Text>
          <Text style={{ fontSize: 8, color: C.red }}>
            {stats.overdueCount} invoice{stats.overdueCount !== 1 ? "s" : ""}{" "}
            totalling {fmt(stats.overdueAmount, currency)} are past due.
            Immediate collection action is recommended.
          </Text>
        </View>
      )}
      {stats.dueSoonCount > 0 && (
        <View style={S.warnBox}>
          <Text
            style={{
              fontSize: 8,
              fontFamily: "Helvetica-Bold",
              color: C.amber,
              marginBottom: 2,
            }}
          >
            Due Soon
          </Text>
          <Text style={{ fontSize: 8, color: C.amber }}>
            {stats.dueSoonCount} invoice{stats.dueSoonCount !== 1 ? "s" : ""}{" "}
            are due within the next 7 days. Ensure follow-ups are in place.
          </Text>
        </View>
      )}

      {footer}
    </Page>
  );
};

// ---------------------------------------------------------------------------
// Page 3 — Tax & Withholding
// ---------------------------------------------------------------------------

const TaxPage: React.FC<{
  stats: DashboardStats;
  currency: string;
  periodLabel: string;
  footer: React.ReactElement;
}> = ({ stats, currency, periodLabel, footer }) => {
  const withholdingRate =
    stats.totalAmount > 0 ? stats.withholdingTotal / stats.totalAmount : 0;
  const discountRate =
    stats.totalAmount > 0 ? stats.discountGiven / stats.totalAmount : 0;

  // Bar chart data for tax breakdown
  const taxBarData: HBarItem[] = stats.taxBreakdown
    .sort((a, b) => b.amount - a.amount)
    .map((t, i) => ({
      label: t.taxType,
      value: t.amount,
      color: CHART_COLORS[i % CHART_COLORS.length],
    }));

  return (
    <Page size="A4" style={S.page} wrap>
      <PageHeader
        title="Tax & Withholding"
        subtitle="Output tax, EWT, net payable, and effective rates"
        badgeLabel="TAX"
        periodLabel={periodLabel}
      />

      {/* KPI row */}
      <View style={S.kpiGrid4}>
        <KPICard
          label="Output Tax Collected"
          value={fmtShort(stats.taxCollected, currency)}
          sub={`Effective rate: ${fmtPct(stats.effectiveTaxRate)}`}
          stripeColor={C.brandAccent}
        />
        <KPICard
          label="EWT Withheld"
          value={fmtShort(stats.withholdingTotal, currency)}
          sub={`${fmtPct(withholdingRate)} of gross`}
          stripeColor={C.amber}
        />
        <KPICard
          label="Net Payable"
          value={fmtShort(stats.netPayable, currency)}
          sub="After EWT deductions"
          stripeColor={C.green}
        />
        <KPICard
          label="Discounts Given"
          value={fmtShort(stats.discountGiven, currency)}
          sub={`${fmtPct(discountRate)} revenue forgone`}
          stripeColor={C.red}
        />
      </View>

      {/* Two-col: Bar chart + Effective rate box */}
      <View style={S.twoCol}>
        {/* Tax breakdown bar chart */}
        <View style={[S.card, { flex: 1.4 }]}>
          <Text style={S.sectionLabel}>Tax Type Breakdown</Text>
          {taxBarData.length === 0 ? (
            <Text style={{ fontSize: 8, color: C.inkFaint }}>
              No tax data available.
            </Text>
          ) : (
            <HorizontalBarChart
              data={taxBarData}
              width={280}
              barHeight={14}
              formatValue={(v) => fmtShort(v, currency)}
            />
          )}
        </View>

        {/* Rates summary */}
        <View style={[S.card, { flex: 1 }]}>
          <Text style={S.sectionLabel}>Rate Analysis</Text>
          <View style={S.divider} />
          {[
            {
              label: "Effective Tax Rate",
              value: fmtPct(stats.effectiveTaxRate),
              sub: "Weighted avg output tax / subtotal",
            },
            {
              label: "Withholding Rate",
              value: fmtPct(withholdingRate),
              sub: "EWT / gross revenue",
            },
            {
              label: "Discount Rate",
              value: fmtPct(discountRate),
              sub: "Discounts / gross revenue",
            },
            {
              label: "Net-to-Gross Ratio",
              value: fmtPct(
                stats.totalAmount > 0
                  ? stats.netPayable / stats.totalAmount
                  : 0,
              ),
              sub: "Net payable / gross",
            },
          ].map((row, i) => (
            <View
              key={i}
              style={{
                paddingVertical: 7,
                borderBottomWidth: 1,
                borderBottomColor: C.borderLight,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                }}
              >
                <Text style={[S.tableCell]}>{row.label}</Text>
                <Text
                  style={[S.tableCellMono, { fontFamily: "Helvetica-Bold" }]}
                >
                  {row.value}
                </Text>
              </View>
              <Text style={S.tableCellFaint}>{row.sub}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Tax breakdown table */}
      {stats.taxBreakdown.length > 0 && (
        <View style={S.cardNoPad}>
          <View style={S.tableHeader}>
            {["Tax Type", "Avg Rate", "Total Amount", "% of Tax Total"].map(
              (h, i) => (
                <Text
                  key={i}
                  style={[
                    S.tableHeaderCell,
                    {
                      flex: i === 0 ? 2 : 1,
                      textAlign: i > 1 ? "right" : "left",
                    },
                  ]}
                >
                  {h}
                </Text>
              ),
            )}
          </View>
          {stats.taxBreakdown
            .sort((a, b) => b.amount - a.amount)
            .map((t, i) => (
              <View
                key={t.taxType}
                style={[S.tableRow, i % 2 === 1 ? S.tableRowAlt : {}]}
              >
                <Text style={[S.tableCellBold, S.tableCell, { flex: 2 }]}>
                  {t.taxType}
                </Text>
                <Text style={[S.tableCellMono, { flex: 1 }]}>
                  {fmtPct(t.rate)}
                </Text>
                <Text
                  style={[S.tableCellMono, { flex: 1, textAlign: "right" }]}
                >
                  {fmt(t.amount, currency)}
                </Text>
                <Text
                  style={[
                    S.tableCellFaint,
                    S.tableCellMono,
                    { flex: 1, textAlign: "right" },
                  ]}
                >
                  {stats.taxCollected > 0
                    ? fmtPct(t.amount / stats.taxCollected)
                    : "-"}
                </Text>
              </View>
            ))}
        </View>
      )}

      {footer}
    </Page>
  );
};

// ---------------------------------------------------------------------------
// Page 4 — Invoice Health
// ---------------------------------------------------------------------------

const InvoiceHealthPage: React.FC<{
  stats: DashboardStats;
  currency: string;
  periodLabel: string;
  footer: React.ReactElement;
}> = ({ stats, currency, periodLabel, footer }) => {
  // Status bar chart
  const statusBarData: VBarItem[] = Object.entries(stats.byStatus)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([status, count]) => ({
      label: status,
      value: count,
      color: STATUS_CHART_COLORS[status] ?? C.brandAccent,
    }));

  // Amount by status bar chart
  const statusAmountData: HBarItem[] = Object.entries(stats.byStatusAmount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([status, amount], i) => ({
      label: status,
      value: amount,
      color: STATUS_CHART_COLORS[status] ?? CHART_COLORS[i],
    }));

  const healthMetrics = [
    {
      label: "Partially Paid",
      count: stats.partialCount,
      color: C.amber,
    },
    { label: "Drafts", count: stats.draftCount, color: C.inkFaint },
    {
      label: "Encrypted / Locked",
      count: stats.encryptedCount,
      color: C.purple,
    },
    { label: "Unsigned", count: stats.unsignedCount, color: C.red },
    { label: "Due Soon (7d)", count: stats.dueSoonCount, color: C.amber },
    { label: "Overdue", count: stats.overdueCount, color: C.red },
  ];

  return (
    <Page size="A4" style={S.page} wrap>
      <PageHeader
        title="Invoice Health"
        subtitle="Status distribution, structural integrity, and sizing metrics"
        badgeLabel="HEALTH"
        periodLabel={periodLabel}
      />

      {/* Health metrics grid */}
      <View style={S.kpiGrid4}>
        {healthMetrics.slice(0, 4).map((m, i) => (
          <KPICard
            key={i}
            label={m.label}
            value={fmtN(m.count)}
            sub={
              stats.total > 0
                ? `${fmtPct(m.count / stats.total)} of total`
                : undefined
            }
            stripeColor={m.color}
          />
        ))}
      </View>
      <View style={S.kpiGrid4}>
        {healthMetrics.slice(4).map((m, i) => (
          <KPICard
            key={i}
            label={m.label}
            value={fmtN(m.count)}
            sub={
              stats.total > 0
                ? `${fmtPct(m.count / stats.total)} of total`
                : undefined
            }
            stripeColor={m.color}
          />
        ))}
        {/* Pad to 4 */}
        <View style={S.kpiCard}>
          <Text style={S.kpiLabel}>Unique Issuers</Text>
          <Text style={S.kpiValue}>{fmtN(stats.uniqueIssuerCount)}</Text>
          <Text style={S.kpiSub}>Distinct issuing entities</Text>
        </View>
        <View style={S.kpiCard}>
          <Text style={S.kpiLabel}>Unique Recipients</Text>
          <Text style={S.kpiValue}>{fmtN(stats.uniqueRecipientCount)}</Text>
          <Text style={S.kpiSub}>Distinct clients billed</Text>
        </View>
      </View>

      {/* Two-col: Count bar + Amount bar */}
      <View style={S.twoCol}>
        <View style={[S.card, { flex: 1 }]}>
          <Text style={S.sectionLabel}>Invoice Count by Status</Text>
          <VerticalBarChart
            data={statusBarData}
            width={230}
            height={110}
            formatValue={(v) => String(v)}
          />
        </View>
        <View style={[S.card, { flex: 1 }]}>
          <Text style={S.sectionLabel}>Revenue by Status</Text>
          <HorizontalBarChart
            data={statusAmountData}
            width={220}
            barHeight={13}
            formatValue={(v) => fmtShort(v, currency)}
          />
        </View>
      </View>

      {/* Status breakdown table */}
      <View style={S.cardNoPad}>
        <View style={S.tableHeader}>
          {["Status", "Count", "% Count", "Total Value", "% Revenue"].map(
            (h, i) => (
              <Text
                key={i}
                style={[
                  S.tableHeaderCell,
                  {
                    flex: i === 0 ? 1.5 : 1,
                    textAlign: i > 0 ? "right" : "left",
                  },
                ]}
              >
                {h}
              </Text>
            ),
          )}
        </View>
        {Object.entries(stats.byStatusAmount)
          .sort((a, b) => b[1] - a[1])
          .map(([status, amount], i) => {
            const count = stats.byStatus[status] ?? 0;
            return (
              <View
                key={status}
                style={[S.tableRow, i % 2 === 1 ? S.tableRowAlt : {}]}
              >
                <View
                  style={{
                    flex: 1.5,
                    flexDirection: "row",
                    alignItems: "center",
                  }}
                >
                  <View
                    style={[
                      S.statusDot,
                      {
                        backgroundColor:
                          STATUS_CHART_COLORS[status] ?? C.inkFaint,
                      },
                    ]}
                  />
                  <Text style={[S.tableCell, { textTransform: "capitalize" }]}>
                    {status}
                  </Text>
                </View>
                <Text
                  style={[S.tableCellMono, { flex: 1, textAlign: "right" }]}
                >
                  {count}
                </Text>
                <Text
                  style={[
                    S.tableCellFaint,
                    S.tableCellMono,
                    { flex: 1, textAlign: "right" },
                  ]}
                >
                  {stats.total > 0 ? fmtPct(count / stats.total) : "-"}
                </Text>
                <Text
                  style={[S.tableCellMono, { flex: 1, textAlign: "right" }]}
                >
                  {fmt(amount, currency)}
                </Text>
                <Text
                  style={[
                    S.tableCellFaint,
                    S.tableCellMono,
                    { flex: 1, textAlign: "right" },
                  ]}
                >
                  {stats.totalAmount > 0
                    ? fmtPct(amount / stats.totalAmount)
                    : "-"}
                </Text>
              </View>
            );
          })}
      </View>

      {footer}
    </Page>
  );
};

// ---------------------------------------------------------------------------
// Page 5 — Client Intelligence
// ---------------------------------------------------------------------------

const ClientPage: React.FC<{
  stats: DashboardStats;
  currency: string;
  periodLabel: string;
  footer: React.ReactElement;
}> = ({ stats, currency, periodLabel, footer }) => {
  // const maxAmount = stats.topRecipients[0]?.totalAmount ?? 1;

  const recipientBarData: HBarItem[] = stats.topRecipients.map((r, i) => ({
    label: r.name,
    value: r.totalAmount,
    color: CHART_COLORS[i % CHART_COLORS.length],
  }));

  return (
    <Page size="A4" style={S.page} wrap>
      <PageHeader
        title="Client Intelligence"
        subtitle="Top recipients by revenue, invoice volume, and payment behaviour"
        badgeLabel="CLIENTS"
        periodLabel={periodLabel}
      />

      {/* Summary KPIs */}
      <View style={S.kpiGrid3}>
        <KPICard
          label="Unique Recipients"
          value={fmtN(stats.uniqueRecipientCount)}
          sub="Distinct clients billed"
          stripeColor={C.brandAccent}
        />
        <KPICard
          label="Top Client Revenue"
          value={fmtShort(stats.topRecipients[0]?.totalAmount ?? 0, currency)}
          sub={stats.topRecipients[0]?.name ?? "-"}
          stripeColor={C.green}
        />
        <KPICard
          label="Top Client Share"
          value={
            stats.totalAmount > 0 && stats.topRecipients[0]
              ? fmtPct(stats.topRecipients[0].totalAmount / stats.totalAmount)
              : "-"
          }
          sub="% of gross revenue"
          stripeColor={C.amber}
        />
      </View>

      {/* Top recipients bar chart */}
      {recipientBarData.length > 0 && (
        <View style={S.card}>
          <Text style={S.sectionLabel}>
            Top {recipientBarData.length} Recipients by Revenue
          </Text>
          <HorizontalBarChart
            data={recipientBarData}
            width={455}
            barHeight={16}
            formatValue={(v) => fmtShort(v, currency)}
          />
        </View>
      )}

      {/* Top recipients table */}
      {stats.topRecipients.length > 0 && (
        <View style={S.cardNoPad}>
          <View style={S.tableHeader}>
            {[
              "#",
              "Recipient",
              "Invoices",
              "Total Revenue",
              "Collected",
              "% of Gross",
            ].map((h, i) => (
              <Text
                key={i}
                style={[
                  S.tableHeaderCell,
                  {
                    flex: i === 1 ? 2.5 : 1,
                    textAlign: i > 1 ? "right" : "left",
                  },
                ]}
              >
                {h}
              </Text>
            ))}
          </View>
          {stats.topRecipients.map((r, i) => (
            <View
              key={r.name}
              style={[S.tableRow, i % 2 === 1 ? S.tableRowAlt : {}]}
            >
              <Text style={[S.tableCellFaint, { flex: 1 }]}>{i + 1}</Text>
              <View style={{ flex: 2.5 }}>
                <Text style={[S.tableCell, { fontFamily: "Helvetica-Bold" }]}>
                  {r.name.length > 28 ? r.name.slice(0, 27) + "…" : r.name}
                </Text>
              </View>
              <Text style={[S.tableCellMono, { flex: 1, textAlign: "right" }]}>
                {r.count}
              </Text>
              <Text style={[S.tableCellMono, { flex: 1, textAlign: "right" }]}>
                {fmt(r.totalAmount, currency)}
              </Text>
              <Text
                style={[
                  S.tableCellMono,
                  { flex: 1, textAlign: "right", color: C.green },
                ]}
              >
                {fmt(r.paidAmount, currency)}
              </Text>
              <Text
                style={[
                  S.tableCellFaint,
                  S.tableCellMono,
                  { flex: 1, textAlign: "right" },
                ]}
              >
                {stats.totalAmount > 0
                  ? fmtPct(r.totalAmount / stats.totalAmount)
                  : "-"}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Concentration risk note */}
      {stats.topRecipients.length > 0 &&
        stats.totalAmount > 0 &&
        (() => {
          const top1Pct =
            stats.topRecipients[0].totalAmount / stats.totalAmount;
          const top3Pct =
            stats.topRecipients
              .slice(0, 3)
              .reduce((s, r) => s + r.totalAmount, 0) / stats.totalAmount;
          if (top1Pct > 0.4) {
            return (
              <View style={S.warnBox}>
                <Text
                  style={{
                    fontSize: 8,
                    fontFamily: "Helvetica-Bold",
                    color: C.amber,
                    marginBottom: 2,
                  }}
                >
                  Revenue Concentration Risk
                </Text>
                <Text style={{ fontSize: 8, color: C.amber }}>
                  Your top client accounts for {fmtPct(top1Pct)} of gross
                  revenue.
                  {top3Pct > 0.7
                    ? ` Your top 3 clients represent ${fmtPct(top3Pct)}. Consider diversifying your client base to reduce revenue risk.`
                    : " Monitor this dependency carefully."}
                </Text>
              </View>
            );
          }
          return null;
        })()}

      {footer}
    </Page>
  );
};

// ---------------------------------------------------------------------------
// Page 6 — Appendix / Summary
// ---------------------------------------------------------------------------

const AppendixPage: React.FC<{
  stats: DashboardStats;
  currency: string;
  periodLabel: string;
  periodRange: string;
  business?: MajikBuwizSummaryDocumentProps["business"];
  generatedOn: string;
  generatedBy?: string;
  footer: React.ReactElement;
}> = ({
  stats,
  currency,
  periodLabel,
  periodRange,
  business,
  generatedOn,
  generatedBy,
  footer,
}) => {
  const summaryRows: Array<{ label: string; value: string; mono?: boolean }> = [
    { label: "Report Period", value: periodLabel },
    { label: "Data Range", value: periodRange },
    { label: "Total Invoices", value: fmtN(stats.total) },
    {
      label: "Gross Revenue",
      value: fmt(stats.totalAmount, currency),
      mono: true,
    },
    {
      label: "Total Collected",
      value: fmt(stats.totalCollected, currency),
      mono: true,
    },
    {
      label: "Total Outstanding",
      value: fmt(stats.totalOutstanding, currency),
      mono: true,
    },
    {
      label: "Total Overdue",
      value: fmt(stats.overdueAmount, currency),
      mono: true,
    },
    {
      label: "Output Tax",
      value: fmt(stats.taxCollected, currency),
      mono: true,
    },
    {
      label: "EWT Withheld",
      value: fmt(stats.withholdingTotal, currency),
      mono: true,
    },
    {
      label: "Net Payable",
      value: fmt(stats.netPayable, currency),
      mono: true,
    },
    {
      label: "Discounts Given",
      value: fmt(stats.discountGiven, currency),
      mono: true,
    },
    { label: "Effective Tax Rate", value: fmtPct(stats.effectiveTaxRate) },
    {
      label: "Avg Invoice Value",
      value: fmt(stats.avgInvoiceValue, currency),
      mono: true,
    },
    {
      label: "Median Invoice Value",
      value: fmt(stats.medianInvoiceValue, currency),
      mono: true,
    },
    {
      label: "Largest Invoice",
      value: fmt(stats.largestInvoice, currency),
      mono: true,
    },
    {
      label: "Smallest Invoice",
      value: fmt(stats.smallestInvoice, currency),
      mono: true,
    },
    { label: "Avg Days to Payment", value: fmtDays(stats.avgDaysToPayment) },
    { label: "Unique Recipients", value: fmtN(stats.uniqueRecipientCount) },
    { label: "Unique Issuers", value: fmtN(stats.uniqueIssuerCount) },
    { label: "Paid Count", value: fmtN(stats.paidCount) },
    { label: "Partial Count", value: fmtN(stats.partialCount) },
    { label: "Overdue Count", value: fmtN(stats.overdueCount) },
    { label: "Draft Count", value: fmtN(stats.draftCount) },
    { label: "Encrypted (Locked)", value: fmtN(stats.encryptedCount) },
    { label: "Unsigned", value: fmtN(stats.unsignedCount) },
    { label: "Oldest Invoice", value: fmtDateShort(stats.oldestInvoiceDate) },
    { label: "Newest Invoice", value: fmtDateShort(stats.newestInvoiceDate) },
  ];

  return (
    <Page size="A4" style={S.page} wrap>
      <PageHeader
        title="Appendix — Full Data Reference"
        subtitle="Complete metric summary for audit and record-keeping"
        badgeLabel="APPENDIX"
        periodLabel={periodLabel}
      />

      {/* Generation meta */}
      <View style={[S.card, { marginBottom: 12 }]}>
        <Text style={S.sectionLabel}>Report Information</Text>
        <View style={{ flexDirection: "row", gap: 20 }}>
          <View style={{ flex: 1 }}>
            <Text style={S.tableCellFaint}>Generated on</Text>
            <Text style={[S.tableCell, { fontFamily: "Helvetica-Bold" }]}>
              {generatedOn}
            </Text>
          </View>
          {generatedBy && (
            <View style={{ flex: 1 }}>
              <Text style={S.tableCellFaint}>Generated by</Text>
              <Text style={[S.tableCell, { fontFamily: "Helvetica-Bold" }]}>
                {generatedBy}
              </Text>
            </View>
          )}
          {business && (
            <View style={{ flex: 2 }}>
              <Text style={S.tableCellFaint}>Business</Text>
              <Text style={[S.tableCell, { fontFamily: "Helvetica-Bold" }]}>
                {business.name}
                {business.tin ? ` — TIN: ${business.tin}` : ""}
              </Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={S.tableCellFaint}>Currency</Text>
            <Text style={[S.tableCell, { fontFamily: "Helvetica-Bold" }]}>
              {currency}
            </Text>
          </View>
        </View>
      </View>

      {/* Full data table */}
      <View style={S.cardNoPad}>
        <View style={S.tableHeader}>
          <Text style={[S.tableHeaderCell, { flex: 2 }]}>Metric</Text>
          <Text style={[S.tableHeaderCell, { flex: 2, textAlign: "right" }]}>
            Value
          </Text>
        </View>
        {summaryRows.map((row, i) => (
          <View
            key={row.label}
            style={[S.tableRow, i % 2 === 1 ? S.tableRowAlt : {}]}
          >
            <Text style={[S.tableCell, { flex: 2 }]}>{row.label}</Text>
            <Text
              style={[
                row.mono ? S.tableCellMono : S.tableCell,
                {
                  flex: 2,
                  textAlign: "right",
                  fontFamily: row.mono ? "Helvetica" : "Helvetica-Bold",
                },
              ]}
            >
              {row.value}
            </Text>
          </View>
        ))}
      </View>

      {/* Disclaimer */}
      <View
        style={{
          marginTop: 12,
          padding: 10,
          backgroundColor: C.brandSoft,
          borderRadius: 5,
          border: `1pt solid ${C.brand}22`,
        }}
      >
        <Text
          style={{
            fontSize: 7,
            color: C.inkFaint,
            lineHeight: 1.6,
          }}
        >
          This report was generated automatically by Majik Buwiz powered by
          @majikah/majik-invoice. Encrypted invoices that were not decrypted
          during the session may show incomplete financial detail — their public
          summary values (grand totals) are included in all aggregate figures,
          but tax, discount, and payment breakdowns require decryption. This
          document is for informational purposes only and does not constitute a
          certified financial statement. Always verify figures against your
          authoritative accounting records.
        </Text>
      </View>

      {footer}
    </Page>
  );
};

// ---------------------------------------------------------------------------
// Main Document component
// ---------------------------------------------------------------------------

export const MajikBuwizSummaryDocument: React.FC<
  MajikBuwizSummaryDocumentProps
> = ({ stats, currency = "PHP", period, business, generatedBy }) => {
  const generatedOn = new Date().toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  // Resolve period label and range
  const periodLabel =
    period?.label ??
    (stats.oldestInvoiceDate && stats.newestInvoiceDate
      ? `${fmtDateShort(stats.oldestInvoiceDate)} – ${fmtDateShort(stats.newestInvoiceDate)}`
      : "All Time");

  const periodRange =
    period?.from && period?.to
      ? `${fmtDate(period.from.toISOString())} — ${fmtDate(period.to.toISOString())}`
      : stats.oldestInvoiceDate && stats.newestInvoiceDate
        ? `${fmtDate(stats.oldestInvoiceDate)} — ${fmtDate(stats.newestInvoiceDate)}`
        : `${fmtN(stats.total)} invoices in scope`;

  const reportLabel = `Financial Summary · ${periodLabel}`;

  const footer = (
    <DocFooter businessName={business?.name} reportLabel={reportLabel} />
  );

  const pageProps = { stats, currency, periodLabel, footer };

  return (
    <Document
      title={`Financial Summary — ${periodLabel}`}
      author={business?.name ?? "Majik Buwiz"}
      creator="Majik Buwiz"
      producer="@majikah/majik-invoice"
      subject="Invoice Financial Summary Report"
    >
      {/* ── Page 1: Cover ── */}
      <CoverPage
        stats={stats}
        currency={currency}
        periodLabel={periodLabel}
        periodRange={periodRange}
        business={business}
        generatedOn={generatedOn}
        generatedBy={generatedBy}
      />

      {/* ── Page 2: Revenue & Collections ── */}
      <RevenuePage {...pageProps} />

      {/* ── Page 3: Tax & Withholding ── */}
      <TaxPage {...pageProps} />

      {/* ── Page 4: Invoice Health ── */}
      <InvoiceHealthPage {...pageProps} />

      {/* ── Page 5: Client Intelligence ── */}
      <ClientPage {...pageProps} />

      {/* ── Page 6: Appendix ── */}
      <AppendixPage
        stats={stats}
        currency={currency}
        periodLabel={periodLabel}
        periodRange={periodRange}
        business={business}
        generatedOn={generatedOn}
        generatedBy={generatedBy}
        footer={footer}
      />
    </Document>
  );
};

// ---------------------------------------------------------------------------
// Filename builder
// ---------------------------------------------------------------------------

function buildFilename(props: MajikBuwizSummaryDocumentProps): string {
  const biz = props.business?.name ?? "Majik Buwiz";
  const period = props.period?.label ?? "Summary";
  return (
    `${biz} - Financial Summary - ${period}`
      .replace(/[/\\?%*:|"<>]/g, "_")
      .trim() + ".pdf"
  );
}

// ---------------------------------------------------------------------------
// Export utilities
// ---------------------------------------------------------------------------

export async function buildMajikBuwizSummaryBlob(
  props: MajikBuwizSummaryDocumentProps,
): Promise<Blob> {
  return pdf(<MajikBuwizSummaryDocument {...props} />).toBlob();
}

/**
 * Download the summary PDF via Tauri's file save dialog.
 * Falls back to a toast error if the user cancels.
 */
export async function downloadMajikBuwizSummaryPDF(
  props: MajikBuwizSummaryDocumentProps,
  filename?: string,
): Promise<void> {
  const blob = await buildMajikBuwizSummaryBlob(props);

  const filePath = await save({
    defaultPath: filename ?? buildFilename(props),
    filters: [{ name: "PDF Document", extensions: ["pdf"] }],
  });

  if (!filePath) {
    toast.error("Download cancelled.");
    return;
  }

  const arrayBuffer = await blob.arrayBuffer();
  await writeFile(filePath, new Uint8Array(arrayBuffer));
  toast.success("Summary report saved.");
}
