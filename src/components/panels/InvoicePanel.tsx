/**
 * InvoicePanel.tsx
 *
 * State machine:
 *
 *   "draft"       → GeneralInvoice in-memory only. Edit freely. "Finalize"
 *                   button opens the configure modal.
 *
 *   "configuring" → Modal open: user picks mode (signed-only /
 *                   encrypted-and-signed) and recipients/signers. Confirm
 *                   triggers: MajikInvoice.create → sign → encrypt (if needed)
 *                   → store → transition to "finalized".
 *
 *   "finalized"   → MajikInvoice stored. Still editable (edit → reissue+resign
 *                   in one shot, no modal needed since mode/recipients are
 *                   already configured). Seal button available in the sidebar.
 *
 *   "sealed"      → Fully readonly. Sidebar shows seal info only.
 *
 * initialInvoice:
 *   - Not provided  → start in "draft" with a blank GeneralInvoice
 *   - MajikInvoice, not sealed → start in "finalized"
 *   - MajikInvoice, sealed → start in "sealed"
 */

import {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
  useImperativeHandle,
  forwardRef,
} from "react";
import styled from "styled-components";
import {
  ShieldCheckIcon,
  UserFocusIcon,
  GearIcon,
  ArrowClockwiseIcon,
  PenNibIcon,
  LockKeyIcon,
  CheckCircleIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";

import { GeneralInvoice, MajikInvoice } from "@majikah/majik-invoice";
import type {
  InvoiceStatus,
  MajikInvoiceMode,
  ProofOfPayment,
} from "@majikah/majik-invoice";

import MajikInvoiceContactListSelector from "../MajikContactListSelector";
import { MajikInvoiceDocument } from "../functional/MajikInvoiceDocument/MajikInvoiceDocument";
import DynamicPopUp from "../functional/DynamicPopUp";
import { InvoiceSettings } from "./invoice/InvoiceSettings";
import { InvoiceDefaults } from "@/SDK/majik-buwiz-client/src/core/storage/client-state/_types";
import { toast } from "sonner";
import { computeDueDateFromTerm } from "../functional/MajikInvoiceDocument/_utils";
import { MajikInvoiceContact } from "@/SDK/majik-buwiz-client/src/core/party/majik-invoice-contact";
import { useMajikah } from "../majikah-session-wrapper/use-majikah";
import { SignerInfo } from "../functional/MajikInvoiceDocument/SignatureBlock";
import { MajikBuwizDatabase } from "../majik-context-wrapper/majik-buwiz-database";
import GuideHelper from "../functional/GuideHelper";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PanelState = "draft" | "configuring" | "finalized" | "sealed";

// ---------------------------------------------------------------------------
// Styled
// ---------------------------------------------------------------------------

const PanelRoot = styled.div`
  display: flex;
  height: auto;
  background: ${({ theme }) => theme.colors.primaryBackground};
  color: ${({ theme }) => theme.colors.textPrimary};
`;

const Sidebar = styled.aside`
  width: 400px;
  border-right: 1px solid ${({ theme }) => theme.colors.primary}15;
  background: ${({ theme }) => theme.colors.secondaryBackground};
  display: flex;
  flex-direction: column;
  padding: 1.5rem;
  gap: 2rem;
  overflow-y: auto;
`;

const MainContent = styled.main`
  flex: 1;
  padding: 2rem;
  background: ${({ theme }) => theme.colors.primaryBackground};
`;

const Section = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const Label = styled.div`
  font-size: 11px;
  font-family: ${({ theme }) => theme.typography.fonts.semibold};
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: ${({ theme }) => theme.colors.primary};
  display: flex;
  align-items: center;
  gap: 6px;
`;

const ModeToggle = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  background: ${({ theme }) => theme.colors.primaryBackground};
  padding: 4px;
  border-radius: ${({ theme }) => theme.borders.radius.medium};
  border: 1px solid ${({ theme }) => theme.colors.secondaryBackground};
`;

const ModeBtn = styled.button<{ $active: boolean }>`
  border: none;
  padding: 8px;
  font-size: 12px;
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  border-radius: ${({ theme }) => theme.borders.radius.small};
  cursor: pointer;
  transition: all 0.2s;
  background: ${({ $active, theme }) =>
    $active ? theme.colors.secondaryBackground : "transparent"};
  color: ${({ $active, theme }) =>
    $active ? theme.colors.primary : theme.colors.textSecondary};
  box-shadow: ${({ $active }) =>
    $active ? "0 2px 4px rgba(0,0,0,0.05)" : "none"};

  &:hover {
    color: ${({ theme }) => theme.colors.primary};
  }
`;

const InfoBox = styled.div`
  padding: 12px;
  background: ${({ theme }) => theme.colors.primarySoft};
  border-radius: ${({ theme }) => theme.borders.radius.medium};
  font-size: 12px;
  line-height: 1.5;
  color: ${({ theme }) => theme.colors.textSecondary};
  border-left: 3px solid ${({ theme }) => theme.colors.primary};
`;

const PrimaryButton = styled.button`
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  font-size: 12px;
  padding: 9px 14px;
  border-radius: ${({ theme }) => theme.borders.radius.medium};
  background: ${({ theme }) => theme.gradients.primary};
  border: 1px solid transparent;
  color: ${({ theme }) => theme.colors.static.white};
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  width: 100%;
  transition: filter 0.15s;

  &:hover:not(:disabled) {
    filter: brightness(1.08);
  }
  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
`;

const GhostButton = styled.button`
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  font-size: 12px;
  padding: 9px 14px;
  border-radius: ${({ theme }) => theme.borders.radius.medium};
  background: transparent;
  border: 1px solid ${({ theme }) => theme.colors.primary}33;
  color: ${({ theme }) => theme.colors.textSecondary};
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  width: 100%;
  transition: all 0.15s;

  &:hover:not(:disabled) {
    background: ${({ theme }) => theme.colors.primarySoft};
    color: ${({ theme }) => theme.colors.primary};
    border-color: ${({ theme }) => theme.colors.primary};
  }
  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
`;

const SealButton = styled.button`
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  font-size: 12px;
  padding: 9px 14px;
  border-radius: ${({ theme }) => theme.borders.radius.medium};
  background: ${({ theme }) => theme.colors.primarySoft};
  border: 1px solid ${({ theme }) => theme.colors.primary}44;
  color: ${({ theme }) => theme.colors.primary};
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  width: 100%;
  transition: all 0.15s;

  &:hover:not(:disabled) {
    filter: brightness(0.95);
  }
  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
`;

const ErrorNote = styled.div`
  font-size: 11px;
  color: ${({ theme }) => theme.colors.error};
  margin-top: 4px;
`;

const SealedInfo = styled.div`
  padding: 14px;
  background: ${({ theme }) => theme.colors.primarySoft};
  border-radius: ${({ theme }) => theme.borders.radius.medium};
  border: 1px solid ${({ theme }) => theme.colors.primary}33;
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const SealedRow = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const SealedRowLabel = styled.div`
  font-size: 10px;
  font-family: ${({ theme }) => theme.typography.fonts.light};
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: ${({ theme }) => theme.colors.textSecondary};
`;

const SealedRowValue = styled.div`
  font-size: 11px;
  font-family: ${({ theme }) => theme.typography.fonts.numbers};
  color: ${({ theme }) => theme.colors.textPrimary};
  word-break: break-all;
`;

// ---------------------------------------------------------------------------
// Configure Modal Styled
// ---------------------------------------------------------------------------

const ConfigureBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 4px 0;
`;

const ConfigSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const ConfigLabel = styled.div`
  font-size: 11px;
  font-family: ${({ theme }) => theme.typography.fonts.semibold};
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: ${({ theme }) => theme.colors.primary};
`;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

/** Imperative handle exposed to InvoicesManager via a ref. */
export interface InvoicePanelHandle {
  /** (existing) Applies a status transition, reissues + re-signs. */
  applyStatusTransition: (to: InvoiceStatus) => Promise<void>;

  /**
   * (NEW) Accepts a GeneralInvoice that already has addPayment() called on it
   * (by StatusQuickActions), reissues + re-signs the MajikInvoice, stores it,
   * and calls onUpdate.
   *
   * The status on updatedGi was set automatically by addPayment() — no manual
   * status field needed.
   */
  applyPayment: (updatedGi: GeneralInvoice) => Promise<void>;
  refresh: (inv: MajikInvoice) => Promise<void>; // ← was void
  /** Receive an updated MajikInvoice from the manager without forcing a remount. */
  receiveUpdate: (inv: MajikInvoice) => Promise<void>;
}

interface InvoicePanelProps {
  majik: MajikBuwizDatabase;
  /** If provided, panel opens in finalized or sealed state */
  initialInvoice?: MajikInvoice;

  initialDraft?: GeneralInvoice;
  /** Forces readonly regardless of state (used by InvoicesManager view mode) */
  readonly?: boolean;
  /** Called after any mutation that produces a new MajikInvoice */
  onUpdate?: (updated: MajikInvoice) => void;

  /**
   * When true AND onSign is provided, renders the SignatureBlock CTA at the
   * bottom of the document. Defaults to false.
   */
  canSign?: boolean;

  onSign?: (invoice: MajikInvoice) => void;

  /** Called when user closes (seal=false) or closes+seals (seal=true) */
  onCloseInvoice?: (seal?: boolean) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const InvoicePanel = forwardRef<InvoicePanelHandle, InvoicePanelProps>(
  function InvoicePanel(
    {
      majik,
      initialInvoice,
      initialDraft,
      readonly = false,
      onUpdate,
      canSign = false,
      onSign,
      onCloseInvoice,
    },
    ref,
  ) {
    const { majikah } = useMajikah();

    // ── Panel state machine ───────────────────────────────────────────────────

    const deriveInitialState = (): PanelState => {
      if (!initialInvoice) return "draft";
      if (initialInvoice.isSealed) return "sealed";
      return "finalized";
    };

    const [panelState, setPanelState] =
      useState<PanelState>(deriveInitialState);

    /**
     * workingDraft: the GeneralInvoice being edited.
     * - In "draft" state: this is the only thing that exists
     * - In "finalized" state: this is a copy unwrapped from the MajikInvoice,
     *   used for in-place editing before reissue+resign on save
     */
    const [workingDraft, setWorkingDraft] = useState<GeneralInvoice | null>(
      initialDraft ?? null,
    );

    /** The stored MajikInvoice — provided by parent via props. */
    const majikInvoice = initialInvoice ?? null;

    const [isDirty, setIsDirty] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const [isLoading, setIsLoading] = useState<boolean>(!initialInvoice);

    // ── Finalize / configure modal ────────────────────────────────────────────

    const [isConfigureOpen, setIsConfigureOpen] = useState(false);
    const [configMode, setConfigMode] =
      useState<MajikInvoiceMode>("signed-only");
    const [configRecipients, setConfigRecipients] = useState<
      MajikInvoiceContact[]
    >(() => {
      const active = majik.getActiveAccount();
      return active ? [active] : [];
    });
    const [isFinalizing, setIsFinalizing] = useState(false);
    const [finalizeError, setFinalizeError] = useState<string | null>(null);

    // ── Seal ──────────────────────────────────────────────────────────────────

    const [isSealing, setIsSealing] = useState(false);
    const [sealError, setSealError] = useState<string | null>(null);
    const [canSealInvoice, setCanSealInvoice] = useState(false);

    useEffect(() => {
      if (!majikInvoice || majikInvoice.isSealed) {
        setCanSealInvoice(false);
        return;
      }
      let cancelled = false;
      majik.canSealInvoice(majikInvoice).then(({ permitted }) => {
        if (!cancelled) setCanSealInvoice(permitted);
      });
      return () => {
        cancelled = true;
      };
    }, [majik, majikInvoice]);

    // After signerInfo useMemo:

    const isIssuer = useMemo(() => {
      if (!majikInvoice) return false;
      if (!majikInvoice?.userId?.trim()) return true;
      const activeAccount = majik.getActiveAccount();
      const majikahAccount = majikah.user?.id;
      if (!majikahAccount) return false;
      if (!activeAccount) return false;
      // The issuer's signerId is stored on the first expected signer, or
      // we can match against the issuer fingerprint on the public header.
      return majikInvoice.userId === majikahAccount;
    }, [majik, majikInvoice]);

    // ── Settings modal ────────────────────────────────────────────────────────

    const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);

    // InvoicePanel — don't store settings in state at all
    const invoiceSettingsRef = useRef<InvoiceDefaults | null>(null);

    // ── Contacts ──────────────────────────────────────────────────────────────

    const availableContacts = useMemo(() => majik.listContacts(true), [majik]);
    const groups = useMemo(() => majik.listContactGroups(true), [majik]);

    const signerInfo: SignerInfo | undefined = useMemo(() => {
      const activeAccount = majik.getActiveAccount();
      if (!activeAccount) return undefined;
      const infoData: SignerInfo = {
        signerId: activeAccount.fingerprint,
        displayName: activeAccount.meta.legalName,
      };

      return infoData;
    }, [majik]);

    useEffect(() => {
      async function initRecipientContacts() {
        try {
          if (!majikInvoice) return;

          if (majikInvoice.isEncrypted) {
            const invoiceRecipientPubKeys = majikInvoice.recipients;

            if (!invoiceRecipientPubKeys) return;

            const invoiceContacts = await majik.getContactsByPublicKey(
              invoiceRecipientPubKeys,
            );

            setConfigRecipients(invoiceContacts);
          } else {
            const invoiceSigners = majikInvoice.integrity.expectedSigners?.map(
              (signer) => signer.signerId,
            );

            if (!invoiceSigners) return;

            const invoiceContacts = majik.getContactsByID(invoiceSigners);

            setConfigRecipients(invoiceContacts);
          }
        } catch (err) {
          console.error("Failed to get invoice recipients", err);
        } finally {
          setIsLoading(false);
        }
      }

      initRecipientContacts();
    }, [majik, majikInvoice]);

    // ── Init — only runs when no initialInvoice (new invoice flow) ────────────

    useEffect(() => {
      if (initialInvoice) {
        // Unwrap GeneralInvoice from the existing MajikInvoice for editing
        if (!initialInvoice.isSealed && !initialInvoice.isEncrypted) {
          try {
            setWorkingDraft(initialInvoice.invoice);
          } catch {
            // encrypted+locked: workingDraft stays null until decrypted
          }
        }
        setIsLoading(false);
        return;
      }

      if (initialDraft) {
        setWorkingDraft(initialDraft);
        setIsLoading(false);
        return;
      }

      async function initDraft() {
        try {
          const defaults = await majik.getInvoiceDefaults();
          const draft = GeneralInvoice.create({
            issuer: {
              legalName: defaults?.issuer?.legalName ?? "New Entity",
              email: defaults?.issuer?.email ?? "business@majikah.solutions",
              tradeName: defaults?.issuer?.tradeName,
              tin: defaults?.issuer?.tin,
            },
            recipient: { legalName: "Draft Client" },
            currency: defaults?.currency ?? "PHP",
            lineItems: [
              {
                unitPrice: 0,
                description: "A new item",
                quantity: 1,
                unit: "piece",
              },
            ],
            defaultTaxes: defaults?.defaultTaxes ?? [
              {
                rate: 0.12,
                taxType: "VAT",
                jurisdiction: "PH",
              },
            ],
            paymentTerms: defaults?.paymentTerms,
            notes: defaults?.notes,
            invoiceNumber: `${defaults?.invoiceNumberPrefix ?? "INV-"}${defaults?.invoiceNumberCounter ?? 0}`,
          });
          setWorkingDraft(draft);
        } catch (err) {
          console.error("Failed to initialize draft invoice", err);
        } finally {
          setIsLoading(false);
        }
      }

      initDraft();
    }, [majik, initialInvoice]);

    // Replaces handleEdit for field-level changes
    const handleFieldChange = useCallback(
      (updated: GeneralInvoice) => {
        setWorkingDraft(updated);
        setIsDirty(true);
      },
      [initialInvoice, initialDraft, majik],
    );

    // ── Draft onChange ────────────────────────────────────────────────────────

    const handleDraftChange = useCallback((updated: GeneralInvoice) => {
      setWorkingDraft(updated);
    }, []);

    const handleSaveChanges = useCallback(async () => {
      if (!majikInvoice || !workingDraft || !isDirty) return;
      setIsSaving(true);
      try {
        const contactRecipientIds = configRecipients.map(
          (contact) => contact.id,
        );

        const resigned = await majik.reissueInvoice(
          majikInvoice,
          workingDraft,
          {
            recipientContactIds: contactRecipientIds,
          },
        );

        setIsDirty(false);
        // Update local working draft to reflect the newly-signed invoice.
        try {
          setWorkingDraft(
            resigned.mode === "signed-only" ? resigned.invoice : null,
          );
        } catch {
          setWorkingDraft(null);
        }
        // Let the manager own the persisted MajikInvoice state and decryption.
        onUpdate?.(resigned);
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to save changes.",
        );
      } finally {
        setIsSaving(false);
      }
    }, [
      majikInvoice,
      workingDraft,
      isDirty,
      majik,
      configRecipients,
      onUpdate,
    ]);

    useImperativeHandle(
      ref,
      () => ({
        refresh: async (inv: MajikInvoice) => {
          // Sync panelState from the provided invoice and update the
          // working draft only if the invoice is available in plaintext
          // (or already has a decrypted cache). Do not attempt to
          // auto-decrypt here; the manager is responsible for that.
          if (!inv) {
            setPanelState("draft");
            setWorkingDraft(initialDraft ?? null);
            setIsDirty(false);
            return;
          }

          if (inv.isSealed) {
            setPanelState("sealed");
          } else {
            setPanelState("finalized");
          }

          try {
            if (!inv.isEncrypted || inv.hasDecryptedCache) {
              setWorkingDraft(inv.invoice);
            } else {
              setWorkingDraft(null);
            }
          } catch {
            setWorkingDraft(null);
          }
          setIsDirty(false);
        },
        receiveUpdate: async (inv: MajikInvoice) => {
          // If the user has unsaved changes, do not stomp their work.
          if (isDirty) return;
          if (!inv) return;
          setPanelState(inv.isSealed ? "sealed" : "finalized");
          try {
            if (!inv.isEncrypted || inv.hasDecryptedCache) {
              setWorkingDraft(inv.invoice);
            } else {
              setWorkingDraft(null);
            }
          } catch {
            setWorkingDraft(null);
          }
          setIsLoading(false);
        },
        // ── existing ──
        async applyStatusTransition(to: InvoiceStatus) {
          if (panelState !== "finalized") {
            throw new Error(
              `[InvoicePanel] Cannot transition status in panel state "${panelState}".`,
            );
          }
          if (!majikInvoice) throw new Error("[InvoicePanel] No MajikInvoice.");
          if (majikInvoice.isLocked) {
            throw new Error("[InvoicePanel] Invoice encrypted and locked.");
          }

          const gi = majikInvoice.invoice;
          if (!gi)
            throw new Error("[InvoicePanel] Cannot unwrap GeneralInvoice.");

          const resigned = await majik.reissueSignAndStore(
            majikInvoice,
            gi.withStatus(to),
            configRecipients.map((c) => c.id),
          );

          // In applyStatusTransition and applyPayment — reorder these three lines:
          setIsDirty(false);
          try {
            setWorkingDraft(resigned.invoice);
          } catch {
            setWorkingDraft(null);
          }
          onUpdate?.(resigned);
        },

        // ── NEW ──
        async applyPayment(updatedGi: GeneralInvoice) {
          if (panelState !== "finalized") {
            throw new Error(
              `[InvoicePanel] Cannot apply payment in panel state "${panelState}".`,
            );
          }
          if (!majikInvoice) throw new Error("[InvoicePanel] No MajikInvoice.");
          if (majikInvoice.isLocked) {
            throw new Error(
              "[InvoicePanel] Invoice encrypted and locked — decrypt first.",
            );
          }

          const resigned = await majik.reissueSignAndStore(
            majikInvoice,
            updatedGi, // already has payment + status from addPayment()
            configRecipients.map((c) => c.id),
          );

          // In applyStatusTransition and applyPayment — reorder these three lines:
          setIsDirty(false);
          try {
            setWorkingDraft(resigned.invoice);
          } catch {
            setWorkingDraft(null);
          }
          onUpdate?.(resigned);
        },
      }),
      [
        panelState,
        majikInvoice,
        majik,
        configRecipients,
        workingDraft,
        onUpdate,
      ],
    );

    const handleDiscardChanges = useCallback(async () => {
      if (!majikInvoice) return;
      // Reset draft
      setWorkingDraft(majikInvoice.invoice);
      // Reset recipients back to what's stored on the invoice
      const storedContacts = await majik.getContactsByPublicKey(
        majikInvoice.recipients ?? [],
      );
      setConfigRecipients(storedContacts);
      setIsDirty(false);
    }, [majikInvoice, majik]);

    // ── Finalize — opens configure modal ─────────────────────────────────────

    const handleFinalizeClick = () => {
      setFinalizeError(null);
      setIsConfigureOpen(true);
    };

    // ── Configure confirm — create + sign + encrypt ───────────────────────────

    const handleConfigureConfirm = async () => {
      if (!workingDraft) return;
      setIsFinalizing(true);
      setFinalizeError(null);

      try {
        const activeAccountKey = majik.getActiveAccountKey();
        if (!activeAccountKey) throw new Error("No active account key.");

        if (configRecipients.length === 0) {
          throw new Error("Add at least one recipient for encrypted mode.");
        }

        const signed = await majik.finalizeInvoice(
          workingDraft,
          configMode,
          configRecipients.map((c) => c.id),
          { userId: majikah.user?.id },
        );

        setWorkingDraft(configMode === "signed-only" ? signed.invoice : null); // keep working draft in sync
        setPanelState("finalized");
        setIsConfigureOpen(false);
        onUpdate?.(signed);
      } catch (err) {
        console.error("Finalization failed:", err);
        setFinalizeError(
          err instanceof Error ? err.message : "Finalization failed.",
        );
      } finally {
        setIsFinalizing(false);
      }
    };

    // ── Edit (finalized state) — reissue + resign in one shot ─────────────────

    // ── Mode change (post-finalize, in finalized state) ───────────────────────

    const handleModeChange = async (newMode: MajikInvoiceMode) => {
      if (readonly) return;

      if (
        !majikInvoice ||
        majikInvoice.mode === newMode ||
        panelState !== "finalized"
      )
        return;

      // If switching to encrypted, we need recipients
      if (newMode === "encrypted-and-signed" && configRecipients.length === 0) {
        toast.error(
          "Add at least one recipient before switching to encrypted mode.",
        );
        return;
      }

      try {
        let resigned = await majik.switchInvoiceMode(
          majikInvoice,
          newMode,
          configRecipients.map((c) => c.id),
        );

        if (resigned.isEncrypted) {
          resigned = await majik.unlockInvoice(resigned);
        }

        try {
          setWorkingDraft(resigned.invoice);
        } catch {
          setWorkingDraft(null);
        }
        onUpdate?.(resigned);
      } catch (err) {
        console.error("Mode switch failed:", err);
        toast.error(err instanceof Error ? err.message : "Mode switch failed.");
      }
    };

    // ── Seal ──────────────────────────────────────────────────────────────────

    const handleSeal = async () => {
      if (readonly) return;
      if (!majikInvoice) return;
      setIsSealing(true);
      setSealError(null);
      try {
        const sealed = await majik.sealInvoice(majikInvoice);
        setPanelState("sealed");
        try {
          setWorkingDraft(null);
        } catch {}
        onUpdate?.(sealed);
      } catch (err) {
        setSealError(err instanceof Error ? err.message : "Seal failed.");
      } finally {
        setIsSealing(false);
      }
    };

    // ── Recipients update (post-finalize) ────────────────────────────────────

    // Replace the current handleRecipientsUpdate:
    const handleRecipientsUpdate = useCallback(
      (selected: MajikInvoiceContact[]) => {
        if (readonly || panelState === "sealed") return; // ← guard
        setConfigRecipients(selected);
        if (panelState === "finalized") setIsDirty(true); // ← flag dirty
      },
      [readonly, panelState],
    );

    // ── Settings ──────────────────────────────────────────────────────────────

    const handleSaveInvoiceSettings = async () => {
      const invoiceSettings = invoiceSettingsRef.current;
      if (!invoiceSettings) return;
      try {
        await majik.setInvoiceDefaults(invoiceSettings);
        // Re-apply to working draft if still in draft state
        if (panelState === "draft") {
          const draft = GeneralInvoice.create({
            issuer: {
              legalName: invoiceSettings.issuer?.legalName ?? "New Entity",
              email:
                invoiceSettings.issuer?.email ?? "business@majikah.solutions",
              tradeName: invoiceSettings.issuer?.tradeName,
              tin: invoiceSettings.issuer?.tin,
            },
            recipient: workingDraft?.recipient ?? { legalName: "Draft Client" },
            currency: invoiceSettings.currency ?? "PHP",
            lineItems: workingDraft?.lineItems.map((li) => ({
              id: li.id,
              description: li.description,
              quantity: li.quantity,
              unitPrice: li.unitPrice.toMajor(),
              unit: li.unit,
              taxes: invoiceSettings.defaultTaxes,
              discount: li.discount,
            })) ?? [{ unitPrice: 0, description: "A new item", quantity: 1 }],
            defaultTaxes: invoiceSettings.defaultTaxes,
            paymentTerms: invoiceSettings.paymentTerms,
            dueDate: invoiceSettings.paymentTerms
              ? computeDueDateFromTerm(
                  workingDraft?.issueDate || new Date().toISOString(),
                  invoiceSettings.paymentTerms,
                )
              : undefined,
            notes: invoiceSettings.notes ?? workingDraft?.notes,
            invoiceNumber: `${invoiceSettings.invoiceNumberPrefix ?? "INV-"}${invoiceSettings.invoiceNumberCounter ?? 0}`,
          });
          setWorkingDraft(draft);
        }
      } catch (e) {
        console.error("Failed to save invoice defaults", e);
      }
      setIsSettingsOpen(false);
    };

    useEffect(() => {
      let cancelled = false;

      async function applyIncoming(inv?: MajikInvoice) {
        if (!inv) {
          if (cancelled) return;
          setPanelState("draft");
          setWorkingDraft(initialDraft ?? null);
          setIsDirty(false);
          setIsLoading(false);
          return;
        }

        if (!initialInvoice && initialDraft) return;

        if (cancelled) return;

        // If the incoming invoice is the same one already shown and the user
        // has unsaved edits, don't stomp their working draft. Only update
        // panelState (e.g. if it just got sealed externally).
        const incomingId = inv.id;
        const currentId = majikInvoice?.id; // majikInvoice = initialInvoice ?? null

        if (isDirty && incomingId === currentId) {
          // Just sync state flags — don't touch workingDraft
          setPanelState(inv.isSealed ? "sealed" : "finalized");
          setIsLoading(false);
          return;
        }

        setIsLoading(true);
        setPanelState(inv.isSealed ? "sealed" : "finalized");

        try {
          if (inv.isEncrypted) {
            setWorkingDraft(inv.hasDecryptedCache ? inv.invoice : null);
          } else {
            setWorkingDraft(inv.invoice);
          }
        } catch {
          setWorkingDraft(null);
        } finally {
          if (!cancelled) setIsLoading(false);
        }

        if (!cancelled) setIsDirty(false);
      }

      applyIncoming(initialInvoice);
      return () => {
        cancelled = true;
      };
      // isDirty intentionally excluded — we only want this to re-run when
      // initialInvoice identity changes, not on every dirty toggle.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialInvoice, initialDraft]);

    const handleAddPayment = useCallback(
      async (proof: ProofOfPayment) => {
        if (!majikInvoice) return;
        if (majikInvoice.isEncrypted && majikInvoice.isLocked) {
          toast.error("Decrypt the invoice before recording a payment.");
          return;
        }

        try {
          // addPayment() returns a new GeneralInvoice with:
          //   - the proof appended to payments[]
          //   - status auto-set to "partial" or "paid" based on totals
          const updatedGi = majikInvoice.invoice.addPayment(proof);

          const recipientIds = configRecipients.map((rec) => rec.id);

          const reissued = await majik.reissueInvoice(majikInvoice, updatedGi, {
            recipientContactIds: recipientIds,
          });

          try {
            setWorkingDraft(reissued.invoice);
          } catch {
            setWorkingDraft(null);
          }
          setIsDirty(false);
          onUpdate?.(reissued);
        } catch (err) {
          toast.error(
            err instanceof Error ? err.message : "Failed to record payment.",
          );
        }
      },
      [majikInvoice, majik, configRecipients, workingDraft, onUpdate],
    );

    const handleRemovePayment = useCallback(
      async (proof: ProofOfPayment) => {
        if (!majikInvoice) return;
        if (majikInvoice.isEncrypted && majikInvoice.isLocked) {
          toast.error("Decrypt the invoice before removing a payment.");
          return;
        }

        try {
          const updatedInvoice = majikInvoice.removePayment(proof.id);

          let status: InvoiceStatus = "issued";

          if (updatedInvoice.payments && updatedInvoice.payments.length > 0) {
            status = "partial";
          }

          const recipientIds = configRecipients.map((rec) => rec.id);

          const reissued = await majik.reissueInvoice(
            updatedInvoice,
            updatedInvoice.invoice.withStatus(status, true),
            {
              recipientContactIds: recipientIds,
            },
          );

          try {
            setWorkingDraft(reissued.invoice);
          } catch {
            setWorkingDraft(null);
          }
          setIsDirty(false);
          onUpdate?.(reissued);
        } catch (err) {
          console.error("Error: ", err);
          toast.error(
            err instanceof Error ? err.message : "Failed to remove payment.",
          );
        }
      },
      [majikInvoice, majik, configRecipients, workingDraft, onUpdate],
    );

    const handleClearPayments = useCallback(async () => {
      if (!majikInvoice) return;
      if (majikInvoice.isEncrypted && majikInvoice.isLocked) {
        toast.error("Decrypt the invoice before removing a payment.");
        return;
      }

      try {
        // addPayment() returns a new GeneralInvoice with:
        //   - the proof appended to payments[]
        //   - status auto-set to "partial" or "paid" based on totals
        const updatedGi = majikInvoice.invoice.clearPayments();

        const recipientIds = configRecipients.map((rec) => rec.id);

        const reissued = await majik.reissueInvoice(
          majikInvoice,
          updatedGi.withStatus("issued", true),
          {
            recipientContactIds: recipientIds,
          },
        );

        try {
          setWorkingDraft(reissued.invoice);
        } catch {
          setWorkingDraft(null);
        }
        setIsDirty(false);
        onUpdate?.(reissued);
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to clear payments.",
        );
      }
    }, [majikInvoice, majik, configRecipients, workingDraft, onUpdate]);

    const handleSign = async () => {
      if (!majikInvoice) return;
      if (onSign) {
        onSign(majikInvoice);
        return;
      }

      const signed = await majik.signInvoice(majikInvoice);
      await majik.storeInvoice(signed);
      try {
        setWorkingDraft(signed.invoice);
      } catch {
        setWorkingDraft(null);
      }
      onUpdate?.(signed);
    };

    const handleDecrypt = async () => {
      if (!majikInvoice) return;
      const { invoice: gi, instance } =
        await majik.decryptInvoice(majikInvoice);
      setWorkingDraft(gi);
      onUpdate?.(instance);
    };

    const handleSecureLock = async () => {
      if (!majikInvoice) return;
      majikInvoice.secureLock(); // mutates in-place
      setWorkingDraft(null);
      onUpdate?.(majikInvoice);
    };
    const handleVerify = async () => {
      if (!majikInvoice) return;
      await majik.verifyInvoiceSignatures(majikInvoice);
    };

    // ── Loading guard ─────────────────────────────────────────────────────────

    if (isLoading) {
      return (
        <PanelRoot style={{ alignItems: "center", justifyContent: "center" }}>
          <ArrowClockwiseIcon size={32} className="spinning" />
        </PanelRoot>
      );
    }

    // ── Render ────────────────────────────────────────────────────────────────

    return (
      <PanelRoot>
        {/* ── Sidebar ── */}
        {!readonly && (
          <Sidebar>
            {/* Settings — always available */}
            <Section>
              <Label>
                <GearIcon size={14} /> Invoice Settings
              </Label>
              <GhostButton onClick={() => setIsSettingsOpen(true)}>
                Configure Defaults
              </GhostButton>
            </Section>

            {/* Draft state — just show the finalize button */}
            {panelState === "draft" && (
              <Section>
                <Label>
                  <PenNibIcon size={14} /> Ready to finalize?
                </Label>
                <InfoBox>
                  Fill in the invoice details, then finalize when ready. You'll
                  choose the security mode and recipients before signing.
                </InfoBox>
                <PrimaryButton
                  onClick={handleFinalizeClick}
                  disabled={!workingDraft}
                >
                  <CheckCircleIcon size={13} weight="bold" />
                  Finalize Invoice
                </PrimaryButton>
              </Section>
            )}

            {/* Finalized state — mode toggle + contacts + seal */}
            {panelState === "finalized" && majikInvoice && (
              <>
                <Section>
                  <Label>
                    <GearIcon size={14} /> Security Mode
                  </Label>
                  <ModeToggle>
                    <ModeBtn
                      $active={majikInvoice.mode === "signed-only"}
                      onClick={() => handleModeChange("signed-only")}
                    >
                      Signed Only
                    </ModeBtn>
                    <ModeBtn
                      $active={majikInvoice.mode === "encrypted-and-signed"}
                      onClick={() => handleModeChange("encrypted-and-signed")}
                    >
                      Encrypted
                    </ModeBtn>
                  </ModeToggle>
                  <InfoBox>
                    {majikInvoice.mode === "signed-only"
                      ? "Contents are plaintext but protected by a cryptographic signature seal."
                      : "Contents are encrypted via ML-KEM-768. Only selected recipients can view items."}
                  </InfoBox>
                </Section>

                <Section>
                  <Label>
                    <UserFocusIcon size={14} />
                    {majikInvoice.mode === "encrypted-and-signed"
                      ? "Encrypted Recipients"
                      : "Expected Signers"}
                  </Label>
                  <MajikInvoiceContactListSelector
                    contacts={availableContacts}
                    value={configRecipients}
                    onUpdate={handleRecipientsUpdate}
                    allowEmpty={false}
                    groups={groups}
                    compact
                  />
                </Section>

                <Section>
                  <Label>
                    <LockKeyIcon size={14} /> Seal Invoice
                  </Label>
                  <InfoBox>
                    Sealing makes this invoice permanently immutable. This
                    cannot be undone.
                  </InfoBox>
                  <SealButton
                    onClick={handleSeal}
                    disabled={isSealing || !majikInvoice.isSigned}
                  >
                    {isSealing ? (
                      <ArrowClockwiseIcon size={13} className="spinning" />
                    ) : (
                      <LockKeyIcon size={13} />
                    )}
                    {isSealing ? "Sealing…" : "Seal Invoice"}
                  </SealButton>
                  {!majikInvoice.isSigned && (
                    <ErrorNote>
                      Invoice must be signed before sealing.
                    </ErrorNote>
                  )}
                  {sealError && <ErrorNote>{sealError}</ErrorNote>}
                </Section>
              </>
            )}

            {/* Sealed state — just show seal info */}
            {panelState === "sealed" && majikInvoice && (
              <Section>
                <Label>
                  <LockKeyIcon size={14} /> Sealed
                </Label>
                <SealedInfo>
                  <SealedRow>
                    <SealedRowLabel>Sealed on</SealedRowLabel>
                    <SealedRowValue>
                      {majikInvoice.integrity.sealInfo?.sealTimestamp
                        ? new Date(
                            majikInvoice.integrity.sealInfo.sealTimestamp,
                          ).toLocaleString()
                        : "—"}
                    </SealedRowValue>
                  </SealedRow>
                  <SealedRow>
                    <SealedRowLabel>Sealed by</SealedRowLabel>
                    <SealedRowValue>
                      {majikInvoice.integrity.sealInfo?.sealedBy?.slice(
                        0,
                        24,
                      ) ?? "—"}
                      …
                    </SealedRowValue>
                  </SealedRow>
                  <SealedRow>
                    <SealedRowLabel>Seal hash</SealedRowLabel>
                    <SealedRowValue>
                      {majikInvoice.integrity.sealInfo?.sealHash?.slice(
                        0,
                        24,
                      ) ?? "—"}
                      …
                    </SealedRowValue>
                  </SealedRow>
                </SealedInfo>
                <InfoBox>
                  This invoice is permanently sealed and cannot be edited or
                  re-signed. Use "Duplicate" from the invoice list to create an
                  editable copy.
                </InfoBox>
              </Section>
            )}

            {isDirty && (
              <Section>
                <InfoBox>
                  You have unsaved changes. Save to re-sign and store, or
                  discard to revert.
                </InfoBox>
                <PrimaryButton onClick={handleSaveChanges} disabled={isSaving}>
                  {isSaving ? (
                    <>
                      <ArrowClockwiseIcon size={13} className="spinning" />{" "}
                      Saving…
                    </>
                  ) : (
                    <>
                      <CheckCircleIcon size={13} weight="bold" /> Save Changes
                    </>
                  )}
                </PrimaryButton>
                <GhostButton onClick={handleDiscardChanges} disabled={isSaving}>
                  Discard
                </GhostButton>
              </Section>
            )}

            {/* Integrity status — always shown */}
            <Section style={{ marginTop: "auto", marginBottom: 100 }}>
              <Label>
                <ShieldCheckIcon size={14} /> Integrity Status
              </Label>
              <div style={{ fontSize: "12px", opacity: 0.7 }}>
                {panelState === "draft"
                  ? "Draft — Not yet stored"
                  : panelState === "sealed"
                    ? "Locked & Sealed"
                    : "Signed — Editable"}
              </div>
              {majikInvoice && (
                <div
                  style={{
                    fontSize: "10px",
                    fontFamily: "monospace",
                    wordBreak: "break-all",
                  }}
                >
                  ID: {majikInvoice.id}
                </div>
              )}
            </Section>
          </Sidebar>
        )}

        {/* ── Main document ── */}
        <MainContent>
          {panelState === "draft" && workingDraft ? (
            <MajikInvoiceDocument
              majik={majik}
              kind="draft"
              invoice={workingDraft}
              onChange={handleDraftChange}
            />
          ) : panelState !== "draft" && majikInvoice ? (
            <MajikInvoiceDocument
              majik={majik}
              kind="majik"
              invoice={majikInvoice}
              pendingDraft={
                // For encrypted invoices, always drive display from workingDraft when available.
                // This covers both unsaved edits (isDirty) and the post-save window before
                // the initialInvoice prop updates with a fresh cache.
                majikInvoice.isEncrypted && workingDraft
                  ? workingDraft
                  : isDirty
                    ? (workingDraft ?? undefined)
                    : undefined
              }
              readonly={readonly || panelState === "sealed"}
              onEdit={
                panelState === "finalized" && !readonly
                  ? handleFieldChange
                  : undefined
              }
              onSign={panelState === "finalized" ? handleSign : undefined}
              onSeal={
                panelState === "finalized" && !readonly ? handleSeal : undefined
              }
              onDecrypt={handleDecrypt}
              onVerify={handleVerify}
              onSecureLock={handleSecureLock}
              onAddPayment={handleAddPayment}
              onRemovePayment={handleRemovePayment}
              onClearPayments={handleClearPayments}
              signerInfo={signerInfo}
              canSign={canSign}
              isIssuer={isIssuer}
              onCloseInvoice={
                panelState === "finalized" ? onCloseInvoice : undefined
              }
              canSeal={canSealInvoice}
            />
          ) : null}
        </MainContent>

        {/* ── Configure / Finalize modal ── */}
        <DynamicPopUp
          isOpen={isConfigureOpen}
          onOpenChange={(open) => {
            if (!open) setIsConfigureOpen(false);
          }}
          modal={{
            title: "Finalize Invoice",
            description:
              "Choose how this invoice will be secured before signing.",
          }}
          buttons={{
            cancel: {
              text: "Cancel",
              onClick: () => {
                setIsConfigureOpen(false);
                setFinalizeError(null);
              },
            },
            confirm: {
              text: isFinalizing ? "Finalizing…" : "Sign & Finalize",
              onClick: handleConfigureConfirm,
            },
          }}
        >
          <ConfigureBody>
            {configMode === "signed-only" ? (
              <GuideHelper docsPath="https://majikah.solutions/products/majik-buwiz/docs/buwiz-invoices-signing" />
            ) : (
              <GuideHelper docsPath="https://majikah.solutions/products/majik-buwiz/docs/buwiz-invoices-encryption" />
            )}

            <ConfigSection>
              <ConfigLabel>Security Mode</ConfigLabel>
              <ModeToggle>
                <ModeBtn
                  $active={configMode === "signed-only"}
                  onClick={() => setConfigMode("signed-only")}
                >
                  Signed Only
                </ModeBtn>
                <ModeBtn
                  $active={configMode === "encrypted-and-signed"}
                  onClick={() => setConfigMode("encrypted-and-signed")}
                >
                  Encrypted + Signed
                </ModeBtn>
              </ModeToggle>
              <InfoBox>
                {configMode === "signed-only"
                  ? "The invoice payload is plaintext but cryptographically signed. Anyone with the public key can verify it."
                  : "The payload is encrypted with ML-KEM-768. Only selected recipients can view line items and amounts."}
              </InfoBox>
            </ConfigSection>

            <ConfigSection>
              <ConfigLabel>
                {configMode === "encrypted-and-signed"
                  ? "Encryption Recipients"
                  : "Expected Signers"}
              </ConfigLabel>
              <MajikInvoiceContactListSelector
                contacts={availableContacts}
                value={configRecipients}
                onUpdate={setConfigRecipients}
                allowEmpty={configMode === "signed-only"}
                groups={groups}
                compact
              />
              {configMode === "encrypted-and-signed" &&
                configRecipients.length === 0 && (
                  <ErrorNote>
                    At least one recipient is required for encrypted mode.
                  </ErrorNote>
                )}
            </ConfigSection>

            {finalizeError && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  fontSize: 12,
                  color: "var(--color-error)",
                }}
              >
                <WarningCircleIcon size={13} weight="fill" />
                {finalizeError}
              </div>
            )}
          </ConfigureBody>
        </DynamicPopUp>

        {/* ── Settings modal ── */}
        <DynamicPopUp
          scrollable
          isOpen={isSettingsOpen}
          onOpenChange={setIsSettingsOpen}
          modal={{
            title: "Invoice Settings",
            description: "Configure your default invoice preferences.",
          }}
          buttons={{
            cancel: { text: "Cancel", onClick: () => setIsSettingsOpen(false) },
            confirm: { text: "Save", onClick: handleSaveInvoiceSettings },
          }}
        >
          <InvoiceSettings
            majik={majik}
            onClose={() => setIsSettingsOpen(false)}
            onChange={(v) => {
              invoiceSettingsRef.current = v;
            }}
          />
        </DynamicPopUp>
      </PanelRoot>
    );
  },
);
