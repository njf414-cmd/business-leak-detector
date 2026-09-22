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
  return ["missed","not rebooked","ready to rebook","follow up needed"].includes(normalizeText(value));
}

function isAlreadyBilled(value: unknown): boolean {
  return ["booked","scheduled","billed","invoiced","paid","collected"].includes(normalizeText(value));
}

export const missedRebookingOpportunityDetector: BusinessLeakDetector = {
  id: "appointment-services.missed-rebooking-opportunity",
  name: "Missed Rebooking Opportunity",
  description: "Detects completed appointments with a documented rebooking opportunity that has not been converted.",
  scope: "industry",
  industries: ["appointment-services"],
  requirements: {
    optionalFields: ["Customer Name","Project Name","Rebooking Opportunity","Rebooking Opportunity Amount","Rebooking Status","Rebooking Billing Status","Last Appointment Date"],
  },
  supports(profile) {
    return profile.industry === "appointment-services";
  },
  async detect(context: DetectorContext): Promise<DetectorResult> {
    const leaks: DetectedBusinessLeak[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    context.rows.forEach((row, rowIndex) => {
      if (!isEarned(row["Rebooking Status"])) return;
      if (isAlreadyBilled(row["Rebooking Billing Status"])) return;

      const amount = parseMoney(row["Rebooking Opportunity Amount"]);
      if (amount === null || amount <= 0) return;

      const item = cleanText(row["Rebooking Opportunity"]);
      if (!item) return;

      const customerName = cleanText(row["Customer Name"]) || "Unknown Customer";
      const projectName = cleanText(row["Project Name"]);
      const eventDate = cleanText(row["Last Appointment Date"]);
      const recovery = amount * 0.9;

      leaks.push({
        detectorId: "appointment-services.missed-rebooking-opportunity",
        leakType: "Missed Rebooking Opportunity",
        title: `${customerName} has a missed rebooking opportunity`,
        description: `${customerName}'s ${item}${projectName ? ` for ${projectName}` : ""} has an earned $${amount.toFixed(2)} amount that has not been billed.`,
        category: "Appointment Revenue",
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
          status: cleanText(row["Rebooking Status"]),
          billingStatus: cleanText(row["Rebooking Billing Status"]),
          eventDate,
        },
        recommendedAction: `Review ${customerName}'s ${item} and invoice the documented $${amount.toFixed(2)} amount.`,
        metadata: {
          industry: "appointment-services",
          revenueType: "rebooking_revenue",
          detectionReason: "rebooking_opportunity_not_converted",
        },
      });
    });

    return {
      detectorId: "appointment-services.missed-rebooking-opportunity",
      ran: true,
      leaks,
      warnings,
      errors,
    };
  },
};
