"use client";

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  orderBy,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDoc,
} from "firebase/firestore";
import { Plus, Pencil, Trash2, X, Loader2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

// --- INTERFACES ---
interface ProgramRekrutmen {
  id: string;
  nama: string;
}

interface Pertanyaan {
  id: string;
  pertanyaan: string;
  urutan: number;
  tipeJawaban: 'Jawaban Terbuka' | 'Pilihan Ganda' | 'Upload File';
  pilihan?: string[];
}

const initialFormData = {
  pertanyaan: "",
  urutan: 1,
  tipeJawaban: 'Jawaban Terbuka' as Pertanyaan['tipeJawaban'],
  pilihan: [""],
};

export default function DetailPertanyaanPage() {
  const params = useParams();
  const router = useRouter();
  const programId = params.id as string;

  // --- STATE MANAGEMENT ---
  const [program, setProgram] = useState<ProgramRekrutmen | null>(null);
  const [pertanyaanList, setPertanyaanList] = useState<Pertanyaan[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<any>(initialFormData);

  // --- DATA FETCHING ---
  const fetchData = useCallback(async () => {
    if (!programId) return;
    setLoading(true);
    try {
      // Fetch program details
      const programDoc = await getDoc(doc(db, "rekrutmen_program", programId));
      if (!programDoc.exists()) {
        alert("Program tidak ditemukan.");
        router.push("/admin/rekrutmen/program");
        return;
      }
      setProgram({ id: programDoc.id, ...programDoc.data() } as ProgramRekrutmen);

      // Fetch questions for the program
      const q = query(collection(db, `rekrutmen_program/${programId}/pertanyaan`), orderBy("urutan", "asc"));
      const snapshot = await getDocs(q);
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Pertanyaan));
      setPertanyaanList(list);
    } catch (error) {
      console.error("Error fetching data: ", error);
      alert("Gagal memuat data.");
    } finally {
      setLoading(false);
    }
  }, [programId, router]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // --- MODAL & FORM HANDLERS ---
  const openModal = (pertanyaan: Pertanyaan | null = null) => {
    if (pertanyaan) {
      setEditingId(pertanyaan.id);
      setFormData({
        pertanyaan: pertanyaan.pertanyaan,
        urutan: pertanyaan.urutan,
        tipeJawaban: pertanyaan.tipeJawaban,
        pilihan: pertanyaan.pilihan || [""],
      });
    } else {
      setEditingId(null);
      const nextUrutan = pertanyaanList.length > 0 ? Math.max(...pertanyaanList.map(p => p.urutan)) + 1 : 1;
      setFormData({ ...initialFormData, urutan: nextUrutan });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => setIsModalOpen(false);

  const handlePilihanChange = (index: number, value: string) => {
    const newPilihan = [...formData.pilihan];
    newPilihan[index] = value;
    setFormData({ ...formData, pilihan: newPilihan });
  };

  const addPilihan = () => {
    setFormData({ ...formData, pilihan: [...formData.pilihan, ""] });
  };

  const removePilihan = (index: number) => {
    if (formData.pilihan.length <= 1) return;
    const newPilihan = formData.pilihan.filter((_: any, i: number) => i !== index);
    setFormData({ ...formData, pilihan: newPilihan });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const dataToSave: any = {
      pertanyaan: formData.pertanyaan,
      urutan: Number(formData.urutan),
      tipeJawaban: formData.tipeJawaban,
    };

    if (formData.tipeJawaban === 'Pilihan Ganda') {
      dataToSave.pilihan = formData.pilihan.filter((p: string) => p.trim() !== "");
    }

    try {
      const collectionRef = collection(db, `rekrutmen_program/${programId}/pertanyaan`);
      if (editingId) {
        await updateDoc(doc(collectionRef, editingId), dataToSave);
        alert("Pertanyaan berhasil diperbarui.");
      } else {
        await addDoc(collectionRef, dataToSave);
        alert("Pertanyaan berhasil ditambahkan.");
      }
      fetchData(); // Refresh list
      closeModal();
    } catch (error) {
      console.error("Error saving pertanyaan:", error);
      alert("Gagal menyimpan pertanyaan.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Yakin ingin menghapus pertanyaan ini?")) return;
    try {
      await deleteDoc(doc(db, `rekrutmen_program/${programId}/pertanyaan`, id));
      setPertanyaanList(prev => prev.filter(p => p.id !== id));
      alert("Pertanyaan berhasil dihapus.");
    } catch (error) {
      console.error("Error deleting pertanyaan:", error);
      alert("Gagal menghapus pertanyaan.");
    }
  };

  // --- RENDER ---
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <Link href="/admin/rekrutmen/program" className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 mb-2">
            <ArrowLeft className="w-4 h-4" />
            Kembali ke Daftar Program
          </Link>
          <h1 className="text-2xl font-bold text-gray-800">Daftar Pertanyaan</h1>
          <p className="text-gray-600">Program: {program?.nama || "Memuat..."}</p>
        </div>
        <button
          onClick={() => openModal()}
          className="bg-[#581c87] text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-[#45156b] transition"
        >
          <Plus className="w-4 h-4" /> Tambah Pertanyaan
        </button>
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50 text-gray-900 font-semibold border-b">
              <tr>
                <th className="p-4">Pertanyaan</th>
                <th className="p-4 w-24 text-center">Urutan</th>
                <th className="p-4 w-48">Tipe Jawaban</th>
                <th className="p-4 w-32 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={4} className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-[#581c87]" /></td></tr>
              ) : pertanyaanList.length === 0 ? (
                <tr><td colSpan={4} className="p-8 text-center text-gray-500">Belum ada pertanyaan untuk program ini.</td></tr>
              ) : (
                pertanyaanList.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="p-4 font-medium text-gray-900">{item.pertanyaan}</td>
                    <td className="p-4 text-center">{item.urutan}</td>
                    <td className="p-4">{item.tipeJawaban}</td>
                    <td className="p-4 flex justify-center items-center gap-2">
                      <button onClick={() => openModal(item)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition" title="Edit"><Pencil className="w-4 h-4" /></button>
                      <button onClick={() => handleDelete(item.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition" title="Hapus"><Trash2 className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl">
            <div className="p-4 border-b flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-gray-800">{editingId ? 'Edit' : 'Tambah'} Pertanyaan</h3>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Pertanyaan</label>
                <textarea value={formData.pertanyaan} onChange={e => setFormData({...formData, pertanyaan: e.target.value})} className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#581c87] outline-none" rows={3} required />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Urutan</label>
                  <input type="number" value={formData.urutan} onChange={e => setFormData({...formData, urutan: e.target.value})} className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#581c87] outline-none" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipe Jawaban</label>
                  <select value={formData.tipeJawaban} onChange={e => setFormData({...formData, tipeJawaban: e.target.value})} className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#581c87] outline-none bg-white" required>
                    <option value="Jawaban Terbuka">Jawaban Terbuka</option>
                    <option value="Pilihan Ganda">Pilihan Ganda</option>
                    <option value="Upload File">Upload File</option>
                  </select>
                </div>
              </div>

              {/* Conditional Field for Pilihan Ganda */}
              {formData.tipeJawaban === 'Pilihan Ganda' && (
                <div className="p-4 border border-dashed rounded-lg space-y-3">
                  <label className="block text-sm font-medium text-gray-700">Opsi Pilihan Ganda</label>
                  {formData.pilihan.map((pilihan: string, index: number) => (
                    <div key={index} className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder={`Pilihan ${index + 1}`}
                        value={pilihan}
                        onChange={e => handlePilihanChange(index, e.target.value)}
                        className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-[#581c87] outline-none"
                      />
                      <button type="button" onClick={() => removePilihan(index)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg" disabled={formData.pilihan.length <= 1}>
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  <button type="button" onClick={addPilihan} className="text-sm text-[#581c87] font-medium flex items-center gap-1 hover:underline">
                    <Plus className="w-4 h-4" /> Tambah Pilihan
                  </button>
                </div>
              )}

              <div className="pt-4 flex justify-end gap-3">
                <button type="button" onClick={closeModal} className="px-4 py-2 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-200">Batal</button>
                <button type="submit" disabled={isSubmitting} className="bg-[#581c87] text-white px-4 py-2 rounded-lg text-sm hover:bg-[#45156b] transition disabled:opacity-50">
                  {isSubmitting ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}