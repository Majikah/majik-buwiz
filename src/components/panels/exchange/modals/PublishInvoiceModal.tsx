/**
 * modals/PublishInvoiceModal.tsx
 *
 * Self-contained modal for creating a new key account.
 * Handles the zip/PNG generation and Tauri save dialog internally.
 * Keystrokes never escape to the parent.
 */

import React, { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { MajikBuwizDatabase } from "@/components/majik-context-wrapper/majik-buwiz-database";

import DynamicPopUp from "@/components/functional/DynamicPopUp";

import styled from "styled-components";
import { MajikInvoiceContact } from "@/SDK/majik-buwiz-client/src/core/party/majik-invoice-contact";

import { MajikInvoice } from "@majikah/majik-invoice";
import { ExchangePublishSearchBar } from "../ExchangePublishSearchBar";
import { ExchangeSearchResults } from "../ExchangeSearchResults";
import MajikRecipientSelector from "@/components/MajikRecipientSelector";
import GuideHelper from "@/components/functional/GuideHelper";

// ---------------------------------------------------------------------------
// Publish modal styled
// ---------------------------------------------------------------------------

const PublishModalBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 260px;
`;

const PublishSearch = styled.div`
  position: relative;
`;

interface PublishInvoiceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  majik: MajikBuwizDatabase;
  onSuccess: () => void;
  hiddenInvoiceIds?: Set<string>;
  disabledInvoiceIds?: Set<string>;
  localInvoices: MajikInvoice[];
}

export const PublishInvoiceModal: React.FC<PublishInvoiceModalProps> =
  React.memo(
    ({
      open,
      onOpenChange,
      majik,
      onSuccess,
      hiddenInvoiceIds,
      localInvoices,
    }) => {
      const [isPublishing, setIsPublishing] = useState(false);

      const [publishCandidates, setPublishCandidates] = useState<
        MajikInvoice[]
      >([]);

      const [publishSearch, setPublishSearch] = useState("");
      const [selectedToPublish, setSelectedToPublish] = useState<Set<string>>(
        new Set(),
      );

      const [configRecipients, setConfigRecipients] = useState<
        MajikInvoiceContact[]
      >(() => {
        const active = majik.getActiveAccount();
        return active ? [active] : [];
      });

      const handleRecipientsUpdate = useCallback(
        (selected: MajikInvoiceContact[]) => {
          setConfigRecipients(selected);
        },
        [],
      );

      const togglePublishSelect = useCallback((id: string) => {
        setSelectedToPublish((prev) => {
          const next = new Set(prev);
          next.has(id) ? next.delete(id) : next.add(id);
          return next;
        });
      }, []);

      useEffect(() => {
        if (open) {
          setSelectedToPublish(new Set());
          setPublishSearch("");
        }
      }, [open]);

      // ── handlePublishConfirm — updated to use contact IDs ────────────────────

      const processPublish = async (
        toPublish: MajikInvoice[],
      ): Promise<string> => {
        setIsPublishing(true);
        if (toPublish.length === 0) {
          throw new Error("No invoices selected for publishing.");
        }

        if (configRecipients.length === 0) {
          throw new Error("Select at least one recipient before publishing.");
        }

        const recipientContactIds = configRecipients.map((c) => c.id);

        for (const inv of toPublish) {
          await majik.publishInvoice(inv, recipientContactIds);
        }

        return `${toPublish.length} invoice${
          toPublish.length > 1 ? "s" : ""
        } published.`;
      };

      const handlePublishConfirm = useCallback((): void => {
        if (configRecipients.length === 1) {
          toast.error("Select at least 2 participants before publishing.");
          return;
        }

        const toPublish = localInvoices.filter((inv) =>
          selectedToPublish.has(inv.id),
        );

        toast.promise(processPublish(toPublish), {
          loading: `Publishing ${toPublish.length > 1 ? "invoices" : "invoice"}...`,
          success: (msg) => {
            onOpenChange(false);
            onSuccess();
            return msg;
          },
          error: (err) => {
            console.error(err);
            return err instanceof Error ? err.message : "Publish failed.";
          },
          finally: () => {
            onOpenChange(false);
            setIsPublishing(false);
          },
        });
      }, [localInvoices, selectedToPublish, configRecipients, majik]);

      const handleCancel = useCallback(
        () => onOpenChange(false),
        [onOpenChange],
      );

      return (
        <DynamicPopUp
          isOpen={open}
          onOpenChange={onOpenChange}
          scrollable
          modal={{
            title: "Send Invoice",
            description:
              "Select local invoices to publish to the Majikah network. Already-published invoices are shown as read-only.",
          }}
          buttons={{
            cancel: {
              text: "Cancel",
              onClick: handleCancel,
              isDisabled: isPublishing,
            },
            confirm: {
              text: isPublishing
                ? "Publishing…"
                : selectedToPublish.size > 0
                  ? `Send ${selectedToPublish.size} Invoice${selectedToPublish.size > 1 ? "s" : ""}`
                  : "Send",

              isDisabled:
                selectedToPublish.size === 0 ||
                isPublishing ||
                configRecipients.length < 2,
              onClick: handlePublishConfirm,
            },
          }}
        >
          <PublishModalBody>
            <GuideHelper docsPath="https://majikah.solutions/products/majik-buwiz/docs/buwiz-exchange-send" />

            {/* Recipient selector */}

            <MajikRecipientSelector
              value={configRecipients}
              onUpdate={handleRecipientsUpdate}
              allowEmpty={true}
              compact
              maxContacts={1}
              majik={majik}
            />

            {/* Invoice search */}
            <PublishSearch>
              <ExchangePublishSearchBar
                invoices={localInvoices}
                onFilter={setPublishCandidates}
                onQueryChange={setPublishSearch}
              />
            </PublishSearch>

            <ExchangeSearchResults
              variant="compact"
              selectionMode
              selectedIds={selectedToPublish}
              hiddenInvoiceIds={hiddenInvoiceIds}
              allInvoices={localInvoices}
              results={publishCandidates}
              hasQuery={!!publishSearch.trim()}
              onSelect={(inv) => togglePublishSelect(inv.id)}
              onToggleSelect={(inv) => togglePublishSelect(inv.id)}
              tab="sent"
              defaultCount={10}
            />
          </PublishModalBody>
        </DynamicPopUp>
      );
    },
  );

PublishInvoiceModal.displayName = "PublishInvoiceModal";
