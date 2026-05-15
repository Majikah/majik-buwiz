/**
 * sections/MUIDDetailView.tsx
 *
 * Renders the full MUID detail: hero card, verification CTA, delete card,
 * public profile, private info, verification stages, bound key, identity hash.
 *
 * Memoized — only re-renders when uid, privateInfo, sessionStatus, or
 * verificationUrl change.  Username edit state is fully internal.
 */

import React, { useCallback, useState } from "react";
import styled, { keyframes, css } from "styled-components";
import { toast } from "sonner";
import { open } from "@tauri-apps/plugin-shell";
import {
  ArrowsClockwiseIcon,
  ArrowSquareOutIcon,
  CalendarIcon,
  CheckCircleIcon,
  ClockIcon,
  CopyIcon,
  EnvelopeIcon,
  GlobeIcon,
  IdentificationCardIcon,
  LockKeyIcon,
  LockOpenIcon,
  MapPinIcon,
  PencilSimpleIcon,
  PhoneIcon,
  ShieldCheckIcon,
  ShieldWarningIcon,
  SpinnerIcon,
  TrashIcon,
  UserIcon,
  WarningCircleIcon,
  XCircleIcon,
} from "@phosphor-icons/react";

import {
  DiditStage,
  IDTier,
  MajikUniversalID,
  type PrivatePersonalInfo,
} from "@majikah/majik-universal-id";
import { MajikBuwizDatabase } from "@/components/majik-context-wrapper/majik-buwiz-database";
import UserAvatar from "@/components/functional/UserAvatar";
import { useValidatedImage } from "@/utils/use-validated-image";

import {
  ALL_STAGES,
  ACTIVE_SESSION_STATUSES,
  STAGE_LABELS,
  REVOKE_LOCKOUT_MS,
  SpinIcon,
  Card,
  FieldRow,
  FieldIcon,
  FieldContent,
  FieldLabel,
  FieldValue,
  FieldMono,
  FieldCopyBtn,
  EmptyField,
  SectionWrap,
  SectionHead,
  SectionTitle,
  SectionAction,
  tierGradient,
} from "../../shared/atoms";
import GuideHelper from "@/components/functional/GuideHelper";

// ─── Local styled ──────────────────────────────────────────────────────────────

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
`;

const glowPulse = keyframes`
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.45; }
`;

const HeroCard = styled.div`
  margin: 3px 0 8px;
  padding: 12px;
  gap: 8px;
  background: ${({ theme }) => theme.colors.secondaryBackground};
  border-radius: 16px;
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
  animation: ${fadeIn} 0.25s ease;
  &::before {
    content: "";
    position: absolute;
    inset: 0;
    background: radial-gradient(
      circle at 80% -10%,
      ${({ theme }) => `${theme.colors.primary || "#E05C1A"}18`} 0%,
      transparent 65%
    );
    pointer-events: none;
  }
`;

const HeroTop = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
`;

const HeroLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 0;
`;

const HeroMeta = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const HeroName = styled.h3`
  font-size: 15px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textPrimary};
  margin: 0;
  letter-spacing: -0.02em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const HeroID = styled.span`
  font-family: "Fira Mono", "JetBrains Mono", monospace;
  font-size: 9px;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.4;
`;

const TierBadge = styled.div<{ $tier: string }>`
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  padding: 5px 10px;
  border-radius: 20px;
  flex-shrink: 0;
  background: ${({ $tier, theme }) =>
    $tier === "trusted"
      ? "rgba(34,197,94,0.12)"
      : $tier === "enhanced"
        ? theme.colors.primarySoft
        : $tier === "verified"
          ? "rgba(59,130,246,0.12)"
          : $tier === "basic"
            ? "rgba(245,158,11,0.12)"
            : "rgba(156,163,175,0.1)"};
  color: ${({ $tier, theme }) =>
    $tier === "trusted"
      ? "#22c55e"
      : $tier === "enhanced"
        ? theme.colors.primary
        : $tier === "verified"
          ? "#3b82f6"
          : $tier === "basic"
            ? "#f59e0b"
            : "#9ca3af"};
  border: 1px solid
    ${({ $tier, theme }) =>
      $tier === "trusted"
        ? "rgba(34,197,94,0.15)"
        : $tier === "enhanced"
          ? theme.colors.primary
          : $tier === "verified"
            ? "rgba(59,130,246,0.15)"
            : $tier === "basic"
              ? "rgba(245,158,11,0.15)"
              : "rgba(156,163,175,0.08)"};
`;

const HeroStats = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 5px;
`;

const StatChip = styled.div`
  background: ${({ theme }) => theme.colors.primaryBackground};
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  padding: 5px 8px;
  gap: 2px;
`;

const StatLabel = styled.span`
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.45;
`;

const StatValue = styled.span`
  font-size: 11px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textPrimary};
`;

const VerifyCTA = styled.div<{ $status?: string }>`
  background: ${({ $status, theme }) =>
    $status === "Approved"
      ? "rgba(34,197,94,0.06)"
      : $status === "Declined"
        ? "rgba(239,68,68,0.06)"
        : $status === "In Review"
          ? "rgba(59,130,246,0.06)"
          : `${theme.colors.primary || "#E05C1A"}08`};
  border: 1px solid
    ${({ $status, theme }) =>
      $status === "Approved"
        ? "rgba(34,197,94,0.2)"
        : $status === "Declined"
          ? "rgba(239,68,68,0.2)"
          : $status === "In Review"
            ? "rgba(59,130,246,0.2)"
            : `${theme.colors.primary || "#E05C1A"}25`};
  border-radius: 14px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 12px;
`;

const VerifyTop = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`;

const VerifyIcon = styled.div`
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: ${({ theme }) => `${theme.colors.primary || "#E05C1A"}15`};
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${({ theme }) => theme.colors.primary || "#E05C1A"};
  flex-shrink: 0;
`;

const VerifyText = styled.div`
  flex: 1;
  min-width: 0;
`;

const VerifyTitle = styled.div`
  font-size: 12px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textPrimary};
`;

const VerifyHint = styled.div`
  font-size: 10px;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.6;
  margin-top: 2px;
  line-height: 1.4;
`;

const VerifyBtnRow = styled.div`
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
`;

const VerifyBtn = styled.button<{ $variant?: "primary" | "cancel" }>`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 13px;
  border-radius: 8px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
  border: 1px solid
    ${({ $variant, theme }) =>
      $variant === "cancel"
        ? "rgba(239,68,68,0.3)"
        : `${theme.colors.primary || "#E05C1A"}50`};
  background: ${({ $variant, theme }) =>
    $variant === "cancel"
      ? "rgba(239,68,68,0.08)"
      : `${theme.colors.primary || "#E05C1A"}15`};
  color: ${({ $variant, theme }) =>
    $variant === "cancel" ? "#ef4444" : theme.colors.primary || "#E05C1A"};
  &:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
  &:hover:not(:disabled) {
    opacity: 0.8;
  }
`;

const SessionBadge = styled.div<{ $status: string }>`
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 3px 8px;
  border-radius: 20px;
  background: ${({ $status }) =>
    $status === "Approved"
      ? "rgba(34,197,94,0.12)"
      : $status === "Declined"
        ? "rgba(239,68,68,0.12)"
        : $status === "In Review"
          ? "rgba(59,130,246,0.12)"
          : $status === "In Progress"
            ? "rgba(245,158,11,0.12)"
            : "rgba(156,163,175,0.1)"};
  color: ${({ $status }) =>
    $status === "Approved"
      ? "#22c55e"
      : $status === "Declined"
        ? "#ef4444"
        : $status === "In Review"
          ? "#3b82f6"
          : $status === "In Progress"
            ? "#f59e0b"
            : "#9ca3af"};
`;

const ActionCard = styled.div<{ $danger?: boolean }>`
  background: ${({ $danger }) =>
    $danger ? "rgba(239,68,68,0.05)" : "rgba(245,158,11,0.05)"};
  border: 1px solid
    ${({ $danger }) =>
      $danger ? "rgba(239,68,68,0.18)" : "rgba(245,158,11,0.18)"};
  border-radius: 14px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 12px;
`;

const ActionTop = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 10px;
`;

const ActionIcon = styled.div<{ $danger?: boolean }>`
  width: 36px;
  height: 36px;
  border-radius: 10px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${({ $danger }) =>
    $danger ? "rgba(239,68,68,0.1)" : "rgba(245,158,11,0.1)"};
  color: ${({ $danger }) => ($danger ? "#ef4444" : "#f59e0b")};
`;

const ActionText = styled.div`
  flex: 1;
  min-width: 0;
`;

const ActionTitle = styled.div`
  font-size: 12px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textPrimary};
`;

const ActionHint = styled.div`
  font-size: 10px;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.6;
  margin-top: 3px;
  line-height: 1.5;
`;

const ActionBtnRow = styled.div`
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
`;

const DangerBtn = styled.button`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 13px;
  border-radius: 8px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
  border: 1px solid rgba(239, 68, 68, 0.3);
  background: rgba(239, 68, 68, 0.08);
  color: #ef4444;
  &:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
  &:hover:not(:disabled) {
    background: rgba(239, 68, 68, 0.14);
    border-color: rgba(239, 68, 68, 0.45);
  }
`;

const EditBtn = styled.button`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 13px;
  border-radius: 8px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
  border: 1px solid ${({ theme }) => theme.colors.secondaryBackground};
  background: transparent;
  color: ${({ theme }) => theme.colors.textSecondary};
  &:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
  &:hover:not(:disabled) {
    background: ${({ theme }) => theme.colors.secondaryBackground};
    color: ${({ theme }) => theme.colors.textPrimary};
  }
`;

const LockedBanner = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  background: ${({ theme }) => theme.colors.secondaryBackground};
  border-radius: 12px;
  padding: 14px;
`;

const LockedText = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
`;

const LockedTitle = styled.span`
  font-size: 12px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textPrimary};
`;

const LockedHint = styled.span`
  font-size: 10px;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.55;
  line-height: 1.5;
`;

const DecryptBtn = styled.button`
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 7px 12px;
  border-radius: 8px;
  border: 1px solid ${({ theme }) => `${theme.colors.primary || "#E05C1A"}40`};
  background: ${({ theme }) => `${theme.colors.primary || "#E05C1A"}10`};
  color: ${({ theme }) => theme.colors.primary || "#E05C1A"};
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
  transition: all 0.15s;
  &:hover {
    opacity: 0.8;
  }
`;

const StagesGrid = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const StageRow = styled.div<{ $passed: boolean }>`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 14px;
  border-radius: 8px;
  background: ${({ theme }) => theme.colors.secondaryBackground};
  border: 1px solid
    ${({ $passed, theme }) =>
      $passed ? "rgba(34,197,94,0.15)" : theme.colors.secondaryBackground};
`;

const StageDot = styled.div<{ $passed: boolean }>`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
  background: ${({ $passed }) =>
    $passed ? "#22c55e" : "rgba(156,163,175,0.25)"};
  animation: ${({ $passed }) =>
    $passed
      ? "none"
      : css`
          ${glowPulse} 2s ease-in-out infinite
        `};
`;

const StageName = styled.span`
  font-size: 11px;
  font-weight: 500;
  color: ${({ theme }) => theme.colors.textPrimary};
  flex: 1;
  text-transform: capitalize;
`;

const StageStatus = styled.span<{ $passed: boolean }>`
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: ${({ $passed }) => ($passed ? "#22c55e" : "#9ca3af")};
`;

const BoundKeyCard = styled.div`
  background: ${({ theme }) => theme.colors.secondaryBackground};
  border-radius: 12px;
  padding: 12px 14px;
  display: flex;
  align-items: center;
  gap: 12px;
`;

const KeyIconBox = styled.div`
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: ${({ theme }) => theme.colors.primaryBackground};
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${({ theme }) => theme.colors.textSecondary};
  flex-shrink: 0;
`;

const KeyMeta = styled.div`
  flex: 1;
  min-width: 0;
`;

const KeyFingerprint = styled.div`
  font-family: "Fira Mono", "JetBrains Mono", monospace;
  font-size: 10px;
  color: ${({ theme }) => theme.colors.textPrimary};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const KeySub = styled.div`
  font-size: 9px;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.45;
  margin-top: 2px;
`;

const UsernameEditRow = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  min-width: 0;
`;

const UsernameInput = styled.input`
  flex: 1;
  min-width: 0;
  background: ${({ theme }) => theme.colors.primaryBackground};
  border: 1px solid ${({ theme }) => theme.colors.secondaryBackground};
  border-radius: 7px;
  padding: 5px 9px;
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textPrimary};
  outline: none;
  font-family: inherit;
  transition: border-color 0.15s;
  &:focus {
    border-color: ${({ theme }) => theme.colors.primary || "#E05C1A"};
  }
  &::placeholder {
    color: ${({ theme }) => theme.colors.textSecondary};
    opacity: 0.35;
  }
`;

const UsernameActionBtn = styled.button<{ $variant?: "confirm" | "cancel" }>`
  width: 26px;
  height: 26px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  cursor: pointer;
  transition: all 0.15s;
  border: 1px solid
    ${({ $variant, theme }) =>
      $variant === "confirm"
        ? `${theme.colors.primary || "#E05C1A"}50`
        : "rgba(239,68,68,0.3)"};
  background: ${({ $variant, theme }) =>
    $variant === "confirm"
      ? `${theme.colors.primary || "#E05C1A"}12`
      : "rgba(239,68,68,0.08)"};
  color: ${({ $variant, theme }) =>
    $variant === "confirm" ? theme.colors.primary || "#E05C1A" : "#ef4444"};
  &:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
  &:hover:not(:disabled) {
    opacity: 0.75;
  }
`;

const UsernameHint = styled.div<{ $error?: boolean }>`
  font-size: 9px;
  margin-top: 3px;
  line-height: 1.4;
  color: ${({ $error }) => ($error ? "#ef4444" : "inherit")};
  opacity: ${({ $error }) => ($error ? 1 : 0.4)};
`;

// ─── Helpers ───────────────────────────────────────────────────────────────────

function getRevokeLockedDaysRemaining(uid: MajikUniversalID): number {
  const verifiedAt = uid.lastUpdate ? new Date(uid.lastUpdate).getTime() : null;
  if (!verifiedAt) return 0;
  const remaining = REVOKE_LOCKOUT_MS - (Date.now() - verifiedAt);
  return remaining > 0 ? Math.ceil(remaining / (24 * 60 * 60 * 1000)) : 0;
}

const copyToClipboard = (text: string, label = "Copied") => {
  navigator.clipboard
    .writeText(text)
    .then(() => toast.success(label, { duration: 1500 }));
};

// ─── Props ─────────────────────────────────────────────────────────────────────

interface MUIDDetailViewProps {
  uid: MajikUniversalID;
  privateInfo: PrivatePersonalInfo | null;
  sessionStatus: string | null;
  verificationUrl: string | null;
  majik: MajikBuwizDatabase;
  editUserUrl: string;
  cacheBuster: number;
  avatarUploading: boolean;

  onAvatarUpload: (file: File) => Promise<void>;
  onAvatarDelete: () => Promise<void>;
  onRequestDecrypt: () => void;
  onRequestDelete: () => void;
  onStartVerification: () => void;
  onCancelVerification: () => void;
  onUsernameUpdate: (uid_id: string, username: string) => Promise<void>;
  onUIDUpdate: (fresh: MajikUniversalID) => void;

  isStartingVerification: boolean;
  isCancellingVerification: boolean;
}

// ─── Component ─────────────────────────────────────────────────────────────────

export const MUIDDetailView: React.FC<MUIDDetailViewProps> = React.memo(
  ({
    uid,
    privateInfo,
    sessionStatus,
    verificationUrl,
    editUserUrl,
    cacheBuster,
    avatarUploading,
    onAvatarUpload,
    onAvatarDelete,
    onRequestDecrypt,
    onRequestDelete,
    onStartVerification,
    onCancelVerification,
    onUsernameUpdate,
    isStartingVerification,
    isCancellingVerification,
  }) => {
    // Username edit — internal only, no parent re-render
    const [isEditingUsername, setIsEditingUsername] = useState(false);
    const [usernameInput, setUsernameInput] = useState("");
    const [usernameError, setUsernameError] = useState<string | null>(null);
    const [isSavingUsername, setIsSavingUsername] = useState(false);

    const userImage = useValidatedImage(
      `https://pimg.majikah.solutions/${uid.userId}/profile.webp?v=${cacheBuster}`,
    );

    const handleSaveUsername = useCallback(async () => {
      const trimmed = usernameInput.trim();
      if (!trimmed) {
        setUsernameError("Username cannot be empty");
        return;
      }
      if (!/^[a-zA-Z0-9]+$/.test(trimmed)) {
        setUsernameError("Letters and numbers only");
        return;
      }
      setIsSavingUsername(true);
      setUsernameError(null);
      try {
        await onUsernameUpdate(uid.id, trimmed);
        setIsEditingUsername(false);
        setUsernameInput("");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (err: any) {
        const msg = err?.message ?? "Failed to update username";
        setUsernameError(
          msg.toLowerCase().includes("taken") ? "Username already taken" : msg,
        );
      } finally {
        setIsSavingUsername(false);
      }
    }, [usernameInput, uid.id, onUsernameUpdate]);

    // ── Verification CTA ────────────────────────────────────────────────────
    const renderVerificationCTA = () => {
      if (uid.tier !== IDTier.UNVERIFIED) return null;
      const hasActiveSession =
        !!sessionStatus && ACTIVE_SESSION_STATUSES.has(sessionStatus);

      if (hasActiveSession) {
        return (
          <VerifyCTA $status={sessionStatus!}>
            <VerifyTop>
              <VerifyIcon>
                <ShieldWarningIcon size={18} weight="duotone" />
              </VerifyIcon>
              <VerifyText>
                <VerifyTitle>
                  Verification in progress
                  <SessionBadge
                    $status={sessionStatus!}
                    style={{ marginLeft: 8 }}
                  >
                    {sessionStatus}
                  </SessionBadge>
                </VerifyTitle>
                <VerifyHint>
                  {sessionStatus === "In Review"
                    ? "Your submission is under manual review. Check back later."
                    : sessionStatus === "Resubmitted"
                      ? "Some documents were flagged. Open the session to resubmit."
                      : "Complete your identity verification in the Didit session."}
                </VerifyHint>
              </VerifyText>
            </VerifyTop>
            <VerifyBtnRow>
              {verificationUrl && (
                <VerifyBtn
                  $variant="primary"
                  onClick={() => open(verificationUrl)}
                >
                  <ArrowSquareOutIcon size={11} /> Continue in Didit
                </VerifyBtn>
              )}
              {sessionStatus !== "In Review" && (
                <VerifyBtn
                  $variant="cancel"
                  onClick={onCancelVerification}
                  disabled={isCancellingVerification}
                >
                  {isCancellingVerification ? (
                    <SpinIcon>
                      <SpinnerIcon size={11} />
                    </SpinIcon>
                  ) : (
                    <XCircleIcon size={11} />
                  )}
                  Cancel
                </VerifyBtn>
              )}
            </VerifyBtnRow>
          </VerifyCTA>
        );
      }

      const isDeclined = [
        "Declined",
        "Expired",
        "Kyc Expired",
        "Abandoned",
      ].includes(sessionStatus ?? "");
      const hasExistingUrl = !!verificationUrl;

      return (
        <VerifyCTA>
          <VerifyTop>
            <VerifyIcon>
              <ShieldCheckIcon size={18} weight="duotone" />
            </VerifyIcon>
            <VerifyText>
              <VerifyTitle>
                {isDeclined
                  ? "Restart verification"
                  : hasExistingUrl
                    ? "Continue verification"
                    : "Verify your identity"}
              </VerifyTitle>
              <VerifyHint>
                {isDeclined
                  ? "Your previous session ended. Start a new verification to continue."
                  : hasExistingUrl
                    ? "Your session is ready. Open it to complete identity verification."
                    : "Complete Didit's KYC flow to unlock your full identity tier."}
              </VerifyHint>
            </VerifyText>
          </VerifyTop>
          <VerifyBtnRow>
            <VerifyBtn
              $variant="primary"
              onClick={onStartVerification}
              disabled={isStartingVerification}
            >
              {isStartingVerification ? (
                <SpinIcon>
                  <SpinnerIcon size={11} />
                </SpinIcon>
              ) : (
                <ShieldCheckIcon size={11} />
              )}
              {isStartingVerification
                ? "Starting…"
                : hasExistingUrl
                  ? "Open Verification"
                  : isDeclined
                    ? "Start Again"
                    : "Start Verification"}
            </VerifyBtn>
          </VerifyBtnRow>
        </VerifyCTA>
      );
    };

    // ── Delete card ─────────────────────────────────────────────────────────
    const renderDeleteCard = () => {
      const revokeLockedDays = uid.isVerified
        ? getRevokeLockedDaysRemaining(uid)
        : 0;
      const isRevokeLocked = revokeLockedDays > 0;

      if (uid.isVerified) {
        return (
          <ActionCard $danger={!isRevokeLocked}>
            <ActionTop>
              <ActionIcon $danger={!isRevokeLocked}>
                {isRevokeLocked ? (
                  <WarningCircleIcon size={18} weight="duotone" />
                ) : (
                  <TrashIcon size={18} weight="duotone" />
                )}
              </ActionIcon>
              <ActionText>
                <ActionTitle>
                  {isRevokeLocked
                    ? "Revocation Locked"
                    : "Revoke & Re-create ID"}
                </ActionTitle>
                <ActionHint>
                  {isRevokeLocked
                    ? `Your ID was verified recently. Revocation is locked for ${revokeLockedDays} more day${revokeLockedDays !== 1 ? "s" : ""}.`
                    : "Revoking permanently nullifies your verified ID. You'll need to re-verify a new one."}
                </ActionHint>
              </ActionText>
            </ActionTop>
            {!isRevokeLocked && (
              <ActionBtnRow>
                <DangerBtn onClick={onRequestDelete}>
                  <TrashIcon size={11} /> Revoke ID
                </DangerBtn>
              </ActionBtnRow>
            )}
          </ActionCard>
        );
      }

      return (
        <ActionCard>
          <ActionTop>
            <ActionIcon>
              <PencilSimpleIcon size={18} weight="duotone" />
            </ActionIcon>
            <ActionText>
              <ActionTitle>Need to update your info?</ActionTitle>
              <ActionHint>
                Delete this unverified ID and recreate it with corrected
                personal information.
              </ActionHint>
            </ActionText>
          </ActionTop>
          <ActionBtnRow>
            <DangerBtn onClick={onRequestDelete}>
              <TrashIcon size={11} /> Delete &amp; Re-create
            </DangerBtn>
            <EditBtn onClick={() => open(editUserUrl)}>
              <PencilSimpleIcon size={11} /> Edit Profile First
            </EditBtn>
          </ActionBtnRow>
        </ActionCard>
      );
    };

    const displayName =
      uid.toPublicView().display_name || uid.userRef.display_name;

    return (
      <>
        <GuideHelper
          docsPath="https://majikah.solutions/products/majik-buwiz/docs/buwiz-muid-setup"
          id="guide-user-muid-panel"
        />
        {/* Hero */}
        <HeroCard>
          <HeroTop>
            <HeroLeft>
              <UserAvatar
                src={userImage}
                alt={displayName}
                editable
                shape="circle"
                size={80}
                borderWidth={3}
                borderRadius="14px"
                tierColor={tierGradient(uid.tier)}
                isLoading={avatarUploading}
                fallback={
                  uid.isVerified ? (
                    <ShieldCheckIcon size={22} weight="duotone" />
                  ) : (
                    <ShieldWarningIcon size={22} weight="duotone" />
                  )
                }
                onUpload={onAvatarUpload}
                onDelete={onAvatarDelete}
              />
              <HeroMeta>
                <HeroName>{displayName}</HeroName>
                <HeroID>{uid.id}</HeroID>
              </HeroMeta>
            </HeroLeft>
            <TierBadge $tier={uid.tier.toLowerCase()}>
              <span>{uid.tier}</span>
            </TierBadge>
          </HeroTop>
          <HeroStats>
            <StatChip>
              <StatLabel>Status</StatLabel>
              <StatValue style={{ textTransform: "capitalize" }}>
                {uid.status.replace(/_/g, " ")}
              </StatValue>
            </StatChip>
            <StatChip>
              <StatLabel>Mutable</StatLabel>
              <StatValue>{uid.isMutable ? "Yes" : "No"}</StatValue>
            </StatChip>
            <StatChip>
              <StatLabel>Created</StatLabel>
              <StatValue>
                {new Date(uid.timestamp).toLocaleDateString()}
              </StatValue>
            </StatChip>
            <StatChip>
              <StatLabel>Updated</StatLabel>
              <StatValue>
                {new Date(uid.lastUpdate).toLocaleDateString()}
              </StatValue>
            </StatChip>
          </HeroStats>
        </HeroCard>

        {renderVerificationCTA()}
        {renderDeleteCard()}

        {/* Public Profile */}
        <SectionWrap>
          <SectionHead>
            <SectionTitle>
              <UserIcon size={11} /> Public Profile
            </SectionTitle>
          </SectionHead>
          <Card>
            {/* Username */}
            <FieldRow>
              <FieldIcon>
                <IdentificationCardIcon size={14} />
              </FieldIcon>
              <FieldContent>
                <FieldLabel>Username</FieldLabel>
                {isEditingUsername ? (
                  <>
                    <UsernameEditRow>
                      <UsernameInput
                        autoFocus
                        value={usernameInput}
                        placeholder={uid.username ?? "yourhandle"}
                        maxLength={32}
                        onChange={(e) => {
                          setUsernameInput(e.target.value);
                          setUsernameError(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSaveUsername();
                          if (e.key === "Escape") {
                            setIsEditingUsername(false);
                            setUsernameInput("");
                            setUsernameError(null);
                          }
                        }}
                      />
                      <UsernameActionBtn
                        $variant="confirm"
                        onClick={handleSaveUsername}
                        disabled={isSavingUsername || !usernameInput.trim()}
                        title="Save"
                      >
                        {isSavingUsername ? (
                          <SpinIcon>
                            <ArrowsClockwiseIcon size={11} />
                          </SpinIcon>
                        ) : (
                          <CheckCircleIcon size={11} />
                        )}
                      </UsernameActionBtn>
                      <UsernameActionBtn
                        $variant="cancel"
                        onClick={() => {
                          setIsEditingUsername(false);
                          setUsernameInput("");
                          setUsernameError(null);
                        }}
                        disabled={isSavingUsername}
                        title="Cancel"
                      >
                        <XCircleIcon size={11} />
                      </UsernameActionBtn>
                    </UsernameEditRow>
                    {usernameError ? (
                      <UsernameHint $error>{usernameError}</UsernameHint>
                    ) : (
                      <UsernameHint>
                        Letters and numbers only, no spaces
                      </UsernameHint>
                    )}
                  </>
                ) : (
                  <UsernameEditRow>
                    <FieldValue style={{ flex: 1 }}>
                      {uid.username ? (
                        <>@{uid.username}</>
                      ) : (
                        <EmptyField>Not set</EmptyField>
                      )}
                    </FieldValue>
                    <UsernameActionBtn
                      $variant="confirm"
                      onClick={() => {
                        setUsernameInput(uid.username ?? "");
                        setUsernameError(null);
                        setIsEditingUsername(true);
                      }}
                      title="Edit username"
                    >
                      <PencilSimpleIcon size={11} />
                    </UsernameActionBtn>
                  </UsernameEditRow>
                )}
              </FieldContent>
            </FieldRow>

            <FieldRow>
              <FieldIcon>
                <UserIcon size={14} />
              </FieldIcon>
              <FieldContent>
                <FieldLabel>Display Name</FieldLabel>
                <FieldValue data-private>
                  {uid.toPublicView().display_name ||
                    (uid.toPublicView().public_profile
                      ?.display_name as string) || (
                      <EmptyField>Not set</EmptyField>
                    )}
                </FieldValue>
              </FieldContent>
            </FieldRow>

            {(uid.toPublicView().public_profile?.location_label as string) && (
              <FieldRow>
                <FieldIcon>
                  <MapPinIcon size={14} />
                </FieldIcon>
                <FieldContent>
                  <FieldLabel>Location</FieldLabel>
                  <FieldValue data-private>
                    {uid.toPublicView().public_profile.location_label as string}
                  </FieldValue>
                </FieldContent>
              </FieldRow>
            )}

            <FieldRow>
              <FieldIcon>
                <ClockIcon size={14} />
              </FieldIcon>
              <FieldContent>
                <FieldLabel>Member Since</FieldLabel>
                <FieldValue data-private>
                  {new Date(uid.timestamp).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </FieldValue>
              </FieldContent>
            </FieldRow>
          </Card>
        </SectionWrap>

        {/* Private Info */}
        <SectionWrap>
          <SectionHead>
            <SectionTitle>
              <LockKeyIcon size={11} weight="fill" /> Private Info
            </SectionTitle>
            {!privateInfo && (
              <SectionAction onClick={onRequestDecrypt}>
                <LockOpenIcon size={11} /> Decrypt
              </SectionAction>
            )}
          </SectionHead>
          {!privateInfo ? (
            <LockedBanner>
              <LockKeyIcon
                size={20}
                weight="duotone"
                style={{
                  color: "var(--text-secondary)",
                  opacity: 0.4,
                  flexShrink: 0,
                }}
              />
              <LockedText>
                <LockedTitle>Private info is encrypted</LockedTitle>
                <LockedHint>
                  Decrypt using your seed backup to view personal details.
                </LockedHint>
              </LockedText>
              <DecryptBtn onClick={onRequestDecrypt}>
                <LockOpenIcon size={11} weight="fill" /> Decrypt
              </DecryptBtn>
            </LockedBanner>
          ) : (
            <Card>
              {privateInfo.legal_first_name && (
                <FieldRow>
                  <FieldIcon>
                    <UserIcon size={14} />
                  </FieldIcon>
                  <FieldContent>
                    <FieldLabel>Legal Name</FieldLabel>
                    <FieldValue data-private>
                      {[
                        privateInfo.legal_first_name,
                        privateInfo.legal_middle_name,
                        privateInfo.legal_last_name,
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      {privateInfo.legal_name_suffix
                        ? `, ${privateInfo.legal_name_suffix}`
                        : ""}
                    </FieldValue>
                  </FieldContent>
                </FieldRow>
              )}
              {privateInfo.primary_email && (
                <FieldRow>
                  <FieldIcon>
                    <EnvelopeIcon size={14} />
                  </FieldIcon>
                  <FieldContent>
                    <FieldLabel>Email</FieldLabel>
                    <FieldValue data-private>
                      {privateInfo.primary_email}
                    </FieldValue>
                  </FieldContent>
                  <FieldCopyBtn
                    onClick={() =>
                      copyToClipboard(
                        privateInfo.primary_email!,
                        "Email copied",
                      )
                    }
                  >
                    <CopyIcon size={12} />
                  </FieldCopyBtn>
                </FieldRow>
              )}
              {privateInfo.primary_phone && (
                <FieldRow>
                  <FieldIcon>
                    <PhoneIcon size={14} />
                  </FieldIcon>
                  <FieldContent>
                    <FieldLabel>Phone</FieldLabel>
                    <FieldValue data-private>
                      {privateInfo.primary_phone}
                    </FieldValue>
                  </FieldContent>
                </FieldRow>
              )}
              {privateInfo.date_of_birth && (
                <FieldRow>
                  <FieldIcon>
                    <CalendarIcon size={14} />
                  </FieldIcon>
                  <FieldContent>
                    <FieldLabel>Date of Birth</FieldLabel>
                    <FieldValue data-private>
                      {privateInfo.date_of_birth}
                    </FieldValue>
                  </FieldContent>
                </FieldRow>
              )}
              {privateInfo.nationality && (
                <FieldRow>
                  <FieldIcon>
                    <GlobeIcon size={14} />
                  </FieldIcon>
                  <FieldContent>
                    <FieldLabel>Nationality</FieldLabel>
                    <FieldValue data-private>
                      {privateInfo.nationality}
                    </FieldValue>
                  </FieldContent>
                </FieldRow>
              )}
              {privateInfo.home_address && (
                <FieldRow>
                  <FieldIcon>
                    <MapPinIcon size={14} />
                  </FieldIcon>
                  <FieldContent>
                    <FieldLabel>Home Address</FieldLabel>
                    <FieldValue data-private>
                      {[
                        privateInfo.home_address.line1,
                        privateInfo.home_address.line2,
                        privateInfo.home_address.barangay,
                        privateInfo.home_address.city,
                        privateInfo.home_address.state_province,
                        privateInfo.home_address.postal_code,
                        privateInfo.home_address.country,
                      ]
                        .filter(Boolean)
                        .join(", ")}
                    </FieldValue>
                  </FieldContent>
                </FieldRow>
              )}
            </Card>
          )}
        </SectionWrap>

        {/* Verification Stages */}
        <SectionWrap>
          <SectionHead>
            <SectionTitle>
              <ShieldCheckIcon size={11} weight="fill" /> Verification
            </SectionTitle>
          </SectionHead>
          <StagesGrid>
            {ALL_STAGES.map((stage) => {
              const passed = uid.verificationSummary.completed_stages.includes(
                stage as DiditStage,
              );
              return (
                <StageRow key={stage} $passed={passed}>
                  <StageDot $passed={passed} />
                  <StageName>
                    {STAGE_LABELS[stage] || stage.replace(/_/g, " ")}
                  </StageName>
                  <StageStatus $passed={passed}>
                    {passed ? "Passed" : "Pending"}
                  </StageStatus>
                </StageRow>
              );
            })}
          </StagesGrid>
        </SectionWrap>

        {/* Bound Key */}
        <SectionWrap>
          <SectionHead>
            <SectionTitle>
              <LockKeyIcon size={11} weight="fill" /> Bound Key
            </SectionTitle>
          </SectionHead>
          <BoundKeyCard>
            <KeyIconBox>
              <LockKeyIcon size={16} weight="duotone" />
            </KeyIconBox>
            <KeyMeta>
              <KeyFingerprint data-private>
                {uid.signingKey.fingerprint}
              </KeyFingerprint>
              <KeySub data-private>
                KDF v{uid.signingKey.kdf_version} · Registered{" "}
                {new Date(uid.signingKey.registered_at).toLocaleDateString()}
              </KeySub>
            </KeyMeta>
            <FieldCopyBtn
              onClick={() =>
                copyToClipboard(
                  uid.signingKey.fingerprint,
                  "Fingerprint copied",
                )
              }
              title="Copy fingerprint"
            >
              <CopyIcon size={13} />
            </FieldCopyBtn>
          </BoundKeyCard>
        </SectionWrap>

        {/* Identity Hash */}
        <SectionWrap>
          <SectionHead>
            <SectionTitle>
              <IdentificationCardIcon size={11} weight="fill" /> Identity Hash
            </SectionTitle>
          </SectionHead>
          <Card>
            <FieldRow>
              <FieldContent>
                <FieldLabel>SHA3-512</FieldLabel>
                <FieldMono data-private>{uid.hash.slice(0, 48)}…</FieldMono>
              </FieldContent>
              <FieldCopyBtn
                onClick={() => copyToClipboard(uid.hash, "Hash copied")}
              >
                <CopyIcon size={12} />
              </FieldCopyBtn>
            </FieldRow>
          </Card>
        </SectionWrap>
      </>
    );
  },
);

MUIDDetailView.displayName = "MUIDDetailView";
