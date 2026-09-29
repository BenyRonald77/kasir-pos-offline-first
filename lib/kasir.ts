import { prisma } from "@/lib/prisma";

export class AppError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export type SyncItemInput = { produk_id: number; qty: number };

export type SyncResult =
  | { hasil: "synced" | "duplicate"; transaksi_id: number; total: number; detail?: unknown }
  | { hasil: "conflict"; transaksi_id: number; total: number; konflik: KonflikItem[] };

export type KonflikItem = {
  produk_id: number;
  nama: string;
  qty_diminta: number;
  stok_tersedia: number;
};

export type SyncInput = {
  idempotency_key: string;
  items: SyncItemInput[];
  bayar: number;
  kasir: string;
  client_created_at?: string;
};

/** Buat transaksi dari satu payload sync. Idempoten terhadap idempotency_key. */
export async function processSyncItem(inp: SyncInput): Promise<SyncResult> {
  const existing = await prisma.transaksi.findUnique({
    where: { idempotency_key: inp.idempotency_key },
  });
  if (existing) {
    return { hasil: "duplicate", transaksi_id: existing.id, total: existing.total };
  }

  if (!inp.items || inp.items.length === 0) {
    throw new AppError(400, "items tidak boleh kosong");
  }
  if (!inp.bayar || inp.bayar <= 0) {
    throw new AppError(400, "bayar harus lebih dari 0");
  }
  if (!inp.kasir || !inp.kasir.trim()) {
    throw new AppError(400, "kasir wajib diisi");
  }

  const produkIds = inp.items.map((i) => i.produk_id);
  const produks = await prisma.produk.findMany({
    where: { id: { in: produkIds } },
  });
  const byId = new Map(produks.map((p) => [p.id, p]));

  const lines: {
    produk_id: number;
    nama: string;
    qty: number;
    harga_satuan: number;
    subtotal: number;
  }[] = [];
  for (const it of inp.items) {
    const p = byId.get(it.produk_id);
    if (!p) throw new AppError(404, `produk id ${it.produk_id} tidak ditemukan`);
    if (!Number.isInteger(it.qty) || it.qty <= 0) {
      throw new AppError(400, `qty produk ${p.nama} tidak valid`);
    }
    lines.push({
      produk_id: p.id,
      nama: p.nama,
      qty: it.qty,
      harga_satuan: p.harga,
      subtotal: it.qty * p.harga,
    });
  }

  const total = lines.reduce((s, l) => s + l.subtotal, 0);
  if (inp.bayar < total) {
    throw new AppError(400, `bayar kurang: total ${total}, bayar ${inp.bayar}`);
  }
  const kembalian = inp.bayar - total;
  const createdAt = inp.client_created_at ?? new Date().toISOString();

  const konflik: KonflikItem[] = [];
  for (const l of lines) {
    const p = byId.get(l.produk_id)!;
    if (p.stok < l.qty) {
      konflik.push({
        produk_id: p.id,
        nama: p.nama,
        qty_diminta: l.qty,
        stok_tersedia: p.stok,
      });
    }
  }

  if (konflik.length > 0) {
    const t = await prisma.transaksi.create({
      data: {
        idempotency_key: inp.idempotency_key,
        kasir: inp.kasir.trim(),
        total,
        bayar: inp.bayar,
        kembalian,
        status: "conflict",
        created_at: createdAt,
        synced_at: new Date().toISOString(),
        items: {
          create: lines.map((l) => ({
            produk_id: l.produk_id,
            qty: l.qty,
            harga_satuan: l.harga_satuan,
            subtotal: l.subtotal,
          })),
        },
      },
    });
    return { hasil: "conflict", transaksi_id: t.id, total, konflik };
  }

  const t = await prisma.$transaction(async (tx) => {
    for (const l of lines) {
      await tx.produk.update({
        where: { id: l.produk_id },
        data: { stok: { decrement: l.qty } },
      });
    }
    return tx.transaksi.create({
      data: {
        idempotency_key: inp.idempotency_key,
        kasir: inp.kasir.trim(),
        total,
        bayar: inp.bayar,
        kembalian,
        status: "synced",
        created_at: createdAt,
        synced_at: new Date().toISOString(),
        items: {
          create: lines.map((l) => ({
            produk_id: l.produk_id,
            qty: l.qty,
            harga_satuan: l.harga_satuan,
            subtotal: l.subtotal,
          })),
        },
      },
    });
  });
  return { hasil: "synced", transaksi_id: t.id, total };
}

/** Resolve transaksi conflict: adjust (sesuaikan qty ke stok) atau void. */
export async function resolveConflict(
  id: number,
  aksi: "adjust" | "void"
): Promise<{ transaksi_id: number; status: string; total: number }> {
  const t = await prisma.transaksi.findUnique({
    where: { id },
    include: { items: { include: { produk: true } } },
  });
  if (!t) throw new AppError(404, "transaksi tidak ditemukan");
  if (t.status !== "conflict") {
    throw new AppError(409, `transaksi status ${t.status}, hanya conflict yang bisa di-resolve`);
  }

  if (aksi === "void") {
    await prisma.transaksi.update({
      where: { id },
      data: { status: "void" },
    });
    return { transaksi_id: id, status: "void", total: t.total };
  }

  // adjust: sesuaikan qty ke stok tersedia
  const newLines: { item_id: number; produk_id: number; qty: number }[] = [];
  for (const item of t.items) {
    const stok = item.produk.stok;
    if (stok > 0) {
      newLines.push({
        item_id: item.id,
        produk_id: item.produk_id,
        qty: Math.min(item.qty, stok),
      });
    }
  }
  if (newLines.length === 0) {
    throw new AppError(409, "semua item stoknya 0, tidak ada yang bisa diproses");
  }

  const updated = await prisma.$transaction(async (tx) => {
    let total = 0;
    for (const nl of newLines) {
      const item = t.items.find((i) => i.id === nl.item_id)!;
      const subtotal = nl.qty * item.harga_satuan;
      total += subtotal;
      await tx.transaksiItem.update({
        where: { id: nl.item_id },
        data: { qty: nl.qty, subtotal },
      });
      await tx.produk.update({
        where: { id: nl.produk_id },
        data: { stok: { decrement: nl.qty } },
      });
    }
    // hapus item yang stoknya 0
    const removedIds = t.items
      .filter((i) => !newLines.some((nl) => nl.item_id === i.id))
      .map((i) => i.id);
    if (removedIds.length > 0) {
      await tx.transaksiItem.deleteMany({ where: { id: { in: removedIds } } });
    }
    return tx.transaksi.update({
      where: { id },
      data: {
        total,
        kembalian: t.bayar - total,
        status: "synced",
        synced_at: new Date().toISOString(),
      },
    });
  });
  return { transaksi_id: id, status: "synced", total: updated.total };
}
