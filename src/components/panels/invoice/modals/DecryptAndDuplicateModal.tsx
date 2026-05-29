/**
 * modals/DecryptAndDuplicateModal.tsx
 *
 * Shown when a user wants to duplicate an encrypted invoice that belongs to
 * a different account. The user provides the original account's backup file
 * and passphrase so we can reconstruct the MajikKey locally, decrypt the
 * invoice, and hand a clean duplicate back to the manager.
 *
 * The reconstructed key is never registered in the keystore — it is used
 * only for the single duplicate() call and then discarded.
 */

import React, { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { UploadSimpleIcon, KeyboardIcon } from "@phosphor-icons/react";
import { MajikKey } from "@majikah/majik-key";
import type { MajikInvoice } from "@majikah/majik-invoice";

import {
  jsonToSeed,
  type MnemonicJSON,
} from "@/SDK/majik-buwiz-client/src/index";

import { MajikBuwizDatabase } from "@/components/majik-context-wrapper/majik-buwiz-database";
import DynamicPopUp from "@/components/functional/DynamicPopUp";
import DropImportAccount from "@/components/foundations/DropImportAccount";
import { SeedKeyInput } from "@/components/foundations/SeedKeyInput";
import { ImportModeToggle, ModeToggleButton } from "../../shared/atoms";

interface DecryptAndDuplicateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: MajikInvoice | null;
  majik: MajikBuwizDatabase;
  /** Called with the clean duplicate once decryption + duplication succeeds. */
  onDuplicated: (duplicate: MajikInvoice) => void;
}

const EMPTY_MNEMONIC: MnemonicJSON = {
  id: "",
  seed: Array(12).fill(""),
  phrase: "",
};

export const DecryptAndDuplicateModal: React.FC<DecryptAndDuplicateModalProps> =
  React.memo(({ open, onOpenChange, invoice, majik, onDuplicated }) => {
    const [passphrase, setPassphrase] = useState("");
    const [mnemonic, setMnemonic] = useState("");
    const [mnemonicJSON, setMnemonicJSON] =
      useState<MnemonicJSON>(EMPTY_MNEMONIC);
    const [importMode, setImportMode] = useState<"drop" | "manual">("drop");
    const [isWorking, setIsWorking] = useState(false);

    // Reset all form state whenever modal opens
    useEffect(() => {
      if (open) {
        setPassphrase("");
        setMnemonic("");
        setMnemonicJSON(EMPTY_MNEMONIC);
        setImportMode("drop");
        setIsWorking(false);
      }
    }, [open]);

    const handleDropClear = useCallback(() => {
      setMnemonicJSON(EMPTY_MNEMONIC);
      setMnemonic("");
      setPassphrase("");
    }, []);

    const handleDropFileLoaded = useCallback((json: MnemonicJSON) => {
      setMnemonicJSON(json);
      setMnemonic(jsonToSeed(json));
    }, []);

    const handleSeedKeyChange = useCallback((input: MnemonicJSON) => {
      if (!input) return;
      setMnemonicJSON(input);
      setMnemonic(jsonToSeed(input));
    }, []);

    const handleConfirm = useCallback(async () => {
      if (!invoice) return;
      if (!mnemonicJSON?.id?.trim() || !mnemonicJSON?.seed || mnemonicJSON.seed.length === 0) {
        toast.error("Please provide a backup file.");
        return;
      }

      setIsWorking(true);
      try {
        // Reconstruct the original key locally — never stored in the keystore
        const originalKey = await MajikKey.fromMnemonicJSON(mnemonicJSON, mnemonicJSON?.phrase || "default");

        const duplicate = await majik.duplicateInvoice(invoice, {
          account: originalKey,
        });

        onDuplicated(duplicate);
        onOpenChange(false);
        toast.success("Invoice duplicated successfully.");
      } catch (err) {
        toast.error("Duplication failed", {
          description:
            err instanceof Error
              ? err.message
              : "Could not decrypt with the provided key.",
        });
      } finally {
        setIsWorking(false);
      }
    }, [
      invoice,
      majik,
      mnemonicJSON,
      mnemonic,
      passphrase,
      onDuplicated,
      onOpenChange,
    ]);

    const handleCancel = useCallback(() => onOpenChange(false), [onOpenChange]);

    const confirmDisabled =
      isWorking || !mnemonicJSON?.id?.trim() || mnemonicJSON.seed.length === 0;

    return (
      <DynamicPopUp
        isOpen={open}
        onOpenChange={onOpenChange}
        scrollable
        modal={{
          title: "Duplicate Encrypted Invoice",
          description:
            "This invoice was encrypted with a different account key. " +
            "Load that account's backup to decrypt and duplicate it.",
        }}
        buttons={{
          cancel: { text: "Cancel", onClick: handleCancel },
          confirm: {
            text: isWorking ? "Decrypting…" : "Decrypt & Duplicate",
            isDisabled: confirmDisabled,
            onClick: handleConfirm,
          },
        }}
      >
        <ImportModeToggle>
          <ModeToggleButton
            $active={importMode === "drop"}
            onClick={() => {
              setImportMode("drop");
              handleDropClear();
            }}
            type="button"
          >
            <UploadSimpleIcon size={12} /> Backup file
          </ModeToggleButton>
          <ModeToggleButton
            $active={importMode === "manual"}
            onClick={() => {
              setImportMode("manual");
              handleDropClear();
            }}
            type="button"
          >
            <KeyboardIcon size={12} /> Enter manually
          </ModeToggleButton>
        </ImportModeToggle>

        {importMode === "drop" ? (
          <DropImportAccount
            mnemonicJSON={mnemonicJSON}
            onFileLoaded={handleDropFileLoaded}
            onClear={handleDropClear}
          />
        ) : (
          <SeedKeyInput
            importProp={{ type: "json" }}
            requireBackupKey
            onUpdatePassphrase={(v) => setPassphrase(v?.trim() ? v : "")}
            onChange={handleSeedKeyChange}
            readonly={false}
            currentValue={{ ...mnemonicJSON, phrase: passphrase }}
          />
        )}
      </DynamicPopUp>
    );
  });

DecryptAndDuplicateModal.displayName = "DecryptAndDuplicateModal";
