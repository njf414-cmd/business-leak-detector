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
  
  type RestaurantDetectorSpec = {
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
    positiveStatuses: string[];
    billedStatuses: string[];
    leakType: string;
    category: string;
    revenueType: string;
    detectionReason: string;
    recommendedActionVerb?: string;
    recoveryRate?: number;
    severityMedium?: number;
    severityHigh?: number;
  };
  
  /* ================================== */
  /* PROFILE */
  /* ================================== */
  
  const profile:
    BusinessIntelligenceProfile = {
      businessId:
        "test-restaurant",
  
      businessName:
        "Test Restaurant",
  
      industry:
        "restaurant",
  
      businessModel:
        "hospitality",
  
      revenueModels: [
        "transactional",
        "project_based",
        "mixed",
      ],
  
      capabilities: {
        usesLeads: true,
        usesQuotes: true,
        usesInvoices: true,
        usesAppointments: true,
        usesJobs: true,
        usesOrders: true,
        usesSubscriptions: false,
        usesPayments: true,
        usesCustomerRelationships: true,
        usesSalesPipeline: true,
      },
  
      description:
        "Runtime test profile for restaurant and food service businesses.",
  
      metadata: {},
    };
  
  /* ================================== */
  /* LOAD SPECS */
  /* ================================== */
  
  function loadRestaurantSpecs():
    RestaurantDetectorSpec[] {
    const specPath =
      path.join(
        process.cwd(),
        "detector-specs",
        "restaurant-batch.json"
      );
  
    const raw =
      fs.readFileSync(
        specPath,
        "utf8"
      );
  
    const parsed =
      JSON.parse(
        raw
      ) as RestaurantDetectorSpec[];
  
    return parsed
      .filter(
        (spec) =>
          spec.number >= 96 &&
          spec.number <= 105 &&
          spec.industry ===
            "restaurant"
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
      RestaurantDetectorSpec[]
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
          300 +
          index * 100;
  
        const positiveAmountTwo =
          900 +
          index * 100;
  
        const baseDate =
          `2026-09-${String(
            index + 1
          ).padStart(
            2,
            "0"
          )}`;
  
        const positiveOne:
          BusinessDataRow = {
            [customerField]:
              `Restaurant Test ${spec.number}A`,
  
            [projectField]:
              `Restaurant Event ${spec.number}A`,
  
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
  
        const positiveTwo:
          BusinessDataRow = {
            [customerField]:
              `Restaurant Test ${spec.number}B`,
  
            [projectField]:
              `Restaurant Event ${spec.number}B`,
  
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
  
        const billedRow:
          BusinessDataRow = {
            [customerField]:
              `Restaurant Test ${spec.number}C`,
  
            [projectField]:
              `Restaurant Event ${spec.number}C`,
  
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
  
        const invalidStatusRow:
          BusinessDataRow = {
            [customerField]:
              `Restaurant Test ${spec.number}D`,
  
            [projectField]:
              `Restaurant Event ${spec.number}D`,
  
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
  
        const noAmountRow:
          BusinessDataRow = {
            [customerField]:
              `Restaurant Test ${spec.number}E`,
  
            [projectField]:
              `Restaurant Event ${spec.number}E`,
  
            [spec.itemField]:
              `Test Item ${spec.number}E`,
  
            [spec.statusField]:
              firstPositiveStatus,
  
            [spec.billingStatusField]:
              "__not_billed__",
  
            "Order Total":
              "99999",
  
            "Event Total":
              "88888",
  
            "Invoice Amount":
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
        loadRestaurantSpecs();
  
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
          96,
          97,
          98,
          99,
          100,
          101,
          102,
          103,
          104,
          105,
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
  
      const catalog =
        getDetectorCatalog();
  
      const catalogRestaurantIds =
        catalog
          .filter(
            (detector) =>
              detector.scope ===
                "industry" &&
              detector.industries.includes(
                "restaurant"
              )
          )
          .map(
            (detector) =>
              detector.id
          );
  
      const registryRestaurantIds =
        getAllDetectors()
          .filter(
            (detector) =>
              detector.scope ===
                "industry" &&
              detector.industries.includes(
                "restaurant"
              )
          )
          .map(
            (detector) =>
              detector.id
          );
  
      const supportedRestaurantIds =
        getSupportedDetectors(
          profile
        )
          .filter(
            (detector) =>
              detector.id.startsWith(
                "restaurant."
              )
          )
          .map(
            (detector) =>
              detector.id
          );
  
      const rows =
        createTestRows(
          specs
        );
  
      const now =
        new Date(
          "2026-09-21T12:00:00.000Z"
        );
  
      const result =
        await runBusinessDetectors({
          profile,
          rows,
          now,
        });
  
      const restaurantResults =
        result.detectorResults.filter(
          (detectorResult) =>
            detectorResult.detectorId.startsWith(
              "restaurant."
            )
        );
  
      const detectorTests =
        specs.map(
          (
            spec,
            index
          ) => {
            const detectorResult =
              restaurantResults.find(
                (item) =>
                  item.detectorId ===
                  spec.id
              );
  
            const leaks =
              detectorResult?.leaks ??
              [];
  
            const customerA =
              `Restaurant Test ${spec.number}A`;
  
            const customerB =
              `Restaurant Test ${spec.number}B`;
  
            const customerC =
              `Restaurant Test ${spec.number}C`;
  
            const customerD =
              `Restaurant Test ${spec.number}D`;
  
            const customerE =
              `Restaurant Test ${spec.number}E`;
  
            const expectedAmountA =
              300 +
              index * 100;
  
            const expectedAmountB =
              900 +
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
              catalogRestaurantIds.includes(
                spec.id
              ) &&
              registryRestaurantIds.includes(
                spec.id
              ) &&
              supportedRestaurantIds.includes(
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
  
      const allCatalogRegistered =
        specs.every(
          (spec) =>
            catalogRestaurantIds.includes(
              spec.id
            )
        );
  
      const allRegistryRegistered =
        specs.every(
          (spec) =>
            registryRestaurantIds.includes(
              spec.id
            )
        );
  
      const allSupported =
        specs.every(
          (spec) =>
            supportedRestaurantIds.includes(
              spec.id
            )
        );
  
      const registrationCountsPassed =
        catalogRestaurantIds.length ===
          10 &&
        registryRestaurantIds.length ===
          10 &&
        supportedRestaurantIds.length ===
          10;
  
      const restaurantRunCountPassed =
        restaurantResults.length ===
        10;
  
      const allRestaurantDetectorsRan =
        restaurantResults.length ===
          10 &&
        restaurantResults.every(
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
  
        restaurantExpected:
          10,
  
        restaurantSelected:
          restaurantResults.length,
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
        detectorHealth.restaurantSelected ===
          detectorHealth.restaurantExpected;
  
      const allPassed =
        result.success &&
        specsComplete &&
        allCatalogRegistered &&
        allRegistryRegistered &&
        allSupported &&
        registrationCountsPassed &&
        restaurantRunCountPassed &&
        allRestaurantDetectorsRan &&
        everyDetectorTestPassed &&
        globalHealthPassed;
  
      return NextResponse.json({
        success:
          allPassed,
  
        message:
          allPassed
            ? "Restaurant detectors #96 through #105 passed together."
            : "Restaurant detectors #96 through #105 have a failing test.",
  
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
          catalogRestaurantCount:
            catalogRestaurantIds.length,
  
          catalogRestaurantIds,
  
          registryRestaurantCount:
            registryRestaurantIds.length,
  
          registryRestaurantIds,
  
          supportedRestaurantCount:
            supportedRestaurantIds.length,
  
          supportedRestaurantIds,
        },
  
        registrationHealth: {
          allCatalogRegistered,
  
          allRegistryRegistered,
  
          allSupported,
  
          registrationCountsPassed,
        },
  
        runtimeHealth: {
          restaurantRunCountPassed,
  
          allRestaurantDetectorsRan,
  
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
              : "Unknown restaurant detector test error.",
        },
        {
          status: 500,
        }
      );
    }
  }