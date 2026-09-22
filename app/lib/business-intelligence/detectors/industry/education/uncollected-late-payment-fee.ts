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
  return ["due","assessed","applied","past due"].includes(normalizeText(value));
}

function isAlreadyBilled(value: unknown): boolean {
  return ["paid","collected","waived","settled"].includes(normalizeText(value));
}

export const uncollectedEducationLatePaymentFeeDetector: BusinessLeakDetector = {
  id: "education.uncollected-late-payment-fee",
  name: "Uncollected Late Payment Fee",
  description: "Detects documented uncollected late payment fee opportunities where revenue is due or earned but has not been properly billed or collected.",
  scope: "industry",
  industries: ["education"],
  requirements: {
    optionalFields: ["Customer Name","Project Name","Late Payment","Late Payment Fee","Late Payment Status","Late Fee Payment Status","Assessment Date"],
  },
  supports(profile) {
    return profile.industry === "education";
  },
  async detect(context: DetectorContext): Promise<DetectorResult> {
    const leaks: DetectedBusinessLeak[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    context.rows.forEach((row, rowIndex) => {
      if (!isEarned(row["Late Payment Status"])) return;
      if (isAlreadyBilled(row["Late Fee Payment Status"])) return;

      const amount = parseMoney(row["Late Payment Fee"]);
      if (amount === null || amount <= 0) return;

      const item = cleanText(row["Late Payment"]);
      if (!item) return;

      const customerName = cleanText(row["Customer Name"]) || "Unknown Customer";
      const projectName = cleanText(row["Project Name"]);
      const eventDate = cleanText(row["Assessment Date"]);
      const recovery = amount * 0.9;

      leaks.push({
        detectorId: "education.uncollected-late-payment-fee",
        leakType: "Uncollected Late Payment Fee",
        title: `${customerName} has a uncollected late payment fee`,
        description: `${customerName}'s ${item}${projectName ? ` for ${projectName}` : ""} has an earned $${amount.toFixed(2)} amount that has not been billed.`,
        category: "Education Billing",
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
          status: cleanText(row["Late Payment Status"]),
          billingStatus: cleanText(row["Late Fee Payment Status"]),
          eventDate,
        },
        recommendedAction: `Review ${customerName}'s ${item} and invoice the documented $${amount.toFixed(2)} amount.`,
        metadata: {
          industry: "education",
          revenueType: "late_payment_fee",
          detectionReason: "education_late_payment_fee_not_collected",
        },
      });
    });

    return {
      detectorId: "education.uncollected-late-payment-fee",
      ran: true,
      leaks,
      warnings,
      errors,
    };
  },
};
