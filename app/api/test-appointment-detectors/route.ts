import {
    NextResponse,
  } from "next/server";
  
  import fs from "node:fs";
  import path from "node:path";
  
  import {
    runBusinessDetectors,
  } from "../../lib/business-intelligence/detector-runner";
  
  import {
    getAllDetectors,
    getSupportedDetectors,
  } from "../../lib/business-intelligence/detector-registry";
  
  import {
    getDetectorCatalog,
    registerDetectorCatalog,
  } from "../../lib/business-intelligence/detector-catalog";
  
  import type {
    BusinessDataRow,
  } from "../../lib/business-intelligence/detector-types";
  
  import type {
    BusinessIntelligenceProfile,
  } from "../../lib/business-intelligence/types";
  
  /* ================================== */
  /* TYPES */
  /* ================================== */
  
  type AppointmentDetectorSpec = {
    number: number;
  
    id: string;
  
    exportName: string;
  
    fileName: string;
  
    name: string;
  
    description: string;
  
    industry: string;
  
    customerField?: string;
  
    projectField?: string;
  
    itemField: string;
  
    amountField: string;
  
    statusField: string;
  
    billingStatusField: string;
  
    dateField?: string;
  
    positiveStatuses:
      string[];
  
    billedStatuses:
      string[];
  
    leakType: string;
  
    category: string;
  
    revenueType: string;
  
    detectionReason: string;
  
    recommendedActionVerb?:
      string;
  
    recoveryRate?:
      number;
  
    severityMedium?:
      number;
  
    severityHigh?:
      number;
  };
  
  /* ================================== */
  /* PROFILE */
  /* ================================== */
  
  const profile:
    BusinessIntelligenceProfile = {
      businessId:
        "test-appointment-services",
  
      businessName:
        "Test Appointment Business",
  
      industry:
        "appointment-services",
  
      businessModel:
        "service",
  
      revenueModels: [
        "one_time",
        "recurring",
      ],
  
      capabilities: {
        usesLeads: true,
        usesQuotes: true,
        usesInvoices: true,
        usesAppointments: true,
        usesJobs: true,
        usesOrders: true,
        usesSubscriptions: true,
        usesPayments: true,
        usesCustomerRelationships: true,
        usesSalesPipeline: true,
      },
  
      description:
        "Runtime test profile for appointment-based businesses.",
  
      metadata: {},
    };
  
  /* ================================== */
  /* LOAD SPECS */
  /* ================================== */
  
  function loadAppointmentSpecs():
    AppointmentDetectorSpec[] {
    const specPath =
      path.join(
        process.cwd(),
        "detector-specs",
        "appointment-batch.json"
      );
  
    const raw =
      fs.readFileSync(
        specPath,
        "utf8"
      );
  
    const parsed =
      JSON.parse(
        raw
      ) as AppointmentDetectorSpec[];
  
    return parsed
      .filter(
        (spec) =>
          spec.number >= 56 &&
          spec.number <= 65 &&
          spec.industry ===
            "appointment-services"
      )
      .sort(
        (a, b) =>
          a.number - b.number
      );
  }
  
  /* ================================== */
  /* TEST ROW BUILDER */
  /* ================================== */
  
  function createTestRows(
    specs:
      AppointmentDetectorSpec[]
  ): BusinessDataRow[] {
    const rows:
      BusinessDataRow[] = [];
  
    specs.forEach(
      (
        spec,
        index
      ) => {
        const customerField =
          spec.customerField ||
          "Customer Name";
  
        const projectField =
          spec.projectField ||
          "Project Name";
  
        const firstPositiveStatus =
          spec.positiveStatuses[0];
  
        const secondPositiveStatus =
          spec.positiveStatuses[1] ||
          firstPositiveStatus;
  
        const billedStatus =
          spec.billedStatuses[0];
  
        const positiveAmountOne =
          1000 +
          index * 100;
  
        const positiveAmountTwo =
          2000 +
          index * 100;
  
        const baseDate =
          `2026-09-${String(
            index + 1
          ).padStart(
            2,
            "0"
          )}`;
  
        /* ================================== */
        /* POSITIVE CASE #1 */
        /* ================================== */
  
        const positiveOne:
          BusinessDataRow = {
            [customerField]:
              `Appointment Test ${spec.number}A`,
  
            [projectField]:
              `Test Project ${spec.number}A`,
  
            [spec.itemField]:
              `Test Item ${spec.number}A`,
  
            [spec.amountField]:
              String(
                positiveAmountOne
              ),
  
            [spec.statusField]:
              firstPositiveStatus,
  
            [spec.billingStatusField]:
              "__not_billed__",
          };
  
        if (
          spec.dateField
        ) {
          positiveOne[
            spec.dateField
          ] =
            baseDate;
        }
  
        rows.push(
          positiveOne
        );
  
        /* ================================== */
        /* POSITIVE CASE #2 */
        /* ================================== */
  
        const positiveTwo:
          BusinessDataRow = {
            [customerField]:
              `Appointment Test ${spec.number}B`,
  
            [projectField]:
              `Test Project ${spec.number}B`,
  
            [spec.itemField]:
              `Test Item ${spec.number}B`,
  
            [spec.amountField]:
              String(
                positiveAmountTwo
              ),
  
            [spec.statusField]:
              secondPositiveStatus,
  
            [spec.billingStatusField]:
              "pending",
          };
  
        if (
          spec.dateField
        ) {
          positiveTwo[
            spec.dateField
          ] =
            baseDate;
        }
  
        rows.push(
          positiveTwo
        );
  
        /* ================================== */
        /* ALREADY BILLED SAFETY */
        /* ================================== */
  
        const billedRow:
          BusinessDataRow = {
            [customerField]:
              `Appointment Test ${spec.number}C`,
  
            [projectField]:
              `Test Project ${spec.number}C`,
  
            [spec.itemField]:
              `Test Item ${spec.number}C`,
  
            [spec.amountField]:
              "3000",
  
            [spec.statusField]:
              firstPositiveStatus,
  
            [spec.billingStatusField]:
              billedStatus,
          };
  
        if (
          spec.dateField
        ) {
          billedRow[
            spec.dateField
          ] =
            baseDate;
        }
  
        rows.push(
          billedRow
        );
  
        /* ================================== */
        /* INVALID STATUS SAFETY */
        /* ================================== */
  
        const invalidStatusRow:
          BusinessDataRow = {
            [customerField]:
              `Appointment Test ${spec.number}D`,
  
            [projectField]:
              `Test Project ${spec.number}D`,
  
            [spec.itemField]:
              `Test Item ${spec.number}D`,
  
            [spec.amountField]:
              "4000",
  
            [spec.statusField]:
              "__inactive_test_status__",
  
            [spec.billingStatusField]:
              "__not_billed__",
          };
  
        if (
          spec.dateField
        ) {
          invalidStatusRow[
            spec.dateField
          ] =
            baseDate;
        }
  
        rows.push(
          invalidStatusRow
        );
  
        /* ================================== */
        /* NO-GUESSING SAFETY */
        /* ================================== */
  
        const noAmountRow:
          BusinessDataRow = {
            [customerField]:
              `Appointment Test ${spec.number}E`,
  
            [projectField]:
              `Test Project ${spec.number}E`,
  
            [spec.itemField]:
              `Test Item ${spec.number}E`,
  
            [spec.statusField]:
              firstPositiveStatus,
  
            [spec.billingStatusField]:
              "__not_billed__",
  
            /*
              Intentionally unrelated money.
  
              Detector must NOT substitute this
              for the detector-specific amount.
            */
            "Contract Amount":
              "99999",
  
            "Invoice Amount":
              "88888",
  
            "Job Amount":
              "77777",
          };
  
        if (
          spec.dateField
        ) {
          noAmountRow[
            spec.dateField
          ] =
            baseDate;
        }
  
        rows.push(
          noAmountRow
        );
      }
    );
  
    return rows;
  }
  
  /* ================================== */
  /* ROUTE */
  /* ================================== */
  
  export async function GET() {
    try {
      registerDetectorCatalog();
  
      const specs =
        loadAppointmentSpecs();
  
      /* ================================== */
      /* SPEC HEALTH */
      /* ================================== */
  
      const specIds =
        specs.map(
          (spec) =>
            spec.id
        );
  
      const specNumbers =
        specs.map(
          (spec) =>
            spec.number
        );
  
      const expectedSpecNumbers =
        [
          56,
          57,
          58,
          59,
          60,
          61,
          62,
          63,
          64,
          65,
        ];
  
      const specsComplete =
        specs.length ===
          10 &&
        expectedSpecNumbers.every(
          (number) =>
            specNumbers.includes(
              number
            )
        );
  
      /* ================================== */
      /* REGISTRATION DEBUG */
      /* ================================== */
  
      const catalog =
        getDetectorCatalog();
  
      const catalogAppointmentIds =
        catalog
          .filter(
            (detector) =>
              detector.scope ===
                "industry" &&
              detector.industries.includes(
                "appointment-services"
              )
          )
          .map(
            (detector) =>
              detector.id
          );
  
      const registryAppointmentIds =
        getAllDetectors()
          .filter(
            (detector) =>
              detector.scope ===
                "industry" &&
              detector.industries.includes(
                "appointment-services"
              )
          )
          .map(
            (detector) =>
              detector.id
          );
  
      const supportedDetectors =
        getSupportedDetectors(
          profile
        );
  
      const supportedAppointmentIds =
        supportedDetectors
          .filter(
            (detector) =>
              detector.id.startsWith(
                "appointment-services."
              )
          )
          .map(
            (detector) =>
              detector.id
          );
  
      /* ================================== */
      /* CREATE TEST DATA */
      /* ================================== */
  
      const rows =
        createTestRows(
          specs
        );
  
      const now =
        new Date(
          "2026-09-21T12:00:00.000Z"
        );
  
      /* ================================== */
      /* RUN ALL SUPPORTED DETECTORS */
      /* ================================== */
  
      const result =
        await runBusinessDetectors({
          profile,
          rows,
          now,
        });
  
      /* ================================== */
      /* DETECTOR RESULTS */
      /* ================================== */
  
      const appointmentResults =
        result.detectorResults.filter(
          (detectorResult) =>
            detectorResult.detectorId.startsWith(
              "appointment-services."
            )
        );
  
      /* ================================== */
      /* INDIVIDUAL TESTS */
      /* ================================== */
  
      const detectorTests =
        specs.map(
          (
            spec,
            index
          ) => {
            const detectorResult =
              appointmentResults.find(
                (item) =>
                  item.detectorId ===
                  spec.id
              );
  
            const leaks =
              detectorResult?.leaks ??
              [];
  
            const customerA =
              `Appointment Test ${spec.number}A`;
  
            const customerB =
              `Appointment Test ${spec.number}B`;
  
            const customerC =
              `Appointment Test ${spec.number}C`;
  
            const customerD =
              `Appointment Test ${spec.number}D`;
  
            const customerE =
              `Appointment Test ${spec.number}E`;
  
            const expectedAmountA =
              1000 +
              index * 100;
  
            const expectedAmountB =
              2000 +
              index * 100;
  
            const leakA =
              leaks.find(
                (leak) =>
                  leak.customerName ===
                  customerA
              );
  
            const leakB =
              leaks.find(
                (leak) =>
                  leak.customerName ===
                  customerB
              );
  
            const leakC =
              leaks.find(
                (leak) =>
                  leak.customerName ===
                  customerC
              );
  
            const leakD =
              leaks.find(
                (leak) =>
                  leak.customerName ===
                  customerD
              );
  
            const leakE =
              leaks.find(
                (leak) =>
                  leak.customerName ===
                  customerE
              );
  
            const firstPositivePassed =
              Boolean(
                leakA &&
                Math.abs(
                  leakA.estimatedLoss -
                    expectedAmountA
                ) <
                  0.01
              );
  
            const secondPositivePassed =
              Boolean(
                leakB &&
                Math.abs(
                  leakB.estimatedLoss -
                    expectedAmountB
                ) <
                  0.01
              );
  
            const billedSafetyPassed =
              !leakC;
  
            const invalidStatusSafetyPassed =
              !leakD;
  
            const noGuessingPassed =
              !leakE;
  
            const leakCountPassed =
              leaks.length ===
              2;
  
            const registeredPassed =
              catalogAppointmentIds.includes(
                spec.id
              ) &&
              registryAppointmentIds.includes(
                spec.id
              ) &&
              supportedAppointmentIds.includes(
                spec.id
              );
  
            const ranPassed =
              Boolean(
                detectorResult &&
                detectorResult.ran &&
                detectorResult.errors.length ===
                  0
              );
  
            const passed =
              firstPositivePassed &&
              secondPositivePassed &&
              billedSafetyPassed &&
              invalidStatusSafetyPassed &&
              noGuessingPassed &&
              leakCountPassed &&
              registeredPassed &&
              ranPassed;
  
            return {
              number:
                spec.number,
  
              detectorId:
                spec.id,
  
              passed,
  
              firstPositivePassed,
  
              secondPositivePassed,
  
              billedSafetyPassed,
  
              invalidStatusSafetyPassed,
  
              noGuessingPassed,
  
              leakCountPassed,
  
              registeredPassed,
  
              ranPassed,
  
              leakCount:
                leaks.length,
  
              errors:
                detectorResult?.errors ??
                [],
            };
          }
        );
  
      /* ================================== */
      /* REGISTRATION HEALTH */
      /* ================================== */
  
      const allCatalogRegistered =
        specs.every(
          (spec) =>
            catalogAppointmentIds.includes(
              spec.id
            )
        );
  
      const allRegistryRegistered =
        specs.every(
          (spec) =>
            registryAppointmentIds.includes(
              spec.id
            )
        );
  
      const allSupported =
        specs.every(
          (spec) =>
            supportedAppointmentIds.includes(
              spec.id
            )
        );
  
      const registrationCountsPassed =
        catalogAppointmentIds.length ===
          10 &&
        registryAppointmentIds.length ===
          10 &&
        supportedAppointmentIds.length ===
          10;
  
      /* ================================== */
      /* DETECTOR RUN HEALTH */
      /* ================================== */
  
      const appointmentRunCountPassed =
        appointmentResults.length ===
        10;
  
      const allAppointmentDetectorsRan =
        appointmentResults.length ===
          10 &&
        appointmentResults.every(
          (detectorResult) =>
            detectorResult.ran &&
            detectorResult.errors.length ===
              0
        );
  
      const everyDetectorTestPassed =
        detectorTests.every(
          (test) =>
            test.passed
        );
  
      /* ================================== */
      /* GLOBAL HEALTH */
      /* ================================== */
  
      /*
        Appointment-services profile should
        currently select:
  
        Profile-supported universal detectors
        + 10 appointment detectors
  
        = 35 total.
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
  
        appointmentExpected:
          10,
  
        appointmentSelected:
          appointmentResults.length,
      };
  
      const globalHealthPassed =
        detectorHealth.selected ===
          expectedTotal &&
        detectorHealth.ran ===
          expectedTotal &&
        detectorHealth.failed ===
          0 &&
        detectorHealth.errors ===
          0 &&
        detectorHealth.appointmentSelected ===
          detectorHealth.appointmentExpected;
  
      /* ================================== */
      /* FINAL */
      /* ================================== */
  
      const allPassed =
        result.success &&
        specsComplete &&
        allCatalogRegistered &&
        allRegistryRegistered &&
        allSupported &&
        registrationCountsPassed &&
        appointmentRunCountPassed &&
        allAppointmentDetectorsRan &&
        everyDetectorTestPassed &&
        globalHealthPassed;
  
      return NextResponse.json({
        success:
          allPassed,
  
        message:
          allPassed
            ? "Appointment Services detectors #56 through #65 passed together."
            : "Appointment Services detectors #56 through #65 have a failing test.",
  
        allPassed,
  
        specHealth: {
          specsComplete,
  
          count:
            specs.length,
  
          numbers:
            specNumbers,
  
          ids:
            specIds,
        },
  
        debug: {
          catalogAppointmentCount:
            catalogAppointmentIds.length,
  
          catalogAppointmentIds,
  
          registryAppointmentCount:
            registryAppointmentIds.length,
  
          registryAppointmentIds,
  
          supportedAppointmentCount:
            supportedAppointmentIds.length,
  
          supportedAppointmentIds,
        },
  
        registrationHealth: {
          allCatalogRegistered,
  
          allRegistryRegistered,
  
          allSupported,
  
          registrationCountsPassed,
        },
  
        runtimeHealth: {
          appointmentRunCountPassed,
  
          allAppointmentDetectorsRan,
  
          everyDetectorTestPassed,
  
          globalHealthPassed,
        },
  
        detectorTests,
  
        detectorHealth,
  
        runnerStats:
          result.stats,
  
        rowsGenerated:
          rows.length,
      });
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
  
          error:
            error instanceof Error
              ? error.message
              : "Unknown appointment detector test error.",
        },
        {
          status: 500,
        }
      );
    }
  }