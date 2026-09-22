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
  return ["abandoned","left checkout","checkout abandoned","not completed"].includes(normalizeText(value));
}

function isAlreadyBilled(value: unknown): boolean {
  return ["recovered","purchased","converted","paid"].includes(normalizeText(value));
}

export const abandonedCartDetector: BusinessLeakDetector = {
  id: "ecommerce.abandoned-cart",
  name: "Abandoned Cart",
  description: "Detects abandoned shopping carts with a documented recoverable cart value.",
  scope: "industry",
  industries: ["ecommerce"],
  requirements: {
    optionalFields: ["Customer Name","Project Name","Cart","Cart Value","Cart Status","Cart Recovery Status","Cart Abandoned Date"],
  },
  supports(profile) {
    return profile.industry === "ecommerce";
  },
  async detect(context: DetectorContext): Promise<DetectorResult> {
    const leaks: DetectedBusinessLeak[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    context.rows.forEach((row, rowIndex) => {
      if (!isEarned(row["Cart Status"])) return;
      if (isAlreadyBilled(row["Cart Recovery Status"])) return;

      const amount = parseMoney(row["Cart Value"]);
      if (amount === null || amount <= 0) return;

      const item = cleanText(row["Cart"]);
      if (!item) return;

      const customerName = cleanText(row["Customer Name"]) || "Unknown Customer";
      const projectName = cleanText(row["Project Name"]);
      const eventDate = cleanText(row["Cart Abandoned Date"]);
      const recovery = amount * 0.9;

      leaks.push({
        detectorId: "ecommerce.abandoned-cart",
        leakType: "Abandoned Cart",
        title: `${customerName} has a abandoned cart`,
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
          status: cleanText(row["Cart Status"]),
          billingStatus: cleanText(row["Cart Recovery Status"]),
          eventDate,
        },
        recommendedAction: `Review ${customerName}'s ${item} and recover the documented $${amount.toFixed(2)} amount.`,
        metadata: {
          industry: "ecommerce",
          revenueType: "abandoned_cart",
          detectionReason: "cart_abandoned_not_recovered",
        },
      });
    });

    return {
      detectorId: "ecommerce.abandoned-cart",
      ran: true,
      leaks,
      warnings,
      errors,
    };
  },
};
