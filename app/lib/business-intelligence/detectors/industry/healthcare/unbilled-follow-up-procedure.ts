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
  return ["completed","performed","provided","approved"].includes(normalizeText(value));
}

function isAlreadyBilled(value: unknown): boolean {
  return ["billed","invoiced","paid","collected"].includes(normalizeText(value));
}

export const unbilledFollowUpProcedureDetector: BusinessLeakDetector = {
  id: "healthcare.unbilled-follow-up-procedure",
  name: "Unbilled Follow-Up Procedure",
  description: "Detects completed billable follow-up procedures with a documented amount that has not been billed.",
  scope: "industry",
  industries: ["healthcare"],
  requirements: {
    optionalFields: ["Customer Name","Project Name","Follow-Up Procedure","Follow-Up Procedure Amount","Follow-Up Procedure Status","Follow-Up Procedure Billing Status","Follow-Up Date"],
  },
  supports(profile) {
    return profile.industry === "healthcare";
  },
  async detect(context: DetectorContext): Promise<DetectorResult> {
    const leaks: DetectedBusinessLeak[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    context.rows.forEach((row, rowIndex) => {
      if (!isEarned(row["Follow-Up Procedure Status"])) return;
      if (isAlreadyBilled(row["Follow-Up Procedure Billing Status"])) return;

      const amount = parseMoney(row["Follow-Up Procedure Amount"]);
      if (amount === null || amount <= 0) return;

      const item = cleanText(row["Follow-Up Procedure"]);
      if (!item) return;

      const customerName = cleanText(row["Customer Name"]) || "Unknown Customer";
      const projectName = cleanText(row["Project Name"]);
      const eventDate = cleanText(row["Follow-Up Date"]);
      const recovery = amount * 0.9;

      leaks.push({
        detectorId: "healthcare.unbilled-follow-up-procedure",
        leakType: "Unbilled Follow-Up Procedure",
        title: `${customerName} has a unbilled follow-up procedure`,
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
          status: cleanText(row["Follow-Up Procedure Status"]),
          billingStatus: cleanText(row["Follow-Up Procedure Billing Status"]),
          eventDate,
        },
        recommendedAction: `Review ${customerName}'s ${item} and invoice the documented $${amount.toFixed(2)} amount.`,
        metadata: {
          industry: "healthcare",
          revenueType: "follow_up_procedure",
          detectionReason: "follow_up_procedure_completed_not_billed",
        },
      });
    });

    return {
      detectorId: "healthcare.unbilled-follow-up-procedure",
      ran: true,
      leaks,
      warnings,
      errors,
    };
  },
};
