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
  
  function isWonStatus(
    value: unknown
  ): boolean {
    return matchesStatus(
      value,
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
  
  function isPaidStatus(
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
  
  /* ================================== */
  /* DETECTOR */
  /* ================================== */
  
  export const expiredEstimateDetector:
    BusinessLeakDetector = {
      id:
        "universal.expired-estimate",
  
      name:
        "Expired Estimate",
  
      description:
        "Detects estimates, quotes, and proposals that have expired without converting into a sale.",
  
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
              Match legacy behavior:
  
              Won or paid opportunities are
              not expired-estimate leaks.
            */
  
            if (
              isWonStatus(
                status
              ) ||
              isPaidStatus(
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
  
            const expirationDate =
              row[
                "Expiration Date"
              ];
  
            /*
              Legacy detector considers the
              estimate expired if either:
  
              1. Status explicitly says expired
              OR
              2. Expiration Date is in the past.
            */
  
            const explicitlyExpired =
              isExpiredEstimateStatus(
                status
              );
  
            const dateExpired =
              cleanText(
                expirationDate
              ) !== "" &&
              isPastDue(
                expirationDate,
                context.now
              );
  
            if (
              !explicitlyExpired &&
              !dateExpired
            ) {
              return;
            }
  
            const recordDate =
              row["Date"];
  
            /*
              Legacy behavior uses the
              expiration date for age when
              available.
  
              Otherwise it falls back to the
              general record date.
            */
  
            const daysOpen =
              cleanText(
                expirationDate
              )
                ? getDaysSince(
                    expirationDate,
                    context.now
                  )
                : getDaysSince(
                    recordDate,
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
              amount * 0.15;
  
            leaks.push({
              detectorId:
                "universal.expired-estimate",
  
              leakType:
                "Expired Estimate",
  
              title:
                "Expired estimate revenue",
  
              description:
                daysOpen !== null
                  ? `${customerName} has an expired estimate worth $${amount.toFixed(
                      2
                    )}. The estimate has been expired for ${daysOpen} days.`
                  : `${customerName} has an expired estimate worth $${amount.toFixed(
                      2
                    )}.`,
  
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
  
                expirationDate:
                  cleanText(
                    expirationDate
                  ),
  
                recordDate:
                  cleanText(
                    recordDate
                  ),
  
                explicitlyExpired,
  
                dateExpired,
  
                daysOpen,
  
                estimateValue:
                  amount,
              },
  
              recommendedAction:
                "Contact the customer to determine whether the expired estimate can be renewed, updated, or converted into a sale.",
  
              metadata: {},
            });
          }
        );
  
        return {
          detectorId:
            "universal.expired-estimate",
  
          ran: true,
  
          leaks,
  
          warnings,
  
          errors,
        };
      },
    };