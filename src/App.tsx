import { useCallback, useEffect, useMemo, useState, type JSX } from "react";

import { toast } from "sonner";

import styled from "styled-components";

import {
  AddressBookIcon,
  BankIcon,
  ReceiptIcon,
  IdentificationCardIcon,
  ChartLineUpIcon,
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

type ModalKeyContext =
  | "create-account"
  | "replace-account"
  | "import-account"
  | "import-contact"
  | "import-invoice-mjki"
  | "import-invoice-csv"
  | "export-invoice-backup"
  | "export-invoice-csv"
  | "export-contacts"
  | "export-backup"
  | "export-majik-key"
  | "validate-invoice"
  | "auth-majikah"
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

  // const [pendingSignFile, setPendingSignFile] = useState<File | null>(null);
  // const [pendingVerifyFile, setPendingVerifyFile] = useState<File | null>(null);

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
        // ─────────────────────────────────────────────────────────────
        // File
        // ─────────────────────────────────────────────────────────────

        // listen("trigger-sign-file", async () => {
        //   try {
        //     const selected = await open({
        //       multiple: false,
        //       filters: [{ name: "All Files", extensions: ["*"] }],
        //     });
        //     if (!selected) return;

        //     const filePath = selected as string;
        //     const uint8 = await readFile(filePath);
        //     const fileName = await basename(filePath);
        //     const file = new File([uint8], fileName);

        //     // setPendingSignFile(file);
        //     navigate("/sign");
        //   } catch (error) {
        //     console.error(error);
        //     toast.error("Failed to open file for signing", {
        //       description: (error as any)?.message || String(error),
        //     });
        //   }
        // }),

        // listen("trigger-verify-file", async () => {
        //   try {
        //     const selected = await open({
        //       multiple: false,
        //       filters: [{ name: "All Files", extensions: ["*"] }],
        //     });
        //     if (!selected) return;

        //     const filePath = selected as string;
        //     const uint8 = await readFile(filePath);
        //     const fileName = await basename(filePath);
        //     const file = new File([uint8], fileName);

        //     // setPendingVerifyFile(file);
        //     navigate("/verify");
        //   } catch (error) {
        //     console.error(error);
        //     toast.error("Failed to open file for verification", {
        //       description: (error as any)?.message || String(error),
        //     });
        //   }
        // }),

        listen("trigger-import-invoice-mjki", async () => {
          toast.info("Coming Soon", {
            description:
              "This feature will soon be available. Thank you for your patience.",
            id: "toast-info-coming-soon",
          });
        }),

        listen("trigger-import-invoice-csv", async () => {
          toast.info("Coming Soon", {
            description:
              "This feature will soon be available. Thank you for your patience.",
            id: "toast-info-coming-soon",
          });
        }),

        listen("trigger-export-contacts", async () => {
          toast.info("Coming Soon", {
            description:
              "This feature will soon be available. Thank you for your patience.",
            id: "toast-info-coming-soon",
          });
        }),

        listen("trigger-export-invoices-backup", async () => {
          toast.info("Coming Soon", {
            description:
              "This feature will soon be available. Thank you for your patience.",
            id: "toast-info-coming-soon",
          });
        }),

        listen("trigger-export-invoices-csv", async () => {
          toast.info("Coming Soon", {
            description:
              "This feature will soon be available. Thank you for your patience.",
            id: "toast-info-coming-soon",
          });
        }),

        listen("trigger-export-app-data", async () => {
          toast.info("Coming Soon", {
            description:
              "This feature will soon be available. Thank you for your patience.",
            id: "toast-info-coming-soon",
          });
        }),

        // ─────────────────────────────────────────────────────────────
        // Account
        // ─────────────────────────────────────────────────────────────

        listen("trigger-import-contact", () => {
          setModalKey("import-contact");
          navigate("/contacts");
        }),

        listen("trigger-switch-account", () => {
          setModalKey("replace-account");
          navigate("/muid");
        }),

        listen("trigger-refresh-muid", async () => {
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
          setModalKey("auth-majikah");
        }),

        listen("trigger-auth-sign-out", async () => {
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
          navigate("/invoices");
        }),

        listen("trigger-dashboard-summary", () => {
          navigate("/dashboard");
        }),

        // ─────────────────────────────────────────────────────────────
        // Preferences
        // ─────────────────────────────────────────────────────────────

        listen("trigger-toggle-dark-mode", () => {
          dispatch(toggleTheme());
        }),

        // ─────────────────────────────────────────────────────────────
        // Tools
        // ─────────────────────────────────────────────────────────────

        listen("trigger-export-majik-key", async () => {
          toast.info("Coming Soon", {
            description:
              "This feature will soon be available. Thank you for your patience.",
            id: "toast-info-coming-soon",
          });
        }),

        listen("trigger-validate-invoice", async () => {
          toast.info("Coming Soon", {
            description:
              "This feature will soon be available. Thank you for your patience.",
            id: "toast-info-coming-soon",
          });
        }),

        // launch-web-app
        // system-status
        // docs
        // product-info
        // developer
        // report-issue
        // submit-ticket
        //
        // NOTE:
        // These are opened directly from Rust via open_url(...)
        // so no frontend listener is needed unless behavior changes.

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

        // ─────────────────────────────────────────────────────────────
        // Legacy / Future
        // ─────────────────────────────────────────────────────────────

        // listen("trigger-sign-file", async () => {
        //   TODO: Handle file signing
        // }),

        // listen("trigger-verify-file", async () => {
        //   TODO: Handle file verification
        // }),

        // listen("trigger-create-account", async () => {
        //   TODO: Handle account creation
        // }),

        // listen("trigger-import-account", async () => {
        //   TODO: Handle account import
        // }),
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
  }, [majik, majikah, dispatch, navigate, tour, userAccounts.length]);
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

  const tabs: RouterTabContent[] = [
    {
      id: "accounts",
      route: "/accounts",
      icon: IdentificationCardIcon,
      name: "Majik Universal ID",
      element: <UserMUIDPanel majik={majik} onUpdate={handleRefreshInstance} />,
    },

    {
      id: "contacts",
      route: "/contacts",
      name: "Contacts",
      icon: AddressBookIcon,
      element: <ContactsPanel majik={majik} onUpdate={handleRefreshInstance} />,
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
      id: "exchange",
      route: "/exchange",
      name: "Exchange",
      icon: BankIcon,
      element: <InvoiceExchangePanel majik={majik} />,
    },
  ];

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

        <ImportContactModal
          majik={majik}
          onSuccess={handleModalSuccess}
          open={modalKey === "import-contact"}
          onOpenChange={(change) =>
            setModalKey(change ? "import-contact" : null)
          }
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
