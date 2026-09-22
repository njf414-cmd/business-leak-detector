import type {
    BusinessLeakDetector,
    DetectedBusinessLeak,
    DetectorContext,
  } from "../../detector-types";
  
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
        "not contacted",
        "never contacted",
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
  
  export const unfollowedEstimateDetector:
    BusinessLeakDetector = {
      id:
        "universal.unfollowed-estimate",
  
      name:
        "Unfollowed Estimate",
  
      description:
        "Detects open estimates and quotes that have no recorded follow-up.",
  
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
  
            if (
              isResolvedStatus(
                status
              )
            ) {
              return;
            }
  
            if (
              !isEstimateStatus(
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
  
            const estimateSent =
              row[
                "Estimate Sent"
              ];
  
            /*
              Unsent Estimate has priority.
  
              We don't want an explicitly unsent
              estimate also classified as
              Unfollowed Estimate.
            */
  
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
  
            const expirationDate =
              row[
                "Expiration Date"
              ];
  
            /*
              Expired Estimate also has priority.
            */
  
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
  
            const followUp =
              row["Follow Up"];
  
            if (
              !isFollowUpMissing(
                followUp
              )
            ) {
              return;
            }
  
            const recordDate =
              row["Date"];
  
            const lastContactDate =
              row[
                "Last Contact Date"
              ];
  
            /*
              Match legacy getBestAgeDate:
  
              Last Contact Date first,
              then original Date.
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
  
            const customerName =
              cleanText(
                row[
                  "Customer Name"
                ]
              ) ||
              "Unknown Customer";
  
            const estimatedRecovery =
              amount * 0.35;
  
            const urgent =
              daysOpen !== null &&
              daysOpen >= 7;
  
            leaks.push({
              detectorId:
                "universal.unfollowed-estimate",
  
              leakType:
                "Unfollowed Estimate",
  
              title:
                "Unfollowed estimate revenue",
  
              description:
                daysOpen !== null
                  ? `${customerName} has an estimate worth $${amount.toFixed(
                      2
                    )} with no recorded follow-up. The opportunity has been open for ${daysOpen} days.`
                  : `${customerName} has an estimate worth $${amount.toFixed(
                      2
                    )} with no recorded follow-up.`,
  
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
  
                estimateValue:
                  amount,
              },
  
              recommendedAction:
                urgent
                  ? "Follow up with the customer about the estimate. This should be addressed as soon as possible."
                  : "Follow up with the customer about the estimate.",
  
              metadata: {},
            });
          }
        );
  
        return {
          detectorId:
            "universal.unfollowed-estimate",
  
          ran: true,
  
          leaks,
  
          warnings,
  
          errors,
        };
      },
    };