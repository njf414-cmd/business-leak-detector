import OpenAI from "openai";
import { NextResponse } from "next/server";

type RecoveryLeakInput = {
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
  status?: string;
  notes?: string;
  followUpDate?: string;
  contactAttempts?: number;
  lastContactedAt?: string | null;
};

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

    const body = await request.json();

    const leak: RecoveryLeakInput | null =
      body?.leak && typeof body.leak === "object"
        ? body.leak
        : null;

    if (!leak) {
      return NextResponse.json(
        {
          error: "No leak was provided.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * Build a controlled version of the leak.
     * The AI only receives information that already exists
     * inside the Business Leak Detector.
     */

    const safeLeak = {
      customer: leak.customer || "Unknown customer",
      type: leak.type || "Unknown leak type",
      category: leak.category || "Unknown",
      amount: Number(leak.amount) || 0,
      estimatedRecovery: Number(leak.recovery) || 0,
      severity: leak.severity || "Unknown",
      reason: leak.reason || "",
      currentRecommendedAction: leak.action || "",
      daysOpen: Number(leak.daysOpen) || 0,
      priorityScore: Number(leak.priorityScore) || 0,
      priorityLevel: leak.priorityLevel || "Unknown",
      status: leak.status || "Open",
      notes: leak.notes || "",
      followUpDate: leak.followUpDate || "",
      contactAttempts: Number(leak.contactAttempts) || 0,
      lastContactedAt: leak.lastContactedAt || null,
    };

    const response = await openai.responses.create({
      model: "gpt-5.6-luna",

      reasoning: {
        effort: "medium",
      },

      instructions: `
You are the AI Recovery Assistant inside a Business Leak Detector SaaS.

The deterministic leak detection engine has already identified a specific revenue leak.

Your job is NOT to decide whether the leak exists.

Your job is to help the business owner recover the revenue associated with this specific leak.

IMPORTANT RULES:

1. Treat the supplied leak data as authoritative.

2. Never invent:
- customer facts
- conversations
- dates
- payments
- promises
- objections
- transaction history
- contact information
- business policies
- discounts
- appointments
- dollar amounts

3. Never claim the customer said or did something unless it appears in the supplied data.

4. Do not change the leak amount or estimated recovery amount.

5. Do not promise that money will be recovered.

6. Clearly separate known facts from recommended strategy.

7. Recommendations should be practical for a small business owner.

8. Avoid manipulative, deceptive, threatening, or overly aggressive sales tactics.

9. Do not recommend pretending there is urgency, scarcity, a discount, or a deadline unless that fact exists in the supplied data.

10. If important information is missing, create a strategy that works without inventing it.

Your recovery plan must include:

RECOVERY SUMMARY
A concise explanation of how the owner should approach this opportunity.

NEXT BEST ACTION
The single most useful next action.

CONTACT STRATEGY
Explain which outreach approach should be used and why.

CUSTOMER MESSAGE
Write a short customer-facing message suitable for text or a short direct message.
It must be ready to copy and send.
Do not invent facts.

EMAIL
Write:
- a subject line
- a concise email body

PHONE SCRIPT
Write a natural call script the owner can use.
It should sound conversational, not robotic.

OBJECTION HANDLING
Provide several likely generic objections that could occur.
These are hypothetical possibilities, NOT claims that the customer actually made them.
For each one, provide a professional response.

FOLLOW-UP PLAN
Create a short sequence of follow-up steps.
Do not invent exact calendar dates.
Use relative timing such as "after 2 days" when appropriate.

STOP CONDITIONS
Explain when the owner should stop contacting the customer or close the recovery attempt.

CONFIDENCE
Rate confidence as high, medium, or low based only on how much useful information was supplied.

Keep everything concise, actionable, and professional.
`,

      input: `
Create a recovery plan for this detected revenue leak.

LEAK DATA:

${JSON.stringify(safeLeak, null, 2)}
`,

      text: {
        format: {
          type: "json_schema",
          name: "recovery_assistant_plan",
          strict: true,

          schema: {
            type: "object",
            additionalProperties: false,

            properties: {
              recoverySummary: {
                type: "string",
              },

              nextBestAction: {
                type: "string",
              },

              contactStrategy: {
                type: "string",
              },

              customerMessage: {
                type: "string",
              },

              email: {
                type: "object",
                additionalProperties: false,

                properties: {
                  subject: {
                    type: "string",
                  },

                  body: {
                    type: "string",
                  },
                },

                required: ["subject", "body"],
              },

              phoneScript: {
                type: "string",
              },

              objectionHandling: {
                type: "array",

                items: {
                  type: "object",
                  additionalProperties: false,

                  properties: {
                    objection: {
                      type: "string",
                    },

                    response: {
                      type: "string",
                    },
                  },

                  required: ["objection", "response"],
                },
              },

              followUpPlan: {
                type: "array",

                items: {
                  type: "object",
                  additionalProperties: false,

                  properties: {
                    step: {
                      type: "string",
                    },

                    timing: {
                      type: "string",
                    },

                    action: {
                      type: "string",
                    },
                  },

                  required: ["step", "timing", "action"],
                },
              },

              stopConditions: {
                type: "array",

                items: {
                  type: "string",
                },
              },

              confidence: {
                type: "string",
                enum: ["low", "medium", "high"],
              },
            },

            required: [
              "recoverySummary",
              "nextBestAction",
              "contactStrategy",
              "customerMessage",
              "email",
              "phoneScript",
              "objectionHandling",
              "followUpPlan",
              "stopConditions",
              "confidence",
            ],
          },
        },
      },
    });

    const output = response.output_text;

    if (!output) {
      throw new Error(
        "The AI Recovery Assistant returned an empty response."
      );
    }

    const recoveryPlan = JSON.parse(output);

    return NextResponse.json({
      success: true,
      recoveryPlan,
    });
  } catch (error) {
    console.error("AI recovery assistant error:", error);

    return NextResponse.json(
      {
        error: "AI Recovery Assistant failed.",
      },
      {
        status: 500,
      }
    );
  }
}