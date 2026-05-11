// components/InvoiceSettings.tsx

import React, { useEffect, useState } from "react";
import styled from "styled-components";
import {
  CurrencyDollarIcon,
  ReceiptIcon,
  UserIcon,
  HashIcon,
  PlusIcon,
  TrashIcon,
  ToggleLeftIcon,
  ToggleRightIcon,
} from "@phosphor-icons/react";
import type { MajikBuwizClient } from "@/SDK/majik-buwiz-client/src";
import type { InvoiceDefaults } from "@/SDK/majik-buwiz-client/src/core/storage/client-state/_types";
import type { TaxDetail } from "@majikah/majik-invoice";
import { PaymentTermsPicker } from "@/components/functional/MajikInvoiceDocument/PaymentTermsPicker";
import ConfirmationButton from "@/components/foundations/ConfirmationButton";

// ── Styled ────────────────────────────────────────────────────────────────

const Panel = styled.div`
  width: 100%;
  height: fit-content;
  background: inherit;
  display: flex;
  flex-direction: column;
`;

const PanelBody = styled.div`
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 2rem;
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

const FieldRow = styled.div`
  display: grid;
  grid-template-columns: 140px 1fr;
  align-items: center;
  gap: 12px;
`;

const FieldColumn = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
`;

const FieldLabel = styled.label`
  font-size: 11px;
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  color: ${({ theme }) => theme.colors.textSecondary};
`;

const Input = styled.input`
  font-family: ${({ theme }) => theme.typography.fonts.regular};
  font-size: 12px;
  padding: 6px 10px;
  border-radius: ${({ theme }) => theme.borders.radius.small};
  border: 1px solid ${({ theme }) => theme.colors.primary}33;
  background: ${({ theme }) => theme.colors.secondaryBackground};
  color: ${({ theme }) => theme.colors.textPrimary};
  width: 100%;

  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.primary}88;
  }
`;

const Select = styled.select`
  font-family: ${({ theme }) => theme.typography.fonts.regular};
  font-size: 12px;
  padding: 6px 10px;
  border-radius: ${({ theme }) => theme.borders.radius.small};
  border: 1px solid ${({ theme }) => theme.colors.primary}33;
  background: ${({ theme }) => theme.colors.secondaryBackground};
  color: ${({ theme }) => theme.colors.textPrimary};
  width: 100%;
  cursor: pointer;

  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.primary}88;
  }
`;

const Textarea = styled.textarea`
  font-family: ${({ theme }) => theme.typography.fonts.regular};
  font-size: 12px;
  padding: 8px 10px;
  border-radius: ${({ theme }) => theme.borders.radius.small};
  border: 1px solid ${({ theme }) => theme.colors.primary}33;
  background: ${({ theme }) => theme.colors.secondaryBackground};
  color: ${({ theme }) => theme.colors.textPrimary};
  width: 100%;
  min-height: 64px;
  resize: vertical;

  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.primary}88;
  }
`;

const InvoiceNumberPreview = styled.div`
  font-family: ${({ theme }) => theme.typography.fonts.numbers};
  font-size: 11px;
  padding: 5px 10px;
  border-radius: ${({ theme }) => theme.borders.radius.small};
  background: ${({ theme }) => theme.colors.primarySoft};
  color: ${({ theme }) => theme.colors.primary};
  margin-top: 2px;
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

const COMMON_CURRENCIES = ["PHP", "USD", "EUR", "GBP", "SGD", "JPY", "AUD"];
const TAX_TYPES = ["VAT", "GST", "EWT", "WHT", "SALES_TAX", "EXCISE", "NONE"];

const FALLBACK_DEFAULTS: InvoiceDefaults = {
  currency: "PHP",
  defaultTaxes: [{ rate: 0.12, taxType: "VAT", jurisdiction: "PH" }],
  paymentTerms: "net30",
  invoiceNumberPrefix: "INV-",
  invoiceNumberCounter: 1,
};

const BEHAVIOUR_OPTIONS: { value: string; label: string }[] = [
  { value: "additive", label: "Additive" },
  { value: "withholding", label: "Withholding" },
  { value: "informational", label: "Info only" },
];

// ── Component ─────────────────────────────────────────────────────────────

interface InvoiceSettingsProps {
  majik: MajikBuwizClient;
  onClose: () => void;
  onChange?: (defaults: InvoiceDefaults) => void;
}

export const InvoiceSettings: React.FC<InvoiceSettingsProps> = ({
  majik,
  onChange,
}) => {
  const [form, setForm] = useState<InvoiceDefaults>(FALLBACK_DEFAULTS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    majik.getInvoiceDefaults().then((saved) => {
      if (saved) setForm({ ...FALLBACK_DEFAULTS, ...saved });
      setLoading(false);
    });
  }, [majik]);

  const emitChange = (next: InvoiceDefaults) => {
    onChange?.(next);
  };

  const setField = <K extends keyof InvoiceDefaults>(
    key: K,
    value: InvoiceDefaults[K],
  ) => {
    setForm((prev) => {
      const updated = { ...prev, [key]: value };
      queueMicrotask(() => emitChange(updated));
      return updated;
    });
  };

  const setIssuerField = (key: string, value: string) => {
    setForm((prev) => {
      const updated = {
        ...prev,
        issuer: { ...(prev.issuer ?? {}), [key]: value },
      };
      queueMicrotask(() => emitChange(updated));
      return updated;
    });
  };

  // ── Tax Manager operations ─────────────────────────────────────────────

  const taxes = form.defaultTaxes ?? [];

  const updateTax = (index: number, patch: Partial<TaxDetail>) => {
    const next = taxes.map((t, i) => (i === index ? { ...t, ...patch } : t));
    setField("defaultTaxes", next);
  };

  const removeTax = (index: number) => {
    setField(
      "defaultTaxes",
      taxes.filter((_, i) => i !== index),
    );
  };

  const addWithholding = () => {
    // Don't add duplicate EWT
    if (taxes.some((t) => t.behaviour === "withholding")) return;
    setField("defaultTaxes", [
      ...taxes,
      {
        taxType: "EWT",
        rate: 0.05,
        behaviour: "withholding" as const,
        jurisdiction: "PH",
      },
    ]);
  };

  const addCustomTax = () => {
    setField("defaultTaxes", [
      ...taxes,
      { taxType: "TAX", rate: 0.0, behaviour: "additive" as const },
    ]);
  };

  const hasWithholding = taxes.some((t) => t.behaviour === "withholding");

  // ── Derived ────────────────────────────────────────────────────────────

  const invoiceNumberPreview = `${form.invoiceNumberPrefix ?? "INV-"}${String(
    form.invoiceNumberCounter ?? 1,
  ).padStart(3, "0")}`;

  const handleReset = async () => {
    setForm(FALLBACK_DEFAULTS);
    queueMicrotask(() => emitChange(FALLBACK_DEFAULTS));
    await majik.removeInvoiceDefaults();
  };

  if (loading) return null;

  return (
    <Panel>
      <PanelBody>
        {/* ── Issuer ── */}
        <Section>
          <SectionLabel>
            <UserIcon size={12} /> Issuer
          </SectionLabel>
          <FieldRow>
            <FieldLabel>Legal Name</FieldLabel>
            <Input
              value={form.issuer?.legalName ?? ""}
              onChange={(e) => setIssuerField("legalName", e.target.value)}
              placeholder="Your company name"
            />
          </FieldRow>
          <FieldRow>
            <FieldLabel>Trade Name</FieldLabel>
            <Input
              value={form.issuer?.tradeName ?? ""}
              onChange={(e) => setIssuerField("tradeName", e.target.value)}
              placeholder="DBA / brand name"
            />
          </FieldRow>
          <FieldRow>
            <FieldLabel>Tagline</FieldLabel>
            <Input
              value={form.tagline ?? ""}
              onChange={(e) => setField("tagline", e.target.value)}
              placeholder="Tagline"
            />
          </FieldRow>
          <FieldRow>
            <FieldLabel>Email</FieldLabel>
            <Input
              type="email"
              value={form.issuer?.email ?? ""}
              onChange={(e) => setIssuerField("email", e.target.value)}
              placeholder="billing@yourcompany.com"
            />
          </FieldRow>
          <FieldRow>
            <FieldLabel>TIN</FieldLabel>
            <Input
              value={form.issuer?.tin ?? ""}
              onChange={(e) => setIssuerField("tin", e.target.value)}
              placeholder="123-456-789-000"
            />
          </FieldRow>
        </Section>

        {/* ── Billing ── */}
        <Section>
          <SectionLabel>
            <CurrencyDollarIcon size={12} /> Billing
          </SectionLabel>
          <FieldRow>
            <FieldLabel>Currency</FieldLabel>
            <Select
              value={form.currency}
              onChange={(e) => setField("currency", e.target.value)}
            >
              {COMMON_CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </FieldRow>
          <FieldColumn>
            <FieldLabel>Payment Terms</FieldLabel>
            <PaymentTermsPicker
              value={form.paymentTerms ?? "immediate"}
              onChange={(e) => setField("paymentTerms", e)}
              readonly={false}
            />
          </FieldColumn>
          <FieldRow>
            <FieldLabel>Default Notes</FieldLabel>
            <Textarea
              value={form.notes ?? ""}
              onChange={(e) => setField("notes", e.target.value || undefined)}
              placeholder="Payment instructions, bank details…"
            />
          </FieldRow>
        </Section>

        {/* ── Tax Manager ── */}
        <Section>
          <SectionLabel>
            <ReceiptIcon size={12} /> Default Taxes
          </SectionLabel>

          {taxes.length === 0 ? (
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

              {taxes.map((tax, i) => {
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
                      onClick={() =>
                        updateTax(i, { inclusive: !tax.inclusive })
                      }
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
          {taxes.length > 0 && (
            <div
              style={{
                fontSize: "10px",
                color: "var(--color-text-secondary, #888)",
                marginTop: "4px",
                lineHeight: 1.6,
              }}
            >
              {taxes.map((t, i) => {
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

        {/* ── Numbering ── */}
        <Section>
          <SectionLabel>
            <HashIcon size={12} /> Numbering
          </SectionLabel>
          <FieldRow>
            <FieldLabel>Prefix</FieldLabel>
            <Input
              value={form.invoiceNumberPrefix ?? "INV-"}
              onChange={(e) => setField("invoiceNumberPrefix", e.target.value)}
              placeholder="INV-"
            />
          </FieldRow>
          <FieldRow>
            <FieldLabel>Next Number</FieldLabel>
            <Input
              type="number"
              min={1}
              value={form.invoiceNumberCounter ?? 1}
              onChange={(e) =>
                setField("invoiceNumberCounter", parseInt(e.target.value) || 1)
              }
            />
          </FieldRow>
          <InvoiceNumberPreview>
            Preview: {invoiceNumberPreview}
          </InvoiceNumberPreview>
        </Section>

        <ConfirmationButton
          onClick={handleReset}
          text="Reset to Defaults"
          strict
          alertTextTitle="Reset to Defaults"
        />
      </PanelBody>
    </Panel>
  );
};
