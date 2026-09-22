import OpenAI from "openai";
import { NextResponse } from "next/server";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type LeakInput = {
  customer?: string;
  type?: string;
  category?: string;
  amount?: number;
  recovery?: number;
  severity?: string;
  reason?: string;
  action?: string;
  daysOpen?: number;
  priorityScore?: number;
  priorityLevel?: string;
};

export async function POST(request: Request) {
  try {
    /* ================================== */
    /* CHECK API KEY */
    /* ================================== */

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        {
          error: "OPENAI_API_KEY is not configured.",
        },
        {
          status: 500,
        }
      );
    }

    /* ================================== */
    /* READ REQUEST */
    /* ================================== */

    const body = await request.json();

    const leaks: LeakInput[] = Array.isArray(body?.leaks)
      ? body.leaks
      : [];

    const previousScan =
      body?.previousScan &&
      typeof body.previousScan === "object"
        ? body.previousScan
        : null;

    if (leaks.length === 0) {
      return NextResponse.json(
        {
          error: "No leaks were provided for AI analysis.",
        },
        {
          status: 400,
        }
      );
    }

    /* ================================== */
    /* SANITIZE LEAK INPUT */
    /* ================================== */

    const safeLeaks = leaks.slice(0, 100).map((leak) => ({
      customer: leak.customer || "Unknown",

      type: leak.type || "Unknown",

      category: leak.category || "Unknown",

      amount: Number(leak.amount) || 0,

      recovery: Number(leak.recovery) || 0,

      severity: leak.severity || "Unknown",

      reason: leak.reason || "",

      action: leak.action || "",

      daysOpen: Number(leak.daysOpen) || 0,

      priorityScore: Number(leak.priorityScore) || 0,

      priorityLevel: leak.priorityLevel || "Unknown",
    }));

    /* ================================== */
    /* DETERMINISTIC BUSINESS METRICS */
    /* ================================== */

    const recoverableLeaks = safeLeaks.filter(
      (leak) => leak.category === "Recoverable"
    );

    const lostLeaks = safeLeaks.filter(
      (leak) => leak.category === "Lost"
    );

    const totalRevenueAtRisk = recoverableLeaks.reduce(
      (total, leak) => total + leak.amount,
      0
    );

    const totalEstimatedRecovery = recoverableLeaks.reduce(
      (total, leak) => total + leak.recovery,
      0
    );

    const totalLostRevenue = lostLeaks.reduce(
      (total, leak) => total + leak.amount,
      0
    );

    /* ================================== */
    /* LEAK TYPE BREAKDOWN */
    /* ================================== */

    const typeBreakdown: Record<
      string,
      {
        count: number;
        amount: number;
        recovery: number;
      }
    > = {};

    for (const leak of safeLeaks) {
      if (!typeBreakdown[leak.type]) {
        typeBreakdown[leak.type] = {
          count: 0,
          amount: 0,
          recovery: 0,
        };
      }

      typeBreakdown[leak.type].count += 1;
      typeBreakdown[leak.type].amount += leak.amount;
      typeBreakdown[leak.type].recovery += leak.recovery;
    }

    const leakTypeSummary = Object.entries(typeBreakdown)
      .map(([type, data]) => ({
        type,
        count: data.count,
        amount: data.amount,
        recovery: data.recovery,
      }))
      .sort((a, b) => b.amount - a.amount);

    /* ================================== */
    /* CATEGORY BREAKDOWN */
    /* ================================== */

    const categoryBreakdown: Record<
      string,
      {
        count: number;
        amount: number;
        recovery: number;
      }
    > = {};

    for (const leak of safeLeaks) {
      if (!categoryBreakdown[leak.category]) {
        categoryBreakdown[leak.category] = {
          count: 0,
          amount: 0,
          recovery: 0,
        };
      }

      categoryBreakdown[leak.category].count += 1;
      categoryBreakdown[leak.category].amount += leak.amount;
      categoryBreakdown[leak.category].recovery += leak.recovery;
    }

    const categorySummary = Object.entries(categoryBreakdown)
      .map(([category, data]) => ({
        category,
        count: data.count,
        amount: data.amount,
        recovery: data.recovery,
      }))
      .sort((a, b) => b.amount - a.amount);

    /* ================================== */
    /* HIGHEST PRIORITY LEAK */
    /* ================================== */

    const highestPriorityLeak = [...safeLeaks].sort(
      (a, b) => b.priorityScore - a.priorityScore
    )[0];

    /* ================================== */
    /* AGE METRICS */
    /* ================================== */

    const leaksWithAge = safeLeaks.filter(
      (leak) => leak.daysOpen > 0
    );

    const averageDaysOpen =
      leaksWithAge.length > 0
        ? Math.round(
            leaksWithAge.reduce(
              (total, leak) => total + leak.daysOpen,
              0
            ) / leaksWithAge.length
          )
        : 0;

    const oldestLeak =
      leaksWithAge.length > 0
        ? [...leaksWithAge].sort(
            (a, b) => b.daysOpen - a.daysOpen
          )[0]
        : null;

    /* ================================== */
    /* PREVIOUS SCAN */
    /* ================================== */

    const safePreviousScan = previousScan
      ? {
          revenueAtRisk:
            Number(previousScan.revenueAtRisk) || 0,

          estimatedRecovery:
            Number(previousScan.estimatedRecovery) || 0,

          leakCount:
            Number(previousScan.leakCount) || 0,
        }
      : null;

    /* ================================== */
    /* CONTEXT FOR AI */
    /* ================================== */

    const businessMetrics = {
      leakCount: safeLeaks.length,

      recoverableLeakCount: recoverableLeaks.length,

      lostLeakCount: lostLeaks.length,

      totalRevenueAtRisk,

      totalEstimatedRecovery,

      totalLostRevenue,

      averageDaysOpen,

      highestPriorityLeak: highestPriorityLeak
        ? {
            customer: highestPriorityLeak.customer,
            type: highestPriorityLeak.type,
            amount: highestPriorityLeak.amount,
            recovery: highestPriorityLeak.recovery,
            priorityScore: highestPriorityLeak.priorityScore,
            priorityLevel: highestPriorityLeak.priorityLevel,
          }
        : null,

      oldestLeak: oldestLeak
        ? {
            customer: oldestLeak.customer,
            type: oldestLeak.type,
            daysOpen: oldestLeak.daysOpen,
            amount: oldestLeak.amount,
          }
        : null,

      leakTypeSummary,

      categorySummary,

      previousScan: safePreviousScan,
    };

    /* ================================== */
    /* AI ANALYSIS */
    /* ================================== */

    const response = await openai.responses.create({
      model: "gpt-5.6-luna",

      reasoning: {
        effort: "medium",
      },

      instructions: `
You are the AI intelligence layer for a SaaS product called Business Leak Detector.

A deterministic rule-based leak engine has already analyzed the business data and identified potential revenue leaks.

You are NOT responsible for replacing the deterministic leak engine.

Your job is to turn the confirmed leak-engine output into a concise, useful business intelligence report for a small business owner.

The report has TWO purposes:

1. Explain the detected revenue leakage.
2. Give the business owner an executive-level summary of what deserves attention right now.

IMPORTANT RULES:

- Never invent financial facts.
- Never invent customers.
- Never invent transactions.
- Never invent dates.
- Never invent dollar amounts.
- Never invent historical changes.
- Never claim a trend exists unless previous-scan data is supplied.
- Never claim causation when the data only supports correlation or a possible operational explanation.
- Clearly distinguish a likely operational cause from a confirmed cause.
- Use dollar amounts only when supported by the supplied data.
- Clearly acknowledge when available data is insufficient.
- Prioritize practical revenue-recovery actions.
- Focus on patterns across multiple leaks when possible.
- Keep language understandable for a small business owner.
- Avoid unnecessary jargon.
- Keep recommendations specific and actionable.
- Do not repeat the same point across every field.
- Do not exaggerate the seriousness of small or ambiguous leaks.
- Treat deterministic metrics supplied by the application as authoritative.
- Do not recalculate financial totals differently from the supplied business metrics.

BUSINESS SUMMARY REQUIREMENTS:

The business summary should quickly answer:

- What is happening?
- How much recoverable revenue is currently at risk?
- What type of leak appears to be the biggest problem?
- What deserves attention first?
- Is there a meaningful pattern across the detected leaks?
- If previous-scan information exists, what meaningfully changed?
- If previous-scan information does NOT exist, explicitly say that a trend cannot yet be determined.
- What should the owner focus on now?

HEALTH STATUS:

Return one of:

"stable"
"attention"
"critical"

Use these carefully.

"stable":
The detected leakage is limited, lower urgency, or there is no strong evidence of widespread operational leakage.

"attention":
There are meaningful recoverable leaks or repeated operational problems that deserve action.

"critical":
Use only when the supplied data strongly supports unusually severe, widespread, or highly urgent revenue leakage.

Do not use "critical" simply because a leak exists.

CONFIDENCE:

Use "high" only when the supplied data strongly supports the conclusion.

Use "medium" when the pattern is reasonable but some important information is missing.

Use "low" when the available data is limited or ambiguous.

TREND DIRECTION:

Return:

"improving"
"worsening"
"stable"
"unknown"

If previous-scan information is unavailable, trendDirection MUST be "unknown".

If previous-scan information exists, use the supplied metrics to describe the change without inventing explanations for why the change occurred.

PRIORITY FOCUS:

priorityFocus should be a short phrase describing the single operational area that deserves the owner's attention first.

Examples of the style:

"Follow up on open estimates"
"Collect overdue invoices"
"Recover unbooked leads"
"Reduce appointment no-shows"

Do not copy these examples unless supported by the actual data.

Analyze:

1. The largest source of revenue leakage.
2. Patterns appearing across multiple leaks.
3. The most urgent opportunity.
4. The likely operational cause of the detected leakage.
5. What the business should address first.
6. Why that action matters.
7. Practical steps that could recover revenue.
8. Areas where the supplied data is insufficient for a strong conclusion.
9. The overall business leak-health status.
10. Whether the latest scan is improving, worsening, stable, or cannot yet be compared.

Return ONLY valid JSON matching the required schema.
      `,

      input: `
Analyze the following Business Leak Detector results.

DETERMINISTIC BUSINESS METRICS:

${JSON.stringify(businessMetrics, null, 2)}

DETECTED LEAKS:

${JSON.stringify(safeLeaks, null, 2)}
      `,

      text: {
        format: {
          type: "json_schema",

          name: "business_leak_analysis",

          strict: true,

          schema: {
            type: "object",

            additionalProperties: false,

            properties: {
              /* ================================== */
              /* EXISTING 6B OUTPUT */
              /* ================================== */

              executiveSummary: {
                type: "string",
              },

              rootCause: {
                type: "string",
              },

              highestPriorityAction: {
                type: "string",
              },

              recoveryStrategy: {
                type: "string",
              },

              confidence: {
                type: "string",

                enum: [
                  "low",
                  "medium",
                  "high",
                ],
              },

              insights: {
                type: "array",

                items: {
                  type: "object",

                  additionalProperties: false,

                  properties: {
                    title: {
                      type: "string",
                    },

                    explanation: {
                      type: "string",
                    },

                    recommendedAction: {
                      type: "string",
                    },
                  },

                  required: [
                    "title",
                    "explanation",
                    "recommendedAction",
                  ],
                },
              },

              /* ================================== */
              /* NEW 6C BUSINESS SUMMARY */
              /* ================================== */

              businessSummary: {
                type: "object",

                additionalProperties: false,

                properties: {
                  headline: {
                    type: "string",
                  },

                  overview: {
                    type: "string",
                  },

                  healthStatus: {
                    type: "string",

                    enum: [
                      "stable",
                      "attention",
                      "critical",
                    ],
                  },

                  priorityFocus: {
                    type: "string",
                  },

                  biggestLeakArea: {
                    type: "string",
                  },

                  biggestLeakExplanation: {
                    type: "string",
                  },

                  trendDirection: {
                    type: "string",

                    enum: [
                      "improving",
                      "worsening",
                      "stable",
                      "unknown",
                    ],
                  },

                  trendExplanation: {
                    type: "string",
                  },

                  ownerFocus: {
                    type: "array",

                    items: {
                      type: "string",
                    },
                  },
                },

                required: [
                  "headline",
                  "overview",
                  "healthStatus",
                  "priorityFocus",
                  "biggestLeakArea",
                  "biggestLeakExplanation",
                  "trendDirection",
                  "trendExplanation",
                  "ownerFocus",
                ],
              },
            },

            required: [
              "executiveSummary",
              "rootCause",
              "highestPriorityAction",
              "recoveryStrategy",
              "confidence",
              "insights",
              "businessSummary",
            ],
          },
        },
      },
    });

    /* ================================== */
    /* READ AI OUTPUT */
    /* ================================== */

    const output = response.output_text;

    if (!output) {
      throw new Error(
        "The AI returned an empty response."
      );
    }

    const analysis = JSON.parse(output);

    /* ================================== */
    /* RETURN RESULT */
    /* ================================== */

    return NextResponse.json({
      success: true,

      analysis,

      metrics: businessMetrics,
    });
  } catch (error) {
    console.error(
      "AI analysis error:",
      error
    );

    return NextResponse.json(
      {
        error: "AI analysis failed.",
      },
      {
        status: 500,
      }
    );
  }
}