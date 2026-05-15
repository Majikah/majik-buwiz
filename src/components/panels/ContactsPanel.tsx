import styled from "styled-components";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ListIcon,
  SquaresFourIcon,
  UsersThreeIcon,
  UserIcon,
  XIcon,
  StarIcon,
  PencilIcon,
  AddressBookIcon,
} from "@phosphor-icons/react";

import CBaseUserAccount from "../base/CBaseUserAccount";
import ContactRow from "../base/ContactRow";
import GuideHelper from "@/components/functional/GuideHelper";
import { useShepherd } from "@/lib/shepherd-js/use-shepherd";
import { launchTutorialContacts } from "@/lib/shepherd-js/tutorials/tutorial-contacts";
import { MajikBytes } from "@majikah/majik-bytes";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
import { toast } from "sonner";

import { MajikBuwizDatabase } from "../majik-context-wrapper/majik-buwiz-database";
import { MajikInvoiceContactGroup } from "@/SDK/majik-buwiz-client/src/core/party/majik-invoice-contact-group";
import { MajikInvoiceContact } from "@/SDK/majik-buwiz-client/src/core/party/majik-invoice-contact";

import {
  AddContactModal,
  CreateGroupModal,
  EditContactMetaModal,
  ContactGroupManagerModal,
} from "./contacts/modals";

// ─── Constants ────────────────────────────────────────────────────────────────
const MAX_CONTACTS_LIMIT = 1000;
const LIST_DEFAULT_THRESHOLD = 10;
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ#".split("");
const DEFAULT_GROUP_COLOR = "#ea7f05";

type ViewMode = "grid" | "list";

// ─── Layout ───────────────────────────────────────────────────────────────────
const Root = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  overflow: hidden;
`;

// ─── Panel header ─────────────────────────────────────────────────────────────
const PanelHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 18px 13px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.secondaryBackground};
  flex-shrink: 0;
`;

const HeaderLeft = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const PanelTitle = styled.h2`
  font-size: 14px;
  font-weight: 700;
  letter-spacing: -0.01em;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 7px;
  color: ${({ theme }) => theme.colors.textPrimary};
`;

const PanelSubtitle = styled.p`
  font-family: "Fira Mono", "JetBrains Mono", monospace;
  font-size: 10px;
  color: ${({ theme }) => theme.colors.textSecondary};
  margin: 0;
  opacity: 0.5;
  letter-spacing: 0.03em;
`;

const HeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
`;

// ─── View toggle ──────────────────────────────────────────────────────────────
const ViewToggle = styled.div`
  display: flex;
  align-items: center;
  background: ${({ theme }) => theme.colors.secondaryBackground};
  border-radius: 8px;
  padding: 2px;
  gap: 2px;

  @media (max-width: 640px) {
    display: none;
  }
`;

const ToggleBtn = styled.button<{ $active: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 24px;
  border-radius: 6px;
  border: none;
  cursor: pointer;
  transition: all 150ms ease;
  background: ${({ $active, theme }) =>
    $active ? theme.colors.primaryBackground : "transparent"};
  color: ${({ $active, theme }) =>
    $active ? theme.colors.primary : theme.colors.textSecondary};
  opacity: ${({ $active }) => ($active ? 1 : 0.5)};

  &:hover {
    opacity: 1;
    color: ${({ $active, theme }) =>
      $active ? theme.colors.primary : theme.colors.textPrimary};
  }
`;

const LimitBadge = styled.span`
  font-family: "Fira Mono", "JetBrains Mono", monospace;
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.06em;
  padding: 2px 7px;
  border-radius: 100px;
  background: ${({ theme }) => theme.colors.secondaryBackground};
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.7;
  white-space: nowrap;
`;

// ─── Groups strip ─────────────────────────────────────────────────────────────
const GroupsStrip = styled.div`
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 18px 10px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.secondaryBackground};
  overflow-x: auto;
  scrollbar-width: none;

  &::-webkit-scrollbar {
    display: none;
  }
`;

const GroupChip = styled.button<{
  $color: string;
  $active: boolean;
  $isSystem: boolean;
}>`
  display: inline-flex;
  align-items: center;
  gap: 0;
  padding: 0;
  border-radius: 100px;
  border: 1px solid
    ${({ $active, $color }) => ($active ? $color : "rgba(255,255,255,0.08)")};
  background: ${({ $active, $color }) =>
    $active ? `${$color}22` : "transparent"};
  cursor: pointer;
  white-space: nowrap;
  transition: all 150ms ease;
  flex-shrink: 0;
  overflow: hidden;

  &:hover {
    border-color: ${({ $color }) => $color};
    background: ${({ $color }) => `${$color}14`};
  }
`;

const ChipFilterZone = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 8px 5px 8px;
`;

const ChipDot = styled.span<{ $color: string }>`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: ${({ $color }) => $color};
  flex-shrink: 0;
`;

const ChipLabel = styled.span<{ $active: boolean; $color: string }>`
  font-family: "Fira Mono", "JetBrains Mono", monospace;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: ${({ $active, $color, theme }) =>
    $active ? $color : theme.colors.textSecondary};
  transition: color 150ms ease;
`;

const ChipCount = styled.span<{ $color: string }>`
  font-family: "Fira Mono", "JetBrains Mono", monospace;
  font-size: 9px;
  font-weight: 700;
  color: ${({ $color }) => $color};
  opacity: 0.7;
`;

const ChipManageZone = styled.div<{ $color: string }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 5px 8px;
  border-left: 1px solid ${({ $color }) => `${$color}33`};
  transition: background 150ms ease;

  &:hover {
    background: ${({ $color }) => `${$color}25`};
    svg {
      opacity: 1;
    }
  }

  svg {
    opacity: 0.45;
    transition: opacity 150ms ease;
  }
`;

const ChipManageLabel = styled.span<{ $color: string }>`
  font-family: "Fira Mono", "JetBrains Mono", monospace;
  font-size: 8px;
  font-weight: 700;
  letter-spacing: 0.05em;
  color: ${({ $color }) => $color};
  opacity: 0.6;
  margin-left: 3px;
  transition: opacity 150ms ease;

  ${ChipManageZone}:hover & {
    opacity: 1;
  }
`;

// ─── Active group filter banner ───────────────────────────────────────────────
const FilterBanner = styled.div<{ $color: string }>`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 18px;
  background: ${({ $color }) => `${$color}12`};
  border-bottom: 1px solid ${({ $color }) => `${$color}25`};
  flex-shrink: 0;
`;

const FilterLabel = styled.span<{ $color: string }>`
  font-family: "Fira Mono", "JetBrains Mono", monospace;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: ${({ $color }) => $color};
  flex: 1;
`;

const FilterClearBtn = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border: none;
  background: transparent;
  cursor: pointer;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.5;
  border-radius: 4px;
  transition: opacity 150ms ease;
  padding: 0;

  &:hover {
    opacity: 1;
  }
`;

// ─── Body ─────────────────────────────────────────────────────────────────────
const BodyWrapper = styled.div`
  flex: 1;
  overflow: hidden;
  position: relative;
  display: flex;
`;

const Body = styled.div<{ $isListView: boolean }>`
  flex: 1;
  overflow-y: auto;
  padding: ${({ $isListView }) => ($isListView ? "0" : "16px 18px 24px")};

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

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(420px, 1fr));
  gap: 10px;

  @media (max-width: 640px) {
    grid-template-columns: 1fr;
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
  color: ${({ $active, $hasItems, theme }) =>
    $active
      ? theme.colors.primary
      : $hasItems
        ? theme.colors.textSecondary
        : theme.colors.textSecondary};
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

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getContactLetter(label: string): string {
  const first = (label || "?").trim()[0]?.toUpperCase();
  return /[A-Z]/.test(first ?? "") ? (first ?? "#") : "#";
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface ContactsPanelProps {
  majik: MajikBuwizDatabase;
  onUpdate?: (updatedInstance: MajikBuwizDatabase) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────
const ContactsPanel: React.FC<ContactsPanelProps> = ({ majik, onUpdate }) => {
  const tour = useShepherd();

  // ── Refresh trigger ────────────────────────────────────────────────────────
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  // ── Alpha scrollbar ────────────────────────────────────────────────────────
  const [activeLetter, setActiveLetter] = useState<string | null>(null);
  const [bubbleVisible, setBubbleVisible] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const bubbleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Group filter ───────────────────────────────────────────────────────────
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);

  // ── Group manager modal ────────────────────────────────────────────────────
  const [managingGroup, setManagingGroup] =
    useState<MajikInvoiceContactGroup | null>(null);
  const [isGroupManagerOpen, setIsGroupManagerOpen] = useState(false);

  // ── Edit meta modal ────────────────────────────────────────────────────────
  const [editingContact, setEditingContact] =
    useState<MajikInvoiceContact | null>(null);
  const [isEditMetaOpen, setIsEditMetaOpen] = useState(false);

  // ── View mode ──────────────────────────────────────────────────────────────
  const [viewMode, setViewMode] = useState<ViewMode>("grid");

  // ── Data ───────────────────────────────────────────────────────────────────
  const contacts = useMemo(() => {
    if (!majik) return [];
    return majik.listContacts(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [majik, refreshKey]);

  const groups = useMemo(() => {
    if (!majik) return [];
    const favorites = majik.getFavoritesGroup();
    const user = majik.listUserGroups(true);
    return [favorites, ...user];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [majik, refreshKey]);

  const activeGroup = useMemo(
    () =>
      activeGroupId
        ? (groups.find((g) => g.id === activeGroupId) ?? null)
        : null,
    [groups, activeGroupId],
  );

  const displayedContacts = useMemo(() => {
    if (!activeGroupId || !activeGroup) return contacts;
    const memberIds = new Set(activeGroup.listMemberIds());
    return contacts.filter((c) => memberIds.has(c.id));
  }, [contacts, activeGroupId, activeGroup]);

  const grouped = useMemo(() => {
    const sorted = [...displayedContacts].sort((a, b) =>
      (a.meta?.label || "")
        .toLowerCase()
        .localeCompare((b.meta?.label || "").toLowerCase()),
    );
    const map: Record<string, typeof contacts> = {};
    for (const c of sorted) {
      const letter = getContactLetter(c.meta?.label || "");
      if (!map[letter]) map[letter] = [];
      map[letter].push(c);
    }
    return map;
  }, [displayedContacts]);

  const presentLetters = useMemo(() => Object.keys(grouped).sort(), [grouped]);

  // Sync view mode based on count
  useEffect(() => {
    setViewMode(contacts.length > LIST_DEFAULT_THRESHOLD ? "list" : "grid");
  }, [contacts.length]);

  // ── Event listeners ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!majik) return;
    const handler = (): void => {
      refresh();
      onUpdate?.(majik);
      console.log("New Event")
    };
    const events = [
      "new-contact",
      "removed-contact",
      "new-contact-group",
      "removed-contact-group",
      "contact-group-change",
    ] as const;
    events.forEach((e) => majik.on(e, handler));
    return () => events.forEach((e) => majik.off(e, handler));
  }, [majik, refresh, onUpdate]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleGroupChipClick = useCallback((groupId: string): void => {
    setActiveGroupId((prev) => (prev === groupId ? null : groupId));
  }, []);

  const handleOpenGroupManager = useCallback(
    (e: React.MouseEvent, group: MajikInvoiceContactGroup): void => {
      e.stopPropagation();
      setManagingGroup(group);
      setIsGroupManagerOpen(true);
    },
    [],
  );

  const handleOpenEditMeta = useCallback((acct: MajikInvoiceContact): void => {
    setEditingContact(acct);
    setIsEditMetaOpen(true);
  }, []);

  const handleDelete = useCallback(
    async (id: string): Promise<void> => {
      try {
        await majik.removeContact(id);
        onUpdate?.(majik);
        refresh();
      } catch (err) {
        toast.error("Failed to Delete Contact", {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          description: (err as any)?.message || err,
          id: "error-majik-delete",
        });
      }
    },
    [majik, onUpdate, refresh],
  );

  const handleDownloadCard = useCallback(
    async (input: MajikInvoiceContact): Promise<void> => {
      const s = await majik.exportContactAsString(input.id);
      if (!s) {
        toast.error("Failed to download", {
          id: `toast-error-download-${input.id}`,
        });
        return;
      }
      try {
        const majikByte = await MajikBytes.create(s);
        const mbyteFile = await majikByte.toPNG();
        const defaultName = `${input?.meta?.label || input.id} - Contact Card PNG`;
        const filePath = await save({
          defaultPath: defaultName,
          filters: [{ name: "Contact Card PNG", extensions: ["png"] }],
        });
        if (!filePath) {
          toast.info("Contact Card export cancelled", {
            id: `toast-info-download-${input.id}`,
          });
          return;
        }
        const arrayBuffer = await mbyteFile.arrayBuffer();
        await writeFile(filePath, new Uint8Array(arrayBuffer));
        toast.success("Contact Card exported successfully", {
          id: `toast-success-download-${input.id}`,
        });
      } catch (err) {
        toast.error("Failed to copy", {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          description: (err as any)?.message || err,
          id: `toast-error-share-${input.id}`,
        });
      }
    },
    [majik],
  );

  const scrollToLetter = useCallback(
    (letter: string) => {
      if (!grouped[letter]) return;
      const el = sectionRefs.current[letter];
      if (el && bodyRef.current) {
        bodyRef.current.scrollTo({ top: el.offsetTop, behavior: "smooth" });
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

  // ── Derived ────────────────────────────────────────────────────────────────
  const atLimitContact = contacts.length >= MAX_CONTACTS_LIMIT;
  const isListView = viewMode === "list";
  const activeGroupColor = activeGroup?.meta?.color || DEFAULT_GROUP_COLOR;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Root id="section-contacts">
      <GuideHelper
        docsPath="https://majikah.solutions/products/majik-buwiz/docs/buwiz-contacts-overview"
        startTour={() => launchTutorialContacts(tour)}
      />

      {/* ── Header ── */}
      <PanelHeader>
        <HeaderLeft>
          <PanelTitle>
            <AddressBookIcon size={16} weight="duotone" />
            Contacts
          </PanelTitle>
          <PanelSubtitle>
            {contacts.length} / {MAX_CONTACTS_LIMIT} contacts
          </PanelSubtitle>
        </HeaderLeft>

        <HeaderActions>
          {atLimitContact && <LimitBadge>Limit reached</LimitBadge>}

          {contacts.length > 0 && (
            <ViewToggle>
              <ToggleBtn
                $active={viewMode === "grid"}
                onClick={() => setViewMode("grid")}
                title="Grid view"
              >
                <SquaresFourIcon size={14} />
              </ToggleBtn>
              <ToggleBtn
                $active={viewMode === "list"}
                onClick={() => setViewMode("list")}
                title="List view"
              >
                <ListIcon size={14} />
              </ToggleBtn>
            </ViewToggle>
          )}

          <AddContactModal majik={majik} disabled={atLimitContact} />
        </HeaderActions>
      </PanelHeader>

      {/* ── Groups strip ── */}
      <GroupsStrip id="section-contact-groups">
        {groups.map((group, index) => {
          const color = group.meta?.color || DEFAULT_GROUP_COLOR;
          const isActive = activeGroupId === group.id;
          return (
            <GroupChip
              key={group.id}
              $color={color}
              $active={isActive}
              $isSystem={group.isSystem}
              onClick={undefined}
              id={`button-contact-groups-item-${index}`}
            >
              <ChipFilterZone onClick={() => handleGroupChipClick(group.id)}>
                {group.isFavorites() ? (
                  <StarIcon size={9} weight="fill" color={color} />
                ) : (
                  <ChipDot $color={color} />
                )}
                <ChipLabel $active={isActive} $color={color}>
                  {group.meta.name}
                </ChipLabel>
                <ChipCount $color={color}>{group.memberCount()}</ChipCount>
              </ChipFilterZone>

              <ChipManageZone
                $color={color}
                onClick={(e) => handleOpenGroupManager(e, group)}
                title={`Manage ${group.meta.name}`}
                id={`button-contact-groups-manage-${index}`}
              >
                <PencilIcon size={9} weight="bold" color={color} />
                <ChipManageLabel $color={color}>EDIT</ChipManageLabel>
              </ChipManageZone>
            </GroupChip>
          );
        })}

        <CreateGroupModal majik={majik} groupCount={groups.length} />
      </GroupsStrip>

      {/* ── Active group filter banner ── */}
      {activeGroup && (
        <FilterBanner $color={activeGroupColor}>
          <UsersThreeIcon size={12} color={activeGroupColor} />
          <FilterLabel $color={activeGroupColor}>
            {activeGroup.meta.name} · {displayedContacts.length} member
            {displayedContacts.length !== 1 ? "s" : ""}
          </FilterLabel>
          <FilterClearBtn
            onClick={() => setActiveGroupId(null)}
            title="Clear filter"
          >
            <XIcon size={12} weight="bold" />
          </FilterClearBtn>
        </FilterBanner>
      )}

      {/* ── Body ── */}
      <BodyWrapper>
        <Body $isListView={isListView} ref={bodyRef}>
          {displayedContacts.length === 0 ? (
            <EmptyState>
              <EmptyIcon>
                {activeGroup ? (
                  <UsersThreeIcon size={22} />
                ) : (
                  <UserIcon size={22} />
                )}
              </EmptyIcon>
              <EmptyTitle>
                {activeGroup
                  ? `No members in ${activeGroup.meta.name}`
                  : "No contacts yet"}
              </EmptyTitle>
              <EmptyHint>
                {activeGroup
                  ? "Open the group manager to add contacts."
                  : "You haven't added any contacts yet."}
              </EmptyHint>
            </EmptyState>
          ) : isListView ? (
            <>
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
                        onDelete={() => handleDelete(c.id)}
                        onEdit={handleOpenEditMeta}
                      />
                    ))}
                  </AlphaSection>
                );
              })}
            </>
          ) : (
            <Grid>
              {displayedContacts.map((c) => (
                <CBaseUserAccount
                  key={c.id}
                  itemData={c}
                  onDelete={() => handleDelete(c.id)}
                  onEdit={handleOpenEditMeta}
                  onDownload={() => handleDownloadCard(c)}
                />
              ))}
            </Grid>
          )}
        </Body>

        {isListView && displayedContacts.length > 0 && (
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
        )}

        <AlphaBubble $visible={bubbleVisible}>{activeLetter ?? ""}</AlphaBubble>
      </BodyWrapper>

      {/* ── Modals ── */}
      <ContactGroupManagerModal
        isOpen={isGroupManagerOpen}
        group={managingGroup}
        majik={majik}
        allContacts={contacts}
        onOpenChange={setIsGroupManagerOpen}
        onUpdate={refresh}
      />

      <EditContactMetaModal
        isOpen={isEditMetaOpen}
        contact={editingContact}
        majik={majik}
        onOpenChange={(open) => {
          setIsEditMetaOpen(open);
          if (!open) setEditingContact(null);
        }}
      />
    </Root>
  );
};

export default ContactsPanel;
