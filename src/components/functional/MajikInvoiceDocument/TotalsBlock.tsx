import React from "react";
import styled, { css } from "styled-components";
import { fmt } from "./LineItemsTable";
import type { GeneralInvoice } from "@majikah/majik-invoice";
import { toast } from "sonner";
import { CopyIcon } from "@phosphor-icons/react";

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

const Label = styled.span<{ $variant?: "discount" | "tax" | "normal" }>`
  min-width: 100px;
  text-align: right;
  color: ${({ theme, $variant }) => {
    if ($variant === "discount") return theme.colors.brand.green;
    if ($variant === "tax") return theme.colors.textSecondary;
    return theme.colors.textSecondary;
  }};
`;

const Value = styled.span<{ $variant?: "discount" | "tax" | "normal" }>`
  min-width: 110px;
  text-align: right;
  font-family: ${({ theme }) => theme.typography.fonts.numbers};
  color: ${({ theme, $variant }) => {
    if ($variant === "discount") return theme.colors.brand.green;
    return theme.colors.textPrimary;
  }};
`;

const TaxNote = styled.div`
  font-size: 10px;
  color: ${({ theme }) => theme.colors.textSecondary};
  margin-top: 2px;
  font-family: ${({ theme }) => theme.typography.fonts.light};
  opacity: 0.7;
`;

// ---------------------------------------------------------------------------
// Payment Summary
// ---------------------------------------------------------------------------

const PaymentSummary = styled.div<{ $status: string }>`
  width: 100%;
  max-width: 360px;
  margin-top: ${({ theme }) => theme.spacing.medium};
  padding: ${({ theme }) => theme.spacing.medium};
  border-radius: ${({ theme }) => theme.borders.radius.large};
  border: 1px solid
    ${({ theme, $status }) => {
      if ($status === "settled") return `${theme.colors.brand.green}55`;
      if ($status === "partially_paid") return `${theme.colors.primary}55`;

      return `${theme.colors.primary}22`;
    }};

  background: ${({ theme, $status }) => {
    if ($status === "settled") return `${theme.colors.brand.green}08`;
    if ($status === "partially_paid") return `${theme.colors.primary}08`;

    return `${theme.colors.primary}08`;
  }};

  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.small};
`;

const PaymentHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.small};
`;

const PaymentTitle = styled.div`
  font-size: 12px;
  font-family: ${({ theme }) => theme.typography.fonts.semibold};
  color: ${({ theme }) => theme.colors.textPrimary};
`;

const PaymentBadge = styled.div<{ $status: string }>`
  font-size: 10px;
  padding: 4px 8px;
  border-radius: 999px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  font-family: ${({ theme }) => theme.typography.fonts.semibold};

  ${({ theme, $status }) => {
    if ($status === "settled") {
      return css`
        color: ${theme.colors.brand.green};
        background: ${theme.colors.brand.green}18;
      `;
    }

    if ($status === "partially_paid") {
      return css`
        color: ${theme.colors.primary};
        background: ${theme.colors.primary}18;
      `;
    }

    return css`
      color: ${theme.colors.textSecondary};
      background: ${theme.colors.primary}10;
    `;
  }}
`;

const PaymentMeta = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const PaymentRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.medium};
`;

const PaymentLabel = styled.span`
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textSecondary};
`;

const PaymentValue = styled.span<{ $emphasis?: boolean }>`
  font-size: ${({ $emphasis }) => ($emphasis ? "14px" : "12px")};
  font-family: ${({ theme }) => theme.typography.fonts.numbers};
  color: ${({ theme, $emphasis }) =>
    $emphasis ? theme.colors.textPrimary : theme.colors.textSecondary};
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

const copyToClipboard = (text: string, label = "Copied") => {
  navigator.clipboard
    .writeText(text)
    .then(() => toast.success(label, { duration: 1500 }));
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface TotalsBlockProps {
  invoice: GeneralInvoice;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const TotalsBlockComponent: React.FC<TotalsBlockProps> = ({ invoice }) => {
  const { totals, currency } = invoice;

  const taxBreakdown = invoice.taxBreakdown();

  const additiveTaxes = taxBreakdown.filter((t) => t.behaviour === "additive");

  const withholdingTaxes = taxBreakdown.filter(
    (t) => t.behaviour === "withholding",
  );

  return (
    <Block>
      <Row>
        <Label>Subtotal</Label>
        <Value data-private>
          {fmt(totals.subtotalAmount, currency)}

          <FieldCopyBtn
            onClick={() =>
              copyToClipboard(
                totals.subtotalAmount.toString(),
                "Subtotal copied",
              )
            }
          >
            <CopyIcon size={12} />
          </FieldCopyBtn>
        </Value>
      </Row>

      {invoice.hasDiscount && (
        <Row>
          <Label $variant="discount">Discount</Label>
          <Value $variant="discount" data-private>
            −{fmt(totals.discountTotalAmount, currency)}
            <FieldCopyBtn
              onClick={() =>
                copyToClipboard(
                  totals.discountTotalAmount.toString(),
                  "Discount copied",
                )
              }
            >
              <CopyIcon size={12} />
            </FieldCopyBtn>
          </Value>
        </Row>
      )}

      {additiveTaxes.map((t) => (
        <Row key={`${t.taxType}-${t.jurisdiction ?? ""}`}>
          <Label $variant="tax">
            {t.label ?? t.taxType}
            {t.inclusive && " (incl.)"}
          </Label>

          <Value data-private>
            {fmt(t.taxAmount, currency)}

            <FieldCopyBtn
              onClick={() =>
                copyToClipboard(
                  t.taxAmount.toString(),
                  `${t.label || t.taxType} copied`,
                )
              }
            >
              <CopyIcon size={12} />
            </FieldCopyBtn>
          </Value>
        </Row>
      ))}

      <Row $grand>
        <Label>Total</Label>
        <Value data-private>
          {fmt(totals.grandTotalAmount, currency)}{" "}
          <FieldCopyBtn
            onClick={() =>
              copyToClipboard(
                totals.grandTotalAmount.toString(),
                "Total Grand Amount copied",
              )
            }
          >
            <CopyIcon size={12} />
          </FieldCopyBtn>
        </Value>
      </Row>

      {withholdingTaxes.map((t) => (
        <Row key={`${t.taxType}-${t.jurisdiction ?? ""}`}>
          <Label $variant="tax">Less: {t.label ?? t.taxType}</Label>
          <Value data-private>
            −{fmt(t.taxAmount, currency)}
            <FieldCopyBtn
              onClick={() =>
                copyToClipboard(
                  t.taxAmount.toString(),
                  `${t.label || t.taxType} copied`,
                )
              }
            >
              <CopyIcon size={12} />
            </FieldCopyBtn>
          </Value>
        </Row>
      ))}

      {invoice.hasWithholding && (
        <Row $grand>
          <Label>Net Payable</Label>
          <Value data-private>
            {fmt(totals.netPayableAmount, currency)}
            <FieldCopyBtn
              onClick={() =>
                copyToClipboard(
                  totals.netPayableAmount.toString(),
                  "Net Payable copied",
                )
              }
            >
              <CopyIcon size={12} />
            </FieldCopyBtn>
          </Value>
        </Row>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Payment Status Summary */}
      {/* ------------------------------------------------------------------ */}

      <PaymentSummary $status={invoice.paymentStatus}>
        <PaymentHeader>
          <PaymentTitle>Payment Status</PaymentTitle>

          <PaymentBadge $status={invoice.paymentStatus}>
            {invoice.paymentStatus === "settled"
              ? "Paid"
              : invoice.paymentStatus === "partially_paid"
                ? "Partial"
                : "Pending"}
          </PaymentBadge>
        </PaymentHeader>

        <PaymentMeta>
          <PaymentRow>
            <PaymentLabel>Amount Paid</PaymentLabel>

            <PaymentValue data-private>
              {invoice.totalPaid.format()}
              <FieldCopyBtn
                onClick={() =>
                  copyToClipboard(
                    invoice.totalPaid.toMajor().toString(),
                    "Amount Paid copied",
                  )
                }
              >
                <CopyIcon size={12} />
              </FieldCopyBtn>
            </PaymentValue>
          </PaymentRow>

          {!invoice.isFullyPaid && (
            <PaymentRow>
              <PaymentLabel>Remaining Balance</PaymentLabel>

              <PaymentValue $emphasis data-private>
                {invoice.amountDue.format()}
                <FieldCopyBtn
                  onClick={() =>
                    copyToClipboard(
                      invoice.amountDue.toMajor().toString(),
                      "Remaining Balance copied",
                    )
                  }
                >
                  <CopyIcon size={12} />
                </FieldCopyBtn>
              </PaymentValue>
            </PaymentRow>
          )}

          {invoice.isFullyPaid && (
            <PaymentRow>
              <PaymentLabel>Settlement</PaymentLabel>

              <PaymentValue $emphasis>Fully Paid</PaymentValue>
            </PaymentRow>
          )}
        </PaymentMeta>
      </PaymentSummary>

      {invoice.hasTax && (
        <TaxNote>
          Effective tax rate: {(invoice.effectiveTaxRate * 100).toFixed(2)}%
        </TaxNote>
      )}
    </Block>
  );
};

export const TotalsBlock = React.memo(TotalsBlockComponent);
