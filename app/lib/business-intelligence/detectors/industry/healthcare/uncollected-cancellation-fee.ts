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
  return ["cancelled","canceled","late cancellation","fee due"].includes(normalizeText(value));
}

function isAlreadyBilled(value: unknown): boolean {
  return ["paid","collected","waived","settled"].includes(normalizeText(value));
}

export const uncollectedHealthcareCancellationFeeDetector: BusinessLeakDetector = {
  id: "healthcare.uncollected-cancellation-fee",
  name: "Uncollected Cancellation Fee",
  description: "Detects cancelled healthcare appointments or procedures with a documented cancellation fee that remains uncollected.",
  scope: "industry",
  industries: ["healthcare"],
  requirements: {
    optionalFields: ["Customer Name","Project Name","Cancelled Appointment","Cancellation Fee Amount","Cancellation Status","Cancellation Fee Status","Cancellation Date"],
  },
  supports(profile) {
    return profile.industry === "healthcare";
  },
  async detect(context: DetectorContext): Promise<DetectorResult> {
    const leaks: DetectedBusinessLeak[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    context.rows.forEach((row, rowIndex) => {
      if (!isEarned(row["Cancellation Status"])) return;
      if (isAlreadyBilled(row["Cancellation Fee Status"])) return;

      const amount = parseMoney(row["Cancellation Fee Amount"]);
      if (amount === null || amount <= 0) return;

      const item = cleanText(row["Cancelled Appointment"]);
      if (!item) return;

      const customerName = cleanText(row["Customer Name"]) || "Unknown Customer";
      const projectName = cleanText(row["Project Name"]);
      const eventDate = cleanText(row["Cancellation Date"]);
      const recovery = amount * 0.9;

      leaks.push({
        detectorId: "healthcare.uncollected-cancellation-fee",
        leakType: "Uncollected Cancellation Fee",
        title: `${customerName} has a uncollected cancellation fee`,
        description: `${customerName}'s ${item}${projectName ? ` for ${projectName}` : ""} has an earned $${amount.toFixed(2)} amount that has not been billed.`,
        category: "Healthcare Billing",
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
          status: cleanText(row["Cancellation Status"]),
          billingStatus: cleanText(row["Cancellation Fee Status"]),
          eventDate,
        },
        recommendedAction: `Review ${customerName}'s ${item} and collect the documented $${amount.toFixed(2)} amount.`,
        metadata: {
          industry: "healthcare",
          revenueType: "cancellation_fee",
          detectionReason: "healthcare_cancellation_fee_not_collected",
        },
      });
    });

    return {
      detectorId: "healthcare.uncollected-cancellation-fee",
      ran: true,
      leaks,
      warnings,
      errors,
    };
  },
};
