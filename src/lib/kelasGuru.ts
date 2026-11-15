/**
 * Helper penugasan guru pada data `kelas`.
 *
 * Skema yang dipakai:
 *   guruKelas:   string[]  -> nama guru (data lama, tetap dipertahankan demi kompatibilitas)
 *   guruKelasIds: string[] -> ID dokumen `guru`
 *   asistenGuru:  string[] -> nama asisten guru
 *   asistenGuruIds: string[] -> ID dokumen `guru` (role "Asisten Guru")
 *
 * ID adalah sumber kebenaran: jika nama guru diubah di Data Guru, data kelas
 * tidak perlu ikut diperbarui. Nama hanya dipakai sebagai fallback untuk
 * kelas lama yang belum memiliki field ID.
 *
 * Catatan: NAMA guru sengaja tetap disimpan. Beberapa query Firestore memakai
 * `array-contains` pada nama (mis. daftar kelas yang diampu guru), dan aturan
 * Firestore tidak boleh memuat resource lain — jadi dokumen guru tidak bisa
 * "dibaca" saat mengevaluasi rules. ID tetap dipakai untuk joins & tampilan.
 */

import { collection, getDocs, query, where, type Firestore, type QueryConstraint } from "firebase/firestore";

export interface GuruRef {
  id?: string;
  nama?: string;
}

export interface KelasGuruFields {
  guruKelas?: unknown;
  guruKelasIds?: unknown;
  asistenGuru?: unknown;
  asistenGuruIds?: unknown;
  waliKelas?: unknown;
}

export type GuruRoleKind = "wali" | "asisten";

const idsKey = (kind: GuruRoleKind) => (kind === "wali" ? "guruKelasIds" : "asistenGuruIds");

const asStringArray = (value: unknown): string[] => {
  if (typeof value === "string") {
    return value
      .split(/[,;]/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (Array.isArray(value)) {
    return value
      .map((v) => (typeof v === "string" ? v : (v as GuruRef | null)?.id || ""))
      .filter(Boolean);
  }
  return [];
};

const asNamaArray = (value: unknown): string[] => {
  if (typeof value === "string") {
    return value
      .split(/[,;]/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (Array.isArray(value)) {
    return value
      .map((v) => (typeof v === "string" ? v : (v as GuruRef | null)?.nama || ""))
      .filter(Boolean);
  }
  if (value && typeof value === "object") {
    return [((value as GuruRef).nama || "").trim()].filter(Boolean);
  }
  return [];
};

/** ID guru yang ditugaskan pada kelas (wali kelas atau asisten guru). */
export const getGuruIds = (kelas: KelasGuruFields | undefined, kind: GuruRoleKind): string[] =>
  asStringArray(kelas?.[idsKey(kind)]);

/**
 * Nama guru yang ditugaskan pada kelas.
 * Wali kelas: `guruKelas` didahulukan, lalu field lama `waliKelas`.
 */
export const getGuruNames = (kelas: KelasGuruFields | undefined, kind: GuruRoleKind): string[] => {
  if (kind === "wali") {
    const utama = asNamaArray(kelas?.guruKelas);
    return utama.length > 0 ? utama : asNamaArray(kelas?.waliKelas);
  }
  return asNamaArray(kelas?.asistenGuru);
};

/** True jika guru (berdasarkan ID) ditugaskan di kelas pada peran tertentu. */
export const isGuruAssigned = (
  kelas: KelasGuruFields | undefined,
  kind: GuruRoleKind,
  guru: GuruRef | undefined | null
): boolean => {
  if (!guru) return false;
  const ids = getGuruIds(kelas, kind);
  if (guru.id && ids.length > 0 && ids.includes(guru.id)) return true;
  return !!guru.nama && getGuruNames(kelas, kind).includes(guru.nama);
};

/**
 * Ambil semua dokumen `kelas` milik seorang guru pada satu cabang.
 *
 * Urutan pencarian:
 *   1. `guruKelasIds` / `asistenGuruIds`  -> array-contains ID guru (sumber kebenaran)
 *   2. `guruKelas` / `asistenGuru`        -> array-contains nama guru (fallback data lama)
 *
 * Hasil digabung & dideduplikasi berdasarkan ID dokumen kelas.
 * Catatan: query berbasis nama tetap dibutuhkan selama data kelas lama
 * belum memiliki field ID; setelah semua kelas dimigrasi, query nama bisa dihapus.
 */
export async function fetchKelasGuru(
  db: Firestore,
  guru: { id?: string; nama?: string; cabang?: string }
): Promise<{ id: string; data: () => Record<string, unknown> }[]> {
  if (!guru?.cabang) return [];

  const kelasRef = collection(db, "kelas");
  const filters: QueryConstraint[] = [where("cabang", "==", guru.cabang)];

  // Setiap constraint array-contains harus di query terpisah (tidak bisa digabung)
  const fieldConstraints: QueryConstraint[] = [];
  if (guru.id) {
    fieldConstraints.push(where("guruKelasIds", "array-contains", guru.id));
    fieldConstraints.push(where("asistenGuruIds", "array-contains", guru.id));
  }
  if (guru.nama) {
    fieldConstraints.push(where("guruKelas", "array-contains", guru.nama));
    fieldConstraints.push(where("asistenGuru", "array-contains", guru.nama));
  }

  const snaps = await Promise.all(
    fieldConstraints.map((f) => getDocs(query(kelasRef, ...filters, f)))
  );

  const merged: { id: string; data: () => Record<string, unknown> }[] = [];
  snaps.forEach((snap) => {
    snap.docs.forEach((d) => {
      if (!merged.some((existing) => existing.id === d.id)) merged.push(d);
    });
  });
  return merged;
}
