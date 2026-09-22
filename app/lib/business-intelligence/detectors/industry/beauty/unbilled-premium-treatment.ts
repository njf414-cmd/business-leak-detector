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
  return ["completed","performed","provided","finished"].includes(normalizeText(value));
}

function isAlreadyBilled(value: unknown): boolean {
  return ["billed","invoiced","paid","collected"].includes(normalizeText(value));
}

export const unbilledBeautyPremiumTreatmentDetector: BusinessLeakDetector = {
  id: "beauty.unbilled-premium-treatment",
  name: "Unbilled Premium Treatment",
  description: "Detects documented unbilled premium treatment opportunities where revenue is due or earned but has not been properly billed or collected.",
  scope: "industry",
  industries: ["beauty"],
  requirements: {
    optionalFields: ["Customer Name","Project Name","Premium Treatment","Premium Treatment Amount","Treatment Status","Treatment Billing Status","Treatment Date"],
  },
  supports(profile) {
    return profile.industry === "beauty";
  },
  async detect(context: DetectorContext): Promise<DetectorResult> {
    const leaks: DetectedBusinessLeak[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    context.rows.forEach((row, rowIndex) => {
      if (!isEarned(row["Treatment Status"])) return;
      if (isAlreadyBilled(row["Treatment Billing Status"])) return;

      const amount = parseMoney(row["Premium Treatment Amount"]);
      if (amount === null || amount <= 0) return;

      const item = cleanText(row["Premium Treatment"]);
      if (!item) return;

      const customerName = cleanText(row["Customer Name"]) || "Unknown Customer";
      const projectName = cleanText(row["Project Name"]);
      const eventDate = cleanText(row["Treatment Date"]);
      const recovery = amount * 0.9;

      leaks.push({
        detectorId: "beauty.unbilled-premium-treatment",
        leakType: "Unbilled Premium Treatment",
        title: `${customerName} has a unbilled premium treatment`,
        description: `${customerName}'s ${item}${projectName ? ` for ${projectName}` : ""} has an earned $${amount.toFixed(2)} amount that has not been billed.`,
        category: "Beauty Billing",
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
          status: cleanText(row["Treatment Status"]),
          billingStatus: cleanText(row["Treatment Billing Status"]),
          eventDate,
        },
        recommendedAction: `Review ${customerName}'s ${item} and invoice the documented $${amount.toFixed(2)} amount.`,
        metadata: {
          industry: "beauty",
          revenueType: "premium_treatment",
          detectionReason: "beauty_premium_treatment_not_billed",
        },
      });
    });

    return {
      detectorId: "beauty.unbilled-premium-treatment",
      ran: true,
      leaks,
      warnings,
      errors,
    };
  },
};
