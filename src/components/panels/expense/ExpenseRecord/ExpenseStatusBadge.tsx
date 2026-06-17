import { ExpenseDocumentType, ExpenseRecordEffectiveStatus } from "@/SDK/majik-buwiz-client/src/core/expenses/types";
import React from "react";
import styled from "styled-components";

// ---------------------------------------------------------------------------
// Styled
// ---------------------------------------------------------------------------

const BaseBadge = styled.span`
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  font-size: 10px;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  padding: 3px 10px;
  border-radius: ${({ theme }) => theme.borders.radius.rounded};
  display: inline-flex;
  align-items: center;
  gap: 5px;
  border: 1px solid transparent;
`;

const EffectiveStatusBadge = styled(BaseBadge)<{
  $status: ExpenseRecordEffectiveStatus;
}>`
  ${({ $status, theme }) => {
    switch ($status) {
      case "approved":
        return `
          background: ${theme.colors.brand.green}22;
          color: ${theme.colors.brand.green};
          border-color: ${theme.colors.brand.green}44;
        `;
      case "partially-refunded":
        return `
          background: ${theme.colors.accent}18;
          color: ${theme.colors.accent};
          border-color: ${theme.colors.accent}33;
        `;
      case "refunded":
        return `
          background: ${theme.colors.primarySoft};
          color: ${theme.colors.textSecondary};
          border-color: ${theme.colors.primary}22;
        `;
      case "draft":
      default:
        return `
          background: ${theme.colors.secondaryBackground};
          color: ${theme.colors.textSecondary};
          border-color: ${theme.colors.primary}18;
        `;
    }
  }}
`;

const DocTypeBadge = styled(BaseBadge)`
  background: ${({ theme }) => theme.colors.primarySoft};
  color: ${({ theme }) => theme.colors.primary};
  border-color: ${({ theme }) => theme.colors.primary}33;
`;

// ---------------------------------------------------------------------------
// Dot indicator for effective status
// ---------------------------------------------------------------------------

const Dot = styled.span<{ $status: ExpenseRecordEffectiveStatus }>`
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
  background: ${({ $status, theme }) => {
    switch ($status) {
      case "approved":
        return theme.colors.brand.green;
      case "partially-refunded":
        return theme.colors.accent;
      case "refunded":
        return theme.colors.textSecondary;
      default:
        return theme.colors.textSecondary;
    }
  }};
`;

// ---------------------------------------------------------------------------
// Document type label map
// ---------------------------------------------------------------------------

const DOC_TYPE_LABELS: Record<ExpenseDocumentType, string> = {
  "supplier-invoice": "Supplier Invoice",
  "official-receipt": "Official Receipt",
  "billing-statement": "Billing Statement",
  "utility-bill": "Utility Bill",
  "rent-invoice": "Rent Invoice",
  "professional-fee-invoice": "Professional Fee Invoice",
  "importation-document": "Importation Document",
  other: "Other",
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ExpenseStatusBadgeProps {
  effectiveStatus: ExpenseRecordEffectiveStatus;
  documentType: ExpenseDocumentType;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const ExpenseStatusBadge: React.FC<ExpenseStatusBadgeProps> = ({
  effectiveStatus,
  documentType,
}) => (
  <>
    <DocTypeBadge>{DOC_TYPE_LABELS[documentType] ?? documentType}</DocTypeBadge>

    <EffectiveStatusBadge $status={effectiveStatus}>
      <Dot $status={effectiveStatus} />
      {effectiveStatus.replace("-", " ")}
    </EffectiveStatusBadge>
  </>
);
