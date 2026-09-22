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
  return ["upgraded","activated","approved","active"].includes(normalizeText(value));
}

function isAlreadyBilled(value: unknown): boolean {
  return ["billed","invoiced","paid","collected"].includes(normalizeText(value));
}

export const unbilledEducationCourseUpgradeDetector: BusinessLeakDetector = {
  id: "education.unbilled-course-upgrade",
  name: "Unbilled Course Upgrade",
  description: "Detects documented unbilled course upgrade opportunities where revenue is due or earned but has not been properly billed or collected.",
  scope: "industry",
  industries: ["education"],
  requirements: {
    optionalFields: ["Customer Name","Project Name","Course Upgrade","Course Upgrade Amount","Course Upgrade Status","Course Upgrade Billing Status","Upgrade Date"],
  },
  supports(profile) {
    return profile.industry === "education";
  },
  async detect(context: DetectorContext): Promise<DetectorResult> {
    const leaks: DetectedBusinessLeak[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    context.rows.forEach((row, rowIndex) => {
      if (!isEarned(row["Course Upgrade Status"])) return;
      if (isAlreadyBilled(row["Course Upgrade Billing Status"])) return;

      const amount = parseMoney(row["Course Upgrade Amount"]);
      if (amount === null || amount <= 0) return;

      const item = cleanText(row["Course Upgrade"]);
      if (!item) return;

      const customerName = cleanText(row["Customer Name"]) || "Unknown Customer";
      const projectName = cleanText(row["Project Name"]);
      const eventDate = cleanText(row["Upgrade Date"]);
      const recovery = amount * 0.9;

      leaks.push({
        detectorId: "education.unbilled-course-upgrade",
        leakType: "Unbilled Course Upgrade",
        title: `${customerName} has a unbilled course upgrade`,
        description: `${customerName}'s ${item}${projectName ? ` for ${projectName}` : ""} has an earned $${amount.toFixed(2)} amount that has not been billed.`,
        category: "Education Billing",
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
          status: cleanText(row["Course Upgrade Status"]),
          billingStatus: cleanText(row["Course Upgrade Billing Status"]),
          eventDate,
        },
        recommendedAction: `Review ${customerName}'s ${item} and invoice the documented $${amount.toFixed(2)} amount.`,
        metadata: {
          industry: "education",
          revenueType: "course_upgrade",
          detectionReason: "education_course_upgrade_not_billed",
        },
      });
    });

    return {
      detectorId: "education.unbilled-course-upgrade",
      ran: true,
      leaks,
      warnings,
      errors,
    };
  },
};
