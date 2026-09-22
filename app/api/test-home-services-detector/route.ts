import { getSupportedDetectors } from "../../lib/business-intelligence/detector-registry";
import {
    NextResponse,
  } from "next/server";
  
  import {
    runBusinessDetectors,
  } from "../../lib/business-intelligence/detector-runner";
  
  import type {
    BusinessDataRow,
  } from "../../lib/business-intelligence/detector-types";
  
  import type {
    BusinessIntelligenceProfile,
  } from "../../lib/business-intelligence/types";
  
  import {
    registerDetectorCatalog,
  } from "../../lib/business-intelligence/detector-catalog";
  
  /* ================================== */
  /* TEST PROFILE */
  /* ================================== */
  
  const profile:
    BusinessIntelligenceProfile = {
      businessId:
        "test-home-services",
  
      businessName:
        "Test Home Services Company",
  
      industry:
        "home_services",
  
      businessModel:
        "service",
  
      revenueModels: [
        "one_time",
        "project_based",
      ],
  
      capabilities: {
        usesLeads: true,
        usesQuotes: true,
        usesInvoices: true,
        usesAppointments: true,
        usesJobs: true,
        usesOrders: false,
        usesSubscriptions: false,
        usesPayments: true,
        usesCustomerRelationships: true,
        usesSalesPipeline: true,
      },
  
      description:
        "Test home services business",
  
      metadata: {},
    };
  
  /* ================================== */
  /* TEST */
  /* ================================== */
  
  export async function GET() {
    try {
      registerDetectorCatalog();
  
      const now =
        new Date(
          "2026-09-21T12:00:00.000Z"
        );
  
      const rows:
        BusinessDataRow[] = [
  
          /* #36 */
          {
            "Customer Name":
              "Customer A",
            "Service":
              "HVAC Replacement",
            "Estimate Amount":
              "8500",
            "Estimate Status":
              "Approved",
            "Job Status":
              "Not Scheduled",
          },
  
          {
            "Customer Name":
              "Customer B",
            "Service":
              "Water Heater Replacement",
            "Estimate Amount":
              "2400",
            "Estimate Status":
              "Accepted",
            "Job Status":
              "Pending",
          },
  
          {
            "Customer Name":
              "Customer C",
            "Service":
              "Electrical Panel Upgrade",
            "Estimate Amount":
              "4200",
            "Estimate Status":
              "Approved",
            "Job Status":
              "Scheduled",
          },
  
          {
            "Customer Name":
              "Customer D",
            "Service":
              "Roof Repair",
            "Estimate Amount":
              "3100",
            "Estimate Status":
              "Pending",
            "Job Status":
              "Not Scheduled",
          },
  
          {
            "Customer Name":
              "Customer E",
            "Service":
              "Drain Repair",
            "Estimate Status":
              "Approved",
            "Job Status":
              "Not Scheduled",
            "Job Amount":
              "1750",
          },
  
          /* #37 */
          {
            "Customer Name":
              "Customer F",
            "Maintenance Service":
              "HVAC Tune-Up",
            "Maintenance Due Date":
              "2026-08-01",
            "Maintenance Amount":
              "225",
            "Maintenance Status":
              "Due",
          },
  
          {
            "Customer Name":
              "Customer G",
            "Maintenance Service":
              "Furnace Tune-Up",
            "Maintenance Due Date":
              "2026-11-01",
            "Maintenance Amount":
              "200",
            "Maintenance Status":
              "Due",
          },
  
          {
            "Customer Name":
              "Customer H",
            "Maintenance Service":
              "AC Maintenance",
            "Maintenance Due Date":
              "2026-07-01",
            "Maintenance Amount":
              "250",
            "Maintenance Status":
              "Scheduled",
          },
  
          {
            "Customer Name":
              "Customer I",
            "Maintenance Service":
              "Boiler Maintenance",
            "Maintenance Due Date":
              "2026-06-01",
            "Maintenance Status":
              "Due",
            "Job Amount":
              "500",
          },
  
          /* #38 */
          {
            "Customer Name":
              "Customer J",
            "Service":
              "Emergency Plumbing Repair",
            "Service Call Status":
              "Emergency",
            "Booking Status":
              "Not Booked",
            "Service Call Amount":
              "1200",
          },
  
          {
            "Customer Name":
              "Customer K",
            "Service":
              "AC Repair",
            "Service Call Status":
              "Qualified",
            "Booking Status":
              "Pending",
            "Service Call Amount":
              "850",
          },
  
          {
            "Customer Name":
              "Customer L",
            "Service":
              "Electrical Repair",
            "Service Call Status":
              "Qualified",
            "Booking Status":
              "Booked",
            "Service Call Amount":
              "950",
          },
  
          {
            "Customer Name":
              "Customer M",
            "Service":
              "HVAC Inspection",
            "Service Call Status":
              "General Inquiry",
            "Booking Status":
              "Not Booked",
            "Service Call Amount":
              "300",
          },
  
          {
            "Customer Name":
              "Customer N",
            "Service":
              "Roof Leak Repair",
            "Service Call Status":
              "Urgent",
            "Booking Status":
              "Not Booked",
            "Job Amount":
              "1800",
          },
  
          /* #39 */
          {
            "Customer Name":
              "Customer O",
            "Service":
              "HVAC Diagnostic",
            "Service Call Status":
              "Completed",
            "Service Call Fee":
              "149",
            "Service Call Fee Status":
              "Unpaid",
          },
  
          {
            "Customer Name":
              "Customer P",
            "Service":
              "Plumbing Diagnostic",
            "Service Call Status":
              "Completed",
            "Service Call Fee":
              "129",
            "Service Call Fee Status":
              "Paid",
          },
  
          {
            "Customer Name":
              "Customer Q",
            "Service":
              "Electrical Diagnostic",
            "Service Call Status":
              "Cancelled",
            "Service Call Fee":
              "175",
            "Service Call Fee Status":
              "Unpaid",
          },
  
          {
            "Customer Name":
              "Customer R",
            "Service":
              "Drain Diagnostic",
            "Service Call Status":
              "Completed",
            "Service Call Fee Status":
              "Unpaid",
            "Job Amount":
              "450",
          },
  
          /* #40 */
          {
            "Customer Name":
              "Customer S",
            "Service":
              "Kitchen Plumbing Remodel",
            "Change Order":
              "Additional Pipe Replacement",
            "Change Order Amount":
              "1750",
            "Change Order Status":
              "Approved",
            "Change Order Billing Status":
              "Not Billed",
          },
  
          {
            "Customer Name":
              "Customer T",
            "Service":
              "Electrical Upgrade",
            "Change Order":
              "Additional Circuit Installation",
            "Change Order Amount":
              "950",
            "Change Order Status":
              "Performed",
            "Change Order Billing Status":
              "Pending",
          },
  
          {
            "Customer Name":
              "Customer U",
            "Service":
              "Bathroom Remodel",
            "Change Order":
              "Additional Fixture Installation",
            "Change Order Amount":
              "1250",
            "Change Order Status":
              "Approved",
            "Change Order Billing Status":
              "Invoiced",
          },
  
          {
            "Customer Name":
              "Customer V",
            "Service":
              "Roof Replacement",
            "Change Order":
              "Additional Decking",
            "Change Order Amount":
              "2100",
            "Change Order Status":
              "Pending",
            "Change Order Billing Status":
              "Not Billed",
          },
  
          {
            "Customer Name":
              "Customer W",
            "Service":
              "HVAC Installation",
            "Change Order":
              "Additional Ductwork",
            "Change Order Status":
              "Approved",
            "Change Order Billing Status":
              "Not Billed",
            "Job Amount":
              "3200",
          },
  
          /* #41 */
          {
            "Customer Name":
              "Customer X",
            "Service Agreement":
              "HVAC Maintenance Plan",
            "Agreement Renewal Date":
              "2026-08-15",
            "Agreement Renewal Amount":
              "399",
            "Agreement Status":
              "Expired",
          },
  
          {
            "Customer Name":
              "Customer Y",
            "Service Agreement":
              "Plumbing Service Plan",
            "Agreement Renewal Date":
              "2026-11-15",
            "Agreement Renewal Amount":
              "299",
            "Agreement Status":
              "Active Until Renewal",
          },
  
          {
            "Customer Name":
              "Customer Z",
            "Service Agreement":
              "Electrical Maintenance Plan",
            "Agreement Renewal Date":
              "2026-08-01",
            "Agreement Renewal Amount":
              "499",
            "Agreement Status":
              "Renewed",
          },
  
          {
            "Customer Name":
              "Customer AA",
            "Service Agreement":
              "Whole Home Service Plan",
            "Agreement Renewal Date":
              "2026-07-01",
            "Agreement Status":
              "Expired",
            "Job Amount":
              "999",
          },
  
          /* #42 */
          {
            "Customer Name":
              "Customer AB",
            "Warranty Service":
              "HVAC Compressor Follow-Up",
            "Warranty Follow Up Date":
              "2026-08-10",
            "Warranty Service Value":
              "650",
            "Warranty Status":
              "Open",
          },
  
          {
            "Customer Name":
              "Customer AC",
            "Warranty Service":
              "Water Heater Warranty Check",
            "Warranty Follow Up Date":
              "2026-11-10",
            "Warranty Service Value":
              "500",
            "Warranty Status":
              "Open",
          },
  
          {
            "Customer Name":
              "Customer AD",
            "Warranty Service":
              "Electrical Warranty Repair",
            "Warranty Follow Up Date":
              "2026-08-01",
            "Warranty Service Value":
              "800",
            "Warranty Status":
              "Scheduled",
          },
  
          {
            "Customer Name":
              "Customer AE",
            "Warranty Service":
              "Roof Warranty Inspection",
            "Warranty Follow Up Date":
              "2026-07-01",
            "Warranty Status":
              "Open",
            "Job Amount":
              "1500",
          },
  
          /* #43 */
          {
            "Customer Name":
              "Customer AF",
            "Replacement Item":
              "HVAC System",
            "Replacement Recommendation Status":
              "Replacement Recommended",
            "Replacement Sale Status":
              "Not Sold",
            "Replacement Amount":
              "12000",
          },
  
          {
            "Customer Name":
              "Customer AG",
            "Replacement Item":
              "Water Heater",
            "Replacement Recommendation Status":
              "Recommended",
            "Replacement Sale Status":
              "Sold",
            "Replacement Amount":
              "3200",
          },
  
          {
            "Customer Name":
              "Customer AH",
            "Replacement Item":
              "Electrical Panel",
            "Replacement Recommendation Status":
              "Inspection Only",
            "Replacement Sale Status":
              "Not Sold",
            "Replacement Amount":
              "4500",
          },
  
          {
            "Customer Name":
              "Customer AI",
            "Replacement Item":
              "Furnace",
            "Replacement Recommendation Status":
              "Needs Replacement",
            "Replacement Sale Status":
              "Not Sold",
            "Estimate Amount":
              "7800",
          },
  
          /* #44 */
          {
            "Customer Name":
              "Customer AJ",
            "Upsell Item":
              "Whole Home Surge Protection",
            "Upsell Recommendation Status":
              "Recommended",
            "Upsell Sale Status":
              "Not Sold",
            "Upsell Amount":
              "1500",
          },
  
          {
            "Customer Name":
              "Customer AK",
            "Upsell Item":
              "Whole Home Surge Protection",
            "Upsell Recommendation Status":
              "Offered",
            "Upsell Sale Status":
              "Not Sold",
            "Upsell Amount":
              "$650.00",
          },
  
          {
            "Customer Name":
              "Customer AL",
            "Upsell Item":
              "Whole Home Surge Protection",
            "Upsell Recommendation Status":
              "Recommended",
            "Upsell Sale Status":
              "Sold",
            "Upsell Amount":
              "1500",
          },
  
          {
            "Customer Name":
              "Customer AM",
            "Upsell Item":
              "Whole Home Surge Protection",
            "Upsell Recommendation Status":
              "Recommended",
            "Upsell Sale Status":
              "Approved",
            "Upsell Amount":
              "1500",
          },
  
          {
            "Customer Name":
              "Customer AN",
            "Upsell Item":
              "Whole Home Surge Protection",
            "Upsell Recommendation Status":
              "Not Recommended",
            "Upsell Sale Status":
              "Not Sold",
            "Upsell Amount":
              "1500",
          },
  
          {
            "Customer Name":
              "Customer AO",
            "Upsell Item":
              "Whole Home Surge Protection",
            "Upsell Recommendation Status":
              "Recommended",
            "Upsell Sale Status":
              "Not Sold",
            "Job Amount":
              "9000",
            "Estimate Amount":
              "8000",
            "Replacement Amount":
              "7000",
          },
  
          {
            "Customer Name":
              "Customer AP",
            "Upsell Item":
              "",
            "Upsell Recommendation Status":
              "Recommended",
            "Upsell Sale Status":
              "Not Sold",
            "Upsell Amount":
              "1500",
          },
  
          {
            "Customer Name":
              "Customer AQ",
            "Upsell Item":
              "Whole Home Surge Protection",
            "Upsell Recommendation Status":
              "Recommended",
            "Upsell Sale Status":
              "Not Sold",
            "Upsell Amount":
              "0",
          },
  
          {
            "Customer Name":
              "Customer AR",
            "Upsell Item":
              "Whole Home Surge Protection",
            "Upsell Recommendation Status":
              "Recommended",
            "Upsell Sale Status":
              "Not Sold",
            "Upsell Amount":
              "invalid",
          },
  
          {
            "Customer Name":
              "Customer AS",
            "Upsell Item":
              "Whole Home Surge Protection",
            "Upsell Recommendation Status":
              "Recommended",
            "Upsell Sale Status":
              "Not Sold",
            "Upsell Amount":
              "-100",
          },
  
          {
            "Customer Name":
              "Customer AT",
            "Upsell Item":
              "Whole Home Surge Protection",
            "Upsell Sale Status":
              "Not Sold",
            "Upsell Amount":
              "1500",
          },
  
          /* ================================== */
          /* #45 */
          /* ================================== */
  
          /*
            AU:
            Active agreement.
            Payment overdue and unpaid.
            SHOULD trigger #45.
          */
          {
            "Customer Name":
              "Customer AU",
  
            "Service Agreement":
              "HVAC Comfort Plan",
  
            "Agreement Status":
              "Active",
  
            "Agreement Payment Amount":
              "79",
  
            "Agreement Payment Due Date":
              "2026-08-21",
  
            "Agreement Payment Status":
              "Unpaid",
          },
  
          /*
            AV:
            Active agreement but payment
            already collected.
            MUST NOT trigger #45.
          */
          {
            "Customer Name":
              "Customer AV",
  
            "Service Agreement":
              "Plumbing Protection Plan",
  
            "Agreement Status":
              "Active",
  
            "Agreement Payment Amount":
              "59",
  
            "Agreement Payment Due Date":
              "2026-08-15",
  
            "Agreement Payment Status":
              "Paid",
          },
  
          /*
            AW:
            Active agreement but payment
            is not due yet.
            MUST NOT trigger #45.
          */
          {
            "Customer Name":
              "Customer AW",
  
            "Service Agreement":
              "Electrical Service Plan",
  
            "Agreement Status":
              "Current",
  
            "Agreement Payment Amount":
              "69",
  
            "Agreement Payment Due Date":
              "2026-10-21",
  
            "Agreement Payment Status":
              "Unpaid",
          },
  
          /*
            AX:
            Agreement is inactive.
            MUST NOT trigger #45.
          */
          {
            "Customer Name":
              "Customer AX",
  
            "Service Agreement":
              "Home Maintenance Plan",
  
            "Agreement Status":
              "Cancelled",
  
            "Agreement Payment Amount":
              "99",
  
            "Agreement Payment Due Date":
              "2026-08-01",
  
            "Agreement Payment Status":
              "Unpaid",
          },
  
          /*
            AY:
            Active agreement with overdue
            payment but no explicit
            Agreement Payment Amount.
  
            Other amounts exist to prove
            detector does not guess.
  
            MUST NOT trigger #45.
          */
          {
            "Customer Name":
              "Customer AY",
  
            "Service Agreement":
              "Premium HVAC Plan",
  
            "Agreement Status":
              "Enrolled",
  
            "Agreement Payment Due Date":
              "2026-07-01",
  
            "Agreement Payment Status":
              "Unpaid",
  
            "Agreement Renewal Amount":
              "500",
  
            "Invoice Amount":
              "450",
  
            "Job Amount":
              "900",
          },
        ];
  
      const result =
        await runBusinessDetectors({
          profile,
          rows,
          now,
        });
  
      /* ================================== */
      /* DETECTOR #36 */
      /* ================================== */
  
      const detector36Id =
        "home-services.unscheduled-approved-estimate";
  
      const detector36Result =
        result.detectorResults.find(
          (item) =>
            item.detectorId ===
            detector36Id
        );
  
      const detector36Leaks =
        detector36Result?.leaks ?? [];
  
      const customerA =
        detector36Leaks.find(
          (leak) =>
            leak.customerName ===
            "Customer A"
        );
  
      const customerB =
        detector36Leaks.find(
          (leak) =>
            leak.customerName ===
            "Customer B"
        );
  
      const customerC =
        detector36Leaks.find(
          (leak) =>
            leak.customerName ===
            "Customer C"
        );
  
      const customerD =
        detector36Leaks.find(
          (leak) =>
            leak.customerName ===
            "Customer D"
        );
  
      const customerE =
        detector36Leaks.find(
          (leak) =>
            leak.customerName ===
            "Customer E"
        );
  
      const approvedEstimatePassed =
        Boolean(
          customerA &&
          Math.abs(
            customerA.estimatedLoss -
              8500
          ) < 0.01
        );
  
      const acceptedAliasPassed =
        Boolean(
          customerB &&
          Math.abs(
            customerB.estimatedLoss -
              2400
          ) < 0.01
        );
  
      const scheduledJobSafetyPassed =
        !customerC;
  
      const unapprovedEstimateSafetyPassed =
        !customerD;
  
      const estimateNoGuessingPassed =
        !customerE;
  
      /* ================================== */
      /* DETECTOR #37 */
      /* ================================== */
  
      const detector37Id =
        "home-services.unscheduled-maintenance";
  
      const detector37Result =
        result.detectorResults.find(
          (item) =>
            item.detectorId ===
            detector37Id
        );
  
      const detector37Leaks =
        detector37Result?.leaks ?? [];
  
      const customerF =
        detector37Leaks.find(
          (leak) =>
            leak.customerName ===
            "Customer F"
        );
  
      const customerG =
        detector37Leaks.find(
          (leak) =>
            leak.customerName ===
            "Customer G"
        );
  
      const customerH =
        detector37Leaks.find(
          (leak) =>
            leak.customerName ===
            "Customer H"
        );
  
      const customerI =
        detector37Leaks.find(
          (leak) =>
            leak.customerName ===
            "Customer I"
        );
  
      const overdueMaintenancePassed =
        Boolean(
          customerF &&
          Math.abs(
            customerF.estimatedLoss -
              225
          ) < 0.01
        );
  
      const futureMaintenanceSafetyPassed =
        !customerG;
  
      const scheduledMaintenanceSafetyPassed =
        !customerH;
  
      const maintenanceNoGuessingPassed =
        !customerI;
  
      /* ================================== */
      /* DETECTOR #38 */
      /* ================================== */
  
      const detector38Id =
        "home-services.unconverted-service-call";
  
      const detector38Result =
        result.detectorResults.find(
          (item) =>
            item.detectorId ===
            detector38Id
        );
  
      const detector38Leaks =
        detector38Result?.leaks ?? [];
  
      const customerJ =
        detector38Leaks.find(
          (leak) =>
            leak.customerName ===
            "Customer J"
        );
  
      const customerK =
        detector38Leaks.find(
          (leak) =>
            leak.customerName ===
            "Customer K"
        );
  
      const customerL =
        detector38Leaks.find(
          (leak) =>
            leak.customerName ===
            "Customer L"
        );
  
      const customerM =
        detector38Leaks.find(
          (leak) =>
            leak.customerName ===
            "Customer M"
        );
  
      const customerN =
        detector38Leaks.find(
          (leak) =>
            leak.customerName ===
            "Customer N"
        );
  
      const emergencyCallPassed =
        Boolean(
          customerJ &&
          Math.abs(
            customerJ.estimatedLoss -
              1200
          ) < 0.01
        );
  
      const qualifiedCallPassed =
        Boolean(
          customerK &&
          Math.abs(
            customerK.estimatedLoss -
              850
          ) < 0.01
        );
  
      const bookedCallSafetyPassed =
        !customerL;
  
      const unqualifiedCallSafetyPassed =
        !customerM;
  
      const serviceCallNoGuessingPassed =
        !customerN;
  
      /* ================================== */
      /* DETECTOR #39 */
      /* ================================== */
  
      const detector39Id =
        "home-services.uncollected-service-call-fee";
  
      const detector39Result =
        result.detectorResults.find(
          (item) =>
            item.detectorId ===
            detector39Id
        );
  
      const detector39Leaks =
        detector39Result?.leaks ?? [];
  
      const customerO =
        detector39Leaks.find(
          (leak) =>
            leak.customerName ===
            "Customer O"
        );
  
      const customerP =
        detector39Leaks.find(
          (leak) =>
            leak.customerName ===
            "Customer P"
        );
  
      const customerQ =
        detector39Leaks.find(
          (leak) =>
            leak.customerName ===
            "Customer Q"
        );
  
      const customerR =
        detector39Leaks.find(
          (leak) =>
            leak.customerName ===
            "Customer R"
        );
  
      const uncollectedFeePassed =
        Boolean(
          customerO &&
          Math.abs(
            customerO.estimatedLoss -
              149
          ) < 0.01
        );
  
      const paidFeeSafetyPassed =
        !customerP;
  
      const cancelledCallSafetyPassed =
        !customerQ;
  
      const serviceFeeNoGuessingPassed =
        !customerR;
  
      /* ================================== */
      /* DETECTOR #40 */
      /* ================================== */
  
      const detector40Id =
        "home-services.unbilled-change-order";
  
      const detector40Result =
        result.detectorResults.find(
          (item) =>
            item.detectorId ===
            detector40Id
        );
  
      const detector40Leaks =
        detector40Result?.leaks ?? [];
  
      const customerS =
        detector40Leaks.find(
          (leak) =>
            leak.customerName ===
            "Customer S"
        );
  
      const customerT =
        detector40Leaks.find(
          (leak) =>
            leak.customerName ===
            "Customer T"
        );
  
      const customerU =
        detector40Leaks.find(
          (leak) =>
            leak.customerName ===
            "Customer U"
        );
  
      const customerV =
        detector40Leaks.find(
          (leak) =>
            leak.customerName ===
            "Customer V"
        );
  
      const customerW =
        detector40Leaks.find(
          (leak) =>
            leak.customerName ===
            "Customer W"
        );
  
      const approvedChangeOrderPassed =
        Boolean(
          customerS &&
          Math.abs(
            customerS.estimatedLoss -
              1750
          ) < 0.01
        );
  
      const performedChangeOrderPassed =
        Boolean(
          customerT &&
          Math.abs(
            customerT.estimatedLoss -
              950
          ) < 0.01
        );
  
      const billedChangeOrderSafetyPassed =
        !customerU;
  
      const unapprovedChangeOrderSafetyPassed =
        !customerV;
  
      const changeOrderNoGuessingPassed =
        !customerW;
  
      /* ================================== */
      /* DETECTOR #41 */
      /* ================================== */
  
      const detector41Id =
        "home-services.unrenewed-service-agreement";
  
      const detector41Result =
        result.detectorResults.find(
          (item) =>
            item.detectorId ===
            detector41Id
        );
  
      const detector41Leaks =
        detector41Result?.leaks ?? [];
  
      const customerX =
        detector41Leaks.find(
          (leak) =>
            leak.customerName ===
            "Customer X"
        );
  
      const customerY =
        detector41Leaks.find(
          (leak) =>
            leak.customerName ===
            "Customer Y"
        );
  
      const customerZ =
        detector41Leaks.find(
          (leak) =>
            leak.customerName ===
            "Customer Z"
        );
  
      const customerAA =
        detector41Leaks.find(
          (leak) =>
            leak.customerName ===
            "Customer AA"
        );
  
      const overdueAgreementPassed =
        Boolean(
          customerX &&
          Math.abs(
            customerX.estimatedLoss -
              399
          ) < 0.01
        );
  
      const futureAgreementSafetyPassed =
        !customerY;
  
      const renewedAgreementSafetyPassed =
        !customerZ;
  
      const agreementNoGuessingPassed =
        !customerAA;
  
      /* ================================== */
      /* DETECTOR #42 */
      /* ================================== */
  
      const detector42Id =
        "home-services.unfollowed-warranty-service";
  
      const detector42Result =
        result.detectorResults.find(
          (item) =>
            item.detectorId ===
            detector42Id
        );
  
      const detector42Leaks =
        detector42Result?.leaks ?? [];
  
      const customerAB =
        detector42Leaks.find(
          (leak) =>
            leak.customerName ===
            "Customer AB"
        );
  
      const customerAC =
        detector42Leaks.find(
          (leak) =>
            leak.customerName ===
            "Customer AC"
        );
  
      const customerAD =
        detector42Leaks.find(
          (leak) =>
            leak.customerName ===
            "Customer AD"
        );
  
      const customerAE =
        detector42Leaks.find(
          (leak) =>
            leak.customerName ===
            "Customer AE"
        );
  
      const overdueWarrantyPassed =
        Boolean(
          customerAB &&
          Math.abs(
            customerAB.estimatedLoss -
              650
          ) < 0.01
        );
  
      const futureWarrantySafetyPassed =
        !customerAC;
  
      const scheduledWarrantySafetyPassed =
        !customerAD;
  
      const warrantyNoGuessingPassed =
        !customerAE;
  
      /* ================================== */
      /* DETECTOR #43 */
      /* ================================== */
  
      const detector43Id =
        "home-services.unsold-replacement-opportunity";
  
      const detector43Result =
        result.detectorResults.find(
          (item) =>
            item.detectorId ===
            detector43Id
        );
  
      const detector43Leaks =
        detector43Result?.leaks ?? [];
  
      const customerAF =
        detector43Leaks.find(
          (leak) =>
            leak.customerName ===
            "Customer AF"
        );
  
      const customerAG =
        detector43Leaks.find(
          (leak) =>
            leak.customerName ===
            "Customer AG"
        );
  
      const customerAH =
        detector43Leaks.find(
          (leak) =>
            leak.customerName ===
            "Customer AH"
        );
  
      const customerAI =
        detector43Leaks.find(
          (leak) =>
            leak.customerName ===
            "Customer AI"
        );
  
      const unsoldReplacementPassed =
        Boolean(
          customerAF &&
          Math.abs(
            customerAF.estimatedLoss -
              12000
          ) < 0.01
        );
  
      const soldReplacementSafetyPassed =
        !customerAG;
  
      const unrecommendedReplacementSafetyPassed =
        !customerAH;
  
      const replacementNoGuessingPassed =
        !customerAI;
  
      /* ================================== */
      /* DETECTOR #44 */
      /* ================================== */
  
      const detector44Id =
        "home-services.missed-upsell-opportunity";
  
      const detector44Result =
        result.detectorResults.find(
          (item) =>
            item.detectorId ===
            detector44Id
        );
  
      const detector44Leaks =
        detector44Result?.leaks ?? [];
  
      const detector44RanPassed =
        Boolean(
          detector44Result?.ran &&
          detector44Result.errors.length ===
            0
        );
  
      const missedUpsellPassed =
        detector44Leaks.some(
          (leak) =>
            leak.customerName ===
              "Customer AJ" &&
            Math.abs(
              leak.estimatedLoss -
                1500
            ) < 0.01 &&
            Math.abs(
              leak.estimatedRecovery -
                450
            ) < 0.01
        );
  
      const offeredUpsellAliasPassed =
        detector44Leaks.some(
          (leak) =>
            leak.customerName ===
              "Customer AK" &&
            Math.abs(
              leak.estimatedLoss -
                650
            ) < 0.01 &&
            Math.abs(
              leak.estimatedRecovery -
                195
            ) < 0.01
        );
  
      const soldUpsellSafetyPassed =
        detector44RanPassed &&
        !detector44Leaks.some(
          (leak) =>
            [
              "Customer AL",
              "Customer AM",
            ].includes(
              leak.customerName ?? ""
            )
        );
  
      const unrecommendedUpsellSafetyPassed =
        detector44RanPassed &&
        !detector44Leaks.some(
          (leak) =>
            [
              "Customer AN",
              "Customer AT",
            ].includes(
              leak.customerName ?? ""
            )
        );
  
      const upsellNoGuessingPassed =
        detector44RanPassed &&
        !detector44Leaks.some(
          (leak) =>
            leak.customerName ===
            "Customer AO"
        );
  
      const missingUpsellItemSafetyPassed =
        detector44RanPassed &&
        !detector44Leaks.some(
          (leak) =>
            leak.customerName ===
            "Customer AP"
        );
  
      const invalidUpsellAmountSafetyPassed =
        detector44RanPassed &&
        !detector44Leaks.some(
          (leak) =>
            [
              "Customer AQ",
              "Customer AR",
              "Customer AS",
            ].includes(
              leak.customerName ?? ""
            )
        );
  
      const upsellLeakCountPassed =
        detector44Leaks.length ===
        2;
  
      /* ================================== */
      /* DETECTOR #45 */
      /* ================================== */
  
      const detector45Id =
        "home-services.uncollected-agreement-payment";
  
      const detector45Result =
        result.detectorResults.find(
          (item) =>
            item.detectorId ===
            detector45Id
        );
  
      const detector45Leaks =
        detector45Result?.leaks ?? [];
  
      const customerAU =
        detector45Leaks.find(
          (leak) =>
            leak.customerName ===
            "Customer AU"
        );
  
      const customerAV =
        detector45Leaks.find(
          (leak) =>
            leak.customerName ===
            "Customer AV"
        );
  
      const customerAW =
        detector45Leaks.find(
          (leak) =>
            leak.customerName ===
            "Customer AW"
        );
  
      const customerAX =
        detector45Leaks.find(
          (leak) =>
            leak.customerName ===
            "Customer AX"
        );
  
      const customerAY =
        detector45Leaks.find(
          (leak) =>
            leak.customerName ===
            "Customer AY"
        );
  
      const overdueAgreementPaymentPassed =
        Boolean(
          customerAU &&
          Math.abs(
            customerAU.estimatedLoss -
              79
          ) < 0.01 &&
          Math.abs(
            customerAU.estimatedRecovery -
              59.25
          ) < 0.01
        );
  
      const paidAgreementPaymentSafetyPassed =
        !customerAV;
  
      const futureAgreementPaymentSafetyPassed =
        !customerAW;
  
      const inactiveAgreementSafetyPassed =
        !customerAX;
  
      const agreementPaymentNoGuessingPassed =
        !customerAY;
  
      const agreementPaymentLeakCountPassed =
        detector45Leaks.length ===
        1;
  
      /* ================================== */
      /* HOME SERVICES HEALTH */
      /* ================================== */
  
      const homeServicesResults =
        result.detectorResults.filter(
          (item) =>
            item.detectorId.startsWith(
              "home-services."
            )
        );
  
      const homeServicesIds =
        homeServicesResults.map(
          (item) =>
            item.detectorId
        );
  
      const expectedHomeServicesIds = [
        detector36Id,
        detector37Id,
        detector38Id,
        detector39Id,
        detector40Id,
        detector41Id,
        detector42Id,
        detector43Id,
        detector44Id,
        detector45Id,
      ];
  
      const allHomeServicesRegistered =
        expectedHomeServicesIds.every(
          (id) =>
            homeServicesIds.includes(id)
        );
  
      const allHomeServicesDetectorsRan =
        homeServicesResults.length ===
          10 &&
        allHomeServicesRegistered &&
        homeServicesResults.every(
          (item) =>
            item.ran &&
            item.errors.length === 0
        );
  
      /* ================================== */
      /* DETECTOR HEALTH */
      /* ================================== */
  
      /*
        Home Services profile runs:
  
        Profile-supported universal detectors
        + 10 Home Services detectors
        = the supported catalog size.
  
        Automotive detectors correctly
        do not run for this profile.
      */
  
      const expectedTotal =
        getSupportedDetectors(profile).filter((detector) =>
          (detector.requirements.requiredFields ?? []).every((field) =>
            rows.some((row) => Object.hasOwn(row, field))
          )
        ).length;
  
      const detectorHealth = {
        expectedTotal,
  
        selected:
          result.stats
            .detectorsSelected,
  
        ran:
          result.stats
            .detectorsRan,
  
        failed:
          result.stats
            .detectorsFailed,
  
        errors:
          result.stats
            .errors,
  
        homeServicesExpected:
          10,
  
        homeServicesSelected:
          homeServicesResults.length,
      };
  
      /* ================================== */
      /* FINAL */
      /* ================================== */
  
      const allPassed =
        result.success &&
  
        approvedEstimatePassed &&
        acceptedAliasPassed &&
        scheduledJobSafetyPassed &&
        unapprovedEstimateSafetyPassed &&
        estimateNoGuessingPassed &&
  
        overdueMaintenancePassed &&
        futureMaintenanceSafetyPassed &&
        scheduledMaintenanceSafetyPassed &&
        maintenanceNoGuessingPassed &&
  
        emergencyCallPassed &&
        qualifiedCallPassed &&
        bookedCallSafetyPassed &&
        unqualifiedCallSafetyPassed &&
        serviceCallNoGuessingPassed &&
  
        uncollectedFeePassed &&
        paidFeeSafetyPassed &&
        cancelledCallSafetyPassed &&
        serviceFeeNoGuessingPassed &&
  
        approvedChangeOrderPassed &&
        performedChangeOrderPassed &&
        billedChangeOrderSafetyPassed &&
        unapprovedChangeOrderSafetyPassed &&
        changeOrderNoGuessingPassed &&
  
        overdueAgreementPassed &&
        futureAgreementSafetyPassed &&
        renewedAgreementSafetyPassed &&
        agreementNoGuessingPassed &&
  
        overdueWarrantyPassed &&
        futureWarrantySafetyPassed &&
        scheduledWarrantySafetyPassed &&
        warrantyNoGuessingPassed &&
  
        unsoldReplacementPassed &&
        soldReplacementSafetyPassed &&
        unrecommendedReplacementSafetyPassed &&
        replacementNoGuessingPassed &&
  
        detector44RanPassed &&
        missedUpsellPassed &&
        offeredUpsellAliasPassed &&
        soldUpsellSafetyPassed &&
        unrecommendedUpsellSafetyPassed &&
        upsellNoGuessingPassed &&
        missingUpsellItemSafetyPassed &&
        invalidUpsellAmountSafetyPassed &&
        upsellLeakCountPassed &&
  
        overdueAgreementPaymentPassed &&
        paidAgreementPaymentSafetyPassed &&
        futureAgreementPaymentSafetyPassed &&
        inactiveAgreementSafetyPassed &&
        agreementPaymentNoGuessingPassed &&
        agreementPaymentLeakCountPassed &&
  
        allHomeServicesRegistered &&
        allHomeServicesDetectorsRan &&
  
        detectorHealth.selected ===
          expectedTotal &&
  
        detectorHealth.ran ===
          expectedTotal &&
  
        detectorHealth.failed === 0 &&
  
        detectorHealth.errors === 0 &&
  
        detectorHealth.homeServicesSelected ===
          detectorHealth.homeServicesExpected;
  
      return NextResponse.json({
        success:
          allPassed,
  
        message:
          allPassed
            ? "Home Services detectors #36 through #45 passed together."
            : "Home Services detectors #36 through #45 have a failing test.",
  
        allPassed,
  
        tests: {
          approvedEstimatePassed,
          acceptedAliasPassed,
          scheduledJobSafetyPassed,
          unapprovedEstimateSafetyPassed,
          estimateNoGuessingPassed,
  
          overdueMaintenancePassed,
          futureMaintenanceSafetyPassed,
          scheduledMaintenanceSafetyPassed,
          maintenanceNoGuessingPassed,
  
          emergencyCallPassed,
          qualifiedCallPassed,
          bookedCallSafetyPassed,
          unqualifiedCallSafetyPassed,
          serviceCallNoGuessingPassed,
  
          uncollectedFeePassed,
          paidFeeSafetyPassed,
          cancelledCallSafetyPassed,
          serviceFeeNoGuessingPassed,
  
          approvedChangeOrderPassed,
          performedChangeOrderPassed,
          billedChangeOrderSafetyPassed,
          unapprovedChangeOrderSafetyPassed,
          changeOrderNoGuessingPassed,
  
          overdueAgreementPassed,
          futureAgreementSafetyPassed,
          renewedAgreementSafetyPassed,
          agreementNoGuessingPassed,
  
          overdueWarrantyPassed,
          futureWarrantySafetyPassed,
          scheduledWarrantySafetyPassed,
          warrantyNoGuessingPassed,
  
          unsoldReplacementPassed,
          soldReplacementSafetyPassed,
          unrecommendedReplacementSafetyPassed,
          replacementNoGuessingPassed,
  
          detector44RanPassed,
          missedUpsellPassed,
          offeredUpsellAliasPassed,
          soldUpsellSafetyPassed,
          unrecommendedUpsellSafetyPassed,
          upsellNoGuessingPassed,
          missingUpsellItemSafetyPassed,
          invalidUpsellAmountSafetyPassed,
          upsellLeakCountPassed,
  
          overdueAgreementPaymentPassed,
          paidAgreementPaymentSafetyPassed,
          futureAgreementPaymentSafetyPassed,
          inactiveAgreementSafetyPassed,
          agreementPaymentNoGuessingPassed,
          agreementPaymentLeakCountPassed,
  
          allHomeServicesRegistered,
          allHomeServicesDetectorsRan,
        },
  
        homeServicesDetectors: {
          expected:
            10,
  
          count:
            homeServicesResults.length,
  
          detectorIds:
            homeServicesIds,
        },
  
        detectorHealth,
  
        detectorLeaks: {
          detector36:
            detector36Leaks,
  
          detector37:
            detector37Leaks,
  
          detector38:
            detector38Leaks,
  
          detector39:
            detector39Leaks,
  
          detector40:
            detector40Leaks,
  
          detector41:
            detector41Leaks,
  
          detector42:
            detector42Leaks,
  
          detector43:
            detector43Leaks,
  
          detector44:
            detector44Leaks,
  
          detector45:
            detector45Leaks,
        },
  
        runnerStats:
          result.stats,
      });
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
  
          error:
            error instanceof Error
              ? error.message
              : "Unknown Home Services detector test error.",
        },
        {
          status: 500,
        }
      );
    }
  }