"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import { Plus, Pencil, Trash2, X, Save } from "lucide-react";

// --- Interfaces ---
interface NilaiIndikator {
  id: string;
  tanggal: string;
  cabangId: string;
  namaCabang: string;
  kelasId: string;
  namaKelas: string;
  siswaId: string;
  namaSiswa: string;
  semesterId: string;
  namaSemester: string;
  indikatorId: string;
  namaIndikator: string;
  subIndikatorId: string;
  namaSubIndikator: string;
  nilai: number; // 1, 2, 3
}

interface Cabang {
  id: string;
  nama: string;
}

interface Kelas {
  id: string;
  namaKelas: string;
  cabang: string;
}

interface Siswa {
  id: string;
  nama: string;
  kelas: string;
}

interface Semester {
  id: string;
  namaPeriode: string;
  isDefault?: boolean;
}

interface Indikator {
  id: string;
  nama: string;
}

interface SubIndikator {
  id: string;
  deskripsi: string;
  groupId: string;
}

export default function NilaiIndikatorPage() {
  // --- State Data Utama ---
  const [dataList, setDataList] = useState<NilaiIndikator[]>([]);
  const [loading, setLoading] = useState(true);

  // --- State Dropdowns (Master Data) ---
  const [cabangList, setCabangList] = useState<Cabang[]>([]);
  const [kelasList, setKelasList] = useState<Kelas[]>([]); // Filtered by Cabang
  const [siswaList, setSiswaList] = useState<Siswa[]>([]); // Filtered by Kelas
  const [semesterList, setSemesterList] = useState<Semester[]>([]);
  const [indikatorList, setIndikatorList] = useState<Indikator[]>([]);
  const [subIndikatorList, setSubIndikatorList] = useState<SubIndikator[]>([]); // Filtered by Indikator

  // --- State Form ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    tanggal: new Date().toISOString().split("T")[0],
    cabangId: "",
    namaCabang: "",
    kelasId: "",
    namaKelas: "",
    siswaId: "",
    namaSiswa: "",
    semesterId: "",
    namaSemester: "",
    indikatorId: "",
    namaIndikator: "",
    subIndikatorId: "",
    namaSubIndikator: "",
    nilai: 1,
  });

  // --- Fetch Initial Data ---
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        // 1. Fetch Data Nilai (Tabel Utama)
        const qNilai = query(collection(db, "nilai_indikator"), orderBy("tanggal", "desc"));
        const snapNilai = await getDocs(qNilai);
        const nilaiData = snapNilai.docs.map((d) => ({ id: d.id, ...d.data() })) as NilaiIndikator[];
        setDataList(nilaiData);

        // 2. Fetch Master Cabang
        const snapCabang = await getDocs(query(collection(db, "cabang"), orderBy("nama", "asc")));
        setCabangList(snapCabang.docs.map((d) => ({ id: d.id, ...d.data() })) as Cabang[]);

        // 3. Fetch Master Semester
        const snapSemester = await getDocs(query(collection(db, "kpi_periode"), orderBy("namaPeriode", "asc")));
        const semesters = snapSemester.docs.map((d) => ({ id: d.id, ...d.data() })) as Semester[];
        setSemesterList(semesters);

        // 4. Fetch Master Indikator
        const snapIndikator = await getDocs(collection(db, "indikator_groups"));
        setIndikatorList(snapIndikator.docs.map((d) => ({ id: d.id, ...d.data() })) as unknown as Indikator[]);

      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchInitialData();
  }, []);

  // --- Handlers for Cascading Dropdowns ---

  // 1. Handle Cabang Change -> Fetch Kelas
  const handleCabangChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedCabangId = e.target.value;
    const selectedCabang = cabangList.find((c) => c.id === selectedCabangId);

    setForm((prev) => ({
      ...prev,
      cabangId: selectedCabangId,
      namaCabang: selectedCabang?.nama || "",
      kelasId: "", namaKelas: "", // Reset bawahnya
      siswaId: "", namaSiswa: "",
    }));
    setSiswaList([]);

    if (selectedCabangId && selectedCabang) {
      const qKelas = query(collection(db, "kelas"), where("cabang", "==", selectedCabang.nama));
      const snapKelas = await getDocs(qKelas);
      setKelasList(snapKelas.docs.map((d) => ({ id: d.id, ...d.data() })) as unknown as Kelas[]);
    } else {
      setKelasList([]);
    }
  };

  // 2. Handle Kelas Change -> Fetch Siswa
  const handleKelasChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedKelasId = e.target.value;
    const selectedKelas = kelasList.find((k) => k.id === selectedKelasId);

    setForm((prev) => ({
      ...prev,
      kelasId: selectedKelasId,
      namaKelas: selectedKelas?.namaKelas || "",
      siswaId: "", namaSiswa: "", // Reset bawahnya
    }));

    if (selectedKelasId && selectedKelas) {
      const qSiswa = query(collection(db, "siswa"), where("kelas", "==", selectedKelas.namaKelas));
      const snapSiswa = await getDocs(qSiswa);
      setSiswaList(snapSiswa.docs.map((d) => ({ id: d.id, ...d.data() })) as unknown as Siswa[]);
    } else {
      setSiswaList([]);
    }
  };

  // 3. Handle Siswa Change
  const handleSiswaChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedSiswaId = e.target.value;
    const selectedSiswa = siswaList.find((s) => s.id === selectedSiswaId);

    setForm((prev) => ({
      ...prev,
      siswaId: selectedSiswaId,
      namaSiswa: selectedSiswa?.nama || "",
    }));
  };

  // 4. Handle Semester Change
  const handleSemesterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedId = e.target.value;
    const selectedSem = semesterList.find((s) => s.id === selectedId);
    setForm((prev) => ({
      ...prev,
      semesterId: selectedId,
      namaSemester: selectedSem?.namaPeriode || ""
    }));
  };

  // 5. Handle Indikator Change -> Fetch Sub Indikator
  const handleIndikatorChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedId = e.target.value;
    const selectedIndikator = indikatorList.find((i) => i.id === selectedId);

    setForm((prev) => ({
      ...prev,
      indikatorId: selectedId,
      namaIndikator: selectedIndikator?.nama || "",
      subIndikatorId: "", namaSubIndikator: "" // Reset sub indikator
    }));

    if (selectedId) {
      const qSub = query(collection(db, "sub_indikators"), where("groupId", "==", selectedId));
      const snapSub = await getDocs(qSub);
      setSubIndikatorList(snapSub.docs.map((d) => ({ id: d.id, ...d.data() })) as unknown as SubIndikator[]);
    } else {
      setSubIndikatorList([]);
    }
  };

  // 6. Handle Sub Indikator Change
  const handleSubIndikatorChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedId = e.target.value;
    const selectedSub = subIndikatorList.find((s) => s.id === selectedId);
    setForm((prev) => ({
      ...prev,
      subIndikatorId: selectedId,
      namaSubIndikator: selectedSub?.deskripsi || ""
    }));
  };

  // --- CRUD Operations ---

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (isEditing && currentId) {
        await updateDoc(doc(db, "nilai_indikator", currentId), {
          ...form,
          updatedAt: serverTimestamp(),
        });
        alert("Data berhasil diperbarui!");
      } else {
        await addDoc(collection(db, "nilai_indikator"), {
          ...form,
          createdAt: serverTimestamp(),
        });
        alert("Data berhasil ditambahkan!");
      }
      closeModal();
      // Refresh Data Table
      const qNilai = query(collection(db, "nilai_indikator"), orderBy("tanggal", "desc"));
      const snapNilai = await getDocs(qNilai);
      setDataList(snapNilai.docs.map((d) => ({ id: d.id, ...d.data() })) as NilaiIndikator[]);
    } catch (error) {
      console.error("Error saving data:", error);
      alert("Gagal menyimpan data.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Yakin ingin menghapus data penilaian ini?")) {
      try {
        await deleteDoc(doc(db, "nilai_indikator", id));
        setDataList((prev) => prev.filter((item) => item.id !== id));
      } catch (error) {
        console.error("Error deleting:", error);
        alert("Gagal menghapus data.");
      }
    }
  };

  const openModal = () => {
    // Set default semester
    const defaultSem = semesterList.find((s) => s.isDefault);
    setForm({
      tanggal: new Date().toISOString().split("T")[0],
      cabangId: "", namaCabang: "",
      kelasId: "", namaKelas: "",
      siswaId: "", namaSiswa: "",
      semesterId: defaultSem?.id || "", namaSemester: defaultSem?.namaPeriode || "",
      indikatorId: "", namaIndikator: "",
      subIndikatorId: "", namaSubIndikator: "",
      nilai: 1,
    });
    setSubIndikatorList([]);
    setIsEditing(false);
    setIsModalOpen(true);
  };

  const handleEdit = async (item: NilaiIndikator) => {
    // 1. Set Form Basic
    setForm({
      tanggal: item.tanggal,
      cabangId: item.cabangId, namaCabang: item.namaCabang,
      kelasId: item.kelasId, namaKelas: item.namaKelas,
      siswaId: item.siswaId, namaSiswa: item.namaSiswa,
      semesterId: item.semesterId, namaSemester: item.namaSemester,
      indikatorId: item.indikatorId, namaIndikator: item.namaIndikator,
      subIndikatorId: item.subIndikatorId, namaSubIndikator: item.namaSubIndikator,
      nilai: item.nilai,
    });

    // 2. Populate Dropdowns (Async)
    if (item.namaCabang) {
      const qKelas = query(collection(db, "kelas"), where("cabang", "==", item.namaCabang));
      const snapKelas = await getDocs(qKelas);
      setKelasList(snapKelas.docs.map((d) => ({ id: d.id, ...d.data() })) as unknown as Kelas[]);
    }
    if (item.namaKelas) {
      const qSiswa = query(collection(db, "siswa"), where("kelas", "==", item.namaKelas));
      const snapSiswa = await getDocs(qSiswa);
      setSiswaList(snapSiswa.docs.map((d) => ({ id: d.id, ...d.data() })) as unknown as Siswa[]);
    }
    if (item.indikatorId) {
      const qSub = query(collection(db, "sub_indikators"), where("groupId", "==", item.indikatorId));
      const snapSub = await getDocs(qSub);
      setSubIndikatorList(snapSub.docs.map((d) => ({ id: d.id, ...d.data() })) as unknown as SubIndikator[]);
    }

    setCurrentId(item.id);
    setIsEditing(true);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setCurrentId(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">Nilai Indikator</h1>
        <button onClick={openModal} className="bg-[#581c87] text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-[#45156b] transition">
          <Plus className="w-4 h-4" /> Tambah Penilaian
        </button>
      </div>

      {/* Tabel Data */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600 min-w-[1100px]">
            <thead className="bg-gray-50 text-gray-900 font-semibold border-b">
              <tr>
                <th className="p-4 w-12">No</th>
                <th className="p-4">Tanggal</th>
                <th className="p-4">Cabang</th>
                <th className="p-4">Kelas</th>
                <th className="p-4">Nama Siswa</th>
                <th className="p-4">Semester</th>
                <th className="p-4">Indikator</th>
                <th className="p-4">Sub Indikator</th>
                <th className="p-4 text-center">Nilai</th>
                <th className="p-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={10} className="p-8 text-center">Memuat data...</td></tr>
              ) : dataList.length === 0 ? (
                <tr><td colSpan={10} className="p-8 text-center">Belum ada data penilaian.</td></tr>
              ) : (
                dataList.map((item, index) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="p-4 text-center">{index + 1}</td>
                    <td className="p-4">{item.tanggal}</td>
                    <td className="p-4">{item.namaCabang}</td>
                    <td className="p-4">{item.namaKelas}</td>
                    <td className="p-4 font-medium text-gray-900">{item.namaSiswa}</td>
                    <td className="p-4">{item.namaSemester}</td>
                    <td className="p-4 max-w-xs truncate" title={item.namaIndikator}>{item.namaIndikator}</td>
                    <td className="p-4 max-w-xs truncate" title={item.namaSubIndikator}>{item.namaSubIndikator}</td>
                    <td className="p-4 text-center">
                      <span className={`inline-block w-8 h-8 leading-8 rounded-full font-bold text-white ${
                        item.nilai === 3 ? "bg-green-500" : item.nilai === 2 ? "bg-yellow-500" : "bg-red-500"
                      }`}>
                        {item.nilai}
                      </span>
                    </td>
                    <td className="p-4 flex justify-center gap-2">
                      <button onClick={() => handleEdit(item)} className="p-2 text-[#581c87] hover:bg-[#581c87]/10 rounded-lg transition" title="Edit">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(item.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition" title="Hapus">
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

      {/* Modal Form */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-4 border-b flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-gray-800">{isEditing ? "Edit Penilaian" : "Tambah Penilaian"}</h3>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal Penilaian</label>
                  <input 
                    type="date" 
                    required 
                    className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#581c87] outline-none"
                    value={form.tanggal}
                    onChange={(e) => setForm({...form, tanggal: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Semester</label>
                  <select 
                    required 
                    className="w-full border rounded-lg p-2 bg-white focus:ring-2 focus:ring-[#581c87] outline-none"
                    value={form.semesterId}
                    onChange={handleSemesterChange}
                  >
                    <option value="">Pilih Semester</option>
                    {semesterList.map(s => (
                      <option key={s.id} value={s.id}>{s.namaPeriode} {s.isDefault ? "(Default)" : ""}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cabang</label>
                  <select 
                    required 
                    className="w-full border rounded-lg p-2 bg-white focus:ring-2 focus:ring-[#581c87] outline-none"
                    value={form.cabangId}
                    onChange={handleCabangChange}
                  >
                    <option value="">Pilih Cabang</option>
                    {cabangList.map(c => (
                      <option key={c.id} value={c.id}>{c.nama}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Kelas</label>
                  <select 
                    required 
                    className="w-full border rounded-lg p-2 bg-white focus:ring-2 focus:ring-[#581c87] outline-none"
                    value={form.kelasId}
                    onChange={handleKelasChange}
                    disabled={!form.cabangId}
                  >
                    <option value="">Pilih Kelas</option>
                    {kelasList.map(k => (
                      <option key={k.id} value={k.id}>{k.namaKelas}</option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nama Siswa</label>
                  <select 
                    required 
                    className="w-full border rounded-lg p-2 bg-white focus:ring-2 focus:ring-[#581c87] outline-none"
                    value={form.siswaId}
                    onChange={handleSiswaChange}
                    disabled={!form.kelasId}
                  >
                    <option value="">Pilih Siswa</option>
                    {siswaList.map(s => (
                      <option key={s.id} value={s.id}>{s.nama}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Indikator</label>
                  <select 
                    required 
                    className="w-full border rounded-lg p-2 bg-white focus:ring-2 focus:ring-[#581c87] outline-none"
                    value={form.indikatorId}
                    onChange={handleIndikatorChange}
                  >
                    <option value="">Pilih Indikator</option>
                    {indikatorList.map(i => (
                      <option key={i.id} value={i.id}>{i.nama}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sub Indikator</label>
                  <select 
                    required 
                    className="w-full border rounded-lg p-2 bg-white focus:ring-2 focus:ring-[#581c87] outline-none"
                    value={form.subIndikatorId}
                    onChange={handleSubIndikatorChange}
                    disabled={!form.indikatorId}
                  >
                    <option value="">Pilih Sub Indikator</option>
                    {subIndikatorList.length === 0 && form.indikatorId && (
                      <option disabled>Tidak ada sub indikator</option>
                    )}
                    {subIndikatorList.map(s => (
                      <option key={s.id} value={s.id}>{s.deskripsi}</option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nilai</label>
                  <select 
                    required 
                    className="w-full border rounded-lg p-2 bg-white focus:ring-2 focus:ring-[#581c87] outline-none"
                    value={form.nilai}
                    onChange={(e) => setForm({...form, nilai: Number(e.target.value)})}
                  >
                    <option value="1">1 (Belum Muncul)</option>
                    <option value="2">2 (Muncul Sebagian)</option>
                    <option value="3">3 (Sudah Muncul)</option>
                  </select>
                </div>
              </div>

              <div className="pt-4 border-t flex justify-end gap-3">
                <button type="button" onClick={closeModal} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition">
                  Batal
                </button>
                <button type="submit" disabled={submitting} className="px-4 py-2 bg-[#581c87] text-white rounded-lg hover:bg-[#45156b] transition flex items-center gap-2">
                  <Save className="w-4 h-4" />
                  {submitting ? "Menyimpan..." : "Simpan Data"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}