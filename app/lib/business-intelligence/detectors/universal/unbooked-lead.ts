import type {
  BusinessLeakDetector,
  DetectedBusinessLeak,
  DetectorContext,
} from "../../detector-types";

/* ================================== */
/* SETTINGS */
/* ================================== */

const CONTACTED_LEAD_THRESHOLD_DAYS = 7;
const STALE_LEAD_THRESHOLD_DAYS = 14;
const ABANDONED_LEAD_THRESHOLD_DAYS = 3;

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

function parseMoney(
  value: unknown
): number {
  const cleaned =
    cleanText(value)
      .replace(/[$,]/g, "")
      .replace(
        /[^\d.-]/g,
        ""
      );

  const parsed =
    Number(cleaned);

  if (
    !Number.isFinite(parsed)
  ) {
    return 0;
  }

  return Math.max(
    0,
    parsed
  );
}

/* ================================== */
/* DATE HELPERS */
/* ================================== */

function parseDate(
  value: unknown
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
      Number(
        isoDateOnly[1]
      );

    const month =
      Number(
        isoDateOnly[2]
      );

    const day =
      Number(
        isoDateOnly[3]
      );

    const parsed =
      new Date(
        year,
        month - 1,
        day
      );

    if (
      parsed.getFullYear() ===
        year &&
      parsed.getMonth() ===
        month - 1 &&
      parsed.getDate() ===
        day
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
      Number(
        usDate[1]
      );

    const day =
      Number(
        usDate[2]
      );

    const year =
      Number(
        usDate[3]
      );

    const parsed =
      new Date(
        year,
        month - 1,
        day
      );

    if (
      parsed.getFullYear() ===
        year &&
      parsed.getMonth() ===
        month - 1 &&
      parsed.getDate() ===
        day
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

function startOfDay(
  date: Date
): Date {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  );
}

function isFutureDate(
  value: unknown,
  now: Date
): boolean {
  const parsed =
    parseDate(value);

  if (!parsed) {
    return false;
  }

  return (
    startOfDay(parsed).getTime() >
    startOfDay(now).getTime()
  );
}

function getDaysSince(
  value: unknown,
  now: Date
): number | null {
  const date =
    parseDate(value);

  if (!date) {
    return null;
  }

  const start =
    startOfDay(date);

  const today =
    startOfDay(now);

  const difference =
    today.getTime() -
    start.getTime();

  if (difference < 0) {
    return null;
  }

  return Math.floor(
    difference /
      (
        1000 *
        60 *
        60 *
        24
      )
  );
}

/* ================================== */
/* STATUS HELPERS */
/* ================================== */

function matchesStatus(
  value: unknown,
  statuses: string[]
): boolean {
  const normalized =
    normalizeText(value);

  return statuses.some(
    (status) =>
      normalized ===
      normalizeText(status)
  );
}

function isYes(
  value: unknown
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
  value: unknown
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

function isLeadStatus(
  value: unknown
): boolean {
  return matchesStatus(
    value,
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

function isResolvedStatus(
  value: unknown
): boolean {
  return matchesStatus(
    value,
    [
      "paid",
      "paid in full",
      "payment received",
      "settled",
      "collected",
      "complete payment",
      "won",
      "closed won",
      "sold",
      "accepted",
      "approved",
      "booked",
      "scheduled",
      "converted",
      "customer",
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

/* ================================== */
/* ABANDONED CHECK */
/* ================================== */

function isAbandonedLead(
  status: unknown,
  contacted: unknown,
  recordDaysOld: number | null
): boolean {
  if (
    !isLeadStatus(status)
  ) {
    return false;
  }

  if (
    isYes(contacted)
  ) {
    return false;
  }

  if (
    matchesStatus(
      status,
      ["contacted"]
    )
  ) {
    return false;
  }

  const explicitlyNotContacted =
    isNo(contacted);

  const oldEnough =
    recordDaysOld !== null &&
    recordDaysOld >=
      ABANDONED_LEAD_THRESHOLD_DAYS;

  return (
    explicitlyNotContacted ||
    oldEnough
  );
}

/* ================================== */
/* DETECTOR */
/* ================================== */

export const unbookedLeadDetector:
  BusinessLeakDetector = {
    id:
      "universal.unbooked-lead",

    name:
      "Unbooked Lead",

    description:
      "Detects active leads with potential revenue that have not yet converted into a booking.",

    scope:
      "universal",

    industries: [],

    requirements: {
      requiredFields: [
        "Status",
        "Quote Amount",
      ],

      optionalFields: [
        "Customer Name",
        "Contacted",
        "Date",
        "Last Contact Date",
      ],
    },

    supports() {
      return true;
    },

    detect(
      context: DetectorContext
    ) {
      const leaks:
        DetectedBusinessLeak[] = [];

      const warnings:
        string[] = [];

      const errors:
        string[] = [];

      context.rows.forEach(
        (row, rowIndex) => {
          const status =
            cleanText(
              row["Status"]
            );

          if (
            isResolvedStatus(
              status
            )
          ) {
            return;
          }

          if (
            !isLeadStatus(
              status
            )
          ) {
            return;
          }

          const amount =
            parseMoney(
              row[
                "Quote Amount"
              ]
            );

          if (amount <= 0) {
            return;
          }

          const contacted =
            row["Contacted"];

          const recordDate =
            row["Date"];

          const lastContactDate =
            row[
              "Last Contact Date"
            ];

          /*
            IMPORTANT:

            Missing dates are allowed because
            the legacy engine can still classify
            an active lead as Unbooked.

            But an explicitly supplied FUTURE
            date is different. It means the
            temporal data is inconsistent.

            We do not make a confirmed leak
            claim from that record.
          */

          if (
            isFutureDate(
              recordDate,
              context.now
            ) ||
            isFutureDate(
              lastContactDate,
              context.now
            )
          ) {
            return;
          }

          /*
            Original record age.
          */

          const recordDaysOld =
            getDaysSince(
              recordDate,
              context.now
            );

          /*
            Lead age prefers Last Contact Date,
            then falls back to creation Date.
          */

          const daysOpen =
            getDaysSince(
              lastContactDate,
              context.now
            ) ??
            recordDaysOld;

          /*
            Abandoned Lead owns this row if
            its rules apply.
          */

          if (
            isAbandonedLead(
              status,
              contacted,
              recordDaysOld
            )
          ) {
            return;
          }

          /*
            Recently contacted leads have not
            crossed the Unbooked threshold.
          */

          if (
            normalizeText(
              status
            ) ===
              "contacted" &&
            daysOpen !== null &&
            daysOpen <
              CONTACTED_LEAD_THRESHOLD_DAYS
          ) {
            return;
          }

          /*
            14+ day leads belong to Stale Lead.
          */

          if (
            daysOpen !== null &&
            daysOpen >=
              STALE_LEAD_THRESHOLD_DAYS
          ) {
            return;
          }

          const customerName =
            cleanText(
              row[
                "Customer Name"
              ]
            ) ||
            "Unknown Customer";

          const estimatedRecovery =
            amount * 0.3;

          const urgent =
            daysOpen !== null &&
            daysOpen >= 7;

          leaks.push({
            detectorId:
              "universal.unbooked-lead",

            leakType:
              "Unbooked Lead",

            title:
              "Unbooked lead revenue",

            description:
              daysOpen !== null
                ? `${customerName} has a lead worth $${amount.toFixed(
                    2
                  )} that has not converted into a booking after ${daysOpen} days.`
                : `${customerName} has a lead worth $${amount.toFixed(
                    2
                  )} with no completed booking found.`,

            category:
              "Sales",

            severity:
              amount >= 1500
                ? "high"
                : amount >= 750
                  ? "medium"
                  : "low",

            confidence:
              "high",

            estimatedLoss:
              amount,

            estimatedRecovery,

            customerName,

            sourceRowIndex:
              rowIndex,

            evidence: {
              status,

              contacted:
                cleanText(
                  contacted
                ),

              recordDate:
                cleanText(
                  recordDate
                ),

              lastContactDate:
                cleanText(
                  lastContactDate
                ),

              daysOpen,

              leadValue:
                amount,
            },

            recommendedAction:
              urgent
                ? "Contact the lead and attempt to book the job. This should be addressed as soon as possible."
                : "Contact the lead and attempt to book the job.",

            metadata: {},
          });
        }
      );

      return {
        detectorId:
          "universal.unbooked-lead",

        ran: true,

        leaks,

        warnings,

        errors,
      };
    },
  };