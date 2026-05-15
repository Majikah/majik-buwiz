import type { Tour } from "shepherd.js";

export function launchTourMyInvoices(
  tour: Tour,
  completeTutorialFn?: () => void,
): void {
  const completeTutorial = (): void => {
    tour.complete();
    completeTutorialFn?.();
  };

  // ── Step 1 — Tab introduction ─────────────────────────────────────────────
  tour.addStep({
    id: "majik-buwiz-my-invoices-welcome",
    title: "My Invoices",
    text: "This is your invoice hub. From here you can create, view, edit, sign, encrypt, duplicate, export, and delete your invoices — all in one place.",
    buttons: [
      { text: "End Tour", action: completeTutorial, secondary: true },
      { text: "Next", action: tour.next },
    ],
  });

  // ── Step 2 — Invoice table ────────────────────────────────────────────────
  tour.addStep({
    id: "majik-buwiz-my-invoices-table",
    title: "Your Invoice Table",
    text: "All your invoices are listed here. Each row shows the key details you need at a glance — invoice number, issuer, recipient, status, mode, amount, issue date, due date, and seal status.",
    attachTo: { element: "#table-invoices", on: "top" },
    buttons: [
      { text: "End Tour", action: completeTutorial, secondary: true },
      { text: "Back", action: tour.back },
      { text: "Next", action: tour.next },
    ],
  });

  // ── Step 3 — Column sorting ───────────────────────────────────────────────
  tour.addStep({
    id: "majik-buwiz-my-invoices-sort",
    title: "Sort Any Column",
    text: "Click any column header to sort your invoices by that field. Click again to reverse the order. This makes it easy to find your most recent invoices, largest amounts, or overdue items quickly.",
    attachTo: { element: "#table-invoices-header", on: "bottom" },
    buttons: [
      { text: "End Tour", action: completeTutorial, secondary: true },
      { text: "Back", action: tour.back },
      { text: "Next", action: tour.next },
    ],
  });

  // ── Step 4 — Quick actions ────────────────────────────────────────────────
  tour.addStep({
    id: "majik-buwiz-my-invoices-quick-actions",
    title: "Quick Actions",
    text: "The last column gives you one-click actions for each invoice. Depending on where the invoice is in its lifecycle, you can edit it, view it, duplicate it, or delete it. Signed invoices cannot be structurally edited — use Reissue to make changes.",
    attachTo: { element: "#table-invoices-col-actions", on: "left" },
    buttons: [
      { text: "End Tour", action: completeTutorial, secondary: true },
      { text: "Back", action: tour.back },
      { text: "Next", action: tour.next },
    ],
  });

  // ── Step 5 — Batch select ─────────────────────────────────────────────────
  tour.addStep({
    id: "majik-buwiz-my-invoices-batch-select",
    title: "Select Multiple Invoices",
    text: "Use the checkboxes on the left of each row to select multiple invoices at once. Once selected, you can bulk export them as CSV or bulk void and delete them in a single action.",
    attachTo: { element: "#table-invoices-col-checkbox", on: "right" },
    buttons: [
      { text: "End Tour", action: completeTutorial, secondary: true },
      { text: "Back", action: tour.back },
      { text: "Next", action: tour.next },
    ],
  });

  // ── Step 6 — Pagination ───────────────────────────────────────────────────
  tour.addStep({
    id: "majik-buwiz-my-invoices-pagination",
    title: "Pagination Controls",
    text: "Use the pagination controls here to navigate through your invoice list. You can change how many invoices are shown per page to suit how you like to work.",
    attachTo: { element: "#pagination-invoices", on: "top" },
    buttons: [
      { text: "End Tour", action: completeTutorial, secondary: true },
      { text: "Back", action: tour.back },
      { text: "Next", action: tour.next },
    ],
  });

  // ── Step 7 — Search ───────────────────────────────────────────────────────
  tour.addStep({
    id: "majik-buwiz-my-invoices-search",
    title: "Search Your Invoices",
    text: "Type here to search across your invoices. You can search by invoice number, issuer name, recipient name, or amount. Results update as you type.",
    attachTo: { element: "#input-invoices-search", on: "bottom" },
    buttons: [
      { text: "End Tour", action: completeTutorial, secondary: true },
      { text: "Back", action: tour.back },
      { text: "Next", action: tour.next },
    ],
  });

  // ── Step 8 — Filters ──────────────────────────────────────────────────────
  tour.addStep({
    id: "majik-buwiz-my-invoices-filters",
    title: "Filter Your Invoices",
    text: "Narrow down your invoice list using filters. You can filter by business status (Draft, Issued, Paid, Overdue, etc.), invoice mode (Signed Only or Encrypted & Signed), and seal status. Filters can be combined.",
    attachTo: { element: "#toolbar-invoices-filters", on: "bottom" },
    buttons: [
      { text: "End Tour", action: completeTutorial, secondary: true },
      { text: "Back", action: tour.back },
      { text: "Next", action: tour.next },
    ],
  });

  // ── Step 9 — Column visibility ────────────────────────────────────────────
  tour.addStep({
    id: "majik-buwiz-my-invoices-columns",
    title: "Customize Visible Columns",
    text: "Not all columns need to be visible all the time. Use this control to choose which columns appear in your table. Your selection is saved app-wide as your default view — it will be remembered the next time you open Majik Buwiz.",
    attachTo: { element: "#button-invoices-column-visibility", on: "bottom" },
    buttons: [
      { text: "End Tour", action: completeTutorial, secondary: true },
      { text: "Back", action: tour.back },
      { text: "Next", action: tour.next },
    ],
  });

  // ── Step 10 — Quick CSV export ────────────────────────────────────────────
  tour.addStep({
    id: "majik-buwiz-my-invoices-export-csv",
    title: "Export All Invoices to CSV",
    text: "Click here to quickly export all your invoices as a CSV file. You can choose which columns to include from a full column selector — useful for accounting tools or record-keeping.",
    attachTo: { element: "#button-invoices-export-csv", on: "bottom" },
    buttons: [
      { text: "End Tour", action: completeTutorial, secondary: true },
      { text: "Back", action: tour.back },
      { text: "Next", action: tour.next },
    ],
  });

  // ── Step 11 — Refresh ─────────────────────────────────────────────────────
  tour.addStep({
    id: "majik-buwiz-my-invoices-refresh",
    title: "Refresh Your Invoice List",
    text: "Click here to reload your invoices from local storage. Use this if you have just returned from the Exchange tab and want to make sure your latest received or synced invoices are showing.",
    attachTo: { element: "#button-invoices-refresh", on: "bottom" },
    buttons: [
      { text: "End Tour", action: completeTutorial, secondary: true },
      { text: "Back", action: tour.back },
      { text: "Next", action: tour.next },
    ],
  });

  // ── Step 12 — New invoice button ──────────────────────────────────────────
  tour.addStep({
    id: "majik-buwiz-my-invoices-new",
    title: "Create a New Invoice",
    text: "Ready to bill a client? Click here to open the invoice builder. Your business profile will be pre-filled as the issuer — just add a recipient, your line items, taxes, and any notes.",
    attachTo: { element: "#button-invoices-new", on: "bottom" },
    buttons: [
      { text: "End Tour", action: completeTutorial, secondary: true },
      { text: "Back", action: tour.back },
      { text: "Next", action: tour.next },
    ],
  });

  // ── Step 13 — Invoice count ───────────────────────────────────────────────
  tour.addStep({
    id: "majik-buwiz-my-invoices-count",
    title: "Total Invoice Count",
    text: "This shows the total number of invoices in your local database. It updates in real time as you create, duplicate, or delete invoices.",
    attachTo: { element: "#badge-invoices-count", on: "bottom" },
    buttons: [
      { text: "End Tour", action: completeTutorial, secondary: true },
      { text: "Back", action: tour.back },
      { text: "Finish Tour", action: completeTutorial },
    ],
  });

  tour.start();
}
