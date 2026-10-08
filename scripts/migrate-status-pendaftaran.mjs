// scripts/migrate-status-pendaftaran.mjs
// =============================================================
// SKRIP MIGRASI STATUS PENDAFTARAN SISWA BARU
// -------------------------------------------------------------
// Mapping status lama -> baru:
//   "Sudah Bayar"      -> "Bayar Pendaftaran"
//   "Sudah Lunas"      -> "Lunas"
//   "Ditolak"          -> "Batal"
//   ("Sudah Assesment" / "Sudah Konsultasi" diabaikan — tidak ada data)
//
// CARA JALANKAN (dari root project, di terminal VS Code):
//   node scripts/migrate-status-pendaftaran.mjs
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
      // Buang tanda kutip pembungkus kalau ada
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
loadEnvFile(".env"); // fallback

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Jangan lanjut kalau env tidak lengkap
for (const [key, value] of Object.entries(firebaseConfig)) {
  if (!value) {
    console.error(`❌ Env variable tidak ada: ${key}`);
    console.error("   Pastikan .env.local di root project berisi konfigurasi Firebase.");
    process.exit(1);
  }
}

// ---------- 2. Init Firestore (client SDK) ----------
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ---------- 3. Mapping status lama -> baru ----------
const MAPPING = {
  "Sudah Bayar": "Bayar Pendaftaran",
  "Sudah Lunas": "Lunas",
  "Ditolak": "Batal",
};

// ---------- 4. Fungsi utama migrasi ----------
async function migrate() {
  console.log(`🚀 Memulai migrasi di project: ${firebaseConfig.projectId}`);
  console.log(`   Mapping: ${JSON.stringify(MAPPING, null, 2)}`);
  console.log("");

  // Ambil semua dokumen di koleksi
  const snapshot = await getDocs(collection(db, "siswa_baru_registrations"));
  console.log(`📥 Total dokumen di koleksi: ${snapshot.size}`);

  // Kumpulkan yang perlu di-update
  const updates = [];
  snapshot.forEach((d) => {
    const status = d.data().statusPendaftaran;
    if (status && MAPPING[status]) {
      updates.push({ id: d.id, from: status, to: MAPPING[status] });
    }
  });

  if (updates.length === 0) {
    console.log("✅ Tidak ada dokumen yang perlu dimigrasi. Semua status sudah baru.");
    return;
  }

  console.log(`\n📊 Ditemukan ${updates.length} dokumen yang perlu di-update:`);
  updates.forEach((u) => {
    console.log(`   - ${u.id}: "${u.from}" → "${u.to}"`);
  });

  // ---------- 5. Konfirmasi dulu sebelum menulis ----------
  const readline = await import("node:readline/promises");
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question("\nLanjutkan migrasi? (y/n): ");
  rl.close();

  if (answer.trim().toLowerCase() !== "y") {
    console.log("❌ Migrasi dibatalkan. Tidak ada perubahan yang ditulis.");
    return;
  }

  // ---------- 6. Tulis pakai batch (max 500 operasi per batch) ----------
  let batch = writeBatch(db);
  let opsInBatch = 0;
  let totalWritten = 0;

  for (const u of updates) {
    batch.update(doc(db, "siswa_baru_registrations", u.id), {
      statusPendaftaran: u.to,
    });
    opsInBatch++;
    totalWritten++;

    // Firestore membatasi 500 operasi per batch — commit lalu buat batch baru
    if (opsInBatch === 500) {
      await batch.commit();
      console.log(`   ✅ ${totalWritten} dokumen ter-update...`);
      batch = writeBatch(db);
      opsInBatch = 0;
    }
  }

  // Commit sisa operasi yang belum masuk batch penuh
  if (opsInBatch > 0) {
    await batch.commit();
  }

  console.log(`\n🎉 Selesai! Total ${totalWritten} dokumen berhasil dimigrasi.`);
}

// ---------- 7. Jalankan ----------
migrate().catch((err) => {
  console.error("❌ Migrasi gagal:", err);
  process.exit(1);
});
