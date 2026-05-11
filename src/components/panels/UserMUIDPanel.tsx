
/**
 * UserMUIDPanel.tsx  (refactored)
 *
 * Responsibilities of THIS file after refactor:
 *   1. Orchestrate modal open/close booleans
 *   2. Hold non-form async state (uid, privateInfo, sessionStatus — via hook)
 *   3. Wire action callbacks (verification, delete, avatar, passphrase, share)
 *   4. Render step dividers + delegate to section/modal components
 *
 * What has moved OUT:
 *   - All MUID fetch + realtime logic     → hooks/useUserMUID.ts
 *   - All form field state                → individual modal components
 *   - MUID detail render tree            → sections/MUIDDetailView.tsx
 *   - Key account slot                   → sections/KeyAccountSection.tsx
 *   - Mismatch banner                    → sections/MismatchBanner.tsx
 *   - Import / Create / Replace modals   → modals/ImportKeyModal, CreateKeyModal, ReplaceKeyModal
 *   - Decrypt modal                      → modals/DecryptPrivateModal
 *   - Confirm modals                     → modals/ConfirmationModals
 *
 * Race condition fix (MUID flashing null):
 *   Moved to useUserMUID — generation-counter pattern ensures only the latest
 *   in-flight fetch can commit state, regardless of how many concurrent
 *   effects fire during auth changes.
 *
 * Render performance:
 *   - No form state in this component → keystrokes in modals can't trigger
 *     a parent re-render.
 *   - MUIDDetailView, KeyAccountSection, MismatchBanner are all React.memo.
 *   - Modal open/close booleans are the only state that lives here aside from
 *     uid/privateInfo/sessionStatus which are necessary at this level.
 */

import React, { useCallback, useMemo, useRef, useState } from "react";
import styled from "styled-components";
import { toast } from "sonner";

import { open } from "@tauri-apps/plugin-shell";

import {
  ArrowsClockwiseIcon,
  CheckCircleIcon,
  DownloadIcon,
  IdentificationCardIcon,
  ShareIcon,
  SignInIcon,
  SignOutIcon,
} from "@phosphor-icons/react";

import {
  MajikUniversalID,
  type PrivatePersonalInfo,
} from "@majikah/majik-universal-id";
import { MajikBytes } from "@majikah/majik-bytes";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";

import { MajikBuwizDatabase } from "@/components/majik-context-wrapper/majik-buwiz-database";
import { MajikInvoiceContact } from "@/SDK/majik-buwiz-client/src/core/party/majik-invoice-contact";
import { MajikInvoiceContactMeta } from "@/SDK/majik-buwiz-client/src/core/party/types";

import GuideHelper from "@/components/functional/GuideHelper";
import DynamicPlaceholder from "@/components/foundations/DynamicPlaceholder";
import UserAuth from "@/components/foundations/UserAuth";
import DynamicPopUp from "@/components/functional/DynamicPopUp";

import { useMajikah } from "../majikah-session-wrapper/use-majikah";
import { useUserMUID } from "./muid/use-user-muid";

import { MismatchBanner } from "./muid/sections/MismatchBanner";
import { KeyAccountSection } from "./muid/sections/KeyAccountSection";
import { MUIDDetailView } from "./muid/sections/MUIDDetailView";
import MajikUniversalIDSetup from "./muid/MajikUniversalIDSetup";

import { DecryptPrivateModal } from "./muid/modals/DecryptPrivateModal";
import { ReplaceKeyModal } from "./muid/modals/ReplaceKeyModal";
import {
  RemoveKeyModal,
  DeleteUIDModal,
} from "./muid/modals/ConfirmationModals";

import { IconBtn, SpinIcon, REVOKE_LOCKOUT_MS } from "./shared/atoms";
import { EditContactMetaModal } from "./contacts/modals";

// ─── Layout atoms local to this file ──────────────────────────────────────────

const Root = styled.div`
  display: flex;
  flex-direction: column;
  height: auto;
  background: ${({ theme }) => theme.colors.primaryBackground};
`;

const PanelHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 18px 13px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.secondaryBackground};
  flex-shrink: 0;
`;

const HeaderLeft = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const PanelTitle = styled.h2`
  font-size: 14px;
  font-weight: 700;
  letter-spacing: -0.01em;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 7px;
  color: ${({ theme }) => theme.colors.textPrimary};
`;

const HeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
`;

const StepDivider = styled.div`
  display: flex;
  align-items: center;
  margin: 10px 0 3px;
  gap: 8px;
`;

const StepLine = styled.div`
  flex: 1;
  height: 1px;
  background: ${({ theme }) => theme.colors.secondaryBackground};
`;

const StepLabel = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.4;
  white-space: nowrap;
`;

const StepBadge = styled.div<{ $active?: boolean; $done?: boolean }>`
  width: 18px;
  height: 18px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 9px;
  font-weight: 800;
  flex-shrink: 0;
  background: ${({ $active, $done, theme }) =>
    $done
      ? "rgba(34,197,94,0.15)"
      : $active
        ? `${theme.colors.primary || "#E05C1A"}20`
        : theme.colors.secondaryBackground};
  color: ${({ $active, $done, theme }) =>
    $done
      ? "#22c55e"
      : $active
        ? theme.colors.primary || "#E05C1A"
        : theme.colors.textSecondary};
  border: 1px solid
    ${({ $active, $done, theme }) =>
      $done
        ? "rgba(34,197,94,0.2)"
        : $active
          ? `${theme.colors.primary || "#E05C1A"}30`
          : theme.colors.secondaryBackground};
`;

const MUIDPromptCard = styled.div`
  border-radius: 14px;
  border: 1.5px dashed
    ${({ theme }) => `${theme.colors.primary || "#E05C1A"}35`};
  background: ${({ theme }) => `${theme.colors.primary || "#E05C1A"}06`};
  padding: 28px 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  text-align: center;
`;

const MUIDPromptIcon = styled.div`
  width: 48px;
  height: 48px;
  border-radius: 14px;
  background: ${({ theme }) => `${theme.colors.primary || "#E05C1A"}12`};
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${({ theme }) => theme.colors.primary || "#E05C1A"};
`;

const MUIDPromptTitle = styled.div`
  font-size: 13px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textPrimary};
`;

const MUIDPromptHint = styled.div`
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.55;
  line-height: 1.55;
  max-width: 280px;
`;

// ─── Props ─────────────────────────────────────────────────────────────────────

interface PassphraseUpdateParams {
  id: string;
  passphrase: { old: string; new: string };
}

interface UserMUIDPanelProps {
  majik: MajikBuwizDatabase;
  onUpdate?: (updated: MajikBuwizDatabase) => void;
  editUserUrl?: string;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function getRevokeLockedDaysRemaining(uid: MajikUniversalID): number {
  const verifiedAt = uid.lastUpdate ? new Date(uid.lastUpdate).getTime() : null;
  if (!verifiedAt) return 0;
  const remaining = REVOKE_LOCKOUT_MS - (Date.now() - verifiedAt);
  return remaining > 0 ? Math.ceil(remaining / (24 * 60 * 60 * 1000)) : 0;
}

// ─── Component ─────────────────────────────────────────────────────────────────

const UserMUIDPanel: React.FC<UserMUIDPanelProps> = ({
  majik,
  onUpdate,
  editUserUrl = "/majikah",
}) => {
  const { majikah } = useMajikah();

  // ── MUID state (race-safe) ─────────────────────────────────────────────────
  const {
    uid,
    setUID,
    privateInfo,
    setPrivateInfo,
    muidLoading,
    sessionStatus,
    setSessionStatus,
    verificationUrl,
    setVerificationUrl,
    showSetupAfterDelete,
    setShowSetupAfterDelete,
    refresh,
  } = useUserMUID(majik);

  // ── Key account ────────────────────────────────────────────────────────────
  const [keyRefreshKey, setKeyRefreshKey] = useState(0);
  const currentAccount = useMemo(
    () => majik.getActiveAccount(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [majik, keyRefreshKey],
  );
  const hasAccount = !!currentAccount;

  const handleAccountChange = useCallback(() => {
    setKeyRefreshKey((k) => k + 1);
    onUpdate?.(majik);
  }, [majik, onUpdate]);

  // ── Modal open/close booleans ──────────────────────────────────────────────
  const [showRemoveKeyModal, setShowRemoveKeyModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showDecryptModal, setShowDecryptModal] = useState(false);
  const [showReplaceKeyModal, setShowReplaceKeyModal] = useState(false);
  const [showEditMetaModal, setShowEditMetaModal] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);

  // EditMeta needs a snapshot of the account meta at the time of opening
  const editMetaSnapshotRef = useRef<MajikInvoiceContactMeta | null>(null);

  // ── Verification flow ──────────────────────────────────────────────────────
  const [isStartingVerification, setIsStartingVerification] = useState(false);
  const [isCancellingVerification, setIsCancellingVerification] =
    useState(false);

  const handleStartVerification = useCallback(async () => {
    if (!uid) return;
    if (verificationUrl) {
      open(verificationUrl);
      return;
    }
    setIsStartingVerification(true);
    try {
      const session = await majik.startVerification(uid.id, {
        callbackUrl: `${window.location.origin}/id`,
      });
      setSessionStatus(session.data.status);
      setVerificationUrl(session.data.verification_url);
      open(session.data.verification_url);
      toast.success("Verification session started");
    } catch (err) {
      toast.error("Failed to start verification", {
        description: err instanceof Error ? err.message : "Please try again",
      });
    } finally {
      setIsStartingVerification(false);
    }
  }, [uid, majik, verificationUrl, setSessionStatus, setVerificationUrl]);

  const handleCancelVerification = useCallback(async () => {
    if (!uid) return;
    setIsCancellingVerification(true);
    try {
      await majik.cancelVerification(uid.id);
      setSessionStatus(null);
      setVerificationUrl(null);
      toast.success("Verification cancelled");
    } catch (err) {
      toast.error("Failed to cancel", {
        description: err instanceof Error ? err.message : "Please try again",
      });
    } finally {
      setIsCancellingVerification(false);
    }
  }, [uid, majik, setSessionStatus, setVerificationUrl]);

  // ── MUID delete ────────────────────────────────────────────────────────────
  const handleDeleteUID = useCallback(async () => {
    if (!uid) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (majik as any).deleteMUID(uid.id);
    toast.success(
      uid.isVerified ? "Universal ID revoked" : "Universal ID deleted",
    );
    setUID(null);
    setPrivateInfo(null);
    setSessionStatus(null);
    setVerificationUrl(null);
    setShowSetupAfterDelete(true);
  }, [
    uid,
    majik,
    setUID,
    setPrivateInfo,
    setSessionStatus,
    setVerificationUrl,
    setShowSetupAfterDelete,
  ]);

  // ── Remove local key ───────────────────────────────────────────────────────
  const handleRemoveAccount = useCallback(async () => {
    if (!currentAccount) return;
    await majik.removeOwnAccount(currentAccount.id);
    onUpdate?.(majik);
    setKeyRefreshKey((p) => p + 1);
    toast.success("Key account removed");
  }, [currentAccount, majik, onUpdate]);

  // ── ReplaceKey success ─────────────────────────────────────────────────────
  const handleReplaceSuccess = useCallback(() => {
    onUpdate?.(majik);
    setKeyRefreshKey((k) => k + 1);
  }, [majik, onUpdate]);

  // ── Share / public key ─────────────────────────────────────────────────────
  const handleShare = useCallback(
    async (id: string) => {
      const s = await majik.exportContactAsString(id);
      if (!s) {
        toast.error("Failed to copy");
        return;
      }
      try {
        await navigator.clipboard.writeText(s);
        toast.success("Invite key copied");
      } catch (err) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        toast.error("Copy failed", { description: (err as any)?.message });
      }
    },
    [majik],
  );

  const handleGetPublicKey = useCallback(
    async (contact: MajikInvoiceContact) => {
      const pkey = await contact.getPublicKeyBase64();
      if (!pkey) {
        toast.error("Failed to copy");
        return;
      }
      try {
        await navigator.clipboard.writeText(pkey);
        toast.success("Public key copied");
      } catch (err) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        toast.error("Copy failed", { description: (err as any)?.message });
      }
    },
    [],
  );

  const handleEditPassphrase = useCallback(
    async (input: PassphraseUpdateParams) => {
      try {
        majik.updatePassphrase(
          input.passphrase.old,
          input.passphrase.new,
          input.id,
        );
        onUpdate?.(majik);
        setKeyRefreshKey((p) => p + 1);
        toast.success("Passphrase updated");
      } catch (err) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        toast.error("Update failed", { description: (err as any)?.message });
      }
    },
    [majik, onUpdate],
  );

  const handleDownloadCard = useCallback(
    async (input: MajikInvoiceContact) => {
      const s = await majik.exportContactAsString(input.id);
      if (!s) {
        toast.error("Export failed");
        return;
      }
      try {
        const majikByte = await MajikBytes.create(s);
        const mbyteFile = await majikByte.toPNG();
        const defaultName = `${input?.meta?.label || input.id} - Invoice Contact Card PNG`;
        const filePath = await save({
          defaultPath: defaultName,
          filters: [{ name: "Contact Card PNG", extensions: ["png"] }],
        });
        if (!filePath) {
          toast.info("Export cancelled");
          return;
        }
        const ab = await mbyteFile.arrayBuffer();
        await writeFile(filePath, new Uint8Array(ab));
        toast.success("Contact card exported");
      } catch (err) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        toast.error("Export failed", { description: (err as any)?.message });
      }
    },
    [majik],
  );

  // ── Edit meta ──────────────────────────────────────────────────────────────
  const handleOpenEditMeta = useCallback((meta: MajikInvoiceContactMeta) => {
    editMetaSnapshotRef.current = meta;
    setShowEditMetaModal(true);
  }, []);

  // ── Setup complete ─────────────────────────────────────────────────────────
  const handleSetupComplete = useCallback(
    (created: MajikUniversalID) => {
      setUID(created);
      setShowSetupAfterDelete(false);
      if (created.isPrivateDecrypted) {
        try {
          setPrivateInfo(created.privateInfo as PrivatePersonalInfo);
        } catch {
          /* */
        }
      }
    },
    [setUID, setShowSetupAfterDelete, setPrivateInfo],
  );

  // ── Decrypt callback ───────────────────────────────────────────────────────
  const handleDecrypted = useCallback(
    (info: PrivatePersonalInfo) => {
      setPrivateInfo(info);
    },
    [setPrivateInfo],
  );

  // ── Avatar ─────────────────────────────────────────────────────────────────
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [cacheBuster] = useState(Date.now());

  const handleAvatarUpload = useCallback(
    async (file: File) => {
      setAvatarUploading(true);
      try {
        await majikah.uploadAvatar(file);
        toast.success("Avatar uploaded");
        refresh();
      } catch (e) {
        toast.error("Upload failed", { description: `${e}` });
      } finally {
        setAvatarUploading(false);
      }
    },
    [majikah, refresh],
  );

  const handleAvatarDelete = useCallback(async () => {
    await majikah.deleteAvatar();
  }, [majikah]);

  // ── Username update ────────────────────────────────────────────────────────
  const handleUsernameUpdate = useCallback(
    async (uid_id: string, username: string) => {
      const updated = await majik.updateMuidUsername(uid_id, username);
      const fresh = await MajikUniversalID.fromJSON(updated);
      setUID(fresh);
      toast.success("Username updated");
    },
    [majik, setUID],
  );

  // ── Sign out ───────────────────────────────────────────────────────────────
  const handleSignOut = useCallback(async () => {
    if (!majikah.isAuthenticated) return;

    const run = async (): Promise<string> => {
      await majikah.signOut();
      toast.success("Signed Out");
      majik.clearUser();
      majik.clearAllCaches();
      setUID(null);

      return "Signed out from Majikah.";
    };

    toast.promise(run(), {
      loading: `Signing Out…`,
      success: (m) => {
        return m;
      },
      error: (err) =>
        err instanceof Error ? err.message : "Problem Signing Out.",
    });
  }, [majikah, majik]);

  // ── Mismatch derived values ────────────────────────────────────────────────
  const localFingerprint = useMemo(() => {
    if (!currentAccount) return null;
    return currentAccount.fingerprint ?? currentAccount.id ?? null;
  }, [currentAccount]);

  const keyMismatch = useMemo(() => {
    if (!uid || !localFingerprint) return false;
    return uid.signingKey.fingerprint !== localFingerprint;
  }, [uid, localFingerprint]);

  const canRevoke = useMemo(() => {
    if (!uid) return false;
    return uid.isVerified ? getRevokeLockedDaysRemaining(uid) === 0 : true;
  }, [uid]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Root>
      <GuideHelper
        docsPath="https://majikah.solutions/products/majik-buwiz/docs/muid"
        id="guide-user-muid-panel"
      />

      <PanelHeader>
        <HeaderLeft>
          <PanelTitle>
            <IdentificationCardIcon size={16} weight="duotone" />
            Identity
          </PanelTitle>
        </HeaderLeft>
        <HeaderActions>
          {uid && (
            <>
              <IconBtn onClick={refresh} title="Refresh" disabled={muidLoading}>
                {muidLoading ? (
                  <SpinIcon>
                    <ArrowsClockwiseIcon size={13} />
                  </SpinIcon>
                ) : (
                  <ArrowsClockwiseIcon size={13} />
                )}
              </IconBtn>
              <IconBtn
                onClick={() => {
                  navigator.clipboard.writeText(uid.toBase64());
                  toast.success("ID copied", { duration: 1500 });
                }}
                title="Export ID"
              >
                <DownloadIcon size={13} />
              </IconBtn>
              <IconBtn
                onClick={() => {
                  navigator.clipboard.writeText(
                    `https://id.majikah.solutions/id/${uid.username ?? uid.id}`,
                  );
                  toast.success("Profile URL copied", { duration: 1500 });
                }}
                title="Share"
              >
                <ShareIcon size={13} />
              </IconBtn>
            </>
          )}
          {majikah.isAuthenticated ? (
            <IconBtn onClick={handleSignOut} title="Sign Out">
              <SignOutIcon size={13} />
            </IconBtn>
          ) : (
            <IconBtn onClick={() => setIsSigningIn(true)} title="Sign In">
              <SignInIcon size={13} />
            </IconBtn>
          )}
        </HeaderActions>
      </PanelHeader>

      {/* Mismatch banner — only mounts when there's actually a mismatch */}
      {uid && currentAccount && keyMismatch && (
        <MismatchBanner
          localFingerprint={localFingerprint!}
          muidFingerprint={uid.signingKey.fingerprint}
          isVerified={uid.isVerified}
          canRevoke={canRevoke}
          onSwitchKey={() => setShowReplaceKeyModal(true)}
          onDeleteUID={() => setShowDeleteModal(true)}
          onSignOut={handleSignOut}
        />
      )}

      {/* ════ STEP 1 — LOCAL KEY ACCOUNT ════ */}
      <StepDivider>
        <StepBadge $done={hasAccount} $active={!hasAccount}>
          {hasAccount ? <CheckCircleIcon size={10} weight="fill" /> : "1"}
        </StepBadge>
        <StepLabel>Local Key Account</StepLabel>
        <StepLine />
      </StepDivider>

      <KeyAccountSection
        currentAccount={currentAccount}
        majik={majik}
        onAccountChange={handleAccountChange}
        onEditMeta={handleOpenEditMeta}
        onRemoveRequest={() => setShowRemoveKeyModal(true)}
        onShare={handleShare}
        onCopyPublicKey={handleGetPublicKey}
        onUpdatePassphrase={handleEditPassphrase}
        onDownload={handleDownloadCard}
      />

      {/* ════ STEP 2 — UNIVERSAL ID ════ */}
      <StepDivider>
        <StepBadge
          $done={!!uid && !showSetupAfterDelete}
          $active={hasAccount && (!uid || showSetupAfterDelete)}
        >
          {uid && !showSetupAfterDelete ? (
            <CheckCircleIcon size={10} weight="fill" />
          ) : (
            "2"
          )}
        </StepBadge>
        <StepLabel>Universal ID</StepLabel>
        <StepLine />
      </StepDivider>

      {!hasAccount ? (
        <MUIDPromptCard>
          <MUIDPromptIcon>
            <IdentificationCardIcon size={22} weight="duotone" />
          </MUIDPromptIcon>
          <MUIDPromptTitle>Set up your key first</MUIDPromptTitle>
          <MUIDPromptHint>
            Create or import a local key account above to unlock your Universal
            ID.
          </MUIDPromptHint>
        </MUIDPromptCard>
      ) : muidLoading ? (
        <DynamicPlaceholder loading>Loading Universal ID…</DynamicPlaceholder>
      ) : !uid || showSetupAfterDelete ? (
        <MajikUniversalIDSetup
          majik={majik}
          majikah={majikah}
          editUserUrl={editUserUrl}
          onComplete={handleSetupComplete}
        />
      ) : (
        <MUIDDetailView
          uid={uid}
          privateInfo={privateInfo}
          sessionStatus={sessionStatus}
          verificationUrl={verificationUrl}
          majik={majik}
          editUserUrl={editUserUrl}
          cacheBuster={cacheBuster}
          avatarUploading={avatarUploading}
          onAvatarUpload={handleAvatarUpload}
          onAvatarDelete={handleAvatarDelete}
          onRequestDecrypt={() => setShowDecryptModal(true)}
          onRequestDelete={() => setShowDeleteModal(true)}
          onStartVerification={handleStartVerification}
          onCancelVerification={handleCancelVerification}
          onUsernameUpdate={handleUsernameUpdate}
          onUIDUpdate={setUID}
          isStartingVerification={isStartingVerification}
          isCancellingVerification={isCancellingVerification}
        />
      )}

      {/* ════ MODALS ════ */}

      {uid && showDecryptModal && (
        <DecryptPrivateModal
          open={showDecryptModal}
          onOpenChange={setShowDecryptModal}
          uid={uid}
          onDecrypted={handleDecrypted}
        />
      )}

      <ReplaceKeyModal
        open={showReplaceKeyModal}
        onOpenChange={setShowReplaceKeyModal}
        majik={majik}
        onSuccess={handleReplaceSuccess}
      />

      <RemoveKeyModal
        open={showRemoveKeyModal}
        onOpenChange={setShowRemoveKeyModal}
        onConfirm={handleRemoveAccount}
      />

      <DeleteUIDModal
        open={showDeleteModal}
        onOpenChange={setShowDeleteModal}
        uid={uid}
        onConfirm={handleDeleteUID}
      />

      {/* <EditMetaModal
        open={showEditMetaModal}
        onOpenChange={setShowEditMetaModal}
        majik={majik}
        initialMeta={currentAccount?.meta}
        accountId={currentAccount?.id ?? null}
        onSuccess={() => setKeyRefreshKey((t) => t + 1)}
      /> */}

      <EditContactMetaModal
        contact={currentAccount}
        majik={majik}
        isOpen={showEditMetaModal}
        onOpenChange={setShowEditMetaModal}
      />

      {/* Sign In modal */}
      <DynamicPopUp
        scrollable
        modal={{
          title: "Sign In",
          description: "Log in to continue creating a Universal ID.",
        }}
        buttons={{
          cancel: { text: "Cancel" },
          confirm: { text: "Close", isDisabled: true, hide: true },
        }}
        isOpen={isSigningIn}
        onOpenChange={setIsSigningIn}
      >
        <UserAuth
          showLogo={false}
          expand
          onSignIn={() => setIsSigningIn(false)}
          onSignUp={() => setIsSigningIn(false)}
        />
      </DynamicPopUp>
    </Root>
  );
};

export default UserMUIDPanel;
