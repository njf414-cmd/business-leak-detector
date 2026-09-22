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
  return ["no show","missed","absent","did not attend"].includes(normalizeText(value));
}

function isAlreadyBilled(value: unknown): boolean {
  return ["paid","collected","waived","settled"].includes(normalizeText(value));
}

export const uncollectedBeautyNoShowFeeDetector: BusinessLeakDetector = {
  id: "beauty.uncollected-no-show-fee",
  name: "Uncollected No-Show Fee",
  description: "Detects documented uncollected no-show fee opportunities where revenue is due or earned but has not been properly billed or collected.",
  scope: "industry",
  industries: ["beauty"],
  requirements: {
    optionalFields: ["Customer Name","Project Name","No-Show Appointment","No-Show Fee Amount","Appointment Status","No-Show Fee Status","Appointment Date"],
  },
  supports(profile) {
    return profile.industry === "beauty";
  },
  async detect(context: DetectorContext): Promise<DetectorResult> {
    const leaks: DetectedBusinessLeak[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    context.rows.forEach((row, rowIndex) => {
      if (!isEarned(row["Appointment Status"])) return;
      if (isAlreadyBilled(row["No-Show Fee Status"])) return;

      const amount = parseMoney(row["No-Show Fee Amount"]);
      if (amount === null || amount <= 0) return;

      const item = cleanText(row["No-Show Appointment"]);
      if (!item) return;

      const customerName = cleanText(row["Customer Name"]) || "Unknown Customer";
      const projectName = cleanText(row["Project Name"]);
      const eventDate = cleanText(row["Appointment Date"]);
      const recovery = amount * 0.9;

      leaks.push({
        detectorId: "beauty.uncollected-no-show-fee",
        leakType: "Uncollected No-Show Fee",
        title: `${customerName} has a uncollected no-show fee`,
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
          status: cleanText(row["Appointment Status"]),
          billingStatus: cleanText(row["No-Show Fee Status"]),
          eventDate,
        },
        recommendedAction: `Review ${customerName}'s ${item} and invoice the documented $${amount.toFixed(2)} amount.`,
        metadata: {
          industry: "beauty",
          revenueType: "no_show_fee",
          detectionReason: "beauty_no_show_fee_not_collected",
        },
      });
    });

    return {
      detectorId: "beauty.uncollected-no-show-fee",
      ran: true,
      leaks,
      warnings,
      errors,
    };
  },
};
