export type LeakType =
  | "Unfollowed Estimate"
  | "Stale Estimate"
  | "Unbooked Lead"
  | "Stale Lead"
  | "Unpaid Invoice"
  | "Overdue Invoice"
  | "Failed Payment"
  | "Abandoned Lead"
  | "Unsent Estimate"
  | "Expired Estimate"
  | "Partial Payment"
  | "No-Show"
  | "Cancelled Job"
  | "Lost Lead"
  | (string & {});

export type LeakSeverity =
  | "High"
  | "Medium"
  | "Low";

export type LeakCategory =
  | "Recoverable"
  | "Lost";

export type BusinessRow = {
  [key: string]: string;
};

export type Leak = {
  customer: string;
  type: LeakType;
  category: LeakCategory;
  amount: number;
  recovery: number;
  severity: LeakSeverity;
  reason: string;
  action: string;
  date?: string;
  daysOpen?: number;
};

type NormalizedRow = Record<
  string,
  string
>;

const CONTACTED_LEAD_THRESHOLD_DAYS = 7;
const STALE_LEAD_THRESHOLD_DAYS = 14;
const ABANDONED_LEAD_THRESHOLD_DAYS = 3;
const STALE_ESTIMATE_THRESHOLD_DAYS = 14;

/* ================================== */
/* BASIC HELPERS */
/* ================================== */

function cleanText(
  value: unknown
): string {
  return String(
    value ?? ""
  ).trim();
}

function normalizeText(
  value: unknown
): string {
  return cleanText(value)
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

function normalizeHeader(
  value: string
): string {
  return normalizeText(value);
}

function parseMoney(
  value: unknown
): number {
  const cleaned =
    cleanText(value)
      .replace(/[$,]/g, "")
      .replace(/[^\d.-]/g, "");

  const number =
    Number(cleaned);

  if (
    !Number.isFinite(number)
  ) {
    return 0;
  }

  return Math.max(
    0,
    number
  );
}

function normalizeRow(
  row: BusinessRow
): NormalizedRow {
  const normalized:
    NormalizedRow = {};

  Object.entries(row).forEach(
    ([key, value]) => {
      normalized[
        normalizeHeader(key)
      ] = cleanText(value);
    }
  );

  return normalized;
}

function getFirstValue(
  row: NormalizedRow,
  keys: string[]
): string {
  for (
    const key of keys
  ) {
    const value =
      row[
        normalizeHeader(key)
      ];

    if (
      value !== undefined &&
      cleanText(value) !== ""
    ) {
      return cleanText(value);
    }
  }

  return "";
}

function getMoneyValue(
  row: NormalizedRow,
  keys: string[]
): number {
  return parseMoney(
    getFirstValue(
      row,
      keys
    )
  );
}

/* ================================== */
/* FIELD ALIASES */
/* ================================== */

const CUSTOMER_KEYS = [
  "customer",
  "customer name",
  "client",
  "client name",
  "contact",
  "contact name",
  "lead",
  "lead name",
  "name",
];

const STATUS_KEYS = [
  "status",
  "lead status",
  "customer status",
  "estimate status",
  "quote status",
  "proposal status",
  "invoice status",
  "job status",
  "appointment status",
];

const PAYMENT_STATUS_KEYS = [
  "payment status",
  "payment",
  "transaction status",
  "charge status",
];

const QUOTE_KEYS = [
  "quote",
  "quote amount",
  "quoted amount",
  "estimate",
  "estimate amount",
  "estimated amount",
  "proposal amount",
  "potential value",
  "lead value",
  "opportunity value",
  "deal value",
];

const INVOICE_KEYS = [
  "invoice",
  "invoice amount",
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
];

const AMOUNT_PAID_KEYS = [
  "amount paid",
  "paid amount",
  "payment amount",
  "total paid",
  "collected amount",
  "amount collected",
];

const FOLLOW_UP_KEYS = [
  "follow up",
  "followup",
  "follow-up",
  "follow up status",
  "followup status",
  "follow-up status",
  "followed up",
  "followed-up",
];

const CONTACTED_KEYS = [
  "contacted",
  "was contacted",
  "lead contacted",
  "contact status",
];

const ESTIMATE_SENT_KEYS = [
  "estimate sent",
  "quote sent",
  "proposal sent",
  "sent",
];

const DATE_KEYS = [
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
];

const LAST_CONTACT_KEYS = [
  "last contacted",
  "last contact",
  "last contact date",
];

const DUE_DATE_KEYS = [
  "due date",
  "invoice due date",
  "payment due date",
];

const EXPIRATION_DATE_KEYS = [
  "expiration date",
  "expiry date",
  "expires",
  "expires on",
  "valid until",
  "estimate expiration",
  "estimate expiration date",
  "quote expiration",
  "quote expiration date",
];

const APPOINTMENT_STATUS_KEYS = [
  "appointment status",
  "booking status",
  "schedule status",
];

const JOB_STATUS_KEYS = [
  "job status",
  "work status",
  "service status",
];

const JOB_AMOUNT_KEYS = [
  "job amount",
  "job value",
  "job total",
  "service amount",
  "service total",
  "sale amount",
  "contract amount",
];

/* ================================== */
/* DATE HELPERS */
/* ================================== */

function parseDate(
  value: string
): Date | null {
  const cleaned =
    cleanText(value);

  if (!cleaned) {
    return null;
  }

  const isoDateOnly =
    cleaned.match(
      /^(\d{4})-(\d{1,2})-(\d{1,2})$/
    );

  if (isoDateOnly) {
    const year =
      Number(isoDateOnly[1]);

    const month =
      Number(isoDateOnly[2]);

    const day =
      Number(isoDateOnly[3]);

    const parsed =
      new Date(
        year,
        month - 1,
        day
      );

    if (
      parsed.getFullYear() === year &&
      parsed.getMonth() === month - 1 &&
      parsed.getDate() === day
    ) {
      return parsed;
    }

    return null;
  }

  const usDate =
    cleaned.match(
      /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/
    );

  if (usDate) {
    const month =
      Number(usDate[1]);

    const day =
      Number(usDate[2]);

    const year =
      Number(usDate[3]);

    const parsed =
      new Date(
        year,
        month - 1,
        day
      );

    if (
      parsed.getFullYear() === year &&
      parsed.getMonth() === month - 1 &&
      parsed.getDate() === day
    ) {
      return parsed;
    }

    return null;
  }

  const parsed =
    new Date(cleaned);

  if (
    Number.isNaN(
      parsed.getTime()
    )
  ) {
    return null;
  }

  return parsed;
}

function getDaysSince(
  value: string,
  now: Date
): number | undefined {
  const date =
    parseDate(value);

  if (!date) {
    return undefined;
  }

  const start =
    new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate()
    );

  const today =
    new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );

  const difference =
    today.getTime() -
    start.getTime();

  if (difference < 0) {
    return undefined;
  }

  return Math.floor(
    difference /
      (1000 * 60 * 60 * 24)
  );
}

function getBestAgeDate(
  row: NormalizedRow
): string {
  return (
    getFirstValue(
      row,
      LAST_CONTACT_KEYS
    ) ||
    getFirstValue(
      row,
      DATE_KEYS
    )
  );
}

function isPastDue(
  value: string,
  now: Date
): boolean {
  const parsed =
    parseDate(value);

  if (!parsed) {
    return false;
  }

  const today =
    new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );

  const target =
    new Date(
      parsed.getFullYear(),
      parsed.getMonth(),
      parsed.getDate()
    );

  return (
    target.getTime() <
    today.getTime()
  );
}

/* ================================== */
/* STATUS HELPERS */
/* ================================== */

function matchesStatus(
  status: string,
  statuses: string[]
): boolean {
  const normalized =
    normalizeText(status);

  return statuses.some(
    (candidate) =>
      normalized ===
      normalizeText(candidate)
  );
}

function isYes(
  value: string
): boolean {
  return matchesStatus(
    value,
    [
      "yes",
      "true",
      "y",
      "1",
      "sent",
      "contacted",
      "complete",
      "completed",
    ]
  );
}

function isNo(
  value: string
): boolean {
  return matchesStatus(
    value,
    [
      "no",
      "false",
      "n",
      "0",
      "not sent",
      "unsent",
      "not contacted",
      "never contacted",
    ]
  );
}

function isEstimateStatus(
  status: string
): boolean {
  return matchesStatus(
    status,
    [
      "quoted",
      "quote",
      "estimate",
      "estimated",
      "estimate sent",
      "quote sent",
      "proposal",
      "proposal sent",
      "waiting on customer",
      "waiting for customer",
      "pending quote",
      "pending estimate",
      "follow up needed",
      "follow-up needed",
      "followup needed",
    ]
  );
}

function isLeadStatus(
  status: string
): boolean {
  return matchesStatus(
    status,
    [
      "lead",
      "new lead",
      "new",
      "inquiry",
      "inquiry received",
      "new inquiry",
      "contacted",
      "unbooked",
      "not booked",
      "no booking",
      "missed",
      "missed lead",
    ]
  );
}

function isUnpaidStatus(
  status: string
): boolean {
  return matchesStatus(
    status,
    [
      "unpaid",
      "payment due",
      "payment pending",
      "awaiting payment",
      "balance due",
      "outstanding",
    ]
  );
}

function isOverdueStatus(
  status: string
): boolean {
  return matchesStatus(
    status,
    [
      "overdue",
      "past due",
      "past-due",
      "late",
      "delinquent",
    ]
  );
}

function isFailedPaymentStatus(
  status: string
): boolean {
  return matchesStatus(
    status,
    [
      "failed",
      "payment failed",
      "failed payment",
      "declined",
      "payment declined",
      "card declined",
      "charge failed",
      "transaction failed",
      "retry payment",
    ]
  );
}

function isPaidStatus(
  status: string
): boolean {
  return matchesStatus(
    status,
    [
      "paid",
      "paid in full",
      "payment received",
      "settled",
      "collected",
      "complete payment",
    ]
  );
}

function isWonStatus(
  status: string
): boolean {
  return matchesStatus(
    status,
    [
      "won",
      "closed won",
      "sold",
      "accepted",
      "approved",
      "booked",
      "scheduled",
      "converted",
      "customer",
    ]
  );
}

function isClosedStatus(
  status: string
): boolean {
  return matchesStatus(
    status,
    [
      "closed",
      "closed lost",
      "lost",
      "cancelled",
      "canceled",
      "completed",
      "complete",
      "finished",
      "done",
      "void",
      "voided",
      "refunded",
    ]
  );
}

function isResolvedStatus(
  status: string
): boolean {
  return (
    isPaidStatus(status) ||
    isWonStatus(status) ||
    isClosedStatus(status)
  );
}

function isCompletedOrFinalStatus(
  status: string
): boolean {
  return matchesStatus(
    status,
    [
      "completed",
      "complete",
      "finished",
      "done",
      "paid",
      "paid in full",
      "payment received",
      "settled",
      "collected",
      "closed won",
      "fulfilled",
      "service completed",
      "job completed",
    ]
  );
}

function isFollowUpMissing(
  value: string
): boolean {
  const normalized =
    normalizeText(value);

  return [
    "",
    "no",
    "none",
    "false",
    "missing",
    "not contacted",
    "not followed up",
    "follow up needed",
    "followup needed",
  ].includes(normalized);
}

function isLostLeadStatus(
  status: string
): boolean {
  return matchesStatus(
    status,
    [
      "lost",
      "lead lost",
      "lost lead",
      "closed lost",
      "dead lead",
      "not interested",
      "declined quote",
      "declined estimate",
    ]
  );
}

function isCancelledJobStatus(
  status: string
): boolean {
  return matchesStatus(
    status,
    [
      "cancelled",
      "canceled",
      "job cancelled",
      "job canceled",
      "service cancelled",
      "service canceled",
      "appointment cancelled",
      "appointment canceled",
    ]
  );
}

function isNoShowStatus(
  status: string
): boolean {
  return matchesStatus(
    status,
    [
      "no show",
      "no-show",
      "noshow",
      "missed appointment",
      "did not show",
      "customer no show",
      "customer no-show",
    ]
  );
}

function isUnsentEstimateStatus(
  status: string
): boolean {
  return matchesStatus(
    status,
    [
      "draft estimate",
      "estimate draft",
      "draft quote",
      "quote draft",
      "draft proposal",
      "proposal draft",
      "unsent estimate",
      "unsent quote",
      "unsent proposal",
      "estimate not sent",
      "quote not sent",
      "proposal not sent",
    ]
  );
}

function isExpiredEstimateStatus(
  status: string
): boolean {
  return matchesStatus(
    status,
    [
      "expired estimate",
      "estimate expired",
      "expired quote",
      "quote expired",
      "expired proposal",
      "proposal expired",
    ]
  );
}

function isPartialPaymentStatus(
  status: string
): boolean {
  return matchesStatus(
    status,
    [
      "partial",
      "partially paid",
      "partial payment",
      "part paid",
      "partially collected",
      "balance remaining",
      "remaining balance",
    ]
  );
}

/* ================================== */
/* CATEGORY / SEVERITY / RECOVERY */
/* ================================== */

function getLeakCategory(
  type: LeakType
): LeakCategory {
  switch (type) {
    case "No-Show":
    case "Cancelled Job":
    case "Lost Lead":
      return "Lost";

    default:
      return "Recoverable";
  }
}

function getSeverity(
  type: LeakType,
  amount: number
): LeakSeverity {
  const paymentType =
    type === "Overdue Invoice" ||
    type === "Unpaid Invoice" ||
    type === "Failed Payment" ||
    type === "Partial Payment";

  if (paymentType) {
    if (amount >= 1000) {
      return "High";
    }

    if (amount >= 500) {
      return "Medium";
    }

    return "Low";
  }

  if (amount >= 1500) {
    return "High";
  }

  if (amount >= 750) {
    return "Medium";
  }

  return "Low";
}

function getRecoveryEstimate(
  type: LeakType,
  amount: number
): number {
  switch (type) {
    case "Overdue Invoice":
    case "Unpaid Invoice":
    case "Partial Payment":
      return amount;

    case "Failed Payment":
      return amount * 0.9;

    case "Unfollowed Estimate":
      return amount * 0.35;

    case "Unsent Estimate":
      return amount * 0.3;

    case "Stale Estimate":
      return amount * 0.25;

    case "Expired Estimate":
      return amount * 0.15;

    case "Abandoned Lead":
      return amount * 0.35;

    case "Unbooked Lead":
      return amount * 0.3;

    case "Stale Lead":
      return amount * 0.2;

    default:
      return 0;
  }
}

/* ================================== */
/* REASONS / ACTIONS */
/* ================================== */

function getReason(
  type: LeakType,
  daysOpen?: number
): string {
  const ageText =
    daysOpen !== undefined
      ? ` This record is ${daysOpen} days old.`
      : "";

  const reasons:
    Partial<Record<LeakType, string>> = {
      "Unfollowed Estimate":
        "An estimate was sent but no follow-up was recorded.",

      "Stale Estimate":
        "An open estimate has been sitting without progressing for an extended period.",

      "Unsent Estimate":
        "An estimate or quote appears to have been created but was never sent to the customer.",

      "Expired Estimate":
        "An estimate has expired without being converted into a booked customer.",

      "Unbooked Lead":
        "A lead has potential value but no completed booking was found.",

      "Stale Lead":
        "An open lead has been sitting without progressing for an extended period.",

      "Abandoned Lead":
        "A new lead appears to have gone several days without being contacted.",

      "Lost Lead":
        "A revenue opportunity was marked as lost before converting into a customer.",

      "Unpaid Invoice":
        "An invoice appears to have money still outstanding.",

      "Overdue Invoice":
        "An invoice appears to be past its payment deadline with money still outstanding.",

      "Failed Payment":
        "A payment attempt appears to have failed or been declined, leaving revenue uncollected.",

      "Partial Payment":
        "The customer appears to have paid only part of the invoice, leaving a remaining balance.",

      "No-Show":
        "A scheduled customer did not show for the appointment, resulting in lost booked revenue.",

      "Cancelled Job":
        "A booked job or service was cancelled before completion, resulting in lost booked revenue.",
    };

  const reason =
    reasons[type];

  if (!reason) {
    return "A potential revenue leak was detected.";
  }

  return `${reason}${ageText}`;
}

function getAction(
  type: LeakType,
  daysOpen?: number
): string {
  const urgent =
    daysOpen !== undefined &&
    daysOpen >= 7
      ? " This should be addressed as soon as possible."
      : "";

  switch (type) {
    case "Unfollowed Estimate":
      return `Follow up with the customer about the estimate.${urgent}`;

    case "Stale Estimate":
      return `Re-engage the customer and determine whether the estimate can be closed or converted.${urgent}`;

    case "Unsent Estimate":
      return `Review the estimate and send it to the customer immediately if it is still valid.${urgent}`;

    case "Expired Estimate":
      return `Contact the customer and offer to refresh or reissue the estimate.${urgent}`;

    case "Unbooked Lead":
      return `Contact the lead and attempt to book the job.${urgent}`;

    case "Stale Lead":
      return `Re-contact the lead and determine whether the opportunity is still active.${urgent}`;

    case "Abandoned Lead":
      return `Contact the lead immediately before the opportunity goes cold.${urgent}`;

    case "Lost Lead":
      return "Review why the lead was lost and use the reason to improve future lead conversion.";

    case "Unpaid Invoice":
      return `Contact the customer and collect the outstanding payment.${urgent}`;

    case "Overdue Invoice":
      return `Contact the customer about the overdue balance and request payment.${urgent}`;

    case "Failed Payment":
      return `Contact the customer, update the payment method, and retry collection.${urgent}`;

    case "Partial Payment":
      return `Contact the customer and collect the remaining balance.${urgent}`;

    case "No-Show":
      return "Attempt to rebook the customer and review whether reminders or deposits could reduce future no-shows.";

    case "Cancelled Job":
      return "Review the cancellation reason, attempt to rebook when appropriate, and identify preventable cancellation patterns.";

    default:
      return "Review this opportunity and take action.";
  }
}

/* ================================== */
/* CREATE LEAK */
/* ================================== */

function createLeak(
  type: LeakType,
  customer: string,
  amount: number,
  date?: string,
  daysOpen?: number
): Leak {
  return {
    customer:
      customer ||
      "Unknown Customer",

    type,

    category:
      getLeakCategory(type),

    amount,

    recovery:
      getRecoveryEstimate(
        type,
        amount
      ),

    severity:
      getSeverity(
        type,
        amount
      ),

    reason:
      getReason(
        type,
        daysOpen
      ),

    action:
      getAction(
        type,
        daysOpen
      ),

    date,

    daysOpen,
  };
}

/* ================================== */
/* RECORD DATA */
/* ================================== */

function getRecordData(
  row: NormalizedRow,
  now: Date
) {
  const customer =
    getFirstValue(
      row,
      CUSTOMER_KEYS
    ) ||
    "Unknown Customer";

  const status =
    getFirstValue(
      row,
      STATUS_KEYS
    );

  const paymentStatus =
    getFirstValue(
      row,
      PAYMENT_STATUS_KEYS
    );

  const appointmentStatus =
    getFirstValue(
      row,
      APPOINTMENT_STATUS_KEYS
    );

  const jobStatus =
    getFirstValue(
      row,
      JOB_STATUS_KEYS
    );

  const quote =
    getMoneyValue(
      row,
      QUOTE_KEYS
    );

  const invoice =
    getMoneyValue(
      row,
      INVOICE_KEYS
    );

  const amountPaid =
    getMoneyValue(
      row,
      AMOUNT_PAID_KEYS
    );

  const jobAmount =
    getMoneyValue(
      row,
      JOB_AMOUNT_KEYS
    );

  const followUp =
    getFirstValue(
      row,
      FOLLOW_UP_KEYS
    );

  const contacted =
    getFirstValue(
      row,
      CONTACTED_KEYS
    );

  const estimateSent =
    getFirstValue(
      row,
      ESTIMATE_SENT_KEYS
    );

  const date =
    getBestAgeDate(row);

  const recordDate =
    getFirstValue(
      row,
      DATE_KEYS
    );

  const daysOpen =
    getDaysSince(
      date,
      now
    );

  const recordDaysOld =
    getDaysSince(
      recordDate,
      now
    );

  const dueDate =
    getFirstValue(
      row,
      DUE_DATE_KEYS
    );

  const expirationDate =
    getFirstValue(
      row,
      EXPIRATION_DATE_KEYS
    );

  return {
    customer,
    status,
    paymentStatus,
    appointmentStatus,
    jobStatus,
    quote,
    invoice,
    amountPaid,
    jobAmount,
    followUp,
    contacted,
    estimateSent,
    date,
    recordDate,
    daysOpen,
    recordDaysOld,
    dueDate,
    expirationDate,
  };
}

/* ================================== */
/* LOST LEAD */
/* ================================== */

function detectLostLead(
  row: NormalizedRow,
  now: Date
): Leak | null {
  const data =
    getRecordData(
      row,
      now
    );

  if (
    !isLostLeadStatus(
      data.status
    ) ||
    data.quote <= 0
  ) {
    return null;
  }

  return createLeak(
    "Lost Lead",
    data.customer,
    data.quote,
    data.date || undefined,
    data.daysOpen
  );
}

/* ================================== */
/* ABANDONED LEAD */
/* ================================== */

function detectAbandonedLead(
  row: NormalizedRow,
  now: Date
): Leak | null {
  const data =
    getRecordData(
      row,
      now
    );

  if (
    !isLeadStatus(
      data.status
    ) ||
    data.quote <= 0
  ) {
    return null;
  }

  if (
    isYes(
      data.contacted
    )
  ) {
    return null;
  }

  if (
    matchesStatus(
      data.status,
      ["contacted"]
    )
  ) {
    return null;
  }

  const explicitlyNotContacted =
    isNo(
      data.contacted
    );

  const oldEnough =
    data.recordDaysOld !==
      undefined &&
    data.recordDaysOld >=
      ABANDONED_LEAD_THRESHOLD_DAYS;

  if (
    !explicitlyNotContacted &&
    !oldEnough
  ) {
    return null;
  }

  return createLeak(
    "Abandoned Lead",
    data.customer,
    data.quote,
    data.recordDate ||
      data.date ||
      undefined,
    data.recordDaysOld ??
      data.daysOpen
  );
}

/* ================================== */
/* LEAD */
/* ================================== */

function detectLeadLeak(
  row: NormalizedRow,
  now: Date
): Leak | null {
  const data =
    getRecordData(
      row,
      now
    );

  if (
    isResolvedStatus(
      data.status
    )
  ) {
    return null;
  }

  if (
    !isLeadStatus(
      data.status
    ) ||
    data.quote <= 0
  ) {
    return null;
  }

  if (
    detectAbandonedLead(
      row,
      now
    )
  ) {
    return null;
  }

  const normalizedStatus =
    normalizeText(
      data.status
    );

  if (
    normalizedStatus ===
      "contacted" &&
    data.daysOpen !==
      undefined &&
    data.daysOpen <
      CONTACTED_LEAD_THRESHOLD_DAYS
  ) {
    return null;
  }

  if (
    data.daysOpen !==
      undefined &&
    data.daysOpen >=
      STALE_LEAD_THRESHOLD_DAYS
  ) {
    return createLeak(
      "Stale Lead",
      data.customer,
      data.quote,
      data.date || undefined,
      data.daysOpen
    );
  }

  return createLeak(
    "Unbooked Lead",
    data.customer,
    data.quote,
    data.date || undefined,
    data.daysOpen
  );
}

/* ================================== */
/* UNSENT ESTIMATE */
/* ================================== */

function detectUnsentEstimate(
  row: NormalizedRow,
  now: Date
): Leak | null {
  const data =
    getRecordData(
      row,
      now
    );

  if (
    data.quote <= 0 ||
    isResolvedStatus(
      data.status
    )
  ) {
    return null;
  }

  const explicitUnsent =
    isNo(
      data.estimateSent
    );

  const statusUnsent =
    isUnsentEstimateStatus(
      data.status
    );

  if (
    !explicitUnsent &&
    !statusUnsent
  ) {
    return null;
  }

  return createLeak(
    "Unsent Estimate",
    data.customer,
    data.quote,
    data.recordDate ||
      data.date ||
      undefined,
    data.recordDaysOld ??
      data.daysOpen
  );
}

/* ================================== */
/* EXPIRED ESTIMATE */
/* ================================== */

function detectExpiredEstimate(
  row: NormalizedRow,
  now: Date
): Leak | null {
  const data =
    getRecordData(
      row,
      now
    );

  if (
    data.quote <= 0
  ) {
    return null;
  }

  if (
    isWonStatus(
      data.status
    ) ||
    isPaidStatus(
      data.status
    )
  ) {
    return null;
  }

  const explicitExpired =
    isExpiredEstimateStatus(
      data.status
    );

  const dateExpired =
    Boolean(
      data.expirationDate &&
      isPastDue(
        data.expirationDate,
        now
      )
    );

  if (
    !explicitExpired &&
    !dateExpired
  ) {
    return null;
  }

  return createLeak(
    "Expired Estimate",
    data.customer,
    data.quote,
    data.expirationDate ||
      data.date ||
      undefined,
    data.expirationDate
      ? getDaysSince(
          data.expirationDate,
          now
        )
      : data.daysOpen
  );
}

/* ================================== */
/* ESTIMATE */
/* ================================== */

function detectEstimateLeak(
  row: NormalizedRow,
  now: Date
): Leak | null {
  const data =
    getRecordData(
      row,
      now
    );

  if (
    isResolvedStatus(
      data.status
    )
  ) {
    return null;
  }

  if (
    !isEstimateStatus(
      data.status
    ) ||
    data.quote <= 0
  ) {
    return null;
  }

  if (
    detectUnsentEstimate(
      row,
      now
    ) ||
    detectExpiredEstimate(
      row,
      now
    )
  ) {
    return null;
  }

  if (
    isFollowUpMissing(
      data.followUp
    )
  ) {
    return createLeak(
      "Unfollowed Estimate",
      data.customer,
      data.quote,
      data.date || undefined,
      data.daysOpen
    );
  }

  if (
    data.daysOpen !==
      undefined &&
    data.daysOpen >=
      STALE_ESTIMATE_THRESHOLD_DAYS
  ) {
    return createLeak(
      "Stale Estimate",
      data.customer,
      data.quote,
      data.date || undefined,
      data.daysOpen
    );
  }

  return null;
}

/* ================================== */
/* PARTIAL PAYMENT */
/* ================================== */

function detectPartialPayment(
  row: NormalizedRow,
  now: Date
): Leak | null {
  const data =
    getRecordData(
      row,
      now
    );

  if (
    isPaidStatus(
      data.paymentStatus
    ) ||
    isPaidStatus(
      data.status
    )
  ) {
    return null;
  }

  if (
    data.invoice <= 0
  ) {
    return null;
  }

  const partialStatus =
    isPartialPaymentStatus(
      data.paymentStatus
    ) ||
    isPartialPaymentStatus(
      data.status
    );

  const partialByAmounts =
    data.amountPaid > 0 &&
    data.amountPaid <
      data.invoice;

  if (
    !partialStatus &&
    !partialByAmounts
  ) {
    return null;
  }

  const remaining =
    partialByAmounts
      ? Math.max(
          0,
          data.invoice -
            data.amountPaid
        )
      : data.invoice;

  if (
    remaining <= 0
  ) {
    return null;
  }

  return createLeak(
    "Partial Payment",
    data.customer,
    remaining,
    data.dueDate ||
      data.date ||
      undefined,
    data.dueDate
      ? getDaysSince(
          data.dueDate,
          now
        )
      : data.daysOpen
  );
}

/* ================================== */
/* PAYMENT */
/* ================================== */

function detectPaymentLeak(
  row: NormalizedRow,
  now: Date
): Leak | null {
  const data =
    getRecordData(
      row,
      now
    );

  if (
    isPaidStatus(
      data.status
    ) ||
    isPaidStatus(
      data.paymentStatus
    )
  ) {
    return null;
  }

  if (
    isClosedStatus(
      data.status
    )
  ) {
    return null;
  }

  if (
    data.invoice <= 0
  ) {
    return null;
  }

  if (
    detectPartialPayment(
      row,
      now
    )
  ) {
    return null;
  }

  if (
    isFailedPaymentStatus(
      data.paymentStatus
    ) ||
    isFailedPaymentStatus(
      data.status
    )
  ) {
    return createLeak(
      "Failed Payment",
      data.customer,
      data.invoice,
      data.date || undefined,
      data.daysOpen
    );
  }

  if (
    isOverdueStatus(
      data.status
    ) ||
    isOverdueStatus(
      data.paymentStatus
    ) ||
    (
      data.dueDate &&
      isPastDue(
        data.dueDate,
        now
      )
    )
  ) {
    const overdueDate =
      data.dueDate ||
      data.date;

    return createLeak(
      "Overdue Invoice",
      data.customer,
      data.invoice,
      overdueDate || undefined,
      getDaysSince(
        overdueDate,
        now
      )
    );
  }

  if (
    isUnpaidStatus(
      data.status
    ) ||
    isUnpaidStatus(
      data.paymentStatus
    )
  ) {
    return createLeak(
      "Unpaid Invoice",
      data.customer,
      data.invoice,
      data.date || undefined,
      data.daysOpen
    );
  }

  return null;
}

/* ================================== */
/* NO-SHOW */
/* ================================== */

function detectNoShow(
  row: NormalizedRow,
  now: Date
): Leak | null {
  const data =
    getRecordData(
      row,
      now
    );

  if (
    isCompletedOrFinalStatus(
      data.status
    ) ||
    isCompletedOrFinalStatus(
      data.jobStatus
    )
  ) {
    return null;
  }

  const noShow =
    isNoShowStatus(
      data.appointmentStatus
    ) ||
    isNoShowStatus(
      data.status
    );

  if (!noShow) {
    return null;
  }

  const amount =
    data.jobAmount > 0
      ? data.jobAmount
      : data.quote;

  if (
    amount <= 0
  ) {
    return null;
  }

  return createLeak(
    "No-Show",
    data.customer,
    amount,
    data.recordDate ||
      data.date ||
      undefined,
    data.recordDaysOld ??
      data.daysOpen
  );
}

/* ================================== */
/* CANCELLED JOB */
/* ================================== */

function detectCancelledJob(
  row: NormalizedRow,
  now: Date
): Leak | null {
  const data =
    getRecordData(
      row,
      now
    );

  if (
    isCompletedOrFinalStatus(
      data.status
    )
  ) {
    return null;
  }

  const cancelled =
    isCancelledJobStatus(
      data.jobStatus
    ) ||
    isCancelledJobStatus(
      data.appointmentStatus
    ) ||
    isCancelledJobStatus(
      data.status
    );

  if (!cancelled) {
    return null;
  }

  const amount =
    data.jobAmount > 0
      ? data.jobAmount
      : data.quote;

  if (
    amount <= 0
  ) {
    return null;
  }

  return createLeak(
    "Cancelled Job",
    data.customer,
    amount,
    data.recordDate ||
      data.date ||
      undefined,
    data.recordDaysOld ??
      data.daysOpen
  );
}

/* ================================== */
/* DUPLICATE PROTECTION */
/* ================================== */

function getLeakKey(
  leak: Leak
): string {
  return [
    normalizeText(
      leak.customer
    ),
    leak.type,
    leak.amount.toFixed(2),
    normalizeText(
      leak.date || ""
    ),
  ].join("|");
}

function removeDuplicateLeaks(
  leaks: Leak[]
): Leak[] {
  const seen =
    new Set<string>();

  const unique:
    Leak[] = [];

  for (
    const leak of leaks
  ) {
    const key =
      getLeakKey(leak);

    if (
      seen.has(key)
    ) {
      continue;
    }

    seen.add(key);

    unique.push(leak);
  }

  return unique;
}

/* ================================== */
/* ANALYZE ONE ROW */
/* ================================== */

function analyzeNormalizedRow(
  row: NormalizedRow,
  now: Date
): Leak[] {
  const leaks:
    Leak[] = [];

  const noShow =
    detectNoShow(
      row,
      now
    );

  if (noShow) {
    return [noShow];
  }

  const cancelledJob =
    detectCancelledJob(
      row,
      now
    );

  if (cancelledJob) {
    return [
      cancelledJob,
    ];
  }

  const lostLead =
    detectLostLead(
      row,
      now
    );

  if (lostLead) {
    return [
      lostLead,
    ];
  }

  const abandonedLead =
    detectAbandonedLead(
      row,
      now
    );

  if (abandonedLead) {
    leaks.push(
      abandonedLead
    );
  } else {
    const leadLeak =
      detectLeadLeak(
        row,
        now
      );

    if (leadLeak) {
      leaks.push(
        leadLeak
      );
    }
  }

  const unsentEstimate =
    detectUnsentEstimate(
      row,
      now
    );

  if (unsentEstimate) {
    leaks.push(
      unsentEstimate
    );
  } else {
    const expiredEstimate =
      detectExpiredEstimate(
        row,
        now
      );

    if (expiredEstimate) {
      leaks.push(
        expiredEstimate
      );
    } else {
      const estimateLeak =
        detectEstimateLeak(
          row,
          now
        );

      if (estimateLeak) {
        leaks.push(
          estimateLeak
        );
      }
    }
  }

  const partialPayment =
    detectPartialPayment(
      row,
      now
    );

  if (partialPayment) {
    leaks.push(
      partialPayment
    );
  } else {
    const paymentLeak =
      detectPaymentLeak(
        row,
        now
      );

    if (paymentLeak) {
      leaks.push(
        paymentLeak
      );
    }
  }

  return leaks;
}

/* ================================== */
/* ANALYZE BUSINESS ROWS */
/* ================================== */

export function analyzeBusinessRows(
  rows: BusinessRow[],
  now: Date = new Date()
): Leak[] {
  const leaks:
    Leak[] = [];

  for (
    const row of rows
  ) {
    const normalizedRow =
      normalizeRow(row);

    leaks.push(
      ...analyzeNormalizedRow(
        normalizedRow,
        now
      )
    );
  }

  return removeDuplicateLeaks(
    leaks
  );
}

/* ================================== */
/* ROBUST CSV PARSER */
/* ================================== */

export function parseCSV(
  text: string
): BusinessRow[] {
  const rows:
    string[][] = [];

  let currentRow:
    string[] = [];

  let currentValue = "";

  let insideQuotes =
    false;

  for (
    let i = 0;
    i < text.length;
    i++
  ) {
    const char =
      text[i];

    const nextChar =
      text[i + 1];

    if (
      char === '"'
    ) {
      if (
        insideQuotes &&
        nextChar === '"'
      ) {
        currentValue += '"';
        i++;
      } else {
        insideQuotes =
          !insideQuotes;
      }

      continue;
    }

    if (
      char === "," &&
      !insideQuotes
    ) {
      currentRow.push(
        currentValue
      );

      currentValue = "";

      continue;
    }

    if (
      (
        char === "\n" ||
        char === "\r"
      ) &&
      !insideQuotes
    ) {
      if (
        char === "\r" &&
        nextChar === "\n"
      ) {
        i++;
      }

      currentRow.push(
        currentValue
      );

      currentValue = "";

      if (
        currentRow.some(
          (value) =>
            value.trim() !==
            ""
        )
      ) {
        rows.push(
          currentRow
        );
      }

      currentRow = [];

      continue;
    }

    currentValue += char;
  }

  currentRow.push(
    currentValue
  );

  if (
    currentRow.some(
      (value) =>
        value.trim() !==
        ""
    )
  ) {
    rows.push(
      currentRow
    );
  }

  if (
    rows.length < 2
  ) {
    return [];
  }

  const headers =
    rows[0].map(
      (header) =>
        header
          .replace(
            /^\uFEFF/,
            ""
          )
          .trim()
    );

  return rows
    .slice(1)
    .map(
      (values) => {
        const row:
          BusinessRow = {};

        headers.forEach(
          (
            header,
            index
          ) => {
            row[header] =
              (
                values[
                  index
                ] ?? ""
              ).trim();
          }
        );

        return row;
      }
    )
    .filter(
      (row) =>
        Object.values(
          row
        ).some(
          (value) =>
            value.trim() !==
            ""
        )
    );
}

/* ================================== */
/* ANALYZE CSV */
/* ================================== */

export function analyzeCSV(
  text: string,
  now: Date = new Date()
): Leak[] {
  return analyzeBusinessRows(
    parseCSV(text),
    now
  );
}