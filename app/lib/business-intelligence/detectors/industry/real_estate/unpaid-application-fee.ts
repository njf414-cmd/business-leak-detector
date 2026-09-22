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
  return ["approved","processed","accepted","fee due"].includes(normalizeText(value));
}

function isAlreadyBilled(value: unknown): boolean {
  return ["paid","collected","received","waived"].includes(normalizeText(value));
}

export const unpaidApplicationFeeDetector: BusinessLeakDetector = {
  id: "real-estate.unpaid-application-fee",
  name: "Unpaid Application Fee",
  description: "Detects documented real estate application fees that became due but have not been collected.",
  scope: "industry",
  industries: ["real_estate"],
  requirements: {
    optionalFields: ["Customer Name","Project Name","Application","Application Fee","Application Status","Application Fee Status","Application Date"],
  },
  supports(profile) {
    return profile.industry === "real_estate";
  },
  async detect(context: DetectorContext): Promise<DetectorResult> {
    const leaks: DetectedBusinessLeak[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    context.rows.forEach((row, rowIndex) => {
      if (!isEarned(row["Application Status"])) return;
      if (isAlreadyBilled(row["Application Fee Status"])) return;

      const amount = parseMoney(row["Application Fee"]);
      if (amount === null || amount <= 0) return;

      const item = cleanText(row["Application"]);
      if (!item) return;

      const customerName = cleanText(row["Customer Name"]) || "Unknown Customer";
      const projectName = cleanText(row["Project Name"]);
      const eventDate = cleanText(row["Application Date"]);
      const recovery = amount * 0.9;

      leaks.push({
        detectorId: "real-estate.unpaid-application-fee",
        leakType: "Unpaid Application Fee",
        title: `${customerName} has a unpaid application fee`,
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
          status: cleanText(row["Application Status"]),
          billingStatus: cleanText(row["Application Fee Status"]),
          eventDate,
        },
        recommendedAction: `Review ${customerName}'s ${item} and invoice the documented $${amount.toFixed(2)} amount.`,
        metadata: {
          industry: "real_estate",
          revenueType: "application_fee",
          detectionReason: "application_fee_due_not_collected",
        },
      });
    });

    return {
      detectorId: "real-estate.unpaid-application-fee",
      ran: true,
      leaks,
      warnings,
      errors,
    };
  },
};
