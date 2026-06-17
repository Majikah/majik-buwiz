/**
 * TableView.tsx
 *
 * Sortable table view of recurring expenses.
 *
 * Changes from v1:
 *   - Uses app theme tokens instead of custom theme
 *   - Constrained max-height to fit inside DynamicSlidingDialogue
 *   - Sticky header works within the dialogue scroll container
 */

import React, { useState } from "react";
import styled, { css } from "styled-components";
import type { RecurringItemSummary } from "./KanbanView";
import {
  LightningIcon,
  PauseIcon,
  PencilIcon,
  PlayIcon,
  StopIcon,
  TrashIcon,
} from "@phosphor-icons/react";

interface TableViewProps {
  items: RecurringItemSummary[];
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onEnd: (id: string) => void;
  onActualize: (id: string) => void;
}

type SortKey = "name" | "amount" | "frequency" | "status" | "startDate";
type SortDir = "asc" | "desc";

const FREQ_ORDER: Record<string, number> = {
  daily: 0,
  weekly: 1,
  biweekly: 2,
  monthly: 3,
  quarterly: 4,
  yearly: 5,
};

// ── Styled ────────────────────────────────────────────────────────────────────

const Wrapper = styled.div`
  overflow-x: auto;
  overflow-y: auto;
  max-height: 480px;
  border: 1px solid ${({ theme }) => theme.colors.primary}12;
  border-radius: ${({ theme }) => theme.borders?.radius?.medium ?? "6px"};

  &::-webkit-scrollbar {
    width: 4px;
    height: 4px;
  }
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  &::-webkit-scrollbar-thumb {
    background: ${({ theme }) => theme.colors.primary}22;
    border-radius: 2px;
  }
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textPrimary};
`;

const THead = styled.thead`
  background: ${({ theme }) => theme.colors.secondaryBackground};
  position: sticky;
  top: 0;
  z-index: 2;
`;

const Th = styled.th<{
  $sortable?: boolean;
  $active?: boolean;
  $align?: string;
}>`
  padding: 9px 12px;
  font-family: ${({ theme }) =>
    theme.typography?.fonts?.semibold ?? "sans-serif"};
  font-size: 9px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: ${({ $active, theme }) =>
    $active ? theme.colors.primary : theme.colors.textSecondary};
  text-align: ${({ $align }) => $align ?? "left"};
  border-bottom: 1px solid ${({ theme }) => theme.colors.primary}15;
  white-space: nowrap;
  user-select: none;
  cursor: ${({ $sortable }) => ($sortable ? "pointer" : "default")};
  transition: color 0.12s;
  opacity: ${({ $active }) => ($active ? 1 : 0.7)};

  ${({ $sortable, theme }) =>
    $sortable &&
    css`
      &:hover {
        opacity: 1;
        background: ${theme.colors.primarySoft};
      }
    `}
`;

const ThInner = styled.div<{ $align?: string }>`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  justify-content: ${({ $align }) =>
    $align === "right"
      ? "flex-end"
      : $align === "center"
        ? "center"
        : "flex-start"};
`;

const SortArrow = styled.span<{ $dir?: SortDir }>`
  font-size: 8px;
  opacity: 0.8;
  transform: ${({ $dir }) =>
    $dir === "asc" ? "rotate(180deg)" : "rotate(0deg)"};
  display: inline-block;
  transition: transform 0.15s;
`;

const TBody = styled.tbody``;

const Tr = styled.tr<{ $faded?: boolean }>`
  border-bottom: 1px solid ${({ theme }) => theme.colors.primary}08;
  opacity: ${({ $faded }) => ($faded ? 0.45 : 1)};
  transition: background 0.1s;

  &:last-child {
    border-bottom: none;
  }
  &:hover {
    background: ${({ theme }) => theme.colors.primarySoft};
  }
`;

const Td = styled.td<{ $align?: string }>`
  padding: 9px 12px;
  text-align: ${({ $align }) => $align ?? "left"};
  vertical-align: middle;
`;

const NameCell = styled.div`
  font-family: ${({ theme }) =>
    theme.typography?.fonts?.semibold ?? "sans-serif"};
  font-size: 12px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textPrimary};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 160px;
`;

const MonoText = styled.span`
  font-family: ${({ theme }) =>
    theme.typography?.fonts?.numbers ?? "monospace"};
  font-size: 12px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.primary};
`;

const FreqChip = styled.span`
  font-family: ${({ theme }) =>
    theme.typography?.fonts?.medium ?? "sans-serif"};
  font-size: 9px;
  padding: 2px 7px;
  border-radius: ${({ theme }) => theme.borders?.radius?.rounded ?? "99px"};
  background: ${({ theme }) => theme.colors.primarySoft};
  color: ${({ theme }) => theme.colors.primary};
  border: 1px solid ${({ theme }) => theme.colors.primary}22;
  white-space: nowrap;
  text-transform: uppercase;
  letter-spacing: 0.06em;
`;

const StatusBadge = styled.span<{ $status: "active" | "paused" | "ended" }>`
  font-family: ${({ theme }) =>
    theme.typography?.fonts?.medium ?? "sans-serif"};
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.07em;
  padding: 2px 7px;
  border-radius: ${({ theme }) => theme.borders?.radius?.rounded ?? "99px"};
  text-transform: uppercase;
  white-space: nowrap;

  ${({ $status }) => {
    switch ($status) {
      case "active":
        return css`
          color: var(--color-success, #3ecf82);
          background: var(--color-success-soft, #3ecf8218);
          border: 1px solid #3ecf8244;
        `;
      case "paused":
        return css`
          color: #6e86c8;
          background: #6e86c818;
          border: 1px solid #6e86c844;
        `;
      default:
        return css`
          color: #7a8299;
          background: #7a829918;
          border: 1px solid #7a829933;
        `;
    }
  }}
`;

const DimText = styled.span`
  font-family: ${({ theme }) => theme.typography?.fonts?.light ?? "sans-serif"};
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.7;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 110px;
  display: block;
`;

const ActionsCell = styled.div`
  display: flex;
  align-items: center;
  gap: 1px;
  justify-content: flex-end;
`;

const ActionBtn = styled.button<{ $danger?: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: ${({ theme }) => theme.borders?.radius?.small ?? "4px"};
  background: transparent;
  cursor: pointer;
  font-size: 11px;
  transition: all 0.12s;
  color: ${({ $danger, theme }) =>
    $danger ? theme.colors.error : theme.colors.textSecondary};
  opacity: 0.5;

  &:hover {
    opacity: 1;
    background: ${({ $danger, theme }) =>
      $danger ? theme.colors.error + "15" : theme.colors.primarySoft};
    color: ${({ $danger, theme }) =>
      $danger ? theme.colors.error : theme.colors.primary};
  }
`;

const ActualizeBtn = styled.button`
  font-family: ${({ theme }) =>
    theme.typography?.fonts?.medium ?? "sans-serif"};
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.05em;
  padding: 3px 7px;
  border-radius: ${({ theme }) => theme.borders?.radius?.small ?? "4px"};
  border: 1px solid ${({ theme }) => theme.colors.primary}33;
  background: ${({ theme }) => theme.colors.primarySoft};
  color: ${({ theme }) => theme.colors.primary};
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
  text-transform: uppercase;

  &:hover {
    background: ${({ theme }) =>
      theme.gradients?.primary ?? theme.colors.primary};
    color: ${({ theme }) => theme.colors.static?.white ?? "#fff"};
    border-color: transparent;
  }

  &:disabled {
    opacity: 0.3;
    cursor: not-allowed;
    pointer-events: none;
  }
`;

const EmptyState = styled.div`
  padding: 3rem 2rem;
  text-align: center;
  font-family: ${({ theme }) => theme.typography?.fonts?.light ?? "sans-serif"};
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.55;
`;

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtCurrency = (amount: number, currency = "PHP") =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency }).format(
    amount,
  );

// ── Component ─────────────────────────────────────────────────────────────────

export const TableView: React.FC<TableViewProps> = ({
  items,
  onEdit,
  onDelete,
  onPause,
  onResume,
  onEnd,
  onActualize,
}) => {
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const sorted = [...items].sort((a, b) => {
    let cmp = 0;
    switch (sortKey) {
      case "name":
        cmp = a.name.localeCompare(b.name);
        break;
      case "amount":
        cmp = a.amount - b.amount;
        break;
      case "frequency":
        cmp = (FREQ_ORDER[a.frequency] ?? 99) - (FREQ_ORDER[b.frequency] ?? 99);
        break;
      case "status":
        cmp = a.status.localeCompare(b.status);
        break;
      case "startDate":
        cmp = (a.schedule?.startDate ?? "").localeCompare(
          b.schedule?.startDate ?? "",
        );
        break;
    }
    return sortDir === "asc" ? cmp : -cmp;
  });

  const SortTh = ({
    col,
    label,
    align,
  }: {
    col: SortKey;
    label: string;
    align?: string;
  }) => (
    <Th
      $sortable
      $active={sortKey === col}
      $align={align}
      onClick={() => handleSort(col)}
    >
      <ThInner $align={align}>
        {label}
        {sortKey === col && <SortArrow $dir={sortDir}>▼</SortArrow>}
      </ThInner>
    </Th>
  );

  if (items.length === 0) {
    return <EmptyState>No recurring expenses found.</EmptyState>;
  }

  return (
    <Wrapper>
      <Table>
        <THead>
          <tr>
            <SortTh col="name" label="Name" />
            <SortTh col="amount" label="Amount" align="right" />
            <SortTh col="frequency" label="Frequency" align="center" />
            <SortTh col="status" label="Status" align="center" />
            <Th>Payee</Th>
            <SortTh col="startDate" label="Start Date" />
            <Th $align="right">Actions</Th>
          </tr>
        </THead>
        <TBody>
          {sorted.map((item) => (
            <Tr key={item.id} $faded={item.status === "ended"}>
              <Td>
                <NameCell title={item.name}>{item.name}</NameCell>
              </Td>
              <Td $align="right">
                <MonoText>{fmtCurrency(item.amount, item.currency)}</MonoText>
              </Td>
              <Td $align="center">
                <FreqChip>{item.frequency}</FreqChip>
              </Td>
              <Td $align="center">
                <StatusBadge $status={item.status}>{item.status}</StatusBadge>
              </Td>
              <Td>
                <DimText title={item.payee?.legalName}>
                  {item.payee?.legalName ?? "—"}
                </DimText>
              </Td>
              <Td>
                <DimText>{item.schedule?.startDate ?? "—"}</DimText>
              </Td>
              <Td $align="right">
                <ActionsCell>
                  <ActualizeBtn
                    onClick={() => onActualize(item.id)}
                    disabled={item.status !== "active"}
                    title={
                      item.status !== "active"
                        ? "Only active items can be actualized"
                        : "Actualize"
                    }
                  >
                    <LightningIcon size={12} weight="fill" />
                  </ActualizeBtn>
                  <ActionBtn title="Edit" onClick={() => onEdit(item.id)}>
                    <PencilIcon size={12} weight="fill" />
                  </ActionBtn>
                  {item.status === "active" && (
                    <ActionBtn title="Pause" onClick={() => onPause(item.id)}>
                      <PauseIcon size={12} weight="fill" />
                    </ActionBtn>
                  )}
                  {item.status === "paused" && (
                    <ActionBtn title="Resume" onClick={() => onResume(item.id)}>
                      <PlayIcon size={12} weight="fill" />
                    </ActionBtn>
                  )}
                  {item.status !== "ended" && (
                    <ActionBtn title="End" onClick={() => onEnd(item.id)}>
                      <StopIcon size={12} weight="fill" />
                    </ActionBtn>
                  )}
                  <ActionBtn
                    $danger
                    title="Delete"
                    onClick={() => onDelete(item.id)}
                  >
                    <TrashIcon size={12} weight="fill" />
                  </ActionBtn>
                </ActionsCell>
              </Td>
            </Tr>
          ))}
        </TBody>
      </Table>
    </Wrapper>
  );
};
