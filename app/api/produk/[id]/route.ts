import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = Number(params.id);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: "id tidak valid" }, { status: 400 });
  }
  const row = await prisma.produk.findUnique({ where: { id } });
  if (!row) return NextResponse.json({ error: "produk tidak ditemukan" }, { status: 404 });
  return NextResponse.json(row);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = Number(params.id);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: "id tidak valid" }, { status: 400 });
  }
  const row = await prisma.produk.findUnique({ where: { id } });
  if (!row) return NextResponse.json({ error: "produk tidak ditemukan" }, { status: 404 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "body JSON tidak valid" }, { status: 400 });
  }
  const data: { nama?: string; sku?: string; harga?: number; stok?: number } = {};
  if (body.nama !== undefined) {
    const nama = String(body.nama).trim();
    if (!nama) return NextResponse.json({ error: "nama tidak boleh kosong" }, { status: 400 });
    data.nama = nama;
  }
  if (body.sku !== undefined) {
    const sku = String(body.sku).trim();
    if (!sku) return NextResponse.json({ error: "sku tidak boleh kosong" }, { status: 400 });
    const dupe = await prisma.produk.findUnique({ where: { sku } });
    if (dupe && dupe.id !== id) {
      return NextResponse.json({ error: `sku ${sku} sudah dipakai` }, { status: 409 });
    }
    data.sku = sku;
  }
  if (body.harga !== undefined) {
    const harga = Number(body.harga);
    if (!Number.isInteger(harga) || harga <= 0) {
      return NextResponse.json({ error: "harga harus bilangan bulat > 0" }, { status: 400 });
    }
    data.harga = harga;
  }
  if (body.stok !== undefined) {
    const stok = Number(body.stok);
    if (!Number.isInteger(stok) || stok < 0) {
      return NextResponse.json({ error: "stok harus bilangan bulat >= 0" }, { status: 400 });
    }
    data.stok = stok;
  }
  const updated = await prisma.produk.update({ where: { id }, data });
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = Number(params.id);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: "id tidak valid" }, { status: 400 });
  }
  const row = await prisma.produk.findUnique({ where: { id } });
  if (!row) return NextResponse.json({ error: "produk tidak ditemukan" }, { status: 404 });
  await prisma.produk.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
