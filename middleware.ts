import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

const PROTECTED_PREFIXES = [
  "/desk",
  "/eval",
  "/experiments",
  "/metrics",
  "/api/documents",
  "/api/ingest",
  "/api/chat",
  "/api/summarize",
  "/api/eval",
  "/api/conversations",
  "/api/experiments",
  "/api/metrics",
  "/api/suggestions",
];

function isProtected(pathname: string) {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const { pathname } = request.nextUrl;
  const isApi = pathname.startsWith("/api/");

  if (!url || !anon) {
    if (isProtected(pathname)) {
      if (isApi) {
        return NextResponse.json(
          {
            error:
              "Supabase Auth belum dikonfigurasi (NEXT_PUBLIC_SUPABASE_URL / ANON_KEY).",
          },
          { status: 503 },
        );
      }
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/login";
      loginUrl.searchParams.set(
        "error",
        "Supabase Auth belum dikonfigurasi (NEXT_PUBLIC_SUPABASE_URL / ANON_KEY).",
      );
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  const { supabaseResponse, user } = await updateSession(request);

  if (isProtected(pathname) && !user) {
    if (isApi) {
      return NextResponse.json(
        { error: "Unauthorized. Silakan login dulu." },
        { status: 401 },
      );
    }
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname === "/login" && user) {
    const next = request.nextUrl.searchParams.get("next") || "/desk";
    return NextResponse.redirect(new URL(next, request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/desk",
    "/desk/:path*",
    "/eval",
    "/eval/:path*",
    "/experiments",
    "/experiments/:path*",
    "/metrics",
    "/metrics/:path*",
    "/login",
    "/api/documents",
    "/api/documents/:path*",
    "/api/ingest",
    "/api/ingest/:path*",
    "/api/chat",
    "/api/chat/:path*",
    "/api/summarize",
    "/api/summarize/:path*",
    "/api/eval",
    "/api/eval/:path*",
    "/api/conversations",
    "/api/conversations/:path*",
    "/api/experiments",
    "/api/experiments/:path*",
    "/api/metrics",
    "/api/metrics/:path*",
    "/api/suggestions",
    "/api/suggestions/:path*",
  ],
};
