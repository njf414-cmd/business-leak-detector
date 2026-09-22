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
  
  /* ================================== */
  /* DETECTOR */
  /* ================================== */
  
  export const unsentEstimateDetector:
    BusinessLeakDetector = {
      id:
        "universal.unsent-estimate",
  
      name:
        "Unsent Estimate",
  
      description:
        "Detects estimates, quotes, and proposals that were created but never sent to the customer.",
  
      scope:
        "universal",
  
      industries: [],
  
      requirements: {
        requiredFields: [
          "Quote Amount",
        ],
  
        optionalFields: [
          "Customer Name",
          "Status",
          "Estimate Sent",
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
              Resolved opportunities cannot
              be unsent estimate leaks.
            */
  
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
  
            const estimateSent =
              row[
                "Estimate Sent"
              ];
  
            /*
              Match legacy behavior:
  
              Either the sent field explicitly
              says No/Unsent OR the record status
              identifies an unsent/draft estimate.
            */
  
            const explicitlyUnsent =
              isNo(
                estimateSent
              );
  
            const statusUnsent =
              isUnsentEstimateStatus(
                status
              );
  
            if (
              !explicitlyUnsent &&
              !statusUnsent
            ) {
              return;
            }
  
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
  
            const customerName =
              cleanText(
                row[
                  "Customer Name"
                ]
              ) ||
              "Unknown Customer";
  
            const estimatedRecovery =
              amount * 0.30;
  
            leaks.push({
              detectorId:
                "universal.unsent-estimate",
  
              leakType:
                "Unsent Estimate",
  
              title:
                "Unsent estimate revenue",
  
              description:
                daysOpen !== null
                  ? `${customerName} has an estimate worth $${amount.toFixed(
                      2
                    )} that has not been sent to the customer. The opportunity has been open for ${daysOpen} days.`
                  : `${customerName} has an estimate worth $${amount.toFixed(
                      2
                    )} that has not been sent to the customer.`,
  
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
  
                estimateSent:
                  cleanText(
                    estimateSent
                  ),
  
                explicitlyUnsent,
  
                statusUnsent,
  
                recordDate:
                  cleanText(
                    recordDate
                  ),
  
                lastContactDate:
                  cleanText(
                    lastContactDate
                  ),
  
                daysOpen,
  
                estimateValue:
                  amount,
              },
  
              recommendedAction:
                "Review the estimate and send it to the customer as soon as possible, then schedule a follow-up.",
  
              metadata: {},
            });
          }
        );
  
        return {
          detectorId:
            "universal.unsent-estimate",
  
          ran: true,
  
          leaks,
  
          warnings,
  
          errors,
        };
      },
    };