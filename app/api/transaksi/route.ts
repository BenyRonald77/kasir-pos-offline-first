import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AppError, processSyncItem } from "@/lib/kasir";

export async function GET() {
  const rows = await prisma.transaksi.findMany({
    orderBy: { id: "desc" },
    take: 50,
    include: { items: { include: { produk: true } } },
  });
  return NextResponse.json(rows);
}

/** Checkout online langsung: idempotency_key boleh dikirim klien atau dibuat server. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "body JSON tidak valid" }, { status: 400 });
  }
  try {
    const result = await processSyncItem({
      idempotency_key:
        typeof body.idempotency_key === "string" && body.idempotency_key
          ? body.idempotency_key
          : crypto.randomUUID(),
      items: body.items ?? [],
      bayar: Number(body.bayar),
      kasir: String(body.kasir ?? ""),
      client_created_at: new Date().toISOString(),
    });
    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    if (e instanceof AppError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}
