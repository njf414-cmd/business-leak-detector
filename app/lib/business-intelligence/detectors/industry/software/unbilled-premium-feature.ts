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
  return ["enabled","activated","active","added"].includes(normalizeText(value));
}

function isAlreadyBilled(value: unknown): boolean {
  return ["billed","invoiced","paid","collected"].includes(normalizeText(value));
}

export const unbilledSoftwarePremiumFeatureDetector: BusinessLeakDetector = {
  id: "software.unbilled-premium-feature",
  name: "Unbilled Premium Feature",
  description: "Detects documented unbilled premium feature opportunities where revenue is due or earned but has not been properly billed or collected.",
  scope: "industry",
  industries: ["software"],
  requirements: {
    optionalFields: ["Customer Name","Project Name","Premium Feature","Premium Feature Amount","Feature Status","Premium Feature Billing Status","Activation Date"],
  },
  supports(profile) {
    return profile.industry === "software";
  },
  async detect(context: DetectorContext): Promise<DetectorResult> {
    const leaks: DetectedBusinessLeak[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    context.rows.forEach((row, rowIndex) => {
      if (!isEarned(row["Feature Status"])) return;
      if (isAlreadyBilled(row["Premium Feature Billing Status"])) return;

      const amount = parseMoney(row["Premium Feature Amount"]);
      if (amount === null || amount <= 0) return;

      const item = cleanText(row["Premium Feature"]);
      if (!item) return;

      const customerName = cleanText(row["Customer Name"]) || "Unknown Customer";
      const projectName = cleanText(row["Project Name"]);
      const eventDate = cleanText(row["Activation Date"]);
      const recovery = amount * 0.9;

      leaks.push({
        detectorId: "software.unbilled-premium-feature",
        leakType: "Unbilled Premium Feature",
        title: `${customerName} has a unbilled premium feature`,
        description: `${customerName}'s ${item}${projectName ? ` for ${projectName}` : ""} has an earned $${amount.toFixed(2)} amount that has not been billed.`,
        category: "Software Billing",
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
          status: cleanText(row["Feature Status"]),
          billingStatus: cleanText(row["Premium Feature Billing Status"]),
          eventDate,
        },
        recommendedAction: `Review ${customerName}'s ${item} and invoice the documented $${amount.toFixed(2)} amount.`,
        metadata: {
          industry: "software",
          revenueType: "premium_feature",
          detectionReason: "software_premium_feature_not_billed",
        },
      });
    });

    return {
      detectorId: "software.unbilled-premium-feature",
      ran: true,
      leaks,
      warnings,
      errors,
    };
  },
};
