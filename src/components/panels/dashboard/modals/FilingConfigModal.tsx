/**
 * @file FilingConfigModal.tsx
 *
 * Modal that collects BIR filing configuration before PDF export.
 * Shown only when dateMode === "filing" and a specific return type is selected.
 *
 * Renders adapter-specific fields based on the selected birReturnType:
 *   income_quarterly  → quarter info, deduction method, GPP/other income, spouse
 *   income_annual     → deduction method, other income, GPP, payment mode, spouse
 *   vat_quarterly     → VAT withheld (gov payments)
 *   vat_monthly       → VAT withheld (gov payments)
 *   percentage_quarterly → transaction rows, CWT withheld
 *   withholding       → (not yet implemented)
 *
 * The modal does NOT run computation — it only collects config.
 * The caller receives a FilingExportConfig and runs computeTax() itself.
 */

import React, { useCallback, useEffect, useState } from "react";
import styled from "styled-components";
import {
  CaretDownIcon,
  InfoIcon,
  PlusIcon,
  TrashIcon,
} from "@phosphor-icons/react";
import type { BIRReturnType } from "@/SDK/bir-tax-period";
import type {
  Form1701QAdapterConfig,
  Form1701QSpouseData,
} from "@/SDK/majik-buwiz-client/src/core/accounting/adapters/forms/form-1701q";
import type { Form1701AAdapterConfig } from "@/SDK/majik-buwiz-client/src/core/accounting/adapters/forms/form-1701a";
import type {
  Form2550MAdapterConfig,
  VATWithheldConfig,
} from "@/SDK/majik-buwiz-client/src/core/accounting/adapters/forms/form-2550m";
import type { Form2550QAdapterConfig } from "@/SDK/majik-buwiz-client/src/core/accounting/adapters/forms/form-2550q";
import type {
  Form2551QAdapterConfig,
  PercentageTaxTransactionRow,
} from "@/SDK/majik-buwiz-client/src/core/accounting/adapters/forms/form-2551q";
import DynamicPopUp from "@/components/functional/DynamicPopUp";
import DynamicAlertBanner from "@/components/foundations/DynamicAlertBanner";

// ---------------------------------------------------------------------------
// Exported config shape — what this modal produces
// ---------------------------------------------------------------------------

export interface FilingExportConfig {
  birReturnType: BIRReturnType;
  /** Config for whichever adapter matches birReturnType */
  adapterConfig:
    | Partial<Form1701QAdapterConfig>
    | Partial<Form1701AAdapterConfig>
    | Partial<Form2550MAdapterConfig>
    | Partial<Form2550QAdapterConfig>
    | Partial<Form2551QAdapterConfig>;
  /** Spouse data — only for income_quarterly / income_annual */
  spouseData?: Form1701QSpouseData;
  /** Whether this is an amended return */
  isAmended: boolean;
}

interface FilingConfigModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  birReturnType: BIRReturnType;
  /** Current quarter derived from activePreset — shown as read-only context */
  periodLabel: string;
  onConfirm: (config: FilingExportConfig) => void;
}

// ---------------------------------------------------------------------------
// Styled components
// ---------------------------------------------------------------------------

const Section = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 0;
`;

const SectionTitle = styled.div`
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.55;
  padding-bottom: 6px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.primary}14;
`;

const Field = styled.div`
  display: flex;
  flex-direction: column;
  gap: 5px;
`;

const FieldRow = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
`;

const Label = styled.label`
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textSecondary};
  display: flex;
  align-items: center;
  gap: 5px;
`;

const HintIcon = styled.span`
  opacity: 0.45;
  cursor: default;
  display: inline-flex;
  align-items: center;
  position: relative;

  &:hover .hint-bubble {
    opacity: 1;
    pointer-events: auto;
  }
`;

const HintBubble = styled.span`
  position: absolute;
  top: calc(100% + 6px);
  left: 50%;
  transform: translateX(-50%);
  background: ${({ theme }) => theme.colors.primaryBackground};
  border: 1px solid ${({ theme }) => theme.colors.primary}28;
  border-radius: ${({ theme }) => theme.borders.radius.small};
  padding: 7px 10px;
  font-size: 10px;
  line-height: 1.5;
  color: ${({ theme }) => theme.colors.textPrimary};
  width: 200px;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15);
  opacity: 0;
  transition: opacity 0.14s;
  z-index: 300;
  pointer-events: none;
`;

const Input = styled.input`
  font-size: 12px;
  padding: 8px 10px;
  border-radius: ${({ theme }) => theme.borders.radius.small};
  border: 1px solid ${({ theme }) => theme.colors.primary}28;
  background: ${({ theme }) => theme.colors.primaryBackground};
  color: ${({ theme }) => theme.colors.textPrimary};
  outline: none;
  width: 100%;
  box-sizing: border-box;

  &:focus {
    border-color: ${({ theme }) => theme.colors.primary};
  }

  &[type="number"] {
    font-family: "Fira Mono", "JetBrains Mono", monospace;
  }
`;

const Select = styled.select`
  font-size: 12px;
  padding: 8px 10px;
  border-radius: ${({ theme }) => theme.borders.radius.small};
  border: 1px solid ${({ theme }) => theme.colors.primary}28;
  background: ${({ theme }) => theme.colors.primaryBackground};
  color: ${({ theme }) => theme.colors.textPrimary};
  outline: none;
  width: 100%;
  cursor: pointer;

  &:focus {
    border-color: ${({ theme }) => theme.colors.primary};
  }
`;

const CheckRow = styled.label`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textPrimary};
  cursor: pointer;
  user-select: none;
`;

const Checkbox = styled.input`
  width: 14px;
  height: 14px;
  cursor: pointer;
  accent-color: ${({ theme }) => theme.colors.primary};
`;

const Divider = styled.div`
  border-bottom: 1px solid ${({ theme }) => theme.colors.primary}14;
  margin: 4px 0;
`;

const PeriodBadge = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 10px;
  border-radius: ${({ theme }) => theme.borders.radius.small};
  background: ${({ theme }) => theme.colors.primarySoft};
  border: 1px solid ${({ theme }) => theme.colors.primary}22;
  font-size: 11px;
  font-family: "Fira Mono", "JetBrains Mono", monospace;
  color: ${({ theme }) => theme.colors.textSecondary};
  margin-bottom: 4px;
`;

const AddBtn = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  padding: 5px 10px;
  border-radius: ${({ theme }) => theme.borders.radius.small};
  border: 1px dashed ${({ theme }) => theme.colors.primary}44;
  background: transparent;
  color: ${({ theme }) => theme.colors.primary};
  cursor: pointer;
  transition: all 0.13s;

  &:hover {
    background: ${({ theme }) => theme.colors.primarySoft};
  }
`;

const RemoveBtn = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  background: transparent;
  color: ${({ theme }) => theme.colors.textSecondary};
  cursor: pointer;
  opacity: 0.5;
  border-radius: ${({ theme }) => theme.borders.radius.small};
  transition: all 0.12s;
  flex-shrink: 0;

  &:hover {
    opacity: 1;
    background: rgba(199, 78, 78, 0.1);
    color: #c74e4e;
  }
`;

const RowGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const TransactionRowWrap = styled.div`
  display: grid;
  grid-template-columns: 1fr 80px 80px 24px;
  gap: 6px;
  align-items: end;
`;

const CollapseToggle = styled.button<{ $open: boolean }>`
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  text-align: left;
  background: transparent;
  border: none;
  padding: 0;
  cursor: pointer;
  color: ${({ theme }) => theme.colors.textSecondary};
  font-size: 11px;

  svg {
    transition: transform 0.15s;
    transform: rotate(${({ $open }) => ($open ? "180deg" : "0deg")});
  }
`;

// ---------------------------------------------------------------------------
// Sub-forms
// ---------------------------------------------------------------------------

interface NumberFieldProps {
  label: string;
  hint?: string;
  value: number;
  onChange: (v: number) => void;
  placeholder?: string;
}

const NumberField: React.FC<NumberFieldProps> = ({
  label,
  hint,
  value,
  onChange,
  placeholder = "0.00",
}) => (
  <Field>
    <Label>
      {label}
      {hint && (
        <HintIcon>
          <InfoIcon size={12} />
          <HintBubble className="hint-bubble">{hint}</HintBubble>
        </HintIcon>
      )}
    </Label>
    <Input
      type="number"
      min={0}
      step="0.01"
      placeholder={placeholder}
      value={value || ""}
      onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
    />
  </Field>
);

// ---------------------------------------------------------------------------
// Income quarterly config
// ---------------------------------------------------------------------------

interface IncomeQuarterlyFormProps {
  config: Partial<Form1701QAdapterConfig>;
  spouseData: Partial<Form1701QSpouseData> | null;
  onChange: (c: Partial<Form1701QAdapterConfig>) => void;
  onSpouseChange: (s: Partial<Form1701QSpouseData> | null) => void;
}

const IncomeQuarterlyForm: React.FC<IncomeQuarterlyFormProps> = ({
  config,
  spouseData,
  onChange,
  onSpouseChange,
}) => {
  const [showSpouse, setShowSpouse] = useState(!!spouseData);

  const set = <K extends keyof Form1701QAdapterConfig>(
    k: K,
    v: Form1701QAdapterConfig[K],
  ) => onChange({ ...config, [k]: v });

  return (
    <Section>
      <SectionTitle>Income & Deductions</SectionTitle>

      <FieldRow>
        <NumberField
          label="GPP Income (Item 27)"
          hint="Your share of income from a General Professional Partnership."
          value={config.gppIncome ?? 0}
          onChange={(v) => set("gppIncome", v)}
        />
        <NumberField
          label="Other Income (Item 31)"
          hint="Non-operating income not in invoices — interest, rental, etc."
          value={config.otherIncome ?? 0}
          onChange={(v) => set("otherIncome", v)}
        />
      </FieldRow>

      <Field>
        <Label>Business Type</Label>
        <Select
          value={config.businessType ?? "services"}
          onChange={(e) =>
            set(
              "businessType",
              e.target.value as Form1701QAdapterConfig["businessType"],
            )
          }
        >
          <option value="services">Services (1% representation cap)</option>
          <option value="goods">Goods (0.5% representation cap)</option>
          <option value="mixed">Mixed (0.75% cap)</option>
        </Select>
      </Field>

      <CheckRow>
        <Checkbox
          type="checkbox"
          checked={config.hasCompensationIncome ?? false}
          onChange={(e) => set("hasCompensationIncome", e.target.checked)}
        />
        Has compensation income (affects 8% flat rate ₱250K exemption)
      </CheckRow>

      <Divider />
      <SectionTitle>Amended Return</SectionTitle>

      <CheckRow>
        <Checkbox
          type="checkbox"
          checked={config.isAmended ?? false}
          onChange={(e) => set("isAmended", e.target.checked)}
        />
        This is an amended return
      </CheckRow>

      {config.isAmended && (
        <NumberField
          label="Tax Paid on Previously Filed Return (Item 38I)"
          hint="Amount paid on the original return being amended."
          value={config.taxPaidAmended ?? 0}
          onChange={(v) => set("taxPaidAmended", v)}
        />
      )}

      <Divider />

      <CollapseToggle
        $open={showSpouse}
        onClick={() => {
          setShowSpouse((v) => !v);
          if (showSpouse) onSpouseChange(null);
        }}
      >
        <CaretDownIcon size={12} />
        Spouse Column (Column B) — optional
      </CollapseToggle>

      {showSpouse && (
        <RowGroup>
          <FieldRow>
            <NumberField
              label="Spouse Gross Revenues"
              value={spouseData?.grossRevenues ?? 0}
              onChange={(v) =>
                onSpouseChange({ ...(spouseData ?? {}), grossRevenues: v })
              }
            />
            <NumberField
              label="Spouse Deductions"
              value={spouseData?.deductions ?? 0}
              onChange={(v) =>
                onSpouseChange({ ...(spouseData ?? {}), deductions: v })
              }
            />
          </FieldRow>
          <FieldRow>
            <NumberField
              label="Spouse Other Income"
              value={spouseData?.otherIncome ?? 0}
              onChange={(v) =>
                onSpouseChange({ ...(spouseData ?? {}), otherIncome: v })
              }
            />
            <NumberField
              label="Spouse Cost of Sales"
              value={spouseData?.costOfSales ?? 0}
              onChange={(v) =>
                onSpouseChange({ ...(spouseData ?? {}), costOfSales: v })
              }
            />
          </FieldRow>
          <FieldRow>
            <NumberField
              label="Spouse CWT This Quarter"
              value={spouseData?.cwtThisQuarter ?? 0}
              onChange={(v) =>
                onSpouseChange({ ...(spouseData ?? {}), cwtThisQuarter: v })
              }
            />
            <NumberField
              label="Spouse Prior Year Excess Credits"
              value={spouseData?.priorYearExcessCredits ?? 0}
              onChange={(v) =>
                onSpouseChange({
                  ...(spouseData ?? {}),
                  priorYearExcessCredits: v,
                })
              }
            />
          </FieldRow>
        </RowGroup>
      )}
    </Section>
  );
};

// ---------------------------------------------------------------------------
// Annual income config
// ---------------------------------------------------------------------------

interface IncomeAnnualFormProps {
  config: Partial<Form1701AAdapterConfig>;
  spouseData: Partial<Form1701QSpouseData> | null;
  onChange: (c: Partial<Form1701AAdapterConfig>) => void;
  onSpouseChange: (s: Partial<Form1701QSpouseData> | null) => void;
}

const IncomeAnnualForm: React.FC<IncomeAnnualFormProps> = ({
  config,
  spouseData,
  onChange,
  onSpouseChange,
}) => {
  const [showSpouse, setShowSpouse] = useState(!!spouseData);

  const set = <K extends keyof Form1701AAdapterConfig>(
    k: K,
    v: Form1701AAdapterConfig[K],
  ) => onChange({ ...config, [k]: v });

  return (
    <Section>
      <SectionTitle>Annual Income</SectionTitle>

      <FieldRow>
        <NumberField
          label="Other Income (Items 41-42)"
          hint="Annual interest, dividends, rental from personal assets, etc."
          value={config.otherIncome ?? 0}
          onChange={(v) => set("otherIncome", v)}
        />
        <NumberField
          label="GPP Income (Item 43)"
          hint="Full-year income from a General Professional Partnership."
          value={config.gppIncome ?? 0}
          onChange={(v) => set("gppIncome", v)}
        />
      </FieldRow>

      <FieldRow>
        <NumberField
          label="Foreign Tax Credits (Item 62)"
          hint="Taxes paid to foreign governments on foreign-sourced income."
          value={config.foreignTaxCredits ?? 0}
          onChange={(v) => set("foreignTaxCredits", v)}
        />
        <NumberField
          label="Other Tax Credits (Item 63)"
          value={config.otherTaxCredits ?? 0}
          onChange={(v) => set("otherTaxCredits", v)}
        />
      </FieldRow>

      <FieldRow>
        <Field>
          <Label>Deduction Method</Label>
          <Select
            value={config.deductionMethodOverride ?? "osd"}
            onChange={(e) =>
              set(
                "deductionMethodOverride",
                e.target.value as "osd" | "itemized",
              )
            }
          >
            <option value="osd">OSD — Optional Standard Deduction (40%)</option>
          </Select>
        </Field>
        <Field>
          <Label>Payment Mode</Label>
          <Select
            value={config.paymentMode ?? "installment"}
            onChange={(e) =>
              set("paymentMode", e.target.value as "installment" | "full")
            }
          >
            <option value="installment">Installment (50/50 split)</option>
            <option value="full">Full payment</option>
          </Select>
        </Field>
      </FieldRow>

      <Field>
        <Label>Business Type</Label>
        <Select
          value={config.businessType ?? "services"}
          onChange={(e) =>
            set(
              "businessType",
              e.target.value as Form1701AAdapterConfig["businessType"],
            )
          }
        >
          <option value="services">Services (1% representation cap)</option>
          <option value="goods">Goods (0.5% representation cap)</option>
          <option value="mixed">Mixed (0.75% cap)</option>
        </Select>
      </Field>

      <CheckRow>
        <Checkbox
          type="checkbox"
          checked={config.hasCompensationIncome ?? false}
          onChange={(e) => set("hasCompensationIncome", e.target.checked)}
        />
        Has compensation income
      </CheckRow>

      <Divider />
      <SectionTitle>Amended Return</SectionTitle>

      <CheckRow>
        <Checkbox
          type="checkbox"
          checked={config.isAmended ?? false}
          onChange={(e) => set("isAmended", e.target.checked)}
        />
        This is an amended return
      </CheckRow>

      {config.isAmended && (
        <NumberField
          label="Tax Paid in Previously Filed Return (Item 61)"
          value={config.taxPaidAmended ?? 0}
          onChange={(v) => set("taxPaidAmended", v)}
        />
      )}

      <Divider />

      <CollapseToggle
        $open={showSpouse}
        onClick={() => {
          setShowSpouse((v) => !v);
          if (showSpouse) onSpouseChange(null);
        }}
      >
        <CaretDownIcon size={12} />
        Spouse Column — optional
      </CollapseToggle>

      {showSpouse && (
        <RowGroup>
          <FieldRow>
            <NumberField
              label="Spouse Gross Revenues"
              value={spouseData?.grossRevenues ?? 0}
              onChange={(v) =>
                onSpouseChange({ ...(spouseData ?? {}), grossRevenues: v })
              }
            />
            <NumberField
              label="Spouse Other Income"
              value={spouseData?.otherIncome ?? 0}
              onChange={(v) =>
                onSpouseChange({ ...(spouseData ?? {}), otherIncome: v })
              }
            />
          </FieldRow>
        </RowGroup>
      )}
    </Section>
  );
};

// ---------------------------------------------------------------------------
// VAT config (shared by monthly + quarterly)
// ---------------------------------------------------------------------------

interface VATFormProps {
  config: VATWithheldConfig;
  isAmended: boolean;
  taxPaidAmended: number;
  onChange: (c: VATWithheldConfig) => void;
  onAmendedChange: (v: boolean) => void;
  onTaxPaidAmendedChange: (v: number) => void;
}

const VATForm: React.FC<VATFormProps> = ({
  config,
  isAmended,
  taxPaidAmended,
  onChange,
  onAmendedChange,
  onTaxPaidAmendedChange,
}) => (
  <Section>
    <SectionTitle>Government Money Payments</SectionTitle>

    <FieldRow>
      <NumberField
        label="VAT Withheld — Goods"
        hint="VAT withheld by government entities on sale of goods (Form 2306)."
        value={config.vatWithheldOnGoods ?? 0}
        onChange={(v) => onChange({ ...config, vatWithheldOnGoods: v })}
      />
      <NumberField
        label="VAT Withheld — Services"
        hint="VAT withheld by government entities on sale of services."
        value={config.vatWithheldOnServices ?? 0}
        onChange={(v) => onChange({ ...config, vatWithheldOnServices: v })}
      />
    </FieldRow>

    <Divider />
    <SectionTitle>Amended Return</SectionTitle>

    <CheckRow>
      <Checkbox
        type="checkbox"
        checked={isAmended}
        onChange={(e) => onAmendedChange(e.target.checked)}
      />
      This is an amended return
    </CheckRow>

    {isAmended && (
      <NumberField
        label="VAT Paid on Previously Filed Return"
        value={taxPaidAmended}
        onChange={onTaxPaidAmendedChange}
      />
    )}
  </Section>
);

// ---------------------------------------------------------------------------
// Percentage tax config
// ---------------------------------------------------------------------------

interface PercentageFormProps {
  config: Partial<Form2551QAdapterConfig>;
  onChange: (c: Partial<Form2551QAdapterConfig>) => void;
}

const PercentageForm: React.FC<PercentageFormProps> = ({
  config,
  onChange,
}) => {
  const rows: PercentageTaxTransactionRow[] = config.transactionRows ?? [];

  const addRow = () =>
    onChange({
      ...config,
      transactionRows: [
        ...rows,
        { classification: "", atcCode: "OPT", taxableAmount: 0 },
      ],
    });

  const updateRow = (
    i: number,
    field: keyof PercentageTaxTransactionRow,
    value: string | number,
  ) => {
    const next = rows.map((r, idx) =>
      idx === i ? { ...r, [field]: value } : r,
    );
    onChange({ ...config, transactionRows: next });
  };

  const removeRow = (i: number) =>
    onChange({
      ...config,
      transactionRows: rows.filter((_, idx) => idx !== i),
    });

  return (
    <Section>
      <SectionTitle>Transaction Rows (Part II — Items 14-18)</SectionTitle>

      <RowGroup>
        {rows.map((row, i) => (
          <TransactionRowWrap key={i}>
            <Field>
              <Label>Classification</Label>
              <Input
                type="text"
                placeholder="e.g. Professional Services"
                value={row.classification}
                onChange={(e) => updateRow(i, "classification", e.target.value)}
              />
            </Field>
            <Field>
              <Label>ATC Code</Label>
              <Input
                type="text"
                placeholder="OPT"
                value={row.atcCode}
                onChange={(e) => updateRow(i, "atcCode", e.target.value)}
              />
            </Field>
            <Field>
              <Label>Taxable Amt</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                placeholder="0.00"
                value={row.taxableAmount || ""}
                onChange={(e) =>
                  updateRow(i, "taxableAmount", parseFloat(e.target.value) || 0)
                }
              />
            </Field>
            <RemoveBtn type="button" onClick={() => removeRow(i)}>
              <TrashIcon size={12} />
            </RemoveBtn>
          </TransactionRowWrap>
        ))}

        {rows.length < 5 && (
          <AddBtn type="button" onClick={addRow}>
            <PlusIcon size={12} />
            Add transaction row
          </AddBtn>
        )}
      </RowGroup>

      <Divider />
      <SectionTitle>Credits</SectionTitle>

      <NumberField
        label="CWT Withheld (Item 20A)"
        hint="Creditable percentage tax withheld per BIR Form 2307."
        value={config.cwtWithheld ?? 0}
        onChange={(v) => onChange({ ...config, cwtWithheld: v })}
      />

      <Divider />
      <SectionTitle>Amended Return</SectionTitle>

      <CheckRow>
        <Checkbox
          type="checkbox"
          checked={config.isAmended ?? false}
          onChange={(e) => onChange({ ...config, isAmended: e.target.checked })}
        />
        This is an amended return
      </CheckRow>

      {config.isAmended && (
        <NumberField
          label="Tax Paid on Previously Filed Return (Item 20B)"
          value={config.taxPaidAmended ?? 0}
          onChange={(v) => onChange({ ...config, taxPaidAmended: v })}
        />
      )}
    </Section>
  );
};

// ---------------------------------------------------------------------------
// Main modal
// ---------------------------------------------------------------------------

const RETURN_TYPE_LABELS: Record<BIRReturnType, string> = {
  income_quarterly: "Quarterly Income Tax — Form 1701Q",
  income_annual: "Annual Income Tax — Form 1701A",
  vat_quarterly: "Quarterly VAT — Form 2550Q",
  vat_monthly: "Monthly VAT — Form 2550M",
  percentage_quarterly: "Quarterly Percentage Tax — Form 2551Q",
  withholding: "Quarterly Withholding — Form 1601-EQ",
};

export const FilingConfigModal: React.FC<FilingConfigModalProps> = ({
  open,
  onOpenChange,
  birReturnType,
  periodLabel,
  onConfirm,
}) => {
  // Per-adapter config state
  const [qConfig, setQConfig] = useState<Partial<Form1701QAdapterConfig>>({
    businessType: "services",
    hasCompensationIncome: false,
    isAmended: false,
  });
  const [aConfig, setAConfig] = useState<Partial<Form1701AAdapterConfig>>({
    deductionMethodOverride: "osd",
    paymentMode: "installment",
    businessType: "services",
    hasCompensationIncome: false,
    isAmended: false,
  });
  const [vatWithheld, setVatWithheld] = useState<VATWithheldConfig>({
    vatWithheldOnGoods: 0,
    vatWithheldOnServices: 0,
  });
  const [vatAmended, setVatAmended] = useState(false);
  const [vatTaxPaidAmended, setVatTaxPaidAmended] = useState(0);
  const [ptConfig, setPtConfig] = useState<Partial<Form2551QAdapterConfig>>({
    isAmended: false,
  });
  const [spouseData, setSpouseData] =
    useState<Partial<Form1701QSpouseData> | null>(null);

  // Reset state when birReturnType changes
  useEffect(() => {
    setSpouseData(null);
    setVatAmended(false);
    setVatTaxPaidAmended(0);
  }, [birReturnType]);

  const handleConfirm = useCallback(() => {
    let adapterConfig:
      | Partial<Form1701QAdapterConfig>
      | Partial<Form1701AAdapterConfig>
      | Partial<Form2550MAdapterConfig>
      | Partial<Form2550QAdapterConfig>
      | Partial<Form2551QAdapterConfig>;

    let isAmended = false;

    switch (birReturnType) {
      case "income_quarterly":
        adapterConfig = {
          ...qConfig,
          spouseData: spouseData as Form1701QSpouseData | undefined,
        };
        isAmended = qConfig.isAmended ?? false;
        break;
      case "income_annual":
        adapterConfig = aConfig;
        isAmended = aConfig.isAmended ?? false;
        break;
      case "vat_monthly":
        adapterConfig = {
          vatWithheld,
          isAmended: vatAmended,
          taxPaidAmended: vatTaxPaidAmended,
        } satisfies Partial<Form2550MAdapterConfig>;
        isAmended = vatAmended;
        break;
      case "vat_quarterly":
        adapterConfig = {
          vatWithheld,
          isAmended: vatAmended,
          taxPaidAmended: vatTaxPaidAmended,
        } satisfies Partial<Form2550QAdapterConfig>;
        isAmended = vatAmended;
        break;
      case "percentage_quarterly":
        adapterConfig = ptConfig;
        isAmended = ptConfig.isAmended ?? false;
        break;
      default:
        adapterConfig = {};
    }

    onConfirm({
      birReturnType,
      adapterConfig,
      spouseData: (spouseData as Form1701QSpouseData) ?? undefined,
      isAmended,
    });

    onOpenChange(false);
  }, [
    birReturnType,
    qConfig,
    aConfig,
    vatWithheld,
    vatAmended,
    vatTaxPaidAmended,
    ptConfig,
    spouseData,
    onConfirm,
    onOpenChange,
  ]);

  const renderForm = () => {
    switch (birReturnType) {
      case "income_quarterly":
        return (
          <IncomeQuarterlyForm
            config={qConfig}
            spouseData={spouseData}
            onChange={setQConfig}
            onSpouseChange={setSpouseData}
          />
        );
      case "income_annual":
        return (
          <IncomeAnnualForm
            config={aConfig}
            spouseData={spouseData}
            onChange={setAConfig}
            onSpouseChange={setSpouseData}
          />
        );
      case "vat_monthly":
      case "vat_quarterly":
        return (
          <VATForm
            config={vatWithheld}
            isAmended={vatAmended}
            taxPaidAmended={vatTaxPaidAmended}
            onChange={setVatWithheld}
            onAmendedChange={setVatAmended}
            onTaxPaidAmendedChange={setVatTaxPaidAmended}
          />
        );
      case "percentage_quarterly":
        return <PercentageForm config={ptConfig} onChange={setPtConfig} />;
      default:
        return (
          <Section>
            <DynamicAlertBanner
              title="Form Not Yet Supported"
              description="This BIR form is not yet supported for PDF export."
              level="error"
            />
          </Section>
        );
    }
  };

  return (
    <DynamicPopUp
      scrollable
      isOpen={open}
      onOpenChange={onOpenChange}
      modal={{
        title: "BIR Filing Configuration",
        description: `Configure the details for ${RETURN_TYPE_LABELS[birReturnType] ?? birReturnType}.`,
      }}
      buttons={{
        cancel: { text: "Cancel" },
        confirm: {
          text: "Generate & Export PDF",
          onClick: handleConfirm,
          isDisabled: birReturnType === "withholding",
        },
      }}
    >
      <DynamicAlertBanner
        level="warning"
        title="Experimental Tax Filing & Computation Feature"
        description="This filing generator and tax computation module is currently experimental and should only be used as a drafting or estimation tool. Generated values, tax mappings, calculations, and BIR form outputs may contain inaccuracies, omissions, or outdated interpretations of Philippine tax regulations. Always review and verify all generated data, computations, attachments, and filing requirements with a licensed CPA, accountant, or qualified tax/legal professional before submission to the BIR. The user remains fully responsible for validating compliance, accuracy, and final filed amounts."
      />
      <PeriodBadge>Period: {periodLabel.toUpperCase()}</PeriodBadge>
      {renderForm()}
    </DynamicPopUp>
  );
};

export default FilingConfigModal;
