"use client";

import { useState, useEffect } from "react";
import { db, auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
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
import { Plus, Pencil, Trash2, X, Save, Filter } from "lucide-react";

// --- Interfaces ---
interface NilaiTrilogi {
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
  trilogiId: string;
  namaTrilogi: string;
  subTrilogiId: string;
  namaSubTrilogi: string;
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
  guruKelas?: string[];
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

interface Trilogi {
  id: string;
  nama: string;
}

interface SubTrilogi {
  id: string;
  deskripsi: string;
  groupId: string;
}

interface KriteriaNilai {
  id: string;
  kategoriId: string;
  nama: string;
  nilai: number;
}

export default function NilaiTrilogiPage() {
  // --- State Data Utama ---
  const [dataList, setDataList] = useState<NilaiTrilogi[]>([]);
  const [loading, setLoading] = useState(true);

  // --- State Dropdowns (Master Data) ---
  const [cabangList, setCabangList] = useState<Cabang[]>([]);
  const [kelasList, setKelasList] = useState<Kelas[]>([]); // Filtered by Cabang
  const [siswaList, setSiswaList] = useState<Siswa[]>([]); // Filtered by Kelas
  const [semesterList, setSemesterList] = useState<Semester[]>([]);
  const [trilogiList, setTrilogiList] = useState<Trilogi[]>([]);
  const [subTrilogiList, setSubTrilogiList] = useState<SubTrilogi[]>([]); // Filtered by Trilogi
  const [kriteriaOptions, setKriteriaOptions] = useState<KriteriaNilai[]>([]);

  // --- Filter State ---
  const [filterCabang, setFilterCabang] = useState<string>("");
  const [filterKelas, setFilterKelas] = useState<string>("");
  const [filterSiswa, setFilterSiswa] = useState<string>("");
  const [filterSemester, setFilterSemester] = useState<string>("");

  // --- Filter Options State ---
  const [filterKelasList, setFilterKelasList] = useState<Kelas[]>([]);
  const [filterSiswaList, setFilterSiswaList] = useState<Siswa[]>([]);

  // --- State Form ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // --- User Role State ---
  const [userRole, setUserRole] = useState<string>("");
  const [userCabangId, setUserCabangId] = useState<string>("");
  const [userKelasId, setUserKelasId] = useState<string>("");

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
    trilogiId: "",
    namaTrilogi: "",
    subTrilogiId: "",
    namaSubTrilogi: "",
    nilai: 0,
  });

  // --- Fetch Initial Data ---
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        // 1. Fetch Data Nilai (Tabel Utama)
        const qNilai = query(collection(db, "nilai_trilogi"), orderBy("tanggal", "desc"));
        const snapNilai = await getDocs(qNilai);
        const nilaiData = snapNilai.docs.map((d) => ({ id: d.id, ...d.data() })) as NilaiTrilogi[];
        setDataList(nilaiData);

        // 2. Fetch Master Cabang
        const snapCabang = await getDocs(query(collection(db, "cabang"), orderBy("nama", "asc")));
        setCabangList(snapCabang.docs.map((d) => ({ id: d.id, ...d.data() })) as Cabang[]);

        // 3. Fetch Master Semester
        const snapSemester = await getDocs(query(collection(db, "kpi_periode"), orderBy("namaPeriode", "asc")));
        const semesters = snapSemester.docs.map((d) => ({ id: d.id, ...d.data() })) as Semester[];
        setSemesterList(semesters);

        // Set Default Filter Semester
        const defaultSem = semesters.find(s => s.isDefault);
        if (defaultSem) setFilterSemester(defaultSem.id);

        // 4. Fetch Master Trilogi
        const snapTrilogi = await getDocs(collection(db, "trilogi_groups"));
        setTrilogiList(snapTrilogi.docs.map((d) => ({ id: d.id, ...d.data() })) as unknown as Trilogi[]);

        // 5. Fetch Kriteria Nilai (Kategori: Nilai Trilogi)
        const qKat = query(collection(db, "kategori_penilaian"), where("nama", "==", "Nilai Trilogi"));
        const snapKat = await getDocs(qKat);
        if (!snapKat.empty) {
          const katId = snapKat.docs[0].id;
          const qKriteria = query(collection(db, "kriteria_nilai"), where("kategoriId", "==", katId));
          const snapKriteria = await getDocs(qKriteria);
          const items = snapKriteria.docs.map((d) => ({ id: d.id, ...d.data() })) as unknown as KriteriaNilai[];
          setKriteriaOptions(items.sort((a, b) => a.nilai - b.nilai));
        }

      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchInitialData();
  }, []);

  // --- Auth & Role Logic ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser && cabangList.length > 0) {
        try {
          const q = query(collection(db, "guru"), where("email", "==", currentUser.email));
          const querySnapshot = await getDocs(q);
          if (!querySnapshot.empty) {
            const userData = querySnapshot.docs[0].data();
            const role = userData.role;
            setUserRole(role);

            if (role === "Kepala Sekolah" || role === "Guru") {
              // 1. Set Cabang
              const userCabangName = userData.cabang;
              const foundCabang = cabangList.find(c => c.nama === userCabangName);
              
              if (foundCabang) {
                setFilterCabang(foundCabang.id);
                setUserCabangId(foundCabang.id);

                // Fetch Kelas for this Cabang (for Filter Dropdown)
                const qKelas = query(collection(db, "kelas"), where("cabang", "==", userCabangName));
                const snapKelas = await getDocs(qKelas);
                const classes = snapKelas.docs.map((d) => ({ id: d.id, ...d.data() })) as unknown as Kelas[];
                setFilterKelasList(classes);

                // 2. If Guru, Set Kelas
                if (role === "Guru") {
                  const guruName = userData.nama;
                  const foundKelas = classes.find(k => k.guruKelas && k.guruKelas.includes(guruName));
                  
                  if (foundKelas) {
                    setFilterKelas(foundKelas.id);
                    setUserKelasId(foundKelas.id);

                    // Fetch Siswa for this Kelas (for Filter Dropdown)
                    const qSiswa = query(
                      collection(db, "siswa"), 
                      where("kelas", "==", foundKelas.namaKelas),
                      where("cabang", "==", userCabangName)
                    );
                    const snapSiswa = await getDocs(qSiswa);
                    setFilterSiswaList(snapSiswa.docs.map((d) => ({ id: d.id, ...d.data() })) as unknown as Siswa[]);
                  }
                }
              }
            }
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
        }
      }
    });
    return () => unsubscribe();
  }, [cabangList]);

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
      const qSiswa = query(
        collection(db, "siswa"), 
        where("kelas", "==", selectedKelas.namaKelas),
        where("cabang", "==", selectedKelas.cabang)
      );
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

  // 5. Handle Trilogi Change -> Fetch Sub Trilogi
  const handleTrilogiChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedId = e.target.value;
    const selectedTrilogi = trilogiList.find((i) => i.id === selectedId);

    setForm((prev) => ({
      ...prev,
      trilogiId: selectedId,
      namaTrilogi: selectedTrilogi?.nama || "",
      subTrilogiId: "", namaSubTrilogi: "" // Reset sub trilogi
    }));

    if (selectedId) {
      const qSub = query(collection(db, "sub_trilogi"), where("groupId", "==", selectedId));
      const snapSub = await getDocs(qSub);
      setSubTrilogiList(snapSub.docs.map((d) => ({ id: d.id, ...d.data() })) as unknown as SubTrilogi[]);
    } else {
      setSubTrilogiList([]);
    }
  };

  // 6. Handle Sub Trilogi Change
  const handleSubTrilogiChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedId = e.target.value;
    const selectedSub = subTrilogiList.find((s) => s.id === selectedId);
    setForm((prev) => ({
      ...prev,
      subTrilogiId: selectedId,
      namaSubTrilogi: selectedSub?.deskripsi || ""
    }));
  };

  // --- Filter Handlers ---
  const handleFilterCabangChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setFilterCabang(val);
    setFilterKelas("");
    setFilterSiswa("");
    setFilterKelasList([]);
    setFilterSiswaList([]);

    if (val) {
      const selectedCabang = cabangList.find((c) => c.id === val);
      if (selectedCabang) {
        const qKelas = query(collection(db, "kelas"), where("cabang", "==", selectedCabang.nama));
        const snapKelas = await getDocs(qKelas);
        setFilterKelasList(snapKelas.docs.map((d) => ({ id: d.id, ...d.data() })) as unknown as Kelas[]);
      }
    }
  };

  const handleFilterKelasChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setFilterKelas(val);
    setFilterSiswa("");
    setFilterSiswaList([]);

    if (val) {
      const selectedKelas = filterKelasList.find((k) => k.id === val);
      if (selectedKelas) {
        const qSiswa = query(
          collection(db, "siswa"),
          where("kelas", "==", selectedKelas.namaKelas),
          where("cabang", "==", selectedKelas.cabang)
        );
        const snapSiswa = await getDocs(qSiswa);
        setFilterSiswaList(snapSiswa.docs.map((d) => ({ id: d.id, ...d.data() })) as unknown as Siswa[]);
      }
    }
  };

  // --- Filter Logic ---
  const filteredData = dataList.filter((item) => {
    const matchCabang = filterCabang ? item.cabangId === filterCabang : true;
    const matchKelas = filterKelas ? item.kelasId === filterKelas : true;
    const matchSiswa = filterSiswa ? item.siswaId === filterSiswa : true;
    const matchSemester = filterSemester ? item.semesterId === filterSemester : true;
    return matchCabang && matchKelas && matchSiswa && matchSemester;
  });

  // --- CRUD Operations ---

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (isEditing && currentId) {
        await updateDoc(doc(db, "nilai_trilogi", currentId), {
          ...form,
          updatedAt: serverTimestamp(),
        });
        alert("Data berhasil diperbarui!");
      } else {
        await addDoc(collection(db, "nilai_trilogi"), {
          ...form,
          createdAt: serverTimestamp(),
        });
        alert("Data berhasil ditambahkan!");
      }
      closeModal();
      // Refresh Data Table
      const qNilai = query(collection(db, "nilai_trilogi"), orderBy("tanggal", "desc"));
      const snapNilai = await getDocs(qNilai);
      setDataList(snapNilai.docs.map((d) => ({ id: d.id, ...d.data() })) as NilaiTrilogi[]);
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
        await deleteDoc(doc(db, "nilai_trilogi", id));
        setDataList((prev) => prev.filter((item) => item.id !== id));
      } catch (error) {
        console.error("Error deleting:", error);
        alert("Gagal menghapus data.");
      }
    }
  };

  const openModal = async () => {
    // Set default semester
    const defaultSem = semesterList.find((s) => s.isDefault);
    
    // Prepare initial values based on Role
    let initialCabangId = userCabangId || "";
    let initialCabangName = cabangList.find(c => c.id === userCabangId)?.nama || "";
    let initialKelasId = userKelasId || "";
    let initialKelasName = "";

    // If User is Guru/KS, we need to populate the dropdowns for the form immediately
    if (initialCabangId) {
       const qKelas = query(collection(db, "kelas"), where("cabang", "==", initialCabangName));
       const snapKelas = await getDocs(qKelas);
       const classes = snapKelas.docs.map((d) => ({ id: d.id, ...d.data() })) as unknown as Kelas[];
       setKelasList(classes);

       if (initialKelasId) {
         const foundKelas = classes.find(k => k.id === initialKelasId);
         initialKelasName = foundKelas?.namaKelas || "";
         
         // Fetch Siswa
         const qSiswa = query(
           collection(db, "siswa"), 
           where("kelas", "==", initialKelasName),
           where("cabang", "==", initialCabangName)
         );
         const snapSiswa = await getDocs(qSiswa);
         setSiswaList(snapSiswa.docs.map((d) => ({ id: d.id, ...d.data() })) as unknown as Siswa[]);
       }
    } else {
       setKelasList([]);
       setSiswaList([]);
    }

    setForm({
      tanggal: new Date().toISOString().split("T")[0],
      cabangId: initialCabangId, namaCabang: initialCabangName,
      kelasId: initialKelasId, namaKelas: initialKelasName,
      siswaId: "", namaSiswa: "",
      semesterId: defaultSem?.id || "", namaSemester: defaultSem?.namaPeriode || "",
      trilogiId: "", namaTrilogi: "",
      subTrilogiId: "", namaSubTrilogi: "",
      nilai: 0,
    });
    setSubTrilogiList([]);
    setIsEditing(false);
    setIsModalOpen(true);
  };

  const handleEdit = async (item: NilaiTrilogi) => {
    // 1. Set Form Basic
    setForm({
      tanggal: item.tanggal,
      cabangId: item.cabangId, namaCabang: item.namaCabang,
      kelasId: item.kelasId, namaKelas: item.namaKelas,
      siswaId: item.siswaId, namaSiswa: item.namaSiswa,
      semesterId: item.semesterId, namaSemester: item.namaSemester,
      trilogiId: item.trilogiId, namaTrilogi: item.namaTrilogi,
      subTrilogiId: item.subTrilogiId, namaSubTrilogi: item.namaSubTrilogi,
      nilai: item.nilai,
    });

    // 2. Populate Dropdowns (Async)
    if (item.namaCabang) {
      const qKelas = query(collection(db, "kelas"), where("cabang", "==", item.namaCabang));
      const snapKelas = await getDocs(qKelas);
      setKelasList(snapKelas.docs.map((d) => ({ id: d.id, ...d.data() })) as unknown as Kelas[]);
    }
    if (item.namaKelas) {
      const qSiswa = query(
        collection(db, "siswa"), 
        where("kelas", "==", item.namaKelas),
        where("cabang", "==", item.namaCabang)
      );
      const snapSiswa = await getDocs(qSiswa);
      setSiswaList(snapSiswa.docs.map((d) => ({ id: d.id, ...d.data() })) as unknown as Siswa[]);
    }
    if (item.trilogiId) {
      const qSub = query(collection(db, "sub_trilogi"), where("groupId", "==", item.trilogiId));
      const snapSub = await getDocs(qSub);
      setSubTrilogiList(snapSub.docs.map((d) => ({ id: d.id, ...d.data() })) as unknown as SubTrilogi[]);
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
        <h1 className="text-2xl font-bold text-gray-800">Nilai Trilogi</h1>
        <button onClick={openModal} className="bg-[#581c87] text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-[#45156b] transition">
          <Plus className="w-4 h-4" /> Tambah Penilaian
        </button>
      </div>

      {/* Filter Section */}
      <div className="flex flex-wrap gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100 items-center">
        <div className="flex items-center gap-2 text-gray-600">
          <Filter className="w-4 h-4" />
          <span className="text-sm font-medium">Filter:</span>
        </div>

        <select
          className="border rounded-lg p-2 text-sm bg-white outline-none focus:ring-2 focus:ring-[#581c87]"
          value={filterCabang}
          onChange={handleFilterCabangChange}
          disabled={userRole === "Kepala Sekolah" || userRole === "Guru"}
        >
          <option value="">Semua Cabang</option>
          {cabangList.map((c) => (
            <option key={c.id} value={c.id}>{c.nama}</option>
          ))}
        </select>

        <select
          className="border rounded-lg p-2 text-sm bg-white outline-none focus:ring-2 focus:ring-[#581c87]"
          value={filterKelas}
          onChange={handleFilterKelasChange}
          disabled={!filterCabang || userRole === "Guru"}
        >
          <option value="">Semua Kelas</option>
          {filterKelasList.map((k) => (
            <option key={k.id} value={k.id}>{k.namaKelas}</option>
          ))}
        </select>

        <select
          className="border rounded-lg p-2 text-sm bg-white outline-none focus:ring-2 focus:ring-[#581c87]"
          value={filterSiswa}
          onChange={(e) => setFilterSiswa(e.target.value)}
          disabled={!filterKelas}
        >
          <option value="">Semua Siswa</option>
          {filterSiswaList.map((s) => (
            <option key={s.id} value={s.id}>{s.nama}</option>
          ))}
        </select>

        <select
          className="border rounded-lg p-2 text-sm bg-white outline-none focus:ring-2 focus:ring-[#581c87]"
          value={filterSemester}
          onChange={(e) => setFilterSemester(e.target.value)}
        >
          <option value="">Semua Semester</option>
          {semesterList.map((s) => (
            <option key={s.id} value={s.id}>{s.namaPeriode} {s.isDefault ? "(Default)" : ""}</option>
          ))}
        </select>
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
                <th className="p-4">Trilogi</th>
                <th className="p-4">Sub Trilogi</th>
                <th className="p-4 text-center">Nilai</th>
                <th className="p-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={10} className="p-8 text-center">Memuat data...</td></tr>
              ) : filteredData.length === 0 ? (
                <tr><td colSpan={10} className="p-8 text-center">Belum ada data penilaian.</td></tr>
              ) : (
                filteredData.map((item, index) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="p-4 text-center">{index + 1}</td>
                    <td className="p-4">{item.tanggal}</td>
                    <td className="p-4">{item.namaCabang}</td>
                    <td className="p-4">{item.namaKelas}</td>
                    <td className="p-4 font-medium text-gray-900">{item.namaSiswa}</td>
                    <td className="p-4">{item.namaSemester}</td>
                    <td className="p-4 max-w-xs truncate" title={item.namaTrilogi}>{item.namaTrilogi}</td>
                    <td className="p-4 max-w-xs truncate" title={item.namaSubTrilogi}>{item.namaSubTrilogi}</td>
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
                    className={`w-full border rounded-lg p-2 bg-white focus:ring-2 focus:ring-[#581c87] outline-none ${userRole === "Kepala Sekolah" || userRole === "Guru" ? "bg-gray-100 cursor-not-allowed" : ""}`}
                    value={form.cabangId}
                    onChange={handleCabangChange}
                    disabled={userRole === "Kepala Sekolah" || userRole === "Guru"}
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
                    className={`w-full border rounded-lg p-2 bg-white focus:ring-2 focus:ring-[#581c87] outline-none ${userRole === "Guru" ? "bg-gray-100 cursor-not-allowed" : ""}`}
                    value={form.kelasId}
                    onChange={handleKelasChange}
                    disabled={!form.cabangId || userRole === "Guru"}
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Trilogi</label>
                  <select 
                    required 
                    className="w-full border rounded-lg p-2 bg-white focus:ring-2 focus:ring-[#581c87] outline-none"
                    value={form.trilogiId}
                    onChange={handleTrilogiChange}
                  >
                    <option value="">Pilih Trilogi</option>
                    {trilogiList.map(i => (
                      <option key={i.id} value={i.id}>{i.nama}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sub Trilogi</label>
                  <select 
                    required 
                    className="w-full border rounded-lg p-2 bg-white focus:ring-2 focus:ring-[#581c87] outline-none"
                    value={form.subTrilogiId}
                    onChange={handleSubTrilogiChange}
                    disabled={!form.trilogiId}
                  >
                    <option value="">Pilih Sub Trilogi</option>
                    {subTrilogiList.length === 0 && form.trilogiId && (
                      <option disabled>Tidak ada sub trilogi</option>
                    )}
                    {subTrilogiList.map(s => (
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
                    <option value="">Pilih Nilai</option>
                    {kriteriaOptions.map((k) => (
                      <option key={k.id} value={k.nilai}>{k.nilai} ({k.nama})</option>
                    ))}
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