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
  return ["completed","performed","approved","billable"].includes(normalizeText(value));
}

function isAlreadyBilled(value: unknown): boolean {
  return ["billed","invoiced","paid","collected"].includes(normalizeText(value));
}

export const unbilledRetainerWorkDetector: BusinessLeakDetector = {
  id: "professional-services.unbilled-retainer-work",
  name: "Unbilled Retainer Work",
  description: "Detects completed billable work performed beyond an included retainer amount that has not been billed.",
  scope: "industry",
  industries: ["professional_services"],
  requirements: {
    optionalFields: ["Customer Name","Project Name","Retainer Work","Retainer Overage Amount","Retainer Work Status","Retainer Overage Billing Status","Retainer Work Date"],
  },
  supports(profile) {
    return profile.industry === "professional_services";
  },
  async detect(context: DetectorContext): Promise<DetectorResult> {
    const leaks: DetectedBusinessLeak[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    context.rows.forEach((row, rowIndex) => {
      if (!isEarned(row["Retainer Work Status"])) return;
      if (isAlreadyBilled(row["Retainer Overage Billing Status"])) return;

      const amount = parseMoney(row["Retainer Overage Amount"]);
      if (amount === null || amount <= 0) return;

      const item = cleanText(row["Retainer Work"]);
      if (!item) return;

      const customerName = cleanText(row["Customer Name"]) || "Unknown Customer";
      const projectName = cleanText(row["Project Name"]);
      const eventDate = cleanText(row["Retainer Work Date"]);
      const recovery = amount * 0.9;

      leaks.push({
        detectorId: "professional-services.unbilled-retainer-work",
        leakType: "Unbilled Retainer Work",
        title: `${customerName} has a unbilled retainer work`,
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
          status: cleanText(row["Retainer Work Status"]),
          billingStatus: cleanText(row["Retainer Overage Billing Status"]),
          eventDate,
        },
        recommendedAction: `Review ${customerName}'s ${item} and invoice the documented $${amount.toFixed(2)} amount.`,
        metadata: {
          industry: "professional_services",
          revenueType: "retainer_overage",
          detectionReason: "retainer_overage_completed_not_billed",
        },
      });
    });

    return {
      detectorId: "professional-services.unbilled-retainer-work",
      ran: true,
      leaks,
      warnings,
      errors,
    };
  },
};
