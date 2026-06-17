import { useCallback, useEffect, useMemo, useState, type JSX } from "react";

import { toast } from "sonner";

import styled from "styled-components";

import {
  AddressBookIcon,
  BankIcon,
  ReceiptIcon,
  IdentificationCardIcon,
  ChartLineUpIcon,
  MoneyWavyIcon,
} from "@phosphor-icons/react";
import { useMajik } from "./components/majik-context-wrapper/use-majik";

import DynamicPlaceholder from "./components/foundations/DynamicPlaceholder";

import ContactsPanel from "./components/panels/ContactsPanel";
import UnlockModal from "./components/UnlockModal";

import {
  TabRouter,
  type RouterTabContent,
} from "./components/functional/TabRouter";

import { useMajikah } from "./components/majikah-session-wrapper/use-majikah";

// import { launchTutorialOnboarding } from "./lib/shepherd-js/tutorials/tutorial-onboarding";
import { useShepherd } from "./lib/shepherd-js/use-shepherd";

import { listen } from "@tauri-apps/api/event";

import { useNavigate } from "react-router-dom";
import { toggleTheme } from "./redux/slices/system";
import { useDispatch } from "react-redux";

import MajikBuwizOnboardingGate from "./components/MajikBuwizOnboardingGate";
// import { useMajikTutorials } from "./hooks/use-majik-tutorials";

import { InvoicesManager } from "./components/panels/invoice/InvoicesManager";
import UserMUIDPanel from "./components/panels/UserMUIDPanel";
import { MajikBuwizDatabase } from "./components/majik-context-wrapper/majik-buwiz-database";
import BuwizDashboardPanel from "./components/panels/BuwizDashboardPanel";
import { InvoiceExchangePanel } from "./components/panels/InvoiceExchangePanel";
import { ReplaceKeyModal } from "./components/panels/muid/modals/ReplaceKeyModal";
import { CreateKeyModal } from "./components/panels/muid/modals/CreateKeyModal";
import { ImportKeyModal } from "./components/panels/muid/modals/ImportKeyModal";
import { ImportContactModal } from "./components/panels/contacts/modals";
import { MajikahAuthModal } from "./components/panels/muid/modals/MajikahAuthModal";
import {
  API_RESPONSE_SIGN_IN,
  API_RESPONSE_SIGN_UP,
} from "./components/majikah-session-wrapper/api-types";
import { MajikInvoiceContact } from "./SDK/majik-buwiz-client/src/core/party/majik-invoice-contact";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { readFile, writeFile } from "@tauri-apps/plugin-fs";

import { MajikInvoice } from "@majikah/majik-invoice";
import { ImportMJKIModal } from "./components/panels/invoice/modals/ImportMJKIModal";
import { InvoiceSettingsModal } from "./components/panels/invoice/modals/InvoiceSettingsModal";
import CSVExportDialog from "./components/panels/invoice/CSVExportDialog";
import { sendNotification } from "@tauri-apps/plugin-notification";
import { ImportInvoiceBackupModal } from "./components/panels/invoice/modals/ImportInvoiceModal";
import { ImportContactBackupModal } from "./components/panels/contacts/modals/ImportContactBackupModal";
import { ContactManagerSnapshot } from "./SDK/majik-buwiz-client/src";
import { AppDataSnapshot } from "./SDK/majik-buwiz-client/src/core/backup/types";
import { ImportAppDataModal } from "./components/panels/modals/ImportAppDataModal";
import { AppSettingsModal } from "./components/panels/settings/AppSettingsModal";
import { ExportAccountKeyModal } from "./components/panels/muid/modals/ExportAccountKeyModal";
import TaxProfileWizardModal from "./components/panels/contacts/modals/TaxProfileWizardModal";
import { ExpensesManager } from "./components/panels/expense/ExpensesManager";

type ModalKeyContext =
  | "create-account"
  | "replace-account"
  | "import-account"
  | "import-contact"
  | "import-contact-backup"
  | "import-invoice-mjki"
  | "import-invoice-csv"
  | "import-invoice-backup"
  | "import-expense-mjki"
  | "import-expense-backup"
  | "export-invoice-backup"
  | "export-invoice-csv"
  | "export-expense-backup"
  | "export-contacts"
  | "export-backup"
  | "restore-backup"
  | "export-majik-key"
  | "validate-invoice"
  | "auth-majikah"
  | "invoice-settings"
  | "user-preferences"
  | "tax-profile-wizard"
  | null;

const RootContainer = styled.div`
  display: flex;
  flex-direction: column;
  overflow: hidden;
  width: inherit;
  background-color: ${({ theme }) => theme.colors.primaryBackground};
  height: 100vh;
  width: 100vw;
`;

// const firebaseConfig = {
//   apiKey: import.meta.env.VITE_FIREBASE_API_KEY!,
//   projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID!,
//   messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID!,
//   appId: import.meta.env.VITE_FIREBASE_APP_ID!,
//   vapidKey: import.meta.env.VITE_VAPID_PUBLIC_KEY!,
// };

function App(): JSX.Element {
  const tour = useShepherd();
  // const { add: addTutorial } = useMajikTutorials();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const { majik, loading, updateInstance } = useMajik();
  const { majikah } = useMajikah();
  const [unlockId, setUnlockId] = useState<string | null>(null);
  const [unlockResolver, setUnlockResolver] = useState<
    ((s: string) => void) | null
  >(null);
  const [unlocked, setUnlocked] = useState<boolean>(false);
  const [isUnlocking, setIsUnlocking] = useState(false);

  const [modalKey, setModalKey] = useState<ModalKeyContext>(null);

  const [pendingImportInvoices, setPendingImportInvoices] = useState<
    MajikInvoice[]
  >([]);

  const [pendingBackupInvoices, setPendingBackupInvoices] = useState<
    MajikInvoice[]
  >([]);

  const [pendingContactBackupSnapshot, setPendingContactBackupSnapshot] =
    useState<ContactManagerSnapshot | null>(null);

  const [pendingAppDataSnapshot, setPendingAppDataSnapshot] =
    useState<AppDataSnapshot | null>(null);

  const [csvInvoices, setCsvInvoices] = useState<MajikInvoice[]>([]);

  const [refreshKey, setRefreshKey] = useState<number>(0);

  // useFirebaseElectronPush({
  //   config: firebaseConfig,
  //   publicKey: majik?.currentIdentity?.publicKey || null,
  //   session: majikah,
  //   enabled: true,
  // });

  useEffect(() => {
    // Wire majik.keyManager.onUnlockRequested to present our React modal
    majik.keyManager.onUnlockRequested = (id: string) => {
      return new Promise<string>((resolve) => {
        setUnlockId(id);
        setUnlockResolver(() => resolve);
      });
    };

    return () => {
      majik.keyManager.onUnlockRequested = undefined;
    };
  }, []);

  useEffect(() => {
    if (!majikah) return;

    const handleSignIn = async () => {
      if (!isTauri()) return;

      invoke("set_auth_state", { signedIn: true })
        .catch(console.error)
        .finally(() => console.log("User Signed In", true));
    };

    const handleSignOut = async () => {
      if (!isTauri()) return;

      invoke("set_auth_state", { signedIn: false })
        .catch(console.error)
        .finally(() => console.log("User Signed Out", false));
    };

    majikah.on("sign-in", handleSignIn);
    majikah.on("sign-out", handleSignOut);
    return () => {
      majikah.off("sign-in", handleSignIn);
      majikah.off("sign-out", handleSignOut);
    };
  }, [majikah]);

  useEffect(() => {
    if (!majik) return;

    const active = majik.getActiveAccount();
    if (!active) return;

    try {
      // Try accessing private key
      majik.keyManager.getPrivateKey(active.id);

      // If no error → already unlocked
      setUnlocked(true);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      const needsUnlock =
        err instanceof Error &&
        /must be unlocked|unlockIdentity/.test(err.message);

      if (needsUnlock) {
        setUnlockId(active.id);
      }
    }
  }, [majik]);

  const userAccounts = useMemo(() => {
    return majik.listOwnAccounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [majik, refreshKey]);

  window.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "p") {
      e.preventDefault();
      e.stopPropagation();
    }
  });

  useEffect(() => {
    let isCancelled = false;
    const handlers: Array<() => void> = [];

    const register = async () => {
      const unlisteners = await Promise.all([
        listen("trigger-import-invoice-mjki", async () => {
          if (!unlocked) {
            toast.error("Account Locked", {
              description: "Unlock your Majik Key first.",
              id: "toast-error-locked",
            });
            return;
          }
          try {
            const selected = await open({
              multiple: true, // allow multi-file pick
              filters: [{ name: "Majik Invoice", extensions: ["mjki", "*"] }],
            });
            if (!selected) return;

            const paths = Array.isArray(selected) ? selected : [selected];

            const parsed: MajikInvoice[] = [];
            for (const filePath of paths) {
              const uint8 = await readFile(filePath);
              const invoice = MajikInvoice.fromBinary(uint8.buffer);
              parsed.push(invoice);
            }

            if (parsed.length === 0) {
              toast.error(
                "No invoices could be parsed from the selected file(s).",
              );
              return;
            }

            setPendingImportInvoices(parsed);
            setModalKey("import-invoice-mjki");
          } catch (error) {
            console.error(error);
            toast.error("Failed to open invoice file", {
              description: (error as any)?.message || String(error),
            });
          }
        }),

        listen("trigger-import-invoice-backup", async () => {
          if (!unlocked) {
            toast.error("Account Locked", {
              description: "Unlock your Majik Key first.",
              id: "toast-error-locked",
            });
            return;
          }
          try {
            const selected = await open({
              multiple: false,
              filters: [{ name: "Majik Backup", extensions: ["mjkbackup"] }],
            });
            if (!selected) return;

            const filePath = selected as string;
            const uint8 = await readFile(filePath);

            const invoices = await majik.readInvoicesBackup(uint8);

            if (invoices.length === 0) {
              toast.warning("Empty backup", {
                description:
                  "No invoices were found in the selected backup file.",
              });
              return;
            }

            setPendingBackupInvoices(invoices);
            setModalKey("import-invoice-backup");
          } catch (error) {
            console.error(error);
            toast.error("Failed to read backup file", {
              description: (error as any)?.message || String(error),
            });
          }
        }),

        listen("trigger-import-expense-mjki", async () => {
          if (!unlocked) {
            toast.error("Account Locked", {
              description: "Unlock your Majik Key first.",
              id: "toast-error-locked",
            });
            return;
          }
          toast.error("Coming Soon", {
            description:
              "This feature will soon be available. Thank you for waiting.",
            id: "toast-coming-soon",
          });
          // try {
          //   const selected = await open({
          //     multiple: true, // allow multi-file pick
          //     filters: [{ name: "Majik Invoice", extensions: ["mjki", "*"] }],
          //   });
          //   if (!selected) return;

          //   const paths = Array.isArray(selected) ? selected : [selected];

          //   const parsed: MajikInvoice[] = [];
          //   for (const filePath of paths) {
          //     const uint8 = await readFile(filePath);
          //     const invoice = MajikInvoice.fromBinary(uint8.buffer);
          //     parsed.push(invoice);
          //   }

          //   if (parsed.length === 0) {
          //     toast.error(
          //       "No invoices could be parsed from the selected file(s).",
          //     );
          //     return;
          //   }

          //   setPendingImportInvoices(parsed);
          //   setModalKey("import-invoice-mjki");
          // } catch (error) {
          //   console.error(error);
          //   toast.error("Failed to open invoice file", {
          //     description: (error as any)?.message || String(error),
          //   });
          // }
        }),

        listen("trigger-import-expense-backup", async () => {
          if (!unlocked) {
            toast.error("Account Locked", {
              description: "Unlock your Majik Key first.",
              id: "toast-error-locked",
            });
            return;
          }
          toast.error("Coming Soon", {
            description:
              "This feature will soon be available. Thank you for waiting.",
            id: "toast-coming-soon",
          });
          // try {
          //   const selected = await open({
          //     multiple: false,
          //     filters: [{ name: "Majik Backup", extensions: ["mjkbackup"] }],
          //   });
          //   if (!selected) return;

          //   const filePath = selected as string;
          //   const uint8 = await readFile(filePath);

          //   const invoices = await majik.readInvoicesBackup(uint8);

          //   if (invoices.length === 0) {
          //     toast.warning("Empty backup", {
          //       description:
          //         "No expenses were found in the selected backup file.",
          //     });
          //     return;
          //   }

          //   setPendingBackupInvoices(invoices);
          //   setModalKey("import-expense-backup");
          // } catch (error) {
          //   console.error(error);
          //   toast.error("Failed to read backup file", {
          //     description: (error as any)?.message || String(error),
          //   });
          // }
        }),
        listen("trigger-export-contacts", async () => {
          if (!unlocked) {
            toast.error("Account Locked", {
              description: "Unlock your Majik Key first.",
              id: "toast-error-locked",
            });
            return;
          }
          const backupBlob = await majik.backupContacts();
          const blobBuffer = await backupBlob.arrayBuffer();

          const backupFileName = `${activeAccount?.meta.label || activeAccount?.id || "User"}  - Contacts Backup`;

          const filePath = await save({
            defaultPath: backupFileName,
            filters: [{ name: "Majik Backup", extensions: ["mjkbackup"] }],
          });

          if (!filePath) {
            toast.info("Backup cancelled");
            return;
          } else {
            await writeFile(filePath, new Uint8Array(blobBuffer));
          }

          toast.success("Contacts Backup Saved", {
            description: `${backupFileName} exported successfully.`,
          });

          sendNotification({
            title: "Contacts Backup Saved",
            body: backupFileName,
          });
        }),

        listen("trigger-export-invoices-backup", async () => {
          if (!unlocked) {
            toast.error("Account Locked", {
              description: "Unlock your Majik Key first.",
              id: "toast-error-locked",
            });
            return;
          }
          const backupBlob = majik.backupInvoices();
          const blobBuffer = await backupBlob.arrayBuffer();

          const backupFileName = `${activeAccount?.meta.label || activeAccount?.id || "User"}  - Invoice Backup`;

          const filePath = await save({
            defaultPath: backupFileName,
            filters: [{ name: "Majik Backup", extensions: ["mjkbackup"] }],
          });

          if (!filePath) {
            toast.info("Backup cancelled");
            return;
          } else {
            await writeFile(filePath, new Uint8Array(blobBuffer));
          }

          toast.success("Invoice Backup Saved", {
            description: `${backupFileName} exported successfully.`,
          });

          sendNotification({
            title: "Invoice Backup Saved",
            body: backupFileName,
          });
        }),

        listen("trigger-export-invoices-csv", async () => {
          if (!unlocked) {
            toast.error("Account Locked", {
              description: "Unlock your Majik Key first.",
              id: "toast-error-locked",
            });
            return;
          }
          const list = majik.listInvoices();
          setCsvInvoices(list);
          setModalKey("export-invoice-csv");
        }),

        listen("trigger-export-expenses-backup", async () => {
          if (!unlocked) {
            toast.error("Account Locked", {
              description: "Unlock your Majik Key first.",
              id: "toast-error-locked",
            });
            return;
          }
          const backupBlob = majik.backupExpenses();
          const blobBuffer = await backupBlob.arrayBuffer();

          const backupFileName = `${activeAccount?.meta.label || activeAccount?.id || "User"}  - Expense Backup`;

          const filePath = await save({
            defaultPath: backupFileName,
            filters: [{ name: "Majik Backup", extensions: ["mjkbackup"] }],
          });

          if (!filePath) {
            toast.info("Backup cancelled");
            return;
          } else {
            await writeFile(filePath, new Uint8Array(blobBuffer));
          }

          toast.success("Expense Backup Saved", {
            description: `${backupFileName} exported successfully.`,
          });

          sendNotification({
            title: "Expense Backup Saved",
            body: backupFileName,
          });
        }),

        listen("trigger-export-expenses-csv", async () => {
          if (!unlocked) {
            toast.error("Account Locked", {
              description: "Unlock your Majik Key first.",
              id: "toast-error-locked",
            });
            return;
          }

          toast.error("Coming Soon", {
            description:
              "This feature will soon be available. Thank you for waiting.",
            id: "toast-coming-soon",
          });
        }),

        listen("trigger-export-app-data", async () => {
          if (!unlocked) {
            toast.error("Account Locked", {
              description: "Unlock your Majik Key first.",
              id: "toast-error-locked",
            });
            return;
          }
          const backupBlob = await majik.backupAppData();
          const blobBuffer = await backupBlob.arrayBuffer();

          const backupFileName = `${activeAccount?.meta.label || activeAccount?.id || "User"}  - App Data Backup`;

          const filePath = await save({
            defaultPath: backupFileName,
            filters: [{ name: "Majik Backup", extensions: ["mjkbackup"] }],
          });

          if (!filePath) {
            toast.info("Backup cancelled");
            return;
          } else {
            await writeFile(filePath, new Uint8Array(blobBuffer));
          }

          toast.success("App Data Backup Saved", {
            description: `${backupFileName} exported successfully.`,
          });

          sendNotification({
            title: "App Data Backup Saved",
            body: backupFileName,
          });
        }),

        // ─────────────────────────────────────────────────────────────
        // Account
        // ─────────────────────────────────────────────────────────────

        listen("trigger-import-contact", () => {
          if (!unlocked) {
            toast.error("Account Locked", {
              description: "Unlock your Majik Key first.",
              id: "toast-error-locked",
            });
            return;
          }
          setModalKey("import-contact");
          navigate("/contacts");
        }),

        listen("trigger-import-contact-backup", async () => {
          if (!unlocked) {
            toast.error("Account Locked", {
              description: "Unlock your Majik Key first.",
              id: "toast-error-locked",
            });
            return;
          }
          try {
            const selected = await open({
              multiple: false,
              filters: [{ name: "Majik Backup", extensions: ["mjkbackup"] }],
            });
            if (!selected) return;

            const uint8 = await readFile(selected as string);
            const snapshot = await majik.readContactsBackup(uint8);

            if (snapshot.contacts.length === 0) {
              toast.warning("Empty backup", {
                description:
                  "No contacts were found in the selected backup file.",
              });
              return;
            }

            setPendingContactBackupSnapshot(snapshot);
            setModalKey("import-contact-backup");
          } catch (error) {
            console.error(error);
            toast.error("Failed to read contact backup", {
              description: (error as any)?.message || String(error),
            });
          }
        }),

        listen("trigger-import-app-data", async () => {
          if (!unlocked) {
            toast.error("Account Locked", {
              description: "Unlock your Majik Key first.",
              id: "toast-error-locked",
            });
            return;
          }
          try {
            const selected = await open({
              multiple: false,
              filters: [{ name: "Majik Backup", extensions: ["mjkbackup"] }],
            });
            if (!selected) return;

            const uint8 = await readFile(selected as string);
            const snapshot = await majik.readAppDataBackup(uint8);

            const hasAnything =
              snapshot.invoices.length > 0 ||
              snapshot.contacts.length > 0 ||
              snapshot.invoiceDefaults !== null ||
              snapshot.preferences !== null;

            if (!hasAnything) {
              toast.warning("Empty backup", {
                description: "This backup file appears to contain no data.",
              });
              return;
            }

            setPendingAppDataSnapshot(snapshot);
            setModalKey("restore-backup");
          } catch (error) {
            console.error(error);
            toast.error("Failed to read backup file", {
              description: (error as any)?.message || String(error),
            });
          }
        }),

        listen("trigger-switch-account", () => {
          if (!unlocked) {
            toast.error("Account Locked", {
              description: "Unlock your Majik Key first.",
              id: "toast-error-locked",
            });
            return;
          }
          setModalKey("replace-account");
          navigate("/muid");
        }),

        listen("trigger-refresh-muid", async () => {
          if (!unlocked) {
            toast.error("Account Locked", {
              description: "Unlock your Majik Key first.",
              id: "toast-error-locked",
            });
            return;
          }
          await majik.refreshMUID();
          setRefreshKey((prev) => prev + 1);
        }),

        listen("trigger-verify-muid", async () => {
          toast.info("Coming Soon", {
            description:
              "This feature will soon be available. Thank you for your patience.",
            id: "toast-info-coming-soon",
          });
        }),

        listen("trigger-auth-sign-in", () => {
          if (!unlocked) {
            toast.error("Account Locked", {
              description: "Unlock your Majik Key first.",
              id: "toast-error-locked",
            });
            return;
          }
          setModalKey("auth-majikah");
        }),

        listen("trigger-auth-sign-out", async () => {
          if (!unlocked) {
            toast.error("Account Locked", {
              description: "Unlock your Majik Key first.",
              id: "toast-error-locked",
            });
            return;
          }
          if (!majikah.isAuthenticated) return;

          const run = async (): Promise<string> => {
            await majikah.signOut();
            toast.success("Signed Out");
            majik.clearUser();
            majik.clearAllCaches();

            return "Signed out from Majikah.";
          };

          toast.promise(run(), {
            loading: `Signing Out…`,
            success: (m) => {
              navigate("/muid");
              return m;
            },
            error: (err) =>
              err instanceof Error ? err.message : "Problem Signing Out.",
          });
        }),

        // ─────────────────────────────────────────────────────────────
        // Invoices
        // ─────────────────────────────────────────────────────────────

        listen("trigger-manage-invoices", () => {
          if (!unlocked) {
            toast.error("Account Locked", {
              description: "Unlock your Majik Key first.",
              id: "toast-error-locked",
            });
            return;
          }
          navigate("/invoices");
        }),

        listen("trigger-dashboard-summary", () => {
          if (!unlocked) {
            toast.error("Account Locked", {
              description: "Unlock your Majik Key first.",
              id: "toast-error-locked",
            });
            return;
          }
          navigate("/dashboard");
        }),

        listen("trigger-invoice-settings", () => {
          if (!unlocked) {
            toast.error("Account Locked", {
              description: "Unlock your Majik Key first.",
              id: "toast-error-locked",
            });
            return;
          }
          setModalKey("invoice-settings");
        }),

        // ─────────────────────────────────────────────────────────────
        // Preferences
        // ─────────────────────────────────────────────────────────────

        listen("trigger-toggle-dark-mode", () => {
          dispatch(toggleTheme());
        }),

        listen("trigger-user-preferences", () => {
          if (!unlocked) {
            toast.error("Account Locked", {
              description: "Unlock your Majik Key first.",
              id: "toast-error-locked",
            });
            return;
          }
          setModalKey("user-preferences");
        }),

        listen("trigger-tax-profile-wizard", () => {
          if (!unlocked) {
            toast.error("Account Locked", {
              description: "Unlock your Majik Key first.",
              id: "toast-error-locked",
            });
            return;
          }
          setModalKey("tax-profile-wizard");
        }),

        // ─────────────────────────────────────────────────────────────
        // Tools
        // ─────────────────────────────────────────────────────────────

        listen("trigger-export-majik-key", async () => {
          if (!unlocked) {
            toast.error("Account Locked", {
              description: "Unlock your Majik Key first.",
              id: "toast-error-locked",
            });
            return;
          }
          setModalKey("export-majik-key");
        }),

        listen("trigger-validate-invoice", async () => {
          toast.info("Coming Soon", {
            description:
              "This feature will soon be available. Thank you for your patience.",
            id: "toast-info-coming-soon",
          });
        }),

        // ─────────────────────────────────────────────────────────────
        // Help
        // ─────────────────────────────────────────────────────────────

        listen("trigger-start-tutorial", () => {
          // launchTutorialOnboarding(tour);
          toast.info("Coming Soon", {
            description:
              "This feature will soon be available. Thank you for your patience.",
            id: "toast-info-coming-soon",
          });
        }),
      ]);

      // Cleanup immediately if effect was already disposed
      if (isCancelled) {
        unlisteners.forEach((fn) => fn());
        return;
      }

      handlers.push(...unlisteners);
    };

    register();

    return () => {
      isCancelled = true;

      handlers.forEach((fn) => fn());
    };
  }, [majik, majikah, dispatch, navigate, tour, userAccounts.length, unlocked]);

  const handleCancel = (): void => {
    if (unlockResolver) unlockResolver("");
    setUnlockId(null);
    setUnlockResolver(null);
  };

  const handleSwitchAccount = async (
    newAccount: MajikInvoiceContact,
  ): Promise<void> => {
    handleCancel();
    setUnlockId(newAccount.id);
    await majik.ensureIdentityUnlocked(newAccount.id);
    toast.success("Access granted", {
      description: "Your identity has been securely unlocked.",
      id: "toast-success-unlock",
    });
  };

  const handleSubmit = async (pass: string): Promise<void> => {
    if (!majik || !unlockId || isUnlocking) return;
    if (unlockResolver) unlockResolver(pass);
    try {
      setIsUnlocking(true);

      await majik.unlockAccount(unlockId, pass);

      toast.success("Access granted", {
        description: "Your identity has been securely unlocked.",
      });

      setUnlockId(null);
      setUnlockResolver(null);
      setUnlocked(true);
    } catch {
      toast.error("Incorrect passphrase. Please try again.");
      // modal stays open
    } finally {
      setIsUnlocking(false);
    }
  };

  const handleForgotSuccess = useCallback(() => {
    toast.success("Access granted", {
      description: "Your identity has been securely unlocked.",
    });

    setUnlockId(null);
    setUnlockResolver(null);
    setUnlocked(true);
  }, [majik]);

  const handleRefreshInstance = (data: MajikBuwizDatabase): void => {
    updateInstance(data);
    setRefreshKey((prev) => prev + 1);
  };

  // ── ReplaceKey success ─────────────────────────────────────────────────────
  const handleModalSuccess = useCallback(() => {
    setRefreshKey((prev) => prev + 1);
  }, [majik]);

  const handleAuthSuccess = useCallback(
    async (response: API_RESPONSE_SIGN_IN | API_RESPONSE_SIGN_UP) => {
      navigate("/muid");
      setRefreshKey((prev) => prev + 1);
      setModalKey(null);
      if (!!response.user) {
        await majik.refreshMUID();
      }
    },
    [majik],
  );

  if (loading) {
    return (
      <RootContainer>
        <DynamicPlaceholder loading>Loading...</DynamicPlaceholder>
      </RootContainer>
    );
  }

  const activeAccount = useMemo(() => {
    return majik.getActiveAccount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [majik, refreshKey]);

  const tabs: RouterTabContent[] = useMemo(() => {
    if (!activeAccount) {
      return [
        {
          id: "accounts",
          route: "/accounts",
          icon: IdentificationCardIcon,
          name: "Majik Universal ID",
          element: (
            <UserMUIDPanel majik={majik} onUpdate={handleRefreshInstance} />
          ),
        },
      ];
    }

    return [
      {
        id: "accounts",
        route: "/accounts",
        icon: IdentificationCardIcon,
        name: "Majik Universal ID",
        element: (
          <UserMUIDPanel majik={majik} onUpdate={handleRefreshInstance} />
        ),
      },

      {
        id: "contacts",
        route: "/contacts",
        name: "Contacts",
        icon: AddressBookIcon,
        element: (
          <ContactsPanel majik={majik} onUpdate={handleRefreshInstance} />
        ),
      },

      {
        id: "dashboard",
        route: "/dashboard",
        name: "Dashboard",
        icon: ChartLineUpIcon,
        element: <BuwizDashboardPanel majik={majik} />,
      },

      {
        id: "invoices",
        route: "/invoices",
        name: "My Invoices",
        icon: ReceiptIcon,
        element: <InvoicesManager majik={majik} />,
      },

      {
        id: "expenses",
        route: "/expenses",
        name: "My Expenses",
        icon: MoneyWavyIcon,
        element: <ExpensesManager majik={majik} />,
      },

      {
        id: "exchange",
        route: "/exchange",
        name: "Exchange",
        icon: BankIcon,
        element: <InvoiceExchangePanel majik={majik} />,
      },
    ];

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeAccount, refreshKey]);

  return (
    <RootContainer>
      <MajikBuwizOnboardingGate
        majikah={majikah}
        majik={majik}
        onUpdate={handleRefreshInstance}
        // onLaunchTour={() =>
        //   launchTutorialOnboarding(tour, () => {
        //     addTutorial("tutorial-majik-buwiz-onboarding:v:0.0.1");
        //   })
        // }
      >
        <TabRouter tabs={tabs} key={refreshKey} />
        <UnlockModal
          identityId={unlockId}
          onCancel={handleCancel}
          onSubmit={handleSubmit}
          majik={majik}
          strict={!unlocked}
          onSignout={() => setUnlockId(null)}
          onSwitchAccount={handleSwitchAccount}
          onReset={handleCancel}
          isUnlocking={isUnlocking}
          onForgotPasswordSuccess={handleForgotSuccess}
        />

        <AppSettingsModal
          majik={majik}
          onSuccess={handleModalSuccess}
          open={modalKey === "user-preferences"}
          onOpenChange={(change) =>
            setModalKey(change ? "user-preferences" : null)
          }
        />

        <ReplaceKeyModal
          majik={majik}
          onSuccess={handleModalSuccess}
          open={modalKey === "replace-account"}
          onOpenChange={(change) =>
            setModalKey(change ? "replace-account" : null)
          }
        />
        <CreateKeyModal
          majik={majik}
          onSuccess={handleModalSuccess}
          open={modalKey === "create-account"}
          onOpenChange={(change) =>
            setModalKey(change ? "create-account" : null)
          }
        />

        <ImportKeyModal
          majik={majik}
          onSuccess={handleModalSuccess}
          open={modalKey === "import-account"}
          onOpenChange={(change) =>
            setModalKey(change ? "import-account" : null)
          }
        />

        <ExportAccountKeyModal
          majik={majik}
          onSuccess={handleModalSuccess}
          open={modalKey === "export-majik-key"}
          onOpenChange={(change) =>
            setModalKey(change ? "export-majik-key" : null)
          }
        />

        <ImportContactModal
          majik={majik}
          onSuccess={handleModalSuccess}
          open={modalKey === "import-contact"}
          onOpenChange={(change) =>
            setModalKey(change ? "import-contact" : null)
          }
        />

        <ImportContactBackupModal
          open={modalKey === "import-contact-backup"}
          onOpenChange={(change) => {
            setModalKey(change ? "import-contact-backup" : null);
            if (!change) setPendingContactBackupSnapshot(null);
          }}
          majik={majik}
          snapshot={pendingContactBackupSnapshot}
          onSuccess={handleModalSuccess}
        />

        <ImportMJKIModal
          open={modalKey === "import-invoice-mjki"}
          onOpenChange={(change) => {
            setModalKey(change ? "import-invoice-mjki" : null);
            if (!change) setPendingImportInvoices([]); // clear on close
          }}
          majik={majik}
          invoices={pendingImportInvoices}
          onSuccess={handleModalSuccess}
        />

        <ImportInvoiceBackupModal
          open={modalKey === "import-invoice-backup"}
          onOpenChange={(change) => {
            setModalKey(change ? "import-invoice-backup" : null);
            if (!change) setPendingBackupInvoices([]); // clear on close
          }}
          majik={majik}
          invoices={pendingBackupInvoices}
          onSuccess={handleModalSuccess}
        />

        <ImportAppDataModal
          open={modalKey === "restore-backup"}
          onOpenChange={(change) => {
            setModalKey(change ? "restore-backup" : null);
            if (!change) setPendingAppDataSnapshot(null);
          }}
          majik={majik}
          snapshot={pendingAppDataSnapshot}
          onSuccess={handleModalSuccess}
        />

        <InvoiceSettingsModal
          majik={majik}
          onOpenChange={(change) =>
            setModalKey(change ? "invoice-settings" : null)
          }
          open={modalKey === "invoice-settings"}
        />

        <TaxProfileWizardModal
          majik={majik}
          onOpenChange={(change) =>
            setModalKey(change ? "tax-profile-wizard" : null)
          }
          open={modalKey === "tax-profile-wizard"}
        />

        <CSVExportDialog
          majik={majik}
          isOpen={modalKey === "export-invoice-csv"}
          onOpenChange={(change) =>
            setModalKey(change ? "export-invoice-csv" : null)
          }
          invoices={csvInvoices}
          scope={"all"}
        />

        <MajikahAuthModal
          onSuccessSignIn={handleAuthSuccess}
          onSuccessSignUp={handleAuthSuccess}
          open={modalKey === "auth-majikah"}
          onOpenChange={(change) => setModalKey(change ? "auth-majikah" : null)}
        />
      </MajikBuwizOnboardingGate>
    </RootContainer>
  );
}

export default App;
