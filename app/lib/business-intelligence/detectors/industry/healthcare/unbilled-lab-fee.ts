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
  return ["completed","processed","performed","resulted"].includes(normalizeText(value));
}

function isAlreadyBilled(value: unknown): boolean {
  return ["billed","invoiced","paid","collected"].includes(normalizeText(value));
}

export const unbilledHealthcareLabFeeDetector: BusinessLeakDetector = {
  id: "healthcare.unbilled-lab-fee",
  name: "Unbilled Lab Fee",
  description: "Detects completed or processed lab work with a documented lab fee that has not been billed.",
  scope: "industry",
  industries: ["healthcare"],
  requirements: {
    optionalFields: ["Customer Name","Project Name","Lab Work","Lab Fee Amount","Lab Status","Lab Billing Status","Lab Date"],
  },
  supports(profile) {
    return profile.industry === "healthcare";
  },
  async detect(context: DetectorContext): Promise<DetectorResult> {
    const leaks: DetectedBusinessLeak[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    context.rows.forEach((row, rowIndex) => {
      if (!isEarned(row["Lab Status"])) return;
      if (isAlreadyBilled(row["Lab Billing Status"])) return;

      const amount = parseMoney(row["Lab Fee Amount"]);
      if (amount === null || amount <= 0) return;

      const item = cleanText(row["Lab Work"]);
      if (!item) return;

      const customerName = cleanText(row["Customer Name"]) || "Unknown Customer";
      const projectName = cleanText(row["Project Name"]);
      const eventDate = cleanText(row["Lab Date"]);
      const recovery = amount * 0.9;

      leaks.push({
        detectorId: "healthcare.unbilled-lab-fee",
        leakType: "Unbilled Lab Fee",
        title: `${customerName} has a unbilled lab fee`,
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
          status: cleanText(row["Lab Status"]),
          billingStatus: cleanText(row["Lab Billing Status"]),
          eventDate,
        },
        recommendedAction: `Review ${customerName}'s ${item} and invoice the documented $${amount.toFixed(2)} amount.`,
        metadata: {
          industry: "healthcare",
          revenueType: "lab_fee",
          detectionReason: "lab_completed_fee_not_billed",
        },
      });
    });

    return {
      detectorId: "healthcare.unbilled-lab-fee",
      ran: true,
      leaks,
      warnings,
      errors,
    };
  },
};
