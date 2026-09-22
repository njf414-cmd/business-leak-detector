import type {
    BusinessLeakDetector,
    DetectorContext,
    DetectorResult,
    DetectedBusinessLeak,
  } from "../../../detector-types";
  
  /* ================================== */
  /* HELPERS */
  /* ================================== */
  
  function cleanText(
    value: unknown
  ): string {
    return String(
      value ?? ""
    ).trim();
  }
  
  function normalizeText(
    value: unknown
  ): string {
    return cleanText(value)
      .toLowerCase()
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ");
  }
  
  function parseMoney(
    value: unknown
  ): number | null {
    const cleaned =
      cleanText(value)
        .replace(/[$,\s]/g, "");
  
    if (
      !cleaned ||
      !/^\d+(\.\d+)?$/.test(
        cleaned
      )
    ) {
      return null;
    }
  
    const parsed =
      Number(cleaned);
  
    return Number.isFinite(parsed)
      ? parsed
      : null;
  }
  
  function parseDate(
    value: unknown
  ): Date | null {
    const text =
      cleanText(value);
  
    if (!text) {
      return null;
    }
  
    const parsed =
      new Date(text);
  
    if (
      Number.isNaN(
        parsed.getTime()
      )
    ) {
      return null;
    }
  
    return parsed;
  }
  
  function isOutstanding(
    value: unknown
  ): boolean {
    const status =
      normalizeText(value);
  
    return [
      "unpaid",
      "outstanding",
      "overdue",
      "past due",
      "pending",
      "open",
    ].includes(status);
  }
  
  function isPaid(
    value: unknown
  ): boolean {
    const status =
      normalizeText(value);
  
    return [
      "paid",
      "collected",
      "settled",
      "closed",
    ].includes(status);
  }
  
  function daysBetween(
    earlier: Date,
    later: Date
  ): number {
    const milliseconds =
      later.getTime() -
      earlier.getTime();
  
    return Math.floor(
      milliseconds /
        (1000 * 60 * 60 * 24)
    );
  }
  
  /* ================================== */
  /* DETECTOR #50 */
  /* ================================== */
  
  export const overdueProjectReceivableDetector:
    BusinessLeakDetector = {
      id:
        "construction.overdue-project-receivable",
  
      name:
        "Overdue Project Receivable",
  
      description:
        "Detects construction project receivables that remain unpaid after their documented due date.",
  
      scope:
        "industry",
  
      industries: [
        "construction",
      ],
  
      requirements: {
        optionalFields: [
          "Customer Name",
          "Project Name",
          "Project Receivable Amount",
          "Project Receivable Due Date",
          "Project Receivable Status",
        ],
      },
  
      supports(profile) {
        return (
          profile.industry ===
          "construction"
        );
      },
  
      async detect(
        context: DetectorContext
      ): Promise<DetectorResult> {
        const leaks:
          DetectedBusinessLeak[] = [];
  
        const warnings:
          string[] = [];
  
        const errors:
          string[] = [];
  
        context.rows.forEach(
          (
            row,
            rowIndex
          ) => {
            const amount =
              parseMoney(
                row[
                  "Project Receivable Amount"
                ]
              );
  
            /*
              Require an explicit project
              receivable amount.
  
              Never substitute Contract
              Amount, Invoice Amount,
              Progress Payment Amount,
              or another field.
            */
  
            if (
              amount === null ||
              amount <= 0
            ) {
              return;
            }
  
            const dueDate =
              parseDate(
                row[
                  "Project Receivable Due Date"
                ]
              );
  
            /*
              Require an explicit due date.
              We do not guess payment terms.
            */
  
            if (!dueDate) {
              return;
            }
  
            /*
              The receivable must actually
              be past due.
            */
  
            if (
              dueDate.getTime() >=
              context.now.getTime()
            ) {
              return;
            }
  
            const status =
              row[
                "Project Receivable Status"
              ];
  
            /*
              Paid or settled receivables
              are never leaks.
            */
  
            if (isPaid(status)) {
              return;
            }
  
            /*
              Require an explicit
              outstanding status so we do
              not infer nonpayment from a
              missing field.
            */
  
            if (
              !isOutstanding(status)
            ) {
              return;
            }
  
            const customerName =
              cleanText(
                row["Customer Name"]
              ) ||
              "Unknown Customer";
  
            const projectName =
              cleanText(
                row["Project Name"]
              );
  
            const daysOverdue =
              Math.max(
                1,
                daysBetween(
                  dueDate,
                  context.now
                )
              );
  
            const recovery =
              amount * 0.8;
  
            leaks.push({
              detectorId:
                "construction.overdue-project-receivable",
  
              leakType:
                "Overdue Project Receivable",
  
              title:
                `${customerName} has an overdue project receivable`,
  
              description:
                `${customerName}'s $${amount.toFixed(
                  2
                )} receivable${projectName ? ` for ${projectName}` : ""} is ${daysOverdue} day${daysOverdue === 1 ? "" : "s"} overdue and remains unpaid.`,
  
              category:
                "Construction Collections",
  
              severity:
                amount >= 25000 ||
                daysOverdue >= 90
                  ? "high"
                  : amount >= 7500 ||
                      daysOverdue >= 30
                    ? "medium"
                    : "low",
  
              confidence:
                "high",
  
              estimatedLoss:
                amount,
  
              estimatedRecovery:
                recovery,
  
              customerName,
  
              sourceRowIndex:
                rowIndex,
  
              evidence: {
                projectName,
  
                receivableAmount:
                  amount,
  
                receivableDueDate:
                  dueDate.toISOString(),
  
                receivableStatus:
                  cleanText(status),
  
                daysOverdue,
              },
  
              recommendedAction:
                `Follow up with ${customerName} on the $${amount.toFixed(
                  2
                )} overdue project receivable and begin the appropriate collection process.`,
  
              metadata: {
                industry:
                  "construction",
  
                revenueType:
                  "project_receivable",
  
                detectionReason:
                  "project_receivable_past_due",
              },
            });
          }
        );
  
        return {
          detectorId:
            "construction.overdue-project-receivable",
  
          ran: true,
  
          leaks,
  
          warnings,
  
          errors,
        };
      },
    };