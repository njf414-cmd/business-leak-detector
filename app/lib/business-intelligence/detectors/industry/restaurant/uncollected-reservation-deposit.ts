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
  return ["confirmed","booked","reserved","scheduled"].includes(normalizeText(value));
}

function isAlreadyBilled(value: unknown): boolean {
  return ["paid","collected","received","waived"].includes(normalizeText(value));
}

export const uncollectedReservationDepositDetector: BusinessLeakDetector = {
  id: "restaurant.uncollected-reservation-deposit",
  name: "Uncollected Reservation Deposit",
  description: "Detects confirmed reservations or events with a documented required deposit that remains uncollected.",
  scope: "industry",
  industries: ["restaurant"],
  requirements: {
    optionalFields: ["Customer Name","Project Name","Reservation","Reservation Deposit","Reservation Status","Reservation Deposit Status","Reservation Date"],
  },
  supports(profile) {
    return profile.industry === "restaurant";
  },
  async detect(context: DetectorContext): Promise<DetectorResult> {
    const leaks: DetectedBusinessLeak[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    context.rows.forEach((row, rowIndex) => {
      if (!isEarned(row["Reservation Status"])) return;
      if (isAlreadyBilled(row["Reservation Deposit Status"])) return;

      const amount = parseMoney(row["Reservation Deposit"]);
      if (amount === null || amount <= 0) return;

      const item = cleanText(row["Reservation"]);
      if (!item) return;

      const customerName = cleanText(row["Customer Name"]) || "Unknown Customer";
      const projectName = cleanText(row["Project Name"]);
      const eventDate = cleanText(row["Reservation Date"]);
      const recovery = amount * 0.9;

      leaks.push({
        detectorId: "restaurant.uncollected-reservation-deposit",
        leakType: "Uncollected Reservation Deposit",
        title: `${customerName} has a uncollected reservation deposit`,
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
          status: cleanText(row["Reservation Status"]),
          billingStatus: cleanText(row["Reservation Deposit Status"]),
          eventDate,
        },
        recommendedAction: `Review ${customerName}'s ${item} and collect the documented $${amount.toFixed(2)} amount.`,
        metadata: {
          industry: "restaurant",
          revenueType: "reservation_deposit",
          detectionReason: "reservation_confirmed_deposit_not_collected",
        },
      });
    });

    return {
      detectorId: "restaurant.uncollected-reservation-deposit",
      ran: true,
      leaks,
      warnings,
      errors,
    };
  },
};
