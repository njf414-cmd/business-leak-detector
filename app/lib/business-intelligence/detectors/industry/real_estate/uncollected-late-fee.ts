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
  return ["due","assessed","applied","approved"].includes(normalizeText(value));
}

function isAlreadyBilled(value: unknown): boolean {
  return ["paid","collected","settled","waived"].includes(normalizeText(value));
}

export const uncollectedRealEstateLateFeeDetector: BusinessLeakDetector = {
  id: "real-estate.uncollected-late-fee",
  name: "Uncollected Late Fee",
  description: "Detects documented tenant late fees that became due but have not been collected.",
  scope: "industry",
  industries: ["real_estate"],
  requirements: {
    optionalFields: ["Customer Name","Project Name","Late Payment","Late Fee Amount","Late Fee Status","Late Fee Collection Status","Late Fee Date"],
  },
  supports(profile) {
    return profile.industry === "real_estate";
  },
  async detect(context: DetectorContext): Promise<DetectorResult> {
    const leaks: DetectedBusinessLeak[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    context.rows.forEach((row, rowIndex) => {
      if (!isEarned(row["Late Fee Status"])) return;
      if (isAlreadyBilled(row["Late Fee Collection Status"])) return;

      const amount = parseMoney(row["Late Fee Amount"]);
      if (amount === null || amount <= 0) return;

      const item = cleanText(row["Late Payment"]);
      if (!item) return;

      const customerName = cleanText(row["Customer Name"]) || "Unknown Customer";
      const projectName = cleanText(row["Project Name"]);
      const eventDate = cleanText(row["Late Fee Date"]);
      const recovery = amount * 0.9;

      leaks.push({
        detectorId: "real-estate.uncollected-late-fee",
        leakType: "Uncollected Late Fee",
        title: `${customerName} has a uncollected late fee`,
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
          status: cleanText(row["Late Fee Status"]),
          billingStatus: cleanText(row["Late Fee Collection Status"]),
          eventDate,
        },
        recommendedAction: `Review ${customerName}'s ${item} and invoice the documented $${amount.toFixed(2)} amount.`,
        metadata: {
          industry: "real_estate",
          revenueType: "late_fee",
          detectionReason: "late_fee_due_not_collected",
        },
      });
    });

    return {
      detectorId: "real-estate.uncollected-late-fee",
      ran: true,
      leaks,
      warnings,
      errors,
    };
  },
};
