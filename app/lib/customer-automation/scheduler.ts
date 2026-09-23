import type { CustomerReportFrequency } from "./types";

export function calculateNextScanAt(
  frequency: CustomerReportFrequency,
  from: Date = new Date(),
  timeZone = "UTC"
): Date | null {
  if (Number.isNaN(from.getTime())) {
    throw new Error("Invalid scan scheduling date.");
  }

  void timeZone;

  const next = new Date(from);

  if (frequency === "weekly") {
    next.setUTCDate(next.getUTCDate() + 7);
    return next;
  }

  if (frequency === "biweekly") {
    next.setUTCDate(next.getUTCDate() + 14);
    return next;
  }

  if (frequency === "monthly") {
    const originalDay = next.getUTCDate();
    next.setUTCDate(1);
    next.setUTCMonth(next.getUTCMonth() + 1);

    const endOfTargetMonth = new Date(
      Date.UTC(
        next.getUTCFullYear(),
        next.getUTCMonth() + 1,
        0,
        next.getUTCHours(),
        next.getUTCMinutes(),
        next.getUTCSeconds(),
        next.getUTCMilliseconds()
      )
    ).getUTCDate();

    next.setUTCDate(Math.min(originalDay, endOfTargetMonth));
    return next;
  }

  return null;
}
