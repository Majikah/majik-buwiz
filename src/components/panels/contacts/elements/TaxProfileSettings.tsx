/**
 * TaxpayerProfileSettings.tsx
 *
 * Advanced, non-wizard settings panel for the full BIR tax profile.
 * Mirrors the structure / conventions of InvoiceSettings.tsx:
 *   - Section-based layout, all fields inline editable
 *   - No step flow — shows everything at once
 *   - Emits onChange(result) for every mutation; parent decides when to save
 *
 * Sections:
 *   1. Classification  — entity type, taxpayer category, income source
 *   2. Tax Regime      — VAT / OPT / Exempt, VAT rate, inclusive flag
 *   3. Withholding     — agent flag, EWT rate rows (add/remove/edit)
 *   4. BIR Details     — RDO code, accounting method, rate election, deduction method,
 *                        VAT registration date, ATC codes, functional currency
 *   5. Spouse          — optional, for married individual filers
 *
 * Props:
 *   majik      — MajikBuwizClient instance
 *   onChange   — called on every field change with the latest TaxProfileWizardResult
 */

import React, { useEffect, useState } from "react";
import styled from "styled-components";
import {
  BankIcon,
  HandCoinsIcon,
  InfoIcon,
  MinusCircleIcon,
  PlusIcon,
  ReceiptIcon,
  ShieldCheckIcon,
  ToggleLeftIcon,
  ToggleRightIcon,
  TrashIcon,
  UserIcon,
  UsersThreeIcon,
  WarningIcon,
} from "@phosphor-icons/react";
import type {
  MajikBuwizClient,
  TaxpayerCategory,
  TaxpayerType,
} from "@/SDK/majik-buwiz-client/src";

import type { TaxDetail } from "@majikah/majik-invoice";
import type {
  InvoiceContactBIRProfile,
  InvoiceContactTaxProfile,
  MajikInvoiceContactMeta,
} from "@/SDK/majik-buwiz-client/src/core/party/types";
import type { TaxProfileWizardResult } from "./TaxProfileWizard";
import CustomFormInput from "@/components/foundations/CustomFormInput";

// ─── Styled — Panel shell ─────────────────────────────────────────────────────

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

// ─── Section ──────────────────────────────────────────────────────────────────

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

const FieldColumn = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const FieldLabel = styled.label`
  font-size: 11px;
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  color: ${({ theme }) => theme.colors.textSecondary};
`;

const FieldRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
`;

// ─── Segmented / radio button group ──────────────────────────────────────────

const SegmentGroup = styled.div`
  display: flex;
  gap: 5px;
  flex-wrap: wrap;
`;

const SegmentButton = styled.button<{ $selected: boolean; $color?: string }>`
  padding: 5px 12px;
  border-radius: 7px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.14s;
  border: 1px solid
    ${({ $selected, theme, $color }) =>
      $selected
        ? ($color ?? theme.colors.primary)
        : `${theme.colors.primary}22`};
  background: ${({ $selected, theme, $color }) =>
    $selected ? `${$color ?? theme.colors.primary}14` : "transparent"};
  color: ${({ $selected, theme, $color }) =>
    $selected ? ($color ?? theme.colors.primary) : theme.colors.textSecondary};

  &:hover {
    border-color: ${({ theme, $color }) => $color ?? theme.colors.primary};
    color: ${({ theme, $color }) => $color ?? theme.colors.primary};
  }
`;

// ─── Toggle (boolean on/off) ──────────────────────────────────────────────────

const ToggleRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 12px;
  border-radius: ${({ theme }) => theme.borders.radius.small};
  background: ${({ theme }) => theme.colors.primaryBackground};
  border: 1px solid ${({ theme }) => theme.colors.primary}0e;
`;

const ToggleInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
`;

const ToggleTitle = styled.span`
  font-size: 12px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textPrimary};
`;

const ToggleDesc = styled.span`
  font-size: 10px;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.55;
  line-height: 1.4;
`;

const ToggleButton = styled.button<{ $active: boolean }>`
  background: none;
  border: none;
  cursor: pointer;
  color: ${({ $active, theme }) =>
    $active ? theme.colors.primary : theme.colors.textSecondary};
  opacity: ${({ $active }) => ($active ? 1 : 0.35)};
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2px;
  flex-shrink: 0;
  transition: all 0.15s;

  &:hover {
    opacity: 1;
  }
`;

// ─── EWT table ────────────────────────────────────────────────────────────────

const EwtTable = styled.div`
  display: flex;
  flex-direction: column;
  gap: 5px;
`;

const EwtTableHeader = styled.div`
  display: grid;
  grid-template-columns: 80px 70px 90px 1fr 28px;
  gap: 6px;
  padding: 0 2px;
`;

const EwtColLabel = styled.div`
  font-size: 9px;
  font-family: ${({ theme }) => theme.typography.fonts.semibold};
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.6;
`;

const EwtRow = styled.div`
  display: grid;
  grid-template-columns: 80px 70px 90px 1fr 28px;
  gap: 6px;
  align-items: center;
  padding: 7px 9px;
  border-radius: ${({ theme }) => theme.borders.radius.small};
  background: ${({ theme }) => theme.colors.primaryBackground};
  border: 1px solid ${({ theme }) => theme.colors.primary}12;
  transition: border-color 0.15s;

  &:hover {
    border-color: ${({ theme }) => theme.colors.primary}30;
  }
`;

const EwtInput = styled.input`
  font-family: ${({ theme }) => theme.typography.fonts.regular};
  font-size: 11px;
  padding: 4px 7px;
  border-radius: ${({ theme }) => theme.borders.radius.small};
  border: 1px solid ${({ theme }) => theme.colors.primary}25;
  background: ${({ theme }) => theme.colors.secondaryBackground};
  color: ${({ theme }) => theme.colors.textPrimary};
  width: 100%;

  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.primary}70;
  }
`;

const EwtDeleteBtn = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  color: ${({ theme }) => theme.colors.error ?? "#ef4444"};
  opacity: 0.35;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2px;
  border-radius: ${({ theme }) => theme.borders.radius.small};
  transition: opacity 0.14s;

  &:hover {
    opacity: 1;
    background: rgba(239, 68, 68, 0.08);
  }
`;

const AddRowBtn = styled.button`
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  font-size: 11px;
  color: ${({ theme }) => theme.colors.primary};
  border: none;
  background: none;
  cursor: pointer;
  padding: 4px 0;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  transition: opacity 0.14s;

  &:hover {
    opacity: 0.65;
  }
`;

const EwtPresetQuickAdd = styled.button`
  font-size: 10px;
  font-weight: 600;
  padding: 3px 9px;
  border-radius: 20px;
  border: 1px solid ${({ theme }) => `${theme.colors.primary}30`};
  background: transparent;
  color: ${({ theme }) => theme.colors.primary};
  cursor: pointer;
  transition: all 0.13s;

  &:hover {
    background: ${({ theme }) => `${theme.colors.primary}10`};
    border-color: ${({ theme }) => theme.colors.primary};
  }
`;

// ─── ATC tags ─────────────────────────────────────────────────────────────────

const AtcWrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 7px;
`;

const AtcTagList = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
`;

const AtcTag = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 3px 9px;
  border-radius: 20px;
  font-size: 10px;
  font-weight: 600;
  background: ${({ theme }) => `${theme.colors.primary}10`};
  border: 1px solid ${({ theme }) => `${theme.colors.primary}28`};
  color: ${({ theme }) => theme.colors.primary};
`;

const AtcRemove = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  display: flex;
  align-items: center;
  color: ${({ theme }) => theme.colors.primary};
  opacity: 0.5;
  &:hover {
    opacity: 1;
  }
`;

const AtcInput = styled.input`
  font-family: ${({ theme }) => theme.typography.fonts.regular};
  font-size: 11px;
  padding: 5px 9px;
  border-radius: ${({ theme }) => theme.borders.radius.small};
  border: 1px solid ${({ theme }) => theme.colors.primary}25;
  background: ${({ theme }) => theme.colors.secondaryBackground};
  color: ${({ theme }) => theme.colors.textPrimary};
  width: 120px;

  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.primary}70;
  }

  &::placeholder {
    opacity: 0.4;
  }
`;

// ─── Info callout ─────────────────────────────────────────────────────────────

const InfoCallout = styled.div<{ $level?: "info" | "warn" | "success" }>`
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 9px 12px;
  border-radius: ${({ theme }) => theme.borders.radius.small};
  font-size: 10.5px;
  line-height: 1.55;
  background: ${({ $level }) =>
    $level === "warn"
      ? "rgba(234,179,8,0.07)"
      : $level === "success"
        ? "rgba(34,197,94,0.07)"
        : "rgba(99,102,241,0.06)"};
  border: 1px solid
    ${({ $level }) =>
      $level === "warn"
        ? "rgba(234,179,8,0.2)"
        : $level === "success"
          ? "rgba(34,197,94,0.18)"
          : "rgba(99,102,241,0.16)"};
  color: ${({ $level }) =>
    $level === "warn"
      ? "#b45309"
      : $level === "success"
        ? "#15803d"
        : "#4f46e5"};
`;

const EmptyNote = styled.div`
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.45;
  font-style: italic;
  padding: 4px 0;
`;

// ─── Types ────────────────────────────────────────────────────────────────────

interface EwtEntry {
  id: number;
  taxType: string;
  rate: number;
  atc: string;
  description: string;
}

// Pre-built BIR-compliant EWT presets
const EWT_PRESETS = [
  {
    taxType: "EWT",
    rate: 5,
    atc: "WC158",
    description: "Prof. fees — individuals",
  },
  { taxType: "EWT", rate: 10, atc: "WC157", description: "Prof. fees — corps" },
  { taxType: "EWT", rate: 2, atc: "WC010", description: "Rental — corps" },
  {
    taxType: "EWT",
    rate: 5,
    atc: "WI010",
    description: "Rental — individuals",
  },
  { taxType: "EWT", rate: 1, atc: "WC001", description: "Goods — corps" },
  {
    taxType: "EWT",
    rate: 2,
    atc: "WI001",
    description: "Services — individuals",
  },
  {
    taxType: "EWT",
    rate: 15,
    atc: "WC200",
    description: "Income payments to corp",
  },
];

const COMMON_ATC_CODES = [
  "WC158",
  "WC157",
  "WI158",
  "WI157",
  "WC010",
  "WI010",
  "WC001",
  "WI001",
  "WC200",
  "WI300",
];

interface TaxpayerProfileSettingsProps {
  majik: MajikBuwizClient;
  onChange?: (result: TaxProfileWizardResult) => void;
}

// ─── helpers ──────────────────────────────────────────────────────────────────

let _ewtIdCounter = 1;
const nextEwtId = () => ++_ewtIdCounter;

// ─── Component ────────────────────────────────────────────────────────────────

export const TaxpayerProfileSettings: React.FC<
  TaxpayerProfileSettingsProps
> = ({ majik, onChange }) => {
  const [loading, setLoading] = useState(true);

  // ── Classification ──────────────────────────────────────────────────────────
  const [taxpayerType, setTaxpayerType] = useState<TaxpayerType>(
    "individual-professional",
  );
  const [taxpayerCategory, setTaxpayerCategory] =
    useState<TaxpayerCategory>("sole_proprietor");

  // ── Tax regime ──────────────────────────────────────────────────────────────
  const [taxRegime, setTaxRegime] = useState<
    "vat" | "percentage-tax" | "exempt"
  >("exempt");
  const [vatRate, setVatRate] = useState<number>(12);
  const [vatInclusive, setVatInclusive] = useState(false);
  const [optRate, setOptRate] = useState<number>(3);
  const [isWithholding, setIsWithholding] = useState(false);
  const [, setIsPercentageTax] = useState(false);

  // ── EWT rows ────────────────────────────────────────────────────────────────
  const [ewtRows, setEwtRows] = useState<EwtEntry[]>([]);

  // ── BIR details ─────────────────────────────────────────────────────────────
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
  const [vatRegistrationDate, setVatRegistrationDate] = useState("");
  const [functionalCurrency, setFunctionalCurrency] = useState("PHP");
  const [atcCodes, setAtcCodes] = useState<string[]>([]);
  const [atcInput, setAtcInput] = useState("");

  // ── Spouse ──────────────────────────────────────────────────────────────────
  const [hasSpouse, setHasSpouse] = useState(false);
  const [spouseLastName, setSpouseLastName] = useState("");
  const [spouseFirstName, setSpouseFirstName] = useState("");
  const [spouseMiddle, setSpouseMiddle] = useState("");
  const [spouseTin, setSpouseTin] = useState("");
  const [spouseRdo, setSpouseRdo] = useState("");

  // ── Load existing profile ───────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        const active = majik.getActiveAccount();
        const meta = active?.meta as MajikInvoiceContactMeta | undefined;

        if (meta?.bir) {
          const bir = meta.bir;
          setRdoCode(bir.rdoCode ?? "");
          setAccountingMethod(bir.accountingMethod ?? "cash");
          setTaxRateElection(bir.taxRateElection ?? "graduated");
          setDeductionMethod(bir.deductionMethod ?? "osd");
          setVatRegistrationDate(bir.vatRegistrationDate ?? "");
          setFunctionalCurrency(bir.functionalCurrency ?? "PHP");
          setAtcCodes(bir.registeredActivities ?? []);
          setTaxRegime((bir.taxRegime as any) ?? "exempt");

          if (bir.entityType) {
            if (bir.entityType === "individual") {
              setTaxpayerType("individual-professional");
            } else if (bir.entityType === "corporation") {
              setTaxpayerType("corporation");
            } else if (bir.entityType === "partnership") {
              setTaxpayerType("partnership");
            }
          }

          if (bir.spouse) {
            setHasSpouse(true);
            setSpouseLastName(bir.spouse.lastName ?? "");
            setSpouseFirstName(bir.spouse.firstName ?? "");
            setSpouseMiddle(bir.spouse.middleName ?? "");
            setSpouseTin(bir.spouse.tin ?? "");
            setSpouseRdo(bir.spouse.rdoCode ?? "");
          }
        }

        if (meta?.taxProfile) {
          const tp = meta.taxProfile;
          if (tp.taxpayerType) setTaxpayerType(tp.taxpayerType as TaxpayerType);
          if (tp.taxpayerCategory)
            setTaxpayerCategory(tp.taxpayerCategory as TaxpayerCategory);
          if (tp.isWithholdingAgent != null)
            setIsWithholding(tp.isWithholdingAgent);
          if (tp.isPercentageTax != null)
            setIsPercentageTax(tp.isPercentageTax);
        }

        // Load existing taxes
        const defaults = await majik.getInvoiceDefaults();
        if (defaults?.defaultTaxes) {
          const vat = defaults.defaultTaxes.find((t) => t.taxType === "VAT");
          if (vat) {
            setVatRate(Math.round((vat.rate ?? 0.12) * 100));
            setVatInclusive(vat.inclusive ?? false);
          }

          const opt = defaults.defaultTaxes.find((t) => t.taxType === "OPT");
          if (opt) setOptRate(Math.round((opt.rate ?? 0.03) * 100));

          const ewtTaxes = defaults.defaultTaxes.filter(
            (t) => t.behaviour === "withholding",
          );
          if (ewtTaxes.length > 0) {
            setEwtRows(
              ewtTaxes.map((t) => ({
                id: nextEwtId(),
                taxType: t.taxType ?? "EWT",
                rate: Math.round((t.rate ?? 0) * 100),
                atc: (t as any).atc ?? "",
                description: (t as any).description ?? "",
              })),
            );
          }
        }
      } catch (err) {
        console.error("[TaxpayerProfileSettings] load error", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [majik]);

  // ── Emit onChange ───────────────────────────────────────────────────────────

  const emit = (
    overrides?: Partial<{
      type: TaxpayerType;
      category: TaxpayerCategory;
      regime: typeof taxRegime;
      vRate: number;
      vIncl: boolean;
      oRate: number;
      wh: boolean;
      rows: EwtEntry[];
      rdo: string;
      accMethod: "cash" | "accrual";
      election: "graduated" | "flat-8-percent";
      deduction: "itemized" | "osd";
      vatDate: string;
      currency: string;
      atcs: string[];
      sp: boolean;
      spLast: string;
      spFirst: string;
      spMiddle: string;
      spTin: string;
      spRdo: string;
    }>,
  ) => {
    const type_ = overrides?.type ?? taxpayerType;
    const category = overrides?.category ?? taxpayerCategory;
    const regime_ = overrides?.regime ?? taxRegime;
    const vRate = overrides?.vRate ?? vatRate;
    const vIncl = overrides?.vIncl ?? vatInclusive;
    const oRate = overrides?.oRate ?? optRate;
    const wh = overrides?.wh ?? isWithholding;
    const rows_ = overrides?.rows ?? ewtRows;
    const rdo_ = overrides?.rdo ?? rdoCode;
    const accMeth = overrides?.accMethod ?? accountingMethod;
    const election_ = overrides?.election ?? taxRateElection;
    const deduct_ = overrides?.deduction ?? deductionMethod;
    const vatDate_ = overrides?.vatDate ?? vatRegistrationDate;
    const curr_ = overrides?.currency ?? functionalCurrency;
    const atcs_ = overrides?.atcs ?? atcCodes;
    const sp_ = overrides?.sp ?? hasSpouse;
    const spLast_ = overrides?.spLast ?? spouseLastName;
    const spFirst_ = overrides?.spFirst ?? spouseFirstName;
    const spMid_ = overrides?.spMiddle ?? spouseMiddle;
    const spTin_ = overrides?.spTin ?? spouseTin;
    const spRdo_ = overrides?.spRdo ?? spouseRdo;

    // ── Build taxes ──────────────────────────────────────────────────────────
    const taxes: TaxDetail[] = [];
    if (regime_ === "vat") {
      taxes.push({
        taxType: "VAT",
        rate: vRate / 100,
        behaviour: "additive",
        jurisdiction: "PH",
        inclusive: vIncl,
      });
    } else if (regime_ === "percentage-tax") {
      taxes.push({
        taxType: "OPT",
        rate: oRate / 100,
        behaviour: "additive",
        jurisdiction: "PH",
        inclusive: false,
      });
    }
    if (wh) {
      rows_.forEach((row) => {
        if (row.rate > 0) {
          taxes.push({
            taxType: row.taxType || "EWT",
            rate: row.rate / 100,
            behaviour: "withholding",
            jurisdiction: "PH",
          } as TaxDetail);
        }
      });
    }

    // ── Build entity type ────────────────────────────────────────────────────
    const entityTypeMap: Record<TaxpayerType, string> = {
      "individual-professional": "individual",
      "individual-business": "individual",
      corporation: "corporation",
      partnership: "partnership",
      cooperative: "corporation",
    };

    const bir: InvoiceContactBIRProfile = {
      rdoCode: rdo_,
      entityType: entityTypeMap[type_] as any,
      taxRegime: regime_,
      taxRateElection: election_,
      deductionMethod: deduct_,
      accountingMethod: accMeth,
      functionalCurrency: curr_,
      vatRegistrationDate: vatDate_ || undefined,
      registeredActivities: atcs_.length > 0 ? atcs_ : undefined,
      spouse:
        sp_ && spLast_ && spFirst_
          ? {
              lastName: spLast_,
              firstName: spFirst_,
              middleName: spMid_ || undefined,
              tin: spTin_ || undefined,
              rdoCode: spRdo_ || undefined,
            }
          : undefined,
    };

    const taxProfile: InvoiceContactTaxProfile = {
      taxpayerType: type_,
      taxpayerCategory: category,
      vatType:
        regime_ === "vat"
          ? "VAT"
          : regime_ === "percentage-tax"
            ? "NON_VAT"
            : "EXEMPT",
      isPercentageTax: regime_ === "percentage-tax",
      isWithholdingAgent: wh,
    };

    onChange?.({
      contactMetaPatch: { bir, taxProfile },
      taxes,
    });
  };

  // ── EWT helpers ─────────────────────────────────────────────────────────────

  const updateEwtRow = (id: number, patch: Partial<EwtEntry>) => {
    const next = ewtRows.map((r) => (r.id === id ? { ...r, ...patch } : r));
    setEwtRows(next);
    emit({ rows: next });
  };

  const removeEwtRow = (id: number) => {
    const next = ewtRows.filter((r) => r.id !== id);
    setEwtRows(next);
    emit({ rows: next });
  };

  const addBlankEwt = () => {
    const next = [
      ...ewtRows,
      { id: nextEwtId(), taxType: "EWT", rate: 5, atc: "", description: "" },
    ];
    setEwtRows(next);
    emit({ rows: next });
  };

  const addPresetEwt = (preset: (typeof EWT_PRESETS)[number]) => {
    const alreadyHas = ewtRows.some(
      (r) => r.atc === preset.atc && r.rate === preset.rate,
    );
    if (alreadyHas) return;
    const next = [
      ...ewtRows,
      {
        id: nextEwtId(),
        taxType: preset.taxType,
        rate: preset.rate,
        atc: preset.atc,
        description: preset.description,
      },
    ];
    setEwtRows(next);
    emit({ rows: next });
  };

  // ── ATC helpers ──────────────────────────────────────────────────────────────

  const addAtcCode = (code: string) => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed || atcCodes.includes(trimmed)) return;
    const next = [...atcCodes, trimmed];
    setAtcCodes(next);
    setAtcInput("");
    emit({ atcs: next });
  };

  const removeAtcCode = (code: string) => {
    const next = atcCodes.filter((c) => c !== code);
    setAtcCodes(next);
    emit({ atcs: next });
  };

  const isIndividual =
    taxpayerType === "individual-professional" ||
    taxpayerType === "individual-business";

  if (loading) return null;

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <Panel>
      <PanelBody>
        {/* ════════════════════════════════════════════════════════════════════
            SECTION 1 — Classification
        ════════════════════════════════════════════════════════════════════ */}
        <Section>
          <SectionLabel>
            <UserIcon size={12} /> Classification
          </SectionLabel>

          <FieldColumn>
            <FieldLabel>Taxpayer type</FieldLabel>
            <SegmentGroup>
              {(
                [
                  { id: "individual-professional", label: "Professional" },
                  { id: "individual-business", label: "Sole Proprietor" },
                  { id: "corporation", label: "Corporation / OPC" },
                  { id: "partnership", label: "Partnership" },
                  { id: "cooperative", label: "Cooperative" },
                ] as { id: TaxpayerType; label: string }[]
              ).map((opt) => (
                <SegmentButton
                  key={opt.id}
                  $selected={taxpayerType === opt.id}
                  onClick={() => {
                    setTaxpayerType(opt.id);
                    emit({ type: opt.id });
                  }}
                  type="button"
                >
                  {opt.label}
                </SegmentButton>
              ))}
            </SegmentGroup>
          </FieldColumn>

          {isIndividual && (
            <FieldColumn>
              <FieldLabel>Income source / category</FieldLabel>
              <SegmentGroup>
                {(
                  [
                    { id: "self-employed", label: "Self-Employed" },
                    { id: "mixed-income", label: "Mixed Income" },
                    { id: "purely-compensation", label: "Purely Compensation" },
                    { id: "msme", label: "MSME" },
                  ] as { id: TaxpayerCategory; label: string }[]
                ).map((opt) => (
                  <SegmentButton
                    key={opt.id}
                    $selected={taxpayerCategory === opt.id}
                    onClick={() => {
                      setTaxpayerCategory(opt.id);
                      emit({ category: opt.id });
                    }}
                    type="button"
                  >
                    {opt.label}
                  </SegmentButton>
                ))}
              </SegmentGroup>
            </FieldColumn>
          )}

          {taxpayerType === "corporation" && (
            <FieldColumn>
              <FieldLabel>Corporation sub-type</FieldLabel>
              <SegmentGroup>
                {(
                  [
                    { id: "opc", label: "One Person Corporation (OPC)" },
                    { id: "msme", label: "MSME" },
                  ] as { id: TaxpayerCategory; label: string }[]
                ).map((opt) => (
                  <SegmentButton
                    key={opt.id}
                    $selected={taxpayerCategory === opt.id}
                    onClick={() => {
                      setTaxpayerCategory(opt.id);
                      emit({ category: opt.id });
                    }}
                    type="button"
                  >
                    {opt.label}
                  </SegmentButton>
                ))}
              </SegmentGroup>
            </FieldColumn>
          )}
        </Section>

        {/* ════════════════════════════════════════════════════════════════════
            SECTION 2 — Tax Regime & Output Taxes
        ════════════════════════════════════════════════════════════════════ */}
        <Section>
          <SectionLabel>
            <ReceiptIcon size={12} /> Tax Regime &amp; Output Taxes
          </SectionLabel>

          <FieldColumn>
            <FieldLabel>Registration type</FieldLabel>
            <SegmentGroup>
              {(
                [
                  { id: "vat", label: "VAT Registered", color: "#E05C1A" },
                  {
                    id: "percentage-tax",
                    label: "Non-VAT / Percentage",
                    color: "#6366f1",
                  },
                  { id: "exempt", label: "Exempt", color: "#059669" },
                ] as { id: typeof taxRegime; label: string; color: string }[]
              ).map((opt) => (
                <SegmentButton
                  key={opt.id}
                  $selected={taxRegime === opt.id}
                  $color={opt.color}
                  onClick={() => {
                    setTaxRegime(opt.id);
                    setIsPercentageTax(opt.id === "percentage-tax");
                    emit({ regime: opt.id });
                  }}
                  type="button"
                >
                  {opt.label}
                </SegmentButton>
              ))}
            </SegmentGroup>
          </FieldColumn>

          {/* VAT sub-fields */}
          {taxRegime === "vat" && (
            <>
              <FieldRow>
                <FieldLabel>VAT rate (%)</FieldLabel>
                <SegmentGroup>
                  {[12, 0, 8].map((r) => (
                    <SegmentButton
                      key={r}
                      $selected={vatRate === r}
                      onClick={() => {
                        setVatRate(r);
                        emit({ vRate: r });
                      }}
                      type="button"
                    >
                      {r}%
                    </SegmentButton>
                  ))}
                  {/* custom */}
                  <CustomFormInput
                    label=""
                    onChange={(v) => {
                      const n = parseFloat(v as string) || 0;
                      setVatRate(n);
                      emit({ vRate: n });
                    }}
                    value={String(vatRate)}
                    maxChar={5}
                    hideCharLimit
                    layout="row"
                    type="number"
                  />
                </SegmentGroup>
              </FieldRow>

              <ToggleRow>
                <ToggleInfo>
                  <ToggleTitle>VAT-inclusive pricing</ToggleTitle>
                  <ToggleDesc>
                    When enabled, invoice line prices already include VAT. BIR
                    Form 2550M/2550Q will back-compute the tax.
                  </ToggleDesc>
                </ToggleInfo>
                <ToggleButton
                  $active={vatInclusive}
                  onClick={() => {
                    const next = !vatInclusive;
                    setVatInclusive(next);
                    emit({ vIncl: next });
                  }}
                >
                  {vatInclusive ? (
                    <ToggleRightIcon size={22} weight="fill" />
                  ) : (
                    <ToggleLeftIcon size={22} />
                  )}
                </ToggleButton>
              </ToggleRow>

              {vatRate === 0 && (
                <InfoCallout $level="info">
                  <InfoIcon size={12} style={{ flexShrink: 0, marginTop: 1 }} />
                  Zero-rated still requires VAT filing (2550M/Q). You charge 0%
                  but may credit input VAT on purchases.
                </InfoCallout>
              )}
            </>
          )}

          {/* OPT rate */}
          {taxRegime === "percentage-tax" && (
            <>
              <FieldRow>
                <FieldLabel>OPT rate (%)</FieldLabel>
                <SegmentGroup>
                  {[3, 1].map((r) => (
                    <SegmentButton
                      key={r}
                      $selected={optRate === r}
                      onClick={() => {
                        setOptRate(r);
                        emit({ oRate: r });
                      }}
                      type="button"
                    >
                      {r}%{r === 1 ? " (CREATE Act)" : " (Standard)"}
                    </SegmentButton>
                  ))}
                </SegmentGroup>
              </FieldRow>

              <InfoCallout $level="info">
                <InfoIcon size={12} style={{ flexShrink: 0, marginTop: 1 }} />
                Percentage tax is filed quarterly via BIR Form 2551Q. The CREATE
                Act 1% rate applies July 2020–June 2023 only.
              </InfoCallout>
            </>
          )}

          {taxRegime === "exempt" && (
            <InfoCallout $level="success">
              <ShieldCheckIcon
                size={12}
                style={{ flexShrink: 0, marginTop: 1 }}
              />
              Tax exempt — no output tax applied on invoices. You still file
              income tax returns (1701A / 1702RT as applicable).
            </InfoCallout>
          )}
        </Section>

        {/* ════════════════════════════════════════════════════════════════════
            SECTION 3 — Withholding Tax (EWT)
        ════════════════════════════════════════════════════════════════════ */}
        <Section>
          <SectionLabel>
            <HandCoinsIcon size={12} /> Withholding Tax (EWT)
          </SectionLabel>

          <ToggleRow>
            <ToggleInfo>
              <ToggleTitle>Withholding agent</ToggleTitle>
              <ToggleDesc>
                Deduct and remit EWT (Expanded Withholding Tax) on payments to
                suppliers. Required to file BIR Form 0619E / 1601EQ.
              </ToggleDesc>
            </ToggleInfo>
            <ToggleButton
              $active={isWithholding}
              onClick={() => {
                const next = !isWithholding;
                setIsWithholding(next);
                emit({ wh: next });
              }}
            >
              {isWithholding ? (
                <ToggleRightIcon size={22} weight="fill" />
              ) : (
                <ToggleLeftIcon size={22} />
              )}
            </ToggleButton>
          </ToggleRow>

          {isWithholding && (
            <>
              {/* Quick-add presets */}
              <FieldLabel>BIR presets — click to add</FieldLabel>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                {EWT_PRESETS.map((preset, i) => {
                  const alreadyAdded = ewtRows.some(
                    (r) => r.atc === preset.atc && r.rate === preset.rate,
                  );
                  return (
                    <EwtPresetQuickAdd
                      key={i}
                      onClick={() => addPresetEwt(preset)}
                      disabled={alreadyAdded}
                      style={{ opacity: alreadyAdded ? 0.35 : 1 }}
                      type="button"
                    >
                      {preset.rate}% {preset.atc}
                    </EwtPresetQuickAdd>
                  );
                })}
              </div>

              {ewtRows.length === 0 ? (
                <EmptyNote>
                  No EWT rates configured — add a preset or a custom row below.
                </EmptyNote>
              ) : (
                <EwtTable>
                  <EwtTableHeader>
                    <EwtColLabel>Type</EwtColLabel>
                    <EwtColLabel>Rate (%)</EwtColLabel>
                    <EwtColLabel>ATC Code</EwtColLabel>
                    <EwtColLabel>Description</EwtColLabel>
                    <EwtColLabel />
                  </EwtTableHeader>

                  {ewtRows.map((row) => (
                    <EwtRow key={row.id}>
                      <EwtInput
                        value={row.taxType}
                        onChange={(e) =>
                          updateEwtRow(row.id, {
                            taxType: e.target.value.toUpperCase(),
                          })
                        }
                        placeholder="EWT"
                      />
                      <EwtInput
                        type="number"
                        min={0}
                        max={35}
                        step={0.5}
                        value={row.rate}
                        onChange={(e) =>
                          updateEwtRow(row.id, {
                            rate: parseFloat(e.target.value) || 0,
                          })
                        }
                      />
                      <EwtInput
                        value={row.atc}
                        onChange={(e) =>
                          updateEwtRow(row.id, {
                            atc: e.target.value.toUpperCase(),
                          })
                        }
                        placeholder="WC158"
                        list="atc-suggestions"
                      />
                      <EwtInput
                        value={row.description}
                        onChange={(e) =>
                          updateEwtRow(row.id, { description: e.target.value })
                        }
                        placeholder="Description"
                      />
                      <EwtDeleteBtn
                        onClick={() => removeEwtRow(row.id)}
                        title="Remove"
                      >
                        <TrashIcon size={13} />
                      </EwtDeleteBtn>
                    </EwtRow>
                  ))}
                </EwtTable>
              )}

              <datalist id="atc-suggestions">
                {COMMON_ATC_CODES.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>

              <AddRowBtn onClick={addBlankEwt} type="button">
                <PlusIcon size={11} weight="bold" />
                Add custom EWT row
              </AddRowBtn>

              <InfoCallout $level="warn">
                <WarningIcon
                  size={12}
                  style={{ flexShrink: 0, marginTop: 1 }}
                />
                EWT rates must match BIR Revenue Regulations exactly. The ATC
                code determines the applicable rate. When in doubt, consult RR
                2-98 as amended by RR 11-2018.
              </InfoCallout>
            </>
          )}
        </Section>

        {/* ════════════════════════════════════════════════════════════════════
            SECTION 4 — BIR Registration Details
        ════════════════════════════════════════════════════════════════════ */}
        <Section>
          <SectionLabel>
            <BankIcon size={12} /> BIR Registration Details
          </SectionLabel>

          <CustomFormInput
            label="RDO Code"
            onChange={(v) => {
              setRdoCode(v as string);
              emit({ rdo: v as string });
            }}
            value={rdoCode}
            placeholder="e.g. 040 — Quezon City North"
            maxChar={10}
            hideCharLimit
            layout="row"
          />

          <CustomFormInput
            label="Functional Currency"
            onChange={(v) => {
              setFunctionalCurrency(v as string);
              emit({ currency: v as string });
            }}
            value={functionalCurrency}
            layout="row"
            options={["PHP", "USD", "EUR", "SGD"].map((c) => ({
              value: c,
              label: c,
            }))}
          />

          <FieldColumn>
            <FieldLabel>Accounting method</FieldLabel>
            <SegmentGroup>
              {[
                {
                  id: "cash" as const,
                  label: "Cash Basis",
                  desc: "Income when received",
                },
                {
                  id: "accrual" as const,
                  label: "Accrual Basis",
                  desc: "Income when earned",
                },
              ].map((opt) => (
                <SegmentButton
                  key={opt.id}
                  $selected={accountingMethod === opt.id}
                  onClick={() => {
                    setAccountingMethod(opt.id);
                    emit({ accMethod: opt.id });
                  }}
                  type="button"
                >
                  {opt.label}
                </SegmentButton>
              ))}
            </SegmentGroup>
          </FieldColumn>

          {isIndividual && taxRegime !== "exempt" && (
            <>
              <FieldColumn>
                <FieldLabel>
                  Income tax rate election (1701A / 1701Q)
                </FieldLabel>
                <SegmentGroup>
                  <SegmentButton
                    $selected={taxRateElection === "graduated"}
                    onClick={() => {
                      setTaxRateElection("graduated");
                      emit({ election: "graduated" });
                    }}
                    type="button"
                  >
                    Graduated (0–35%)
                  </SegmentButton>
                  <SegmentButton
                    $selected={taxRateElection === "flat-8-percent"}
                    onClick={() => {
                      setTaxRateElection("flat-8-percent");
                      emit({ election: "flat-8-percent" });
                    }}
                    type="button"
                  >
                    Flat 8%
                  </SegmentButton>
                </SegmentGroup>
                {taxRateElection === "flat-8-percent" && (
                  <InfoCallout $level="warn">
                    <WarningIcon size={12} style={{ flexShrink: 0 }} />
                    Flat 8% only available if gross receipts ≤ ₱3M and elected
                    at Q1. Once elected, it applies for the full year.
                  </InfoCallout>
                )}
              </FieldColumn>

              {taxRateElection === "graduated" && (
                <FieldColumn>
                  <FieldLabel>Deduction method</FieldLabel>
                  <SegmentGroup>
                    <SegmentButton
                      $selected={deductionMethod === "osd"}
                      onClick={() => {
                        setDeductionMethod("osd");
                        emit({ deduction: "osd" });
                      }}
                      type="button"
                    >
                      OSD (40% of gross)
                    </SegmentButton>
                    <SegmentButton
                      $selected={deductionMethod === "itemized"}
                      onClick={() => {
                        setDeductionMethod("itemized");
                        emit({ deduction: "itemized" });
                      }}
                      type="button"
                    >
                      Itemized
                    </SegmentButton>
                  </SegmentGroup>
                </FieldColumn>
              )}
            </>
          )}

          {taxRegime === "vat" && (
            <CustomFormInput
              label="VAT Registration Date"
              onChange={(v) => {
                setVatRegistrationDate(v as string);
                emit({ vatDate: v as string });
              }}
              value={vatRegistrationDate}
              placeholder="YYYY-MM-DD"
              maxChar={10}
              hideCharLimit
              layout="row"
            />
          )}

          {/* ATC / Registered Activities */}
          <FieldColumn>
            <FieldLabel>Registered activity codes (ATC)</FieldLabel>
            <AtcWrap>
              {atcCodes.length === 0 ? (
                <EmptyNote>No ATC codes added.</EmptyNote>
              ) : (
                <AtcTagList>
                  {atcCodes.map((code) => (
                    <AtcTag key={code}>
                      {code}
                      <AtcRemove
                        onClick={() => removeAtcCode(code)}
                        type="button"
                        title="Remove"
                      >
                        <MinusCircleIcon size={11} />
                      </AtcRemove>
                    </AtcTag>
                  ))}
                </AtcTagList>
              )}

              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <AtcInput
                  value={atcInput}
                  onChange={(e) => setAtcInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === ",") {
                      e.preventDefault();
                      addAtcCode(atcInput);
                    }
                  }}
                  placeholder="e.g. WC158"
                  list="atc-suggestions-2"
                />
                <AddRowBtn onClick={() => addAtcCode(atcInput)} type="button">
                  <PlusIcon size={11} weight="bold" /> Add
                </AddRowBtn>
              </div>

              <datalist id="atc-suggestions-2">
                {COMMON_ATC_CODES.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </AtcWrap>
          </FieldColumn>
        </Section>

        {/* ════════════════════════════════════════════════════════════════════
            SECTION 5 — Spouse (individual filers only)
        ════════════════════════════════════════════════════════════════════ */}
        {isIndividual && (
          <Section>
            <SectionLabel>
              <UsersThreeIcon size={12} /> Spouse Information
              <span
                style={{
                  fontWeight: 400,
                  opacity: 0.5,
                  fontSize: 9,
                  marginLeft: 4,
                }}
              >
                — for married individual filers (1701A Part V)
              </span>
            </SectionLabel>

            <ToggleRow>
              <ToggleInfo>
                <ToggleTitle>Include spouse details</ToggleTitle>
                <ToggleDesc>
                  Required for married filers who declare combined income on BIR
                  Form 1701A Part V.
                </ToggleDesc>
              </ToggleInfo>
              <ToggleButton
                $active={hasSpouse}
                onClick={() => {
                  const next = !hasSpouse;
                  setHasSpouse(next);
                  emit({ sp: next });
                }}
              >
                {hasSpouse ? (
                  <ToggleRightIcon size={22} weight="fill" />
                ) : (
                  <ToggleLeftIcon size={22} />
                )}
              </ToggleButton>
            </ToggleRow>

            {hasSpouse && (
              <FieldColumn>
                <CustomFormInput
                  label="Last Name"
                  onChange={(v) => {
                    setSpouseLastName(v as string);
                    emit({ spLast: v as string });
                  }}
                  value={spouseLastName}
                  placeholder="Surname"
                  maxChar={100}
                  hideCharLimit
                  layout="row"
                />
                <CustomFormInput
                  label="First Name"
                  onChange={(v) => {
                    setSpouseFirstName(v as string);
                    emit({ spFirst: v as string });
                  }}
                  value={spouseFirstName}
                  placeholder="Given name"
                  maxChar={100}
                  hideCharLimit
                  layout="row"
                />
                <CustomFormInput
                  label="Middle Name"
                  onChange={(v) => {
                    setSpouseMiddle(v as string);
                    emit({ spMiddle: v as string });
                  }}
                  value={spouseMiddle}
                  placeholder="Optional"
                  maxChar={100}
                  hideCharLimit
                  layout="row"
                />
                <CustomFormInput
                  label="Spouse TIN"
                  onChange={(v) => {
                    setSpouseTin(v as string);
                    emit({ spTin: v as string });
                  }}
                  value={spouseTin}
                  placeholder="000-000-000-000"
                  maxChar={20}
                  hideCharLimit
                  layout="row"
                />
                <CustomFormInput
                  label="Spouse RDO Code"
                  onChange={(v) => {
                    setSpouseRdo(v as string);
                    emit({ spRdo: v as string });
                  }}
                  value={spouseRdo}
                  placeholder="e.g. 043"
                  maxChar={10}
                  hideCharLimit
                  layout="row"
                />
              </FieldColumn>
            )}
          </Section>
        )}
      </PanelBody>
    </Panel>
  );
};

export default TaxpayerProfileSettings;
