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
  return ["incurred","approved","reimbursable","completed"].includes(normalizeText(value));
}

function isAlreadyBilled(value: unknown): boolean {
  return ["billed","invoiced","paid","collected"].includes(normalizeText(value));
}

export const unbilledProfessionalTravelExpenseDetector: BusinessLeakDetector = {
  id: "professional-services.unbilled-travel-expense",
  name: "Unbilled Travel Expense",
  description: "Detects reimbursable professional travel expenses with a documented amount that has not been billed.",
  scope: "industry",
  industries: ["professional_services"],
  requirements: {
    optionalFields: ["Customer Name","Project Name","Travel Expense","Travel Expense Amount","Travel Expense Status","Travel Expense Billing Status","Travel Date"],
  },
  supports(profile) {
    return profile.industry === "professional_services";
  },
  async detect(context: DetectorContext): Promise<DetectorResult> {
    const leaks: DetectedBusinessLeak[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    context.rows.forEach((row, rowIndex) => {
      if (!isEarned(row["Travel Expense Status"])) return;
      if (isAlreadyBilled(row["Travel Expense Billing Status"])) return;

      const amount = parseMoney(row["Travel Expense Amount"]);
      if (amount === null || amount <= 0) return;

      const item = cleanText(row["Travel Expense"]);
      if (!item) return;

      const customerName = cleanText(row["Customer Name"]) || "Unknown Customer";
      const projectName = cleanText(row["Project Name"]);
      const eventDate = cleanText(row["Travel Date"]);
      const recovery = amount * 0.9;

      leaks.push({
        detectorId: "professional-services.unbilled-travel-expense",
        leakType: "Unbilled Travel Expense",
        title: `${customerName} has a unbilled travel expense`,
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
          status: cleanText(row["Travel Expense Status"]),
          billingStatus: cleanText(row["Travel Expense Billing Status"]),
          eventDate,
        },
        recommendedAction: `Review ${customerName}'s ${item} and invoice the documented $${amount.toFixed(2)} amount.`,
        metadata: {
          industry: "professional_services",
          revenueType: "travel_expense",
          detectionReason: "reimbursable_travel_expense_not_billed",
        },
      });
    });

    return {
      detectorId: "professional-services.unbilled-travel-expense",
      ran: true,
      leaks,
      warnings,
      errors,
    };
  },
};
