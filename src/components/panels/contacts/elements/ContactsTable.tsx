/**
 * ContactsTable.tsx
 *
 * Table view for contacts with:
 *  - Sortable columns (name, legal name, TIN, email, phone, registration status)
 *  - Pagination
 *  - Row-level: view/edit, delete
 *  - Bulk operations: delete, export-as-backup (placeholder handler)
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import styled, { css } from "styled-components";
import {
  CaretDownIcon,
  CaretLeftIcon,
  CaretRightIcon,
  CaretUpDownIcon,
  CaretUpIcon,
  DownloadSimpleIcon,
  PencilSimpleIcon,
  TrashIcon,
  WifiHighIcon,
} from "@phosphor-icons/react";
import type { MajikInvoiceContact } from "@/SDK/majik-buwiz-client/src/core/party/majik-invoice-contact";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ContactSortType = "alpha" | "boolean";

export interface ContactColumnDef {
  key: string;
  header: string;
  render: (contact: MajikInvoiceContact) => React.ReactNode;
  sortValue?: (
    contact: MajikInvoiceContact,
  ) => string | number | null | undefined;
  sortable?: ContactSortType | false;
  minWidth?: string;
  align?: "left" | "center" | "right";
}

type SortDir = "asc" | "desc";

interface SortState {
  key: string;
  dir: SortDir;
  type: ContactSortType;
}

export interface ContactsTableProps {
  contacts: MajikInvoiceContact[];
  pageSize?: number;
  paginationAt?: "top" | "bottom" | "both";
  onEdit?: (contact: MajikInvoiceContact) => void;
  onDelete?: (contact: MajikInvoiceContact) => void;
  onBulkDelete?: (contacts: MajikInvoiceContact[]) => void;
  /** Placeholder — bulk backup export. Implement in ContactsPanel. */
  onBulkExportBackup?: (contacts: MajikInvoiceContact[]) => void;
  onSelectionChange?: (contacts: MajikInvoiceContact[]) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function shortenKey(key: string, chars = 6): string {
  const s = String(key);
  return `${s.slice(0, chars)}…${s.slice(-4)}`;
}

function getHue(str: string): number {
  return [...str].reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

// ---------------------------------------------------------------------------
// Default column definitions
// ---------------------------------------------------------------------------

const DEFAULT_COLUMNS: ContactColumnDef[] = [
  {
    key: "name",
    header: "Name",
    minWidth: "180px",
    sortable: "alpha",
    sortValue: (c) => c.meta?.label ?? "",
    render: (c) => {
      const name = c.meta?.label || "Unknown";
      const hue = getHue(name);
      const initials = getInitials(name);
      return (
        <NameCell>
          <ContactAvatar $hue={hue} data-private>
            {initials}
          </ContactAvatar>
          <NameText data-private>{name}</NameText>
        </NameCell>
      );
    },
  },
  {
    key: "legalName",
    header: "Legal Name",
    minWidth: "160px",
    sortable: "alpha",
    sortValue: (c) => (c.meta as any)?.legalName ?? "",
    render: (c) => {
      const v = (c.meta as any)?.legalName;
      return <CellText data-private>{v ?? <Muted>—</Muted>}</CellText>;
    },
  },
  {
    key: "tin",
    header: "TIN",
    minWidth: "130px",
    sortable: "alpha",
    sortValue: (c) => (c.meta as any)?.tin ?? "",
    render: (c) => {
      const v = (c.meta as any)?.tin;
      return <MonoCell data-private>{v ?? <Muted>—</Muted>}</MonoCell>;
    },
  },
  {
    key: "email",
    header: "Email",
    minWidth: "190px",
    sortable: "alpha",
    sortValue: (c) => (c.meta as any)?.email ?? "",
    render: (c) => {
      const v = (c.meta as any)?.email;
      return <CellText data-private>{v ?? <Muted>—</Muted>}</CellText>;
    },
  },
  {
    key: "phone",
    header: "Phone",
    minWidth: "140px",
    sortable: "alpha",
    sortValue: (c) => (c.meta as any)?.phone ?? "",
    render: (c) => {
      const v = (c.meta as any)?.phone;
      return <MonoCell data-private>{v ?? <Muted>—</Muted>}</MonoCell>;
    },
  },
  {
    key: "fingerprint",
    header: "Fingerprint",
    minWidth: "140px",
    sortable: "alpha",
    sortValue: (c) => c.id,
    render: (c) => (
      <FingerprintCell data-private>{shortenKey(c.id)}</FingerprintCell>
    ),
  },
  {
    key: "registered",
    header: "Registered",
    minWidth: "110px",
    align: "center",
    sortable: "boolean",
    sortValue: (c) => (c.isMajikahRegistered?.() ? 1 : 0),
    render: (c) => {
      const registered = c.isMajikahRegistered?.() ?? false;
      return registered ? (
        <RegisteredBadge>
          <WifiHighIcon size={9} weight="bold" /> Online
        </RegisteredBadge>
      ) : (
        <LocalBadge>Local</LocalBadge>
      );
    },
  },
];

// ---------------------------------------------------------------------------
// Sort
// ---------------------------------------------------------------------------

function sortContacts(
  items: MajikInvoiceContact[],
  state: SortState | null,
  columns: ContactColumnDef[],
): MajikInvoiceContact[] {
  if (!state) return items;
  const col = columns.find((c) => c.key === state.key);
  if (!col?.sortValue) return items;

  return [...items].sort((a, b) => {
    const av = col.sortValue!(a);
    const bv = col.sortValue!(b);
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    const cmp =
      state.type === "boolean"
        ? (av as number) - (bv as number)
        : String(av).localeCompare(String(bv), undefined, {
            sensitivity: "base",
          });
    return state.dir === "asc" ? cmp : -cmp;
  });
}

// ---------------------------------------------------------------------------
// Pagination helpers
// ---------------------------------------------------------------------------

function buildPageNumbers(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 4) return [1, 2, 3, 4, 5, "…", total];
  if (current >= total - 3)
    return [1, "…", total - 4, total - 3, total - 2, total - 1, total];
  return [1, "…", current - 1, current, current + 1, "…", total];
}

// ---------------------------------------------------------------------------
// Styled — Shell
// ---------------------------------------------------------------------------

const Root = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
`;

const TableScroll = styled.div`
  overflow-x: auto;
  width: 100%;

  &::-webkit-scrollbar {
    height: 5px;
  }
  &::-webkit-scrollbar-track {
    background: ${({ theme }) => theme.colors.secondaryBackground};
    border-radius: 8px;
  }
  &::-webkit-scrollbar-thumb {
    background: ${({ theme }) => theme.gradients.primary};
    border-radius: 8px;
  }
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textPrimary};
`;

const THead = styled.thead`
  background: ${({ theme }) => theme.colors.secondaryBackground};
  position: sticky;
  top: 0;
  z-index: 2;
`;

const Th = styled.th<{
  $align?: "left" | "center" | "right";
  $minWidth?: string;
  $sortable?: boolean;
}>`
  padding: 10px 14px;
  text-align: ${({ $align }) => $align ?? "left"};
  font-family: ${({ theme }) => theme.typography.fonts.semibold};
  font-size: 10px;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.primary};
  border-bottom: 1px solid ${({ theme }) => theme.colors.primary}20;
  white-space: nowrap;
  min-width: ${({ $minWidth }) => $minWidth ?? "auto"};
  user-select: none;
  cursor: ${({ $sortable }) => ($sortable ? "pointer" : "default")};

  ${({ $sortable, theme }) =>
    $sortable &&
    css`
      &:hover {
        background: ${theme.colors.primarySoft};
      }
    `}
`;

const ThInner = styled.div<{ $align?: "left" | "center" | "right" }>`
  display: inline-flex;
  align-items: center;
  gap: 5px;
  justify-content: ${({ $align }) =>
    $align === "right"
      ? "flex-end"
      : $align === "center"
        ? "center"
        : "flex-start"};
`;

const SortIconWrap = styled.span<{ $active?: boolean }>`
  display: inline-flex;
  align-items: center;
  opacity: ${({ $active }) => ($active ? 1 : 0.35)};
  flex-shrink: 0;
  transition: opacity 0.12s;
`;

const TBody = styled.tbody``;

const Tr = styled.tr<{ $selected?: boolean }>`
  transition: background 0.1s;
  border-bottom: 1px solid ${({ theme }) => theme.colors.primary}0c;
  background: ${({ $selected, theme }) =>
    $selected ? theme.colors.primarySoft : "transparent"};

  &:last-child {
    border-bottom: none;
  }
  &:hover {
    background: ${({ theme }) => theme.colors.primarySoft};
  }
`;

const Td = styled.td<{ $align?: "left" | "center" | "right" }>`
  padding: 10px 14px;
  text-align: ${({ $align }) => $align ?? "left"};
  vertical-align: middle;
`;

const CheckboxTh = styled.th`
  width: 40px;
  min-width: 40px;
  padding: 10px 8px 10px 14px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.primary}20;
  background: ${({ theme }) => theme.colors.secondaryBackground};
`;

const CheckboxTd = styled.td`
  width: 40px;
  min-width: 40px;
  padding: 10px 8px 10px 14px;
  vertical-align: middle;
`;

const Checkbox = styled.input.attrs({ type: "checkbox" })`
  width: 14px;
  height: 14px;
  cursor: pointer;
  accent-color: ${({ theme }) => theme.colors.primary};
`;

// ── Bulk bar ─────────────────────────────────────────────────────────────────

const BulkBar = styled.div<{ $visible: boolean }>`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 14px;
  background: ${({ theme }) => theme.colors.primarySoft};
  border-bottom: 1px solid ${({ theme }) => theme.colors.primary}22;
  overflow: hidden;
  max-height: ${({ $visible }) => ($visible ? "52px" : "0px")};
  padding-top: ${({ $visible }) => ($visible ? "9px" : "0px")};
  padding-bottom: ${({ $visible }) => ($visible ? "9px" : "0px")};
  opacity: ${({ $visible }) => ($visible ? 1 : 0)};
  pointer-events: ${({ $visible }) => ($visible ? "auto" : "none")};
  transition:
    max-height 0.18s ease,
    opacity 0.15s ease,
    padding 0.15s ease;
`;

const BulkCount = styled.span`
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  font-size: 12px;
  color: ${({ theme }) => theme.colors.primary};
  flex: 1;
`;

const BulkBtn = styled.button<{ $variant?: "danger" | "default" }>`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  font-size: 11px;
  padding: 6px 12px;
  border-radius: ${({ theme }) => theme.borders.radius.medium};
  cursor: pointer;
  transition: all 0.15s;

  ${({ $variant, theme }) =>
    $variant === "danger"
      ? css`
          border: 1px solid ${theme.colors.error}44;
          background: ${theme.colors.error}12;
          color: ${theme.colors.error};
          &:hover {
            background: ${theme.colors.error}22;
          }
        `
      : css`
          border: 1px solid ${theme.colors.primary}44;
          background: ${theme.colors.primarySoft};
          color: ${theme.colors.primary};
          &:hover {
            background: ${theme.colors.primary}22;
          }
        `}
`;

const ClearSelBtn = styled.button`
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  font-size: 11px;
  padding: 6px 10px;
  border-radius: ${({ theme }) => theme.borders.radius.medium};
  border: 1px solid ${({ theme }) => theme.colors.primary}22;
  background: transparent;
  color: ${({ theme }) => theme.colors.textSecondary};
  cursor: pointer;
  transition: all 0.15s;
  &:hover {
    background: ${({ theme }) => theme.colors.primarySoft};
    color: ${({ theme }) => theme.colors.primary};
  }
`;

// ── Cell atoms ────────────────────────────────────────────────────────────────

const NameCell = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`;

const ContactAvatar = styled.div<{ $hue: number }>`
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: hsl(${({ $hue }) => $hue}, 38%, 24%);
  border: 1px solid rgba(255, 255, 255, 0.07);
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: ${({ theme }) => theme.typography.fonts.mono};
  font-size: 10px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.78);
  flex-shrink: 0;
  user-select: none;
`;

const NameText = styled.span`
  font-size: 13px;
  font-weight: 600;
  letter-spacing: -0.01em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 200px;
`;

const CellText = styled.span`
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 200px;
  display: block;
`;

const MonoCell = styled.span`
  font-family: ${({ theme }) =>
    theme.typography.fonts.mono ?? "'Fira Mono', monospace"};
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textSecondary};
  letter-spacing: 0.02em;
`;

const FingerprintCell = styled.span`
  font-family: ${({ theme }) =>
    theme.typography.fonts.mono ?? "'Fira Mono', monospace"};
  font-size: 10px;
  color: ${({ theme }) => theme.colors.primary};
  letter-spacing: 0.04em;
  opacity: 0.7;
`;

const Muted = styled.span`
  opacity: 0.35;
`;

const RegisteredBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  font-size: 10px;
  padding: 2px 8px;
  border-radius: ${({ theme }) => theme.borders.radius.rounded};
  color: ${({ theme }) => theme.colors.brand?.green ?? "#10b981"};
  background: rgba(16, 185, 129, 0.1);
  border: 1px solid rgba(16, 185, 129, 0.2);
`;

const LocalBadge = styled.span`
  display: inline-flex;
  align-items: center;
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  font-size: 10px;
  padding: 2px 8px;
  border-radius: ${({ theme }) => theme.borders.radius.rounded};
  color: ${({ theme }) => theme.colors.textSecondary};
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid ${({ theme }) => theme.colors.secondaryBackground};
`;

// ── Actions ───────────────────────────────────────────────────────────────────

const ActionsCell = styled.div`
  display: flex;
  align-items: center;
  gap: 3px;
  justify-content: flex-end;
`;

const ActionBtn = styled.button<{ $variant?: "danger" | "ghost" | "default" }>`
  background: none;
  border: none;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: ${({ theme }) => theme.borders.radius.small};
  transition: all 0.12s;
  opacity: 0.5;

  ${({ $variant, theme }) => {
    switch ($variant) {
      case "danger":
        return css`
          color: ${theme.colors.error};
          &:hover:not(:disabled) {
            background: ${theme.colors.error}15;
            opacity: 1;
          }
        `;
      case "ghost":
        return css`
          color: ${theme.colors.textSecondary};
          &:hover:not(:disabled) {
            background: ${theme.colors.primarySoft};
            opacity: 1;
            color: ${theme.colors.primary};
          }
        `;
      default:
        return css`
          color: ${theme.colors.primary};
          &:hover:not(:disabled) {
            background: ${theme.colors.primarySoft};
            opacity: 1;
          }
        `;
    }
  }}

  &:disabled {
    opacity: 0.18;
    cursor: not-allowed;
    pointer-events: none;
  }
`;

// ── Pagination ─────────────────────────────────────────────────────────────────

const PaginationBar = styled.div<{ $position: "top" | "bottom" }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 9px 14px;
  background: ${({ theme }) => theme.colors.secondaryBackground};
  border-top: ${({ $position }) => ($position === "bottom" ? "1px" : "0")} solid
    ${({ theme }) => theme.colors.primary}12;
  border-bottom: ${({ $position }) => ($position === "top" ? "1px" : "0")} solid
    ${({ theme }) => theme.colors.primary}12;
`;

const PageInfo = styled.span`
  font-family: ${({ theme }) => theme.typography.fonts.light};
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textSecondary};
`;

const PageControls = styled.div`
  display: flex;
  align-items: center;
  gap: 3px;
`;

const PageBtn = styled.button<{ $active?: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 28px;
  height: 28px;
  padding: 0 6px;
  border-radius: ${({ theme }) => theme.borders.radius.small};
  border: 1px solid
    ${({ $active, theme }) =>
      $active ? theme.colors.primary : theme.colors.primary + "22"};
  background: ${({ $active, theme }) =>
    $active ? theme.colors.primarySoft : "transparent"};
  color: ${({ $active, theme }) =>
    $active ? theme.colors.primary : theme.colors.textSecondary};
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  font-size: 11px;
  cursor: pointer;
  transition: all 0.12s;
  &:hover:not(:disabled) {
    background: ${({ theme }) => theme.colors.primarySoft};
    color: ${({ theme }) => theme.colors.primary};
    border-color: ${({ theme }) => theme.colors.primary};
  }
  &:disabled {
    opacity: 0.28;
    cursor: not-allowed;
  }
`;

const EmptyState = styled.div`
  padding: 4rem 2rem;
  text-align: center;
  font-family: ${({ theme }) => theme.typography.fonts.light};
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.55;
`;

// ---------------------------------------------------------------------------
// Pagination sub-component
// ---------------------------------------------------------------------------

interface PaginationProps {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  position: "top" | "bottom";
  onPageChange: (p: number) => void;
}

const Pagination: React.FC<PaginationProps> = ({
  page,
  totalPages,
  totalItems,
  pageSize,
  position,
  onPageChange,
}) => {
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalItems);
  const pages = buildPageNumbers(page, totalPages);

  return (
    <PaginationBar $position={position}>
      <PageInfo>
        {totalItems === 0 ? "No contacts" : `${start}–${end} of ${totalItems}`}
      </PageInfo>
      <PageControls>
        <PageBtn onClick={() => onPageChange(page - 1)} disabled={page === 1}>
          <CaretLeftIcon size={12} weight="bold" />
        </PageBtn>
        {pages.map((p, i) =>
          p === "…" ? (
            <PageBtn key={`ell-${i}`} disabled>
              …
            </PageBtn>
          ) : (
            <PageBtn
              key={p}
              $active={p === page}
              onClick={() => onPageChange(p as number)}
            >
              {p}
            </PageBtn>
          ),
        )}
        <PageBtn
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages || totalPages === 0}
        >
          <CaretRightIcon size={12} weight="bold" />
        </PageBtn>
      </PageControls>
    </PaginationBar>
  );
};

// ---------------------------------------------------------------------------
// ContactsTable
// ---------------------------------------------------------------------------

export const ContactsTable: React.FC<ContactsTableProps> = ({
  contacts,
  pageSize = 50,
  paginationAt = "both",
  onEdit,
  onDelete,
  onBulkDelete,
  onBulkExportBackup,
  onSelectionChange,
}) => {
  const [page, setPage] = useState(1);
  const [sortState, setSortState] = useState<SortState | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const columns = DEFAULT_COLUMNS;

  const sortedContacts = useMemo(
    () => sortContacts(contacts, sortState, columns),
    [contacts, sortState],
  );

  const totalPages = Math.max(1, Math.ceil(sortedContacts.length / pageSize));
  const safePage = Math.min(page, totalPages);

  const pageItems = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return sortedContacts.slice(start, start + pageSize);
  }, [sortedContacts, safePage, pageSize]);

  const handleSort = useCallback((col: ContactColumnDef) => {
    if (!col.sortable) return;
    setSortState((prev) => {
      if (prev?.key === col.key) {
        if (prev.dir === "asc") return { ...prev, dir: "desc" };
        return null;
      }
      return {
        key: col.key,
        dir: "asc",
        type: col.sortable as ContactSortType,
      };
    });
    setPage(1);
  }, []);

  const pageIds = useMemo(() => pageItems.map((c) => c.id), [pageItems]);
  const allPageSelected =
    pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));
  const somePageSelected = pageIds.some((id) => selectedIds.has(id));

  const selectAllRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = somePageSelected && !allPageSelected;
    }
  }, [somePageSelected, allPageSelected]);

  const toggleAll = useCallback(() => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allPageSelected) {
        pageIds.forEach((id) => next.delete(id));
      } else {
        pageIds.forEach((id) => next.add(id));
      }
      onSelectionChange?.(contacts.filter((c) => next.has(c.id)));
      return next;
    });
  }, [allPageSelected, pageIds, contacts, onSelectionChange]);

  const toggleRow = useCallback(
    (id: string) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.has(id) ? next.delete(id) : next.add(id);
        onSelectionChange?.(contacts.filter((c) => next.has(c.id)));
        return next;
      });
    },
    [contacts, onSelectionChange],
  );

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    onSelectionChange?.([]);
  }, [onSelectionChange]);

  const handleBulkDelete = useCallback(() => {
    const selected = contacts.filter((c) => selectedIds.has(c.id));
    onBulkDelete?.(selected);
    clearSelection();
  }, [contacts, selectedIds, onBulkDelete, clearSelection]);

  const handleBulkExport = useCallback(() => {
    const selected = contacts.filter((c) => selectedIds.has(c.id));
    onBulkExportBackup?.(selected);
  }, [contacts, selectedIds, onBulkExportBackup]);

  const showTop = paginationAt === "top" || paginationAt === "both";
  const showBottom = paginationAt === "bottom" || paginationAt === "both";
  const selectedCount = selectedIds.size;

  const paginationProps: Omit<PaginationProps, "position"> = {
    page: safePage,
    totalPages,
    totalItems: sortedContacts.length,
    pageSize,
    onPageChange: setPage,
  };

  return (
    <Root>
      {showTop && <Pagination {...paginationProps} position="top" />}

      {/* Bulk action bar */}
      <BulkBar $visible={selectedCount > 0}>
        <BulkCount>
          {selectedCount} contact{selectedCount !== 1 ? "s" : ""} selected
        </BulkCount>
        <ClearSelBtn onClick={clearSelection}>Clear</ClearSelBtn>

        {onBulkExportBackup && (
          <BulkBtn onClick={handleBulkExport}>
            <DownloadSimpleIcon size={12} weight="bold" />
            Export as backup
          </BulkBtn>
        )}

        {onBulkDelete && (
          <BulkBtn $variant="danger" onClick={handleBulkDelete}>
            <TrashIcon size={12} weight="bold" />
            Delete selected
          </BulkBtn>
        )}
      </BulkBar>

      <TableScroll>
        <Table>
          <THead>
            <tr>
              <CheckboxTh>
                <Checkbox
                  ref={selectAllRef}
                  checked={allPageSelected}
                  onChange={toggleAll}
                />
              </CheckboxTh>

              {columns.map((col) => (
                <Th
                  key={col.key}
                  $align={col.align}
                  $minWidth={col.minWidth}
                  $sortable={!!col.sortable}
                  onClick={() => col.sortable && handleSort(col)}
                >
                  <ThInner $align={col.align}>
                    {col.header}
                    {col.sortable && (
                      <SortIconWrap $active={sortState?.key === col.key}>
                        {sortState?.key === col.key ? (
                          sortState.dir === "asc" ? (
                            <CaretUpIcon size={11} weight="bold" />
                          ) : (
                            <CaretDownIcon size={11} weight="bold" />
                          )
                        ) : (
                          <CaretUpDownIcon size={11} />
                        )}
                      </SortIconWrap>
                    )}
                  </ThInner>
                </Th>
              ))}

              <Th $align="right" $minWidth="90px">
                Actions
              </Th>
            </tr>
          </THead>

          <TBody>
            {pageItems.length === 0 ? (
              <tr>
                <td colSpan={columns.length + 2}>
                  <EmptyState>No contacts found.</EmptyState>
                </td>
              </tr>
            ) : (
              pageItems.map((c) => (
                <Tr key={c.id} $selected={selectedIds.has(c.id)}>
                  <CheckboxTd>
                    <Checkbox
                      checked={selectedIds.has(c.id)}
                      onChange={() => toggleRow(c.id)}
                    />
                  </CheckboxTd>

                  {columns.map((col) => (
                    <Td key={col.key} $align={col.align}>
                      {col.render(c)}
                    </Td>
                  ))}

                  <Td $align="right">
                    <ActionsCell>
                      {onEdit && (
                        <ActionBtn title="Edit" onClick={() => onEdit(c)}>
                          <PencilSimpleIcon size={14} />
                        </ActionBtn>
                      )}
                      {onDelete && (
                        <ActionBtn
                          $variant="danger"
                          title="Delete"
                          onClick={() => onDelete(c)}
                        >
                          <TrashIcon size={14} />
                        </ActionBtn>
                      )}
                    </ActionsCell>
                  </Td>
                </Tr>
              ))
            )}
          </TBody>
        </Table>
      </TableScroll>

      {showBottom && <Pagination {...paginationProps} position="bottom" />}
    </Root>
  );
};
