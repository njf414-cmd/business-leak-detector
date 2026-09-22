import type {
    BusinessLeakDetector,
    DetectedBusinessLeak,
    DetectorContext,
  } from "../../../detector-types";
  
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
  
  function hasValue(
    value: unknown
  ): boolean {
    return (
      value !== null &&
      value !== undefined &&
      cleanText(value) !== ""
    );
  }
  
  function parseMoney(
    value: unknown
  ): number | null {
    if (!hasValue(value)) {
      return null;
    }
  
    const cleaned = cleanText(value)
      .replace(/[$,\s]/g, "");
  
    if (
      !/^\d+(\.\d+)?$/.test(cleaned)
    ) {
      return null;
    }
  
    const parsed = Number(cleaned);
  
    if (
      !Number.isFinite(parsed) ||
      parsed <= 0
    ) {
      return null;
    }
  
    return parsed;
  }
  
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
  
  /* ================================== */
  /* STATUS RULES */
  /* ================================== */
  
  const OPEN_STATUSES = [
    "recommended",
    "recommended service",
    "recommended repair",
    "declined",
    "declined service",
    "declined repair",
    "deferred",
    "deferred service",
    "deferred repair",
    "not performed",
    "not completed",
    "pending",
    "open",
    "needs service",
    "needs repair",
  ];
  
  const COMPLETED_STATUSES = [
    "completed",
    "complete",
    "performed",
    "service performed",
    "repair performed",
    "approved and completed",
    "done",
  ];
  
  /* ================================== */
  /* DETECTOR */
  /* ================================== */
  
  export const unperformedRecommendedServiceDetector:
    BusinessLeakDetector = {
      id:
        "automotive.unperformed-recommended-service",
  
      name:
        "Unperformed Recommended Service",
  
      description:
        "Detects recommended automotive services or repairs that have a known value but were not performed.",
  
      scope:
        "industry",
  
      industries: [
        "automotive",
      ],
  
      requirements: {
        optionalFields: [
          "Customer Name",
          "Recommended Service",
          "Recommended Service Amount",
          "Recommended Service Status",
          "Vehicle",
          "VIN",
          "Make",
          "Model",
        ],
      },
  
      supports(profile) {
        return (
          profile.industry ===
          "automotive"
        );
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
            const customerName =
              cleanText(
                row["Customer Name"]
              ) ||
              "Unknown Customer";
  
            const service =
              cleanText(
                row[
                  "Recommended Service"
                ]
              );
  
            const amount =
              parseMoney(
                row[
                  "Recommended Service Amount"
                ]
              );
  
            const status =
              row[
                "Recommended Service Status"
              ];
  
            /*
              Safety rule:
  
              We require an explicit recommended
              service AND an explicit positive
              dollar amount.
  
              Never substitute Job Amount,
              Invoice Amount, Quote Amount, etc.
            */
  
            if (
              !service ||
              amount === null
            ) {
              return;
            }
  
            /*
              Completed recommendations are not
              leaks.
            */
  
            if (
              matchesStatus(
                status,
                COMPLETED_STATUSES
              )
            ) {
              return;
            }
  
            /*
              We require explicit evidence that
              the recommended work remains open,
              deferred, declined, or unperformed.
            */
  
            if (
              !matchesStatus(
                status,
                OPEN_STATUSES
              )
            ) {
              return;
            }
  
            leaks.push({
              detectorId:
                "automotive.unperformed-recommended-service",
  
              leakType:
                "Unperformed Recommended Service",
  
              title:
                "Recommended automotive service was not performed",
  
              description:
                `${customerName} has a recommended ${service} worth $${amount.toFixed(
                  2
                )} that was not performed.`,
  
              category:
                "Automotive Revenue",
  
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
  
              /*
                Recommended work is an opportunity,
                not guaranteed receivable revenue.
  
                Use a conservative recovery
                estimate rather than assuming
                100% recovery.
              */
  
              estimatedRecovery:
                amount * 0.35,
  
              customerName,
  
              sourceRowIndex:
                rowIndex,
  
              evidence: {
                recommendedService:
                  service,
  
                recommendedServiceAmount:
                  amount,
  
                recommendedServiceStatus:
                  cleanText(status),
  
                vehicle:
                  cleanText(
                    row["Vehicle"]
                  ),
  
                vin:
                  cleanText(
                    row["VIN"]
                  ),
  
                make:
                  cleanText(
                    row["Make"]
                  ),
  
                model:
                  cleanText(
                    row["Model"]
                  ),
              },
  
              recommendedAction:
                "Contact the customer about the recommended service, confirm whether the work is still needed, explain the value of completing it, and offer a convenient appointment.",
  
              metadata: {
                industry:
                  "automotive",
  
                revenueType:
                  "recommended_service",
  
                amountSource:
                  "Recommended Service Amount",
  
                detectionReason:
                  "recommended_service_not_performed",
              },
            });
          }
        );
  
        return {
          detectorId:
            "automotive.unperformed-recommended-service",
  
          ran: true,
  
          leaks,
  
          warnings,
  
          errors,
        };
      },
    };