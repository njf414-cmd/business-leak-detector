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
  return ["reactivated","activated","restored","active"].includes(normalizeText(value));
}

function isAlreadyBilled(value: unknown): boolean {
  return ["billed","invoiced","paid","collected"].includes(normalizeText(value));
}

export const unbilledReactivationFeeDetector: BusinessLeakDetector = {
  id: "subscription-services.unbilled-reactivation-fee",
  name: "Unbilled Reactivation Fee",
  description: "Detects reactivated subscriptions or memberships with a documented reactivation fee that has not been billed.",
  scope: "industry",
  industries: ["subscription-services"],
  requirements: {
    optionalFields: ["Customer Name","Project Name","Reactivation","Reactivation Fee Amount","Reactivation Status","Reactivation Billing Status","Reactivation Date"],
  },
  supports(profile) {
    return profile.industry === "subscription-services";
  },
  async detect(context: DetectorContext): Promise<DetectorResult> {
    const leaks: DetectedBusinessLeak[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    context.rows.forEach((row, rowIndex) => {
      if (!isEarned(row["Reactivation Status"])) return;
      if (isAlreadyBilled(row["Reactivation Billing Status"])) return;

      const amount = parseMoney(row["Reactivation Fee Amount"]);
      if (amount === null || amount <= 0) return;

      const item = cleanText(row["Reactivation"]);
      if (!item) return;

      const customerName = cleanText(row["Customer Name"]) || "Unknown Customer";
      const projectName = cleanText(row["Project Name"]);
      const eventDate = cleanText(row["Reactivation Date"]);
      const recovery = amount * 0.9;

      leaks.push({
        detectorId: "subscription-services.unbilled-reactivation-fee",
        leakType: "Unbilled Reactivation Fee",
        title: `${customerName} has a unbilled reactivation fee`,
        description: `${customerName}'s ${item}${projectName ? ` for ${projectName}` : ""} has an earned $${amount.toFixed(2)} amount that has not been billed.`,
        category: "Subscription Billing",
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
          status: cleanText(row["Reactivation Status"]),
          billingStatus: cleanText(row["Reactivation Billing Status"]),
          eventDate,
        },
        recommendedAction: `Review ${customerName}'s ${item} and invoice the documented $${amount.toFixed(2)} amount.`,
        metadata: {
          industry: "subscription-services",
          revenueType: "reactivation_fee",
          detectionReason: "subscription_reactivated_fee_not_billed",
        },
      });
    });

    return {
      detectorId: "subscription-services.unbilled-reactivation-fee",
      ran: true,
      leaks,
      warnings,
      errors,
    };
  },
};
