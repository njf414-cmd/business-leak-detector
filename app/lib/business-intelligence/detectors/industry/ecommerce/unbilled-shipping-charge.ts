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
  return ["shipped","fulfilled","delivered","completed"].includes(normalizeText(value));
}

function isAlreadyBilled(value: unknown): boolean {
  return ["billed","paid","collected","included"].includes(normalizeText(value));
}

export const unbilledShippingChargeDetector: BusinessLeakDetector = {
  id: "ecommerce.unbilled-shipping-charge",
  name: "Unbilled Shipping Charge",
  description: "Detects shipped orders with a documented shipping charge that was not billed.",
  scope: "industry",
  industries: ["ecommerce"],
  requirements: {
    optionalFields: ["Customer Name","Project Name","Shipment","Shipping Charge","Shipment Status","Shipping Billing Status","Shipment Date"],
  },
  supports(profile) {
    return profile.industry === "ecommerce";
  },
  async detect(context: DetectorContext): Promise<DetectorResult> {
    const leaks: DetectedBusinessLeak[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    context.rows.forEach((row, rowIndex) => {
      if (!isEarned(row["Shipment Status"])) return;
      if (isAlreadyBilled(row["Shipping Billing Status"])) return;

      const amount = parseMoney(row["Shipping Charge"]);
      if (amount === null || amount <= 0) return;

      const item = cleanText(row["Shipment"]);
      if (!item) return;

      const customerName = cleanText(row["Customer Name"]) || "Unknown Customer";
      const projectName = cleanText(row["Project Name"]);
      const eventDate = cleanText(row["Shipment Date"]);
      const recovery = amount * 0.9;

      leaks.push({
        detectorId: "ecommerce.unbilled-shipping-charge",
        leakType: "Unbilled Shipping Charge",
        title: `${customerName} has a unbilled shipping charge`,
        description: `${customerName}'s ${item}${projectName ? ` for ${projectName}` : ""} has an earned $${amount.toFixed(2)} amount that has not been billed.`,
        category: "Ecommerce Billing",
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
          status: cleanText(row["Shipment Status"]),
          billingStatus: cleanText(row["Shipping Billing Status"]),
          eventDate,
        },
        recommendedAction: `Review ${customerName}'s ${item} and invoice the documented $${amount.toFixed(2)} amount.`,
        metadata: {
          industry: "ecommerce",
          revenueType: "shipping_charge",
          detectionReason: "shipment_completed_shipping_not_billed",
        },
      });
    });

    return {
      detectorId: "ecommerce.unbilled-shipping-charge",
      ran: true,
      leaks,
      warnings,
      errors,
    };
  },
};
