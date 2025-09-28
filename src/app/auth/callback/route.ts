import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = url.searchParams.get("next") || "/";
  const code = url.searchParams.get("code");

  const supabase = await getSupabaseServerClient();
  if (!supabase) return NextResponse.redirect(new URL("/login", url));

  if (code) {
    try {
      // Exchange auth code for a session and set cookies
      await supabase.auth.exchangeCodeForSession(code);
    } catch {
      return NextResponse.redirect(new URL(`/login?error=exchange&redirect=${encodeURIComponent(next)}`, url));
    }
  }

  return NextResponse.redirect(new URL(next, url));
}

