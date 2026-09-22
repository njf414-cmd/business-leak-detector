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
  return ["completed","launched","implemented","active"].includes(normalizeText(value));
}

function isAlreadyBilled(value: unknown): boolean {
  return ["paid","collected","received","waived"].includes(normalizeText(value));
}

export const uncollectedSoftwareImplementationFeeDetector: BusinessLeakDetector = {
  id: "software.uncollected-implementation-fee",
  name: "Uncollected Implementation Fee",
  description: "Detects documented uncollected implementation fee opportunities where revenue is due or earned but has not been properly billed or collected.",
  scope: "industry",
  industries: ["software"],
  requirements: {
    optionalFields: ["Customer Name","Project Name","Implementation","Implementation Fee","Implementation Status","Implementation Payment Status","Implementation Date"],
  },
  supports(profile) {
    return profile.industry === "software";
  },
  async detect(context: DetectorContext): Promise<DetectorResult> {
    const leaks: DetectedBusinessLeak[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    context.rows.forEach((row, rowIndex) => {
      if (!isEarned(row["Implementation Status"])) return;
      if (isAlreadyBilled(row["Implementation Payment Status"])) return;

      const amount = parseMoney(row["Implementation Fee"]);
      if (amount === null || amount <= 0) return;

      const item = cleanText(row["Implementation"]);
      if (!item) return;

      const customerName = cleanText(row["Customer Name"]) || "Unknown Customer";
      const projectName = cleanText(row["Project Name"]);
      const eventDate = cleanText(row["Implementation Date"]);
      const recovery = amount * 0.9;

      leaks.push({
        detectorId: "software.uncollected-implementation-fee",
        leakType: "Uncollected Implementation Fee",
        title: `${customerName} has a uncollected implementation fee`,
        description: `${customerName}'s ${item}${projectName ? ` for ${projectName}` : ""} has an earned $${amount.toFixed(2)} amount that has not been billed.`,
        category: "Software Billing",
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
          status: cleanText(row["Implementation Status"]),
          billingStatus: cleanText(row["Implementation Payment Status"]),
          eventDate,
        },
        recommendedAction: `Review ${customerName}'s ${item} and invoice the documented $${amount.toFixed(2)} amount.`,
        metadata: {
          industry: "software",
          revenueType: "implementation_fee",
          detectionReason: "software_implementation_fee_not_collected",
        },
      });
    });

    return {
      detectorId: "software.uncollected-implementation-fee",
      ran: true,
      leaks,
      warnings,
      errors,
    };
  },
};
