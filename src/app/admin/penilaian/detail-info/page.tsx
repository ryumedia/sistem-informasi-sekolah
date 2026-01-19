"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { doc, getDoc, collection, query, where, getDocs, writeBatch, serverTimestamp } from "firebase/firestore";
import { ArrowLeft, Loader2, Save } from "lucide-react";

export default function DetailInfoPage() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  const router = useRouter();
  const [infoData, setInfoData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    const fetchData = async () => {
      try {
        const docRef = doc(db, "info_tambahan_rapor", id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setInfoData({ id: docSnap.id, ...docSnap.data() });
        }
      } catch (error) {
        console.error("Error fetching detail:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  useEffect(() => {
    if (!infoData) return;

    const fetchStudentsAndData = async () => {
      try {
        // 1. Fetch Siswa berdasarkan Kelas & Cabang
        const qSiswa = query(
          collection(db, "siswa"),
          where("kelas", "==", infoData.kelas),
          where("cabang", "==", infoData.cabang)
        );
        const siswaSnap = await getDocs(qSiswa);
        const siswaList = siswaSnap.docs.map((doc) => ({
          id: doc.id,
          nama: doc.data().nama,
          ...doc.data(),
        }));

        // Sort siswa by name alphabetically
        siswaList.sort((a: any, b: any) => a.nama.localeCompare(b.nama));

        // 2. Fetch Data Info Tambahan Siswa yang sudah ada
        const qData = query(
          collection(db, "info_tambahan_siswa"),
          where("infoTambahanId", "==", infoData.id)
        );
        const dataSnap = await getDocs(qData);
        const existingDataMap = new Map();
        dataSnap.forEach((doc) => {
          existingDataMap.set(doc.data().siswaId, { docId: doc.id, ...doc.data() });
        });

        // 3. Merge Data
        const mergedData = siswaList.map((s) => {
          const existing = existingDataMap.get(s.id) || {};
          return {
            siswaId: s.id,
            nama: s.nama,
            docId: existing.docId || null,
            beratBadan: existing.beratBadan || "",
            tinggiBadan: existing.tinggiBadan || "",
            lingkarKepala: existing.lingkarKepala || "",
            sakit: existing.sakit || 0,
            ijin: existing.ijin || 0,
            alpa: existing.alpa || 0,
          };
        });

        setStudents(mergedData);
      } catch (error) {
        console.error("Error fetching students data:", error);
      }
    };

    fetchStudentsAndData();
  }, [infoData]);

  const handleInputChange = (index: number, field: string, value: any) => {
    const newStudents = [...students];
    newStudents[index] = { ...newStudents[index], [field]: value };
    setStudents(newStudents);
  };

  const handleSaveAll = async () => {
    setIsSaving(true);
    try {
      const batch = writeBatch(db);
      
      students.forEach((student) => {
        const dataToSave = {
          infoTambahanId: infoData.id,
          siswaId: student.siswaId,
          beratBadan: student.beratBadan,
          tinggiBadan: student.tinggiBadan,
          lingkarKepala: student.lingkarKepala,
          sakit: Number(student.sakit),
          ijin: Number(student.ijin),
          alpa: Number(student.alpa),
          updatedAt: serverTimestamp(),
        };

        if (student.docId) {
          const ref = doc(db, "info_tambahan_siswa", student.docId);
          batch.update(ref, dataToSave);
        } else {
          const ref = doc(collection(db, "info_tambahan_siswa"));
          batch.set(ref, dataToSave);
        }
      });

      await batch.commit();
      alert("Data berhasil disimpan!");
      window.location.reload(); // Reload to refresh docIds
    } catch (error) {
      console.error("Error saving batch:", error);
      alert("Gagal menyimpan data.");
    } finally {
      setIsSaving(false);
    }
  };

  if (!id) return <div className="p-8 text-center text-gray-500">ID tidak ditemukan</div>;
  if (loading) return <div className="p-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-[#581c87]" /></div>;
  if (!infoData) return <div className="p-8 text-center text-gray-500">Data tidak ditemukan</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => router.back()} 
            className="p-2 hover:bg-gray-100 rounded-full transition"
            title="Kembali"
          >
            <ArrowLeft className="w-6 h-6 text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Detail Informasi Tambahan</h1>
            <p className="text-gray-500 text-sm">{infoData.cabang} • {infoData.kelas} • {infoData.semester}</p>
          </div>
        </div>
        <button 
          onClick={handleSaveAll}
          disabled={isSaving}
          className="bg-[#581c87] text-white px-4 py-2 rounded-lg hover:bg-[#45156b] transition flex items-center gap-2 disabled:opacity-70"
        >
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Simpan Perubahan
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left min-w-[1000px]">
            <thead className="bg-gray-50 text-gray-700 font-semibold border-b">
              <tr>
                <th className="p-4 w-12 text-center">No</th>
                <th className="p-4 min-w-[200px]">Nama Siswa</th>
                <th className="p-4 w-32">Berat Badan (kg)</th>
                <th className="p-4 w-32">Tinggi Badan (cm)</th>
                <th className="p-4 w-32">Lingkar Kepala (cm)</th>
                <th className="p-4 w-20 text-center">Sakit</th>
                <th className="p-4 w-20 text-center">Ijin</th>
                <th className="p-4 w-20 text-center">Tanpa Ket.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {students.length === 0 ? (
                <tr><td colSpan={8} className="p-8 text-center text-gray-500">Tidak ada siswa di kelas ini.</td></tr>
              ) : (
                students.map((student, index) => (
                  <tr key={student.siswaId} className="hover:bg-gray-50">
                    <td className="p-4 text-center">{index + 1}</td>
                    <td className="p-4 font-medium text-gray-900">{student.nama}</td>
                    <td className="p-4">
                      <input 
                        type="text" 
                        className="w-full border rounded px-2 py-1 focus:ring-2 focus:ring-[#581c87] outline-none"
                        value={student.beratBadan}
                        onChange={(e) => handleInputChange(index, 'beratBadan', e.target.value)}
                        placeholder="0"
                      />
                    </td>
                    <td className="p-4">
                      <input 
                        type="text" 
                        className="w-full border rounded px-2 py-1 focus:ring-2 focus:ring-[#581c87] outline-none"
                        value={student.tinggiBadan}
                        onChange={(e) => handleInputChange(index, 'tinggiBadan', e.target.value)}
                        placeholder="0"
                      />
                    </td>
                    <td className="p-4">
                      <input 
                        type="text" 
                        className="w-full border rounded px-2 py-1 focus:ring-2 focus:ring-[#581c87] outline-none"
                        value={student.lingkarKepala}
                        onChange={(e) => handleInputChange(index, 'lingkarKepala', e.target.value)}
                        placeholder="0"
                      />
                    </td>
                    <td className="p-4">
                      <input 
                        type="number" 
                        min="0"
                        className="w-full border rounded px-2 py-1 focus:ring-2 focus:ring-[#581c87] outline-none text-center"
                        value={student.sakit}
                        onChange={(e) => handleInputChange(index, 'sakit', e.target.value)}
                      />
                    </td>
                    <td className="p-4">
                      <input 
                        type="number" 
                        min="0"
                        className="w-full border rounded px-2 py-1 focus:ring-2 focus:ring-[#581c87] outline-none text-center"
                        value={student.ijin}
                        onChange={(e) => handleInputChange(index, 'ijin', e.target.value)}
                      />
                    </td>
                    <td className="p-4">
                      <input 
                        type="number" 
                        min="0"
                        className="w-full border rounded px-2 py-1 focus:ring-2 focus:ring-[#581c87] outline-none text-center"
                        value={student.alpa}
                        onChange={(e) => handleInputChange(index, 'alpa', e.target.value)}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}