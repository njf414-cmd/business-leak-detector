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
  return ["active","enrolled","attending","payment due"].includes(normalizeText(value));
}

function isAlreadyBilled(value: unknown): boolean {
  return ["paid","collected","settled","waived"].includes(normalizeText(value));
}

export const uncollectedEducationTuitionBalanceDetector: BusinessLeakDetector = {
  id: "education.uncollected-tuition-balance",
  name: "Uncollected Tuition Balance",
  description: "Detects documented uncollected tuition balance opportunities where revenue is due or earned but has not been properly billed or collected.",
  scope: "industry",
  industries: ["education"],
  requirements: {
    optionalFields: ["Customer Name","Project Name","Student Account","Tuition Balance","Enrollment Status","Tuition Payment Status","Tuition Due Date"],
  },
  supports(profile) {
    return profile.industry === "education";
  },
  async detect(context: DetectorContext): Promise<DetectorResult> {
    const leaks: DetectedBusinessLeak[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    context.rows.forEach((row, rowIndex) => {
      if (!isEarned(row["Enrollment Status"])) return;
      if (isAlreadyBilled(row["Tuition Payment Status"])) return;

      const amount = parseMoney(row["Tuition Balance"]);
      if (amount === null || amount <= 0) return;

      const item = cleanText(row["Student Account"]);
      if (!item) return;

      const customerName = cleanText(row["Customer Name"]) || "Unknown Customer";
      const projectName = cleanText(row["Project Name"]);
      const eventDate = cleanText(row["Tuition Due Date"]);
      const recovery = amount * 0.9;

      leaks.push({
        detectorId: "education.uncollected-tuition-balance",
        leakType: "Uncollected Tuition Balance",
        title: `${customerName} has a uncollected tuition balance`,
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
          status: cleanText(row["Enrollment Status"]),
          billingStatus: cleanText(row["Tuition Payment Status"]),
          eventDate,
        },
        recommendedAction: `Review ${customerName}'s ${item} and invoice the documented $${amount.toFixed(2)} amount.`,
        metadata: {
          industry: "education",
          revenueType: "tuition_balance",
          detectionReason: "education_tuition_balance_not_collected",
        },
      });
    });

    return {
      detectorId: "education.uncollected-tuition-balance",
      ran: true,
      leaks,
      warnings,
      errors,
    };
  },
};
