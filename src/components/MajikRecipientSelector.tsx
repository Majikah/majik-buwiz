import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
  type JSX,
} from "react";
import styled, { keyframes } from "styled-components";
import { toast } from "sonner";
import Fuse from "fuse.js";
import {
  TrashIcon,
  UsersIcon,
  UserIcon,
  LockKeyIcon,
  ArrowSquareInIcon as ImportIcon,
  PlusIcon,
} from "@phosphor-icons/react";

import { MajikInvoiceContact } from "@/SDK/majik-buwiz-client/src/core/party/majik-invoice-contact";
import { MajikInvoiceContactGroup } from "@/SDK/majik-buwiz-client/src/core/party/majik-invoice-contact-group";
import { ImportKeyModal } from "./panels/muid/modals/ImportKeyModal";
import { CreateKeyModal } from "./panels/muid/modals/CreateKeyModal";

// ── Types ────────────────────────────────────────────────────────────────────

type SearchMode = "contact" | "group";

type SearchableContact = {
  contact: MajikInvoiceContact;
  label: string;
  publicKey: string;
  publicKeyPrefix: string;
};

type SearchableGroup = {
  group: MajikInvoiceContactGroup;
  name: string;
  description: string;
  id: string;
};

interface MajikRecipientSelectorProps {
  /** The majik SDK instance — required */
  majik: any; // replace with your Majik SDK type
  /** External refresh signal — increment to force a data reload */
  refreshKey?: number;
  /** Currently selected recipients (controlled) — excludes self */
  value?: MajikInvoiceContact[];
  /** Called whenever the selection changes. Always includes the active self-account. */
  onUpdate?: (value: MajikInvoiceContact[]) => void;
  disabled?: boolean;
  compact?: boolean;
  allowEmpty?: boolean;
  maxContacts?: number;
  id?: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const arraysEqual = (
  a: MajikInvoiceContact[],
  b: MajikInvoiceContact[],
): boolean =>
  a.length === b.length && a.every((item, i) => item.id === b[i].id);

const normalize = (v: string): string =>
  v.toLowerCase().replace(/[^a-z0-9]/g, "");

// ── Animations ───────────────────────────────────────────────────────────────

const pulse = keyframes`
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.5; }
`;

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(-4px); }
  to   { opacity: 1; transform: translateY(0); }
`;

const slideDown = keyframes`
  from { opacity: 0; transform: translateY(-6px); }
  to   { opacity: 1; transform: translateY(0); }
`;

// ── Component ────────────────────────────────────────────────────────────────

export const MajikRecipientSelector = React.memo(
  function MajikRecipientSelector({
    id,
    majik,
    refreshKey: externalRefreshKey = 0,
    value = [],
    onUpdate,
    disabled = false,
    compact = false,
    allowEmpty = true,
    maxContacts,
  }: MajikRecipientSelectorProps): JSX.Element {
    const isSingleMode = maxContacts === 1;

    // ── Internal refresh key (bumped after modal success) ─────────────────────
    const [internalRefreshKey, setInternalRefreshKey] = useState(0);
    const refreshKey = externalRefreshKey + internalRefreshKey;

    // ── Modal state ───────────────────────────────────────────────────────────
    const [importOpen, setImportOpen] = useState(false);
    const [createOpen, setCreateOpen] = useState(false);

    // ── Data ──────────────────────────────────────────────────────────────────
    const activeAccount: MajikInvoiceContact | null = useMemo(() => {
      if (!majik) return null;
      return majik.getActiveAccount() ?? null;
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [majik, refreshKey]);

    const contacts = useMemo((): MajikInvoiceContact[] => {
      if (!majik) return [];
      return majik.listContacts(false);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [majik, refreshKey]);

    const groups = useMemo((): MajikInvoiceContactGroup[] => {
      if (!majik) return [];
      const favorites = majik.getFavoritesGroup();
      const user = majik.listUserGroups(true);
      return [favorites, ...user];
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [majik, refreshKey]);

    // ── Visible contacts — exclude self ───────────────────────────────────────
    const visibleContacts = useMemo(
      () => contacts.filter((c) => c.id !== activeAccount?.id),
      [contacts, activeAccount],
    );

    // ── Selection state (visible / non-self only) ─────────────────────────────
    // Strip self from the initial value so the active account never appears as a tag
    const [list, setList] = useState<MajikInvoiceContact[]>(() =>
      value.filter((c) => c.id !== activeAccount?.id),
    );

    // Sync controlled value — always strip self before storing into visible list
    useEffect(() => {
      const stripped = value.filter((c) => c.id !== activeAccount?.id);
      if (!arraysEqual(stripped, list)) setList(stripped);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value, activeAccount]);

    // ── Emit — always prepend active account ──────────────────────────────────
    const emit = useCallback(
      (recipients: MajikInvoiceContact[]) => {
        if (!activeAccount) {
          onUpdate?.(recipients);
          return;
        }
        const withSelf = [
          activeAccount,
          ...recipients.filter((r) => r.id !== activeAccount.id),
        ];
        onUpdate?.(withSelf);
      },
      [activeAccount, onUpdate],
    );

    // ── Contact labels (async public-key resolution) ──────────────────────────
    const [contactLabels, setContactLabels] = useState<Record<string, string>>(
      {},
    );

    useEffect(() => {
      let cancelled = false;
      const resolveLabels = async (): Promise<void> => {
        const unresolved = contacts.filter((c) => contactLabels[c.id] == null);
        if (unresolved.length === 0) return;
        const entries = await Promise.all(
          unresolved.map(async (contact) => {
            const pk = await contact.getPublicKeyBase64();
            return [contact.id, pk] as const;
          }),
        );
        if (!cancelled) {
          setContactLabels((prev) => ({
            ...prev,
            ...Object.fromEntries(entries),
          }));
        }
      };
      resolveLabels();
      return () => {
        cancelled = true;
      };
    }, [contacts, contactLabels]);

    const getContactLabelSync = (contact: MajikInvoiceContact): string =>
      contact.meta.label || contactLabels[contact.id] || "…";

    const getContactDisplayWithKey = (contact: MajikInvoiceContact) => {
      const label = contact.meta.label || contactLabels[contact.id] || "…";
      const publicKey = contactLabels[contact.id] || "";
      const showKey = !!(
        contact.meta.label &&
        contact.meta.label !== publicKey &&
        publicKey
      );
      return { label, showKey, publicKey };
    };

    // ── Dropdown / search state ───────────────────────────────────────────────
    const [showDropdown, setShowDropdown] = useState(false);
    const [query, setQuery] = useState("");
    const [highlightedIndex, setHighlightedIndex] = useState(0);
    const [searchMode, setSearchMode] = useState<SearchMode>("contact");
    const [pendingGroupContacts, setPendingGroupContacts] = useState<
      MajikInvoiceContact[] | null
    >(null);

    const wrapperRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Click outside
    useEffect(() => {
      const handleClickOutside = (event: MouseEvent): void => {
        if (
          wrapperRef.current &&
          !wrapperRef.current.contains(event.target as Node)
        ) {
          setShowDropdown(false);
          setQuery("");
          setPendingGroupContacts(null);
        }
      };
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // ── Fuse search ───────────────────────────────────────────────────────────
    const availableContacts = useMemo(
      () => visibleContacts.filter((c) => !list.some((sel) => sel.id === c.id)),
      [visibleContacts, list],
    );

    const searchableContacts = useMemo<SearchableContact[]>(
      () =>
        availableContacts.map((contact) => {
          const pk = contactLabels[contact.id] ?? "";
          const normalizedPk = normalize(pk);
          return {
            contact,
            label: contact.meta.label ?? "",
            publicKey: normalizedPk,
            publicKeyPrefix: normalizedPk.slice(0, 32),
          };
        }),
      [availableContacts, contactLabels],
    );

    const contactFuse = useMemo(
      () =>
        new Fuse(searchableContacts, {
          keys: [
            { name: "label", weight: 0.7 },
            { name: "publicKeyPrefix", weight: 0.3 },
          ],
          threshold: 0.45,
          ignoreLocation: true,
          includeScore: true,
          shouldSort: true,
          minMatchCharLength: 1,
          ignoreFieldNorm: true,
        }),
      [searchableContacts],
    );

    const searchableGroups = useMemo<SearchableGroup[]>(
      () =>
        groups.map((group) => ({
          group,
          name: group.meta.name ?? "",
          description: group.meta.description ?? "",
          id: group.id,
        })),
      [groups],
    );

    const groupFuse = useMemo(
      () =>
        new Fuse(searchableGroups, {
          keys: [
            { name: "name", weight: 0.6 },
            { name: "id", weight: 0.25 },
            { name: "description", weight: 0.15 },
          ],
          threshold: 0.45,
          ignoreLocation: true,
          includeScore: true,
          shouldSort: true,
          minMatchCharLength: 1,
          ignoreFieldNorm: true,
        }),
      [searchableGroups],
    );

    const normalizedQuery = useMemo(() => normalize(query), [query]);

    const filteredContacts = useMemo(() => {
      const isGroupPreview = !!pendingGroupContacts;
      const pool = isGroupPreview
        ? pendingGroupContacts!.filter(
            (c) => !list.some((sel) => sel.id === c.id),
          )
        : searchMode === "contact"
          ? availableContacts
          : [];

      if (!isGroupPreview && searchMode !== "contact") return [];
      if (!normalizedQuery) return pool;

      if (isGroupPreview) {
        const f = new Fuse(
          pool.map((contact) => {
            const pk = contactLabels[contact.id] ?? "";
            const normalizedPk = normalize(pk);
            return {
              contact,
              label: contact.meta.label ?? "",
              publicKey: normalizedPk,
              publicKeyPrefix: normalizedPk.slice(0, 32),
            };
          }),
          {
            keys: [
              { name: "label", weight: 0.7 },
              { name: "publicKeyPrefix", weight: 0.3 },
            ],
            threshold: 0.45,
            ignoreLocation: true,
            includeScore: true,
            shouldSort: true,
            minMatchCharLength: 1,
            ignoreFieldNorm: true,
          },
        );
        return f.search(normalizedQuery).map((r) => r.item.contact);
      }
      return contactFuse.search(normalizedQuery).map((r) => r.item.contact);
    }, [
      normalizedQuery,
      contactFuse,
      availableContacts,
      searchMode,
      pendingGroupContacts,
      list,
      contactLabels,
    ]);

    const filteredGroups = useMemo(() => {
      if (searchMode !== "group" || pendingGroupContacts) return [];
      if (!normalizedQuery) return searchableGroups.map((s) => s.group);
      return groupFuse.search(normalizedQuery).map((r) => r.item.group);
    }, [
      normalizedQuery,
      groupFuse,
      searchableGroups,
      searchMode,
      pendingGroupContacts,
    ]);

    // ── Handlers ──────────────────────────────────────────────────────────────
    const commitContacts = (incoming: MajikInvoiceContact[]): void => {
      if (isSingleMode) {
        const picked = incoming[0];
        if (!picked) return;
        setList([picked]);
        emit([picked]);
      } else {
        const deduped = incoming.filter(
          (c) => !list.some((sel) => sel.id === c.id),
        );
        if (
          maxContacts !== undefined &&
          list.length + deduped.length > maxContacts
        ) {
          toast.error(`You can only select up to ${maxContacts} recipients.`);
          const allowed = deduped.slice(0, maxContacts - list.length);
          const updated = [...list, ...allowed];
          setList(updated);
          emit(updated);
          return;
        }
        const updated = [...list, ...deduped];
        setList(updated);
        emit(updated);
      }
      setQuery("");
      setShowDropdown(false);
      setHighlightedIndex(0);
      setPendingGroupContacts(null);
    };

    const handleSelectContact = (contact: MajikInvoiceContact): void => {
      if (disabled || !activeAccount) return;
      if (list.some((c) => c.id === contact.id)) {
        toast.error("This contact is already added.");
        return;
      }
      if (
        maxContacts !== undefined &&
        !isSingleMode &&
        list.length >= maxContacts
      ) {
        toast.error(`You can only select up to ${maxContacts} recipients.`);
        return;
      }
      commitContacts([contact]);
    };

    const handleSelectGroup = (group: MajikInvoiceContactGroup): void => {
      if (disabled || !activeAccount) return;
      const memberIds = group.listMemberIds();
      // Exclude self from group members too
      const groupContacts = visibleContacts.filter((c) =>
        memberIds.includes(c.id),
      );
      if (groupContacts.length === 0) {
        toast.error("This group has no contacts in your directory.");
        return;
      }
      setSearchMode("contact");
      setPendingGroupContacts(groupContacts);
      setQuery("");
      setHighlightedIndex(0);
      toast.success(
        `${group.meta.name} — ${groupContacts.length} contact${groupContacts.length !== 1 ? "s" : ""} loaded`,
      );
    };

    const handleRemove = (index: number, e: React.MouseEvent): void => {
      e.stopPropagation();
      if (disabled) return;
      const updated = list.filter((_, i) => i !== index);
      if (!allowEmpty && updated.length === 0) {
        toast.error("Recipient cannot be empty.");
        return;
      }
      setList(updated);
      emit(updated);
    };

    const handleClearAll = (): void => {
      setList([]);
      setQuery("");
      setShowDropdown(false);
      setPendingGroupContacts(null);
      emit([]);
    };

    const handleSelectAllGroupMembers = (): void => {
      if (!pendingGroupContacts) return;
      const unselected = pendingGroupContacts.filter(
        (c) => !list.some((sel) => sel.id === c.id),
      );
      if (unselected.length === 0) {
        toast.error("All group members are already selected.");
        return;
      }
      commitContacts(unselected);
    };

    const toggleSearchMode = (): void => {
      if (disabled || !activeAccount) return;
      const next: SearchMode = searchMode === "contact" ? "group" : "contact";
      setSearchMode(next);
      setPendingGroupContacts(null);
      setQuery("");
      setHighlightedIndex(0);
      setShowDropdown(true);
      inputRef.current?.focus();
    };

    const handleInputChange = (
      e: React.ChangeEvent<HTMLInputElement>,
    ): void => {
      if (disabled || !activeAccount) return;
      setQuery(e.target.value);
      setShowDropdown(true);
      setHighlightedIndex(0);
    };

    const handleInputFocus = (): void => {
      if (disabled || !activeAccount) return;
      if (
        searchMode === "contact" &&
        !pendingGroupContacts &&
        visibleContacts.length === 0
      ) {
        toast.error("No contacts available.");
        return;
      }
      if (searchMode === "group" && groups.length === 0) {
        toast.error("No groups available.");
        return;
      }
      setShowDropdown(true);
    };

    const allDropdownItems =
      searchMode === "group" && !pendingGroupContacts
        ? filteredGroups
        : filteredContacts;

    const handleKeyDown = (e: React.KeyboardEvent): void => {
      if (disabled || !activeAccount) return;
      if (e.key === "Backspace" && query === "" && list.length > 0) {
        e.preventDefault();
        if (allowEmpty || list.length > 1) {
          const updated = list.slice(0, -1);
          setList(updated);
          emit(updated);
        } else {
          toast.error("Recipient cannot be empty.", {
            id: "toast-error-remove-last",
          });
        }
        return;
      }
      if (!showDropdown) return;
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setHighlightedIndex((prev) =>
            prev < allDropdownItems.length - 1 ? prev + 1 : prev,
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
          break;
        case "Enter":
          e.preventDefault();
          if (searchMode === "group" && !pendingGroupContacts) {
            const g = filteredGroups[highlightedIndex];
            if (g) handleSelectGroup(g);
          } else {
            const c = filteredContacts[highlightedIndex];
            if (c) handleSelectContact(c);
          }
          break;
        case "Escape":
          e.preventDefault();
          setShowDropdown(false);
          setQuery("");
          setPendingGroupContacts(null);
          break;
      }
    };

    // Scroll highlighted item into view
    useEffect(() => {
      if (showDropdown && dropdownRef.current) {
        const el = dropdownRef.current.children[
          highlightedIndex
        ] as HTMLElement;
        if (el) el.scrollIntoView({ block: "nearest" });
      }
    }, [highlightedIndex, showDropdown]);

    // ── Modal success handlers ─────────────────────────────────────────────────
    const handleModalSuccess = useCallback(() => {
      setInternalRefreshKey((k) => k + 1);
      setImportOpen(false);
      setCreateOpen(false);
    }, []);

    // ── Derived ───────────────────────────────────────────────────────────────
    const isAtMax = maxContacts !== undefined && list.length >= maxContacts;
    const isDisabled = disabled || !activeAccount;

    const inputPlaceholder = (() => {
      if (!activeAccount) return "";
      if (isDisabled) return "";
      if (isSingleMode && list.length > 0) return "Replace recipient…";
      if (pendingGroupContacts)
        return `Filter ${pendingGroupContacts.length} group members…`;
      if (searchMode === "group")
        return "Search by group name, ID, or description…";
      if (list.length === 0) return "Type to search recipients…";
      return "Type name or public key…";
    })();

    // ── Render ────────────────────────────────────────────────────────────────
    return (
      <SelectorWrapper ref={wrapperRef} id={id}>
        {/* ── No active account banner ── */}
        {!activeAccount && (
          <NoAccountBanner $compact={compact}>
            <BannerIconRow>
              <LockKeyIcon size={compact ? 20 : 26} weight="duotone" />
            </BannerIconRow>
            <BannerBody>
              <BannerTitle>No key account active</BannerTitle>
              <BannerHint>
                Create a new key account or import one from a seed backup. A key
                account is required to send and receive messages.
              </BannerHint>
              <BannerActions>
                <BannerBtn onClick={() => setImportOpen(true)} type="button">
                  <ImportIcon size={11} weight="bold" /> Import
                </BannerBtn>
                <BannerBtn
                  $primary
                  onClick={() => setCreateOpen(true)}
                  type="button"
                >
                  <PlusIcon size={11} weight="bold" /> Create New
                </BannerBtn>
              </BannerActions>
            </BannerBody>
          </NoAccountBanner>
        )}

        {/* ── Selector ── */}
        <InputContainer
          $compact={compact}
          $disabled={isDisabled}
          onClick={() => !isDisabled && inputRef.current?.focus()}
        >
          {!isSingleMode &&
            list.map((contact, index) => (
              <Tag key={contact.id} $compact={compact}>
                <span data-private>{getContactLabelSync(contact)}</span>
                {!isDisabled && (
                  <RemoveButton onClick={(e) => handleRemove(index, e)}>
                    ✕
                  </RemoveButton>
                )}
              </Tag>
            ))}

          {isSingleMode && list.length > 0 && !showDropdown && (
            <SingleContactCard
              $compact={compact}
              onClick={() => {
                if (!isDisabled) {
                  setShowDropdown(true);
                  inputRef.current?.focus();
                }
              }}
            >
              <SingleContactInfo>
                <SingleContactName data-private>
                  {getContactLabelSync(list[0])}
                </SingleContactName>
                <SingleContactMeta>
                  {list[0].meta.legalName && (
                    <SingleContactMetaItem data-private>
                      {list[0].meta.legalName}
                    </SingleContactMetaItem>
                  )}
                  {list[0].meta.tin && (
                    <SingleContactMetaItem data-private $mono>
                      TIN: {list[0].meta.tin}
                    </SingleContactMetaItem>
                  )}
                  {contactLabels[list[0].id] && (
                    <SingleContactMetaItem data-private $mono $muted>
                      {contactLabels[list[0].id]}
                    </SingleContactMetaItem>
                  )}
                </SingleContactMeta>
              </SingleContactInfo>
              {!isDisabled && (
                <RemoveButton
                  onClick={(e) => handleRemove(0, e)}
                  style={{ alignSelf: "flex-start", paddingTop: "1px" }}
                >
                  ✕
                </RemoveButton>
              )}
            </SingleContactCard>
          )}

          <InputRow $hidden={isSingleMode && list.length > 0 && !showDropdown}>
            <ModeToggle
              $compact={compact}
              $active={searchMode === "group"}
              $disabled={isDisabled}
              onClick={(e) => {
                e.stopPropagation();
                toggleSearchMode();
              }}
              title={
                searchMode === "contact"
                  ? "Switch to group search"
                  : "Switch to contact search"
              }
              type="button"
              disabled={isDisabled}
            >
              {pendingGroupContacts ? (
                <UsersIcon size={compact ? 12 : 14} weight="fill" />
              ) : searchMode === "group" ? (
                <UsersIcon size={compact ? 12 : 14} />
              ) : (
                <UserIcon size={compact ? 12 : 14} />
              )}
            </ModeToggle>

            {pendingGroupContacts && (
              <GroupBadge $compact={compact}>
                {pendingGroupContacts.length} members
                <ClearGroupButton
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPendingGroupContacts(null);
                    setQuery("");
                  }}
                >
                  ✕
                </ClearGroupButton>
              </GroupBadge>
            )}

            <StyledInput
              $compact={compact}
              ref={inputRef}
              type="text"
              value={query}
              onChange={handleInputChange}
              onFocus={handleInputFocus}
              onKeyDown={handleKeyDown}
              disabled={isDisabled || (isAtMax && !isSingleMode)}
              placeholder={inputPlaceholder}
            />
          </InputRow>
        </InputContainer>

        {/* ── Max count badge ── */}
        {maxContacts !== undefined && !isSingleMode && (
          <CountBadge $atMax={isAtMax} $compact={compact}>
            {list.length} / {maxContacts}
          </CountBadge>
        )}

        {/* ── Dropdown ── */}
        {showDropdown && activeAccount && (
          <Dropdown ref={dropdownRef}>
            {searchMode === "group" && !pendingGroupContacts && (
              <>
                {filteredGroups.length > 0 ? (
                  filteredGroups.map((group, index) => (
                    <DropdownItem
                      key={group.id}
                      $highlighted={index === highlightedIndex}
                      onClick={() => handleSelectGroup(group)}
                      onMouseEnter={() => setHighlightedIndex(index)}
                    >
                      <GroupItemLeft>
                        <GroupItemIcon>
                          <UsersIcon size={13} />
                        </GroupItemIcon>
                        <GroupItemInfo>
                          <ContactLabel data-private>
                            {group.meta.name}
                          </ContactLabel>
                          {group.meta.description && (
                            <GroupDescription data-private>
                              {group.meta.description}
                            </GroupDescription>
                          )}
                        </GroupItemInfo>
                      </GroupItemLeft>
                      <MemberCount>{group.memberCount()} members</MemberCount>
                    </DropdownItem>
                  ))
                ) : (
                  <EmptyState>No groups found</EmptyState>
                )}
              </>
            )}

            {(searchMode === "contact" || pendingGroupContacts) && (
              <>
                {pendingGroupContacts && (
                  <GroupPreviewHeader $compact={compact}>
                    <UsersIcon size={12} weight="fill" /> Select from group
                    members
                  </GroupPreviewHeader>
                )}

                {pendingGroupContacts &&
                  (() => {
                    const unselectedCount = pendingGroupContacts.filter(
                      (c) => !list.some((sel) => sel.id === c.id),
                    ).length;
                    return unselectedCount > 0 ? (
                      <SelectAllItem onClick={handleSelectAllGroupMembers}>
                        <UsersIcon size={14} weight="fill" />
                        Add all {unselectedCount} member
                        {unselectedCount !== 1 ? "s" : ""}
                      </SelectAllItem>
                    ) : null;
                  })()}

                {filteredContacts.length > 0 ? (
                  filteredContacts.map((contact, index) => {
                    const { label, showKey, publicKey } =
                      getContactDisplayWithKey(contact);
                    return (
                      <DropdownItem
                        key={contact.id}
                        $highlighted={index === highlightedIndex}
                        onClick={() => handleSelectContact(contact)}
                        onMouseEnter={() => setHighlightedIndex(index)}
                      >
                        <ContactLabel data-private>{label}</ContactLabel>
                        {showKey && (
                          <PublicKey data-private>{publicKey}</PublicKey>
                        )}
                      </DropdownItem>
                    );
                  })
                ) : (
                  <EmptyState>
                    {pendingGroupContacts
                      ? "All group members already selected"
                      : "No contacts found"}
                  </EmptyState>
                )}
              </>
            )}

            {list.length > 0 && (
              <>
                <Divider />
                <ActionItem onClick={handleClearAll}>
                  <TrashIcon size={16} /> Clear All
                </ActionItem>
              </>
            )}
          </Dropdown>
        )}

        {/* ── Modals ── */}
        <ImportKeyModal
          open={importOpen}
          onOpenChange={setImportOpen}
          majik={majik}
          onSuccess={handleModalSuccess}
        />
        <CreateKeyModal
          open={createOpen}
          onOpenChange={setCreateOpen}
          majik={majik}
          onSuccess={handleModalSuccess}
        />
      </SelectorWrapper>
    );
  },
);

export default MajikRecipientSelector;

MajikRecipientSelector.displayName = "MajikRecipientSelector";

// ── Styled Components ────────────────────────────────────────────────────────

const SelectorWrapper = styled.div`
  position: relative;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

// ── No account banner ────────────────────────────────────────────────────────

const NoAccountBanner = styled.div<{ $compact?: boolean }>`
  display: flex;
  align-items: flex-start;
  gap: ${({ $compact }) => ($compact ? "10px" : "14px")};
  padding: ${({ $compact }) => ($compact ? "10px 12px" : "14px 16px")};
  background: ${({ theme }) => theme.colors.secondaryBackground};
  border: 1px solid ${({ theme }) => theme.colors.secondaryBackground};
  border-radius: ${({ $compact }) => ($compact ? "8px" : "10px")};
  animation: ${slideDown} 0.18s ease;
`;

const BannerIconRow = styled.div`
  flex-shrink: 0;
  opacity: 0.7;
  padding-top: 2px;
  color: ${({ theme }) => theme.colors.textSecondary};
`;

const BannerBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
  min-width: 0;
`;

const BannerTitle = styled.span`
  font-size: 0.875rem;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textPrimary};
`;

const BannerHint = styled.span`
  font-size: 0.775rem;
  color: ${({ theme }) => theme.colors.textSecondary};
  line-height: 1.4;
`;

const BannerActions = styled.div`
  display: flex;
  gap: 8px;
  margin-top: 4px;
`;

const BannerBtn = styled.button<{ $primary?: boolean }>`
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 5px 12px;
  font-size: 0.775rem;
  font-weight: 500;
  border-radius: 6px;
  cursor: pointer;
  border: 1px solid
    ${({ theme, $primary }) =>
      $primary ? theme.colors.primary : theme.colors.secondaryBackground};
  background: ${({ theme, $primary }) =>
    $primary ? theme.colors.primary : "transparent"};
  color: ${({ theme, $primary }) =>
    $primary ? theme.colors.primaryBackground : theme.colors.textPrimary};
  transition: all 0.15s ease;
  &:hover {
    opacity: 0.85;
  }
`;

// ── Selector ─────────────────────────────────────────────────────────────────

const RemoveButton = styled.button`
  border: none;
  background: transparent;
  color: ${({ theme }) => theme.colors.textSecondary};
  font-size: 0.875rem;
  cursor: pointer;
  padding: 0;
  margin: 0;
  line-height: 1;
  transition: color 0.2s ease;
  &:hover {
    color: #e74c3c;
  }
`;

const InputContainer = styled.div<{ $compact?: boolean; $disabled?: boolean }>`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-height: ${({ $compact }) => ($compact ? "30px" : "42px")};
  border: 1px solid ${({ theme }) => theme.colors.secondaryBackground};
  border-radius: ${({ $compact }) => ($compact ? "7px" : "8px")};
  padding: ${({ $compact }) => ($compact ? "3px 7px" : "6px 10px")};
  background: ${({ theme }) => theme.colors.secondaryBackground};
  cursor: ${({ $disabled }) => ($disabled ? "not-allowed" : "text")};
  opacity: ${({ $disabled }) => ($disabled ? 0.5 : 1)};
  transition: opacity 0.2s ease;
`;

const InputRow = styled.div<{ $hidden?: boolean }>`
  display: ${({ $hidden }) => ($hidden ? "none" : "flex")};
  align-items: center;
  flex: 1;
  gap: 6px;
  min-width: 0;
`;

const Tag = styled.span<{ $compact?: boolean }>`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: ${({ $compact }) => ($compact ? "2px 6px" : "5px 10px")};
  background-color: ${({ theme }) => theme.colors.primaryBackground};
  color: ${({ theme }) => theme.colors.textPrimary};
  border-radius: ${({ $compact }) => ($compact ? "5px" : "6px")};
  font-size: ${({ $compact }) => ($compact ? "10px" : "0.875rem")};
  white-space: nowrap;
  transition: all 0.2s ease;
  &:hover {
    transform: scale(1.05);
  }
`;

const SingleContactCard = styled.div<{ $compact?: boolean }>`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  flex: 1;
  padding: ${({ $compact }) => ($compact ? "4px 6px" : "6px 8px")};
  background-color: ${({ theme }) => theme.colors.primaryBackground};
  color: ${({ theme }) => theme.colors.textPrimary};
  border-radius: ${({ $compact }) => ($compact ? "5px" : "6px")};
  cursor: pointer;
  transition: opacity 0.2s ease;
  &:hover {
    opacity: 0.85;
  }
`;

const SingleContactInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
  flex: 1;
`;

const SingleContactName = styled.span`
  font-size: 0.875rem;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textPrimary};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const SingleContactMeta = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1px;
`;

const SingleContactMetaItem = styled.span<{
  $mono?: boolean;
  $muted?: boolean;
}>`
  font-size: 0.72rem;
  font-family: ${({ $mono }) => ($mono ? "monospace" : "inherit")};
  color: ${({ theme, $muted }) =>
    $muted ? theme.colors.textSecondary : theme.colors.textPrimary};
  opacity: ${({ $muted }) => ($muted ? 0.6 : 0.8)};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const ModeToggle = styled.button<{
  $compact?: boolean;
  $active?: boolean;
  $disabled?: boolean;
}>`
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: ${({ $compact }) => ($compact ? "20px" : "24px")};
  height: ${({ $compact }) => ($compact ? "20px" : "24px")};
  border: 1px solid
    ${({ theme, $active }) =>
      $active ? theme.colors.primary : theme.colors.secondaryBackground};
  border-radius: 5px;
  background: ${({ theme, $active }) =>
    $active ? theme.colors.primary : "transparent"};
  color: ${({ theme, $active }) =>
    $active ? theme.colors.primaryBackground : theme.colors.textSecondary};
  cursor: ${({ $disabled }) => ($disabled ? "not-allowed" : "pointer")};
  transition: all 0.15s ease;
  padding: 0;
  &:hover:not(:disabled) {
    border-color: ${({ theme }) => theme.colors.primary};
    color: ${({ theme }) => theme.colors.primary};
  }
`;

const GroupBadge = styled.span<{ $compact?: boolean }>`
  display: flex;
  align-items: center;
  gap: 4px;
  padding: ${({ $compact }) => ($compact ? "1px 6px" : "2px 8px")};
  background: ${({ theme }) =>
    theme.gradients?.secondary ?? theme.colors.secondaryBackground};
  color: ${({ theme }) => theme.colors.textPrimary};
  border-radius: 4px;
  font-size: ${({ $compact }) => ($compact ? "9px" : "0.75rem")};
  white-space: nowrap;
  flex-shrink: 0;
`;

const ClearGroupButton = styled.button`
  border: none;
  background: transparent;
  color: ${({ theme }) => theme.colors.textSecondary};
  font-size: 0.75rem;
  cursor: pointer;
  padding: 0;
  margin: 0;
  line-height: 1;
  transition: color 0.15s ease;
  &:hover {
    color: #e74c3c;
  }
`;

const StyledInput = styled.input<{ $compact?: boolean }>`
  flex: 1;
  min-width: ${({ $compact }) => ($compact ? "70px" : "120px")};
  border: none;
  background: transparent;
  color: ${({ theme }) => theme.colors.textPrimary};
  font-size: ${({ $compact }) => ($compact ? "10px" : "0.875rem")};
  outline: none;
  padding: 4px 0;
  &::placeholder {
    color: ${({ theme }) => theme.colors.textSecondary};
  }
  &:disabled {
    cursor: not-allowed;
  }
`;

const CountBadge = styled.div<{ $atMax?: boolean; $compact?: boolean }>`
  display: flex;
  justify-content: flex-end;
  font-size: ${({ $compact }) => ($compact ? "9px" : "0.7rem")};
  color: ${({ theme, $atMax }) =>
    $atMax ? "#e74c3c" : theme.colors.textSecondary};
  margin-top: -4px;
  padding-right: 2px;
  animation: ${({ $atMax }) => ($atMax ? pulse : "none")} 1.5s ease-in-out
    infinite;
`;

const Dropdown = styled.div`
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  max-height: 300px;
  overflow-y: auto;
  background: ${({ theme }) => theme.colors.primaryBackground};
  border: 1px solid ${({ theme }) => theme.colors.secondaryBackground};
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  z-index: 1000;
  animation: ${fadeIn} 0.12s ease;
`;

const DropdownItem = styled.div<{ $highlighted: boolean }>`
  padding: 10px 16px;
  cursor: pointer;
  background: ${({ theme, $highlighted }) =>
    $highlighted
      ? (theme.gradients?.secondary ?? theme.colors.secondaryBackground)
      : theme.colors.secondaryBackground};
  color: ${({ theme }) => theme.colors.textPrimary};
  transition: all 0.15s ease;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-direction: row;
  &:hover {
    background: ${({ theme }) => theme.colors.primary};
    color: ${({ theme }) => theme.colors.primaryBackground};
  }
`;

const GroupPreviewHeader = styled.div<{ $compact?: boolean }>`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: ${({ $compact }) => ($compact ? "5px 12px" : "7px 16px")};
  font-size: ${({ $compact }) => ($compact ? "9px" : "0.7rem")};
  color: ${({ theme }) => theme.colors.textSecondary};
  border-bottom: 1px solid ${({ theme }) => theme.colors.secondaryBackground};
  text-transform: uppercase;
  letter-spacing: 0.05em;
`;

const GroupItemLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
`;

const GroupItemIcon = styled.div`
  flex-shrink: 0;
  opacity: 0.6;
`;

const GroupItemInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
`;

const GroupDescription = styled.span`
  font-size: 0.72rem;
  opacity: 0.65;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 220px;
`;

const MemberCount = styled.span`
  font-size: 0.72rem;
  opacity: 0.55;
  flex-shrink: 0;
  margin-left: 8px;
`;

const EmptyState = styled.div`
  padding: 16px;
  text-align: center;
  color: ${({ theme }) => theme.colors.textSecondary};
  font-size: 0.875rem;
`;

const Divider = styled.div`
  height: 1px;
  background: ${({ theme }) => theme.colors.secondaryBackground};
  margin: 4px 0;
`;

const ActionItem = styled.div`
  padding: 10px 16px;
  cursor: pointer;
  color: ${({ theme }) => theme.colors.textPrimary};
  font-size: 0.875rem;
  transition: all 0.15s ease;
  display: flex;
  align-items: center;
  gap: 8px;
  &:hover {
    background: ${({ theme }) => theme.colors.secondaryBackground};
  }
`;

const ContactLabel = styled.span`
  font-weight: 500;
`;

const PublicKey = styled.span`
  font-size: 0.8rem;
  opacity: 0.8;
  font-family: monospace;
`;

const SelectAllItem = styled.div`
  padding: 9px 16px;
  cursor: pointer;
  color: ${({ theme }) => theme.colors.primary};
  font-size: 0.8rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 7px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.secondaryBackground};
  transition: all 0.15s ease;
  &:hover {
    background: ${({ theme }) => theme.colors.primary};
    color: ${({ theme }) => theme.colors.primaryBackground};
  }
`;
