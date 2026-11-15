// scripts/migrate-kelas-guru-ids.mjs
// =============================================================
// SKRIP MIGRASI: ISI ID GURU PADA DOKUMEN `kelas`
// -------------------------------------------------------------
// Sebelumnya penugasan guru di dokumen `kelas` hanya menyimpan NAMA:
//   guruKelas:   ["Ustadzah Ani"]
//   asistenGuru: ["Ustadzah Budi"]
//
// Sekarang ditambah field ID dokumen `guru` sebagai sumber kebenaran:
//   guruKelasIds:   ["<id dokumen guru>"]
//   asistenGuruIds: ["<id dokumen guru>"]
//
// Skrip ini mengisi field ID untuk kelas lama, dengan mencocokkan nama
// (dinormalisasi: huruf kecil, tanpa tanda baca). Nama lama TIDAK dihapus.
//
// CARA JALANKAN (dari root project, di terminal VS Code):
//   node scripts/migrate-kelas-guru-ids.mjs          (dry-run, tidak menulis)
//   node scripts/migrate-kelas-guru-ids.mjs --apply  (tulis perubahan)
// =============================================================

import { readFileSync } from "node:fs";
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  getDocs,
  doc,
  writeBatch,
} from "firebase/firestore";

// ---------- 1. Muat .env.local manual (tanpa dotenv) ----------
function loadEnvFile(filePath) {
  try {
    const content = readFileSync(filePath, "utf8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIndex = trimmed.indexOf("=");
      if (eqIndex === -1) continue;
      const key = trimmed.slice(0, eqIndex).trim();
      let value = trimmed.slice(eqIndex + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = value;
    }
    console.log(`✅ Env dimuat dari: ${filePath}`);
  } catch {
    console.warn(`⚠️  File ${filePath} tidak ditemukan, lanjut pakai env yang ada.`);
  }
}

loadEnvFile(".env.local");
loadEnvFile(".env");

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

for (const [key, value] of Object.entries(firebaseConfig)) {
  if (!value) {
    console.error(`❌ Env variable tidak ada: ${key}`);
    console.error("   Pastikan .env.local di root project berisi konfigurasi Firebase.");
    process.exit(1);
  }
}

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ---------- 2. Normalisasi nama (sama dengan src/lib/kelasGuru.ts) ----------
const normalizeNama = (nama) =>
  (nama || "")
    .replace(/\([^)]*\)/g, " ")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

const toNamaArray = (value) => {
  if (typeof value === "string") {
    return value.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
  }
  if (Array.isArray(value)) {
    return value
      .map((v) => (typeof v === "string" ? v : v?.nama || ""))
      .filter(Boolean);
  }
  return [];
};

// ---------- 3. Fungsi utama ----------
async function main() {
  const apply = process.argv.includes("--apply");
  console.log(`🚀 Migrasi kelas -> guru IDs di project: ${firebaseConfig.projectId}`);
  console.log(`   Mode: ${apply ? "APPLY (menulis perubahan)" : "DRY-RUN (tidak menulis)"}\n`);

  const guruSnap = await getDocs(collection(db, "guru"));
  console.log(`📥 Total dokumen guru: ${guruSnap.size}`);

  // nama ternormalisasi -> daftar { id, cabang } (bisa >1 jika nama sama)
  const byNama = new Map();
  guruSnap.forEach((d) => {
    const data = d.data();
    const key = normalizeNama(data.nama);
    if (!key) return;
    if (!byNama.has(key)) byNama.set(key, []);
    byNama.get(key).push({ id: d.id, cabang: data.cabang || "" });
  });

  const kelasSnap = await getDocs(collection(db, "kelas"));
  console.log(`📥 Total dokumen kelas: ${kelasSnap.size}\n`);

  const updates = [];
  let unresolved = 0;

  kelasSnap.forEach((d) => {
    const data = d.data();
    const cabang = data.cabang || "";

    const resolve = (nama) => {
      const candidates = byNama.get(normalizeNama(nama)) || [];
      // Utamakan guru dari cabang yang sama
      const sameCabang = candidates.filter((g) => g.cabang === cabang);
      const picked = sameCabang[0] || candidates[0];
      return picked?.id || null;
    };

    const guruIds = toNamaArray(data.guruKelas)
      .map(resolve)
      .filter(Boolean);
    const asistenIds = toNamaArray(data.asistenGuru)
      .map(resolve)
      .filter(Boolean);

    unresolved +=
      toNamaArray(data.guruKelas).length - guruIds.length +
      toNamaArray(data.asistenGuru).length - asistenIds.length;

    const sudahSama =
      JSON.stringify(data.guruKelasIds || []) === JSON.stringify(guruIds) &&
      JSON.stringify(data.asistenGuruIds || []) === JSON.stringify(asistenIds);

    if (!sudahSama && (guruIds.length > 0 || asistenIds.length > 0)) {
      updates.push({ id: d.id, namaKelas: data.namaKelas, guruIds, asistenIds });
    }
  });

  if (updates.length === 0) {
    console.log("✅ Tidak ada kelas yang perlu dimigrasi.");
    if (unresolved > 0) console.log(`⚠️  ${unresolved} nama guru tidak ditemukan di koleksi guru.`);
    return;
  }

  console.log(`📊 ${updates.length} kelas akan di-update:`);
  updates.forEach((u) => {
    console.log(`   - ${u.namaKelas} (${u.id}) | guruKelasIds: ${u.guruIds.length} | asistenGuruIds: ${u.asistenIds.length}`);
  });
  if (unresolved > 0) {
    console.log(`\n⚠️  ${unresolved} nama guru tidak ditemukan — periksa Data Guru (nama harus sama).`);
  }

  if (!apply) {
    console.log("\nℹ️  Dry-run selesai. Jalankan dengan --apply untuk menulis perubahan.");
    return;
  }

  let batch = writeBatch(db);
  let ops = 0;
  for (const u of updates) {
    batch.update(doc(db, "kelas", u.id), {
      guruKelasIds: u.guruIds,
      asistenGuruIds: u.asistenIds,
    });
    ops++;
    if (ops === 500) {
      await batch.commit();
      batch = writeBatch(db);
      ops = 0;
    }
  }
  if (ops > 0) await batch.commit();

  console.log(`\n🎉 Selesai! ${updates.length} dokumen kelas berhasil dimigrasi.`);
}

main().catch((err) => {
  console.error("❌ Migrasi gagal:", err);
  process.exit(1);
});
