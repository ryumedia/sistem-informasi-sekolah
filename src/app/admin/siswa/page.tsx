// src/app/admin/siswa/page.tsx
"use client";

import { useState, useEffect } from "react";
import { db, firebaseConfig, auth } from "@/lib/firebase";
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy, where } from "firebase/firestore";
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, onAuthStateChanged } from "firebase/auth";
import { Plus, X, Pencil, Trash2, Search, Lock, FileText } from "lucide-react";

interface Siswa {
  id: string;
  nama: string;
  jenisKelamin: string;
  nisn: string;
  tempatLahir: string;
  tanggalLahir: string;
  agama: string;
  anakKe: string;
  alamat: string;
  namaAyah: string;
  namaIbu: string;
  kelas: string;
  cabang: string;
  email: string;
  status: string;
  foto?: string;
  jenjangUsia?: string;
  uid?: string; // Tambahkan field UID
}

export default function DataSiswaPage() {
  const [siswaList, setSiswaList] = useState<Siswa[]>([]);
  const [cabangList, setCabangList] = useState<any[]>([]);
  const [kelasList, setKelasList] = useState<any[]>([]);
  const [usiaList, setUsiaList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [viewDetail, setViewDetail] = useState<Siswa | null>(null);
  const [userRole, setUserRole] = useState<string>("");
  
  // Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCabang, setFilterCabang] = useState("");
  const [filterKelas, setFilterKelas] = useState("");

  // State Form
  const [formData, setFormData] = useState({
    nama: "",
    jenisKelamin: "Laki-laki",
    nisn: "",
    tempatLahir: "",
    tanggalLahir: "",
    agama: "",
    anakKe: "",
    alamat: "",
    namaAyah: "",
    namaIbu: "",
    kelas: "",
    cabang: "",
    email: "",
    password: "",
    status: "Aktif",
    foto: "",
    jenjangUsia: "",
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
    const fetchUsia = async () => {
      try {
        const q = query(collection(db, "kelompok_usia"), orderBy("usia", "asc"));
        const querySnapshot = await getDocs(q);
        const data = querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setUsiaList(data);
      } catch (error) {
        console.error("Error fetching usia:", error);
      }
    };
    fetchCabang();
    fetchKelas();
    fetchUsia();
  }, []);

  // Cek Role User (Kepala Sekolah hanya bisa lihat cabangnya sendiri)
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        try {
          const q = query(collection(db, "guru"), where("email", "==", currentUser.email));
          const querySnapshot = await getDocs(q);
          if (!querySnapshot.empty) {
            const userData = querySnapshot.docs[0].data();
            setUserRole(userData.role);
            if (userData.role === "Kepala Sekolah") {
              setFilterCabang(userData.cabang);
            }
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  // Handle File Change (Base64)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData((prev) => ({ ...prev, foto: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle Submit (Tambah/Edit)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editId) {
        // Mode Edit: Update data yang ada
        
        // 1. Cek apakah email berubah, jika ya update di Auth via API
        const currentSiswa = siswaList.find(s => s.id === editId);
        if (currentSiswa && currentSiswa.uid && currentSiswa.email !== formData.email) {
           const res = await fetch('/api/admin/update-user', {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ uid: currentSiswa.uid, email: formData.email })
           });
           
           if (!res.ok) {
             const errData = await res.json();
             throw new Error(errData.error || "Gagal update email di Auth System");
           }
        }

        await updateDoc(doc(db, "siswa", editId), {
          nama: formData.nama,
          jenisKelamin: formData.jenisKelamin,
          nisn: formData.nisn,
          tempatLahir: formData.tempatLahir,
          tanggalLahir: formData.tanggalLahir,
          agama: formData.agama,
          anakKe: formData.anakKe,
          alamat: formData.alamat,
          namaAyah: formData.namaAyah,
          namaIbu: formData.namaIbu,
          kelas: formData.kelas,
          cabang: formData.cabang,
          email: formData.email,
          status: formData.status,
          foto: formData.foto,
          jenjangUsia: formData.jenjangUsia,
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
          jenisKelamin: formData.jenisKelamin,
          nisn: formData.nisn,
          tempatLahir: formData.tempatLahir,
          tanggalLahir: formData.tanggalLahir,
          agama: formData.agama,
          anakKe: formData.anakKe,
          alamat: formData.alamat,
          namaAyah: formData.namaAyah,
          namaIbu: formData.namaIbu,
          kelas: formData.kelas,
          cabang: formData.cabang,
          email: formData.email,
          status: formData.status,
          foto: formData.foto,
          role: "Siswa",
          uid: userCredential.user.uid,
          createdAt: new Date(),
          jenjangUsia: formData.jenjangUsia,
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
        // 1. Cari data siswa untuk mendapatkan UID/Email
        const siswaToDelete = siswaList.find(s => s.id === id);
        
        // 2. Hapus user di Auth via API
        if (siswaToDelete) {
            await fetch('/api/admin/delete-user', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ uid: siswaToDelete.uid, email: siswaToDelete.email })
            });
        }

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
      jenisKelamin: siswa.jenisKelamin || "Laki-laki",
      nisn: siswa.nisn || "",
      tempatLahir: siswa.tempatLahir || "",
      tanggalLahir: siswa.tanggalLahir || "",
      agama: siswa.agama || "",
      anakKe: siswa.anakKe || "",
      alamat: siswa.alamat || "",
      namaAyah: siswa.namaAyah || "",
      namaIbu: siswa.namaIbu || "",
      kelas: siswa.kelas,
      cabang: siswa.cabang,
      email: siswa.email,
      status: siswa.status,
      password: "",
      foto: siswa.foto || "",
      jenjangUsia: siswa.jenjangUsia || "",
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditId(null);
    setFormData({
      nama: "",
      jenisKelamin: "Laki-laki",
      nisn: "",
      tempatLahir: "",
      tanggalLahir: "",
      agama: "",
      anakKe: "",
      alamat: "",
      namaAyah: "",
      namaIbu: "",
      kelas: "",
      cabang: "",
      email: "",
      password: "",
      status: "Aktif",
      foto: "",
      jenjangUsia: ""
    });
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
          className={`border rounded-lg px-4 py-2 bg-white focus:ring-2 focus:ring-[#581c87] outline-none text-gray-900 ${userRole === "Kepala Sekolah" ? "bg-gray-100 cursor-not-allowed" : ""}`}
          value={filterCabang}
          onChange={(e) => setFilterCabang(e.target.value)}
          disabled={userRole === "Kepala Sekolah"}
        >
          {userRole !== "Kepala Sekolah" && <option value="">Semua Cabang</option>}
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
                    <button onClick={() => setViewDetail(siswa)} className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition" title="Lihat Detail">
                      <FileText className="w-4 h-4" />
                    </button>
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
          <div className="bg-white rounded-xl shadow-xl w-full max-w-7xl overflow-hidden flex flex-col max-h-[95vh]">
            <div className="p-4 border-b flex justify-between items-center bg-gray-50 shrink-0">
              <h3 className="font-bold text-gray-800">{editId ? "Edit Data Siswa" : "Tambah Siswa Baru"}</h3>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nama Siswa</label>
                  <input required type="text" className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#581c87] outline-none text-gray-900"
                    value={formData.nama} onChange={(e) => setFormData({...formData, nama: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Jenis Kelamin</label>
                  <select className="w-full border rounded-lg p-2 bg-white focus:ring-2 focus:ring-[#581c87] outline-none text-gray-900"
                    value={formData.jenisKelamin} onChange={(e) => setFormData({...formData, jenisKelamin: e.target.value})}>
                    <option value="Laki-laki">Laki-laki</option>
                    <option value="Perempuan">Perempuan</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Jenjang Usia</label>
                  <select required className="w-full border rounded-lg p-2 bg-white focus:ring-2 focus:ring-[#581c87] outline-none text-gray-900"
                    value={formData.jenjangUsia} onChange={(e) => setFormData({...formData, jenjangUsia: e.target.value})}>
                    <option value="">Pilih Jenjang Usia</option>
                    {usiaList.map((u) => <option key={u.id} value={u.usia}>{u.usia}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">NISN</label>
                  <input type="text" className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#581c87] outline-none text-gray-900"
                    value={formData.nisn} onChange={(e) => setFormData({...formData, nisn: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Agama</label>
                  <input type="text" className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#581c87] outline-none text-gray-900"
                    value={formData.agama} onChange={(e) => setFormData({...formData, agama: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tempat Lahir</label>
                  <input type="text" className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#581c87] outline-none text-gray-900"
                    value={formData.tempatLahir} onChange={(e) => setFormData({...formData, tempatLahir: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal Lahir</label>
                  <input type="date" className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#581c87] outline-none text-gray-900"
                    value={formData.tanggalLahir} onChange={(e) => setFormData({...formData, tanggalLahir: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nama Ayah</label>
                  <input type="text" className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#581c87] outline-none text-gray-900"
                    value={formData.namaAyah} onChange={(e) => setFormData({...formData, namaAyah: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nama Ibu</label>
                  <input type="text" className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#581c87] outline-none text-gray-900"
                    value={formData.namaIbu} onChange={(e) => setFormData({...formData, namaIbu: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Anak Ke-</label>
                  <input type="number" className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#581c87] outline-none text-gray-900"
                    value={formData.anakKe} onChange={(e) => setFormData({...formData, anakKe: e.target.value})} />
                </div>
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
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Alamat</label>
                  <textarea rows={2} className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#581c87] outline-none text-gray-900"
                    value={formData.alamat} onChange={(e) => setFormData({...formData, alamat: e.target.value})} />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Foto Siswa</label>
                  <input 
                    type="file" 
                    accept="image/*"
                    onChange={handleFileChange}
                    className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-[#581c87] hover:file:bg-purple-100"
                  />
                  {formData.foto && (
                    <div className="mt-2 relative w-20 h-20">
                      <img src={formData.foto} alt="Preview" className="w-full h-full object-cover rounded-lg border" />
                      <button type="button" onClick={() => setFormData({...formData, foto: ""})} className="absolute -top-2 -right-2 bg-red-100 text-red-600 rounded-full p-0.5 hover:bg-red-200"><X className="w-3 h-3" /></button>
                    </div>
                  )}
                </div>
              </div>

              <button disabled={submitting} type="submit" className="w-full bg-[#581c87] text-white py-2 rounded-lg hover:bg-[#45156b] transition font-medium mt-2">
                {submitting ? "Menyimpan..." : "Simpan Data"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal Detail Siswa */}
      {viewDetail && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setViewDetail(null)}>
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full overflow-hidden relative" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-gray-800">Detail Siswa</h3>
              <button onClick={() => setViewDetail(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[80vh]">
              <div className="flex flex-col md:flex-row gap-6">
                <div className="w-full md:w-1/3 flex flex-col items-center">
                  {viewDetail.foto ? (
                    <img src={viewDetail.foto} alt={viewDetail.nama} className="w-32 h-32 object-cover rounded-full border-4 border-purple-50 shadow-sm" />
                  ) : (
                    <div className="w-32 h-32 bg-purple-100 rounded-full flex items-center justify-center text-purple-500 text-4xl font-bold">
                      {viewDetail.nama.charAt(0)}
                    </div>
                  )}
                  <div className="mt-4 text-center">
                    <h4 className="font-bold text-gray-900">{viewDetail.nama}</h4>
                    <p className="text-sm text-gray-500">{viewDetail.nisn || "-"}</p>
                    <span className={`mt-2 inline-block px-2 py-1 rounded-full text-xs font-medium ${viewDetail.status === 'Aktif' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {viewDetail.status}
                    </span>
                  </div>
                </div>
                <div className="w-full md:w-2/3 space-y-3">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div><p className="text-gray-500">Jenis Kelamin</p><p className="font-medium">{viewDetail.jenisKelamin}</p></div>
                    <div><p className="text-gray-500">Agama</p><p className="font-medium">{viewDetail.agama || "-"}</p></div>
                    <div><p className="text-gray-500">Jenjang Usia</p><p className="font-medium">{viewDetail.jenjangUsia || "-"}</p></div>
                    <div><p className="text-gray-500">Tempat, Tgl Lahir</p><p className="font-medium">{viewDetail.tempatLahir}, {viewDetail.tanggalLahir}</p></div>
                    <div><p className="text-gray-500">Anak Ke</p><p className="font-medium">{viewDetail.anakKe || "-"}</p></div>
                    <div><p className="text-gray-500">Kelas</p><p className="font-medium">{viewDetail.kelas}</p></div>
                    <div><p className="text-gray-500">Cabang</p><p className="font-medium">{viewDetail.cabang}</p></div>
                    <div><p className="text-gray-500">Nama Ayah</p><p className="font-medium">{viewDetail.namaAyah || "-"}</p></div>
                    <div><p className="text-gray-500">Nama Ibu</p><p className="font-medium">{viewDetail.namaIbu || "-"}</p></div>
                    <div className="col-span-2"><p className="text-gray-500">Alamat</p><p className="font-medium">{viewDetail.alamat || "-"}</p></div>
                    <div className="col-span-2"><p className="text-gray-500">Email</p><p className="font-medium">{viewDetail.email}</p></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
