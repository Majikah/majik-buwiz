import React from "react";
import styled from "styled-components";

import type { CurrencyCode, ISODateString } from "@majikah/majik-invoice";
import { EditableField } from "@/components/functional/MajikInvoiceDocument/EditableField";

// ---------------------------------------------------------------------------
// Styled
// ---------------------------------------------------------------------------

const DatesGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: ${({ theme }) => theme.spacing.medium};
  margin-bottom: ${({ theme }) => theme.spacing.medium};
  padding: ${({ theme }) => theme.spacing.medium} 0;
  border-top: 1px solid ${({ theme }) => theme.colors.primary}18;
  border-bottom: 1px solid ${({ theme }) => theme.colors.primary}10;

  @media (max-width: ${({ theme }) => theme.breakpoints.tablet}) {
    grid-template-columns: 1fr 1fr;
  }
`;

const DateField = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const FieldLabel = styled.div`
  font-family: ${({ theme }) => theme.typography.fonts.semibold};
  font-size: 9px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.primary};
  opacity: 0.7;
`;

// ---------------------------------------------------------------------------
// Currency options (common subset — expand as needed)
// ---------------------------------------------------------------------------

const CURRENCY_OPTIONS = [
  { value: "PHP", label: "PHP — Philippine Peso" },
  { value: "USD", label: "USD — US Dollar" },
  { value: "EUR", label: "EUR — Euro" },
  { value: "SGD", label: "SGD — Singapore Dollar" },
  { value: "GBP", label: "GBP — British Pound" },
  { value: "JPY", label: "JPY — Japanese Yen" },
  { value: "AUD", label: "AUD — Australian Dollar" },
  { value: "CAD", label: "CAD — Canadian Dollar" },
  { value: "HKD", label: "HKD — Hong Kong Dollar" },
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ExpenseDatesProps {
  expenseDate: ISODateString;
  paidAt?: ISODateString;
  currency: CurrencyCode;
  readonly: boolean;
  onExpenseDateChange: (v: ISODateString) => void;
  onPaidAtChange: (v: ISODateString | undefined) => void;
  onCurrencyChange: (v: CurrencyCode) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const ExpenseDatesComponent: React.FC<ExpenseDatesProps> = ({
  expenseDate,
  paidAt,
  currency,
  readonly,
  onExpenseDateChange,
  onPaidAtChange,
  onCurrencyChange,
}) => (
  <DatesGrid>
    <DateField>
      <FieldLabel>Expense Date</FieldLabel>
      <EditableField
        label="Expense Date"
        type="date"
        value={expenseDate}
        onChange={(v) => onExpenseDateChange(v as ISODateString)}
        readonly={readonly}
        inputStyle={{ fontSize: "13px" }}
      />
    </DateField>

    <DateField>
      <FieldLabel>Date Paid</FieldLabel>
      <EditableField
        label="Date Paid"
        type="date"
        value={paidAt ?? ""}
        onChange={(v) => onPaidAtChange(v ? (v as ISODateString) : undefined)}
        readonly={readonly}
        inputStyle={{ fontSize: "13px" }}
        placeholder="Not yet paid"
      />
    </DateField>

    <DateField>
      <FieldLabel>Currency</FieldLabel>
      <EditableField
        as="select"
        label="Currency"
        value={currency}
        onChange={(v) => onCurrencyChange(v as CurrencyCode)}
        readonly={readonly}
        options={CURRENCY_OPTIONS}
        inputStyle={{ fontSize: "13px" }}
      />
    </DateField>
  </DatesGrid>
);

export const ExpenseDates = React.memo(ExpenseDatesComponent);
