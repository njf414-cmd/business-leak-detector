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
  return ["active","activated","provided","approved"].includes(normalizeText(value));
}

function isAlreadyBilled(value: unknown): boolean {
  return ["billed","invoiced","paid","collected"].includes(normalizeText(value));
}

export const unbilledFitnessPremiumAmenityFeeDetector: BusinessLeakDetector = {
  id: "health-fitness.unbilled-premium-amenity-fee",
  name: "Unbilled Premium Amenity Fee",
  description: "Detects activated premium fitness amenities with a documented fee that has not been billed.",
  scope: "industry",
  industries: ["health_fitness"],
  requirements: {
    optionalFields: ["Customer Name","Project Name","Premium Amenity","Premium Amenity Fee","Premium Amenity Status","Premium Amenity Billing Status","Amenity Start Date"],
  },
  supports(profile) {
    return profile.industry === "health_fitness";
  },
  async detect(context: DetectorContext): Promise<DetectorResult> {
    const leaks: DetectedBusinessLeak[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    context.rows.forEach((row, rowIndex) => {
      if (!isEarned(row["Premium Amenity Status"])) return;
      if (isAlreadyBilled(row["Premium Amenity Billing Status"])) return;

      const amount = parseMoney(row["Premium Amenity Fee"]);
      if (amount === null || amount <= 0) return;

      const item = cleanText(row["Premium Amenity"]);
      if (!item) return;

      const customerName = cleanText(row["Customer Name"]) || "Unknown Customer";
      const projectName = cleanText(row["Project Name"]);
      const eventDate = cleanText(row["Amenity Start Date"]);
      const recovery = amount * 0.9;

      leaks.push({
        detectorId: "health-fitness.unbilled-premium-amenity-fee",
        leakType: "Unbilled Premium Amenity Fee",
        title: `${customerName} has a unbilled premium amenity fee`,
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
          status: cleanText(row["Premium Amenity Status"]),
          billingStatus: cleanText(row["Premium Amenity Billing Status"]),
          eventDate,
        },
        recommendedAction: `Review ${customerName}'s ${item} and invoice the documented $${amount.toFixed(2)} amount.`,
        metadata: {
          industry: "health_fitness",
          revenueType: "premium_amenity_fee",
          detectionReason: "premium_amenity_active_not_billed",
        },
      });
    });

    return {
      detectorId: "health-fitness.unbilled-premium-amenity-fee",
      ran: true,
      leaks,
      warnings,
      errors,
    };
  },
};
