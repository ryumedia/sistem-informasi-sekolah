import React, { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, documentId, doc, getDoc } from 'firebase/firestore';

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
interface InfoTambahan {
  beratBadan: string;
  tinggiBadan: string;
  lingkarKepala: string;
  sakit: number;
  ijin: number;
  alpa: number;
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
  const [infoTambahan, setInfoTambahan] = useState<InfoTambahan | null>(null);
  const [semesterName, setSemesterName] = useState<string>("-");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchNilai = async () => {
      if (!siswa) return;
      setLoading(true);
      setInfoTambahan(null);
      setSemesterName("-");
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

        // Fetch Info Tambahan
        if (semesterId) {
            const semRef = doc(db, "kpi_periode", semesterId);
            const semSnap = await getDoc(semRef);
            if (semSnap.exists()) {
                const semName = semSnap.data().namaPeriode;
                setSemesterName(semName);
                
                const infoQuery = query(
                    collection(db, "info_tambahan_rapor"),
                    where("cabang", "==", siswa.cabang),
                    where("kelas", "==", siswa.kelas),
                    where("semester", "==", semName)
                );
                const infoSnap = await getDocs(infoQuery);
                
                if (!infoSnap.empty) {
                    const infoId = infoSnap.docs[0].id;
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
    <>
    <style>{`
      /* Paksa rata tengah secara vertikal untuk semua sel tabel */
      .rapor-print-view td, .rapor-print-view th {
        vertical-align: middle !important;
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
      }
    `}</style>
    <div className="rapor-print-view bg-white font-sans text-[#111827] mx-auto shadow-lg" style={{ width: '210mm', minHeight: '297mm', padding: '15mm', boxSizing: 'border-box' }}>
      {/* Header */}
      <div className="flex justify-between items-center border-b-4 border-[#000000] pb-3 mb-5">
        <div className="flex items-center">
          <Image src="/logo.png" alt="Logo Sekolah" width={80} height={80} />
          <div className="ml-4">
            <h1 className="text-2xl font-bold">LAPORAN PERKEMBANGAN ANAK</h1>
            <h2 className="text-xl font-semibold">KB-TK MAINRIANG</h2>
          </div>
        </div>
      </div>

      {/* Informasi Siswa */}
      <div className="flex justify-between mb-6 text-sm">
        <div className="flex flex-row grid grid-cols-2 gap-x-0 gap-y-1">
          <div className="font-bold">Nama</div><div>: {siswa.nama}</div>
          <div className="font-bold">NISN</div><div>: {siswa.nisn}</div>
          <div className="font-bold">Kelas</div><div>: {siswa.kelas}</div>
          <div className="font-bold">Semester</div><div>: {semesterName}</div>
          <div className="font-bold">Sekolah</div><div>: {siswa.cabang || "-"}</div>
        </div>
        <div className="w-24 h-32 relative border-2 border-[#d1d5db] rounded-lg overflow-hidden">
            <Image src={siswa.foto && siswa.foto !== "" ? siswa.foto : '/images/default-profile.png'} alt="Foto Siswa" layout="fill" objectFit="cover" crossOrigin="anonymous" />
        </div>
      </div>

      {/* A. Narasi Perkembangan */}
      <div className="mb-6 break-inside-avoid">
        <h3 className="text-lg font-bold text-[#581c87] mb-2 border-b-2 border-[#f3f4f6] pb-1">A. Narasi Perkembangan</h3>
        <p className="text-justify indent-6 text-sm">
          {narasi}
        </p>
      </div>

      {/* B. Tahap Perkembangan */}
      <div className="mb-6 break-inside-avoid">
        <h3 className="text-lg font-bold text-[#581c87] mb-2 border-b-2 border-[#f3f4f6] pb-1">B. Tahap Perkembangan</h3>
        <table className="w-full text-xs border-collapse border border-[#d1d5db] rounded-lg overflow-hidden">
          <thead className="bg-[#581c87] text-[#ffffff]">
            <tr>
              <th className="p-2 text-left align-middle">Domain / Aspek Perkembangan</th>
              <th className="p-2 w-24 text-center align-middle">Nilai</th>
            </tr>
          </thead>
          <tbody>
            {nilaiPerkembangan.length === 0 ? (
              <tr><td colSpan={2} className="p-3 text-center italic text-[#6b7280] border border-[#d1d5db]">Tidak ada data penilaian.</td></tr>
            ) : (
                nilaiPerkembangan.map((item, idx) => (
                <tr key={idx} className={idx % 2 === 0 ? "bg-[#ffffff]" : "bg-[#f9fafb]"}>
                  <td className="border border-[#d1d5db] p-2 align-middle">
                    <div className="font-semibold text-[#1f2937]">{item.namaDomain}</div>
                    {item.lingkup && (
                        <div className="text-[#581c87] text-[10px] mt-0.5 font-medium">Lingkup: {item.lingkup}</div>
                    )}
                    {item.namaAspek && <div className="text-[#4b5563] pl-3 mt-0.5 text-[10px]">• {item.namaAspek}</div>}
                  </td>
                  <td className="border border-[#d1d5db] p-2 text-center font-bold align-middle text-xs">
                    {kriteriaPerkembangan[item.nilai] || item.nilai}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* C. Indikator Belajar */}
      <div className="mb-6 break-inside-avoid">
        <h3 className="text-lg font-bold text-[#581c87] mb-2 border-b-2 border-[#f3f4f6] pb-1">C. Indikator Belajar</h3>
        <table className="w-full text-xs border-collapse border border-[#d1d5db] rounded-lg overflow-hidden">
          <thead className="bg-[#581c87] text-[#ffffff]">
            <tr>
              <th className="p-2 text-left align-middle">Indikator / Sub Indikator</th>
              <th className="p-2 w-24 text-center align-middle">Nilai</th>
            </tr>
          </thead>
          <tbody>
            {nilaiIndikator.length === 0 ? (
              <tr><td colSpan={2} className="p-3 text-center italic text-[#6b7280] border border-[#d1d5db]">Tidak ada data penilaian.</td></tr>
            ) : (
              Array.from(groupedIndikator.entries()).map(([indikator, items], groupIdx) => (
                <React.Fragment key={groupIdx}>
                  <tr className="bg-[#f3f4f6]">
                    <td colSpan={2} className="border border-[#d1d5db] p-2 font-bold text-[#1f2937] align-middle">{indikator}</td>
                  </tr>
                  {items.map((item, idx) => (
                    <tr key={`${groupIdx}-${idx}`} className="bg-[#ffffff]">
                      <td className="border border-[#d1d5db] p-2 pl-6 align-middle">
                        <div className="text-[#4b5563] text-[10px]">• {item.namaSubIndikator}</div>
                      </td>
                      <td className="border border-[#d1d5db] p-2 text-center font-bold align-middle text-xs">
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
      <div className="mb-6 break-inside-avoid">
        <h3 className="text-lg font-bold text-[#581c87] mb-2 border-b-2 border-[#f3f4f6] pb-1">D. Trilogi Mainriang</h3>
        <table className="w-full text-xs border-collapse border border-[#d1d5db] rounded-lg overflow-hidden">
          <thead className="bg-[#581c87] text-[#ffffff]">
            <tr>
              <th className="p-2 text-left align-middle">Trilogi / Sub Trilogi</th>
              <th className="p-2 w-24 text-center align-middle">Nilai</th>
            </tr>
          </thead>
          <tbody>
             {nilaiTrilogi.length === 0 ? (
              <tr><td colSpan={2} className="p-3 text-center italic text-[#6b7280] border border-[#d1d5db]">Tidak ada data penilaian.</td></tr>
            ) : (
              Array.from(groupedTrilogi.entries()).map(([trilogi, items], groupIdx) => (
                <React.Fragment key={groupIdx}>
                  <tr className="bg-[#f3f4f6]">
                    <td colSpan={2} className="border border-[#d1d5db] p-2 font-bold text-[#1f2937] align-middle">{trilogi}</td>
                  </tr>
                  {items.map((item, idx) => (
                    <tr key={`${groupIdx}-${idx}`} className="bg-[#ffffff]">
                      <td className="border border-[#d1d5db] p-2 pl-6 align-middle">
                        <div className="text-[#4b5563] text-[10px]">• {item.namaSubTrilogi}</div>
                      </td>
                      <td className="border border-[#d1d5db] p-2 text-center font-bold align-middle text-xs">
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

      {/* E. Informasi Tambahan */}
      <div className="mb-6 break-inside-avoid">
        <h3 className="text-lg font-bold text-[#581c87] mb-2 border-b-2 border-[#f3f4f6] pb-1">E. Informasi Tambahan</h3>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <h4 className="font-bold mb-1 text-xs">Antropometri</h4>
            <table className="w-full text-xs border-collapse border border-[#d1d5db]">
              <tbody>
                <tr>
                  <td className="border border-[#d1d5db] p-1.5 align-middle">Berat Badan</td>
                  <td className="border border-[#d1d5db] p-1.5 text-center align-middle">{infoTambahan?.beratBadan || "-"} kg</td>
                </tr>
                <tr>
                  <td className="border border-[#d1d5db] p-1.5 align-middle">Tinggi Badan</td>
                  <td className="border border-[#d1d5db] p-1.5 text-center align-middle">{infoTambahan?.tinggiBadan || "-"} cm</td>
                </tr>
                <tr>
                  <td className="border border-[#d1d5db] p-1.5 align-middle">Lingkar Kepala</td>
                  <td className="border border-[#d1d5db] p-1.5 text-center align-middle">{infoTambahan?.lingkarKepala || "-"} cm</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div>
            <h4 className="font-bold mb-1 text-xs">Kehadiran</h4>
            <table className="w-full text-xs border-collapse border border-[#d1d5db]">
              <tbody>
                <tr>
                  <td className="border border-[#d1d5db] p-1.5 align-middle">Sakit</td>
                  <td className="border border-[#d1d5db] p-1.5 text-center align-middle">{infoTambahan?.sakit || 0} hari</td>
                </tr>
                <tr>
                  <td className="border border-[#d1d5db] p-1.5 align-middle">Ijin</td>
                  <td className="border border-[#d1d5db] p-1.5 text-center align-middle">{infoTambahan?.ijin || 0} hari</td>
                </tr>
                <tr>
                  <td className="border border-[#d1d5db] p-1.5 align-middle">Tanpa Keterangan</td>
                  <td className="border border-[#d1d5db] p-1.5 text-center align-middle">{infoTambahan?.alpa || 0} hari</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

       {/* TTD */}
       <div className="flex justify-between items-start pt-8 text-center break-inside-avoid text-sm">
            <div>
                <p className="mb-16">Mengetahui,</p>
                <p className="font-bold underline">Kepala Sekolah</p>
                <p className="font-bold">{namaKepalaSekolah}</p>
            </div>
            <div>
                <p className="mb-16">Wali Kelas,</p>
                <p className="font-bold underline">{namaWaliKelas}</p>
                <p className="font-bold"></p>
            </div>
        </div>

    </div>
    </>
  );
};

export default TemplateRapor;
