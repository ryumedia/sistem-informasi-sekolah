"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { db, auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  orderBy,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  Timestamp,
  QuerySnapshot,
} from "firebase/firestore";
import { ArrowLeft, Loader2, User, Plus, Calendar, Pencil, Trash2, X, BookText } from "lucide-react";

// --- Interface Definitions ---
interface Siswa {
  id: string;
  nama: string;
  kelas: string;
  foto?: string;
}

interface CatatanAnekdotal {
  id: string;
  tanggalKejadian: Timestamp;
  peristiwa: string;
  solusi: string;
  guruId: string;
  guruNama: string;
  createdAt: Timestamp;
}

interface CatatanFormData {
  tanggalKejadian: string;
  peristiwa: string;
  solusi: string;
}

// --- Helper Functions ---
const formatDate = (timestamp: Timestamp | undefined) => {
  if (!timestamp) return "-";
  return timestamp.toDate().toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};

const formatDateForInput = (date: Date): string => {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function CatatanAnekdotalClient({ siswaId }: { siswaId: string }) {
  const router = useRouter();

  // --- State Management ---
  const [loading, setLoading] = useState(true);
  const [siswa, setSiswa] = useState<Siswa | null>(null);
  const [catatanList, setCatatanList] = useState<CatatanAnekdotal[]>([]);
  const [guruData, setGuruData] = useState<any>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCatatan, setEditingCatatan] = useState<CatatanAnekdotal | null>(null);
  const [formData, setFormData] = useState<CatatanFormData>({
    tanggalKejadian: formatDateForInput(new Date()),
    peristiwa: "",
    solusi: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [triggerFetch, setTriggerFetch] = useState(0);

  useEffect(() => {
    // Guard clause: Jangan jalankan apapun jika siswaId belum ada.
    if (!siswaId) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        // --- Definisikan semua query yang dibutuhkan ---
        const siswaDocRef = doc(db, "siswa", siswaId);
        const catatanQuery = query(
          collection(db, "catatan_anekdotal"),
          where("siswaId", "==", siswaId),
          orderBy("tanggalKejadian", "desc")
        );
        
        let guruPromise: Promise<QuerySnapshot | null> = Promise.resolve(null);
        if (auth.currentUser) {
          const guruQuery = query(collection(db, "guru"), where("email", "==", auth.currentUser.email));
          guruPromise = getDocs(guruQuery);
        }

        // --- Jalankan semua query secara paralel ---
        const [siswaDoc, catatanSnap, guruSnap] = await Promise.all([
          getDoc(siswaDocRef),
          getDocs(catatanQuery),
          guruPromise,
        ]);

        // --- Proses hasil query ---
        if (siswaDoc.exists()) {
          setSiswa({ id: siswaDoc.id, ...siswaDoc.data() } as Siswa);
        }

        const list = catatanSnap.docs.map(d => ({ id: d.id, ...d.data() } as CatatanAnekdotal));
        setCatatanList(list);

        if (guruSnap && !guruSnap.empty) {
          setGuruData({ id: guruSnap.docs[0].id, ...guruSnap.docs[0].data() });
        }
      } catch (error) {
        console.error("Error fetching page data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [siswaId, triggerFetch]);

  const openModal = (catatan: CatatanAnekdotal | null = null) => {
    setEditingCatatan(catatan);
    if (catatan) {
      setFormData({
        tanggalKejadian: formatDateForInput(catatan.tanggalKejadian.toDate()),
        peristiwa: catatan.peristiwa,
        solusi: catatan.solusi,
      });
    } else {
      setFormData({
        tanggalKejadian: formatDateForInput(new Date()),
        peristiwa: "",
        solusi: "",
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingCatatan(null);
  };

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guruData) return;
    setIsSubmitting(true);

    const dataToSave = {
      ...formData,
      tanggalKejadian: Timestamp.fromDate(new Date(formData.tanggalKejadian)),
      siswaId: siswaId,
      guruId: guruData.id,
      guruNama: guruData.nama,
    };

    try {
      if (editingCatatan) {
        // Update existing
        const docRef = doc(db, "catatan_anekdotal", editingCatatan.id);
        await updateDoc(docRef, dataToSave);
      } else {
        // Create new
        await addDoc(collection(db, "catatan_anekdotal"), {
          ...dataToSave,
          createdAt: Timestamp.now(),
        });
      }
      closeModal();
      setTriggerFetch(prev => prev + 1); // Re-fetch data
    } catch (error) {
      console.error("Error saving catatan:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Apakah Anda yakin ingin menghapus catatan ini?")) {
      try {
        await deleteDoc(doc(db, "catatan_anekdotal", id));
        setTriggerFetch(prev => prev + 1); // Re-fetch data
      } catch (error) {
        console.error("Error deleting catatan:", error);
      }
    }
  };

  // --- Render Logic ---
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50"><Loader2 className="w-8 h-8 animate-spin text-[#581c87]" /></div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex justify-center">
      <div className="w-full max-w-lg bg-white min-h-screen shadow-xl flex flex-col">
        {/* Header */}
        <header className="bg-white p-4 shadow-sm sticky top-0 z-20 flex items-center gap-3">
          <button onClick={() => router.push("/guru/daftar-siswa")} className="p-2 hover:bg-gray-100 rounded-full transition">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div className="flex items-center gap-3">
            {siswa?.foto ? (
              <img src={siswa.foto} alt={siswa.nama} className="w-10 h-10 rounded-full object-cover bg-gray-100" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-500">
                <User className="w-5 h-5" />
              </div>
            )}
            <div>
              <h1 className="text-lg font-bold text-gray-800">{siswa?.nama || "Siswa"}</h1>
              <p className="text-xs text-gray-500">Catatan Anekdotal</p>
            </div>
          </div>
        </header>

        {/* Add Button */}
        <div className="p-4 border-b border-gray-100">
          <button 
            onClick={() => openModal()} 
            disabled={!guruData}
            className="w-full bg-[#581c87] text-white py-3 rounded-lg flex items-center justify-center gap-2 hover:bg-[#45156b] transition font-medium disabled:opacity-50 disabled:cursor-wait"
          >
            {guruData ? <><Plus className="w-5 h-5" /> Tambah Catatan</> : "Verifikasi akses..."}
          </button>
        </div>

        {/* Content List */}
        <div className="p-4 space-y-3 flex-1">
          {catatanList.length === 0 ? (
            <div className="text-center py-16 bg-gray-50 rounded-xl border border-dashed border-gray-200">
              <BookText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h3 className="font-semibold text-gray-700">Belum Ada Catatan</h3>
              <p className="text-gray-500 text-sm mt-1">Mulai tambahkan catatan anekdotal untuk siswa ini.</p>
            </div>
          ) : (
            catatanList.map(catatan => (
              <div key={catatan.id} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Calendar className="w-4 h-4 text-purple-500" />
                      <p className="font-bold text-gray-800 text-sm">{formatDate(catatan.tanggalKejadian)}</p>
                    </div>
                    <p className="text-xs text-gray-500">Dicatat oleh: {catatan.guruNama}</p>
                  </div>
                  <div className="flex gap-1">
                    <button 
                      onClick={() => handleDelete(catatan.id)} 
                      disabled={!guruData}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-full transition disabled:opacity-30"
                    ><Trash2 className="w-4 h-4" /></button>
                    <button 
                      onClick={() => openModal(catatan)} 
                      disabled={!guruData}
                      className="p-2 text-blue-500 hover:bg-blue-50 rounded-full transition disabled:opacity-30"
                    ><Pencil className="w-4 h-4" /></button>
                  </div>
                </div>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs font-semibold text-gray-500 mb-1">Peristiwa:</p>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{catatan.peristiwa}</p>
                  </div>
                  <div className="border-t pt-2">
                    <p className="text-xs font-semibold text-gray-500 mb-1">Solusi:</p>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{catatan.solusi}</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] flex flex-col">
            <div className="p-4 border-b flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-gray-800">{editingCatatan ? "Edit" : "Tambah"} Catatan Anekdotal</h3>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Tanggal Kejadian</label>
                <input required type="date" name="tanggalKejadian" value={formData.tanggalKejadian} onChange={handleFormChange} className="w-full border rounded-lg p-2 text-sm text-gray-900" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Peristiwa</label>
                <textarea required name="peristiwa" value={formData.peristiwa} onChange={handleFormChange} rows={5} className="w-full border rounded-lg p-2 text-sm text-gray-900" placeholder="Jelaskan peristiwa yang terjadi..."></textarea>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Solusi</label>
                <textarea required name="solusi" value={formData.solusi} onChange={handleFormChange} rows={3} className="w-full border rounded-lg p-2 text-sm text-gray-900" placeholder="Tindakan atau solusi yang diberikan..."></textarea>
              </div>
              <div className="pt-2">
                <button disabled={isSubmitting} type="submit" className="w-full bg-[#581c87] text-white py-3 rounded-lg hover:bg-[#45156b] transition font-medium disabled:opacity-50">
                  {isSubmitting ? "Menyimpan..." : "Simpan Catatan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}