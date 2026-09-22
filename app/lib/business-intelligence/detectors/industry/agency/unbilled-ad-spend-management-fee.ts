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
  return ["managed","active","completed","delivered"].includes(normalizeText(value));
}

function isAlreadyBilled(value: unknown): boolean {
  return ["billed","invoiced","paid","collected"].includes(normalizeText(value));
}

export const unbilledAgencyAdSpendManagementFeeDetector: BusinessLeakDetector = {
  id: "agency.unbilled-ad-spend-management-fee",
  name: "Unbilled Ad Spend Management Fee",
  description: "Detects documented unbilled ad spend management fee opportunities where revenue is due or earned but has not been properly billed or collected.",
  scope: "industry",
  industries: ["agency"],
  requirements: {
    optionalFields: ["Customer Name","Project Name","Ad Management","Ad Management Fee","Ad Management Status","Ad Management Billing Status","Management Date"],
  },
  supports(profile) {
    return profile.industry === "agency";
  },
  async detect(context: DetectorContext): Promise<DetectorResult> {
    const leaks: DetectedBusinessLeak[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    context.rows.forEach((row, rowIndex) => {
      if (!isEarned(row["Ad Management Status"])) return;
      if (isAlreadyBilled(row["Ad Management Billing Status"])) return;

      const amount = parseMoney(row["Ad Management Fee"]);
      if (amount === null || amount <= 0) return;

      const item = cleanText(row["Ad Management"]);
      if (!item) return;

      const customerName = cleanText(row["Customer Name"]) || "Unknown Customer";
      const projectName = cleanText(row["Project Name"]);
      const eventDate = cleanText(row["Management Date"]);
      const recovery = amount * 0.9;

      leaks.push({
        detectorId: "agency.unbilled-ad-spend-management-fee",
        leakType: "Unbilled Ad Spend Management Fee",
        title: `${customerName} has a unbilled ad spend management fee`,
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
          status: cleanText(row["Ad Management Status"]),
          billingStatus: cleanText(row["Ad Management Billing Status"]),
          eventDate,
        },
        recommendedAction: `Review ${customerName}'s ${item} and invoice the documented $${amount.toFixed(2)} amount.`,
        metadata: {
          industry: "agency",
          revenueType: "ad_management_fee",
          detectionReason: "agency_ad_management_fee_not_billed",
        },
      });
    });

    return {
      detectorId: "agency.unbilled-ad-spend-management-fee",
      ran: true,
      leaks,
      warnings,
      errors,
    };
  },
};
