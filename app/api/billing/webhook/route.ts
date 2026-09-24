import Stripe from "stripe";
import { NextResponse } from "next/server";

import {
  getStripe,
  getStripeWebhookSecret,
} from "../../../lib/billing/stripe";

import {
  createSupabaseWorkerClient,
} from "../../../lib/supabase-worker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type StoredSubscriptionStatus =
  | "inactive"
  | "trialing"
  | "active"
  | "past_due"
  | "canceled";

function normalizeStatus(
  status: Stripe.Subscription.Status
): StoredSubscriptionStatus {
  if (status === "trialing") {
    return "trialing";
  }

  if (status === "active") {
    return "active";
  }

  if (
    status === "past_due" ||
    status === "unpaid"
  ) {
    return "past_due";
  }

  if (status === "canceled") {
    return "canceled";
  }

  return "inactive";
}

async function syncSubscription(
  subscription: Stripe.Subscription
) {
  const worker =
    createSupabaseWorkerClient();

  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;

  let businessId =
    subscription.metadata?.business_id ||
    null;

  if (!businessId) {
    const lookup = await worker
      .from("business_subscriptions")
      .select("business_id")
      .eq(
        "stripe_customer_id",
        customerId
      )
      .maybeSingle();

    if (lookup.error) {
      throw new Error(
        `Could not resolve subscription business: ${lookup.error.message}`
      );
    }

    businessId =
      lookup.data?.business_id ?? null;
  }

  if (!businessId) {
    throw new Error(
      `No business found for Stripe subscription ${subscription.id}.`
    );
  }

  const subscriptionWithPeriod =
    subscription as Stripe.Subscription & {
      current_period_end?: number;
    };

  const currentPeriodEnd =
    typeof subscriptionWithPeriod
      .current_period_end === "number"
      ? new Date(
          subscriptionWithPeriod.current_period_end *
            1000
        ).toISOString()
      : null;

  const priceId =
    subscription.items.data[0]?.price?.id ??
    null;

  const {
    error,
  } = await worker
    .from("business_subscriptions")
    .upsert(
      {
        business_id: businessId,
        plan: "pro",
        status: normalizeStatus(
          subscription.status
        ),
        stripe_customer_id: customerId,
        stripe_subscription_id:
          subscription.id,
        stripe_price_id: priceId,
        current_period_end:
          currentPeriodEnd,
        cancel_at_period_end:
          Boolean(
            subscription.cancel_at_period_end
          ),
        updated_at:
          new Date().toISOString(),
      },
      {
        onConflict: "business_id",
      }
    );

  if (error) {
    throw new Error(
      `Could not sync Stripe subscription: ${error.message}`
    );
  }
}

export async function POST(
  request: Request
) {
  try {
    const stripe = getStripe();

    const signature =
      request.headers.get(
        "stripe-signature"
      );

    if (!signature) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Missing Stripe signature.",
        },
        { status: 400 }
      );
    }

    const payload =
      await request.text();

    const event =
      stripe.webhooks.constructEvent(
        payload,
        signature,
        getStripeWebhookSecret()
      );

    if (
      event.type ===
        "customer.subscription.created" ||
      event.type ===
        "customer.subscription.updated" ||
      event.type ===
        "customer.subscription.deleted"
    ) {
      await syncSubscription(
        event.data.object
      );
    }

    if (
      event.type ===
      "checkout.session.completed"
    ) {
      const session =
        event.data.object;

      const subscriptionId =
        typeof session.subscription ===
        "string"
          ? session.subscription
          : session.subscription?.id;

      if (subscriptionId) {
        const subscription =
          await stripe.subscriptions.retrieve(
            subscriptionId
          );

        await syncSubscription(
          subscription
        );
      }
    }

    return NextResponse.json({
      received: true,
    });
  } catch (error) {
    console.error(
      "billing.webhook.failed",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Webhook processing failed.",
      },
      { status: 400 }
    );
  }
}
