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
  return ["active","due","renewed","service active"].includes(normalizeText(value));
}

function isAlreadyBilled(value: unknown): boolean {
  return ["paid","collected","received","settled"].includes(normalizeText(value));
}

export const uncollectedAgencyRetainerPaymentDetector: BusinessLeakDetector = {
  id: "agency.uncollected-retainer-payment",
  name: "Uncollected Retainer Payment",
  description: "Detects documented uncollected retainer payment opportunities where revenue is due or earned but has not been properly billed or collected.",
  scope: "industry",
  industries: ["agency"],
  requirements: {
    optionalFields: ["Customer Name","Project Name","Retainer","Retainer Amount","Retainer Status","Retainer Payment Status","Retainer Due Date"],
  },
  supports(profile) {
    return profile.industry === "agency";
  },
  async detect(context: DetectorContext): Promise<DetectorResult> {
    const leaks: DetectedBusinessLeak[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    context.rows.forEach((row, rowIndex) => {
      if (!isEarned(row["Retainer Status"])) return;
      if (isAlreadyBilled(row["Retainer Payment Status"])) return;

      const amount = parseMoney(row["Retainer Amount"]);
      if (amount === null || amount <= 0) return;

      const item = cleanText(row["Retainer"]);
      if (!item) return;

      const customerName = cleanText(row["Customer Name"]) || "Unknown Customer";
      const projectName = cleanText(row["Project Name"]);
      const eventDate = cleanText(row["Retainer Due Date"]);
      const recovery = amount * 0.9;

      leaks.push({
        detectorId: "agency.uncollected-retainer-payment",
        leakType: "Uncollected Retainer Payment",
        title: `${customerName} has a uncollected retainer payment`,
        description: `${customerName}'s ${item}${projectName ? ` for ${projectName}` : ""} has an earned $${amount.toFixed(2)} amount that has not been billed.`,
        category: "Agency Billing",
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
          status: cleanText(row["Retainer Status"]),
          billingStatus: cleanText(row["Retainer Payment Status"]),
          eventDate,
        },
        recommendedAction: `Review ${customerName}'s ${item} and invoice the documented $${amount.toFixed(2)} amount.`,
        metadata: {
          industry: "agency",
          revenueType: "retainer_payment",
          detectionReason: "agency_retainer_payment_not_collected",
        },
      });
    });

    return {
      detectorId: "agency.uncollected-retainer-payment",
      ran: true,
      leaks,
      warnings,
      errors,
    };
  },
};
