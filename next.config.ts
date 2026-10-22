import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  // firebase-admin (dipakai route API notifikasi) harus dijalankan sebagai paket
  // eksternal Node biasa. Tanpa ini Turbopack mencoba membuat junction ke
  // node_modules/firebase-admin dan gagal dengan "failed to create junction point".
  serverExternalPackages: ["firebase-admin"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "firebasestorage.googleapis.com",
      },
    ],
  },
};

export default nextConfig;
