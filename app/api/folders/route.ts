import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { fetchMutation, fetchQuery } from "convex/nextjs";
import { ConvexError } from "convex/values";
import { NextResponse, type NextRequest } from "next/server";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

export const dynamic = "force-dynamic";

function originIsAllowed(request: NextRequest): boolean {
  return request.headers.get("origin") === request.nextUrl.origin;
}

function errorCode(error: unknown): string | null {
  if (error instanceof ConvexError && typeof error.data === "object" && error.data !== null) {
    const code = (error.data as { code?: unknown }).code;
    return typeof code === "string" ? code : null;
  }
  return null;
}

const statuses: Record<string, number> = { invalid_folder_name: 400, folder_exists: 409, too_many_folders: 400 };

export async function GET() {
  const token = await convexAuthNextjsToken();
  if (!token) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const library = await fetchQuery(api.saves.library, {}, { token });
  if (library === null) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  return NextResponse.json(library);
}

export async function POST(request: NextRequest) {
  const token = await convexAuthNextjsToken();
  if (!token) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (!originIsAllowed(request)) return NextResponse.json({ error: "origin_not_allowed" }, { status: 403 });
  const body = (await request.json().catch(() => null)) as { name?: unknown } | null;
  if (typeof body?.name !== "string") return NextResponse.json({ error: "invalid_folder_name" }, { status: 400 });
  try {
    const folder = await fetchMutation(api.saves.createFolder, { name: body.name }, { token });
    return NextResponse.json(folder, { status: 201 });
  } catch (error) {
    const code = errorCode(error);
    return NextResponse.json({ error: code ?? "folder_failed" }, { status: statuses[code ?? ""] ?? 400 });
  }
}

export async function PATCH(request: NextRequest) {
  const token = await convexAuthNextjsToken();
  if (!token) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (!originIsAllowed(request)) return NextResponse.json({ error: "origin_not_allowed" }, { status: 403 });
  const body = (await request.json().catch(() => null)) as { action?: unknown; folderId?: unknown; name?: unknown; slug?: unknown } | null;
  try {
    if (body?.action === "rename" && typeof body.folderId === "string" && typeof body.name === "string") {
      await fetchMutation(api.saves.renameFolder, { folderId: body.folderId as Id<"collections">, name: body.name }, { token });
    } else if (body?.action === "move" && typeof body.slug === "string") {
      const folderId = body.folderId === null || body.folderId === undefined ? null : body.folderId as Id<"collections">;
      await fetchMutation(api.saves.moveToFolder, { slug: body.slug, folderId }, { token });
    } else {
      return NextResponse.json({ error: "invalid_folder_request" }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    const code = errorCode(error);
    return NextResponse.json({ error: code ?? "folder_failed" }, { status: statuses[code ?? ""] ?? 400 });
  }
}

export async function DELETE(request: NextRequest) {
  const token = await convexAuthNextjsToken();
  if (!token) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (!originIsAllowed(request)) return NextResponse.json({ error: "origin_not_allowed" }, { status: 403 });
  const body = (await request.json().catch(() => null)) as { folderId?: unknown } | null;
  if (typeof body?.folderId !== "string") return NextResponse.json({ error: "invalid_folder_request" }, { status: 400 });
  await fetchMutation(api.saves.deleteFolder, { folderId: body.folderId as Id<"collections"> }, { token });
  return NextResponse.json({ ok: true });
}
