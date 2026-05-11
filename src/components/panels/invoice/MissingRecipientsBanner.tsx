// MissingRecipientsBanner.tsx

import React, { useCallback, useEffect, useMemo, useState } from "react";
import styled, { keyframes } from "styled-components";
import {
  UserCirclePlusIcon,
  WarningIcon,
  CaretDownIcon,
  CaretUpIcon,
} from "@phosphor-icons/react";

import { MajikBuwizDatabase } from "@/components/majik-context-wrapper/majik-buwiz-database";
import { MajikInvoice } from "@majikah/majik-invoice";
import { MajikInvoiceContact } from "@/SDK/majik-buwiz-client/src/core/party/majik-invoice-contact";
import { ConditionalBanner } from "@/components/functional/ConditionalBanner";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MissingRecipientsBannerProps {
  invoice: MajikInvoice;
  majik: MajikBuwizDatabase;
  onInvite?: (publicKey: string) => void;
}

// ---------------------------------------------------------------------------
// Animations
// ---------------------------------------------------------------------------

const slideDown = keyframes`
  from { opacity: 0; transform: translateY(-4px); }
  to   { opacity: 1; transform: translateY(0); }
`;

// ---------------------------------------------------------------------------
// Styled components
// ---------------------------------------------------------------------------

const BannerShell = styled(ConditionalBanner)`
  animation: ${slideDown} 0.18s ease;
`;

const BannerInner = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 14px;
  background: ${({ theme }) => theme.colors.error}0f;
  border: 1px solid ${({ theme }) => theme.colors.error}28;
  border-radius: ${({ theme }) => theme.borders.radius.medium};
  margin: 10px 18px 0;
`;

const IconWrap = styled.div`
  flex-shrink: 0;
  margin-top: 1px;
  color: ${({ theme }) => theme.colors.error};
`;

const Body = styled.div`
  flex: 1;
  min-width: 0;
`;

const Title = styled.div`
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  font-size: 12px;
  color: ${({ theme }) => theme.colors.error};
  line-height: 1.4;
`;

const Subtitle = styled.div`
  font-family: ${({ theme }) => theme.typography.fonts.light};
  font-size: 10.5px;
  color: ${({ theme }) => theme.colors.textSecondary};
  margin-top: 2px;
  opacity: 0.75;
  line-height: 1.5;
`;

const ToggleBtn = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 3px;
  margin-top: 5px;
  padding: 0;
  background: none;
  border: none;
  cursor: pointer;
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  font-size: 10px;
  color: ${({ theme }) => theme.colors.error};
  opacity: 0.75;
  transition: opacity 0.12s;
  &:hover {
    opacity: 1;
  }
`;

const KeyList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 5px;
  margin-top: 8px;
`;

const KeyRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  background: ${({ theme }) => theme.colors.primaryBackground};
  border: 1px solid ${({ theme }) => theme.colors.primary}10;
  border-radius: ${({ theme }) => theme.borders.radius.small};
`;

const KeyLabel = styled.span`
  flex: 1;
  font-family: ${({ theme }) => theme.typography.fonts.numbers};
  font-size: 10px;
  color: ${({ theme }) => theme.colors.textSecondary};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  opacity: 0.6;
`;

const InviteBtn = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  border-radius: ${({ theme }) => theme.borders.radius.small};
  border: 1px solid ${({ theme }) => theme.colors.primary}33;
  background: transparent;
  color: ${({ theme }) => theme.colors.primary};
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  font-size: 10px;
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.12s;
  &:hover {
    background: ${({ theme }) => theme.colors.primarySoft};
    border-color: ${({ theme }) => theme.colors.primary};
  }
`;

// ---------------------------------------------------------------------------
// Hook — resolves missing recipients from the directory
// ---------------------------------------------------------------------------

export function useMissingRecipients(
  invoice: MajikInvoice | null,
  majik: MajikBuwizDatabase,
): {
  missingKeys: string[];
  resolvedContacts: MajikInvoiceContact[];
  isLoading: boolean;
} {
  const [resolvedContacts, setResolvedContacts] = useState<
    MajikInvoiceContact[]
  >([]);
  const [missingKeys, setMissingKeys] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const recipientKeys: string[] = useMemo(() => {
    if (!invoice?.recipients) return [];
    return invoice.recipients as unknown as string[];
  }, [invoice]);

  useEffect(() => {
    if (!recipientKeys.length) {
      setResolvedContacts([]);
      setMissingKeys([]);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    (async () => {
      try {
        const contacts = await majik.getContactsByPublicKey(recipientKeys);
        if (cancelled) return;

        // Resolve each contact's public key asynchronously before diffing
        const resolvedKeyPairs = await Promise.all(
          contacts.map(async (c) => ({
            contact: c,
            publicKey: await c.getPublicKeyBase64(),
          })),
        );
        if (cancelled) return;

        setResolvedContacts(contacts);

        const resolvedKeySet = new Set(
          resolvedKeyPairs.map((p) => p.publicKey),
        );
        setMissingKeys(recipientKeys.filter((k) => !resolvedKeySet.has(k)));
      } catch {
        if (!cancelled) {
          setResolvedContacts([]);
          setMissingKeys([]);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [recipientKeys, majik]);

  return { missingKeys, resolvedContacts, isLoading };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const MissingRecipientsBanner: React.FC<
  MissingRecipientsBannerProps
> = ({ invoice, majik, onInvite }) => {
  const { missingKeys, isLoading } = useMissingRecipients(invoice, majik);
  const [expanded, setExpanded] = useState(false);

  const hasMissing = !isLoading && missingKeys.length > 0;
  const missingCount = missingKeys.length;

  const handleInvite = useCallback(
    (key: string) => {
      onInvite?.(key);
    },
    [onInvite],
  );

  return (
    <BannerShell show={hasMissing}>
      <BannerInner>
        <IconWrap>
          <WarningIcon size={15} weight="fill" />
        </IconWrap>

        <Body>
          <Title>
            {missingCount === 1
              ? "1 recipient not found in your directory"
              : `${missingCount} recipients not found in your directory`}
          </Title>
          <Subtitle>
            {missingCount === 1
              ? "This invoice has a recipient whose public key is not in your contact list. You may not be able to verify or re-encrypt for them."
              : "Some recipients on this invoice are missing from your contact directory. Add them to fully verify and interact with this invoice."}
          </Subtitle>

          <ToggleBtn onClick={() => setExpanded((v) => !v)}>
            {expanded ? (
              <>
                Hide keys <CaretUpIcon size={9} weight="bold" />
              </>
            ) : (
              <>
                Show {missingCount} missing key{missingCount > 1 ? "s" : ""}{" "}
                <CaretDownIcon size={9} weight="bold" />
              </>
            )}
          </ToggleBtn>

          {expanded && (
            <KeyList>
              {missingKeys.map((key) => (
                <KeyRow key={key}>
                  <KeyLabel title={key}>{key}</KeyLabel>
                  <InviteBtn onClick={() => handleInvite(key)}>
                    <UserCirclePlusIcon size={11} weight="regular" />
                    Send Invite
                  </InviteBtn>
                </KeyRow>
              ))}
            </KeyList>
          )}
        </Body>
      </BannerInner>
    </BannerShell>
  );
};
