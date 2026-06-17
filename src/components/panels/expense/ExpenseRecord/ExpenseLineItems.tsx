import React, { useCallback, useState } from "react";
import styled from "styled-components";

import type { LineItemInput } from "@majikah/majik-invoice";
import { TaxManager } from "@majikah/majik-invoice";
import { LineItemsTable } from "@/components/functional/MajikInvoiceDocument/LineItemsTable";

import { SlidersHorizontalIcon } from "@phosphor-icons/react";
import { LineItemTaxModal } from "../modals/LineItemTaxModal";
import { UniformTaxModal } from "../modals/UniformTaxModal";

// ---------------------------------------------------------------------------
// Styled
// ---------------------------------------------------------------------------

const Wrapper = styled.div`
  margin-bottom: ${({ theme }) => theme.spacing.medium};
`;

const SectionHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
`;

const SectionLabel = styled.div`
  font-family: ${({ theme }) => theme.typography.fonts.semibold};
  font-size: 9px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.primary};
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;

  &::after {
    content: "";
    flex: 1;
    height: 1px;
    background: ${({ theme }) => theme.colors.primary}18;
  }
`;

const UniformTaxButton = styled.button`
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 5px;
  font-family: ${({ theme }) => theme.typography.fonts.regular};
  font-size: 10px;
  color: ${({ theme }) => theme.colors.primary};
  background: ${({ theme }) => theme.colors.primarySoft};
  border: 1px solid ${({ theme }) => theme.colors.primary}33;
  border-radius: ${({ theme }) => theme.borders.radius.small};
  padding: 3px 9px;
  cursor: pointer;
  transition: opacity 0.15s;
  margin-left: 10px;

  &:hover {
    opacity: 0.75;
  }
  &:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }
`;

const EmptyNote = styled.div`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.5;
  padding: 8px 0;
`;

// ---------------------------------------------------------------------------
// Default-tax inheritance
//
// When the caller adds a new line item (next.length > prev.length), we copy
// the last existing item's taxes onto every newly appended item that arrives
// with no taxes yet.
// ---------------------------------------------------------------------------

function inheritTaxesForNewItems(
  prev: LineItemInput[],
  next: LineItemInput[],
): LineItemInput[] {
  if (next.length <= prev.length) return next; // deletion or same — don't touch

  const lastTaxes =
    prev.length > 0
      ? TaxManager.coerce(prev[prev.length - 1].taxes).toArray()
      : [];

  if (lastTaxes.length === 0) return next; // nothing to inherit

  return next.map((item, i) => {
    if (i < prev.length) return item; // existing item
    // Newly added: inject only if it arrives with no taxes
    const hasTaxes =
      item.taxes && (Array.isArray(item.taxes) ? item.taxes.length > 0 : true);
    return hasTaxes ? item : { ...item, taxes: [...lastTaxes] };
  });
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ExpenseLineItemsProps {
  items: LineItemInput[];
  currency: string;
  canEdit: boolean;
  onChange: (items: LineItemInput[]) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const ExpenseLineItemsComponent: React.FC<ExpenseLineItemsProps> = ({
  items,
  currency,
  canEdit,
  onChange,
}) => {
  const [taxModalItem, setTaxModalItem] = useState<LineItemInput | null>(null);
  const [uniformModalOpen, setUniformModalOpen] = useState(false);

  // ── onChange wrapper — injects default taxes on new items ────────────────
  const handleChange = useCallback(
    (next: LineItemInput[]) => {
      onChange(inheritTaxesForNewItems(items, next));
    },
    [items, onChange],
  );

  // ── Single-item tax save ─────────────────────────────────────────────────
  const handleSaveItemTax = useCallback(
    (updatedItem: LineItemInput) => {
      onChange(
        items.map((li) => (li.id === updatedItem.id ? updatedItem : li)),
      );
      setTaxModalItem(null);
    },
    [items, onChange],
  );

  // ── Uniform tax apply ────────────────────────────────────────────────────
  const handleApplyUniformTax = useCallback(
    (sourceId: string) => {
      const source = items.find((li) => li.id === sourceId);
      if (!source) return;
      const taxes = TaxManager.coerce(source.taxes).toArray();
      onChange(items.map((li) => ({ ...li, taxes: [...taxes] })));
      setUniformModalOpen(false);
    },
    [items, onChange],
  );

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <Wrapper>
      <SectionHeader>
        <SectionLabel>Line Items</SectionLabel>
        {canEdit && items.length > 1 && (
          <UniformTaxButton
            type="button"
            onClick={() => setUniformModalOpen(true)}
            title="Copy tax settings from one line item to all others"
          >
            <SlidersHorizontalIcon size={11} />
            Uniform Tax
          </UniformTaxButton>
        )}
      </SectionHeader>

      {items.length === 0 && !canEdit ? (
        <EmptyNote>No itemized line items on this expense.</EmptyNote>
      ) : (
        <LineItemsTable
          items={items}
          currency={currency}
          canEdit={canEdit}
          onChange={handleChange}
          onEditTaxes={canEdit ? setTaxModalItem : undefined}
          useDropdown
        />
      )}

      {taxModalItem && (
        <LineItemTaxModal
          open
          onOpenChange={(open) => {
            if (!open) setTaxModalItem(null);
          }}
          lineItem={taxModalItem}
          currency={currency}
          onSave={handleSaveItemTax}
        />
      )}

      <UniformTaxModal
        open={uniformModalOpen}
        onOpenChange={setUniformModalOpen}
        items={items}
        currency={currency}
        onApply={handleApplyUniformTax}
      />
    </Wrapper>
  );
};

export const ExpenseLineItems = React.memo(ExpenseLineItemsComponent);
