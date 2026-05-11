/**
 * modals/DecryptPrivateModal.tsx
 *
 * Self-contained modal for decrypting private MUID fields via seed backup.
 * Maintains its own file / key state — does not re-render the parent.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import styled from "styled-components";
import {
  CheckCircleIcon,
  FilePlusIcon,
  UploadSimpleIcon,
  WarningCircleIcon,
  XCircleIcon,
} from "@phosphor-icons/react";

import { MajikKey } from "@majikah/majik-key";
import { MajikBytes } from "@majikah/majik-bytes";
import {
  MajikUniversalID,
  type PrivatePersonalInfo,
} from "@majikah/majik-universal-id";
import { type MnemonicJSON } from "@/SDK/majik-buwiz-client/src/index";
import DynamicPopUp from "@/components/functional/DynamicPopUp";

// ─── Styled ────────────────────────────────────────────────────────────────────

const DropZone = styled.div<{ $dragging: boolean; $hasFile: boolean }>`
  border: 2px dashed
    ${({ $dragging, $hasFile, theme }) =>
      $dragging
        ? theme.colors.primary || "#E05C1A"
        : $hasFile
          ? "rgba(34,197,94,0.4)"
          : theme.colors.secondaryBackground};
  border-radius: 14px;
  padding: 28px 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s ease;
  background: ${({ $dragging, $hasFile, theme }) =>
    $dragging
      ? `${theme.colors.primary || "#E05C1A"}08`
      : $hasFile
        ? "rgba(34,197,94,0.05)"
        : theme.colors.secondaryBackground};
  &:hover {
    border-color: ${({ theme }) => theme.colors.primary || "#E05C1A"};
    background: ${({ theme }) => `${theme.colors.primary || "#E05C1A"}06`};
  }
`;

const DropIcon = styled.div<{ $hasFile: boolean }>`
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${({ $hasFile, theme }) =>
    $hasFile ? "rgba(34,197,94,0.12)" : theme.colors.primaryBackground};
  color: ${({ $hasFile }) => ($hasFile ? "#22c55e" : "#9ca3af")};
`;

const DropTitle = styled.div`
  font-size: 13px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textPrimary};
`;

const DropHint = styled.div`
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.55;
  line-height: 1.45;
`;

const BrowseBtn = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 5px 12px;
  border-radius: 7px;
  font-size: 11px;
  font-weight: 600;
  border: 1px solid ${({ theme }) => `${theme.colors.primary || "#E05C1A"}40`};
  background: ${({ theme }) => `${theme.colors.primary || "#E05C1A"}10`};
  color: ${({ theme }) => theme.colors.primary || "#E05C1A"};
`;

const LoadedCard = styled.div`
  margin-top: 12px;
  background: ${({ theme }) => theme.colors.secondaryBackground};
  border-radius: 10px;
  padding: 10px 12px;
  display: flex;
  align-items: center;
  gap: 10px;
`;

const LoadedIcon = styled.div`
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: rgba(34, 197, 94, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #22c55e;
  flex-shrink: 0;
`;

const LoadedMeta = styled.div`
  flex: 1;
  min-width: 0;
`;

const LoadedName = styled.div`
  font-size: 12px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textPrimary};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const LoadedSub = styled.div`
  font-size: 10px;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.5;
  font-family: "Fira Mono", "JetBrains Mono", monospace;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 2px;
`;

const ClearBtn = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  padding: 2px;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.35;
  flex-shrink: 0;
  &:hover {
    opacity: 0.8;
  }
`;

const ReadyBox = styled.div`
  margin-top: 8px;
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(34, 197, 94, 0.07);
  border: 1px solid rgba(34, 197, 94, 0.18);
  border-radius: 10px;
  padding: 10px 14px;
  font-size: 11px;
  color: #22c55e;
  line-height: 1.5;
`;

const ErrorBox = styled.div`
  margin-top: 8px;
  display: flex;
  align-items: flex-start;
  gap: 8px;
  background: rgba(239, 68, 68, 0.07);
  border: 1px solid rgba(239, 68, 68, 0.18);
  border-radius: 10px;
  padding: 10px 14px;
  font-size: 11px;
  color: #ef4444;
  line-height: 1.5;
`;

// ─── Component ─────────────────────────────────────────────────────────────────

interface DecryptPrivateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  uid: MajikUniversalID;
  onDecrypted: (info: PrivatePersonalInfo) => void;
}

export const DecryptPrivateModal: React.FC<DecryptPrivateModalProps> =
  React.memo(({ open, onOpenChange, uid, onDecrypted }) => {
    const [dragging, setDragging] = useState(false);
    const [decryptKey, setDecryptKey] = useState<MajikKey | null>(null);
    const [decryptError, setDecryptError] = useState<string | null>(null);
    const [isDecrypting, setIsDecrypting] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
      if (!open) {
        setDecryptKey(null);
        setDecryptError(null);
        setDragging(false);
      }
    }, [open]);

    const processFile = useCallback(
      async (file: File) => {
        const isJSON =
          file.type === "application/json" || file.name.endsWith(".json");
        const isPNG = file.type === "image/png" || file.name.endsWith(".png");
        if (!isJSON && !isPNG) {
          toast.error("Invalid file type — expected .png or .json");
          return;
        }

        toast.promise(
          (async () => {
            let parsed: MnemonicJSON;
            if (isPNG) {
              const isMajikByte = await MajikBytes.isValidPNG(file);
              if (!isMajikByte.isValid)
                throw new Error("Not a valid Majik Bytes PNG.");
              const loaded = await MajikBytes.fromPNG(file);
              parsed = JSON.parse(atob(loaded.toStringValue())) as MnemonicJSON;
            } else {
              parsed = JSON.parse(await file.text()) as MnemonicJSON;
            }
            if (!parsed.id || !parsed.seed?.length) {
              throw new Error("Invalid backup file — missing id or seed.");
            }
            const key = await MajikKey.fromMnemonicJSON(
              parsed,
              "majikah-imported-account",
            );
            if (key.fingerprint !== uid.signingKey.fingerprint) {
              throw new Error("This backup does not match your current MUID.");
            }
            setDecryptKey(key);
            setDecryptError(null);
            return `Fingerprint: ${key.fingerprint.slice(0, 18)}…`;
          })(),
          {
            loading: "Loading Key Backup...",
            success: (msg) => msg,
            error: (err) => {
              setDecryptError(
                err instanceof Error
                  ? err.message
                  : "Could not parse key file.",
              );
              return `${err}`;
            },
          },
        );
      },
      [uid.signingKey.fingerprint],
    );

    const handleConfirm = useCallback(async () => {
      if (!decryptKey) return;
      setIsDecrypting(true);
      try {
        const result = await uid.decryptPrivate(decryptKey);
        if (result.success && result.data) {
          onDecrypted(result.data as PrivatePersonalInfo);
          onOpenChange(false);
          toast.success("Private info decrypted");
        } else {
          setDecryptError(result.reason ?? "Decryption failed.");
          toast.error("Decryption failed", { description: result.reason });
        }
      } finally {
        setIsDecrypting(false);
      }
    }, [uid, decryptKey, onDecrypted, onOpenChange]);

    const handleCancel = useCallback(() => onOpenChange(false), [onOpenChange]);

    return (
      <>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json,.png,image/png"
          style={{ display: "none" }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) processFile(file);
            if (fileRef.current) fileRef.current.value = "";
          }}
        />
        <DynamicPopUp
          isOpen={open}
          onOpenChange={(next) => {
            if (!next && !isDecrypting) handleCancel();
          }}
          modal={{
            title: "Decrypt Private Info",
            description:
              "Load your Majik Key seed backup (.png or .json) to temporarily decrypt your private identity fields.",
          }}
          buttons={{
            cancel: {
              text: "Cancel",
              onClick: handleCancel,
              isDisabled: isDecrypting,
            },
            confirm: {
              text: isDecrypting ? "Decrypting…" : "Decrypt",
              onClick: handleConfirm,
              isDisabled: !decryptKey || isDecrypting,
            },
          }}
        >
          {!decryptKey ? (
            <DropZone
              $dragging={dragging}
              $hasFile={false}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                const file = e.dataTransfer.files[0];
                if (file) processFile(file);
              }}
              onClick={() => fileRef.current?.click()}
            >
              <DropIcon $hasFile={false}>
                <UploadSimpleIcon size={22} />
              </DropIcon>
              <DropTitle>
                {dragging ? "Release to load" : "Drop your seed key file here"}
              </DropTitle>
              <DropHint>
                Accepts the .png or .json backup exported when you created your
                account.
                <br />
                Loaded into memory only — never re-uploaded.
              </DropHint>
              <BrowseBtn>
                <FilePlusIcon size={12} /> Browse files
              </BrowseBtn>
            </DropZone>
          ) : (
            <LoadedCard>
              <LoadedIcon>
                <FilePlusIcon size={16} />
              </LoadedIcon>
              <LoadedMeta>
                <LoadedName>{decryptKey.publicKeyBase64}</LoadedName>
                <LoadedSub>{decryptKey.fingerprint.slice(0, 28)}…</LoadedSub>
              </LoadedMeta>
              <ClearBtn
                onClick={() => {
                  setDecryptKey(null);
                  setDecryptError(null);
                }}
                title="Remove key"
              >
                <XCircleIcon size={15} />
              </ClearBtn>
            </LoadedCard>
          )}
          {decryptKey && !decryptError && (
            <ReadyBox>
              <CheckCircleIcon
                size={14}
                weight="fill"
                style={{ flexShrink: 0 }}
              />
              Key unlocked — click Decrypt to reveal your private info.
            </ReadyBox>
          )}
          {decryptError && (
            <ErrorBox>
              <WarningCircleIcon
                size={14}
                weight="fill"
                style={{ flexShrink: 0, marginTop: 1 }}
              />
              {decryptError}
            </ErrorBox>
          )}
        </DynamicPopUp>
      </>
    );
  });

DecryptPrivateModal.displayName = "DecryptPrivateModal";
