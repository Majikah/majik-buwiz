/**
 * ExpenseRefundForm.tsx
 *
 * Stripped-down refund form for ExpenseRecord refund events.
 * Matches RefundRecord exactly — no payment method, currency, or proof URL.
 */

import React, { useEffect, useId, useRef, useState } from "react";
import styled, { css } from "styled-components";
import type { RefundRecord } from "@/SDK/majik-buwiz-client/src/core/expenses/types";
import CustomFormInput from "@/components/foundations/CustomFormInput";

// ---------------------------------------------------------------------------
// Styled
// ---------------------------------------------------------------------------

const FormRoot = styled.div`
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 4px 0;
`;

const SectionDivider = styled.div`
  height: 1px;
  background: ${({ theme }) => theme.colors.primary}12;
  margin: 2px 0;
`;

// ── Preset grid ──────────────────────────────────────────────────────────────

const PresetBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const PresetLabel = styled.div`
  font-size: 10px;
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  color: ${({ theme }) => theme.colors.textSecondary};
  letter-spacing: 0.03em;
  text-transform: uppercase;
  opacity: 0.65;
  user-select: none;
`;

const PresetGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
`;

const presetActiveStyle = css`
  background: ${({ theme }) => theme.colors.primary};
  color: ${({ theme }) => theme.colors.primaryBackground};
  border-color: ${({ theme }) => theme.colors.primary};
  box-shadow: 0 2px 8px ${({ theme }) => theme.colors.primary}44;
`;

const PresetBtn = styled.button<{ $active: boolean }>`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  padding: 7px 6px 6px;
  border-radius: ${({ theme }) => theme.borders.radius.small};
  border: 1px solid ${({ theme }) => theme.colors.primary}33;
  background: ${({ theme }) => theme.colors.secondaryBackground};
  color: ${({ theme }) => theme.colors.primary};
  cursor: pointer;
  transition: all 0.13s ease;

  ${({ $active }) => $active && presetActiveStyle}

  &:hover:not(:disabled) {
    ${presetActiveStyle}
  }

  &:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
`;

const PresetPct = styled.span`
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  font-size: 11px;
  letter-spacing: 0.02em;
`;

const PresetAmt = styled.span`
  font-family: ${({ theme }) => theme.typography.fonts.numbers};
  font-size: 10px;
  opacity: 0.75;
`;

// ── Amount row ───────────────────────────────────────────────────────────────

const AmountSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const AmountFieldLabel = styled.label`
  font-size: 11px;
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  color: ${({ theme }) => theme.colors.textSecondary};
  letter-spacing: 0.02em;
`;

const RequiredMark = styled.span`
  color: ${({ theme }) => theme.colors.error};
  margin-left: 1px;
`;

const AmountHintRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const HintText = styled.div`
  font-size: 10px;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.6;
`;

const ErrorHint = styled.div`
  font-size: 10px;
  color: ${({ theme }) => theme.colors.error};
`;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

interface PresetDef {
  key: string;
  pct: number;
  label: string;
}

const PRESETS: PresetDef[] = [
  { key: "full", pct: 100, label: "Full" },
  { key: "half", pct: 50, label: "50%" },
  { key: "third", pct: 30, label: "30%" },
  { key: "quarter", pct: 25, label: "25%" },
  { key: "fifth", pct: 20, label: "20%" },
  { key: "tenth", pct: 10, label: "10%" },
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ExpenseRefundFormProps {
  /** Currency code shown beside amount hints (display only — not stored on RefundRecord) */
  displayCurrency: string;
  /** Total amount of the expense */
  expenseTotal?: number;
  /** Remaining refundable balance — used for preset calculations and over-refund guard */
  amountRemaining?: number;
  onChange: (refund: Omit<RefundRecord, "id"> | null) => void;
  /** Fires whenever form validity changes */
  onValidate?: (valid: boolean) => void;
}

// ---------------------------------------------------------------------------
// Internal form state
// ---------------------------------------------------------------------------

interface FormState {
  /** Raw string while editing; parsed to number on emit */
  amount: string;
  refundedAt: string;
  reason: string;
  reference: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function nowLocal(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` +
    `T${pad(now.getHours())}:${pad(now.getMinutes())}`
  );
}

function roundTo2(n: number): string {
  return (Math.round(n * 100) / 100).toFixed(2);
}

/** Strip non-numeric chars; enforce max 2 decimal places */
function cleanDecimalString(raw: string): string {
  const cleaned = raw.replace(/[^0-9.]/g, "");
  const parts = cleaned.split(".");
  if (parts.length > 2) return parts[0] + "." + parts[1];
  if (parts[1] !== undefined && parts[1].length > 2) {
    return parts[0] + "." + parts[1].slice(0, 2);
  }
  return cleaned;
}

function computeValidity(
  f: FormState,
  amountRemaining: number | undefined,
): boolean {
  const amount = parseFloat(f.amount);
  return (
    !isNaN(amount) &&
    amount > 0 &&
    !!f.refundedAt &&
    (amountRemaining === undefined || amount <= amountRemaining)
  );
}

function buildRefund(f: FormState): Omit<RefundRecord, "id"> {
  return {
    amount: Math.round(parseFloat(f.amount) * 100) / 100,
    refundedAt: new Date(f.refundedAt).toISOString(),
    reason: f.reason.trim() || undefined,
    reference: f.reference.trim() || undefined,
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const ExpenseRefundForm: React.FC<ExpenseRefundFormProps> = ({
  displayCurrency,
  expenseTotal,
  amountRemaining,
  onChange,
  onValidate,
}) => {
  const uid = useId();

  const baseAmount = amountRemaining ?? expenseTotal ?? 0;

  const defaultAmount =
    amountRemaining !== undefined
      ? roundTo2(amountRemaining)
      : expenseTotal !== undefined
        ? roundTo2(expenseTotal)
        : "";

  const [form, setForm] = useState<FormState>({
    amount: defaultAmount,
    refundedAt: nowLocal(),
    reason: "",
    reference: "",
  });

  const [preset, setPreset] = useState<string>(defaultAmount ? "full" : "");

  // ------------------------------------------------------------------
  // Emit — runs after render, never during it
  // ------------------------------------------------------------------
  const lastValid = useRef<boolean | null>(null);

  useEffect(() => {
    const valid = computeValidity(form, amountRemaining);

    if (valid !== lastValid.current) {
      lastValid.current = valid;
      onValidate?.(valid);
    }

    onChange(valid ? buildRefund(form) : null);
    // onChange / onValidate excluded intentionally — stable refs expected
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form]);

  // ------------------------------------------------------------------
  // Field setter
  // ------------------------------------------------------------------
  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  // ------------------------------------------------------------------
  // Preset
  // ------------------------------------------------------------------
  const applyPreset = (p: PresetDef) => {
    if (!baseAmount) return;
    setPreset(p.key);
    setForm((prev) => ({
      ...prev,
      amount: roundTo2((p.pct / 100) * baseAmount),
    }));
  };

  // ------------------------------------------------------------------
  // Amount input
  // ------------------------------------------------------------------
  const handleAmountChange = (v: string) => {
    setPreset("");
    setForm((prev) => ({ ...prev, amount: cleanDecimalString(v) }));
  };

  // ------------------------------------------------------------------
  // Derived display values
  // ------------------------------------------------------------------
  const currencyAmt = parseFloat(form.amount) || 0;

  const amountError: string | null = (() => {
    if (!form.amount || form.amount === "0") return null;
    if (currencyAmt <= 0) return "Amount must be greater than zero.";
    if (amountRemaining !== undefined && currencyAmt > amountRemaining) {
      return `Exceeds remaining balance of ${displayCurrency} ${roundTo2(amountRemaining)}.`;
    }
    return null;
  })();

  return (
    <FormRoot>
      {/* Amount section */}
      <AmountSection>
        <AmountFieldLabel htmlFor={`${uid}-amount`}>
          Refund Amount <RequiredMark>*</RequiredMark>
        </AmountFieldLabel>

        {/* Preset grid */}
        {baseAmount > 0 && (
          <PresetBlock>
            <PresetLabel>Quick fill</PresetLabel>
            <PresetGrid>
              {PRESETS.map((p) => (
                <PresetBtn
                  key={p.key}
                  type="button"
                  $active={preset === p.key}
                  onClick={() => applyPreset(p)}
                >
                  <PresetPct>{p.label}</PresetPct>
                  <PresetAmt>
                    {displayCurrency} {roundTo2((p.pct / 100) * baseAmount)}
                  </PresetAmt>
                </PresetBtn>
              ))}
            </PresetGrid>
          </PresetBlock>
        )}

        <CustomFormInput
          id={`${uid}-amount`}
          label=""
          value={form.amount}
          onChange={(v) => handleAmountChange(v as string)}
          type="number"
          placeholder="0.00"
          required
        />

        <AmountHintRow>
          <div>{amountError && <ErrorHint>{amountError}</ErrorHint>}</div>
          {amountRemaining !== undefined && (
            <HintText data-private>
              Remaining: {displayCurrency}{" "}
              {amountRemaining.toLocaleString(undefined, {
                minimumFractionDigits: 2,
              })}
            </HintText>
          )}
        </AmountHintRow>
      </AmountSection>

      {/* Refund date & time */}
      <CustomFormInput
        id={`${uid}-refunded-at`}
        label="Refund Date & Time"
        value={form.refundedAt}
        onChange={(v) => setField("refundedAt", v as string)}
        type="datetime-local"
        required
      />

      <SectionDivider />

      {/* Reason (optional) */}
      <CustomFormInput
        id={`${uid}-reason`}
        label="Reason"
        value={form.reason}
        onChange={(v) => setField("reason", v as string)}
        placeholder="e.g. Duplicate charge, Vendor credit, Overpayment…"
        hint="Optional — Why is this refund being issued?"
        maxChar={200}
      />

      {/* Reference (optional) */}
      <CustomFormInput
        id={`${uid}-reference`}
        label="Reference"
        value={form.reference}
        onChange={(v) => setField("reference", v as string)}
        placeholder="e.g. Credit memo #, Return auth code…"
        hint="Optional — Credit memo number, return authorization, etc."
        maxChar={120}
      />
    </FormRoot>
  );
};
