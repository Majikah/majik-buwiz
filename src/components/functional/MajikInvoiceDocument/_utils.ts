import { ISODateString, PaymentTerms } from "@majikah/majik-invoice";

export interface PaymentTermMeta {
  title: string;
  description: string;
}

export function getPaymentTermMeta(term: PaymentTerms): PaymentTermMeta {
  switch (term) {
    case "immediate":
      return {
        title: "Pay Immediately",
        description:
          "Best for quick transactions. The customer is expected to pay as soon as they receive the invoice. Use this for one-time work or when you want instant payment.",
      };

    case "net7":
      return {
        title: "7 Days to Pay",
        description:
          "Good for small projects or trusted clients. Gives the customer a short window (1 week) to complete payment.",
      };

    case "net15":
      return {
        title: "15 Days to Pay",
        description:
          "A balanced option. Offers some flexibility while still keeping payments relatively fast. Ideal for regular clients.",
      };

    case "net30":
      return {
        title: "30 Days to Pay",
        description:
          "The most common payment term. Use this for professional or corporate clients who need time for approvals and processing.",
      };

    case "net60":
      return {
        title: "60 Days to Pay",
        description:
          "Best for large projects or enterprise clients. Gives them more time, but expect slower cash flow.",
      };

    case "net90":
      return {
        title: "90 Days to Pay",
        description:
          "Used for very large deals or long-term contracts. Only choose this if you’re comfortable waiting several months for payment.",
      };

    case "eom":
      return {
        title: "End of Month",
        description:
          "Payment is due at the end of the current month, no matter when the invoice was sent. Useful for businesses that close payments monthly.",
      };

    case "cod":
      return {
        title: "Cash on Delivery",
        description:
          "Payment is collected when the product or service is delivered. Ideal for physical goods or in-person transactions.",
      };

    case "prepaid":
      return {
        title: "Pay Before Work Starts",
        description:
          "Full payment is required upfront. Best for new clients, high-risk projects, or when you want to avoid unpaid work.",
      };

    case "custom":
      return {
        title: "Custom Payment Terms",
        description:
          "Set your own payment rules. Use this if none of the standard options fit your agreement with the client.",
      };

    default:
      return {
        title: "Unknown Payment Term",
        description: "This payment term is not recognized.",
      };
  }
}

// Add to PaymentTermsPicker.tsx, exported for use in DatesMeta

export function computeDueDateFromTerm(
  issueDate: ISODateString,
  term: PaymentTerms,
): ISODateString | undefined {
  const base = new Date(issueDate);
  if (isNaN(base.getTime())) return undefined;

  switch (term) {
    case "immediate":
      return issueDate;
    case "net7":
      base.setDate(base.getDate() + 7);
      break;
    case "net15":
      base.setDate(base.getDate() + 15);
      break;
    case "net30":
      base.setDate(base.getDate() + 30);
      break;
    case "net60":
      base.setDate(base.getDate() + 60);
      break;
    case "net90":
      base.setDate(base.getDate() + 90);
      break;
    case "eom":
      // Last day of the issue month
      base.setMonth(base.getMonth() + 1, 0);
      break;
    default:
      // cod, prepaid, custom — no implied date
      return undefined;
  }

  return base.toISOString().slice(0, 10) as ISODateString;
}

// ---------------------------------------------------------------------------
// Invoice Reference Type — Meta Utilities
// ---------------------------------------------------------------------------

export const REFERENCE_TYPE_OPTIONS = [
  // Common commercial references
  "PO",
  "SO",
  "CONTRACT",
  "QUOTE",
  "DELIVERY_ORDER",
  "WORK_ORDER",
  // Financial / credit
  "CREDIT_NOTE",
  "DEBIT_NOTE",
  "PROFORMA",
  // Logistics / compliance
  "CUSTOMS",
  "BILL_OF_LADING",
  "PACKING_LIST",
  // Project / service
  "PROJECT",
  "RETAINER",
  "CHANGE_ORDER",
  // Internal / admin
  "BUDGET_CODE",
  "DEPARTMENT_CODE",
  "TAX_EXEMPTION",
  // Catch-all
  "OTHER",
] as const;

export type InvoiceReferenceType = (typeof REFERENCE_TYPE_OPTIONS)[number];

// ---------------------------------------------------------------------------
// Category — for visual grouping / badge colour
// ---------------------------------------------------------------------------

export type ReferenceCategory =
  | "commercial"
  | "financial"
  | "logistics"
  | "project"
  | "internal"
  | "other";

export const REFERENCE_CATEGORY: Record<
  InvoiceReferenceType,
  ReferenceCategory
> = {
  PO: "commercial",
  SO: "commercial",
  CONTRACT: "commercial",
  QUOTE: "commercial",
  DELIVERY_ORDER: "commercial",
  WORK_ORDER: "commercial",
  CREDIT_NOTE: "financial",
  DEBIT_NOTE: "financial",
  PROFORMA: "financial",
  CUSTOMS: "logistics",
  BILL_OF_LADING: "logistics",
  PACKING_LIST: "logistics",
  PROJECT: "project",
  RETAINER: "project",
  CHANGE_ORDER: "project",
  BUDGET_CODE: "internal",
  DEPARTMENT_CODE: "internal",
  TAX_EXEMPTION: "internal",
  OTHER: "other",
};

export const CATEGORY_LABEL: Record<ReferenceCategory, string> = {
  commercial: "Commercial",
  financial: "Financial",
  logistics: "Logistics",
  project: "Project",
  internal: "Internal",
  other: "Other",
};

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

export interface InvoiceReferenceTypeMeta {
  /** Short human-readable label, no jargon */
  title: string;
  /** One-sentence plain-English description of what this reference is for */
  description: string;
}

export function getInvoiceReferenceTypeMeta(
  type: InvoiceReferenceType,
): InvoiceReferenceTypeMeta {
  switch (type) {
    // ---- Commercial --------------------------------------------------------

    case "PO":
      return {
        title: "Purchase Order",
        description:
          "A number the buyer gave you before the work started. Including it helps their finance team match your invoice quickly and avoid payment delays.",
      };

    case "SO":
      return {
        title: "Sales Order",
        description:
          "Your own internal order number that tracks this sale. Useful when you need to cross-reference the invoice with your records.",
      };

    case "CONTRACT":
      return {
        title: "Contract Number",
        description:
          "The ID of the signed agreement that authorises this work or purchase. Include it when your client requires invoices to be tied to a formal contract.",
      };

    case "QUOTE":
      return {
        title: "Quote / Estimate Number",
        description:
          "Refers back to the price estimate or proposal you sent earlier. Lets the client confirm the final invoice matches what was agreed.",
      };

    case "DELIVERY_ORDER":
      return {
        title: "Delivery Order",
        description:
          "Links the invoice to a specific shipment or delivery. Common in retail, distribution, and logistics where goods are delivered in batches.",
      };

    case "WORK_ORDER":
      return {
        title: "Work Order",
        description:
          "An internal authorisation number for a specific job or task. Often used by maintenance, facilities, and field-service businesses.",
      };

    // ---- Financial ---------------------------------------------------------

    case "CREDIT_NOTE":
      return {
        title: "Credit Note",
        description:
          "References a credit you issued to reduce a previous invoice. Use this to keep both documents linked so reconciliation is straightforward.",
      };

    case "DEBIT_NOTE":
      return {
        title: "Debit Note",
        description:
          "References a debit memo that increases the amount owed. Typically used to correct an under-billed invoice or add charges after the fact.",
      };

    case "PROFORMA":
      return {
        title: "Pro Forma Invoice",
        description:
          "A preliminary invoice sent before goods are shipped or services completed — often required for customs clearance or advance payment approval.",
      };

    // ---- Logistics ---------------------------------------------------------

    case "CUSTOMS":
      return {
        title: "Customs / Import Reference",
        description:
          "A reference number required for cross-border shipments. Include this when the goods cross international borders and customs documentation is needed.",
      };

    case "BILL_OF_LADING":
      return {
        title: "Bill of Lading",
        description:
          "The shipping carrier's receipt for goods in transit. Required for sea or air freight invoices and for customs clearance purposes.",
      };

    case "PACKING_LIST":
      return {
        title: "Packing List",
        description:
          "Ties the invoice to a detailed list of items in the shipment. Useful for verifying what was delivered matches what was billed.",
      };

    // ---- Project / Service -------------------------------------------------

    case "PROJECT":
      return {
        title: "Project Code",
        description:
          "Links the invoice to a named project so the client can allocate the cost correctly. Especially helpful for long-running or multi-phase engagements.",
      };

    case "RETAINER":
      return {
        title: "Retainer Agreement",
        description:
          "Refers to an ongoing monthly or recurring arrangement. Use when billing against a pre-agreed retainer rather than a one-off job.",
      };

    case "CHANGE_ORDER":
      return {
        title: "Change Order",
        description:
          "A formal amendment to the original scope of work. Including the change-order number shows the client exactly what extra work this invoice covers.",
      };

    // ---- Internal ----------------------------------------------------------

    case "BUDGET_CODE":
      return {
        title: "Budget / Cost-Centre Code",
        description:
          "An internal code the client uses to book expenses to the right budget line. Many large organisations require this before they can approve payment.",
      };

    case "DEPARTMENT_CODE":
      return {
        title: "Department Code",
        description:
          "Routes the invoice to the correct department inside the client's organisation. Speeds up approval in companies with multiple teams or offices.",
      };

    case "TAX_EXEMPTION":
      return {
        title: "Tax Exemption Certificate",
        description:
          "The reference number of a tax-exemption certificate held by the client. Include this when the transaction is zero-rated or exempt from local taxes.",
      };

    // ---- Other -------------------------------------------------------------

    case "OTHER":
      return {
        title: "Other Reference",
        description:
          "Any reference not covered above — an internal tracking code, a verbal agreement ID, or anything specific to your industry or workflow.",
      };

    default: {
      const _exhaustive: never = type;
      void _exhaustive;
      return {
        title: "Unknown Reference",
        description: "This reference type is not recognised.",
      };
    }
  }
}
