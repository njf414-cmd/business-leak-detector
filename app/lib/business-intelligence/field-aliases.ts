export type FieldAliasDefinition = {
  canonical: string;
  aliases: string[];
};

export const FIELD_ALIASES: FieldAliasDefinition[] = [
  { canonical: "Customer Name", aliases: ["customer", "client", "client name", "account", "account name", "contact name"] },
  { canonical: "Status", aliases: ["pipeline stage"] },
  { canonical: "Contacted", aliases: ["reached"] },
  { canonical: "Date", aliases: ["created on", "created at", "created date"] },
  { canonical: "Last Contact Date", aliases: ["last called", "last contacted"] },
  { canonical: "Record Type", aliases: ["record type"] },
  { canonical: "Deal Value", aliases: ["deal value"] },
  { canonical: "Quote Amount", aliases: ["quote", "quoted amount", "lead value", "opportunity value"] },
  {
    canonical: "Revenue Impact",
    aliases: [
      "revenue impact",
      "amount",
      "amount due",
      "balance",
      "balance due",
      "invoice amount",
      "invoice total",
      "total",
      "total amount",
      "value",
      "lost revenue",
      "revenue loss",
      "potential revenue",
    ],
  },

  {
    canonical: "Record",
    aliases: [
      "record",
      "customer",
      "customer name",
      "client",
      "client name",
      "lead",
      "lead name",
      "account",
      "account name",
      "job",
      "job name",
      "project",
      "project name",
      "invoice",
      "invoice number",
      "order",
      "order number",
    ],
  },

  {
    canonical: "Invoice Amount",
    aliases: [
      "invoice amount",
      "invoice total",
      "total invoice",
      "total due",
      "amount invoiced",
      "gross invoice",
      "invoice",
    ],
  },

  {
    canonical: "Amount Paid",
    aliases: [
      "amount paid",
      "paid amount",
      "payment amount",
      "payments received",
      "cash received",
      "total paid",
      "paid",
    ],
  },

  {
    canonical: "Invoice Date",
    aliases: [
      "invoice date",
      "date invoiced",
      "invoice created",
      "invoice created date",
      "billing date",
    ],
  },

  {
    canonical: "Payment Due Date",
    aliases: [
      "payment due date",
      "due date",
      "invoice due date",
      "payment date due",
    ],
  },

  {
    canonical: "Invoice Sent Date",
    aliases: [
      "invoice sent date",
      "sent date",
      "invoice emailed date",
      "invoice delivered date",
    ],
  },

  {
    canonical: "Selling Price",
    aliases: [
      "selling price",
      "sale price",
      "charged price",
      "price charged",
      "final price",
      "customer price",
    ],
  },

  {
    canonical: "Required Price",
    aliases: [
      "required price",
      "target price",
      "minimum price",
      "recommended price",
      "expected price",
    ],
  },

  {
    canonical: "Gross Profit",
    aliases: [
      "gross profit",
      "profit",
      "gross margin dollars",
      "gross profit dollars",
    ],
  },

  {
    canonical: "Revenue",
    aliases: [
      "revenue",
      "sales",
      "total sales",
      "gross revenue",
      "net revenue",
    ],
  },

  {
    canonical: "Worked Hours",
    aliases: [
      "worked hours",
      "hours worked",
      "labor hours",
      "actual hours",
      "time worked",
    ],
  },

  {
    canonical: "Billed Hours",
    aliases: [
      "billed hours",
      "hours billed",
      "billable hours",
      "charged hours",
    ],
  },

  {
    canonical: "Actual Labor Hours",
    aliases: [
      "actual labor hours",
      "actual hours",
      "labor hours actual",
      "hours used",
    ],
  },

  {
    canonical: "Estimated Labor Hours",
    aliases: [
      "estimated labor hours",
      "estimated hours",
      "budgeted hours",
      "quoted hours",
    ],
  },

  {
    canonical: "Available Hours",
    aliases: [
      "available hours",
      "capacity hours",
      "total available hours",
      "scheduled capacity",
    ],
  },

  {
    canonical: "Billable Hours",
    aliases: [
      "billable hours",
      "billed hours",
      "productive hours",
      "revenue hours",
    ],
  },

  {
    canonical: "Paid Hours",
    aliases: [
      "paid hours",
      "payroll hours",
      "clocked hours",
      "employee hours",
    ],
  },

  {
    canonical: "Last Service Date",
    aliases: [
      "last service date",
      "last appointment",
      "last visit",
      "last job date",
      "last service",
    ],
  },

  {
    canonical: "Last Purchase Date",
    aliases: [
      "last purchase date",
      "last order date",
      "last transaction date",
      "last sale date",
      "last purchase",
    ],
  },

  {
    canonical: "Renewal Due Date",
    aliases: [
      "renewal due date",
      "renewal date",
      "subscription renewal",
      "membership renewal date",
    ],
  },

  {
    canonical: "Booked Slots",
    aliases: [
      "booked slots",
      "appointments booked",
      "booked appointments",
      "occupied slots",
    ],
  },

  {
    canonical: "Available Slots",
    aliases: [
      "available slots",
      "open slots",
      "appointment capacity",
      "total slots",
    ],
  },

  {
    canonical: "Booked Hours",
    aliases: [
      "booked hours",
      "scheduled hours",
      "appointment hours",
      "reserved hours",
    ],
  },

  {
    canonical: "Discount Amount",
    aliases: [
      "discount amount",
      "discount",
      "discount value",
      "discount dollars",
    ],
  },

  {
    canonical: "Pre-Discount Price",
    aliases: [
      "pre-discount price",
      "original price",
      "list price",
      "price before discount",
      "standard price",
    ],
  },

  {
    canonical: "Customer Revenue",
    aliases: [
      "customer revenue",
      "client revenue",
      "account revenue",
      "revenue by customer",
      "lifetime revenue",
    ],
  },

  {
    canonical: "Customer Cost",
    aliases: [
      "customer cost",
      "client cost",
      "account cost",
      "cost to serve",
      "service cost",
    ],
  },

  {
    canonical: "Quote Date",
    aliases: [
      "quote date",
      "estimate date",
      "proposal date",
      "quoted date",
    ],
  },

  {
    canonical: "Quoted Amount",
    aliases: [
      "quoted amount",
      "quote amount",
      "estimate amount",
      "proposal amount",
    ],
  },

  {
    canonical: "Accepted Quote Amount",
    aliases: [
      "accepted quote amount",
      "accepted amount",
      "approved amount",
      "won amount",
    ],
  },

  {
    canonical: "Required Deposit",
    aliases: [
      "required deposit",
      "deposit required",
      "deposit due",
      "deposit amount",
    ],
  },

  {
    canonical: "Deposit Paid",
    aliases: [
      "deposit paid",
      "paid deposit",
      "deposit received",
      "deposit payment",
    ],
  },

  {
    canonical: "Final Amount Due",
    aliases: [
      "final amount due",
      "final balance",
      "remaining balance",
      "balance remaining",
    ],
  },

  {
    canonical: "Final Amount Paid",
    aliases: [
      "final amount paid",
      "final payment",
      "balance paid",
      "remaining balance paid",
    ],
  },
];

export function normalizeFieldName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[_\-./]+/g, " ")
    .replace(/\s+/g, " ");
}

export function getAliasesForField(
  canonical: string
): string[] {
  const normalizedCanonical =
    normalizeFieldName(canonical);

  const match =
    FIELD_ALIASES.find(
      (item) =>
        normalizeFieldName(
          item.canonical
        ) === normalizedCanonical
    );

  return match
    ? [
        match.canonical,
        ...match.aliases,
      ]
    : [canonical];
}
