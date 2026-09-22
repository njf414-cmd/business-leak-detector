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
  return ["completed","complete","delivered","approved"].includes(normalizeText(value));
}

function isAlreadyBilled(value: unknown): boolean {
  return ["paid","collected","received","settled"].includes(normalizeText(value));
}

export const uncollectedProfessionalFinalPaymentDetector: BusinessLeakDetector = {
  id: "professional-services.uncollected-final-payment",
  name: "Uncollected Final Payment",
  description: "Detects completed professional engagements with a documented final payment that remains uncollected.",
  scope: "industry",
  industries: ["professional_services"],
  requirements: {
    optionalFields: ["Customer Name","Project Name","Final Payment","Final Payment Amount","Project Completion Status","Final Payment Status","Completion Date"],
  },
  supports(profile) {
    return profile.industry === "professional_services";
  },
  async detect(context: DetectorContext): Promise<DetectorResult> {
    const leaks: DetectedBusinessLeak[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    context.rows.forEach((row, rowIndex) => {
      if (!isEarned(row["Project Completion Status"])) return;
      if (isAlreadyBilled(row["Final Payment Status"])) return;

      const amount = parseMoney(row["Final Payment Amount"]);
      if (amount === null || amount <= 0) return;

      const item = cleanText(row["Final Payment"]);
      if (!item) return;

      const customerName = cleanText(row["Customer Name"]) || "Unknown Customer";
      const projectName = cleanText(row["Project Name"]);
      const eventDate = cleanText(row["Completion Date"]);
      const recovery = amount * 0.9;

      leaks.push({
        detectorId: "professional-services.uncollected-final-payment",
        leakType: "Uncollected Final Payment",
        title: `${customerName} has a uncollected final payment`,
        description: `${customerName}'s ${item}${projectName ? ` for ${projectName}` : ""} has an earned $${amount.toFixed(2)} amount that has not been billed.`,
        category: "Professional Services Billing",
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
          status: cleanText(row["Project Completion Status"]),
          billingStatus: cleanText(row["Final Payment Status"]),
          eventDate,
        },
        recommendedAction: `Review ${customerName}'s ${item} and collect the documented $${amount.toFixed(2)} amount.`,
        metadata: {
          industry: "professional_services",
          revenueType: "final_payment",
          detectionReason: "project_completed_final_payment_not_collected",
        },
      });
    });

    return {
      detectorId: "professional-services.uncollected-final-payment",
      ran: true,
      leaks,
      warnings,
      errors,
    };
  },
};
