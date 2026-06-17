import { EditableField } from "@/components/functional/MajikInvoiceDocument/EditableField";
import {
  ExpenseCategory,
  ExpenseDocumentType,
  ExpenseRecordEffectiveStatus,
} from "@/SDK/majik-buwiz-client/src/core/expenses/types";
import React from "react";
import styled from "styled-components";
import { ExpenseStatusBadge } from "./ExpenseStatusBadge";

// ---------------------------------------------------------------------------
// Styled
// ---------------------------------------------------------------------------

const HeaderRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 24px;
  margin-bottom: ${({ theme }) => theme.spacing.large};
`;

const LeftBlock = styled.div`
  flex: 1;
  min-width: 0;
`;

const TypeRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
`;

const RecordTypeLabel = styled.span`
  font-family: ${({ theme }) => theme.typography.fonts.light};
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.textSecondary};
`;

const Dot = styled.span`
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.4;
`;

const RightBlock = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 10px;
  flex-shrink: 0;
`;

const ExpenseIdRow = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
`;

const ExpenseIdLabel = styled.span`
  font-family: ${({ theme }) => theme.typography.fonts.light};
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textSecondary};
  letter-spacing: 0.03em;
`;

const ExpenseIdValue = styled.span`
  font-family: var(--font-numbers);
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textSecondary};
  letter-spacing: 0.04em;
`;

const MetaRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const DescriptionLabel = styled.div`
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textSecondary};
  margin-top: 5px;
  letter-spacing: 0.03em;
`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CATEGORY_OPTIONS: { value: ExpenseCategory; label: string }[] = [
  { value: "cost-of-sales", label: "Cost of Sales" },
  { value: "compensation", label: "Compensation" },
  { value: "rent", label: "Rent" },
  { value: "professional-fees", label: "Professional Fees" },
  { value: "utilities", label: "Utilities" },
  { value: "depreciation", label: "Depreciation" },
  { value: "interest", label: "Interest" },
  { value: "taxes-and-licenses", label: "Taxes & Licenses" },
  { value: "representation", label: "Representation" },
  { value: "transportation", label: "Transportation" },
  { value: "communication", label: "Communication" },
  { value: "insurance", label: "Insurance" },
  { value: "supplies", label: "Supplies" },
  { value: "bad-debts", label: "Bad Debts" },
  { value: "charitable-contributions", label: "Charitable Contributions" },
  { value: "other", label: "Other" },
];

const DOCUMENT_TYPE_OPTIONS: { value: ExpenseDocumentType; label: string }[] = [
  { value: "supplier-invoice", label: "Supplier Invoice" },
  { value: "official-receipt", label: "Official Receipt" },
  { value: "billing-statement", label: "Billing Statement" },
  { value: "utility-bill", label: "Utility Bill" },
  { value: "rent-invoice", label: "Rent Invoice" },
  { value: "professional-fee-invoice", label: "Professional Fee Invoice" },
  { value: "importation-document", label: "Importation Document" },
  { value: "other", label: "Other" },
];

// Truncate UUID to first 8 + last 8 chars for display
const truncateId = (id: string) =>
  id.length > 20 ? `${id.slice(0, 8)}…${id.slice(-8)}` : id;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ExpenseHeaderProps {
  description: string;
  documentType: ExpenseDocumentType;
  category: ExpenseCategory;
  effectiveStatus: ExpenseRecordEffectiveStatus;
  recordId: string;
  readonly: boolean;
  onDescriptionChange: (v: string) => void;
  onDocumentTypeChange: (v: ExpenseDocumentType) => void;
  onCategoryChange: (v: ExpenseCategory) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const ExpenseHeaderComponent: React.FC<ExpenseHeaderProps> = ({
  description,
  documentType,
  category,
  effectiveStatus,
  recordId,
  readonly,
  onDescriptionChange,
  onDocumentTypeChange,
  onCategoryChange,
}) => {
  return (
    <HeaderRow>
      {/* ── Left: record identity ── */}
      <LeftBlock>
        <TypeRow>
          <RecordTypeLabel>Expense</RecordTypeLabel>
          <Dot />
          <EditableField
            as="select"
            label="Document Type"
            value={documentType}
            onChange={(v) => onDocumentTypeChange(v as ExpenseDocumentType)}
            readonly={readonly}
            options={DOCUMENT_TYPE_OPTIONS}
            inputStyle={{ fontSize: "10px", letterSpacing: "0.05em" }}
          />
        </TypeRow>

        <EditableField
          block
          label="Description"
          value={description}
          onChange={onDescriptionChange}
          readonly={readonly}
          inputStyle={{
            fontFamily: "inherit",
            fontSize: "17px",
            fontWeight: 500,
          }}
          maxLines={2}
        />
        <DescriptionLabel>Description</DescriptionLabel>
      </LeftBlock>

      {/* ── Right: reference + classification + status ── */}
      <RightBlock>
        <ExpenseIdRow>
          <ExpenseIdLabel>Expense ID</ExpenseIdLabel>
          <ExpenseIdValue>{truncateId(recordId)}</ExpenseIdValue>
        </ExpenseIdRow>

        <MetaRow>
          <EditableField
            as="select"
            label="Category"
            value={category}
            onChange={(v) => onCategoryChange(v as ExpenseCategory)}
            readonly={readonly}
            options={CATEGORY_OPTIONS}
            inputStyle={{ fontSize: "10px", textAlign: "right" }}
          />
          <ExpenseStatusBadge
            effectiveStatus={effectiveStatus}
            documentType={documentType}
          />
        </MetaRow>
      </RightBlock>
    </HeaderRow>
  );
};

export const ExpenseHeader = React.memo(ExpenseHeaderComponent);
