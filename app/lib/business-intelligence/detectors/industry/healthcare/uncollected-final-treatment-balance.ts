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
  return ["completed","complete","finished","closed"].includes(normalizeText(value));
}

function isAlreadyBilled(value: unknown): boolean {
  return ["paid","collected","received","settled"].includes(normalizeText(value));
}

export const uncollectedFinalTreatmentBalanceDetector: BusinessLeakDetector = {
  id: "healthcare.uncollected-final-treatment-balance",
  name: "Uncollected Final Treatment Balance",
  description: "Detects completed treatment plans with a documented final balance that remains uncollected.",
  scope: "industry",
  industries: ["healthcare"],
  requirements: {
    optionalFields: ["Customer Name","Project Name","Treatment Plan","Final Treatment Balance","Treatment Completion Status","Final Treatment Payment Status","Treatment Completion Date"],
  },
  supports(profile) {
    return profile.industry === "healthcare";
  },
  async detect(context: DetectorContext): Promise<DetectorResult> {
    const leaks: DetectedBusinessLeak[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    context.rows.forEach((row, rowIndex) => {
      if (!isEarned(row["Treatment Completion Status"])) return;
      if (isAlreadyBilled(row["Final Treatment Payment Status"])) return;

      const amount = parseMoney(row["Final Treatment Balance"]);
      if (amount === null || amount <= 0) return;

      const item = cleanText(row["Treatment Plan"]);
      if (!item) return;

      const customerName = cleanText(row["Customer Name"]) || "Unknown Customer";
      const projectName = cleanText(row["Project Name"]);
      const eventDate = cleanText(row["Treatment Completion Date"]);
      const recovery = amount * 0.9;

      leaks.push({
        detectorId: "healthcare.uncollected-final-treatment-balance",
        leakType: "Uncollected Final Treatment Balance",
        title: `${customerName} has a uncollected final treatment balance`,
        description: `${customerName}'s ${item}${projectName ? ` for ${projectName}` : ""} has an earned $${amount.toFixed(2)} amount that has not been billed.`,
        category: "Healthcare Billing",
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
          status: cleanText(row["Treatment Completion Status"]),
          billingStatus: cleanText(row["Final Treatment Payment Status"]),
          eventDate,
        },
        recommendedAction: `Review ${customerName}'s ${item} and collect the documented $${amount.toFixed(2)} amount.`,
        metadata: {
          industry: "healthcare",
          revenueType: "final_treatment_balance",
          detectionReason: "treatment_completed_final_balance_not_collected",
        },
      });
    });

    return {
      detectorId: "healthcare.uncollected-final-treatment-balance",
      ran: true,
      leaks,
      warnings,
      errors,
    };
  },
};
