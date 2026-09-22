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
  
  function isLostLeadStatus(
    value: unknown
  ): boolean {
    return matchesStatus(
      value,
      [
        "lost",
        "lead lost",
        "lost lead",
        "closed lost",
        "dead lead",
        "not interested",
        "declined quote",
        "declined estimate",
      ]
    );
  }
  
  /* ================================== */
  /* DETECTOR */
  /* ================================== */
  
  export const lostLeadDetector:
    BusinessLeakDetector = {
      id:
        "universal.lost-lead",
  
      name:
        "Lost Lead",
  
      description:
        "Detects leads or opportunities that were explicitly lost and represent lost potential revenue.",
  
      scope:
        "universal",
  
      industries: [],
  
      requirements: {
        optionalFields: [
          "Customer Name",
          "Status",
          "Quote Amount",
          "Job Amount",
          "Date",
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
              The legacy engine only treats
              explicit lost-lead states as
              Lost Lead.
  
              We do not guess that a lead is
              lost simply because it is old.
            */
  
            if (
              !isLostLeadStatus(
                status
              )
            ) {
              return;
            }
  
            /*
              Quote Amount represents the
              opportunity value for a lead.
  
              Job Amount is retained as a
              fallback for normalized datasets
              where the opportunity value was
              mapped there instead.
            */
  
            const quoteAmount =
              parseMoney(
                row[
                  "Quote Amount"
                ]
              );
  
            const jobAmount =
              parseMoney(
                row[
                  "Job Amount"
                ]
              );
  
            const amount =
              quoteAmount > 0
                ? quoteAmount
                : jobAmount;
  
            if (amount <= 0) {
              return;
            }
  
            const customerName =
              cleanText(
                row[
                  "Customer Name"
                ]
              ) ||
              "Unknown Customer";
  
            /*
              Lost Lead is historical lost
              revenue in the legacy engine.
  
              Recovery rate = 0%.
            */
  
            const severity =
              amount >= 1500
                ? "high"
                : amount >= 750
                  ? "medium"
                  : "low";
  
            leaks.push({
              detectorId:
                "universal.lost-lead",
  
              leakType:
                "Lost Lead",
  
              title:
                "Lost lead revenue",
  
              description:
                `${customerName} represents a lost lead or opportunity worth $${amount.toFixed(
                  2
                )}.`,
  
              category:
                "Lost",
  
              severity,
  
              confidence:
                "high",
  
              estimatedLoss:
                amount,
  
              estimatedRecovery:
                0,
  
              customerName,
  
              sourceRowIndex:
                rowIndex,
  
              evidence: {
                status,
  
                quoteAmount,
  
                jobAmount,
  
                lostRevenue:
                  amount,
  
                recordDate:
                  cleanText(
                    row["Date"]
                  ),
              },
  
              recommendedAction:
                "Review why the lead was lost and use the outcome to improve sales follow-up, pricing, qualification, or future win-back campaigns.",
  
              metadata: {},
            });
          }
        );
  
        return {
          detectorId:
            "universal.lost-lead",
  
          ran: true,
  
          leaks,
  
          warnings,
  
          errors,
        };
      },
    };