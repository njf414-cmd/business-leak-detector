import {
  mapFields,
} from "../app/lib/business-intelligence/field-mapper.ts";

const sourceFields = [
  "Client Name",
  "Invoice Total",
  "Date Invoiced",
  "Paid Amount",
  "Hours Worked",
  "Hours Billed",
  "Last Appointment",
  "Renewal Date",
];

const targetFields = [
  "Record",
  "Invoice Amount",
  "Invoice Date",
  "Amount Paid",
  "Worked Hours",
  "Billed Hours",
  "Last Service Date",
  "Renewal Due Date",
];

const result =
  mapFields(
    sourceFields,
    targetFields
  );

console.log("\nMATCHES\n");

for (const match of result.matches) {
  console.log(
    `${match.sourceField} -> ${match.targetField} | ${match.confidence} | ${match.reason}`
  );
}

console.log("\nUNMAPPED SOURCE FIELDS");
console.log(
  result.unmappedSourceFields
);

console.log("\nUNMAPPED TARGET FIELDS");
console.log(
  result.unmappedTargetFields
);
