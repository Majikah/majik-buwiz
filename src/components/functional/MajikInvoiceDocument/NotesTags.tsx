/**
 * NotesTags.tsx
 *
 * Self-contained Notes & Tags section for MajikInvoiceDocument.
 * Owns its own "Add Tag" modal state so the parent does not need to.
 */

import React, { useCallback, useState } from "react";
import styled from "styled-components";
import { PlusIcon, TagIcon, XIcon } from "@phosphor-icons/react";

import { EditableField } from "./EditableField";
import AddTagModal from "./modals/AddTagModal";

// ---------------------------------------------------------------------------
// Styled
// ---------------------------------------------------------------------------

const TagsWrap = styled.div<{ $isEmpty: boolean }>`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 6px;
  min-height: 28px;

  ${({ $isEmpty }) => $isEmpty && "display: none;"}
`;

const TagBadge = styled.span`
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  font-size: 11px;
  padding: 3px 9px;
  border-radius: ${({ theme }) => theme.borders.radius.rounded};
  background: ${({ theme }) => theme.colors.primarySoft};
  color: ${({ theme }) => theme.colors.primary};
  border: 1px solid ${({ theme }) => theme.colors.primary}22;
  display: inline-flex;
  align-items: center;
  gap: 5px;
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

export interface NotesTagsProps {
  notes: string;
  tags: string[];
  canEdit: boolean;
  onNotesChange: (v: string) => void;
  onAddTag: (tag: string) => void;
  onRemoveTag: (idx: number) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const NotesTags: React.FC<NotesTagsProps> = React.memo(
  ({ notes, tags, canEdit, onNotesChange, onAddTag, onRemoveTag }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);

    const handleAddTag = useCallback(
      (tag: string) => {
        onAddTag(tag);
      },
      [onAddTag],
    );

    const handleRemoveTag = useCallback(
      (i: number) => onRemoveTag(i),
      [onRemoveTag],
    );

    return (
      <>
        {/* Notes */}
        <div>
          <EditableField
            as="textarea"
            block
            label="Payment Instructions and Notes…"
            value={notes}
            onChange={onNotesChange}
            readonly={!canEdit}
            inputStyle={{
              fontSize: "12px",
              minHeight: "64px",
              lineHeight: "1.7",
              color: "inherit",
              opacity: 0.8,
            }}
          />
        </div>

        {/* Tags */}
        <div>
          <TagsWrap $isEmpty={!tags.length}>
            {tags.map((tag, i) => (
              <TagBadge key={i}>
                <TagIcon size={10} weight="fill" />
                {tag}
                <IconButton
                  style={{ padding: 0 }}
                  onClick={() => handleRemoveTag(i)}
                  disabled={!canEdit}
                  title="Remove tag"
                >
                  <XIcon size={10} weight="bold" />
                </IconButton>
              </TagBadge>
            ))}
          </TagsWrap>

          <AddButton disabled={!canEdit} onClick={() => setIsModalOpen(true)}>
            <PlusIcon size={11} weight="bold" /> Add tag
          </AddButton>
        </div>

        <AddTagModal
          open={isModalOpen}
          onOpenChange={setIsModalOpen}
          onConfirm={handleAddTag}
        />
      </>
    );
  },
);

NotesTags.displayName = "NotesTags";

export default NotesTags;
