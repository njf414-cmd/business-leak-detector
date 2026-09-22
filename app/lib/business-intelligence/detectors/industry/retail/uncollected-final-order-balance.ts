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
  return ["completed","fulfilled","ready","closed"].includes(normalizeText(value));
}

function isAlreadyBilled(value: unknown): boolean {
  return ["paid","collected","settled","refunded"].includes(normalizeText(value));
}

export const uncollectedRetailFinalOrderBalanceDetector: BusinessLeakDetector = {
  id: "retail.uncollected-final-order-balance",
  name: "Uncollected Final Order Balance",
  description: "Detects documented uncollected final order balance opportunities where revenue is due or earned but has not been properly billed or collected.",
  scope: "industry",
  industries: ["retail"],
  requirements: {
    optionalFields: ["Customer Name","Project Name","Order","Final Order Balance","Order Status","Final Order Payment Status","Order Date"],
  },
  supports(profile) {
    return profile.industry === "retail";
  },
  async detect(context: DetectorContext): Promise<DetectorResult> {
    const leaks: DetectedBusinessLeak[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    context.rows.forEach((row, rowIndex) => {
      if (!isEarned(row["Order Status"])) return;
      if (isAlreadyBilled(row["Final Order Payment Status"])) return;

      const amount = parseMoney(row["Final Order Balance"]);
      if (amount === null || amount <= 0) return;

      const item = cleanText(row["Order"]);
      if (!item) return;

      const customerName = cleanText(row["Customer Name"]) || "Unknown Customer";
      const projectName = cleanText(row["Project Name"]);
      const eventDate = cleanText(row["Order Date"]);
      const recovery = amount * 0.9;

      leaks.push({
        detectorId: "retail.uncollected-final-order-balance",
        leakType: "Uncollected Final Order Balance",
        title: `${customerName} has a uncollected final order balance`,
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
          status: cleanText(row["Order Status"]),
          billingStatus: cleanText(row["Final Order Payment Status"]),
          eventDate,
        },
        recommendedAction: `Review ${customerName}'s ${item} and invoice the documented $${amount.toFixed(2)} amount.`,
        metadata: {
          industry: "retail",
          revenueType: "final_order_balance",
          detectionReason: "retail_final_order_balance_not_collected",
        },
      });
    });

    return {
      detectorId: "retail.uncollected-final-order-balance",
      ran: true,
      leaks,
      warnings,
      errors,
    };
  },
};
