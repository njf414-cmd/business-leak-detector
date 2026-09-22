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
  
  type EcommerceDetectorSpec = {
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
        "test-ecommerce",
  
      businessName:
        "Test Ecommerce Business",
  
      industry:
        "ecommerce",
  
      businessModel:
        "ecommerce",
  
      revenueModels: [
        "transactional",
        "mixed",
      ],
  
      capabilities: {
        usesLeads: true,
        usesQuotes: true,
        usesInvoices: true,
        usesAppointments: false,
        usesJobs: false,
        usesOrders: true,
        usesSubscriptions: true,
        usesPayments: true,
        usesCustomerRelationships: true,
        usesSalesPipeline: true,
      },
  
      description:
        "Runtime test profile for ecommerce and retail businesses.",
  
      metadata: {},
    };
  
  /* ================================== */
  /* LOAD SPECS */
  /* ================================== */
  
  function loadEcommerceSpecs():
    EcommerceDetectorSpec[] {
    const specPath =
      path.join(
        process.cwd(),
        "detector-specs",
        "ecommerce-batch.json"
      );
  
    const raw =
      fs.readFileSync(
        specPath,
        "utf8"
      );
  
    const parsed =
      JSON.parse(
        raw
      ) as EcommerceDetectorSpec[];
  
    return parsed
      .filter(
        (spec) =>
          spec.number >= 76 &&
          spec.number <= 85 &&
          spec.industry ===
            "ecommerce"
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
      EcommerceDetectorSpec[]
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
          250 +
          index * 100;
  
        const positiveAmountTwo =
          750 +
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
              `Ecommerce Test ${spec.number}A`,
  
            [projectField]:
              `Test Order ${spec.number}A`,
  
            [spec.itemField]:
              `Test Item ${spec.number}A`,
  
            [spec.amountField]:
              String(
                positiveAmountOne
              ),
  
            [spec.statusField]:
              firstPositiveStatus,
  
            [spec.billingStatusField]:
              "__not_recovered__",
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
              `Ecommerce Test ${spec.number}B`,
  
            [projectField]:
              `Test Order ${spec.number}B`,
  
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
        /* ALREADY BILLED / RECOVERED */
        /* ================================== */
  
        const billedRow:
          BusinessDataRow = {
            [customerField]:
              `Ecommerce Test ${spec.number}C`,
  
            [projectField]:
              `Test Order ${spec.number}C`,
  
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
              `Ecommerce Test ${spec.number}D`,
  
            [projectField]:
              `Test Order ${spec.number}D`,
  
            [spec.itemField]:
              `Test Item ${spec.number}D`,
  
            [spec.amountField]:
              "4000",
  
            [spec.statusField]:
              "__inactive_test_status__",
  
            [spec.billingStatusField]:
              "__not_recovered__",
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
              `Ecommerce Test ${spec.number}E`,
  
            [projectField]:
              `Test Order ${spec.number}E`,
  
            [spec.itemField]:
              `Test Item ${spec.number}E`,
  
            [spec.statusField]:
              firstPositiveStatus,
  
            [spec.billingStatusField]:
              "__not_recovered__",
  
            /*
              Deliberately unrelated amounts.
  
              Detector must NOT use them as
              substitutes for its own amount
              field.
            */
            "Order Total":
              "99999",
  
            "Invoice Amount":
              "88888",
  
            "Cart Total":
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
        loadEcommerceSpecs();
  
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
          76,
          77,
          78,
          79,
          80,
          81,
          82,
          83,
          84,
          85,
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
  
      const catalogEcommerceIds =
        catalog
          .filter(
            (detector) =>
              detector.scope ===
                "industry" &&
              detector.industries.includes(
                "ecommerce"
              )
          )
          .map(
            (detector) =>
              detector.id
          );
  
      const registryEcommerceIds =
        getAllDetectors()
          .filter(
            (detector) =>
              detector.scope ===
                "industry" &&
              detector.industries.includes(
                "ecommerce"
              )
          )
          .map(
            (detector) =>
              detector.id
          );
  
      const supportedEcommerceIds =
        getSupportedDetectors(
          profile
        )
          .filter(
            (detector) =>
              detector.id.startsWith(
                "ecommerce."
              )
          )
          .map(
            (detector) =>
              detector.id
          );
  
      /* ================================== */
      /* TEST DATA */
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
      /* RUN DETECTORS */
      /* ================================== */
  
      const result =
        await runBusinessDetectors({
          profile,
          rows,
          now,
        });
  
      const ecommerceResults =
        result.detectorResults.filter(
          (detectorResult) =>
            detectorResult.detectorId.startsWith(
              "ecommerce."
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
              ecommerceResults.find(
                (item) =>
                  item.detectorId ===
                  spec.id
              );
  
            const leaks =
              detectorResult?.leaks ??
              [];
  
            const customerA =
              `Ecommerce Test ${spec.number}A`;
  
            const customerB =
              `Ecommerce Test ${spec.number}B`;
  
            const customerC =
              `Ecommerce Test ${spec.number}C`;
  
            const customerD =
              `Ecommerce Test ${spec.number}D`;
  
            const customerE =
              `Ecommerce Test ${spec.number}E`;
  
            const expectedAmountA =
              250 +
              index * 100;
  
            const expectedAmountB =
              750 +
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
              catalogEcommerceIds.includes(
                spec.id
              ) &&
              registryEcommerceIds.includes(
                spec.id
              ) &&
              supportedEcommerceIds.includes(
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
            catalogEcommerceIds.includes(
              spec.id
            )
        );
  
      const allRegistryRegistered =
        specs.every(
          (spec) =>
            registryEcommerceIds.includes(
              spec.id
            )
        );
  
      const allSupported =
        specs.every(
          (spec) =>
            supportedEcommerceIds.includes(
              spec.id
            )
        );
  
      const registrationCountsPassed =
        catalogEcommerceIds.length ===
          10 &&
        registryEcommerceIds.length ===
          10 &&
        supportedEcommerceIds.length ===
          10;
  
      /* ================================== */
      /* RUNTIME HEALTH */
      /* ================================== */
  
      const ecommerceRunCountPassed =
        ecommerceResults.length ===
        10;
  
      const allEcommerceDetectorsRan =
        ecommerceResults.length ===
          10 &&
        ecommerceResults.every(
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
        + 10 ecommerce
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
  
        ecommerceExpected:
          10,
  
        ecommerceSelected:
          ecommerceResults.length,
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
        detectorHealth.ecommerceSelected ===
          detectorHealth.ecommerceExpected;
  
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
        ecommerceRunCountPassed &&
        allEcommerceDetectorsRan &&
        everyDetectorTestPassed &&
        globalHealthPassed;
  
      return NextResponse.json({
        success:
          allPassed,
  
        message:
          allPassed
            ? "Ecommerce detectors #76 through #85 passed together."
            : "Ecommerce detectors #76 through #85 have a failing test.",
  
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
          catalogEcommerceCount:
            catalogEcommerceIds.length,
  
          catalogEcommerceIds,
  
          registryEcommerceCount:
            registryEcommerceIds.length,
  
          registryEcommerceIds,
  
          supportedEcommerceCount:
            supportedEcommerceIds.length,
  
          supportedEcommerceIds,
        },
  
        registrationHealth: {
          allCatalogRegistered,
  
          allRegistryRegistered,
  
          allSupported,
  
          registrationCountsPassed,
        },
  
        runtimeHealth: {
          ecommerceRunCountPassed,
  
          allEcommerceDetectorsRan,
  
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
              : "Unknown ecommerce detector test error.",
        },
        {
          status: 500,
        }
      );
    }
  }