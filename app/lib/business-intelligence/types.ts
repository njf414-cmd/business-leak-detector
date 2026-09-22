/* ================================== */
/* BUSINESS TYPES */
/* ================================== */

export type BusinessModel =
  | "service"
  | "retail"
  | "ecommerce"
  | "subscription"
  | "professional_service"
  | "construction"
  | "healthcare"
  | "hospitality"
  | "real_estate"
  | "automotive"
  | "other";

export type RevenueModel =
  | "one_time"
  | "recurring"
  | "project_based"
  | "transactional"
  | "commission"
  | "mixed";

export type BusinessIndustry =
  | "subscription-services"
  | "appointment-services"
  | "home_services"
  | "construction"
  | "automotive"
  | "restaurant"
  | "retail"
  | "ecommerce"
  | "agency"
  | "professional_services"
  | "real_estate"
  | "health_fitness"
  | "healthcare"
  | "beauty"
  | "hospitality"
  | "software"
  | "education"
  | "other";

/* ================================== */
/* BUSINESS CAPABILITIES */
/* ================================== */

export type BusinessCapabilities = {
  usesLeads: boolean;

  usesQuotes: boolean;

  usesInvoices: boolean;

  usesAppointments: boolean;

  usesJobs: boolean;

  usesOrders: boolean;

  usesSubscriptions: boolean;

  usesPayments: boolean;

  usesCustomerRelationships: boolean;

  usesSalesPipeline: boolean;
};

/* ================================== */
/* BUSINESS PROFILE */
/* ================================== */

export type BusinessIntelligenceProfile = {
  businessId: string | null;

  businessName: string | null;

  industry: BusinessIndustry;

  businessModel: BusinessModel;

  revenueModels: RevenueModel[];

  capabilities: BusinessCapabilities;

  /*
    Human-readable information about how the
    business operates.

    This will eventually be generated or enhanced
    during AI onboarding.
  */

  description: string | null;

  /*
    Allows future industry-specific modules without
    changing the universal profile structure.
  */

  metadata: Record<string, unknown>;
};

/* ================================== */
/* DEFAULT PROFILE */
/* ================================== */

export function createDefaultBusinessProfile():
  BusinessIntelligenceProfile {
  return {
    businessId: null,

    businessName: null,

    industry: "other",

    businessModel: "other",

    revenueModels: ["mixed"],

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

    description: null,

    metadata: {},
  };
}