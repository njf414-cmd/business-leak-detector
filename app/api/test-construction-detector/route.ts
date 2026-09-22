import {
    NextResponse,
  } from "next/server";
  
  import {
    runBusinessDetectors,
  } from "../../lib/business-intelligence/detector-runner";
  
  import {
    getAllDetectors,
    getSupportedDetectors,
  } from "../../lib/business-intelligence/detector-registry";
  
  import type {
    BusinessDataRow,
  } from "../../lib/business-intelligence/detector-types";
  
  import type {
    BusinessIntelligenceProfile,
  } from "../../lib/business-intelligence/types";
  
  import {
    getDetectorCatalog,
    registerDetectorCatalog,
  } from "../../lib/business-intelligence/detector-catalog";
  
  /* ================================== */
  /* TEST PROFILE */
  /* ================================== */
  
  const profile:
    BusinessIntelligenceProfile = {
      businessId:
        "test-construction",
  
      businessName:
        "Test Construction Company",
  
      industry:
        "construction",
  
      businessModel:
        "construction",
  
      revenueModels: [
        "project_based",
        "one_time",
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
        "Test construction business",
  
      metadata: {},
    };
  
  /* ================================== */
  /* TEST */
  /* ================================== */
  
  export async function GET() {
    try {
      registerDetectorCatalog();
  
      /* ================================== */
      /* DEBUG REGISTRATION STATE */
      /* ================================== */
  
      const catalog =
        getDetectorCatalog();
  
      const catalogConstructionIds =
        catalog
          .filter(
            (detector) =>
              detector.scope ===
                "industry" &&
              detector.industries.includes(
                "construction"
              )
          )
          .map(
            (detector) =>
              detector.id
          );
  
      const registryConstructionIds =
        getAllDetectors()
          .filter(
            (detector) =>
              detector.scope ===
                "industry" &&
              detector.industries.includes(
                "construction"
              )
          )
          .map(
            (detector) =>
              detector.id
          );
  
      const supportedConstructionIds =
        getSupportedDetectors(
          profile
        )
          .filter(
            (detector) =>
              detector.id.startsWith(
                "construction."
              )
          )
          .map(
            (detector) =>
              detector.id
          );
  
      const now =
        new Date(
          "2026-09-21T12:00:00.000Z"
        );
  
      const rows:
        BusinessDataRow[] = [
  
          /* ================================== */
          /* #46 */
          /* ================================== */
  
          {
            "Customer Name":
              "Customer A",
            "Project Name":
              "Kitchen Remodel",
            "Project Milestone":
              "Rough-In Complete",
            "Milestone Status":
              "Completed",
            "Progress Payment Amount":
              "12000",
            "Progress Payment Status":
              "Pending",
          },
  
          {
            "Customer Name":
              "Customer B",
            "Project Name":
              "Commercial Buildout",
            "Project Milestone":
              "Framing",
            "Milestone Status":
              "Approved",
            "Progress Payment Amount":
              "25000",
            "Progress Payment Status":
              "Not Billed",
          },
  
          {
            "Customer Name":
              "Customer C",
            "Project Name":
              "Bathroom Remodel",
            "Project Milestone":
              "Tile Complete",
            "Milestone Status":
              "Completed",
            "Progress Payment Amount":
              "6500",
            "Progress Payment Status":
              "Invoiced",
          },
  
          {
            "Customer Name":
              "Customer D",
            "Project Name":
              "Deck Build",
            "Project Milestone":
              "Framing",
            "Milestone Status":
              "In Progress",
            "Progress Payment Amount":
              "4800",
            "Progress Payment Status":
              "Not Billed",
          },
  
          {
            "Customer Name":
              "Customer E",
            "Project Name":
              "Roof Replacement",
            "Project Milestone":
              "Roof Complete",
            "Milestone Status":
              "Completed",
            "Progress Payment Status":
              "Not Billed",
            "Contract Amount":
              "18000",
          },
  
          /* ================================== */
          /* #47 */
          /* ================================== */
  
          {
            "Customer Name":
              "Customer F",
            "Project Name":
              "Office Renovation",
            "Change Order":
              "Additional Electrical Work",
            "Change Order Amount":
              "8500",
            "Change Order Status":
              "Approved",
            "Change Order Billing Status":
              "Not Billed",
          },
  
          {
            "Customer Name":
              "Customer G",
            "Project Name":
              "Home Addition",
            "Change Order":
              "Foundation Extension",
            "Change Order Amount":
              "14500",
            "Change Order Status":
              "Performed",
            "Change Order Billing Status":
              "Pending",
          },
  
          {
            "Customer Name":
              "Customer H",
            "Project Name":
              "Restaurant Buildout",
            "Change Order":
              "Plumbing Upgrade",
            "Change Order Amount":
              "9200",
            "Change Order Status":
              "Approved",
            "Change Order Billing Status":
              "Invoiced",
          },
  
          {
            "Customer Name":
              "Customer I",
            "Project Name":
              "Warehouse Remodel",
            "Change Order":
              "Additional Lighting",
            "Change Order Amount":
              "6000",
            "Change Order Status":
              "Pending",
            "Change Order Billing Status":
              "Not Billed",
          },
  
          {
            "Customer Name":
              "Customer J",
            "Project Name":
              "Retail Renovation",
            "Change Order":
              "Additional Flooring",
            "Change Order Status":
              "Approved",
            "Change Order Billing Status":
              "Not Billed",
            "Contract Amount":
              "30000",
          },
  
          /* ================================== */
          /* #48 */
          /* ================================== */
  
          {
            "Customer Name":
              "Customer K",
            "Project Name":
              "Medical Office Buildout",
            "Retainage Amount":
              "18000",
            "Retainage Release Date":
              "2026-08-01",
            "Retainage Status":
              "Outstanding",
          },
  
          {
            "Customer Name":
              "Customer L",
            "Project Name":
              "Apartment Renovation",
            "Retainage Amount":
              "7500",
            "Retainage Release Date":
              "2026-09-01",
            "Retainage Status":
              "Pending",
          },
  
          {
            "Customer Name":
              "Customer M",
            "Project Name":
              "School Renovation",
            "Retainage Amount":
              "12000",
            "Retainage Release Date":
              "2026-07-15",
            "Retainage Status":
              "Collected",
          },
  
          {
            "Customer Name":
              "Customer N",
            "Project Name":
              "Retail Buildout",
            "Retainage Amount":
              "9000",
            "Retainage Release Date":
              "2026-11-01",
            "Retainage Status":
              "Outstanding",
          },
  
          {
            "Customer Name":
              "Customer O",
            "Project Name":
              "Warehouse Expansion",
            "Retainage Release Date":
              "2026-08-15",
            "Retainage Status":
              "Outstanding",
            "Contract Amount":
              "250000",
          },
  
          /* ================================== */
          /* #49 */
          /* ================================== */
  
          {
            "Customer Name":
              "Customer P",
            "Project Name":
              "Office Renovation",
            "T&M Work":
              "Additional Electrical Repairs",
            "T&M Status":
              "Completed",
            "T&M Labor Amount":
              "3200",
            "T&M Material Amount":
              "2300",
            "T&M Billing Status":
              "Not Billed",
          },
  
          {
            "Customer Name":
              "Customer Q",
            "Project Name":
              "Warehouse Repair",
            "T&M Work":
              "Emergency Labor",
            "T&M Status":
              "Performed",
            "T&M Labor Amount":
              "3200",
            "T&M Billing Status":
              "Pending",
          },
  
          {
            "Customer Name":
              "Customer R",
            "Project Name":
              "Retail Buildout",
            "T&M Work":
              "Additional Framing",
            "T&M Status":
              "Completed",
            "T&M Labor Amount":
              "4000",
            "T&M Material Amount":
              "2500",
            "T&M Billing Status":
              "Invoiced",
          },
  
          {
            "Customer Name":
              "Customer S",
            "Project Name":
              "Apartment Renovation",
            "T&M Work":
              "Plumbing Rework",
            "T&M Status":
              "In Progress",
            "T&M Labor Amount":
              "2800",
            "T&M Material Amount":
              "1200",
            "T&M Billing Status":
              "Not Billed",
          },
  
          {
            "Customer Name":
              "Customer T",
            "Project Name":
              "Commercial Remodel",
            "T&M Work":
              "Additional Site Work",
            "T&M Status":
              "Completed",
            "T&M Billing Status":
              "Not Billed",
            "Job Amount":
              "9000",
          },
  
          /* ================================== */
          /* #50 */
          /* ================================== */
  
          {
            "Customer Name":
              "Customer U",
            "Project Name":
              "Commercial Addition",
            "Project Receivable Amount":
              "16000",
            "Project Receivable Due Date":
              "2026-08-01",
            "Project Receivable Status":
              "Outstanding",
          },
  
          {
            "Customer Name":
              "Customer V",
            "Project Name":
              "Restaurant Renovation",
            "Project Receivable Amount":
              "6500",
            "Project Receivable Due Date":
              "2026-09-01",
            "Project Receivable Status":
              "Past Due",
          },
  
          {
            "Customer Name":
              "Customer W",
            "Project Name":
              "Office Buildout",
            "Project Receivable Amount":
              "11000",
            "Project Receivable Due Date":
              "2026-08-10",
            "Project Receivable Status":
              "Paid",
          },
  
          {
            "Customer Name":
              "Customer X",
            "Project Name":
              "Warehouse Addition",
            "Project Receivable Amount":
              "22000",
            "Project Receivable Due Date":
              "2026-11-01",
            "Project Receivable Status":
              "Outstanding",
          },
  
          {
            "Customer Name":
              "Customer Y",
            "Project Name":
              "Retail Remodel",
            "Project Receivable Due Date":
              "2026-08-20",
            "Project Receivable Status":
              "Outstanding",
            "Invoice Amount":
              "17500",
          },
  
          /* ================================== */
          /* #51 */
          /* ================================== */
  
          {
            "Customer Name":
              "Customer Z",
            "Project Name":
              "Medical Office Expansion",
            "Stored Materials":
              "Electrical Equipment",
            "Stored Materials Amount":
              "12500",
            "Stored Materials Status":
              "Billable",
            "Stored Materials Billing Status":
              "Not Billed",
          },
  
          {
            "Customer Name":
              "Customer AA",
            "Project Name":
              "Restaurant Buildout",
            "Stored Materials":
              "Plumbing Fixtures",
            "Stored Materials Amount":
              "4800",
            "Stored Materials Status":
              "Approved",
            "Stored Materials Billing Status":
              "Pending",
          },
  
          {
            "Customer Name":
              "Customer AB",
            "Project Name":
              "Warehouse Expansion",
            "Stored Materials":
              "Structural Steel",
            "Stored Materials Amount":
              "18000",
            "Stored Materials Status":
              "Ready to Bill",
            "Stored Materials Billing Status":
              "Invoiced",
          },
  
          {
            "Customer Name":
              "Customer AC",
            "Project Name":
              "School Renovation",
            "Stored Materials":
              "Lighting Fixtures",
            "Stored Materials Amount":
              "7200",
            "Stored Materials Status":
              "Stored",
            "Stored Materials Billing Status":
              "Not Billed",
          },
  
          {
            "Customer Name":
              "Customer AD",
            "Project Name":
              "Commercial Remodel",
            "Stored Materials":
              "HVAC Equipment",
            "Stored Materials Status":
              "Approved",
            "Stored Materials Billing Status":
              "Not Billed",
            "Job Amount":
              "30000",
          },
  
          /* ================================== */
          /* #52 */
          /* ================================== */
  
          {
            "Customer Name":
              "Customer AE",
            "Project Name":
              "Hotel Renovation",
            "Mobilization":
              "Initial Site Mobilization",
            "Mobilization Amount":
              "15000",
            "Mobilization Status":
              "Completed",
            "Mobilization Billing Status":
              "Not Billed",
          },
  
          {
            "Customer Name":
              "Customer AF",
            "Project Name":
              "Industrial Buildout",
            "Mobilization":
              "Equipment Mobilization",
            "Mobilization Amount":
              "7500",
            "Mobilization Status":
              "Earned",
            "Mobilization Billing Status":
              "Pending",
          },
  
          {
            "Customer Name":
              "Customer AG",
            "Project Name":
              "Office Addition",
            "Mobilization":
              "Initial Mobilization",
            "Mobilization Amount":
              "10000",
            "Mobilization Status":
              "Completed",
            "Mobilization Billing Status":
              "Invoiced",
          },
  
          {
            "Customer Name":
              "Customer AH",
            "Project Name":
              "Retail Development",
            "Mobilization":
              "Site Mobilization",
            "Mobilization Amount":
              "9000",
            "Mobilization Status":
              "Scheduled",
            "Mobilization Billing Status":
              "Not Billed",
          },
  
          {
            "Customer Name":
              "Customer AI",
            "Project Name":
              "Warehouse Construction",
            "Mobilization":
              "Initial Site Mobilization",
            "Mobilization Status":
              "Completed",
            "Mobilization Billing Status":
              "Not Billed",
            "Contract Amount":
              "400000",
          },
  
          /* ================================== */
          /* #53 */
          /* ================================== */
  
          {
            "Customer Name":
              "Customer AJ",
            "Project Name":
              "Medical Office Renovation",
            "Closeout Item":
              "Final Project Closeout",
            "Closeout Amount":
              "18000",
            "Closeout Status":
              "Complete",
            "Closeout Billing Status":
              "Not Billed",
          },
  
          {
            "Customer Name":
              "Customer AK",
            "Project Name":
              "Commercial Buildout",
            "Closeout Item":
              "Final Completion Payment",
            "Closeout Amount":
              "8500",
            "Closeout Status":
              "Final Approved",
            "Closeout Billing Status":
              "Pending",
          },
  
          {
            "Customer Name":
              "Customer AL",
            "Project Name":
              "Restaurant Renovation",
            "Closeout Item":
              "Project Closeout",
            "Closeout Amount":
              "12000",
            "Closeout Status":
              "Complete",
            "Closeout Billing Status":
              "Invoiced",
          },
  
          {
            "Customer Name":
              "Customer AM",
            "Project Name":
              "Warehouse Expansion",
            "Closeout Item":
              "Final Completion Payment",
            "Closeout Amount":
              "15000",
            "Closeout Status":
              "In Progress",
            "Closeout Billing Status":
              "Not Billed",
          },
  
          {
            "Customer Name":
              "Customer AN",
            "Project Name":
              "School Renovation",
            "Closeout Item":
              "Final Project Closeout",
            "Closeout Status":
              "Complete",
            "Closeout Billing Status":
              "Not Billed",
            "Contract Amount":
              "350000",
          },
  
          /* ================================== */
          /* #54 */
          /* ================================== */
  
          {
            "Customer Name":
              "Customer AO",
            "Project Name":
              "Office Construction",
            "Substantial Completion Item":
              "Substantial Completion Milestone",
            "Substantial Completion Amount":
              "22000",
            "Substantial Completion Status":
              "Substantially Complete",
            "Substantial Completion Billing Status":
              "Not Billed",
            "Substantial Completion Date":
              "2026-09-01",
          },
  
          {
            "Customer Name":
              "Customer AP",
            "Project Name":
              "Retail Development",
            "Substantial Completion Item":
              "Substantial Completion Payment",
            "Substantial Completion Amount":
              "9500",
            "Substantial Completion Status":
              "Approved",
            "Substantial Completion Billing Status":
              "Pending",
            "Substantial Completion Date":
              "2026-09-05",
          },
  
          {
            "Customer Name":
              "Customer AQ",
            "Project Name":
              "Warehouse Construction",
            "Substantial Completion Item":
              "Substantial Completion Milestone",
            "Substantial Completion Amount":
              "17500",
            "Substantial Completion Status":
              "Achieved",
            "Substantial Completion Billing Status":
              "Invoiced",
            "Substantial Completion Date":
              "2026-08-28",
          },
  
          {
            "Customer Name":
              "Customer AR",
            "Project Name":
              "Apartment Development",
            "Substantial Completion Item":
              "Substantial Completion Payment",
            "Substantial Completion Amount":
              "14000",
            "Substantial Completion Status":
              "In Progress",
            "Substantial Completion Billing Status":
              "Not Billed",
          },
  
          {
            "Customer Name":
              "Customer AS",
            "Project Name":
              "School Addition",
            "Substantial Completion Item":
              "Substantial Completion Milestone",
            "Substantial Completion Status":
              "Complete",
            "Substantial Completion Billing Status":
              "Not Billed",
            "Contract Amount":
              "425000",
          },
  
          /* ================================== */
          /* #55 */
          /* ================================== */
  
          /*
            AT:
            Punch-list work complete with
            explicit unbilled amount.
            SHOULD trigger #55 for $12,500.
          */
          {
            "Customer Name":
              "Customer AT",
            "Project Name":
              "Commercial Office Buildout",
            "Punch List Item":
              "Final Punch List Completion",
            "Punch List Amount":
              "12500",
            "Punch List Status":
              "Complete",
            "Punch List Billing Status":
              "Not Billed",
            "Punch List Completion Date":
              "2026-09-02",
          },
  
          /*
            AU:
            Punch list signed off and
            billing remains pending.
            SHOULD trigger #55 for $6,500.
          */
          {
            "Customer Name":
              "Customer AU",
            "Project Name":
              "Restaurant Renovation",
            "Punch List Item":
              "Final Corrections",
            "Punch List Amount":
              "6500",
            "Punch List Status":
              "Signed Off",
            "Punch List Billing Status":
              "Pending",
            "Punch List Completion Date":
              "2026-09-06",
          },
  
          /*
            AV:
            Already invoiced.
            MUST NOT trigger #55.
          */
          {
            "Customer Name":
              "Customer AV",
            "Project Name":
              "Warehouse Expansion",
            "Punch List Item":
              "Final Punch List",
            "Punch List Amount":
              "9000",
            "Punch List Status":
              "Completed",
            "Punch List Billing Status":
              "Invoiced",
            "Punch List Completion Date":
              "2026-08-30",
          },
  
          /*
            AW:
            Punch-list work is not complete.
            MUST NOT trigger #55.
          */
          {
            "Customer Name":
              "Customer AW",
            "Project Name":
              "Apartment Renovation",
            "Punch List Item":
              "Remaining Corrections",
            "Punch List Amount":
              "7800",
            "Punch List Status":
              "In Progress",
            "Punch List Billing Status":
              "Not Billed",
          },
  
          /*
            AX:
            No explicit punch-list amount.
            Contract Amount proves detector
            does not guess.
            MUST NOT trigger #55.
          */
          {
            "Customer Name":
              "Customer AX",
            "Project Name":
              "School Construction",
            "Punch List Item":
              "Final Punch List",
            "Punch List Status":
              "Approved",
            "Punch List Billing Status":
              "Not Billed",
            "Punch List Completion Date":
              "2026-09-08",
            "Contract Amount":
              "500000",
          },
        ];
  
      /* ================================== */
      /* RUN */
      /* ================================== */
  
      const result =
        await runBusinessDetectors({
          profile,
          rows,
          now,
        });
  
      /* ================================== */
      /* DETECTOR IDS */
      /* ================================== */
  
      const progressDetectorId =
        "construction.unbilled-progress-payment";
  
      const changeOrderDetectorId =
        "construction.unbilled-change-order";
  
      const retainageDetectorId =
        "construction.uncollected-retainage";
  
      const timeMaterialsDetectorId =
        "construction.unbilled-time-materials";
  
      const receivableDetectorId =
        "construction.overdue-project-receivable";
  
      const storedMaterialsDetectorId =
        "construction.unbilled-stored-materials";
  
      const mobilizationDetectorId =
        "construction.unbilled-mobilization-payment";
  
      const closeoutDetectorId =
        "construction.unbilled-closeout-payment";
  
      const substantialCompletionDetectorId =
        "construction.unbilled-substantial-completion-payment";
  
      const punchListDetectorId =
        "construction.unbilled-punch-list-payment";
  
      /* ================================== */
      /* RESULT HELPER */
      /* ================================== */
  
      function getLeaks(
        detectorId: string
      ) {
        return (
          result.detectorResults.find(
            (item) =>
              item.detectorId ===
              detectorId
          )?.leaks ?? []
        );
      }
  
      /* ================================== */
      /* #46 */
      /* ================================== */
  
      const progressLeaks =
        getLeaks(
          progressDetectorId
        );
  
      const customerA =
        progressLeaks.find(
          (leak) =>
            leak.customerName ===
            "Customer A"
        );
  
      const customerB =
        progressLeaks.find(
          (leak) =>
            leak.customerName ===
            "Customer B"
        );
  
      const customerC =
        progressLeaks.find(
          (leak) =>
            leak.customerName ===
            "Customer C"
        );
  
      const customerD =
        progressLeaks.find(
          (leak) =>
            leak.customerName ===
            "Customer D"
        );
  
      const customerE =
        progressLeaks.find(
          (leak) =>
            leak.customerName ===
            "Customer E"
        );
  
      const completedMilestonePassed =
        Boolean(
          customerA &&
          Math.abs(
            customerA.estimatedLoss -
              12000
          ) < 0.01
        );
  
      const approvedAliasPassed =
        Boolean(
          customerB &&
          Math.abs(
            customerB.estimatedLoss -
              25000
          ) < 0.01
        );
  
      const billedSafetyPassed =
        !customerC;
  
      const incompleteMilestoneSafetyPassed =
        !customerD;
  
      const progressNoGuessingPassed =
        !customerE;
  
      /* ================================== */
      /* #47 */
      /* ================================== */
  
      const changeOrderLeaks =
        getLeaks(
          changeOrderDetectorId
        );
  
      const customerF =
        changeOrderLeaks.find(
          (leak) =>
            leak.customerName ===
            "Customer F"
        );
  
      const customerG =
        changeOrderLeaks.find(
          (leak) =>
            leak.customerName ===
            "Customer G"
        );
  
      const customerH =
        changeOrderLeaks.find(
          (leak) =>
            leak.customerName ===
            "Customer H"
        );
  
      const customerI =
        changeOrderLeaks.find(
          (leak) =>
            leak.customerName ===
            "Customer I"
        );
  
      const customerJ =
        changeOrderLeaks.find(
          (leak) =>
            leak.customerName ===
            "Customer J"
        );
  
      const approvedChangeOrderPassed =
        Boolean(
          customerF &&
          Math.abs(
            customerF.estimatedLoss -
              8500
          ) < 0.01
        );
  
      const performedAliasPassed =
        Boolean(
          customerG &&
          Math.abs(
            customerG.estimatedLoss -
              14500
          ) < 0.01
        );
  
      const billedChangeOrderSafetyPassed =
        !customerH;
  
      const unapprovedChangeOrderSafetyPassed =
        !customerI;
  
      const changeOrderNoGuessingPassed =
        !customerJ;
  
      /* ================================== */
      /* #48 */
      /* ================================== */
  
      const retainageLeaks =
        getLeaks(
          retainageDetectorId
        );
  
      const customerK =
        retainageLeaks.find(
          (leak) =>
            leak.customerName ===
            "Customer K"
        );
  
      const customerL =
        retainageLeaks.find(
          (leak) =>
            leak.customerName ===
            "Customer L"
        );
  
      const customerM =
        retainageLeaks.find(
          (leak) =>
            leak.customerName ===
            "Customer M"
        );
  
      const customerN =
        retainageLeaks.find(
          (leak) =>
            leak.customerName ===
            "Customer N"
        );
  
      const customerO =
        retainageLeaks.find(
          (leak) =>
            leak.customerName ===
            "Customer O"
        );
  
      const overdueRetainagePassed =
        Boolean(
          customerK &&
          Math.abs(
            customerK.estimatedLoss -
              18000
          ) < 0.01
        );
  
      const secondRetainagePassed =
        Boolean(
          customerL &&
          Math.abs(
            customerL.estimatedLoss -
              7500
          ) < 0.01
        );
  
      const collectedRetainageSafetyPassed =
        !customerM;
  
      const futureRetainageSafetyPassed =
        !customerN;
  
      const retainageNoGuessingPassed =
        !customerO;
  
      /* ================================== */
      /* #49 */
      /* ================================== */
  
      const timeMaterialsLeaks =
        getLeaks(
          timeMaterialsDetectorId
        );
  
      const customerP =
        timeMaterialsLeaks.find(
          (leak) =>
            leak.customerName ===
            "Customer P"
        );
  
      const customerQ =
        timeMaterialsLeaks.find(
          (leak) =>
            leak.customerName ===
            "Customer Q"
        );
  
      const customerR =
        timeMaterialsLeaks.find(
          (leak) =>
            leak.customerName ===
            "Customer R"
        );
  
      const customerS =
        timeMaterialsLeaks.find(
          (leak) =>
            leak.customerName ===
            "Customer S"
        );
  
      const customerT =
        timeMaterialsLeaks.find(
          (leak) =>
            leak.customerName ===
            "Customer T"
        );
  
      const combinedTimeMaterialsPassed =
        Boolean(
          customerP &&
          Math.abs(
            customerP.estimatedLoss -
              5500
          ) < 0.01
        );
  
      const laborOnlyTimeMaterialsPassed =
        Boolean(
          customerQ &&
          Math.abs(
            customerQ.estimatedLoss -
              3200
          ) < 0.01
        );
  
      const billedTimeMaterialsSafetyPassed =
        !customerR;
  
      const incompleteTimeMaterialsSafetyPassed =
        !customerS;
  
      const timeMaterialsNoGuessingPassed =
        !customerT;
  
      /* ================================== */
      /* #50 */
      /* ================================== */
  
      const receivableLeaks =
        getLeaks(
          receivableDetectorId
        );
  
      const customerU =
        receivableLeaks.find(
          (leak) =>
            leak.customerName ===
            "Customer U"
        );
  
      const customerV =
        receivableLeaks.find(
          (leak) =>
            leak.customerName ===
            "Customer V"
        );
  
      const customerW =
        receivableLeaks.find(
          (leak) =>
            leak.customerName ===
            "Customer W"
        );
  
      const customerX =
        receivableLeaks.find(
          (leak) =>
            leak.customerName ===
            "Customer X"
        );
  
      const customerY =
        receivableLeaks.find(
          (leak) =>
            leak.customerName ===
            "Customer Y"
        );
  
      const overdueReceivablePassed =
        Boolean(
          customerU &&
          Math.abs(
            customerU.estimatedLoss -
              16000
          ) < 0.01
        );
  
      const pastDueAliasPassed =
        Boolean(
          customerV &&
          Math.abs(
            customerV.estimatedLoss -
              6500
          ) < 0.01
        );
  
      const paidReceivableSafetyPassed =
        !customerW;
  
      const futureReceivableSafetyPassed =
        !customerX;
  
      const receivableNoGuessingPassed =
        !customerY;
  
      /* ================================== */
      /* #51 */
      /* ================================== */
  
      const storedMaterialsLeaks =
        getLeaks(
          storedMaterialsDetectorId
        );
  
      const customerZ =
        storedMaterialsLeaks.find(
          (leak) =>
            leak.customerName ===
            "Customer Z"
        );
  
      const customerAA =
        storedMaterialsLeaks.find(
          (leak) =>
            leak.customerName ===
            "Customer AA"
        );
  
      const customerAB =
        storedMaterialsLeaks.find(
          (leak) =>
            leak.customerName ===
            "Customer AB"
        );
  
      const customerAC =
        storedMaterialsLeaks.find(
          (leak) =>
            leak.customerName ===
            "Customer AC"
        );
  
      const customerAD =
        storedMaterialsLeaks.find(
          (leak) =>
            leak.customerName ===
            "Customer AD"
        );
  
      const billableStoredMaterialsPassed =
        Boolean(
          customerZ &&
          Math.abs(
            customerZ.estimatedLoss -
              12500
          ) < 0.01
        );
  
      const approvedStoredMaterialsPassed =
        Boolean(
          customerAA &&
          Math.abs(
            customerAA.estimatedLoss -
              4800
          ) < 0.01
        );
  
      const billedStoredMaterialsSafetyPassed =
        !customerAB;
  
      const unapprovedStoredMaterialsSafetyPassed =
        !customerAC;
  
      const storedMaterialsNoGuessingPassed =
        !customerAD;
  
      const storedMaterialsLeakCountPassed =
        storedMaterialsLeaks.length ===
        2;
  
      /* ================================== */
      /* #52 */
      /* ================================== */
  
      const mobilizationLeaks =
        getLeaks(
          mobilizationDetectorId
        );
  
      const customerAE =
        mobilizationLeaks.find(
          (leak) =>
            leak.customerName ===
            "Customer AE"
        );
  
      const customerAF =
        mobilizationLeaks.find(
          (leak) =>
            leak.customerName ===
            "Customer AF"
        );
  
      const customerAG =
        mobilizationLeaks.find(
          (leak) =>
            leak.customerName ===
            "Customer AG"
        );
  
      const customerAH =
        mobilizationLeaks.find(
          (leak) =>
            leak.customerName ===
            "Customer AH"
        );
  
      const customerAI =
        mobilizationLeaks.find(
          (leak) =>
            leak.customerName ===
            "Customer AI"
        );
  
      const completedMobilizationPassed =
        Boolean(
          customerAE &&
          Math.abs(
            customerAE.estimatedLoss -
              15000
          ) < 0.01
        );
  
      const earnedMobilizationPassed =
        Boolean(
          customerAF &&
          Math.abs(
            customerAF.estimatedLoss -
              7500
          ) < 0.01
        );
  
      const billedMobilizationSafetyPassed =
        !customerAG;
  
      const incompleteMobilizationSafetyPassed =
        !customerAH;
  
      const mobilizationNoGuessingPassed =
        !customerAI;
  
      const mobilizationLeakCountPassed =
        mobilizationLeaks.length ===
        2;
  
      /* ================================== */
      /* #53 */
      /* ================================== */
  
      const closeoutLeaks =
        getLeaks(
          closeoutDetectorId
        );
  
      const customerAJ =
        closeoutLeaks.find(
          (leak) =>
            leak.customerName ===
            "Customer AJ"
        );
  
      const customerAK =
        closeoutLeaks.find(
          (leak) =>
            leak.customerName ===
            "Customer AK"
        );
  
      const customerAL =
        closeoutLeaks.find(
          (leak) =>
            leak.customerName ===
            "Customer AL"
        );
  
      const customerAM =
        closeoutLeaks.find(
          (leak) =>
            leak.customerName ===
            "Customer AM"
        );
  
      const customerAN =
        closeoutLeaks.find(
          (leak) =>
            leak.customerName ===
            "Customer AN"
        );
  
      const completedCloseoutPassed =
        Boolean(
          customerAJ &&
          Math.abs(
            customerAJ.estimatedLoss -
              18000
          ) < 0.01
        );
  
      const approvedCloseoutPassed =
        Boolean(
          customerAK &&
          Math.abs(
            customerAK.estimatedLoss -
              8500
          ) < 0.01
        );
  
      const billedCloseoutSafetyPassed =
        !customerAL;
  
      const incompleteCloseoutSafetyPassed =
        !customerAM;
  
      const closeoutNoGuessingPassed =
        !customerAN;
  
      const closeoutLeakCountPassed =
        closeoutLeaks.length ===
        2;
  
      /* ================================== */
      /* #54 */
      /* ================================== */
  
      const substantialCompletionLeaks =
        getLeaks(
          substantialCompletionDetectorId
        );
  
      const customerAO =
        substantialCompletionLeaks.find(
          (leak) =>
            leak.customerName ===
            "Customer AO"
        );
  
      const customerAP =
        substantialCompletionLeaks.find(
          (leak) =>
            leak.customerName ===
            "Customer AP"
        );
  
      const customerAQ =
        substantialCompletionLeaks.find(
          (leak) =>
            leak.customerName ===
            "Customer AQ"
        );
  
      const customerAR =
        substantialCompletionLeaks.find(
          (leak) =>
            leak.customerName ===
            "Customer AR"
        );
  
      const customerAS =
        substantialCompletionLeaks.find(
          (leak) =>
            leak.customerName ===
            "Customer AS"
        );
  
      const substantialCompletionPassed =
        Boolean(
          customerAO &&
          Math.abs(
            customerAO.estimatedLoss -
              22000
          ) < 0.01
        );
  
      const approvedSubstantialCompletionPassed =
        Boolean(
          customerAP &&
          Math.abs(
            customerAP.estimatedLoss -
              9500
          ) < 0.01
        );
  
      const billedSubstantialCompletionSafetyPassed =
        !customerAQ;
  
      const incompleteSubstantialCompletionSafetyPassed =
        !customerAR;
  
      const substantialCompletionNoGuessingPassed =
        !customerAS;
  
      const substantialCompletionLeakCountPassed =
        substantialCompletionLeaks.length ===
        2;
  
      /* ================================== */
      /* #55 */
      /* ================================== */
  
      const punchListLeaks =
        getLeaks(
          punchListDetectorId
        );
  
      const customerAT =
        punchListLeaks.find(
          (leak) =>
            leak.customerName ===
            "Customer AT"
        );
  
      const customerAU =
        punchListLeaks.find(
          (leak) =>
            leak.customerName ===
            "Customer AU"
        );
  
      const customerAV =
        punchListLeaks.find(
          (leak) =>
            leak.customerName ===
            "Customer AV"
        );
  
      const customerAW =
        punchListLeaks.find(
          (leak) =>
            leak.customerName ===
            "Customer AW"
        );
  
      const customerAX =
        punchListLeaks.find(
          (leak) =>
            leak.customerName ===
            "Customer AX"
        );
  
      const completedPunchListPassed =
        Boolean(
          customerAT &&
          Math.abs(
            customerAT.estimatedLoss -
              12500
          ) < 0.01
        );
  
      const signedOffPunchListPassed =
        Boolean(
          customerAU &&
          Math.abs(
            customerAU.estimatedLoss -
              6500
          ) < 0.01
        );
  
      const billedPunchListSafetyPassed =
        !customerAV;
  
      const incompletePunchListSafetyPassed =
        !customerAW;
  
      const punchListNoGuessingPassed =
        !customerAX;
  
      const punchListLeakCountPassed =
        punchListLeaks.length ===
        2;
  
      /* ================================== */
      /* CONSTRUCTION HEALTH */
      /* ================================== */
  
      const constructionResults =
        result.detectorResults.filter(
          (item) =>
            item.detectorId.startsWith(
              "construction."
            )
        );
  
      const constructionIds =
        constructionResults.map(
          (item) =>
            item.detectorId
        );
  
      const progressDetectorRegistered =
        constructionIds.includes(
          progressDetectorId
        );
  
      const changeOrderDetectorRegistered =
        constructionIds.includes(
          changeOrderDetectorId
        );
  
      const retainageDetectorRegistered =
        constructionIds.includes(
          retainageDetectorId
        );
  
      const timeMaterialsDetectorRegistered =
        constructionIds.includes(
          timeMaterialsDetectorId
        );
  
      const receivableDetectorRegistered =
        constructionIds.includes(
          receivableDetectorId
        );
  
      const storedMaterialsDetectorRegistered =
        constructionIds.includes(
          storedMaterialsDetectorId
        );
  
      const mobilizationDetectorRegistered =
        constructionIds.includes(
          mobilizationDetectorId
        );
  
      const closeoutDetectorRegistered =
        constructionIds.includes(
          closeoutDetectorId
        );
  
      const substantialCompletionDetectorRegistered =
        constructionIds.includes(
          substantialCompletionDetectorId
        );
  
      const punchListDetectorRegistered =
        constructionIds.includes(
          punchListDetectorId
        );
  
      const allConstructionDetectorsRan =
        constructionResults.length ===
          10 &&
        progressDetectorRegistered &&
        changeOrderDetectorRegistered &&
        retainageDetectorRegistered &&
        timeMaterialsDetectorRegistered &&
        receivableDetectorRegistered &&
        storedMaterialsDetectorRegistered &&
        mobilizationDetectorRegistered &&
        closeoutDetectorRegistered &&
        substantialCompletionDetectorRegistered &&
        punchListDetectorRegistered &&
        constructionResults.every(
          (item) =>
            item.ran &&
            item.errors.length === 0
        );
  
      /* ================================== */
      /* DETECTOR HEALTH */
      /* ================================== */
  
      /*
        Profile-supported universal
        + 10 construction
        = the supported catalog size.
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
  
        constructionExpected:
          10,
  
        constructionSelected:
          constructionResults.length,
      };
  
      /* ================================== */
      /* FINAL */
      /* ================================== */
  
      const allPassed =
        result.success &&
  
        completedMilestonePassed &&
        approvedAliasPassed &&
        billedSafetyPassed &&
        incompleteMilestoneSafetyPassed &&
        progressNoGuessingPassed &&
  
        approvedChangeOrderPassed &&
        performedAliasPassed &&
        billedChangeOrderSafetyPassed &&
        unapprovedChangeOrderSafetyPassed &&
        changeOrderNoGuessingPassed &&
  
        overdueRetainagePassed &&
        secondRetainagePassed &&
        collectedRetainageSafetyPassed &&
        futureRetainageSafetyPassed &&
        retainageNoGuessingPassed &&
  
        combinedTimeMaterialsPassed &&
        laborOnlyTimeMaterialsPassed &&
        billedTimeMaterialsSafetyPassed &&
        incompleteTimeMaterialsSafetyPassed &&
        timeMaterialsNoGuessingPassed &&
  
        overdueReceivablePassed &&
        pastDueAliasPassed &&
        paidReceivableSafetyPassed &&
        futureReceivableSafetyPassed &&
        receivableNoGuessingPassed &&
  
        billableStoredMaterialsPassed &&
        approvedStoredMaterialsPassed &&
        billedStoredMaterialsSafetyPassed &&
        unapprovedStoredMaterialsSafetyPassed &&
        storedMaterialsNoGuessingPassed &&
        storedMaterialsLeakCountPassed &&
  
        completedMobilizationPassed &&
        earnedMobilizationPassed &&
        billedMobilizationSafetyPassed &&
        incompleteMobilizationSafetyPassed &&
        mobilizationNoGuessingPassed &&
        mobilizationLeakCountPassed &&
  
        completedCloseoutPassed &&
        approvedCloseoutPassed &&
        billedCloseoutSafetyPassed &&
        incompleteCloseoutSafetyPassed &&
        closeoutNoGuessingPassed &&
        closeoutLeakCountPassed &&
  
        substantialCompletionPassed &&
        approvedSubstantialCompletionPassed &&
        billedSubstantialCompletionSafetyPassed &&
        incompleteSubstantialCompletionSafetyPassed &&
        substantialCompletionNoGuessingPassed &&
        substantialCompletionLeakCountPassed &&
  
        completedPunchListPassed &&
        signedOffPunchListPassed &&
        billedPunchListSafetyPassed &&
        incompletePunchListSafetyPassed &&
        punchListNoGuessingPassed &&
        punchListLeakCountPassed &&
  
        progressDetectorRegistered &&
        changeOrderDetectorRegistered &&
        retainageDetectorRegistered &&
        timeMaterialsDetectorRegistered &&
        receivableDetectorRegistered &&
        storedMaterialsDetectorRegistered &&
        mobilizationDetectorRegistered &&
        closeoutDetectorRegistered &&
        substantialCompletionDetectorRegistered &&
        punchListDetectorRegistered &&
  
        allConstructionDetectorsRan &&
  
        detectorHealth.selected ===
          expectedTotal &&
  
        detectorHealth.ran ===
          expectedTotal &&
  
        detectorHealth.failed ===
          0 &&
  
        detectorHealth.errors ===
          0 &&
  
        detectorHealth.constructionSelected ===
          detectorHealth.constructionExpected;
  
      return NextResponse.json({
        success:
          allPassed,
  
        message:
          allPassed
            ? "Construction detectors #46 through #55 passed together."
            : "Construction detectors #46 through #55 have a failing test.",
  
        allPassed,
  
        debug: {
          catalogConstructionCount:
            catalogConstructionIds.length,
  
          catalogConstructionIds,
  
          registryConstructionCount:
            registryConstructionIds.length,
  
          registryConstructionIds,
  
          supportedConstructionCount:
            supportedConstructionIds.length,
  
          supportedConstructionIds,
        },
  
        tests: {
          completedMilestonePassed,
          approvedAliasPassed,
          billedSafetyPassed,
          incompleteMilestoneSafetyPassed,
          progressNoGuessingPassed,
  
          approvedChangeOrderPassed,
          performedAliasPassed,
          billedChangeOrderSafetyPassed,
          unapprovedChangeOrderSafetyPassed,
          changeOrderNoGuessingPassed,
  
          overdueRetainagePassed,
          secondRetainagePassed,
          collectedRetainageSafetyPassed,
          futureRetainageSafetyPassed,
          retainageNoGuessingPassed,
  
          combinedTimeMaterialsPassed,
          laborOnlyTimeMaterialsPassed,
          billedTimeMaterialsSafetyPassed,
          incompleteTimeMaterialsSafetyPassed,
          timeMaterialsNoGuessingPassed,
  
          overdueReceivablePassed,
          pastDueAliasPassed,
          paidReceivableSafetyPassed,
          futureReceivableSafetyPassed,
          receivableNoGuessingPassed,
  
          billableStoredMaterialsPassed,
          approvedStoredMaterialsPassed,
          billedStoredMaterialsSafetyPassed,
          unapprovedStoredMaterialsSafetyPassed,
          storedMaterialsNoGuessingPassed,
          storedMaterialsLeakCountPassed,
  
          completedMobilizationPassed,
          earnedMobilizationPassed,
          billedMobilizationSafetyPassed,
          incompleteMobilizationSafetyPassed,
          mobilizationNoGuessingPassed,
          mobilizationLeakCountPassed,
  
          completedCloseoutPassed,
          approvedCloseoutPassed,
          billedCloseoutSafetyPassed,
          incompleteCloseoutSafetyPassed,
          closeoutNoGuessingPassed,
          closeoutLeakCountPassed,
  
          substantialCompletionPassed,
          approvedSubstantialCompletionPassed,
          billedSubstantialCompletionSafetyPassed,
          incompleteSubstantialCompletionSafetyPassed,
          substantialCompletionNoGuessingPassed,
          substantialCompletionLeakCountPassed,
  
          completedPunchListPassed,
          signedOffPunchListPassed,
          billedPunchListSafetyPassed,
          incompletePunchListSafetyPassed,
          punchListNoGuessingPassed,
          punchListLeakCountPassed,
  
          progressDetectorRegistered,
          changeOrderDetectorRegistered,
          retainageDetectorRegistered,
          timeMaterialsDetectorRegistered,
          receivableDetectorRegistered,
          storedMaterialsDetectorRegistered,
          mobilizationDetectorRegistered,
          closeoutDetectorRegistered,
          substantialCompletionDetectorRegistered,
          punchListDetectorRegistered,
  
          allConstructionDetectorsRan,
        },
  
        constructionDetectors: {
          expected:
            10,
  
          count:
            constructionResults.length,
  
          detectorIds:
            constructionIds,
        },
  
        detectorHealth,
  
        progressLeaks,
        changeOrderLeaks,
        retainageLeaks,
        timeMaterialsLeaks,
        receivableLeaks,
        storedMaterialsLeaks,
        mobilizationLeaks,
        closeoutLeaks,
        substantialCompletionLeaks,
        punchListLeaks,
  
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
              : "Unknown construction detector test error.",
        },
        {
          status: 500,
        }
      );
    }
  }