/**
 * @file ChartStatusDistribution.tsx
 *
 * Memoized donut chart for invoice status distribution.
 * Consumes byStatus + byStatusAmount from DashboardStats directly —
 * no re-derivation needed.
 *
 * Usage in BuwizDashboardPanel:
 *   <ChartStatusDistribution
 *     byStatus={stats.byStatus}
 *     byStatusAmount={stats.byStatusAmount}
 *     currency="PHP"
 *   />
 */

import React, { memo, useMemo } from "react";
import styled from "styled-components";
import Plot from "react-plotly.js";
import theme from "@/globals/theme";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Styled
// ---------------------------------------------------------------------------

const Root = styled.div`
  display: flex;
  width: 100%;
  height: 100%;
  min-height: 140px;
  justify-content: center;
  align-items: center;
`;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ChartStatusDistributionProps {
  /** byStatus from DashboardStats: { paid: 4, overdue: 2, … } */
  byStatus: Record<string, number>;
  /** byStatusAmount from DashboardStats: { paid: 120000, … } */
  byStatusAmount: Record<string, number>;
  /** ISO currency code, default "PHP" */
  currency?: string;
  /** Chart height in px, default 220 */
  height?: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const ChartStatusDistribution: React.FC<ChartStatusDistributionProps> = memo(
  ({ byStatus, byStatusAmount, currency = "PHP", height = 220 }) => {
    const plotData = useMemo(() => {
      const entries = Object.entries(byStatus).filter(([, n]) => n > 0);
      if (entries.length === 0) return [];

      const labels = entries.map(([s]) => {
        // Capitalise first letter
        return s.charAt(0).toUpperCase() + s.slice(1);
      });
      const values = entries.map(([s]) => byStatusAmount[s] ?? 0);
      const colors = entries.map(([s]) => statusColor(s));

      return [
        {
          type: "pie" as const,
          hole: 0.52, // donut
          labels,
          values,
          marker: { colors, line: { color: "transparent", width: 0 } },
          textinfo: "percent" as const,
          textfont: {
            color: theme.colors.textPrimary,
            size: 11,
          },
          hovertemplate:
            "%{label}<br>" +
            new Intl.NumberFormat("en-PH", {
              style: "currency",
              currency,
              minimumFractionDigits: 2,
            })
              .format(0)
              .replace("0.00", "%{value:,.2f}") +
            " (%{percent})<extra></extra>",
          sort: false,
        },
      ];
    }, [byStatus, byStatusAmount, currency]);

    const layout = useMemo(
      (): Partial<Plotly.Layout> => ({
        autosize: true,
        margin: { l: 10, r: 10, t: 10, b: 10 },
        plot_bgcolor: "transparent",
        paper_bgcolor: "transparent",
        height,
        showlegend: true,
        legend: {
          orientation: "h",
          x: 0.5,
          xanchor: "center",
          y: -0.08,
          font: { color: theme.colors.textSecondary, size: 10 },
        },
      }),
      [height],
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

ChartStatusDistribution.displayName = "ChartStatusDistribution";

export default ChartStatusDistribution;
