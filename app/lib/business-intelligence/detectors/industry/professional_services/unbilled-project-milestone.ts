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
  return ["completed","approved","achieved","ready to bill"].includes(normalizeText(value));
}

function isAlreadyBilled(value: unknown): boolean {
  return ["billed","invoiced","paid","collected"].includes(normalizeText(value));
}

export const unbilledProfessionalProjectMilestoneDetector: BusinessLeakDetector = {
  id: "professional-services.unbilled-project-milestone",
  name: "Unbilled Project Milestone",
  description: "Detects completed project milestones with a documented milestone payment that has not been billed.",
  scope: "industry",
  industries: ["professional_services"],
  requirements: {
    optionalFields: ["Customer Name","Project Name","Project Milestone","Milestone Amount","Milestone Status","Milestone Billing Status","Milestone Date"],
  },
  supports(profile) {
    return profile.industry === "professional_services";
  },
  async detect(context: DetectorContext): Promise<DetectorResult> {
    const leaks: DetectedBusinessLeak[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    context.rows.forEach((row, rowIndex) => {
      if (!isEarned(row["Milestone Status"])) return;
      if (isAlreadyBilled(row["Milestone Billing Status"])) return;

      const amount = parseMoney(row["Milestone Amount"]);
      if (amount === null || amount <= 0) return;

      const item = cleanText(row["Project Milestone"]);
      if (!item) return;

      const customerName = cleanText(row["Customer Name"]) || "Unknown Customer";
      const projectName = cleanText(row["Project Name"]);
      const eventDate = cleanText(row["Milestone Date"]);
      const recovery = amount * 0.9;

      leaks.push({
        detectorId: "professional-services.unbilled-project-milestone",
        leakType: "Unbilled Project Milestone",
        title: `${customerName} has a unbilled project milestone`,
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
          status: cleanText(row["Milestone Status"]),
          billingStatus: cleanText(row["Milestone Billing Status"]),
          eventDate,
        },
        recommendedAction: `Review ${customerName}'s ${item} and invoice the documented $${amount.toFixed(2)} amount.`,
        metadata: {
          industry: "professional_services",
          revenueType: "project_milestone",
          detectionReason: "project_milestone_completed_not_billed",
        },
      });
    });

    return {
      detectorId: "professional-services.unbilled-project-milestone",
      ran: true,
      leaks,
      warnings,
      errors,
    };
  },
};
