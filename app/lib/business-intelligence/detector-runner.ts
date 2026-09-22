import {
  getSupportedDetectors,
} from "./detector-registry";

import {
  registerDetectorCatalog,
} from "./detector-catalog";

import type {
  BusinessIntelligenceProfile,
} from "./types";

import type {
  BusinessDataRow,
  DetectedBusinessLeak,
  DetectorContext,
  DetectorResult,
} from "./detector-types";

/* ================================== */
/* RUNNER TYPES */
/* ================================== */

export type DetectorRunnerRequest = {
  profile: BusinessIntelligenceProfile;
  rows: BusinessDataRow[];
  now?: Date;
};

export type DetectorExecutionSummary = {
  detectorId: string;
  ran: boolean;
  leakCount: number;
  warningCount: number;
  errorCount: number;
};

export type DetectorRunnerResult = {
  success: boolean;

  leaks: DetectedBusinessLeak[];

  detectorResults: DetectorResult[];

  executionSummary:
    DetectorExecutionSummary[];

  stats: {
    rowsAnalyzed: number;
    detectorsSelected: number;
    detectorsRan: number;
    detectorsFailed: number;
    leaksFound: number;
    totalEstimatedLoss: number;
    totalEstimatedRecovery: number;
    warnings: number;
    errors: number;
  };

  warnings: string[];
  errors: string[];
};

/* ================================== */
/* NUMBER SAFETY */
/* ================================== */

function safeMoney(
  value: number
): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(
    0,
    value
  );
}

function sameMoney(
  first: number,
  second: number
): boolean {
  return (
    Math.abs(
      safeMoney(first) -
        safeMoney(second)
    ) < 0.01
  );
}

/* ================================== */
/* DETECTOR FAMILIES */
/* ================================== */

const LEAD_FAMILY_PRIORITY:
  Record<string, number> = {
    "Abandoned Lead": 300,
    "Stale Lead": 200,
    "Unbooked Lead": 100,
  };

const ESTIMATE_FAMILY_PRIORITY:
  Record<string, number> = {
    "Unsent Estimate": 400,
    "Expired Estimate": 300,
    "Unfollowed Estimate": 200,
    "Stale Estimate": 100,
  };

const PAYMENT_FAMILY_PRIORITY:
  Record<string, number> = {
    "Partial Payment": 500,
    "Failed Payment": 400,
    "Overdue Invoice": 300,
    "Unpaid Invoice": 200,
    "Underpaid Job": 100,
  };

const LOST_REVENUE_FAMILY_PRIORITY:
  Record<string, number> = {
    "No-Show": 300,
    "Cancelled Job": 200,
    "Lost Lead": 100,
  };

/* ================================== */
/* RECURRING FAMILY */
/* ================================== */

const RECURRING_FAMILY_PRIORITY:
  Record<string, number> = {
    "Missed Recurring Payment": 300,
    "Unrenewed Customer": 200,
    "Churned Recurring Customer": 100,
  };

/* ================================== */
/* FEE FAMILY */
/* ================================== */

const FEE_FAMILY_PRIORITY:
  Record<string, number> = {
    "Unpaid Cancellation Fee": 200,
    "Uncollected Late Fee": 100,
  };

/* ================================== */
/* AUTOMOTIVE RECOMMENDATION FAMILY */
/* ================================== */

/*
  These three detectors can describe
  the same recommended service.

  The more specific customer decision
  owns the generic unperformed finding.

  Deferred
      >
  Declined
      >
  Unperformed
*/

const AUTOMOTIVE_RECOMMENDED_SERVICE_PRIORITY:
  Record<string, number> = {
    "Deferred Recommended Service": 300,
    "Declined Recommended Service": 200,
    "Unperformed Recommended Service": 100,
  };

/* ================================== */
/* FAMILY HELPERS */
/* ================================== */

function belongsToFamily(
  leak: DetectedBusinessLeak,
  family:
    Record<string, number>
): boolean {
  return (
    family[
      leak.leakType
    ] !== undefined
  );
}

function getFamilyPriority(
  leak: DetectedBusinessLeak,
  family:
    Record<string, number>
): number {
  return (
    family[
      leak.leakType
    ] ?? 0
  );
}

/* ================================== */
/* FAMILY WINNER */
/* ================================== */

function selectFamilyWinners(
  leaks: DetectedBusinessLeak[],
  priority:
    Record<string, number>
): {
  selected:
    DetectedBusinessLeak[];

  ungrouped:
    DetectedBusinessLeak[];
} {
  const leaksByRow =
    new Map<
      number,
      DetectedBusinessLeak[]
    >();

  const ungrouped:
    DetectedBusinessLeak[] = [];

  for (
    const leak of leaks
  ) {
    if (
      leak.sourceRowIndex ===
      null
    ) {
      ungrouped.push(
        leak
      );

      continue;
    }

    const existing =
      leaksByRow.get(
        leak.sourceRowIndex
      ) ?? [];

    existing.push(
      leak
    );

    leaksByRow.set(
      leak.sourceRowIndex,
      existing
    );
  }

  const selected:
    DetectedBusinessLeak[] = [];

  for (
    const rowLeaks of
    leaksByRow.values()
  ) {
    const sorted =
      [...rowLeaks].sort(
        (a, b) =>
          getFamilyPriority(
            b,
            priority
          ) -
          getFamilyPriority(
            a,
            priority
          )
      );

    const winner =
      sorted[0];

    if (winner) {
      selected.push(
        winner
      );
    }
  }

  selected.sort(
    (a, b) => {
      const aIndex =
        a.sourceRowIndex ??
        Number.MAX_SAFE_INTEGER;

      const bIndex =
        b.sourceRowIndex ??
        Number.MAX_SAFE_INTEGER;

      return (
        aIndex -
        bIndex
      );
    }
  );

  return {
    selected,
    ungrouped,
  };
}

/* ================================== */
/* APPLY ONE FAMILY */
/* ================================== */

function enforceFamilyOwnership(
  leaks: DetectedBusinessLeak[],
  family:
    Record<string, number>
): DetectedBusinessLeak[] {
  const familyLeaks =
    leaks.filter(
      (leak) =>
        belongsToFamily(
          leak,
          family
        )
    );

  const nonFamilyLeaks =
    leaks.filter(
      (leak) =>
        !belongsToFamily(
          leak,
          family
        )
    );

  const selection =
    selectFamilyWinners(
      familyLeaks,
      family
    );

  return [
    ...nonFamilyLeaks,
    ...selection.selected,
    ...selection.ungrouped,
  ];
}

/* ================================== */
/* PAYMENT TYPE HELPER */
/* ================================== */

function isGenericPaymentLeak(
  leak: DetectedBusinessLeak
): boolean {
  return [
    "Partial Payment",
    "Failed Payment",
    "Overdue Invoice",
    "Unpaid Invoice",
    "Underpaid Job",
  ].includes(
    leak.leakType
  );
}

/* ================================== */
/* CROSS-FAMILY OWNERSHIP */
/* ================================== */

function enforceCrossFamilyOwnership(
  leaks: DetectedBusinessLeak[]
): DetectedBusinessLeak[] {
  const leaksByRow =
    new Map<
      number,
      DetectedBusinessLeak[]
    >();

  const ungrouped:
    DetectedBusinessLeak[] = [];

  for (
    const leak of leaks
  ) {
    if (
      leak.sourceRowIndex ===
      null
    ) {
      ungrouped.push(
        leak
      );

      continue;
    }

    const rowLeaks =
      leaksByRow.get(
        leak.sourceRowIndex
      ) ?? [];

    rowLeaks.push(
      leak
    );

    leaksByRow.set(
      leak.sourceRowIndex,
      rowLeaks
    );
  }

  const finalLeaks:
    DetectedBusinessLeak[] = [];

  for (
    const rowLeaks of
    leaksByRow.values()
  ) {
    let working =
      [...rowLeaks];

    /* -------------------------------- */
    /* RECURRING PAYMENT OWNERSHIP */
    /* -------------------------------- */

    const recurringPayment =
      working.find(
        (leak) =>
          leak.leakType ===
          "Missed Recurring Payment"
      );

    if (recurringPayment) {
      const recurringLoss =
        safeMoney(
          recurringPayment
            .estimatedLoss
        );

      working =
        working.filter(
          (leak) => {
            if (
              leak ===
              recurringPayment
            ) {
              return true;
            }

            if (
              !isGenericPaymentLeak(
                leak
              )
            ) {
              return true;
            }

            return !sameMoney(
              leak.estimatedLoss,
              recurringLoss
            );
          }
        );
    }

    /* -------------------------------- */
    /* RENEWAL OWNERSHIP */
    /* -------------------------------- */

    const renewal =
      working.find(
        (leak) =>
          leak.leakType ===
            "Unrenewed Customer"
      );

    if (renewal) {
      working =
        working.filter(
          (leak) =>
            leak.leakType !==
              "Churned Recurring Customer"
        );
    }

    /* -------------------------------- */
    /* DEPOSIT OWNERSHIP */
    /* -------------------------------- */

    const deposit =
      working.find(
        (leak) =>
          leak.leakType ===
            "Uncollected Deposit"
      );

    if (deposit) {
      const depositLoss =
        safeMoney(
          deposit.estimatedLoss
        );

      working =
        working.filter(
          (leak) => {
            if (
              leak ===
              deposit
            ) {
              return true;
            }

            if (
              !isGenericPaymentLeak(
                leak
              )
            ) {
              return true;
            }

            return !sameMoney(
              leak.estimatedLoss,
              depositLoss
            );
          }
        );
    }

    /* -------------------------------- */
    /* REFUND VS OVERPAYMENT */
    /* -------------------------------- */

    const refund =
      working.find(
        (leak) =>
          leak.leakType ===
            "Unprocessed Refund"
      );

    if (refund) {
      const refundLoss =
        safeMoney(
          refund.estimatedLoss
        );

      working =
        working.filter(
          (leak) => {
            if (
              leak.leakType !==
                "Overpayment"
            ) {
              return true;
            }

            return !sameMoney(
              leak.estimatedLoss,
              refundLoss
            );
          }
        );
    }

    /*
      Cancellation fees and lost jobs
      represent different money.

      Late fees and invoice principal
      also represent different money.

      Therefore those findings may
      legitimately coexist.
    */

    finalLeaks.push(
      ...working
    );
  }

  return [
    ...finalLeaks,
    ...ungrouped,
  ];
}

/* ================================== */
/* EXACT DUPLICATE SAFETY */
/* ================================== */

function removeExactDuplicates(
  leaks: DetectedBusinessLeak[]
): DetectedBusinessLeak[] {
  const seen =
    new Set<string>();

  const unique:
    DetectedBusinessLeak[] = [];

  for (
    const leak of leaks
  ) {
    const key = [
      leak.detectorId,
      leak.leakType,
      leak.sourceRowIndex ??
        "none",
      safeMoney(
        leak.estimatedLoss
      ).toFixed(2),
      safeMoney(
        leak.estimatedRecovery
      ).toFixed(2),
    ].join("::");

    if (
      seen.has(key)
    ) {
      continue;
    }

    seen.add(key);

    unique.push(
      leak
    );
  }

  return unique;
}

/* ================================== */
/* STABLE RESULT ORDER */
/* ================================== */

function sortFinalLeaks(
  leaks: DetectedBusinessLeak[]
): DetectedBusinessLeak[] {
  return [...leaks].sort(
    (a, b) => {
      const aRow =
        a.sourceRowIndex ??
        Number.MAX_SAFE_INTEGER;

      const bRow =
        b.sourceRowIndex ??
        Number.MAX_SAFE_INTEGER;

      if (
        aRow !== bRow
      ) {
        return (
          aRow - bRow
        );
      }

      const typeCompare =
        a.leakType.localeCompare(
          b.leakType
        );

      if (
        typeCompare !== 0
      ) {
        return typeCompare;
      }

      return (
        a.detectorId.localeCompare(
          b.detectorId
        )
      );
    }
  );
}

/* ================================== */
/* COMPLETE OWNERSHIP PIPELINE */
/* ================================== */

function applyOwnershipRules(
  rawLeaks:
    DetectedBusinessLeak[]
): DetectedBusinessLeak[] {
  let leaks =
    [...rawLeaks];

  /* ================================== */
  /* STEP 1 — FAMILY OWNERSHIP */
  /* ================================== */

  leaks =
    enforceFamilyOwnership(
      leaks,
      LEAD_FAMILY_PRIORITY
    );

  leaks =
    enforceFamilyOwnership(
      leaks,
      ESTIMATE_FAMILY_PRIORITY
    );

  leaks =
    enforceFamilyOwnership(
      leaks,
      PAYMENT_FAMILY_PRIORITY
    );

  leaks =
    enforceFamilyOwnership(
      leaks,
      LOST_REVENUE_FAMILY_PRIORITY
    );

  leaks =
    enforceFamilyOwnership(
      leaks,
      RECURRING_FAMILY_PRIORITY
    );

  leaks =
    enforceFamilyOwnership(
      leaks,
      FEE_FAMILY_PRIORITY
    );

  leaks =
    enforceFamilyOwnership(
      leaks,
      AUTOMOTIVE_RECOMMENDED_SERVICE_PRIORITY
    );

  /* ================================== */
  /* STEP 2 — CROSS-FAMILY OWNERSHIP */
  /* ================================== */

  leaks =
    enforceCrossFamilyOwnership(
      leaks
    );

  /* ================================== */
  /* STEP 3 — RE-ENFORCE FAMILIES */
  /* ================================== */

  leaks =
    enforceFamilyOwnership(
      leaks,
      LEAD_FAMILY_PRIORITY
    );

  leaks =
    enforceFamilyOwnership(
      leaks,
      ESTIMATE_FAMILY_PRIORITY
    );

  leaks =
    enforceFamilyOwnership(
      leaks,
      PAYMENT_FAMILY_PRIORITY
    );

  leaks =
    enforceFamilyOwnership(
      leaks,
      LOST_REVENUE_FAMILY_PRIORITY
    );

  leaks =
    enforceFamilyOwnership(
      leaks,
      RECURRING_FAMILY_PRIORITY
    );

  leaks =
    enforceFamilyOwnership(
      leaks,
      FEE_FAMILY_PRIORITY
    );

  leaks =
    enforceFamilyOwnership(
      leaks,
      AUTOMOTIVE_RECOMMENDED_SERVICE_PRIORITY
    );

  /* ================================== */
  /* STEP 4 — EXACT DUPLICATES */
  /* ================================== */

  leaks =
    removeExactDuplicates(
      leaks
    );

  /* ================================== */
  /* STEP 5 — STABLE ORDER */
  /* ================================== */

  return sortFinalLeaks(
    leaks
  );
}

/* ================================== */
/* RUN DETECTORS */
/* ================================== */

export async function runBusinessDetectors(
  request: DetectorRunnerRequest
): Promise<DetectorRunnerResult> {
  const {
    profile,
    rows,
    now = new Date(),
  } = request;

  registerDetectorCatalog();

  const availableFields =
    new Set(
      rows.flatMap(
        (row) =>
          Object.keys(row)
      )
    );

  const detectors =
    getSupportedDetectors(
      profile
    ).filter(
      (detector) => {
        const requiredFields =
          detector.requirements
            .requiredFields ??
          [];

        if (
          requiredFields.length ===
          0
        ) {
          return true;
        }

        return requiredFields.every(
          (field) =>
            availableFields.has(
              field
            )
        );
      }
    );

  const detectorResults:
    DetectorResult[] = [];

  const rawLeaks:
    DetectedBusinessLeak[] = [];

  const warnings:
    string[] = [];

  const errors:
    string[] = [];

  const analysisNow =
    new Date(
      now.getTime()
    );

  const context:
    DetectorContext = {
      profile,
      rows,
      now:
        analysisNow,
    };

  /* ================================== */
  /* RUN EVERY DETECTOR */
  /* ================================== */

  for (
    const detector of detectors
  ) {
    try {
      const result =
        await detector.detect(
          context
        );

      detectorResults.push(
        result
      );

      if (result.ran) {
        rawLeaks.push(
          ...result.leaks
        );
      }

      for (
        const warning of
        result.warnings
      ) {
        warnings.push(
          `[${detector.id}] ${warning}`
        );
      }

      for (
        const error of
        result.errors
      ) {
        errors.push(
          `[${detector.id}] ${error}`
        );
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unknown detector error.";

      errors.push(
        `[${detector.id}] ${message}`
      );

      detectorResults.push({
        detectorId:
          detector.id,

        ran: false,

        leaks: [],

        warnings: [],

        errors: [
          message,
        ],
      });
    }
  }

  /* ================================== */
  /* OWNERSHIP + DEDUPLICATION */
  /* ================================== */

  const leaks =
    applyOwnershipRules(
      rawLeaks
    );

  /* ================================== */
  /* EXECUTION SUMMARY */
  /* ================================== */

  const executionSummary:
    DetectorExecutionSummary[] =
    detectorResults.map(
      (result) => ({
        detectorId:
          result.detectorId,

        ran:
          result.ran,

        leakCount:
          result.leaks.length,

        warningCount:
          result.warnings.length,

        errorCount:
          result.errors.length,
      })
    );

  /* ================================== */
  /* FINAL TOTALS */
  /* ================================== */

  const totalEstimatedLoss =
    leaks.reduce(
      (
        total,
        leak
      ) =>
        total +
        safeMoney(
          leak.estimatedLoss
        ),
      0
    );

  const totalEstimatedRecovery =
    leaks.reduce(
      (
        total,
        leak
      ) =>
        total +
        safeMoney(
          leak.estimatedRecovery
        ),
      0
    );

  const detectorsRan =
    detectorResults.filter(
      (result) =>
        result.ran
    ).length;

  const detectorsFailed =
    detectorResults.filter(
      (result) =>
        result.errors.length >
        0
    ).length;

  /* ================================== */
  /* RETURN */
  /* ================================== */

  return {
    success:
      errors.length === 0,

    leaks,

    detectorResults,

    executionSummary,

    stats: {
      rowsAnalyzed:
        rows.length,

      detectorsSelected:
        detectors.length,

      detectorsRan,

      detectorsFailed,

      leaksFound:
        leaks.length,

      totalEstimatedLoss,

      totalEstimatedRecovery,

      warnings:
        warnings.length,

      errors:
        errors.length,
    },

    warnings,

    errors,
  };
}