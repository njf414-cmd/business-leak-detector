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
  
  type SubscriptionDetectorSpec = {
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
        "test-subscription-services",
  
      businessName:
        "Test Subscription Business",
  
      industry:
        "subscription-services",
  
      businessModel:
        "subscription",
  
      revenueModels: [
        "recurring",
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
        "Runtime test profile for subscription and membership businesses.",
  
      metadata: {},
    };
  
  /* ================================== */
  /* LOAD SPECS */
  /* ================================== */
  
  function loadSubscriptionSpecs():
    SubscriptionDetectorSpec[] {
    const specPath =
      path.join(
        process.cwd(),
        "detector-specs",
        "subscription-batch.json"
      );
  
    const raw =
      fs.readFileSync(
        specPath,
        "utf8"
      );
  
    const parsed =
      JSON.parse(
        raw
      ) as SubscriptionDetectorSpec[];
  
    return parsed
      .filter(
        (spec) =>
          spec.number >= 66 &&
          spec.number <= 75 &&
          spec.industry ===
            "subscription-services"
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
      SubscriptionDetectorSpec[]
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
          500 +
          index * 100;
  
        const positiveAmountTwo =
          1000 +
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
              `Subscription Test ${spec.number}A`,
  
            [projectField]:
              `Test Account ${spec.number}A`,
  
            [spec.itemField]:
              `Test Item ${spec.number}A`,
  
            [spec.amountField]:
              String(
                positiveAmountOne
              ),
  
            [spec.statusField]:
              firstPositiveStatus,
  
            [spec.billingStatusField]:
              "__not_collected__",
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
              `Subscription Test ${spec.number}B`,
  
            [projectField]:
              `Test Account ${spec.number}B`,
  
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
        /* ALREADY COLLECTED / BILLED */
        /* ================================== */
  
        const billedRow:
          BusinessDataRow = {
            [customerField]:
              `Subscription Test ${spec.number}C`,
  
            [projectField]:
              `Test Account ${spec.number}C`,
  
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
              `Subscription Test ${spec.number}D`,
  
            [projectField]:
              `Test Account ${spec.number}D`,
  
            [spec.itemField]:
              `Test Item ${spec.number}D`,
  
            [spec.amountField]:
              "4000",
  
            [spec.statusField]:
              "__inactive_test_status__",
  
            [spec.billingStatusField]:
              "__not_collected__",
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
              `Subscription Test ${spec.number}E`,
  
            [projectField]:
              `Test Account ${spec.number}E`,
  
            [spec.itemField]:
              `Test Item ${spec.number}E`,
  
            [spec.statusField]:
              firstPositiveStatus,
  
            [spec.billingStatusField]:
              "__not_collected__",
  
            /*
              These unrelated values prove
              the detector does not invent
              or substitute revenue.
            */
            "Invoice Amount":
              "99999",
  
            "Contract Amount":
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
        loadSubscriptionSpecs();
  
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
          66,
          67,
          68,
          69,
          70,
          71,
          72,
          73,
          74,
          75,
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
  
      const catalogSubscriptionIds =
        catalog
          .filter(
            (detector) =>
              detector.scope ===
                "industry" &&
              detector.industries.includes(
                "subscription-services"
              )
          )
          .map(
            (detector) =>
              detector.id
          );
  
      const registrySubscriptionIds =
        getAllDetectors()
          .filter(
            (detector) =>
              detector.scope ===
                "industry" &&
              detector.industries.includes(
                "subscription-services"
              )
          )
          .map(
            (detector) =>
              detector.id
          );
  
      const supportedSubscriptionIds =
        getSupportedDetectors(
          profile
        )
          .filter(
            (detector) =>
              detector.id.startsWith(
                "subscription-services."
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
      /* RUN */
      /* ================================== */
  
      const result =
        await runBusinessDetectors({
          profile,
          rows,
          now,
        });
  
      const subscriptionResults =
        result.detectorResults.filter(
          (detectorResult) =>
            detectorResult.detectorId.startsWith(
              "subscription-services."
            )
        );
  
      /* ================================== */
      /* INDIVIDUAL DETECTOR TESTS */
      /* ================================== */
  
      const detectorTests =
        specs.map(
          (
            spec,
            index
          ) => {
            const detectorResult =
              subscriptionResults.find(
                (item) =>
                  item.detectorId ===
                  spec.id
              );
  
            const leaks =
              detectorResult?.leaks ??
              [];
  
            const customerA =
              `Subscription Test ${spec.number}A`;
  
            const customerB =
              `Subscription Test ${spec.number}B`;
  
            const customerC =
              `Subscription Test ${spec.number}C`;
  
            const customerD =
              `Subscription Test ${spec.number}D`;
  
            const customerE =
              `Subscription Test ${spec.number}E`;
  
            const expectedAmountA =
              500 +
              index * 100;
  
            const expectedAmountB =
              1000 +
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
              catalogSubscriptionIds.includes(
                spec.id
              ) &&
              registrySubscriptionIds.includes(
                spec.id
              ) &&
              supportedSubscriptionIds.includes(
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
            catalogSubscriptionIds.includes(
              spec.id
            )
        );
  
      const allRegistryRegistered =
        specs.every(
          (spec) =>
            registrySubscriptionIds.includes(
              spec.id
            )
        );
  
      const allSupported =
        specs.every(
          (spec) =>
            supportedSubscriptionIds.includes(
              spec.id
            )
        );
  
      const registrationCountsPassed =
        catalogSubscriptionIds.length ===
          10 &&
        registrySubscriptionIds.length ===
          10 &&
        supportedSubscriptionIds.length ===
          10;
  
      /* ================================== */
      /* RUNTIME HEALTH */
      /* ================================== */
  
      const subscriptionRunCountPassed =
        subscriptionResults.length ===
        10;
  
      const allSubscriptionDetectorsRan =
        subscriptionResults.length ===
          10 &&
        subscriptionResults.every(
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
        + 10 subscription
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
  
        subscriptionExpected:
          10,
  
        subscriptionSelected:
          subscriptionResults.length,
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
        detectorHealth.subscriptionSelected ===
          detectorHealth.subscriptionExpected;
  
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
        subscriptionRunCountPassed &&
        allSubscriptionDetectorsRan &&
        everyDetectorTestPassed &&
        globalHealthPassed;
  
      return NextResponse.json({
        success:
          allPassed,
  
        message:
          allPassed
            ? "Subscription Services detectors #66 through #75 passed together."
            : "Subscription Services detectors #66 through #75 have a failing test.",
  
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
          catalogSubscriptionCount:
            catalogSubscriptionIds.length,
  
          catalogSubscriptionIds,
  
          registrySubscriptionCount:
            registrySubscriptionIds.length,
  
          registrySubscriptionIds,
  
          supportedSubscriptionCount:
            supportedSubscriptionIds.length,
  
          supportedSubscriptionIds,
        },
  
        registrationHealth: {
          allCatalogRegistered,
  
          allRegistryRegistered,
  
          allSupported,
  
          registrationCountsPassed,
        },
  
        runtimeHealth: {
          subscriptionRunCountPassed,
  
          allSubscriptionDetectorsRan,
  
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
              : "Unknown subscription detector test error.",
        },
        {
          status: 500,
        }
      );
    }
  }