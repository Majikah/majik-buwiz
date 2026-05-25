/**
 * modals/ReplaceKeyModal.tsx
 *
 * Isolated modal for replacing the local key account with the MUID-bound key.
 * Also prompts the user to decide what to do with existing invoices that may
 * be incompatible with the incoming key (signed / encrypted invoices).
 */

import React, { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  UploadSimpleIcon,
  KeyboardIcon,
  WarningIcon,
  DownloadSimpleIcon,
  CheckCircleIcon,
} from "@phosphor-icons/react";

import {
  jsonToSeed,
  type MnemonicJSON,
} from "@/SDK/majik-buwiz-client/src/index";

import { MajikBuwizDatabase } from "@/components/majik-context-wrapper/majik-buwiz-database";
import DynamicPopUp from "@/components/functional/DynamicPopUp";
import DynamicAlertBanner from "@/components/foundations/DynamicAlertBanner";
import DropImportAccount from "@/components/foundations/DropImportAccount";
import { SeedKeyInput } from "@/components/foundations/SeedKeyInput";
import { ImportModeToggle, ModeToggleButton } from "../../shared/atoms";
import styled from "styled-components";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
import { downloadBlob } from "@/utils/utils";
import CustomToggleSwitch from "@/components/foundations/CustomToggleSwitch";

// ─── Styled atoms ─────────────────────────────────────────────────────────────

const Divider = styled.hr`
  border: none;
  border-top: 1px solid
    ${({ theme }) =>
      theme.colors.secondaryBackground ?? "rgba(255,255,255,0.08)"};
  margin: 4px 0;
`;

const SectionLabel = styled.p`
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: ${({ theme }) =>
    theme.colors.textSecondary ?? "rgba(255,255,255,0.4)"};
  margin: 0 0 6px;
`;

const InvoiceRow = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 8px;
  background: ${({ theme }) =>
    theme.colors.primaryBackground ?? "rgba(255,255,255,0.04)"};
  border: 1px solid
    ${({ theme }) =>
      theme.colors.secondaryBackground ?? "rgba(255,255,255,0.08)"};
`;

const InvoiceRowContent = styled.div`
  flex: 1;
  min-width: 0;
`;

const InvoiceRowTitle = styled.p`
  font-size: 13px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textPrimary ?? "#fff"};
  margin: 0 0 3px;
`;

const InvoiceRowDesc = styled.p`
  font-size: 12px;
  line-height: 1.5;
  color: ${({ theme }) =>
    theme.colors.textSecondary ?? "rgba(255,255,255,0.6)"};
  margin: 0;
`;

const ToggleWrapper = styled.div`
  display: flex;
  align-items: center;
  margin: 15px 0px;
`;

const BackupButton = styled.button<{ $downloaded: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  cursor: ${({ $downloaded }) => ($downloaded ? "default" : "pointer")};
  border: 1.5px solid
    ${({ theme, $downloaded }) =>
      $downloaded ? theme.colors.brand.green : theme.colors.primary};
  background: ${({ theme, $downloaded }) =>
    $downloaded ? theme.colors.brand.green : theme.colors.primary};
  color: ${({ theme, $downloaded }) =>
    $downloaded
      ? (theme.colors.textPrimary ?? "#4caf7d")
      : (theme.colors.textPrimary ?? "#5e9cf5")};
  transition: opacity 0.15s;

  &:hover:not(:disabled) {
    opacity: 0.85;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const BackupRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
`;

const BackupHint = styled.p`
  font-size: 11.5px;
  color: ${({ theme }) =>
    theme.colors.textSecondary ?? "rgba(255,255,255,0.55)"};
  margin: 0;
  line-height: 1.5;
`;

// ─── Types ────────────────────────────────────────────────────────────────────

interface ReplaceKeyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  majik: MajikBuwizDatabase;
  onSuccess: () => void;
}

const EMPTY_MNEMONIC: MnemonicJSON = {
  id: "",
  seed: Array(12).fill(""),
  phrase: "",
};

// ─── Component ────────────────────────────────────────────────────────────────

export const ReplaceKeyModal: React.FC<ReplaceKeyModalProps> = React.memo(
  ({ open, onOpenChange, majik, onSuccess }) => {
    const [passphrase, setPassphrase] = useState("");
    const [mnemonic, setMnemonic] = useState("");
    const [mnemonicJSON, setMnemonicJSON] =
      useState<MnemonicJSON>(EMPTY_MNEMONIC);
    const [importMode, setImportMode] = useState<"drop" | "manual">("drop");

    /** true = clear invoices after key swap, false = keep them */
    const [clearInvoices, setClearInvoices] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const [backupDownloaded, setBackupDownloaded] = useState(false);

    // Reset all state when modal opens
    useEffect(() => {
      if (open) {
        setPassphrase("");
        setMnemonic("");
        setMnemonicJSON(EMPTY_MNEMONIC);
        setImportMode("drop");
        setClearInvoices(false);
        setIsDownloading(false);
        setBackupDownloaded(false);
      }
    }, [open]);

    const handleClear = useCallback(() => {
      setMnemonicJSON(EMPTY_MNEMONIC);
      setMnemonic("");
      setPassphrase("");
    }, []);

    // When the user toggles back to "keep", reset the downloaded flag
    const handleToggleClear = useCallback((value: boolean) => {
      setClearInvoices(value);
      if (!value) setBackupDownloaded(false);
    }, []);

    /** Download the invoice backup before clearing */
    const handleDownloadBackup = useCallback(async () => {
      setIsDownloading(true);
      try {
        const backupBlob = majik.backupInvoices();
        const blobBuffer = await backupBlob.arrayBuffer();

        const activeAccount = majik.getActiveAccount();

        const backupFileName = `${activeAccount?.meta.label || activeAccount?.id || "User"}  - Invoice Backup`;

        const filePath = await save({
          defaultPath: backupFileName,
          filters: [{ name: "Majik Backup", extensions: ["mjkbackup"] }],
        });

        if (!filePath) {
          downloadBlob(backupBlob, "mjkbackup", backupFileName);
        } else {
          await writeFile(filePath, new Uint8Array(blobBuffer));
        }

        setBackupDownloaded(true);
        toast.success("Invoice backup saved", {
          description:
            "Your invoices have been exported. You can now proceed with the key replacement.",
        });
      } catch (err) {
        toast.error("Backup failed", {
          description: (err as any)?.message ?? `${err}`,
        });
      } finally {
        setIsDownloading(false);
      }
    }, [majik]);

    // Confirm is blocked when:
    // 1. Key import data is incomplete
    // 2. User chose "clear" but hasn't downloaded the backup yet
    const isConfirmDisabled =
      !mnemonicJSON?.id?.trim() ||
      !passphrase?.trim() ||
      (clearInvoices && !backupDownloaded);

    const handleConfirm = useCallback(async () => {
      if (isConfirmDisabled) return;
      try {
        await majik.replaceAccountFromMnemonicBackup(
          mnemonicJSON.id,
          mnemonic.trim(),
          passphrase,
          undefined,
        );

        if (clearInvoices) {
          if (!backupDownloaded) {
            await handleDownloadBackup();
          }
          majik.clearInvoices?.();
        }

        onOpenChange(false);
        onSuccess();
        toast.success("Key account replaced", {
          description: clearInvoices
            ? "Your local key has been updated and invoices have been cleared."
            : "Your local key now matches the bound MUID key.",
        });
      } catch (err) {
        toast.error("Replace failed", {
          description: (err as any)?.message || `${err}`,
        });
      }
    }, [
      majik,
      mnemonicJSON,
      mnemonic,
      passphrase,
      clearInvoices,
      isConfirmDisabled,
      onOpenChange,
      onSuccess,
    ]);

    const handleCancel = useCallback(() => onOpenChange(false), [onOpenChange]);

    return (
      <DynamicPopUp
        scrollable
        isOpen={open}
        onOpenChange={onOpenChange}
        modal={{
          title: "Switch to Another Key",
          description:
            "Import the backup for the key bound to your MUID. This will replace your current local account.",
        }}
        buttons={{
          cancel: { text: "Cancel", onClick: handleCancel },
          confirm: {
            text: "Replace Key",
            isDisabled: isConfirmDisabled,
            onClick: handleConfirm,
          },
        }}
      >
        {/* ── Key replacement warning ── */}
        <DynamicAlertBanner
          level="warning"
          title="Warning"
          description="Your current local key will be removed. Make sure you have its backup before continuing."
        />

        {/* ── Import mode toggle ── */}
        <ImportModeToggle>
          <ModeToggleButton
            $active={importMode === "drop"}
            onClick={() => setImportMode("drop")}
            type="button"
          >
            <UploadSimpleIcon size={12} /> Backup file
          </ModeToggleButton>
          <ModeToggleButton
            $active={importMode === "manual"}
            onClick={() => setImportMode("manual")}
            type="button"
          >
            <KeyboardIcon size={12} /> Enter manually
          </ModeToggleButton>
        </ImportModeToggle>

        {importMode === "drop" ? (
          <DropImportAccount
            passphrase={passphrase}
            onPassphraseChange={(v) => setPassphrase(v?.trim() ? v : "")}
            mnemonicJSON={mnemonicJSON}
            onFileLoaded={(json) => {
              setMnemonicJSON(json);
              setMnemonic(jsonToSeed(json));
            }}
            onClear={handleClear}
          />
        ) : (
          <SeedKeyInput
            importProp={{ type: "json" }}
            requireBackupKey
            onUpdatePassphrase={(v) => setPassphrase(v?.trim() ? v : "")}
            onChange={(input) => {
              if (!input) return;
              setMnemonicJSON(input);
              setMnemonic(jsonToSeed(input));
            }}
            readonly={false}
            currentValue={{ ...mnemonicJSON, phrase: passphrase }}
          />
        )}

        <Divider />

        {/* ── Invoice handling section ── */}
        <SectionLabel>Existing Invoices</SectionLabel>

        <InvoiceRow>
          <WarningIcon
            size={18}
            weight="fill"
            color="var(--color-warning, #f5a623)"
            style={{ flexShrink: 0, marginTop: 1 }}
          />
          <InvoiceRowContent>
            <InvoiceRowTitle>
              Invoices signed or encrypted with your current key
            </InvoiceRowTitle>
            <InvoiceRowDesc>
              After switching keys, <strong>encrypted invoices</strong> will no
              longer be decryptable and <strong>signed invoices</strong> that
              are not yet sealed cannot be re-signed or edited. Choose whether
              to keep or clear them below.
            </InvoiceRowDesc>
          </InvoiceRowContent>
        </InvoiceRow>

        <ToggleWrapper>
          <CustomToggleSwitch
            key="ifNameSuffix"
            label="Clear Invoices"
            currentToggle={clearInvoices}
            onToggle={handleToggleClear}
            helper="Clear invoices after key switch"
          />
        </ToggleWrapper>

        {/* Keep — informational notice */}
        {!clearInvoices && (
          <DynamicAlertBanner
            level="info"
            title="Invoices will be kept"
            description="Your invoices remain in the app but encrypted invoices will be unreadable and finalized-but-unsigned invoices cannot be re-signed with the new key."
          />
        )}

        {/* Clear — require backup download first */}
        {clearInvoices && (
          <>
            <DynamicAlertBanner
              level="error"
              title="Invoices will be cleared"
              description="All local invoices will be permanently deleted after the key is replaced. Download a backup first — you will not be able to recover them otherwise."
            />
            <BackupRow>
              <BackupHint>
                {backupDownloaded
                  ? "Backup saved. You can now proceed."
                  : "You must download a backup before continuing."}
              </BackupHint>
              <BackupButton
                type="button"
                $downloaded={backupDownloaded}
                disabled={backupDownloaded || isDownloading}
                onClick={handleDownloadBackup}
              >
                {backupDownloaded ? (
                  <>
                    <CheckCircleIcon size={14} weight="fill" />
                    Backup saved
                  </>
                ) : (
                  <>
                    <DownloadSimpleIcon size={14} />
                    {isDownloading ? "Saving…" : "Download backup"}
                  </>
                )}
              </BackupButton>
            </BackupRow>
          </>
        )}
      </DynamicPopUp>
    );
  },
);

ReplaceKeyModal.displayName = "ReplaceKeyModal";
