import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

interface Siswa {
  id: string;
  nama: string;
  kelas: string;
  nis: string;
  nisn: string;
  fotoUrl?: string;
}

interface TemplateRaporProps {
  siswa: Siswa | null | undefined;
  narasi: string;
}

interface Nilai {
    namaDomain: string;
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

const TemplateRapor: React.FC<TemplateRaporProps> = ({ siswa, narasi }) => {
  const [nilaiPerkembangan, setNilaiPerkembangan] = useState<Nilai[]>([]);
  const [nilaiIndikator, setNilaiIndikator] = useState<NilaiIndikator[]>([]);
  const [nilaiTrilogi, setNilaiTrilogi] = useState<NilaiTrilogi[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchNilai = async () => {
      if (!siswa) return;
      setLoading(true);
      try {
        // Fetch Nilai Perkembangan
        const perkembanganQuery = query(collection(db, "nilai-perkembangan"), where("siswaId", "==", siswa.id));
        const perkembanganSnap = await getDocs(perkembanganQuery);
        setNilaiPerkembangan(perkembanganSnap.docs.map(doc => doc.data() as Nilai));

        // Fetch Nilai Indikator
        const indikatorQuery = query(collection(db, "nilai-indikator"), where("siswaId", "==", siswa.id));
        const indikatorSnap = await getDocs(indikatorQuery);
        setNilaiIndikator(indikatorSnap.docs.map(doc => doc.data() as NilaiIndikator));
        
        // Fetch Nilai Trilogi
        const trilogiQuery = query(collection(db, "nilai-trilogi"), where("siswaId", "==", siswa.id));
        const trilogiSnap = await getDocs(trilogiQuery);
        setNilaiTrilogi(trilogiSnap.docs.map(doc => doc.data() as NilaiTrilogi));

      } catch (error) {
        console.error("Error fetching nilai:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchNilai();
  }, [siswa]);

  if (!siswa) {
    return <div className="text-center p-10">Silakan pilih siswa untuk melihat rapor.</div>;
  }
  
  if (loading) {
      return <div className="text-center p-10">Memuat data nilai...</div>;
  }

  return (
    <div className="bg-white font-sans p-8 text-gray-900">
      {/* Header */}
      <div className="flex justify-between items-center border-b-4 border-black pb-4 mb-6">
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
          <div className="font-bold">NIS</div><div>: {siswa.nis}</div>
          <div className="font-bold">Semester</div><div>: 2 (Dua)</div>
          <div className="font-bold">NISN</div><div>: {siswa.nisn}</div>
          <div className="font-bold">Tahun Ajaran</div><div>: 2023/2024</div>
        </div>
        <div className="w-32 h-40 relative border-2 border-gray-300 rounded-lg overflow-hidden">
            <Image src={siswa.fotoUrl || '/images/default-profile.png'} alt="Foto Siswa" layout="fill" objectFit="cover" crossOrigin="anonymous" />
        </div>
      </div>

      {/* A. Narasi Perkembangan */}
      <div className="mb-8 break-inside-avoid">
        <h3 className="text-xl font-bold text-[#581c87] mb-3 border-b-2 border-gray-100 pb-2">A. Narasi Perkembangan</h3>
        <p className="text-justify indent-8">
          {narasi}
        </p>
      </div>

      {/* B. Tahap Perkembangan */}
      <div className="mb-8 break-inside-avoid">
        <h3 className="text-xl font-bold text-[#581c87] mb-3 border-b-2 border-gray-100 pb-2">B. Tahap Perkembangan</h3>
        <table className="w-full text-sm border-collapse border border-gray-300 rounded-lg overflow-hidden">
          <thead className="bg-[#581c87] text-white">
            <tr>
              <th className="p-3 text-left">Domain / Aspek Perkembangan</th>
              <th className="p-3 w-32 text-center">Nilai</th>
            </tr>
          </thead>
          <tbody>
            {nilaiPerkembangan.length === 0 ? (
              <tr><td colSpan={2} className="p-4 text-center italic text-gray-500 border border-gray-300">Tidak ada data penilaian.</td></tr>
            ) : (
                nilaiPerkembangan.map((item, idx) => (
                <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                  <td className="border border-gray-300 p-3">
                    <div className="font-semibold text-gray-800">{item.namaDomain}</div>
                    <div className="text-gray-600 pl-4 mt-1 text-xs">• {item.namaAspek}</div>
                  </td>
                  <td className="border border-gray-300 p-3 text-center font-bold align-middle text-sm">
                    {item.nilai === 4 ? "Sangat Baik" : item.nilai === 3 ? "Baik" : item.nilai === 2 ? "Cukup" : "Kurang"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* C. Indikator Belajar */}
      <div className="mb-8 break-inside-avoid">
        <h3 className="text-xl font-bold text-[#581c87] mb-3 border-b-2 border-gray-100 pb-2">C. Indikator Belajar</h3>
        <table className="w-full text-sm border-collapse border border-gray-300 rounded-lg overflow-hidden">
          <thead className="bg-[#581c87] text-white">
            <tr>
              <th className="p-3 text-left">Indikator / Sub Indikator</th>
              <th className="p-3 w-32 text-center">Nilai</th>
            </tr>
          </thead>
          <tbody>
            {nilaiIndikator.length === 0 ? (
              <tr><td colSpan={2} className="p-4 text-center italic text-gray-500 border border-gray-300">Tidak ada data penilaian.</td></tr>
            ) : (
                nilaiIndikator.map((item, idx) => (
                <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                  <td className="border border-gray-300 p-3">
                    <div className="font-semibold text-gray-800">{item.namaIndikator}</div>
                    <div className="text-gray-600 pl-4 mt-1 text-xs">• {item.namaSubIndikator}</div>
                  </td>
                  <td className="border border-gray-300 p-3 text-center font-bold align-middle text-sm">
                     {item.nilai === 3 ? "Sudah Muncul" : item.nilai === 2 ? "Muncul Sebagian" : "Belum Muncul"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* D. Trilogi Mainriang */}
      <div className="mb-8 break-inside-avoid">
        <h3 className="text-xl font-bold text-[#581c87] mb-3 border-b-2 border-gray-100 pb-2">D. Trilogi Mainriang</h3>
        <table className="w-full text-sm border-collapse border border-gray-300 rounded-lg overflow-hidden">
          <thead className="bg-[#581c87] text-white">
            <tr>
              <th className="p-3 text-left">Trilogi / Sub Trilogi</th>
              <th className="p-3 w-32 text-center">Nilai</th>
            </tr>
          </thead>
          <tbody>
             {nilaiTrilogi.length === 0 ? (
              <tr><td colSpan={2} className="p-4 text-center italic text-gray-500 border border-gray-300">Tidak ada data penilaian.</td></tr>
            ) : (
              nilaiTrilogi.map((item, idx) => (
                <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                  <td className="border border-gray-300 p-3">
                    <div className="font-semibold text-gray-800">{item.namaTrilogi}</div>
                    <div className="text-gray-600 pl-4 mt-1 text-xs">• {item.namaSubTrilogi}</div>
                  </td>
                  <td className="border border-gray-300 p-3 text-center font-bold align-middle text-sm">
                     {item.nilai === 3 ? "Sudah Muncul" : item.nilai === 2 ? "Muncul Sebagian" : "Belum Muncul"}
                  </td>
                </tr>
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
                <p>NIP. 123456789</p>
            </div>
            <div>
                <p className="mb-20">Wali Kelas,</p>
                <p className="font-bold underline">{siswa.kelas}</p>
                <p>NIP. 987654321</p>
            </div>
        </div>

    </div>
  );
};

export default TemplateRapor;