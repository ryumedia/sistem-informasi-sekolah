// src/app/admin/siswa/page.tsx
"use client";

import { useState, useEffect } from "react";
import { db, firebaseConfig } from "@/lib/firebase";
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy } from "firebase/firestore";
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import { Plus, X, Pencil, Trash2, Search, Lock } from "lucide-react";

interface Siswa {
  id: string;
  nama: string;
  namaOrangTua: string;
  kelas: string;
  cabang: string;
  email: string;
  status: string;
}

export default function DataSiswaPage() {
  const [siswaList, setSiswaList] = useState<Siswa[]>([]);
  const [cabangList, setCabangList] = useState<any[]>([]);
  const [kelasList, setKelasList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  
  // Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCabang, setFilterCabang] = useState("");
  const [filterKelas, setFilterKelas] = useState("");

  // State Form
  const [formData, setFormData] = useState({
    nama: "",
    namaOrangTua: "",
    kelas: "",
    cabang: "",
    email: "",
    password: "",
    status: "Aktif",
  });

  // Fetch Data Siswa
  const fetchSiswa = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, "siswa"), orderBy("nama", "asc"));
      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Siswa[];
      setSiswaList(data);
    } catch (error) {
      console.error("Error fetching siswa:", error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch Data Cabang
  useEffect(() => {
    fetchSiswa();
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
    const fetchKelas = async () => {
      try {
        const q = query(collection(db, "kelas"), orderBy("namaKelas", "asc"));
        const querySnapshot = await getDocs(q);
        const data = querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setKelasList(data);
      } catch (error) {
        console.error("Error fetching kelas:", error);
      }
    };
    fetchCabang();
    fetchKelas();
  }, []);

  // Handle Submit (Tambah/Edit)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editId) {
        // Update data siswa (tanpa ubah password/auth)
        await updateDoc(doc(db, "siswa", editId), {
          nama: formData.nama,
          namaOrangTua: formData.namaOrangTua,
          kelas: formData.kelas,
          cabang: formData.cabang,
          email: formData.email,
          status: formData.status,
        });
        alert("Data siswa berhasil diperbarui!");
      } else {
        // 1. Buat User di Firebase Auth (gunakan Secondary App)
        const secondaryApp = initializeApp(firebaseConfig, "Secondary");
        const secondaryAuth = getAuth(secondaryApp);
        const userCredential = await createUserWithEmailAndPassword(secondaryAuth, formData.email, formData.password);
        await deleteApp(secondaryApp);

        // 2. Simpan ke Firestore dengan Role 'Siswa' & UID
        await addDoc(collection(db, "siswa"), {
          nama: formData.nama,
          namaOrangTua: formData.namaOrangTua,
          kelas: formData.kelas,
          cabang: formData.cabang,
          email: formData.email,
          status: formData.status,
          role: "Siswa",
          uid: userCredential.user.uid,
          createdAt: new Date(),
        });
        alert("Siswa baru berhasil ditambahkan sebagai User!");
      }
      closeModal();
      fetchSiswa();
    } catch (error: any) {
      console.error("Error saving siswa:", error);
      alert("Gagal menyimpan data: " + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Delete
  const handleDelete = async (id: string) => {
    if (confirm("Yakin ingin menghapus data siswa ini?")) {
      try {
        await deleteDoc(doc(db, "siswa", id));
        alert("Data siswa berhasil dihapus.");
        fetchSiswa();
      } catch (error) {
        console.error("Error deleting:", error);
        alert("Gagal menghapus data.");
      }
    }
  };

  const handleEdit = (siswa: Siswa) => {
    setEditId(siswa.id);
    setFormData({
      nama: siswa.nama,
      namaOrangTua: siswa.namaOrangTua,
      kelas: siswa.kelas,
      cabang: siswa.cabang,
      email: siswa.email,
      status: siswa.status,
      password: "",
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditId(null);
    setFormData({ nama: "", namaOrangTua: "", kelas: "", cabang: "", email: "", password: "", status: "Aktif" });
  };

  // Logic Filter
  const filteredSiswa = siswaList.filter((siswa) => {
    const matchSearch = siswa.nama.toLowerCase().includes(searchQuery.toLowerCase()) || 
                        siswa.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchCabang = filterCabang ? siswa.cabang === filterCabang : true;
    const matchKelas = filterKelas ? siswa.kelas === filterKelas : true;
    
    return matchSearch && matchCabang && matchKelas;
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">Data Siswa</h1>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-[#581c87] text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-[#45156b] transition"
        >
          <Plus className="w-4 h-4" /> Tambah Siswa
        </button>
      </div>

      {/* Filter Section */}
      <div className="flex flex-col md:flex-row gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Cari nama siswa atau email..."
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#581c87] outline-none text-gray-900"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <select
          className="border rounded-lg px-4 py-2 bg-white focus:ring-2 focus:ring-[#581c87] outline-none text-gray-900"
          value={filterCabang}
          onChange={(e) => setFilterCabang(e.target.value)}
        >
          <option value="">Semua Cabang</option>
          {cabangList.map((c) => <option key={c.id} value={c.nama}>{c.nama}</option>)}
        </select>
        <select
          className="border rounded-lg px-4 py-2 bg-white focus:ring-2 focus:ring-[#581c87] outline-none text-gray-900"
          value={filterKelas}
          onChange={(e) => setFilterKelas(e.target.value)}
        >
          <option value="">Semua Kelas</option>
          {kelasList
            .filter((k) => !filterCabang || k.cabang === filterCabang)
            .map((k) => <option key={k.id} value={k.namaKelas}>{k.namaKelas}</option>)}
        </select>
      </div>

      {/* Tabel Data */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600 min-w-[1000px]">
          <thead className="bg-gray-50 text-gray-900 font-semibold border-b">
            <tr>
              <th className="p-4 w-16">No</th>
              <th className="p-4">Nama Siswa</th>
              <th className="p-4">Nama Orang Tua</th>
              <th className="p-4">Cabang</th>
              <th className="p-4">Kelas</th>
              <th className="p-4">Email</th>
              <th className="p-4">Status</th>
              <th className="p-4">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={8} className="p-8 text-center">Memuat data...</td></tr>
            ) : filteredSiswa.length === 0 ? (
              <tr><td colSpan={8} className="p-8 text-center">Data tidak ditemukan.</td></tr>
            ) : (
              filteredSiswa.map((siswa, index) => (
                <tr key={siswa.id} className="hover:bg-gray-50">
                  <td className="p-4 text-center">{index + 1}</td>
                  <td className="p-4 font-medium text-gray-900">{siswa.nama}</td>
                  <td className="p-4">{siswa.namaOrangTua}</td>
                  <td className="p-4">{siswa.cabang}</td>
                  <td className="p-4">
                    <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs font-medium">
                      {siswa.kelas}
                    </span>
                  </td>
                  <td className="p-4 text-gray-500">{siswa.email}</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      siswa.status === 'Aktif' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {siswa.status}
                    </span>
                  </td>
                  <td className="p-4 flex gap-2">
                    <button onClick={() => handleEdit(siswa)} className="p-2 text-[#581c87] hover:bg-[#581c87]/10 rounded-lg transition" title="Edit">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(siswa.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition" title="Hapus">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>
      </div>

      {/* Modal Tambah/Edit */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden">
            <div className="p-4 border-b flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-gray-800">{editId ? "Edit Data Siswa" : "Tambah Siswa Baru"}</h3>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nama Siswa</label>
                  <input required type="text" className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#581c87] outline-none text-gray-900"
                    value={formData.nama} onChange={(e) => setFormData({...formData, nama: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nama Orang Tua</label>
                  <input required type="text" className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#581c87] outline-none text-gray-900"
                    value={formData.namaOrangTua} onChange={(e) => setFormData({...formData, namaOrangTua: e.target.value})} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cabang</label>
                  <select required className="w-full border rounded-lg p-2 bg-white focus:ring-2 focus:ring-[#581c87] outline-none text-gray-900"
                    value={formData.cabang} onChange={(e) => setFormData({...formData, cabang: e.target.value})}>
                    <option value="">Pilih Cabang</option>
                    {cabangList.map((c) => <option key={c.id} value={c.nama}>{c.nama}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Kelas</label>
                  <select required className="w-full border rounded-lg p-2 bg-white focus:ring-2 focus:ring-[#581c87] outline-none text-gray-900"
                    value={formData.kelas} onChange={(e) => setFormData({...formData, kelas: e.target.value})}>
                    <option value="">Pilih Kelas</option>
                    {kelasList
                      .filter((k) => !formData.cabang || k.cabang === formData.cabang)
                      .map((k) => <option key={k.id} value={k.namaKelas}>{k.namaKelas}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email (Login)</label>
                <input required type="email" className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#581c87] outline-none text-gray-900"
                  value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} />
              </div>

              {!editId && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                    <input required type="text" minLength={6} className="w-full pl-9 border rounded-lg p-2 focus:ring-2 focus:ring-[#581c87] outline-none text-gray-900"
                      value={formData.password} onChange={(e) => setFormData({...formData, password: e.target.value})} placeholder="Min. 6 karakter" />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select className="w-full border rounded-lg p-2 bg-white focus:ring-2 focus:ring-[#581c87] outline-none text-gray-900"
                  value={formData.status} onChange={(e) => setFormData({...formData, status: e.target.value})}>
                  <option value="Aktif">Aktif</option>
                  <option value="Nonaktif">Nonaktif</option>
                  <option value="Lulus">Lulus</option>
                  <option value="Pindah">Pindah</option>
                </select>
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
