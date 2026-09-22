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
  return ["delivered","completed","fulfilled","shipped"].includes(normalizeText(value));
}

function isAlreadyBilled(value: unknown): boolean {
  return ["billed","invoiced","paid","collected"].includes(normalizeText(value));
}

export const unbilledRetailDeliveryFeeDetector: BusinessLeakDetector = {
  id: "retail.unbilled-delivery-fee",
  name: "Unbilled Delivery Fee",
  description: "Detects documented unbilled delivery fee opportunities where revenue is due or earned but has not been properly billed or collected.",
  scope: "industry",
  industries: ["retail"],
  requirements: {
    optionalFields: ["Customer Name","Project Name","Delivery","Delivery Fee","Delivery Status","Delivery Billing Status","Delivery Date"],
  },
  supports(profile) {
    return profile.industry === "retail";
  },
  async detect(context: DetectorContext): Promise<DetectorResult> {
    const leaks: DetectedBusinessLeak[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    context.rows.forEach((row, rowIndex) => {
      if (!isEarned(row["Delivery Status"])) return;
      if (isAlreadyBilled(row["Delivery Billing Status"])) return;

      const amount = parseMoney(row["Delivery Fee"]);
      if (amount === null || amount <= 0) return;

      const item = cleanText(row["Delivery"]);
      if (!item) return;

      const customerName = cleanText(row["Customer Name"]) || "Unknown Customer";
      const projectName = cleanText(row["Project Name"]);
      const eventDate = cleanText(row["Delivery Date"]);
      const recovery = amount * 0.9;

      leaks.push({
        detectorId: "retail.unbilled-delivery-fee",
        leakType: "Unbilled Delivery Fee",
        title: `${customerName} has a unbilled delivery fee`,
        description: `${customerName}'s ${item}${projectName ? ` for ${projectName}` : ""} has an earned $${amount.toFixed(2)} amount that has not been billed.`,
        category: "Retail Billing",
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
          status: cleanText(row["Delivery Status"]),
          billingStatus: cleanText(row["Delivery Billing Status"]),
          eventDate,
        },
        recommendedAction: `Review ${customerName}'s ${item} and invoice the documented $${amount.toFixed(2)} amount.`,
        metadata: {
          industry: "retail",
          revenueType: "delivery_fee",
          detectionReason: "retail_delivery_fee_not_billed",
        },
      });
    });

    return {
      detectorId: "retail.unbilled-delivery-fee",
      ran: true,
      leaks,
      warnings,
      errors,
    };
  },
};
