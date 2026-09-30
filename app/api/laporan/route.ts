import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { today } from "@/lib/format";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const tgl = today();
  const from = url.searchParams.get("from") ?? tgl;
  const to = url.searchParams.get("to") ?? tgl;

  const txs = await prisma.transaksi.findMany({
    where: {
      status: "synced",
      created_at: { gte: from + "T00:00:00.000Z", lte: to + "T23:59:59.999Z" },
    },
    include: { items: { include: { produk: true } } },
  });

  const total_omzet = txs.reduce((s, t) => s + t.total, 0);
  const jumlah_transaksi = txs.length;

  const byProduk = new Map<number, { produk_id: number; nama: string; qty: number; omzet: number }>();
  for (const t of txs) {
    for (const it of t.items) {
      const cur = byProduk.get(it.produk_id) ?? {
        produk_id: it.produk_id,
        nama: it.produk.nama,
        qty: 0,
        omzet: 0,
      };
      cur.qty += it.qty;
      cur.omzet += it.subtotal;
      byProduk.set(it.produk_id, cur);
    }
  }
  const terlaris = Array.from(byProduk.values()).sort((a, b) => b.qty - a.qty).slice(0, 5);

  const stok_menipis = await prisma.produk.findMany({
    where: { stok: { lt: 5 } },
    orderBy: { stok: "asc" },
  });

  return NextResponse.json({
    from,
    to,
    total_omzet,
    jumlah_transaksi,
    produk_terlaris: terlaris,
    stok_menipis,
  });
}
