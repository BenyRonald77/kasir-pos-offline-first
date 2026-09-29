# PRD — Kasir POS Offline-First

## Ringkasan
Aplikasi kasir Point-of-Sale (POS) yang tetap bisa berjualan saat internet
mati. Transaksi yang dibuat offline disimpan ke antrean IndexedDB (outbox) di
perangkat, lalu disinkronkan ke server dengan aman saat koneksi kembali
menggunakan idempotency key — transaksi yang sama tidak pernah tercatat ganda.
Jika stok tidak mencukupi saat sync, transaksi ditandai sebagai konflik untuk
diselesaikan (sesuaikan qty / batalkan).

## Stack
Next.js 14 + TypeScript + Prisma 5.22 + SQLite + Tailwind CSS.
PWA: manifest.json + service worker (cache app shell) + IndexedDB outbox
di sisi klien.

## Model Data
- **Produk**: id, nama, sku (unik), harga (Int, rupiah), stok (Int)
- **Transaksi**: id, idempotency_key (unik), kasir (String), total (Int),
  bayar (Int), kembalian (Int), status (`synced` | `conflict` | `void`),
  created_at (TEXT ISO), synced_at (TEXT ISO, nullable)
- **TransaksiItem**: id, transaksi_id (FK), produk_id (FK), qty (Int),
  harga_satuan (Int), subtotal (Int)

## Fungsionalitas

### F0 — Setup
Schema Prisma, seed 8 produk dengan stok, layout, dashboard (ringkasan
omzet hari ini, stok menipis, tautan halaman).

### F1 — Produk CRUD + Kasir UI
- CRUD produk (nama, sku unik, harga, stok). SKU duplikat → 409.
- Halaman kasir: daftar produk, keranjang (tambah/kurang/hapus),
  total otomatis, input bayar → kembalian otomatis.
- Checkout online: langsung POST transaksi ke server.
- Checkout offline: simpan ke outbox IndexedDB.

### F2 — PWA + Outbox IndexedDB
- `public/manifest.json` (name, icons, display standalone).
- `public/sw.js`: cache app shell (`/`, `/kasir`, `/produk`) saat install;
  strategi cache-first untuk GET navigasi; fallback offline ke `/`.
- Registrasi service worker via client component kecil di `app/layout.tsx`.
- `lib/idb.ts`: helper IndexedDB (`pos-outbox` DB, store `outbox`,
  keyPath `idempotency_key`).
- Deteksi `navigator.onLine` + event `online`/`offline`; indikator status
  "ONLINE" / "OFFLINE — N transaksi antre".
- idempotency_key transaksi offline = `crypto.randomUUID()`.

### F3 — Endpoint Sync (idempoten + deteksi konflik)
`POST /api/sync` menerima:
```json
{ "transaksi": [
  { "idempotency_key": "...", "items": [{"produk_id":1,"qty":2}],
    "bayar": 50000, "kasir": "Andi", "client_created_at": "2026-09-30T..." }
] }
```
Per transaksi:
- Jika `idempotency_key` sudah ada di DB → kembalikan record lama
  (hasil `duplicate`, TIDAK buat duplikat).
- Jika semua stok cukup → kurangi stok, buat transaksi + items,
  status `synced` (hasil `synced`).
- Jika ada stok kurang → buat transaksi + items TANPA mengurangi stok,
  status `conflict`, catat detail konflik per item
  (hasil `conflict`).
- total = sum(qty × harga_satuan saat sync), kembalian = bayar − total
  (bayar < total → 400).
- Response: ringkasan per idempotency_key: `synced | duplicate | conflict`
  + detail.
UI kasir: tombol "Sinkronkan" mengirim seluruh outbox, menghapus dari
IndexedDB yang hasilnya `synced`/`duplicate`, mempertahankan yang `conflict`.

### F4 — Resolusi Konflik
Halaman `/konflik`: daftar transaksi status `conflict` dengan detail
item (qty diminta vs stok tersedia).
`POST /api/transaksi/[id]/resolve` body `{ "aksi": "adjust" | "void" }`:
- `adjust`: sesuaikan tiap item ke stok tersedia (item dengan stok 0
  dihapus); kurangi stok; status → `synced`. Jika semua item stok 0
  → 409 (tidak ada yang bisa diproses).
- `void`: status → `void` (stok tidak berubah).
- Transaksi non-conflict → 409.

### F5 — Laporan
`GET /api/laporan?from=YYYY-MM-DD&to=YYYY-MM-DD` (default hari ini):
- total omzet (transaksi `synced` saja), jumlah transaksi,
  produk terlaris (top 5 by qty), stok menipis (stok < 5).
Halaman `/laporan`: ringkasan + tabel produk terlaris + stok menipis.
Bonus: tombol "Simulasi offline" di halaman kasir (toggle paksa mode
offline untuk demo; saat aktif, checkout selalu masuk outbox).

## API Ringkas
| Method | Endpoint | Keterangan |
|---|---|---|
| GET/POST | /api/produk | list + tambah produk |
| GET/PUT/DELETE | /api/produk/[id] | detail/ubah/hapus |
| GET | /api/transaksi | riwayat transaksi (latest) |
| POST | /api/transaksi | checkout online langsung |
| POST | /api/sync | sync outbox (idempoten) |
| POST | /api/transaksi/[id]/resolve | resolve conflict |
| GET | /api/laporan | laporan omzet |
