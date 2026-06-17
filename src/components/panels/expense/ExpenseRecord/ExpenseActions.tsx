import React, { useState } from "react";
import styled from "styled-components";
import {
  CheckCircleIcon,
  CopyIcon,
  ArrowCounterClockwiseIcon,
} from "@phosphor-icons/react";

// ---------------------------------------------------------------------------
// Styled
// ---------------------------------------------------------------------------

const ActionsBar = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
`;

const ActionBtn = styled.button<{
  $variant?: "default" | "approve" | "danger";
}>`
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  font-size: 12px;
  padding: 6px 14px;
  border-radius: ${({ theme }) => theme.borders.radius.small};
  border: 1px solid transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  transition:
    background ${({ theme }) => theme.animations.duration.short},
    border-color ${({ theme }) => theme.animations.duration.short},
    opacity ${({ theme }) => theme.animations.duration.short};

  ${({ $variant, theme }) => {
    switch ($variant) {
      case "approve":
        return `
          background: ${theme.colors.brand.green}18;
          color: ${theme.colors.brand.green};
          border-color: ${theme.colors.brand.green}44;
          &:hover { background: ${theme.colors.brand.green}28; }
        `;
      case "danger":
        return `
          background: ${theme.colors.error}10;
          color: ${theme.colors.error};
          border-color: ${theme.colors.error}33;
          &:hover { background: ${theme.colors.error}20; }
        `;
      default:
        return `
          background: ${theme.colors.secondaryBackground};
          color: ${theme.colors.textSecondary};
          border-color: ${theme.colors.primary}22;
          &:hover { color: ${theme.colors.textPrimary}; border-color: ${theme.colors.primary}44; }
        `;
    }
  }}

  &:disabled {
    opacity: 0.35;
    cursor: default;
    pointer-events: none;
  }
`;

const ConfirmBar = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: ${({ theme }) => theme.borders.radius.small};
  background: ${({ theme }) => theme.colors.error}10;
  border: 1px solid ${({ theme }) => theme.colors.error}33;
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textSecondary};
  flex-wrap: wrap;
`;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ExpenseActionsProps {
  status: string;
  isRefunded: boolean;
  isApproved: boolean;
  isDraft: boolean;
  isSealed?: boolean;
  onApprove?: () => Promise<void> | void;
  onMarkRefunded?: () => Promise<void> | void;
  onDuplicate?: () => Promise<void> | void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const ExpenseActionsComponent: React.FC<ExpenseActionsProps> = ({
  isRefunded,
  isApproved,
  isDraft,
  onApprove,
  onMarkRefunded,
  onDuplicate,
}) => {
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmRefund, setConfirmRefund] = useState(false);

  const run = async (key: string, fn?: () => Promise<void> | void) => {
    if (!fn) return;
    setBusy(key);
    try {
      await fn();
    } finally {
      setBusy(null);
    }
  };

  return (
    <ActionsBar>
      {/* Approve — only from draft */}
      {isDraft && onApprove && (
        <ActionBtn
          $variant="approve"
          onClick={() => run("approve", onApprove)}
          disabled={busy === "approve"}
        >
          <CheckCircleIcon size={14} weight="fill" />
          {busy === "approve" ? "Approving…" : "Approve"}
        </ActionBtn>
      )}

      {/* Mark refunded — only from approved, not already refunded */}
      {isApproved && !isRefunded && onMarkRefunded && (
        <>
          {!confirmRefund ? (
            <ActionBtn $variant="danger" onClick={() => setConfirmRefund(true)}>
              <ArrowCounterClockwiseIcon size={14} />
              Mark as Refunded
            </ActionBtn>
          ) : (
            <ConfirmBar>
              Mark entire expense as fully refunded?
              <ActionBtn
                $variant="danger"
                onClick={() => {
                  setConfirmRefund(false);
                  run("refund", onMarkRefunded);
                }}
                disabled={busy === "refund"}
              >
                {busy === "refund" ? "Processing…" : "Confirm"}
              </ActionBtn>
              <ActionBtn onClick={() => setConfirmRefund(false)}>
                Cancel
              </ActionBtn>
            </ConfirmBar>
          )}
        </>
      )}

      {/* Duplicate — always available */}
      {onDuplicate && (
        <ActionBtn
          onClick={() => run("duplicate", onDuplicate)}
          disabled={busy === "duplicate"}
        >
          <CopyIcon size={13} />
          {busy === "duplicate" ? "Duplicating…" : "Duplicate"}
        </ActionBtn>
      )}
    </ActionsBar>
  );
};

export const ExpenseActions = React.memo(ExpenseActionsComponent);
