import type {
  BusinessRow,
} from "../leak-engine";

import type {
  BusinessDataRow,
} from "./detector-types";

/* ================================== */
/* CANONICAL FIELDS */
/* ================================== */

export const CANONICAL_BUSINESS_FIELDS = [
  "Customer Name",
  "Status",
  "Quote Amount",
  "Invoice Amount",
  "Follow Up",
  "Date",
  "Last Contact Date",
  "Due Date",
  "Payment Status",
  "Contacted",
  "Estimate Sent",
  "Expiration Date",
  "Amount Paid",
  "Appointment Status",
  "Job Status",
  "Job Amount",

  "Deposit Amount",
  "Deposit Paid",
  "Deposit Status",

  "Billing Status",

  "Refund Amount",

  "Recurring Amount",
  "Recurring Status",
  "Next Payment Date",

  "Renewal Amount",
  "Renewal Date",
  "Renewal Status",

  /*
    Fee fields
  */
  "Fee Amount",
  "Fee Type",
  "Fee Status",
] as const;

export type CanonicalBusinessField =
  (typeof CANONICAL_BUSINESS_FIELDS)[number];

/* ================================== */
/* FIELD ALIASES */
/* ================================== */

const FIELD_ALIASES: Record<
  CanonicalBusinessField,
  string[]
> = {
  "Customer Name": [
    "customer name",
    "customer",
    "client",
    "client name",
    "contact",
    "contact name",
    "lead",
    "lead name",
    "name",
    "account",
  ],

  Status: [
    "status",
    "lead status",
    "customer status",
    "estimate status",
    "quote status",
    "proposal status",
    "pipeline stage",
  ],

  "Quote Amount": [
    "quote amount",
    "quote",
    "quoted amount",
    "estimate",
    "estimate amount",
    "estimated amount",
    "proposal amount",
    "potential value",
    "lead value",
    "opportunity value",
    "deal value",
  ],

  "Invoice Amount": [
    "invoice amount",
    "invoice",
    "invoice total",
    "total invoice",
    "total invoiced",
    "amount due",
    "balance",
    "balance due",
    "outstanding balance",
    "outstanding amount",
    "amount outstanding",
    "unpaid amount",
    "remaining balance",
  ],

  "Follow Up": [
    "follow up",
    "followup",
    "follow-up",
    "follow up status",
    "followup status",
    "follow-up status",
    "followed up",
    "followed-up",
  ],

  Date: [
    "date",
    "created date",
    "created at",
    "date created",
    "lead date",
    "lead created",
    "lead created at",
    "estimate date",
    "estimate created",
    "estimate created at",
    "quote date",
    "quote created",
    "proposal date",
    "proposal created",
    "invoice date",
    "invoice created",
    "invoice created at",
    "job date",
    "appointment date",
    "created on",
  ],

  "Last Contact Date": [
    "last contact date",
    "last contacted",
    "last contact",
    "last called",
  ],

  "Due Date": [
    "due date",
    "invoice due date",
    "payment due date",
  ],

  "Payment Status": [
    "payment status",
    "payment",
    "transaction status",
    "charge status",
  ],

  Contacted: [
    "contacted",
    "was contacted",
    "lead contacted",
    "contact status",
    "reached",
  ],

  "Estimate Sent": [
    "estimate sent",
    "quote sent",
    "proposal sent",
    "sent",
  ],

  "Expiration Date": [
    "expiration date",
    "expiry date",
    "expires",
    "expires on",
    "valid until",
    "estimate expiration",
    "estimate expiration date",
    "quote expiration",
    "quote expiration date",
  ],

  "Amount Paid": [
    "amount paid",
    "paid amount",
    "payment amount",
    "total paid",
    "collected amount",
    "amount collected",
    "cash received",
  ],

  "Appointment Status": [
    "appointment status",
    "booking status",
    "schedule status",
  ],

  "Job Status": [
    "job status",
    "work status",
    "service status",
  ],

  "Job Amount": [
    "job amount",
    "job value",
    "job total",
    "service amount",
    "service total",
    "sale amount",
    "contract amount",
  ],

  "Deposit Amount": [
    "deposit amount",
    "deposit",
    "required deposit",
    "deposit required",
    "deposit due",
    "deposit total",
    "required deposit amount",
    "down payment",
    "down payment amount",
    "required down payment",
    "booking deposit",
    "booking deposit amount",
    "initial deposit",
    "initial payment",
    "retainer amount",
    "retainer",
  ],

  "Deposit Paid": [
    "deposit paid",
    "deposit collected",
    "deposit received",
    "deposit amount paid",
    "deposit amount collected",
    "deposit amount received",
    "paid deposit",
    "collected deposit",
    "down payment paid",
    "down payment collected",
    "down payment received",
    "booking deposit paid",
    "booking deposit collected",
    "initial payment paid",
    "retainer paid",
    "retainer collected",
  ],

  "Deposit Status": [
    "deposit status",
    "deposit payment status",
    "deposit collection status",
    "down payment status",
    "booking deposit status",
    "initial payment status",
    "retainer status",
  ],

  "Billing Status": [
    "billing status",
    "bill status",
    "invoice status",
    "invoicing status",
    "billing state",
    "invoice state",
    "billed status",
    "billed",
    "billed?",
    "invoiced",
    "invoiced?",
    "invoice sent",
    "invoice sent?",
    "bill sent",
    "bill sent?",
    "billing complete",
    "billing completed",
    "needs invoice",
    "needs invoicing",
    "needs billing",
    "invoice needed",
    "billing needed",
  ],

  "Refund Amount": [
    "refund amount",
    "refund due",
    "refund total",
    "refund value",
    "refund owed",
    "amount to refund",
    "amount due for refund",
    "amount owed to customer",
    "customer refund amount",
    "customer refund",
    "approved refund amount",
    "pending refund amount",
    "credit amount",
    "customer credit amount",
  ],

  "Recurring Amount": [
    "recurring amount",
    "recurring payment amount",
    "recurring charge amount",
    "subscription amount",
    "subscription price",
    "subscription fee",
    "membership amount",
    "membership price",
    "membership fee",
    "plan amount",
    "plan price",
    "plan fee",
    "monthly amount",
    "monthly payment",
    "monthly fee",
    "scheduled payment amount",
  ],

  "Recurring Status": [
    "recurring status",
    "recurring payment status",
    "recurring billing status",
    "subscription status",
    "membership status",
    "plan status",
    "autopay status",
    "auto pay status",
    "automatic payment status",
  ],

  "Next Payment Date": [
    "next payment date",
    "next payment",
    "next charge date",
    "next charge",
    "next billing date",
    "next bill date",
    "next invoice date",
    "scheduled payment date",
    "recurring payment date",
    "autopay date",
    "auto pay date",
  ],

  "Renewal Amount": [
    "renewal amount",
    "renewal price",
    "renewal fee",
    "renewal value",
    "renewal total",
    "contract renewal amount",
    "contract renewal value",
    "membership renewal amount",
    "membership renewal price",
    "subscription renewal amount",
    "subscription renewal price",
    "plan renewal amount",
    "plan renewal price",
  ],

  "Renewal Date": [
    "renewal date",
    "renewal due date",
    "next renewal date",
    "contract renewal date",
    "membership renewal date",
    "subscription renewal date",
    "plan renewal date",
    "agreement renewal date",
    "service agreement renewal date",
    "maintenance agreement renewal date",
    "expiration renewal date",
  ],

  "Renewal Status": [
    "renewal status",
    "renewal state",
    "contract renewal status",
    "membership renewal status",
    "subscription renewal status",
    "plan renewal status",
    "agreement renewal status",
    "service agreement renewal status",
    "maintenance agreement renewal status",
  ],

  /* ================================== */
  /* FEE FIELDS */
  /* ================================== */

  "Fee Amount": [
    "fee amount",
    "fee total",
    "fee balance",
    "fee due",
    "fee owed",
    "outstanding fee",
    "outstanding fee amount",

    "cancellation fee",
    "cancellation fee amount",
    "cancel fee",
    "cancel fee amount",

    "late cancellation fee",
    "late cancellation fee amount",

    "no show fee",
    "no show fee amount",
    "no-show fee",
    "no-show fee amount",

    "late fee",
    "late fee amount",
    "late payment fee",
    "late payment fee amount",

    "service charge",
    "service charge amount",
    "penalty fee",
    "penalty amount",
  ],

  "Fee Type": [
    "fee type",
    "fee reason",
    "fee category",
    "fee name",
    "charge type",
    "charge reason",
    "charge category",
    "penalty type",
    "penalty reason",
  ],

  "Fee Status": [
    "fee status",
    "fee payment status",
    "fee collection status",
    "charge collection status",
    "penalty status",

    "cancellation fee status",
    "cancel fee status",
    "late cancellation fee status",

    "no show fee status",
    "no-show fee status",

    "late fee status",
    "late payment fee status",

    "service charge status",
  ],
};

/* ================================== */
/* HEADER NORMALIZATION */
/* ================================== */

function normalizeHeader(
  value: string
): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

/* ================================== */
/* ADAPT ONE ROW */
/* ================================== */

export function adaptBusinessRow(
  row: BusinessRow
): BusinessDataRow {
  const normalizedSource =
    new Map<string, string>();

  for (
    const [key, value] of
    Object.entries(row)
  ) {
    normalizedSource.set(
      normalizeHeader(key),
      value
    );
  }

  const adapted:
    BusinessDataRow = {};

  for (
    const canonicalField of
    CANONICAL_BUSINESS_FIELDS
  ) {
    const aliases =
      FIELD_ALIASES[
        canonicalField
      ];

    let matchedValue:
      string | undefined;

    for (
      const alias of aliases
    ) {
      const value =
        normalizedSource.get(
          normalizeHeader(alias)
        );

      if (
        value !== undefined &&
        value.trim() !== ""
      ) {
        matchedValue = value;
        break;
      }
    }

    adapted[canonicalField] =
      matchedValue ?? null;
  }

  /*
    Preserve original fields too.

    This lets future detectors access
    business-specific data that is not
    yet part of the canonical schema.
  */

  for (
    const [key, value] of
    Object.entries(row)
  ) {
    if (
      adapted[key] === undefined
    ) {
      adapted[key] = value;
    }
  }

  return adapted;
}

/* ================================== */
/* ADAPT MULTIPLE ROWS */
/* ================================== */

export function adaptBusinessRows(
  rows: BusinessRow[]
): BusinessDataRow[] {
  return rows.map(
    adaptBusinessRow
  );
}