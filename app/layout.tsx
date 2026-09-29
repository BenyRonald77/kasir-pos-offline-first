import type { Metadata } from "next";
import "./globals.css";
import SWRegister from "./sw-register";

export const metadata: Metadata = {
  title: "Kasir POS Offline-First",
  description: "Aplikasi kasir yang tetap bisa jualan saat offline",
  manifest: "/manifest.json",
};

function Nav() {
  const links = [
    ["Kasir", "/kasir"],
    ["Produk", "/produk"],
    ["Konflik", "/konflik"],
    ["Laporan", "/laporan"],
  ];
  return (
    <nav className="bg-teal-700 text-white">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-4">
        <a href="/" className="font-bold text-lg mr-4">
          Kasir POS
        </a>
        {links.map(([label, href]) => (
          <a key={href} href={href} className="text-sm hover:underline">
            {label}
          </a>
        ))}
      </div>
    </nav>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className="min-h-screen text-slate-900">
        <SWRegister />
        <Nav />
        <main className="max-w-5xl mx-auto px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
