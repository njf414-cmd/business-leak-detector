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
  return ["approved","scheduled","booked","active"].includes(normalizeText(value));
}

function isAlreadyBilled(value: unknown): boolean {
  return ["paid","collected","received","waived"].includes(normalizeText(value));
}

export const uncollectedTreatmentDepositDetector: BusinessLeakDetector = {
  id: "healthcare.uncollected-treatment-deposit",
  name: "Uncollected Treatment Deposit",
  description: "Detects approved or scheduled treatments with a documented required deposit that remains uncollected.",
  scope: "industry",
  industries: ["healthcare"],
  requirements: {
    optionalFields: ["Customer Name","Project Name","Treatment","Treatment Deposit Amount","Treatment Status","Treatment Deposit Status","Treatment Date"],
  },
  supports(profile) {
    return profile.industry === "healthcare";
  },
  async detect(context: DetectorContext): Promise<DetectorResult> {
    const leaks: DetectedBusinessLeak[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    context.rows.forEach((row, rowIndex) => {
      if (!isEarned(row["Treatment Status"])) return;
      if (isAlreadyBilled(row["Treatment Deposit Status"])) return;

      const amount = parseMoney(row["Treatment Deposit Amount"]);
      if (amount === null || amount <= 0) return;

      const item = cleanText(row["Treatment"]);
      if (!item) return;

      const customerName = cleanText(row["Customer Name"]) || "Unknown Customer";
      const projectName = cleanText(row["Project Name"]);
      const eventDate = cleanText(row["Treatment Date"]);
      const recovery = amount * 0.9;

      leaks.push({
        detectorId: "healthcare.uncollected-treatment-deposit",
        leakType: "Uncollected Treatment Deposit",
        title: `${customerName} has a uncollected treatment deposit`,
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
          status: cleanText(row["Treatment Status"]),
          billingStatus: cleanText(row["Treatment Deposit Status"]),
          eventDate,
        },
        recommendedAction: `Review ${customerName}'s ${item} and collect the documented $${amount.toFixed(2)} amount.`,
        metadata: {
          industry: "healthcare",
          revenueType: "treatment_deposit",
          detectionReason: "treatment_approved_deposit_not_collected",
        },
      });
    });

    return {
      detectorId: "healthcare.uncollected-treatment-deposit",
      ran: true,
      leaks,
      warnings,
      errors,
    };
  },
};
