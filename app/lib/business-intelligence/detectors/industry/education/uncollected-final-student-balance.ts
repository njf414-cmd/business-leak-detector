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
  return ["completed","graduated","withdrawn","closed"].includes(normalizeText(value));
}

function isAlreadyBilled(value: unknown): boolean {
  return ["paid","collected","settled","waived"].includes(normalizeText(value));
}

export const uncollectedEducationFinalStudentBalanceDetector: BusinessLeakDetector = {
  id: "education.uncollected-final-student-balance",
  name: "Uncollected Final Student Balance",
  description: "Detects documented uncollected final student balance opportunities where revenue is due or earned but has not been properly billed or collected.",
  scope: "industry",
  industries: ["education"],
  requirements: {
    optionalFields: ["Customer Name","Project Name","Student Account","Final Student Balance","Program Status","Final Student Payment Status","Program End Date"],
  },
  supports(profile) {
    return profile.industry === "education";
  },
  async detect(context: DetectorContext): Promise<DetectorResult> {
    const leaks: DetectedBusinessLeak[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    context.rows.forEach((row, rowIndex) => {
      if (!isEarned(row["Program Status"])) return;
      if (isAlreadyBilled(row["Final Student Payment Status"])) return;

      const amount = parseMoney(row["Final Student Balance"]);
      if (amount === null || amount <= 0) return;

      const item = cleanText(row["Student Account"]);
      if (!item) return;

      const customerName = cleanText(row["Customer Name"]) || "Unknown Customer";
      const projectName = cleanText(row["Project Name"]);
      const eventDate = cleanText(row["Program End Date"]);
      const recovery = amount * 0.9;

      leaks.push({
        detectorId: "education.uncollected-final-student-balance",
        leakType: "Uncollected Final Student Balance",
        title: `${customerName} has a uncollected final student balance`,
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
          status: cleanText(row["Program Status"]),
          billingStatus: cleanText(row["Final Student Payment Status"]),
          eventDate,
        },
        recommendedAction: `Review ${customerName}'s ${item} and invoice the documented $${amount.toFixed(2)} amount.`,
        metadata: {
          industry: "education",
          revenueType: "final_student_balance",
          detectionReason: "education_final_student_balance_not_collected",
        },
      });
    });

    return {
      detectorId: "education.uncollected-final-student-balance",
      ran: true,
      leaks,
      warnings,
      errors,
    };
  },
};
