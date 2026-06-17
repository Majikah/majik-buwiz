/**
 * ExpenseStatusQuickActions.tsx
 *
 * Quick-action status transition buttons for the expense panel header.
 *
 * Lifecycle: draft → approved → refunded
 *
 * isAdmin (default: true):
 *   true  → All EXPENSE_ALLOWED_TRANSITIONS shown as direct action buttons,
 *           except "refunded" which always opens the AddRefundModal.
 *   false → Only CLIENT_ALLOWED_TRANSITIONS shown.
 *           Admin-only transitions (approve, void draft) are hidden.
 *
 * Transition ownership summary:
 *   Admin only:      approve (draft → approved)
 *   Admin + client:  refunded (via refund modal) — only when approved
 *
 * Special routing:
 *   approved → refunded  → opens AddRefundModal (calls onRefund, not onTransition)
 */

import React, { useState } from "react";
import styled, { css } from "styled-components";
import {
  CheckCircleIcon,
  ArrowUUpLeftIcon,
  ReceiptIcon,
} from "@phosphor-icons/react";
import { AddRefundModal } from "./modals/AddRefundModal";
import type {
  ExpenseRecordStatus,
  RefundRecord,
} from "@/SDK/majik-buwiz-client/src/core/expenses/types";
import type { ExpenseRecord } from "@/SDK/majik-buwiz-client/src/core/expenses/expense-record";

// ---------------------------------------------------------------------------
// Transition table
// ---------------------------------------------------------------------------

/**
 * Mirrors EXPENSE_RECORD_ALLOWED_TRANSITIONS from constants.
 * Defined locally here to keep this component self-contained — import from
 * constants if you prefer a single source of truth.
 */
const EXPENSE_ALLOWED_TRANSITIONS: Record<
  ExpenseRecordStatus,
  ExpenseRecordStatus[]
> = {
  draft: ["approved"],
  approved: ["refunded"],
  refunded: [], // terminal
};

/**
 * Transitions a non-admin client may trigger.
 * Clients can only initiate a refund on an approved expense — never approve.
 */
const CLIENT_ALLOWED_TRANSITIONS: ExpenseRecordStatus[] = ["refunded"];

/**
 * Transitions that open the refund modal instead of calling onTransition directly.
 * ExpenseRecord.addRefund() handles the actual status promotion, so we never
 * call onTransition("refunded") — we call onRefund(updatedRecord) instead.
 */
const REFUND_TRANSITIONS = new Set<ExpenseRecordStatus>(["refunded"]);

// ---------------------------------------------------------------------------
// Action metadata
// ---------------------------------------------------------------------------

interface ActionMeta {
  label: string;
  icon: React.ReactNode;
  variant: "default" | "primary" | "success" | "warning" | "danger";
}

const ACTION_META: Record<ExpenseRecordStatus, ActionMeta> = {
  draft: {
    label: "Revert to Draft",
    icon: <ArrowUUpLeftIcon size={11} weight="bold" />,
    variant: "default",
  },
  approved: {
    label: "Approve",
    icon: <CheckCircleIcon size={11} weight="fill" />,
    variant: "primary",
  },
  refunded: {
    label: "Record Refund",
    icon: <ReceiptIcon size={11} weight="bold" />,
    variant: "warning",
  },
};

// ---------------------------------------------------------------------------
// Styled
// ---------------------------------------------------------------------------

const ActionsRoot = styled.div`
  display: flex;
  align-items: center;
  gap: 5px;
  flex-wrap: nowrap;
`;

const ActionBtn = styled.button<{ $variant: ActionMeta["variant"] }>`
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  font-size: 11px;
  padding: 5px 11px;
  border-radius: ${({ theme }) => theme.borders.radius.medium};
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
  transition: all 0.14s ease;

  ${({ $variant, theme }) => {
    switch ($variant) {
      case "primary":
        return css`
          background: ${theme.gradients.primary};
          border: 1px solid transparent;
          color: ${theme.colors.static.white};
          &:hover:not(:disabled) {
            filter: brightness(1.1);
          }
        `;
      case "success":
        return css`
          background: transparent;
          border: 1px solid ${theme.colors.brand.green};
          color: ${theme.colors.brand.green};
          &:hover:not(:disabled) {
            background: ${theme.colors.brand.green};
            color: ${theme.colors.static.white};
          }
        `;
      case "warning":
        return css`
          background: transparent;
          border: 1px solid ${theme.colors.textSecondary};
          color: ${theme.colors.textSecondary};
          &:hover:not(:disabled) {
            background: ${theme.colors.secondaryBackground};
          }
        `;
      case "danger":
        return css`
          background: transparent;
          border: 1px solid ${theme.colors.error};
          color: ${theme.colors.error};
          &:hover:not(:disabled) {
            background: ${theme.colors.error}14;
          }
        `;
      default:
        return css`
          background: transparent;
          border: 1px solid ${theme.colors.primary};
          color: ${theme.colors.textSecondary};
          &:hover:not(:disabled) {
            background: ${theme.colors.primarySoft};
            color: ${theme.colors.primary};
            border-color: ${theme.colors.primary};
          }
        `;
    }
  }}

  &:disabled {
    opacity: 0.38;
    cursor: not-allowed;
    pointer-events: none;
  }

  svg {
    flex-shrink: 0;
  }
`;

const Separator = styled.div`
  width: 1px;
  height: 18px;
  background: ${({ theme }) => theme.colors.primary}18;
  flex-shrink: 0;
  margin: 0 2px;
`;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ExpenseStatusQuickActionsProps {
  /** The live ExpenseRecord instance */
  expense: ExpenseRecord;
  /**
   * Called for direct status transitions (currently only draft → approved).
   * NOT called for approved → refunded — use onRefund for that path.
   */
  onTransition: (to: ExpenseRecordStatus) => void;
  /**
   * Called after a refund is confirmed in the modal.
   * Receives the updated ExpenseRecord returned by expense.addRefund().
   * The caller is responsible for persisting the updated record.
   */
  onRefund?: (updatedExpense: ExpenseRecord) => Promise<void>;
  /** Disable all buttons while an async operation is in-flight */
  disabled?: boolean;
  /**
   * Admin mode — default true.
   *   true  → All allowed transitions visible. approved → refunded opens modal.
   *   false → Only CLIENT_ALLOWED_TRANSITIONS (refunded via modal, if approved).
   */
  isAdmin?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const ExpenseStatusQuickActions: React.FC<
  ExpenseStatusQuickActionsProps
> = ({ expense, onTransition, onRefund, disabled = false, isAdmin = true }) => {
  const [refundModalOpen, setRefundModalOpen] = useState(false);

  // ── Derive visible transitions ────────────────────────────────────────────

  const activeStatus = expense.status;

  const allTargets = EXPENSE_ALLOWED_TRANSITIONS[activeStatus] ?? [];

  const visibleTargets = isAdmin
    ? allTargets
    : allTargets.filter((t) => CLIENT_ALLOWED_TRANSITIONS.includes(t));

  if (visibleTargets.length === 0) return null;

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleButtonClick = (to: ExpenseRecordStatus) => {
    if (REFUND_TRANSITIONS.has(to)) {
      setRefundModalOpen(true);
      return;
    }
    onTransition(to);
  };

  const handleRefundConfirm = async (refund: Omit<RefundRecord, "id">) => {
    const updated = expense.addRefund(refund);
    await onRefund?.(updated);
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <Separator />
      <ActionsRoot>
        {visibleTargets.map((to) => {
          const meta = ACTION_META[to];
          return (
            <ActionBtn
              key={to}
              $variant={meta.variant}
              onClick={() => handleButtonClick(to)}
              disabled={disabled}
              title={`Transition to: ${to}`}
            >
              {meta.icon}
              {meta.label}
            </ActionBtn>
          );
        })}
      </ActionsRoot>

      <AddRefundModal
        open={refundModalOpen}
        onOpenChange={setRefundModalOpen}
        expense={expense}
        onConfirm={handleRefundConfirm}
      />
    </>
  );
};
