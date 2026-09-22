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

export const unbilledHealthcareProcedureAddOnDetector: BusinessLeakDetector = {
  id: "healthcare.unbilled-procedure-add-on",
  name: "Unbilled Procedure Add-On",
  description: "Detects completed healthcare procedure add-ons with a documented charge that has not been billed.",
  scope: "industry",
  industries: ["healthcare"],
  requirements: {
    optionalFields: ["Customer Name","Project Name","Procedure Add-On","Procedure Add-On Amount","Procedure Add-On Status","Procedure Add-On Billing Status","Procedure Date"],
  },
  supports(profile) {
    return profile.industry === "healthcare";
  },
  async detect(context: DetectorContext): Promise<DetectorResult> {
    const leaks: DetectedBusinessLeak[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    context.rows.forEach((row, rowIndex) => {
      if (!isEarned(row["Procedure Add-On Status"])) return;
      if (isAlreadyBilled(row["Procedure Add-On Billing Status"])) return;

      const amount = parseMoney(row["Procedure Add-On Amount"]);
      if (amount === null || amount <= 0) return;

      const item = cleanText(row["Procedure Add-On"]);
      if (!item) return;

      const customerName = cleanText(row["Customer Name"]) || "Unknown Customer";
      const projectName = cleanText(row["Project Name"]);
      const eventDate = cleanText(row["Procedure Date"]);
      const recovery = amount * 0.9;

      leaks.push({
        detectorId: "healthcare.unbilled-procedure-add-on",
        leakType: "Unbilled Procedure Add-On",
        title: `${customerName} has a unbilled procedure add-on`,
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
          status: cleanText(row["Procedure Add-On Status"]),
          billingStatus: cleanText(row["Procedure Add-On Billing Status"]),
          eventDate,
        },
        recommendedAction: `Review ${customerName}'s ${item} and invoice the documented $${amount.toFixed(2)} amount.`,
        metadata: {
          industry: "healthcare",
          revenueType: "procedure_add_on",
          detectionReason: "procedure_add_on_completed_not_billed",
        },
      });
    });

    return {
      detectorId: "healthcare.unbilled-procedure-add-on",
      ran: true,
      leaks,
      warnings,
      errors,
    };
  },
};
