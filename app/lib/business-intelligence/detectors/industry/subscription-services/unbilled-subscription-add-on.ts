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
  return ["activated","active","added","approved"].includes(normalizeText(value));
}

function isAlreadyBilled(value: unknown): boolean {
  return ["billed","invoiced","paid","collected"].includes(normalizeText(value));
}

export const unbilledSubscriptionAddOnDetector: BusinessLeakDetector = {
  id: "subscription-services.unbilled-subscription-add-on",
  name: "Unbilled Subscription Add-On",
  description: "Detects activated subscription add-ons with a documented charge that has not been billed.",
  scope: "industry",
  industries: ["subscription-services"],
  requirements: {
    optionalFields: ["Customer Name","Project Name","Subscription Add-On","Subscription Add-On Amount","Subscription Add-On Status","Subscription Add-On Billing Status","Subscription Add-On Date"],
  },
  supports(profile) {
    return profile.industry === "subscription-services";
  },
  async detect(context: DetectorContext): Promise<DetectorResult> {
    const leaks: DetectedBusinessLeak[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    context.rows.forEach((row, rowIndex) => {
      if (!isEarned(row["Subscription Add-On Status"])) return;
      if (isAlreadyBilled(row["Subscription Add-On Billing Status"])) return;

      const amount = parseMoney(row["Subscription Add-On Amount"]);
      if (amount === null || amount <= 0) return;

      const item = cleanText(row["Subscription Add-On"]);
      if (!item) return;

      const customerName = cleanText(row["Customer Name"]) || "Unknown Customer";
      const projectName = cleanText(row["Project Name"]);
      const eventDate = cleanText(row["Subscription Add-On Date"]);
      const recovery = amount * 0.9;

      leaks.push({
        detectorId: "subscription-services.unbilled-subscription-add-on",
        leakType: "Unbilled Subscription Add-On",
        title: `${customerName} has a unbilled subscription add-on`,
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
          status: cleanText(row["Subscription Add-On Status"]),
          billingStatus: cleanText(row["Subscription Add-On Billing Status"]),
          eventDate,
        },
        recommendedAction: `Review ${customerName}'s ${item} and invoice the documented $${amount.toFixed(2)} amount.`,
        metadata: {
          industry: "subscription-services",
          revenueType: "subscription_add_on",
          detectionReason: "subscription_add_on_active_not_billed",
        },
      });
    });

    return {
      detectorId: "subscription-services.unbilled-subscription-add-on",
      ran: true,
      leaks,
      warnings,
      errors,
    };
  },
};
