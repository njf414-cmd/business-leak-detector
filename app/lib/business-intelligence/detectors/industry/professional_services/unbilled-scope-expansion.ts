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
  return ["approved","completed","performed","accepted"].includes(normalizeText(value));
}

function isAlreadyBilled(value: unknown): boolean {
  return ["billed","invoiced","paid","collected"].includes(normalizeText(value));
}

export const unbilledScopeExpansionDetector: BusinessLeakDetector = {
  id: "professional-services.unbilled-scope-expansion",
  name: "Unbilled Scope Expansion",
  description: "Detects approved or completed out-of-scope work with a documented additional amount that has not been billed.",
  scope: "industry",
  industries: ["professional_services"],
  requirements: {
    optionalFields: ["Customer Name","Project Name","Scope Expansion","Scope Expansion Amount","Scope Expansion Status","Scope Expansion Billing Status","Scope Expansion Date"],
  },
  supports(profile) {
    return profile.industry === "professional_services";
  },
  async detect(context: DetectorContext): Promise<DetectorResult> {
    const leaks: DetectedBusinessLeak[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    context.rows.forEach((row, rowIndex) => {
      if (!isEarned(row["Scope Expansion Status"])) return;
      if (isAlreadyBilled(row["Scope Expansion Billing Status"])) return;

      const amount = parseMoney(row["Scope Expansion Amount"]);
      if (amount === null || amount <= 0) return;

      const item = cleanText(row["Scope Expansion"]);
      if (!item) return;

      const customerName = cleanText(row["Customer Name"]) || "Unknown Customer";
      const projectName = cleanText(row["Project Name"]);
      const eventDate = cleanText(row["Scope Expansion Date"]);
      const recovery = amount * 0.9;

      leaks.push({
        detectorId: "professional-services.unbilled-scope-expansion",
        leakType: "Unbilled Scope Expansion",
        title: `${customerName} has a unbilled scope expansion`,
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
          status: cleanText(row["Scope Expansion Status"]),
          billingStatus: cleanText(row["Scope Expansion Billing Status"]),
          eventDate,
        },
        recommendedAction: `Review ${customerName}'s ${item} and invoice the documented $${amount.toFixed(2)} amount.`,
        metadata: {
          industry: "professional_services",
          revenueType: "scope_expansion",
          detectionReason: "scope_expansion_completed_not_billed",
        },
      });
    });

    return {
      detectorId: "professional-services.unbilled-scope-expansion",
      ran: true,
      leaks,
      warnings,
      errors,
    };
  },
};
