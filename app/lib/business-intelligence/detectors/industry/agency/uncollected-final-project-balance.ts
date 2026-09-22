import type {
  BusinessLeakDetector,
  DetectorContext,
  DetectorResult,
  DetectedBusinessLeak,
} from "../../../detector-types";

function cleanText(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeText(value: unknown): string {
  return cleanText(value)
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

function parseMoney(value: unknown): number | null {
  const cleaned = cleanText(value).replace(/[$,\s]/g, "");
  if (!cleaned || !/^\d+(\.\d+)?$/.test(cleaned)) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function isEarned(value: unknown): boolean {
  return ["completed","delivered","closed","finished"].includes(normalizeText(value));
}

function isAlreadyBilled(value: unknown): boolean {
  return ["paid","collected","settled","waived"].includes(normalizeText(value));
}

export const uncollectedAgencyFinalProjectBalanceDetector: BusinessLeakDetector = {
  id: "agency.uncollected-final-project-balance",
  name: "Uncollected Final Project Balance",
  description: "Detects documented uncollected final project balance opportunities where revenue is due or earned but has not been properly billed or collected.",
  scope: "industry",
  industries: ["agency"],
  requirements: {
    optionalFields: ["Customer Name","Project Name","Project","Final Project Balance","Project Completion Status","Final Project Payment Status","Project Completion Date"],
  },
  supports(profile) {
    return profile.industry === "agency";
  },
  async detect(context: DetectorContext): Promise<DetectorResult> {
    const leaks: DetectedBusinessLeak[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    context.rows.forEach((row, rowIndex) => {
      if (!isEarned(row["Project Completion Status"])) return;
      if (isAlreadyBilled(row["Final Project Payment Status"])) return;

      const amount = parseMoney(row["Final Project Balance"]);
      if (amount === null || amount <= 0) return;

      const item = cleanText(row["Project"]);
      if (!item) return;

      const customerName = cleanText(row["Customer Name"]) || "Unknown Customer";
      const projectName = cleanText(row["Project Name"]);
      const eventDate = cleanText(row["Project Completion Date"]);
      const recovery = amount * 0.9;

      leaks.push({
        detectorId: "agency.uncollected-final-project-balance",
        leakType: "Uncollected Final Project Balance",
        title: `${customerName} has a uncollected final project balance`,
        description: `${customerName}'s ${item}${projectName ? ` for ${projectName}` : ""} has an earned $${amount.toFixed(2)} amount that has not been billed.`,
        category: "Agency Billing",
        severity: amount >= 25000 ? "high" : amount >= 7500 ? "medium" : "low",
        confidence: "high",
        estimatedLoss: amount,
        estimatedRecovery: recovery,
        customerName,
        sourceRowIndex: rowIndex,
        evidence: {
          projectName,
          item,
          amount,
          status: cleanText(row["Project Completion Status"]),
          billingStatus: cleanText(row["Final Project Payment Status"]),
          eventDate,
        },
        recommendedAction: `Review ${customerName}'s ${item} and invoice the documented $${amount.toFixed(2)} amount.`,
        metadata: {
          industry: "agency",
          revenueType: "final_project_balance",
          detectionReason: "agency_final_project_balance_not_collected",
        },
      });
    });

    return {
      detectorId: "agency.uncollected-final-project-balance",
      ran: true,
      leaks,
      warnings,
      errors,
    };
  },
};
