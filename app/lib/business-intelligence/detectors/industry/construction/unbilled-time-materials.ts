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
  
  function isCompletedWork(
    value: unknown
  ): boolean {
    const status =
      normalizeText(value);
  
    return [
      "completed",
      "complete",
      "performed",
      "finished",
      "done",
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
  /* DETECTOR #49 */
  /* ================================== */
  
  export const unbilledTimeMaterialsDetector:
    BusinessLeakDetector = {
      id:
        "construction.unbilled-time-materials",
  
      name:
        "Unbilled Time & Materials",
  
      description:
        "Detects completed construction time-and-materials work with documented billable labor or materials that have not been billed.",
  
      scope:
        "industry",
  
      industries: [
        "construction",
      ],
  
      requirements: {
        optionalFields: [
          "Customer Name",
          "Project Name",
          "T&M Work",
          "T&M Status",
          "T&M Labor Amount",
          "T&M Material Amount",
          "T&M Billing Status",
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
              Work must explicitly be
              completed or performed.
            */
  
            if (
              !isCompletedWork(
                row["T&M Status"]
              )
            ) {
              return;
            }
  
            /*
              Ignore work that has already
              been billed or collected.
            */
  
            if (
              isAlreadyBilled(
                row[
                  "T&M Billing Status"
                ]
              )
            ) {
              return;
            }
  
            const laborAmount =
              parseMoney(
                row[
                  "T&M Labor Amount"
                ]
              );
  
            const materialAmount =
              parseMoney(
                row[
                  "T&M Material Amount"
                ]
              );
  
            /*
              Each component is only used
              when explicitly documented.
  
              We never substitute Contract
              Amount, Job Amount, Invoice
              Amount, or another field.
            */
  
            const explicitLabor =
              laborAmount !== null &&
              laborAmount > 0
                ? laborAmount
                : 0;
  
            const explicitMaterials =
              materialAmount !== null &&
              materialAmount > 0
                ? materialAmount
                : 0;
  
            const totalAmount =
              explicitLabor +
              explicitMaterials;
  
            if (totalAmount <= 0) {
              return;
            }
  
            const work =
              cleanText(
                row["T&M Work"]
              );
  
            if (!work) {
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
              totalAmount * 0.85;
  
            leaks.push({
              detectorId:
                "construction.unbilled-time-materials",
  
              leakType:
                "Unbilled Time & Materials",
  
              title:
                `${customerName} has unbilled T&M work`,
  
              description:
                `${customerName}'s ${work}${projectName ? ` on ${projectName}` : ""} has been completed but $${totalAmount.toFixed(
                  2
                )} in documented time-and-materials work has not been billed.`,
  
              category:
                "Construction Billing",
  
              severity:
                totalAmount >= 10000
                  ? "high"
                  : totalAmount >= 2500
                    ? "medium"
                    : "low",
  
              confidence:
                "high",
  
              estimatedLoss:
                totalAmount,
  
              estimatedRecovery:
                recovery,
  
              customerName,
  
              sourceRowIndex:
                rowIndex,
  
              evidence: {
                projectName,
  
                work,
  
                tmStatus:
                  cleanText(
                    row["T&M Status"]
                  ),
  
                laborAmount:
                  explicitLabor,
  
                materialAmount:
                  explicitMaterials,
  
                totalAmount,
  
                billingStatus:
                  cleanText(
                    row[
                      "T&M Billing Status"
                    ]
                  ),
              },
  
              recommendedAction:
                `Review ${customerName}'s completed T&M work and invoice the documented $${totalAmount.toFixed(
                  2
                )} in billable labor and materials.`,
  
              metadata: {
                industry:
                  "construction",
  
                revenueType:
                  "time_and_materials",
  
                detectionReason:
                  "completed_tm_work_not_billed",
              },
            });
          }
        );
  
        return {
          detectorId:
            "construction.unbilled-time-materials",
  
          ran: true,
  
          leaks,
  
          warnings,
  
          errors,
        };
      },
    };