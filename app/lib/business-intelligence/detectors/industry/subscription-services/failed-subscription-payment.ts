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
  return ["failed","declined","payment failed","retry needed"].includes(normalizeText(value));
}

function isAlreadyBilled(value: unknown): boolean {
  return ["paid","collected","recovered","settled"].includes(normalizeText(value));
}

export const failedSubscriptionPaymentDetector: BusinessLeakDetector = {
  id: "subscription-services.failed-subscription-payment",
  name: "Failed Subscription Payment",
  description: "Detects failed recurring subscription payments with a documented amount that remains uncollected.",
  scope: "industry",
  industries: ["subscription-services"],
  requirements: {
    optionalFields: ["Customer Name","Project Name","Subscription","Subscription Payment Amount","Subscription Payment Status","Subscription Collection Status","Payment Attempt Date"],
  },
  supports(profile) {
    return profile.industry === "subscription-services";
  },
  async detect(context: DetectorContext): Promise<DetectorResult> {
    const leaks: DetectedBusinessLeak[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    context.rows.forEach((row, rowIndex) => {
      if (!isEarned(row["Subscription Payment Status"])) return;
      if (isAlreadyBilled(row["Subscription Collection Status"])) return;

      const amount = parseMoney(row["Subscription Payment Amount"]);
      if (amount === null || amount <= 0) return;

      const item = cleanText(row["Subscription"]);
      if (!item) return;

      const customerName = cleanText(row["Customer Name"]) || "Unknown Customer";
      const projectName = cleanText(row["Project Name"]);
      const eventDate = cleanText(row["Payment Attempt Date"]);
      const recovery = amount * 0.9;

      leaks.push({
        detectorId: "subscription-services.failed-subscription-payment",
        leakType: "Failed Subscription Payment",
        title: `${customerName} has a failed subscription payment`,
        description: `${customerName}'s ${item}${projectName ? ` for ${projectName}` : ""} has an earned $${amount.toFixed(2)} amount that has not been billed.`,
        category: "Subscription Revenue",
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
          status: cleanText(row["Subscription Payment Status"]),
          billingStatus: cleanText(row["Subscription Collection Status"]),
          eventDate,
        },
        recommendedAction: `Review ${customerName}'s ${item} and recover the documented $${amount.toFixed(2)} amount.`,
        metadata: {
          industry: "subscription-services",
          revenueType: "subscription_payment",
          detectionReason: "failed_subscription_payment_not_collected",
        },
      });
    });

    return {
      detectorId: "subscription-services.failed-subscription-payment",
      ran: true,
      leaks,
      warnings,
      errors,
    };
  },
};
