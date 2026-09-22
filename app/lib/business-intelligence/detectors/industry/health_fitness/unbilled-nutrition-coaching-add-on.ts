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
  return ["provided","completed","performed","active"].includes(normalizeText(value));
}

function isAlreadyBilled(value: unknown): boolean {
  return ["billed","invoiced","paid","collected"].includes(normalizeText(value));
}

export const unbilledNutritionCoachingAddOnDetector: BusinessLeakDetector = {
  id: "health-fitness.unbilled-nutrition-coaching-add-on",
  name: "Unbilled Nutrition Coaching Add-On",
  description: "Detects provided nutrition coaching add-ons with a documented charge that has not been billed.",
  scope: "industry",
  industries: ["health_fitness"],
  requirements: {
    optionalFields: ["Customer Name","Project Name","Nutrition Coaching Add-On","Nutrition Coaching Amount","Nutrition Coaching Status","Nutrition Coaching Billing Status","Coaching Date"],
  },
  supports(profile) {
    return profile.industry === "health_fitness";
  },
  async detect(context: DetectorContext): Promise<DetectorResult> {
    const leaks: DetectedBusinessLeak[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    context.rows.forEach((row, rowIndex) => {
      if (!isEarned(row["Nutrition Coaching Status"])) return;
      if (isAlreadyBilled(row["Nutrition Coaching Billing Status"])) return;

      const amount = parseMoney(row["Nutrition Coaching Amount"]);
      if (amount === null || amount <= 0) return;

      const item = cleanText(row["Nutrition Coaching Add-On"]);
      if (!item) return;

      const customerName = cleanText(row["Customer Name"]) || "Unknown Customer";
      const projectName = cleanText(row["Project Name"]);
      const eventDate = cleanText(row["Coaching Date"]);
      const recovery = amount * 0.9;

      leaks.push({
        detectorId: "health-fitness.unbilled-nutrition-coaching-add-on",
        leakType: "Unbilled Nutrition Coaching Add-On",
        title: `${customerName} has a unbilled nutrition coaching add-on`,
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
          status: cleanText(row["Nutrition Coaching Status"]),
          billingStatus: cleanText(row["Nutrition Coaching Billing Status"]),
          eventDate,
        },
        recommendedAction: `Review ${customerName}'s ${item} and invoice the documented $${amount.toFixed(2)} amount.`,
        metadata: {
          industry: "health_fitness",
          revenueType: "nutrition_coaching_add_on",
          detectionReason: "nutrition_coaching_provided_not_billed",
        },
      });
    });

    return {
      detectorId: "health-fitness.unbilled-nutrition-coaching-add-on",
      ran: true,
      leaks,
      warnings,
      errors,
    };
  },
};
