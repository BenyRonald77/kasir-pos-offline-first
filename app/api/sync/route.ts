import { NextRequest, NextResponse } from "next/server";
import { AppError, processSyncItem } from "@/lib/kasir";

/** Sync outbox dari klien offline. Idempoten per idempotency_key. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const list = body?.transaksi;
  if (!Array.isArray(list)) {
    return NextResponse.json(
      { error: "body harus { transaksi: [...] }" },
      { status: 400 }
    );
  }
  if (list.length === 0) {
    return NextResponse.json({ hasil: [] });
  }

  const hasil: unknown[] = [];
  for (const t of list) {
    try {
      if (!t || typeof t !== "object" || !t.idempotency_key) {
        hasil.push({ idempotency_key: null, hasil: "error", error: "idempotency_key wajib" });
        continue;
      }
      const r = await processSyncItem({
        idempotency_key: String(t.idempotency_key),
        items: t.items ?? [],
        bayar: Number(t.bayar),
        kasir: String(t.kasir ?? ""),
        client_created_at: t.client_created_at,
      });
      hasil.push({ idempotency_key: t.idempotency_key, ...r });
    } catch (e) {
      if (e instanceof AppError) {
        hasil.push({
          idempotency_key: t?.idempotency_key ?? null,
          hasil: "error",
          error: e.message,
        });
      } else {
        throw e;
      }
    }
  }
  return NextResponse.json({ hasil });
}
