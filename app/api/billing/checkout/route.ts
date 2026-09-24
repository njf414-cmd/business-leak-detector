import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import {
  getStripe,
  getStripeProPriceId,
} from "../../../lib/billing/stripe";

import {
  createSupabaseWorkerClient,
} from "../../../lib/supabase-worker";

export const dynamic = "force-dynamic";

async function createAuthenticatedSupabase() {
  const cookieStore = await cookies();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Supabase server configuration is missing."
    );
  }

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        for (const {
          name,
          value,
          options,
        } of cookiesToSet) {
          cookieStore.set(name, value, options);
        }
      },
    },
  });
}

export async function POST(request: Request) {
  try {
    const supabase =
      await createAuthenticatedSupabase();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        {
          success: false,
          error: "Authentication required.",
        },
        { status: 401 }
      );
    }

    const businessResult = await supabase
      .from("businesses")
      .select("id,name")
      .eq("user_id", user.id)
      .order("created_at", {
        ascending: true,
      })
      .limit(1)
      .maybeSingle();

    if (
      businessResult.error ||
      !businessResult.data?.id
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "No business found for this account.",
        },
        { status: 404 }
      );
    }

    const businessId = String(
      businessResult.data.id
    );

    const worker =
      createSupabaseWorkerClient();

    const existingResult = await worker
      .from("business_subscriptions")
      .select(
        "stripe_customer_id,stripe_subscription_id,status"
      )
      .eq("business_id", businessId)
      .maybeSingle();

    if (existingResult.error) {
      throw new Error(
        `Could not load billing record: ${existingResult.error.message}`
      );
    }

    const stripe = getStripe();

    let customerId =
      existingResult.data?.stripe_customer_id ??
      null;

    if (!customerId) {
      const customer =
        await stripe.customers.create({
          email: user.email ?? undefined,
          name:
            businessResult.data.name ??
            undefined,
          metadata: {
            business_id: businessId,
            user_id: user.id,
          },
        });

      customerId = customer.id;

      const {
        error: customerSaveError,
      } = await worker
        .from("business_subscriptions")
        .upsert(
          {
            business_id: businessId,
            plan: "free",
            status: "inactive",
            stripe_customer_id: customerId,
            updated_at:
              new Date().toISOString(),
          },
          {
            onConflict: "business_id",
          }
        );

      if (customerSaveError) {
        throw new Error(
          `Could not save Stripe customer: ${customerSaveError.message}`
        );
      }
    }

    const origin =
      process.env.NEXT_PUBLIC_APP_URL ||
      new URL(request.url).origin;

    const session =
      await stripe.checkout.sessions.create({
        mode: "subscription",

        customer: customerId,

        line_items: [
          {
            price: getStripeProPriceId(),
            quantity: 1,
          },
        ],

        allow_promotion_codes: true,

        client_reference_id: businessId,

        metadata: {
          business_id: businessId,
          user_id: user.id,
        },

        subscription_data: {
          metadata: {
            business_id: businessId,
            user_id: user.id,
          },
        },

        success_url:
          `${origin}/settings/automation?checkout=success`,

        cancel_url:
          `${origin}/settings/automation?checkout=cancelled`,
      });

    if (!session.url) {
      throw new Error(
        "Stripe did not return a checkout URL."
      );
    }

    return NextResponse.json({
      success: true,
      url: session.url,
    });
  } catch (error) {
    console.error(
      "billing.checkout.failed",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Could not start checkout.",
      },
      { status: 500 }
    );
  }
}
