/**
 * StatusQuickActions.tsx
 *
 * Renders quick-action status transition buttons in the invoice panel header.
 *
 * isAdmin (default: true):
 *   true  → All ALLOWED_TRANSITIONS shown as direct action buttons,
 *           except paid/partial which always open the payment proof modal.
 *           When currentStatus is "void", shows "Restart Invoice" (→ issued)
 *           which calls onRestart instead of onTransition.
 *           Sync controls (push/pull) are also available.
 *   false → Only CLIENT_ALLOWED_TRANSITIONS shown (partial, paid via modal).
 *           System-automated transitions (sent, viewed) are hidden.
 *           All admin-only transitions (issued, disputed, void, etc.) are hidden.
 *           No sync controls.
 *
 * Transition ownership summary:
 *   Admin direct:   issued, sent, viewed, disputed, void, overdue, draft
 *   Admin + client: partial, paid  (both via payment modal)
 *   Client only:    partial, paid
 *   Hidden always from client: sent, viewed, issued, disputed, void, overdue
 *
 * Special routing:
 *   void → issued  → calls onRestart() (not onTransition) when provided
 */

import React, { useMemo, useRef, useState } from "react";
import styled, { css } from "styled-components";
import type {
  InvoiceStatus,
  GeneralInvoice,
  ProofOfPayment,
  MajikInvoice,
} from "@majikah/majik-invoice";
import { ALLOWED_TRANSITIONS } from "@majikah/majik-invoice";
import {
  PaperPlaneTiltIcon,
  EyeIcon,
  CheckCircleIcon,
  CurrencyCircleDollarIcon,
  WarningIcon,
  ProhibitIcon,
  ClockIcon,
  ArrowCounterClockwiseIcon,
  CloudArrowDownIcon,
  CloudArrowUpIcon,
} from "@phosphor-icons/react";
import DynamicPopUp from "@/components/functional/DynamicPopUp";
import DynamicSlidingDialogue from "@/components/functional/DynamicSlidingDialogue";
import { InvoicePaymentForm } from "./InvoicePaymentForm";
import InvoiceComparison from "./InvoiceComparison";

// ---------------------------------------------------------------------------
// Transition visibility rules
// ---------------------------------------------------------------------------

/**
 * The only statuses a non-admin client may manually trigger.
 * "sent" / "viewed" are system-automated and intentionally excluded.
 * "issued", "disputed", "void", "overdue" are admin-only.
 */
const CLIENT_ALLOWED_TRANSITIONS: InvoiceStatus[] = ["partial", "paid"];

/**
 * Transitions that open the payment proof modal regardless of admin role.
 * The status is set automatically by GeneralInvoice.addPayment() based on totals
 * so we never call onTransition for these — we call onPayment instead.
 */
const PAYMENT_TRANSITIONS = new Set<InvoiceStatus>(["paid", "partial"]);

/**
 * Returns true when the button should route to onRestart instead of onTransition.
 * Only applies to the admin-injected void → issued path.
 */
const isRestartTransition = (
  activeStatus: InvoiceStatus,
  to: InvoiceStatus,
): boolean => activeStatus === "void" && to === "issued";

// ---------------------------------------------------------------------------
// Action metadata
// ---------------------------------------------------------------------------

interface ActionMeta {
  label: string;
  icon: React.ReactNode;
  variant: "default" | "primary" | "success" | "warning" | "danger";
}

const ACTION_META: Record<InvoiceStatus, ActionMeta> = {
  draft: {
    label: "Revert to Draft",
    icon: <ArrowCounterClockwiseIcon size={11} weight="bold" />,
    variant: "default",
  },
  issued: {
    label: "Issue",
    icon: <PaperPlaneTiltIcon size={11} weight="bold" />,
    variant: "primary",
  },
  sent: {
    label: "Mark Sent",
    icon: <PaperPlaneTiltIcon size={11} weight="fill" />,
    variant: "default",
  },
  viewed: {
    label: "Mark Viewed",
    icon: <EyeIcon size={11} weight="bold" />,
    variant: "default",
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
    label: "Disputed",
    icon: <WarningIcon size={11} weight="bold" />,
    variant: "warning",
  },
  void: {
    label: "Void",
    icon: <ProhibitIcon size={11} weight="bold" />,
    variant: "danger",
  },
};

/**
 * Overrides for specific (currentStatus → target) combinations when isAdmin.
 * Key format: `${currentStatus}:${to}`.
 */
const CONTEXTUAL_META: Partial<Record<string, ActionMeta>> = {
  "void:issued": {
    label: "Restart Invoice",
    icon: <ArrowCounterClockwiseIcon size={11} weight="bold" />,
    variant: "primary",
  },
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

/** Sync button — subtler ghost styling */
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

export interface StatusQuickActionsProps {
  /**
   * The live MajikInvoice wrapper — needed for sync comparison drawer.
   */
  majikInvoice: MajikInvoice;
  /**
   * Called for non-payment direct status transitions.
   * NOT called for paid/partial (use onPayment) or void→issued (use onRestart).
   */
  onTransition: (to: InvoiceStatus) => void;
  /**
   * Called after a payment proof is successfully recorded.
   * Receives the updated GeneralInvoice returned by invoice.addPayment(proof).
   * The caller is responsible for reissue + resign + persist.
   */
  onPayment?: (updatedInvoice: GeneralInvoice) => void;
  /**
   * Called when the admin clicks "Restart Invoice" on a voided invoice.
   * Replaces onTransition("issued") for the void → issued path so the caller
   * can run custom restart logic (e.g. majik.restartInvoice).
   * Falls back to onTransition("issued") if not provided.
   */
  onRestart?: () => void;
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
  /** Disable all buttons while an async operation is in-flight */
  disabled?: boolean;
  /**
   * Admin mode — default true.
   *   true  → All allowed transitions visible. paid/partial open payment modal.
   *           void status exposes "Restart Invoice" (→ onRestart).
   *           Sync controls visible.
   *   false → Only CLIENT_ALLOWED_TRANSITIONS shown (partial, paid via modal).
   *           System-owned transitions (sent, viewed, issued, etc.) are hidden.
   *           No sync controls.
   */
  isAdmin?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const StatusQuickActions: React.FC<StatusQuickActionsProps> = ({
  majikInvoice,
  onTransition,
  onPayment,
  onRestart,
  onSync,
  onFetchRemote,
  disabled = false,
  isAdmin = true,
}) => {
  // ── Payment modal ─────────────────────────────────────────────────────────
  const [paymentModalOpen, setPaymentModalOpen] = useState<boolean>(false);
  const paymentProofRef = useRef<ProofOfPayment | null>(null);
  const [paymentIntent, setPaymentIntent] = useState<"paid" | "partial">(
    "paid",
  );
  const [paymentValid, setPaymentValid] = useState<boolean>(false);

  // ── Sync comparison drawer ────────────────────────────────────────────────
  const [syncDrawerOpen, setSyncDrawerOpen] = useState(false);
  const [syncIntent, setSyncIntent] = useState<"local" | "cloud" | null>(null);
  const [remoteInvoice, setRemoteInvoice] = useState<MajikInvoice | null>(null);
  const [fetchingRemote, setFetchingRemote] = useState(false);

  // ── Derive status + invoice from majikInvoice ─────────────────────────────

  const activeStatus = useMemo((): InvoiceStatus => {
    if (!majikInvoice) return "draft";
    return majikInvoice.status;
  }, [majikInvoice]);

  const invoice = useMemo(() => {
    if (!majikInvoice) return undefined;
    if (majikInvoice.isEncrypted && !majikInvoice.hasDecryptedCache)
      return undefined;
    try {
      return majikInvoice.invoice ?? undefined;
    } catch {
      return undefined;
    }
  }, [majikInvoice]);

  // ── Derive visible targets ────────────────────────────────────────────────

  // ALLOWED_TRANSITIONS["void"] is [] (terminal) in the package.
  // Admins may still restart a voided invoice by transitioning → issued,
  // so we inject it locally. The button routes to onRestart, not onTransition.
  const allTargets: InvoiceStatus[] = [
    ...(ALLOWED_TRANSITIONS[activeStatus] ?? []),
    ...(isAdmin && activeStatus === "void"
      ? (["issued"] as InvoiceStatus[])
      : []),
  ];

  const visibleTargets = isAdmin
    ? allTargets
    : allTargets.filter((t) => CLIENT_ALLOWED_TRANSITIONS.includes(t));

  /**
   * Resolve display metadata for a target transition.
   * Checks contextual overrides first (e.g. void → issued becomes "Restart Invoice"),
   * then falls back to the standard ACTION_META entry.
   */
  const getDisplayMeta = (to: InvoiceStatus): ActionMeta => {
    const contextKey = `${activeStatus}:${to}`;
    return CONTEXTUAL_META[contextKey] ?? ACTION_META[to];
  };

  const showSyncControls = isAdmin && !!onSync && !!onFetchRemote;
  const hasAnything = visibleTargets.length > 0 || showSyncControls;

  if (!hasAnything) return null;

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleButtonClick = (to: InvoiceStatus) => {
    // Payment modal takes priority
    if (PAYMENT_TRANSITIONS.has(to)) {
      paymentProofRef.current = null;
      setPaymentIntent(to as "paid" | "partial");
      setPaymentModalOpen(true);
      return;
    }

    // void → issued routes to onRestart; falls back to onTransition if
    // the caller didn't provide it.
    if (isRestartTransition(activeStatus, to)) {
      if (onRestart) {
        onRestart();
      } else {
        onTransition(to);
      }
      return;
    }

    onTransition(to);
  };

  const handlePaymentConfirm = () => {
    if (!paymentProofRef.current || !invoice) return;
    try {
      const updated = invoice.addPayment(paymentProofRef.current);
      onPayment?.(updated);
    } catch (err) {
      console.error("[StatusQuickActions] addPayment failed:", err);
    } finally {
      setPaymentModalOpen(false);
      paymentProofRef.current = null;
    }
  };

  const handlePaymentCancel = () => {
    setPaymentModalOpen(false);
    paymentProofRef.current = null;
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
      console.error("[StatusQuickActions] fetchRemote failed:", err);
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

  // ── Derive amounts for payment modal hint ─────────────────────────────────

  const invoiceTotal = invoice
    ? (() => {
        try {
          return invoice.totals.netPayable;
        } catch {
          return undefined;
        }
      })()
    : undefined;

  const amountPaid = invoice ? invoice.totalPaid : undefined;

  const amountRemaining =
    invoiceTotal !== undefined && amountPaid !== undefined
      ? invoiceTotal.subtract(amountPaid).toMajor()
      : undefined;

  // ── Comparison invoices ───────────────────────────────────────────────────
  // For "local → cloud": left = local (majikInvoice), right = remote
  // For "cloud → local": left = remote, right = local (majikInvoice)
  const comparisonLeft =
    syncIntent === "local" ? majikInvoice : (remoteInvoice ?? majikInvoice);
  const comparisonRight =
    syncIntent === "local" ? (remoteInvoice ?? majikInvoice) : majikInvoice;

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
        </LeftGroup>

        {/* ── Right: sync buttons (admin only) ── */}
        {showSyncControls && (
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

      {/* ── Payment proof modal — shown for paid / partial ── */}
      <DynamicPopUp
        scrollable
        isOpen={paymentModalOpen}
        onOpenChange={(open) => {
          if (!open) handlePaymentCancel();
        }}
        modal={{
          title:
            paymentIntent === "partial"
              ? "Record Partial Payment"
              : "Record Payment",
          description:
            paymentIntent === "partial"
              ? "Log a partial payment. The invoice status will update automatically based on the total amount covered."
              : "Record the full payment details. The invoice will be marked as paid once the total is covered.",
        }}
        buttons={{
          cancel: { text: "Cancel", onClick: handlePaymentCancel },
          confirm: {
            text: "Record Payment",
            onClick: handlePaymentConfirm,
            isDisabled: !paymentValid,
          },
        }}
      >
        <InvoicePaymentForm
          invoiceCurrency={invoice?.currency ?? "PHP"}
          invoiceTotal={invoiceTotal?.toMajor()}
          amountRemaining={amountRemaining}
          onChange={(proof) => {
            paymentProofRef.current = proof;
          }}
          onValidate={setPaymentValid}
        />
      </DynamicPopUp>

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
