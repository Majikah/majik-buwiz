import React from "react";
import styled, { css } from "styled-components";
import { EditableField } from "./EditableField";
import type {
  LineItemInput,
  //   TaxDetail,
  //   Discount,
} from "@majikah/majik-invoice";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function computeLineItem(item: LineItemInput): {
  base: number;
  discountAmt: number;
  postDiscount: number;
  taxAmt: number;
  net: number;
} {
  const base = item.quantity * item.unitPrice;
  const discountAmt = item.discount
    ? item.discount.type === "percentage"
      ? base * item.discount.value
      : item.discount.value
    : 0;
  const postDiscount = base - discountAmt;

  const taxes = item.taxes ?? [];
  const taxAmt = taxes.reduce((sum, tax) => {
    const amt = tax.inclusive
      ? postDiscount - postDiscount / (1 + tax.rate)
      : postDiscount * tax.rate;
    return sum + amt;
  }, 0);

  // Net is inclusive of any inclusive taxes, exclusive taxes add on top
  const hasExclusive = taxes.some((t) => !t.inclusive);
  const net = hasExclusive ? postDiscount + taxAmt : postDiscount;

  return { base, discountAmt, postDiscount, taxAmt, net };
}

export function fmt(n: number, currency = "PHP"): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(n);
}

function pct(r: number) {
  return (r * 100).toFixed(0) + "%";
}

// ---------------------------------------------------------------------------
// Styled
// ---------------------------------------------------------------------------

const TableWrapper = styled.div`
  overflow-x: auto;
  margin-bottom: ${({ theme }) => theme.spacing.small};
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
  font-family: ${({ theme }) => theme.typography.fonts.regular};
`;

const Th = styled.th<{ $align?: "left" | "right" | "center" }>`
  font-family: ${({ theme }) => theme.typography.fonts.semibold};
  font-size: 9px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.primary};
  padding: 8px 6px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.primary}22;
  text-align: ${({ $align = "left" }) => $align};
`;

const Tr = styled.tr<{ $canEdit: boolean }>`
  ${({ $canEdit, theme }) =>
    $canEdit &&
    css`
      &:hover td {
        background: ${theme.colors.primarySoft};
      }
      &:hover .row-del {
        opacity: 1;
      }
    `}
`;

const Td = styled.td<{ $align?: "left" | "right" | "center" }>`
  padding: 8px 6px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.primary}10;
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textPrimary};
  text-align: ${({ $align = "left" }) => $align};
  vertical-align: middle;
`;

const TaxChip = styled.span`
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  font-size: 10px;
  padding: 2px 7px;
  border-radius: ${({ theme }) => theme.borders.radius.rounded};
  background: ${({ theme }) => theme.colors.primarySoft};
  color: ${({ theme }) => theme.colors.primary};
`;

const DiscountChip = styled.span`
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  font-size: 10px;
  padding: 2px 7px;
  border-radius: ${({ theme }) => theme.borders.radius.rounded};
  background: ${({ theme }) => theme.colors.brand.green}18;
  color: ${({ theme }) => theme.colors.brand.green};
`;

const NoneChip = styled.span`
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.4;
`;

const NetTotal = styled.div`
  font-family: ${({ theme }) => theme.typography.fonts.numbers};
  font-size: 13px;
  font-weight: 500;
  color: ${({ theme }) => theme.colors.textPrimary};
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
`;

const DeleteBtn = styled.button`
  opacity: 0;
  transition: opacity ${({ theme }) => theme.animations.duration.short};
  background: none;
  border: none;
  cursor: pointer;
  color: ${({ theme }) => theme.colors.error};
  font-size: 11px;
  padding: 1px 3px;
  border-radius: ${({ theme }) => theme.borders.radius.small};
  line-height: 1;

  &:hover {
    background: ${({ theme }) => theme.colors.error}18;
  }
  &:disabled {
    display: none;
  }
`;

const AddRowBtn = styled.button`
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  font-size: 12px;
  color: ${({ theme }) => theme.colors.primary};
  background: none;
  border: none;
  cursor: pointer;
  padding: 8px 4px;
  display: flex;
  align-items: center;
  gap: 5px;
  transition: opacity ${({ theme }) => theme.animations.duration.short};

  &:hover {
    opacity: 0.7;
  }
  &:disabled {
    display: none;
  }
`;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface LineItemsTableProps {
  items: LineItemInput[];
  currency: string;
  canEdit: boolean; // false when sealed OR readonly
  onChange: (items: LineItemInput[]) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const LineItemsTableComponent: React.FC<LineItemsTableProps> = ({
  items,
  currency,
  canEdit,
  onChange,
}) => {
  const updateItem = (index: number, patch: Partial<LineItemInput>) => {
    const next = items.map((it, i) => (i === index ? { ...it, ...patch } : it));
    onChange(next);
  };

  const removeItem = (index: number) => {
    if (items.length <= 1) return;
    onChange(items.filter((_, i) => i !== index));
  };

  const addItem = () => {
    onChange([
      ...items,
      {
        id: crypto.randomUUID(),
        description: "New line item",
        quantity: 1,
        unitPrice: 0,
        unit: "piece",
      },
    ]);
  };

  return (
    <>
      <TableWrapper>
        <Table>
          <thead>
            <tr>
              <Th style={{ width: "30%" }}>Description</Th>
              <Th style={{ width: "7%" }} $align="right">
                Qty
              </Th>
              <Th style={{ width: "8%" }}>Unit</Th>
              <Th style={{ width: "14%" }} $align="right">
                Unit price
              </Th>
              <Th style={{ width: "11%" }} $align="center">
                Tax
              </Th>
              <Th style={{ width: "11%" }} $align="center">
                Discount
              </Th>
              <Th style={{ width: "14%" }} $align="right">
                Net total
              </Th>
              <Th style={{ width: "5%" }} />
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => {
              const c = computeLineItem(item);
              return (
                <Tr key={item.id ?? i} $canEdit={canEdit}>
                  <Td>
                    <EditableField
                      block
                      label="Description"
                      value={item.description}
                      onChange={(v) => updateItem(i, { description: v })}
                      readonly={!canEdit}
                      inputStyle={{ fontSize: "12px", width: "100%" }}
                    />
                  </Td>
                  <Td $align="right">
                    <EditableField
                      label="Qty"
                      type="number"
                      value={String(item.quantity)}
                      onChange={(v) => updateItem(i, { quantity: Number(v) })}
                      readonly={!canEdit}
                      inputStyle={{
                        fontSize: "12px",
                        width: "48px",
                        textAlign: "right",
                      }}
                    />
                  </Td>
                  <Td>
                    <EditableField
                      label="Unit"
                      value={item.unit ?? ""}
                      onChange={(v) => updateItem(i, { unit: v || undefined })}
                      readonly={!canEdit}
                      inputStyle={{ fontSize: "12px", width: "52px" }}
                    />
                  </Td>
                  <Td $align="right">
                    <EditableField
                      label="Unit Price"
                      type="number"
                      value={String(item.unitPrice)}
                      onChange={(v) => updateItem(i, { unitPrice: Number(v) })}
                      readonly={!canEdit}
                      inputStyle={{
                        fontSize: "12px",
                        width: "80px",
                        textAlign: "right",
                      }}
                    />
                  </Td>
                  <Td $align="center">
                    {item.taxes?.length ? (
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: 3,
                          justifyContent: "center",
                        }}
                      >
                        {item.taxes.map((tax, ti) => (
                          <TaxChip key={ti} title={tax.taxType}>
                            {tax.taxType} {pct(tax.rate)}
                            {tax.inclusive && " (incl.)"}
                          </TaxChip>
                        ))}
                      </div>
                    ) : (
                      <NoneChip>—</NoneChip>
                    )}
                  </Td>
                  <Td $align="center">
                    {item.discount ? (
                      <DiscountChip>
                        {item.discount.type === "percentage"
                          ? pct(item.discount.value)
                          : fmt(item.discount.value, currency)}
                      </DiscountChip>
                    ) : (
                      <NoneChip>—</NoneChip>
                    )}
                  </Td>
                  <Td $align="right">
                    <NetTotal>
                      {fmt(c.postDiscount, currency)}
                      <DeleteBtn
                        className="row-del"
                        onClick={() => removeItem(i)}
                        disabled={!canEdit || items.length <= 1}
                        title="Remove line item (assertDraft guard: min 1 item)"
                      >
                        ✕
                      </DeleteBtn>
                    </NetTotal>
                  </Td>
                </Tr>
              );
            })}
          </tbody>
        </Table>
      </TableWrapper>
      <AddRowBtn onClick={addItem} disabled={!canEdit}>
        <svg
          width="11"
          height="11"
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <line x1="6" y1="1" x2="6" y2="11" />
          <line x1="1" y1="6" x2="11" y2="6" />
        </svg>
        Add line item
      </AddRowBtn>
    </>
  );
};

export const LineItemsTable = React.memo(LineItemsTableComponent);
