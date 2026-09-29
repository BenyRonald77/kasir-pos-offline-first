# Kasir POS Offline-First

Aplikasi kasir yang tetap bisa berjualan saat internet mati. Transaksi offline
disimpan ke antrean IndexedDB (outbox) di perangkat, lalu disinkronkan ke
server dengan idempotency key — transaksi yang sama tidak pernah tercatat
ganda. Jika stok tidak mencukupi saat sync, transaksi ditandai sebagai konflik
dan bisa diselesaikan dari halaman Konflik.

## Cara Menjalankan

```
npm install
cp .env.example .env
npx prisma generate
npx prisma db push
npm run seed
npm run dev
```

## Halaman

- `/` — Dashboard: ringkasan omzet hari ini, jumlah transaksi, stok menipis.
- `/kasir` — Kasir: daftar produk, keranjang, total, bayar → kembalian.
  Indikator ONLINE/OFFLINE, tombol "Sinkronkan" untuk mengirim antrean,
  tombol "Simulasi offline" untuk demo mode offline.
- `/produk` — CRUD produk (nama, SKU unik, harga, stok).
- `/konflik` — Daftar transaksi status conflict; aksi "Sesuaikan ke stok"
  atau "Batalkan transaksi".
- `/laporan` — Omzet, jumlah transaksi, produk terlaris, stok menipis
  (filter rentang tanggal).

## API

| Method | Endpoint | Keterangan |
|---|---|---|
| GET/POST | /api/produk | list + tambah produk |
| GET/PUT/DELETE | /api/produk/[id] | detail/ubah/hapus |
| GET | /api/transaksi | riwayat transaksi |
| POST | /api/transaksi | checkout online langsung |
| POST | /api/sync | sync outbox, idempoten per idempotency_key |
| POST | /api/transaksi/[id]/resolve | resolve conflict (`adjust`/`void`) |
| GET | /api/laporan?from&to | omzet, terlaris, stok menipis |

## Aturan bisnis penting

- `POST /api/sync` idempoten: idempotency_key yang sudah ada mengembalikan
  record lama tanpa duplikat.
- Stok dikurangi hanya jika semua item cukup; jika tidak, transaksi dibuat
  dengan status `conflict` tanpa mengurangi stok.
- `resolve` dengan `adjust` menyesuaikan qty ke stok tersedia lalu mengurangi
  stok; `void` membatalkan tanpa mengubah stok.
