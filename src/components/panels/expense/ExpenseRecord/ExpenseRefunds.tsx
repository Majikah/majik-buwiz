import React, { useState } from "react";
import styled from "styled-components";
import { PlusIcon, TrashIcon } from "@phosphor-icons/react";

import { fmtCurrency } from "./ExpenseTotals"; // adjust import path
import { RefundRecord } from "@/SDK/majik-buwiz-client/src/core/expenses/types";

// ---------------------------------------------------------------------------
// Styled
// ---------------------------------------------------------------------------

const Wrapper = styled.div``;

const SectionLabel = styled.div`
  font-family: ${({ theme }) => theme.typography.fonts.semibold};
  font-size: 9px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.primary};
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 6px;

  &::after {
    content: "";
    flex: 1;
    height: 1px;
    background: ${({ theme }) => theme.colors.primary}18;
  }
`;

const RefundList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: ${({ theme }) => theme.spacing.small};
`;

const RefundRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.medium};
  padding: 8px 10px;
  border-radius: ${({ theme }) => theme.borders.radius.medium};
  background: ${({ theme }) => theme.colors.brand.green}08;
  border: 1px solid ${({ theme }) => theme.colors.brand.green}22;
  font-size: 12px;
`;

const RefundDate = styled.span`
  font-family: ${({ theme }) => theme.typography.fonts.numbers};
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textSecondary};
  white-space: nowrap;
`;

const RefundAmount = styled.span`
  font-family: ${({ theme }) => theme.typography.fonts.numbers};
  font-size: 13px;
  color: ${({ theme }) => theme.colors.brand.green};
  white-space: nowrap;
`;

const RefundReason = styled.span`
  flex: 1;
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.7;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const RemoveBtn = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  color: ${({ theme }) => theme.colors.error};
  opacity: 0.4;
  padding: 2px;
  display: flex;
  align-items: center;

  &:hover {
    opacity: 1;
  }
`;

const EmptyNote = styled.div`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.5;
  padding: 4px 0;
`;

// ---------------------------------------------------------------------------
// Add refund form
// ---------------------------------------------------------------------------

const AddForm = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr 2fr auto;
  gap: ${({ theme }) => theme.spacing.small};
  align-items: end;
  padding: 10px;
  border-radius: ${({ theme }) => theme.borders.radius.medium};
  background: ${({ theme }) => theme.colors.secondaryBackground};
  border: 1px solid ${({ theme }) => theme.colors.primary}18;
  margin-top: ${({ theme }) => theme.spacing.small};

  @media (max-width: ${({ theme }) => theme.breakpoints.tablet}) {
    grid-template-columns: 1fr 1fr;
  }
`;

const FormLabel = styled.div`
  font-family: ${({ theme }) => theme.typography.fonts.semibold};
  font-size: 9px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.7;
  margin-bottom: 4px;
`;

const FormInput = styled.input`
  width: 100%;
  font-family: ${({ theme }) => theme.typography.fonts.regular};
  font-size: 12px;
  background: ${({ theme }) => theme.colors.primaryBackground};
  border: 1px solid ${({ theme }) => theme.colors.primary}22;
  border-radius: ${({ theme }) => theme.borders.radius.small};
  padding: 5px 8px;
  color: ${({ theme }) => theme.colors.textPrimary};
  outline: none;

  &:focus {
    border-color: ${({ theme }) => theme.colors.primary}66;
  }
`;

const AddBtn = styled.button`
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  font-size: 12px;
  color: ${({ theme }) => theme.colors.primary};
  background: ${({ theme }) => theme.colors.primarySoft};
  border: 1px solid ${({ theme }) => theme.colors.primary}33;
  border-radius: ${({ theme }) => theme.borders.radius.small};
  padding: 5px 12px;
  cursor: pointer;
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 5px;

  &:hover {
    background: ${({ theme }) => theme.colors.primary}22;
  }

  &:disabled {
    opacity: 0.4;
    cursor: default;
  }
`;

const OpenFormBtn = styled.button`
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  font-size: 12px;
  color: ${({ theme }) => theme.colors.primary};
  background: none;
  border: none;
  cursor: pointer;
  padding: 6px 0;
  display: flex;
  align-items: center;
  gap: 5px;
  opacity: 0.7;

  &:hover {
    opacity: 1;
  }
`;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ExpenseRefundsProps {
  refunds: readonly RefundRecord[];
  currency: string;
  refundableAmount: number;
  isRefunded: boolean;
  canAddRefund: boolean;
  onAddRefund: (refund: Omit<RefundRecord, "id">) => void;
  onRemoveRefund: (refundId: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const ExpenseRefundsComponent: React.FC<ExpenseRefundsProps> = ({
  refunds,
  currency,
  refundableAmount,
  isRefunded,
  canAddRefund,
  onAddRefund,
  onRemoveRefund,
}) => {
  const [showForm, setShowForm] = useState(false);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState("");
  const [reference, setReference] = useState("");

  const handleAdd = () => {
    const amt = Number(amount);
    if (!amt || amt <= 0) return;
    onAddRefund({
      amount: amt,
      refundedAt: date,
      reason: reason || undefined,
      reference: reference || undefined,
    });
    setAmount("");
    setReason("");
    setReference("");
    setShowForm(false);
  };

  return (
    <Wrapper>
      <SectionLabel>Refunds</SectionLabel>

      <RefundList>
        {refunds.length === 0 ? (
          <EmptyNote>No refunds recorded.</EmptyNote>
        ) : (
          refunds.map((r) => (
            <RefundRow key={r.id}>
              <RefundDate>{r.refundedAt}</RefundDate>
              <RefundAmount>+{fmtCurrency(r.amount, currency)}</RefundAmount>
              <RefundReason>{r.reason ?? r.reference ?? "—"}</RefundReason>
              {canAddRefund && !isRefunded && (
                <RemoveBtn
                  title="Remove refund"
                  onClick={() => onRemoveRefund(r.id)}
                >
                  <TrashIcon size={13} />
                </RemoveBtn>
              )}
            </RefundRow>
          ))
        )}
      </RefundList>

      {canAddRefund && !isRefunded && refundableAmount > 0 && (
        <>
          {!showForm ? (
            <OpenFormBtn onClick={() => setShowForm(true)}>
              <PlusIcon size={13} />
              Record refund
            </OpenFormBtn>
          ) : (
            <AddForm>
              <div>
                <FormLabel>Amount</FormLabel>
                <FormInput
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder={`max ${refundableAmount.toFixed(2)}`}
                  max={refundableAmount}
                  min={0.01}
                  step={0.01}
                />
              </div>

              <div>
                <FormLabel>Date</FormLabel>
                <FormInput
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>

              <div>
                <FormLabel>Reason / Reference</FormLabel>
                <FormInput
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Optional"
                />
              </div>

              <AddBtn
                onClick={handleAdd}
                disabled={!amount || Number(amount) <= 0}
              >
                <PlusIcon size={13} />
                Add
              </AddBtn>
            </AddForm>
          )}
        </>
      )}
    </Wrapper>
  );
};

export const ExpenseRefunds = React.memo(ExpenseRefundsComponent);
