/**
 * TaxProfileWizard.tsx
 *
 * Decoupled, reusable wizard for setting up BIR-specific tax profile fields.
 * Covers:
 *   - Entity type & taxpayer classification
 *   - Tax regime (VAT / Percentage Tax / Exempt)
 *   - VAT rate override
 *   - Withholding agent status + EWT rate presets
 *   - RDO code, accounting method, income tax rate election, deduction method
 *   - Auto-configures defaultTaxes in InvoiceDefaults
 *
 * Usage in onboarding gate:
 *   <TaxProfileWizard
 *     majik={majik}
 *     onComplete={(meta, taxes) => { ... }}
 *     onSkip={() => { ... }}
 *   />
 *
 * Usage as standalone settings panel:
 *   <TaxProfileWizard
 *     majik={majik}
 *     compact
 *     onComplete={(meta, taxes) => { ... }}
 *   />
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import styled, { keyframes } from "styled-components";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  BankIcon,
  BuildingsIcon,
  CheckCircleIcon,
  CurrencyCircleDollarIcon,
  FileTextIcon,
  HandCoinsIcon,
  IdentificationBadgeIcon,
  InfoIcon,
  PercentIcon,
  ReceiptIcon,
  ShieldCheckIcon,
  UserIcon,
  WarningIcon,
} from "@phosphor-icons/react";
import type {
  MajikBuwizClient,
  TaxpayerCategory,
  TaxpayerType,
  VATType,
} from "@/SDK/majik-buwiz-client/src";
import type { TaxDetail } from "@majikah/majik-invoice";
import type {
  InvoiceContactBIRProfile,
  InvoiceContactTaxProfile,
  MajikInvoiceContactMeta,
} from "@/SDK/majik-buwiz-client/src/core/party/types";
import CustomFormInput from "@/components/foundations/CustomFormInput";
import { TaxRegime } from "@/SDK/majik-buwiz-client/src/core/accounting/types";

// ─── Animations ───────────────────────────────────────────────────────────────

const slideIn = keyframes`
  from { opacity: 0; transform: translateX(10px); }
  to   { opacity: 1; transform: translateX(0); }
`;

// ─── Layout ───────────────────────────────────────────────────────────────────

const WizardRoot = styled.div<{ $compact?: boolean }>`
  display: flex;
  flex-direction: column;
  gap: ${({ $compact }) => ($compact ? "16px" : "20px")};
  animation: ${slideIn} 0.22s ease both;
`;

const StepPane = styled.div`
  display: flex;
  flex-direction: column;
  gap: 14px;
  animation: ${slideIn} 0.2s ease both;
`;

// ─── Step progress (optional, hidden in compact mode) ────────────────────────

const ProgressBar = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const ProgressTrack = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
`;

const ProgressSegment = styled.div<{ $state: "done" | "active" | "pending" }>`
  flex: 1;
  height: 3px;
  border-radius: 100px;
  transition: all 0.3s ease;
  background: ${({ $state, theme }) =>
    $state === "done"
      ? theme.colors.primary
      : $state === "active"
        ? theme.colors.textPrimary
        : theme.colors.secondaryBackground};
  opacity: ${({ $state }) => ($state === "pending" ? 0.25 : 1)};
`;

const ProgressLabels = styled.div`
  display: flex;
  justify-content: space-between;
`;

const ProgressLabel = styled.span<{ $active: boolean }>`
  font-size: 9px;
  font-weight: ${({ $active }) => ($active ? "700" : "400")};
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: ${({ $active, theme }) =>
    $active ? theme.colors.textPrimary : theme.colors.textSecondary};
  opacity: ${({ $active }) => ($active ? 1 : 0.4)};
  transition: all 0.2s;
  flex: 1;
  text-align: center;
  &:first-child {
    text-align: left;
  }
  &:last-child {
    text-align: right;
  }
`;

// ─── Step header ──────────────────────────────────────────────────────────────

const StepHead = styled.div`
  display: flex;
  flex-direction: column;
  gap: 5px;
`;

const StepIconBadge = styled.div`
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: ${({ theme }) => theme.colors.secondaryBackground};
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${({ theme }) => theme.colors.textSecondary};
  flex-shrink: 0;
  margin-bottom: 4px;
`;

const StepTitle = styled.h4`
  font-size: 14px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textPrimary};
  margin: 0;
  letter-spacing: -0.01em;
`;

const StepSubtitle = styled.p`
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textSecondary};
  margin: 0;
  line-height: 1.55;
  opacity: 0.65;
`;

// ─── Section divider ─────────────────────────────────────────────────────────

const SectionDivider = styled.div`
  height: 1px;
  background: ${({ theme }) => theme.colors.secondaryBackground};
`;

const SectionLabel = styled.div`
  font-size: 9px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.09em;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.4;
  padding: 4px 0 2px;
`;

// ─── Option card grid ─────────────────────────────────────────────────────────

const OptionGrid = styled.div<{ $cols?: number }>`
  display: grid;
  grid-template-columns: ${({ $cols = 2 }) => `repeat(${$cols}, 1fr)`};
  gap: 8px;
`;

const OptionCard = styled.button<{
  $selected: boolean;
  $accent?: string;
  $disabled?: boolean;
}>`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  padding: 12px 12px 10px;
  border-radius: 10px;
  border: 1.5px solid
    ${({ $selected, theme, $accent }) =>
      $selected
        ? $accent || theme.colors.primary
        : theme.colors.secondaryBackground};
  background: ${({ $selected, theme, $accent }) =>
    $selected
      ? `${$accent || theme.colors.primary}10`
      : theme.colors.secondaryBackground};
  cursor: ${({ $disabled }) => ($disabled ? "not-allowed" : "pointer")};
  text-align: left;
  opacity: ${({ $disabled }) => ($disabled ? 0.4 : 1)};
  transition:
    border-color 0.15s,
    background 0.15s,
    opacity 0.15s;

  &:hover:not(:disabled) {
    border-color: ${({ theme, $accent }) =>
      $accent || theme.colors.textSecondary};
  }
`;

const OptionCardIcon = styled.span<{ $selected: boolean; $accent?: string }>`
  color: ${({ $selected, theme, $accent }) =>
    $selected ? $accent || theme.colors.primary : theme.colors.textSecondary};
  transition: color 0.15s;
`;

const OptionCardLabel = styled.span`
  font-size: 12px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textPrimary};
  line-height: 1.2;
`;

const OptionCardDesc = styled.span`
  font-size: 10px;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.6;
  line-height: 1.45;
`;

// ─── Rate input row ───────────────────────────────────────────────────────────

const RateRow = styled.div<{ $selected?: boolean }>`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 10px;

  border: 1px solid
    ${({ $selected, theme }) =>
      $selected ? theme.colors.primary : theme.colors.secondaryBackground};
  color: ${({ $selected, theme }) =>
    $selected ? theme.colors.primary : theme.colors.textSecondary};
  cursor: "pointer";

  &:hover:not(:disabled) {
    border-color: ${({ theme }) => theme.colors.textPrimary};
  }
`;

const RateLabel = styled.span`
  font-size: 11px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textPrimary};
  flex: 1;
`;

const RateInputWrap = styled.div`
  display: flex;
  align-items: center;
  gap: 5px;
`;

const RateInput = styled.input`
  font-size: 13px;
  font-weight: 700;
  font-family: "Fira Mono", "JetBrains Mono", monospace;
  width: 60px;
  padding: 5px 8px;
  border-radius: 7px;
  border: 1.5px solid ${({ theme }) => theme.colors.primary}44;
  background: ${({ theme }) => theme.colors.primaryBackground};
  color: ${({ theme }) => theme.colors.primary};
  text-align: center;

  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.primary};
  }
`;

const RateUnit = styled.span`
  font-size: 12px;

  opacity: 0.6;
`;

// ─── Preset chips ─────────────────────────────────────────────────────────────

const PresetRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-top: 4px;
`;

const PresetChip = styled.button<{ $selected: boolean }>`
  font-size: 10px;
  font-weight: 600;
  padding: 3px 9px;
  border-radius: 20px;
  border: 1px solid
    ${({ $selected, theme }) =>
      $selected ? theme.colors.primary : `${theme.colors.primary}30`};
  background: ${({ $selected, theme }) =>
    $selected ? theme.colors.primary : "transparent"};
  color: ${({ $selected, theme }) =>
    $selected ? "#fff" : theme.colors.primary};
  cursor: pointer;
  transition: all 0.13s;

  &:hover {
    border-color: ${({ theme }) => theme.colors.primary};
    color: ${({ $selected, theme }) =>
      $selected ? "#fff" : theme.colors.primary};
  }
`;

// ─── Info banner ──────────────────────────────────────────────────────────────

const InfoBanner = styled.div<{ $level?: "info" | "warn" | "success" }>`
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 9px 12px;
  border-radius: 8px;
  font-size: 11px;
  line-height: 1.5;
  background: ${({ $level }) =>
    $level === "warn"
      ? "rgba(234,179,8,0.07)"
      : $level === "success"
        ? "rgba(34,197,94,0.07)"
        : "rgba(99,102,241,0.07)"};
  border: 1px solid
    ${({ $level }) =>
      $level === "warn"
        ? "rgba(234,179,8,0.2)"
        : $level === "success"
          ? "rgba(34,197,94,0.18)"
          : "rgba(99,102,241,0.18)"};
  color: ${({ $level }) =>
    $level === "warn"
      ? "#ca8a04"
      : $level === "success"
        ? "#16a34a"
        : "#6366f1"};
`;

// ─── Tax summary pill ─────────────────────────────────────────────────────────

const TaxSummaryRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
`;

const TaxPill = styled.div<{ $withholding?: boolean }>`
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 10px;
  font-weight: 600;
  background: ${({ $withholding }) =>
    $withholding ? "rgba(239,68,68,0.08)" : "rgba(224,92,26,0.1)"};
  border: 1px solid
    ${({ $withholding }) =>
      $withholding ? "rgba(239,68,68,0.22)" : "rgba(224,92,26,0.3)"};
  color: ${({ $withholding }) => ($withholding ? "#dc2626" : "#E05C1A")};
`;

// ─── Footer (non-compact) ────────────────────────────────────────────────────

const WizardFooter = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 6px;
  border-top: 1px solid ${({ theme }) => theme.colors.secondaryBackground};
  gap: 10px;
`;

const NavBtn = styled.button<{ $primary?: boolean }>`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s;
  white-space: nowrap;
  border: 1px solid
    ${({ $primary, theme }) =>
      $primary ? theme.colors.primary : theme.colors.secondaryBackground};
  background: ${({ $primary, theme }) =>
    $primary ? theme.colors.primary : "transparent"};
  color: ${({ $primary, theme }) =>
    $primary ? "#fff" : theme.colors.textSecondary};

  &:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }
  &:hover:not(:disabled) {
    opacity: 0.82;
  }
`;

const SkipBtn = styled.button`
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.5;
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px 0;
  &:hover {
    opacity: 0.9;
  }
`;

// ─── Types & constants ────────────────────────────────────────────────────────

/** Result emitted on completion */
export interface TaxProfileWizardResult {
  /** Partial contact meta update — pass to majik.updateActiveAccountMeta() */
  contactMetaPatch: Partial<MajikInvoiceContactMeta>;
  /** Updated invoice defaults taxes array */
  taxes: TaxDetail[];
}

interface TaxProfileWizardProps {
  majik: MajikBuwizClient;
  /** When true, hides internal step progress bar and footer nav; parent controls steps */
  compact?: boolean;
  /** Called when the wizard is complete with the computed patch */
  onComplete?: (result: TaxProfileWizardResult) => void;
  /** Called when user clicks skip (only shown when compact=false) */
  onSkip?: () => void;
}

// ─── EWT presets ─────────────────────────────────────────────────────────────

const EWT_PRESETS: {
  label: string;
  rate: number;
  atc: string;
  desc: string;
}[] = [
  {
    label: "5%",
    rate: 0.05,
    atc: "WC158",
    desc: "Professional fees — individuals",
  },
  {
    label: "10%",
    rate: 0.1,
    atc: "WC157",
    desc: "Professional fees — corporations",
  },
  { label: "2%", rate: 0.02, atc: "WC010", desc: "Rental — corporations" },
  { label: "5%", rate: 0.05, atc: "WI010", desc: "Rental — individuals" },
  { label: "1%", rate: 0.01, atc: "WC001", desc: "Goods — corporations" },
  { label: "2%", rate: 0.02, atc: "WI001", desc: "Services — individuals" },
];

type WizardStep = "entity" | "regime" | "withholding" | "details" | "review";

const WIZARD_STEPS: { id: WizardStep; label: string }[] = [
  { id: "entity", label: "Entity" },
  { id: "regime", label: "Tax Type" },
  { id: "withholding", label: "Withholding" },
  { id: "details", label: "Details" },
  { id: "review", label: "Review" },
];

// ─── Component ────────────────────────────────────────────────────────────────

export const TaxProfileWizard: React.FC<TaxProfileWizardProps> = ({
  majik,
  compact = false,
  onComplete,
  onSkip,
}) => {
  // ── Step state ──────────────────────────────────────────────────────────────
  const [step, setStep] = useState<WizardStep>("entity");

  // ── Entity & classification ─────────────────────────────────────────────────
  const [taxpayerType, setTaxpayerType] = useState<TaxpayerType | null>(null);
  const [taxpayerCategory, setTaxpayerCategory] =
    useState<TaxpayerCategory | null>(null);

  // ── Tax regime ──────────────────────────────────────────────────────────────
  const [taxRegime, setTaxRegime] = useState<TaxRegime | null>(null);
  const [vatRate, setVatRate] = useState<number>(12);
  const [vatRateOverride, setVatRateOverride] = useState(false);

  // ── Withholding ─────────────────────────────────────────────────────────────
  const [isWithholdingAgent, setIsWithholdingAgent] = useState<boolean | null>(
    null,
  );
  const [withholdingPresets, setWithholdingPresets] = useState<Set<number>>(
    new Set(),
  );
  const [customEwtRate, setCustomEwtRate] = useState<number>(5);
  const [showCustomEwt, setShowCustomEwt] = useState(false);

  // ── Details ─────────────────────────────────────────────────────────────────
  const [rdoCode, setRdoCode] = useState("");
  const [accountingMethod, setAccountingMethod] = useState<"cash" | "accrual">(
    "cash",
  );
  const [taxRateElection, setTaxRateElection] = useState<
    "graduated" | "flat-8-percent"
  >("graduated");
  const [deductionMethod, setDeductionMethod] = useState<"itemized" | "osd">(
    "osd",
  );

  // ── Load existing profile ───────────────────────────────────────────────────
  useEffect(() => {
    const loadExisting = async () => {
      try {
        const active = majik.getActiveAccount();
        if (!active?.meta) return;
        const meta = active.meta as MajikInvoiceContactMeta;

        if (meta.bir) {
          setRdoCode(meta.bir.rdoCode ?? "");
          setAccountingMethod(meta.bir.accountingMethod ?? "cash");
          setTaxRateElection(meta.bir.taxRateElection ?? "graduated");
          setDeductionMethod(meta.bir.deductionMethod ?? "osd");

          if (meta.bir.taxRegime) setTaxRegime(meta.bir.taxRegime as TaxRegime);
          if (meta.bir.entityType) {
            const et = meta.bir.entityType;
            if (et === "individual") setTaxpayerType("individual-professional");
            else if (et === "corporation") setTaxpayerType("corporation");
            else if (et === "partnership") setTaxpayerType("partnership");
          }
        }

        if (meta.taxProfile) {
          if (meta.taxProfile.isWithholdingAgent != null) {
            setIsWithholdingAgent(meta.taxProfile.isWithholdingAgent);
          }
          if (meta.taxProfile.vatType) {
            if (meta.taxProfile.vatType === "VAT") setTaxRegime("vat");
            else if (meta.taxProfile.vatType === "NON_VAT")
              setTaxRegime("percentage-tax");
            else if (meta.taxProfile.vatType === "EXEMPT")
              setTaxRegime("exempt");
          }
        }

        // Load existing VAT rate from invoice defaults
        const defaults = await majik.getInvoiceDefaults();
        const existingVat = defaults?.defaultTaxes?.find(
          (t) => t.taxType === "VAT" || t.taxType === "OVAT",
        );
        if (existingVat) {
          setVatRate(Math.round((existingVat.rate ?? 0.12) * 100));
        }
      } catch {
        // non-fatal
      }
    };
    loadExisting();
  }, [majik]);

  // ── Derived: built taxes ─────────────────────────────────────────────────────

  const computedTaxes = useMemo((): TaxDetail[] => {
    const taxes: TaxDetail[] = [];

    if (taxRegime === "vat") {
      taxes.push({
        taxType: "VAT",
        rate: vatRate / 100,
        behaviour: "additive",
        jurisdiction: "PH",
        inclusive: false,
      });
    } else if (taxRegime === "percentage-tax") {
      taxes.push({
        taxType: "OPT",
        rate: 0.03,
        behaviour: "additive",
        jurisdiction: "PH",
        inclusive: false,
      });
    }

    if (isWithholdingAgent) {
      // Add selected EWT presets
      EWT_PRESETS.forEach((preset, i) => {
        if (withholdingPresets.has(i)) {
          taxes.push({
            taxType: "EWT",
            rate: preset.rate,
            behaviour: "withholding",
            jurisdiction: "PH",
          });
        }
      });

      // Add custom EWT if specified
      if (showCustomEwt && customEwtRate > 0) {
        taxes.push({
          taxType: "EWT",
          rate: customEwtRate / 100,
          behaviour: "withholding",
          jurisdiction: "PH",
        });
      }
    }

    return taxes;
  }, [
    taxRegime,
    vatRate,
    isWithholdingAgent,
    withholdingPresets,
    showCustomEwt,
    customEwtRate,
  ]);

  // ── Derived: contact meta patch ──────────────────────────────────────────────

  const computedMeta = useMemo((): Partial<MajikInvoiceContactMeta> => {
    const entityTypeMap: Record<TaxpayerType, string> = {
      "individual-professional": "individual",
      "individual-business": "individual",
      corporation: "corporation",
      partnership: "partnership",
      cooperative: "corporation",
    };

    const vatTypeMap: Record<TaxRegime, VATType> = {
      vat: "VAT",
      "percentage-tax": "NON_VAT",
      exempt: "EXEMPT",
    };

    const taxProfile: InvoiceContactTaxProfile = {
      taxpayerType: taxpayerType ?? "individual-professional",
      taxpayerCategory: taxpayerCategory ?? undefined,
      vatType: taxRegime ? vatTypeMap[taxRegime] : undefined,
      isPercentageTax: taxRegime === "percentage-tax",
      isWithholdingAgent: isWithholdingAgent ?? false,
    };

    const bir: InvoiceContactBIRProfile = {
      rdoCode: rdoCode || "",
      entityType: taxpayerType
        ? (entityTypeMap[taxpayerType] as any)
        : "individual",
      taxRegime: taxRegime ?? "exempt",
      taxRateElection: taxRateElection,
      deductionMethod: deductionMethod,
      accountingMethod: accountingMethod,
      functionalCurrency: "PHP",
    };

    return { taxProfile, bir };
  }, [
    taxpayerType,
    taxpayerCategory,
    taxRegime,
    isWithholdingAgent,
    rdoCode,
    accountingMethod,
    taxRateElection,
    deductionMethod,
  ]);

  // ── Navigation ───────────────────────────────────────────────────────────────

  const stepIndex = WIZARD_STEPS.findIndex((s) => s.id === step);

  const canProceed = useMemo(() => {
    if (step === "entity") return taxpayerType !== null;
    if (step === "regime") return taxRegime !== null;
    if (step === "withholding") return isWithholdingAgent !== null;
    return true;
  }, [step, taxpayerType, taxRegime, isWithholdingAgent]);

  const handleNext = useCallback(() => {
    const order: WizardStep[] = [
      "entity",
      "regime",
      "withholding",
      "details",
      "review",
    ];
    const idx = order.indexOf(step);
    if (idx < order.length - 1) {
      setStep(order[idx + 1]);
    } else {
      onComplete?.({ contactMetaPatch: computedMeta, taxes: computedTaxes });
    }
  }, [step, computedMeta, computedTaxes, onComplete]);

  const handleBack = useCallback(() => {
    const order: WizardStep[] = [
      "entity",
      "regime",
      "withholding",
      "details",
      "review",
    ];
    const idx = order.indexOf(step);
    if (idx > 0) setStep(order[idx - 1]);
  }, [step]);

  const togglePreset = (i: number) => {
    setWithholdingPresets((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  // ─── Step: entity ────────────────────────────────────────────────────────────

  const renderEntityStep = () => (
    <StepPane>
      <StepHead>
        <StepIconBadge>
          <UserIcon size={20} />
        </StepIconBadge>
        <StepTitle>What type of taxpayer are you?</StepTitle>
        <StepSubtitle>
          BIR classifies filers differently for income tax returns. This
          determines which forms and rates apply.
        </StepSubtitle>
      </StepHead>

      <OptionGrid $cols={2}>
        {(
          [
            {
              id: "individual-professional" as TaxpayerType,
              icon: <IdentificationBadgeIcon size={18} />,
              label: "Professional",
              desc: "Doctors, lawyers, consultants, freelancers",
            },
            {
              id: "individual-business" as TaxpayerType,
              icon: <HandCoinsIcon size={18} />,
              label: "Sole Proprietor",
              desc: "Single-owner business, registered trade name",
            },
            {
              id: "corporation" as TaxpayerType,
              icon: <BuildingsIcon size={18} />,
              label: "Corporation / OPC",
              desc: "Stock and non-stock corporations, OPC",
            },
            {
              id: "partnership" as TaxpayerType,
              icon: <BankIcon size={18} />,
              label: "Partnership / Coop",
              desc: "General and limited partnerships, cooperatives",
            },
          ] as const
        ).map((opt) => (
          <OptionCard
            key={opt.id}
            $selected={taxpayerType === opt.id}
            onClick={() => {
              setTaxpayerType(opt.id);
              // Clear category when type changes
              setTaxpayerCategory(null);
            }}
            type="button"
          >
            <OptionCardIcon $selected={taxpayerType === opt.id}>
              {opt.icon}
            </OptionCardIcon>
            <OptionCardLabel>{opt.label}</OptionCardLabel>
            <OptionCardDesc>{opt.desc}</OptionCardDesc>
          </OptionCard>
        ))}
      </OptionGrid>

      {/* Category sub-select for individual types */}
      {(taxpayerType === "individual-professional" ||
        taxpayerType === "individual-business") && (
        <>
          <SectionLabel>Income source</SectionLabel>
          <OptionGrid $cols={3}>
            {[
              {
                id: "self-employed" as TaxpayerCategory,
                label: "Self-Employed Only",
                desc: "No employer",
              },
              {
                id: "mixed-income" as TaxpayerCategory,
                label: "Mixed Income",
                desc: "Has employer + own business",
              },
              {
                id: "purely-compensation" as TaxpayerCategory,
                label: "Compensation Only",
                desc: "Purely from employer",
              },
            ].map((cat) => (
              <OptionCard
                key={cat.id}
                $selected={taxpayerCategory === cat.id}
                onClick={() => setTaxpayerCategory(cat.id)}
                type="button"
              >
                <OptionCardLabel style={{ fontSize: 11 }}>
                  {cat.label}
                </OptionCardLabel>
                <OptionCardDesc>{cat.desc}</OptionCardDesc>
              </OptionCard>
            ))}
          </OptionGrid>
        </>
      )}
    </StepPane>
  );

  // ─── Step: regime ────────────────────────────────────────────────────────────

  const renderRegimeStep = () => (
    <StepPane>
      <StepHead>
        <StepIconBadge>
          <ReceiptIcon size={20} />
        </StepIconBadge>
        <StepTitle>What is your tax registration?</StepTitle>
        <StepSubtitle>
          This controls which taxes are applied on your invoices automatically.
        </StepSubtitle>
      </StepHead>

      <OptionGrid $cols={1}>
        {[
          {
            id: "vat" as TaxRegime,
            icon: <PercentIcon size={18} />,
            label: "VAT Registered",
            desc: "12% VAT applied to all taxable sales. Required if annual gross sales exceed ₱3M.",
            accent: "#E05C1A",
          },
          {
            id: "percentage-tax" as TaxRegime,
            icon: <FileTextIcon size={18} />,
            label: "Non-VAT / Percentage Tax (2551Q)",
            desc: "3% Other Percentage Tax on gross receipts. For sales below ₱3M threshold.",
            accent: "#6366f1",
          },
          {
            id: "exempt" as TaxRegime,
            icon: <ShieldCheckIcon size={18} />,
            label: "Tax Exempt / Special",
            desc: "VAT-exempt or with special regime (cooperatives, professionals below threshold, etc.)",
            accent: "#059669",
          },
        ].map((opt) => (
          <OptionCard
            key={opt.id}
            $selected={taxRegime === opt.id}
            $accent={opt.accent}
            onClick={() => setTaxRegime(opt.id)}
            type="button"
            style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
          >
            <OptionCardIcon
              $selected={taxRegime === opt.id}
              $accent={opt.accent}
            >
              {opt.icon}
            </OptionCardIcon>
            <div style={{ flex: 1 }}>
              <OptionCardLabel>{opt.label}</OptionCardLabel>
              <OptionCardDesc style={{ display: "block", marginTop: 3 }}>
                {opt.desc}
              </OptionCardDesc>
            </div>
            {taxRegime === opt.id && (
              <CheckCircleIcon
                size={16}
                color={opt.accent}
                weight="fill"
                style={{ flexShrink: 0 }}
              />
            )}
          </OptionCard>
        ))}
      </OptionGrid>

      {/* VAT rate override */}
      {taxRegime === "vat" && (
        <>
          <SectionDivider />
          <RateRow>
            <RateLabel>
              <PercentIcon
                size={12}
                style={{ marginRight: 5, verticalAlign: "middle" }}
              />
              VAT Rate
            </RateLabel>
            <RateInputWrap>
              <RateInput
                type="number"
                min={0}
                max={100}
                step={0.5}
                value={vatRate}
                onChange={(e) => {
                  setVatRateOverride(true);
                  setVatRate(parseFloat(e.target.value) || 12);
                }}
              />
              <RateUnit>%</RateUnit>
            </RateInputWrap>
          </RateRow>

          <PresetRow>
            {[12, 0, 8].map((r) => (
              <PresetChip
                key={r}
                $selected={(vatRate === r && !vatRateOverride) || vatRate === r}
                onClick={() => {
                  setVatRate(r);
                  setVatRateOverride(false);
                }}
                type="button"
              >
                {r}%{" "}
                {r === 12
                  ? "(Standard)"
                  : r === 0
                    ? "(Zero-rated)"
                    : "(Export)"}
              </PresetChip>
            ))}
          </PresetRow>

          {vatRate === 0 && (
            <InfoBanner $level="info">
              <InfoIcon size={13} style={{ flexShrink: 0, marginTop: 1 }} />
              Zero-rated VAT still requires VAT filing (2550M/2550Q) — you
              charge 0% but claim input VAT credits on purchases.
            </InfoBanner>
          )}
        </>
      )}

      {taxRegime === "percentage-tax" && (
        <InfoBanner $level="info">
          <InfoIcon size={13} style={{ flexShrink: 0, marginTop: 1 }} />
          3% OPT (Other Percentage Tax) will be added. Filed quarterly via BIR
          Form 2551Q. If you opted into the CREATE Act's 1% rate (July 2020–June
          2023), use the rate override.
        </InfoBanner>
      )}
    </StepPane>
  );

  // ─── Step: withholding ───────────────────────────────────────────────────────

  const renderWithholdingStep = () => (
    <StepPane>
      <StepHead>
        <StepIconBadge>
          <CurrencyCircleDollarIcon size={20} />
        </StepIconBadge>
        <StepTitle>Are you a withholding agent?</StepTitle>
        <StepSubtitle>
          Withholding agents deduct EWT (Expanded Withholding Tax) from payments
          to suppliers and remit it to BIR.
        </StepSubtitle>
      </StepHead>

      <OptionGrid $cols={2}>
        <OptionCard
          $selected={isWithholdingAgent === true}
          $accent="#E05C1A"
          onClick={() => setIsWithholdingAgent(true)}
          type="button"
        >
          <OptionCardIcon
            $selected={isWithholdingAgent === true}
            $accent="#E05C1A"
          >
            <ShieldCheckIcon size={18} />
          </OptionCardIcon>
          <OptionCardLabel>Yes — I withhold EWT</OptionCardLabel>
          <OptionCardDesc>I deduct tax from supplier payments</OptionCardDesc>
        </OptionCard>
        <OptionCard
          $selected={isWithholdingAgent === false}
          $accent="#6b7280"
          onClick={() => {
            setIsWithholdingAgent(false);
            setWithholdingPresets(new Set());
          }}
          type="button"
        >
          <OptionCardIcon
            $selected={isWithholdingAgent === false}
            $accent="#6b7280"
          >
            <UserIcon size={18} />
          </OptionCardIcon>
          <OptionCardLabel>No — I don't withhold</OptionCardLabel>
          <OptionCardDesc>Clients withhold from my payments</OptionCardDesc>
        </OptionCard>
      </OptionGrid>

      {!!isWithholdingAgent && (
        <>
          <SectionDivider />
          <SectionLabel>
            Select applicable EWT rates (BIR-compliant presets)
          </SectionLabel>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {EWT_PRESETS.map((preset, i) => (
              <RateRow
                key={i}
                onClick={() => togglePreset(i)}
                $selected={withholdingPresets.has(i)}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, fontWeight: 600 }}>
                    {preset.label} — {preset.desc}
                  </div>
                  <div
                    style={{
                      fontSize: 9,
                      opacity: 0.5,
                      marginTop: 2,
                      fontFamily: "monospace",
                    }}
                  >
                    ATC: {preset.atc}
                  </div>
                </div>
                {withholdingPresets.has(i) && (
                  <CheckCircleIcon size={14} color="#E05C1A" weight="fill" />
                )}
              </RateRow>
            ))}
          </div>

          {/* Custom rate */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <PresetChip
              $selected={showCustomEwt}
              onClick={() => setShowCustomEwt((v) => !v)}
              type="button"
            >
              + Custom rate
            </PresetChip>
          </div>

          {showCustomEwt && (
            <RateRow>
              <RateLabel>Custom EWT rate</RateLabel>
              <RateInputWrap>
                <RateInput
                  type="number"
                  min={0}
                  max={35}
                  step={0.5}
                  value={customEwtRate}
                  onChange={(e) =>
                    setCustomEwtRate(parseFloat(e.target.value) || 0)
                  }
                />
                <RateUnit>%</RateUnit>
              </RateInputWrap>
            </RateRow>
          )}

          {withholdingPresets.size === 0 && !showCustomEwt && (
            <InfoBanner $level="warn">
              <WarningIcon size={13} style={{ flexShrink: 0, marginTop: 1 }} />
              Select at least one EWT rate or add a custom rate, otherwise EWT
              won't be auto-applied on invoices.
            </InfoBanner>
          )}

          {!isWithholdingAgent && (
            <InfoBanner $level="info">
              <InfoIcon size={13} style={{ flexShrink: 0, marginTop: 1 }} />
              You'll still receive BIR Form 2307 certificates from clients who
              withhold on your income. You can record these as tax credits.
            </InfoBanner>
          )}
        </>
      )}
    </StepPane>
  );

  // ─── Step: details ───────────────────────────────────────────────────────────

  const renderDetailsStep = () => {
    const isIndividual =
      taxpayerType === "individual-professional" ||
      taxpayerType === "individual-business";

    return (
      <StepPane>
        <StepHead>
          <StepIconBadge>
            <BankIcon size={20} />
          </StepIconBadge>
          <StepTitle>BIR Registration Details</StepTitle>
          <StepSubtitle>
            These details are used for filing computations. You can update them
            anytime in Settings.
          </StepSubtitle>
        </StepHead>

        <CustomFormInput
          label="RDO Code"
          value={rdoCode}
          onChange={(v) => setRdoCode(v as string)}
          placeholder="e.g. 040 — Quezon City North"
          maxChar={10}
          hideCharLimit
          layout="row"
        />

        <SectionLabel>Accounting method</SectionLabel>
        <OptionGrid $cols={2}>
          {[
            {
              id: "cash" as const,
              label: "Cash Basis",
              desc: "Income when received, expense when paid",
            },
            {
              id: "accrual" as const,
              label: "Accrual Basis",
              desc: "Income when earned, expense when incurred",
            },
          ].map((opt) => (
            <OptionCard
              key={opt.id}
              $selected={accountingMethod === opt.id}
              onClick={() => setAccountingMethod(opt.id)}
              type="button"
            >
              <OptionCardLabel>{opt.label}</OptionCardLabel>
              <OptionCardDesc>{opt.desc}</OptionCardDesc>
            </OptionCard>
          ))}
        </OptionGrid>

        {isIndividual && taxRegime !== "exempt" && (
          <>
            <SectionLabel>Income tax rate election</SectionLabel>
            <OptionGrid $cols={2}>
              {[
                {
                  id: "graduated" as const,
                  label: "Graduated",
                  desc: "0–35% tax table. Allows deductions.",
                },
                {
                  id: "flat-8-percent" as const,
                  label: "Flat 8%",
                  desc: "8% flat on gross receipts. Gross ≤ ₱3M only.",
                },
              ].map((opt) => (
                <OptionCard
                  key={opt.id}
                  $selected={taxRateElection === opt.id}
                  onClick={() => setTaxRateElection(opt.id)}
                  type="button"
                >
                  <OptionCardLabel>{opt.label}</OptionCardLabel>
                  <OptionCardDesc>{opt.desc}</OptionCardDesc>
                </OptionCard>
              ))}
            </OptionGrid>

            {taxRateElection === "graduated" && (
              <>
                <SectionLabel>Deduction method</SectionLabel>
                <OptionGrid $cols={2}>
                  {[
                    {
                      id: "osd" as const,
                      label: "OSD (40%)",
                      desc: "40% of gross receipts. No substantiation needed.",
                    },
                    {
                      id: "itemized" as const,
                      label: "Itemized",
                      desc: "Actual expenses. Receipts required.",
                    },
                  ].map((opt) => (
                    <OptionCard
                      key={opt.id}
                      $selected={deductionMethod === opt.id}
                      onClick={() => setDeductionMethod(opt.id)}
                      type="button"
                    >
                      <OptionCardLabel>{opt.label}</OptionCardLabel>
                      <OptionCardDesc>{opt.desc}</OptionCardDesc>
                    </OptionCard>
                  ))}
                </OptionGrid>
              </>
            )}
          </>
        )}
      </StepPane>
    );
  };

  // ─── Step: review ────────────────────────────────────────────────────────────

  const renderReviewStep = () => (
    <StepPane>
      <StepHead>
        <StepIconBadge>
          <CheckCircleIcon size={20} weight="fill" />
        </StepIconBadge>
        <StepTitle>Review your tax profile</StepTitle>
        <StepSubtitle>
          These settings will be saved to your account and applied to new
          invoices.
        </StepSubtitle>
      </StepHead>

      {/* Summary rows */}
      {[
        {
          label: "Taxpayer type",
          value: taxpayerType?.replace(/-/g, " ") ?? "—",
        },
        {
          label: "Tax regime",
          value:
            taxRegime === "vat"
              ? `VAT Registered (${vatRate}%)`
              : taxRegime === "percentage-tax"
                ? "Percentage Tax (3% OPT)"
                : "Tax Exempt",
        },
        {
          label: "Withholding agent",
          value: isWithholdingAgent
            ? `Yes (${withholdingPresets.size + (showCustomEwt ? 1 : 0)} rate${withholdingPresets.size + (showCustomEwt ? 1 : 0) !== 1 ? "s" : ""} configured)`
            : "No",
        },
        { label: "RDO Code", value: rdoCode || "Not specified" },
        {
          label: "Accounting method",
          value: accountingMethod === "cash" ? "Cash Basis" : "Accrual Basis",
        },
        ...((taxpayerType === "individual-professional" ||
          taxpayerType === "individual-business") &&
        taxRegime !== "exempt"
          ? [
              {
                label: "Tax rate election",
                value:
                  taxRateElection === "flat-8-percent"
                    ? "Flat 8%"
                    : "Graduated",
              },
              ...(taxRateElection === "graduated"
                ? [
                    {
                      label: "Deduction method",
                      value:
                        deductionMethod === "osd" ? "OSD (40%)" : "Itemized",
                    },
                  ]
                : []),
            ]
          : []),
      ].map(({ label, value }) => (
        <RateRow key={label}>
          <RateLabel style={{ fontSize: 11 }}>{label}</RateLabel>
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "inherit",
              textAlign: "right",
              maxWidth: 200,
              wordBreak: "break-word",
            }}
          >
            {value}
          </span>
        </RateRow>
      ))}

      {/* Auto-configured taxes */}
      {computedTaxes.length > 0 && (
        <>
          <SectionLabel>Taxes that will be auto-configured</SectionLabel>
          <TaxSummaryRow>
            {computedTaxes.map((t, i) => (
              <TaxPill key={i} $withholding={t.behaviour === "withholding"}>
                <ReceiptIcon size={10} />
                {t.taxType} {((t.rate ?? 0) * 100).toFixed(1)}%
                {t.behaviour === "withholding" ? " withheld" : ""}
              </TaxPill>
            ))}
          </TaxSummaryRow>
        </>
      )}

      {computedTaxes.length === 0 && (
        <InfoBanner $level="info">
          <InfoIcon size={13} style={{ flexShrink: 0 }} />
          No taxes will be auto-applied (tax exempt). You can add taxes manually
          per invoice or update this profile anytime.
        </InfoBanner>
      )}

      <InfoBanner $level="success">
        <CheckCircleIcon size={13} style={{ flexShrink: 0, marginTop: 1 }} />
        Profile complete. Tap Save to apply these settings to your account and
        invoice defaults.
      </InfoBanner>
    </StepPane>
  );

  // ─── Render ──────────────────────────────────────────────────────────────────

  const renderCurrentStep = () => {
    switch (step) {
      case "entity":
        return renderEntityStep();
      case "regime":
        return renderRegimeStep();
      case "withholding":
        return renderWithholdingStep();
      case "details":
        return renderDetailsStep();
      case "review":
        return renderReviewStep();
    }
  };

  return (
    <WizardRoot $compact={compact}>
      {/* Progress bar */}
      {!compact && (
        <ProgressBar>
          <ProgressTrack>
            {WIZARD_STEPS.map((s, i) => (
              <ProgressSegment
                key={s.id}
                $state={
                  i < stepIndex
                    ? "done"
                    : i === stepIndex
                      ? "active"
                      : "pending"
                }
              />
            ))}
          </ProgressTrack>
          <ProgressLabels>
            {WIZARD_STEPS.map((s, i) => (
              <ProgressLabel key={s.id} $active={i === stepIndex}>
                {s.label}
              </ProgressLabel>
            ))}
          </ProgressLabels>
        </ProgressBar>
      )}

      {renderCurrentStep()}

      {/* Footer nav */}
      {!compact && (
        <WizardFooter>
          <div>
            {stepIndex > 0 ? (
              <NavBtn type="button" onClick={handleBack}>
                <ArrowLeftIcon size={13} /> Back
              </NavBtn>
            ) : (
              onSkip && (
                <SkipBtn type="button" onClick={onSkip}>
                  Skip for now
                </SkipBtn>
              )
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {stepIndex < WIZARD_STEPS.length - 1 && onSkip && (
              <SkipBtn type="button" onClick={onSkip}>
                Skip
              </SkipBtn>
            )}
            <NavBtn
              $primary
              type="button"
              disabled={!canProceed}
              onClick={handleNext}
            >
              {step === "review" ? (
                <>
                  Save Profile <CheckCircleIcon size={13} />
                </>
              ) : (
                <>
                  Next <ArrowRightIcon size={13} />
                </>
              )}
            </NavBtn>
          </div>
        </WizardFooter>
      )}
    </WizardRoot>
  );
};

export default TaxProfileWizard;
