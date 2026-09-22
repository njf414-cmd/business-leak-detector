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
  return ["approved","scheduled","signed","active"].includes(normalizeText(value));
}

function isAlreadyBilled(value: unknown): boolean {
  return ["paid","collected","received","waived"].includes(normalizeText(value));
}

export const uncollectedAgencyProjectDepositDetector: BusinessLeakDetector = {
  id: "agency.uncollected-project-deposit",
  name: "Uncollected Project Deposit",
  description: "Detects documented uncollected project deposit opportunities where revenue is due or earned but has not been properly billed or collected.",
  scope: "industry",
  industries: ["agency"],
  requirements: {
    optionalFields: ["Customer Name","Project Name","Project","Project Deposit Amount","Project Status","Project Deposit Status","Project Start Date"],
  },
  supports(profile) {
    return profile.industry === "agency";
  },
  async detect(context: DetectorContext): Promise<DetectorResult> {
    const leaks: DetectedBusinessLeak[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    context.rows.forEach((row, rowIndex) => {
      if (!isEarned(row["Project Status"])) return;
      if (isAlreadyBilled(row["Project Deposit Status"])) return;

      const amount = parseMoney(row["Project Deposit Amount"]);
      if (amount === null || amount <= 0) return;

      const item = cleanText(row["Project"]);
      if (!item) return;

      const customerName = cleanText(row["Customer Name"]) || "Unknown Customer";
      const projectName = cleanText(row["Project Name"]);
      const eventDate = cleanText(row["Project Start Date"]);
      const recovery = amount * 0.9;

      leaks.push({
        detectorId: "agency.uncollected-project-deposit",
        leakType: "Uncollected Project Deposit",
        title: `${customerName} has a uncollected project deposit`,
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
          status: cleanText(row["Project Status"]),
          billingStatus: cleanText(row["Project Deposit Status"]),
          eventDate,
        },
        recommendedAction: `Review ${customerName}'s ${item} and invoice the documented $${amount.toFixed(2)} amount.`,
        metadata: {
          industry: "agency",
          revenueType: "project_deposit",
          detectionReason: "agency_project_deposit_not_collected",
        },
      });
    });

    return {
      detectorId: "agency.uncollected-project-deposit",
      ran: true,
      leaks,
      warnings,
      errors,
    };
  },
};
