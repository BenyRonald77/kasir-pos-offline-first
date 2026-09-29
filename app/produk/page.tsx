"use client";
import { useEffect, useState } from "react";
import { rupiah } from "@/lib/format";

type Produk = { id: number; nama: string; sku: string; harga: number; stok: number };

const empty = { nama: "", sku: "", harga: "", stok: "" };

export default function ProdukPage() {
  const [rows, setRows] = useState<Produk[]>([]);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState<number | null>(null);
  const [msg, setMsg] = useState("");

  const load = () =>
    fetch("/api/produk").then((r) => r.json()).then(setRows).catch(() => {});
  useEffect(() => {
    load();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    const payload = {
      nama: form.nama,
      sku: form.sku,
      harga: Number(form.harga),
      stok: Number(form.stok || 0),
    };
    const url = editId ? `/api/produk/${editId}` : "/api/produk";
    const r = await fetch(url, {
      method: editId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await r.json();
    if (!r.ok) {
      setMsg("Gagal: " + (data.error ?? "unknown"));
      return;
    }
    setForm(empty);
    setEditId(null);
    setMsg(editId ? "Produk diperbarui." : "Produk ditambahkan.");
    load();
  }

  function startEdit(p: Produk) {
    setEditId(p.id);
    setForm({
      nama: p.nama,
      sku: p.sku,
      harga: String(p.harga),
      stok: String(p.stok),
    });
  }

  async function hapus(id: number) {
    if (!confirm("Hapus produk ini?")) return;
    const r = await fetch(`/api/produk/${id}`, { method: "DELETE" });
    if (!r.ok) {
      const data = await r.json();
      setMsg("Gagal: " + (data.error ?? "unknown"));
      return;
    }
    setMsg("Produk dihapus.");
    load();
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Produk</h1>
      {msg && (
        <div className="mb-4 bg-blue-50 border border-blue-200 text-blue-800 text-sm rounded p-3">
          {msg}
        </div>
      )}

      <form onSubmit={submit} className="bg-white rounded shadow p-4 mb-6">
        <h2 className="font-semibold mb-3">{editId ? "Ubah Produk" : "Tambah Produk"}</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="text-sm">Nama</label>
            <input
              value={form.nama}
              onChange={(e) => setForm({ ...form, nama: e.target.value })}
              className="border rounded w-full px-2 py-1 text-sm"
              required
            />
          </div>
          <div>
            <label className="text-sm">SKU</label>
            <input
              value={form.sku}
              onChange={(e) => setForm({ ...form, sku: e.target.value })}
              className="border rounded w-full px-2 py-1 text-sm"
              required
            />
          </div>
          <div>
            <label className="text-sm">Harga (Rp)</label>
            <input
              value={form.harga}
              onChange={(e) =>
                setForm({ ...form, harga: e.target.value.replace(/[^0-9]/g, "") })
              }
              inputMode="numeric"
              className="border rounded w-full px-2 py-1 text-sm"
              required
            />
          </div>
          <div>
            <label className="text-sm">Stok</label>
            <input
              value={form.stok}
              onChange={(e) =>
                setForm({ ...form, stok: e.target.value.replace(/[^0-9]/g, "") })
              }
              inputMode="numeric"
              className="border rounded w-full px-2 py-1 text-sm"
            />
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <button className="bg-teal-600 text-white rounded px-4 py-1.5 text-sm font-semibold">
            {editId ? "Simpan" : "Tambah"}
          </button>
          {editId && (
            <button
              type="button"
              onClick={() => {
                setEditId(null);
                setForm(empty);
              }}
              className="border rounded px-4 py-1.5 text-sm"
            >
              Batal
            </button>
          )}
        </div>
      </form>

      <div className="bg-white rounded shadow overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-100">
            <tr>
              <th className="text-left p-2">Nama</th>
              <th className="text-left p-2">SKU</th>
              <th className="text-right p-2">Harga</th>
              <th className="text-right p-2">Stok</th>
              <th className="p-2">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="p-2">{p.nama}</td>
                <td className="p-2 text-slate-500">{p.sku}</td>
                <td className="p-2 text-right">{rupiah(p.harga)}</td>
                <td className={`p-2 text-right ${p.stok < 5 ? "text-red-600 font-bold" : ""}`}>
                  {p.stok}
                </td>
                <td className="p-2 text-center">
                  <button onClick={() => startEdit(p)} className="text-teal-700 mr-3 hover:underline">
                    Ubah
                  </button>
                  <button onClick={() => hapus(p.id)} className="text-red-600 hover:underline">
                    Hapus
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
