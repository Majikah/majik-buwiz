/**
 * ContactsGrid.tsx
 *
 * Standalone grid view for contacts.
 * Renders contacts in a responsive auto-fill grid using CBaseUserAccount cards.
 */

import React from "react";
import styled from "styled-components";
import { UserIcon } from "@phosphor-icons/react";


import type { MajikInvoiceContact } from "@/SDK/majik-buwiz-client/src/core/party/majik-invoice-contact";
import CBaseUserAccount from "@/components/base/CBaseUserAccount";

// ---------------------------------------------------------------------------
// Styled
// ---------------------------------------------------------------------------

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(420px, 1fr));
  gap: 10px;
  padding: 16px 18px 24px;

  @media (max-width: 640px) {
    grid-template-columns: 1fr;
  }
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

export interface ContactsGridProps {
  contacts: MajikInvoiceContact[];
  emptyTitle?: string;
  emptyHint?: string;
  onDelete?: (contact: MajikInvoiceContact) => void;
  onEdit?: (contact: MajikInvoiceContact) => void;
  onDownload?: (contact: MajikInvoiceContact) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const ContactsGrid: React.FC<ContactsGridProps> = ({
  contacts,
  emptyTitle = "No contacts yet",
  emptyHint = "You haven't added any contacts yet.",
  onDelete,
  onEdit,
  onDownload,
}) => {
  if (contacts.length === 0) {
    return (
      <EmptyState>
        <EmptyIcon>
          <UserIcon size={22} />
        </EmptyIcon>
        <EmptyTitle>{emptyTitle}</EmptyTitle>
        <EmptyHint>{emptyHint}</EmptyHint>
      </EmptyState>
    );
  }

  return (
    <Grid>
      {contacts.map((c) => (
        <CBaseUserAccount
          key={c.id}
          itemData={c}
          onDelete={onDelete ? () => onDelete(c) : undefined}
          onEdit={onEdit}
          onDownload={onDownload ? () => onDownload(c) : undefined}
        />
      ))}
    </Grid>
  );
};
