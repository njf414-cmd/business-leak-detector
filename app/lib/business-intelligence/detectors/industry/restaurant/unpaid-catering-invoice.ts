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
  return ["completed","delivered","fulfilled","served"].includes(normalizeText(value));
}

function isAlreadyBilled(value: unknown): boolean {
  return ["paid","collected","settled","received"].includes(normalizeText(value));
}

export const unpaidCateringInvoiceDetector: BusinessLeakDetector = {
  id: "restaurant.unpaid-catering-invoice",
  name: "Unpaid Catering Invoice",
  description: "Detects completed catering jobs with a documented unpaid balance.",
  scope: "industry",
  industries: ["restaurant"],
  requirements: {
    optionalFields: ["Customer Name","Project Name","Catering Job","Catering Balance","Catering Status","Catering Payment Status","Catering Date"],
  },
  supports(profile) {
    return profile.industry === "restaurant";
  },
  async detect(context: DetectorContext): Promise<DetectorResult> {
    const leaks: DetectedBusinessLeak[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    context.rows.forEach((row, rowIndex) => {
      if (!isEarned(row["Catering Status"])) return;
      if (isAlreadyBilled(row["Catering Payment Status"])) return;

      const amount = parseMoney(row["Catering Balance"]);
      if (amount === null || amount <= 0) return;

      const item = cleanText(row["Catering Job"]);
      if (!item) return;

      const customerName = cleanText(row["Customer Name"]) || "Unknown Customer";
      const projectName = cleanText(row["Project Name"]);
      const eventDate = cleanText(row["Catering Date"]);
      const recovery = amount * 0.9;

      leaks.push({
        detectorId: "restaurant.unpaid-catering-invoice",
        leakType: "Unpaid Catering Invoice",
        title: `${customerName} has a unpaid catering invoice`,
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
          status: cleanText(row["Catering Status"]),
          billingStatus: cleanText(row["Catering Payment Status"]),
          eventDate,
        },
        recommendedAction: `Review ${customerName}'s ${item} and collect the documented $${amount.toFixed(2)} amount.`,
        metadata: {
          industry: "restaurant",
          revenueType: "catering_invoice",
          detectionReason: "catering_completed_balance_unpaid",
        },
      });
    });

    return {
      detectorId: "restaurant.unpaid-catering-invoice",
      ran: true,
      leaks,
      warnings,
      errors,
    };
  },
};
