import { NextResponse } from "next/server";

import {
  analyzeBusinessWithIntelligence,
} from "../../lib/business-intelligence/analysis-bridge";

import type {
  BusinessRow,
} from "../../lib/leak-engine";

type SimpleLeak = {
  customerName: string;
  leakType: string;
  estimatedLoss: number;
  estimatedRecovery: number;
};

type OwnershipExpectation = {
  customerName: string;
  mustContain: string[];
  mustNotContain: string[];
  expectedLossByType?: Record<
    string,
    number
  >;
};

function cleanText(
  value: unknown
): string {
  return String(
    value ?? ""
  ).trim();
}

function safeNumber(
  value: unknown
): number {
  const parsed =
    Number(value);

  return Number.isFinite(
    parsed
  )
    ? parsed
    : 0;
}

function normalizeLeak(
  leak: Record<
    string,
    unknown
  >
): SimpleLeak {
  return {
    customerName:
      cleanText(
        leak.customerName
      ) ||
      cleanText(
        leak.customer
      ) ||
      "Unknown Customer",

    leakType:
      cleanText(
        leak.leakType
      ) ||
      cleanText(
        leak.type
      ),

    estimatedLoss:
      safeNumber(
        leak.estimatedLoss ??
          leak.amount
      ),

    estimatedRecovery:
      safeNumber(
        leak.estimatedRecovery ??
          leak.recovery
      ),
  };
}

/* ================================== */
/* 9D OWNERSHIP TORTURE DATA */
/* ================================== */

const ownershipRows:
  BusinessRow[] = [
    /*
      TEST A

      Same row can look like both:
      - Missed Recurring Payment
      - Failed Payment

      The recurring detector should own
      the recurring charge.

      Expected final result:
      Missed Recurring Payment = $1,000
      Failed Payment = REMOVED
    */
    {
      "Customer Name":
        "Ownership Test A",

      "Recurring Amount":
        "1000",

      "Recurring Status":
        "Payment Failed",

      "Next Payment Date":
        "2026-09-01",

      "Invoice Amount":
        "1000",

      "Amount Paid":
        "0",

      "Payment Status":
        "Payment Failed",

      "Due Date":
        "2026-09-01",

      Status:
        "Payment Failed",
    },

    /*
      TEST B

      Same row looks like:
      - Unrenewed Customer
      - Churned Recurring Customer

      Renewal owns the event.

      Expected:
      Unrenewed Customer = $1,500
      Churned Recurring Customer = REMOVED
    */
    {
      "Customer Name":
        "Ownership Test B",

      "Renewal Amount":
        "1500",

      "Renewal Date":
        "2026-09-01",

      "Renewal Status":
        "Not Renewed",

      "Recurring Amount":
        "1500",

      "Recurring Status":
        "Churned",

      Status:
        "Churned",

      Date:
        "2026-09-01",
    },

    /*
      TEST C

      Explicit refund and overpayment
      represent the exact same $500.

      Refund should own the event.

      Expected:
      Unprocessed Refund = $500
      Overpayment = REMOVED
    */
    {
      "Customer Name":
        "Ownership Test C",

      "Invoice Amount":
        "2000",

      "Amount Paid":
        "2500",

      "Refund Amount":
        "500",

      "Payment Status":
        "Refund Pending",

      "Billing Status":
        "Refund Approved",
    },

    /*
      TEST D

      Deposit and generic payment leak
      represent the exact same $750.

      Deposit should own that $750.

      Expected:
      Uncollected Deposit = $750

      Generic $750 payment finding
      must not survive.
    */
    {
      "Customer Name":
        "Ownership Test D",

      Status:
        "Booked",

      "Job Status":
        "Scheduled",

      "Deposit Amount":
        "750",

      "Deposit Paid":
        "0",

      "Deposit Status":
        "Unpaid",

      "Invoice Amount":
        "750",

      "Amount Paid":
        "0",

      "Payment Status":
        "Unpaid",

      "Due Date":
        "2026-09-01",
    },

    /*
      TEST E

      IMPORTANT SAFETY TEST.

      Deposit and invoice are DIFFERENT
      amounts.

      These may represent two separate
      financial obligations.

      We must NOT delete the invoice just
      because a deposit exists.

      Expected:
      Uncollected Deposit = $500

      A payment-family leak for the
      $2,000 invoice may coexist.
    */
    {
      "Customer Name":
        "Ownership Test E",

      Status:
        "Booked",

      "Job Status":
        "Scheduled",

      "Deposit Amount":
        "500",

      "Deposit Paid":
        "0",

      "Deposit Status":
        "Unpaid",

      "Invoice Amount":
        "2000",

      "Amount Paid":
        "0",

      "Payment Status":
        "Unpaid",

      "Due Date":
        "2026-09-01",
    },

    /*
      TEST F

      Cancellation fee vs late fee.

      Fee Type explicitly says
      Cancellation Fee.

      #24 owns this.
      #25 must not claim it.
    */
    {
      "Customer Name":
        "Ownership Test F",

      "Fee Amount":
        "225",

      "Fee Type":
        "Cancellation Fee",

      "Fee Status":
        "Unpaid",

      "Appointment Status":
        "Cancelled",
    },

    /*
      TEST G

      Normal late fee.

      Must remain a late-fee finding.
    */
    {
      "Customer Name":
        "Ownership Test G",

      "Fee Amount":
        "400",

      "Fee Type":
        "Late Fee",

      "Fee Status":
        "Unpaid",
    },

    /*
      TEST H

      Renewal amount and recurring amount
      are deliberately different.

      This verifies that renewal ownership
      uses Renewal Amount and does not steal
      Recurring Amount.

      Expected:
      Unrenewed Customer = $2,500
    */
    {
      "Customer Name":
        "Ownership Test H",

      "Renewal Amount":
        "2500",

      "Renewal Date":
        "2026-09-01",

      "Renewal Status":
        "Not Renewed",

      "Recurring Amount":
        "400",

      "Recurring Status":
        "Active",

      Status:
        "Active",
    },
  ];

/* ================================== */
/* EXPECTATIONS */
/* ================================== */

const expectations:
  OwnershipExpectation[] = [
    {
      customerName:
        "Ownership Test A",

      mustContain: [
        "Missed Recurring Payment",
      ],

      mustNotContain: [
        "Partial Payment",
        "Failed Payment",
        "Overdue Invoice",
        "Unpaid Invoice",
      ],

      expectedLossByType: {
        "Missed Recurring Payment":
          1000,
      },
    },

    {
      customerName:
        "Ownership Test B",

      mustContain: [
        "Unrenewed Customer",
      ],

      mustNotContain: [
        "Churned Recurring Customer",
      ],

      expectedLossByType: {
        "Unrenewed Customer":
          1500,
      },
    },

    {
      customerName:
        "Ownership Test C",

      mustContain: [
        "Unprocessed Refund",
      ],

      mustNotContain: [
        "Overpayment",
      ],

      expectedLossByType: {
        "Unprocessed Refund":
          500,
      },
    },

    {
      customerName:
        "Ownership Test D",

      mustContain: [
        "Uncollected Deposit",
      ],

      mustNotContain: [
        "Partial Payment",
        "Failed Payment",
        "Overdue Invoice",
        "Unpaid Invoice",
        "Underpaid Job",
      ],

      expectedLossByType: {
        "Uncollected Deposit":
          750,
      },
    },

    {
      customerName:
        "Ownership Test E",

      mustContain: [
        "Uncollected Deposit",
        "Overdue Invoice",
      ],

      mustNotContain: [],

      expectedLossByType: {
        "Uncollected Deposit":
          500,

        "Overdue Invoice":
          2000,
      },
    },

    {
      customerName:
        "Ownership Test F",

      mustContain: [
        "Unpaid Cancellation Fee",
      ],

      mustNotContain: [
        "Uncollected Late Fee",
      ],

      expectedLossByType: {
        "Unpaid Cancellation Fee":
          225,
      },
    },

    {
      customerName:
        "Ownership Test G",

      mustContain: [
        "Uncollected Late Fee",
      ],

      mustNotContain: [
        "Unpaid Cancellation Fee",
      ],

      expectedLossByType: {
        "Uncollected Late Fee":
          400,
      },
    },

    {
      customerName:
        "Ownership Test H",

      mustContain: [
        "Unrenewed Customer",
      ],

      mustNotContain: [
        "Churned Recurring Customer",
      ],

      expectedLossByType: {
        "Unrenewed Customer":
          2500,
      },
    },
  ];

/* ================================== */
/* TEST REPORT */
/* ================================== */

function buildOwnershipReport(
  leaks: SimpleLeak[]
) {
  const results =
    expectations.map(
      (expectation) => {
        const customerLeaks =
          leaks.filter(
            (leak) =>
              leak.customerName ===
              expectation.customerName
          );

        const leakTypes =
          customerLeaks.map(
            (leak) =>
              leak.leakType
          );

        const containsPassed =
          expectation.mustContain.every(
            (type) =>
              leakTypes.includes(
                type
              )
          );

        const exclusionPassed =
          expectation.mustNotContain.every(
            (type) =>
              !leakTypes.includes(
                type
              )
          );

        const amountChecks =
          Object.entries(
            expectation
              .expectedLossByType ??
              {}
          ).map(
            ([
              leakType,
              expectedLoss,
            ]) => {
              const leak =
                customerLeaks.find(
                  (item) =>
                    item.leakType ===
                    leakType
                );

              const actualLoss =
                leak?.estimatedLoss ??
                0;

              const passed =
                leak !== undefined &&
                Math.abs(
                  actualLoss -
                    expectedLoss
                ) < 0.01;

              return {
                leakType,
                expectedLoss,
                actualLoss,
                passed,
              };
            }
          );

        const amountsPassed =
          amountChecks.every(
            (check) =>
              check.passed
          );

        return {
          customerName:
            expectation.customerName,

          customerLeaks,

          mustContain:
            expectation.mustContain,

          mustNotContain:
            expectation.mustNotContain,

          containsPassed,

          exclusionPassed,

          amountChecks,

          amountsPassed,

          passed:
            containsPassed &&
            exclusionPassed &&
            amountsPassed,
        };
      }
    );

  const failures =
    results.filter(
      (result) =>
        !result.passed
    );

  return {
    totalTests:
      results.length,

    passedTests:
      results.length -
      failures.length,

    failedTests:
      failures.length,

    allOwnershipTestsPassed:
      failures.length === 0,

    failures,

    results,
  };
}

/* ================================== */
/* ROUTE */
/* ================================== */

export async function GET() {
  try {
    const result =
      await analyzeBusinessWithIntelligence({
        rows:
          ownershipRows,

        now:
          new Date(
            "2026-09-19T12:00:00"
          ),
      });

    const modularLeaks =
      result.modularAnalysis
        .leaks.map(
          (leak) =>
            normalizeLeak(
              leak as unknown as
                Record<
                  string,
                  unknown
                >
            )
        );

    const ownershipReport =
      buildOwnershipReport(
        modularLeaks
      );

    const stats =
      result.modularAnalysis
        .stats;

    const detectorHealth = {
      expectedDetectors: 25,

      selected:
        stats.detectorsSelected,

      ran:
        stats.detectorsRan,

      failed:
        stats.detectorsFailed,

      errors:
        stats.errors,

      all25Healthy:
        stats.detectorsSelected ===
          25 &&
        stats.detectorsRan ===
          25 &&
        stats.detectorsFailed ===
          0 &&
        stats.errors === 0,
    };

    const ownershipReady =
      detectorHealth.all25Healthy &&
      ownershipReport
        .allOwnershipTestsPassed;

    return NextResponse.json({
      success: true,

      message:
        "9D-1 cross-detector ownership torture test completed.",

      ownershipReady,

      detectorHealth,

      ownershipReport,

      modularStats:
        result.modularAnalysis
          .stats,

      finalLeaks:
        modularLeaks,

      rawDetectorExecution:
        result.modularAnalysis
          .executionSummary,

      warnings:
        result.modularAnalysis
          .warnings,

      errors:
        result.modularAnalysis
          .errors,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,

        error:
          error instanceof Error
            ? error.message
            : "Unknown ownership test error.",
      },
      {
        status: 500,
      }
    );
  }
}