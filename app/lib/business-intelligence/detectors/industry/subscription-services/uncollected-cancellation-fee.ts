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
  return ["cancelled","canceled","terminated","closed"].includes(normalizeText(value));
}

function isAlreadyBilled(value: unknown): boolean {
  return ["paid","collected","waived","settled"].includes(normalizeText(value));
}

export const uncollectedSubscriptionCancellationFeeDetector: BusinessLeakDetector = {
  id: "subscription-services.uncollected-cancellation-fee",
  name: "Uncollected Subscription Cancellation Fee",
  description: "Detects subscription cancellations where a documented cancellation fee was earned but not collected.",
  scope: "industry",
  industries: ["subscription-services"],
  requirements: {
    optionalFields: ["Customer Name","Project Name","Subscription Cancellation","Cancellation Fee Amount","Cancellation Status","Cancellation Fee Status","Cancellation Date"],
  },
  supports(profile) {
    return profile.industry === "subscription-services";
  },
  async detect(context: DetectorContext): Promise<DetectorResult> {
    const leaks: DetectedBusinessLeak[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    context.rows.forEach((row, rowIndex) => {
      if (!isEarned(row["Cancellation Status"])) return;
      if (isAlreadyBilled(row["Cancellation Fee Status"])) return;

      const amount = parseMoney(row["Cancellation Fee Amount"]);
      if (amount === null || amount <= 0) return;

      const item = cleanText(row["Subscription Cancellation"]);
      if (!item) return;

      const customerName = cleanText(row["Customer Name"]) || "Unknown Customer";
      const projectName = cleanText(row["Project Name"]);
      const eventDate = cleanText(row["Cancellation Date"]);
      const recovery = amount * 0.9;

      leaks.push({
        detectorId: "subscription-services.uncollected-cancellation-fee",
        leakType: "Uncollected Subscription Cancellation Fee",
        title: `${customerName} has a uncollected subscription cancellation fee`,
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
          status: cleanText(row["Cancellation Status"]),
          billingStatus: cleanText(row["Cancellation Fee Status"]),
          eventDate,
        },
        recommendedAction: `Review ${customerName}'s ${item} and collect the documented $${amount.toFixed(2)} amount.`,
        metadata: {
          industry: "subscription-services",
          revenueType: "cancellation_fee",
          detectionReason: "subscription_cancelled_fee_not_collected",
        },
      });
    });

    return {
      detectorId: "subscription-services.uncollected-cancellation-fee",
      ran: true,
      leaks,
      warnings,
      errors,
    };
  },
};
