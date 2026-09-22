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
  
  function isBillable(
    value: unknown
  ): boolean {
    const status =
      normalizeText(value);
  
    return [
      "billable",
      "approved",
      "approved for billing",
      "ready to bill",
    ].includes(status);
  }
  
  function isAlreadyBilled(
    value: unknown
  ): boolean {
    const status =
      normalizeText(value);
  
    return [
      "billed",
      "invoiced",
      "invoice sent",
      "paid",
      "collected",
    ].includes(status);
  }
  
  /* ================================== */
  /* DETECTOR #51 */
  /* ================================== */
  
  export const unbilledStoredMaterialsDetector:
    BusinessLeakDetector = {
      id:
        "construction.unbilled-stored-materials",
  
      name:
        "Unbilled Stored Materials",
  
      description:
        "Detects explicitly billable stored construction materials with documented value that have not been billed.",
  
      scope:
        "industry",
  
      industries: [
        "construction",
      ],
  
      requirements: {
        optionalFields: [
          "Customer Name",
          "Project Name",
          "Stored Materials",
          "Stored Materials Amount",
          "Stored Materials Status",
          "Stored Materials Billing Status",
        ],
      },
  
      supports(profile) {
        return (
          profile.industry ===
          "construction"
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
            /*
              Materials must explicitly be
              approved or ready for billing.
            */
  
            if (
              !isBillable(
                row[
                  "Stored Materials Status"
                ]
              )
            ) {
              return;
            }
  
            /*
              Ignore materials that have
              already been billed or paid.
            */
  
            if (
              isAlreadyBilled(
                row[
                  "Stored Materials Billing Status"
                ]
              )
            ) {
              return;
            }
  
            const amount =
              parseMoney(
                row[
                  "Stored Materials Amount"
                ]
              );
  
            /*
              Require an explicit stored
              materials amount.
  
              Never substitute Contract
              Amount, Job Amount, Invoice
              Amount, material cost, or
              another financial field.
            */
  
            if (
              amount === null ||
              amount <= 0
            ) {
              return;
            }
  
            const materials =
              cleanText(
                row[
                  "Stored Materials"
                ]
              );
  
            /*
              Require an explicit description
              of the stored materials.
            */
  
            if (!materials) {
              return;
            }
  
            const customerName =
              cleanText(
                row["Customer Name"]
              ) ||
              "Unknown Customer";
  
            const projectName =
              cleanText(
                row["Project Name"]
              );
  
            const recovery =
              amount * 0.9;
  
            leaks.push({
              detectorId:
                "construction.unbilled-stored-materials",
  
              leakType:
                "Unbilled Stored Materials",
  
              title:
                `${customerName} has unbilled stored materials`,
  
              description:
                `${customerName}'s ${materials}${projectName ? ` for ${projectName}` : ""} have $${amount.toFixed(
                  2
                )} in documented billable value that has not been billed.`,
  
              category:
                "Construction Billing",
  
              severity:
                amount >= 20000
                  ? "high"
                  : amount >= 5000
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
                projectName,
  
                materials,
  
                storedMaterialsAmount:
                  amount,
  
                storedMaterialsStatus:
                  cleanText(
                    row[
                      "Stored Materials Status"
                    ]
                  ),
  
                billingStatus:
                  cleanText(
                    row[
                      "Stored Materials Billing Status"
                    ]
                  ),
              },
  
              recommendedAction:
                `Review ${customerName}'s stored materials and bill the documented $${amount.toFixed(
                  2
                )} in approved material value.`,
  
              metadata: {
                industry:
                  "construction",
  
                revenueType:
                  "stored_materials",
  
                detectionReason:
                  "billable_stored_materials_not_billed",
              },
            });
          }
        );
  
        return {
          detectorId:
            "construction.unbilled-stored-materials",
  
          ran: true,
  
          leaks,
  
          warnings,
  
          errors,
        };
      },
    };