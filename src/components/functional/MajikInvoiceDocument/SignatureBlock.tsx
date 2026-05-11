"use client";

/**
 * SignatureBlock.tsx
 *
 * A prominent, full-width signature CTA block rendered at the bottom of
 * MajikInvoiceDocument. Visible only when:
 *   - canSign === true
 *   - onSign is provided
 *
 * Features:
 *   - Displays the signing account/key identity so the user knows which
 *     key will be used.
 *   - Thick, unmissable CTA button — this is the primary action.
 *   - Unique DOM id `majik-signature-block` for programmatic scroll/focus.
 *   - Memoized with React.memo: the block is expensive-ish to render and its
 *     props are stable references passed down from InvoicePanel, so memo
 *     prevents spurious re-renders caused by the parent's debounced edit cycle.
 */

import React, { memo, useState } from "react";
import styled, { css, keyframes } from "styled-components";
import {
  PenNibIcon,
  ShieldCheckIcon,
  WarningCircleIcon,
  CheckCircleIcon,
  LockKeyIcon,
  UserIcon,
  FingerprintIcon,
} from "@phosphor-icons/react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SignerInfo {
  /** Human-readable display name (e.g. account alias or org name) */
  displayName?: string;
  /** Short fingerprint / signer ID shown in mono */
  signerId: string;
  /** Optional algorithm label, e.g. "Ed25519 + ML-DSA-87" */
  algorithm?: string;
}

export interface SignatureBlockProps {
  /** Whether signing is permitted right now */
  canSign?: boolean;
  /** Async sign handler — throws on failure */
  onSign?: () => Promise<void>;
  /** Info about the key/account that will be used to sign */
  signerInfo?: SignerInfo;
  /** Optional label override for the button */
  signLabel?: string;
}

// ---------------------------------------------------------------------------
// Animations
// ---------------------------------------------------------------------------

const pulseRing = keyframes`
  0%   { box-shadow: 0 0 0 0 var(--pulse-color, rgba(99,102,241,0.35)); }
  70%  { box-shadow: 0 0 0 12px transparent; }
  100% { box-shadow: 0 0 0 0 transparent; }
`;

const shimmer = keyframes`
  0%   { background-position: -200% center; }
  100% { background-position:  200% center; }
`;

const fadeSlideUp = keyframes`
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
`;

// ---------------------------------------------------------------------------
// Styled
// ---------------------------------------------------------------------------

const Block = styled.section`
  id: majik-signature-block; /* fallback — real id set as HTML attr */
  margin-top: 2rem;
  border-radius: ${({ theme }) => theme.borders.radius.big};
  border: 1.5px solid ${({ theme }) => theme.colors.primary}33;
  background: ${({ theme }) => theme.colors.secondaryBackground};
  overflow: hidden;
  animation: ${fadeSlideUp} 0.35s ease both;
  position: relative;
`;

/* Top accent bar */
const AccentBar = styled.div`
  height: 3px;
  width: 100%;
  background: linear-gradient(
    90deg,
    ${({ theme }) => theme.colors.primary}00 0%,
    ${({ theme }) => theme.colors.primary} 40%,
    ${({ theme }) => theme.colors.primary}cc 100%
  );
  background-size: 200% auto;
  animation: ${shimmer} 3s linear infinite;
`;

const Inner = styled.div`
  padding: 1.75rem 2rem 2rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
`;

/* ── Header row ── */
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

/* ── Signer identity card ── */
const SignerCard = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0.875rem 1.125rem;
  border-radius: ${({ theme }) => theme.borders.radius.medium};
  background: ${({ theme }) => theme.colors.primaryBackground};
  border: 1px solid ${({ theme }) => theme.colors.primary}1a;
`;

const SignerAvatar = styled.div`
  width: 36px;
  height: 36px;
  border-radius: ${({ theme }) => theme.borders.radius.medium};
  background: ${({ theme }) => theme.colors.primarySoft};
  border: 1px solid ${({ theme }) => theme.colors.primary}22;
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${({ theme }) => theme.colors.primary};
  flex-shrink: 0;
`;

const SignerMeta = styled.div`
  flex: 1;
  min-width: 0;
`;

const SignerName = styled.div`
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textPrimary};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const SignerFingerprint = styled.div`
  display: flex;
  align-items: center;
  gap: 5px;
  font-family: ${({ theme }) => theme.typography.fonts.numbers};
  font-size: 10px;
  color: ${({ theme }) => theme.colors.textSecondary};
  margin-top: 2px;
  letter-spacing: 0.03em;
`;

const AlgoBadge = styled.span`
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  font-size: 9.5px;
  padding: 2px 7px;
  border-radius: ${({ theme }) => theme.borders.radius.rounded};
  background: ${({ theme }) => theme.colors.primarySoft};
  color: ${({ theme }) => theme.colors.primary};
  border: 1px solid ${({ theme }) => theme.colors.primary}22;
  white-space: nowrap;
  flex-shrink: 0;
`;

/* ── CTA row ── */
const CtaRow = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;

  @media (max-width: ${({ theme }) => theme.breakpoints.tablet}) {
    flex-direction: column;
    align-items: stretch;
  }
`;

const SignButton = styled.button<{ $busy: boolean }>`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 9px;

  /* Thick — visually dominant */
  padding: 0.9rem 1.75rem;
  border-radius: ${({ theme }) => theme.borders.radius.medium};
  border: none;
  cursor: ${({ $busy }) => ($busy ? "wait" : "pointer")};

  font-family: ${({ theme }) => theme.typography.fonts.semibold};
  font-size: 14px;
  letter-spacing: 0.02em;
  color: #fff;

  background: ${({ theme }) => theme.colors.primary};
  position: relative;
  overflow: hidden;
  transition:
    opacity 0.18s ease,
    transform 0.14s ease,
    box-shadow 0.18s ease;

  /* Shimmer overlay on idle */
  &::before {
    content: "";
    position: absolute;
    inset: 0;
    background: linear-gradient(
      105deg,
      transparent 40%,
      rgba(255, 255, 255, 0.12) 50%,
      transparent 60%
    );
    background-size: 200% auto;
    animation: ${shimmer} 2.8s linear infinite;
    pointer-events: none;
  }

  &:hover:not(:disabled) {
    opacity: 0.92;
    transform: translateY(-1px);
    box-shadow: 0 6px 20px ${({ theme }) => theme.colors.primary}44;
    --pulse-color: ${({ theme }) => theme.colors.primary}55;
    animation: ${pulseRing} 1s ease-out infinite;
  }

  &:active:not(:disabled) {
    transform: translateY(0);
    box-shadow: none;
  }

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
    &::before {
      display: none;
    }
  }

  ${({ $busy }) =>
    $busy &&
    css`
      pointer-events: none;
    `}
`;

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

/* ── Feedback banner ── */
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
// Component
// ---------------------------------------------------------------------------

export const SIGNATURE_BLOCK_ID = "majik-signature-block";

/**
 * Scroll to the SignatureBlock from anywhere:
 *   document.getElementById(SIGNATURE_BLOCK_ID)?.scrollIntoView({ behavior: "smooth" })
 */

const SignatureBlockInner: React.FC<SignatureBlockProps> = ({
  canSign = false,
  onSign,
  signerInfo,
  signLabel = "Sign Invoice",
}) => {
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ msg: string; ok: boolean } | null>(
    null,
  );

  const handleSign = async () => {
    if (!canSign || busy) return;
    setBusy(true);
    setFeedback(null);
    try {
      await onSign?.();
      setFeedback({
        msg: "Signed — Ed25519 + ML-DSA-87 signature attached.",
        ok: true,
      });
    } catch (err) {
      setFeedback({
        msg: err instanceof Error ? err.message : "Signing failed.",
        ok: false,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Block id={SIGNATURE_BLOCK_ID} aria-label="Invoice signature block">
      <AccentBar />
      <Inner>
        {/* Header */}
        <Header>
          <HeaderIcon>
            <PenNibIcon size={16} weight="duotone" />
          </HeaderIcon>
          <HeaderText>
            <Title>Sign this Invoice</Title>
            <Subtitle>
              Review the document above, then apply your cryptographic
              signature. This action is recorded and verifiable.
            </Subtitle>
          </HeaderText>
        </Header>

        {/* Signer identity */}
        {signerInfo && (
          <SignerCard>
            <SignerAvatar>
              <UserIcon size={16} weight="duotone" />
            </SignerAvatar>
            <SignerMeta>
              {signerInfo.displayName && (
                <SignerName data-private>{signerInfo.displayName}</SignerName>
              )}
              <SignerFingerprint data-private>
                <FingerprintIcon size={10} />
                {signerInfo.signerId}
              </SignerFingerprint>
            </SignerMeta>
            {signerInfo.algorithm && (
              <AlgoBadge>{signerInfo.algorithm}</AlgoBadge>
            )}
          </SignerCard>
        )}

        {/* CTA */}
        <CtaRow>
          <SignButton
            onClick={handleSign}
            disabled={!canSign || busy}
            $busy={busy}
            aria-label={busy ? "Signing in progress" : signLabel}
          >
            {busy ? (
              <>
                <ShieldCheckIcon size={16} weight="fill" />
                Signing…
              </>
            ) : (
              <>
                <PenNibIcon size={16} weight="fill" />
                {signLabel}
              </>
            )}
          </SignButton>
        </CtaRow>

        {/* Legal disclaimer */}
        <Disclaimer>
          <LockKeyIcon size={12} />
          By signing, you confirm that you have reviewed this invoice and that
          your digital signature — using{" "}
          {signerInfo?.algorithm ?? "Ed25519 + ML-DSA-87"} — constitutes a
          legally binding cryptographic attestation of its contents.
        </Disclaimer>

        {/* Feedback */}
        {feedback && (
          <FeedbackBanner $ok={feedback.ok}>
            {feedback.ok ? (
              <CheckCircleIcon size={12} weight="fill" />
            ) : (
              <WarningCircleIcon size={12} weight="fill" />
            )}
            {feedback.msg}
          </FeedbackBanner>
        )}
      </Inner>
    </Block>
  );
};

/**
 * Memoized: props (canSign, onSign, signerInfo) are stable references from the
 * parent panel, so memoization meaningfully prevents re-renders during the
 * parent's debounced invoice-edit cycle.
 */
export const SignatureBlock = memo(SignatureBlockInner);
