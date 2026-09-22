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
  return ["upgraded","activated","approved","active"].includes(normalizeText(value));
}

function isAlreadyBilled(value: unknown): boolean {
  return ["billed","invoiced","paid","collected"].includes(normalizeText(value));
}

export const unbilledSubscriptionUpgradeDetector: BusinessLeakDetector = {
  id: "subscription-services.unbilled-subscription-upgrade",
  name: "Unbilled Subscription Upgrade",
  description: "Detects subscription upgrades that were activated but whose documented upgrade amount has not been billed.",
  scope: "industry",
  industries: ["subscription-services"],
  requirements: {
    optionalFields: ["Customer Name","Project Name","Subscription Upgrade","Subscription Upgrade Amount","Subscription Upgrade Status","Subscription Upgrade Billing Status","Subscription Upgrade Date"],
  },
  supports(profile) {
    return profile.industry === "subscription-services";
  },
  async detect(context: DetectorContext): Promise<DetectorResult> {
    const leaks: DetectedBusinessLeak[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    context.rows.forEach((row, rowIndex) => {
      if (!isEarned(row["Subscription Upgrade Status"])) return;
      if (isAlreadyBilled(row["Subscription Upgrade Billing Status"])) return;

      const amount = parseMoney(row["Subscription Upgrade Amount"]);
      if (amount === null || amount <= 0) return;

      const item = cleanText(row["Subscription Upgrade"]);
      if (!item) return;

      const customerName = cleanText(row["Customer Name"]) || "Unknown Customer";
      const projectName = cleanText(row["Project Name"]);
      const eventDate = cleanText(row["Subscription Upgrade Date"]);
      const recovery = amount * 0.9;

      leaks.push({
        detectorId: "subscription-services.unbilled-subscription-upgrade",
        leakType: "Unbilled Subscription Upgrade",
        title: `${customerName} has a unbilled subscription upgrade`,
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
          status: cleanText(row["Subscription Upgrade Status"]),
          billingStatus: cleanText(row["Subscription Upgrade Billing Status"]),
          eventDate,
        },
        recommendedAction: `Review ${customerName}'s ${item} and invoice the documented $${amount.toFixed(2)} amount.`,
        metadata: {
          industry: "subscription-services",
          revenueType: "subscription_upgrade",
          detectionReason: "subscription_upgrade_activated_not_billed",
        },
      });
    });

    return {
      detectorId: "subscription-services.unbilled-subscription-upgrade",
      ran: true,
      leaks,
      warnings,
      errors,
    };
  },
};
