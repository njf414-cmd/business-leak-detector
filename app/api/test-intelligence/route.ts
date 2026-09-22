import { NextResponse } from "next/server";

import {
  analyzeBusinessWithIntelligence,
} from "../../lib/business-intelligence/analysis-bridge";

import type {
  BusinessRow,
} from "../../lib/leak-engine";

/* ================================== */
/* CONTROLLED TEST DATA */
/* ================================== */

const testRows: BusinessRow[] = [
  /* ================================== */
  /* CORE / LEGACY TESTS */
  /* ================================== */

  {
    "Customer Name": "Test Customer A",
    "Invoice Amount": "1000",
    "Amount Paid": "0",
    "Payment Status": "Unpaid",
    "Due Date": "2026-01-15",
    Status: "Unpaid",
  },

  {
    "Customer Name": "Test Customer B",
    "Invoice Amount": "1000",
    "Amount Paid": "500",
    "Payment Status": "Partially Paid",
    "Due Date": "2026-01-15",
    Status: "Partially Paid",
  },

  {
    "Customer Name": "Test Customer C",
    "Invoice Amount": "1000",
    "Amount Paid": "1000",
    "Payment Status": "Paid",
    "Due Date": "2026-01-15",
    Status: "Paid",
  },

  {
    "Customer Name": "Test Customer D",
    "Invoice Amount": "2000",
    "Amount Paid": "0",
    "Payment Status": "Pending",
    "Due Date": "2099-12-31",
    Status: "Pending",
  },

  {
    Client: "Test Customer E",
    "Invoice Total": "750",
    "Cash Received": "0",
    Payment: "Overdue",
    "Payment Due Date": "2026-01-15",
    Status: "Overdue",
  },

  {
    "Customer Name": "Lead Test A",
    Status: "New Lead",
    "Quote Amount": "1200",
    Contacted: "No",
    Date: "2026-09-10",
  },

  {
    "Customer Name": "Lead Test B",
    Status: "New Lead",
    "Quote Amount": "900",
    Contacted: "No",
    Date: "2026-09-18",
  },

  {
    "Customer Name": "Lead Test C",
    Status: "Contacted",
    "Quote Amount": "1800",
    Contacted: "Yes",
    Date: "2026-09-01",
    "Last Contact Date": "2026-09-15",
  },

  {
    "Customer Name": "Lead Test D",
    Status: "Booked",
    "Quote Amount": "2500",
    Contacted: "Yes",
    Date: "2026-09-01",
  },

  {
    Account: "Lead Test E",
    "Pipeline Stage": "New Lead",
    "Deal Value": "2000",
    Reached: "No",
    "Created On": "2026-09-05",
  },

  {
    "Customer Name": "Lead Test F",
    Status: "Contacted",
    "Quote Amount": "1400",
    Contacted: "Yes",
    Date: "2026-09-01",
    "Last Contact Date": "2026-09-11",
  },

  {
    "Customer Name": "Lead Test G",
    Status: "Lead",
    "Quote Amount": "600",
    Contacted: "",
    Date: "",
  },

  {
    "Customer Name": "Lead Test H",
    Status: "Contacted",
    "Quote Amount": "1600",
    Contacted: "Yes",
    Date: "2026-08-20",
    "Last Contact Date": "2026-09-01",
  },

  {
    Account: "Lead Test I",
    "Pipeline Stage": "Contacted",
    "Deal Value": "1100",
    Reached: "Yes",
    "Created On": "2026-08-25",
    "Last Called": "2026-09-10",
  },

  {
    "Customer Name": "Estimate Test A",
    Status: "Estimate Sent",
    "Quote Amount": "2400",
    "Estimate Sent": "Yes",
    "Follow Up": "No",
    Date: "2026-09-10",
  },

  {
    "Customer Name": "Estimate Test B",
    Status: "Estimate Sent",
    "Quote Amount": "1800",
    "Estimate Sent": "Yes",
    "Follow Up": "Yes",
    Date: "2026-09-10",
  },

  {
    "Customer Name": "Estimate Test C",
    Status: "Booked",
    "Quote Amount": "3200",
    "Estimate Sent": "Yes",
    "Follow Up": "No",
    Date: "2026-09-01",
  },

  {
    Client: "Estimate Test D",
    "Quote Status": "Waiting on Customer",
    "Proposal Amount": "1350",
    "Proposal Sent": "Yes",
    "Followup Status": "Missing",
    "Quote Created": "2026-09-08",
  },

  {
    "Customer Name": "Estimate Test E",
    Status: "Estimate Sent",
    "Quote Amount": "2000",
    "Estimate Sent": "Yes",
    "Follow Up": "Yes",
    Date: "2026-08-20",
    "Last Contact Date": "2026-08-31",
  },

  {
    "Customer Name": "Estimate Test F",
    Status: "Estimate Sent",
    "Quote Amount": "1250",
    "Estimate Sent": "Yes",
    "Follow Up": "Yes",
    Date: "2026-09-01",
    "Last Contact Date": "2026-09-14",
  },

  {
    "Customer Name": "Estimate Test G",
    Status: "Estimate Sent",
    "Quote Amount": "3000",
    "Estimate Sent": "Yes",
    "Follow Up": "No",
    Date: "2026-08-15",
    "Last Contact Date": "2026-08-25",
  },

  {
    "Customer Name": "Estimate Test H",
    Status: "Estimate",
    "Quote Amount": "2200",
    "Estimate Sent": "No",
    "Follow Up": "No",
    Date: "2026-09-12",
  },

  {
    "Customer Name": "Estimate Test I",
    Status: "Draft Quote",
    "Quote Amount": "1700",
    "Estimate Sent": "",
    Date: "2026-09-15",
  },

  {
    Client: "Estimate Test J",
    "Proposal Amount": "950",
    "Quote Status": "Draft Proposal",
    "Proposal Sent": "No",
    "Quote Created": "2026-09-17",
  },

  {
    "Customer Name": "Estimate Test K",
    Status: "Expired Estimate",
    "Quote Amount": "2600",
    "Estimate Sent": "Yes",
    "Follow Up": "Yes",
    Date: "2026-08-20",
  },

  {
    "Customer Name": "Estimate Test L",
    Status: "Estimate Sent",
    "Quote Amount": "1800",
    "Estimate Sent": "Yes",
    "Follow Up": "No",
    Date: "2026-08-25",
    "Expiration Date": "2026-09-10",
  },

  {
    "Customer Name": "Estimate Test M",
    Status: "Estimate Sent",
    "Quote Amount": "2100",
    "Estimate Sent": "Yes",
    "Follow Up": "Yes",
    Date: "2026-09-10",
    "Last Contact Date": "2026-09-16",
    "Expiration Date": "2026-10-15",
  },

  {
    "Customer Name": "Payment Test A",
    "Invoice Amount": "2000",
    "Amount Paid": "0",
    "Payment Status": "Payment Failed",
    "Due Date": "2026-09-15",
    Status: "Payment Failed",
  },

  {
    "Customer Name": "Lost Revenue Test A",
    Status: "No Show",
    "Appointment Status": "No Show",
    "Job Status": "No Show",
    "Job Amount": "1200",
    Date: "2026-09-18",
  },

  {
    "Customer Name": "Lost Revenue Test B",
    Status: "Cancelled",
    "Appointment Status": "Cancelled",
    "Job Status": "Cancelled",
    "Job Amount": "1600",
    Date: "2026-09-18",
  },

  {
    "Customer Name": "Lost Revenue Test C",
    Status: "Closed Lost",
    "Quote Amount": "2400",
    Date: "2026-09-17",
  },

  /* ================================== */
  /* TORTURE TESTS */
  /* ================================== */

  {
    "Customer Name": "Torture Lead A",
    Status: "New Lead",
    "Quote Amount": "2500",
    Contacted: "No",
    Date: "2026-08-01",
  },

  {
    "Customer Name": "Torture Lead B",
    Status: "Contacted",
    "Quote Amount": "1750",
    Contacted: "Yes",
    Date: "2026-08-01",
    "Last Contact Date": "2026-08-20",
  },

  {
    "Customer Name": "Torture Lead C",
    Status: "Lead",
    "Quote Amount": "$1,250.00",
  },

  {
    "Customer Name": "Torture Estimate A",
    Status: "Draft Estimate",
    "Quote Amount": "$4,500.00",
    "Estimate Sent": "No",
    "Follow Up": "No",
    Date: "2026-07-01",
    "Expiration Date": "2026-08-01",
  },

  {
    "Customer Name": "Torture Estimate B",
    Status: "Estimate Sent",
    "Quote Amount": "3100",
    "Estimate Sent": "Yes",
    "Follow Up": "No",
    Date: "2026-07-15",
    "Expiration Date": "2026-09-01",
  },

  {
    "Customer Name": "Torture Estimate C",
    Status: "Estimate Sent",
    "Quote Amount": "2800",
    "Estimate Sent": "Yes",
    "Follow Up": "No",
    Date: "2026-07-01",
    "Expiration Date": "2099-01-01",
  },

  {
    "Customer Name": "Torture Payment A",
    "Invoice Amount": "$5,000.00",
    "Amount Paid": "$1,250.00",
    "Payment Status": "Payment Failed",
    "Due Date": "2026-08-01",
    Status: "Payment Failed",
  },

  {
    "Customer Name": "Torture Payment B",
    "Invoice Amount": "3200",
    "Amount Paid": "0",
    "Payment Status": "Declined",
    "Due Date": "2026-08-01",
    Status: "Overdue",
  },

  {
    "Customer Name": "Torture Payment C",
    "Invoice Amount": "2100",
    "Amount Paid": "0",
    "Payment Status": "Unpaid",
    "Due Date": "2026-08-01",
    Status: "Unpaid",
  },

  {
    "Customer Name": "Torture Payment D",
    "Invoice Amount": "9000",
    "Amount Paid": "9000",
    "Payment Status": "Paid",
    "Due Date": "2025-01-01",
    Status: "Paid",
  },

  {
    "Customer Name": "Torture Lost A",
    Status: "Lost",
    "Appointment Status": "No Show",
    "Job Status": "Cancelled",
    "Job Amount": "3500",
    "Quote Amount": "3500",
  },

  {
    "Customer Name": "Torture Lost B",
    Status: "Closed Lost",
    "Job Status": "Cancelled",
    "Job Amount": "2750",
    "Quote Amount": "2750",
  },

  {
    "Customer Name": "Torture Garbage A",
    Status: "Unpaid",
    "Invoice Amount": "not-a-number",
    "Amount Paid": "???",
    "Payment Status": "Unpaid",
    "Due Date": "yesterday maybe",
  },

  {
    "Customer Name": "Torture Future A",
    Status: "Contacted",
    "Quote Amount": "1800",
    Contacted: "Yes",
    Date: "2099-01-01",
    "Last Contact Date": "2099-01-02",
  },

  /* ================================== */
  /* #15 — DEPOSIT */
  /* ================================== */

  {
    "Customer Name": "Deposit Test A",
    Status: "Booked",
    "Job Status": "Scheduled",
    "Deposit Amount": "1000",
    "Deposit Paid": "0",
    "Deposit Status": "Unpaid",
  },

  {
    "Customer Name": "Deposit Test B",
    Status: "Approved",
    "Job Status": "Scheduled",
    "Deposit Amount": "1500",
    "Deposit Paid": "500",
    "Deposit Status": "Partially Paid",
  },

  {
    "Customer Name": "Deposit Test C",
    Status: "Booked",
    "Deposit Amount": "750",
    "Deposit Paid": "750",
    "Deposit Status": "Paid",
  },

  {
    "Customer Name": "Deposit Test D",
    Status: "Cancelled",
    "Job Status": "Cancelled",
    "Deposit Amount": "1500",
    "Deposit Paid": "0",
    "Deposit Status": "Unpaid",
  },

  {
    Client: "Deposit Test E",
    "Pipeline Stage": "Closed Won",
    "Down Payment": "2000",
    "Down Payment Collected": "500",
    "Down Payment Status": "Pending",
  },

  /* ================================== */
  /* #16 — UNDERPAID JOB */
  /* ================================== */

  {
    "Customer Name": "Underpaid Job Test A",
    "Job Status": "Completed",
    "Job Amount": "3000",
    "Amount Paid": "2200",
  },

  {
    "Customer Name": "Underpaid Job Test B",
    "Job Status": "Completed",
    "Job Amount": "2500",
    "Amount Paid": "0",
  },

  {
    "Customer Name": "Underpaid Job Test C",
    "Job Status": "Completed",
    "Job Amount": "1800",
    "Amount Paid": "1800",
  },

  {
    "Customer Name": "Underpaid Job Test D",
    "Job Status": "Completed",
    "Job Amount": "2000",
    "Amount Paid": "2100",
  },

  {
    "Customer Name": "Underpaid Job Test E",
    "Job Status": "Cancelled",
    "Job Amount": "4000",
    "Amount Paid": "500",
  },

  {
    Client: "Underpaid Job Test F",
    "Work Status": "Finished",
    "Service Total": "$4,500.00",
    "Cash Received": "$3,000.00",
  },

  {
    "Customer Name": "Underpaid Job Test G",
    "Job Status": "Completed",
    "Job Amount": "3000",
    "Invoice Amount": "3000",
    "Amount Paid": "2200",
    "Payment Status": "Partially Paid",
    "Due Date": "2026-09-01",
  },

  {
    "Customer Name": "Underpaid Job Test H",
    "Job Status": "Completed",
    "Job Amount": "5000",
  },

  /* ================================== */
  /* #17 — UNBILLED JOB */
  /* ================================== */

  {
    "Customer Name": "Unbilled Job Test A",
    "Job Status": "Completed",
    "Job Amount": "4000",
    "Billing Status": "Not Invoiced",
  },

  {
    Client: "Unbilled Job Test B",
    "Work Status": "Finished",
    "Service Total": "$2,750.00",
    "Invoice Status": "Needs Invoice",
  },

  {
    "Customer Name": "Unbilled Job Test C",
    "Job Status": "Completed",
    "Job Amount": "5000",
    "Invoice Amount": "5000",
    "Billing Status": "Not Invoiced",
  },

  {
    "Customer Name": "Unbilled Job Test D",
    "Job Status": "Completed",
    "Job Amount": "1800",
    "Amount Paid": "1800",
    "Billing Status": "Not Invoiced",
  },

  {
    "Customer Name": "Unbilled Job Test E",
    "Job Status": "Cancelled",
    "Job Amount": "6000",
    "Billing Status": "Not Invoiced",
  },

  {
    "Customer Name": "Unbilled Job Test F",
    "Job Status": "Completed",
    "Job Amount": "3200",
  },

  /* ================================== */
  /* #18 — DUPLICATE CHARGE */
  /* ================================== */

  {
    "Customer Name": "Duplicate Charge Test A",
    "Amount Paid": "750",
    "Payment Status": "Paid",
    Date: "2026-09-18",
  },

  {
    "Customer Name": "Duplicate Charge Test A",
    "Amount Paid": "750",
    "Payment Status": "Paid",
    Date: "2026-09-18",
  },

  {
    "Customer Name": "Duplicate Charge Test B",
    "Amount Paid": "500",
    "Payment Status": "Paid",
    Date: "2026-09-17",
  },

  {
    "Customer Name": "Duplicate Charge Test B",
    "Amount Paid": "500",
    "Payment Status": "Paid",
    Date: "2026-09-17",
  },

  {
    "Customer Name": "Duplicate Charge Test B",
    "Amount Paid": "500",
    "Payment Status": "Paid",
    Date: "2026-09-17",
  },

  /* ================================== */
  /* #19 — OVERPAYMENT */
  /* ================================== */

  {
    "Customer Name": "Overpayment Test A",
    "Invoice Amount": "2000",
    "Amount Paid": "2500",
    "Payment Status": "Paid",
  },

  {
    "Customer Name": "Overpayment Test B",
    "Job Status": "Completed",
    "Job Amount": "3000",
    "Amount Paid": "3750",
    "Payment Status": "Paid",
  },

  {
    "Customer Name": "Overpayment Test C",
    "Invoice Amount": "1800",
    "Amount Paid": "1800",
    "Payment Status": "Paid",
  },

  /* ================================== */
  /* #20 — REFUND */
  /* ================================== */

  {
    "Customer Name": "Refund Test A",
    "Refund Amount": "300",
    "Payment Status": "Refund Pending",
  },

  {
    "Customer Name": "Refund Test B",
    "Refund Amount": "750",
    "Billing Status": "Refund Approved",
  },

  {
    "Customer Name": "Refund Test C",
    "Refund Amount": "500",
    "Payment Status": "Refunded",
  },

  /* ================================== */
  /* #21 — RECURRING PAYMENT */
  /* ================================== */

  {
    "Customer Name": "Recurring Test A",
    "Recurring Amount": "300",
    "Recurring Status": "Missed Payment",
    "Payment Status": "Unpaid",
    "Next Payment Date": "2026-09-10",
  },

  {
    "Customer Name": "Recurring Test B",
    "Recurring Amount": "750",
    "Recurring Status": "Active",
    "Payment Status": "Pending",
    "Next Payment Date": "2026-09-10",
  },

  {
    "Customer Name": "Recurring Test C",
    "Recurring Amount": "500",
    "Recurring Status": "Active",
    "Payment Status": "Pending",
    "Next Payment Date": "2026-10-10",
  },

  {
    Client: "Recurring Test G",
    "Membership Fee": "$1,500.00",
    "Membership Status": "Payment Failed",
    "Next Billing Date": "2026-09-01",
    Payment: "Payment Failed",
  },

  {
    "Customer Name": "Recurring Test H",
    "Recurring Amount": "400",
    "Invoice Amount": "5000",
    "Job Amount": "5000",
    "Recurring Status": "Active",
    "Payment Status": "Declined",
    "Next Payment Date": "2026-09-10",
  },

  /* ================================== */
  /* #22 — RENEWAL */
  /* ================================== */

  {
    "Customer Name": "Renewal Test A",
    "Renewal Amount": "1200",
    "Renewal Date": "2026-09-10",
    "Renewal Status": "Not Renewed",
    "Recurring Status": "Active",
    Status: "Active",
  },

  {
    "Customer Name": "Renewal Test B",
    "Renewal Amount": "750",
    "Renewal Date": "2026-09-01",
    "Renewal Status": "Pending",
    "Recurring Status": "Active",
    Status: "Active",
  },

  {
    Client: "Renewal Test G",
    "Membership Renewal Price": "$2,500.00",
    "Membership Renewal Date": "2026-09-01",
    "Membership Renewal Status": "Renewal Overdue",
    "Membership Status": "Active",
  },

  {
    "Customer Name": "Renewal Test H",
    "Renewal Amount": "400",
    "Recurring Amount": "1000",
    "Renewal Date": "2026-09-01",
    "Renewal Status": "Not Renewed",
    "Recurring Status": "Active",
  },

  /* ================================== */
  /* #23 — CHURN */
  /* ================================== */

  {
    "Customer Name": "Churn Test A",
    "Recurring Amount": "1000",
    "Recurring Status": "Churned",
    Status: "Churned",
    Date: "2026-09-10",
  },

  {
    "Customer Name": "Churn Test B",
    "Recurring Amount": "500",
    "Recurring Status": "Membership Cancelled",
    Status: "Inactive",
    Date: "2026-09-10",
  },

  {
    "Customer Name": "Churn Test C",
    "Recurring Amount": "750",
    "Recurring Status": "Active",
    Status: "Active",
    Date: "2026-09-10",
  },

  {
    "Customer Name": "Churn Test D",
    "Recurring Amount": "1200",
    "Recurring Status": "Payment Failed",
    "Payment Status": "Payment Failed",
    "Next Payment Date": "2026-09-01",
    Status: "Active",
    Date: "2026-08-01",
  },

  {
    "Customer Name": "Churn Test E",
    "Recurring Amount": "900",
    "Renewal Amount": "1500",
    "Recurring Status": "Active",
    "Renewal Status": "Not Renewed",
    "Renewal Date": "2026-09-01",
    Status: "Active",
    Date: "2026-08-01",
  },

  {
    "Customer Name": "Churn Test F",
    "Invoice Amount": "5000",
    "Job Amount": "7000",
    "Renewal Amount": "3000",
    "Recurring Status": "Churned",
    Status: "Churned",
    Date: "2026-09-01",
  },

  {
    Client: "Churn Test G",
    "Membership Fee": "$2,000.00",
    "Membership Status": "Membership Cancelled",
    Status: "Inactive",
    "Created On": "2026-09-01",
  },

  {
    "Customer Name": "Churn Test H",
    "Recurring Amount": "400",
    "Renewal Amount": "2500",
    "Invoice Amount": "5000",
    "Job Amount": "8000",
    "Recurring Status": "Subscription Cancelled",
    Status: "Inactive",
    Date: "2026-09-01",
  },

  /* ================================== */
  /* #24 — CANCELLATION / NO-SHOW FEE */
  /* ================================== */

  {
    "Customer Name": "Fee Test A",
    "Fee Amount": "150",
    "Fee Type": "Cancellation Fee",
    "Fee Status": "Unpaid",
    "Appointment Status": "Cancelled",
  },

  {
    "Customer Name": "Fee Test B",
    "Fee Amount": "250",
    "Fee Type": "No Show Fee",
    "Fee Status": "Outstanding",
    "Appointment Status": "No Show",
  },

  {
    "Customer Name": "Fee Test C",
    "Fee Amount": "300",
    "Fee Type": "Cancellation Fee",
    "Fee Status": "Paid",
    "Appointment Status": "Cancelled",
  },

  {
    "Customer Name": "Fee Test D",
    "Fee Amount": "400",
    "Fee Type": "Late Cancellation Fee",
    "Fee Status": "Waived",
    "Appointment Status": "Cancelled",
  },

  {
    "Customer Name": "Fee Test E",
    "Job Amount": "5000",
    "Job Status": "Cancelled",
    "Fee Status": "Unpaid",
  },

  {
    "Customer Name": "Fee Test F",
    "Fee Amount": "600",
    "Fee Type": "Cancellation Fee",
    "Appointment Status": "Cancelled",
  },

  {
    Client: "Fee Test G",
    "No Show Fee Amount": "$175.00",
    "No Show Fee Status": "Uncollected",
    "Fee Reason": "No Show",
    "Booking Status": "No Show",
  },

  {
    "Customer Name": "Fee Test H",
    "Fee Amount": "200",
    "Fee Type": "Cancellation Fee",
    "Fee Status": "Past Due",
    "Appointment Status": "Cancelled",
    "Invoice Amount": "5000",
    "Job Amount": "8000",
    "Recurring Amount": "2500",
    "Renewal Amount": "3000",
    "Deposit Amount": "1500",
    "Payment Status": "Pending",
  },

  /* ================================== */
  /* #25 — UNCOLLECTED LATE FEE */
  /* ================================== */

  {
    "Customer Name": "Late Fee Test A",
    "Fee Amount": "75",
    "Fee Type": "Late Fee",
    "Fee Status": "Unpaid",
  },

  {
    "Customer Name": "Late Fee Test B",
    "Fee Amount": "550",
    "Fee Type": "Overdue Fee",
    "Fee Status": "Outstanding",
  },

  {
    "Customer Name": "Late Fee Test C",
    "Fee Amount": "125",
    "Fee Type": "Late Payment Fee",
    "Fee Status": "Paid",
  },

  {
    "Customer Name": "Late Fee Test D",
    "Fee Amount": "200",
    "Fee Type": "Penalty Fee",
    "Fee Status": "Waived",
  },

  {
    "Customer Name": "Late Fee Test E",
    "Invoice Amount": "5000",
    "Fee Type": "Late Fee",
    "Fee Status": "Unpaid",
  },

  {
    "Customer Name": "Late Fee Test F",
    "Fee Amount": "300",
    "Fee Type": "Late Fee",
  },

  {
    "Customer Name": "Late Fee Test G",
    "Fee Amount": "$1,250.00",
    "Fee Type": "Late Charge",
    "Fee Status": "Past Due",
  },

  {
    "Customer Name": "Late Fee Test H",
    "Fee Amount": "400",
    "Fee Type": "Late Payment Fee",
    "Fee Status": "Uncollected",
    "Invoice Amount": "5000",
    "Job Amount": "8000",
    "Recurring Amount": "2500",
    "Renewal Amount": "3000",
    "Deposit Amount": "1500",
    "Payment Status": "Pending",
  },

  {
    "Customer Name": "Late Fee Test I",
    "Fee Amount": "225",
    "Fee Type": "Cancellation Fee",
    "Fee Status": "Unpaid",
    "Appointment Status": "Cancelled",
  },
];

/* ================================== */
/* TYPES */
/* ================================== */

type ComparableLeak = {
  customerName: string;
  leakType: string;
  estimatedLoss: number;
  estimatedRecovery: number;
};

type ExpectedMoneyResult = {
  customerName: string;
  expectedLeakType: string | null;
  expectedLoss: number;
  expectedRecovery: number;
};

/* ================================== */
/* HELPERS */
/* ================================== */

function cleanText(
  value: unknown
): string {
  return String(value ?? "").trim();
}

function safeNumber(
  value: unknown
): number {
  const number =
    Number(value);

  return Number.isFinite(number)
    ? number
    : 0;
}

function normalizeLegacyLeak(
  leak: Record<string, unknown>
): ComparableLeak {
  return {
    customerName:
      cleanText(leak.customer) ||
      cleanText(leak.customerName) ||
      "Unknown Customer",

    leakType:
      cleanText(leak.type) ||
      cleanText(leak.leakType),

    estimatedLoss:
      safeNumber(
        leak.amount ??
          leak.estimatedLoss
      ),

    estimatedRecovery:
      safeNumber(
        leak.recovery ??
          leak.estimatedRecovery
      ),
  };
}

function normalizeModularLeak(
  leak: Record<string, unknown>
): ComparableLeak {
  return {
    customerName:
      cleanText(
        leak.customerName
      ) ||
      "Unknown Customer",

    leakType:
      cleanText(
        leak.leakType
      ),

    estimatedLoss:
      safeNumber(
        leak.estimatedLoss
      ),

    estimatedRecovery:
      safeNumber(
        leak.estimatedRecovery
      ),
  };
}

function leakKey(
  leak: Pick<
    ComparableLeak,
    "customerName" | "leakType"
  >
): string {
  return `${leak.customerName
    .trim()
    .toLowerCase()}::${leak.leakType
    .trim()
    .toLowerCase()}`;
}

/* ================================== */
/* LEGACY PARITY */
/* ================================== */

function buildParityReport(
  legacyLeaks: ComparableLeak[],
  modularLeaks: ComparableLeak[]
) {
  const legacyMap =
    new Map<string, ComparableLeak>();

  const modularMap =
    new Map<string, ComparableLeak>();

  for (const leak of legacyLeaks) {
    legacyMap.set(
      leakKey(leak),
      leak
    );
  }

  for (const leak of modularLeaks) {
    modularMap.set(
      leakKey(leak),
      leak
    );
  }

  const missingLegacyBehavior:
    ComparableLeak[] = [];

  const valueMismatches: Array<{
    customerName: string;
    leakType: string;
    legacyLoss: number;
    modularLoss: number;
    legacyRecovery: number;
    modularRecovery: number;
  }> = [];

  const approvedSafetyDifferences:
    ComparableLeak[] = [];

  for (
    const [key, legacyLeak]
    of legacyMap
  ) {
    const modularLeak =
      modularMap.get(key);

    if (!modularLeak) {
      if (
        legacyLeak.customerName ===
          "Torture Future A" &&
        legacyLeak.leakType ===
          "Unbooked Lead"
      ) {
        approvedSafetyDifferences.push(
          legacyLeak
        );

        continue;
      }

      missingLegacyBehavior.push(
        legacyLeak
      );

      continue;
    }

    const lossMatches =
      Math.abs(
        legacyLeak.estimatedLoss -
          modularLeak.estimatedLoss
      ) < 0.01;

    const recoveryMatches =
      Math.abs(
        legacyLeak.estimatedRecovery -
          modularLeak.estimatedRecovery
      ) < 0.01;

    if (
      !lossMatches ||
      !recoveryMatches
    ) {
      valueMismatches.push({
        customerName:
          legacyLeak.customerName,

        leakType:
          legacyLeak.leakType,

        legacyLoss:
          legacyLeak.estimatedLoss,

        modularLoss:
          modularLeak.estimatedLoss,

        legacyRecovery:
          legacyLeak.estimatedRecovery,

        modularRecovery:
          modularLeak.estimatedRecovery,
      });
    }
  }

  return {
    legacyParityPassed:
      missingLegacyBehavior.length ===
        0 &&
      valueMismatches.length ===
        0,

    missingLegacyBehavior,
    valueMismatches,
    approvedSafetyDifferences,
  };
}

/* ================================== */
/* MONEY REPORT */
/* ================================== */

function buildMoneyDetectorReport(
  detectorName: string,
  expectations: ExpectedMoneyResult[],
  modularLeaks: ComparableLeak[]
) {
  const results =
    expectations.map(
      (expectation) => {
        const customerLeaks =
          modularLeaks.filter(
            (leak) =>
              leak.customerName ===
              expectation.customerName
          );

        const detectorLeak =
          customerLeaks.find(
            (leak) =>
              leak.leakType ===
              detectorName
          ) ?? null;

        const expectedLeak =
          expectation.expectedLeakType
            ? customerLeaks.find(
                (leak) =>
                  leak.leakType ===
                  expectation.expectedLeakType
              ) ?? null
            : null;

        const typePassed =
          expectation.expectedLeakType ===
          null
            ? detectorLeak === null
            : expectedLeak !== null;

        const lossPassed =
          expectation.expectedLeakType ===
          null
            ? true
            : Math.abs(
                (expectedLeak
                  ?.estimatedLoss ?? 0) -
                  expectation.expectedLoss
              ) < 0.01;

        const recoveryPassed =
          expectation.expectedLeakType ===
          null
            ? true
            : Math.abs(
                (expectedLeak
                  ?.estimatedRecovery ?? 0) -
                  expectation.expectedRecovery
              ) < 0.01;

        return {
          customerName:
            expectation.customerName,

          expectedLeakType:
            expectation.expectedLeakType,

          expectedLoss:
            expectation.expectedLoss,

          expectedRecovery:
            expectation.expectedRecovery,

          actualLeaks:
            customerLeaks,

          typePassed,
          lossPassed,
          recoveryPassed,

          passed:
            typePassed &&
            lossPassed &&
            recoveryPassed,
        };
      }
    );

  const failures =
    results.filter(
      (result) =>
        !result.passed
    );

  return {
    detector:
      detectorName,

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
  };
}

/* ================================== */
/* #23 EXPECTATIONS */
/* ================================== */

const churnExpectations:
  ExpectedMoneyResult[] = [
    {
      customerName: "Churn Test A",
      expectedLeakType:
        "Churned Recurring Customer",
      expectedLoss: 1000,
      expectedRecovery: 350,
    },
    {
      customerName: "Churn Test B",
      expectedLeakType:
        "Churned Recurring Customer",
      expectedLoss: 500,
      expectedRecovery: 175,
    },
    {
      customerName: "Churn Test C",
      expectedLeakType: null,
      expectedLoss: 0,
      expectedRecovery: 0,
    },
    {
      customerName: "Churn Test D",
      expectedLeakType:
        "Missed Recurring Payment",
      expectedLoss: 1200,
      expectedRecovery: 1200,
    },
    {
      customerName: "Churn Test E",
      expectedLeakType:
        "Unrenewed Customer",
      expectedLoss: 1500,
      expectedRecovery: 1500,
    },
    {
      customerName: "Churn Test F",
      expectedLeakType: null,
      expectedLoss: 0,
      expectedRecovery: 0,
    },
    {
      customerName: "Churn Test G",
      expectedLeakType:
        "Churned Recurring Customer",
      expectedLoss: 2000,
      expectedRecovery: 700,
    },
    {
      customerName: "Churn Test H",
      expectedLeakType:
        "Churned Recurring Customer",
      expectedLoss: 400,
      expectedRecovery: 140,
    },
  ];

/* ================================== */
/* #24 EXPECTATIONS */
/* ================================== */

const cancellationFeeExpectations:
  ExpectedMoneyResult[] = [
    {
      customerName: "Fee Test A",
      expectedLeakType:
        "Unpaid Cancellation Fee",
      expectedLoss: 150,
      expectedRecovery: 150,
    },
    {
      customerName: "Fee Test B",
      expectedLeakType:
        "Unpaid Cancellation Fee",
      expectedLoss: 250,
      expectedRecovery: 250,
    },
    {
      customerName: "Fee Test C",
      expectedLeakType: null,
      expectedLoss: 0,
      expectedRecovery: 0,
    },
    {
      customerName: "Fee Test D",
      expectedLeakType: null,
      expectedLoss: 0,
      expectedRecovery: 0,
    },
    {
      customerName: "Fee Test E",
      expectedLeakType: null,
      expectedLoss: 0,
      expectedRecovery: 0,
    },
    {
      customerName: "Fee Test F",
      expectedLeakType: null,
      expectedLoss: 0,
      expectedRecovery: 0,
    },
    {
      customerName: "Fee Test G",
      expectedLeakType:
        "Unpaid Cancellation Fee",
      expectedLoss: 175,
      expectedRecovery: 175,
    },
    {
      customerName: "Fee Test H",
      expectedLeakType:
        "Unpaid Cancellation Fee",
      expectedLoss: 200,
      expectedRecovery: 200,
    },
  ];

/* ================================== */
/* #25 EXPECTATIONS */
/* ================================== */

const lateFeeExpectations:
  ExpectedMoneyResult[] = [
    {
      customerName:
        "Late Fee Test A",
      expectedLeakType:
        "Uncollected Late Fee",
      expectedLoss: 75,
      expectedRecovery: 75,
    },
    {
      customerName:
        "Late Fee Test B",
      expectedLeakType:
        "Uncollected Late Fee",
      expectedLoss: 550,
      expectedRecovery: 550,
    },
    {
      customerName:
        "Late Fee Test C",
      expectedLeakType: null,
      expectedLoss: 0,
      expectedRecovery: 0,
    },
    {
      customerName:
        "Late Fee Test D",
      expectedLeakType: null,
      expectedLoss: 0,
      expectedRecovery: 0,
    },
    {
      customerName:
        "Late Fee Test E",
      expectedLeakType: null,
      expectedLoss: 0,
      expectedRecovery: 0,
    },
    {
      customerName:
        "Late Fee Test F",
      expectedLeakType: null,
      expectedLoss: 0,
      expectedRecovery: 0,
    },
    {
      customerName:
        "Late Fee Test G",
      expectedLeakType:
        "Uncollected Late Fee",
      expectedLoss: 1250,
      expectedRecovery: 1250,
    },
    {
      customerName:
        "Late Fee Test H",
      expectedLeakType:
        "Uncollected Late Fee",
      expectedLoss: 400,
      expectedRecovery: 400,
    },
    {
      customerName:
        "Late Fee Test I",
      expectedLeakType: null,
      expectedLoss: 0,
      expectedRecovery: 0,
    },
  ];

/* ================================== */
/* CHURN OWNERSHIP */
/* ================================== */

function buildChurnOwnershipReport(
  finalLeaks: ComparableLeak[]
) {
  const customerName =
    "Churn Test H";

  const customerLeaks =
    finalLeaks.filter(
      (leak) =>
        leak.customerName ===
        customerName
    );

  const churnLeak =
    customerLeaks.find(
      (leak) =>
        leak.leakType ===
        "Churned Recurring Customer"
    ) ?? null;

  const amountOwnershipPassed =
    churnLeak !== null &&
    Math.abs(
      churnLeak.estimatedLoss - 400
    ) < 0.01 &&
    Math.abs(
      churnLeak.estimatedRecovery - 140
    ) < 0.01;

  return {
    customerName,
    recurringAmount: 400,
    renewalAmount: 2500,
    invoiceAmount: 5000,
    jobAmount: 8000,
    churnLeak,
    amountOwnershipPassed,
  };
}

/* ================================== */
/* #24 FEE OWNERSHIP */
/* ================================== */

function buildCancellationFeeOwnershipReport(
  finalLeaks: ComparableLeak[]
) {
  const customerName =
    "Fee Test H";

  const customerLeaks =
    finalLeaks.filter(
      (leak) =>
        leak.customerName ===
        customerName
    );

  const feeLeak =
    customerLeaks.find(
      (leak) =>
        leak.leakType ===
        "Unpaid Cancellation Fee"
    ) ?? null;

  const amountOwnershipPassed =
    feeLeak !== null &&
    Math.abs(
      feeLeak.estimatedLoss - 200
    ) < 0.01 &&
    Math.abs(
      feeLeak.estimatedRecovery - 200
    ) < 0.01;

  return {
    customerName,
    feeAmount: 200,
    invoiceAmount: 5000,
    jobAmount: 8000,
    recurringAmount: 2500,
    renewalAmount: 3000,
    depositAmount: 1500,
    feeLeak,
    amountOwnershipPassed,
  };
}

/* ================================== */
/* #25 LATE FEE OWNERSHIP */
/* ================================== */

function buildLateFeeOwnershipReport(
  finalLeaks: ComparableLeak[]
) {
  const customerName =
    "Late Fee Test H";

  const customerLeaks =
    finalLeaks.filter(
      (leak) =>
        leak.customerName ===
        customerName
    );

  const lateFeeLeak =
    customerLeaks.find(
      (leak) =>
        leak.leakType ===
        "Uncollected Late Fee"
    ) ?? null;

  const amountOwnershipPassed =
    lateFeeLeak !== null &&
    Math.abs(
      lateFeeLeak.estimatedLoss - 400
    ) < 0.01 &&
    Math.abs(
      lateFeeLeak.estimatedRecovery - 400
    ) < 0.01;

  return {
    customerName,

    feeAmount: 400,
    invoiceAmount: 5000,
    jobAmount: 8000,
    recurringAmount: 2500,
    renewalAmount: 3000,
    depositAmount: 1500,

    lateFeeLeak,

    amountOwnershipPassed,
  };
}

/* ================================== */
/* CROSS-DETECTOR OWNERSHIP */
/* ================================== */

function buildRecurringFamilyReport(
  finalLeaks: ComparableLeak[]
) {
  const paymentCustomer =
    finalLeaks.filter(
      (leak) =>
        leak.customerName ===
        "Churn Test D"
    );

  const renewalCustomer =
    finalLeaks.filter(
      (leak) =>
        leak.customerName ===
        "Churn Test E"
    );

  const paymentOwnedBy21 =
    paymentCustomer.some(
      (leak) =>
        leak.leakType ===
        "Missed Recurring Payment"
    ) &&
    !paymentCustomer.some(
      (leak) =>
        leak.leakType ===
        "Churned Recurring Customer"
    );

  const renewalOwnedBy22 =
    renewalCustomer.some(
      (leak) =>
        leak.leakType ===
        "Unrenewed Customer"
    ) &&
    !renewalCustomer.some(
      (leak) =>
        leak.leakType ===
        "Churned Recurring Customer"
    );

  return {
    paymentCustomer,
    renewalCustomer,
    paymentOwnedBy21,
    renewalOwnedBy22,

    recurringFamilyOwnershipPassed:
      paymentOwnedBy21 &&
      renewalOwnedBy22,
  };
}

/* ================================== */
/* #24 / #25 FEE FAMILY OWNERSHIP */
/* ================================== */

function buildFeeFamilyReport(
  finalLeaks: ComparableLeak[]
) {
  const cancellationCustomer =
    finalLeaks.filter(
      (leak) =>
        leak.customerName ===
        "Late Fee Test I"
    );

  const cancellationOwnedBy24 =
    cancellationCustomer.some(
      (leak) =>
        leak.leakType ===
        "Unpaid Cancellation Fee"
    );

  const lateFeeNotClaimedBy25 =
    !cancellationCustomer.some(
      (leak) =>
        leak.leakType ===
        "Uncollected Late Fee"
    );

  return {
    cancellationCustomer,

    cancellationOwnedBy24,

    lateFeeNotClaimedBy25,

    feeFamilyOwnershipPassed:
      cancellationOwnedBy24 &&
      lateFeeNotClaimedBy25,
  };
}

/* ================================== */
/* ROUTE */
/* ================================== */

export async function GET() {
  try {
    const result =
      await analyzeBusinessWithIntelligence({
        rows: testRows,

        now:
          new Date(
            "2026-09-19T12:00:00"
          ),
      });

    const legacyLeaks =
      result.leaks.map(
        (leak) =>
          normalizeLegacyLeak(
            leak as unknown as
              Record<
                string,
                unknown
              >
          )
      );

    const modularLeaks =
      result.modularAnalysis.leaks.map(
        (leak) =>
          normalizeModularLeak(
            leak as unknown as
              Record<
                string,
                unknown
              >
          )
      );

    const parityReport =
      buildParityReport(
        legacyLeaks,
        modularLeaks
      );

    const churnReport =
      buildMoneyDetectorReport(
        "Churned Recurring Customer",
        churnExpectations,
        modularLeaks
      );

    const cancellationFeeReport =
      buildMoneyDetectorReport(
        "Unpaid Cancellation Fee",
        cancellationFeeExpectations,
        modularLeaks
      );

    const lateFeeReport =
      buildMoneyDetectorReport(
        "Uncollected Late Fee",
        lateFeeExpectations,
        modularLeaks
      );

    const churnOwnership =
      buildChurnOwnershipReport(
        modularLeaks
      );

    const cancellationFeeOwnership =
      buildCancellationFeeOwnershipReport(
        modularLeaks
      );

    const lateFeeOwnership =
      buildLateFeeOwnershipReport(
        modularLeaks
      );

    const recurringFamily =
      buildRecurringFamilyReport(
        modularLeaks
      );

    const feeFamily =
      buildFeeFamilyReport(
        modularLeaks
      );

    const stats =
      result.modularAnalysis.stats;

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
        stats.detectorsRan === 25 &&
        stats.detectorsFailed === 0 &&
        stats.errors === 0,
    };

    const expansionReady =
      detectorHealth.all25Healthy &&
      parityReport.legacyParityPassed &&
      churnReport.allTestsPassed &&
      cancellationFeeReport
        .allTestsPassed &&
      lateFeeReport.allTestsPassed &&
      churnOwnership
        .amountOwnershipPassed &&
      cancellationFeeOwnership
        .amountOwnershipPassed &&
      lateFeeOwnership
        .amountOwnershipPassed &&
      recurringFamily
        .recurringFamilyOwnershipPassed &&
      feeFamily
        .feeFamilyOwnershipPassed;

    return NextResponse.json({
      success: true,

      message:
        "25-detector intelligence test completed, including late-fee detection, cancellation-fee separation, amount ownership, recurring-family ownership, safety checks, and legacy parity.",

      expansionReady,

      detectorHealth,

      parityReport,

      churnReport: {
        ...churnReport,

        allChurnTestsPassed:
          churnReport.allTestsPassed,
      },

      cancellationFeeReport: {
        ...cancellationFeeReport,

        allCancellationFeeTestsPassed:
          cancellationFeeReport
            .allTestsPassed,
      },

      lateFeeReport: {
        ...lateFeeReport,

        allLateFeeTestsPassed:
          lateFeeReport.allTestsPassed,
      },

      churnOwnership,

      cancellationFeeOwnership,

      lateFeeOwnership,

      recurringFamily,

      feeFamily,

      modularStats:
        result.modularAnalysis.stats,

      legacyLeaks,

      modularLeaks,

      modularExecution:
        result.modularAnalysis
          .executionSummary,

      warnings:
        result.modularAnalysis.warnings,

      errors:
        result.modularAnalysis.errors,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,

        error:
          error instanceof Error
            ? error.message
            : "Unknown intelligence test error.",
      },
      {
        status: 500,
      }
    );
  }
}