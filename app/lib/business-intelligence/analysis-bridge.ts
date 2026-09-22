import {
  analyzeBusinessRows,
  type BusinessRow,
  type Leak,
} from "../leak-engine";

import {
  runBusinessDetectors,
  type DetectorRunnerResult,
} from "./detector-runner";

import {
  createDefaultBusinessProfile,
  type BusinessIntelligenceProfile,
} from "./types";

import {
  adaptBusinessRows,
} from "./data-adapter";

import {
  validateBusinessData,
  type DataQualityResult,
} from "./data-quality";

import {
  buildBusinessProfileFromData,
  type IndustryClassification,
  classifyBusinessIndustry,
} from "./industry-classifier";

/* ================================== */
/* TYPES */
/* ================================== */

export type BusinessAnalysisRequest = {
  rows: BusinessRow[];

  /*
    Optional explicit profile.

    If supplied, this profile wins.

    If omitted, the system automatically
    builds a profile from the uploaded data.
  */

  profile?: BusinessIntelligenceProfile;

  /*
    Optional business context improves
    automatic industry classification.
  */

  businessName?: string | null;

  description?: string | null;

  /*
    Optional deterministic clock.

    Production:
      If omitted, all systems use the
      real current time.

    Tests:
      Pass a fixed Date so every system
      evaluates date rules against the
      exact same moment.
  */

  now?: Date;
};

export type BusinessAnalysisResult = {
  /*
    Existing production engine remains
    available during migration.
  */

  leaks: Leak[];

  /*
    Final profile actually used by the
    modular intelligence engine.
  */

  profile:
    BusinessIntelligenceProfile;

  /*
    Classification information explains
    how the automatic profile was chosen.

    Null means an explicit profile was
    supplied by the caller.
  */

  industryClassification:
    IndustryClassification | null;

  /*
    Modular detector engine.
  */

  modularAnalysis:
    DetectorRunnerResult;

  /*
    Data quality result for the same
    canonical rows supplied to detectors.
  */

  dataQuality:
    DataQualityResult;

  comparison: {
    legacyLeakCount: number;

    modularLeakCount: number;

    legacyEstimatedRecovery: number;

    modularEstimatedRecovery: number;

    modularDetectorsSelected: number;

    modularDetectorsRan: number;

    modularErrors: number;

    dataQualityScore: number;

    dataQualityErrors: number;

    dataQualityWarnings: number;

    detectedIndustry: string;

    industryConfidence:
      | "low"
      | "medium"
      | "high"
      | null;

    industryScore:
      number | null;
  };
};

/* ================================== */
/* MONEY SAFETY */
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

/* ================================== */
/* ANALYSIS BRIDGE */
/* ================================== */

export async function analyzeBusinessWithIntelligence(
  request: BusinessAnalysisRequest
): Promise<BusinessAnalysisResult> {
  const {
    rows,
    profile:
      suppliedProfile,
    businessName = null,
    description = null,
    now = new Date(),
  } = request;

  /*
    SHARED ANALYSIS CLOCK

    Legacy engine, validator, and modular
    detector engine all receive the exact
    same analysis time.
  */

  const analysisNow =
    new Date(
      now.getTime()
    );

  /*
    EXISTING PRODUCTION ENGINE

    Legacy behavior remains available while
    the modular intelligence system
    continues to mature.
  */

  const leaks =
    analyzeBusinessRows(
      rows,
      analysisNow
    );

  /*
    CANONICAL DATA ADAPTER

    Converts source-specific aliases into
    standardized business fields while
    preserving original fields.
  */

  const adaptedRows =
    adaptBusinessRows(
      rows
    );

  /*
    DATA QUALITY ENGINE

    Validate standardized rows before
    relying on them for intelligence.

    Warnings do not block analysis.
  */

  const dataQuality =
    validateBusinessData(
      adaptedRows,
      analysisNow
    );

  /* ================================== */
  /* BUSINESS / INDUSTRY IDENTIFICATION */
  /* ================================== */

  let industryClassification:
    IndustryClassification | null =
      null;

  let resolvedProfile:
    BusinessIntelligenceProfile;

  if (suppliedProfile) {
    /*
      Explicit profiles always win.

      This allows onboarding, admins, or
      future integrations to override
      automatic classification.
    */

    resolvedProfile =
      suppliedProfile;
  } else {
    /*
      Automatically inspect the business
      context and uploaded data.
    */

    industryClassification =
      classifyBusinessIndustry({
        rows:
          adaptedRows,

        businessName,

        description,
      });

    resolvedProfile =
      buildBusinessProfileFromData({
        rows:
          adaptedRows,

        businessName,

        description,
      });

    /*
      Defensive fallback.

      The profile builder should always
      return a valid profile, but keeping
      this boundary makes the analysis
      pipeline resilient to future changes.
    */

    if (!resolvedProfile) {
      resolvedProfile =
        createDefaultBusinessProfile();
    }
  }

  /*
    MODULAR DETECTOR ENGINE

    The detector registry can now select
    universal + future industry-specific
    detectors using the resolved profile.
  */

  const modularAnalysis =
    await runBusinessDetectors({
      profile:
        resolvedProfile,

      rows:
        adaptedRows,

      now:
        analysisNow,
    });

  /* ================================== */
  /* LEGACY TOTALS */
  /* ================================== */

  const legacyEstimatedRecovery =
    leaks.reduce(
      (
        total,
        leak
      ) =>
        total +
        safeMoney(
          leak.recovery
        ),
      0
    );

  /* ================================== */
  /* RETURN */
  /* ================================== */

  return {
    leaks,

    profile:
      resolvedProfile,

    industryClassification,

    modularAnalysis,

    dataQuality,

    comparison: {
      legacyLeakCount:
        leaks.length,

      modularLeakCount:
        modularAnalysis
          .stats
          .leaksFound,

      legacyEstimatedRecovery,

      modularEstimatedRecovery:
        modularAnalysis
          .stats
          .totalEstimatedRecovery,

      modularDetectorsSelected:
        modularAnalysis
          .stats
          .detectorsSelected,

      modularDetectorsRan:
        modularAnalysis
          .stats
          .detectorsRan,

      modularErrors:
        modularAnalysis
          .stats
          .errors,

      dataQualityScore:
        dataQuality.score,

      dataQualityErrors:
        dataQuality.errors,

      dataQualityWarnings:
        dataQuality.warnings,

      detectedIndustry:
        resolvedProfile.industry,

      industryConfidence:
        industryClassification
          ?.confidence ??
        null,

      industryScore:
        industryClassification
          ?.score ??
        null,
    },
  };
}