import type {
    BusinessLeakDetector,
    DetectedBusinessLeak,
    DetectorContext,
  } from "../../detector-types";
  
  /* ================================== */
  /* SETTINGS */
  /* ================================== */
  
  const STALE_LEAD_THRESHOLD_DAYS = 14;
  
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
  /* DETECTOR */
  /* ================================== */
  
  export const staleLeadDetector:
    BusinessLeakDetector = {
      id:
        "universal.stale-lead",
  
      name:
        "Stale Lead",
  
      description:
        "Detects active leads that have gone 14 or more days without progressing.",
  
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
  
            /*
              Closed, booked, paid, lost,
              cancelled, or otherwise resolved
              opportunities are not stale leads.
            */
  
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
  
            const recordDate =
              row["Date"];
  
            const lastContactDate =
              row[
                "Last Contact Date"
              ];
  
            /*
              Match the legacy engine's
              getBestAgeDate behavior:
  
              Last Contact Date first,
              then Date.
            */
  
            const ageDate =
              cleanText(
                lastContactDate
              )
                ? lastContactDate
                : recordDate;
  
            const daysOpen =
              getDaysSince(
                ageDate,
                context.now
              );
  
            /*
              We need a valid age to prove
              that the lead is stale.
            */
  
            if (
              daysOpen === null
            ) {
              return;
            }
  
            if (
              daysOpen <
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
              amount * 0.2;
  
            leaks.push({
              detectorId:
                "universal.stale-lead",
  
              leakType:
                "Stale Lead",
  
              title:
                "Stale lead revenue",
  
              description:
                `${customerName} has an active lead worth $${amount.toFixed(
                  2
                )} that has gone ${daysOpen} days without progressing.`,
  
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
                    row[
                      "Contacted"
                    ]
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
  
                staleThresholdDays:
                  STALE_LEAD_THRESHOLD_DAYS,
  
                leadValue:
                  amount,
              },
  
              recommendedAction:
                "Re-contact the lead and determine whether the opportunity is still active. This should be addressed as soon as possible.",
  
              metadata: {},
            });
          }
        );
  
        return {
          detectorId:
            "universal.stale-lead",
  
          ran: true,
  
          leaks,
  
          warnings,
  
          errors,
        };
      },
    };