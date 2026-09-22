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
  
  type ProfessionalServicesDetectorSpec = {
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
        "test-professional-services",
  
      businessName:
        "Test Professional Services Business",
  
      industry:
        "professional_services",
  
      businessModel:
        "professional_service",
  
      revenueModels: [
        "project_based",
        "mixed",
      ],
  
      capabilities: {
        usesLeads: true,
        usesQuotes: true,
        usesInvoices: true,
        usesAppointments: true,
        usesJobs: true,
        usesOrders: false,
        usesSubscriptions: true,
        usesPayments: true,
        usesCustomerRelationships: true,
        usesSalesPipeline: true,
      },
  
      description:
        "Runtime test profile for professional service businesses.",
  
      metadata: {},
    };
  
  /* ================================== */
  /* LOAD SPECS */
  /* ================================== */
  
  function loadProfessionalServicesSpecs():
    ProfessionalServicesDetectorSpec[] {
    const specPath =
      path.join(
        process.cwd(),
        "detector-specs",
        "professional-services-batch.json"
      );
  
    const raw =
      fs.readFileSync(
        specPath,
        "utf8"
      );
  
    const parsed =
      JSON.parse(
        raw
      ) as ProfessionalServicesDetectorSpec[];
  
    return parsed
      .filter(
        (spec) =>
          spec.number >= 86 &&
          spec.number <= 95 &&
          spec.industry ===
            "professional_services"
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
      ProfessionalServicesDetectorSpec[]
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
          index * 250;
  
        const positiveAmountTwo =
          2500 +
          index * 250;
  
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
              `Professional Test ${spec.number}A`,
  
            [projectField]:
              `Project ${spec.number}A`,
  
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
              `Professional Test ${spec.number}B`,
  
            [projectField]:
              `Project ${spec.number}B`,
  
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
        /* ALREADY BILLED / COLLECTED */
        /* ================================== */
  
        const billedRow:
          BusinessDataRow = {
            [customerField]:
              `Professional Test ${spec.number}C`,
  
            [projectField]:
              `Project ${spec.number}C`,
  
            [spec.itemField]:
              `Test Item ${spec.number}C`,
  
            [spec.amountField]:
              "5000",
  
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
              `Professional Test ${spec.number}D`,
  
            [projectField]:
              `Project ${spec.number}D`,
  
            [spec.itemField]:
              `Test Item ${spec.number}D`,
  
            [spec.amountField]:
              "6000",
  
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
              `Professional Test ${spec.number}E`,
  
            [projectField]:
              `Project ${spec.number}E`,
  
            [spec.itemField]:
              `Test Item ${spec.number}E`,
  
            [spec.statusField]:
              firstPositiveStatus,
  
            [spec.billingStatusField]:
              "__not_billed__",
  
            /*
              Unrelated money values.
  
              Detector must never substitute
              these for its required amount.
            */
            "Contract Amount":
              "99999",
  
            "Invoice Amount":
              "88888",
  
            "Project Value":
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
        loadProfessionalServicesSpecs();
  
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
          86,
          87,
          88,
          89,
          90,
          91,
          92,
          93,
          94,
          95,
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
      /* REGISTRATION */
      /* ================================== */
  
      const catalog =
        getDetectorCatalog();
  
      const catalogProfessionalIds =
        catalog
          .filter(
            (detector) =>
              detector.scope ===
                "industry" &&
              detector.industries.includes(
                "professional_services"
              )
          )
          .map(
            (detector) =>
              detector.id
          );
  
      const registryProfessionalIds =
        getAllDetectors()
          .filter(
            (detector) =>
              detector.scope ===
                "industry" &&
              detector.industries.includes(
                "professional_services"
              )
          )
          .map(
            (detector) =>
              detector.id
          );
  
      const supportedProfessionalIds =
        getSupportedDetectors(
          profile
        )
          .filter(
            (detector) =>
              detector.id.startsWith(
                "professional-services."
              )
          )
          .map(
            (detector) =>
              detector.id
          );
  
      /* ================================== */
      /* BUILD TEST DATA */
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
      /* RUN */
      /* ================================== */
  
      const result =
        await runBusinessDetectors({
          profile,
          rows,
          now,
        });
  
      const professionalResults =
        result.detectorResults.filter(
          (detectorResult) =>
            detectorResult.detectorId.startsWith(
              "professional-services."
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
              professionalResults.find(
                (item) =>
                  item.detectorId ===
                  spec.id
              );
  
            const leaks =
              detectorResult?.leaks ??
              [];
  
            const customerA =
              `Professional Test ${spec.number}A`;
  
            const customerB =
              `Professional Test ${spec.number}B`;
  
            const customerC =
              `Professional Test ${spec.number}C`;
  
            const customerD =
              `Professional Test ${spec.number}D`;
  
            const customerE =
              `Professional Test ${spec.number}E`;
  
            const expectedAmountA =
              1000 +
              index * 250;
  
            const expectedAmountB =
              2500 +
              index * 250;
  
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
              catalogProfessionalIds.includes(
                spec.id
              ) &&
              registryProfessionalIds.includes(
                spec.id
              ) &&
              supportedProfessionalIds.includes(
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
            catalogProfessionalIds.includes(
              spec.id
            )
        );
  
      const allRegistryRegistered =
        specs.every(
          (spec) =>
            registryProfessionalIds.includes(
              spec.id
            )
        );
  
      const allSupported =
        specs.every(
          (spec) =>
            supportedProfessionalIds.includes(
              spec.id
            )
        );
  
      const registrationCountsPassed =
        catalogProfessionalIds.length ===
          10 &&
        registryProfessionalIds.length ===
          10 &&
        supportedProfessionalIds.length ===
          10;
  
      /* ================================== */
      /* RUNTIME HEALTH */
      /* ================================== */
  
      const professionalRunCountPassed =
        professionalResults.length ===
        10;
  
      const allProfessionalDetectorsRan =
        professionalResults.length ===
          10 &&
        professionalResults.every(
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
        Profile-supported universal
        + 10 professional services
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
  
        professionalExpected:
          10,
  
        professionalSelected:
          professionalResults.length,
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
        detectorHealth.professionalSelected ===
          detectorHealth.professionalExpected;
  
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
        professionalRunCountPassed &&
        allProfessionalDetectorsRan &&
        everyDetectorTestPassed &&
        globalHealthPassed;
  
      return NextResponse.json({
        success:
          allPassed,
  
        message:
          allPassed
            ? "Professional Services detectors #86 through #95 passed together."
            : "Professional Services detectors #86 through #95 have a failing test.",
  
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
          catalogProfessionalCount:
            catalogProfessionalIds.length,
  
          catalogProfessionalIds,
  
          registryProfessionalCount:
            registryProfessionalIds.length,
  
          registryProfessionalIds,
  
          supportedProfessionalCount:
            supportedProfessionalIds.length,
  
          supportedProfessionalIds,
        },
  
        registrationHealth: {
          allCatalogRegistered,
  
          allRegistryRegistered,
  
          allSupported,
  
          registrationCountsPassed,
        },
  
        runtimeHealth: {
          professionalRunCountPassed,
  
          allProfessionalDetectorsRan,
  
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
              : "Unknown professional-services detector test error.",
        },
        {
          status: 500,
        }
      );
    }
  }