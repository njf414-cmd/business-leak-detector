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
  return ["returned","processed","restocked","fee due"].includes(normalizeText(value));
}

function isAlreadyBilled(value: unknown): boolean {
  return ["paid","collected","waived","settled"].includes(normalizeText(value));
}

export const uncollectedRetailRestockingFeeDetector: BusinessLeakDetector = {
  id: "retail.uncollected-restocking-fee",
  name: "Uncollected Restocking Fee",
  description: "Detects documented uncollected restocking fee opportunities where revenue is due or earned but has not been properly billed or collected.",
  scope: "industry",
  industries: ["retail"],
  requirements: {
    optionalFields: ["Customer Name","Project Name","Return","Restocking Fee","Return Status","Restocking Fee Status","Return Date"],
  },
  supports(profile) {
    return profile.industry === "retail";
  },
  async detect(context: DetectorContext): Promise<DetectorResult> {
    const leaks: DetectedBusinessLeak[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    context.rows.forEach((row, rowIndex) => {
      if (!isEarned(row["Return Status"])) return;
      if (isAlreadyBilled(row["Restocking Fee Status"])) return;

      const amount = parseMoney(row["Restocking Fee"]);
      if (amount === null || amount <= 0) return;

      const item = cleanText(row["Return"]);
      if (!item) return;

      const customerName = cleanText(row["Customer Name"]) || "Unknown Customer";
      const projectName = cleanText(row["Project Name"]);
      const eventDate = cleanText(row["Return Date"]);
      const recovery = amount * 0.9;

      leaks.push({
        detectorId: "retail.uncollected-restocking-fee",
        leakType: "Uncollected Restocking Fee",
        title: `${customerName} has a uncollected restocking fee`,
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
          status: cleanText(row["Return Status"]),
          billingStatus: cleanText(row["Restocking Fee Status"]),
          eventDate,
        },
        recommendedAction: `Review ${customerName}'s ${item} and invoice the documented $${amount.toFixed(2)} amount.`,
        metadata: {
          industry: "retail",
          revenueType: "restocking_fee",
          detectionReason: "retail_restocking_fee_not_collected",
        },
      });
    });

    return {
      detectorId: "retail.uncollected-restocking-fee",
      ran: true,
      leaks,
      warnings,
      errors,
    };
  },
};
