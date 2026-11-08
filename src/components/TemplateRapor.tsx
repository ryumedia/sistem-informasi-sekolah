import React, { useState, useEffect, useMemo, type CSSProperties } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, documentId, doc, getDoc, orderBy } from 'firebase/firestore';

interface Siswa {
  id: string;
  nama: string;
  kelas: string;
  nis: string;
  nisn: string;
  foto?: string;
  cabang?: string;
  // Jenjang usia siswa, bisa berupa ID dokumen kelompok_usia atau nama (mis. "4-5 Tahun")
  jenjangUsia?: string;
  kelompokUsiaId?: string;
  kelompokUsia?: string;
}

interface TemplateRaporProps {
  siswa: Siswa | null | undefined;
  catatanGuru: string;
  semesterId: string;
}

interface Nilai {
    namaDomain: string;
    lingkup?: string;
    namaAspek: string;
    nilai: number;
}
interface NilaiIndikator {
    namaIndikator: string;
    namaSubIndikator: string;
    nilai: number;
}
interface NilaiTrilogi {
    namaTrilogi: string;
    namaSubTrilogi: string;
    nilai: number;
    subTrilogiId?: string;
    // Nama habit dari master sub_trilogi (mis. "Mengenal konsep Pengurangan Statis")
    habit?: string;
}
interface InfoTambahan {
  beratBadan: string;
  tinggiBadan: string;
  lingkarKepala: string;
  sakit: number;
  ijin: number;
  alpa: number;
}

/**
 * CATATAN PENTING SOAL RENDER PDF (html2canvas):
 * html2canvas TIDAK mendukung `vertical-align`. Ia menempatkan teks dari
 * `Range.getClientRects()` tiap text node. Kalau inline box teks lebih pendek dari
 * kotak blok-nya, teks menempel ke BAWAH kotak (baseline normal), sehingga terlihat
 * rata bawah saat kotak tinggi.
 *
 * Jangan pakai `height` yang lebih besar dari isi + `lineHeight` (itu memotong teks),
 * dan jangan pakai `lineHeight` besar berikut `overflow: hidden` (teks terpotong).
 * Cukup pakai `minHeight` kecil yang sama untuk SEMUA baris, sehingga setiap kotak
 * teks setinggi isinya dan baris satu kolom tetap sejajar dengan kolom sebelahnya.
 */
const CELL_MIN_HEIGHT = 24; // px — 1 baris 12px + sedikit ruang; tidak ada sisa ruang besar
// Untuk sel/element satu baris. Tanpa lineHeight dan tanpa overflow, jadi tidak memotong teks.
const cellBoxSingle: CSSProperties = { minHeight: CELL_MIN_HEIGHT };
const cellTextRight: CSSProperties = { ...cellBoxSingle, textAlign: 'right' };
// Sel multi-baris (Domain + Lingkup, Sub Indikator): rapatkan line-height agar tidak melar.
const cellBoxMulti: CSSProperties = { minHeight: CELL_MIN_HEIGHT, lineHeight: 1.35 };

const TemplateRapor: React.FC<TemplateRaporProps> = ({ siswa, catatanGuru, semesterId }) => {
  const [nilaiPerkembangan, setNilaiPerkembangan] = useState<Nilai[]>([]);
  const [nilaiIndikator, setNilaiIndikator] = useState<NilaiIndikator[]>([]);
  const [nilaiTrilogi, setNilaiTrilogi] = useState<NilaiTrilogi[]>([]);
  const [kriteriaPerkembangan, setKriteriaPerkembangan] = useState<Record<number, string>>({});
  const [kriteriaIndikator, setKriteriaIndikator] = useState<Record<number, string>>({});
  const [kriteriaTrilogi, setKriteriaTrilogi] = useState<Record<number, string>>({});
  const [namaKepalaSekolah, setNamaKepalaSekolah] = useState<string>("-");
  const [namaWaliKelas, setNamaWaliKelas] = useState<string>("-");
  const [kota, setKota] = useState<string>("-");
  const [titimangsa, setTitimangsa] = useState<string>("-");
  const [infoTambahan, setInfoTambahan] = useState<InfoTambahan | null>(null);
  const [jenjangUsia, setJenjangUsia] = useState<string>("");
  // Jenjang kelas siswa (mis. "Playgroup", "TK A") diambil dari master koleksi "kelas"
  const [jenjangKelas, setJenjangKelas] = useState<string>("");
  const [loading, setLoading] = useState(true);

  // Dependency effect memakai id siswa (bukan objek siswa) agar tidak fetch ulang
  // setiap parent re-render dan tidak ada setState setelah komponen unmount.
  const siswaId = siswa?.id;

  useEffect(() => {
    let cancelled = false;
    const fetchNilai = async () => {
      if (!siswa) return;
      setLoading(true);
      setInfoTambahan(null);
      setJenjangUsia("");
      setJenjangKelas("");
      setKota("-");
      setTitimangsa("-");
      try {
        // 0. Fetch Kriteria Nilai untuk "Nilai Perkembangan"
        const katQuery = query(collection(db, "kategori_penilaian"), where("nama", "==", "Nilai Perkembangan"));
        const katSnap = await getDocs(katQuery);
        if (!katSnap.empty) {
          const katId = katSnap.docs[0].id;
          const kriteriaQuery = query(collection(db, "kriteria_nilai"), where("kategoriId", "==", katId));
          const kriteriaSnap = await getDocs(kriteriaQuery);
          const map: Record<number, string> = {};
          kriteriaSnap.forEach(doc => {
            const d = doc.data();
            map[d.nilai] = d.nama;
          });
          setKriteriaPerkembangan(map);
        }

        // Fetch Kriteria Nilai untuk "Nilai Indikator"
        const katIndikatorQuery = query(collection(db, "kategori_penilaian"), where("nama", "==", "Nilai Indikator"));
        const katIndikatorSnap = await getDocs(katIndikatorQuery);
        if (!katIndikatorSnap.empty) {
          const katId = katIndikatorSnap.docs[0].id;
          const kriteriaQuery = query(collection(db, "kriteria_nilai"), where("kategoriId", "==", katId));
          const kriteriaSnap = await getDocs(kriteriaQuery);
          const map: Record<number, string> = {};
          kriteriaSnap.forEach(doc => {
            const d = doc.data();
            map[d.nilai] = d.nama;
          });
          setKriteriaIndikator(map);
        }

        // Fetch Kriteria Nilai untuk "Nilai Trilogi"
        const katTrilogiQuery = query(collection(db, "kategori_penilaian"), where("nama", "==", "Nilai Trilogi"));
        const katTrilogiSnap = await getDocs(katTrilogiQuery);
        if (!katTrilogiSnap.empty) {
          const katId = katTrilogiSnap.docs[0].id;
          const kriteriaQuery = query(collection(db, "kriteria_nilai"), where("kategoriId", "==", katId));
          const kriteriaSnap = await getDocs(kriteriaQuery);
          const map: Record<number, string> = {};
          kriteriaSnap.forEach(doc => {
            const d = doc.data();
            map[d.nilai] = d.nama;
          });
          setKriteriaTrilogi(map);
        }

        // Fetch Nilai Perkembangan
        const perkembanganQuery = query(collection(db, "nilai_perkembangan"), where("siswaId", "==", siswa.id), where("semesterId", "==", semesterId));
        const perkembanganSnap = await getDocs(perkembanganQuery);
        
        // --- Fetch Lingkup from tahap_perkembangan ---
        const tahapIds = new Set<string>();
        perkembanganSnap.docs.forEach(doc => {
            const d = doc.data();
            if (d.tahapId) tahapIds.add(d.tahapId);
        });

        const tahapMap = new Map<string, any>();
        if (tahapIds.size > 0) {
            const ids = Array.from(tahapIds);
            // Chunking for 'in' query (max 10)
            for (let i = 0; i < ids.length; i += 10) {
                const chunk = ids.slice(i, i + 10);
                const q = query(collection(db, "tahap_perkembangan"), where(documentId(), "in", chunk));
                const snap = await getDocs(q);
                snap.forEach(doc => {
                    tahapMap.set(doc.id, doc.data());
                });
            }
        }

        // --- Jenjang usia siswa (dari master kelompok_usia) ---
        // Field jenjangUsia di data siswa bisa berisi ID dokumen atau nama (mis. "4-5 Tahun").
        // Jika tidak ada, ambil dari kelompokUsiaId milik tahap perkembangan yang dinilai.
        const usiaRef = siswa.jenjangUsia || siswa.kelompokUsiaId || siswa.kelompokUsia || "";
        const usiaIdDariTahap = Array.from(tahapMap.values())
            .map(t => t?.kelompokUsiaId)
            .find((id): id is string => typeof id === "string" && id !== "");
        const usiaKey = usiaRef || usiaIdDariTahap || "";
        if (usiaKey) {
            const usiaSnap = await getDocs(query(collection(db, "kelompok_usia"), orderBy("usia", "asc")));
            const usiaList = usiaSnap.docs.map(d => ({ id: d.id, usia: (d.data().usia as string) || "" }));
            const match = usiaList.find(u => u.id === usiaKey || u.usia === usiaKey);
            setJenjangUsia(match ? match.usia : usiaKey);
        }

        const rawPerkembangan = perkembanganSnap.docs.map(doc => {
            const data = doc.data();
            const tahap = tahapMap.get(data.tahapId);
            return { 
                namaDomain: data.namaTahap, 
                lingkup: tahap ? tahap.lingkup : "",
                namaAspek: "", 
                nilai: data.nilai 
            } as Nilai;
        });

        const uniquePerkembangan = new Map<string, Nilai>();
        rawPerkembangan.forEach(item => {
            const key = `${item.namaDomain}|${item.namaAspek}`;
            if (!uniquePerkembangan.has(key) || item.nilai > uniquePerkembangan.get(key)!.nilai) {
                uniquePerkembangan.set(key, item);
            }
        });
        
        // Sort by Lingkup then namaDomain
        const sortedPerkembangan = Array.from(uniquePerkembangan.values()).sort((a, b) => {
            if ((a.lingkup || "") < (b.lingkup || "")) return -1;
            if ((a.lingkup || "") > (b.lingkup || "")) return 1;
            return 0;
        });

        setNilaiPerkembangan(sortedPerkembangan);

        // Fetch Nilai Indikator
        const indikatorQuery = query(collection(db, "nilai_indikator"), where("siswaId", "==", siswa.id), where("semesterId", "==", semesterId));
        const indikatorSnap = await getDocs(indikatorQuery);
        const rawIndikator = indikatorSnap.docs.map(doc => doc.data() as NilaiIndikator);
        const uniqueIndikator = new Map<string, NilaiIndikator>();
        rawIndikator.forEach(item => {
            const key = `${item.namaIndikator}|${item.namaSubIndikator}`;
            if (!uniqueIndikator.has(key) || item.nilai > uniqueIndikator.get(key)!.nilai) {
                uniqueIndikator.set(key, item);
            }
        });
        setNilaiIndikator(Array.from(uniqueIndikator.values()));
        
        // Fetch Nilai Trilogi
        const trilogiQuery = query(collection(db, "nilai_trilogi"), where("siswaId", "==", siswa.id), where("semesterId", "==", semesterId));
        const trilogiSnap = await getDocs(trilogiQuery);
        const rawTrilogi = trilogiSnap.docs.map(doc => doc.data() as NilaiTrilogi);
        const uniqueTrilogi = new Map<string, NilaiTrilogi>();
        rawTrilogi.forEach(item => {
            const key = `${item.namaTrilogi}|${item.namaSubTrilogi}`;
            if (!uniqueTrilogi.has(key) || item.nilai > uniqueTrilogi.get(key)!.nilai) {
                uniqueTrilogi.set(key, item);
            }
        });

        // --- Ambil nama Habit dari master sub_trilogi ---
        // namaSubTrilogi di nilai_trilogi berisi deskripsi, sedangkan habit disimpan terpisah.
        const subTrilogiIds = new Set<string>();
        uniqueTrilogi.forEach(item => {
            if (item.subTrilogiId) subTrilogiIds.add(item.subTrilogiId);
        });
        const habitMap = new Map<string, string>();
        if (subTrilogiIds.size > 0) {
            const ids = Array.from(subTrilogiIds);
            for (let i = 0; i < ids.length; i += 10) {
                const chunk = ids.slice(i, i + 10);
                const q = query(collection(db, "sub_trilogi"), where(documentId(), "in", chunk));
                const snap = await getDocs(q);
                snap.forEach(d => {
                    habitMap.set(d.id, (d.data().habit as string) || "");
                });
            }
        }

        setNilaiTrilogi(Array.from(uniqueTrilogi.values()).map(item => ({
            ...item,
            habit: item.subTrilogiId ? habitMap.get(item.subTrilogiId) || "" : "",
        })));

        // Fetch Kepala Sekolah & Wali Kelas
        if (siswa.cabang) {
            // 1. Kepala Sekolah (Guru role 'Kepala Sekolah' di Cabang Siswa)
            const ksQuery = query(collection(db, "guru"), where("role", "==", "Kepala Sekolah"), where("cabang", "==", siswa.cabang));
            const ksSnap = await getDocs(ksQuery);
            if (!ksSnap.empty) {
                setNamaKepalaSekolah(ksSnap.docs[0].data().nama);
            } else {
                setNamaKepalaSekolah("-");
            }

            // Fetch Kota dari Cabang
            const cabangQuery = query(collection(db, "cabang"), where("nama", "==", siswa.cabang));
            const cabangSnap = await getDocs(cabangQuery);
            if (!cabangSnap.empty) {
                setKota(cabangSnap.docs[0].data().kota || "-");
            }

            // 2. Wali Kelas (Dari data Kelas)
            const kelasQuery = query(collection(db, "kelas"), where("namaKelas", "==", siswa.kelas), where("cabang", "==", siswa.cabang));
            const kelasSnap = await getDocs(kelasQuery);
            if (!kelasSnap.empty) {
                const kelasData = kelasSnap.docs[0].data();
                setJenjangKelas((kelasData.jenjangKelas as string) || "");
                const dataWali = kelasData.guruKelas || kelasData.waliKelas;
                // Handle jika waliKelas berupa array (banyak guru) atau string tunggal
                if (Array.isArray(dataWali)) {
                    const names = dataWali.map((w: any) => typeof w === 'string' ? w : w.nama || "").join(', ');
                    setNamaWaliKelas(names);
                } else if (typeof dataWali === 'string') {
                    setNamaWaliKelas(dataWali);
                } else if (typeof dataWali === 'object' && dataWali !== null) {
                    setNamaWaliKelas(dataWali.nama || "-");
                } else {
                    setNamaWaliKelas("-");
                }
            } else {
                setNamaWaliKelas("-");
            }
        }

        // Fetch Info Tambahan
        if (semesterId) {
            const semRef = doc(db, "kpi_periode", semesterId);
            const semSnap = await getDoc(semRef);
            if (semSnap.exists()) {
                const semName = semSnap.data().namaPeriode;
                
                
                const infoQuery = query(
                    collection(db, "info_tambahan_rapor"),
                    where("cabang", "==", siswa.cabang),
                    where("kelas", "==", siswa.kelas),
                    where("semester", "==", semName)
                );
                const infoSnap = await getDocs(infoQuery);
                
                if (!infoSnap.empty) {
                    const infoDoc = infoSnap.docs[0];
                    setTitimangsa(infoDoc.data().titimangsa || "-");
                    const infoId = infoDoc.id;
                    const siswaInfoQuery = query(
                        collection(db, "info_tambahan_siswa"),
                        where("infoTambahanId", "==", infoId),
                        where("siswaId", "==", siswa.id)
                    );
                    const siswaInfoSnap = await getDocs(siswaInfoQuery);
                    if (!siswaInfoSnap.empty) {
                        setInfoTambahan(siswaInfoSnap.docs[0].data() as InfoTambahan);
                    }
                }
            }
        }

      } catch (error) {
        console.error("Error fetching nilai:", error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchNilai();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siswaId, semesterId]);

  const groupedIndikator = useMemo(() => {
    const groups = new Map<string, NilaiIndikator[]>();
    nilaiIndikator.forEach((item) => {
      if (!groups.has(item.namaIndikator)) {
        groups.set(item.namaIndikator, []);
      }
      groups.get(item.namaIndikator)!.push(item);
    });
    return groups;
  }, [nilaiIndikator]);

  // Trilogi dikelompokkan per nama Trilogi (mis. "5 Basic Area"),
  // tiap sub trilogi ditampilkan sebagai kalimat: "Ananda <Nilai> dalam <Sub Trilogi>."
  const groupedTrilogi = useMemo(() => {
    const groups = new Map<string, { habit: string; sentence: string }[]>();
    nilaiTrilogi.forEach((item) => {
      const groupName = item.namaTrilogi || "Lainnya";
      if (!groups.has(groupName)) {
        groups.set(groupName, []);
      }
      const nilaiText = kriteriaTrilogi[item.nilai] || String(item.nilai);
      const subTrilogi = (item.namaSubTrilogi || "").trim().replace(/[.;]+$/, "");
      groups.get(groupName)!.push({
        habit: (item.habit || "").trim(),
        sentence: `Ananda ${nilaiText} dalam ${subTrilogi}.`,
      });
    });
    // Urutkan sub trilogi di tiap grup secara alfabetis berdasarkan Habit
    // (mis. "Bahasa" di atas "5 Basic Area", "Dimensi 1" di atas "Gembira Beraksi").
    // localeCompare dengan numeric:true membuat "Dimensi 2" tetap sebelum "Dimensi 10".
    groups.forEach((items) => {
      items.sort((a, b) => a.habit.localeCompare(b.habit, "id", { numeric: true, sensitivity: "base" }));
    });
    return groups;
  }, [nilaiTrilogi, kriteriaTrilogi]);

  // Rapor Playgroup tidak menampilkan Indikator Belajar & Kehadiran.
  // Pencocokan dibuat longgar (huruf kecil, tanpa spasi) agar "Play Group" / "PLAYGROUP" tetap terdeteksi.
  const isPlaygroup = useMemo(() => {
    const normalize = (value: string) => value.toLowerCase().replace(/[^a-z]/g, "");
    const jenjang = normalize(jenjangKelas);
    if (jenjang) return jenjang.includes("playgroup");
    // Fallback: jika data kelas tidak punya jenjangKelas, cek nama kelasnya
    return normalize(siswa?.kelas || "").includes("playgroup");
  }, [jenjangKelas, siswa?.kelas]);

  const formatTitimangsa = (dateStr: string) => {
    if (!dateStr || dateStr === "-") return "-";
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric" }).format(date);
  };

  if (!siswa) {
    return <div className="text-center p-10">Silakan pilih siswa untuk melihat rapor.</div>;
  }
  
  if (loading) {
      return <div className="text-center p-10">Memuat data nilai...</div>;
  }

  return (
    <>
    <style>{`
      /* Paksa rata tengah secara vertikal untuk semua sel tabel.
         Ditaruh juga di dalam @media print karena html2canvas (yang dipakai html2pdf)
         merender lewat media "print" — tanpa ini, aturan Tailwind .align-middle
         kalah/tidak terbaca dan sel jatuh ke default browser (baseline/bottom),
         sehingga di PDF teks terlihat menempel ke garis bawah sel. */
      .rapor-print-view td, .rapor-print-view th {
        vertical-align: middle !important;
      }
      .rapor-print-view tr, .rapor-print-view tbody, .rapor-print-view thead {
        vertical-align: middle !important;
      }

      /* Warna sekunder #ff9402 dengan opacity rendah untuk baris tabel */
      .rapor-print-view .row-accent {
        background-color: rgba(255, 148, 2, 0.12) !important;
      }
      .rapor-print-view .row-accent-strong {
        background-color: rgba(255, 148, 2, 0.22) !important;
      }
      /* ===== Trilogi Mainriang =====
         JANGAN memakai elemen block (div/h4/ul/li) untuk judul grup dan habit.
         html2canvas selalu menempelkan teks ke dasar kotak block dan tidak mendukung
         vertical-align, sehingga judul/habit tampak "tenggelam".
         Solusinya: rendam semuanya dalam <table> (satu sel per baris). Di dalam sel tabel,
         posisi baris teks dihitung per baris, jadi padding atas/bawah benar-benar diterapkan
         dan teks otomatis berada di tengah — ini pola yang sudah terbukti benar di section
         Tahap Perkembangan, Antropometri, dan Kehadiran. */
      .rapor-print-view .trilogi-table {
        width: 100%;
        border-collapse: collapse;
        table-layout: fixed;
      }
      .rapor-print-view .trilogi-table col.trilogi-col-mark {
        width: 18px;
      }
      .rapor-print-view .trilogi-table td {
        padding: 0 !important;
        border: none !important;
        vertical-align: middle !important;
      }
      /* Judul grup Trilogi.
         html2canvas menempelkan teks ke dasar kotak dan mengabaikan vertical-align,
         jadi cat warna tidak boleh satu lapisan dengan teksnya.

         Struktur TERBUKTI di rapor ini (permintaan sebelumnya):
         "Berat Badan" di dalam <td> dengan padding + div minHeight ⇒ rata tengah.
         "Nilai" (teks tabel) juga rata tengah.

         Maka judul grup dibuat sebagai SEL TABEL dengan padding atas-bawah yang sama
         seperti sel lain, tinggi TIDAK dikunci (tanpa height/line-height/overflow),
         dan cat oranye dipasang sebagai border-left tebal + background sel.
         Tidak ada lapisan yang ditumpuk, tidak ada overflow yang memotong teks. */
      .rapor-print-view .trilogi-table td.trilogi-group-cell {
        padding: 0px 10px 15px 15px !important;
        background-color: #ff9402 !important;
        color: #ffffff !important;
        font-weight: 700 !important;
        font-size: 14px !important;
        line-height: 1.35 !important;
        border-left: 4px solid #7a4600 !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      /* Baris habit + kalimat */
      .rapor-print-view .trilogi-table td.trilogi-item-cell {
        padding: 2px 0 !important;
        font-size: 12px !important;
        line-height: 1.45 !important;
      }
      .rapor-print-view .trilogi-table td.trilogi-mark-cell {
        padding: 2px 0 !important;
        text-align: center;
        font-size: 12px !important;
        line-height: 1.45 !important;
        vertical-align: top !important;
      }
      .rapor-print-view .trilogi-habit-text {
        color: #581c87;
        font-weight: 600;
        font-size: 11px !important;
        line-height: 1.35 !important;
        margin-bottom: 1px;
      }
      .rapor-print-view .trilogi-group-spacer td {
        height: 8px;
        padding: 0 !important;
      }

      @media print {
        @page {
          size: A4;
          margin: 0;
        }
        html, body {
          background: white !important;
        }
        body {
          visibility: hidden;
        }
        .rapor-print-view {
          visibility: visible;
          position: absolute;
          left: 0 !important;
          top: 0 !important;
          width: 210mm !important;
          height: auto !important;
          min-height: auto !important;
          margin: 0 !important;
          padding: 10mm !important;
          background-color: white !important;
          box-sizing: border-box;
          border: none !important;
          box-shadow: none !important;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
          z-index: 9999;
        }
        .rapor-print-view * {
          visibility: visible;
        }
        /* Ulangi aturan vertical-align di media print agar ikut terbaca kanvas/generator PDF */
        .rapor-print-view td, .rapor-print-view th {
          vertical-align: middle !important;
        }
      }
    `}</style>
    <div className="rapor-print-view bg-white font-sans text-[#111827] mx-auto shadow-lg" style={{ width: '210mm', minHeight: '297mm', padding: '15mm', boxSizing: 'border-box', borderSpacing: 0 }}>
      {/* Tahap Perkembangan */}
      <div className="mb-6 break-inside-avoid">
        <h3 className="text-lg font-bold text-[#581c87] mb-2 border-b-2 border-[#f3f4f6] pb-1">
          Tahap Perkembangan {siswa.nama}
          {jenjangUsia && (
            <span className="block text-sm font-semibold text-[#4b5563] mt-0.5">{jenjangUsia}</span>
          )}
        </h3>
        <table className="w-full text-xs border-collapse border border-[#d1d5db] rounded-lg overflow-hidden">
          <thead className="bg-[#581c87] text-[#ffffff]">
            <tr>
              <th className="p-2 text-left align-middle"><div style={cellBoxSingle}>Domain / Aspek Perkembangan</div></th>
              <th className="p-2 w-24 text-center align-middle"><div style={cellBoxSingle}>Nilai</div></th>
            </tr>
          </thead>
          <tbody>
            {nilaiPerkembangan.length === 0 ? (
              <tr><td colSpan={2} className="p-3 text-center italic text-[#6b7280] border border-[#d1d5db]"><div style={cellBoxSingle}>Tidak ada data penilaian.</div></td></tr>
            ) : (
                nilaiPerkembangan.map((item, idx) => (
                <tr key={idx} className={idx % 2 === 0 ? "bg-[#ffffff]" : "row-accent"}>
                  <td className="border border-[#d1d5db] px-3 pb-3 align-middle">
                    <div style={cellBoxMulti}>
                      {item.lingkup && (
                          <div className="text-[#581c87] text-[10px] mt-0.5 font-medium leading-tight">Lingkup: {item.lingkup}</div>
                      )}
                      {item.namaAspek && <div className="text-[#4b5563] pl-3 mt-0.5 text-[10px] leading-tight">• {item.namaAspek}</div>}
                      <div className="font-semibold text-[#1f2937] leading-tight">{item.namaDomain}</div>
                    </div>
                  </td>
                  <td className="border border-[#d1d5db] px-3 pb-3 text-center font-bold align-middle text-xs">
                    <div style={cellBoxSingle}>{kriteriaPerkembangan[item.nilai] || item.nilai}</div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Indikator Belajar (tidak ditampilkan untuk Playgroup) */}
      {!isPlaygroup && (
        <div className="mb-6 break-inside-avoid">
          <h3 className="text-lg font-bold text-[#581c87] mb-2 border-b-2 border-[#f3f4f6] pb-1">Indikator Belajar</h3>
          <table className="w-full text-xs border-collapse border border-[#d1d5db] rounded-lg overflow-hidden">
            <thead className="bg-[#581c87] text-[#ffffff]">
              <tr>
                <th className="p-2 text-left align-middle"><div style={cellBoxSingle}>Indikator / Sub Indikator</div></th>
                <th className="p-2 w-24 text-center align-middle"><div style={cellBoxSingle}>Nilai</div></th>
              </tr>
            </thead>
            <tbody>
              {nilaiIndikator.length === 0 ? (
                <tr><td colSpan={2} className="p-3 text-center italic text-[#6b7280] border border-[#d1d5db]"><div style={cellBoxSingle}>Tidak ada data penilaian.</div></td></tr>
              ) : (
                Array.from(groupedIndikator.entries()).map(([indikator, items], groupIdx) => (
                  <React.Fragment key={groupIdx}>
                    <tr className="row-accent-strong">
                      <td colSpan={2} className="border border-[#d1d5db] p-2 font-bold text-[#1f2937] align-middle"><div style={cellBoxSingle}>{indikator}</div></td>
                    </tr>
                    {items.map((item, idx) => (
                      <tr key={`${groupIdx}-${idx}`} className="bg-[#ffffff]">
                        <td className="border border-[#d1d5db] p-2 pl-6 align-middle">
                          <div style={cellBoxMulti}><span className="text-[#4b5563] text-[10px]">• {item.namaSubIndikator}</span></div>
                        </td>
                        <td className="border border-[#d1d5db] p-2 text-center font-bold align-middle text-xs">
                          <div style={cellBoxSingle}>{kriteriaIndikator[item.nilai] || item.nilai}</div>
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Trilogi Mainriang */}
      <div className="mb-6 break-inside-avoid">
        <h3 className="text-lg font-bold text-[#581c87] mb-2 border-b-2 border-[#f3f4f6] pb-1">Trilogi Mainriang</h3>
        {groupedTrilogi.size === 0 ? (
          <p className="text-xs italic text-[#6b7280]">Tidak ada data penilaian.</p>
        ) : (
          <table className="trilogi-table">
            <colgroup>
              <col className="trilogi-col-mark" />
              <col />
            </colgroup>
            <tbody>
              {Array.from(groupedTrilogi.entries()).map(([trilogi, items], groupIdx) => (
                <React.Fragment key={groupIdx}>
                  {/* Judul grup = satu <td> biasa dengan padding (pola yang sudah terbukti
                      rata tengah di rapor). Cat oranye dari background sel, bukan lapisan
                      yang ditumpuk. */}
                  <tr className="break-inside-avoid">
                    <td colSpan={2} className="trilogi-group-cell">{trilogi}</td>
                  </tr>
                  {items.map((item, idx) => (
                    <tr key={idx} className="break-inside-avoid">
                      <td className="trilogi-mark-cell">•</td>
                      <td className="trilogi-item-cell">
                        {item.habit && (
                          <div className="trilogi-habit-text">{item.habit}</div>
                        )}
                        <div>{item.sentence}</div>
                      </td>
                    </tr>
                  ))}
                  {groupIdx < groupedTrilogi.size - 1 && (
                    <tr className="trilogi-group-spacer"><td colSpan={2} /></tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Antropometri */}
      <div className="mb-6 break-inside-avoid">
        <h3 className="text-lg font-bold text-[#581c87] mb-2 border-b-2 border-[#f3f4f6] pb-1">Antropometri</h3>
        <table className="w-full text-xs border-collapse border border-[#d1d5db] rounded-lg overflow-hidden">
          <tbody>
            <tr className="bg-[#ffffff]">
              <td className="border border-[#d1d5db] p-2 align-middle"><div style={cellBoxSingle}>Berat Badan</div></td>
              <td className="border border-[#d1d5db] p-2 text-center font-bold align-middle"><div style={cellTextRight}>{infoTambahan?.beratBadan || "-"} kg</div></td>
            </tr>
            <tr className="row-accent">
              <td className="border border-[#d1d5db] p-2 align-middle"><div style={cellBoxSingle}>Tinggi Badan</div></td>
              <td className="border border-[#d1d5db] p-2 text-center font-bold align-middle"><div style={cellTextRight}>{infoTambahan?.tinggiBadan || "-"} cm</div></td>
            </tr>
            <tr className="bg-[#ffffff]">
              <td className="border border-[#d1d5db] p-2 align-middle"><div style={cellBoxSingle}>Lingkar Kepala</div></td>
              <td className="border border-[#d1d5db] p-2 text-center font-bold align-middle"><div style={cellTextRight}>{infoTambahan?.lingkarKepala || "-"} cm</div></td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Kehadiran (tidak ditampilkan untuk Playgroup) */}
      {!isPlaygroup && (
        <div className="mb-6 break-inside-avoid">
          <h3 className="text-lg font-bold text-[#581c87] mb-2 border-b-2 border-[#f3f4f6] pb-1">Kehadiran</h3>
          <table className="w-full text-xs border-collapse border border-[#d1d5db] rounded-lg overflow-hidden">
            <tbody>
              <tr className="bg-[#ffffff]">
                <td className="border border-[#d1d5db] p-2 align-middle"><div style={cellBoxSingle}>Sakit</div></td>
                <td className="border border-[#d1d5db] p-2 text-center font-bold align-middle"><div style={cellTextRight}>{infoTambahan?.sakit || 0} hari</div></td>
              </tr>
              <tr className="row-accent">
                <td className="border border-[#d1d5db] p-2 align-middle"><div style={cellBoxSingle}>Ijin</div></td>
                <td className="border border-[#d1d5db] p-2 text-center font-bold align-middle"><div style={cellTextRight}>{infoTambahan?.ijin || 0} hari</div></td>
              </tr>
              <tr className="bg-[#ffffff]">
                <td className="border border-[#d1d5db] p-2 align-middle"><div style={cellBoxSingle}>Tanpa Keterangan</div></td>
                <td className="border border-[#d1d5db] p-2 text-center font-bold align-middle"><div style={cellTextRight}>{infoTambahan?.alpa || 0} hari</div></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Catatan Guru */}
      <div className="mb-6 break-inside-avoid">
        <h3 className="text-lg font-bold text-[#581c87] mb-2 border-b-2 border-[#f3f4f6] pb-1">Catatan Guru</h3>
        <p className="text-justify indent-6 text-sm whitespace-pre-line">
          {catatanGuru}
        </p>
      </div>

       {/* TTD */}
       <div className="flex justify-between items-start pt-8 text-center break-inside-avoid text-sm">
            <div>
                <p className="mb-1"></p>
                <p className="mb-1">Mengetahui,</p>
                <p className="mb-16">Kepala Sekolah</p>
                <p className="font-bold underline">{namaKepalaSekolah}</p>
            </div>
            <div>
                <p className="mb-1">{kota}, {formatTitimangsa(titimangsa)}</p>
                <p className="mb-1"></p>
                <p className="mb-16">Wali Kelas,</p>
                <p className="font-bold underline">{namaWaliKelas}</p>
            </div>
        </div>

    </div>
    </>
  );
};

export default TemplateRapor;
