"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, query, where, getDocs, addDoc, deleteDoc, doc, serverTimestamp } from "firebase/firestore";
import { ArrowLeft, Loader2, Plus, Trash2, Save, X, FileText, User } from "lucide-react";

export default function CatatanGuruPage() {
  const router = useRouter();
  const [guruData, setGuruData] = useState<any>(null);
  const [siswaList, setSiswaList] = useState<any[]>([]);
  const [catatanList, setCatatanList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    siswaId: "",
    catatan: ""
  });

  // 1. Auth & Get Guru Data
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        router.push("/login");
        return;
      }

      try {
        const qGuru = query(collection(db, "guru"), where("email", "==", currentUser.email));
        const snapshotGuru = await getDocs(qGuru);

        if (!snapshotGuru.empty) {
          const data = snapshotGuru.docs[0].data();
          setGuruData({ id: snapshotGuru.docs[0].id, ...data });
        } else {
          router.push("/");
        }
      } catch (error) {
        console.error("Error fetching guru data:", error);
        router.push("/");
      }
    });
    return () => unsubscribe();
  }, [router]);

  // 2. Fetch Siswa & Catatan based on Guru
  useEffect(() => {
    if (!guruData) return;

    const fetchData = async () => {
      try {
        // A. Fetch Siswa (Logic from daftar-siswa)
        // Cari kelas dimana guru ini terdaftar
        const qKelas = query(
          collection(db, "kelas"),
          where("cabang", "==", guruData.cabang),
          where("guruKelas", "array-contains", guruData.nama)
        );
        const kelasSnap = await getDocs(qKelas);
        const classes = kelasSnap.docs.map(doc => doc.data().namaKelas);

        if (classes.length > 0) {
          const qSiswa = query(
            collection(db, "siswa"),
            where("cabang", "==", guruData.cabang),
            where("kelas", "in", classes)
          );
          const siswaSnap = await getDocs(qSiswa);
          const list = siswaSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          // Sort client-side
          list.sort((a: any, b: any) => (a.nama || "").localeCompare(b.nama || ""));
          setSiswaList(list);
        }

        // B. Fetch Catatan Guru (Notes created by this teacher)
        const qCatatan = query(
            collection(db, "catatan_guru"), 
            where("guruId", "==", guruData.id)
        );
        const catatanSnap = await getDocs(qCatatan);
        const notes = catatanSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Client side sort by date desc
        notes.sort((a: any, b: any) => {
            const dateA = a.createdAt?.seconds || 0;
            const dateB = b.createdAt?.seconds || 0;
            return dateB - dateA;
        });
        
        setCatatanList(notes);

      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [guruData]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.siswaId || !formData.catatan) return;
    
    setSubmitting(true);
    try {
        const selectedSiswa = siswaList.find(s => s.id === formData.siswaId);
        
        const newNote = {
            guruId: guruData.id,
            guruNama: guruData.nama,
            siswaId: formData.siswaId,
            siswaNama: selectedSiswa?.nama || "Unknown",
            catatan: formData.catatan,
            cabang: guruData.cabang,
            createdAt: serverTimestamp()
        };

        const docRef = await addDoc(collection(db, "catatan_guru"), newNote);

        // Update local state immediately for better UX
        setCatatanList(prev => [{ id: docRef.id, ...newNote, createdAt: { seconds: Date.now() / 1000 } }, ...prev]);

        setIsModalOpen(false);
        setFormData({ siswaId: "", catatan: "" });
    } catch (error) {
        console.error("Error saving note:", error);
        alert("Gagal menyimpan catatan.");
    } finally {
        setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
      if(!confirm("Hapus catatan ini?")) return;
      try {
          await deleteDoc(doc(db, "catatan_guru", id));
          setCatatanList(prev => prev.filter(n => n.id !== id));
      } catch (error) {
          console.error("Error deleting:", error);
          alert("Gagal menghapus catatan.");
      }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><Loader2 className="w-8 h-8 animate-spin text-[#581c87]" /></div>;

  return (
    <div className="min-h-screen bg-gray-50 flex justify-center">
      <div className="w-full max-w-lg bg-white min-h-screen shadow-xl flex flex-col">
        {/* Header */}
        <header className="bg-white p-4 shadow-sm sticky top-0 z-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-full transition">
                <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <h1 className="text-lg font-bold text-gray-800">Catatan Guru</h1>
          </div>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-[#581c87] text-white p-2 rounded-full hover:bg-[#45156b] transition shadow-sm"
          >
            <Plus className="w-5 h-5" />
          </button>
        </header>

        {/* Content List */}
        <div className="p-4 space-y-4 pb-20">
            {catatanList.length === 0 ? (
                <div className="text-center py-16 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                    <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <h3 className="font-semibold text-gray-700">Belum Ada Catatan</h3>
                    <p className="text-gray-500 text-sm mt-1">Tekan tombol + untuk membuat catatan baru.</p>
                </div>
            ) : (
                catatanList.map(item => (
                    <div key={item.id} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm hover:shadow-md transition relative group">
                        <div className="flex justify-between items-start mb-2">
                            <div className="flex items-center gap-2">
                                <div className="bg-purple-100 p-1.5 rounded-full text-purple-600">
                                    <User className="w-3 h-3" />
                                </div>
                                <span className="font-bold text-gray-800 text-sm">{item.siswaNama}</span>
                            </div>
                            <span className="text-[10px] text-gray-400">
                                {item.createdAt?.seconds ? new Date(item.createdAt.seconds * 1000).toLocaleDateString("id-ID") : "-"}
                            </span>
                        </div>
                        <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{item.catatan}</p>
                        
                        <button 
                            onClick={() => handleDelete(item.id)}
                            className="absolute top-3 right-3 p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                ))
            )}
        </div>

        {/* Modal Tambah Catatan */}
        {isModalOpen && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
                    <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-xl">
                        <h3 className="font-bold text-gray-800">Tambah Catatan</h3>
                        <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                    <form onSubmit={handleSave} className="p-4 space-y-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Pilih Siswa</label>
                            <select 
                                required
                                className="w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-[#581c87] outline-none bg-white"
                                value={formData.siswaId}
                                onChange={(e) => setFormData({...formData, siswaId: e.target.value})}
                            >
                                <option value="">-- Pilih Siswa --</option>
                                {siswaList.map(s => (
                                    <option key={s.id} value={s.id}>{s.nama}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Isi Catatan</label>
                            <textarea 
                                required
                                rows={5}
                                className="w-full border rounded-lg p-3 text-sm focus:ring-2 focus:ring-[#581c87] outline-none resize-none"
                                placeholder="Tulis catatan perkembangan atau kejadian penting..."
                                value={formData.catatan}
                                onChange={(e) => setFormData({...formData, catatan: e.target.value})}
                            />
                        </div>
                        <button 
                            type="submit" 
                            disabled={submitting}
                            className="w-full bg-[#581c87] text-white py-2.5 rounded-lg hover:bg-[#45156b] transition font-medium flex items-center justify-center gap-2 disabled:opacity-70"
                        >
                            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            Simpan Catatan
                        </button>
                    </form>
                </div>
            </div>
        )}
      </div>
    </div>
  );
}