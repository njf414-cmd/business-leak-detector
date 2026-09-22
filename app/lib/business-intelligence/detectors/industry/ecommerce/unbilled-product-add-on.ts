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
  return ["sold","added","fulfilled","delivered"].includes(normalizeText(value));
}

function isAlreadyBilled(value: unknown): boolean {
  return ["billed","paid","collected","included"].includes(normalizeText(value));
}

export const unbilledEcommerceProductAddOnDetector: BusinessLeakDetector = {
  id: "ecommerce.unbilled-product-add-on",
  name: "Unbilled Product Add-On",
  description: "Detects sold product add-ons with a documented add-on amount that has not been billed.",
  scope: "industry",
  industries: ["ecommerce"],
  requirements: {
    optionalFields: ["Customer Name","Project Name","Product Add-On","Product Add-On Amount","Product Add-On Status","Product Add-On Billing Status","Order Date"],
  },
  supports(profile) {
    return profile.industry === "ecommerce";
  },
  async detect(context: DetectorContext): Promise<DetectorResult> {
    const leaks: DetectedBusinessLeak[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    context.rows.forEach((row, rowIndex) => {
      if (!isEarned(row["Product Add-On Status"])) return;
      if (isAlreadyBilled(row["Product Add-On Billing Status"])) return;

      const amount = parseMoney(row["Product Add-On Amount"]);
      if (amount === null || amount <= 0) return;

      const item = cleanText(row["Product Add-On"]);
      if (!item) return;

      const customerName = cleanText(row["Customer Name"]) || "Unknown Customer";
      const projectName = cleanText(row["Project Name"]);
      const eventDate = cleanText(row["Order Date"]);
      const recovery = amount * 0.9;

      leaks.push({
        detectorId: "ecommerce.unbilled-product-add-on",
        leakType: "Unbilled Product Add-On",
        title: `${customerName} has a unbilled product add-on`,
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
          status: cleanText(row["Product Add-On Status"]),
          billingStatus: cleanText(row["Product Add-On Billing Status"]),
          eventDate,
        },
        recommendedAction: `Review ${customerName}'s ${item} and invoice the documented $${amount.toFixed(2)} amount.`,
        metadata: {
          industry: "ecommerce",
          revenueType: "product_add_on",
          detectionReason: "product_add_on_sold_not_billed",
        },
      });
    });

    return {
      detectorId: "ecommerce.unbilled-product-add-on",
      ran: true,
      leaks,
      warnings,
      errors,
    };
  },
};
