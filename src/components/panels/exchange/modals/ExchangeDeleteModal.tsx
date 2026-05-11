/**
 * ExchangeDeleteModal.tsx
 *
 * Delete confirmation modal for the exchange panel.
 * Handles single and bulk delete.
 * Shows a "force void & delete" warning when non-voided invoices are in the selection.
 * Offers cloud-only vs cloud+local delete choice.
 */

import React, { useCallback, useMemo, useState } from "react";
import styled from "styled-components";
import { HardDrivesIcon, TrashIcon, WarningIcon } from "@phosphor-icons/react";
import type { MajikInvoice } from "@majikah/majik-invoice";
import DynamicPopUp from "@/components/functional/DynamicPopUp";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const invoiceLabel = (inv: MajikInvoice): string =>
  inv.public?.invoiceNumber ?? inv.id?.slice(0, 14);

// ---------------------------------------------------------------------------
// Styled
// ---------------------------------------------------------------------------

const Body = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 2px 0 6px;
`;

// Force-void warning banner
const ForceBanner = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 11px 13px;
  border-radius: ${({ theme }) => theme.borders.radius.medium};
  background: ${({ theme }) => theme.colors.primary}0d;
  border: 1px solid ${({ theme }) => theme.colors.primary}33;
`;

const ForceBannerIcon = styled.div`
  color: ${({ theme }) => theme.colors.primary};
  flex-shrink: 0;
  margin-top: 1px;
`;

const ForceBannerText = styled.div`
  display: flex;
  flex-direction: column;
  gap: 3px;
`;

const ForceBannerTitle = styled.div`
  font-family: ${({ theme }) => theme.typography.fonts.semibold};
  font-size: 11.5px;
  color: ${({ theme }) => theme.colors.primary};
`;

const ForceBannerSub = styled.div`
  font-family: ${({ theme }) => theme.typography.fonts.light};
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textSecondary};
  line-height: 1.6;
  opacity: 0.85;
`;

// Invoice list
const InvoiceList = styled.ul`
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 9px 12px;
  border-radius: ${({ theme }) => theme.borders.radius.medium};
  background: ${({ theme }) => theme.colors.error}08;
  border: 1px solid ${({ theme }) => theme.colors.error}1a;
  margin: 0;
  list-style: none;
  max-height: 130px;
  overflow-y: auto;

  &::-webkit-scrollbar {
    width: 3px;
  }
  &::-webkit-scrollbar-thumb {
    background: ${({ theme }) => theme.colors.error}28;
    border-radius: 4px;
  }
`;

const InvoiceItem = styled.li<{ $willForce?: boolean }>`
  font-family: ${({ theme }) => theme.typography.fonts.numbers};
  font-size: 11px;
  color: ${({ $willForce, theme }) =>
    $willForce ? theme.colors.primary : theme.colors.error};
  opacity: 0.85;
  display: flex;
  align-items: center;
  gap: 6px;

  &::before {
    content: "·";
    opacity: 0.5;
  }
`;

const ForceTag = styled.span`
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  font-size: 9px;
  padding: 1px 5px;
  border-radius: ${({ theme }) => theme.borders.radius.rounded};
  color: ${({ theme }) => theme.colors.primary};
  background: ${({ theme }) => theme.colors.primary}15;
  border: 1px solid ${({ theme }) => theme.colors.primary}28;
  letter-spacing: 0.04em;
  text-transform: uppercase;
`;

// Scope options
const ScopeOptions = styled.div`
  display: flex;
  flex-direction: column;
  gap: 7px;
`;

const ScopeLabel = styled.div`
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textSecondary};
  margin-bottom: 2px;
`;

const ScopeOption = styled.button<{ $active: boolean; $danger?: boolean }>`
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 11px 13px;
  border-radius: ${({ theme }) => theme.borders.radius.medium};
  border: 1px solid
    ${({ $active, $danger, theme }) =>
      $active
        ? $danger
          ? `${theme.colors.error}55`
          : `${theme.colors.primary}44`
        : `${theme.colors.primary}18`};
  background: ${({ $active, $danger, theme }) =>
    $active
      ? $danger
        ? `${theme.colors.error}0c`
        : `${theme.colors.primarySoft}`
      : "transparent"};
  cursor: pointer;
  text-align: left;
  transition: all 0.14s ease;
  width: 100%;

  &:hover {
    background: ${({ $danger, theme }) =>
      $danger ? `${theme.colors.error}0a` : `${theme.colors.primarySoft}88`};
    border-color: ${({ $danger, theme }) =>
      $danger ? `${theme.colors.error}44` : `${theme.colors.primary}33`};
  }
`;

const ScopeIcon = styled.div<{ $danger?: boolean }>`
  color: ${({ $danger, theme }) =>
    $danger ? theme.colors.error : theme.colors.primary};
  flex-shrink: 0;
  margin-top: 1px;
`;

const ScopeText = styled.div`
  display: flex;
  flex-direction: column;
  gap: 3px;
`;

const ScopeTitle = styled.div<{ $danger?: boolean }>`
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  font-size: 12px;
  color: ${({ $danger, theme }) =>
    $danger ? theme.colors.error : theme.colors.textPrimary};
`;

const ScopeSub = styled.div`
  font-family: ${({ theme }) => theme.typography.fonts.light};
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.7;
  line-height: 1.5;
`;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DeleteScope = "cloud" | "both";

export interface ExchangeDeleteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Single or multiple invoices to delete. */
  invoices: MajikInvoice | MajikInvoice[];
  /**
   * Called when the user confirms deletion.
   * removeLocally = false → cloud only
   * removeLocally = true  → cloud + local
   * forceVoid = true → non-voided invoices must be voided first server-side before deletion
   */
  onConfirm: (removeLocally: boolean, forceVoid: boolean) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const ExchangeDeleteModal: React.FC<ExchangeDeleteModalProps> =
  React.memo(({ open, onOpenChange, invoices, onConfirm }) => {
    const [scope, setScope] = useState<DeleteScope>("cloud");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const isBulk = Array.isArray(invoices);
    const list: MajikInvoice[] = isBulk ? invoices : [invoices];

    // Partition into voided and non-voided
    const { nonVoided } = useMemo(() => {
      const voided: MajikInvoice[] = [];
      const nonVoided: MajikInvoice[] = [];
      for (const inv of list) {
        const status = inv.public?.status;
        if (status === "void") {
          voided.push(inv);
        } else {
          nonVoided.push(inv);
        }
      }
      return { voided, nonVoided };
    }, [list]);

    const hasNonVoided = nonVoided.length > 0;

    const handleClose = useCallback(() => {
      if (isSubmitting) return;
      setScope("cloud");
      onOpenChange(false);
    }, [isSubmitting, onOpenChange]);

    const handleConfirm = useCallback(async () => {
      setIsSubmitting(true);
      try {
        await onConfirm(scope === "both", hasNonVoided);
        setScope("cloud");
        onOpenChange(false);
      } finally {
        setIsSubmitting(false);
      }
    }, [scope, hasNonVoided, onConfirm, onOpenChange]);

    const title = hasNonVoided
      ? isBulk
        ? `Force Void & Delete ${list.length} Invoice${list.length !== 1 ? "s" : ""}`
        : "Force Void & Delete Invoice"
      : isBulk
        ? `Delete ${list.length} Invoice${list.length !== 1 ? "s" : ""}`
        : "Delete Invoice";

    const description = hasNonVoided
      ? "Some selected invoices are not yet voided. Proceeding will void them automatically before deletion."
      : "Select how you want to remove this invoice. This action cannot be undone.";

    const confirmLabel = isSubmitting
      ? hasNonVoided
        ? "Voiding & Deleting…"
        : "Deleting…"
      : hasNonVoided
        ? `Force Void & Delete`
        : `Delete${isBulk ? ` ${list.length}` : ""}`;

    return (
      <DynamicPopUp
        scrollable
        isOpen={open}
        onOpenChange={(o) => {
          if (!o) handleClose();
        }}
        modal={{ title, description }}
        buttons={{
          cancel: {
            text: "Cancel",
            onClick: handleClose,
            isDisabled: isSubmitting,
          },
          confirm: {
            text: confirmLabel,
            onClick: handleConfirm,
            isDisabled: isSubmitting,
          },
        }}
      >
        <Body>
          {/* Force-void warning banner */}
          {hasNonVoided && (
            <ForceBanner>
              <ForceBannerIcon>
                <WarningIcon size={18} weight="duotone" />
              </ForceBannerIcon>
              <ForceBannerText>
                <ForceBannerTitle>
                  {nonVoided.length} invoice
                  {nonVoided.length !== 1 ? "s" : ""} not yet voided
                </ForceBannerTitle>
                <ForceBannerSub>
                  The following invoice
                  {nonVoided.length !== 1 ? "s" : ""} will be voided
                  automatically before deletion. Recipients will see them as
                  void.
                </ForceBannerSub>
              </ForceBannerText>
            </ForceBanner>
          )}

          {/* Invoice list */}
          {list.length > 0 && (
            <InvoiceList>
              {list.map((inv) => {
                const isForced = nonVoided.some((n) => n.id === inv.id);
                return (
                  <InvoiceItem key={inv.id} $willForce={isForced}>
                    {invoiceLabel(inv)}
                    {isForced && <ForceTag>will void</ForceTag>}
                  </InvoiceItem>
                );
              })}
            </InvoiceList>
          )}

          {/* Scope selector */}
          <ScopeOptions>
            <ScopeLabel>Where to delete from</ScopeLabel>

            <ScopeOption
              $active={scope === "cloud"}
              $danger={false}
              onClick={() => setScope("cloud")}
              type="button"
            >
              <ScopeIcon>
                <HardDrivesIcon size={16} weight="duotone" />
              </ScopeIcon>
              <ScopeText>
                <ScopeTitle>Cloud only</ScopeTitle>
                <ScopeSub>
                  The invoice remains in your local storage for reference.
                </ScopeSub>
              </ScopeText>
            </ScopeOption>

            <ScopeOption
              $active={scope === "both"}
              $danger
              onClick={() => setScope("both")}
              type="button"
            >
              <ScopeIcon $danger>
                <TrashIcon size={16} weight="duotone" />
              </ScopeIcon>
              <ScopeText>
                <ScopeTitle $danger>Cloud &amp; local</ScopeTitle>
                <ScopeSub>
                  Permanently removes everywhere. Cannot be recovered.
                </ScopeSub>
              </ScopeText>
            </ScopeOption>
          </ScopeOptions>
        </Body>
      </DynamicPopUp>
    );
  });

ExchangeDeleteModal.displayName = "ExchangeDeleteModal";
