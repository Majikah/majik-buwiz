/**
 * sections/MismatchBanner.tsx
 *
 * Shown when the local signing key doesn't match the MUID-bound key.
 * Accepts only the derived values it needs — no raw uid/currentAccount refs.
 */

import React from "react";
import styled, { keyframes } from "styled-components";
import {
  ArrowsClockwiseIcon,
  TrashIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";
import { LogOutIcon } from "lucide-react";
import { CtrlBtn } from "@/globals/buttons";

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
`;

const Banner = styled.div`
  margin: 8px 0 4px;
  background: rgba(239, 68, 68, 0.06);
  border: 1px solid rgba(239, 68, 68, 0.22);
  border-radius: 12px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  animation: ${fadeIn} 0.2s ease;
`;

const Top = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 10px;
`;

const IconBox = styled.div`
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: rgba(239, 68, 68, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ef4444;
  flex-shrink: 0;
`;

const TextBlock = styled.div`
  flex: 1;
  min-width: 0;
`;

const Title = styled.div`
  font-size: 11px;
  font-weight: 700;
  color: #ef4444;
  margin-bottom: 2px;
`;

const Hint = styled.div`
  font-size: 10px;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.7;
  line-height: 1.5;
`;

const FingerprintRow = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 5px;
`;

const FingerprintChip = styled.div`
  background: ${({ theme }) => theme.colors.primaryBackground};
  border-radius: 7px;
  padding: 5px 8px;
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const FingerprintLabel = styled.span`
  font-size: 8px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.4;
`;

const FingerprintValue = styled.span`
  font-family: "Fira Mono", "JetBrains Mono", monospace;
  font-size: 9px;
  color: ${({ theme }) => theme.colors.textPrimary};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  opacity: 0.8;
`;

const WarningBox = styled.div`
  background: rgba(245, 158, 11, 0.07);
  border: 1px solid rgba(245, 158, 11, 0.2);
  border-radius: 8px;
  padding: 7px 10px;
  font-size: 10px;
  color: #f59e0b;
  line-height: 1.5;
  display: flex;
  gap: 7px;
  align-items: flex-start;
`;

const CtrlBtnRow = styled.div`
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
`;

// ─── Props / Component ─────────────────────────────────────────────────────────

interface MismatchBannerProps {
  localFingerprint: string;
  muidFingerprint: string;
  isVerified: boolean;
  canRevoke: boolean;
  onSwitchKey: () => void;
  onDeleteUID: () => void;
  onSignOut: () => void;
}

export const MismatchBanner: React.FC<MismatchBannerProps> = React.memo(
  ({
    localFingerprint,
    muidFingerprint,
    isVerified,
    canRevoke,
    onSwitchKey,
    onDeleteUID,
    onSignOut,
  }) => (
    <Banner>
      <Top>
        <IconBox>
          <WarningCircleIcon size={16} weight="fill" />
        </IconBox>
        <TextBlock>
          <Title>Key mismatch detected</Title>
          <Hint>
            Your local signing key doesn't match the key bound to your MUID.
            Invoices, sealed files, and exchange messages signed with the wrong
            key will fail verification.
          </Hint>
        </TextBlock>
      </Top>

      <FingerprintRow>
        <FingerprintChip>
          <FingerprintLabel>Local Key</FingerprintLabel>
          <FingerprintValue title={localFingerprint} data-private>
            {localFingerprint}
          </FingerprintValue>
        </FingerprintChip>
        <FingerprintChip>
          <FingerprintLabel>MUID Bound Key</FingerprintLabel>
          <FingerprintValue title={muidFingerprint} data-private>
            {muidFingerprint}
          </FingerprintValue>
        </FingerprintChip>
      </FingerprintRow>

      <WarningBox>
        <WarningCircleIcon
          size={13}
          weight="fill"
          style={{ flexShrink: 0, marginTop: 1 }}
        />
        <span>
          Exchange and relay operations require your local key to match your
          MUID's bound signing key. Mismatched keys will cause invoice signing
          and encryption failures.
        </span>
      </WarningBox>

      <CtrlBtnRow>
        <CtrlBtn $variant="primary" onClick={onSwitchKey}>
          <ArrowsClockwiseIcon size={11} /> Switch to Matching Key
        </CtrlBtn>
        {canRevoke && (
          <CtrlBtn $variant="danger" onClick={onDeleteUID}>
            <TrashIcon size={11} />
            {isVerified ? "Revoke & Re-register" : "Delete & Re-register"}
          </CtrlBtn>
        )}
        <CtrlBtn $variant="ghost" onClick={onSignOut}>
          <LogOutIcon size={11} />
          Log Out
        </CtrlBtn>
      </CtrlBtnRow>
    </Banner>
  ),
);

MismatchBanner.displayName = "MismatchBanner";
