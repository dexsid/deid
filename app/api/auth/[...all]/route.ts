import { getAuth } from "../../../../lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handle(request: Request) {
  const auth = getAuth();
  if (!auth) return Response.json({ error: "Authentication is not configured" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  return auth.handler(request);
}

export { handle as GET, handle as POST };
