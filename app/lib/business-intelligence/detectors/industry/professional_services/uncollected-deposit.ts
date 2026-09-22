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
  return ["approved","started","scheduled","active"].includes(normalizeText(value));
}

function isAlreadyBilled(value: unknown): boolean {
  return ["paid","collected","received","waived"].includes(normalizeText(value));
}

export const uncollectedProfessionalDepositDetector: BusinessLeakDetector = {
  id: "professional-services.uncollected-deposit",
  name: "Uncollected Deposit",
  description: "Detects approved or started professional engagements with a documented required deposit that remains uncollected.",
  scope: "industry",
  industries: ["professional_services"],
  requirements: {
    optionalFields: ["Customer Name","Project Name","Engagement Deposit","Deposit Amount","Engagement Status","Deposit Status","Engagement Date"],
  },
  supports(profile) {
    return profile.industry === "professional_services";
  },
  async detect(context: DetectorContext): Promise<DetectorResult> {
    const leaks: DetectedBusinessLeak[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    context.rows.forEach((row, rowIndex) => {
      if (!isEarned(row["Engagement Status"])) return;
      if (isAlreadyBilled(row["Deposit Status"])) return;

      const amount = parseMoney(row["Deposit Amount"]);
      if (amount === null || amount <= 0) return;

      const item = cleanText(row["Engagement Deposit"]);
      if (!item) return;

      const customerName = cleanText(row["Customer Name"]) || "Unknown Customer";
      const projectName = cleanText(row["Project Name"]);
      const eventDate = cleanText(row["Engagement Date"]);
      const recovery = amount * 0.9;

      leaks.push({
        detectorId: "professional-services.uncollected-deposit",
        leakType: "Uncollected Deposit",
        title: `${customerName} has a uncollected deposit`,
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
          status: cleanText(row["Engagement Status"]),
          billingStatus: cleanText(row["Deposit Status"]),
          eventDate,
        },
        recommendedAction: `Review ${customerName}'s ${item} and collect the documented $${amount.toFixed(2)} amount.`,
        metadata: {
          industry: "professional_services",
          revenueType: "engagement_deposit",
          detectionReason: "engagement_started_deposit_not_collected",
        },
      });
    });

    return {
      detectorId: "professional-services.uncollected-deposit",
      ran: true,
      leaks,
      warnings,
      errors,
    };
  },
};
