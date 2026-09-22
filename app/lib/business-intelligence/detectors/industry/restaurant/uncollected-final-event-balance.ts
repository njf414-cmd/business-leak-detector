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
  return ["completed","finished","served","closed"].includes(normalizeText(value));
}

function isAlreadyBilled(value: unknown): boolean {
  return ["paid","collected","received","settled"].includes(normalizeText(value));
}

export const uncollectedFinalEventBalanceDetector: BusinessLeakDetector = {
  id: "restaurant.uncollected-final-event-balance",
  name: "Uncollected Final Event Balance",
  description: "Detects completed catering or private events with a documented final balance that remains uncollected.",
  scope: "industry",
  industries: ["restaurant"],
  requirements: {
    optionalFields: ["Customer Name","Project Name","Event Final Balance","Final Event Balance","Event Completion Status","Final Event Payment Status","Event Date"],
  },
  supports(profile) {
    return profile.industry === "restaurant";
  },
  async detect(context: DetectorContext): Promise<DetectorResult> {
    const leaks: DetectedBusinessLeak[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    context.rows.forEach((row, rowIndex) => {
      if (!isEarned(row["Event Completion Status"])) return;
      if (isAlreadyBilled(row["Final Event Payment Status"])) return;

      const amount = parseMoney(row["Final Event Balance"]);
      if (amount === null || amount <= 0) return;

      const item = cleanText(row["Event Final Balance"]);
      if (!item) return;

      const customerName = cleanText(row["Customer Name"]) || "Unknown Customer";
      const projectName = cleanText(row["Project Name"]);
      const eventDate = cleanText(row["Event Date"]);
      const recovery = amount * 0.9;

      leaks.push({
        detectorId: "restaurant.uncollected-final-event-balance",
        leakType: "Uncollected Final Event Balance",
        title: `${customerName} has a uncollected final event balance`,
        description: `${customerName}'s ${item}${projectName ? ` for ${projectName}` : ""} has an earned $${amount.toFixed(2)} amount that has not been billed.`,
        category: "Restaurant Billing",
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
          status: cleanText(row["Event Completion Status"]),
          billingStatus: cleanText(row["Final Event Payment Status"]),
          eventDate,
        },
        recommendedAction: `Review ${customerName}'s ${item} and collect the documented $${amount.toFixed(2)} amount.`,
        metadata: {
          industry: "restaurant",
          revenueType: "final_event_balance",
          detectionReason: "event_completed_final_balance_not_collected",
        },
      });
    });

    return {
      detectorId: "restaurant.uncollected-final-event-balance",
      ran: true,
      leaks,
      warnings,
      errors,
    };
  },
};
