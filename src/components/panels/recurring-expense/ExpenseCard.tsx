/**
 * ExpenseCard.tsx
 *
 * Kanban card for a single RecurringExpenseItem.
 *
 * Changes from v1:
 *   - Uses app theme tokens (no custom theme import)
 *   - Tighter layout for 220px column width
 *   - Action buttons always visible (not hover-only) for touch-friendly use
 *     inside a modal context where hover is less reliable
 */

import React from "react";
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

interface ExpenseCardProps {
  item: RecurringItemSummary;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onEnd: (id: string) => void;
  onActualize: (id: string) => void;
}

// ── Styled ────────────────────────────────────────────────────────────────────

const CardRoot = styled.div`
  background: ${({ theme }) => theme.colors.primaryBackground};
  border: 1px solid ${({ theme }) => theme.colors.primary}14;
  border-radius: ${({ theme }) => theme.borders?.radius?.medium ?? "6px"};
  padding: 10px 11px;
  transition:
    border-color 0.15s,
    box-shadow 0.15s;
  position: relative;

  &:hover {
    border-color: ${({ theme }) => theme.colors.primary}33;
    box-shadow: 0 2px 8px ${({ theme }) => theme.colors.primary}10;
  }
`;

const CardHeader = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 6px;
  margin-bottom: 8px;
`;

const CardTitle = styled.h4`
  font-family: ${({ theme }) =>
    theme.typography?.fonts?.semibold ?? "sans-serif"};
  font-size: 12px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textPrimary};
  margin: 0;
  line-height: 1.3;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const ActionRow = styled.div`
  display: flex;
  align-items: center;
  gap: 1px;
  flex-shrink: 0;
`;

const Btn = styled.button<{ $danger?: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border: none;
  border-radius: ${({ theme }) => theme.borders?.radius?.small ?? "4px"};
  background: transparent;
  cursor: pointer;
  transition: all 0.12s;
  font-size: 11px;
  color: ${({ $danger, theme }) =>
    $danger ? theme.colors.error : theme.colors.textSecondary};
  opacity: 0.55;

  &:hover {
    opacity: 1;
    background: ${({ $danger, theme }) =>
      $danger ? theme.colors.error + "15" : theme.colors.primarySoft};
    color: ${({ $danger, theme }) =>
      $danger ? theme.colors.error : theme.colors.primary};
  }
`;

const AmountRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  margin-bottom: 6px;
`;

const Amount = styled.span`
  font-family: ${({ theme }) =>
    theme.typography?.fonts?.numbers ?? "monospace"};
  font-size: 13px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.primary};
  letter-spacing: -0.01em;
`;

const StatusBadge = styled.span<{ $status: "active" | "paused" | "ended" }>`
  font-family: ${({ theme }) =>
    theme.typography?.fonts?.medium ?? "sans-serif"};
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.08em;
  padding: 1px 6px;
  border-radius: ${({ theme }) => theme.borders?.radius?.rounded ?? "99px"};
  text-transform: uppercase;
  white-space: nowrap;
  flex-shrink: 0;

  ${({ $status }) => {
    switch ($status) {
      case "active":
        return css`
          color: var(--color-success, #3ecf82);
          background: var(--color-success-soft, #3ecf8218);
          border: 1px solid var(--color-success, #3ecf82) 44;
        `;
      case "paused":
        return css`
          color: #6e86c8;
          background: #6e86c818;
          border: 1px solid #6e86c844;
        `;
      case "ended":
        return css`
          color: #7a8299;
          background: #7a829918;
          border: 1px solid #7a829933;
        `;
    }
  }}
`;

const MetaRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  padding: 2px 0;
`;

const MetaKey = styled.span`
  font-family: ${({ theme }) =>
    theme.typography?.fonts?.medium ?? "sans-serif"};
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.55;
  flex-shrink: 0;
`;

const MetaVal = styled.span`
  font-family: ${({ theme }) => theme.typography?.fonts?.light ?? "sans-serif"};
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textSecondary};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: right;
`;

const CardFooter = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid ${({ theme }) => theme.colors.primary}10;
  flex-wrap: wrap;
`;

const TagRow = styled.div`
  display: flex;
  gap: 3px;
  flex-wrap: wrap;
  flex: 1;
  min-width: 0;
`;

const MiniTag = styled.span`
  font-family: ${({ theme }) =>
    theme.typography?.fonts?.medium ?? "sans-serif"};
  font-size: 9px;
  padding: 1px 5px;
  border-radius: ${({ theme }) => theme.borders?.radius?.rounded ?? "99px"};
  background: ${({ theme }) => theme.colors.primarySoft};
  color: ${({ theme }) => theme.colors.primary};
  border: 1px solid ${({ theme }) => theme.colors.primary}18;
  white-space: nowrap;
`;

const ActualizeBtn = styled.button<{ $disabled?: boolean }>`
  display: flex;
  gap: 6px;
  font-family: ${({ theme }) =>
    theme.typography?.fonts?.medium ?? "sans-serif"};
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.06em;
  padding: 5px 8px;
  border-radius: ${({ theme }) => theme.borders?.radius?.small ?? "4px"};
  border: 1px solid ${({ theme }) => theme.colors.primary}44;
  background: ${({ theme }) => theme.colors.primarySoft};
  color: ${({ theme }) => theme.colors.primary};
  cursor: ${({ $disabled }) => ($disabled ? "not-allowed" : "pointer")};
  transition: all 0.15s;
  white-space: nowrap;
  opacity: ${({ $disabled }) => ($disabled ? 0.35 : 1)};
  text-transform: uppercase;
  flex-shrink: 0;

  &:hover:not([disabled]) {
    background: ${({ theme }) =>
      theme.gradients?.primary ?? theme.colors.primary};
    color: ${({ theme }) => theme.colors.static?.white ?? "#fff"};
    border-color: transparent;
  }
`;

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtCurrency = (amount: number, currency = "PHP") =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount);

// ── Component ─────────────────────────────────────────────────────────────────

export const ExpenseCard: React.FC<ExpenseCardProps> = ({
  item,
  onEdit,
  onDelete,
  onPause,
  onResume,
  onEnd,
  onActualize,
}) => {
  const isActive = item.status === "active";

  return (
    <CardRoot>
      <CardHeader>
        <CardTitle title={item.name}>{item.name}</CardTitle>
        <ActionRow>
          <Btn title="Edit" onClick={() => onEdit(item.id)}>
            <PencilIcon size={12} weight="fill" />
          </Btn>
          {item.status === "active" && (
            <Btn title="Pause" onClick={() => onPause(item.id)}>
              <PauseIcon size={12} weight="fill" />
            </Btn>
          )}
          {item.status === "paused" && (
            <Btn title="Resume" onClick={() => onResume(item.id)}>
              <PlayIcon size={12} weight="fill" />
            </Btn>
          )}
          {item.status !== "ended" && (
            <Btn title="End" onClick={() => onEnd(item.id)}>
              <StopIcon size={12} weight="fill" />
            </Btn>
          )}
          <Btn $danger title="Delete" onClick={() => onDelete(item.id)}>
            <TrashIcon size={12} weight="fill" />
          </Btn>
        </ActionRow>
      </CardHeader>

      <AmountRow>
        <Amount>{fmtCurrency(item.amount, item.currency)}</Amount>
        <StatusBadge $status={item.status}>{item.status}</StatusBadge>
      </AmountRow>

      {item.payee?.legalName && (
        <MetaRow>
          <MetaKey>Payee</MetaKey>
          <MetaVal>{item.payee.legalName}</MetaVal>
        </MetaRow>
      )}

      {item.paidBy?.legalName && (
        <MetaRow>
          <MetaKey>Paid by</MetaKey>
          <MetaVal>{item.paidBy.legalName}</MetaVal>
        </MetaRow>
      )}

      {item.schedule?.startDate && (
        <MetaRow>
          <MetaKey>Since</MetaKey>
          <MetaVal>{item.schedule.startDate}</MetaVal>
        </MetaRow>
      )}

      <CardFooter>
        <TagRow>
          {(item.tags ?? []).slice(0, 2).map((t) => (
            <MiniTag key={t}>{t}</MiniTag>
          ))}
        </TagRow>
        <ActualizeBtn
          $disabled={!isActive}
          disabled={!isActive}
          onClick={() => isActive && onActualize(item.id)}
          title={
            isActive
              ? "Actualize this expense for a month"
              : "Only active items can be actualized"
          }
        >
          <LightningIcon size={12} weight="fill" />
          Actualize
        </ActualizeBtn>
      </CardFooter>
    </CardRoot>
  );
};
