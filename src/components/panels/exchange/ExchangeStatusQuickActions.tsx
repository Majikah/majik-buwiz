import React, { useState } from "react";
import styled, { css } from "styled-components";
import type {
  InvoiceStatus,
  GeneralInvoice,
  ProofOfPayment,
} from "@majikah/majik-invoice";
import { ALLOWED_TRANSITIONS } from "@majikah/majik-invoice";
import {
  ArrowCounterClockwiseIcon,
  CheckCircleIcon,
  CloudArrowDownIcon,
  CloudArrowUpIcon,
  CurrencyCircleDollarIcon,
  ProhibitIcon,
  ClockIcon,
  PaperPlaneTiltIcon,
  TrashIcon,
  WarningIcon,
} from "@phosphor-icons/react";
import DynamicSlidingDialogue from "@/components/functional/DynamicSlidingDialogue";

import type { MajikInvoice } from "@majikah/majik-invoice";
import InvoiceComparison from "../invoice/InvoiceComparison";
import { ExchangeDeleteModal } from "./modals/ExchangeDeleteModal";
import { ClearPaymentModal } from "./modals/ClearPaymentModal";
import { AddPaymentModal } from "../invoice/modals/AddPaymentModal";

type ModalKeyContext =
  | "dispute"
  | "delete"
  | "clear-payment"
  | "add-payment"
  | null;

// ---------------------------------------------------------------------------
// Visibility rules
// ---------------------------------------------------------------------------

const SYSTEM_TRANSITIONS = new Set<InvoiceStatus>([
  "sent",
  "viewed",
  "partial",
  "paid",
]);
const ISSUER_ONLY_TRANSITIONS = new Set<InvoiceStatus>([
  "issued",
  "overdue",
  "void",
]);
const RECIPIENT_ONLY_TRANSITIONS = new Set<InvoiceStatus>(["disputed"]);
const PAYMENT_ALLOWED_STATUSES = new Set<InvoiceStatus>([
  "sent",
  "viewed",
  "partial",
  "issued",
]);

const PAYMENT_BLOCKED_STATUSES = new Set<InvoiceStatus>([
  "void",
  "disputed",
  "draft",
]);
const ISSUER_CLEAR_PAYMENT_STATUSES = new Set<InvoiceStatus>([
  "paid",
  "partial",
]);

// ---------------------------------------------------------------------------
// Action metadata
// ---------------------------------------------------------------------------

interface ActionMeta {
  label: string;
  icon: React.ReactNode;
  variant: "default" | "primary" | "success" | "warning" | "danger";
}

const ACTION_META: Partial<Record<InvoiceStatus, ActionMeta>> = {
  issued: {
    label: "Issue",
    icon: <PaperPlaneTiltIcon size={11} weight="bold" />,
    variant: "primary",
  },
  partial: {
    label: "Partial Payment",
    icon: <CurrencyCircleDollarIcon size={11} weight="bold" />,
    variant: "warning",
  },
  paid: {
    label: "Mark Paid",
    icon: <CheckCircleIcon size={11} weight="fill" />,
    variant: "success",
  },
  overdue: {
    label: "Overdue",
    icon: <ClockIcon size={11} weight="bold" />,
    variant: "warning",
  },
  disputed: {
    label: "Dispute",
    icon: <WarningIcon size={11} weight="bold" />,
    variant: "warning",
  },
  void: {
    label: "Void",
    icon: <ProhibitIcon size={11} weight="bold" />,
    variant: "danger",
  },
};

const CONTEXTUAL_META: Partial<Record<string, ActionMeta>> = {
  "disputed:issued:issuer": {
    label: "Resolve & Reissue",
    icon: <PaperPlaneTiltIcon size={11} weight="bold" />,
    variant: "primary",
  },
  "void:issued:issuer": {
    label: "Reissue",
    icon: <PaperPlaneTiltIcon size={11} weight="bold" />,
    variant: "primary",
  },
};

const CLEAR_PAYMENTS_META: ActionMeta = {
  label: "Clear Payments",
  icon: <ProhibitIcon size={11} weight="bold" />,
  variant: "danger",
};

// ---------------------------------------------------------------------------
// Styled
// ---------------------------------------------------------------------------

/** Outermost row — left group + right group with space-between */
const ActionsRoot = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: nowrap;
  width: 100%;
`;

const LeftGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 5px;
  flex-wrap: nowrap;
  flex: 1;
  min-width: 0;
`;

const RightGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 5px;
  flex-shrink: 0;
`;

const Separator = styled.div`
  width: 1px;
  height: 18px;
  background: ${({ theme }) => theme.colors.primary}18;
  flex-shrink: 0;
  margin: 0 2px;
`;

const ActionBtn = styled.button<{ $variant: ActionMeta["variant"] }>`
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  font-size: 11px;
  padding: 5px 11px;
  border-radius: ${({ theme }) => theme.borders.radius.medium};
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
  transition: all 0.14s ease;

  ${({ $variant, theme }) => {
    switch ($variant) {
      case "primary":
        return css`
          background: ${theme.gradients.primary};
          border: 1px solid transparent;
          color: ${theme.colors.static.white};
          &:hover:not(:disabled) {
            filter: brightness(1.1);
          }
        `;
      case "success":
        return css`
          background: transparent;
          border: 1px solid ${theme.colors.brand.green};
          color: ${theme.colors.brand.green};
          &:hover:not(:disabled) {
            background: ${theme.colors.brand.green};
            color: ${theme.colors.static.white};
          }
        `;
      case "warning":
        return css`
          background: transparent;
          border: 1px solid ${theme.colors.textSecondary};
          color: ${theme.colors.textSecondary};
          &:hover:not(:disabled) {
            background: ${theme.colors.secondaryBackground};
          }
        `;
      case "danger":
        return css`
          background: transparent;
          border: 1px solid ${theme.colors.error};
          color: ${theme.colors.error};
          &:hover:not(:disabled) {
            background: ${theme.colors.error}14;
          }
        `;
      default:
        return css`
          background: transparent;
          border: 1px solid ${theme.colors.primary};
          color: ${theme.colors.textSecondary};
          &:hover:not(:disabled) {
            background: ${theme.colors.primarySoft};
            color: ${theme.colors.primary};
            border-color: ${theme.colors.primary};
          }
        `;
    }
  }}

  &:disabled {
    opacity: 0.38;
    cursor: not-allowed;
    pointer-events: none;
  }

  svg {
    flex-shrink: 0;
  }
`;

/** Sync button — subtler styling, uses default/ghost variant */
const SyncBtn = styled.button<{ $loading?: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  font-size: 11px;
  padding: 5px 10px;
  border-radius: ${({ theme }) => theme.borders.radius.medium};
  cursor: ${({ $loading }) => ($loading ? "not-allowed" : "pointer")};
  white-space: nowrap;
  flex-shrink: 0;
  transition: all 0.14s ease;
  background: transparent;
  border: 1px solid ${({ theme }) => theme.colors.primary}28;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: ${({ $loading }) => ($loading ? 0.5 : 1)};

  &:hover:not(:disabled) {
    background: ${({ theme }) => theme.colors.primarySoft};
    color: ${({ theme }) => theme.colors.primary};
    border-color: ${({ theme }) => theme.colors.primary}55;
  }

  &:disabled {
    opacity: 0.38;
    cursor: not-allowed;
    pointer-events: none;
  }

  svg {
    flex-shrink: 0;
  }
`;

const SyncSeparator = styled.div`
  width: 1px;
  height: 14px;
  background: ${({ theme }) => theme.colors.primary}18;
  flex-shrink: 0;
`;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ExchangeStatusQuickActionsProps {
  currentStatus: InvoiceStatus;
  isIssuer: boolean;
  /**
   * The live MajikInvoice wrapper — needed for sync comparison and payment modal.
   */
  majikInvoice?: MajikInvoice;
  invoice?: GeneralInvoice;
  onTransition: (to: InvoiceStatus) => void;
  onPayment?: (updatedInvoice: GeneralInvoice) => void;
  onClearPayment?: () => void;
  /**
   * Called when the issuer wants to restart a voided invoice from scratch.
   * Drops all signatures and re-signs as if new.
   */
  onRestart?: () => void;
  /**
   * Called when the issuer wants to delete the invoice from the cloud.
   * The boolean indicates whether to also remove the local copy.
   */
  onDelete?: (removeLocally: boolean) => void;
  /**
   * Called after the user confirms a sync action inside the comparison drawer.
   * source = "local"  → push local copy to cloud
   * source = "cloud"  → pull cloud copy and overwrite local
   */
  onSync?: (source: "local" | "cloud") => void;
  /**
   * Fetch the current cloud version of this invoice for the comparison drawer.
   * Should call majik.getInvoiceRemote(id, true).
   */
  onFetchRemote?: () => Promise<MajikInvoice>;
  disabled?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const ExchangeStatusQuickActions: React.FC<
  ExchangeStatusQuickActionsProps
> = ({
  currentStatus,
  isIssuer,
  majikInvoice,
  invoice,
  onTransition,
  onPayment,
  onClearPayment,
  onRestart,
  onDelete,
  onSync,
  onFetchRemote,
  disabled = false,
}) => {
  const [modalKey, setModalKey] = useState<ModalKeyContext>(null);

  // ── Sync comparison drawer ────────────────────────────────────────────────
  const [syncDrawerOpen, setSyncDrawerOpen] = useState(false);
  const [syncIntent, setSyncIntent] = useState<"local" | "cloud" | null>(null);
  const [remoteInvoice, setRemoteInvoice] = useState<MajikInvoice | null>(null);
  const [fetchingRemote, setFetchingRemote] = useState(false);

  // ── Derive visible targets ────────────────────────────────────────────────

  const allTargets: InvoiceStatus[] = ALLOWED_TRANSITIONS[currentStatus] ?? [];

  const visibleTargets = allTargets.filter((to) => {
    if (SYSTEM_TRANSITIONS.has(to)) return false;
    if (isIssuer && RECIPIENT_ONLY_TRANSITIONS.has(to)) return false;
    if (!isIssuer && ISSUER_ONLY_TRANSITIONS.has(to)) return false;
    // For void status, suppress the "issued" transition from the standard buttons
    // — it's handled by the dedicated Restart button instead.
    if (currentStatus === "void" && to === "issued") return false;
    if (!ACTION_META[to]) return false;
    return true;
  });

  const role = isIssuer ? "issuer" : "recipient";

  const getDisplayMeta = (to: InvoiceStatus): ActionMeta => {
    const contextKey = `${currentStatus}:${to}:${role}`;
    return CONTEXTUAL_META[contextKey] ?? ACTION_META[to]!;
  };

  const showClearPayments =
    isIssuer && ISSUER_CLEAR_PAYMENT_STATUSES.has(currentStatus);

  // Void-specific issuer controls
  const showVoidControls = isIssuer && currentStatus === "void";

  const hasLeftAnything =
    visibleTargets.length > 0 || showClearPayments || showVoidControls;
  const hasAnything = hasLeftAnything || (isIssuer && !!onSync);

  const canAcceptPayments =
    PAYMENT_ALLOWED_STATUSES.has(currentStatus) &&
    !PAYMENT_BLOCKED_STATUSES.has(currentStatus);

  if (!hasAnything) return null;

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleButtonClick = (to: InvoiceStatus) => {
    onTransition(to);
  };

  const handleAddPayment = () => {
    if (!canAcceptPayments) return;
    setModalKey("add-payment");
  };

  const handlePaymentConfirm = (proof: ProofOfPayment) => {
    if (!proof || !invoice) return;
    try {
      console.log("Received Proof: ", proof);
      const updated = invoice.addPayment(proof);
      onPayment?.(updated);
    } catch (err) {
      console.error("[ExchangeStatusQuickActions] addPayment failed:", err);
    } finally {
      setModalKey(null);
    }
  };

  // ── Sync handlers ─────────────────────────────────────────────────────────

  const handleSyncClick = async (source: "local" | "cloud") => {
    if (!onFetchRemote || !majikInvoice) return;
    setFetchingRemote(true);
    try {
      const remote = await onFetchRemote();
      setRemoteInvoice(remote);
      setSyncIntent(source);
      setSyncDrawerOpen(true);
    } catch (err) {
      console.error("[ExchangeStatusQuickActions] fetchRemote failed:", err);
    } finally {
      setFetchingRemote(false);
    }
  };

  const handleSyncConfirm = () => {
    if (!syncIntent) return;
    onSync?.(syncIntent);
    setSyncDrawerOpen(false);
    setRemoteInvoice(null);
    setSyncIntent(null);
  };

  // ── Delete handlers ───────────────────────────────────────────────────────

  const handleDeleteConfirm = (removeLocally: boolean) => {
    onDelete?.(removeLocally);
    setModalKey(null);
  };

  // ── Comparison invoices ───────────────────────────────────────────────────
  // For "local → cloud": left = local (majikInvoice), right = remote
  // For "cloud → local": left = remote, right = local (majikInvoice)
  const comparisonLeft =
    syncIntent === "local" ? majikInvoice! : (remoteInvoice ?? majikInvoice!);
  const comparisonRight =
    syncIntent === "local" ? (remoteInvoice ?? majikInvoice!) : majikInvoice!;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <Separator />
      <ActionsRoot>
        {/* ── Left: status transition buttons ── */}
        <LeftGroup>
          {visibleTargets.map((to) => {
            const meta = getDisplayMeta(to);
            return (
              <ActionBtn
                key={to}
                $variant={meta.variant}
                onClick={() => handleButtonClick(to)}
                disabled={disabled}
                title={`Transition to: ${to}`}
              >
                {meta.icon}
                {meta.label}
              </ActionBtn>
            );
          })}

          {canAcceptPayments && !isIssuer && (
            <ActionBtn
              $variant="success"
              onClick={handleAddPayment}
              disabled={disabled}
            >
              <CurrencyCircleDollarIcon size={11} weight="bold" />
              Add Payment
            </ActionBtn>
          )}

          {showClearPayments && (
            <ActionBtn
              $variant={CLEAR_PAYMENTS_META.variant}
              onClick={() => setModalKey("clear-payment")}
              disabled={disabled}
              title="Clear all recorded payments"
            >
              {CLEAR_PAYMENTS_META.icon}
              {CLEAR_PAYMENTS_META.label}
            </ActionBtn>
          )}

          {/* Void-specific controls */}
          {showVoidControls && (
            <>
              <ActionBtn
                $variant="primary"
                onClick={() => onRestart?.()}
                disabled={disabled}
                title="Restart invoice from scratch — drops all signatures and re-signs"
              >
                <ArrowCounterClockwiseIcon size={11} weight="bold" />
                Restart Invoice
              </ActionBtn>

              <ActionBtn
                $variant="danger"
                onClick={() => setModalKey("delete")}
                disabled={disabled}
                title="Delete this invoice from the cloud"
              >
                <TrashIcon size={11} weight="bold" />
                Delete
              </ActionBtn>
            </>
          )}
        </LeftGroup>

        {/* ── Right: sync buttons (issuer only, always visible) ── */}
        {isIssuer && onSync && onFetchRemote && (
          <RightGroup>
            <SyncSeparator />

            <SyncBtn
              $loading={fetchingRemote}
              onClick={() => handleSyncClick("local")}
              disabled={disabled || fetchingRemote}
              title="Push your local copy to the cloud"
            >
              <CloudArrowUpIcon size={11} weight="bold" />
              Sync to Cloud
            </SyncBtn>

            <SyncBtn
              $loading={fetchingRemote}
              onClick={() => handleSyncClick("cloud")}
              disabled={disabled || fetchingRemote}
              title="Pull the cloud copy and overwrite local"
            >
              <CloudArrowDownIcon size={11} weight="bold" />
              Sync from Cloud
            </SyncBtn>
          </RightGroup>
        )}
      </ActionsRoot>

      {/* ── Payment modal ── */}
      {!!majikInvoice && (
        <AddPaymentModal
          open={modalKey === "add-payment"}
          onOpenChange={(change) => setModalKey(change ? "add-payment" : null)}
          invoice={majikInvoice}
          onConfirm={async (proof: ProofOfPayment) => {
            if (!majikInvoice || modalKey !== "add-payment") return;
            handlePaymentConfirm(proof);
          }}
        />
      )}

      {/* ── Delete confirmation modal ── */}
      <ExchangeDeleteModal
        open={modalKey === "delete"}
        onOpenChange={(change) => setModalKey(change ? "delete" : null)}
        invoices={majikInvoice ? [majikInvoice] : []}
        onConfirm={async (removeLocally: boolean) => {
          if (!majikInvoice || modalKey !== "delete") return;
          handleDeleteConfirm(removeLocally);
        }}
      />

      {/* ── Clear Payments modal ── */}

      {majikInvoice && (
        <ClearPaymentModal
          open={modalKey === "clear-payment"}
          onOpenChange={(change) =>
            setModalKey(change ? "clear-payment" : null)
          }
          invoice={majikInvoice}
          onConfirm={async () => {
            if (!majikInvoice || modalKey !== "clear-payment") return;
            onClearPayment?.();
          }}
        />
      )}

      {/* ── Sync comparison drawer ── */}
      {majikInvoice && remoteInvoice && (
        <DynamicSlidingDialogue
          isOpen={syncDrawerOpen}
          onOpenChange={(open) => {
            if (!open) {
              setSyncDrawerOpen(false);
              setRemoteInvoice(null);
              setSyncIntent(null);
            }
          }}
          scrollable
          preventDragClose
          modal={{
            title:
              syncIntent === "local"
                ? "Sync Local → Cloud"
                : "Sync Cloud → Local",
            description:
              syncIntent === "local"
                ? "Review the differences before pushing your local copy to the cloud."
                : "Review the differences before overwriting your local copy with the cloud version.",
          }}
          buttons={{
            cancel: { text: "Cancel", hide: false },
            confirm: {
              text:
                syncIntent === "local" ? "Push to Cloud" : "Overwrite Local",
              hide: false,
              onClick: handleSyncConfirm,
            },
          }}
          width={900}
        >
          <InvoiceComparison
            invoiceA={comparisonLeft}
            invoiceB={comparisonRight}
            comparisonSource={{
              from: syncIntent === "local" ? "local" : "cloud",
              to: syncIntent === "cloud" ? "local" : "cloud",
            }}
          />
        </DynamicSlidingDialogue>
      )}
    </>
  );
};
