/**
 * IntegrityPanel.tsx
 *
 * Self-contained integrity panel for MajikInvoiceDocument (majik mode only).
 * Renders:
 *  - Mode / status / sig count / seal stats grid
 *  - Content hash
 *  - Seal info (when sealed)
 *  - Signature list
 *  - Pending signers
 *  - Feedback banner
 *  - Crypto controls (sign, seal, verify, decrypt/lock, PDF export)
 *
 * All async handlers are invoked by the parent and passed down — this
 * component has no network/crypto knowledge itself.
 */

import React, { useCallback, useState } from "react";
import styled from "styled-components";
import {
  CheckCircleIcon,
  FilePdfIcon,
  LockKeyIcon,
  PenNibIcon,
  ShieldCheckIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";
import type { MajikInvoice } from "@majikah/majik-invoice";
import { CtrlBtn } from "@/globals/buttons";

// ---------------------------------------------------------------------------
// Styled
// ---------------------------------------------------------------------------

const Panel = styled.div`
  border: 1px solid ${({ theme }) => theme.colors.primary}22;
  border-radius: ${({ theme }) => theme.borders.radius.big};
  padding: 1.25rem 1.5rem;
  margin-top: ${({ theme }) => theme.spacing.medium};
  background: ${({ theme }) => theme.colors.secondaryBackground};
`;

const PanelTitle = styled.div`
  font-family: ${({ theme }) => theme.typography.fonts.semibold};
  font-size: 11px;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.primary};
  margin-bottom: ${({ theme }) => theme.spacing.medium};
  display: flex;
  align-items: center;
  gap: 8px;
`;

const IntegrityGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: ${({ theme }) => theme.spacing.medium};
  margin-bottom: ${({ theme }) => theme.spacing.medium};
`;

const StatCell = styled.div``;

const StatLabel = styled.div`
  font-family: ${({ theme }) => theme.typography.fonts.light};
  font-size: 10px;
  letter-spacing: 0.04em;
  color: ${({ theme }) => theme.colors.textSecondary};
  margin-bottom: 4px;
`;

const StatValue = styled.div`
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textPrimary};
`;

const MonoText = styled.span`
  font-family: ${({ theme }) => theme.typography.fonts.numbers};
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textSecondary};
  letter-spacing: 0.02em;
  word-break: break-all;
`;

const SigList = styled.div`
  margin-bottom: ${({ theme }) => theme.spacing.small};
`;

const SigRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 9px 0;
  border-bottom: 1px solid ${({ theme }) => theme.colors.primary}12;
  font-size: 12px;
  gap: 12px;

  &:last-child {
    border-bottom: none;
  }
`;

const SigLeft = styled.div`
  flex: 1;
  min-width: 0;
`;

const SigLabel = styled.div`
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textPrimary};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const SigMeta = styled.div`
  font-family: ${({ theme }) => theme.typography.fonts.numbers};
  font-size: 10px;
  color: ${({ theme }) => theme.colors.textSecondary};
  margin-top: 2px;
`;

const SigRight = styled.div`
  text-align: right;
  flex-shrink: 0;
`;

const SigTime = styled.div`
  font-family: ${({ theme }) => theme.typography.fonts.light};
  font-size: 10px;
  color: ${({ theme }) => theme.colors.textSecondary};
  margin-top: 3px;
`;

const ValidBadge = styled.span`
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  font-size: 10px;
  padding: 2px 8px;
  border-radius: ${({ theme }) => theme.borders.radius.rounded};
  background: ${({ theme }) => theme.colors.brand.green}18;
  color: ${({ theme }) => theme.colors.brand.green};
  display: inline-flex;
  align-items: center;
  gap: 4px;
`;

const PendingWrap = styled.div`
  margin-bottom: ${({ theme }) => theme.spacing.small};
`;

const PendingLabel = styled.div`
  font-size: 10px;
  color: ${({ theme }) => theme.colors.textSecondary};
  margin-bottom: 5px;
`;

const PendingChips = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
`;

const PendingChip = styled.span`
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  font-size: 10px;
  padding: 3px 9px;
  border-radius: ${({ theme }) => theme.borders.radius.rounded};
  background: ${({ theme }) => theme.colors.primarySoft};
  color: ${({ theme }) => theme.colors.primary};
  border: 1px solid ${({ theme }) => theme.colors.primary}33;
`;

const EmptyNote = styled.div`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.5;
  padding: 4px 0;
`;

const FeedbackBanner = styled.div<{ $ok: boolean }>`
  font-family: ${({ theme }) => theme.typography.fonts.regular};
  font-size: 11px;
  margin-top: ${({ theme }) => theme.spacing.small};
  padding: 7px 12px;
  border-radius: ${({ theme }) => theme.borders.radius.small};
  display: flex;
  align-items: center;
  gap: 7px;
  color: ${({ theme, $ok }) =>
    $ok ? theme.colors.brand.green : theme.colors.error};
  background: ${({ theme, $ok }) =>
    $ok ? `${theme.colors.brand.green}0e` : `${theme.colors.error}0e`};
  border: 1px solid
    ${({ theme, $ok }) =>
      $ok ? `${theme.colors.brand.green}28` : `${theme.colors.error}28`};
`;

const CryptoControls = styled.div`
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: ${({ theme }) => theme.spacing.medium};
  padding-top: ${({ theme }) => theme.spacing.medium};
  border-top: 1px solid ${({ theme }) => theme.colors.primary}12;
`;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface IntegrityPanelProps {
  invoice: MajikInvoice;
  readonly: boolean;
  /** True when the parent's PDF export dialog should be opened. */
  onRequestPDFExport: () => void;
  onSign?: () => Promise<void>;
  onSeal?: () => Promise<void>;
  onVerify?: () => Promise<void>;
  onDecrypt?: () => Promise<void>;
  onSecureLock?: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const IntegrityPanel: React.FC<IntegrityPanelProps> = React.memo(
  ({
    invoice,
    readonly,
    onRequestPDFExport,
    onSign,
    onSeal,
    onVerify,
    onDecrypt,
    onSecureLock,
  }) => {
    const [busy, setBusy] = useState<string | null>(null);
    const [feedback, setFeedback] = useState<{
      msg: string;
      ok: boolean;
    } | null>(null);

    const isSealed = invoice.isSealed;

    // Capability flags derived locally — same logic as the parent had
    const canSealNow = !!onSeal && !isSealed && !!invoice.isSigned;
    const canDecryptNow =
      !!onDecrypt && !!invoice.isEncrypted && !invoice.hasDecryptedCache;

    // ── Feedback ─────────────────────────────────────────────────────────────

    const fb = useCallback((msg: string, ok: boolean) => {
      setFeedback({ msg, ok });
      setTimeout(() => setFeedback(null), 6000);
    }, []);

    // ── Action wrappers ───────────────────────────────────────────────────────

    const handleSign = useCallback(async () => {
      if (!onSign) return;
      setBusy("sign");
      try {
        await onSign();
        fb("Signed successfully — Ed25519 + ML-DSA-87.", true);
      } catch (err) {
        fb(err instanceof Error ? err.message : "Sign failed.", false);
      } finally {
        setBusy(null);
      }
    }, [onSign, fb]);

    const handleSeal = useCallback(async () => {
      if (!onSeal) return;
      setBusy("seal");
      try {
        await onSeal();
        fb(
          "Invoice sealed — immutable. No further signatures permitted.",
          true,
        );
      } catch (err) {
        fb(err instanceof Error ? err.message : "Seal failed.", false);
      } finally {
        setBusy(null);
      }
    }, [onSeal, fb]);

    const handleVerify = useCallback(async () => {
      if (invoice.integrity.signatures.length === 0) {
        fb("No signatures to verify.", false);
        return;
      }
      setBusy("verify");
      try {
        await onVerify?.();
        fb("Verification complete.", true);
      } catch (err) {
        fb(err instanceof Error ? err.message : "Verification failed.", false);
      } finally {
        setBusy(null);
      }
    }, [invoice.integrity.signatures.length, onVerify, fb]);

    const handleDecrypt = useCallback(async () => {
      if (!onDecrypt) return;
      setBusy("decrypt");
      try {
        await onDecrypt();
        fb("Decrypted — line items now visible.", true);
      } catch (err) {
        fb(err instanceof Error ? err.message : "Decryption failed.", false);
      } finally {
        setBusy(null);
      }
    }, [onDecrypt, fb]);

    const handleLockEncrypt = useCallback(async () => {
      if (!onSecureLock) return;
      setBusy("lock");
      try {
        await onSecureLock();
        fb("Locked and encrypted — invoice now secured.", true);
      } catch (err) {
        fb(err instanceof Error ? err.message : "Locking failed.", false);
      } finally {
        setBusy(null);
      }
    }, [onSecureLock, fb]);

    // ── Shared crypto controls — rendered in both edit and sealed/readonly modes
    const encryptionControl = invoice.isEncrypted ? (
      !invoice.hasDecryptedCache ? (
        <CtrlBtn
          onClick={handleDecrypt}
          disabled={!canDecryptNow || busy === "decrypt"}
        >
          <LockKeyIcon size={13} />
          {busy === "decrypt" ? "Decrypting…" : "Decrypt"}
        </CtrlBtn>
      ) : (
        <CtrlBtn onClick={handleLockEncrypt} disabled={busy === "lock"}>
          <LockKeyIcon size={13} />
          {busy === "lock" ? "Locking…" : "Secure Lock"}
        </CtrlBtn>
      )
    ) : null;

    const verifyControl = (
      <CtrlBtn
        $variant="success"
        onClick={handleVerify}
        disabled={
          invoice.integrity.signatures.length === 0 || busy === "verify"
        }
      >
        <ShieldCheckIcon size={13} />
        {busy === "verify" ? "Verifying…" : "Verify signatures"}
      </CtrlBtn>
    );

    const pdfControl = (
      <CtrlBtn onClick={onRequestPDFExport} disabled={busy === "pdf"}>
        <FilePdfIcon size={13} />
        {busy === "pdf" ? "Exporting…" : "Export PDF"}
      </CtrlBtn>
    );

    // ── Render ────────────────────────────────────────────────────────────────

    return (
      <Panel>
        <PanelTitle>
          <ShieldCheckIcon size={14} weight="fill" />
          Integrity — MajikInvoice
        </PanelTitle>

        {/* Stats grid */}
        <IntegrityGrid>
          <StatCell>
            <StatLabel>Mode</StatLabel>
            <StatValue data-private>{invoice.mode}</StatValue>
          </StatCell>
          <StatCell>
            <StatLabel>Status</StatLabel>
            <StatValue data-private>{invoice.integrityStatus}</StatValue>
          </StatCell>
          <StatCell>
            <StatLabel>Signatures</StatLabel>
            <StatValue data-private>
              {invoice.signatureCount === 0
                ? "none"
                : `${invoice.signatureCount} attached`}
              {invoice.isFullySigned &&
                invoice.signatureCount > 0 &&
                " — complete"}
            </StatValue>
          </StatCell>
          <StatCell>
            <StatLabel>Seal</StatLabel>
            <StatValue data-private>
              {isSealed
                ? `sealed${
                    invoice.integrity.sealInfo?.sealTimestamp
                      ? ` · ${new Date(
                          invoice.integrity.sealInfo.sealTimestamp,
                        ).toLocaleDateString()}`
                      : ""
                  }`
                : "unsealed"}
            </StatValue>
          </StatCell>
          <StatCell style={{ gridColumn: "1 / -1" }}>
            <StatLabel>Content hash (SHA-256)</StatLabel>
            <MonoText data-private>{invoice.integrity.contentHash}</MonoText>
          </StatCell>
          {isSealed && invoice.integrity.sealInfo && (
            <>
              <StatCell style={{ gridColumn: "1 / -1" }}>
                <StatLabel>Sealed by</StatLabel>
                <MonoText data-private>
                  {invoice.integrity.sealInfo.sealedBy}
                </MonoText>
              </StatCell>
              <StatCell style={{ gridColumn: "1 / -1" }}>
                <StatLabel>Seal Hash (SHA3-512)</StatLabel>
                <MonoText data-private>
                  {invoice.integrity.sealInfo.sealHash}
                </MonoText>
              </StatCell>
            </>
          )}
        </IntegrityGrid>

        {/* Signature list */}
        <StatLabel style={{ marginBottom: 6 }}>Signatures</StatLabel>
        <SigList>
          {invoice.integrity.signatures.length === 0 ? (
            <EmptyNote>No signatures attached yet.</EmptyNote>
          ) : (
            invoice.integrity.signatures.map((sig, i) => (
              <SigRow key={i}>
                <SigLeft>
                  <SigLabel data-private>{sig.signerId}</SigLabel>
                  <SigMeta data-private>
                    {(sig as any).algorithm ?? "Ed25519 + ML-DSA-87"} · hash:{" "}
                    {sig.contentHash}
                  </SigMeta>
                </SigLeft>
                <SigRight>
                  <ValidBadge>
                    <CheckCircleIcon size={10} weight="fill" /> signed
                  </ValidBadge>
                  <SigTime data-private>
                    {new Date(sig.timestamp).toLocaleString()}
                  </SigTime>
                </SigRight>
              </SigRow>
            ))
          )}
        </SigList>

        {/* Pending signers */}
        {invoice.pendingSigners.length > 0 && (
          <PendingWrap>
            <PendingLabel>
              Awaiting signatures ({invoice.pendingSigners.length} remaining):
            </PendingLabel>
            <PendingChips>
              {invoice.pendingSigners.map((ps) => (
                <PendingChip key={ps.signerId} data-private>
                  {ps.signerId}
                </PendingChip>
              ))}
            </PendingChips>
          </PendingWrap>
        )}

        {/* Feedback banner */}
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

        {/* Crypto controls — editable (not readonly, not sealed) */}
        {!readonly && !isSealed && (
          <CryptoControls>
            <CtrlBtn onClick={handleSign} disabled={busy === "sign"}>
              <PenNibIcon size={13} />
              {busy === "sign" ? "Signing…" : "Re-sign"}
            </CtrlBtn>

            <CtrlBtn
              $variant="primary"
              onClick={handleSeal}
              disabled={!canSealNow || busy === "seal"}
            >
              <LockKeyIcon size={13} />
              {busy === "seal" ? "Sealing…" : "Seal"}
            </CtrlBtn>

            {verifyControl}
            {encryptionControl}
            {pdfControl}
          </CryptoControls>
        )}

        {/* Crypto controls — sealed / readonly (verify + decrypt/lock + pdf only) */}
        {(readonly || isSealed) && (
          <CryptoControls>
            {verifyControl}
            {encryptionControl}
            {pdfControl}
          </CryptoControls>
        )}
      </Panel>
    );
  },
);

IntegrityPanel.displayName = "IntegrityPanel";

export default IntegrityPanel;
