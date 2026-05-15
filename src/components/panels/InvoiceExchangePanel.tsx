/**
 * InvoiceExchangePanel.tsx
 *
 * Refactored to use ExchangeInvoiceTable in place of the inline renderList.
 * Bulk void/delete/dispute handlers live here and delegate to MajikBuwizDatabase.
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import styled, { keyframes } from "styled-components";
import {
  ArrowClockwiseIcon,
  ArrowLeftIcon,
  PaperPlaneTiltIcon,
  PlusIcon,
  TrayArrowDownIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";

import {
  GeneralInvoice,
  InvoiceStatus,
  MajikInvoice,
} from "@majikah/majik-invoice";

import { MajikBuwizDatabase } from "@/components/majik-context-wrapper/majik-buwiz-database";

import { PageResult } from "../majik-context-wrapper/_types";
import { ExchangeSearchBar } from "./exchange/ExchangeSearchBar";
import { InvoicePanel, InvoicePanelHandle } from "./InvoicePanel";
import { toast } from "sonner";

import { ExchangeStatusQuickActions } from "./exchange/ExchangeStatusQuickActions";
import { MissingRecipientsBanner } from "./invoice/MissingRecipientsBanner";
import DynamicAlertBanner from "../foundations/DynamicAlertBanner";
import { PublishInvoiceModal } from "./exchange/modals/PublishInvoiceModal";
import { ExchangeInvoiceTable } from "./exchange/ExchangeInvoiceTable";
import { VoidInvoiceModal } from "./exchange/modals/VoidInvoiceModal";
import {
  closeSealInvoiceCommand,
  countersignInvoiceCommand,
  deleteInvoicesCommand,
  disputeInvoicesCommand,
  restartInvoiceCommand,
  settleInvoiceCommand,
  syncInvoiceCommand,
  transitionInvoiceStatusCommand,
  voidInvoicesCommand,
} from "./exchange/invoice-exchange-commands";
import { DisputeInvoiceModal } from "./exchange/modals/DisputeInvoiceModal";
import { useMajikah } from "../majikah-session-wrapper/use-majikah";
import UserAuth from "../foundations/UserAuth";
import GuideHelper from "../functional/GuideHelper";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ExchangeTab = "inbox" | "sent";
type ContentView = "list" | "detail";

/** Cursor stack for a single tab — index 0 always = null (first page). */
interface CursorStack {
  cursors: (string | null)[];
  pageIndex: number;
  hasMore: boolean;
  total: number;
}

const initialStack = (): CursorStack => ({
  cursors: [null],
  pageIndex: 0,
  hasMore: false,
  total: 0,
});

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface InvoiceExchangePanelProps {
  majik: MajikBuwizDatabase;
}

// ---------------------------------------------------------------------------
// Animations
// ---------------------------------------------------------------------------

const spin = keyframes`
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
`;

// ---------------------------------------------------------------------------
// Styled — root layout
// ---------------------------------------------------------------------------

const Root = styled.div`
  display: flex;
  height: 100%;
  background: ${({ theme }) => theme.colors.primaryBackground};
  color: ${({ theme }) => theme.colors.textPrimary};
  overflow: hidden;
`;

// ---------------------------------------------------------------------------
// Nav Rail
// ---------------------------------------------------------------------------

const NavRail = styled.nav`
  width: 220px;
  flex-shrink: 0;
  border-right: 1px solid ${({ theme }) => theme.colors.primary}14;
  background: ${({ theme }) => theme.colors.secondaryBackground};
  display: flex;
  flex-direction: column;
  overflow-y: auto;
`;

const NavHeader = styled.div`
  width: 100%;
`;

const NavHeaderRow = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  padding: 16px 16px 14px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.primary}10;
`;

const NavTitle = styled.div`
  font-family: ${({ theme }) => theme.typography.fonts.semibold};
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.primary};
`;

const NavSubtitle = styled.div`
  font-size: 10px;
  font-family: ${({ theme }) => theme.typography.fonts.light};
  color: ${({ theme }) => theme.colors.textSecondary};
  margin-top: 2px;
  opacity: 0.55;
`;

const NavSection = styled.div`
  padding: 10px 0 4px;
`;

const NavSectionLabel = styled.div`
  padding: 0 16px 5px;
  font-size: 9.5px;
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.5;
`;

const NavItem = styled.button<{ $active: boolean }>`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 16px;
  border: none;
  background: none;
  cursor: pointer;
  width: 100%;
  text-align: left;
  transition: all 0.12s;
  position: relative;

  ${({ $active, theme }) =>
    $active
      ? `
          background: ${theme.colors.primarySoft};
          color: ${theme.colors.primary};
          &::before {
            content: "";
            position: absolute;
            left: 0; top: 4px; bottom: 4px;
            width: 2.5px;
            border-radius: 0 2px 2px 0;
            background: ${theme.colors.primary};
          }
        `
      : `
          color: ${theme.colors.textSecondary};
          &:hover {
            background: ${theme.colors.primarySoft}55;
            color: ${theme.colors.textPrimary};
          }
        `}
`;

const NavItemLabel = styled.span`
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  font-size: 12px;
  flex: 1;
`;

const NavBadge = styled.span<{ $primary?: boolean }>`
  font-family: ${({ theme }) => theme.typography.fonts.numbers};
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 10px;
  min-width: 18px;
  text-align: center;
  font-weight: 600;
  background: ${({ $primary, theme }) =>
    $primary ? theme.colors.primary : theme.colors.primarySoft};
  color: ${({ $primary, theme }) =>
    $primary ? (theme.colors.static?.white ?? "#fff") : theme.colors.primary};
`;

const NavDivider = styled.div`
  height: 1px;
  background: ${({ theme }) => theme.colors.primary}10;
  margin: 6px 16px;
`;

const PublishBtn = styled.button`
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 12px 12px 4px;
  padding: 9px 12px;
  border-radius: ${({ theme }) => theme.borders.radius.medium};
  background: ${({ theme }) => theme.gradients.primary};
  border: none;
  color: ${({ theme }) => theme.colors.static?.white ?? "#fff"};
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  font-size: 12px;
  cursor: pointer;
  transition: filter 0.15s;
  width: calc(100% - 24px);
  justify-content: center;

  &:hover {
    filter: brightness(1.07);
  }
`;

// ---------------------------------------------------------------------------
// Content Area
// ---------------------------------------------------------------------------

const ContentArea = styled.div`
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
`;

const BannerColumn = styled.div`
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  align-items: center;
`;

const BannerWidth = styled.div`
  display: flex;
  flex-direction: column;
  max-width: 600px;
`;

const ContentHeader = styled.div`
  padding: 12px 20px 11px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.primary}0e;
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
  background: ${({ theme }) => theme.colors.secondaryBackground};
`;

const PanelHeader = styled.div`
  display: flex;
  flex-direction: column;
  padding: 14px 18px 13px;
  flex: 1;
  overflow-y: auto;

  &::-webkit-scrollbar {
    width: 5px;
  }
  &::-webkit-scrollbar-thumb {
    background: ${({ theme }) => theme.gradients.primary};
    border-radius: 8px;
  }
`;

const BackBtn = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  font-size: 12px;
  padding: 6px 12px;
  border-radius: ${({ theme }) => theme.borders.radius.medium};
  border: 1px solid ${({ theme }) => theme.colors.primary}33;
  background: transparent;
  color: ${({ theme }) => theme.colors.textSecondary};
  cursor: pointer;
  transition: all 0.15s;
  flex-shrink: 0;
  &:hover {
    background: ${({ theme }) => theme.colors.primarySoft};
    color: ${({ theme }) => theme.colors.primary};
    border-color: ${({ theme }) => theme.colors.primary};
  }
`;

const HeaderTitle = styled.div`
  font-family: ${({ theme }) => theme.typography.fonts.semibold};
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textPrimary};
  flex: 1;
`;

const HeaderMeta = styled.div`
  font-size: 10px;
  font-family: ${({ theme }) => theme.typography.fonts.light};
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.55;
`;

const SmallIconBtn = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: ${({ theme }) => theme.borders.radius.small};
  border: 1px solid ${({ theme }) => theme.colors.primary}22;
  background: transparent;
  color: ${({ theme }) => theme.colors.textSecondary};
  cursor: pointer;
  transition: all 0.12s;
  &:hover {
    background: ${({ theme }) => theme.colors.primarySoft};
    color: ${({ theme }) => theme.colors.primary};
    border-color: ${({ theme }) => theme.colors.primary};
  }
`;

// ── List wrapper — contains search + table ────────────────────────────────

const ListView = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

// ── Empty / error states ──────────────────────────────────────────────────

const CenterState = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  opacity: 0.38;
  color: ${({ theme }) => theme.colors.textSecondary};
  text-align: center;
  padding: 3rem 2rem;
`;

const CenterText = styled.div`
  font-family: ${({ theme }) => theme.typography.fonts.light};
  font-size: 12px;
  line-height: 1.75;
  white-space: pre-line;
`;

const Spinner = styled(ArrowClockwiseIcon)`
  animation: ${spin} 0.75s linear infinite;
`;

export type ModalKeyContext =
  | "void"
  | "dispute"
  | "delete"
  | "restart"
  | "publish"
  | null;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LIMIT = 25;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const InvoiceExchangePanel: React.FC<InvoiceExchangePanelProps> = ({
  majik,
}) => {
  const { majikah } = useMajikah();
  // ── Tab / view ────────────────────────────────────────────────────────────
  const [tab, setTab] = useState<ExchangeTab>("inbox");
  const [view, setView] = useState<ContentView>("list");
  const [selectedInv, setSelectedInv] = useState<MajikInvoice | null>(null);

  const [localInvoices, setLocalInvoices] = useState<MajikInvoice[]>([]);

  // ── Raw data ──────────────────────────────────────────────────────────────
  const [inboundItems, setInboundItems] = useState<MajikInvoice[]>([]);
  const [outboundItems, setOutboundItems] = useState<MajikInvoice[]>([]);

  // ── Cursor stacks ─────────────────────────────────────────────────────────
  const [inboxStack, setInboxStack] = useState<CursorStack>(initialStack);
  const [outboxStack, setOutboxStack] = useState<CursorStack>(initialStack);

  const [isTransitioning, setIsTransitioning] = useState(false);

  const panelRef = useRef<InvoicePanelHandle>(null);

  // ── Filtered list ─────────────────────────────────────────────────────────
  const rawList = tab === "inbox" ? inboundItems : outboundItems;
  const [filteredList, setFilteredList] = useState<MajikInvoice[]>([]);

  useEffect(() => {
    setFilteredList(rawList);
  }, [rawList]);

  // ── Loading / error ───────────────────────────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Modals ─────────────────────────────────────────────────────────

  const [modalKey, setModalKey] = useState<ModalKeyContext>(null);

  const [modalInvoice, setModalInvoice] = useState<MajikInvoice | null>(null);

  // ── isIssuer helper ───────────────────────────────────────────────────────
  const isIssuer = useCallback(
    (inv: MajikInvoice): boolean => inv.userId === majik.user?.id,
    [majik],
  );

  // ── Published sets ────────────────────────────────────────────────────────
  const publishedIds = useMemo(
    () =>
      new Set(outboundItems.map((inv) => inv.id).filter(Boolean) as string[]),
    [outboundItems],
  );
  const publishedNumbers = useMemo(
    () =>
      new Set(
        outboundItems
          .map((inv) => inv.public.invoiceNumber)
          .filter(Boolean) as string[],
      ),
    [outboundItems],
  );

  const loadInvoices = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = majik.listInvoices();
      setLocalInvoices(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load invoices");
    } finally {
      setLoading(false);
    }
  }, [majik]);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  // ── Data loader ───────────────────────────────────────────────────────────

  const loadPage = useCallback(
    async (
      direction: "first" | "prev" | "next",
      targetTab: ExchangeTab,
      stack: CursorStack,
    ) => {
      setLoading(true);
      setError(null);

      let newPageIndex = stack.pageIndex;
      let cursor: string | null = null;

      if (direction === "first") {
        newPageIndex = 0;
        cursor = null;
      } else if (direction === "next") {
        newPageIndex = stack.pageIndex + 1;
        cursor = stack.cursors[newPageIndex] ?? null;
      } else if (direction === "prev") {
        newPageIndex = Math.max(0, stack.pageIndex - 1);
        cursor = stack.cursors[newPageIndex] ?? null;
      }

      try {
        const opts = { cursor, limit: LIMIT };
        const result: PageResult<MajikInvoice> =
          targetTab === "inbox"
            ? await majik.listInboundInvoices(opts)
            : await majik.listOutboundInvoices(opts);

        const nextIndex = newPageIndex + 1;
        const setStack = targetTab === "inbox" ? setInboxStack : setOutboxStack;
        setStack((prev) => {
          const cursors = [...prev.cursors];
          if (result.next_cursor) cursors[nextIndex] = result.next_cursor;
          return {
            cursors,
            pageIndex: newPageIndex,
            hasMore: result.has_more,
            total: result.count,
          };
        });

        if (targetTab === "inbox") setInboundItems(result.items);
        else setOutboundItems(result.items);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load invoices.",
        );
      } finally {
        setLoading(false);
      }
    },
    [majik],
  );

  // ── Listen for account changes ─────────────────────────────────────────────
  useEffect(() => {
    if (!majikah) return;

    const handler = async () => {
      await loadInvoices();
    };

    majikah.on("sign-in", handler);

    return () => {
      majikah.off("sign-in", handler);
    };
  }, [majikah, loadInvoices]);

  useEffect(() => {
    loadPage("first", "inbox", inboxStack);
  }, []); // eslint-disable-line
  useEffect(() => {
    loadPage("first", "sent", outboxStack);
  }, []); // eslint-disable-line

  // Reset view on tab change
  useEffect(() => {
    setView("list");
    setSelectedInv(null);
  }, [tab]);

  // ── Shared result sync ────────────────────────────────────────────────────

  const syncInvoiceResult = useCallback(
    (result: MajikInvoice) => {
      setSelectedInv(null);
      setSelectedInv(result);
      if (tab === "inbox") {
        setInboundItems((prev) =>
          prev.map((i) => (i.id === result.id ? result : i)),
        );
      } else {
        setOutboundItems((prev) =>
          prev.map((i) => (i.id === result.id ? result : i)),
        );
      }
    },
    [tab],
  );

  const handleRefresh = useCallback(async () => {
    setInboxStack(initialStack());
    setOutboxStack(initialStack());
    await majik.refreshInvoices?.().catch(() => {});
    loadPage("first", tab, initialStack());
  }, [majik, tab, loadPage]);

  // ── Detail helpers ────────────────────────────────────────────────────────

  const goBack = useCallback(() => {
    setView("list");
    setSelectedInv(null);
  }, []);

  const ensureDecrypted = useCallback(
    async (inv: MajikInvoice | null): Promise<MajikInvoice | null> => {
      if (!inv) return null;
      if (inv.isEncrypted && !inv.hasDecryptedCache) {
        try {
          return await majik.unlockInvoice(inv);
        } catch {
          return inv;
        }
      }
      return inv;
    },
    [majik],
  );

  const openDetail = useCallback(
    (inv: MajikInvoice) => {
      (async () => {
        const decrypted = await ensureDecrypted(inv);
        setSelectedInv(decrypted);
        setView("detail");
      })().catch((err) => {
        console.error(err);
        setSelectedInv(inv);
        setView("detail");
      });
    },
    [ensureDecrypted],
  );

  // ── Status transition (detail view) ──────────────────────────────────────

  const handleStatusTransition = useCallback(
    async (to: InvoiceStatus, inv?: MajikInvoice) => {
      const invoice = inv ?? selectedInv;
      if (!invoice) return;

      if (invoice.isEncrypted && !invoice.hasDecryptedCache) {
        toast.error("Decrypt invoice first.");
        return;
      }

      if (isIssuer(invoice) && to === "void") {
        setModalInvoice(invoice);
        setModalKey("void");
        return;
      }

      if (!isIssuer(invoice) && to === "disputed") {
        setModalInvoice(invoice);
        setModalKey("dispute");
        return;
      }

      setIsTransitioning(true);
      const promise = transitionInvoiceStatusCommand(majik, invoice, to);

      toast.promise(promise, {
        loading: `Updating status...`,
        success: (res) => {
          if (res.data) syncInvoiceResult(res.data);
          return `Marked as ${to}`;
        },
        error: (error) => {
          console.error(error);
          return "Status update failed";
        },
        finally: () => setIsTransitioning(false),
      });
    },
    [selectedInv, isIssuer, majik, syncInvoiceResult],
  );

  const handlePayment = useCallback(
    async (updatedGi: GeneralInvoice) => {
      const invoice = selectedInv;

      if (!invoice) return;
      const payerIsIssuer = isIssuer(invoice);
      const payments = updatedGi.proofOfPayments;
      const latestPayment = payments[payments.length - 1];
      if (!latestPayment) return;

      setIsTransitioning(true);
      const promise = settleInvoiceCommand(
        majik,
        invoice,
        latestPayment,
        payerIsIssuer,
      );

      toast.promise(promise, {
        loading: "Processing payment...",
        success: (res) => {
          if (res.data) syncInvoiceResult(res.data);
          return "Payment recorded";
        },
        error: (err) => `Payment failed: ${err}`,
        finally: () => setIsTransitioning(false),
      });
    },
    [selectedInv, isIssuer, majik, syncInvoiceResult],
  );

  const handleClearPayment = useCallback(async () => {
    const invoice = selectedInv;
    if (!invoice || !isIssuer(invoice)) return;
    setIsTransitioning(true);
    try {
      const result = await majik.resendInvoice(invoice);
      syncInvoiceResult(result);
      toast.success("Payments cleared. Invoice reissued.");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Clear payments failed.",
      );
    } finally {
      setIsTransitioning(false);
    }
  }, [selectedInv, isIssuer, majik, syncInvoiceResult]);

  const handleRestart = useCallback(async () => {
    const invoice = selectedInv;
    if (!invoice || !isIssuer(invoice)) return;
    setIsTransitioning(true);
    const promise = restartInvoiceCommand(majik, invoice);

    toast.promise(promise, {
      loading: "Restarting invoice...",
      success: (res) => {
        if (res.data) syncInvoiceResult(res.data);
        return "Invoice restarted";
      },
      error: "Restart failed",
      finally: () => setIsTransitioning(false),
    });
  }, [selectedInv, isIssuer, majik, syncInvoiceResult]);

  const handleFetchRemote = useCallback(async (): Promise<MajikInvoice> => {
    const invoice = selectedInv;
    if (!invoice) throw new Error("No invoice selected.");
    return majik.getInvoiceRemote(invoice.id, true);
  }, [selectedInv, majik]);

  const handleSync = useCallback(
    async (source: "local" | "cloud") => {
      const invoice = selectedInv;
      if (!invoice) return;
      setIsTransitioning(true);
      const promise = syncInvoiceCommand(majik, invoice, source);

      toast.promise(promise, {
        loading: "Syncing...",
        success: (res) => {
          if (res.data) syncInvoiceResult(res.data);
          return `Synced from ${source}`;
        },
        error: "Sync failed",
        finally: () => setIsTransitioning(false),
      });
    },
    [selectedInv, majik, syncInvoiceResult],
  );
  // ── Table handlers (list view) ────────────────────────────────────────────

  /** Void a single invoice (from per-row action). */
  const handleVoid = useCallback(
    async (inv: MajikInvoice, reason: string) => {
      setIsTransitioning(true);
      const promise = voidInvoicesCommand(majik, [inv], reason).then(
        (result) => {
          const { failedCount, ok, data, meta } = result;

          // ── STATE UPDATE ─────────────────────────────
          if (!!data && data.length > 0) {
            const updated = data[0];

            setInboundItems((prev) =>
              prev.map((i) => (i.id === updated.id ? updated : i)),
            );
            setOutboundItems((prev) =>
              prev.map((i) => (i.id === updated.id ? updated : i)),
            );

            setSelectedInv(updated);
          }

          return {
            voided: data?.length || 0,
            failedCount: failedCount || 0,
            ok,
            meta,
          };
        },
      );

      toast.promise(promise, {
        loading: "Voiding invoices...",
        success: (res) => {
          const parts = [];

          parts.push(
            `${res.voided} invoice${res.voided !== 1 ? "s" : ""} voided`,
          );

          if (res.failedCount > 0) {
            parts.push(`${res.failedCount} failed to void`);
          }

          return parts.join(" • ");
        },
        error: "Unexpected error while voiding invoices.",
        finally: () => setIsTransitioning(false),
      });
    },
    [majik],
  );

  /** Bulk void (from bulk bar). */
  const handleBulkVoid = useCallback(
    async (invoices: MajikInvoice[], reason: string) => {
      setIsTransitioning(true);
      const promise = voidInvoicesCommand(majik, invoices, reason);

      toast.promise(promise, {
        loading: "Voiding invoices...",
        success: (res) => {
          const updated = res.data ?? [];

          const patch = (prev: MajikInvoice[]) =>
            prev.map((i) => {
              const found = updated.find((u) => u.id === i.id);
              return found ?? i;
            });

          if (tab === "inbox") setInboundItems(patch);
          else setOutboundItems(patch);

          return `${updated.length} invoices voided`;
        },
        error: "Failed to void invoices",
        finally: () => setIsTransitioning(false),
      });
    },
    [majik, tab],
  );

  const handleDelete = useCallback(
    async (
      invoices: MajikInvoice[],
      removeLocally: boolean,
      forceVoid: boolean,
    ) => {
      setIsTransitioning(true);
      const promise = deleteInvoicesCommand(majik, invoices, {
        removeLocally,
        forceVoid,
      });

      toast.promise(promise, {
        loading: "Deleting invoices...",
        success: (res) => {
          const data = res.data;

          if (!data) return "Done";

          const remove = (prev: MajikInvoice[]) =>
            prev.filter((i) => !data.deletedIds.includes(i.id));

          if (tab === "inbox") setInboundItems(remove);
          else setOutboundItems(remove);

          if (selectedInv && data.deletedIds.includes(selectedInv.id)) {
            goBack();
          }

          return `${data.deletedIds.length} invoices deleted`;
        },
        error: "Delete failed",
        finally: () => setIsTransitioning(false),
      });
    },
    [majik, tab, selectedInv, goBack],
  );

  /** Dispute one or more invoices (recipients only). */
  const handleDispute = useCallback(
    async (invoices: MajikInvoice[], reason: string) => {
      setIsTransitioning(true);
      const promise = disputeInvoicesCommand(majik, invoices, reason);

      toast.promise(promise, {
        loading: "Raising disputes...",
        success: (res) => {
          const updated = res.data ?? [];

          if (updated.length === 0) {
            setSelectedInv(updated[0]);
          }

          const patch = (prev: MajikInvoice[]) =>
            prev.map((i) => {
              const found = updated.find((u) => u.id === i.id);
              return found ?? i;
            });

          if (tab === "inbox") setInboundItems(patch);
          else setOutboundItems(patch);

          return `${updated.length} disputes raised`;
        },
        error: "Dispute failed",
        finally: () => setIsTransitioning(false),
      });
    },
    [majik, tab],
  );

  const handleCounterSign = useCallback(async () => {
    const invoice = selectedInv;
    if (!invoice || isIssuer(invoice)) return;
    setIsTransitioning(true);
    const promise = countersignInvoiceCommand(majik, invoice);

    toast.promise(promise, {
      loading: "Signing invoice...",
      success: (res) => {
        if (res.data) syncInvoiceResult(res.data);
        return "Invoice signed and received";
      },
      error: "Signing failed",
      finally: () => setIsTransitioning(false),
    });
  }, [selectedInv, isIssuer, majik, syncInvoiceResult]);

  const handleCloseInvoice = useCallback(
    async (seal: boolean = false) => {
      const invoice = selectedInv;
      if (!invoice || !isIssuer(invoice)) return;
      setIsTransitioning(true);
      const promise = closeSealInvoiceCommand(majik, invoice, seal);

      toast.promise(promise, {
        loading: seal ? "Closing and sealing invoice..." : "Closing invoice...",
        success: (res) => {
          const toastMessage = seal
            ? "Invoice closed, sealed, and securely stored locally."
            : "Invoice closed, deleted from cloud, and stored locally.";

          if (res.ok && res.data) {
            const updatedInvoice = res.data;

            const remove = (prev: MajikInvoice[]) =>
              prev.filter((i) => i.id !== updatedInvoice.id);

            if (tab === "inbox") {
              setInboundItems(remove);
            } else {
              setOutboundItems(remove);
            }

            if (selectedInv?.id === updatedInvoice.id) {
              goBack();
            }
          }

          return toastMessage;
        },
        error: seal
          ? "Failed to close and seal invoice."
          : "Failed to close invoice.",
        finally: () => setIsTransitioning(false),
      });
    },
    [selectedInv, isIssuer, majik, syncInvoiceResult],
  );

  const hiddenInvoiceIds = useMemo(() => {
    const hidden = new Set<string>();
    for (const invoice of localInvoices) {
      const status = invoice.public?.status;
      if (status !== "issued") {
        hidden.add(invoice.id);
        continue;
      }
      if (publishedIds.has(invoice.id)) {
        hidden.add(invoice.id);
        continue;
      }
      const invoiceNumber = invoice.public?.invoiceNumber;
      if (invoiceNumber && publishedNumbers.has(invoiceNumber)) {
        hidden.add(invoice.id);
      }
    }
    return hidden;
  }, [localInvoices, publishedIds, publishedNumbers]);

  const handlePublishSuccess = useCallback(async () => {
    await loadInvoices();
    setOutboxStack(initialStack());
    loadPage("first", "sent", initialStack());
    setView("list");
    setTab("sent");
  }, [loadInvoices, loadPage]);

  // ── Header values ─────────────────────────────────────────────────────────

  const headerTitle =
    view === "list"
      ? tab === "inbox"
        ? "Inbox"
        : "Sent"
      : (selectedInv?.public.invoiceNumber ??
        selectedInv?.id?.slice(0, 10) ??
        "Invoice");

  const headerMeta =
    view === "list"
      ? `${filteredList.length} shown`
      : tab === "inbox"
        ? `From ${selectedInv?.public.issuerName ?? "—"}`
        : `To ${selectedInv?.public.recipientName ?? "—"}`;

  const [userCanSign, setUserCanSign] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const checkPermission = async () => {
      if (!selectedInv) {
        setUserCanSign(false);
        return;
      }

      try {
        const result = await majik.canSignInvoice(selectedInv);

        if (!cancelled) {
          setUserCanSign(result.permitted);
        }
      } catch (err) {
        if (!cancelled) {
          setUserCanSign(false);
        }
      }
    };

    checkPermission();

    return () => {
      cancelled = true;
    };
  }, [selectedInv]);

  // ── Detail view ───────────────────────────────────────────────────────────

  const renderInvoiceDetails = () => {
    if (!selectedInv) return null;
    const invoiceIsIssuer = isIssuer(selectedInv);

    return (
      <PanelHeader>
        <MissingRecipientsBanner
          invoice={selectedInv}
          majik={majik}
          onInvite={() => toast.info("Invite flow coming soon.")}
        />
        {!selectedInv.isLocked ? (
          <ExchangeStatusQuickActions
            currentStatus={selectedInv.status}
            isIssuer={invoiceIsIssuer}
            majikInvoice={selectedInv}
            invoice={selectedInv.invoice}
            onTransition={handleStatusTransition}
            onPayment={handlePayment}
            onClearPayment={handleClearPayment}
            onRestart={handleRestart}
            onDelete={async (removeLocally) =>
              handleDelete([selectedInv], removeLocally, false)
            }
            onSync={handleSync}
            onFetchRemote={handleFetchRemote}
            disabled={isTransitioning}
          />
        ) : (
          <DynamicAlertBanner
            title="Invoice Locked"
            description="This invoice is currently encrypted. Decrypt it to view details and enable available actions."
          />
        )}
        <InvoicePanel
          key={`${selectedInv.id}-view`}
          majik={majik}
          initialInvoice={selectedInv}
          readonly
          ref={panelRef}
          onUpdate={setSelectedInv}
          canSign={userCanSign}
          onSign={handleCounterSign}
          onCloseInvoice={handleCloseInvoice}
        />
      </PanelHeader>
    );
  };

  if (!majikah.isAuthenticated) {
    return (
      <Root>
        <BannerColumn>
          <BannerWidth>
            <DynamicAlertBanner
              title="Majikah Account & Universal ID Required"
              description="To use the Cloud Invoice Exchange, you must have a valid Majikah account and a registered Majik Universal ID. Please log in or create an account first, then create your Majik Universal ID to enable secure cloud invoice exchange."
              level="warning"
            />
          </BannerWidth>

          <UserAuth />
        </BannerColumn>
      </Root>
    );
  }

  // ── Main render ───────────────────────────────────────────────────────────

  return (
    <Root>
      {/* Nav Rail */}
      <NavRail>
        <NavHeaderRow>
          <NavHeader>
            <NavTitle>Exchange </NavTitle>
            <NavSubtitle>Majikah Network</NavSubtitle>
          </NavHeader>
          <GuideHelper docsPath="https://majikah.solutions/products/majik-buwiz/docs/buwiz-exchange-overview" />
        </NavHeaderRow>

        <PublishBtn onClick={() => setModalKey("publish")}>
          <PlusIcon size={13} weight="bold" />
          Send Invoice
        </PublishBtn>

        <NavSection>
          <NavSectionLabel>Mailbox</NavSectionLabel>
          <NavItem $active={tab === "inbox"} onClick={() => setTab("inbox")}>
            <TrayArrowDownIcon
              size={13}
              weight={tab === "inbox" ? "fill" : "regular"}
            />
            <NavItemLabel>Inbox</NavItemLabel>
            {inboxStack.total > 0 && (
              <NavBadge $primary>{inboxStack.total}</NavBadge>
            )}
          </NavItem>
          <NavItem $active={tab === "sent"} onClick={() => setTab("sent")}>
            <PaperPlaneTiltIcon
              size={13}
              weight={tab === "sent" ? "fill" : "regular"}
            />
            <NavItemLabel>Sent</NavItemLabel>
            {outboxStack.total > 0 && <NavBadge>{outboxStack.total}</NavBadge>}
          </NavItem>
        </NavSection>

        <NavDivider />

        <NavSection>
          <NavItem $active={false} onClick={handleRefresh}>
            {loading ? <Spinner size={12} /> : <ArrowClockwiseIcon size={12} />}
            <NavItemLabel>Refresh</NavItemLabel>
          </NavItem>
        </NavSection>
      </NavRail>

      {/* Content Area */}
      <ContentArea>
        <ContentHeader>
          {view === "detail" && (
            <BackBtn onClick={goBack}>
              <ArrowLeftIcon size={12} weight="bold" />
              Back
            </BackBtn>
          )}
          <HeaderTitle>{headerTitle}</HeaderTitle>
          <HeaderMeta>{headerMeta}</HeaderMeta>
          {view === "list" && (
            <SmallIconBtn onClick={handleRefresh} title="Refresh">
              {loading ? (
                <Spinner size={13} />
              ) : (
                <ArrowClockwiseIcon size={13} />
              )}
            </SmallIconBtn>
          )}
        </ContentHeader>

        {view === "detail" ? (
          renderInvoiceDetails()
        ) : (
          <ListView>
            {/* Search bar */}
            <ExchangeSearchBar
              invoices={rawList}
              tab={tab}
              onFilter={setFilteredList}
            />

            {/* Error / empty state outside table */}
            {error ? (
              <CenterState>
                <WarningCircleIcon size={30} />
                <CenterText>{error}</CenterText>
              </CenterState>
            ) : (
              <ExchangeInvoiceTable
                items={filteredList}
                tab={tab}
                isIssuer={isIssuer}
                loading={loading}
                onView={openDetail}
                onVoid={handleVoid}
                onDelete={handleDelete}
                onDispute={handleDispute}
                onBulkVoid={handleBulkVoid}
              />
            )}
          </ListView>
        )}
      </ContentArea>

      <PublishInvoiceModal
        majik={majik}
        localInvoices={localInvoices}
        hiddenInvoiceIds={hiddenInvoiceIds}
        onOpenChange={(change) => setModalKey(change ? "publish" : null)}
        open={modalKey === "publish"}
        onSuccess={handlePublishSuccess}
      />

      <VoidInvoiceModal
        open={modalKey === "void"}
        onOpenChange={(change) => setModalKey(change ? "void" : null)}
        invoices={modalInvoice ? [modalInvoice] : []}
        onConfirm={async (reason) => {
          if (!modalInvoice || modalKey !== "void") return;
          handleVoid(modalInvoice, reason);
        }}
      />

      <DisputeInvoiceModal
        open={modalKey === "dispute"}
        onOpenChange={(change) => setModalKey(change ? "dispute" : null)}
        invoices={modalInvoice ? [modalInvoice] : []}
        onConfirm={async (reason) => {
          if (!modalInvoice || modalKey !== "dispute") return;
          handleDispute([modalInvoice], reason);
        }}
      />
    </Root>
  );
};
