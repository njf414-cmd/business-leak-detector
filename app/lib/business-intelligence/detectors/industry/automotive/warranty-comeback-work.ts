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
  
  function isWarrantyOrComeback(
    value: unknown
  ): boolean {
    const status =
      normalizeText(value);
  
    return [
      "warranty",
      "warranty work",
      "warranty repair",
      "comeback",
      "come back",
      "comeback work",
      "comeback repair",
      "redo",
      "rework",
      "repeat repair",
      "failed repair",
    ].includes(status);
  }
  
  /* ================================== */
  /* DETECTOR #32 */
  /* ================================== */
  
  export const warrantyComebackWorkDetector:
    BusinessLeakDetector = {
      id:
        "automotive.warranty-comeback-work",
  
      name:
        "Warranty / Comeback Work",
  
      description:
        "Detects automotive warranty, comeback, or rework jobs that create measurable cost from previously completed work.",
  
      scope:
        "industry",
  
      industries: [
        "automotive",
      ],
  
      requirements: {
        optionalFields: [
          "Customer Name",
          "Comeback Type",
          "Comeback Service",
          "Comeback Cost",
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
            const comebackType =
              row[
                "Comeback Type"
              ];
  
            /*
              Require explicit evidence that
              this is warranty/comeback work.
  
              We do not infer it from normal
              job information.
            */
  
            if (
              !isWarrantyOrComeback(
                comebackType
              )
            ) {
              return;
            }
  
            const cost =
              parseMoney(
                row[
                  "Comeback Cost"
                ]
              );
  
            /*
              Never invent the cost of
              warranty or rework.
            */
  
            if (
              cost === null ||
              cost <= 0
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
                  "Comeback Service"
                ]
              ) ||
              "previous service";
  
            leaks.push({
              detectorId:
                "automotive.warranty-comeback-work",
  
              leakType:
                "Warranty / Comeback Work",
  
              title:
                `${customerName} required ${service} rework`,
  
              description:
                `${customerName} required warranty or comeback work for ${service}, creating $${cost.toFixed(
                  2
                )} in measurable rework cost.`,
  
              category:
                "Automotive Margin",
  
              severity:
                cost >= 1500
                  ? "high"
                  : cost >= 500
                    ? "medium"
                    : "low",
  
              confidence:
                "high",
  
              estimatedLoss:
                cost,
  
              /*
                The cost has already been
                incurred, so we do not claim
                that the business can recover
                this exact amount.
              */
  
              estimatedRecovery:
                0,
  
              customerName,
  
              sourceRowIndex:
                rowIndex,
  
              evidence: {
                comebackType:
                  cleanText(
                    comebackType
                  ),
  
                comebackService:
                  service,
  
                comebackCost:
                  cost,
              },
  
              recommendedAction:
                `Review the ${service} comeback for ${customerName}, identify the cause of the rework, and determine whether a process, parts, or quality-control issue should be corrected.`,
  
              metadata: {
                industry:
                  "automotive",
  
                revenueType:
                  "margin_leak",
  
                detectionReason:
                  "warranty_or_comeback_cost",
              },
            });
          }
        );
  
        return {
          detectorId:
            "automotive.warranty-comeback-work",
  
          ran: true,
  
          leaks,
  
          warnings,
  
          errors,
        };
      },
    };