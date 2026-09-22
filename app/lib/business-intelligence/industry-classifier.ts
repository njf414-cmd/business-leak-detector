import type {
    BusinessCapabilities,
    BusinessIndustry,
    BusinessIntelligenceProfile,
    BusinessModel,
    RevenueModel,
  } from "./types";
  
  import type {
    BusinessDataRow,
  } from "./detector-types";
  
  /* ================================== */
  /* TYPES */
  /* ================================== */
  
  export type IndustryClassifierInput = {
    rows: BusinessDataRow[];
  
    businessName?: string | null;
  
    description?: string | null;
  };
  
  export type IndustryClassification = {
    industry: BusinessIndustry;
  
    businessModel: BusinessModel;
  
    revenueModels: RevenueModel[];
  
    capabilities: BusinessCapabilities;
  
    confidence:
      | "low"
      | "medium"
      | "high";
  
    score: number;
  
    reasons: string[];
  
    industryScores:
      Partial<
        Record<
          BusinessIndustry,
          number
        >
      >;
  };
  
  type IndustryRule = {
    industry: BusinessIndustry;
  
    keywords: string[];
  
    fields: string[];
  
    businessModel: BusinessModel;
  
    revenueModels: RevenueModel[];
  };
  
  /* ================================== */
  /* INDUSTRY RULES */
  /* ================================== */
  
  const INDUSTRY_RULES:
    IndustryRule[] = [
      {
        industry:
          "home_services",
  
        keywords: [
          "hvac",
          "heating",
          "cooling",
          "air conditioning",
          "plumbing",
          "plumber",
          "electrician",
          "electrical",
          "roofing",
          "roofer",
          "landscaping",
          "landscape",
          "lawn",
          "pressure washing",
          "power washing",
          "pest control",
          "cleaning service",
          "garage door",
          "tree service",
          "home service",
        ],
  
        fields: [
          "service address",
          "technician",
          "service call",
          "work order",
        ],
  
        businessModel:
          "service",
  
        revenueModels: [
          "one_time",
          "project_based",
        ],
      },
  
      {
        industry:
          "construction",
  
        keywords: [
          "construction",
          "contractor",
          "general contractor",
          "remodel",
          "remodeling",
          "renovation",
          "builder",
          "building",
          "excavation",
          "concrete",
          "masonry",
          "carpentry",
        ],
  
        fields: [
          "project",
          "project name",
          "project status",
          "contract value",
          "change order",
        ],
  
        businessModel:
          "construction",
  
        revenueModels: [
          "project_based",
        ],
      },
  
      {
        industry:
          "automotive",
  
        keywords: [
          "automotive",
          "auto repair",
          "mechanic",
          "car repair",
          "auto body",
          "collision",
          "detailing",
          "car detailing",
          "vehicle",
          "tire shop",
          "oil change",
        ],
  
        fields: [
          "vehicle",
          "vin",
          "make",
          "model",
          "mileage",
          "repair order",
        ],
  
        businessModel:
          "automotive",
  
        revenueModels: [
          "one_time",
          "recurring",
        ],
      },
  
      {
        industry:
          "restaurant",
  
        keywords: [
          "restaurant",
          "cafe",
          "coffee shop",
          "bar",
          "grill",
          "pizza",
          "bakery",
          "catering",
          "food service",
        ],
  
        fields: [
          "table",
          "server",
          "check total",
          "menu item",
          "tip",
        ],
  
        businessModel:
          "hospitality",
  
        revenueModels: [
          "transactional",
        ],
      },
  
      {
        industry:
          "retail",
  
        keywords: [
          "retail",
          "store",
          "shop",
          "boutique",
          "merchandise",
        ],
  
        fields: [
          "sku",
          "product",
          "inventory",
          "quantity sold",
          "register",
        ],
  
        businessModel:
          "retail",
  
        revenueModels: [
          "transactional",
        ],
      },
  
      {
        industry:
          "ecommerce",
  
        keywords: [
          "ecommerce",
          "e-commerce",
          "online store",
          "shopify",
          "online shop",
        ],
  
        fields: [
          "order id",
          "shipping",
          "tracking",
          "cart",
          "checkout",
        ],
  
        businessModel:
          "ecommerce",
  
        revenueModels: [
          "transactional",
        ],
      },
  
      {
        industry:
          "agency",
  
        keywords: [
          "agency",
          "marketing agency",
          "advertising agency",
          "creative agency",
          "seo agency",
          "social media agency",
        ],
  
        fields: [
          "campaign",
          "retainer",
          "ad spend",
          "client account",
        ],
  
        businessModel:
          "professional_service",
  
        revenueModels: [
          "recurring",
          "project_based",
        ],
      },
  
      {
        industry:
          "professional_services",
  
        keywords: [
          "consulting",
          "consultant",
          "accounting",
          "accountant",
          "law firm",
          "attorney",
          "legal",
          "bookkeeping",
          "professional service",
        ],
  
        fields: [
          "billable hours",
          "hourly rate",
          "matter",
          "engagement",
        ],
  
        businessModel:
          "professional_service",
  
        revenueModels: [
          "project_based",
          "recurring",
        ],
      },
  
      {
        industry:
          "real_estate",
  
        keywords: [
          "real estate",
          "realtor",
          "brokerage",
          "property management",
          "property manager",
          "leasing",
          "rental",
        ],
  
        fields: [
          "property",
          "property address",
          "listing",
          "rent",
          "tenant",
          "lease",
          "commission",
        ],
  
        businessModel:
          "real_estate",
  
        revenueModels: [
          "commission",
          "recurring",
        ],
      },
  
      {
        industry:
          "health_fitness",
  
        keywords: [
          "gym",
          "fitness",
          "personal training",
          "personal trainer",
          "yoga",
          "pilates",
          "fitness studio",
        ],
  
        fields: [
          "membership",
          "member",
          "class",
          "trainer",
        ],
  
        businessModel:
          "subscription",
  
        revenueModels: [
          "recurring",
        ],
      },
  
      {
        industry:
          "healthcare",
  
        keywords: [
          "medical",
          "healthcare",
          "clinic",
          "doctor",
          "dental",
          "dentist",
          "chiropractic",
          "chiropractor",
          "therapy",
          "therapist",
        ],
  
        fields: [
          "patient",
          "provider",
          "insurance",
          "procedure",
        ],
  
        businessModel:
          "healthcare",
  
        revenueModels: [
          "one_time",
          "recurring",
        ],
      },
  
      {
        industry:
          "beauty",
  
        keywords: [
          "salon",
          "barber",
          "barbershop",
          "spa",
          "nail salon",
          "esthetician",
          "beauty",
        ],
  
        fields: [
          "stylist",
          "barber",
          "service provider",
          "treatment",
        ],
  
        businessModel:
          "service",
  
        revenueModels: [
          "one_time",
          "recurring",
        ],
      },
  
      {
        industry:
          "hospitality",
  
        keywords: [
          "hotel",
          "motel",
          "resort",
          "hospitality",
          "lodging",
          "vacation rental",
        ],
  
        fields: [
          "room",
          "reservation",
          "check in",
          "check out",
          "guest",
        ],
  
        businessModel:
          "hospitality",
  
        revenueModels: [
          "transactional",
        ],
      },
  
      {
        industry:
          "software",
  
        keywords: [
          "software",
          "saas",
          "app",
          "platform",
          "technology company",
        ],
  
        fields: [
          "subscription",
          "plan",
          "license",
          "mrr",
          "arr",
          "seat count",
        ],
  
        businessModel:
          "subscription",
  
        revenueModels: [
          "recurring",
        ],
      },
  
      {
        industry:
          "education",
  
        keywords: [
          "school",
          "education",
          "academy",
          "tutoring",
          "tutor",
          "training",
          "course",
        ],
  
        fields: [
          "student",
          "course",
          "class",
          "tuition",
          "enrollment",
        ],
  
        businessModel:
          "service",
  
        revenueModels: [
          "one_time",
          "recurring",
        ],
      },
    ];
  
  /* ================================== */
  /* TEXT HELPERS */
  /* ================================== */
  
  function normalizeText(
    value: unknown
  ): string {
    return String(
      value ?? ""
    )
      .trim()
      .toLowerCase()
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ");
  }
  
  function includesPhrase(
    text: string,
    phrase: string
  ): boolean {
    // Match whole words: "shop" must not match "shopping" or "workshop".
    const words = normalizeText(phrase).split(" ").map((word) =>
      word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    );
    return new RegExp(`\\b${words.join("\\s+")}\\b`, "i").test(text);
  }
  
  /* ================================== */
  /* FIELD DISCOVERY */
  /* ================================== */
  
  function collectFieldNames(
    rows: BusinessDataRow[]
  ): Set<string> {
    const fields =
      new Set<string>();
  
    for (
      const row of rows
    ) {
      for (
        const key of
        Object.keys(row)
      ) {
        fields.add(
          normalizeText(key)
        );
      }
    }
  
    return fields;
  }
  
  /* ================================== */
  /* CAPABILITY DETECTION */
  /* ================================== */
  
  function detectCapabilities(
    rows: BusinessDataRow[]
  ): BusinessCapabilities {
    const fields =
      collectFieldNames(rows);
  
    const hasAnyField = (
      names: string[]
    ): boolean =>
      names.some(
        (name) =>
          fields.has(
            normalizeText(name)
          )
      );
  
    return {
      usesLeads:
        hasAnyField([
          "Status",
          "Contacted",
          "Last Contact Date",
        ]),
  
      usesQuotes:
        hasAnyField([
          "Quote Amount",
          "Estimate Sent",
          "Expiration Date",
        ]),
  
      usesInvoices:
        hasAnyField([
          "Invoice Amount",
          "Due Date",
          "Billing Status",
        ]),
  
      usesAppointments:
        hasAnyField([
          "Appointment Status",
          "appointment date",
          "booking status",
        ]),
  
      usesJobs:
        hasAnyField([
          "Job Status",
          "Job Amount",
          "work order",
        ]),
  
      usesOrders:
        hasAnyField([
          "order id",
          "order status",
          "sku",
          "product",
        ]),
  
      usesSubscriptions:
        hasAnyField([
          "Recurring Amount",
          "Recurring Status",
          "Next Payment Date",
          "Renewal Amount",
          "Renewal Date",
        ]),
  
      usesPayments:
        hasAnyField([
          "Payment Status",
          "Amount Paid",
          "Deposit Amount",
          "Refund Amount",
          "Fee Amount",
        ]),
  
      usesCustomerRelationships:
        hasAnyField([
          "Customer Name",
          "client",
          "customer",
          "member",
          "patient",
        ]),
  
      usesSalesPipeline:
        hasAnyField([
          "Status",
          "Quote Amount",
          "Follow Up",
          "Contacted",
        ]),
    };
  }
  
  /* ================================== */
  /* INDUSTRY SCORING */
  /* ================================== */
  
  function scoreIndustries(
    input: IndustryClassifierInput
  ): Partial<
    Record<
      BusinessIndustry,
      number
    >
  > {
    const scores:
      Partial<
        Record<
          BusinessIndustry,
          number
        >
      > = {};
  
    const fields =
      collectFieldNames(
        input.rows
      );
  
    const contextText =
      normalizeText(
        [
          input.businessName,
          input.description,
        ]
          .filter(Boolean)
          .join(" ")
      );
  
    for (
      const rule of
      INDUSTRY_RULES
    ) {
      let score = 0;
  
      for (
        const keyword of
        rule.keywords
      ) {
        if (
          includesPhrase(
            contextText,
            keyword
          )
        ) {
          score += 5;
        }
      }
  
      for (
        const field of
        rule.fields
      ) {
        if (
          fields.has(
            normalizeText(field)
          )
        ) {
          score += 2;
        }
      }
  
      scores[
        rule.industry
      ] = score;
    }
  
    return scores;
  }
  
  /* ================================== */
  /* CLASSIFICATION */
  /* ================================== */
  
  export function classifyBusinessIndustry(
    input: IndustryClassifierInput
  ): IndustryClassification {
    const industryScores =
      scoreIndustries(input);
  
    let bestIndustry:
      BusinessIndustry =
        "other";
  
    let bestScore = 0;
  
    for (
      const [
        industry,
        score,
      ] of Object.entries(
        industryScores
      )
    ) {
      const safeScore =
        score ?? 0;
  
      if (
        safeScore >
        bestScore
      ) {
        bestIndustry =
          industry as
            BusinessIndustry;
  
        bestScore =
          safeScore;
      }
    }
  
    const matchedRule =
      INDUSTRY_RULES.find(
        (rule) =>
          rule.industry ===
          bestIndustry
      );
  
    const confidence:
      IndustryClassification[
        "confidence"
      ] =
        bestScore >= 10
          ? "high"
          : bestScore >= 5
            ? "medium"
            : "low";
  
    const reasons:
      string[] = [];
  
    if (
      bestIndustry ===
      "other"
    ) {
      reasons.push(
        "No industry received enough evidence for a confident classification."
      );
    } else {
      reasons.push(
        `${bestIndustry} received the highest classification score (${bestScore}).`
      );
    }
  
    return {
      industry:
        bestIndustry,
  
      businessModel:
        matchedRule
          ?.businessModel ??
        "other",
  
      revenueModels:
        matchedRule
          ?.revenueModels ??
        ["mixed"],
  
      capabilities:
        detectCapabilities(
          input.rows
        ),
  
      confidence,
  
      score:
        bestScore,
  
      reasons,
  
      industryScores,
    };
  }
  
  /* ================================== */
  /* BUILD PROFILE */
  /* ================================== */
  
  export function buildBusinessProfileFromData(
    input: IndustryClassifierInput
  ): BusinessIntelligenceProfile {
    const classification =
      classifyBusinessIndustry(
        input
      );
  
    return {
      businessId: null,
  
      businessName:
        input.businessName ??
        null,
  
      industry:
        classification.industry,
  
      businessModel:
        classification.businessModel,
  
      revenueModels:
        classification.revenueModels,
  
      capabilities:
        classification.capabilities,
  
      description:
        input.description ??
        null,
  
      metadata: {
        classification: {
          confidence:
            classification.confidence,
  
          score:
            classification.score,
  
          reasons:
            classification.reasons,
  
          industryScores:
            classification.industryScores,
        },
      },
    };
  }