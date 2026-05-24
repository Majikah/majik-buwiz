/**
 * @file ChartRevenueTrend.tsx
 *
 * Memoized area/line chart for invoice revenue over time.
 * Derives its own time-series data from the raw invoice array so the parent
 * doesn't need to pre-process anything — just pass the already-filtered
 * invoices (same slice the dashboard uses for stats) and the active date range.
 *
 * Bucketing strategy (auto-selected from range span):
 *   ≤ 31 days  → daily
 *   ≤ 90 days  → weekly  (ISO week buckets)
 *   ≤ 730 days → monthly
 *   > 730 days → quarterly
 *
 * Usage in BuwizDashboardPanel:
 *   <ChartRevenueTrend
 *     invoices={filtered}   // the invoices already filtered to the period
 *     range={range}
 *     currency="PHP"
 *   />
 *
 * Dependencies:
 *   react-plotly.js, styled-components, @majikah/majik-invoice
 */

import React, { memo, useMemo } from "react";
import styled from "styled-components";
import Plot from "react-plotly.js";
import theme from "@/globals/theme";
import { MajikInvoice } from "@majikah/majik-invoice";
import { DateRange } from "@/components/functional/PeriodFilter";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type Bucket = "day" | "week" | "month" | "quarter";

function selectBucket(from: Date, to: Date): Bucket {
  const days = (to.getTime() - from.getTime()) / 86_400_000;
  if (days <= 31) return "day";
  if (days <= 90) return "week";
  if (days <= 730) return "month";
  return "quarter";
}

/** Returns a sortable bucket key string for a given date */
function bucketKey(d: Date, bucket: Bucket): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");

  if (bucket === "day") return `${y}-${m}-${day}`;
  if (bucket === "month") return `${y}-${m}`;
  if (bucket === "quarter") return `${y}-Q${Math.ceil((d.getMonth() + 1) / 3)}`;

  // ISO week — find Monday of the week containing d
  const tmp = new Date(d);
  const dow = tmp.getDay() === 0 ? 7 : tmp.getDay(); // 1=Mon … 7=Sun
  tmp.setDate(tmp.getDate() - dow + 1);
  const wy = tmp.getFullYear();
  const wm = String(tmp.getMonth() + 1).padStart(2, "0");
  const wd = String(tmp.getDate()).padStart(2, "0");
  return `${wy}-${wm}-${wd}`; // week starting date
}

/** Human-readable axis label for a bucket key */
function bucketLabel(key: string, bucket: Bucket): string {
  if (bucket === "quarter") return key; // already "2024-Q3"

  const d = new Date(key + (bucket === "month" ? "-01" : ""));

  if (bucket === "day" || bucket === "week") {
    return d.toLocaleDateString("en-PH", { month: "short", day: "numeric" });
  }
  // month
  return d.toLocaleDateString("en-PH", { month: "short", year: "numeric" });
}

interface BucketData {
  keys: string[];
  labels: string[];
  revenue: number[];
  paid: number[];
  outstanding: number[];
  counts: number[];
}

function buildTimeSeries(invoices: MajikInvoice[], bucket: Bucket): BucketData {
  // Accumulators keyed by bucket string
  const revenue = new Map<string, number>();
  const paid = new Map<string, number>();
  const outstanding = new Map<string, number>();
  const counts = new Map<string, number>();

  for (const inv of invoices) {
    let raw: string | null = null;
    try {
      raw = inv.invoice.issueDate;
    } catch {
      raw = inv.public.issuedAt ?? null;
    }
    if (!raw) continue;

    const d = new Date(raw);
    const key = bucketKey(d, bucket);
    const amount = inv.public.totalAmount ?? 0;
    const status = inv.public.status ?? "draft";

    revenue.set(key, (revenue.get(key) ?? 0) + amount);
    counts.set(key, (counts.get(key) ?? 0) + 1);

    if (status === "paid") {
      paid.set(key, (paid.get(key) ?? 0) + amount);
    } else {
      outstanding.set(key, (outstanding.get(key) ?? 0) + amount);
    }
  }

  const keys = Array.from(revenue.keys()).sort();

  return {
    keys,
    labels: keys.map((k) => bucketLabel(k, bucket)),
    revenue: keys.map((k) => revenue.get(k) ?? 0),
    paid: keys.map((k) => paid.get(k) ?? 0),
    outstanding: keys.map((k) => outstanding.get(k) ?? 0),
    counts: keys.map((k) => counts.get(k) ?? 0),
  };
}



// ---------------------------------------------------------------------------
// Styled
// ---------------------------------------------------------------------------

const Root = styled.div`
  display: flex;
  width: 100%;
  height: 100%;
  min-height: 220px;
  justify-content: center;
  align-items: center;
`;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ChartRevenueTrendProps {
  /** Already-filtered invoices for the current period */
  invoices: MajikInvoice[];
  /** Active date range — used to auto-select bucket granularity */
  range: DateRange;
  /** ISO currency code, default "PHP" */
  currency?: string;
  /** Chart height in px, default 220 */
  height?: number;
  /**
   * Which series to show.
   * "stacked" renders paid + outstanding as stacked area.
   * "total"   renders a single gross revenue line.
   * Default: "stacked"
   */
  mode?: "stacked" | "total";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const ChartRevenueTrend: React.FC<ChartRevenueTrendProps> = memo(
  ({ invoices, range, currency = "PHP", height = 220, mode = "stacked" }) => {
    const bucket = useMemo(
      () => selectBucket(range.from, range.to),
      [range.from, range.to],
    );

    const series = useMemo(
      () => buildTimeSeries(invoices, bucket),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [invoices, bucket],
    );

    const plotData = useMemo((): Plotly.Data[] => {
      if (series.keys.length === 0) return [];

      const hoverTpl = (label: string) =>
        `<b>${label}</b><br>%{x}<br>₱%{y:,.2f}<extra></extra>`;

      if (mode === "total") {
        return [
          {
            type: "scatter",
            mode: "lines+markers",
            name: "Gross Revenue",
            x: series.labels,
            y: series.revenue,
            line: {
              shape: "spline",
              smoothing: 0.8,
              width: 2.5,
              color: theme.colors.primary,
            },
            marker: { size: 5, color: theme.colors.primary },
            fill: "tozeroy",
            fillcolor: `${theme.colors.primary}18`,
            hovertemplate: hoverTpl("Gross Revenue"),
          } as Plotly.Data,
        ];
      }

      // Stacked: paid (bottom) + outstanding (top)
      return [
        {
          type: "bar",
          name: "Paid",
          x: series.labels,
          y: series.paid,
          marker: { color: "#27cf84" },
          hovertemplate: hoverTpl("Paid"),
        } as Plotly.Data,
        {
          type: "bar",
          name: "Outstanding",
          x: series.labels,
          y: series.outstanding,
          marker: { color: "#d4860a" },
          hovertemplate: hoverTpl("Outstanding"),
        } as Plotly.Data,
      ];
    }, [series, mode]);

    const layout = useMemo(
      (): Partial<Plotly.Layout> => ({
        autosize: true,
        dragmode: false,
        margin: { l: 10, r: 10, t: 10, b: 60 },
        plot_bgcolor: "transparent",
        paper_bgcolor: "transparent",
        height,
        barmode: "stack",
        showlegend: true,
        legend: {
          orientation: "h",
          x: 0.5,
          xanchor: "center",
          y: -0.22,
          font: { color: theme.colors.textSecondary, size: 10 },
        },
        xaxis: {
          showgrid: false,
          zeroline: false,
          color: theme.colors.textSecondary,
          tickfont: { size: 10, color: theme.colors.textSecondary },
          tickangle: series.labels.length > 6 ? -40 : 0,
          automargin: true,
        },
        yaxis: {
          showgrid: true,
          gridcolor: `${theme.colors.secondaryBackground}`,
          zeroline: false,
          color: theme.colors.textSecondary,
          tickfont: { size: 10, color: theme.colors.textSecondary },
          tickprefix: `${currency} `,
          separatethousands: true,
          automargin: true,
        },
      }),
      [height, series.labels.length],
    );

    if (plotData.length === 0) return null;

    return (
      <Root>
        <Plot
          data={plotData}
          layout={layout}
          useResizeHandler
          style={{ width: "100%", height: "100%" }}
          config={{ responsive: true, displayModeBar: false }}
        />
      </Root>
    );
  },
);

ChartRevenueTrend.displayName = "ChartRevenueTrend";

export default ChartRevenueTrend;
