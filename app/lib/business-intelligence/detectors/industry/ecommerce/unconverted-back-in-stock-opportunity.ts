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
  return ["back in stock","available","restocked","ready"].includes(normalizeText(value));
}

function isAlreadyBilled(value: unknown): boolean {
  return ["converted","purchased","ordered","paid"].includes(normalizeText(value));
}

export const unconvertedBackInStockOpportunityDetector: BusinessLeakDetector = {
  id: "ecommerce.unconverted-back-in-stock-opportunity",
  name: "Unconverted Back-In-Stock Opportunity",
  description: "Detects customers who expressed demand for an out-of-stock product that is now available but have not converted.",
  scope: "industry",
  industries: ["ecommerce"],
  requirements: {
    optionalFields: ["Customer Name","Project Name","Back In Stock Product","Opportunity Amount","Back In Stock Status","Conversion Status","Back In Stock Date"],
  },
  supports(profile) {
    return profile.industry === "ecommerce";
  },
  async detect(context: DetectorContext): Promise<DetectorResult> {
    const leaks: DetectedBusinessLeak[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    context.rows.forEach((row, rowIndex) => {
      if (!isEarned(row["Back In Stock Status"])) return;
      if (isAlreadyBilled(row["Conversion Status"])) return;

      const amount = parseMoney(row["Opportunity Amount"]);
      if (amount === null || amount <= 0) return;

      const item = cleanText(row["Back In Stock Product"]);
      if (!item) return;

      const customerName = cleanText(row["Customer Name"]) || "Unknown Customer";
      const projectName = cleanText(row["Project Name"]);
      const eventDate = cleanText(row["Back In Stock Date"]);
      const recovery = amount * 0.9;

      leaks.push({
        detectorId: "ecommerce.unconverted-back-in-stock-opportunity",
        leakType: "Unconverted Back-In-Stock Opportunity",
        title: `${customerName} has a unconverted back-in-stock opportunity`,
        description: `${customerName}'s ${item}${projectName ? ` for ${projectName}` : ""} has an earned $${amount.toFixed(2)} amount that has not been billed.`,
        category: "Ecommerce Opportunity",
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
          status: cleanText(row["Back In Stock Status"]),
          billingStatus: cleanText(row["Conversion Status"]),
          eventDate,
        },
        recommendedAction: `Review ${customerName}'s ${item} and recover the documented $${amount.toFixed(2)} amount.`,
        metadata: {
          industry: "ecommerce",
          revenueType: "back_in_stock_opportunity",
          detectionReason: "product_restocked_customer_not_converted",
        },
      });
    });

    return {
      detectorId: "ecommerce.unconverted-back-in-stock-opportunity",
      ran: true,
      leaks,
      warnings,
      errors,
    };
  },
};
