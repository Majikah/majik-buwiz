/**
 * ActualizeExpenseModal.tsx
 *
 * DynamicPopUp-wrapped actualization form.
 * Replaces the old ActualizeModal (which used its own overlay).
 * Follows the AddRefundModal pattern — owns state, gates confirm button.
 */

import React, { useCallback, useState } from "react";
import styled from "styled-components";
import DynamicPopUp from "@/components/functional/DynamicPopUp";
import { RecurringExpenseItem } from "@/SDK/majik-buwiz-client/src/core/expenses/recurring/recurring-expense";

export type ActualizeMode = "month" | "range";

export interface ActualizeFormData {
  mode: ActualizeMode;
  month?: string;
  rangeFrom?: string;
  rangeTo?: string;
  strict: boolean;
}

interface ActualizationResult {
  created: any[];
  skipped: string[];
  ineligible: string[];
  total: number;
}

interface ActualizeExpenseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: RecurringExpenseItem;
  onSubmit: (itemId: string, data: ActualizeFormData) => Promise<ActualizationResult>;
}

// ── Styled ────────────────────────────────────────────────────────────────────

const FormRoot = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const ItemPreview = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  background: ${({ theme }) => theme.colors.primarySoft};
  border: 1px solid ${({ theme }) => theme.colors.primary}20;
  border-radius: ${({ theme }) => theme.borders?.radius?.medium ?? "6px"};
  flex-wrap: wrap;
`;

const ItemName = styled.span`
  font-family: ${({ theme }) => theme.typography?.fonts?.medium ?? "sans-serif"};
  font-size: 13px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textPrimary};
`;

const ItemMeta = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
`;

const Chip = styled.span`
  font-family: ${({ theme }) => theme.typography?.fonts?.medium ?? "sans-serif"};
  font-size: 10px;
  padding: 2px 8px;
  border-radius: ${({ theme }) => theme.borders?.radius?.rounded ?? "99px"};
  background: ${({ theme }) => theme.colors.primarySoft};
  color: ${({ theme }) => theme.colors.primary};
  border: 1px solid ${({ theme }) => theme.colors.primary}22;
  white-space: nowrap;
`;

const AmountText = styled.span`
  font-family: ${({ theme }) => theme.typography?.fonts?.numbers ?? "monospace"};
  font-size: 14px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.primary};
`;

const SectionLabel = styled.div`
  font-size: 10px;
  font-family: ${({ theme }) => theme.typography?.fonts?.semibold ?? "sans-serif"};
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.primary};
  margin-bottom: 8px;
`;

const ModeToggle = styled.div`
  display: flex;
  border: 1px solid ${({ theme }) => theme.colors.primary}22;
  border-radius: ${({ theme }) => theme.borders?.radius?.medium ?? "6px"};
  overflow: hidden;
  width: fit-content;
`;

const ModeBtn = styled.button<{ $active?: boolean }>`
  font-family: ${({ theme }) => theme.typography?.fonts?.medium ?? "sans-serif"};
  font-size: 11px;
  padding: 6px 14px;
  border: none;
  cursor: pointer;
  transition: all 0.15s;
  background: ${({ $active, theme }) =>
    $active ? theme.colors.primarySoft : "transparent"};
  color: ${({ $active, theme }) =>
    $active ? theme.colors.primary : theme.colors.textSecondary};
  border-right: 1px solid ${({ theme }) => theme.colors.primary}15;

  &:last-child { border-right: none; }
  &:hover {
    background: ${({ theme }) => theme.colors.primarySoft};
    color: ${({ theme }) => theme.colors.primary};
  }
`;

const FieldGrid = styled.div<{ $cols?: number }>`
  display: grid;
  grid-template-columns: repeat(${({ $cols = 1 }) => $cols}, 1fr);
  gap: 12px;
`;

const FormGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 5px;
`;

const FieldLabel = styled.label`
  font-size: 10px;
  font-family: ${({ theme }) => theme.typography?.fonts?.semibold ?? "sans-serif"};
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: ${({ theme }) => theme.colors.textSecondary};
`;

const FieldInput = styled.input`
  background: ${({ theme }) => theme.colors.secondaryBackground};
  border: 1px solid ${({ theme }) => theme.colors.primary}20;
  border-radius: ${({ theme }) => theme.borders?.radius?.medium ?? "6px"};
  color: ${({ theme }) => theme.colors.textPrimary};
  font-family: ${({ theme }) => theme.typography?.fonts?.numbers ?? "monospace"};
  font-size: 13px;
  padding: 8px 10px;
  outline: none;
  transition: border-color 0.15s;
  width: 100%;
  box-sizing: border-box;

  &:focus {
    border-color: ${({ theme }) => theme.colors.primary};
    box-shadow: 0 0 0 2px ${({ theme }) => theme.colors.primary}18;
  }
`;

const Divider = styled.div`
  height: 1px;
  background: ${({ theme }) => theme.colors.primary}12;
`;

const StrictRow = styled.label`
  display: flex;
  align-items: flex-start;
  gap: 10px;
  cursor: pointer;
  font-size: 12px;
  font-family: ${({ theme }) => theme.typography?.fonts?.light ?? "sans-serif"};
  color: ${({ theme }) => theme.colors.textSecondary};
  line-height: 1.5;
`;

const StrictCheck = styled.input`
  width: 14px;
  height: 14px;
  margin-top: 2px;
  accent-color: ${({ theme }) => theme.colors.primary};
  cursor: pointer;
  flex-shrink: 0;
`;

const ResultBox = styled.div<{ $success?: boolean }>`
  padding: 10px 12px;
  border-radius: ${({ theme }) => theme.borders?.radius?.medium ?? "6px"};
  background: ${({ $success, theme }) =>
    $success ? theme.colors.brand.green + "18" : theme.colors.error + "18"};
  border: 1px solid ${({ $success, theme }) =>
    $success ? theme.colors.brand?.green + "44" : theme.colors.error + "44"};
  font-size: 12px;
  font-family: ${({ theme }) => theme.typography?.fonts?.light ?? "sans-serif"};
  color: ${({ $success, theme }) =>
    $success ? theme.colors.brand?.green ?? "#3ecf82" : theme.colors.error};
`;

const ResultRow = styled.div`
  display: flex;
  justify-content: space-between;
  padding: 2px 0;
`;

// ── Helpers ───────────────────────────────────────────────────────────────────

const currentMonth = () => new Date().toISOString().slice(0, 7);

const fmtCurrency = (amount: number, currency = "PHP") =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency }).format(amount);

// ── Component ─────────────────────────────────────────────────────────────────

export const ActualizeExpenseModal: React.FC<ActualizeExpenseModalProps> = React.memo(
  ({ open, onOpenChange, item, onSubmit }) => {
    const [mode, setMode] = useState<ActualizeMode>("month");
    const [month, setMonth] = useState(currentMonth());
    const [rangeFrom, setRangeFrom] = useState(currentMonth());
    const [rangeTo, setRangeTo] = useState(currentMonth());
    const [strict, setStrict] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [result, setResult] = useState<ActualizationResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    const isActive = item.status === "active";

    const handleConfirm = useCallback(async () => {
      setIsSubmitting(true);
      setError(null);
      setResult(null);
      try {
        const data: ActualizeFormData = {
          mode,
          strict,
          ...(mode === "month" ? { month } : { rangeFrom, rangeTo }),
        };
        const res = await onSubmit(item.id, data);
        setResult(res);
      } catch (err: any) {
        setError(err?.message ?? "Actualization failed.");
      } finally {
        setIsSubmitting(false);
      }
    }, [mode, strict, month, rangeFrom, rangeTo, item.id, onSubmit]);

    // Once a result is shown, close button replaces confirm
    const isDone = !!result;

    return (
      <DynamicPopUp
        scrollable
        isOpen={open}
        onOpenChange={onOpenChange}
        modal={{
          title: "Actualize Expense",
          description:
            "Convert this recurring template into an actual expense record.",
        }}
        buttons={{
          cancel: {
            text: isDone ? "Close" : "Cancel",
            isDisabled: isSubmitting,
          },
          confirm: {
            text: isSubmitting ? "Actualizing…" : "Actualize",
            onClick: handleConfirm,
            isDisabled: isSubmitting || !isActive || isDone,
          },
        }}
      >
        <FormRoot>
          {/* Item preview */}
          <ItemPreview>
            <div>
              <ItemName>{item.name}</ItemName>
              {item.payee?.legalName && (
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--color-text-secondary, #888)",
                    marginTop: 2,
                  }}
                >
                  {item.payee.legalName}
                </div>
              )}
            </div>
            <ItemMeta>
              <AmountText>
                {fmtCurrency(item.amount, item.currency)}
              </AmountText>
              <Chip>{item.frequency.toUpperCase()}</Chip>
              <Chip
                style={{
                  color:
                    item.status === "active"
                      ? "var(--color-success, #3ecf82)"
                      : undefined,
                }}
              >
                {item.status.toUpperCase()}
              </Chip>
            </ItemMeta>
          </ItemPreview>

          {/* Period mode */}
          <div>
            <SectionLabel>Actualization Period</SectionLabel>
            <ModeToggle>
              <ModeBtn
                $active={mode === "month"}
                onClick={() => setMode("month")}
              >
                Single Month
              </ModeBtn>
              <ModeBtn
                $active={mode === "range"}
                onClick={() => setMode("range")}
              >
                Date Range
              </ModeBtn>
            </ModeToggle>
          </div>

          {mode === "month" ? (
            <FormGroup>
              <FieldLabel>Month</FieldLabel>
              <FieldInput
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
              />
            </FormGroup>
          ) : (
            <FieldGrid $cols={2}>
              <FormGroup>
                <FieldLabel>From</FieldLabel>
                <FieldInput
                  type="month"
                  value={rangeFrom}
                  onChange={(e) => setRangeFrom(e.target.value)}
                />
              </FormGroup>
              <FormGroup>
                <FieldLabel>To</FieldLabel>
                <FieldInput
                  type="month"
                  value={rangeTo}
                  min={rangeFrom}
                  onChange={(e) => setRangeTo(e.target.value)}
                />
              </FormGroup>
            </FieldGrid>
          )}

          <Divider />

          {/* Strict mode */}
          <StrictRow>
            <StrictCheck
              type="checkbox"
              checked={strict}
              onChange={(e) => setStrict(e.target.checked)}
            />
            <span>
              <strong style={{ fontWeight: 600 }}>Strict mode</strong> — throw
              an error if this month has already been actualized. Default
              behavior silently skips duplicates.
            </span>
          </StrictRow>

          {/* Result */}
          {result && (
            <ResultBox $success>
              <div style={{ fontWeight: 700, marginBottom: 6, fontSize: 12 }}>
                ✓ Actualization complete
              </div>
              <ResultRow>
                <span>Records created</span>
                <strong>{result.created.length}</strong>
              </ResultRow>
              <ResultRow>
                <span>Skipped (duplicate)</span>
                <strong>{result.skipped.length}</strong>
              </ResultRow>
              <ResultRow>
                <span>Ineligible</span>
                <strong>{result.ineligible.length}</strong>
              </ResultRow>
              <ResultRow>
                <span>Total months</span>
                <strong>{result.total}</strong>
              </ResultRow>
            </ResultBox>
          )}

          {/* Error */}
          {error && (
            <ResultBox>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>
                ✕ Error
              </div>
              <div>{error}</div>
            </ResultBox>
          )}
        </FormRoot>
      </DynamicPopUp>
    );
  },
);

ActualizeExpenseModal.displayName = "ActualizeExpenseModal";