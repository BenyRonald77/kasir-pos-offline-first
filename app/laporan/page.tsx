"use client";
import { useEffect, useState } from "react";
import { rupiah, today } from "@/lib/format";

type Laporan = {
  from: string;
  to: string;
  total_omzet: number;
  jumlah_transaksi: number;
  produk_terlaris: { produk_id: number; nama: string; qty: number; omzet: number }[];
  stok_menipis: { id: number; nama: string; sku: string; stok: number }[];
};

export default function LaporanPage() {
  const [from, setFrom] = useState(today());
  const [to, setTo] = useState(today());
  const [lap, setLap] = useState<Laporan | null>(null);

  const load = () => {
    fetch(`/api/laporan?from=${from}&to=${to}`)
      .then((r) => r.json())
      .then(setLap)
      .catch(() => {});
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Laporan</h1>
      <div className="bg-white rounded shadow p-4 mb-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="text-sm block">Dari</label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="border rounded px-2 py-1 text-sm"
          />
        </div>
        <div>
          <label className="text-sm block">Sampai</label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="border rounded px-2 py-1 text-sm"
          />
        </div>
        <button
          onClick={load}
          className="bg-teal-600 text-white rounded px-4 py-1.5 text-sm font-semibold"
        >
          Tampilkan
        </button>
      </div>

      {lap && (
        <>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="bg-white rounded shadow p-4">
              <div className="text-sm text-slate-500">Total omzet</div>
              <div className="text-2xl font-bold">{rupiah(lap.total_omzet)}</div>
            </div>
            <div className="bg-white rounded shadow p-4">
              <div className="text-sm text-slate-500">Jumlah transaksi</div>
              <div className="text-2xl font-bold">{lap.jumlah_transaksi}</div>
            </div>
          </div>

          <h2 className="font-semibold mb-2">Produk terlaris</h2>
          <div className="bg-white rounded shadow overflow-x-auto mb-4">
            <table className="w-full text-sm">
              <thead className="bg-slate-100">
                <tr>
                  <th className="text-left p-2">Produk</th>
                  <th className="text-right p-2">Qty terjual</th>
                  <th className="text-right p-2">Omzet</th>
                </tr>
              </thead>
              <tbody>
                {lap.produk_terlaris.map((p) => (
                  <tr key={p.produk_id} className="border-t">
                    <td className="p-2">{p.nama}</td>
                    <td className="p-2 text-right">{p.qty}</td>
                    <td className="p-2 text-right">{rupiah(p.omzet)}</td>
                  </tr>
                ))}
                {lap.produk_terlaris.length === 0 && (
                  <tr>
                    <td colSpan={3} className="p-2 text-center text-slate-500">
                      Belum ada penjualan.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <h2 className="font-semibold mb-2">Stok menipis (&lt; 5)</h2>
          <div className="bg-white rounded shadow overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-100">
                <tr>
                  <th className="text-left p-2">Produk</th>
                  <th className="text-left p-2">SKU</th>
                  <th className="text-right p-2">Stok</th>
                </tr>
              </thead>
              <tbody>
                {lap.stok_menipis.map((p) => (
                  <tr key={p.id} className="border-t">
                    <td className="p-2">{p.nama}</td>
                    <td className="p-2 text-slate-500">{p.sku}</td>
                    <td className="p-2 text-right text-red-600 font-bold">{p.stok}</td>
                  </tr>
                ))}
                {lap.stok_menipis.length === 0 && (
                  <tr>
                    <td colSpan={3} className="p-2 text-center text-slate-500">
                      Semua stok aman.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
