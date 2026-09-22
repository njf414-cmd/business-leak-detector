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
  return ["past due","overdue","delinquent","payment due"].includes(normalizeText(value));
}

function isAlreadyBilled(value: unknown): boolean {
  return ["paid","collected","settled","resolved"].includes(normalizeText(value));
}

export const pastDueSubscriptionDetector: BusinessLeakDetector = {
  id: "subscription-services.past-due-subscription",
  name: "Past-Due Subscription",
  description: "Detects past-due subscription balances that remain outstanding.",
  scope: "industry",
  industries: ["subscription-services"],
  requirements: {
    optionalFields: ["Customer Name","Project Name","Subscription","Past Due Amount","Subscription Status","Past Due Collection Status","Past Due Date"],
  },
  supports(profile) {
    return profile.industry === "subscription-services";
  },
  async detect(context: DetectorContext): Promise<DetectorResult> {
    const leaks: DetectedBusinessLeak[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    context.rows.forEach((row, rowIndex) => {
      if (!isEarned(row["Subscription Status"])) return;
      if (isAlreadyBilled(row["Past Due Collection Status"])) return;

      const amount = parseMoney(row["Past Due Amount"]);
      if (amount === null || amount <= 0) return;

      const item = cleanText(row["Subscription"]);
      if (!item) return;

      const customerName = cleanText(row["Customer Name"]) || "Unknown Customer";
      const projectName = cleanText(row["Project Name"]);
      const eventDate = cleanText(row["Past Due Date"]);
      const recovery = amount * 0.9;

      leaks.push({
        detectorId: "subscription-services.past-due-subscription",
        leakType: "Past-Due Subscription",
        title: `${customerName} has a past-due subscription`,
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
          status: cleanText(row["Subscription Status"]),
          billingStatus: cleanText(row["Past Due Collection Status"]),
          eventDate,
        },
        recommendedAction: `Review ${customerName}'s ${item} and collect the documented $${amount.toFixed(2)} amount.`,
        metadata: {
          industry: "subscription-services",
          revenueType: "past_due_subscription",
          detectionReason: "subscription_past_due_not_collected",
        },
      });
    });

    return {
      detectorId: "subscription-services.past-due-subscription",
      ran: true,
      leaks,
      warnings,
      errors,
    };
  },
};
