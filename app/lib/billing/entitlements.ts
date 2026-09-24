import type { SupabaseClient } from "@supabase/supabase-js";

export type BillingPlan = "free" | "pro";

export type SubscriptionStatus =
  | "inactive"
  | "trialing"
  | "active"
  | "past_due"
  | "canceled";

export type ProFeature =
  | "ai_setup"
  | "recurring_scans"
  | "automatic_reports"
  | "notifications";

export type BusinessSubscription = {
  id: string | null;
  business_id: string;
  plan: BillingPlan;
  status: SubscriptionStatus;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
};

export type BusinessEntitlements = {
  subscription: BusinessSubscription;
  hasProAccess: boolean;
  features: Record<ProFeature, boolean>;
};

const PRO_FEATURES: ProFeature[] = [
  "ai_setup",
  "recurring_scans",
  "automatic_reports",
  "notifications",
];

function createFreeSubscription(
  businessId: string
): BusinessSubscription {
  return {
    id: null,
    business_id: businessId,
    plan: "free",
    status: "inactive",
    stripe_customer_id: null,
    stripe_subscription_id: null,
    stripe_price_id: null,
    current_period_end: null,
    cancel_at_period_end: false,
  };
}

export function subscriptionHasProAccess(
  subscription: BusinessSubscription
) {
  return (
    subscription.plan === "pro" &&
    (
      subscription.status === "active" ||
      subscription.status === "trialing"
    )
  );
}

export function buildEntitlements(
  subscription: BusinessSubscription
): BusinessEntitlements {
  const hasProAccess =
    subscriptionHasProAccess(subscription);

  const features = Object.fromEntries(
    PRO_FEATURES.map((feature) => [
      feature,
      hasProAccess,
    ])
  ) as Record<ProFeature, boolean>;

  return {
    subscription,
    hasProAccess,
    features,
  };
}

export function hasFeature(
  entitlements: BusinessEntitlements,
  feature: ProFeature
) {
  return entitlements.features[feature] === true;
}

export async function getBusinessEntitlements(
  supabase: SupabaseClient,
  businessId: string
): Promise<BusinessEntitlements> {
  const result = await supabase
    .from("business_subscriptions")
    .select(
      [
        "id",
        "business_id",
        "plan",
        "status",
        "stripe_customer_id",
        "stripe_subscription_id",
        "stripe_price_id",
        "current_period_end",
        "cancel_at_period_end",
      ].join(",")
    )
    .eq("business_id", businessId)
    .maybeSingle();

  if (result.error) {
    throw new Error(
      `Could not load subscription: ${result.error.message}`
    );
  }

  type SubscriptionRow = {
    id: string;
    business_id: string;
    plan: string;
    status: string;
    stripe_customer_id: string | null;
    stripe_subscription_id: string | null;
    stripe_price_id: string | null;
    current_period_end: string | null;
    cancel_at_period_end: boolean | null;
  };

  const row = result.data as unknown as SubscriptionRow | null;

  if (!row) {
    return buildEntitlements(
      createFreeSubscription(businessId)
    );
  }

  const validStatuses: SubscriptionStatus[] = [
    "inactive",
    "trialing",
    "active",
    "past_due",
    "canceled",
  ];

  const status: SubscriptionStatus =
    validStatuses.includes(row.status as SubscriptionStatus)
      ? (row.status as SubscriptionStatus)
      : "inactive";

  const subscription: BusinessSubscription = {
    id: row.id,
    business_id: row.business_id,
    plan: row.plan === "pro" ? "pro" : "free",
    status,
    stripe_customer_id: row.stripe_customer_id,
    stripe_subscription_id: row.stripe_subscription_id,
    stripe_price_id: row.stripe_price_id,
    current_period_end: row.current_period_end,
    cancel_at_period_end: Boolean(row.cancel_at_period_end),
  };

  return buildEntitlements(subscription);
}
