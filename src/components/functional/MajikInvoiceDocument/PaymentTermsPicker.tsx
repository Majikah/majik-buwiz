"use client";

import React from "react";
import styled, { css } from "styled-components";
import type { PaymentTerms } from "@majikah/majik-invoice";
import { getPaymentTermMeta } from "./_utils";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ALL_TERMS: PaymentTerms[] = [
  "immediate",
  "prepaid",
  "cod",
  "net7",
  "net15",
  "net30",
  "net60",
  "net90",
  "eom",
  "custom",
];

// Quick-glance badge: how "fast" is this term?
const TERM_SPEED: Record<
  PaymentTerms,
  "instant" | "fast" | "standard" | "extended" | "flexible"
> = {
  immediate: "instant",
  prepaid: "instant",
  cod: "instant",
  net7: "fast",
  net15: "fast",
  net30: "standard",
  net60: "extended",
  net90: "extended",
  eom: "flexible",
  custom: "flexible",
};

const SPEED_LABEL: Record<string, string> = {
  instant: "Instant",
  fast: "Fast",
  standard: "Standard",
  extended: "Extended",
  flexible: "Flexible",
};

// ---------------------------------------------------------------------------
// Styled
// ---------------------------------------------------------------------------

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 8px;
`;

const Card = styled.button<{ $selected: boolean; $readonly: boolean }>`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  padding: 10px 12px;
  border-radius: ${({ theme }) => theme.borders.radius.big};
  border: 1px solid
    ${({ theme, $selected }) =>
      $selected ? theme.colors.primary : `${theme.colors.primary}20`};
  background: ${({ theme, $selected }) =>
    $selected ? `${theme.colors.primary}12` : theme.colors.secondaryBackground};
  cursor: ${({ $readonly }) => ($readonly ? "default" : "pointer")};
  text-align: left;
  transition:
    border-color 0.12s ease,
    background 0.12s ease,
    transform 0.1s ease;
  width: 100%;

  ${({ $readonly, $selected, theme }) =>
    !$readonly &&
    css`
      &:hover {
        border-color: ${theme.colors.primary}80;
        background: ${$selected
          ? `${theme.colors.primary}18`
          : `${theme.colors.primary}08`};
        transform: translateY(-1px);
      }
      &:active {
        transform: translateY(0);
      }
    `}
`;

const CardHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  gap: 6px;
`;

const Title = styled.span<{ $selected: boolean }>`
  font-family: ${({ theme }) => theme.typography.fonts.semibold};
  font-size: 12px;
  color: ${({ theme, $selected }) =>
    $selected ? theme.colors.primary : theme.colors.textPrimary};
  transition: color 0.12s ease;
  line-height: 1.3;
`;

const SpeedBadge = styled.span<{ $speed: string; $selected: boolean }>`
  flex-shrink: 0;
  font-family: ${({ theme }) => theme.typography.fonts.semibold};
  font-size: 8px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  padding: 2px 6px;
  border-radius: 999px;
  opacity: ${({ $selected }) => ($selected ? 1 : 0.55)};
  transition: opacity 0.12s ease;

  ${({ $speed, theme }) => {
    switch ($speed) {
      case "instant":
        return css`
          background: ${theme.colors.primary}20;
          color: ${theme.colors.primary};
        `;
      case "fast":
        return css`
          background: #22c55e20;
          color: #22c55e;
        `;
      case "standard":
        return css`
          background: #3b82f620;
          color: #3b82f6;
        `;
      case "extended":
        return css`
          background: #f59e0b20;
          color: #f59e0b;
        `;
      default: // flexible
        return css`
          background: #a855f720;
          color: #a855f7;
        `;
    }
  }}
`;

// const Description = styled.span`
//   font-family: ${({ theme }) => theme.typography.fonts.regular};
//   font-size: 11px;
//   line-height: 1.5;
//   color: ${({ theme }) =>
//     theme.colors.textSecondary ?? `${theme.colors.textPrimary}80`};
// `;

const SelectedDescription = styled.div`
  margin-top: 12px;
  padding: 10px 12px;
  border-radius: ${({ theme }) => theme.borders.radius.big};
  background: ${({ theme }) => theme.colors.primary}08;
  border: 1px solid ${({ theme }) => theme.colors.primary}20;
  font-family: ${({ theme }) => theme.typography.fonts.regular};
  font-size: 12px;
  line-height: 1.6;
  color: ${({ theme }) => theme.colors.textPrimary};
  animation: fadeIn 0.15s ease;

  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(-2px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
`;

const ReadonlyDisplay = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const ReadonlyTitle = styled.div`
  font-family: ${({ theme }) => theme.typography.fonts.semibold};
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textPrimary};
`;

const ReadonlyDesc = styled.div`
  font-family: ${({ theme }) => theme.typography.fonts.regular};
  font-size: 12px;
  line-height: 1.5;
  color: ${({ theme }) =>
    theme.colors.textSecondary ?? `${theme.colors.textPrimary}80`};
`;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PaymentTermsPickerProps {
  value?: PaymentTerms;
  onChange: (v: PaymentTerms | undefined) => void;
  readonly?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const PaymentTermsPicker: React.FC<PaymentTermsPickerProps> = ({
  value,
  onChange,
  readonly = false,
}) => {
  const selectedMeta = value ? getPaymentTermMeta(value) : null;

  // Readonly: just show title + description of the selected term
  if (readonly) {
    if (!selectedMeta) return null;
    return (
      <ReadonlyDisplay>
        <ReadonlyTitle>{selectedMeta.title}</ReadonlyTitle>
        <ReadonlyDesc>{selectedMeta.description}</ReadonlyDesc>
      </ReadonlyDisplay>
    );
  }

  return (
    <div>
      <Grid>
        {ALL_TERMS.map((term) => {
          const meta = getPaymentTermMeta(term);
          const selected = value === term;
          const speed = TERM_SPEED[term];

          return (
            <Card
              key={term}
              $selected={selected}
              $readonly={false}
              onClick={() => onChange(selected ? undefined : term)}
              type="button"
              title={meta.description}
            >
              <CardHeader>
                <Title $selected={selected}>{meta.title}</Title>
                <SpeedBadge $speed={speed} $selected={selected}>
                  {SPEED_LABEL[speed]}
                </SpeedBadge>
              </CardHeader>
            </Card>
          );
        })}
      </Grid>

      {/* Expanded description for the selected term */}
      {selectedMeta && (
        <SelectedDescription>{selectedMeta.description}</SelectedDescription>
      )}
    </div>
  );
};
