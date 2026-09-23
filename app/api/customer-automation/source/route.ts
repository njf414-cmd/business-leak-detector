import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

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
        { success: false, error: "Authentication required." },
        { status: 401 }
      );
    }

    const { data: business, error: businessError } = await supabase
      .from("businesses")
      .select("id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (businessError) {
      throw new Error(`Could not load business: ${businessError.message}`);
    }

    if (!business?.id) {
      return NextResponse.json(
        { success: false, error: "No business found for this account." },
        { status: 404 }
      );
    }

    const { data: source, error: sourceError } = await supabase
      .from("customer_scan_sources")
      .select(
        "business_id,file_name,content_type,size_bytes,industry,uploaded_at,updated_at"
      )
      .eq("business_id", business.id)
      .maybeSingle();

    if (sourceError) {
      throw new Error(`Could not load scan source: ${sourceError.message}`);
    }

    return NextResponse.json(
      {
        success: true,
        businessId: business.id,
        source: source ?? null,
      },
      {
        status: 200,
        headers: { "Cache-Control": "no-store" },
      }
    );
  } catch (error) {
    console.error("customer-automation.source.get.failed", error);

    return NextResponse.json(
      {
        success: false,
        error: "Could not load recurring scan source.",
      },
      { status: 500 }
    );
  }
}
