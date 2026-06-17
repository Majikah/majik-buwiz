/**
 * RecurringExpenseToolbar.tsx
 *
 * Top toolbar for the recurring expense manager modal.
 * Fits comfortably inside the 740px DynamicSlidingDialogue.
 *
 * Changes from v1:
 *   - Adds KanbanGroupBy selector (visible only when viewMode === "kanban")
 *   - Removed custom theme colors — uses app theme tokens via styled-components
 *   - Tightened layout for modal context
 */

import {
  ArrowClockwiseIcon,
  LightningIcon,
  TableIcon,
} from "@phosphor-icons/react";
import { KanbanIcon } from "lucide-react";
import React from "react";
import styled from "styled-components";

export type ViewMode = "kanban" | "table";

export type KanbanGroupBy = "frequency" | "status" | "category" | "payee";

const GROUP_BY_OPTIONS: { value: KanbanGroupBy; label: string }[] = [
  { value: "frequency", label: "Frequency" },
  { value: "status", label: "Status" },
  { value: "category", label: "Category" },
  { value: "payee", label: "Payee" },
];

interface RecurringExpenseToolbarProps {
  viewMode: ViewMode;
  onViewChange: (v: ViewMode) => void;
  kanbanGroupBy: KanbanGroupBy;
  onKanbanGroupByChange: (g: KanbanGroupBy) => void;
  onAddNew: () => void;
  onActualizeAll: () => void;
  search: string;
  onSearch: (v: string) => void;
  totalActive: number;
  totalPaused: number;
  totalEnded: number;
  isActualizing?: boolean;
}

// ── Styled ────────────────────────────────────────────────────────────────────

const ToolbarRoot = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const Row = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
`;

const ViewToggle = styled.div`
  display: flex;
  border: 1px solid ${({ theme }) => theme.colors.primary}22;
  border-radius: ${({ theme }) => theme.borders?.radius?.medium ?? "6px"};
  overflow: hidden;
  flex-shrink: 0;
`;

const ViewBtn = styled.button<{ $active?: boolean }>`
  display: flex;
  align-items: center;
  gap: 5px;
  font-family: ${({ theme }) =>
    theme.typography?.fonts?.medium ?? "sans-serif"};
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  padding: 6px 12px;
  border: none;
  cursor: pointer;
  transition: all 0.15s;
  background: ${({ $active, theme }) =>
    $active ? theme.colors.primarySoft : "transparent"};
  color: ${({ $active, theme }) =>
    $active ? theme.colors.primary : theme.colors.textSecondary};
  border-right: 1px solid ${({ theme }) => theme.colors.primary}15;

  &:last-child {
    border-right: none;
  }
  &:hover {
    background: ${({ theme }) => theme.colors.primarySoft};
    color: ${({ theme }) => theme.colors.primary};
  }
`;

const GroupByWrapper = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
`;

const GroupByLabel = styled.span`
  font-family: ${({ theme }) =>
    theme.typography?.fonts?.medium ?? "sans-serif"};
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.7;
  white-space: nowrap;
`;

const GroupBySelect = styled.select`
  font-family: ${({ theme }) =>
    theme.typography?.fonts?.medium ?? "sans-serif"};
  font-size: 11px;
  padding: 5px 24px 5px 8px;
  border: 1px solid ${({ theme }) => theme.colors.primary}22;
  border-radius: ${({ theme }) => theme.borders?.radius?.medium ?? "6px"};
  background: ${({ theme }) => theme.colors.secondaryBackground};
  color: ${({ theme }) => theme.colors.textPrimary};
  cursor: pointer;
  outline: none;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%237a8299' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 7px center;
  transition: border-color 0.15s;

  &:focus {
    border-color: ${({ theme }) => theme.colors.primary};
  }
  option {
    background: ${({ theme }) => theme.colors.secondaryBackground};
  }
`;

const SearchWrapper = styled.div`
  position: relative;
  flex: 1;
  min-width: 120px;
`;

const SearchIcon = styled.span`
  position: absolute;
  left: 9px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.5;
  pointer-events: none;
`;

const SearchInput = styled.input`
  width: 100%;
  box-sizing: border-box;
  padding: 6px 10px 6px 28px;
  font-family: ${({ theme }) => theme.typography?.fonts?.light ?? "sans-serif"};
  font-size: 12px;
  border: 1px solid ${({ theme }) => theme.colors.primary}20;
  border-radius: ${({ theme }) => theme.borders?.radius?.medium ?? "6px"};
  background: ${({ theme }) => theme.colors.secondaryBackground};
  color: ${({ theme }) => theme.colors.textPrimary};
  outline: none;
  transition: border-color 0.15s;

  &::placeholder {
    color: ${({ theme }) => theme.colors.textSecondary};
    opacity: 0.5;
  }
  &:focus {
    border-color: ${({ theme }) => theme.colors.primary};
  }
`;

const StatChips = styled.div`
  display: flex;
  gap: 5px;
  flex-wrap: wrap;
`;

const StatChip = styled.span<{ $color?: string }>`
  font-family: ${({ theme }) =>
    theme.typography?.fonts?.medium ?? "sans-serif"};
  font-size: 10px;
  padding: 3px 9px;
  border-radius: ${({ theme }) => theme.borders?.radius?.rounded ?? "99px"};
  background: ${({ theme }) => theme.colors.primarySoft};
  border: 1px solid ${({ theme }) => theme.colors.primary}18;
  color: ${({ $color, theme }) => $color ?? theme.colors.textSecondary};
  white-space: nowrap;

  strong {
    font-weight: 700;
    color: ${({ $color, theme }) => $color ?? theme.colors.textPrimary};
  }
`;

const ActualizeAllBtn = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-family: ${({ theme }) =>
    theme.typography?.fonts?.medium ?? "sans-serif"};
  font-size: 11px;
  padding: 6px 12px;
  border-radius: ${({ theme }) => theme.borders?.radius?.medium ?? "6px"};
  border: 1px solid ${({ theme }) => theme.colors.primary}33;
  background: transparent;
  color: ${({ theme }) => theme.colors.textSecondary};
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
  flex-shrink: 0;

  &:hover:not(:disabled) {
    background: ${({ theme }) => theme.colors.primarySoft};
    color: ${({ theme }) => theme.colors.primary};
    border-color: ${({ theme }) => theme.colors.primary};
  }

  &:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }
`;

const NewBtn = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-family: ${({ theme }) =>
    theme.typography?.fonts?.medium ?? "sans-serif"};
  font-size: 11px;
  padding: 6px 13px;
  border-radius: ${({ theme }) => theme.borders?.radius?.medium ?? "6px"};
  background: ${({ theme }) =>
    theme.gradients?.primary ?? theme.colors.primary};
  border: 1px solid transparent;
  color: ${({ theme }) => theme.colors.static?.white ?? "#fff"};
  cursor: pointer;
  transition: filter 0.15s;
  white-space: nowrap;
  flex-shrink: 0;

  &:hover {
    filter: brightness(1.08);
  }
`;

// ── Component ─────────────────────────────────────────────────────────────────

export const RecurringExpenseToolbar: React.FC<
  RecurringExpenseToolbarProps
> = ({
  viewMode,
  onViewChange,
  kanbanGroupBy,
  onKanbanGroupByChange,
  onAddNew,
  onActualizeAll,
  search,
  onSearch,
  totalActive,
  totalPaused,
  totalEnded,
  isActualizing,
}) => {
  return (
    <ToolbarRoot>
      {/* Row 1: view toggle + group-by + search */}
      <Row>
        <ViewToggle>
          <ViewBtn
            $active={viewMode === "kanban"}
            onClick={() => onViewChange("kanban")}
          >
            <KanbanIcon size={12} />
            Kanban
          </ViewBtn>
          <ViewBtn
            $active={viewMode === "table"}
            onClick={() => onViewChange("table")}
          >
            <TableIcon size={12} />
            Table
          </ViewBtn>
        </ViewToggle>

        {viewMode === "kanban" && (
          <GroupByWrapper>
            <GroupByLabel>Group by</GroupByLabel>
            <GroupBySelect
              value={kanbanGroupBy}
              onChange={(e) =>
                onKanbanGroupByChange(e.target.value as KanbanGroupBy)
              }
            >
              {GROUP_BY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </GroupBySelect>
          </GroupByWrapper>
        )}

        <SearchWrapper>
          <SearchIcon>⌕</SearchIcon>
          <SearchInput
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search by name, payee, tag…"
          />
        </SearchWrapper>
      </Row>

      {/* Row 2: stat chips + actions */}
      <Row>
        <StatChips>
          {totalActive > 0 && (
            <StatChip $color="var(--color-success, #3ecf82)">
              <strong>{totalActive}</strong> active
            </StatChip>
          )}
          {totalPaused > 0 && (
            <StatChip $color="var(--color-info, #6e86c8)">
              <strong>{totalPaused}</strong> paused
            </StatChip>
          )}
          {totalEnded > 0 && (
            <StatChip>
              <strong>{totalEnded}</strong> ended
            </StatChip>
          )}
        </StatChips>

        <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          <ActualizeAllBtn
            onClick={onActualizeAll}
            disabled={isActualizing || totalActive === 0}
            title={
              totalActive === 0
                ? "No active templates to actualize"
                : "Actualize all active templates for the current month"
            }
          >
            {isActualizing ? (
              <>
                <ArrowClockwiseIcon size={12} />
                Actualizing…
              </>
            ) : (
              <>
                <LightningIcon size={12} weight="fill" />
                Actualize All
              </>
            )}
          </ActualizeAllBtn>

          <NewBtn onClick={onAddNew}>+ New</NewBtn>
        </div>
      </Row>
    </ToolbarRoot>
  );
};
