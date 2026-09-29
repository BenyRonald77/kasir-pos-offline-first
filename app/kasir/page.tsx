"use client";
import { useEffect, useState } from "react";
import { rupiah } from "@/lib/format";
import { outbox, type OutboxTx } from "@/lib/idb";

type Produk = { id: number; nama: string; sku: string; harga: number; stok: number };
type CartLine = { produk: Produk; qty: number };

export default function Kasir() {
  const [produks, setProduks] = useState<Produk[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [kasir, setKasir] = useState("");
  const [bayar, setBayar] = useState("");
  const [online, setOnline] = useState(true);
  const [simOffline, setSimOffline] = useState(false);
  const [antre, setAntre] = useState(0);
  const [msg, setMsg] = useState("");
  const [syncing, setSyncing] = useState(false);

  const isOffline = !online || simOffline;

  const loadProduk = () =>
    fetch("/api/produk")
      .then((r) => r.json())
      .then(setProduks)
      .catch(() => {});

  const refreshAntre = () => outbox.count().then(setAntre).catch(() => {});

  useEffect(() => {
    loadProduk();
    refreshAntre();
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  const total = cart.reduce((s, l) => s + l.qty * l.produk.harga, 0);
  const bayarNum = Number(bayar) || 0;
  const kembalian = bayarNum - total;

  function addToCart(p: Produk) {
    setCart((c) => {
      const found = c.find((l) => l.produk.id === p.id);
      if (found) {
        return c.map((l) =>
          l.produk.id === p.id ? { ...l, qty: l.qty + 1 } : l
        );
      }
      return [...c, { produk: p, qty: 1 }];
    });
  }

  function setQty(id: number, qty: number) {
    setCart((c) =>
      qty <= 0
        ? c.filter((l) => l.produk.id !== id)
        : c.map((l) => (l.produk.id === id ? { ...l, qty } : l))
    );
  }

  async function checkout() {
    setMsg("");
    if (cart.length === 0) return setMsg("Keranjang masih kosong.");
    if (!kasir.trim()) return setMsg("Nama kasir wajib diisi.");
    if (bayarNum < total) return setMsg("Jumlah bayar kurang dari total.");

    const payload: OutboxTx = {
      idempotency_key: crypto.randomUUID(),
      items: cart.map((l) => ({
        produk_id: l.produk.id,
        qty: l.qty,
        nama: l.produk.nama,
        harga: l.produk.harga,
      })),
      bayar: bayarNum,
      kasir: kasir.trim(),
      client_created_at: new Date().toISOString(),
    };

    if (isOffline) {
      await outbox.add(payload);
      setCart([]);
      setBayar("");
      refreshAntre();
      setMsg("Tersimpan ke antrean offline. Akan disinkron saat online.");
      return;
    }

    try {
      const r = await fetch("/api/transaksi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idempotency_key: payload.idempotency_key,
          items: payload.items.map((i) => ({ produk_id: i.produk_id, qty: i.qty })),
          bayar: payload.bayar,
          kasir: payload.kasir,
        }),
      });
      const data = await r.json();
      if (!r.ok) {
        setMsg("Gagal: " + (data.error ?? "unknown"));
        return;
      }
      if (data.hasil === "conflict") {
        setMsg("Transaksi tersimpan sebagai KONFLIK (stok kurang). Cek halaman Konflik.");
      } else {
        setMsg(`Berhasil. Total ${rupiah(data.total)}. Kembalian ${rupiah(bayarNum - data.total)}.`);
      }
      setCart([]);
      setBayar("");
      loadProduk();
    } catch {
      // network gagal di tengah jalan → simpan ke outbox
      await outbox.add(payload);
      setCart([]);
      setBayar("");
      refreshAntre();
      setMsg("Koneksi gagal, transaksi disimpan ke antrean offline.");
    }
  }

  async function sinkronkan() {
    setMsg("");
    setSyncing(true);
    try {
      const semua = await outbox.all();
      if (semua.length === 0) {
        setMsg("Tidak ada transaksi dalam antrean.");
        return;
      }
      const r = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transaksi: semua.map((t) => ({
            idempotency_key: t.idempotency_key,
            items: t.items.map((i) => ({ produk_id: i.produk_id, qty: i.qty })),
            bayar: t.bayar,
            kasir: t.kasir,
            client_created_at: t.client_created_at,
          })),
        }),
      });
      const data = await r.json();
      if (!r.ok) {
        setMsg("Sync gagal: " + (data.error ?? "unknown"));
        return;
      }
      let ok = 0,
        dup = 0,
        conf = 0,
        err = 0;
      for (const h of data.hasil as {
        idempotency_key: string;
        hasil: string;
      }[]) {
        if (h.hasil === "synced" || h.hasil === "duplicate") {
          await outbox.remove(h.idempotency_key);
          if (h.hasil === "synced") ok++;
          else dup++;
        } else if (h.hasil === "conflict") {
          conf++;
        } else {
          err++;
        }
      }
      refreshAntre();
      loadProduk();
      setMsg(
        `Sync selesai: ${ok} synced, ${dup} duplikat, ${conf} konflik, ${err} error.`
      );
    } catch {
      setMsg("Sync gagal: tidak ada koneksi.");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <h1 className="text-2xl font-bold">Kasir</h1>
        <span
          className={`text-sm font-semibold px-3 py-1 rounded-full ${
            isOffline ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
          }`}
        >
          {isOffline ? `OFFLINE — ${antre} transaksi antre` : `ONLINE — ${antre} antre`}
        </span>
        <button
          onClick={() => setSimOffline((v) => !v)}
          className={`text-sm px-3 py-1 rounded border ${
            simOffline ? "bg-amber-500 text-white border-amber-500" : "bg-white"
          }`}
        >
          Simulasi offline: {simOffline ? "AKTIF" : "mati"}
        </button>
        <button
          onClick={sinkronkan}
          disabled={syncing || antre === 0}
          className="text-sm px-3 py-1 rounded bg-teal-600 text-white disabled:opacity-50"
        >
          {syncing ? "Menyinkron…" : `Sinkronkan (${antre})`}
        </button>
      </div>

      {msg && (
        <div className="mb-4 bg-blue-50 border border-blue-200 text-blue-800 text-sm rounded p-3">
          {msg}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <h2 className="font-semibold mb-2">Produk</h2>
          <div className="grid grid-cols-2 gap-2">
            {produks.map((p) => (
              <button
                key={p.id}
                onClick={() => addToCart(p)}
                className="bg-white rounded shadow p-3 text-left hover:shadow-md"
              >
                <div className="font-semibold text-sm">{p.nama}</div>
                <div className="text-xs text-slate-500">{p.sku}</div>
                <div className="text-sm font-bold mt-1">{rupiah(p.harga)}</div>
                <div
                  className={`text-xs ${p.stok < 5 ? "text-red-600" : "text-slate-500"}`}
                >
                  Stok: {p.stok}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <h2 className="font-semibold mb-2">Keranjang</h2>
          <div className="bg-white rounded shadow p-4">
            <label className="block text-sm mb-1">Nama kasir</label>
            <input
              value={kasir}
              onChange={(e) => setKasir(e.target.value)}
              className="border rounded w-full px-2 py-1 mb-3 text-sm"
              placeholder="Nama kasir"
            />
            {cart.length === 0 && (
              <div className="text-sm text-slate-500">Keranjang kosong.</div>
            )}
            {cart.map((l) => (
              <div key={l.produk.id} className="flex items-center gap-2 text-sm py-1">
                <div className="flex-1">
                  <div className="font-medium">{l.produk.nama}</div>
                  <div className="text-xs text-slate-500">
                    {rupiah(l.produk.harga)} × {l.qty} = {rupiah(l.qty * l.produk.harga)}
                  </div>
                </div>
                <button
                  onClick={() => setQty(l.produk.id, l.qty - 1)}
                  className="border rounded px-2"
                >
                  −
                </button>
                <span className="w-6 text-center">{l.qty}</span>
                <button
                  onClick={() => setQty(l.produk.id, l.qty + 1)}
                  className="border rounded px-2"
                >
                  +
                </button>
              </div>
            ))}
            <div className="border-t mt-3 pt-3">
              <div className="flex justify-between font-bold">
                <span>Total</span>
                <span>{rupiah(total)}</span>
              </div>
              <label className="block text-sm mt-2 mb-1">Bayar</label>
              <input
                value={bayar}
                onChange={(e) => setBayar(e.target.value.replace(/[^0-9]/g, ""))}
                inputMode="numeric"
                className="border rounded w-full px-2 py-1 text-sm"
                placeholder="Jumlah bayar"
              />
              <div className="flex justify-between text-sm mt-2">
                <span>Kembalian</span>
                <span className={kembalian < 0 ? "text-red-600" : "font-semibold"}>
                  {rupiah(kembalian)}
                </span>
              </div>
              <button
                onClick={checkout}
                className="mt-3 w-full bg-teal-600 text-white rounded py-2 font-semibold hover:bg-teal-700"
              >
                {isOffline ? "Simpan ke Antrean Offline" : "Bayar"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
