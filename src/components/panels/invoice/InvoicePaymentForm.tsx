/**
 * InvoicePaymentForm.tsx  (v4)
 *
 * Fixes vs v3:
 *   - toggleMode no longer nests a setState call inside another setState
 *     updater — that pattern causes React's "setState during render" warning.
 *     toggleMode is now a plain imperative function that calls setMode and
 *     setForm independently in the same event handler.
 *   - onChange / onValidate are moved to a useEffect that runs *after* the
 *     render cycle, so they can never fire during render of any ancestor.
 *   - handleAmountChange and applyPreset follow the same pattern.
 */

import React, { useEffect, useId, useRef, useState } from "react";
import styled, { css } from "styled-components";
import type { ProofOfPayment } from "@majikah/majik-invoice";
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

const AmountRow = styled.div`
  display: grid;
  grid-template-columns: 64px 1fr;
  gap: 8px;
  align-items: end;
`;

const modeBadgeActiveStyle = css`
  background: ${({ theme }) => theme.colors.primary};
  color: ${({ theme }) => theme.colors.primaryBackground};
  border-color: ${({ theme }) => theme.colors.primary};
`;

const ModeBadge = styled.button<{ $pct: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 32px;
  padding: 0 8px;
  border-radius: ${({ theme }) => theme.borders.radius.small};
  border: 1px solid ${({ theme }) => theme.colors.primary}44;
  background: ${({ theme }) => theme.colors.primarySoft};
  font-family: ${({ theme }) => theme.typography.fonts.numbers};
  font-size: 12px;
  color: ${({ theme }) => theme.colors.primary};
  letter-spacing: 0.04em;
  white-space: nowrap;
  cursor: pointer;
  transition: all 0.13s ease;
  box-sizing: border-box;
  width: 100%;

  ${({ $pct }) => $pct && modeBadgeActiveStyle}

  &:hover {
    ${modeBadgeActiveStyle}
    opacity: 0.9;
  }
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

const PAYMENT_METHODS = [
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "cash", label: "Cash" },
  { value: "check", label: "Check" },
  { value: "credit_card", label: "Credit Card" },
  { value: "debit_card", label: "Debit Card" },
  { value: "ewallet", label: "E-Wallet" },
  { value: "paypal", label: "PayPal" },
  { value: "crypto", label: "Cryptocurrency" },
  { value: "wire", label: "Wire Transfer" },
  { value: "other", label: "Other…" },
] as const;

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
// Internal state
// ---------------------------------------------------------------------------

interface FormState {
  method: string;
  customMethod: string;
  reference: string;
  settledAt: string;
  /** Raw string in the amount input — currency value or percentage */
  amountRaw: string;
  proofUrl: string;
}

type InputMode = "currency" | "percent";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface InvoicePaymentFormProps {
  invoiceCurrency: string;
  invoiceTotal?: number;
  /** Remaining unpaid amount — used for preset calculations and over-payment guard */
  amountRemaining?: number;
  onChange: (proof: ProofOfPayment | null) => void;
  /** Fires whenever the overall form validity changes */
  onValidate?: (valid: boolean) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateProofId(): string {
  return `pay_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function toISO(datetimeLocal: string): string {
  if (!datetimeLocal) return new Date().toISOString();
  return new Date(datetimeLocal).toISOString();
}

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

function resolveCurrencyAmt(raw: string, m: InputMode, base: number): number {
  const n = parseFloat(raw);
  if (isNaN(n)) return 0;
  if (m === "currency") return n;
  return base > 0 ? (n / 100) * base : 0;
}

function computeValidity(
  f: FormState,
  m: InputMode,
  base: number,
  amountRemaining: number | undefined,
): boolean {
  const amount = resolveCurrencyAmt(f.amountRaw, m, base);
  const resolvedMethod =
    f.method === "other" ? f.customMethod.trim() : f.method;

  return (
    !!resolvedMethod &&
    !!f.reference.trim() &&
    !!f.settledAt &&
    amount > 0 &&
    (amountRemaining === undefined || amount <= amountRemaining)
  );
}

function buildProof(
  f: FormState,
  m: InputMode,
  base: number,
  currency: string,
): ProofOfPayment {
  const amount =
    Math.round(resolveCurrencyAmt(f.amountRaw, m, base) * 100) / 100;
  const resolvedMethod =
    f.method === "other" ? f.customMethod.trim() || "other" : f.method;

  return {
    id: generateProofId(),
    method: resolvedMethod as ProofOfPayment["method"],
    reference: f.reference.trim(),
    settledAt: toISO(f.settledAt),
    amount,
    currency,
    proofUrl: f.proofUrl.trim() || undefined,
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const InvoicePaymentForm: React.FC<InvoicePaymentFormProps> = ({
  invoiceCurrency,
  invoiceTotal,
  amountRemaining,
  onChange,
  onValidate,
}) => {
  const uid = useId();

  const baseAmount = amountRemaining ?? invoiceTotal ?? 0;

  const defaultAmount =
    amountRemaining !== undefined
      ? roundTo2(amountRemaining)
      : invoiceTotal !== undefined
        ? roundTo2(invoiceTotal)
        : "";

  const [form, setForm] = useState<FormState>({
    method: "bank_transfer",
    customMethod: "",
    reference: "",
    settledAt: nowLocal(),
    amountRaw: defaultAmount,
    proofUrl: "",
  });

  const [preset, setPreset] = useState<string>(defaultAmount ? "full" : "");
  const [mode, setMode] = useState<InputMode>("currency");

  // ------------------------------------------------------------------
  // Emit via useEffect — runs AFTER the render, never during it.
  // This is the fix for the "setState during render" warning: no parent
  // setState call ever originates from inside our render cycle.
  // ------------------------------------------------------------------
  const lastValid = useRef<boolean | null>(null);

  useEffect(() => {
    const valid = computeValidity(form, mode, baseAmount, amountRemaining);

    if (valid !== lastValid.current) {
      lastValid.current = valid;
      onValidate?.(valid);
    }

    if (valid) {
      onChange(buildProof(form, mode, baseAmount, invoiceCurrency));
    } else {
      onChange(null);
    }
    // onChange / onValidate intentionally excluded — stable callback refs
    // expected from the parent (useCallback). Including them would cause
    // infinite loops if the parent doesn't memoize them.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, mode]);

  // ------------------------------------------------------------------
  // Field setters — plain state updates, no emit calls
  // ------------------------------------------------------------------
  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  // ------------------------------------------------------------------
  // Preset
  // ------------------------------------------------------------------
  const applyPreset = (p: PresetDef) => {
    if (!baseAmount) return;

    const amountRaw =
      mode === "currency"
        ? roundTo2((p.pct / 100) * baseAmount)
        : String(p.pct);

    setPreset(p.key);
    setForm((prev) => ({ ...prev, amountRaw }));
  };

  // ------------------------------------------------------------------
  // Mode toggle (currency ↔ percent)
  // FIX: was previously calling setForm() nested inside setMode()'s
  // updater function, which React treats as setState-during-render.
  // Now both setters are called as independent sequential calls in the
  // same event handler.
  // ------------------------------------------------------------------
  const toggleMode = () => {
    const nextMode: InputMode = mode === "currency" ? "percent" : "currency";
    const currentCurrencyAmt = resolveCurrencyAmt(
      form.amountRaw,
      mode,
      baseAmount,
    );

    let newRaw = "";
    if (nextMode === "percent" && baseAmount > 0 && currentCurrencyAmt > 0) {
      newRaw = roundTo2(Math.min((currentCurrencyAmt / baseAmount) * 100, 100));
    } else if (nextMode === "currency" && currentCurrencyAmt > 0) {
      newRaw = roundTo2(currentCurrencyAmt);
    }

    // Two independent setState calls — React batches them in the same
    // event handler (automatic batching in React 18+) so only one
    // re-render fires, but crucially neither updater calls the other.
    setMode(nextMode);
    setForm((prev) => ({ ...prev, amountRaw: newRaw }));
  };

  // ------------------------------------------------------------------
  // Amount input
  // ------------------------------------------------------------------
  const handleAmountChange = (v: string) => {
    let cleaned = cleanDecimalString(v);

    if (mode === "percent") {
      const n = parseFloat(cleaned);
      if (!isNaN(n) && n > 100) cleaned = "100";
    }

    setPreset("");
    setForm((prev) => ({ ...prev, amountRaw: cleaned }));
  };

  // ------------------------------------------------------------------
  // Derived display values (pure computation from current state)
  // ------------------------------------------------------------------
  const currencyAmt = resolveCurrencyAmt(form.amountRaw, mode, baseAmount);

  const amountError: string | null = (() => {
    if (!form.amountRaw || form.amountRaw === "0") return null;
    if (currencyAmt <= 0) return "Amount must be greater than zero.";
    if (amountRemaining !== undefined && currencyAmt > amountRemaining) {
      return `Exceeds remaining balance of ${invoiceCurrency} ${roundTo2(amountRemaining)}.`;
    }
    return null;
  })();

  const pctHint =
    mode === "percent" && baseAmount > 0 && parseFloat(form.amountRaw) > 0
      ? `= ${invoiceCurrency} ${roundTo2(currencyAmt)}`
      : null;

  const isOther = form.method === "other";

  return (
    <FormRoot>
      {/* Payment method */}
      <CustomFormInput
        id={`${uid}-method`}
        label="Payment Method"
        value={form.method}
        onChange={(v) => setField("method", v as string)}
        options={PAYMENT_METHODS.map((m) => ({
          value: m.value,
          label: m.label,
        }))}
        required
      />

      {/* Custom method — visible only when "Other…" is selected */}
      {isOther && (
        <CustomFormInput
          id={`${uid}-custom-method`}
          label="Specify Payment Method"
          value={form.customMethod}
          onChange={(v) => setField("customMethod", v as string)}
          placeholder="e.g. GCash, Maya, Remittance…"
          required
          maxChar={60}
        />
      )}

      {/* Transaction reference */}
      <CustomFormInput
        id={`${uid}-ref`}
        label="Transaction Reference"
        value={form.reference}
        onChange={(v) => setField("reference", v as string)}
        placeholder="e.g. Bank Ref, GCash Ref, Check #, TxHash…"
        required
        maxChar={120}
      />

      <SectionDivider />

      {/* Amount section */}
      <AmountSection>
        <AmountFieldLabel htmlFor={`${uid}-amount`}>
          Amount Paid <RequiredMark>*</RequiredMark>
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
                    {invoiceCurrency} {roundTo2((p.pct / 100) * baseAmount)}
                  </PresetAmt>
                </PresetBtn>
              ))}
            </PresetGrid>
          </PresetBlock>
        )}

        {/* Toggle badge + input */}
        <AmountRow>
          <ModeBadge
            type="button"
            $pct={mode === "percent"}
            onClick={toggleMode}
            title={
              mode === "currency"
                ? "Switch to percentage input"
                : "Switch to currency amount input"
            }
          >
            {mode === "currency" ? invoiceCurrency : "%"}
          </ModeBadge>

          <CustomFormInput
            id={`${uid}-amount`}
            label=""
            value={form.amountRaw}
            onChange={(v) => handleAmountChange(v as string)}
            type="number"
            placeholder={mode === "currency" ? "0.00" : "0.10 – 100"}
            required
          />
        </AmountRow>

        <AmountHintRow>
          <div>
            {amountError ? (
              <ErrorHint>{amountError}</ErrorHint>
            ) : pctHint ? (
              <HintText>{pctHint}</HintText>
            ) : null}
          </div>
          {amountRemaining !== undefined && (
            <HintText>
              Remaining: {invoiceCurrency}{" "}
              {amountRemaining.toLocaleString(undefined, {
                minimumFractionDigits: 2,
              })}
            </HintText>
          )}
        </AmountHintRow>
      </AmountSection>

      {/* Settlement date & time */}
      <CustomFormInput
        id={`${uid}-settled`}
        label="Settlement Date & Time"
        value={form.settledAt}
        onChange={(v) => setField("settledAt", v as string)}
        type="datetime-local"
        required
      />

      <SectionDivider />

      {/* Proof URL (optional) */}
      <CustomFormInput
        id={`${uid}-proof`}
        label="Proof URL"
        value={form.proofUrl}
        onChange={(v) => setField("proofUrl", v as string)}
        type="url"
        placeholder="https://… receipt image, bank confirmation…"
        hint="Optional — Link to receipt, screenshot, or document"
      />
    </FormRoot>
  );
};
