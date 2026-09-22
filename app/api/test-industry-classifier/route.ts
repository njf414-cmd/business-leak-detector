import { NextResponse } from "next/server";

import {
  classifyBusinessIndustry,
} from "../../lib/business-intelligence/industry-classifier";

import type {
  BusinessDataRow,
} from "../../lib/business-intelligence/detector-types";

/* ================================== */
/* TEST TYPES */
/* ================================== */

type IndustryTestCase = {
  name: string;

  businessName: string;

  description: string;

  rows: BusinessDataRow[];

  expectedIndustry: string;
};

/* ================================== */
/* TEST CASES */
/* ================================== */

const testCases:
  IndustryTestCase[] = [
    {
      name:
        "HVAC Company",

      businessName:
        "Comfort Pro HVAC",

      description:
        "Heating and air conditioning service company.",

      rows: [
        {
          "Customer Name":
            "John Smith",

          "service address":
            "123 Main St",

          technician:
            "Mike",

          "work order":
            "WO-1001",

          "Invoice Amount":
            "1200",
        },
      ],

      expectedIndustry:
        "home_services",
    },

    {
      name:
        "Auto Detailing Company",

      businessName:
        "Luxe Detailing",

      description:
        "Mobile car detailing and vehicle cleaning service.",

      rows: [
        {
          "Customer Name":
            "Nick Test",

          vehicle:
            "BMW",

          make:
            "BMW",

          model:
            "M340i",

          "Job Amount":
            "250",
        },
      ],

      expectedIndustry:
        "automotive",
    },

    {
      name:
        "Construction Company",

      businessName:
        "Premier Construction",

      description:
        "General contractor specializing in renovation and remodeling.",

      rows: [
        {
          "Customer Name":
            "Project Customer",

          project:
            "Kitchen Remodel",

          "contract value":
            "45000",

          "Job Status":
            "Active",
        },
      ],

      expectedIndustry:
        "construction",
    },

    {
      name:
        "Restaurant",

      businessName:
        "Main Street Grill",

      description:
        "Restaurant and bar serving food and drinks.",

      rows: [
        {
          table:
            "12",

          server:
            "Alex",

          "check total":
            "125",
        },
      ],

      expectedIndustry:
        "restaurant",
    },

    {
      name:
        "Real Estate Company",

      businessName:
        "Summit Realty",

      description:
        "Real estate brokerage and property management company.",

      rows: [
        {
          "Customer Name":
            "Property Owner",

          property:
            "Rental House",

          rent:
            "3200",

          tenant:
            "Tenant A",
        },
      ],

      expectedIndustry:
        "real_estate",
    },

    {
      name:
        "Gym",

      businessName:
        "Iron House Fitness",

      description:
        "Gym and personal training facility with monthly memberships.",

      rows: [
        {
          member:
            "Member A",

          membership:
            "Premium",

          "Recurring Amount":
            "79",

          "Recurring Status":
            "Active",
        },
      ],

      expectedIndustry:
        "health_fitness",
    },

    {
      name:
        "Dental Office",

      businessName:
        "Smile Dental",

      description:
        "Dental clinic providing patient care.",

      rows: [
        {
          patient:
            "Patient A",

          provider:
            "Dr Test",

          procedure:
            "Cleaning",

          "Invoice Amount":
            "200",
        },
      ],

      expectedIndustry:
        "healthcare",
    },

    {
      name:
        "Software Company",

      businessName:
        "CloudFlow SaaS",

      description:
        "Software platform sold through monthly subscriptions.",

      rows: [
        {
          subscription:
            "Pro",

          plan:
            "Monthly",

          mrr:
            "5000",

          "Recurring Amount":
            "99",
        },
      ],

      expectedIndustry:
        "software",
    },

    {
      name:
        "Unknown Business",

      businessName:
        "ABC Company",

      description:
        "",

      rows: [
        {
          "Customer Name":
            "Customer A",

          "Invoice Amount":
            "500",
        },
      ],

      expectedIndustry:
        "other",
    },
  ];

/* ================================== */
/* ROUTE */
/* ================================== */

export async function GET() {
  try {
    const results =
      testCases.map(
        (test) => {
          const classification =
            classifyBusinessIndustry({
              businessName:
                test.businessName,

              description:
                test.description,

              rows:
                test.rows,
            });

          const passed =
            classification.industry ===
            test.expectedIndustry;

          return {
            name:
              test.name,

            expectedIndustry:
              test.expectedIndustry,

            actualIndustry:
              classification.industry,

            confidence:
              classification.confidence,

            score:
              classification.score,

            passed,

            reasons:
              classification.reasons,

            industryScores:
              classification.industryScores,

            capabilities:
              classification.capabilities,
          };
        }
      );

    const failures =
      results.filter(
        (result) =>
          !result.passed
      );

    return NextResponse.json({
      success:
        failures.length === 0,

      message:
        failures.length === 0
          ? "Industry classifier test passed."
          : "Industry classifier test has failures.",

      totalTests:
        results.length,

      passedTests:
        results.length -
        failures.length,

      failedTests:
        failures.length,

      allTestsPassed:
        failures.length === 0,

      failures,

      results,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,

        error:
          error instanceof Error
            ? error.message
            : "Unknown industry classifier test error.",
      },
      {
        status: 500,
      }
    );
  }
}