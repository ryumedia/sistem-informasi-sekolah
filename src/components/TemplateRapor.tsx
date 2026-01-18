import React, { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, documentId } from 'firebase/firestore';

interface Siswa {
  id: string;
  nama: string;
  kelas: string;
  nis: string;
  nisn: string;
  foto?: string;
  cabang?: string;
}

interface TemplateRaporProps {
  siswa: Siswa | null | undefined;
  narasi: string;
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
}

const TemplateRapor: React.FC<TemplateRaporProps> = ({ siswa, narasi, semesterId }) => {
  const [nilaiPerkembangan, setNilaiPerkembangan] = useState<Nilai[]>([]);
  const [nilaiIndikator, setNilaiIndikator] = useState<NilaiIndikator[]>([]);
  const [nilaiTrilogi, setNilaiTrilogi] = useState<NilaiTrilogi[]>([]);
  const [kriteriaPerkembangan, setKriteriaPerkembangan] = useState<Record<number, string>>({});
  const [kriteriaIndikator, setKriteriaIndikator] = useState<Record<number, string>>({});
  const [kriteriaTrilogi, setKriteriaTrilogi] = useState<Record<number, string>>({});
  const [namaKepalaSekolah, setNamaKepalaSekolah] = useState<string>("-");
  const [namaWaliKelas, setNamaWaliKelas] = useState<string>("-");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchNilai = async () => {
      if (!siswa) return;
      setLoading(true);
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
        setNilaiTrilogi(Array.from(uniqueTrilogi.values()));

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

            // 2. Wali Kelas (Dari data Kelas)
            const kelasQuery = query(collection(db, "kelas"), where("namaKelas", "==", siswa.kelas), where("cabang", "==", siswa.cabang));
            const kelasSnap = await getDocs(kelasQuery);
            if (!kelasSnap.empty) {
                const kelasData = kelasSnap.docs[0].data();
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

      } catch (error) {
        console.error("Error fetching nilai:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchNilai();
  }, [siswa, semesterId]);

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

  const groupedTrilogi = useMemo(() => {
    const groups = new Map<string, NilaiTrilogi[]>();
    nilaiTrilogi.forEach((item) => {
      if (!groups.has(item.namaTrilogi)) {
        groups.set(item.namaTrilogi, []);
      }
      groups.get(item.namaTrilogi)!.push(item);
    });
    return groups;
  }, [nilaiTrilogi]);

  if (!siswa) {
    return <div className="text-center p-10">Silakan pilih siswa untuk melihat rapor.</div>;
  }
  
  if (loading) {
      return <div className="text-center p-10">Memuat data nilai...</div>;
  }

  return (
    <div className="bg-[#ffffff] font-sans p-8 text-[#111827]" style={{ backgroundColor: '#ffffff', color: '#111827' }}>
      {/* Header */}
      <div className="flex justify-between items-center border-b-4 border-[#000000] pb-4 mb-6">
        <div className="flex items-center">
          <Image src="/logo.png" alt="Logo Sekolah" width={100} height={100} />
          <div className="ml-4">
            <h1 className="text-3xl font-bold">LAPORAN PERKEMBANGAN ANAK</h1>
            <h2 className="text-2xl font-semibold">KB-TK MAINRIANG</h2>
          </div>
        </div>
        <div className="text-right">
          <p>Jl. Raya Mainriang No. 123</p>
          <p>Telp: (021) 1234567</p>
          <p>Website: www.mainriang.sch.id</p>
        </div>
      </div>

      {/* Informasi Siswa */}
      <div className="flex items-center mb-8">
        <div className="flex-grow grid grid-cols-4 gap-x-8 gap-y-2">
          <div className="font-bold">Nama</div><div>: {siswa.nama}</div>
          <div className="font-bold">Kelas</div><div>: {siswa.kelas}</div>
          <div className="font-bold">Sekolah</div><div>: {siswa.cabang || "-"}</div>
          <div className="font-bold">Semester</div><div>: 2 (Dua)</div>
          <div className="font-bold">NISN</div><div>: {siswa.nisn}</div>
          <div className="font-bold">Tahun Ajaran</div><div>: 2023/2024</div>
        </div>
        <div className="w-32 h-40 relative border-2 border-[#d1d5db] rounded-lg overflow-hidden">
            <Image src={siswa.foto && siswa.foto !== "" ? siswa.foto : '/images/default-profile.png'} alt="Foto Siswa" layout="fill" objectFit="cover" crossOrigin="anonymous" />
        </div>
      </div>

      {/* A. Narasi Perkembangan */}
      <div className="mb-8 break-inside-avoid">
        <h3 className="text-xl font-bold text-[#581c87] mb-3 border-b-2 border-[#f3f4f6] pb-2">A. Narasi Perkembangan</h3>
        <p className="text-justify indent-8">
          {narasi}
        </p>
      </div>

      {/* B. Tahap Perkembangan */}
      <div className="mb-8 break-inside-avoid">
        <h3 className="text-xl font-bold text-[#581c87] mb-3 border-b-2 border-[#f3f4f6] pb-2">B. Tahap Perkembangan</h3>
        <table className="w-full text-sm border-collapse border border-[#d1d5db] rounded-lg overflow-hidden">
          <thead className="bg-[#581c87] text-[#ffffff]">
            <tr>
              <th className="p-3 text-left">Domain / Aspek Perkembangan</th>
              <th className="p-3 w-32 text-center">Nilai</th>
            </tr>
          </thead>
          <tbody>
            {nilaiPerkembangan.length === 0 ? (
              <tr><td colSpan={2} className="p-4 text-center italic text-[#6b7280] border border-[#d1d5db]">Tidak ada data penilaian.</td></tr>
            ) : (
                nilaiPerkembangan.map((item, idx) => (
                <tr key={idx} className={idx % 2 === 0 ? "bg-[#ffffff]" : "bg-[#f9fafb]"}>
                  <td className="border border-[#d1d5db] p-3">
                    <div className="font-semibold text-[#1f2937]">{item.namaDomain}</div>
                    {item.lingkup && (
                        <div className="text-[#581c87] text-xs mt-1 font-medium">Lingkup: {item.lingkup}</div>
                    )}
                    {item.namaAspek && <div className="text-[#4b5563] pl-4 mt-1 text-xs">• {item.namaAspek}</div>}
                  </td>
                  <td className="border border-[#d1d5db] p-3 text-center font-bold align-middle text-sm">
                    {kriteriaPerkembangan[item.nilai] || item.nilai}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* C. Indikator Belajar */}
      <div className="mb-8 break-inside-avoid">
        <h3 className="text-xl font-bold text-[#581c87] mb-3 border-b-2 border-[#f3f4f6] pb-2">C. Indikator Belajar</h3>
        <table className="w-full text-sm border-collapse border border-[#d1d5db] rounded-lg overflow-hidden">
          <thead className="bg-[#581c87] text-[#ffffff]">
            <tr>
              <th className="p-3 text-left">Indikator / Sub Indikator</th>
              <th className="p-3 w-32 text-center">Nilai</th>
            </tr>
          </thead>
          <tbody>
            {nilaiIndikator.length === 0 ? (
              <tr><td colSpan={2} className="p-4 text-center italic text-[#6b7280] border border-[#d1d5db]">Tidak ada data penilaian.</td></tr>
            ) : (
              Array.from(groupedIndikator.entries()).map(([indikator, items], groupIdx) => (
                <React.Fragment key={groupIdx}>
                  <tr className="bg-[#f3f4f6]">
                    <td colSpan={2} className="border border-[#d1d5db] p-3 font-bold text-[#1f2937]">{indikator}</td>
                  </tr>
                  {items.map((item, idx) => (
                    <tr key={`${groupIdx}-${idx}`} className="bg-[#ffffff]">
                      <td className="border border-[#d1d5db] p-3 pl-8">
                        <div className="text-[#4b5563] text-sm">• {item.namaSubIndikator}</div>
                      </td>
                      <td className="border border-[#d1d5db] p-3 text-center font-bold align-middle text-sm">
                        {kriteriaIndikator[item.nilai] || item.nilai}
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* D. Trilogi Mainriang */}
      <div className="mb-8 break-inside-avoid">
        <h3 className="text-xl font-bold text-[#581c87] mb-3 border-b-2 border-[#f3f4f6] pb-2">D. Trilogi Mainriang</h3>
        <table className="w-full text-sm border-collapse border border-[#d1d5db] rounded-lg overflow-hidden">
          <thead className="bg-[#581c87] text-[#ffffff]">
            <tr>
              <th className="p-3 text-left">Trilogi / Sub Trilogi</th>
              <th className="p-3 w-32 text-center">Nilai</th>
            </tr>
          </thead>
          <tbody>
             {nilaiTrilogi.length === 0 ? (
              <tr><td colSpan={2} className="p-4 text-center italic text-[#6b7280] border border-[#d1d5db]">Tidak ada data penilaian.</td></tr>
            ) : (
              Array.from(groupedTrilogi.entries()).map(([trilogi, items], groupIdx) => (
                <React.Fragment key={groupIdx}>
                  <tr className="bg-[#f3f4f6]">
                    <td colSpan={2} className="border border-[#d1d5db] p-3 font-bold text-[#1f2937]">{trilogi}</td>
                  </tr>
                  {items.map((item, idx) => (
                    <tr key={`${groupIdx}-${idx}`} className="bg-[#ffffff]">
                      <td className="border border-[#d1d5db] p-3 pl-8">
                        <div className="text-[#4b5563] text-sm">• {item.namaSubTrilogi}</div>
                      </td>
                      <td className="border border-[#d1d5db] p-3 text-center font-bold align-middle text-sm">
                        {kriteriaTrilogi[item.nilai] || item.nilai}
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>

       {/* TTD */}
       <div className="flex justify-between items-start pt-10 text-center break-inside-avoid">
            <div>
                <p className="mb-20">Mengetahui,</p>
                <p className="font-bold underline">Kepala Sekolah</p>
                <p className="font-bold">{namaKepalaSekolah}</p>
            </div>
            <div>
                <p className="mb-20">Wali Kelas,</p>
                <p className="font-bold underline">{namaWaliKelas}</p>
                <p className="font-bold"></p>
            </div>
        </div>

    </div>
  );
};

export default TemplateRapor;