/**
 * ContactsList.tsx
 *
 * Standalone alphabetical list view for contacts.
 * Includes sticky alpha-section headers and a right-side alpha jump scrollbar.
 */

import React, { useCallback, useMemo, useRef, useState } from "react";
import styled from "styled-components";
import { UsersThreeIcon, UserIcon } from "@phosphor-icons/react";

import type { MajikInvoiceContact } from "@/SDK/majik-buwiz-client/src/core/party/majik-invoice-contact";
import ContactRow from "@/components/base/ContactRow";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ#".split("");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getContactLetter(label: string): string {
  const first = (label || "?").trim()[0]?.toUpperCase();
  return /[A-Z]/.test(first ?? "") ? (first ?? "#") : "#";
}

// ---------------------------------------------------------------------------
// Styled
// ---------------------------------------------------------------------------

const Wrapper = styled.div`
  position: relative;
  display: flex;
  flex: 1;
  overflow: hidden;
`;

const Scroll = styled.div`
  flex: 1;
  overflow-y: auto;

  scrollbar-width: thin;
  scrollbar-color: ${({ theme }) =>
    `${theme.colors.secondaryBackground} transparent`};

  &::-webkit-scrollbar {
    width: 3px;
  }
  &::-webkit-scrollbar-thumb {
    background: ${({ theme }) => theme.colors.secondaryBackground};
    border-radius: 4px;
  }
`;

const AlphaSection = styled.div`
  display: flex;
  flex-direction: column;
`;

const AlphaHeader = styled.div`
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 18px 5px;
  background: ${({ theme }) => theme.colors.primaryBackground}f0;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border-bottom: 1px solid ${({ theme }) => theme.colors.secondaryBackground}66;
`;

const AlphaLetter = styled.span`
  font-family: "Fira Mono", "JetBrains Mono", monospace;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: ${({ theme }) => theme.colors.primary};
  text-transform: uppercase;
`;

const AlphaCount = styled.span`
  font-family: "Fira Mono", "JetBrains Mono", monospace;
  font-size: 9px;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.4;
  letter-spacing: 0.04em;
`;

const AlphaScrollbar = styled.div`
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: 18px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 8px 0;
  z-index: 20;
  gap: 1px;
  user-select: none;

  @media (max-width: 640px) {
    width: 16px;
  }
`;

const AlphaScrollBtn = styled.button<{ $active: boolean; $hasItems: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  border: none;
  background: transparent;
  cursor: ${({ $hasItems }) => ($hasItems ? "pointer" : "default")};
  font-family: "Fira Mono", "JetBrains Mono", monospace;
  font-size: 8px;
  font-weight: 700;
  letter-spacing: 0;
  border-radius: 4px;
  transition: all 100ms ease;
  color: ${({ $active, theme }) =>
    $active ? theme.colors.primary : theme.colors.textSecondary};
  opacity: ${({ $hasItems, $active }) =>
    $active ? 1 : $hasItems ? 0.55 : 0.18};
  background: ${({ $active, theme }) =>
    $active ? `${theme.colors.primary}22` : "transparent"};

  &:hover {
    opacity: ${({ $hasItems }) => ($hasItems ? 1 : 0.18)};
    background: ${({ $hasItems, theme }) =>
      $hasItems ? `${theme.colors.primary}15` : "transparent"};
    color: ${({ $hasItems, theme }) =>
      $hasItems ? theme.colors.primary : theme.colors.textSecondary};
  }
`;

const AlphaBubble = styled.div<{ $visible: boolean }>`
  position: absolute;
  right: 22px;
  top: 50%;
  transform: translateY(-50%);
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: "Fira Mono", "JetBrains Mono", monospace;
  font-size: 18px;
  font-weight: 700;
  pointer-events: none;
  z-index: 30;
  transition: opacity 200ms ease;
  opacity: ${({ $visible }) => ($visible ? 1 : 0)};
  background: ${({ theme }) => theme.colors.primary};
  color: #fff;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.3);
`;

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 80px 24px;
  text-align: center;
`;

const EmptyIcon = styled.div`
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: ${({ theme }) => theme.colors.secondaryBackground};
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.5;
`;

const EmptyTitle = styled.p`
  font-size: 13px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textPrimary};
  margin: 0;
`;

const EmptyHint = styled.p`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textSecondary};
  margin: 0;
  max-width: 220px;
  line-height: 1.55;
  opacity: 0.6;
`;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ContactsListProps {
  contacts: MajikInvoiceContact[];
  emptyTitle?: string;
  emptyHint?: string;
  emptyIsGroup?: boolean;
  onDelete?: (contact: MajikInvoiceContact) => void;
  onEdit?: (contact: MajikInvoiceContact) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const ContactsList: React.FC<ContactsListProps> = ({
  contacts,
  emptyTitle,
  emptyHint,
  emptyIsGroup = false,
  onDelete,
  onEdit,
}) => {
  const [activeLetter, setActiveLetter] = useState<string | null>(null);
  const [bubbleVisible, setBubbleVisible] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const bubbleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Build grouped map ─────────────────────────────────────────────────────
  const grouped = useMemo(() => {
    const sorted = [...contacts].sort((a, b) =>
      (a.meta?.label || "")
        .toLowerCase()
        .localeCompare((b.meta?.label || "").toLowerCase()),
    );
    const map: Record<string, MajikInvoiceContact[]> = {};
    for (const c of sorted) {
      const letter = getContactLetter(c.meta?.label || "");
      if (!map[letter]) map[letter] = [];
      map[letter].push(c);
    }
    return map;
  }, [contacts]);

  const presentLetters = useMemo(() => Object.keys(grouped).sort(), [grouped]);

  // ── Alpha scroll ──────────────────────────────────────────────────────────
  const scrollToLetter = useCallback(
    (letter: string) => {
      if (!grouped[letter]) return;
      const el = sectionRefs.current[letter];
      if (el && scrollRef.current) {
        scrollRef.current.scrollTo({ top: el.offsetTop, behavior: "smooth" });
      }
      setActiveLetter(letter);
      setBubbleVisible(true);
      if (bubbleTimerRef.current) clearTimeout(bubbleTimerRef.current);
      bubbleTimerRef.current = setTimeout(() => {
        setBubbleVisible(false);
        setActiveLetter(null);
      }, 800);
    },
    [grouped],
  );

  // ── Empty state ───────────────────────────────────────────────────────────
  if (contacts.length === 0) {
    return (
      <EmptyState>
        <EmptyIcon>
          {emptyIsGroup ? <UsersThreeIcon size={22} /> : <UserIcon size={22} />}
        </EmptyIcon>
        <EmptyTitle>
          {emptyTitle ??
            (emptyIsGroup ? "No members in this group" : "No contacts yet")}
        </EmptyTitle>
        <EmptyHint>
          {emptyHint ??
            (emptyIsGroup
              ? "Open the group manager to add contacts."
              : "You haven't added any contacts yet.")}
        </EmptyHint>
      </EmptyState>
    );
  }

  return (
    <Wrapper>
      <Scroll ref={scrollRef}>
        {presentLetters.map((letter) => {
          const items = grouped[letter] ?? [];
          return (
            <AlphaSection
              key={letter}
              ref={(el) => {
                sectionRefs.current[letter] = el;
              }}
            >
              <AlphaHeader>
                <AlphaLetter>{letter}</AlphaLetter>
                <AlphaCount>{items.length}</AlphaCount>
              </AlphaHeader>
              {items.map((c) => (
                <ContactRow
                  key={c.id}
                  itemData={c}
                  isActiveAccount={false}
                  onDelete={onDelete ? () => onDelete(c) : undefined}
                  onEdit={onEdit}
                />
              ))}
            </AlphaSection>
          );
        })}
      </Scroll>

      {/* Alpha jump scrollbar */}
      <AlphaScrollbar>
        {ALPHABET.map((letter) => {
          const hasItems = !!grouped[letter];
          return (
            <AlphaScrollBtn
              key={letter}
              $active={activeLetter === letter}
              $hasItems={hasItems}
              onClick={() => hasItems && scrollToLetter(letter)}
              aria-label={`Jump to ${letter}`}
            >
              {letter}
            </AlphaScrollBtn>
          );
        })}
      </AlphaScrollbar>

      <AlphaBubble $visible={bubbleVisible}>{activeLetter ?? ""}</AlphaBubble>
    </Wrapper>
  );
};
