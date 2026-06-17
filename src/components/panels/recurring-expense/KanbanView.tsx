/**
 * KanbanView.tsx
 *
 * Kanban board for recurring expenses.
 * Supports multiple groupBy modes:
 *   "frequency" (default) | "status" | "category" | "payee"
 *
 * Changes from v1:
 *   - groupBy prop drives column generation
 *   - Uses app theme tokens instead of custom theme
 *   - Column accent color adapts per groupBy mode
 *   - Max height fits inside a 740px sliding dialogue (not full-page)
 */

import React, { useMemo } from "react";
import styled from "styled-components";
import type { KanbanGroupBy } from "./RecurringExpenseToolbar";
import { ExpenseCard } from "./ExpenseCard";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RecurringItemSummary {
  id: string;
  name: string;
  amount: number;
  currency?: string;
  frequency: string;
  status: "active" | "paused" | "ended";
  payee?: { legalName?: string };
  paidBy?: { legalName?: string };
  schedule?: { startDate?: string; endDate?: string };
  tags?: string[];
  description?: string;
  category?: string;
}

interface KanbanViewProps {
  items: RecurringItemSummary[];
  groupBy?: KanbanGroupBy;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onEnd: (id: string) => void;
  onActualize: (id: string) => void;
}

// ── Group definitions ─────────────────────────────────────────────────────────

const FREQUENCY_ORDER = [
  "daily", "weekly", "biweekly", "monthly", "quarterly", "yearly",
];

const STATUS_ORDER = ["active", "paused", "ended"];

const CATEGORY_ORDER = [
  "cost-of-sales", "compensation", "rent", "professional-fees", "utilities",
  "depreciation", "interest", "taxes-and-licenses", "representation",
  "transportation", "communication", "insurance", "supplies", "bad-debts",
  "charitable-contributions", "other",
];

const CATEGORY_LABELS: Record<string, string> = {
  "cost-of-sales": "Cost of Sales",
  compensation: "Compensation",
  rent: "Rent",
  "professional-fees": "Prof. Fees",
  utilities: "Utilities",
  depreciation: "Depreciation",
  interest: "Interest",
  "taxes-and-licenses": "Taxes & Lic.",
  representation: "Representation",
  transportation: "Transportation",
  communication: "Communication",
  insurance: "Insurance",
  supplies: "Supplies",
  "bad-debts": "Bad Debts",
  "charitable-contributions": "Charitable",
  other: "Other",
};

// Accent colors per group key (CSS color strings — no custom theme required)
const FREQUENCY_COLORS: Record<string, string> = {
  daily:     "#e05252",
  weekly:    "#f0a834",
  biweekly:  "#e8a020",
  monthly:   "#3ecf82",
  quarterly: "#6e86c8",
  yearly:    "#9b79d4",
};

const STATUS_COLORS: Record<string, string> = {
  active: "#3ecf82",
  paused: "#6e86c8",
  ended:  "#4a5268",
};

const accentFor = (groupBy: KanbanGroupBy, key: string): string => {
  if (groupBy === "frequency") return FREQUENCY_COLORS[key] ?? "#7a8299";
  if (groupBy === "status")    return STATUS_COLORS[key]    ?? "#7a8299";
  // category and payee get a consistent brand color
  return "var(--color-primary, #7a8299)";
};

// ── Build columns ─────────────────────────────────────────────────────────────

interface KanbanColumn {
  key: string;
  label: string;
  accent: string;
  items: RecurringItemSummary[];
}

function buildColumns(
  items: RecurringItemSummary[],
  groupBy: KanbanGroupBy,
): KanbanColumn[] {
  const map = new Map<string, RecurringItemSummary[]>();

  for (const item of items) {
    let key: string;
    switch (groupBy) {
      case "frequency": key = item.frequency ?? "other"; break;
      case "status":    key = item.status;               break;
      case "category":  key = item.category ?? "other";  break;
      case "payee":     key = item.payee?.legalName ?? "Unknown"; break;
    }
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(item);
  }

  // Determine ordered keys
  let orderedKeys: string[];
  if (groupBy === "frequency") {
    orderedKeys = [
      ...FREQUENCY_ORDER.filter((k) => map.has(k)),
      ...[...map.keys()].filter((k) => !FREQUENCY_ORDER.includes(k)),
    ];
  } else if (groupBy === "status") {
    orderedKeys = [
      ...STATUS_ORDER.filter((k) => map.has(k)),
      ...[...map.keys()].filter((k) => !STATUS_ORDER.includes(k)),
    ];
  } else if (groupBy === "category") {
    orderedKeys = [
      ...CATEGORY_ORDER.filter((k) => map.has(k)),
      ...[...map.keys()].filter((k) => !CATEGORY_ORDER.includes(k)),
    ];
  } else {
    // payee — alphabetical
    orderedKeys = [...map.keys()].sort((a, b) => a.localeCompare(b));
  }

  return orderedKeys
    .filter((k) => (map.get(k)?.length ?? 0) > 0)
    .map((key) => ({
      key,
      label:
        groupBy === "category"
          ? (CATEGORY_LABELS[key] ?? key)
          : key.charAt(0).toUpperCase() + key.slice(1),
      accent: accentFor(groupBy, key),
      items: map.get(key)!,
    }));
}

// ── Styled ────────────────────────────────────────────────────────────────────

const BoardRoot = styled.div`
  display: flex;
  gap: 12px;
  overflow-x: auto;
  padding-bottom: 12px;
  /* Constrained to fit inside DynamicSlidingDialogue without page scroll */
  max-height: 480px;

  &::-webkit-scrollbar { height: 4px; }
  &::-webkit-scrollbar-track { background: transparent; }
  &::-webkit-scrollbar-thumb {
    background: ${({ theme }) => theme.colors.primary}22;
    border-radius: 2px;
  }
`;

const Column = styled.div`
  flex: 0 0 220px;
  display: flex;
  flex-direction: column;
  background: ${({ theme }) => theme.colors.secondaryBackground};
  border: 1px solid ${({ theme }) => theme.colors.primary}12;
  border-radius: ${({ theme }) => theme.borders?.radius?.medium ?? "6px"};
  overflow: hidden;
`;

const ColumnHeader = styled.div<{ $accent: string }>`
  padding: 9px 12px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.primary}10;
  background: ${({ theme }) => theme.colors.primarySoft};
  border-top: 2px solid ${({ $accent }) => $accent};
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
`;

const ColumnTitle = styled.span`
  font-family: ${({ theme }) => theme.typography?.fonts?.semibold ?? "sans-serif"};
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: ${({ theme }) => theme.colors.textSecondary};
`;

const ColumnCount = styled.span`
  font-family: ${({ theme }) => theme.typography?.fonts?.numbers ?? "monospace"};
  font-size: 10px;
  color: ${({ theme }) => theme.colors.textSecondary};
  background: ${({ theme }) => theme.colors.primarySoft};
  border: 1px solid ${({ theme }) => theme.colors.primary}15;
  padding: 1px 6px;
  border-radius: 10px;
`;

const CardList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
  overflow-y: auto;
  flex: 1;

  &::-webkit-scrollbar { width: 3px; }
  &::-webkit-scrollbar-track { background: transparent; }
  &::-webkit-scrollbar-thumb {
    background: ${({ theme }) => theme.colors.primary}18;
    border-radius: 2px;
  }
`;

const ColumnFooter = styled.div`
  padding: 7px 12px;
  border-top: 1px solid ${({ theme }) => theme.colors.primary}10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
`;

const FooterLabel = styled.span`
  font-family: ${({ theme }) => theme.typography?.fonts?.medium ?? "sans-serif"};
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.6;
`;

const FooterAmount = styled.span`
  font-family: ${({ theme }) => theme.typography?.fonts?.numbers ?? "monospace"};
  font-size: 11px;
  color: ${({ theme }) => theme.colors.primary};
  font-weight: 600;
`;

const EmptyBoard = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  gap: 10px;
  color: ${({ theme }) => theme.colors.textSecondary};
  font-family: ${({ theme }) => theme.typography?.fonts?.light ?? "sans-serif"};
  font-size: 13px;
  opacity: 0.55;
  text-align: center;
`;

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtCurrency = (amount: number, currency = "PHP") =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);

// ── Component ─────────────────────────────────────────────────────────────────

export const KanbanView: React.FC<KanbanViewProps> = ({
  items,
  groupBy = "frequency",
  onEdit,
  onDelete,
  onPause,
  onResume,
  onEnd,
  onActualize,
}) => {
  const columns = useMemo(
    () => buildColumns(items, groupBy),
    [items, groupBy],
  );

  if (columns.length === 0) {
    return (
      <EmptyBoard>
        <span style={{ fontSize: 28, opacity: 0.3 }}>◈</span>
        <div>No recurring expenses yet</div>
        <div style={{ fontSize: 11, opacity: 0.7 }}>
          Click "+ New" to create your first template
        </div>
      </EmptyBoard>
    );
  }

  return (
    <BoardRoot>
      {columns.map((col) => {
        const activeItems = col.items.filter((i) => i.status === "active");
        const totalActive = activeItems.reduce((s, i) => s + i.amount, 0);
        const currency = col.items[0]?.currency;

        return (
          <Column key={col.key}>
            <ColumnHeader $accent={col.accent}>
              <ColumnTitle>{col.label}</ColumnTitle>
              <ColumnCount>{col.items.length}</ColumnCount>
            </ColumnHeader>

            <CardList>
              {col.items.map((item) => (
                <ExpenseCard
                  key={item.id}
                  item={item}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onPause={onPause}
                  onResume={onResume}
                  onEnd={onEnd}
                  onActualize={onActualize}
                />
              ))}
            </CardList>

            {activeItems.length > 0 && (
              <ColumnFooter>
                <FooterLabel>Active total</FooterLabel>
                <FooterAmount>
                  {fmtCurrency(totalActive, currency)}
                </FooterAmount>
              </ColumnFooter>
            )}
          </Column>
        );
      })}
    </BoardRoot>
  );
};