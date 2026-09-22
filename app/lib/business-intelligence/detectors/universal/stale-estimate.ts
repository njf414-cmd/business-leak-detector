import type {
    BusinessLeakDetector,
    DetectedBusinessLeak,
    DetectorContext,
  } from "../../detector-types";
  
  /* ================================== */
  /* CONSTANTS */
  /* ================================== */
  
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
  
  function isEstimateStatus(
    value: unknown
  ): boolean {
    return matchesStatus(
      value,
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
      ]
    );
  }
  
  function isUnsentEstimateStatus(
    value: unknown
  ): boolean {
    return matchesStatus(
      value,
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
    value: unknown
  ): boolean {
    return matchesStatus(
      value,
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
  
  function isFollowUpMissing(
    value: unknown
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
    ].includes(
      normalized
    );
  }
  
  /* ================================== */
  /* EXPIRED DATE CHECK */
  /* ================================== */
  
  function isPastDue(
    value: unknown,
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
  /* DETECTOR */
  /* ================================== */
  
  export const staleEstimateDetector:
    BusinessLeakDetector = {
      id:
        "universal.stale-estimate",
  
      name:
        "Stale Estimate",
  
      description:
        "Detects open estimates that have been followed up but have stopped progressing for 14 or more days.",
  
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
          "Follow Up",
          "Estimate Sent",
          "Expiration Date",
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
              Only active estimate-type records
              belong in this detector.
            */
  
            if (
              !isEstimateStatus(
                status
              )
            ) {
              return;
            }
  
            if (
              isResolvedStatus(
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
  
            /*
              Unsent estimates belong to the
              Unsent Estimate detector.
            */
  
            const estimateSent =
              row[
                "Estimate Sent"
              ];
  
            if (
              isNo(
                estimateSent
              ) ||
              isUnsentEstimateStatus(
                status
              )
            ) {
              return;
            }
  
            /*
              Expired estimates belong to the
              Expired Estimate detector.
            */
  
            const expirationDate =
              row[
                "Expiration Date"
              ];
  
            if (
              isExpiredEstimateStatus(
                status
              ) ||
              (
                cleanText(
                  expirationDate
                ) !== "" &&
                isPastDue(
                  expirationDate,
                  context.now
                )
              )
            ) {
              return;
            }
  
            /*
              Missing follow-up belongs to
              Unfollowed Estimate.
  
              Stale Estimate is for opportunities
              that WERE followed up but then
              stopped progressing.
            */
  
            const followUp =
              row["Follow Up"];
  
            if (
              isFollowUpMissing(
                followUp
              )
            ) {
              return;
            }
  
            /*
              Match the legacy age behavior:
  
              Last Contact Date first,
              then original record Date.
            */
  
            const recordDate =
              row["Date"];
  
            const lastContactDate =
              row[
                "Last Contact Date"
              ];
  
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
  
            if (
              daysOpen === null ||
              daysOpen <
                STALE_ESTIMATE_THRESHOLD_DAYS
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
              amount * 0.25;
  
            leaks.push({
              detectorId:
                "universal.stale-estimate",
  
              leakType:
                "Stale Estimate",
  
              title:
                "Stale estimate revenue",
  
              description:
                `${customerName} has an open estimate worth $${amount.toFixed(
                  2
                )} that has not progressed for ${daysOpen} days.`,
  
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
  
                followUp:
                  cleanText(
                    followUp
                  ),
  
                estimateSent:
                  cleanText(
                    estimateSent
                  ),
  
                recordDate:
                  cleanText(
                    recordDate
                  ),
  
                lastContactDate:
                  cleanText(
                    lastContactDate
                  ),
  
                expirationDate:
                  cleanText(
                    expirationDate
                  ),
  
                daysOpen,
  
                staleThresholdDays:
                  STALE_ESTIMATE_THRESHOLD_DAYS,
  
                estimateValue:
                  amount,
              },
  
              recommendedAction:
                "Re-engage the customer and determine whether the estimate can be closed or converted. This should be addressed as soon as possible.",
  
              metadata: {},
            });
          }
        );
  
        return {
          detectorId:
            "universal.stale-estimate",
  
          ran: true,
  
          leaks,
  
          warnings,
  
          errors,
        };
      },
    };