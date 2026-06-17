import React, { useState } from "react";
import styled from "styled-components";
import { XIcon } from "@phosphor-icons/react";

// ---------------------------------------------------------------------------
// Styled
// ---------------------------------------------------------------------------

const NotesArea = styled.textarea<{ $readonly: boolean }>`
  width: 100%;
  min-height: 72px;
  resize: vertical;
  font-family: ${({ theme }) => theme.typography.fonts.regular};
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textPrimary};
  background: ${({ $readonly, theme }) =>
    $readonly ? "transparent" : theme.colors.secondaryBackground};
  border: 1px solid
    ${({ $readonly, theme }) =>
      $readonly ? "transparent" : `${theme.colors.primary}22`};
  border-radius: ${({ theme }) => theme.borders.radius.small};
  padding: ${({ $readonly }) => ($readonly ? "0" : "8px")};
  outline: none;
  line-height: 1.6;
  box-sizing: border-box;

  &:focus {
    border-color: ${({ theme }) => theme.colors.primary}55;
  }

  &::placeholder {
    color: ${({ theme }) => theme.colors.textSecondary};
    opacity: 0.4;
  }
`;

const TagsWrapper = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
  min-height: 30px;
`;

const Tag = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  font-size: 11px;
  padding: 3px 8px;
  border-radius: ${({ theme }) => theme.borders.radius.rounded};
  background: ${({ theme }) => theme.colors.primarySoft};
  color: ${({ theme }) => theme.colors.primary};
  border: 1px solid ${({ theme }) => theme.colors.primary}22;
`;

const TagRemove = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  display: flex;
  align-items: center;
  color: ${({ theme }) => theme.colors.primary};
  opacity: 0.5;

  &:hover {
    opacity: 1;
  }
`;

const TagInput = styled.input`
  font-family: ${({ theme }) => theme.typography.fonts.regular};
  font-size: 11px;
  background: none;
  border: none;
  outline: none;
  color: ${({ theme }) => theme.colors.textPrimary};
  width: 90px;

  &::placeholder {
    color: ${({ theme }) => theme.colors.textSecondary};
    opacity: 0.5;
  }
`;

const EmptyNote = styled.div`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.5;
`;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ExpenseNotesAndTagsProps {
  notes: string;
  tags: string[];
  canEdit: boolean;
  onNotesChange: (v: string) => void;
  onAddTag: (tag: string) => void;
  onRemoveTag: (index: number) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const ExpenseNotesAndTagsComponent: React.FC<ExpenseNotesAndTagsProps> = ({
  notes,
  tags,
  canEdit,
  onNotesChange,
  onAddTag,
  onRemoveTag,
}) => {
  const [tagDraft, setTagDraft] = useState("");

  const commitTag = () => {
    const trimmed = tagDraft.trim();
    if (trimmed) {
      onAddTag(trimmed);
      setTagDraft("");
    }
  };

  return (
    <>
      {/* Notes */}
      {canEdit || notes ? (
        <NotesArea
          $readonly={!canEdit}
          readOnly={!canEdit}
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          placeholder={canEdit ? "Add notes, terms, or remarks…" : ""}
        />
      ) : (
        <EmptyNote>No notes.</EmptyNote>
      )}

      {/* Tags */}
      <TagsWrapper>
        {tags.map((tag, i) => (
          <Tag key={i}>
            {tag}
            {canEdit && (
              <TagRemove onClick={() => onRemoveTag(i)}>
                <XIcon size={10} weight="bold" />
              </TagRemove>
            )}
          </Tag>
        ))}

        {canEdit && (
          <TagInput
            value={tagDraft}
            onChange={(e) => setTagDraft(e.target.value)}
            placeholder="+ tag"
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") {
                e.preventDefault();
                commitTag();
              }
            }}
            onBlur={commitTag}
          />
        )}
      </TagsWrapper>
    </>
  );
};

export const ExpenseNotesAndTags = React.memo(ExpenseNotesAndTagsComponent);
