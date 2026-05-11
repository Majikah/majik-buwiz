"use client";

/**
 * IssuerCloseBlock.tsx
 *
 * A prominent action block rendered at the bottom of MajikInvoiceDocument,
 * below SignatureBlock. Visible only when ALL of the following are true:
 *
 *   1. kind === "majik"           — not a draft
 *   2. invoice.isFullySigned      — all expected signers have signed
 *   3. !invoice.isSealed          — not already sealed
 *   4. isIssuer === true          — only the invoice issuer sees this
 *
 * Actions:
 *   - "Close Invoice"   → simple confirmation popup → onCloseInvoice()
 *   - "Close & Seal"    → requires typing a confirmation phrase →
 *                         onCloseInvoice(true)
 *     Only rendered when canSeal === true.
 *
 * The component is self-contained: both modals are managed internally.
 * The parent only supplies handlers and capability flags.
 *
 * Usage in MajikInvoiceDocument:
 *
 *   {showIssuerCloseBlock && (
 *     <>
 *       <Divider />
 *       <IssuerCloseBlock
 *         invoice={majikInvoice}
 *         isIssuer={isIssuer}
 *         onCloseInvoice={props.onCloseInvoice}
 *         canSeal={canSealInvoice}
 *       />
 *     </>
 *   )}
 */

import React, { memo, useCallback, useEffect, useMemo, useState } from "react";
import styled, { css, keyframes } from "styled-components";
import {
  ArchiveIcon,
  LockKeyIcon,
  SealIcon,
  WarningCircleIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowClockwiseIcon,
  ShieldWarningIcon,
  FileTextIcon,
} from "@phosphor-icons/react";

import type { MajikInvoice } from "@majikah/majik-invoice";
import DynamicPopUp from "../DynamicPopUp";
import CustomFormInput from "@/components/foundations/CustomFormInput";
import DynamicAlertBanner from "@/components/foundations/DynamicAlertBanner";

// ---------------------------------------------------------------------------
// Animations
// ---------------------------------------------------------------------------

const fadeSlideUp = keyframes`
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
`;

const shimmer = keyframes`
  0%   { background-position: -200% center; }
  100% { background-position:  200% center; }
`;

// ---------------------------------------------------------------------------
// Styled — Block shell
// ---------------------------------------------------------------------------

const Block = styled.section`
  margin-top: 2rem;
  border-radius: ${({ theme }) => theme.borders.radius.big};
  border: 1.5px solid ${({ theme }) => theme.colors.primary}33;
  background: ${({ theme }) => theme.colors.secondaryBackground};
  overflow: hidden;
  animation: ${fadeSlideUp} 0.35s ease both;
  position: relative;
`;

const AccentBar = styled.div`
  height: 3px;
  width: 100%;
  background: linear-gradient(
    90deg,
    ${({ theme }) => theme.colors.primary}00 0%,
    ${({ theme }) => theme.colors.primary}88 50%,
    ${({ theme }) => theme.colors.primary}44 100%
  );
  background-size: 200% auto;
  animation: ${shimmer} 4s linear infinite;
`;

const Inner = styled.div`
  padding: 1.75rem 2rem 2rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
`;

// ---------------------------------------------------------------------------
// Styled — Header
// ---------------------------------------------------------------------------

const Header = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`;

const HeaderIcon = styled.div`
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: ${({ theme }) => theme.colors.primarySoft};
  border: 1px solid ${({ theme }) => theme.colors.primary}33;
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${({ theme }) => theme.colors.primary};
  flex-shrink: 0;
`;

const HeaderText = styled.div`
  flex: 1;
`;

const Title = styled.div`
  font-family: ${({ theme }) => theme.typography.fonts.semibold};
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textPrimary};
  letter-spacing: 0.01em;
`;

const Subtitle = styled.div`
  font-family: ${({ theme }) => theme.typography.fonts.light};
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textSecondary};
  margin-top: 2px;
  line-height: 1.5;
`;

// ---------------------------------------------------------------------------
// Styled — Status strip (fully signed confirmation)
// ---------------------------------------------------------------------------

const StatusStrip = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-radius: ${({ theme }) => theme.borders.radius.medium};
  background: ${({ theme }) => theme.colors.brand.green}0e;
  border: 1px solid ${({ theme }) => theme.colors.brand.green}28;
  font-family: ${({ theme }) => theme.typography.fonts.regular};
  font-size: 11px;
  color: ${({ theme }) => theme.colors.brand.green};
`;

// ---------------------------------------------------------------------------
// Styled — Action buttons row
// ---------------------------------------------------------------------------

const ActionsRow = styled.div`
  display: grid;
  gap: 10px;
  grid-template-columns: 1fr 1fr;

  @media (max-width: ${({ theme }) => theme.breakpoints.tablet}) {
    grid-template-columns: 1fr;
  }
`;

const SingleActionRow = styled.div`
  display: flex;
`;

const BaseActionButton = styled.button<{ $busy: boolean }>`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 0.8rem 1.25rem;
  border-radius: ${({ theme }) => theme.borders.radius.medium};
  font-family: ${({ theme }) => theme.typography.fonts.semibold};
  font-size: 13px;
  letter-spacing: 0.015em;
  cursor: ${({ $busy }) => ($busy ? "wait" : "pointer")};
  transition:
    opacity 0.18s ease,
    transform 0.14s ease,
    box-shadow 0.18s ease,
    background 0.18s ease;

  &:active:not(:disabled) {
    transform: translateY(0) !important;
    box-shadow: none !important;
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  ${({ $busy }) =>
    $busy &&
    css`
      pointer-events: none;
    `}
`;

/** Ghost button — Close Invoice (less destructive) */
const CloseButton = styled(BaseActionButton)`
  background: transparent;
  border: 1.5px solid ${({ theme }) => theme.colors.primary}44;
  color: ${({ theme }) => theme.colors.textSecondary};

  &:hover:not(:disabled) {
    background: ${({ theme }) => theme.colors.primarySoft};
    border-color: ${({ theme }) => theme.colors.primary};
    color: ${({ theme }) => theme.colors.primary};
    transform: translateY(-1px);
  }
`;

/** Filled button — Close & Seal (more permanent) */
const SealButton = styled(BaseActionButton)`
  background: ${({ theme }) => theme.colors.primary};
  border: 1.5px solid transparent;
  color: #fff;
  position: relative;
  overflow: hidden;

  &::before {
    content: "";
    position: absolute;
    inset: 0;
    background: linear-gradient(
      105deg,
      transparent 40%,
      rgba(255, 255, 255, 0.1) 50%,
      transparent 60%
    );
    background-size: 200% auto;
    animation: ${shimmer} 3s linear infinite;
    pointer-events: none;
  }

  &:hover:not(:disabled) {
    opacity: 0.9;
    transform: translateY(-1px);
    box-shadow: 0 6px 20px ${({ theme }) => theme.colors.primary}44;
  }
`;

// ---------------------------------------------------------------------------
// Styled — Disclaimer
// ---------------------------------------------------------------------------

const Disclaimer = styled.div`
  font-family: ${({ theme }) => theme.typography.fonts.light};
  font-size: 10.5px;
  color: ${({ theme }) => theme.colors.textSecondary};
  line-height: 1.6;
  display: flex;
  align-items: flex-start;
  gap: 6px;

  svg {
    flex-shrink: 0;
    margin-top: 1px;
    opacity: 0.5;
  }
`;

// ---------------------------------------------------------------------------
// Styled — Feedback banner
// ---------------------------------------------------------------------------

const FeedbackBanner = styled.div<{ $ok: boolean }>`
  font-family: ${({ theme }) => theme.typography.fonts.regular};
  font-size: 11px;
  padding: 8px 12px;
  border-radius: ${({ theme }) => theme.borders.radius.small};
  display: flex;
  align-items: center;
  gap: 7px;
  animation: ${fadeSlideUp} 0.2s ease both;
  color: ${({ theme, $ok }) =>
    $ok ? theme.colors.brand.green : theme.colors.error};
  background: ${({ theme, $ok }) =>
    $ok ? `${theme.colors.brand.green}0e` : `${theme.colors.error}0e`};
  border: 1px solid
    ${({ theme, $ok }) =>
      $ok ? `${theme.colors.brand.green}28` : `${theme.colors.error}28`};
`;

// ---------------------------------------------------------------------------
// Styled — Seal confirm modal body
// ---------------------------------------------------------------------------

const SealModalBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const SealWarningBox = styled.div`
  display: flex;
  gap: 10px;
  padding: 12px 14px;
  border-radius: ${({ theme }) => theme.borders.radius.medium};
  background: ${({ theme }) => theme.colors.error}0a;
  border: 1px solid ${({ theme }) => theme.colors.error}28;
`;

const SealWarningIcon = styled.div`
  flex-shrink: 0;
  color: ${({ theme }) => theme.colors.error};
  margin-top: 1px;
`;

const SealWarningText = styled.div`
  font-family: ${({ theme }) => theme.typography.fonts.regular};
  font-size: 12px;
  line-height: 1.6;
  color: ${({ theme }) => theme.colors.textSecondary};

  strong {
    font-family: ${({ theme }) => theme.typography.fonts.semibold};
    color: ${({ theme }) => theme.colors.textPrimary};
  }
`;

const SealConfirmLabel = styled.div`
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textSecondary};
  line-height: 1.6;

  code {
    font-family: ${({ theme }) => theme.typography.fonts.numbers};
    font-size: 11px;
    padding: 1px 6px;
    border-radius: 4px;
    background: ${({ theme }) => theme.colors.primarySoft};
    color: ${({ theme }) => theme.colors.primary};
    border: 1px solid ${({ theme }) => theme.colors.primary}22;
  }
`;

// ---------------------------------------------------------------------------
// Seal confirmation modal (internal, memoized)
// ---------------------------------------------------------------------------

interface SealConfirmModalProps {
  isOpen: boolean;
  confirmPhrase: string;
  isBusy: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void>;
}

const SealConfirmModal: React.FC<SealConfirmModalProps> = memo(
  ({ isOpen, confirmPhrase, isBusy, onOpenChange, onConfirm }) => {
    const [typed, setTyped] = useState("");
    const isMatch = typed.trim().toUpperCase() === confirmPhrase.toUpperCase();

    // Reset input whenever modal opens
    useEffect(() => {
      if (isOpen) setTyped("");
    }, [isOpen]);

    return (
      <DynamicPopUp
        isOpen={isOpen}
        onOpenChange={(open) => {
          if (!open && !isBusy) onOpenChange(false);
        }}
        modal={{
          title: "Close & Seal Invoice",
          description:
            "This is a permanent, irreversible action. The invoice will be closed and cryptographically sealed.",
        }}
        buttons={{
          cancel: {
            text: "Cancel",
            onClick: () => onOpenChange(false),
            isDisabled: isBusy,
          },
          confirm: {
            text: isBusy ? "Sealing…" : "Close & Seal",
            onClick: onConfirm,
            isDisabled: !isMatch || isBusy,
          },
        }}
      >
        <SealModalBody>
          <SealWarningBox>
            <SealWarningIcon>
              <ShieldWarningIcon size={16} weight="fill" />
            </SealWarningIcon>
            <SealWarningText>
              <strong>This cannot be undone.</strong> Sealing permanently locks
              the invoice. No further edits, re-signing, or status changes will
              be possible. If you need an editable copy, duplicate the invoice
              first.
            </SealWarningText>
          </SealWarningBox>

          <div>
            <SealConfirmLabel>
              To confirm, type <code>{confirmPhrase}</code> below:
            </SealConfirmLabel>
          </div>

          <div>
            <CustomFormInput
              label="Confirmation phrase"
              value={typed.toUpperCase()}
              onChange={(v) => setTyped(v as string)}
              placeholder={confirmPhrase}
              disabled={isBusy}
              maxChar={confirmPhrase.length}
              layout="stack"
              required
              type="text"
            />
          </div>
        </SealModalBody>
      </DynamicPopUp>
    );
  },
);

SealConfirmModal.displayName = "SealConfirmModal";

// ---------------------------------------------------------------------------
// Close-only confirmation modal (internal, memoized)
// ---------------------------------------------------------------------------

interface CloseConfirmModalProps {
  isOpen: boolean;
  isBusy: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void>;
}

const CloseConfirmModal: React.FC<CloseConfirmModalProps> = memo(
  ({ isOpen, isBusy, onOpenChange, onConfirm }) => {
    return (
      <DynamicPopUp
        isOpen={isOpen}
        onOpenChange={(open) => {
          if (!open && !isBusy) onOpenChange(false);
        }}
        modal={{
          title: "Close Invoice",
          description: "Mark this invoice as closed.",
        }}
        buttons={{
          cancel: {
            text: "Cancel",
            onClick: () => onOpenChange(false),
            isDisabled: isBusy,
          },
          confirm: {
            text: isBusy ? "Closing…" : "Close Invoice",
            onClick: onConfirm,
            isDisabled: isBusy,
          },
        }}
      >
        <SealModalBody>
          <SealWarningBox>
            <SealWarningIcon>
              <WarningCircleIcon size={16} weight="fill" />
            </SealWarningIcon>
            <SealWarningText>
              Closing this invoice will mark it as finalized and no longer
              active. The invoice will remain editable and can be re-opened if
              needed. If you also want to make it permanently immutable, use{" "}
              <strong>Close &amp; Seal</strong> instead.
            </SealWarningText>
          </SealWarningBox>
        </SealModalBody>
      </DynamicPopUp>
    );
  },
);

CloseConfirmModal.displayName = "CloseConfirmModal";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface IssuerCloseBlockProps {
  /** The finalized MajikInvoice being displayed. */
  invoice: MajikInvoice;

  /**
   * Whether the current user is the issuer of this invoice.
   * The block renders null when false.
   */
  isIssuer: boolean;

  /**
   * Called when the user confirms a close action.
   * @param seal  true → close + seal; false/undefined → close only
   */
  onCloseInvoice: (seal?: boolean) => Promise<void>;

  /**
   * When true, the "Close & Seal" button is rendered alongside "Close Invoice".
   * Typically derived from `await majik.canSealInvoice(invoice)`.
   */
  canSeal?: boolean;

  /**
   * The exact phrase the user must type to confirm a seal.
   * Defaults to "SEAL MY INVOICE".
   */
  sealConfirmText?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const IssuerCloseBlockInner: React.FC<IssuerCloseBlockProps> = ({
  invoice,
  isIssuer,
  onCloseInvoice,
  canSeal = false,
  sealConfirmText = "SEAL MY INVOICE",
}) => {
  const [busyClose, setBusyClose] = useState(false);
  const [busySeal, setBusySeal] = useState(false);
  const [closeModalOpen, setCloseModalOpen] = useState(false);
  const [sealModalOpen, setSealModalOpen] = useState(false);
  const [feedback, setFeedback] = useState<{ msg: string; ok: boolean } | null>(
    null,
  );

  // ── Visibility gate ───────────────────────────────────────────────────────

  const isVisible = useMemo(
    () => isIssuer && invoice.isFullySigned && !invoice.isSealed,
    [isIssuer, invoice.isFullySigned, invoice.isSealed],
  );

  if (!isVisible) return null;

  // ── Pending signers summary (for context strip) ───────────────────────────

  const pendingCount = invoice.pendingSigners.length;
  const signerCount = invoice.integrity.signatures?.length ?? 0;

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleCloseConfirm = useCallback(async () => {
    setBusyClose(true);
    setFeedback(null);
    try {
      await onCloseInvoice(false);
      setFeedback({ msg: "Invoice closed successfully.", ok: true });
      setCloseModalOpen(false);
    } catch (err) {
      setFeedback({
        msg: err instanceof Error ? err.message : "Failed to close invoice.",
        ok: false,
      });
    } finally {
      setBusyClose(false);
    }
  }, [onCloseInvoice]);

  const handleSealConfirm = useCallback(async () => {
    setBusySeal(true);
    setFeedback(null);
    try {
      await onCloseInvoice(true);
      setFeedback({
        msg: "Invoice closed and sealed — permanently immutable.",
        ok: true,
      });
      setSealModalOpen(false);
    } catch (err) {
      setFeedback({
        msg:
          err instanceof Error
            ? err.message
            : "Failed to close and seal invoice.",
        ok: false,
      });
    } finally {
      setBusySeal(false);
    }
  }, [onCloseInvoice]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <Block aria-label="Issuer close actions">
        <AccentBar />
        <Inner>
          {/* Header */}
          <Header>
            <HeaderIcon>
              <ArchiveIcon size={16} weight="duotone" />
            </HeaderIcon>
            <HeaderText>
              <Title>Close this Invoice</Title>
              <Subtitle>
                All required signatures are in place. You may now close this
                invoice
                {canSeal
                  ? " or permanently seal it against further changes"
                  : ""}
                .
              </Subtitle>
            </HeaderText>
          </Header>

          {/* Fully signed status strip */}
          <StatusStrip>
            <CheckCircleIcon size={13} weight="fill" />
            {signerCount} signature{signerCount !== 1 ? "s" : ""} recorded
            {pendingCount === 0 ? " — all expected signers have signed" : ""}
          </StatusStrip>

          {/* Action buttons */}
          {canSeal ? (
            <ActionsRow>
              <CloseButton
                $busy={busyClose}
                disabled={busyClose || busySeal}
                onClick={() => setCloseModalOpen(true)}
                aria-label="Close invoice without sealing"
              >
                {busyClose ? (
                  <>
                    <ArrowClockwiseIcon size={14} className="spinning" />
                    Closing…
                  </>
                ) : (
                  <>
                    <FileTextIcon size={14} weight="duotone" />
                    Close Invoice
                  </>
                )}
              </CloseButton>

              <SealButton
                $busy={busySeal}
                disabled={busyClose || busySeal}
                onClick={() => setSealModalOpen(true)}
                aria-label="Close and seal invoice permanently"
              >
                {busySeal ? (
                  <>
                    <ArrowClockwiseIcon size={14} className="spinning" />
                    Sealing…
                  </>
                ) : (
                  <>
                    <SealIcon size={14} weight="fill" />
                    Close &amp; Seal
                  </>
                )}
              </SealButton>
            </ActionsRow>
          ) : (
            <SingleActionRow>
              <CloseButton
                $busy={busyClose}
                disabled={busyClose}
                onClick={() => setCloseModalOpen(true)}
                aria-label="Close invoice"
                style={{ flex: 1 }}
              >
                {busyClose ? (
                  <>
                    <ArrowClockwiseIcon size={14} className="spinning" />
                    Closing…
                  </>
                ) : (
                  <>
                    <FileTextIcon size={14} weight="duotone" />
                    Close Invoice
                  </>
                )}
              </CloseButton>
            </SingleActionRow>
          )}

          <DynamicAlertBanner
            level="warning"
            title="Cloud access and local storage changes"
            description={
              `• The cloud copy of this invoice will be deleted\n` +
              `• Recipients will no longer be able to access this invoice\n` +
              `• Your locally stored invoice will be updated with the current finalized version\n` +
              `• If this invoice does not already exist locally, a new archived copy will be created automatically` +
              (canSeal
                ? `\n• Close & Seal additionally applies a permanent cryptographic seal`
                : "")
            }
          />

          {/* Disclaimer */}
          <Disclaimer>
            <LockKeyIcon size={12} />
            Closed invoices are archived locally for audit and recordkeeping
            purposes.
          </Disclaimer>

          {/* Feedback */}
          {feedback && (
            <FeedbackBanner $ok={feedback.ok}>
              {feedback.ok ? (
                <CheckCircleIcon size={12} weight="fill" />
              ) : (
                <XCircleIcon size={12} weight="fill" />
              )}
              {feedback.msg}
            </FeedbackBanner>
          )}
        </Inner>
      </Block>

      {/* ── Close-only confirm modal ── */}
      <CloseConfirmModal
        isOpen={closeModalOpen}
        isBusy={busyClose}
        onOpenChange={setCloseModalOpen}
        onConfirm={handleCloseConfirm}
      />

      {/* ── Close & Seal confirm modal ── */}
      {canSeal && (
        <SealConfirmModal
          isOpen={sealModalOpen}
          confirmPhrase={sealConfirmText}
          isBusy={busySeal}
          onOpenChange={setSealModalOpen}
          onConfirm={handleSealConfirm}
        />
      )}
    </>
  );
};

/**
 * Memoized: invoice identity + isIssuer + canSeal are stable across the
 * parent's debounced edit cycle, so memo meaningfully reduces re-renders.
 */
export const IssuerCloseBlock = memo(IssuerCloseBlockInner);

export default IssuerCloseBlock;
