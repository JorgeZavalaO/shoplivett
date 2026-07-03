import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/auth";
import { getImage } from "@/lib/blob";
import { getPrisma } from "@/lib/prisma";

type Params = Promise<{ id: string }>;

const ALLOWED_ROLES = new Set(["ADMIN", "SELLER"]);

export async function GET(
  request: NextRequest,
  { params }: { params: Params },
) {
  const session = await auth();
  if (!session?.user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  if (!ALLOWED_ROLES.has(session.user.role)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const { id } = await params;
  if (!id) return new NextResponse("Not found", { status: 404 });

  const receipt = await getPrisma().paymentReceipt.findUnique({
    where: { id },
    select: { pathname: true },
  });
  if (!receipt) return new NextResponse("Not found", { status: 404 });

  const blob =
    (await getImage(receipt.pathname, "private")) ??
    (await getImage(receipt.pathname, "public"));
  if (!blob || blob.statusCode !== 200) {
    return new NextResponse("Not found", { status: 404 });
  }

  const ifNoneMatch = request.headers.get("if-none-match");
  if (ifNoneMatch && ifNoneMatch === blob.blob.etag) {
    return new NextResponse(null, { status: 304 });
  }

  return new NextResponse(blob.stream, {
    headers: {
      "Cache-Control": "private, max-age=300",
      "Content-Disposition": "inline",
      "Content-Length": String(blob.blob.size),
      "Content-Type": blob.blob.contentType,
      ETag: blob.blob.etag,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
