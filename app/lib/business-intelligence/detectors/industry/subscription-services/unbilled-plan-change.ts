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
  return ["completed","changed","approved","active"].includes(normalizeText(value));
}

function isAlreadyBilled(value: unknown): boolean {
  return ["billed","invoiced","paid","collected"].includes(normalizeText(value));
}

export const unbilledPlanChangeDetector: BusinessLeakDetector = {
  id: "subscription-services.unbilled-plan-change",
  name: "Unbilled Plan Change",
  description: "Detects billable subscription plan changes that were completed without billing the documented plan-change amount.",
  scope: "industry",
  industries: ["subscription-services"],
  requirements: {
    optionalFields: ["Customer Name","Project Name","Plan Change","Plan Change Amount","Plan Change Status","Plan Change Billing Status","Plan Change Date"],
  },
  supports(profile) {
    return profile.industry === "subscription-services";
  },
  async detect(context: DetectorContext): Promise<DetectorResult> {
    const leaks: DetectedBusinessLeak[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    context.rows.forEach((row, rowIndex) => {
      if (!isEarned(row["Plan Change Status"])) return;
      if (isAlreadyBilled(row["Plan Change Billing Status"])) return;

      const amount = parseMoney(row["Plan Change Amount"]);
      if (amount === null || amount <= 0) return;

      const item = cleanText(row["Plan Change"]);
      if (!item) return;

      const customerName = cleanText(row["Customer Name"]) || "Unknown Customer";
      const projectName = cleanText(row["Project Name"]);
      const eventDate = cleanText(row["Plan Change Date"]);
      const recovery = amount * 0.9;

      leaks.push({
        detectorId: "subscription-services.unbilled-plan-change",
        leakType: "Unbilled Plan Change",
        title: `${customerName} has a unbilled plan change`,
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
          status: cleanText(row["Plan Change Status"]),
          billingStatus: cleanText(row["Plan Change Billing Status"]),
          eventDate,
        },
        recommendedAction: `Review ${customerName}'s ${item} and invoice the documented $${amount.toFixed(2)} amount.`,
        metadata: {
          industry: "subscription-services",
          revenueType: "plan_change",
          detectionReason: "plan_change_completed_not_billed",
        },
      });
    });

    return {
      detectorId: "subscription-services.unbilled-plan-change",
      ran: true,
      leaks,
      warnings,
      errors,
    };
  },
};
