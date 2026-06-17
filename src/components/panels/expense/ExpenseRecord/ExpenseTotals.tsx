import React from "react";
import styled from "styled-components";
import { CopyIcon } from "@phosphor-icons/react";
import { toast } from "sonner";
import { ExpenseRecord } from "@/SDK/majik-buwiz-client/src/core/expenses/expense-record";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function fmtCurrency(n: number, currency = "PHP"): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(n);
}

function copyToClipboard(text: string, label = "Copied") {
  navigator.clipboard
    .writeText(text)
    .then(() => toast.success(label, { duration: 1500 }));
}

// ---------------------------------------------------------------------------
// Styled
// ---------------------------------------------------------------------------

const Block = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 5px;
  margin: ${({ theme }) => theme.spacing.medium} 0;
`;

const Row = styled.div<{ $grand?: boolean }>`
  display: flex;
  gap: ${({ theme }) => theme.spacing.large};
  font-size: ${({ $grand }) => ($grand ? "15px" : "12px")};
  font-family: ${({ theme, $grand }) =>
    $grand ? theme.typography.fonts.semibold : theme.typography.fonts.regular};
  padding-top: ${({ $grand, theme }) => ($grand ? theme.spacing.small : "0")};
  border-top: ${({ $grand, theme }) =>
    $grand ? `1.5px solid ${theme.colors.primary}44` : "none"};
`;

const Label = styled.span<{ $variant?: "refund" | "normal" }>`
  min-width: 120px;
  text-align: right;
  color: ${({ theme, $variant }) =>
    $variant === "refund"
      ? theme.colors.brand.green
      : theme.colors.textSecondary};
`;

const Value = styled.span<{ $variant?: "refund" | "normal" }>`
  min-width: 110px;
  text-align: right;
  font-family: ${({ theme }) => theme.typography.fonts.numbers};
  color: ${({ theme, $variant }) =>
    $variant === "refund"
      ? theme.colors.brand.green
      : theme.colors.textPrimary};
`;

const FieldCopyBtn = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  padding: 2px;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.3;
  flex-shrink: 0;

  &:hover {
    opacity: 0.8;
  }

  margin-left: 5px;
`;

const NetSummary = styled.div<{ $status: "settled" | "partial" | "pending" }>`
  width: 100%;
  max-width: 360px;
  margin-top: ${({ theme }) => theme.spacing.medium};
  padding: ${({ theme }) => theme.spacing.medium};
  border-radius: ${({ theme }) => theme.borders.radius.large};
  border: 1px solid
    ${({ theme, $status }) => {
      if ($status === "settled") return `${theme.colors.brand.green}55`;
      if ($status === "partial") return `${theme.colors.accent}55`;
      return `${theme.colors.primary}22`;
    }};
  background: ${({ theme, $status }) => {
    if ($status === "settled") return `${theme.colors.brand.green}08`;
    if ($status === "partial") return `${theme.colors.accent}08`;
    return `${theme.colors.primary}08`;
  }};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.small};
`;

const NetHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const NetTitle = styled.div`
  font-size: 12px;
  font-family: ${({ theme }) => theme.typography.fonts.semibold};
  color: ${({ theme }) => theme.colors.textPrimary};
`;

const StatusChip = styled.div<{ $status: "settled" | "partial" | "pending" }>`
  font-size: 10px;
  padding: 4px 8px;
  border-radius: 999px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  font-family: ${({ theme }) => theme.typography.fonts.semibold};

  ${({ theme, $status }) => {
    if ($status === "settled") {
      return `color: ${theme.colors.brand.green}; background: ${theme.colors.brand.green}18;`;
    }
    if ($status === "partial") {
      return `color: ${theme.colors.accent}; background: ${theme.colors.accent}18;`;
    }
    return `color: ${theme.colors.textSecondary}; background: ${theme.colors.primary}10;`;
  }}
`;

const NetRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.medium};
`;

const NetLabel = styled.span`
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textSecondary};
`;

const NetValue = styled.span<{ $emphasis?: boolean }>`
  font-size: ${({ $emphasis }) => ($emphasis ? "14px" : "12px")};
  font-family: ${({ theme }) => theme.typography.fonts.numbers};
  color: ${({ theme, $emphasis }) =>
    $emphasis ? theme.colors.textPrimary : theme.colors.textSecondary};
`;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ExpenseTotalsProps {
  record: ExpenseRecord;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const ExpenseTotalsComponent: React.FC<ExpenseTotalsProps> = ({ record }) => {
  const { currency, totalAmount, totalRefundedAmount, netAmount } = record;

  const hasRefunds = totalRefundedAmount > 0;

  const refundStatus = record.isRefunded
    ? "settled"
    : record.isPartiallyRefunded
      ? "partial"
      : "pending";

  const refundStatusLabel =
    refundStatus === "settled"
      ? "Fully Refunded"
      : refundStatus === "partial"
        ? "Partially Refunded"
        : "No Refund";

  return (
    <Block>
      <Row>
        <Label>Total Amount</Label>
        <Value data-private>
          {fmtCurrency(totalAmount, currency)}
          <FieldCopyBtn
            onClick={() =>
              copyToClipboard(totalAmount.toString(), "Total amount copied")
            }
          >
            <CopyIcon size={12} />
          </FieldCopyBtn>
        </Value>
      </Row>

      {hasRefunds && (
        <Row>
          <Label $variant="refund">Refunded</Label>
          <Value $variant="refund" data-private>
            −{fmtCurrency(totalRefundedAmount, currency)}
            <FieldCopyBtn
              onClick={() =>
                copyToClipboard(
                  totalRefundedAmount.toString(),
                  "Refunded amount copied",
                )
              }
            >
              <CopyIcon size={12} />
            </FieldCopyBtn>
          </Value>
        </Row>
      )}

      {hasRefunds && (
        <Row $grand>
          <Label>Net Amount</Label>
          <Value data-private>
            {fmtCurrency(netAmount, currency)}
            <FieldCopyBtn
              onClick={() =>
                copyToClipboard(netAmount.toString(), "Net amount copied")
              }
            >
              <CopyIcon size={12} />
            </FieldCopyBtn>
          </Value>
        </Row>
      )}

      {/* Refund summary panel */}
      <NetSummary $status={refundStatus}>
        <NetHeader>
          <NetTitle>Refund Status</NetTitle>
          <StatusChip $status={refundStatus}>{refundStatusLabel}</StatusChip>
        </NetHeader>

        <NetRow>
          <NetLabel>Total Refunded</NetLabel>
          <NetValue data-private>
            {fmtCurrency(totalRefundedAmount, currency)}
          </NetValue>
        </NetRow>

        {!record.isRefunded && (
          <NetRow>
            <NetLabel>Refundable Balance</NetLabel>
            <NetValue $emphasis data-private>
              {fmtCurrency(record.refundableAmount, currency)}
            </NetValue>
          </NetRow>
        )}

        {record.isRefunded && (
          <NetRow>
            <NetLabel>Settlement</NetLabel>
            <NetValue $emphasis>Fully Refunded</NetValue>
          </NetRow>
        )}
      </NetSummary>
    </Block>
  );
};

export const ExpenseTotals = React.memo(ExpenseTotalsComponent);
