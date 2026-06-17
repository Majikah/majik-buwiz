import { EditableField } from "@/components/functional/MajikInvoiceDocument/EditableField";
import { BIRContext } from "@/SDK/majik-buwiz-client/src/core/expenses/types";
import React from "react";
import styled from "styled-components";

const EWT_PRESETS: {
  label: string;
  value: string;
}[] = [
  {
    label: "WC158 | Professional fees — individuals (5%)",
    value: "WC158",
  },
  {
    label: "WC157 | Professional fees — corporations (10%)",
    value: "WC157",
  },
  { label: "WC010 | Rental — corporations (2%)", value: "WC010" },
  { label: "WI010 | Rental — individuals (5%)", value: "WI010" },
  { label: "WC001 | Goods — corporations (1%)", value: "WC001" },
  { label: "WI001 | Services — individuals (2%)", value: "WI001" },
];

// ---------------------------------------------------------------------------
// Styled
// ---------------------------------------------------------------------------

const Wrapper = styled.div``;

const BIRGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${({ theme }) => theme.spacing.small}
    ${({ theme }) => theme.spacing.medium};
`;

const FieldBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: 3px;
`;

const FieldLabel = styled.div`
  font-family: ${({ theme }) => theme.typography.fonts.semibold};
  font-size: 9px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.7;
`;

const EmptyNote = styled.div`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.5;
  padding: 4px 0;
`;

const AttachBtn = styled.button`
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  font-size: 12px;
  color: ${({ theme }) => theme.colors.primary};
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px 0;
  display: flex;
  align-items: center;
  gap: 5px;
  opacity: 0.7;

  &:hover {
    opacity: 1;
  }
`;

const RemoveBtn = styled.button`
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  font-size: 11px;
  color: ${({ theme }) => theme.colors.error};
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  opacity: 0.6;

  &:hover {
    opacity: 1;
  }
`;

const BIRHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: ${({ theme }) => theme.spacing.small};
`;

// ---------------------------------------------------------------------------
// Option sets
// ---------------------------------------------------------------------------

const PURCHASE_TYPE_OPTIONS = [
  { value: "goods-other-than-capital", label: "Goods (Non-Capital)" },
  { value: "capital-goods", label: "Capital Goods" },
  { value: "services", label: "Services" },
  { value: "other", label: "Other" },
];

const VAT_CLASSIFICATION_OPTIONS = [
  { value: "creditable", label: "Creditable" },
  { value: "non-creditable", label: "Non-Creditable" },
  { value: "exempt", label: "VAT-Exempt" },
  { value: "zero-rated", label: "Zero-Rated" },
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ExpenseBIRProps {
  bir?: BIRContext;
  readonly: boolean;
  canEdit: boolean;
  onBIRChange: (patch: Partial<BIRContext>) => void;
  onBIRAttach: () => void;
  onBIRRemove: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const ExpenseBIRComponent: React.FC<ExpenseBIRProps> = ({
  bir,
  readonly,
  canEdit,
  onBIRChange,
  onBIRAttach,
  onBIRRemove,
}) => (
  <Wrapper>
    {!bir ? (
      <EmptyNote>
        No BIR metadata attached.
        {canEdit && (
          <>
            {" "}
            <AttachBtn onClick={onBIRAttach}>+ Attach BIR context</AttachBtn>
          </>
        )}
      </EmptyNote>
    ) : (
      <>
        {canEdit && (
          <BIRHeader>
            <span />
            <RemoveBtn onClick={onBIRRemove}>Remove BIR context</RemoveBtn>
          </BIRHeader>
        )}

        <BIRGrid>
          <FieldBlock>
            <FieldLabel>Purchase Type</FieldLabel>
            <EditableField
              as="select"
              label="Purchase Type"
              value={bir.purchaseType ?? ""}
              onChange={(v) =>
                onBIRChange({
                  purchaseType: v
                    ? (v as BIRContext["purchaseType"])
                    : undefined,
                })
              }
              readonly={readonly}
              options={[{ value: "", label: "—" }, ...PURCHASE_TYPE_OPTIONS]}
              inputStyle={{ fontSize: "12px" }}
            />
          </FieldBlock>

          <FieldBlock>
            <FieldLabel>VAT Classification</FieldLabel>
            <EditableField
              as="select"
              label="VAT Classification"
              value={bir.vatClassification ?? ""}
              onChange={(v) =>
                onBIRChange({
                  vatClassification: v
                    ? (v as BIRContext["vatClassification"])
                    : undefined,
                })
              }
              readonly={readonly}
              options={[
                { value: "", label: "—" },
                ...VAT_CLASSIFICATION_OPTIONS,
              ]}
              inputStyle={{ fontSize: "12px" }}
            />
          </FieldBlock>

          <FieldBlock>
            <FieldLabel>Input VAT Rate</FieldLabel>
            <EditableField
              label="Input VAT Rate"
              type="number"
              value={
                bir.inputVatRate !== undefined
                  ? String(bir.inputVatRate * 100)
                  : ""
              }
              onChange={(v) =>
                onBIRChange({
                  inputVatRate: v ? Number(v) / 100 : undefined,
                })
              }
              readonly={readonly}
              inputStyle={{ fontSize: "12px", width: "80px" }}
              placeholder="e.g. 12"
            />
          </FieldBlock>

          <FieldBlock>
            <FieldLabel>Input VAT Amount</FieldLabel>
            <EditableField
              label="Input VAT Amount"
              type="number"
              value={
                bir.inputVatAmount !== undefined
                  ? String(bir.inputVatAmount)
                  : ""
              }
              onChange={(v) =>
                onBIRChange({
                  inputVatAmount: v ? Number(v) : undefined,
                })
              }
              readonly={readonly}
              inputStyle={{ fontSize: "12px", width: "120px" }}
              placeholder="Override"
            />
          </FieldBlock>

          <FieldBlock>
            <FieldLabel>Withholding ATC</FieldLabel>
            <EditableField
              as="select"
              label="Withholding ATC Code"
              value={bir.withholdingAtcCode ?? ""}
              onChange={(v) =>
                onBIRChange({ withholdingAtcCode: v || undefined })
              }
              readonly={readonly}
              inputStyle={{ fontSize: "12px", letterSpacing: "0.04em" }}
              placeholder="e.g. WI010"
              options={EWT_PRESETS}
            />
          </FieldBlock>

          <FieldBlock>
            <FieldLabel>Withholding Amount</FieldLabel>
            <EditableField
              label="Withholding Amount"
              type="number"
              value={
                bir.withholdingAmount !== undefined
                  ? String(bir.withholdingAmount)
                  : ""
              }
              onChange={(v) =>
                onBIRChange({
                  withholdingAmount: v ? Number(v) : undefined,
                })
              }
              readonly={readonly}
              inputStyle={{ fontSize: "12px", width: "120px" }}
            />
          </FieldBlock>

          <FieldBlock>
            <FieldLabel>Supplier TIN</FieldLabel>
            <EditableField
              label="Supplier TIN"
              value={bir.supplierTin ?? ""}
              onChange={(v) => onBIRChange({ supplierTin: v || undefined })}
              readonly={readonly}
              inputStyle={{ fontSize: "12px", letterSpacing: "0.04em" }}
            />
          </FieldBlock>

          <FieldBlock>
            <FieldLabel>Receipt / Invoice No.</FieldLabel>
            <EditableField
              label="Receipt / Invoice No."
              value={bir.receiptNumber ?? ""}
              onChange={(v) => onBIRChange({ receiptNumber: v || undefined })}
              readonly={readonly}
              inputStyle={{ fontSize: "12px" }}
            />
          </FieldBlock>
        </BIRGrid>
      </>
    )}
  </Wrapper>
);

export const ExpenseBIR = React.memo(ExpenseBIRComponent);
