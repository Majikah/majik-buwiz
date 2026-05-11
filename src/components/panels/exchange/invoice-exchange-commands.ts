import {
  InvoiceStatus,
  MajikInvoice,
  ProofOfPayment,
} from "@majikah/majik-invoice";
import { MajikBuwizDatabase } from "@/components/majik-context-wrapper/majik-buwiz-database";

// ---------------------------------------------------------------------------
// Shared Types
// ---------------------------------------------------------------------------

export type CommandResult<T = any> = {
  ok: boolean;
  data?: T;
  failedCount?: number;
  meta?: Record<string, any>;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const settleAll = async <T, R>(items: T[], fn: (item: T) => Promise<R>) => {
  const results = await Promise.allSettled(items.map(fn));

  const succeeded: R[] = [];
  let failed = 0;

  results.forEach((r) => {
    if (r.status === "fulfilled") succeeded.push(r.value);
    else failed++;
  });

  return { succeeded, failed };
};

// ---------------------------------------------------------------------------
// VOID INVOICES
// ---------------------------------------------------------------------------

export const voidInvoicesCommand = async (
  majik: MajikBuwizDatabase,
  invoices: MajikInvoice[],
  reason?: string,
): Promise<CommandResult<MajikInvoice[]>> => {
  const { succeeded, failed } = await settleAll(invoices, (inv) =>
    majik.voidInvoice(inv, reason),
  );

  return {
    ok: succeeded.length > 0,
    data: succeeded,
    failedCount: failed,
  };
};

// ---------------------------------------------------------------------------
// DELETE INVOICES (with optional forceVoid pipeline)
// ---------------------------------------------------------------------------

export const deleteInvoicesCommand = async (
  majik: MajikBuwizDatabase,
  invoices: MajikInvoice[],
  opts: {
    removeLocally: boolean;
    forceVoid: boolean;
  },
): Promise<
  CommandResult<{
    deletedIds: string[];
    failedDeletes: number;
    failedVoids: number;
  }>
> => {
  const toDelete = [...invoices];
  let failedVoids = 0;

  // ── VOID PHASE ─────────────────────────────────────────────
  if (opts.forceVoid) {
    const nonVoided = invoices.filter((inv) => inv.public?.status !== "void");

    const voidResults = await settleAll(nonVoided, (inv) =>
      majik.voidInvoice(inv),
    );

    voidResults.succeeded.forEach((voiced) => {
      const idx = toDelete.findIndex((i) => i.id === voiced.id);
      if (idx !== -1) toDelete[idx] = voiced;
    });

    failedVoids = voidResults.failed;
  }

  const eligible = opts.forceVoid
    ? toDelete.filter((inv) => inv.public?.status === "void")
    : toDelete;

  // ── DELETE PHASE ───────────────────────────────────────────
  const { succeeded, failed } = await settleAll(eligible, (inv) =>
    majik.deleteInvoice(inv, opts.removeLocally),
  );

  return {
    ok: succeeded.length > 0,
    data: {
      deletedIds: succeeded.map((i: any) => i.id),
      failedDeletes: failed,
      failedVoids,
    },
  };
};

// ---------------------------------------------------------------------------
// DISPUTE INVOICES
// ---------------------------------------------------------------------------

export const disputeInvoicesCommand = async (
  majik: MajikBuwizDatabase,
  invoices: MajikInvoice[],
  reason: string,
): Promise<CommandResult<MajikInvoice[]>> => {
  const { succeeded, failed } = await settleAll(invoices, (inv) =>
    majik.disputeInvoice(inv, reason),
  );

  return {
    ok: succeeded.length > 0,
    data: succeeded,
    failedCount: failed,
  };
};

// ---------------------------------------------------------------------------
// SETTLE PAYMENT
// ---------------------------------------------------------------------------

export const settleInvoiceCommand = async (
  majik: MajikBuwizDatabase,
  invoice: MajikInvoice,
  payment: ProofOfPayment,
  isIssuer: boolean = false,
): Promise<CommandResult<MajikInvoice>> => {
  const result = isIssuer
    ? await majik.addPayment(invoice, payment)
    : await majik.settleInvoice(invoice, payment);

  return {
    ok: true,
    data: result,
  };
};

// ---------------------------------------------------------------------------
// RESTART / REISSUE
// ---------------------------------------------------------------------------

export const restartInvoiceCommand = async (
  majik: MajikBuwizDatabase,
  invoice: MajikInvoice,
): Promise<CommandResult<MajikInvoice>> => {
  const result = await majik.resendInvoice(invoice);

  return {
    ok: true,
    data: result,
  };
};

// ---------------------------------------------------------------------------
// COUNTERSIGN (RECIPIENT)
// ---------------------------------------------------------------------------

export const countersignInvoiceCommand = async (
  majik: MajikBuwizDatabase,
  invoice: MajikInvoice,
): Promise<CommandResult<MajikInvoice>> => {
  const result = await majik.markInvoiceViewed(invoice);

  return {
    ok: true,
    data: result,
  };
};

// ---------------------------------------------------------------------------
// STATUS TRANSITION
// ---------------------------------------------------------------------------

export const transitionInvoiceStatusCommand = async (
  majik: MajikBuwizDatabase,
  invoice: MajikInvoice,
  to: InvoiceStatus,
): Promise<CommandResult<MajikInvoice>> => {
  let result: MajikInvoice;

  switch (to) {
    case "viewed":
      result = await majik.markInvoiceViewed(invoice);
      break;

    case "issued":
      result =
        invoice.status === "disputed"
          ? await majik.resolveDispute(invoice)
          : await majik.resendInvoice(invoice);
      break;

    default:
      throw new Error(`Unsupported transition: ${to}`);
  }

  return {
    ok: true,
    data: result,
  };
};

// ---------------------------------------------------------------------------
// SYNC COMMAND
// ---------------------------------------------------------------------------

export const syncInvoiceCommand = async (
  majik: MajikBuwizDatabase,
  invoice: MajikInvoice,
  source: "local" | "cloud",
): Promise<CommandResult<MajikInvoice>> => {
  if (source === "local") {
    const local = await majik.getInvoice(invoice.id);
    if (!local) throw new Error("Local invoice not found.");

    const updated = await majik.updateInvoice(local);

    return { ok: true, data: updated };
  }

  const remote = await majik.getInvoiceRemote(invoice.id, true);
  await majik.storeInvoice(remote);

  return { ok: true, data: remote };
};



// ---------------------------------------------------------------------------
// CLOSE AND SEAL (ISSUER)
// ---------------------------------------------------------------------------

export const closeSealInvoiceCommand = async (
  majik: MajikBuwizDatabase,
  invoice: MajikInvoice,
  seal: boolean = false
): Promise<CommandResult<MajikInvoice>> => {
  const result = await majik.closeInvoice(invoice,seal);

  return {
    ok: true,
    data: result,
  };
};