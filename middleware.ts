import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const publicPaths = [
    "/login",
    "/onboarding", // allow SSR to render form, redirect logic occurs in page
    "/_next",
    "/api",
    "/favicon.ico",
    "/public",
    "/assets",
    "/auth/callback"
  ];
  const isPublic = publicPaths.some((p) => pathname.startsWith(p));

  const res = NextResponse.next();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // If env is missing, skip SSR auth to avoid hard failure; let UI warn.
  if (!url || !key) {
    if (!isPublic) {
      const to = req.nextUrl.clone();
      to.pathname = "/login";
      to.searchParams.set("redirect", pathname);
      return NextResponse.redirect(to);
    }
    return res;
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      get(name: string) {
        return req.cookies.get(name)?.value;
      },
      set(name: string, value: string, options: any) {
        res.cookies.set({ name, value, ...options });
      },
      remove(name: string, options: any) {
        res.cookies.set({ name, value: "", ...options });
      },
    },
  });

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session && !isPublic) {
    const to = req.nextUrl.clone();
    to.pathname = "/login";
    to.searchParams.set("redirect", pathname);
    return NextResponse.redirect(to);
  }

  // If authenticated but visiting /login, send to home or intended redirect
  if (session && pathname === "/login") {
    const to = req.nextUrl.clone();
    to.pathname = req.nextUrl.searchParams.get("redirect") || "/";
    return NextResponse.redirect(to);
  }

  return res;
}

export const config = {
  matcher: ["/(?!_next|.*\\.\")(.*)"],
};
