/**
 * InvoiceReferences.tsx
 *
 * Self-contained references section for MajikInvoiceDocument.
 * Owns its own "Add Reference" modal state so the parent does not need to.
 *
 * Props mirror the slice of state/callbacks that MajikInvoiceDocument
 * previously managed inline.
 */

import React, { useCallback, useState } from "react";
import styled from "styled-components";
import { PlusIcon, XIcon } from "@phosphor-icons/react";
import type { DocumentReference } from "@majikah/majik-invoice";

import { EditableField } from "./EditableField";
import { REFERENCE_TYPE_OPTIONS } from "./_utils";
import AddReferenceModal from "./modals/AddReferenceModal";

// ---------------------------------------------------------------------------
// Styled
// ---------------------------------------------------------------------------

const RefRow = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 6px 0;
  border-bottom: 1px solid ${({ theme }) => theme.colors.primary}0e;
  font-size: 12px;
  gap: 8px;

  &:last-child {
    border-bottom: none;
  }
`;

const RefColumnRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  gap: 8px;
`;

const RefColumn = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const IconButton = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  color: ${({ theme }) => theme.colors.error};
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 2px;
  border-radius: ${({ theme }) => theme.borders.radius.small};
  opacity: 0.5;
  transition: opacity ${({ theme }) => theme.animations.duration.short};
  flex-shrink: 0;

  &:hover {
    opacity: 1;
    background: ${({ theme }) => theme.colors.error}12;
  }
  &:disabled {
    display: none;
  }
`;

const AddButton = styled.button`
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  font-size: 11px;
  color: ${({ theme }) => theme.colors.primary};
  border: none;
  background: none;
  cursor: pointer;
  padding: 5px 0;
  margin-top: 4px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  transition: opacity ${({ theme }) => theme.animations.duration.short};

  &:hover {
    opacity: 0.7;
  }
  &:disabled {
    display: none;
  }
`;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface InvoiceReferencesProps {
  references: DocumentReference[];
  canEdit: boolean;
  readonly: boolean;
  onAdd: (ref: DocumentReference) => void;
  onUpdate: (idx: number, patch: Partial<DocumentReference>) => void;
  onRemove: (idx: number) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const InvoiceReferences: React.FC<InvoiceReferencesProps> = React.memo(
  ({ references, canEdit, readonly, onAdd, onUpdate, onRemove }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);

    const handleUpdate = useCallback(
      (idx: number, patch: Partial<DocumentReference>) => onUpdate(idx, patch),
      [onUpdate],
    );

    const handleRemove = useCallback(
      (idx: number) => onRemove(idx),
      [onRemove],
    );

    return (
      <>
        {references.map((ref, i) => (
          <RefRow key={i}>
            <RefColumn>
              <RefColumnRow>
                <EditableField
                  as="select"
                  label="Type"
                  value={ref.type}
                  onChange={(e) => handleUpdate(i, { type: e })}
                  readonly={readonly}
                  options={REFERENCE_TYPE_OPTIONS.map((t) => ({
                    value: t,
                    label: t,
                  }))}
                />
                <EditableField
                  label="Reference Number"
                  value={ref.number}
                  readonly={!canEdit}
                  onChange={(v) => handleUpdate(i, { number: v })}
                />
                <EditableField
                  label="Date"
                  type="date"
                  value={ref.date ?? ""}
                  readonly={!canEdit}
                  onChange={(v) => handleUpdate(i, { date: v || undefined })}
                />
              </RefColumnRow>
              <EditableField
                label="Notes"
                value={ref.notes ?? ""}
                readonly={!canEdit}
                onChange={(v) => handleUpdate(i, { notes: v || undefined })}
              />
            </RefColumn>

            <IconButton onClick={() => handleRemove(i)} disabled={!canEdit}>
              <XIcon size={11} weight="bold" />
            </IconButton>
          </RefRow>
        ))}

        <AddButton disabled={!canEdit} onClick={() => setIsModalOpen(true)}>
          <PlusIcon size={11} weight="bold" /> Add reference
        </AddButton>

        <AddReferenceModal
          open={isModalOpen}
          onOpenChange={setIsModalOpen}
          onConfirm={onAdd}
        />
      </>
    );
  },
);

InvoiceReferences.displayName = "InvoiceReferences";

export default InvoiceReferences;
