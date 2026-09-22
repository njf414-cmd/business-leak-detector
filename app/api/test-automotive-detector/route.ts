import {
    NextResponse,
  } from "next/server";
  
  import {
    runBusinessDetectors,
  } from "../../lib/business-intelligence/detector-runner";
  
  import {
    createDefaultBusinessProfile,
  } from "../../lib/business-intelligence/types";
  
  import type {
    BusinessDataRow,
  } from "../../lib/business-intelligence/detector-types";
  
  import {
    registerDetectorCatalog,
  } from "../../lib/business-intelligence/detector-catalog";
  
  /* ================================== */
  /* TEST CLOCK */
  /* ================================== */
  
  const TEST_NOW =
    new Date(
      "2026-09-21T12:00:00"
    );
  
  /* ================================== */
  /* AUTOMOTIVE PROFILE */
  /* ================================== */
  
  function createAutomotiveProfile() {
    const profile =
      createDefaultBusinessProfile();
  
    return {
      ...profile,
  
      businessName:
        "Automotive Detector Test",
  
      industry:
        "automotive" as const,
  
      businessModel:
        "automotive" as const,
  
      revenueModels: [
        "one_time" as const,
        "recurring" as const,
      ],
    };
  }
  
  /* ================================== */
  /* TEST DATA */
  /* ================================== */
  
  const TEST_ROWS:
    BusinessDataRow[] = [
  
      /* #26 — UNPERFORMED */
  
      {
        "Customer Name":
          "Automotive Test A",
  
        "Recommended Service":
          "Brake Replacement",
  
        "Recommended Service Amount":
          "850",
  
        "Recommended Service Status":
          "Recommended",
      },
  
      /* #27 — DECLINED */
  
      {
        "Customer Name":
          "Automotive Test B",
  
        "Recommended Service":
          "Transmission Service",
  
        "Recommended Service Amount":
          "1200",
  
        "Recommended Service Status":
          "Declined",
      },
  
      /* COMPLETED SAFETY */
  
      {
        "Customer Name":
          "Automotive Test C",
  
        "Recommended Service":
          "Tire Replacement",
  
        "Recommended Service Amount":
          "900",
  
        "Recommended Service Status":
          "Completed",
      },
  
      /* NO MONEY GUESSING */
  
      {
        "Customer Name":
          "Automotive Test D",
  
        "Recommended Service":
          "Suspension Repair",
  
        "Recommended Service Status":
          "Recommended",
  
        "Job Amount":
          "5000",
      },
  
      /* #28 — DEFERRED */
  
      {
        "Customer Name":
          "Automotive Test E",
  
        "Recommended Service":
          "Timing Belt Replacement",
  
        "Recommended Service Amount":
          "1100",
  
        "Recommended Service Status":
          "Deferred",
      },
  
      /* #29 — OVERDUE MAINTENANCE */
  
      {
        "Customer Name":
          "Automotive Test F",
  
        "Maintenance Service":
          "60,000 Mile Service",
  
        "Maintenance Amount":
          "600",
  
        "Maintenance Due Date":
          "2026-07-01",
  
        "Maintenance Status":
          "Due",
      },
  
      /* FUTURE MAINTENANCE SAFETY */
  
      {
        "Customer Name":
          "Automotive Test G",
  
        "Maintenance Service":
          "Oil Change",
  
        "Maintenance Amount":
          "125",
  
        "Maintenance Due Date":
          "2026-11-01",
  
        "Maintenance Status":
          "Scheduled",
      },
  
      /* COMPLETED MAINTENANCE SAFETY */
  
      {
        "Customer Name":
          "Automotive Test H",
  
        "Maintenance Service":
          "Brake Fluid Service",
  
        "Maintenance Amount":
          "200",
  
        "Maintenance Due Date":
          "2026-06-01",
  
        "Maintenance Status":
          "Completed",
      },
  
      /* #30 — UNRETURNED CUSTOMER */
  
      {
        "Customer Name":
          "Automotive Test I",
  
        "Last Service Date":
          "2026-03-01",
  
        "Expected Return Days":
          "90",
  
        "Expected Return Service":
          "Oil Change",
  
        "Expected Return Amount":
          "150",
      },
  
      /* STILL INSIDE RETURN WINDOW */
  
      {
        "Customer Name":
          "Automotive Test J",
  
        "Last Service Date":
          "2026-08-15",
  
        "Expected Return Days":
          "90",
  
        "Expected Return Service":
          "Oil Change",
  
        "Expected Return Amount":
          "150",
      },
  
      /* MISSING RETURN INTERVAL */
  
      {
        "Customer Name":
          "Automotive Test K",
  
        "Last Service Date":
          "2026-01-01",
  
        "Expected Return Service":
          "Inspection",
  
        "Expected Return Amount":
          "200",
      },
  
      /* MISSING RETURN AMOUNT */
  
      {
        "Customer Name":
          "Automotive Test L",
  
        "Last Service Date":
          "2026-01-01",
  
        "Expected Return Days":
          "90",
  
        "Expected Return Service":
          "Inspection",
  
        "Job Amount":
          "5000",
      },
  
      /* #31 — UNSOLD INSPECTION */
  
      {
        "Customer Name":
          "Automotive Test M",
  
        "Inspection Recommendation":
          "Front Brake Replacement",
  
        "Inspection Recommendation Amount":
          "950",
  
        "Inspection Recommendation Status":
          "Unsold",
      },
  
      /* COMPLETED INSPECTION SAFETY */
  
      {
        "Customer Name":
          "Automotive Test N",
  
        "Inspection Recommendation":
          "Rear Tire Replacement",
  
        "Inspection Recommendation Amount":
          "700",
  
        "Inspection Recommendation Status":
          "Completed",
      },
  
      /* INSPECTION NO MONEY GUESSING */
  
      {
        "Customer Name":
          "Automotive Test O",
  
        "Inspection Recommendation":
          "Control Arm Replacement",
  
        "Inspection Recommendation Status":
          "Unsold",
  
        "Job Amount":
          "4000",
      },
  
      /* #32 — WARRANTY / COMEBACK */
  
      {
        "Customer Name":
          "Automotive Test P",
  
        "Comeback Type":
          "Warranty",
  
        "Comeback Service":
          "Water Pump Replacement",
  
        "Comeback Cost":
          "650",
      },
  
      /* #32 — COMEBACK ALIAS */
  
      {
        "Customer Name":
          "Automotive Test Q",
  
        "Comeback Type":
          "Comeback",
  
        "Comeback Service":
          "Brake Repair",
  
        "Comeback Cost":
          "300",
      },
  
      /* NORMAL JOB SAFETY */
  
      {
        "Customer Name":
          "Automotive Test R",
  
        "Comeback Type":
          "Normal",
  
        "Comeback Service":
          "Oil Change",
  
        "Comeback Cost":
          "100",
      },
  
      /* COMEBACK NO MONEY GUESSING */
  
      {
        "Customer Name":
          "Automotive Test S",
  
        "Comeback Type":
          "Warranty",
  
        "Comeback Service":
          "Transmission Repair",
  
        "Job Amount":
          "5000",
      },
  
      /* #33 — UNBILLED PARTS */
  
      {
        "Customer Name":
          "Automotive Test T",
  
        "Unbilled Item":
          "Brake Pads",
  
        "Unbilled Type":
          "Parts",
  
        "Unbilled Amount":
          "275",
  
        "Unbilled Status":
          "Unbilled",
      },
  
      /* #33 — UNBILLED LABOR */
  
      {
        "Customer Name":
          "Automotive Test U",
  
        "Unbilled Item":
          "Diagnostic Labor",
  
        "Unbilled Type":
          "Labor",
  
        "Unbilled Amount":
          "180",
  
        "Unbilled Status":
          "Left Off Invoice",
      },
  
      /* NORMAL BILLED ITEM SAFETY */
  
      {
        "Customer Name":
          "Automotive Test V",
  
        "Unbilled Item":
          "Oil Filter",
  
        "Unbilled Type":
          "Parts",
  
        "Unbilled Amount":
          "30",
  
        "Unbilled Status":
          "Billed",
      },
  
      /* UNBILLED NO MONEY GUESSING */
  
      {
        "Customer Name":
          "Automotive Test W",
  
        "Unbilled Item":
          "Alternator Labor",
  
        "Unbilled Type":
          "Labor",
  
        "Unbilled Status":
          "Unbilled",
  
        "Job Amount":
          "2500",
      },
  
      /* #34 — UNDERCHARGED LABOR */
  
      {
        "Customer Name":
          "Automotive Test X",
  
        "Labor Description":
          "Engine Diagnostic",
  
        "Labor Hours":
          "3",
  
        "Labor Rate":
          "150",
  
        "Labor Charged":
          "300",
      },
  
      /* #34 — CORRECT LABOR CHARGE */
  
      {
        "Customer Name":
          "Automotive Test Y",
  
        "Labor Description":
          "Brake Labor",
  
        "Labor Hours":
          "2",
  
        "Labor Rate":
          "150",
  
        "Labor Charged":
          "300",
      },
  
      /* #34 — OVERCHARGED SAFETY */
  
      {
        "Customer Name":
          "Automotive Test Z",
  
        "Labor Description":
          "Suspension Labor",
  
        "Labor Hours":
          "2",
  
        "Labor Rate":
          "150",
  
        "Labor Charged":
          "350",
      },
  
      /* #34 — NO GUESSING */
  
      {
        "Customer Name":
          "Automotive Test AA",
  
        "Labor Description":
          "Transmission Labor",
  
        "Labor Hours":
          "4",
  
        "Labor Charged":
          "300",
  
        "Job Amount":
          "5000",
      },
  
      /* #35 — MISSED REBOOKING */
  
      {
        "Customer Name":
          "Automotive Test AB",
  
        "Next Service":
          "Oil Change",
  
        "Next Service Date":
          "2026-10-05",
  
        "Next Service Amount":
          "150",
  
        "Next Appointment Status":
          "Not Booked",
      },
  
      /* #35 — ALREADY BOOKED SAFETY */
  
      {
        "Customer Name":
          "Automotive Test AC",
  
        "Next Service":
          "Tire Rotation",
  
        "Next Service Date":
          "2026-10-10",
  
        "Next Service Amount":
          "100",
  
        "Next Appointment Status":
          "Scheduled",
      },
  
      /* #35 — OVERDUE SAFETY */
  
      {
        "Customer Name":
          "Automotive Test AD",
  
        "Next Service":
          "Brake Inspection",
  
        "Next Service Date":
          "2026-08-01",
  
        "Next Service Amount":
          "200",
  
        "Next Appointment Status":
          "Not Booked",
      },
  
      /* #35 — NO MONEY GUESSING */
  
      {
        "Customer Name":
          "Automotive Test AE",
  
        "Next Service":
          "Transmission Service",
  
        "Next Service Date":
          "2026-10-15",
  
        "Next Appointment Status":
          "Not Booked",
  
        "Job Amount":
          "5000",
      },
    ];
  
  /* ================================== */
  /* TYPES + HELPERS */
  /* ================================== */
  
  type RunnerResult =
    Awaited<
      ReturnType<
        typeof runBusinessDetectors
      >
    >;
  
  function customerLeaks(
    leaks: RunnerResult["leaks"],
    customerName: string
  ) {
    return leaks.filter(
      (leak) =>
        leak.customerName ===
        customerName
    );
  }
  
  function hasLeak(
    leaks: RunnerResult["leaks"],
    customerName: string,
    leakType: string,
    expectedLoss: number
  ): boolean {
    return leaks.some(
      (leak) =>
        leak.customerName ===
          customerName &&
        leak.leakType ===
          leakType &&
        Math.abs(
          leak.estimatedLoss -
            expectedLoss
        ) < 0.01
    );
  }
  
  /* ================================== */
  /* ROUTE */
  /* ================================== */
  
  export async function GET() {
    try {
      registerDetectorCatalog();
  
      const result =
        await runBusinessDetectors({
          profile:
            createAutomotiveProfile(),
  
          rows:
            TEST_ROWS,
  
          now:
            TEST_NOW,
        });
  
      const names = [
        "A", "B", "C", "D",
        "E", "F", "G", "H",
        "I", "J", "K", "L",
        "M", "N", "O", "P",
        "Q", "R", "S", "T",
        "U", "V", "W", "X",
        "Y", "Z", "AA", "AB",
        "AC", "AD", "AE",
      ];
  
      const customers =
        Object.fromEntries(
          names.map(
            (letter) => [
              letter,
              customerLeaks(
                result.leaks,
                `Automotive Test ${letter}`
              ),
            ]
          )
        );
  
      const a = customers.A;
      const b = customers.B;
      const c = customers.C;
      const d = customers.D;
      const e = customers.E;
      const f = customers.F;
      const g = customers.G;
      const h = customers.H;
      const i = customers.I;
      const j = customers.J;
      const k = customers.K;
      const l = customers.L;
      const m = customers.M;
      const n = customers.N;
      const o = customers.O;
      const p = customers.P;
      const q = customers.Q;
      const r = customers.R;
      const s = customers.S;
      const t = customers.T;
      const u = customers.U;
      const v = customers.V;
      const w = customers.W;
      const x = customers.X;
      const y = customers.Y;
      const z = customers.Z;
      const aa = customers.AA;
      const ab = customers.AB;
      const ac = customers.AC;
      const ad = customers.AD;
      const ae = customers.AE;
  
      /* ================================== */
      /* #26 */
      /* ================================== */
  
      const unperformedPassed =
        hasLeak(
          result.leaks,
          "Automotive Test A",
          "Unperformed Recommended Service",
          850
        ) &&
        a.length === 1;
  
      /* ================================== */
      /* #27 */
      /* ================================== */
  
      const declinedPassed =
        hasLeak(
          result.leaks,
          "Automotive Test B",
          "Declined Recommended Service",
          1200
        ) &&
        b.length === 1;
  
      /* ================================== */
      /* #28 */
      /* ================================== */
  
      const deferredPassed =
        hasLeak(
          result.leaks,
          "Automotive Test E",
          "Deferred Recommended Service",
          1100
        ) &&
        e.length === 1;
  
      /* ================================== */
      /* #29 */
      /* ================================== */
  
      const overdueMaintenancePassed =
        hasLeak(
          result.leaks,
          "Automotive Test F",
          "Overdue Maintenance",
          600
        ) &&
        f.length === 1;
  
      const maintenanceSafetyPassed =
        g.length === 0 &&
        h.length === 0;
  
      /* ================================== */
      /* #30 */
      /* ================================== */
  
      const unreturnedCustomerPassed =
        hasLeak(
          result.leaks,
          "Automotive Test I",
          "Unreturned Service Customer",
          150
        ) &&
        i.length === 1;
  
      const returnWindowPassed =
        j.length === 0;
  
      const returnIntervalRequiredPassed =
        k.length === 0;
  
      const returnNoGuessingPassed =
        l.length === 0;
  
      /* ================================== */
      /* #31 */
      /* ================================== */
  
      const unsoldInspectionPassed =
        hasLeak(
          result.leaks,
          "Automotive Test M",
          "Unsold Inspection Recommendation",
          950
        ) &&
        m.length === 1;
  
      const completedInspectionPassed =
        n.length === 0;
  
      const inspectionNoGuessingPassed =
        o.length === 0;
  
      /* ================================== */
      /* #32 */
      /* ================================== */
  
      const warrantyComebackPassed =
        hasLeak(
          result.leaks,
          "Automotive Test P",
          "Warranty / Comeback Work",
          650
        ) &&
        p.length === 1;
  
      const comebackAliasPassed =
        hasLeak(
          result.leaks,
          "Automotive Test Q",
          "Warranty / Comeback Work",
          300
        ) &&
        q.length === 1;
  
      const normalJobSafetyPassed =
        r.length === 0;
  
      const comebackNoGuessingPassed =
        s.length === 0;
  
      /* ================================== */
      /* #33 */
      /* ================================== */
  
      const unbilledPartsPassed =
        hasLeak(
          result.leaks,
          "Automotive Test T",
          "Unbilled Parts or Labor",
          275
        ) &&
        t.length === 1;
  
      const unbilledLaborPassed =
        hasLeak(
          result.leaks,
          "Automotive Test U",
          "Unbilled Parts or Labor",
          180
        ) &&
        u.length === 1;
  
      const billedItemSafetyPassed =
        v.length === 0;
  
      const unbilledNoGuessingPassed =
        w.length === 0;
  
      /* ================================== */
      /* #34 */
      /* ================================== */
  
      const underchargedLaborPassed =
        hasLeak(
          result.leaks,
          "Automotive Test X",
          "Undercharged Labor",
          150
        ) &&
        x.length === 1;
  
      const correctLaborChargePassed =
        y.length === 0;
  
      const overchargedLaborSafetyPassed =
        z.length === 0;
  
      const laborNoGuessingPassed =
        aa.length === 0;
  
      /* ================================== */
      /* #35 */
      /* ================================== */
  
      const missedRebookingPassed =
        hasLeak(
          result.leaks,
          "Automotive Test AB",
          "Missed Rebooking",
          150
        ) &&
        ab.length === 1;
  
      const bookedRebookingSafetyPassed =
        ac.length === 0;
  
      const overdueRebookingSafetyPassed =
        ad.length === 0;
  
      const rebookingNoGuessingPassed =
        ae.length === 0;
  
      /* ================================== */
      /* GENERAL SAFETY */
      /* ================================== */
  
      const completedPassed =
        c.length === 0;
  
      const noGuessingPassed =
        d.length === 0;
  
      const recommendationOwnershipPassed =
        !b.some(
          (leak) =>
            leak.leakType ===
              "Unperformed Recommended Service"
        ) &&
        !e.some(
          (leak) =>
            leak.leakType ===
              "Unperformed Recommended Service" ||
            leak.leakType ===
              "Declined Recommended Service"
        );
  
      /* ================================== */
      /* DETECTOR HEALTH */
      /* ================================== */
  
      const automotiveResults =
        result.detectorResults.filter(
          (detectorResult) =>
            detectorResult.detectorId.startsWith(
              "automotive."
            )
        );
  
      const automotiveDetectorIds =
        automotiveResults.map(
          (detectorResult) =>
            detectorResult.detectorId
        );
  
      const expectedAutomotiveIds = [
        "automotive.unperformed-recommended-service",
        "automotive.declined-recommended-service",
        "automotive.deferred-recommended-service",
        "automotive.overdue-maintenance",
        "automotive.unreturned-service-customer",
        "automotive.unsold-inspection-recommendation",
        "automotive.warranty-comeback-work",
        "automotive.unbilled-parts-labor",
        "automotive.undercharged-labor",
        "automotive.missed-rebooking",
      ];
  
      const allAutomotiveDetectorsRan =
        automotiveResults.length ===
          10 &&
        expectedAutomotiveIds.every(
          (id) =>
            automotiveDetectorIds.includes(
              id
            )
        ) &&
        automotiveResults.every(
          (detectorResult) =>
            detectorResult.ran &&
            detectorResult.errors.length ===
              0
        );
  
      /* ================================== */
      /* FINAL */
      /* ================================== */
  
      const allPassed =
        result.success &&
        unperformedPassed &&
        declinedPassed &&
        deferredPassed &&
        overdueMaintenancePassed &&
        maintenanceSafetyPassed &&
        unreturnedCustomerPassed &&
        returnWindowPassed &&
        returnIntervalRequiredPassed &&
        returnNoGuessingPassed &&
        unsoldInspectionPassed &&
        completedInspectionPassed &&
        inspectionNoGuessingPassed &&
        warrantyComebackPassed &&
        comebackAliasPassed &&
        normalJobSafetyPassed &&
        comebackNoGuessingPassed &&
        unbilledPartsPassed &&
        unbilledLaborPassed &&
        billedItemSafetyPassed &&
        unbilledNoGuessingPassed &&
        underchargedLaborPassed &&
        correctLaborChargePassed &&
        overchargedLaborSafetyPassed &&
        laborNoGuessingPassed &&
        missedRebookingPassed &&
        bookedRebookingSafetyPassed &&
        overdueRebookingSafetyPassed &&
        rebookingNoGuessingPassed &&
        completedPassed &&
        noGuessingPassed &&
        recommendationOwnershipPassed &&
        allAutomotiveDetectorsRan;
  
      return NextResponse.json({
        success:
          allPassed,
  
        message:
          allPassed
            ? "Automotive detectors #26 through #35 passed together."
            : "Automotive detector test failed.",
  
        allPassed,
  
        tests: {
          unperformedPassed,
          declinedPassed,
          deferredPassed,
          overdueMaintenancePassed,
          maintenanceSafetyPassed,
          unreturnedCustomerPassed,
          returnWindowPassed,
          returnIntervalRequiredPassed,
          returnNoGuessingPassed,
          unsoldInspectionPassed,
          completedInspectionPassed,
          inspectionNoGuessingPassed,
          warrantyComebackPassed,
          comebackAliasPassed,
          normalJobSafetyPassed,
          comebackNoGuessingPassed,
          unbilledPartsPassed,
          unbilledLaborPassed,
          billedItemSafetyPassed,
          unbilledNoGuessingPassed,
          underchargedLaborPassed,
          correctLaborChargePassed,
          overchargedLaborSafetyPassed,
          laborNoGuessingPassed,
          missedRebookingPassed,
          bookedRebookingSafetyPassed,
          overdueRebookingSafetyPassed,
          rebookingNoGuessingPassed,
          completedPassed,
          noGuessingPassed,
          recommendationOwnershipPassed,
          allAutomotiveDetectorsRan,
        },
  
        automotiveDetectors: {
          expected: 10,
  
          count:
            automotiveResults.length,
  
          detectorIds:
            automotiveDetectorIds,
        },
  
        detectorHealth: {
          expectedTotal: 35,
  
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
        },
  
        customerResults:
          customers,
      });
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
  
          error:
            error instanceof Error
              ? error.message
              : "Unknown automotive detector test error.",
        },
        {
          status: 500,
        }
      );
    }
  }