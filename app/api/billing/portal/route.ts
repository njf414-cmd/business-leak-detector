import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import {
  getStripe,
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
      .select("id")
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

    const worker =
      createSupabaseWorkerClient();

    const subscriptionResult =
      await worker
        .from("business_subscriptions")
        .select("stripe_customer_id")
        .eq(
          "business_id",
          String(businessResult.data.id)
        )
        .maybeSingle();

    if (subscriptionResult.error) {
      throw new Error(
        `Could not load billing account: ${subscriptionResult.error.message}`
      );
    }

    const customerId =
      subscriptionResult.data
        ?.stripe_customer_id;

    if (!customerId) {
      return NextResponse.json(
        {
          success: false,
          error:
            "No Stripe billing account exists yet.",
        },
        { status: 400 }
      );
    }

    const origin =
      process.env.NEXT_PUBLIC_APP_URL ||
      new URL(request.url).origin;

    const stripe = getStripe();

    const portalSession =
      await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url:
          `${origin}/settings/automation`,
      });

    return NextResponse.json({
      success: true,
      url: portalSession.url,
    });
  } catch (error) {
    console.error(
      "billing.portal.failed",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Could not open billing portal.",
      },
      { status: 500 }
    );
  }
}
