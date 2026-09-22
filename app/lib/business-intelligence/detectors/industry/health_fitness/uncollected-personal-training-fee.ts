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
  return ["completed","performed","attended","finished"].includes(normalizeText(value));
}

function isAlreadyBilled(value: unknown): boolean {
  return ["paid","collected","received","included"].includes(normalizeText(value));
}

export const uncollectedPersonalTrainingFeeDetector: BusinessLeakDetector = {
  id: "health-fitness.uncollected-personal-training-fee",
  name: "Uncollected Personal Training Session Fee",
  description: "Detects completed personal training sessions with a documented fee that remains uncollected.",
  scope: "industry",
  industries: ["health_fitness"],
  requirements: {
    optionalFields: ["Customer Name","Project Name","Personal Training Session","Personal Training Fee","Personal Training Status","Personal Training Payment Status","Training Date"],
  },
  supports(profile) {
    return profile.industry === "health_fitness";
  },
  async detect(context: DetectorContext): Promise<DetectorResult> {
    const leaks: DetectedBusinessLeak[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    context.rows.forEach((row, rowIndex) => {
      if (!isEarned(row["Personal Training Status"])) return;
      if (isAlreadyBilled(row["Personal Training Payment Status"])) return;

      const amount = parseMoney(row["Personal Training Fee"]);
      if (amount === null || amount <= 0) return;

      const item = cleanText(row["Personal Training Session"]);
      if (!item) return;

      const customerName = cleanText(row["Customer Name"]) || "Unknown Customer";
      const projectName = cleanText(row["Project Name"]);
      const eventDate = cleanText(row["Training Date"]);
      const recovery = amount * 0.9;

      leaks.push({
        detectorId: "health-fitness.uncollected-personal-training-fee",
        leakType: "Uncollected Personal Training Session Fee",
        title: `${customerName} has a uncollected personal training session fee`,
        description: `${customerName}'s ${item}${projectName ? ` for ${projectName}` : ""} has an earned $${amount.toFixed(2)} amount that has not been billed.`,
        category: "Fitness Billing",
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
          status: cleanText(row["Personal Training Status"]),
          billingStatus: cleanText(row["Personal Training Payment Status"]),
          eventDate,
        },
        recommendedAction: `Review ${customerName}'s ${item} and collect the documented $${amount.toFixed(2)} amount.`,
        metadata: {
          industry: "health_fitness",
          revenueType: "personal_training_fee",
          detectionReason: "personal_training_completed_fee_not_collected",
        },
      });
    });

    return {
      detectorId: "health-fitness.uncollected-personal-training-fee",
      ran: true,
      leaks,
      warnings,
      errors,
    };
  },
};
