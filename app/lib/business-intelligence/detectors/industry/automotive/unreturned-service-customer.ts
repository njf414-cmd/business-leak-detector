import type {
    BusinessLeakDetector,
    DetectorContext,
    DetectorResult,
    DetectedBusinessLeak,
  } from "../../../detector-types";
  
  /* ================================== */
  /* HELPERS */
  /* ================================== */
  
  function cleanText(
    value: unknown
  ): string {
    return String(
      value ?? ""
    ).trim();
  }
  
  function parseMoney(
    value: unknown
  ): number | null {
    const cleaned =
      cleanText(value)
        .replace(/[$,\s]/g, "");
  
    if (
      !cleaned ||
      !/^\d+(\.\d+)?$/.test(
        cleaned
      )
    ) {
      return null;
    }
  
    const parsed =
      Number(cleaned);
  
    return Number.isFinite(parsed)
      ? parsed
      : null;
  }
  
  function parseDate(
    value: unknown
  ): Date | null {
    const text =
      cleanText(value);
  
    if (!text) {
      return null;
    }
  
    const parsed =
      new Date(text);
  
    if (
      Number.isNaN(
        parsed.getTime()
      )
    ) {
      return null;
    }
  
    return parsed;
  }
  
  function parsePositiveInteger(
    value: unknown
  ): number | null {
    const text =
      cleanText(value);
  
    if (
      !text ||
      !/^\d+$/.test(text)
    ) {
      return null;
    }
  
    const parsed =
      Number(text);
  
    if (
      !Number.isInteger(parsed) ||
      parsed <= 0
    ) {
      return null;
    }
  
    return parsed;
  }
  
  function daysBetween(
    earlier: Date,
    later: Date
  ): number {
    const milliseconds =
      later.getTime() -
      earlier.getTime();
  
    return Math.floor(
      milliseconds /
        (1000 * 60 * 60 * 24)
    );
  }
  
  /* ================================== */
  /* DETECTOR #30 */
  /* ================================== */
  
  export const unreturnedServiceCustomerDetector:
    BusinessLeakDetector = {
      id:
        "automotive.unreturned-service-customer",
  
      name:
        "Unreturned Service Customer",
  
      description:
        "Detects automotive customers who have passed their expected return-service interval without returning.",
  
      scope:
        "industry",
  
      industries: [
        "automotive",
      ],
  
      requirements: {
        optionalFields: [
          "Customer Name",
          "Last Service Date",
          "Expected Return Days",
          "Expected Return Service",
          "Expected Return Amount",
        ],
      },
  
      supports(profile) {
        return (
          profile.industry ===
          "automotive"
        );
      },
  
      async detect(
        context: DetectorContext
      ): Promise<DetectorResult> {
        const leaks:
          DetectedBusinessLeak[] = [];
  
        const warnings:
          string[] = [];
  
        const errors:
          string[] = [];
  
        context.rows.forEach(
          (
            row,
            rowIndex
          ) => {
            const lastServiceDate =
              parseDate(
                row[
                  "Last Service Date"
                ]
              );
  
            const expectedReturnDays =
              parsePositiveInteger(
                row[
                  "Expected Return Days"
                ]
              );
  
            /*
              We require BOTH an actual last
              service date and an explicit
              expected return interval.
  
              The detector must not guess a
              maintenance schedule.
            */
  
            if (
              !lastServiceDate ||
              expectedReturnDays === null
            ) {
              return;
            }
  
            /*
              Future service dates are invalid
              for this opportunity detector.
            */
  
            if (
              lastServiceDate.getTime() >
              context.now.getTime()
            ) {
              return;
            }
  
            const daysSinceService =
              daysBetween(
                lastServiceDate,
                context.now
              );
  
            /*
              Customer is still inside the
              expected return window.
            */
  
            if (
              daysSinceService <=
              expectedReturnDays
            ) {
              return;
            }
  
            const amount =
              parseMoney(
                row[
                  "Expected Return Amount"
                ]
              );
  
            /*
              Never invent revenue.
  
              We need an explicit positive
              expected service value before
              reporting a financial leak.
            */
  
            if (
              amount === null ||
              amount <= 0
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
  
            const service =
              cleanText(
                row[
                  "Expected Return Service"
                ]
              ) ||
              "return service";
  
            const daysLate =
              daysSinceService -
              expectedReturnDays;
  
            /*
              This is a retention opportunity,
              not revenue already owed.
  
              Keep recovery conservative.
            */
  
            const recovery =
              amount * 0.35;
  
            leaks.push({
              detectorId:
                "automotive.unreturned-service-customer",
  
              leakType:
                "Unreturned Service Customer",
  
              title:
                `${customerName} has not returned for ${service}`,
  
              description:
                `${customerName} is ${daysLate} day${daysLate === 1 ? "" : "s"} past the expected return window for ${service}, representing $${amount.toFixed(
                  2
                )} in potential service revenue.`,
  
              category:
                "Automotive Retention",
  
              severity:
                daysLate >= 90 ||
                amount >= 1500
                  ? "high"
                  : daysLate >= 30 ||
                      amount >= 500
                    ? "medium"
                    : "low",
  
              confidence:
                "high",
  
              estimatedLoss:
                amount,
  
              estimatedRecovery:
                recovery,
  
              customerName,
  
              sourceRowIndex:
                rowIndex,
  
              evidence: {
                lastServiceDate:
                  lastServiceDate.toISOString(),
  
                expectedReturnDays,
  
                expectedReturnService:
                  service,
  
                expectedReturnAmount:
                  amount,
  
                daysSinceService,
  
                daysLate,
              },
  
              recommendedAction:
                `Contact ${customerName} to remind them they are due to return for ${service} and offer a convenient appointment.`,
  
              metadata: {
                industry:
                  "automotive",
  
                revenueType:
                  "customer_reactivation",
  
                detectionReason:
                  "customer_past_expected_return_interval",
              },
            });
          }
        );
  
        return {
          detectorId:
            "automotive.unreturned-service-customer",
  
          ran: true,
  
          leaks,
  
          warnings,
  
          errors,
        };
      },
    };