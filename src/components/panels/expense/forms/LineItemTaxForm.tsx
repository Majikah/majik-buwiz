// components/expenses/forms/LineItemTaxForm.tsx
//
// This form is rendered inside LineItemTaxModal. Its job is to let the user
// add, edit, and remove TaxDetail entries for a single line item.
//
// INTEGRATION: Plug in your existing tax editor here. If your LineItemsTable
// already has inline TaxEditor UI (a TaxPicker, TaxRow component, etc.),
// extract it into a shared component and import it here.
//
// The form only needs to:
//   - Render the current taxes[]
//   - Call onChange(newTaxes) whenever the user modifies them
//   - Call onValidate(true/false) so the modal can gate the Apply button

import React, { useCallback, useState } from "react";
import styled from "styled-components";
import type { LineItemInput, TaxDetail } from "@majikah/majik-invoice";
import { TaxManager } from "@majikah/majik-invoice";
import {
  PlusIcon,
  ScalesIcon,
  ToggleLeftIcon,
  ToggleRightIcon,
  TrashIcon,
} from "@phosphor-icons/react";

// ---------------------------------------------------------------------------
// Styled — minimal chrome; the tax editor itself drives most of the layout
// ---------------------------------------------------------------------------

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const LineItemPreview = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textSecondary};
  padding: 8px 10px;
  background: ${({ theme }) => `${theme.colors.primary}08`};
  border-radius: ${({ theme }) => theme.borders.radius.small};
  gap: 12px;
`;

const PreviewName = styled.span`
  font-family: ${({ theme }) => theme.typography.fonts.semibold};
  color: ${({ theme }) => theme.colors.textPrimary};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const PreviewAmount = styled.span`
  flex-shrink: 0;
  font-family: ${({ theme }) => theme.typography.fonts.regular};
  opacity: 0.65;
`;

const Section = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const SectionLabel = styled.div`
  font-size: 9px;
  font-family: ${({ theme }) => theme.typography.fonts.semibold};
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: ${({ theme }) => theme.colors.primary};
  display: flex;
  align-items: center;
  gap: 6px;
  padding-bottom: 6px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.primary}15;
`;

// ── Tax Manager Styled ────────────────────────────────────────────────────

const TaxTable = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const TaxTableHeader = styled.div`
  display: grid;
  grid-template-columns: 90px 70px 80px 80px 70px 28px;
  gap: 6px;
  align-items: center;
  padding: 0 2px;
`;

const TaxColLabel = styled.div`
  font-size: 9px;
  font-family: ${({ theme }) => theme.typography.fonts.semibold};
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.7;
`;

const TaxRow = styled.div`
  display: grid;
  grid-template-columns: 90px 70px 80px 80px 50px 28px;
  gap: 6px;
  align-items: center;
  padding: 6px 8px;
  border-radius: ${({ theme }) => theme.borders.radius.small};
  background: ${({ theme }) => theme.colors.primaryBackground};
  border: 1px solid ${({ theme }) => theme.colors.primary}12;
  transition: border-color 0.15s;
  width: 100%;

  &:hover {
    border-color: ${({ theme }) => theme.colors.primary}30;
  }
`;

const TaxInput = styled.input`
  font-family: ${({ theme }) => theme.typography.fonts.regular};
  font-size: 11px;
  padding: 4px 7px;
  border-radius: ${({ theme }) => theme.borders.radius.small};
  border: 1px solid ${({ theme }) => theme.colors.primary}28;
  background: ${({ theme }) => theme.colors.secondaryBackground};
  color: ${({ theme }) => theme.colors.textPrimary};
  width: 100%;

  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.primary}77;
  }
`;

const TaxSelect = styled.select`
  font-family: ${({ theme }) => theme.typography.fonts.regular};
  font-size: 11px;
  padding: 4px 6px;
  border-radius: ${({ theme }) => theme.borders.radius.small};
  border: 1px solid ${({ theme }) => theme.colors.primary}28;
  background: ${({ theme }) => theme.colors.secondaryBackground};
  color: ${({ theme }) => theme.colors.textPrimary};
  width: 100%;
  cursor: pointer;

  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.primary}77;
  }
`;

const InclusiveToggle = styled.button<{ $active: boolean }>`
  background: none;
  border: none;
  cursor: pointer;
  color: ${({ $active, theme }) =>
    $active ? theme.colors.primary : theme.colors.textSecondary};
  opacity: ${({ $active }) => ($active ? 1 : 0.4)};
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2px;
  transition: all 0.15s;

  &:hover {
    opacity: 1;
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.2;
  }
`;

const DeleteTaxBtn = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  color: ${({ theme }) => theme.colors.error};
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2px;
  border-radius: ${({ theme }) => theme.borders.radius.small};
  opacity: 0.4;
  transition: opacity 0.15s;

  &:hover {
    opacity: 1;
    background: ${({ theme }) => theme.colors.error}12;
  }
`;

const AddTaxRow = styled.div`
  display: flex;
  gap: 8px;
  margin-top: 2px;
`;

const AddTaxButton = styled.button`
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  font-size: 11px;
  color: ${({ theme }) => theme.colors.primary};
  border: none;
  background: none;
  cursor: pointer;
  padding: 5px 0;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  transition: opacity 0.15s;

  &:hover {
    opacity: 0.7;
  }
`;

const WithholdingQuickAdd = styled.button`
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  font-size: 11px;
  color: ${({ theme }) => theme.colors.primary};
  border: 1px solid ${({ theme }) => `${theme.colors.primary}44`};
  background: ${({ theme }) => `${theme.colors.primary}0e`};
  cursor: pointer;
  padding: 4px 10px;
  border-radius: ${({ theme }) => theme.borders.radius.small};
  display: inline-flex;
  align-items: center;
  gap: 4px;
  transition: all 0.15s;

  &:hover {
    background: ${({ theme }) => `${theme.colors.primary}18`};
  }
`;

const EmptyTaxNote = styled.div`
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.5;
  padding: 8px 0;
  font-style: italic;
`;

// ── Constants ─────────────────────────────────────────────────────────────

const TAX_TYPES = ["VAT", "GST", "EWT", "WHT", "SALES_TAX", "EXCISE", "NONE"];

const BEHAVIOUR_OPTIONS: { value: string; label: string }[] = [
  { value: "additive", label: "Additive" },
  { value: "withholding", label: "Withholding" },
  { value: "informational", label: "Info only" },
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface LineItemTaxFormProps {
  taxes: TaxDetail[];
  currency: string;
  lineItem: LineItemInput;
  onChange: (taxes: TaxDetail[]) => void;
  onValidate: (valid: boolean) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const LineItemTaxForm: React.FC<LineItemTaxFormProps> = ({
  taxes,
  currency,
  lineItem,
  onChange,
  onValidate,
}) => {
  const [localTaxes, setLocalTaxes] = useState<TaxDetail[]>(taxes);
  const [error, setError] = useState<string | null>(null);

  const handleTaxesChange = useCallback(
    (next: TaxDetail[]) => {
      // Validate through TaxManager before accepting
      try {
        TaxManager.fromMany(next);
        setError(null);
        onValidate(true);
      } catch (e: any) {
        setError(e.message ?? "Invalid tax configuration");
        onValidate(false);
      }
      setLocalTaxes(next);
      onChange(next);
    },
    [onChange, onValidate],
  );

  const updateTax = (index: number, patch: Partial<TaxDetail>) => {
    const next = localTaxes.map((t, i) =>
      i === index ? { ...t, ...patch } : t,
    );
    handleTaxesChange(next);
  };

  const removeTax = (index: number) => {
    const removed = localTaxes.filter((_, i) => i !== index);

    handleTaxesChange(removed);
  };

  const addWithholding = () => {
    // Don't add duplicate EWT
    if (localTaxes.some((t) => t.behaviour === "withholding")) return;

    handleTaxesChange([
      ...localTaxes,
      {
        taxType: "EWT",
        rate: 0.05,
        behaviour: "withholding" as const,
        jurisdiction: "PH",
      },
    ]);
  };

  const addCustomTax = () => {
    handleTaxesChange([
      ...localTaxes,
      {
        taxType: "VAT",
        rate: 0.12,
        behaviour: "additive" as const,
        jurisdiction: "PH",
      },
    ]);
  };

  const hasWithholding = localTaxes.some((t) => t.behaviour === "withholding");

  const qty = lineItem.quantity ?? 1;
  const unit = lineItem.unitPrice ?? 0;

  return (
    <Wrapper>
      {/* Context strip — reminds the user which item they're editing */}
      <LineItemPreview>
        <PreviewName>{lineItem.description || "Line item"}</PreviewName>
        <PreviewAmount>
          {qty} × {unit.toLocaleString()} {currency}
        </PreviewAmount>
      </LineItemPreview>

      {/* ── Tax Manager ── */}
      <Section>
        <SectionLabel>
          <ScalesIcon size={12} /> Default Taxes
        </SectionLabel>

        {localTaxes.length === 0 ? (
          <EmptyTaxNote>
            No default taxes configured — line items will have no tax applied.
          </EmptyTaxNote>
        ) : (
          <TaxTable>
            <TaxTableHeader>
              <TaxColLabel>Type</TaxColLabel>
              <TaxColLabel>Rate (%)</TaxColLabel>
              <TaxColLabel>Jurisdiction</TaxColLabel>
              <TaxColLabel>Behaviour</TaxColLabel>
              <TaxColLabel>Inclusive</TaxColLabel>
              <TaxColLabel />
            </TaxTableHeader>

            {localTaxes.map((tax, i) => {
              const behaviour = tax.behaviour ?? "additive";
              const isWithholding = behaviour === "withholding";

              return (
                <TaxRow key={i}>
                  {/* Tax Type */}
                  <TaxInput
                    value={tax.taxType}
                    onChange={(e) =>
                      updateTax(i, {
                        taxType: e.target.value.toUpperCase(),
                      })
                    }
                    placeholder="VAT"
                    list="tax-type-suggestions"
                  />

                  {/* Rate */}
                  <TaxInput
                    type="number"
                    min={0}
                    max={100}
                    step={0.1}
                    value={((tax.rate ?? 0) * 100).toFixed(1)}
                    onChange={(e) =>
                      updateTax(i, {
                        rate: parseFloat(e.target.value) / 100 || 0,
                      })
                    }
                  />

                  {/* Jurisdiction */}
                  <TaxInput
                    value={tax.jurisdiction ?? ""}
                    onChange={(e) =>
                      updateTax(i, {
                        jurisdiction: e.target.value || undefined,
                      })
                    }
                    placeholder="PH"
                  />

                  {/* Behaviour */}
                  <TaxSelect
                    value={behaviour}
                    onChange={(e) =>
                      updateTax(i, {
                        behaviour: e.target.value as TaxDetail["behaviour"],
                        // Clear inclusive if switching to withholding
                        ...(e.target.value === "withholding"
                          ? { inclusive: false }
                          : {}),
                      })
                    }
                  >
                    {BEHAVIOUR_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </TaxSelect>

                  {/* Inclusive toggle (disabled for withholding) */}
                  <InclusiveToggle
                    $active={!!tax.inclusive && !isWithholding}
                    disabled={isWithholding}
                    onClick={() => updateTax(i, { inclusive: !tax.inclusive })}
                    title={
                      isWithholding
                        ? "Inclusive has no effect on withholding taxes"
                        : tax.inclusive
                          ? "Tax is inclusive — click to make exclusive"
                          : "Tax is exclusive — click to make inclusive"
                    }
                  >
                    {tax.inclusive && !isWithholding ? (
                      <ToggleRightIcon size={18} weight="fill" />
                    ) : (
                      <ToggleLeftIcon size={18} />
                    )}
                  </InclusiveToggle>

                  {/* Delete */}
                  <DeleteTaxBtn
                    onClick={() => removeTax(i)}
                    title="Remove this tax"
                  >
                    <TrashIcon size={13} />
                  </DeleteTaxBtn>
                </TaxRow>
              );
            })}
          </TaxTable>
        )}

        {/* datalist for type suggestions */}
        <datalist id="tax-type-suggestions">
          {TAX_TYPES.map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>

        <AddTaxRow>
          <AddTaxButton onClick={addCustomTax}>
            <PlusIcon size={11} weight="bold" />
            Add tax
          </AddTaxButton>

          {!hasWithholding && (
            <WithholdingQuickAdd onClick={addWithholding}>
              <PlusIcon size={11} weight="bold" />+ EWT (withholding)
            </WithholdingQuickAdd>
          )}
        </AddTaxRow>

        {/* Summary of configured taxes */}
        {localTaxes.length > 0 && (
          <div
            style={{
              fontSize: "10px",
              color: "var(--color-text-secondary, #888)",
              marginTop: "4px",
              lineHeight: 1.6,
            }}
          >
            {localTaxes.map((t, i) => {
              const behaviour = t.behaviour ?? "additive";
              return (
                <span key={i}>
                  {i > 0 && " · "}
                  <strong>{t.taxType}</strong>{" "}
                  {((t.rate ?? 0) * 100).toFixed(1)}%
                  {behaviour === "withholding" && " (withheld)"}
                  {t.inclusive && " (incl.)"}
                </span>
              );
            })}
          </div>
        )}
      </Section>

      {error && (
        <div
          style={{
            fontSize: 11,
            color: "var(--color-error, #ef4444)",
            padding: "6px 10px",
            borderRadius: 4,
            background: "rgba(239,68,68,0.08)",
          }}
        >
          {error}
        </div>
      )}
    </Wrapper>
  );
};
