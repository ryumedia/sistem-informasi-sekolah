"use client";

import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { collection, getDocs, query, where } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

/**
 * Normalisasi nama lokasi/cabang agar bisa dicocokkan walau penulisannya sedikit berbeda.
 * Contoh: "Cabang Bintaro", "bintaro", " BINTARO " -> "bintaro"
 */
export const normalizeLokasi = (value?: string | null): string =>
  (value || "")
    .toLowerCase()
    .replace(/\b(cabang|lokasi)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Cocokkan cabang user dengan salah satu nama di daftar lokasi. */
export const matchLokasi = (cabang: string, lokasiList: string[]): string => {
  const target = normalizeLokasi(cabang);
  if (!target) return "";
  // 1. Sama persis setelah normalisasi
  const exact = lokasiList.find((l) => normalizeLokasi(l) === target);
  if (exact) return exact;
  // 2. Salah satu mengandung yang lain (mis. "Bintaro" vs "Bintaro Sektor 9")
  const partial = lokasiList.find((l) => {
    const n = normalizeLokasi(l);
    return !!n && (n.includes(target) || target.includes(n));
  });
  return partial || "";
};

/**
 * Untuk role "Kepala Sekolah": mengunci filter lokasi sesuai cabangnya.
 *
 * @param lokasiList daftar nama lokasi yang tersedia di dropdown
 * @returns
 *  - ready:        data user sudah selesai dicek
 *  - isLocked:     true jika user adalah Kepala Sekolah dengan cabang
 *  - lockedLokasi: nama lokasi yang cocok dengan cabangnya (fallback: nama cabang apa adanya)
 */
export function useLokasiKepalaSekolah(lokasiList: string[]) {
  const [ready, setReady] = useState(false);
  const [role, setRole] = useState("");
  const [cabang, setCabang] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user?.email) {
        setRole("");
        setCabang("");
        setReady(true);
        return;
      }
      try {
        const snap = await getDocs(query(collection(db, "guru"), where("email", "==", user.email)));
        const data = snap.empty ? null : snap.docs[0].data();
        setRole((data?.role as string) || "");
        setCabang((data?.cabang as string) || "");
      } catch (error) {
        console.error("Error fetching user role:", error);
      } finally {
        setReady(true);
      }
    });
    return () => unsubscribe();
  }, []);

  const isLocked = role === "Kepala Sekolah" && !!cabang;

  const lockedLokasi = useMemo(() => {
    if (!isLocked) return "";
    // Jika tidak ada nama lokasi yang cocok, pakai nama cabang apa adanya
    // (hasilnya kosong, tapi data cabang lain tetap tidak terlihat).
    return matchLokasi(cabang, lokasiList) || cabang;
  }, [isLocked, cabang, lokasiList]);

  return { ready, isLocked, lockedLokasi, role, cabang };
}
