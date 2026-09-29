"use client";
import { useEffect, useState } from "react";
import { rupiah, fmtWaktu } from "@/lib/format";

type Tx = {
  id: number;
  idempotency_key: string;
  kasir: string;
  total: number;
  bayar: number;
  kembalian: number;
  status: string;
  created_at: string;
  items: { id: number; qty: number; harga_satuan: number; subtotal: number; produk: { id: number; nama: string; stok: number } }[];
};

export default function KonflikPage() {
  const [rows, setRows] = useState<Tx[]>([]);
  const [msg, setMsg] = useState("");

  const load = () =>
    fetch("/api/transaksi")
      .then((r) => r.json())
      .then((all: Tx[]) => setRows(all.filter((t) => t.status === "conflict")))
      .catch(() => {});
  useEffect(() => {
    load();
  }, []);

  async function resolve(id: number, aksi: "adjust" | "void") {
    if (!confirm(aksi === "void" ? "Batalkan transaksi ini?" : "Sesuaikan qty ke stok tersedia?"))
      return;
    setMsg("");
    const r = await fetch(`/api/transaksi/${id}/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ aksi }),
    });
    const data = await r.json();
    if (!r.ok) {
      setMsg("Gagal: " + (data.error ?? "unknown"));
      return;
    }
    setMsg(
      aksi === "void"
        ? `Transaksi #${id} dibatalkan.`
        : `Transaksi #${id} disesuaikan, total baru ${rupiah(data.total)}.`
    );
    load();
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Resolusi Konflik</h1>
      <p className="text-sm text-slate-600 mb-4">
        Transaksi yang gagal disinkron karena stok tidak mencukupi. Pilih{" "}
        <b>Sesuaikan</b> untuk memproses dengan qty mengikuti stok tersedia,
        atau <b>Batalkan</b> untuk membatalkan transaksi.
      </p>
      {msg && (
        <div className="mb-4 bg-blue-50 border border-blue-200 text-blue-800 text-sm rounded p-3">
          {msg}
        </div>
      )}
      {rows.length === 0 && (
        <div className="bg-white rounded shadow p-6 text-slate-500 text-sm">
          Tidak ada transaksi konflik. Semua aman.
        </div>
      )}
      {rows.map((t) => (
        <div key={t.id} className="bg-white rounded shadow p-4 mb-4">
          <div className="flex flex-wrap justify-between items-center mb-2">
            <div className="font-bold">
              Transaksi #{t.id} — {t.kasir}
              <span className="text-xs text-slate-500 ml-2">{fmtWaktu(t.created_at)}</span>
            </div>
            <span className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded-full font-semibold">
              conflict
            </span>
          </div>
          <table className="w-full text-sm mb-3">
            <thead className="bg-slate-100">
              <tr>
                <th className="text-left p-2">Produk</th>
                <th className="text-right p-2">Diminta</th>
                <th className="text-right p-2">Stok tersedia</th>
                <th className="text-right p-2">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {t.items.map((it) => (
                <tr key={it.id} className="border-t">
                  <td className="p-2">{it.produk.nama}</td>
                  <td className="p-2 text-right">{it.qty}</td>
                  <td
                    className={`p-2 text-right font-semibold ${
                      it.produk.stok < it.qty ? "text-red-600" : "text-green-700"
                    }`}
                  >
                    {it.produk.stok}
                  </td>
                  <td className="p-2 text-right">{rupiah(it.subtotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex justify-between items-center">
            <div className="text-sm">
              Total: <b>{rupiah(t.total)}</b> · Bayar: {rupiah(t.bayar)}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => resolve(t.id, "adjust")}
                className="bg-teal-600 text-white text-sm rounded px-3 py-1.5 font-semibold"
              >
                Sesuaikan ke stok
              </button>
              <button
                onClick={() => resolve(t.id, "void")}
                className="border border-red-500 text-red-600 text-sm rounded px-3 py-1.5"
              >
                Batalkan transaksi
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
