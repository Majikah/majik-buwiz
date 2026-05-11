/**
 * sections/KeyAccountSection.tsx
 *
 * Step 1 — Local Key Account slot.
 * Renders either the empty slot (with Import / Create New triggers) or the
 * filled CBaseUserAccount card.
 *
 * The Import and Create modals have been removed from PopUpFormButton in favour
 * of the dedicated ImportKeyModal / CreateKeyModal that own their own form
 * state.  This section simply holds the open/close booleans and passes
 * callbacks down.
 *
 * NOTE: PopUpFormButton was kept as the trigger button for visual parity with
 * the rest of the app — but the actual modal content is now in ImportKeyModal /
 * CreateKeyModal. We therefore use PopUpFormButton in "icon only" mode with
 * its internal form content removed (children = null) and immediately
 * intercept its onOpenChange to forward to the dedicated modals. Since
 * PopUpFormButton always closes itself on confirm/cancel, we bypass it and
 * use plain IconTextButton-style buttons that directly toggle our own state.
 */

import React, { useCallback, useState } from "react";
import styled, { keyframes } from "styled-components";
import { LockKeyIcon, PlusIcon } from "@phosphor-icons/react";
import { ImportIcon } from "lucide-react";

import { MajikBuwizDatabase } from "@/components/majik-context-wrapper/majik-buwiz-database";
import { MajikInvoiceContact } from "@/SDK/majik-buwiz-client/src/core/party/majik-invoice-contact";
import { MajikInvoiceContactMeta } from "@/SDK/majik-buwiz-client/src/core/party/types";
import CBaseUserAccount from "@/components/base/CBaseUserAccount";

import { ImportKeyModal } from "../modals/ImportKeyModal";
import { CreateKeyModal } from "../modals/CreateKeyModal";

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
`;

const KeySlot = styled.div<{ $filled: boolean }>`
  border-radius: 14px;
  border: 1.5px dashed
    ${({ $filled, theme }) =>
      $filled
        ? theme.colors.secondaryBackground
        : `${theme.colors.primary || "#E05C1A"}35`};
  background: ${({ $filled, theme }) =>
    $filled
      ? theme.colors.secondaryBackground
      : `${theme.colors.primary || "#E05C1A"}06`};
  padding: ${({ $filled }) => ($filled ? "0" : "28px 20px")};
  display: flex;
  flex-direction: column;
  align-items: ${({ $filled }) => ($filled ? "stretch" : "center")};
  gap: 10px;
  text-align: center;
  transition: all 0.2s ease;
  animation: ${fadeIn} 0.2s ease;
`;

const EmptyIcon = styled.div`
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: ${({ theme }) => `${theme.colors.primary || "#E05C1A"}12`};
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${({ theme }) => theme.colors.primary || "#E05C1A"};
`;

const EmptyTitle = styled.div`
  font-size: 13px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textPrimary};
`;

const EmptyHint = styled.div`
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.5;
  line-height: 1.5;
  max-width: 260px;
`;

const SlotActions = styled.div`
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: center;
`;

const TriggerBtn = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 13px;
  border-radius: 8px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  border: 1px solid ${({ theme }) => `${theme.colors.primary || "#E05C1A"}33`};
  background: transparent;
  color: ${({ theme }) => theme.colors.textSecondary};
  &:hover {
    background: ${({ theme }) => theme.colors.primarySoft};
    color: ${({ theme }) => theme.colors.primary};
  }
`;

interface PassphraseUpdateParams {
  id: string;
  passphrase: { old: string; new: string };
}

interface KeyAccountSectionProps {
  currentAccount: MajikInvoiceContact | null;
  majik: MajikBuwizDatabase;
  onAccountChange: () => void;
  onEditMeta: (meta: MajikInvoiceContactMeta) => void;
  onRemoveRequest: () => void;
  onShare: (id: string) => void;
  onCopyPublicKey: (contact: MajikInvoiceContact) => void;
  onUpdatePassphrase: (params: PassphraseUpdateParams) => void;
  onDownload: (contact: MajikInvoiceContact) => void;
}

export const KeyAccountSection: React.FC<KeyAccountSectionProps> = React.memo(
  ({
    currentAccount,
    majik,
    onAccountChange,
    onEditMeta,
    onRemoveRequest,
    onShare,
    onCopyPublicKey,
    onUpdatePassphrase,
    onDownload,
  }) => {
    const [importOpen, setImportOpen] = useState(false);
    const [createOpen, setCreateOpen] = useState(false);

    const handleImportSuccess = useCallback(() => {
      onAccountChange();
    }, [onAccountChange]);

    const handleCreateSuccess = useCallback(() => {
      onAccountChange();
    }, [onAccountChange]);

    if (!currentAccount) {
      return (
        <>
          <KeySlot $filled={false}>
            <EmptyIcon>
              <LockKeyIcon size={22} weight="duotone" />
            </EmptyIcon>
            <EmptyTitle>No key account yet</EmptyTitle>
            <EmptyHint>
              Create a new key account or import an existing one from a seed
              backup. Only one key account is active at a time.
            </EmptyHint>
            <SlotActions>
              <TriggerBtn onClick={() => setImportOpen(true)}>
                <ImportIcon size={12} /> Import
              </TriggerBtn>
              <TriggerBtn onClick={() => setCreateOpen(true)}>
                <PlusIcon size={12} /> Create New
              </TriggerBtn>
            </SlotActions>
          </KeySlot>

          <ImportKeyModal
            open={importOpen}
            onOpenChange={setImportOpen}
            majik={majik}
            onSuccess={handleImportSuccess}
          />
          <CreateKeyModal
            open={createOpen}
            onOpenChange={setCreateOpen}
            majik={majik}
            onSuccess={handleCreateSuccess}
          />
        </>
      );
    }

    return (
      <KeySlot $filled>
        <CBaseUserAccount
          index={0}
          itemData={currentAccount}
          onEdit={(acct) => onEditMeta(acct.meta)}
          onDelete={() => onRemoveRequest()}
          onShare={() => onShare(currentAccount.id)}
          onCopyPublicKey={onCopyPublicKey}
          onSetActive={() => undefined}
          onUpdatePassphrase={onUpdatePassphrase}
          onDownload={onDownload}
        />
      </KeySlot>
    );
  },
);

KeyAccountSection.displayName = "KeyAccountSection";
