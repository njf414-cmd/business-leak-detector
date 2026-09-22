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
  return ["completed","finished","closed","finalized"].includes(normalizeText(value));
}

function isAlreadyBilled(value: unknown): boolean {
  return ["paid","collected","settled","waived"].includes(normalizeText(value));
}

export const uncollectedBeautyFinalClientBalanceDetector: BusinessLeakDetector = {
  id: "beauty.uncollected-final-client-balance",
  name: "Uncollected Final Client Balance",
  description: "Detects documented uncollected final client balance opportunities where revenue is due or earned but has not been properly billed or collected.",
  scope: "industry",
  industries: ["beauty"],
  requirements: {
    optionalFields: ["Customer Name","Project Name","Client Account","Final Client Balance","Service Completion Status","Final Balance Status","Completion Date"],
  },
  supports(profile) {
    return profile.industry === "beauty";
  },
  async detect(context: DetectorContext): Promise<DetectorResult> {
    const leaks: DetectedBusinessLeak[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    context.rows.forEach((row, rowIndex) => {
      if (!isEarned(row["Service Completion Status"])) return;
      if (isAlreadyBilled(row["Final Balance Status"])) return;

      const amount = parseMoney(row["Final Client Balance"]);
      if (amount === null || amount <= 0) return;

      const item = cleanText(row["Client Account"]);
      if (!item) return;

      const customerName = cleanText(row["Customer Name"]) || "Unknown Customer";
      const projectName = cleanText(row["Project Name"]);
      const eventDate = cleanText(row["Completion Date"]);
      const recovery = amount * 0.9;

      leaks.push({
        detectorId: "beauty.uncollected-final-client-balance",
        leakType: "Uncollected Final Client Balance",
        title: `${customerName} has a uncollected final client balance`,
        description: `${customerName}'s ${item}${projectName ? ` for ${projectName}` : ""} has an earned $${amount.toFixed(2)} amount that has not been billed.`,
        category: "Beauty Billing",
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
          status: cleanText(row["Service Completion Status"]),
          billingStatus: cleanText(row["Final Balance Status"]),
          eventDate,
        },
        recommendedAction: `Review ${customerName}'s ${item} and invoice the documented $${amount.toFixed(2)} amount.`,
        metadata: {
          industry: "beauty",
          revenueType: "final_client_balance",
          detectionReason: "beauty_final_client_balance_not_collected",
        },
      });
    });

    return {
      detectorId: "beauty.uncollected-final-client-balance",
      ran: true,
      leaks,
      warnings,
      errors,
    };
  },
};
