import OpenAI from "openai";
import { NextResponse } from "next/server";

/* ================================== */
/* TYPES */
/* ================================== */

type SourceRow = Record<string, unknown>;

type ConfirmedLeak = {
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

type DiscoveryRequestBody = {
  sourceRows?: SourceRow[];
  confirmedLeaks?: ConfirmedLeak[];
  fileName?: string;
};

const MAX_ROWS = 500;
const MAX_VALUE_LENGTH = 500;

/* ================================== */
/* HELPERS */
/* ================================== */

function sanitizeValue(value: unknown): unknown {
  if (
    value === null ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (typeof value === "string") {
    return value.slice(0, MAX_VALUE_LENGTH);
  }

  if (Array.isArray(value)) {
    return value.slice(0, 25).map(sanitizeValue);
  }

  if (typeof value === "object" && value !== null) {
    const cleaned: Record<string, unknown> = {};

    for (const [key, nestedValue] of Object.entries(value).slice(0, 50)) {
      cleaned[key.slice(0, 100)] = sanitizeValue(nestedValue);
    }

    return cleaned;
  }

  return String(value).slice(0, MAX_VALUE_LENGTH);
}

function sanitizeRows(rows: SourceRow[]) {
  return rows.slice(0, MAX_ROWS).map((row) => {
    const cleaned: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(row).slice(0, 75)) {
      cleaned[key.slice(0, 100)] = sanitizeValue(value);
    }

    return cleaned;
  });
}

/* ================================== */
/* POST */
/* ================================== */

export async function POST(request: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          error: "OPENAI_API_KEY is not configured.",
        },
        {
          status: 500,
        }
      );
    }

    const openai = new OpenAI({
      apiKey,
    });

    const body = (await request.json()) as DiscoveryRequestBody;

    const sourceRows = Array.isArray(body?.sourceRows)
      ? sanitizeRows(body.sourceRows)
      : [];

    const confirmedLeaks = Array.isArray(body?.confirmedLeaks)
      ? body.confirmedLeaks
      : [];

    if (sourceRows.length === 0) {
      return NextResponse.json(
        {
          error:
            "No original business data was provided for AI Discovery.",
        },
        {
          status: 400,
        }
      );
    }

    const safeConfirmedLeaks = confirmedLeaks.slice(0, 500).map((leak) => ({
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

    const response = await openai.responses.create({
      model: "gpt-5.6-luna",

      reasoning: {
        effort: "medium",
      },

      instructions: `
You are the AI Discovery Layer inside a Business Leak Detector SaaS.

The product already has a deterministic leak detection engine.

That deterministic engine detects these 14 CONFIRMED leak types:

1. Abandoned Lead
2. Unbooked Lead
3. Stale Lead
4. Lost Lead
5. Unsent Estimate
6. Unfollowed Estimate
7. Stale Estimate
8. Expired Estimate
9. Unpaid Invoice
10. Overdue Invoice
11. Failed Payment
12. Partial Payment
13. No-Show
14. Cancelled Job

You are NOT replacing that engine.

Your job is to inspect the ORIGINAL BUSINESS DATA and discover additional
patterns, anomalies, process weaknesses, or possible revenue leaks that the
existing deterministic rules may not cover.

CRITICAL DISTINCTION:

DETERMINISTIC ENGINE
= confirmed rule-based leaks.

AI DISCOVERY
= potential patterns or opportunities that require human review.

Never describe an AI discovery as confirmed.

Use language such as:
- potential
- possible
- appears
- may indicate
- worth reviewing

Do not claim certainty unless the supplied data directly proves the fact.

==================================================
ANTI-HALLUCINATION RULES
==================================================

You may ONLY use information contained in the supplied business rows and
confirmed leak list.

Never invent:

- customers
- payments
- conversations
- appointments
- transactions
- dates
- contact attempts
- estimates
- invoices
- policies
- discounts
- revenue
- costs
- margins
- conversion rates
- employee behavior
- customer intent
- business procedures

Do not assume what a column means if its meaning is unclear.

If evidence is insufficient, do not create a discovery.

It is acceptable to return zero discoveries.

Zero high-quality discoveries is better than fabricated discoveries.

==================================================
DUPLICATE PREVENTION
==================================================

You will also receive the leaks already detected by the deterministic engine.

Do NOT simply rediscover those same leaks.

Do NOT create an AI discovery that is merely another description of one of
the 14 confirmed leak types.

Look for DIFFERENT patterns.

Examples of potentially useful discovery areas include, when supported by
the actual supplied data:

- repeated operational bottlenecks
- unusual concentrations of revenue exposure
- customer groups repeatedly failing to progress
- unusual delays between stages
- inconsistent workflow behavior
- repeated process gaps
- possible repeat-customer retention gaps
- abnormal transaction patterns
- unusual clusters by status
- unusually high-value opportunities receiving weaker follow-up
- inconsistent handling of similar opportunities
- possible data-quality problems that could hide revenue leaks
- combinations of fields that appear associated with poor outcomes
- workflow stages where opportunities repeatedly stall
- patterns spanning multiple rows that a single-row rule would miss

These are examples only.

Do NOT force these patterns if the data does not support them.

==================================================
EVIDENCE
==================================================

Every discovery must include evidence.

Evidence should explain exactly what in the supplied data caused the
discovery.

Whenever possible include:

- number of affected rows
- relevant statuses
- relevant values
- observed timing patterns
- observed field combinations
- affected dollar amount if directly calculable

Do not fabricate precision.

==================================================
FINANCIAL IMPACT
==================================================

Only provide estimated financial impact when it can be reasonably derived
from supplied numeric data.

If impact cannot be supported, use 0.

Do not invent recovery percentages.

Do not claim the estimated impact is guaranteed recoverable revenue.

==================================================
CONFIDENCE
==================================================

Confidence must reflect evidence strength:

HIGH
= strong repeated pattern directly visible in the supplied data.

MEDIUM
= meaningful pattern exists but interpretation contains uncertainty.

LOW
= weak but potentially useful signal requiring significant human review.

==================================================
PRIORITY
==================================================

Priority should consider:

- financial exposure
- number of affected records
- strength of evidence
- practical ability to investigate or fix the issue

Priority values:

Critical
High
Medium
Low

Do not use Critical unless the supplied evidence genuinely supports it.

==================================================
DATA QUALITY
==================================================

If missing, inconsistent, or malformed data prevents reliable leak
detection, you may report that as a data-quality discovery.

Explain specifically which fields or patterns are causing the problem.

Do not automatically treat every blank cell as a problem.

==================================================
OUTPUT PURPOSE
==================================================

The output will be shown directly to a small business owner.

Keep discoveries:

- understandable
- concise
- actionable
- evidence-based
- non-technical when possible

Each discovery should answer:

1. What potential issue did we notice?
2. What evidence supports it?
3. Why could it matter?
4. What should the owner review or do next?
`,

      input: `
Analyze the following business dataset for additional POTENTIAL revenue leaks,
patterns, anomalies, workflow weaknesses, or data-quality issues that are NOT
already represented by the deterministic leak engine.

FILE:
${body?.fileName || "Unknown file"}

ORIGINAL BUSINESS ROWS:
${JSON.stringify(sourceRows, null, 2)}

CONFIRMED DETERMINISTIC LEAKS:
${JSON.stringify(safeConfirmedLeaks, null, 2)}
`,

      text: {
        format: {
          type: "json_schema",
          name: "ai_discovery_results",
          strict: true,

          schema: {
            type: "object",
            additionalProperties: false,

            properties: {
              summary: {
                type: "string",
              },

              discoveryCount: {
                type: "number",
              },

              overallConfidence: {
                type: "string",
                enum: ["low", "medium", "high"],
              },

              discoveries: {
                type: "array",

                items: {
                  type: "object",
                  additionalProperties: false,

                  properties: {
                    title: {
                      type: "string",
                    },

                    category: {
                      type: "string",
                      enum: [
                        "Revenue Opportunity",
                        "Workflow Gap",
                        "Customer Pattern",
                        "Operational Pattern",
                        "Data Quality",
                        "Other",
                      ],
                    },

                    description: {
                      type: "string",
                    },

                    evidence: {
                      type: "array",
                      items: {
                        type: "string",
                      },
                    },

                    affectedRecords: {
                      type: "number",
                    },

                    estimatedImpact: {
                      type: "number",
                    },

                    confidence: {
                      type: "string",
                      enum: ["low", "medium", "high"],
                    },

                    priority: {
                      type: "string",
                      enum: [
                        "Critical",
                        "High",
                        "Medium",
                        "Low",
                      ],
                    },

                    recommendedReview: {
                      type: "string",
                    },

                    recommendedAction: {
                      type: "string",
                    },
                  },

                  required: [
                    "title",
                    "category",
                    "description",
                    "evidence",
                    "affectedRecords",
                    "estimatedImpact",
                    "confidence",
                    "priority",
                    "recommendedReview",
                    "recommendedAction",
                  ],
                },
              },
            },

            required: [
              "summary",
              "discoveryCount",
              "overallConfidence",
              "discoveries",
            ],
          },
        },
      },
    });

    const output = response.output_text;

    if (!output) {
      throw new Error(
        "AI Discovery returned an empty response."
      );
    }

    const discovery = JSON.parse(output);

    if (!Array.isArray(discovery.discoveries)) {
      throw new Error(
        "AI Discovery returned an invalid discovery list."
      );
    }

    /*
     * Never trust the model's count when we can calculate it ourselves.
     */
    discovery.discoveryCount = discovery.discoveries.length;

    return NextResponse.json({
      success: true,
      discovery,
      metadata: {
        rowsAnalyzed: sourceRows.length,
        rowsLimited: body?.sourceRows
          ? body.sourceRows.length > MAX_ROWS
          : false,
        confirmedLeaksProvided: safeConfirmedLeaks.length,
      },
    });
  } catch (error) {
    console.error("AI Discovery error:", error);

    return NextResponse.json(
      {
        error: "AI Discovery failed.",
      },
      {
        status: 500,
      }
    );
  }
}