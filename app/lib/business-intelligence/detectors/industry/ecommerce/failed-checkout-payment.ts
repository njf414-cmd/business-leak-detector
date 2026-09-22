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
  return ["paid","recovered","collected","completed"].includes(normalizeText(value));
}

export const failedCheckoutPaymentDetector: BusinessLeakDetector = {
  id: "ecommerce.failed-checkout-payment",
  name: "Failed Checkout Payment",
  description: "Detects failed checkout payment attempts with a documented order value that remains unrecovered.",
  scope: "industry",
  industries: ["ecommerce"],
  requirements: {
    optionalFields: ["Customer Name","Project Name","Checkout","Checkout Amount","Checkout Payment Status","Checkout Recovery Status","Checkout Date"],
  },
  supports(profile) {
    return profile.industry === "ecommerce";
  },
  async detect(context: DetectorContext): Promise<DetectorResult> {
    const leaks: DetectedBusinessLeak[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    context.rows.forEach((row, rowIndex) => {
      if (!isEarned(row["Checkout Payment Status"])) return;
      if (isAlreadyBilled(row["Checkout Recovery Status"])) return;

      const amount = parseMoney(row["Checkout Amount"]);
      if (amount === null || amount <= 0) return;

      const item = cleanText(row["Checkout"]);
      if (!item) return;

      const customerName = cleanText(row["Customer Name"]) || "Unknown Customer";
      const projectName = cleanText(row["Project Name"]);
      const eventDate = cleanText(row["Checkout Date"]);
      const recovery = amount * 0.9;

      leaks.push({
        detectorId: "ecommerce.failed-checkout-payment",
        leakType: "Failed Checkout Payment",
        title: `${customerName} has a failed checkout payment`,
        description: `${customerName}'s ${item}${projectName ? ` for ${projectName}` : ""} has an earned $${amount.toFixed(2)} amount that has not been billed.`,
        category: "Ecommerce Revenue",
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
          status: cleanText(row["Checkout Payment Status"]),
          billingStatus: cleanText(row["Checkout Recovery Status"]),
          eventDate,
        },
        recommendedAction: `Review ${customerName}'s ${item} and recover the documented $${amount.toFixed(2)} amount.`,
        metadata: {
          industry: "ecommerce",
          revenueType: "checkout_payment",
          detectionReason: "checkout_payment_failed_not_recovered",
        },
      });
    });

    return {
      detectorId: "ecommerce.failed-checkout-payment",
      ran: true,
      leaks,
      warnings,
      errors,
    };
  },
};
