"use client";

import { useState, useEffect } from "react";
import { db, firebaseConfig } from "@/lib/firebase";
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy } from "firebase/firestore";
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import { Plus, X, Pencil, Trash2, Lock } from "lucide-react";

interface Guru {
  id: string;
  nama: string;
  email: string;
  role: string;
  status: string;
  cabang?: string;
}

export default function DataGuruPage() {
  const [guruList, setGuruList] = useState<Guru[]>([]);
  const [cabangList, setCabangList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  // State untuk Form
  const [formData, setFormData] = useState({
    nama: "",
    email: "",
    password: "", // Tambah state password
    role: "Guru",
    cabang: "",
    status: "Aktif",
  });

  // Fungsi Ambil Data
  const fetchGuru = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, "guru"), orderBy("nama", "asc"));
      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Guru[];
      setGuruList(data);
    } catch (error) {
      console.error("Error fetching guru:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGuru();
    
    // Ambil data cabang untuk dropdown
    const fetchCabang = async () => {
      try {
        const q = query(collection(db, "cabang"), orderBy("nama", "asc"));
        const querySnapshot = await getDocs(q);
        const data = querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setCabangList(data);
      } catch (error) {
        console.error("Error fetching cabang:", error);
      }
    };
    fetchCabang();
  }, []);

  // Fungsi Tambah Data
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editId) {
        // Mode Edit: Update data yang ada
        const docRef = doc(db, "guru", editId);
        await updateDoc(docRef, {
          nama: formData.nama,
          email: formData.email,
          role: formData.role,
          cabang: formData.cabang,
          status: formData.status,
        });
        alert("Berhasil memperbarui data guru!");
      } else {
        // Mode Tambah: Buat data baru
        
        // 1. Buat User di Firebase Authentication (Gunakan Secondary App agar Admin tidak ter-logout)
        const secondaryApp = initializeApp(firebaseConfig, "Secondary");
        const secondaryAuth = getAuth(secondaryApp);
        
        const userCredential = await createUserWithEmailAndPassword(secondaryAuth, formData.email, formData.password);
        
        // Hapus app secondary agar tidak membebani memori
        await deleteApp(secondaryApp);

        // 2. Simpan data profil ke Firestore
        await addDoc(collection(db, "guru"), {
          nama: formData.nama,
          email: formData.email,
          role: formData.role,
          cabang: formData.cabang,
          status: formData.status,
          uid: userCredential.user.uid, // Simpan UID agar terhubung dengan Auth
          createdAt: new Date(),
        });
        
        alert(`Berhasil menambahkan guru baru!\nEmail: ${formData.email}\nPassword: ${formData.password}`);
      }
      
      closeModal();
      fetchGuru(); // Refresh data tabel
    } catch (error) {
      console.error("Error saving document: ", error);
      alert("Gagal menyimpan data. Pastikan email belum terdaftar dan password minimal 6 karakter.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Apakah Anda yakin ingin menghapus data ini?")) {
      try {
        await deleteDoc(doc(db, "guru", id));
        alert("Data berhasil dihapus.");
        fetchGuru();
      } catch (error) {
        console.error("Error deleting: ", error);
        alert("Gagal menghapus data.");
      }
    }
  };

  const handleEdit = (guru: Guru) => {
    setEditId(guru.id);
    setFormData({ nama: guru.nama, email: guru.email, role: guru.role, status: guru.status, password: "", cabang: guru.cabang || "" });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setFormData({ nama: "", email: "", role: "Guru", status: "Aktif", password: "", cabang: "" });
    setEditId(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">Data Guru & Staff</h1>
        <button
          onClick={() => { setEditId(null); setFormData({ nama: "", email: "", role: "Guru", status: "Aktif", password: "", cabang: "" }); setIsModalOpen(true); }}
          className="bg-[#581c87] text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-[#45156b] transition"
        >
          <Plus className="w-4 h-4" /> Tambah Guru
        </button>
      </div>

      {/* Tabel Data */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-left text-sm text-gray-600">
          <thead className="bg-gray-50 text-gray-900 font-semibold border-b">
            <tr>
              <th className="p-4 w-16">No</th>
              <th className="p-4">Nama Lengkap</th>
              <th className="p-4">Email</th>
              <th className="p-4">Role</th>
              <th className="p-4">Cabang</th>
              <th className="p-4">Status</th>
              <th className="p-4">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={7} className="p-8 text-center">Memuat data...</td></tr>
            ) : guruList.length === 0 ? (
              <tr><td colSpan={7} className="p-8 text-center">Belum ada data guru.</td></tr>
            ) : (
              guruList.map((guru, index) => (
                <tr key={guru.id} className="hover:bg-gray-50">
                  <td className="p-4 text-center">{index + 1}</td>
                  <td className="p-4 font-medium text-gray-900">{guru.nama}</td>
                  <td className="p-4">{guru.email}</td>
                  <td className="p-4">
                    <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs font-medium border border-gray-200">
                      {guru.role}
                    </span>
                  </td>
                  <td className="p-4 text-gray-600">{guru.cabang || "-"}</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      guru.status === 'Aktif' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {guru.status}
                    </span>
                  </td>
                  <td className="p-4 flex gap-2">
                    <button onClick={() => handleEdit(guru)} className="p-2 text-[#581c87] hover:bg-[#581c87]/10 rounded-lg transition" title="Edit">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(guru.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition" title="Hapus">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Tambah Guru */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-4 border-b flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-gray-800">{editId ? "Edit Data Guru" : "Tambah Guru Baru"}</h3>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nama Lengkap</label>
                <input required type="text" className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#581c87] outline-none"
                  value={formData.nama} onChange={(e) => setFormData({...formData, nama: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input required type="email" className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#581c87] outline-none"
                  value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} />
              </div>
              
              {/* Field Password hanya muncul saat Tambah Baru */}
              {!editId && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Password (Login)</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                    <input required type="text" minLength={6} className="w-full pl-9 border rounded-lg p-2 focus:ring-2 focus:ring-[#581c87] outline-none"
                      value={formData.password} onChange={(e) => setFormData({...formData, password: e.target.value})} placeholder="Min. 6 karakter" />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cabang Sekolah</label>
                <select className="w-full border rounded-lg p-2 bg-white focus:ring-2 focus:ring-[#581c87] outline-none"
                  value={formData.cabang} onChange={(e) => setFormData({...formData, cabang: e.target.value})}>
                  <option value="">Pilih Cabang</option>
                  {cabangList.map((cabang) => (
                    <option key={cabang.id} value={cabang.nama}>{cabang.nama}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                  <select className="w-full border rounded-lg p-2 bg-white"
                    value={formData.role} onChange={(e) => setFormData({...formData, role: e.target.value})}>
                    <option value="Guru">Guru</option>
                    <option value="Admin">Admin</option>
                    <option value="Kepala Sekolah">Kepala Sekolah</option>
                    <option value="Direktur">Direktur</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select className="w-full border rounded-lg p-2 bg-white"
                    value={formData.status} onChange={(e) => setFormData({...formData, status: e.target.value})}>
                    <option value="Aktif">Aktif</option>
                    <option value="Nonaktif">Nonaktif</option>
                  </select>
                </div>
              </div>
              <button disabled={submitting} type="submit" className="w-full bg-[#581c87] text-white py-2 rounded-lg hover:bg-[#45156b] transition font-medium mt-2">
                {submitting ? "Menyimpan..." : "Simpan Data"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}