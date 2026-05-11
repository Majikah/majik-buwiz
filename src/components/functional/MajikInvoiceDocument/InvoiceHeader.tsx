import React from "react";
import styled from "styled-components";
import { EditableField } from "./EditableField";
import {
  InvoiceStatus,
  InvoiceType,
  MajikInvoiceMode,
  MajikInvoiceStatus,
} from "@majikah/majik-invoice";

// ---------------------------------------------------------------------------
// Styled
// ---------------------------------------------------------------------------

const HeaderRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: ${({ theme }) => theme.spacing.large};
`;

const BrandBlock = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 12px;
`;

const LogoMark = styled.div`
  width: 40px;
  height: 40px;
  border-radius: ${({ theme }) => theme.borders.radius.medium};
  background: ${({ theme }) => theme.colors.secondaryBackground};
  border: 1px solid ${({ theme }) => theme.colors.primary}33;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: ${({ theme }) => theme.typography.fonts.bold};
  font-size: 13px;
  color: ${({ theme }) => theme.colors.primary};
  flex-shrink: 0;
`;

const CompanyStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const MetaBlock = styled.div`
  text-align: right;
`;

const InvoiceWord = styled.div`
  font-family: ${({ theme }) => theme.typography.fonts.light};
  font-size: ${({ theme }) => theme.typography.sizes.header};
  color: ${({ theme }) => theme.colors.textPrimary};
  letter-spacing: ${({ theme }) => theme.typography.letterSpacing.heading};
`;

const InvoiceNumRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
  margin-top: 4px;
`;

const HashPrefix = styled.span`
  font-family: ${({ theme }) => theme.typography.fonts.light};
  font-size: ${({ theme }) => theme.typography.sizes.body};
  color: ${({ theme }) => theme.colors.textSecondary};
`;

const BadgeRow = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  justify-content: flex-end;
`;

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

const StatusBadge = styled(BaseBadge)<{
  $status: MajikInvoiceStatus;
}>`
  ${({ $status, theme }) => {
    switch ($status) {
      case "sealed":
        return `background: ${theme.colors.brand.green}22; color: ${theme.colors.brand.green}; border-color: ${theme.colors.brand.green}44;`;
      case "partially-signed":
      case "fully-signed":
        return `background: ${theme.colors.primarySoft}; color: ${theme.colors.primary}; border-color: ${theme.colors.primary}33;`;
      case "unsigned":
        return `background: ${theme.colors.accent}18; color: ${theme.colors.accent}; border-color: ${theme.colors.accent}33;`;
      case "invalid":
        return `background: ${theme.colors.error}18; color: ${theme.colors.error}; border-color: ${theme.colors.error}33;`;
      default:
        return `background: ${theme.colors.secondaryBackground}; color: ${theme.colors.textSecondary};`;
    }
  }}
`;

const SealedBanner = styled.div`
  background: ${({ theme }) => theme.colors.brand.green}14;
  border: 1px solid ${({ theme }) => theme.colors.brand.green}33;
  border-radius: ${({ theme }) => theme.borders.radius.medium};
  padding: 6px 12px;
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  font-size: 11px;
  color: ${({ theme }) => theme.colors.brand.green};
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: ${({ theme }) => theme.spacing.medium};
`;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface InvoiceHeaderProps {
  companyName: string;
  tagline: string;
  invoiceNumber: string;
  invoiceType?: InvoiceType;
  status?: {
    invoice?: InvoiceStatus;
    security?: MajikInvoiceStatus;
  };
  displayStatus?: string;
  mode?: MajikInvoiceMode;
  isSealed: boolean;
  sealedBy?: string;
  sealTimestamp?: string;
  readonly: boolean;
  onCompanyNameChange: (v: string) => void;
  onTaglineChange: (v: string) => void;
  onInvoiceNumberChange: (v: string) => void;
  onInvoiceTypeChange: (v: InvoiceType) => void;
  onStatusChange: (v: InvoiceStatus) => void;
}

const INVOICE_TYPES: InvoiceType[] = [
  "commercial",
  "proforma",
  "credit",
  "debit",
  "tax",
  "government",
  "intercompany",
  "project",
  "recurring",
  "forensic",
  "environmental",
];

const INVOICE_STATUS: InvoiceStatus[] = [
  "disputed",
  "draft",
  "issued",
  "overdue",
  "paid",
  "partial",
  "sent",
  "viewed",
  "void",
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const InvoiceHeaderComponent: React.FC<InvoiceHeaderProps> = ({
  companyName,
  tagline,
  invoiceNumber,
  invoiceType = "commercial",
  status = {
    invoice: "draft",
    security: "unsigned",
  },
  displayStatus,
  isSealed,
  sealedBy,
  sealTimestamp,
  readonly,
  onCompanyNameChange,
  onTaglineChange,
  onInvoiceNumberChange,
  onInvoiceTypeChange,
  onStatusChange,
}) => (
  <>
    {isSealed && (
      <SealedBanner>
        <svg
          width="12"
          height="12"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M8 2L3 4v4c0 3 2.5 5.5 5 6 2.5-.5 5-3 5-6V4L8 2z" />
        </svg>
        Sealed — immutable. Sealed by {sealedBy ?? "unknown"} at{" "}
        {sealTimestamp ?? "—"}. No further edits or signatures are permitted.
      </SealedBanner>
    )}
    <HeaderRow>
      <BrandBlock>
        <LogoMark>
          {companyName
            .split(" ")
            .map((w) => w[0])
            .slice(0, 2)
            .join("")
            .toUpperCase()}
        </LogoMark>
        <CompanyStack>
          <EditableField
            label="Company Name"
            value={companyName}
            onChange={onCompanyNameChange}
            readonly={readonly}
            inputStyle={{
              fontFamily: "inherit",
              fontSize: "17px",
              fontWeight: 500,
            }}
            maxLines={2}
          />
          <EditableField
            label="Tagline"
            value={tagline}
            onChange={onTaglineChange}
            readonly={readonly}
            inputStyle={{ fontSize: "12px", opacity: 0.6 }}
          />
        </CompanyStack>
      </BrandBlock>

      <MetaBlock>
        <InvoiceWord>Invoice</InvoiceWord>
        <InvoiceNumRow>
          <HashPrefix>#</HashPrefix>
          <EditableField
            label="Invoice Number"
            value={invoiceNumber}
            onChange={onInvoiceNumberChange}
            readonly={readonly}
            inputStyle={{
              fontSize: "12px",
              textAlign: "right",
              width: "140px",
            }}
          />
        </InvoiceNumRow>
        <BadgeRow>
          <EditableField
            as="select"
            label="Type"
            value={invoiceType}
            onChange={(v) => onInvoiceTypeChange(v as InvoiceType)}
            readonly={readonly}
            options={INVOICE_TYPES.map((t) => ({ value: t, label: t }))}
            inputStyle={{ fontSize: "10px", textAlign: "right" }}
          />

          <EditableField
            as="select"
            label="Status"
            value={status.invoice}
            onChange={(v) => onStatusChange(v as InvoiceStatus)}
            readonly={readonly}
            options={INVOICE_STATUS.map((t) => ({ value: t, label: t }))}
            inputStyle={{ fontSize: "10px", textAlign: "right" }}
          />

          <StatusBadge $status={status.security || "unsigned"}>
            {status.security === "sealed" && (
              <svg
                width="10"
                height="10"
                viewBox="0 0 10 10"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path d="M2 5l2 2 4-4" />
              </svg>
            )}
            {displayStatus || status.security}
          </StatusBadge>
        </BadgeRow>
      </MetaBlock>
    </HeaderRow>
  </>
);

export const InvoiceHeader = React.memo(InvoiceHeaderComponent);
