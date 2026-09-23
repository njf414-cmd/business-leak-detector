export type NumericValue =
  | number
  | string
  | null
  | undefined;

export type ReportAnalysisSnapshot = {
  id: string;
  business_id: string;
  total_leakage: NumericValue;
  estimated_recovery: NumericValue;
  created_at: string;
};

export type ReportLeakSnapshot = {
  customer: string | null;
  type: string | null;
  amount: NumericValue;
  recovery: NumericValue;
  severity: string | null;
  reason: string | null;
  action: string | null;
  status: string | null;
  priority_score: NumericValue;
  priority_level: string | null;
  recovered_amount: NumericValue;
};

export type CustomerReportTopLeak = {
  customer: string;
  type: string;
  amount: number;
  recovery: number;
  severity: string;
  reason: string;
  action: string;
  status: string;
  priorityScore: number;
  priorityLevel: string;
};

export type GeneratedCustomerReport = {
  scanDate: string;
  revenueAtRisk: number;
  estimatedRecovery: number;
  recoveredAmount: number;
  leaksFound: number;
  newLeaks: number;
  resolvedLeaks: number;
  previousRevenueAtRisk: number | null;
  revenueRiskChange: number;
  topLeaks: CustomerReportTopLeak[];
};

function toNumber(
  value: NumericValue
) {
  const parsed =
    Number(value ?? 0);

  return Number.isFinite(parsed)
    ? parsed
    : 0;
}

function normalizeKeyPart(
  value: string | null
) {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function leakIdentity(
  leak: ReportLeakSnapshot
) {
  return [
    normalizeKeyPart(
      leak.customer
    ),
    normalizeKeyPart(
      leak.type
    ),
  ].join("::");
}

function buildCounts(
  leaks: ReportLeakSnapshot[]
) {
  const counts =
    new Map<string, number>();

  for (const leak of leaks) {
    const key =
      leakIdentity(leak);

    counts.set(
      key,
      (counts.get(key) ?? 0) + 1
    );
  }

  return counts;
}

function positiveCountDifference(
  left: Map<string, number>,
  right: Map<string, number>
) {
  let total = 0;

  for (
    const [key, count]
    of left
  ) {
    total += Math.max(
      0,
      count - (right.get(key) ?? 0)
    );
  }

  return total;
}

function topLeakSnapshot(
  leak: ReportLeakSnapshot
): CustomerReportTopLeak {
  return {
    customer:
      leak.customer?.trim() ||
      "Unknown",

    type:
      leak.type?.trim() ||
      "Unknown",

    amount:
      toNumber(
        leak.amount
      ),

    recovery:
      toNumber(
        leak.recovery
      ),

    severity:
      leak.severity?.trim() ||
      "medium",

    reason:
      leak.reason?.trim() ||
      "",

    action:
      leak.action?.trim() ||
      "",

    status:
      leak.status?.trim() ||
      "Open",

    priorityScore:
      toNumber(
        leak.priority_score
      ),

    priorityLevel:
      leak.priority_level?.trim() ||
      "Medium",
  };
}

export function buildCustomerReport(
  currentAnalysis: ReportAnalysisSnapshot,
  currentLeaks: ReportLeakSnapshot[],
  previousAnalysis:
    | ReportAnalysisSnapshot
    | null,
  previousLeaks: ReportLeakSnapshot[]
): GeneratedCustomerReport {
  const revenueAtRisk =
    toNumber(
      currentAnalysis.total_leakage
    );

  const estimatedRecovery =
    toNumber(
      currentAnalysis.estimated_recovery
    );

  const recoveredAmount =
    currentLeaks.reduce(
      (total, leak) =>
        total +
        toNumber(
          leak.recovered_amount
        ),
      0
    );

  const currentCounts =
    buildCounts(
      currentLeaks
    );

  const previousCounts =
    buildCounts(
      previousLeaks
    );

  const newLeaks =
    previousAnalysis
      ? positiveCountDifference(
          currentCounts,
          previousCounts
        )
      : currentLeaks.length;

  const resolvedLeaks =
    previousAnalysis
      ? positiveCountDifference(
          previousCounts,
          currentCounts
        )
      : 0;

  const previousRevenueAtRisk =
    previousAnalysis
      ? toNumber(
          previousAnalysis.total_leakage
        )
      : null;

  const revenueRiskChange =
    previousRevenueAtRisk === null
      ? 0
      : revenueAtRisk -
        previousRevenueAtRisk;

  const topLeaks =
    [...currentLeaks]
      .sort(
        (a, b) => {
          const priorityDifference =
            toNumber(
              b.priority_score
            ) -
            toNumber(
              a.priority_score
            );

          if (
            priorityDifference !== 0
          ) {
            return priorityDifference;
          }

          const recoveryDifference =
            toNumber(
              b.recovery
            ) -
            toNumber(
              a.recovery
            );

          if (
            recoveryDifference !== 0
          ) {
            return recoveryDifference;
          }

          return (
            toNumber(
              b.amount
            ) -
            toNumber(
              a.amount
            )
          );
        }
      )
      .slice(0, 5)
      .map(
        topLeakSnapshot
      );

  return {
    scanDate:
      currentAnalysis.created_at,

    revenueAtRisk,

    estimatedRecovery,

    recoveredAmount,

    leaksFound:
      currentLeaks.length,

    newLeaks,

    resolvedLeaks,

    previousRevenueAtRisk,

    revenueRiskChange,

    topLeaks,
  };
}
