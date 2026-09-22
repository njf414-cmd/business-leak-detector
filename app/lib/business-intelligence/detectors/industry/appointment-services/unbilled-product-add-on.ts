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
  return ["provided","sold","delivered","completed"].includes(normalizeText(value));
}

function isAlreadyBilled(value: unknown): boolean {
  return ["billed","invoiced","paid","collected"].includes(normalizeText(value));
}

export const unbilledProductAddOnDetector: BusinessLeakDetector = {
  id: "appointment-services.unbilled-product-add-on",
  name: "Unbilled Product Add-On",
  description: "Detects products provided during an appointment that were not billed.",
  scope: "industry",
  industries: ["appointment-services"],
  requirements: {
    optionalFields: ["Customer Name","Project Name","Product Add-On","Product Add-On Amount","Product Add-On Status","Product Add-On Billing Status","Appointment Date"],
  },
  supports(profile) {
    return profile.industry === "appointment-services";
  },
  async detect(context: DetectorContext): Promise<DetectorResult> {
    const leaks: DetectedBusinessLeak[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    context.rows.forEach((row, rowIndex) => {
      if (!isEarned(row["Product Add-On Status"])) return;
      if (isAlreadyBilled(row["Product Add-On Billing Status"])) return;

      const amount = parseMoney(row["Product Add-On Amount"]);
      if (amount === null || amount <= 0) return;

      const item = cleanText(row["Product Add-On"]);
      if (!item) return;

      const customerName = cleanText(row["Customer Name"]) || "Unknown Customer";
      const projectName = cleanText(row["Project Name"]);
      const eventDate = cleanText(row["Appointment Date"]);
      const recovery = amount * 0.9;

      leaks.push({
        detectorId: "appointment-services.unbilled-product-add-on",
        leakType: "Unbilled Product Add-On",
        title: `${customerName} has a unbilled product add-on`,
        description: `${customerName}'s ${item}${projectName ? ` for ${projectName}` : ""} has an earned $${amount.toFixed(2)} amount that has not been billed.`,
        category: "Appointment Billing",
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
          status: cleanText(row["Product Add-On Status"]),
          billingStatus: cleanText(row["Product Add-On Billing Status"]),
          eventDate,
        },
        recommendedAction: `Review ${customerName}'s ${item} and invoice the documented $${amount.toFixed(2)} amount.`,
        metadata: {
          industry: "appointment-services",
          revenueType: "product_add_on",
          detectionReason: "provided_product_not_billed",
        },
      });
    });

    return {
      detectorId: "appointment-services.unbilled-product-add-on",
      ran: true,
      leaks,
      warnings,
      errors,
    };
  },
};
