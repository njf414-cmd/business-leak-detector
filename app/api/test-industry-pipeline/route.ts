import { NextResponse } from "next/server";

import {
  analyzeBusinessWithIntelligence,
} from "../../lib/business-intelligence/analysis-bridge";

import type {
  BusinessRow,
} from "../../lib/leak-engine";

/* ================================== */
/* TEST DATA */
/* ================================== */

const rows: BusinessRow[] = [
  {
    "Customer Name":
      "Pipeline Test Customer",

    vehicle:
      "BMW M340i",

    make:
      "BMW",

    model:
      "M340i",

    "Job Amount":
      "350",

    "Job Status":
      "Completed",

    "Invoice Amount":
      "350",

    "Amount Paid":
      "0",

    "Payment Status":
      "Unpaid",

    "Due Date":
      "2026-09-01",
  },
];

/* ================================== */
/* ROUTE */
/* ================================== */

export async function GET() {
  try {
    /*
      IMPORTANT:

      No profile is supplied here.

      The analysis bridge must classify
      the business and build the profile
      automatically.
    */

    const result =
      await analyzeBusinessWithIntelligence({
        rows,

        businessName:
          "Pipeline Auto Detailing",

        description:
          "Mobile car detailing and vehicle cleaning service.",

        now:
          new Date(
            "2026-09-20T12:00:00"
          ),
      });

    const expectedIndustry =
      "automotive";

    const industryPassed =
      result.profile.industry ===
      expectedIndustry;

    const classificationExists =
      result.industryClassification !==
      null;

    const detectorsRan =
      result.modularAnalysis
        .stats
        .detectorsRan;

    const detectorErrors =
      result.modularAnalysis
        .stats
        .errors;

    // This automotive bridge fixture runs 25 universal and 10 automotive detectors.
    const expectedDetectors = 35;

    const pipelinePassed =
      industryPassed &&
      classificationExists &&
      detectorsRan === expectedDetectors &&
      detectorErrors === 0;

    return NextResponse.json({
      success:
        pipelinePassed,

      message:
        pipelinePassed
          ? "Automatic industry pipeline test passed."
          : "Automatic industry pipeline test failed.",

      pipelinePassed,

      expectedIndustry,

      actualIndustry:
        result.profile.industry,

      classificationExists,

      classification:
        result.industryClassification,

      profile:
        result.profile,

      detectorHealth: {
        expectedDetectors,

        selected:
          result.modularAnalysis
            .stats
            .detectorsSelected,

        ran:
          detectorsRan,

        errors:
          detectorErrors,
      },

      dataQuality:
        result.dataQuality,

      comparison:
        result.comparison,

      leaks:
        result.modularAnalysis
          .leaks,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,

        error:
          error instanceof Error
            ? error.message
            : "Unknown industry pipeline test error.",
      },
      {
        status: 500,
      }
    );
  }
}