// components/expenses/modals/UniformTaxModal.tsx
import React, { useCallback, useState } from "react";
import styled from "styled-components";
import DynamicPopUp from "@/components/functional/DynamicPopUp";
import type { LineItemInput } from "@majikah/majik-invoice";
import { TaxManager } from "@majikah/majik-invoice";
import { CheckCircleIcon } from "@phosphor-icons/react";

// ---------------------------------------------------------------------------
// Styled
// ---------------------------------------------------------------------------

const ItemList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const ItemRow = styled.button<{ $selected: boolean }>`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  text-align: left;
  padding: 10px 12px;
  border-radius: ${({ theme }) => theme.borders.radius.medium};
  border: 1.5px solid
    ${({ theme, $selected }) =>
      $selected ? theme.colors.primary : `${theme.colors.primary}22`};
  background: ${({ theme, $selected }) =>
    $selected ? `${theme.colors.primary}0d` : theme.colors.primaryBackground};
  cursor: pointer;
  transition:
    border-color 0.15s,
    background 0.15s;

  &:hover {
    border-color: ${({ theme }) => `${theme.colors.primary}66`};
  }
`;

const ItemLeft = styled.div`
  flex: 1;
  min-width: 0;
`;

const ItemDesc = styled.div`
  font-family: ${({ theme }) => theme.typography.fonts.semibold};
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textPrimary};
  margin-bottom: 5px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const TaxTags = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
`;

const TaxTag = styled.span`
  font-size: 10px;
  font-family: ${({ theme }) => theme.typography.fonts.regular};
  padding: 2px 7px;
  border-radius: 999px;
  background: ${({ theme }) => `${theme.colors.primary}15`};
  color: ${({ theme }) => theme.colors.primary};
`;

const WithholdingTag = styled(TaxTag)`
  background: ${({ theme }) => `${theme.colors.primary ?? "#f59e0b"}18`};
  color: ${({ theme }) => theme.colors.primary ?? "#f59e0b"};
`;

const NoTaxNote = styled.span`
  font-size: 10px;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.5;
  font-style: italic;
`;

const SelectedCheck = styled.div`
  color: ${({ theme }) => theme.colors.primary};
  flex-shrink: 0;
  padding-top: 1px;
`;

const PreviewNote = styled.div`
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textSecondary};
  margin-top: 12px;
  padding: 8px 10px;
  border-radius: ${({ theme }) => theme.borders.radius.small};
  background: ${({ theme }) => `${theme.colors.primary}08`};
  border: 1px solid ${({ theme }) => `${theme.colors.primary}15`};
  line-height: 1.5;
`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface TaxLabel {
  text: string;
  isWithholding: boolean;
}

function getTaxLabels(item: LineItemInput): TaxLabel[] {
  try {
    return TaxManager.coerce(item.taxes)
      .toArray()
      .map((t) => ({
        text: `${t.label ?? t.taxType} ${
          (t.rate * 100) % 1 === 0
            ? (t.rate * 100).toFixed(0)
            : (t.rate * 100).toFixed(2)
        }%`,
        isWithholding: t.behaviour === "withholding",
      }));
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface UniformTaxModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: LineItemInput[];
  currency: string;
  onApply: (sourceLineItemId: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const UniformTaxModal: React.FC<UniformTaxModalProps> = React.memo(
  ({ open, onOpenChange, items, onApply }) => {
    const [selectedId, setSelectedId] = useState<string | null>(
      items[0]?.id ?? null,
    );

    const handleConfirm = useCallback(() => {
      if (!selectedId) return;
      onApply(selectedId);
    }, [selectedId, onApply]);

    const selectedItem = items.find((li) => li.id === selectedId);
    const selectedLabels = selectedItem ? getTaxLabels(selectedItem) : [];
    const otherCount = items.length - 1;

    return (
      <DynamicPopUp
        scrollable
        isOpen={open}
        onOpenChange={onOpenChange}
        modal={{
          title: "Apply Uniform Tax",
          description:
            "Select which line item's tax configuration should be copied to all others.",
        }}
        buttons={{
          cancel: { text: "Cancel" },
          confirm: {
            text: `Apply to All ${items.length} Items`,
            onClick: handleConfirm,
            isDisabled: !selectedId,
          },
        }}
      >
        <ItemList>
          {items.map((li) => {
            const labels = getTaxLabels(li);
            const isSelected = li.id === selectedId;

            return (
              <ItemRow
                key={li.id}
                type="button"
                $selected={isSelected}
                onClick={() => setSelectedId(li.id!)}
              >
                <ItemLeft>
                  <ItemDesc>
                    {li.description || (
                      <em style={{ opacity: 0.45 }}>Untitled item</em>
                    )}
                  </ItemDesc>
                  <TaxTags>
                    {labels.length > 0 ? (
                      labels.map((label, i) =>
                        label.isWithholding ? (
                          <WithholdingTag key={i}>{label.text}</WithholdingTag>
                        ) : (
                          <TaxTag key={i}>{label.text}</TaxTag>
                        ),
                      )
                    ) : (
                      <NoTaxNote>No taxes</NoTaxNote>
                    )}
                  </TaxTags>
                </ItemLeft>
                {isSelected && (
                  <SelectedCheck>
                    <CheckCircleIcon size={16} weight="fill" />
                  </SelectedCheck>
                )}
              </ItemRow>
            );
          })}
        </ItemList>

        {selectedItem && (
          <PreviewNote>
            {selectedLabels.length > 0 ? (
              <>
                <strong>{selectedItem.description || "This item"}</strong> has{" "}
                {selectedLabels.map((l) => l.text).join(", ")}. These will
                replace the taxes on the other {otherCount} line{" "}
                {otherCount === 1 ? "item" : "items"}.
              </>
            ) : (
              <>
                <strong>{selectedItem.description || "This item"}</strong> has
                no taxes. All other {otherCount} line{" "}
                {otherCount === 1 ? "item" : "items"} will have their taxes
                cleared.
              </>
            )}
          </PreviewNote>
        )}
      </DynamicPopUp>
    );
  },
);

UniformTaxModal.displayName = "UniformTaxModal";
