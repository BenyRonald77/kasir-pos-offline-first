import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const n = await prisma.produk.count();
  if (n > 0) {
    console.log("seed dilewati (sudah ada data)");
    return;
  }
  const produk = [
    { nama: "Kopi Tubruk", sku: "MNM-001", harga: 8000, stok: 50 },
    { nama: "Es Teh Manis", sku: "MNM-002", harga: 5000, stok: 60 },
    { nama: "Indomie Goreng", sku: "MKN-001", harga: 12000, stok: 40 },
    { nama: "Nasi Goreng", sku: "MKN-002", harga: 15000, stok: 25 },
    { nama: "Roti Bakar Coklat", sku: "MKN-003", harga: 10000, stok: 30 },
    { nama: "Air Mineral 600ml", sku: "MNM-003", harga: 4000, stok: 100 },
    { nama: "Pisang Goreng", sku: "MKN-004", harga: 10000, stok: 4 },
    { nama: "Kentang Goreng", sku: "MKN-005", harga: 13000, stok: 3 },
  ];
  await prisma.produk.createMany({ data: produk });
  console.log("seed selesai: 8 produk");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
