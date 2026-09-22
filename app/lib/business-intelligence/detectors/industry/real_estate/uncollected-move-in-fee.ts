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
  return ["approved","scheduled","completed","moved in"].includes(normalizeText(value));
}

function isAlreadyBilled(value: unknown): boolean {
  return ["paid","collected","received","waived"].includes(normalizeText(value));
}

export const uncollectedMoveInFeeDetector: BusinessLeakDetector = {
  id: "real-estate.uncollected-move-in-fee",
  name: "Uncollected Move-In Fee",
  description: "Detects approved or completed tenant move-ins with documented move-in fees that have not been collected.",
  scope: "industry",
  industries: ["real_estate"],
  requirements: {
    optionalFields: ["Customer Name","Project Name","Move-In","Move-In Fee Amount","Move-In Status","Move-In Fee Status","Move-In Date"],
  },
  supports(profile) {
    return profile.industry === "real_estate";
  },
  async detect(context: DetectorContext): Promise<DetectorResult> {
    const leaks: DetectedBusinessLeak[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    context.rows.forEach((row, rowIndex) => {
      if (!isEarned(row["Move-In Status"])) return;
      if (isAlreadyBilled(row["Move-In Fee Status"])) return;

      const amount = parseMoney(row["Move-In Fee Amount"]);
      if (amount === null || amount <= 0) return;

      const item = cleanText(row["Move-In"]);
      if (!item) return;

      const customerName = cleanText(row["Customer Name"]) || "Unknown Customer";
      const projectName = cleanText(row["Project Name"]);
      const eventDate = cleanText(row["Move-In Date"]);
      const recovery = amount * 0.9;

      leaks.push({
        detectorId: "real-estate.uncollected-move-in-fee",
        leakType: "Uncollected Move-In Fee",
        title: `${customerName} has a uncollected move-in fee`,
        description: `${customerName}'s ${item}${projectName ? ` for ${projectName}` : ""} has an earned $${amount.toFixed(2)} amount that has not been billed.`,
        category: "Real Estate Billing",
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
          status: cleanText(row["Move-In Status"]),
          billingStatus: cleanText(row["Move-In Fee Status"]),
          eventDate,
        },
        recommendedAction: `Review ${customerName}'s ${item} and invoice the documented $${amount.toFixed(2)} amount.`,
        metadata: {
          industry: "real_estate",
          revenueType: "move_in_fee",
          detectionReason: "move_in_fee_due_not_collected",
        },
      });
    });

    return {
      detectorId: "real-estate.uncollected-move-in-fee",
      ran: true,
      leaks,
      warnings,
      errors,
    };
  },
};
