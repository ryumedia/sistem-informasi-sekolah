"use client";
import { useState, useEffect } from 'react';
import { db } from "@/lib/firebase";
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where, orderBy } from "firebase/firestore";
import { Plus, Pencil, Trash2, X } from 'lucide-react';

interface GrowthData {
  id: string;
  tanggal: string;
  cabang: string;
  kelas: string;
  siswaId: string;
  lingkarKepala: number;
  tinggiBadan: number;
  beratBadan: number;
}

interface Siswa {
  id: string;
  nama: string;
  kelas: string;
  cabang: string;
}

interface Kelas {
  id: string;
  namaKelas: string;
  cabang: string;
  jenjangKelas: string;
}

const PertumbuhanAnakPage = () => {
  const [growthList, setGrowthList] = useState<GrowthData[]>([]);
  const [siswaList, setSiswaList] = useState<Siswa[]>([]);
  const [kelasList, setKelasList] = useState<Kelas[]>([]);
  const [cabangList, setCabangList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    tanggal: '',
    cabang: '',
    kelas: '',
    siswaId: '',
    lingkarKepala: '',
    tinggiBadan: '',
    beratBadan: '',
  });

  const fetchGrowthData = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, "pertumbuhan_anak"), orderBy("tanggal", "desc"));
      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as GrowthData[];
      setGrowthList(data);
    } catch (error) {
      console.error("Error fetching growth data:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchData = async () => {
    try {
      const cabangQuery = query(collection(db, "cabang"), orderBy("nama", "asc"));
      const cabangSnapshot = await getDocs(cabangQuery);
      setCabangList(cabangSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      
      const kelasQuery = query(collection(db, "kelas"), where("jenjangKelas", "==", "Daycare"), orderBy("namaKelas", "asc"));
      const kelasSnapshot = await getDocs(kelasQuery);
      setKelasList(kelasSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Kelas[]);

      const siswaQuery = query(collection(db, "siswa"), orderBy("nama", "asc"));
      const siswaSnapshot = await getDocs(siswaQuery);
      setSiswaList(siswaSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Siswa[]);

    } catch (error) {
        console.error("Error fetching related data:", error);
    }
  };

  useEffect(() => {
    fetchGrowthData();
    fetchData();
  }, []);

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
    setEditId(data.id);
    setFormData({
        tanggal: data.tanggal,
        cabang: data.cabang,
        kelas: data.kelas,
        siswaId: data.siswaId,
        lingkarKepala: String(data.lingkarKepala),
        tinggiBadan: String(data.tinggiBadan),
        beratBadan: String(data.beratBadan),
    });
    setIsModalOpen(true);
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.siswaId || !formData.tanggal) {
        alert("Harap lengkapi semua field yang diperlukan.");
        return;
    }
    setSubmitting(true);
    
    const dataToSave = {
        ...formData,
        lingkarKepala: parseFloat(formData.lingkarKepala) || 0,
        tinggiBadan: parseFloat(formData.tinggiBadan) || 0,
        beratBadan: parseFloat(formData.beratBadan) || 0,
    };

    try {
      if (editId) {
        await updateDoc(doc(db, "pertumbuhan_anak", editId), dataToSave);
        alert("Data pertumbuhan berhasil diperbarui!");
      } else {
        await addDoc(collection(db, "pertumbuhan_anak"), { ...dataToSave, createdAt: new Date() });
        alert("Data pertumbuhan berhasil ditambahkan!");
      }
      closeModal();
      fetchGrowthData();
    } catch (error) {
      console.error("Error saving data:", error);
      alert("Gagal menyimpan data.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Yakin ingin menghapus data ini?")) {
      try {
        await deleteDoc(doc(db, "pertumbuhan_anak", id));
        alert("Data berhasil dihapus.");
        fetchGrowthData();
      } catch (error) {
        console.error("Error deleting data:", error);
        alert("Gagal menghapus data.");
      }
    }
  };
  
  const getSiswaName = (siswaId: string) => {
      const siswa = siswaList.find(s => s.id === siswaId);
      return siswa ? siswa.nama : 'Siswa tidak ditemukan';
  }

  const filteredKelas = formData.cabang ? kelasList.filter(k => k.cabang === formData.cabang) : [];
  const filteredSiswa = formData.kelas ? siswaList.filter(s => s.kelas === formData.kelas) : [];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">Data Pertumbuhan Anak (Daycare)</h1>
        <button
          onClick={() => { setEditId(null); setIsModalOpen(true); }}
          className="bg-[#581c87] text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-[#45156b] transition"
        >
          <Plus className="w-4 h-4" /> Tambah Data
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600 min-w-[1200px]">
            <thead className="bg-gray-50 text-gray-900 font-semibold border-b">
              <tr>
                <th className="p-4 w-16">No</th>
                <th className="p-4">Tanggal Update</th>
                <th className="p-4">Nama Anak</th>
                <th className="p-4">Lingkar Kepala</th>
                <th className="p-4">Tinggi Badan</th>
                <th className="p-4">Berat Badan</th>
                <th className="p-4">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={7} className="p-8 text-center">Memuat data...</td></tr>
              ) : growthList.length === 0 ? (
                <tr><td colSpan={7} className="p-8 text-center">Belum ada data pertumbuhan.</td></tr>
              ) : (
                growthList.map((data, index) => (
                  <tr key={data.id} className="hover:bg-gray-50">
                    <td className="p-4 text-center">{index + 1}</td>
                    <td className="p-4 font-medium text-gray-900">{data.tanggal}</td>
                    <td className="p-4">{getSiswaName(data.siswaId)}</td>
                    <td className="p-4">{data.lingkarKepala} cm</td>
                    <td className="p-4">{data.tinggiBadan} cm</td>
                    <td className="p-4">{data.beratBadan} kg</td>
                    <td className="p-4 flex gap-2">
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
                  <select required value={formData.cabang} onChange={(e) => setFormData({...formData, cabang: e.target.value, kelas: '', siswaId: ''})} className="w-full border rounded-lg p-2 bg-white focus:ring-2 focus:ring-[#581c87] outline-none text-gray-900">
                    <option value="">Pilih Cabang</option>
                    {cabangList.map((c) => <option key={c.id} value={c.nama}>{c.nama}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Pilih Kelas</label>
                  <select required disabled={!formData.cabang} value={formData.kelas} onChange={(e) => setFormData({...formData, kelas: e.target.value, siswaId: ''})} className="w-full border rounded-lg p-2 bg-white focus:ring-2 focus:ring-[#581c87] outline-none text-gray-900 disabled:bg-gray-100">
                    <option value="">Pilih Kelas</option>
                    {filteredKelas.map((k) => <option key={k.id} value={k.namaKelas}>{k.namaKelas}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Pilih Siswa</label>
                  <select required disabled={!formData.kelas} value={formData.siswaId} onChange={(e) => setFormData({...formData, siswaId: e.target.value})} className="w-full border rounded-lg p-2 bg-white focus:ring-2 focus:ring-[#581c87] outline-none text-gray-900 disabled:bg-gray-100">
                    <option value="">Pilih Siswa</option>
                    {filteredSiswa.map((s) => <option key={s.id} value={s.id}>{s.nama}</option>)}
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

              <button disabled={submitting} type="submit" className="w-full bg-[#581c87] text-white py-2 rounded-lg hover:bg-[#45156b] transition font-medium mt-2">
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
