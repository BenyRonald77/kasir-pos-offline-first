"use client";
import { useEffect, useState } from "react";
import { rupiah } from "@/lib/format";

type Laporan = {
  total_omzet: number;
  jumlah_transaksi: number;
  stok_menipis: { id: number; nama: string; stok: number }[];
};

export default function Dashboard() {
  const [lap, setLap] = useState<Laporan | null>(null);

  useEffect(() => {
    fetch("/api/laporan")
      .then((r) => r.json())
      .then(setLap)
      .catch(() => {});
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Dashboard</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <a href="/kasir" className="bg-teal-600 text-white rounded p-4 hover:bg-teal-700">
          <div className="font-bold text-lg">Kasir</div>
          <div className="text-sm">Jualan &amp; checkout</div>
        </a>
        <a href="/produk" className="bg-white rounded p-4 shadow hover:shadow-md">
          <div className="font-bold text-lg">Produk</div>
          <div className="text-sm text-slate-500">Kelola produk &amp; stok</div>
        </a>
        <a href="/konflik" className="bg-white rounded p-4 shadow hover:shadow-md">
          <div className="font-bold text-lg">Konflik</div>
          <div className="text-sm text-slate-500">Resolusi sync stok</div>
        </a>
        <a href="/laporan" className="bg-white rounded p-4 shadow hover:shadow-md">
          <div className="font-bold text-lg">Laporan</div>
          <div className="text-sm text-slate-500">Omzet &amp; stok menipis</div>
        </a>
      </div>

      <h2 className="text-lg font-semibold mb-2">Ringkasan Hari Ini</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="bg-white rounded p-4 shadow">
          <div className="text-sm text-slate-500">Omzet</div>
          <div className="text-xl font-bold">{lap ? rupiah(lap.total_omzet) : "…"}</div>
        </div>
        <div className="bg-white rounded p-4 shadow">
          <div className="text-sm text-slate-500">Transaksi</div>
          <div className="text-xl font-bold">
            {lap ? lap.jumlah_transaksi : "…"}
          </div>
        </div>
        <div className="bg-white rounded p-4 shadow">
          <div className="text-sm text-slate-500">Stok menipis (&lt; 5)</div>
          <div className="text-xl font-bold">
            {lap ? lap.stok_menipis.length : "…"}
          </div>
          {lap && lap.stok_menipis.length > 0 && (
            <ul className="text-sm mt-1 text-red-600">
              {lap.stok_menipis.map((p) => (
                <li key={p.id}>
                  {p.nama}: {p.stok}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
