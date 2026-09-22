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
  return ["late cancellation","cancelled late","canceled late","fee due"].includes(normalizeText(value));
}

function isAlreadyBilled(value: unknown): boolean {
  return ["paid","collected","waived","settled"].includes(normalizeText(value));
}

export const uncollectedFitnessLateCancellationFeeDetector: BusinessLeakDetector = {
  id: "health-fitness.uncollected-late-cancellation-fee",
  name: "Uncollected Late Cancellation Fee",
  description: "Detects late-cancelled fitness sessions or classes with a documented cancellation fee that remains uncollected.",
  scope: "industry",
  industries: ["health_fitness"],
  requirements: {
    optionalFields: ["Customer Name","Project Name","Late Cancellation","Late Cancellation Fee Amount","Cancellation Status","Late Cancellation Fee Status","Cancellation Date"],
  },
  supports(profile) {
    return profile.industry === "health_fitness";
  },
  async detect(context: DetectorContext): Promise<DetectorResult> {
    const leaks: DetectedBusinessLeak[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    context.rows.forEach((row, rowIndex) => {
      if (!isEarned(row["Cancellation Status"])) return;
      if (isAlreadyBilled(row["Late Cancellation Fee Status"])) return;

      const amount = parseMoney(row["Late Cancellation Fee Amount"]);
      if (amount === null || amount <= 0) return;

      const item = cleanText(row["Late Cancellation"]);
      if (!item) return;

      const customerName = cleanText(row["Customer Name"]) || "Unknown Customer";
      const projectName = cleanText(row["Project Name"]);
      const eventDate = cleanText(row["Cancellation Date"]);
      const recovery = amount * 0.9;

      leaks.push({
        detectorId: "health-fitness.uncollected-late-cancellation-fee",
        leakType: "Uncollected Late Cancellation Fee",
        title: `${customerName} has a uncollected late cancellation fee`,
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
          status: cleanText(row["Cancellation Status"]),
          billingStatus: cleanText(row["Late Cancellation Fee Status"]),
          eventDate,
        },
        recommendedAction: `Review ${customerName}'s ${item} and collect the documented $${amount.toFixed(2)} amount.`,
        metadata: {
          industry: "health_fitness",
          revenueType: "late_cancellation_fee",
          detectionReason: "fitness_late_cancellation_fee_not_collected",
        },
      });
    });

    return {
      detectorId: "health-fitness.uncollected-late-cancellation-fee",
      ran: true,
      leaks,
      warnings,
      errors,
    };
  },
};
