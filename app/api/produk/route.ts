import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const rows = await prisma.produk.findMany({ orderBy: { nama: "asc" } });
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "body JSON tidak valid" }, { status: 400 });
  }
  const nama = String(body.nama ?? "").trim();
  const sku = String(body.sku ?? "").trim();
  const harga = Number(body.harga);
  const stok = Number(body.stok ?? 0);
  if (!nama) return NextResponse.json({ error: "nama wajib diisi" }, { status: 400 });
  if (!sku) return NextResponse.json({ error: "sku wajib diisi" }, { status: 400 });
  if (!Number.isInteger(harga) || harga <= 0) {
    return NextResponse.json({ error: "harga harus bilangan bulat > 0" }, { status: 400 });
  }
  if (!Number.isInteger(stok) || stok < 0) {
    return NextResponse.json({ error: "stok harus bilangan bulat >= 0" }, { status: 400 });
  }
  const dupe = await prisma.produk.findUnique({ where: { sku } });
  if (dupe) {
    return NextResponse.json({ error: `sku ${sku} sudah dipakai` }, { status: 409 });
  }
  const created = await prisma.produk.create({ data: { nama, sku, harga, stok } });
  return NextResponse.json(created, { status: 201 });
}
