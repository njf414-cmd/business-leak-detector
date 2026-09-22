import { NextResponse } from "next/server";

import {
  mapFields,
} from "../../lib/business-intelligence/field-mapper";

export async function GET() {
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

  return NextResponse.json({
    success: true,
    result,
  });
}
