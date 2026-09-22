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
  return ["registered","approved","confirmed","active"].includes(normalizeText(value));
}

function isAlreadyBilled(value: unknown): boolean {
  return ["paid","collected","received","waived"].includes(normalizeText(value));
}

export const uncollectedEducationRegistrationFeeDetector: BusinessLeakDetector = {
  id: "education.uncollected-registration-fee",
  name: "Uncollected Registration Fee",
  description: "Detects documented uncollected registration fee opportunities where revenue is due or earned but has not been properly billed or collected.",
  scope: "industry",
  industries: ["education"],
  requirements: {
    optionalFields: ["Customer Name","Project Name","Registration","Registration Fee","Registration Status","Registration Payment Status","Registration Date"],
  },
  supports(profile) {
    return profile.industry === "education";
  },
  async detect(context: DetectorContext): Promise<DetectorResult> {
    const leaks: DetectedBusinessLeak[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    context.rows.forEach((row, rowIndex) => {
      if (!isEarned(row["Registration Status"])) return;
      if (isAlreadyBilled(row["Registration Payment Status"])) return;

      const amount = parseMoney(row["Registration Fee"]);
      if (amount === null || amount <= 0) return;

      const item = cleanText(row["Registration"]);
      if (!item) return;

      const customerName = cleanText(row["Customer Name"]) || "Unknown Customer";
      const projectName = cleanText(row["Project Name"]);
      const eventDate = cleanText(row["Registration Date"]);
      const recovery = amount * 0.9;

      leaks.push({
        detectorId: "education.uncollected-registration-fee",
        leakType: "Uncollected Registration Fee",
        title: `${customerName} has a uncollected registration fee`,
        description: `${customerName}'s ${item}${projectName ? ` for ${projectName}` : ""} has an earned $${amount.toFixed(2)} amount that has not been billed.`,
        category: "Education Billing",
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
          status: cleanText(row["Registration Status"]),
          billingStatus: cleanText(row["Registration Payment Status"]),
          eventDate,
        },
        recommendedAction: `Review ${customerName}'s ${item} and invoice the documented $${amount.toFixed(2)} amount.`,
        metadata: {
          industry: "education",
          revenueType: "registration_fee",
          detectionReason: "education_registration_fee_not_collected",
        },
      });
    });

    return {
      detectorId: "education.uncollected-registration-fee",
      ran: true,
      leaks,
      warnings,
      errors,
    };
  },
};
