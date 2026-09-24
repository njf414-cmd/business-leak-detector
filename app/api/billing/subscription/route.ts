import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { getBusinessEntitlements } from "../../../lib/billing/entitlements";

export const dynamic = "force-dynamic";

async function createAuthenticatedSupabase() {
  const cookieStore = await cookies();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    throw new Error("Supabase server configuration is missing.");
  }

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          cookieStore.set(name, value, options);
        }
      },
    },
  });
}

export async function GET() {
  try {
    const supabase = await createAuthenticatedSupabase();

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
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (businessResult.error) {
      throw new Error(
        `Could not load business: ${businessResult.error.message}`
      );
    }

    if (!businessResult.data?.id) {
      return NextResponse.json(
        {
          success: false,
          error: "No business found for this account.",
        },
        { status: 404 }
      );
    }

    const entitlements = await getBusinessEntitlements(
      supabase,
      String(businessResult.data.id)
    );

    return NextResponse.json(
      {
        success: true,
        plan: entitlements.subscription.plan,
        status: entitlements.subscription.status,
        hasProAccess: entitlements.hasProAccess,
        features: entitlements.features,
        subscription: {
          currentPeriodEnd:
            entitlements.subscription.current_period_end,
          cancelAtPeriodEnd:
            entitlements.subscription.cancel_at_period_end,
        },
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("billing.subscription.get.failed", error);

    return NextResponse.json(
      {
        success: false,
        error: "Could not load subscription.",
      },
      { status: 500 }
    );
  }
}
