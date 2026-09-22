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
  return ["completed","attended","performed","delivered"].includes(normalizeText(value));
}

function isAlreadyBilled(value: unknown): boolean {
  return ["billed","invoiced","paid","collected"].includes(normalizeText(value));
}

export const unbilledAgencyStrategySessionDetector: BusinessLeakDetector = {
  id: "agency.unbilled-strategy-session",
  name: "Unbilled Strategy Session",
  description: "Detects documented unbilled strategy session opportunities where revenue is due or earned but has not been properly billed or collected.",
  scope: "industry",
  industries: ["agency"],
  requirements: {
    optionalFields: ["Customer Name","Project Name","Strategy Session","Strategy Session Fee","Strategy Session Status","Strategy Session Billing Status","Session Date"],
  },
  supports(profile) {
    return profile.industry === "agency";
  },
  async detect(context: DetectorContext): Promise<DetectorResult> {
    const leaks: DetectedBusinessLeak[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    context.rows.forEach((row, rowIndex) => {
      if (!isEarned(row["Strategy Session Status"])) return;
      if (isAlreadyBilled(row["Strategy Session Billing Status"])) return;

      const amount = parseMoney(row["Strategy Session Fee"]);
      if (amount === null || amount <= 0) return;

      const item = cleanText(row["Strategy Session"]);
      if (!item) return;

      const customerName = cleanText(row["Customer Name"]) || "Unknown Customer";
      const projectName = cleanText(row["Project Name"]);
      const eventDate = cleanText(row["Session Date"]);
      const recovery = amount * 0.9;

      leaks.push({
        detectorId: "agency.unbilled-strategy-session",
        leakType: "Unbilled Strategy Session",
        title: `${customerName} has a unbilled strategy session`,
        description: `${customerName}'s ${item}${projectName ? ` for ${projectName}` : ""} has an earned $${amount.toFixed(2)} amount that has not been billed.`,
        category: "Agency Billing",
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
          status: cleanText(row["Strategy Session Status"]),
          billingStatus: cleanText(row["Strategy Session Billing Status"]),
          eventDate,
        },
        recommendedAction: `Review ${customerName}'s ${item} and invoice the documented $${amount.toFixed(2)} amount.`,
        metadata: {
          industry: "agency",
          revenueType: "strategy_session",
          detectionReason: "agency_strategy_session_not_billed",
        },
      });
    });

    return {
      detectorId: "agency.unbilled-strategy-session",
      ran: true,
      leaks,
      warnings,
      errors,
    };
  },
};
