/**
 * ContactsSearchBar.tsx
 *
 * Provides:
 *  - Fuse.js fuzzy search across contact fields:
 *    name, legal name, TIN, public key, fingerprint, email, website, phone
 *  - Quick-filter chips: registered status
 *  - Emits filtered result set via onFilter
 */

import React, { useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import {
  //  FunnelIcon,
  MagnifyingGlassIcon,
  XIcon,
} from "@phosphor-icons/react";
import Fuse from "fuse.js";
import type { MajikInvoiceContact } from "@/SDK/majik-buwiz-client/src/core/party/majik-invoice-contact";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ContactFilterRegistered = "registered" | "local";

export interface ContactActiveFilters {
  registered: ContactFilterRegistered | null;
}

export interface ContactsSearchBarProps {
  contacts: MajikInvoiceContact[];
  /** Called whenever the filtered result set changes */
  onFilter: (filtered: MajikInvoiceContact[]) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Flatten a contact into a searchable plain object */
function toSearchable(c: MajikInvoiceContact) {
  const meta = c.meta as any;
  return {
    _raw: c,
    id: c.id ?? "",
    label: meta?.label ?? "",
    legalName: meta?.legalName ?? "",
    tin: meta?.tin ?? "",
    email: meta?.email ?? "",
    phone: meta?.phone ?? "",
    website: meta?.website ?? "",
    // publicKey / fingerprint — c.id is already the MUID/fingerprint
    fingerprint: c.id ?? "",
  };
}

// const REGISTERED_OPTIONS: ContactFilterRegistered[] = ["registered", "local"];

// const REGISTERED_LABEL: Record<ContactFilterRegistered, string> = {
//   registered: "Registered",
//   local: "Local only",
// };

// ---------------------------------------------------------------------------
// Styled
// ---------------------------------------------------------------------------

const Bar = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 18px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.secondaryBackground};
  background: ${({ theme }) => theme.colors.primaryBackground};
  flex-wrap: wrap;
  flex-shrink: 0;
`;

const SearchWrap = styled.div`
  position: relative;
  flex: 1;
  min-width: 180px;
  max-width: 380px;
`;

const SearchIconWrap = styled.span`
  position: absolute;
  left: 10px;
  top: 50%;
  transform: translateY(-50%);
  display: inline-flex;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.5;
  pointer-events: none;
`;

const ClearBtn = styled.button`
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border: none;
  background: none;
  cursor: pointer;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.45;
  padding: 0;
  border-radius: 50%;
  transition: opacity 0.12s;
  &:hover {
    opacity: 1;
  }
`;

const SearchInput = styled.input`
  width: 100%;
  padding: 7px 30px 7px 32px;
  border-radius: ${({ theme }) => theme.borders.radius.medium};
  border: 1px solid ${({ theme }) => theme.colors.primary}22;
  background: ${({ theme }) => theme.colors.secondaryBackground};
  color: ${({ theme }) => theme.colors.textPrimary};
  font-family: ${({ theme }) => theme.typography.fonts.light};
  font-size: 12px;
  transition:
    border-color 0.15s,
    background 0.15s;
  outline: none;

  &:focus {
    border-color: ${({ theme }) => theme.colors.primary}66;
    background: ${({ theme }) => theme.colors.primarySoft};
  }
  &::placeholder {
    color: ${({ theme }) => theme.colors.textSecondary};
    opacity: 0.45;
  }
`;

// const FilterGroup = styled.div`
//   display: flex;
//   align-items: center;
//   gap: 5px;
//   flex-wrap: wrap;
// `;

// const FilterLabel = styled.span`
//   font-family: ${({ theme }) => theme.typography.fonts.medium};
//   font-size: 10px;
//   color: ${({ theme }) => theme.colors.textSecondary};
//   opacity: 0.5;
//   letter-spacing: 0.06em;
//   text-transform: uppercase;
//   flex-shrink: 0;
//   display: inline-flex;
//   align-items: center;
//   gap: 4px;
// `;

// const FilterChip = styled.button<{ $active: boolean }>`
//   display: inline-flex;
//   align-items: center;
//   gap: 4px;
//   padding: 3px 10px;
//   border-radius: ${({ theme }) => theme.borders.radius.rounded};
//   font-family: ${({ theme }) => theme.typography.fonts.medium};
//   font-size: 10px;
//   cursor: pointer;
//   transition: all 0.12s;
//   flex-shrink: 0;

//   ${({ $active, theme }) =>
//     $active
//       ? css`
//           background: ${theme.colors.primarySoft};
//           color: ${theme.colors.primary};
//           border: 1px solid ${theme.colors.primary}44;
//         `
//       : css`
//           background: transparent;
//           color: ${theme.colors.textSecondary};
//           border: 1px solid ${theme.colors.primary}18;
//           opacity: 0.65;
//           &:hover {
//             background: ${theme.colors.primarySoft};
//             color: ${theme.colors.primary};
//             border-color: ${theme.colors.primary}33;
//             opacity: 1;
//           }
//         `}
// `;

// const ChipX = styled.span`
//   display: inline-flex;
//   align-items: center;
//   margin-left: 1px;
//   opacity: 0.6;
// `;

const Divider = styled.div`
  width: 1px;
  height: 20px;
  background: ${({ theme }) => theme.colors.primary}15;
  flex-shrink: 0;
  align-self: center;
`;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const ContactsSearchBar: React.FC<ContactsSearchBarProps> = ({
  contacts,
  onFilter,
}) => {
  const [query, setQuery] = useState("");
  // const [filters, setFilters] = useState<ContactActiveFilters>({
  //   registered: null,
  // });

  // ── Fuse instance ─────────────────────────────────────────────────────────

  const searchableItems = useMemo(() => contacts.map(toSearchable), [contacts]);

  const fuse = useMemo(
    () =>
      new Fuse(searchableItems, {
        keys: [
          { name: "label", weight: 0.3 },
          { name: "legalName", weight: 0.2 },
          { name: "email", weight: 0.15 },
          { name: "tin", weight: 0.12 },
          { name: "phone", weight: 0.1 },
          { name: "website", weight: 0.05 },
          { name: "fingerprint", weight: 0.05 },
          { name: "id", weight: 0.03 },
        ],
        threshold: 0.38,
        ignoreLocation: true,
        includeScore: true,
        shouldSort: true,
        minMatchCharLength: 2,
        useExtendedSearch: false,
        ignoreFieldNorm: true,
      }),
    [searchableItems],
  );

  // ── Combined filter + search ──────────────────────────────────────────────

  useEffect(() => {
    let result: MajikInvoiceContact[] =
      query.trim().length >= 2
        ? fuse.search(query).map((r) => r.item._raw)
        : contacts;

    // if (filters.registered === "registered") {
    //   result = result.filter((c) => c.isMajikahRegistered?.() ?? false);
    // } else if (filters.registered === "local") {
    //   result = result.filter((c) => !(c.isMajikahRegistered?.() ?? false));
    // }

    onFilter(result);
  }, [
    query,
    //  filters,
    contacts,
    fuse,
    onFilter,
  ]);

  // const toggleRegistered = useCallback((v: ContactFilterRegistered) => {
  //   setFilters((prev) => ({
  //     ...prev,
  //     registered: prev.registered === v ? null : v,
  //   }));
  // }, []);

  return (
    <Bar>
      {/* Search input */}
      <SearchWrap>
        <SearchIconWrap>
          <MagnifyingGlassIcon size={13} />
        </SearchIconWrap>
        <SearchInput
          type="text"
          placeholder="Search by name, TIN, email, phone, fingerprint…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {query && (
          <ClearBtn onClick={() => setQuery("")} title="Clear search">
            <XIcon size={10} weight="bold" />
          </ClearBtn>
        )}
      </SearchWrap>

      <Divider />

      {/* Registration filter */}
      {/* <FilterGroup>
        <FilterLabel>
          <FunnelIcon size={10} weight="fill" />
          Status
        </FilterLabel>
        {REGISTERED_OPTIONS.map((v) => (
          <FilterChip
            key={v}
            $active={filters.registered === v}
            onClick={() => toggleRegistered(v)}
          >
            {REGISTERED_LABEL[v]}
            {filters.registered === v && (
              <ChipX>
                <XIcon size={8} weight="bold" />
              </ChipX>
            )}
          </FilterChip>
        ))}
      </FilterGroup> */}
    </Bar>
  );
};
