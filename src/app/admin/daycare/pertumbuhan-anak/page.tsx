"use client";
import { useState, useEffect } from 'react';
import { db, auth } from "@/lib/firebase";
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where, orderBy, Timestamp } from "firebase/firestore";
import { onAuthStateChanged } from 'firebase/auth';
import { Plus, Pencil, Trash2, X, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
interface GrowthData {
  id: string;
  tanggal: Timestamp;
  cabang: string;
  kelas: string;
  siswaId: string;
  lingkarKepala: number;
  tinggiBadan: number;
  beratBadan: number;
  // For display
  namaSiswa?: string;
}

interface Siswa {
  id: string;
  nama: string;
  kelas: string;
  cabang: string;
  kelasDaycare?: string; // Tambahkan kelasDaycare sebagai properti opsional
}

interface Kelas {
  id: string;
  namaKelas: string;
  cabang: string;
  guruKelas?: string[];
  jenjangKelas: string;
}

interface Cabang {
  id: string;
  nama: string;
}

const PertumbuhanAnakPage = () => {
  const [growthList, setGrowthList] = useState<GrowthData[]>([]);
  const [siswaList, setSiswaList] = useState<Siswa[]>([]);
  const [allKelasList, setAllKelasList] = useState<Kelas[]>([]); // State baru untuk semua kelas
  const [kelasList, setKelasList] = useState<Kelas[]>([]);
  const [cabangList, setCabangList] = useState<Cabang[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Filtered lists for dropdowns
  const [filteredKelasList, setFilteredKelasList] = useState<Kelas[]>([]);
  const [filteredSiswaList, setFilteredSiswaList] = useState<Siswa[]>([]);

  // State for page filters
  const [filterCabang, setFilterCabang] = useState<string>("");
  const [filteredGrowthList, setFilteredGrowthList] = useState<GrowthData[]>([]);

  const [formData, setFormData] = useState({
    tanggal: '',
    cabang: '',
    kelas: '',
    siswaId: '',
    lingkarKepala: '',
    tinggiBadan: '',
    beratBadan: '',
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user && user.email) {
        let userData: any = null;
        // Cek di koleksi 'guru' (termasuk Admin, Guru, KS, dll)
        const qGuru = query(collection(db, "guru"), where("email", "==", user.email));
        const snapGuru = await getDocs(qGuru); // No changes here, just for context
        if (!snapGuru.empty) {
          userData = { id: snapGuru.docs[0].id, ...snapGuru.docs[0].data() };
        } else {
          // Jika tidak ada di 'guru', cek di 'caregivers'
          const qCaregiver = query(collection(db, "caregivers"), where("email", "==", user.email));
          const snapCaregiver = await getDocs(qCaregiver);
          if (!snapCaregiver.empty) {
            userData = { id: snapCaregiver.docs[0].id, ...snapCaregiver.docs[0].data() };
          }
        }
        setCurrentUser(userData);
      } else {
        setCurrentUser(null);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!currentUser) return;

    const fetchData = async () => {
        setLoading(true);
        try {
            // Fetch Cabang
            const cabangSnapshot = await getDocs(query(collection(db, "cabang"), orderBy("nama", "asc")));
            let allCabang = cabangSnapshot.docs.map(doc => {
                const { id, ...data } = { id: doc.id, ...doc.data() };
                return { id, ...data } as Cabang;
            });       
            if ((currentUser.role === "Caregiver" || currentUser.role === "Guru") && currentUser.cabang) {
                allCabang = allCabang.filter(c => c.nama === currentUser.cabang);
            }
            setCabangList(allCabang);

            // Fetch Kelas
            const kelasQuery = (currentUser.role === "Caregiver" || currentUser.role === "Guru") && currentUser.nama
                ? query(collection(db, "kelas"), where("guruKelas", "array-contains", currentUser.nama))
                : query(collection(db, "kelas"), orderBy("namaKelas", "asc"));

            const kelasSnapshot = await getDocs(kelasQuery);
            const fetchedKelas = kelasSnapshot.docs.map(doc => {
                const { id, ...data } = { id: doc.id, ...doc.data() };
                return { id, ...data } as Kelas;
            });
            setAllKelasList(fetchedKelas); // Simpan semua kelas
            
            // Filter kelas sesuai cabang user jika bukan admin
            let userKelas = fetchedKelas;
            if ((currentUser.role === "Caregiver" || currentUser.role === "Guru") && currentUser.cabang) {
                userKelas = userKelas.filter(k => k.cabang === currentUser.cabang);
            }

            setKelasList(userKelas);

            // Fetch Siswa
            const allowedKelasNames = userKelas.map(k => k.namaKelas);
            let siswaQuery;

            if (currentUser.role === "Admin" || currentUser.role === "Direktur" || currentUser.role === "Yayasan") {
                siswaQuery = query(collection(db, "siswa"), orderBy("nama", "asc"));
            } else {
                siswaQuery = query(collection(db, "siswa"), where("cabang", "==", currentUser.cabang));
            }

            const siswaSnapshot = await getDocs(siswaQuery);
            let allSiswa = siswaSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Siswa));

            if (currentUser.role !== "Admin" && currentUser.role !== "Direktur" && currentUser.role !== "Yayasan") {
                allSiswa = allSiswa.filter(s => allowedKelasNames.includes(s.kelas) || (s.kelasDaycare && allowedKelasNames.includes(s.kelasDaycare)));
            }

            setSiswaList(allSiswa);

            // Fetch Growth Data
            const growthQuery = query(collection(db, "pertumbuhan_anak"), orderBy("tanggal", "desc"));
            const growthSnapshot = await getDocs(growthQuery);
            const allGrowthData = growthSnapshot.docs.map(doc => {
                const data = doc.data() as GrowthData;
                const siswa = allSiswa.find(s => s.id === data.siswaId); // No change here, for context
                return {
                    ...data,
                    id: doc.id,
                    namaSiswa: siswa ? siswa.nama : 'Siswa Dihapus',
                } as GrowthData
            });

            // Filter growth data based on allowed students
            if (currentUser.role !== "Admin" && currentUser.role !== "Direktur" && currentUser.role !== "Yayasan") {
                const allowedSiswaIds = new Set(allSiswa.map(s => s.id));
                const filteredGrowthData = allGrowthData.filter(g => allowedSiswaIds.has(g.siswaId));
                setGrowthList(filteredGrowthData);
            } else {
                setGrowthList(allGrowthData);
            }

        } catch (error) {
            console.error("Error fetching data:", error);
            alert("Gagal memuat data. Silakan coba lagi.");
        } finally {
            setLoading(false);
        }
    };

    fetchData();
  }, [currentUser]);

  // Effect for cascading dropdowns in modal
  useEffect(() => {
    if (formData.cabang) {
      setFilteredKelasList(allKelasList.filter(k => k.cabang === formData.cabang));
    } else {
      setFilteredKelasList([]);
    }
    setFormData((prev) => ({ ...prev, kelas: '', siswaId: '' }));
  }, [formData.cabang, allKelasList]);

  useEffect(() => {
    if (formData.cabang && formData.kelas) {
      setFilteredSiswaList(
        siswaList.filter(s => s.cabang === formData.cabang && s.kelas === formData.kelas)
      );
    } else {
      setFilteredSiswaList([]);
    }
    setFormData((prev) => ({ ...prev, siswaId: '' }));
  }, [formData.cabang, formData.kelas, siswaList]);


  // Effect for page-level filtering
  useEffect(() => {
    // Jika user bukan admin, set filter cabang sesuai data user dan disable
    if (currentUser && (currentUser.role === "Caregiver" || currentUser.role === "Guru") && currentUser.cabang) {
        const userCabang = cabangList.find(c => c.nama === currentUser.cabang);
        if (userCabang) setFilterCabang(userCabang.nama);
    }

    const filtered = growthList.filter(laporan => {
        return !filterCabang || laporan.cabang === filterCabang;
    });
    setFilteredGrowthList(filtered);
  }, [filterCabang, growthList, currentUser, cabangList]);

  const closeModal = () => {
    setIsModalOpen(false);
    setEditId(null);
    setFormData({
      tanggal: '',
      cabang: '',
      kelas: '',
      siswaId: '',
      lingkarKepala: '',
      tinggiBadan: '',
      beratBadan: '',
    });
  };

  const handleEdit = (data: GrowthData) => {
    // Prevent editing if user doesn't have access
    if (currentUser.role !== "Admin" && currentUser.role !== "Direktur" && currentUser.role !== "Yayasan") {
        const siswa = siswaList.find(s => s.id === data.siswaId);
        if (!siswa) {
            alert("Anda tidak memiliki akses untuk mengedit data siswa ini.");
            return;
        }
    }
    setEditId(data.id);
    setFormData({
        tanggal: format(data.tanggal.toDate(), 'yyyy-MM-dd'),
        cabang: data.cabang,
        kelas: data.kelas,
        siswaId: data.siswaId,
        lingkarKepala: String(data.lingkarKepala),
        tinggiBadan: String(data.tinggiBadan),
        beratBadan: String(data.beratBadan),
    });
    setIsModalOpen(true);
  };
  
  const openAddModal = () => {
    setEditId(null);
    const initial = {
      tanggal: new Date().toISOString().split('T')[0],
      cabang: '',
      kelas: '',
      siswaId: '',
      lingkarKepala: '',
      tinggiBadan: '',
      beratBadan: '',
    };

    if ((currentUser?.role === "Caregiver" || currentUser?.role === "Guru") && cabangList.length === 1) {
        initial.cabang = cabangList[0].nama;
        if (kelasList.length === 1) initial.kelas = kelasList[0].namaKelas;
    }
    setFormData(initial);
    setIsModalOpen(true);
  }
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.siswaId || !formData.tanggal) {
        alert("Harap lengkapi semua field yang diperlukan.");
        return;
    }
    setSubmitting(true);
    
    const dataToSave = {
        ...formData,
        tanggal: Timestamp.fromDate(new Date(formData.tanggal)),
        lingkarKepala: parseFloat(formData.lingkarKepala) || 0,
        tinggiBadan: parseFloat(formData.tinggiBadan) || 0,
        beratBadan: parseFloat(formData.beratBadan) || 0,
    };

    try {
      if (editId) {
        await updateDoc(doc(db, "pertumbuhan_anak", editId), dataToSave);
        alert("Data pertumbuhan berhasil diperbarui.");
      } else {
        await addDoc(collection(db, "pertumbuhan_anak"), { ...dataToSave, createdAt: new Date() });
        alert("Data pertumbuhan berhasil ditambahkan.");
      }
      closeModal();
      // Re-trigger fetch.
      // This is a common pattern to force a useEffect with a dependency on an object to re-run.
      if (currentUser) {
        setCurrentUser((prev: any) => ({...prev}));
      }

    } catch (error) {
      console.error("Error saving data:", error);
      alert("Gagal menyimpan data. Pastikan semua field terisi dengan benar.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Yakin ingin menghapus data ini?")) {
      try {
        await deleteDoc(doc(db, "pertumbuhan_anak", id));
        alert("Data berhasil dihapus.");
         setGrowthList((prev) => prev.filter(item => item.id !== id));
      } catch (error) {
        console.error("Error deleting data:", error);
        alert("Gagal menghapus data.");
      }
    }
  };
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">Data Pertumbuhan Anak (Daycare)</h1>
        <button
          onClick={openAddModal}
          className="bg-[#581c87] text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-[#45156b] transition"
        >
          <Plus className="w-4 h-4" /> Tambah Data
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Filter Cabang</label>
              <select 
                name="filterCabang" 
                value={filterCabang} 
                onChange={(e) => setFilterCabang(e.target.value)} 
                className={`w-full max-w-xs border rounded-lg p-2 focus:ring-2 focus:ring-[#581c87] outline-none text-sm ${(currentUser?.role !== "Admin" && currentUser?.role !== "Direktur" && currentUser?.role !== "Yayasan") ? "bg-gray-100 cursor-not-allowed" : ""}`}
                disabled={(currentUser?.role !== "Admin" && currentUser?.role !== "Direktur" && currentUser?.role !== "Yayasan")}
              >
                  <option value="">Semua Cabang</option>
                  {cabangList.map(c => <option key={c.id} value={c.nama}>{c.nama}</option>)}
              </select>
          </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50 text-gray-900 font-semibold border-b">
              <tr>
                <th className="p-4 w-16 text-center">No</th>
                <th className="p-4">Tanggal Update</th>
                <th className="p-4">Nama Anak</th>
                <th className="p-4">Cabang</th>
                <th className="p-4">Lingkar Kepala</th>
                <th className="p-4">Tinggi Badan</th>
                <th className="p-4">Berat Badan</th>
                <th className="p-4 w-32 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={8} className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-[#581c87]" /></td></tr>
              ) : filteredGrowthList.length === 0 ? (
                <tr><td colSpan={8} className="p-8 text-center">Belum ada data pertumbuhan.</td></tr>
              ) : (
                filteredGrowthList.map((data, index) => (
                  <tr key={data.id} className="hover:bg-gray-50">
                    <td className="p-4 text-center">{index + 1}</td>
                    <td className="p-4 font-medium text-gray-900">{format(data.tanggal.toDate(), 'dd MMMM yyyy')}</td>
                    <td className="p-4">{data.namaSiswa}</td>
                    <td className="p-4">{data.cabang}</td>
                    <td className="p-4">{data.lingkarKepala} cm</td>
                    <td className="p-4">{data.tinggiBadan} cm</td>
                    <td className="p-4">{data.beratBadan} kg</td>
                    <td className="p-4 flex justify-center gap-2">
                       <button onClick={() => handleEdit(data)} className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition" title="Edit">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(data.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition" title="Hapus">
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

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[95vh]">
            <div className="p-4 border-b flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-gray-800">{editId ? "Edit Data Pertumbuhan" : "Tambah Data Pertumbuhan"}</h3>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Pilih Tanggal</label>
                    <input required type="date" value={formData.tanggal} onChange={(e) => setFormData({...formData, tanggal: e.target.value})} className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#581c87] outline-none text-gray-900" />
                </div>
                 <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Pilih Cabang</label>
                  <select required value={formData.cabang} 
                    onChange={(e) => setFormData({...formData, cabang: e.target.value, kelas: '', siswaId: ''})} 
                    className={`w-full border rounded-lg p-2 bg-white focus:ring-2 focus:ring-[#581c87] outline-none text-gray-900 ${(currentUser?.role !== "Admin" && currentUser?.role !== "Direktur" && currentUser?.role !== "Yayasan") ? "bg-gray-100 cursor-not-allowed" : ""}`}
                    disabled={(currentUser?.role !== "Admin" && currentUser?.role !== "Direktur" && currentUser?.role !== "Yayasan")}
                  >
                    <option value="">Pilih Cabang</option>
                    {cabangList.map((c) => <option key={c.id} value={c.nama}>{c.nama}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Pilih Kelas</label>
                  <select required
                    disabled={!formData.cabang}
                    value={formData.kelas} 
                    onChange={(e) => setFormData({...formData, kelas: e.target.value, siswaId: ''})} 
                    className="w-full border rounded-lg p-2 bg-white focus:ring-2 focus:ring-[#581c87] outline-none text-gray-900 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  >
                    <option value="">Pilih Kelas</option>
                    {filteredKelasList.map((k) => <option key={k.id} value={k.namaKelas}>{k.namaKelas}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Pilih Siswa</label>
                  <select 
                    required 
                    disabled={!formData.kelas} 
                    value={formData.siswaId} 
                    onChange={(e) => setFormData({...formData, siswaId: e.target.value})} 
                    className="w-full border rounded-lg p-2 bg-white focus:ring-2 focus:ring-[#581c87] outline-none text-gray-900 disabled:bg-gray-100"
                  >
                    <option value="">Pilih Siswa</option>
                    {filteredSiswaList.map((s) => <option key={s.id} value={s.id}>{s.nama}</option>)}
                  </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Lingkar Kepala (cm)</label>
                    <input type="number" step="0.1" value={formData.lingkarKepala} onChange={(e) => setFormData({...formData, lingkarKepala: e.target.value})} className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#581c87] outline-none text-gray-900" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tinggi Badan (cm)</label>
                    <input type="number" step="0.1" value={formData.tinggiBadan} onChange={(e) => setFormData({...formData, tinggiBadan: e.target.value})} className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#581c87] outline-none text-gray-900" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Berat Badan (kg)</label>
                    <input type="number" step="0.1" value={formData.beratBadan} onChange={(e) => setFormData({...formData, beratBadan: e.target.value})} className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#581c87] outline-none text-gray-900" />
                </div>
              </div>

              <button disabled={submitting} type="submit" className="w-full bg-[#581c87] text-white py-2 rounded-lg hover:bg-[#45156b] transition font-medium mt-2 disabled:opacity-50">
                {submitting ? "Menyimpan..." : (editId ? "Simpan Perubahan" : "Simpan Data")}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PertumbuhanAnakPage;
