"use client";

import React from "react";
import styled, { css } from "styled-components";
import type { InvoiceReferenceType } from "./_utils";
import {
  REFERENCE_TYPE_OPTIONS,
  REFERENCE_CATEGORY,
  CATEGORY_LABEL,
  getInvoiceReferenceTypeMeta,
} from "./_utils";

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

// Category badge colours — independent of primary brand colour
const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  commercial: { bg: "#3b82f620", text: "#3b82f6" }, // blue
  financial: { bg: "#22c55e20", text: "#22c55e" }, // green
  logistics: { bg: "#f59e0b20", text: "#f59e0b" }, // amber
  project: { bg: "#a855f720", text: "#a855f7" }, // purple
  internal: { bg: "#64748b20", text: "#64748b" }, // slate
  other: { bg: "#ec489920", text: "#ec4899" }, // pink
};

const CategoryBadge = styled.span<{
  $category: string;
  $selected: boolean;
}>`
  flex-shrink: 0;
  font-family: ${({ theme }) => theme.typography.fonts.semibold};
  font-size: 8px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  padding: 2px 6px;
  border-radius: 999px;
  opacity: ${({ $selected }) => ($selected ? 1 : 0.55)};
  transition: opacity 0.12s ease;
  background: ${({ $category }) =>
    CATEGORY_COLORS[$category]?.bg ?? "#94a3b820"};
  color: ${({ $category }) => CATEGORY_COLORS[$category]?.text ?? "#94a3b8"};
`;

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

interface InvoiceReferenceTypePickerProps {
  value?: InvoiceReferenceType;
  onChange: (v: InvoiceReferenceType | undefined) => void;
  readonly?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const InvoiceReferenceTypePicker: React.FC<
  InvoiceReferenceTypePickerProps
> = ({ value, onChange, readonly = false }) => {
  const selectedMeta = value ? getInvoiceReferenceTypeMeta(value) : null;

  // Readonly: show title + description of selected type only
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
        {REFERENCE_TYPE_OPTIONS.map((type) => {
          const meta = getInvoiceReferenceTypeMeta(type);
          const selected = value === type;
          const category = REFERENCE_CATEGORY[type];

          return (
            <Card
              key={type}
              $selected={selected}
              $readonly={false}
              onClick={() => onChange(selected ? undefined : type)}
              type="button"
              title={meta.description}
            >
              <CardHeader>
                <Title $selected={selected}>{meta.title}</Title>
                <CategoryBadge $category={category} $selected={selected}>
                  {CATEGORY_LABEL[category]}
                </CategoryBadge>
              </CardHeader>
            </Card>
          );
        })}
      </Grid>

      {/* Expanded description for the selected type */}
      {selectedMeta && (
        <SelectedDescription>{selectedMeta.description}</SelectedDescription>
      )}
    </div>
  );
};
