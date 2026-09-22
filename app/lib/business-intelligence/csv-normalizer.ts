import type { CanonicalRow } from "./row-transformer";

// Import metadata is needed to interpret mixed CRM exports, even when no
// individual detector declares it as an input field.
export const CSV_CONTEXT_FIELDS = ["Customer Name", "Status", "Contacted", "Date", "Last Contact Date", "Record Type", "Deal Value"];

export type CsvDerivation = { rowIndex: number; sourceField: string; targetField: string; reason: string };
export type CsvNormalizationIssue = { rowIndex: number; field: string; message: string };

export function normalizeCsvRows(rows: CanonicalRow[]) {
  const derivations: CsvDerivation[] = [];
  const issues: CsvNormalizationIssue[] = [];
  const normalizedRows = rows.map((source, rowIndex) => {
    const row = { ...source };
    const derive = (sourceField: string, targetField: string, value: string, reason: string) => {
      // An explicitly supplied canonical value always wins.
      if (row[targetField]?.trim()) return;
      row[targetField] = value;
      derivations.push({ rowIndex, sourceField, targetField, reason });
    };
    if (row["Deal Value"]?.trim()) {
      const recordType = row["Record Type"]?.trim().toLowerCase();
      const amountFields: Record<string, string> = {
        lead: "Quote Amount", estimate: "Quote Amount", quote: "Quote Amount", proposal: "Quote Amount",
        invoice: "Invoice Amount", job: "Job Amount", project: "Job Amount", appointment: "Job Amount", booking: "Job Amount",
      };
      const amountField = recordType && Object.hasOwn(amountFields, recordType) ? amountFields[recordType] : undefined;
      if (amountField) derive("Deal Value", amountField, row["Deal Value"], `Record Type is ${recordType}.`);
      else issues.push({ rowIndex, field: "Deal Value", message: "Deal Value needs a recognized Record Type before it can be used as a quote, invoice, or job amount." });
    }
    // Only explicit unpaid labels are promoted. Sent/open/paid/cancelled and
    // generic workflow states do not become unpaid balances by inference.
    const unpaid = ["unpaid", "overdue", "past due", "payment pending", "balance due", "outstanding", "awaiting payment"];
    const status = row.Status?.trim().toLowerCase();
    if (row["Invoice Amount"]?.trim() && unpaid.includes(status ?? "")) {
      derive("Status", "Payment Status", status === "overdue" || status === "past due" ? status : "unpaid", "Explicit unpaid invoice status.");
    }
    return row;
  });
  return { rows: normalizedRows, derivations, issues };
}
