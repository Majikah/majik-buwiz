import React, { useEffect, useRef, useState } from "react";
import styled from "styled-components";
import { EditableField } from "./EditableField";
import type {
  ISODateString,
  CurrencyCode,
  PaymentTerms,
  Period,
} from "@majikah/majik-invoice";
import { PaymentTermsPicker } from "./PaymentTermsPicker";
import { computeDueDateFromTerm } from "./_utils";

// ---------------------------------------------------------------------------
// Styled
// ---------------------------------------------------------------------------

const MetaGrid = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.small};
  margin-bottom: ${({ theme }) => theme.spacing.medium};
  padding: ${({ theme }) => theme.spacing.medium};
  background: ${({ theme }) => theme.colors.secondaryBackground};
  border-radius: ${({ theme }) => theme.borders.radius.big};
  border: 1px solid ${({ theme }) => theme.colors.primary}15;
`;

const RequiredRow = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: ${({ theme }) => theme.spacing.small};
`;

const Divider = styled.div`
  height: 1px;
  background: ${({ theme }) => theme.colors.primary}15;
  margin: 2px 0;
`;

const OptionalsBar = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing.small};
  align-items: center;
`;

const ToggleChip = styled.button<{ $active: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 999px;
  border: 1px solid
    ${({ theme, $active }) =>
      $active ? theme.colors.primary : `${theme.colors.primary}40`};
  background: ${({ theme, $active }) =>
    $active ? `${theme.colors.primary}18` : "transparent"};
  color: ${({ theme, $active }) =>
    $active ? theme.colors.primary : `${theme.colors.primary}80`};
  font-family: ${({ theme }) => theme.typography.fonts.semibold};
  font-size: 10px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    border-color: ${({ theme }) => theme.colors.primary};
    color: ${({ theme }) => theme.colors.primary};
  }

  &::before {
    content: "";
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: ${({ theme, $active }) =>
      $active ? theme.colors.primary : `${theme.colors.primary}40`};
    transition: background 0.15s ease;
  }
`;

// Row for compact date-like fields (due date, period start/end)
const DateFieldsRow = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: ${({ theme }) => theme.spacing.small};
  animation: fadeIn 0.15s ease;

  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(-4px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
`;

// Payment terms gets its own full-width section
const PaymentTermsSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  animation: fadeIn 0.15s ease;

  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(-4px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
`;

const MetaCell = styled.div``;

const CellLabel = styled.div`
  font-family: ${({ theme }) => theme.typography.fonts.semibold};
  font-size: 9px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.primary};
  margin-bottom: 5px;
`;

// Small inline note shown when due date was auto-set
const AutoSetNote = styled.span`
  font-family: ${({ theme }) => theme.typography.fonts.regular};
  font-size: 10px;
  color: ${({ theme }) => theme.colors.primary}80;
  margin-left: 6px;
  font-style: italic;
`;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CURRENCIES: CurrencyCode[] = [
  "PHP",
  "USD",
  "EUR",
  "SGD",
  "AUD",
  "GBP",
  "JPY",
  "HKD",
  "CNY",
];

// Terms that imply an automatic due date
const AUTO_DATE_TERMS = new Set<PaymentTerms>([
  "immediate",
  "net7",
  "net15",
  "net30",
  "net60",
  "net90",
  "eom",
]);

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface DatesMetaProps {
  issueDate: ISODateString;
  dueDate?: ISODateString;
  currency: CurrencyCode;
  paymentTerms?: PaymentTerms;
  period?: Period;
  readonly: boolean;
  onIssueDateChange: (v: ISODateString) => void;
  onDueDateChange: (v: ISODateString | undefined) => void;
  onCurrencyChange: (v: CurrencyCode) => void;
  onPaymentTermsChange: (
    term: PaymentTerms | undefined,
    computedDueDate?: ISODateString,
  ) => void;
  onPeriodChange?: (v: Period | undefined) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const DatesMetaComponent: React.FC<DatesMetaProps> = ({
  issueDate,
  dueDate,
  currency,
  paymentTerms,
  period,
  readonly,
  onIssueDateChange,
  onDueDateChange,
  onCurrencyChange,
  onPaymentTermsChange,
  onPeriodChange,
}) => {
  const [showDueDate, setShowDueDate] = useState(!!dueDate);
  const [showPaymentTerms, setShowPaymentTerms] = useState(!!paymentTerms);
  const [showPeriod, setShowPeriod] = useState(!!period);
  // Track whether the current due date was auto-computed (so we can show the note)
  const [dueDateAutoSet, setDueDateAutoSet] = useState(
    () => !!paymentTerms && AUTO_DATE_TERMS.has(paymentTerms) && !dueDate, // if we're about to auto-set it, flag it immediately
  );

  const hasInitialized = useRef(false);

  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    // Only auto-set if: a term is already set, it implies a date, and no due date exists yet
    if (paymentTerms && AUTO_DATE_TERMS.has(paymentTerms) && !dueDate) {
      const computed = computeDueDateFromTerm(issueDate, paymentTerms);
      if (computed) {
        onPaymentTermsChange(paymentTerms, computed);
        setShowDueDate(true);
        setDueDateAutoSet(true);
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleToggleDueDate = () => {
    const next = !showDueDate;
    setShowDueDate(next);
    setDueDateAutoSet(false);
    if (!next) onDueDateChange(undefined);
  };

  const handleTogglePaymentTerms = () => {
    const next = !showPaymentTerms;
    setShowPaymentTerms(next);
    if (!next) {
      onPaymentTermsChange(undefined);
      // Don't clear due date on payment terms removal — user may have adjusted it
    }
  };

  const handleTogglePeriod = () => {
    const next = !showPeriod;
    setShowPeriod(next);
    if (!next) onPeriodChange?.(undefined);
  };

  const handlePaymentTermsChange = (term: PaymentTerms | undefined) => {
    if (!term) {
      onPaymentTermsChange(undefined);
      return;
    }

    if (AUTO_DATE_TERMS.has(term)) {
      const computed = computeDueDateFromTerm(issueDate, term);
      if (computed) {
        // Pass both in one shot — parent will apply as a single patch
        onPaymentTermsChange(term, computed);
        setShowDueDate(true);
        setDueDateAutoSet(true);
      } else {
        onPaymentTermsChange(term);
      }
    } else {
      setDueDateAutoSet(false);
      onPaymentTermsChange(term);
    }
  };

  const handleIssueDateChange = (v: ISODateString) => {
    onIssueDateChange(v);
    // Re-compute due date if it was auto-set and a term is still selected
    if (dueDateAutoSet && paymentTerms && AUTO_DATE_TERMS.has(paymentTerms)) {
      const computed = computeDueDateFromTerm(v, paymentTerms);
      if (computed) onDueDateChange(computed);
    }
  };

  const hasDateFields = showDueDate || (showPeriod && !!onPeriodChange);

  return (
    <MetaGrid>
      {/* ── Required fields ─────────────────────────────────── */}
      <RequiredRow>
        <MetaCell>
          <CellLabel>Issue Date</CellLabel>
          <EditableField
            block
            label="YYYY-MM-DD"
            type="date"
            value={issueDate}
            onChange={handleIssueDateChange}
            readonly={readonly}
            inputStyle={{ fontSize: "13px" }}
            maxChar={20}
          />
        </MetaCell>

        <MetaCell>
          <CellLabel>Currency</CellLabel>
          <EditableField
            as="select"
            block
            label="ISO 4217"
            value={currency}
            onChange={(v) => onCurrencyChange(v as CurrencyCode)}
            readonly={readonly}
            options={CURRENCIES.map((c) => ({ value: c, label: c }))}
            inputStyle={{ fontSize: "13px" }}
            maxChar={4}
          />
        </MetaCell>
      </RequiredRow>

      {/* ── Optional toggles (edit mode only) ───────────────── */}
      {!readonly && (
        <>
          <Divider />
          <OptionalsBar>
            <ToggleChip $active={showDueDate} onClick={handleToggleDueDate}>
              Due Date
            </ToggleChip>
            <ToggleChip
              $active={showPaymentTerms}
              onClick={handleTogglePaymentTerms}
            >
              Payment Terms
            </ToggleChip>
            {onPeriodChange && (
              <ToggleChip $active={showPeriod} onClick={handleTogglePeriod}>
                Service Period
              </ToggleChip>
            )}
          </OptionalsBar>
        </>
      )}

      {/* ── Due date + Period (compact date fields in one row) ── */}
      {hasDateFields && (
        <DateFieldsRow>
          {showDueDate && (
            <MetaCell>
              <CellLabel>
                Due Date
                {dueDateAutoSet && !readonly && (
                  <AutoSetNote>auto-set</AutoSetNote>
                )}
              </CellLabel>
              <EditableField
                block
                label="YYYY-MM-DD"
                type="date"
                value={dueDate ?? ""}
                onChange={(v) => {
                  setDueDateAutoSet(false); // manual edit clears auto-set
                  onDueDateChange(v || undefined);
                }}
                readonly={readonly}
                inputStyle={{ fontSize: "13px" }}
              />
            </MetaCell>
          )}

          {showPeriod && onPeriodChange && (
            <>
              <MetaCell>
                <CellLabel>Period Start</CellLabel>
                <EditableField
                  block
                  label="Service Period Start"
                  type="date"
                  value={period?.start ?? ""}
                  onChange={(v) =>
                    onPeriodChange(
                      v ? { start: v, end: period?.end ?? v } : undefined,
                    )
                  }
                  readonly={readonly}
                  inputStyle={{ fontSize: "13px" }}
                />
              </MetaCell>
              <MetaCell>
                <CellLabel>Period End</CellLabel>
                <EditableField
                  block
                  label="Service Period End"
                  type="date"
                  value={period?.end ?? ""}
                  onChange={(v) =>
                    onPeriodChange(
                      v ? { start: period?.start ?? v, end: v } : undefined,
                    )
                  }
                  readonly={readonly}
                  inputStyle={{ fontSize: "13px" }}
                />
              </MetaCell>
            </>
          )}
        </DateFieldsRow>
      )}

      {/* ── Payment Terms (full-width, below date fields) ─────── */}
      {showPaymentTerms && (
        <PaymentTermsSection>
          {!readonly && <Divider />}
          <MetaCell>
            <CellLabel>Payment Terms</CellLabel>
            <PaymentTermsPicker
              value={paymentTerms}
              onChange={handlePaymentTermsChange}
              readonly={readonly}
            />
          </MetaCell>
        </PaymentTermsSection>
      )}
    </MetaGrid>
  );
};

export const DatesMeta = React.memo(DatesMetaComponent);
