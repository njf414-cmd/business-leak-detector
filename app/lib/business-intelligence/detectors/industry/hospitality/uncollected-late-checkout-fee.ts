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
  return ["late checkout","extended","fee due","approved"].includes(normalizeText(value));
}

function isAlreadyBilled(value: unknown): boolean {
  return ["paid","collected","waived","settled"].includes(normalizeText(value));
}

export const uncollectedHospitalityLateCheckoutFeeDetector: BusinessLeakDetector = {
  id: "hospitality.uncollected-late-checkout-fee",
  name: "Uncollected Late Checkout Fee",
  description: "Detects documented uncollected late checkout fee opportunities where revenue is due or earned but has not been properly billed or collected.",
  scope: "industry",
  industries: ["hospitality"],
  requirements: {
    optionalFields: ["Customer Name","Project Name","Late Checkout","Late Checkout Fee","Checkout Status","Late Checkout Fee Status","Checkout Date"],
  },
  supports(profile) {
    return profile.industry === "hospitality";
  },
  async detect(context: DetectorContext): Promise<DetectorResult> {
    const leaks: DetectedBusinessLeak[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    context.rows.forEach((row, rowIndex) => {
      if (!isEarned(row["Checkout Status"])) return;
      if (isAlreadyBilled(row["Late Checkout Fee Status"])) return;

      const amount = parseMoney(row["Late Checkout Fee"]);
      if (amount === null || amount <= 0) return;

      const item = cleanText(row["Late Checkout"]);
      if (!item) return;

      const customerName = cleanText(row["Customer Name"]) || "Unknown Customer";
      const projectName = cleanText(row["Project Name"]);
      const eventDate = cleanText(row["Checkout Date"]);
      const recovery = amount * 0.9;

      leaks.push({
        detectorId: "hospitality.uncollected-late-checkout-fee",
        leakType: "Uncollected Late Checkout Fee",
        title: `${customerName} has a uncollected late checkout fee`,
        description: `${customerName}'s ${item}${projectName ? ` for ${projectName}` : ""} has an earned $${amount.toFixed(2)} amount that has not been billed.`,
        category: "Hospitality Billing",
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
          status: cleanText(row["Checkout Status"]),
          billingStatus: cleanText(row["Late Checkout Fee Status"]),
          eventDate,
        },
        recommendedAction: `Review ${customerName}'s ${item} and invoice the documented $${amount.toFixed(2)} amount.`,
        metadata: {
          industry: "hospitality",
          revenueType: "late_checkout_fee",
          detectionReason: "hospitality_late_checkout_fee_not_collected",
        },
      });
    });

    return {
      detectorId: "hospitality.uncollected-late-checkout-fee",
      ran: true,
      leaks,
      warnings,
      errors,
    };
  },
};
