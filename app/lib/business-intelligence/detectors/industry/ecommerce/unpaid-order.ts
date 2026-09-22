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
  return ["confirmed","completed","fulfilled","shipped"].includes(normalizeText(value));
}

function isAlreadyBilled(value: unknown): boolean {
  return ["paid","collected","settled"].includes(normalizeText(value));
}

export const unpaidOrderDetector: BusinessLeakDetector = {
  id: "ecommerce.unpaid-order",
  name: "Unpaid Order",
  description: "Detects completed or confirmed customer orders with a documented unpaid balance.",
  scope: "industry",
  industries: ["ecommerce"],
  requirements: {
    optionalFields: ["Customer Name","Project Name","Order","Order Balance","Order Status","Order Payment Status","Order Date"],
  },
  supports(profile) {
    return profile.industry === "ecommerce";
  },
  async detect(context: DetectorContext): Promise<DetectorResult> {
    const leaks: DetectedBusinessLeak[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    context.rows.forEach((row, rowIndex) => {
      if (!isEarned(row["Order Status"])) return;
      if (isAlreadyBilled(row["Order Payment Status"])) return;

      const amount = parseMoney(row["Order Balance"]);
      if (amount === null || amount <= 0) return;

      const item = cleanText(row["Order"]);
      if (!item) return;

      const customerName = cleanText(row["Customer Name"]) || "Unknown Customer";
      const projectName = cleanText(row["Project Name"]);
      const eventDate = cleanText(row["Order Date"]);
      const recovery = amount * 0.9;

      leaks.push({
        detectorId: "ecommerce.unpaid-order",
        leakType: "Unpaid Order",
        title: `${customerName} has a unpaid order`,
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
          status: cleanText(row["Order Status"]),
          billingStatus: cleanText(row["Order Payment Status"]),
          eventDate,
        },
        recommendedAction: `Review ${customerName}'s ${item} and collect the documented $${amount.toFixed(2)} amount.`,
        metadata: {
          industry: "ecommerce",
          revenueType: "order_payment",
          detectionReason: "order_completed_balance_unpaid",
        },
      });
    });

    return {
      detectorId: "ecommerce.unpaid-order",
      ran: true,
      leaks,
      warnings,
      errors,
    };
  },
};
