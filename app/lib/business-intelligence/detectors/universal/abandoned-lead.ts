import type {
  BusinessLeakDetector,
  DetectedBusinessLeak,
  DetectorContext,
} from "../../detector-types";

/* ================================== */
/* SETTINGS */
/* ================================== */

const ABANDONED_LEAD_THRESHOLD_DAYS = 3;

/* ================================== */
/* HELPERS */
/* ================================== */

function cleanText(
  value: unknown
): string {
  return String(value ?? "").trim();
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
  const cleaned = cleanText(value)
    .replace(/[$,]/g, "")
    .replace(/[^\d.-]/g, "");

  const parsed = Number(cleaned);

  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.max(0, parsed);
}

function parseDate(
  value: unknown
): Date | null {
  const cleaned = cleanText(value);

  if (!cleaned) {
    return null;
  }

  const parsed = new Date(cleaned);

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
  value: unknown,
  now: Date
): number | null {
  const parsed =
    parseDate(value);

  if (!parsed) {
    return null;
  }

  const start =
    new Date(
      parsed.getFullYear(),
      parsed.getMonth(),
      parsed.getDate()
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
    return null;
  }

  return Math.floor(
    difference /
      (1000 * 60 * 60 * 24)
  );
}

function isYes(
  value: unknown
): boolean {
  const normalized =
    normalizeText(value);

  return [
    "yes",
    "true",
    "y",
    "1",
    "sent",
    "contacted",
    "complete",
    "completed",
  ].includes(normalized);
}

function isNo(
  value: unknown
): boolean {
  const normalized =
    normalizeText(value);

  return [
    "no",
    "false",
    "n",
    "0",
    "not sent",
    "unsent",
    "not contacted",
    "never contacted",
  ].includes(normalized);
}

function isLeadStatus(
  value: unknown
): boolean {
  const normalized =
    normalizeText(value);

  return [
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
  ].includes(normalized);
}

/* ================================== */
/* DETECTOR */
/* ================================== */

export const abandonedLeadDetector:
  BusinessLeakDetector = {
    id:
      "universal.abandoned-lead",

    name:
      "Abandoned Lead",

    description:
      "Detects valuable leads that appear to have gone without initial contact.",

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

          /*
            Legacy behavior:
            this detector only considers
            recognized lead statuses.
          */

          if (
            !isLeadStatus(status)
          ) {
            return;
          }

          const amount =
            parseMoney(
              row["Quote Amount"]
            );

          if (amount <= 0) {
            return;
          }

          const contacted =
            row["Contacted"];

          /*
            Legacy behavior:
            an explicitly contacted lead
            cannot be abandoned.
          */

          if (isYes(contacted)) {
            return;
          }

          /*
            Legacy behavior:
            Status = Contacted also prevents
            Abandoned Lead even if the
            Contacted field itself is blank.
          */

          if (
            normalizeText(status) ===
            "contacted"
          ) {
            return;
          }

          const recordDate =
            row["Date"];

          /*
            IMPORTANT:

            Legacy abandoned-lead logic uses
            the record creation date.

            It does NOT use Last Contact Date
            to determine the initial
            abandonment threshold.
          */

          const recordDaysOld =
            getDaysSince(
              recordDate,
              context.now
            );

          const explicitlyNotContacted =
            isNo(contacted);

          const oldEnough =
            recordDaysOld !== null &&
            recordDaysOld >=
              ABANDONED_LEAD_THRESHOLD_DAYS;

          /*
            Exact legacy rule:

            Abandoned if EITHER:

            1. Contacted explicitly says No

            OR

            2. The lead is at least 3 days old

            Therefore a lead explicitly marked
            Contacted = No does NOT need to be
            three days old.
          */

          if (
            !explicitlyNotContacted &&
            !oldEnough
          ) {
            return;
          }

          const customer =
            cleanText(
              row[
                "Customer Name"
              ]
            ) ||
            "Unknown Customer";

          const estimatedRecovery =
            amount * 0.35;

          const ageText =
            recordDaysOld !== null
              ? `${recordDaysOld} days`
              : "an unknown amount of time";

          leaks.push({
            detectorId:
              "universal.abandoned-lead",

            leakType:
              "Abandoned Lead",

            title:
              "Uncontacted lead revenue",

            description:
              `${customer} has a lead worth $${amount.toFixed(
                2
              )} that appears to have gone ${ageText} without initial contact.`,

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

            customerName:
              customer,

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

              recordDaysOld,

              explicitlyNotContacted,

              oldEnough,

              leadValue:
                amount,
            },

            recommendedAction:
              "Contact the lead immediately and attempt to move the opportunity toward a booking or sale.",

            metadata: {},
          });
        }
      );

      return {
        detectorId:
          "universal.abandoned-lead",

        ran: true,

        leaks,

        warnings,

        errors,
      };
    },
  };