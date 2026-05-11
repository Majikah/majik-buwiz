/**
 * modals/PickContactModal.tsx
 *
 * Single-select contact picker modal. Lets the user choose a contact from
 * their directory (filtered — self excluded), OR import from a file / invite
 * string. On confirm the caller receives a `Partial<Party>` auto-filled from
 * `contact.meta`.
 *
 * Usage:
 *   <PickContactModal
 *     open={open}
 *     onOpenChange={setOpen}
 *     majik={majik}
 *     onSelect={(patch) => onRecipientChange(patch)}
 *   />
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import styled, { keyframes } from "styled-components";
import { toast } from "sonner";
import Fuse from "fuse.js";
import {
  AddressBookIcon,
  KeyboardIcon,
  MagnifyingGlassIcon,
  UploadSimpleIcon,
  UserIcon,
  XIcon,
} from "@phosphor-icons/react";

import DynamicPopUp from "@/components/functional/DynamicPopUp";
import CustomInputField from "@/components/foundations/CustomInputField";
import DropImportContact from "@/components/foundations/DropImportContact";

import { Party } from "@majikah/majik-invoice";
import { MajikInvoiceContact } from "@/SDK/majik-buwiz-client/src/core/party/majik-invoice-contact";
import {
  ImportModeToggle,
  ModeToggleButton,
} from "@/components/panels/shared/atoms";

// ─── Types ────────────────────────────────────────────────────────────────────

type InputMode = "directory" | "file" | "string";

interface PickContactModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Majik SDK instance */
  majik: any;
  /** Called with a Party patch when the user confirms */
  onSelect: (patch: Partial<Party>) => void;
  /** Label for the section being filled — shown in the modal title */
  partyLabel?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const normalize = (v: string): string =>
  v.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Map MajikInvoiceContactMeta → Partial<Party> */
function metaToParty(contact: MajikInvoiceContact): Partial<Party> {
  const m = contact.meta;
  return {
    legalName: m.legalName ?? "",
    tradeName: m.tradeName,
    tin: m.tin,
    email: m.email,
    phone: m.phone,
    address: m.address
      ? {
          line1: m.address.line1 ?? "",
          city: m.address.city ?? "",
          stateOrProvince: m.address.stateOrProvince,
          postalCode: m.address.postalCode,
          country: m.address.country ?? "",
        }
      : undefined,
  };
}

// ─── Animations ───────────────────────────────────────────────────────────────

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(-3px); }
  to   { opacity: 1; transform: translateY(0); }
`;

// ─── Component ────────────────────────────────────────────────────────────────

export const PickContactModal: React.FC<PickContactModalProps> = React.memo(
  ({ open, onOpenChange, majik, onSelect, partyLabel = "Recipient" }) => {
    // ── Mode ──────────────────────────────────────────────────────────────────
    const [inputMode, setInputMode] = useState<InputMode>("directory");

    // ── Directory state ───────────────────────────────────────────────────────
    const [query, setQuery] = useState("");
    const [selected, setSelected] = useState<MajikInvoiceContact | null>(null);
    const [highlightedIndex, setHighlightedIndex] = useState(0);
    const [contactLabels, setContactLabels] = useState<Record<string, string>>(
      {},
    );

    // ── Import-string state ───────────────────────────────────────────────────
    const [inviteKey, setInviteKey] = useState("");

    const inputRef = useRef<HTMLInputElement>(null);

    // Reset on open
    useEffect(() => {
      if (open) {
        setInputMode("directory");
        setQuery("");
        setSelected(null);
        setHighlightedIndex(0);
        setInviteKey("");
      }
    }, [open]);

    // ── Data ──────────────────────────────────────────────────────────────────
    const activeAccount: MajikInvoiceContact | null = useMemo(() => {
      if (!majik) return null;
      return majik.getActiveAccount() ?? null;
    }, [majik]);

    const contacts: MajikInvoiceContact[] = useMemo(() => {
      if (!majik) return [];
      // Exclude self
      const all: MajikInvoiceContact[] = majik.listContacts(false);
      return all.filter((c) => c.id !== activeAccount?.id);
    }, [majik, activeAccount]);

    // Resolve public-key labels async
    useEffect(() => {
      let cancelled = false;
      const run = async () => {
        const unresolved = contacts.filter((c) => contactLabels[c.id] == null);
        if (!unresolved.length) return;
        const entries = await Promise.all(
          unresolved.map(async (c) => {
            const pk = await c.getPublicKeyBase64();
            return [c.id, pk] as const;
          }),
        );
        if (!cancelled)
          setContactLabels((prev) => ({
            ...prev,
            ...Object.fromEntries(entries),
          }));
      };
      run();
      return () => {
        cancelled = true;
      };
    }, [contacts, contactLabels]);

    const getLabel = (c: MajikInvoiceContact) =>
      c.meta.label || contactLabels[c.id] || "…";

    // ── Fuse search ───────────────────────────────────────────────────────────
    type Searchable = {
      contact: MajikInvoiceContact;
      label: string;
      pkPrefix: string;
    };

    const searchable = useMemo<Searchable[]>(
      () =>
        contacts.map((c) => {
          const pk = normalize(contactLabels[c.id] ?? "");
          return {
            contact: c,
            label: c.meta.label ?? "",
            pkPrefix: pk.slice(0, 32),
          };
        }),
      [contacts, contactLabels],
    );

    const fuse = useMemo(
      () =>
        new Fuse(searchable, {
          keys: [
            { name: "label", weight: 0.7 },
            { name: "pkPrefix", weight: 0.3 },
          ],
          threshold: 0.45,
          ignoreLocation: true,
          includeScore: true,
          shouldSort: true,
          minMatchCharLength: 1,
        }),
      [searchable],
    );

    const normalizedQuery = useMemo(() => normalize(query), [query]);

    const filtered = useMemo<MajikInvoiceContact[]>(() => {
      if (!normalizedQuery) return contacts;
      return fuse.search(normalizedQuery).map((r) => r.item.contact);
    }, [normalizedQuery, fuse, contacts]);

    // ── Keyboard nav ──────────────────────────────────────────────────────────
    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightedIndex((i) => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const c = filtered[highlightedIndex];
        if (c) setSelected(c);
      } else if (e.key === "Escape") {
        onOpenChange(false);
      }
    };

    // ── Import handlers ───────────────────────────────────────────────────────
    const handleDropFileLoaded = useCallback(
      (s: string) => setInviteKey(s),
      [],
    );
    const handleDropClear = useCallback(() => setInviteKey(""), []);

    // ── Confirm ───────────────────────────────────────────────────────────────
    const handleConfirm = useCallback(async () => {
      // Directory mode — use selected contact
      if (inputMode === "directory") {
        if (!selected) {
          toast.error("Please select a contact.");
          return;
        }
        onSelect(metaToParty(selected));
        onOpenChange(false);
        return;
      }

      // File / string import mode
      if (!inviteKey?.trim()) {
        toast.error("Please provide a valid invite key or file.");
        return;
      }
      try {
        const res = await majik.importContactFromString(inviteKey);
        if (!res.success) {
          toast.error("Failed to load contact", { description: res.message });
          return;
        }
        // The imported contact is the freshest — grab it
        const all: MajikInvoiceContact[] = majik.listContacts(false);
        const newest = all
          .filter((c) => c.id !== activeAccount?.id)
          .sort(
            (a, b) =>
              new Date(b.meta.createdAt).getTime() -
              new Date(a.meta.createdAt).getTime(),
          )[0];
        if (newest) {
          onSelect(metaToParty(newest));
          toast.success("Contact loaded successfully.");
        }
        onOpenChange(false);
      } catch (e: any) {
        toast.error("Failed to load contact", {
          description: e?.message ?? String(e),
        });
      }
    }, [
      inputMode,
      selected,
      inviteKey,
      majik,
      activeAccount,
      onSelect,
      onOpenChange,
    ]);

    const isConfirmDisabled =
      inputMode === "directory" ? !selected : !inviteKey?.trim();

    // ─── Render ───────────────────────────────────────────────────────────────
    return (
      <DynamicPopUp
        isOpen={open}
        onOpenChange={onOpenChange}
        scrollable
        modal={{
          title: `Pick ${partyLabel}`,
          description: `Choose from your contact directory or load a contact card.`,
        }}
        buttons={{
          cancel: { text: "Cancel", onClick: () => onOpenChange(false) },
          confirm: {
            text: inputMode === "directory" ? "Use Contact" : "Load & Apply",
            onClick: handleConfirm,
            isDisabled: isConfirmDisabled,
          },
        }}
      >
        {/* Mode tabs */}
        <ImportModeToggle>
          <ModeToggleButton
            $active={inputMode === "directory"}
            onClick={() => setInputMode("directory")}
            type="button"
          >
            <AddressBookIcon size={12} />
            Directory
          </ModeToggleButton>
          <ModeToggleButton
            $active={inputMode === "file"}
            onClick={() => {
              setInputMode("file");
              handleDropClear();
            }}
            type="button"
          >
            <UploadSimpleIcon size={12} />
            Backup file
          </ModeToggleButton>
          <ModeToggleButton
            $active={inputMode === "string"}
            onClick={() => {
              setInputMode("string");
              handleDropClear();
            }}
            type="button"
          >
            <KeyboardIcon size={12} />
            Enter key
          </ModeToggleButton>
        </ImportModeToggle>

        {/* ── Directory tab ── */}
        {inputMode === "directory" && (
          <DirectoryPane>
            <SearchRow>
              <SearchIcon>
                <MagnifyingGlassIcon size={13} />
              </SearchIcon>
              <SearchInput
                ref={inputRef}
                autoFocus
                placeholder="Search by name or public key…"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setHighlightedIndex(0);
                  if (selected) setSelected(null);
                }}
                onKeyDown={handleKeyDown}
              />
              {query && (
                <ClearBtn
                  type="button"
                  onClick={() => {
                    setQuery("");
                    inputRef.current?.focus();
                  }}
                >
                  <XIcon size={11} />
                </ClearBtn>
              )}
            </SearchRow>

            {contacts.length === 0 ? (
              <EmptyState>No contacts in your directory.</EmptyState>
            ) : filtered.length === 0 ? (
              <EmptyState>No contacts match "{query}".</EmptyState>
            ) : (
              <ContactList>
                {filtered.map((contact, idx) => {
                  const isHighlighted = idx === highlightedIndex;
                  const isSelected = selected?.id === contact.id;
                  const label = getLabel(contact);
                  const pk = contactLabels[contact.id];
                  const showPk = !!(
                    contact.meta.label &&
                    pk &&
                    contact.meta.label !== pk
                  );
                  return (
                    <ContactRow
                      key={contact.id}
                      $highlighted={isHighlighted}
                      $selected={isSelected}
                      onClick={() => setSelected(isSelected ? null : contact)}
                      onMouseEnter={() => setHighlightedIndex(idx)}
                    >
                      <ContactAvatar $selected={isSelected}>
                        <UserIcon
                          size={13}
                          weight={isSelected ? "fill" : "regular"}
                        />
                      </ContactAvatar>
                      <ContactInfo>
                        <ContactName data-private>{label}</ContactName>
                        {contact.meta.legalName &&
                          contact.meta.legalName !== label && (
                            <ContactSub data-private>
                              {contact.meta.legalName}
                            </ContactSub>
                          )}
                        {contact.meta.tin && (
                          <ContactSub data-private $mono>
                            TIN: {contact.meta.tin}
                          </ContactSub>
                        )}
                        {showPk && <ContactKey data-private>{pk}</ContactKey>}
                      </ContactInfo>
                      {isSelected && <SelectedDot />}
                    </ContactRow>
                  );
                })}
              </ContactList>
            )}
          </DirectoryPane>
        )}

        {/* ── File tab ── */}
        {inputMode === "file" && (
          <DropImportContact
            inviteKey={inviteKey}
            onFileLoaded={handleDropFileLoaded}
            onClear={handleDropClear}
          />
        )}

        {/* ── String tab ── */}
        {inputMode === "string" && (
          <CustomInputField
            currentValue={inviteKey}
            onChange={(e) => setInviteKey(e)}
            maxChar={10000}
            label="Invite Key / Contact String"
            required
            importProp={{ type: "txt" }}
            sensitive={true}
          />
        )}
      </DynamicPopUp>
    );
  },
);

PickContactModal.displayName = "PickContactModal";

// ─── Styled ───────────────────────────────────────────────────────────────────

const DirectoryPane = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  animation: ${fadeIn} 0.15s ease;
`;

const SearchRow = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  border: 1px solid ${({ theme }) => theme.colors.secondaryBackground};
  border-radius: 8px;
  padding: 6px 10px;
  background: ${({ theme }) => theme.colors.secondaryBackground};
`;

const SearchIcon = styled.span`
  color: ${({ theme }) => theme.colors.textSecondary};
  flex-shrink: 0;
  display: flex;
`;

const SearchInput = styled.input`
  flex: 1;
  border: none;
  background: transparent;
  color: ${({ theme }) => theme.colors.textPrimary};
  font-size: 0.875rem;
  outline: none;
  &::placeholder {
    color: ${({ theme }) => theme.colors.textSecondary};
  }
`;

const ClearBtn = styled.button`
  border: none;
  background: transparent;
  color: ${({ theme }) => theme.colors.textSecondary};
  cursor: pointer;
  display: flex;
  align-items: center;
  padding: 0;
  transition: color 0.15s ease;
  &:hover {
    color: #e74c3c;
  }
`;

const ContactList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 320px;
  overflow-y: auto;
  padding-right: 2px;
`;

const ContactRow = styled.div<{ $highlighted: boolean; $selected: boolean }>`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  border-radius: 8px;
  cursor: pointer;
  background: ${({ theme, $selected, $highlighted }) =>
    $selected
      ? `${theme.colors.primary}18`
      : $highlighted
        ? theme.colors.secondaryBackground
        : "transparent"};
  border: 1px solid
    ${({ theme, $selected }) =>
      $selected ? `${theme.colors.primary}44` : "transparent"};
  transition: all 0.12s ease;
  &:hover {
    background: ${({ theme, $selected }) =>
      $selected
        ? `${theme.colors.primary}22`
        : theme.colors.secondaryBackground};
  }
`;

const ContactAvatar = styled.div<{ $selected: boolean }>`
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${({ theme, $selected }) =>
    $selected ? theme.colors.primary : `${theme.colors.primary}18`};
  color: ${({ theme, $selected }) =>
    $selected ? theme.colors.primaryBackground : theme.colors.primary};
  transition: all 0.12s ease;
`;

const ContactInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
  flex: 1;
`;

const ContactName = styled.span`
  font-size: 0.875rem;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textPrimary};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const ContactSub = styled.span<{ $mono?: boolean }>`
  font-size: 0.72rem;
  color: ${({ theme }) => theme.colors.textSecondary};
  font-family: ${({ $mono }) => ($mono ? "monospace" : "inherit")};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  opacity: 0.8;
`;

const ContactKey = styled.span`
  font-size: 0.68rem;
  font-family: monospace;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.55;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const SelectedDot = styled.div`
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: ${({ theme }) => theme.colors.primary};
  flex-shrink: 0;
`;

const EmptyState = styled.div`
  padding: 20px 16px;
  text-align: center;
  color: ${({ theme }) => theme.colors.textSecondary};
  font-size: 0.875rem;
`;
