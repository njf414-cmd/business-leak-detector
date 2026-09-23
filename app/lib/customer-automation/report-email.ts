type EmailTopLeak = {
  customer?: string;
  type?: string;
  amount?: number;
  recovery?: number;
  priorityLevel?: string;
  action?: string;
};

export type ReportEmailInput = {
  businessName: string;
  reportUrl: string;
  scanDate: string;
  revenueAtRisk: number;
  estimatedRecovery: number;
  recoveredAmount: number;
  leaksFound: number;
  newLeaks: number;
  resolvedLeaks: number;
  revenueRiskChange: number;
  topLeaks: EmailTopLeak[];
};

function escapeHtml(
  value: string
) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function money(
  value: number
) {
  return new Intl.NumberFormat(
    "en-US",
    {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }
  ).format(value);
}

function scanDateLabel(
  value: string
) {
  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "Latest scan";
  }

  return new Intl.DateTimeFormat(
    "en-US",
    {
      month: "short",
      day: "numeric",
      year: "numeric",
    }
  ).format(date);
}

export function buildReportEmail(
  input: ReportEmailInput
) {
  const safeBusiness =
    escapeHtml(
      input.businessName
    );

  const safeUrl =
    escapeHtml(
      input.reportUrl
    );

  const topLeakHtml =
    input.topLeaks
      .slice(0, 3)
      .map(
        (
          leak,
          index
        ) => {
          const type =
            escapeHtml(
              leak.type ||
              "Business Leak"
            );

          const customer =
            escapeHtml(
              leak.customer ||
              "Unknown customer"
            );

          const priority =
            escapeHtml(
              leak.priorityLevel ||
              "Medium"
            );

          const action =
            escapeHtml(
              leak.action ||
              "Review this leak in your report."
            );

          return `
            <div style="border:1px solid #e2e8f0;border-radius:12px;padding:16px;margin-top:12px;">
              <div style="font-size:12px;color:#64748b;margin-bottom:5px;">
                PRIORITY ${index + 1}
              </div>

              <div style="font-size:16px;font-weight:700;color:#0f172a;">
                ${type}
              </div>

              <div style="font-size:13px;color:#64748b;margin-top:3px;">
                ${customer} · ${priority} priority
              </div>

              <div style="margin-top:10px;font-size:14px;color:#334155;line-height:1.5;">
                ${action}
              </div>
            </div>
          `;
        }
      )
      .join("");

  const direction =
    input.revenueRiskChange < 0
      ? "decreased"
      : input.revenueRiskChange > 0
        ? "increased"
        : "did not change";

  const changeAmount =
    money(
      Math.abs(
        input.revenueRiskChange
      )
    );

  const subject =
    `${input.businessName}: your Business Leak Report is ready`;

  const html = `
<!doctype html>
<html>
  <body style="margin:0;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
    <div style="max-width:680px;margin:0 auto;padding:32px 18px;">
      <div style="background:#020617;border-radius:18px;padding:28px;color:#ffffff;">
        <div style="font-size:12px;font-weight:700;letter-spacing:1.4px;color:#94a3b8;">
          BUSINESS LEAK DETECTOR
        </div>

        <h1 style="font-size:28px;margin:8px 0 8px;">
          Your report is ready
        </h1>

        <p style="margin:0;color:#cbd5e1;line-height:1.5;">
          ${safeBusiness} · ${scanDateLabel(input.scanDate)}
        </p>
      </div>

      <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:18px;padding:24px;margin-top:18px;">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          <div style="padding:15px;background:#f8fafc;border-radius:12px;">
            <div style="font-size:12px;color:#64748b;">REVENUE AT RISK</div>
            <div style="font-size:24px;font-weight:800;margin-top:5px;">
              ${money(input.revenueAtRisk)}
            </div>
          </div>

          <div style="padding:15px;background:#f8fafc;border-radius:12px;">
            <div style="font-size:12px;color:#64748b;">ESTIMATED RECOVERY</div>
            <div style="font-size:24px;font-weight:800;margin-top:5px;">
              ${money(input.estimatedRecovery)}
            </div>
          </div>
        </div>

        <div style="margin-top:18px;font-size:14px;line-height:1.7;color:#475569;">
          <strong>${input.leaksFound}</strong> leak${input.leaksFound === 1 ? "" : "s"} detected.
          <strong>${input.newLeaks}</strong> new.
          <strong>${input.resolvedLeaks}</strong> resolved.
        </div>

        <div style="margin-top:8px;font-size:14px;line-height:1.7;color:#475569;">
          Revenue at risk ${direction}
          ${input.revenueRiskChange === 0 ? "" : `by ${changeAmount}`}
          since the previous scan.
        </div>

        ${
          input.recoveredAmount > 0
            ? `
              <div style="margin-top:8px;font-size:14px;color:#475569;">
                Recovered so far:
                <strong>${money(input.recoveredAmount)}</strong>
              </div>
            `
            : ""
        }
      </div>

      ${
        topLeakHtml
          ? `
            <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:18px;padding:24px;margin-top:18px;">
              <h2 style="font-size:19px;margin:0;">
                Top actions
              </h2>

              ${topLeakHtml}
            </div>
          `
          : ""
      }

      <div style="text-align:center;margin-top:24px;">
        <a
          href="${safeUrl}"
          style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:700;padding:14px 22px;border-radius:10px;"
        >
          View Full Report
        </a>
      </div>

      <div style="font-size:12px;color:#94a3b8;text-align:center;line-height:1.6;margin-top:28px;">
        This notification was generated automatically by Business Leak Detector.
      </div>
    </div>
  </body>
</html>
`;

  const text = [
    "Business Leak Detector",
    "",
    `${input.businessName} - your report is ready.`,
    "",
    `Revenue at Risk: ${money(input.revenueAtRisk)}`,
    `Estimated Recovery: ${money(input.estimatedRecovery)}`,
    `Recovered: ${money(input.recoveredAmount)}`,
    `Leaks Found: ${input.leaksFound}`,
    `New Leaks: ${input.newLeaks}`,
    `Resolved Leaks: ${input.resolvedLeaks}`,
    "",
    `View your report: ${input.reportUrl}`,
  ].join("\n");

  return {
    subject,
    html,
    text,
  };
}
