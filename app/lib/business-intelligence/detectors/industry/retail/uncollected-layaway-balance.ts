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
  return ["due","ready","completed","pickup ready"].includes(normalizeText(value));
}

function isAlreadyBilled(value: unknown): boolean {
  return ["paid","collected","settled","cancelled"].includes(normalizeText(value));
}

export const uncollectedRetailLayawayBalanceDetector: BusinessLeakDetector = {
  id: "retail.uncollected-layaway-balance",
  name: "Uncollected Layaway Balance",
  description: "Detects documented uncollected layaway balance opportunities where revenue is due or earned but has not been properly billed or collected.",
  scope: "industry",
  industries: ["retail"],
  requirements: {
    optionalFields: ["Customer Name","Project Name","Layaway","Layaway Balance","Layaway Status","Layaway Payment Status","Due Date"],
  },
  supports(profile) {
    return profile.industry === "retail";
  },
  async detect(context: DetectorContext): Promise<DetectorResult> {
    const leaks: DetectedBusinessLeak[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    context.rows.forEach((row, rowIndex) => {
      if (!isEarned(row["Layaway Status"])) return;
      if (isAlreadyBilled(row["Layaway Payment Status"])) return;

      const amount = parseMoney(row["Layaway Balance"]);
      if (amount === null || amount <= 0) return;

      const item = cleanText(row["Layaway"]);
      if (!item) return;

      const customerName = cleanText(row["Customer Name"]) || "Unknown Customer";
      const projectName = cleanText(row["Project Name"]);
      const eventDate = cleanText(row["Due Date"]);
      const recovery = amount * 0.9;

      leaks.push({
        detectorId: "retail.uncollected-layaway-balance",
        leakType: "Uncollected Layaway Balance",
        title: `${customerName} has a uncollected layaway balance`,
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
          status: cleanText(row["Layaway Status"]),
          billingStatus: cleanText(row["Layaway Payment Status"]),
          eventDate,
        },
        recommendedAction: `Review ${customerName}'s ${item} and invoice the documented $${amount.toFixed(2)} amount.`,
        metadata: {
          industry: "retail",
          revenueType: "layaway_balance",
          detectionReason: "retail_layaway_balance_not_collected",
        },
      });
    });

    return {
      detectorId: "retail.uncollected-layaway-balance",
      ran: true,
      leaks,
      warnings,
      errors,
    };
  },
};
