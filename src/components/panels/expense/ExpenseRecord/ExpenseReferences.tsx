import React, { useState } from "react";
import styled from "styled-components";
import { PlusIcon, TrashIcon } from "@phosphor-icons/react";
import type { DocumentReference } from "@majikah/majik-invoice";

// ---------------------------------------------------------------------------
// Styled
// ---------------------------------------------------------------------------

const Wrapper = styled.div``;

const RefList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const RefItem = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  padding: 5px 0;
  border-bottom: 1px solid ${({ theme }) => theme.colors.primary}0e;

  &:last-child {
    border-bottom: none;
  }
`;

const RefType = styled.span`
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  font-size: 10px;
  padding: 2px 7px;
  border-radius: ${({ theme }) => theme.borders.radius.rounded};
  background: ${({ theme }) => theme.colors.primarySoft};
  color: ${({ theme }) => theme.colors.primary};
  white-space: nowrap;
  flex-shrink: 0;
`;

const RefNumber = styled.span`
  font-family: ${({ theme }) => theme.typography.fonts.numbers};
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textPrimary};
  flex: 1;
`;

const RefNote = styled.span`
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.6;
  max-width: 120px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const RemoveBtn = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  color: ${({ theme }) => theme.colors.error};
  opacity: 0.4;
  padding: 2px;
  display: flex;
  align-items: center;

  &:hover {
    opacity: 1;
  }
`;

const EmptyNote = styled.div`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.5;
  padding: 4px 0;
`;

const AddForm = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr auto;
  gap: ${({ theme }) => theme.spacing.small};
  align-items: end;
  margin-top: ${({ theme }) => theme.spacing.small};
`;

const FormLabel = styled.div`
  font-family: ${({ theme }) => theme.typography.fonts.semibold};
  font-size: 9px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.7;
  margin-bottom: 4px;
`;

const FormInput = styled.input`
  width: 100%;
  font-family: ${({ theme }) => theme.typography.fonts.regular};
  font-size: 12px;
  background: ${({ theme }) => theme.colors.primaryBackground};
  border: 1px solid ${({ theme }) => theme.colors.primary}22;
  border-radius: ${({ theme }) => theme.borders.radius.small};
  padding: 5px 8px;
  color: ${({ theme }) => theme.colors.textPrimary};
  outline: none;

  &:focus {
    border-color: ${({ theme }) => theme.colors.primary}66;
  }
`;

const AddBtn = styled.button`
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  font-size: 12px;
  color: ${({ theme }) => theme.colors.primary};
  background: ${({ theme }) => theme.colors.primarySoft};
  border: 1px solid ${({ theme }) => theme.colors.primary}33;
  border-radius: ${({ theme }) => theme.borders.radius.small};
  padding: 5px 10px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;

  &:disabled {
    opacity: 0.4;
    cursor: default;
  }
`;

const OpenFormBtn = styled.button`
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  font-size: 12px;
  color: ${({ theme }) => theme.colors.primary};
  background: none;
  border: none;
  cursor: pointer;
  padding: 6px 0;
  display: flex;
  align-items: center;
  gap: 5px;
  opacity: 0.7;
  margin-top: 4px;

  &:hover {
    opacity: 1;
  }
`;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ExpenseReferencesProps {
  references: readonly DocumentReference[];
  canEdit: boolean;
  readonly: boolean;
  onAdd: (ref: DocumentReference) => void;
  onRemove: (type: string, number: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const ExpenseReferencesComponent: React.FC<ExpenseReferencesProps> = ({
  references,
  canEdit,
  readonly,
  onAdd,
  onRemove,
}) => {
  const [showForm, setShowForm] = useState(false);
  const [type, setType] = useState("");
  const [number, setNumber] = useState("");

  const handleAdd = () => {
    if (!type.trim() || !number.trim()) return;
    onAdd({ type: type.trim(), number: number.trim() });
    setType("");
    setNumber("");
    setShowForm(false);
  };

  return (
    <Wrapper>
      <RefList>
        {references.length === 0 ? (
          <EmptyNote>No references added.</EmptyNote>
        ) : (
          references.map((ref, i) => (
            <RefItem key={i}>
              <RefType>{ref.type}</RefType>
              <RefNumber>{ref.number}</RefNumber>
              {ref.notes && <RefNote>{ref.notes}</RefNote>}
              {canEdit && (
                <RemoveBtn
                  title="Remove reference"
                  onClick={() => onRemove(ref.type, ref.number)}
                >
                  <TrashIcon size={13} />
                </RemoveBtn>
              )}
            </RefItem>
          ))
        )}
      </RefList>

      {canEdit && !readonly && (
        <>
          {!showForm ? (
            <OpenFormBtn onClick={() => setShowForm(true)}>
              <PlusIcon size={13} />
              Add reference
            </OpenFormBtn>
          ) : (
            <AddForm>
              <div>
                <FormLabel>Type</FormLabel>
                <FormInput
                  type="text"
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  placeholder="e.g. PO, Contract"
                />
              </div>
              <div>
                <FormLabel>Number</FormLabel>
                <FormInput
                  type="text"
                  value={number}
                  onChange={(e) => setNumber(e.target.value)}
                  placeholder="e.g. PO-2025-001"
                />
              </div>
              <AddBtn
                onClick={handleAdd}
                disabled={!type.trim() || !number.trim()}
              >
                <PlusIcon size={13} />
                Add
              </AddBtn>
            </AddForm>
          )}
        </>
      )}
    </Wrapper>
  );
};

export const ExpenseReferences = React.memo(ExpenseReferencesComponent);
