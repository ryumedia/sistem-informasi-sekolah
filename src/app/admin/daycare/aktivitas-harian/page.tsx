// src/app/admin/daycare/aktivitas-harian/page.tsx
"use client";

import { useState, useEffect } from "react";
import { db, auth } from "@/lib/firebase"; // Added auth
import { onAuthStateChanged } from "firebase/auth"; // Added onAuthStateChanged
import {
  collection,
  query,
  orderBy,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  where,
  Timestamp,
} from "firebase/firestore";
import { Plus, Pencil, Trash2, X, Loader2, Eye, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";

// Define interfaces for our data structures
interface Cabang {
  id: string;
  nama: string;
}
interface Kelas {
  id: string;
  namaKelas: string;
  cabang: string;
  guruKelas?: string[]; // Added optional property
}
interface Siswa {
  id: string;
  nama: string;
  cabang: string;
  kelas: string;
  isDaycare?: boolean;
  kelasDaycare?: string;
}
interface Aktivitas {
  id: string;
  nama: string;
  urutan: number;
  subAktivitas: SubAktivitas[];
}
interface SubAktivitas {
  id:string;
  deskripsi: string;
  opsiJawaban: string[];
}
interface LaporanHarian {
    id: string;
    tanggal: Timestamp;
    cabangId: string;
    kelasId: string;
    siswaId: string;
    hasil: { [key: string]: string[] };
    // For display purposes
    namaSiswa?: string;
    namaCabang?: string;
    namaKelas?: string;
}

const ITEMS_PER_PAGE = 20;

const initialFormData = {
  tanggal: new Date(),
  cabangId: "",
  kelasId: "",
  siswaId: "",
  hasil: {},
};

export default function AktivitasHarianPage() {
  // Lists from DB
  const [laporanList, setLaporanList] = useState<LaporanHarian[]>([]);
  const [cabangList, setCabangList] = useState<Cabang[]>([]);
  const [kelasList, setKelasList] = useState<Kelas[]>([]);
  const [siswaList, setSiswaList] = useState<Siswa[]>([]);
  const [aktivitasChecklist, setAktivitasChecklist] = useState<Aktivitas[]>([]);

  // Filtered lists for dropdowns
  const [filteredKelasList, setFilteredKelasList] = useState<Kelas[]>([]);
  const [filteredSiswaList, setFilteredSiswaList] = useState<Siswa[]>([]);

  // Component State
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingLaporanId, setEditingLaporanId] = useState<string | null>(null);
  const [selectedLaporan, setSelectedLaporan] = useState<LaporanHarian | null>(null);
  const [formData, setFormData] = useState<any>(initialFormData);
  const [currentUser, setCurrentUser] = useState<any>(null); // State for logged-in user

  // State for page filters
  const [filterCabang, setFilterCabang] = useState<string>("");
  const [filteredLaporanList, setFilteredLaporanList] = useState<LaporanHarian[]>([]);
  const [searchNama, setSearchNama] = useState<string>("");
  const [filterTanggalDari, setFilterTanggalDari] = useState<string>(""); // yyyy-MM-dd
  const [filterTanggalSampai, setFilterTanggalSampai] = useState<string>(""); // yyyy-MM-dd

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);

  // 1. Auth Check & Get User Data
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user && user.email) {
        let userData: any = null;
        // Cek di koleksi 'guru' (termasuk Admin, Guru, KS, dll)
        const qGuru = query(collection(db, "guru"), where("email", "==", user.email));
        const snapGuru = await getDocs(qGuru);
        if (!snapGuru.empty) {
          userData = { ...snapGuru.docs[0].data(), id: snapGuru.docs[0].id };
        } else {
          // Jika tidak ada di 'guru', cek di 'caregivers'
          const qCaregiver = query(collection(db, "caregivers"), where("email", "==", user.email));
          const snapCaregiver = await getDocs(qCaregiver);
          if (!snapCaregiver.empty) {
            userData = { ...snapCaregiver.docs[0].data(), id: snapCaregiver.docs[0].id };
          }
        }
        if (!userData) {
          // User login tapi tidak terdaftar di 'guru' maupun 'caregivers'
          console.warn("Aktivitas Harian: data user tidak ditemukan untuk email", user.email);
          setLoading(false);
        }
        setCurrentUser(userData);
      } else {
        setCurrentUser(null);
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // 2. Fetch Data based on User Role
  useEffect(() => {
    if (!currentUser) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        // --- Fetch Cabang ---
        const cabangSnapshot = await getDocs(query(collection(db, "cabang"), orderBy("nama", "asc")));
        let allCabang = cabangSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Cabang));

        // Filter Cabang jika Caregiver/Guru
        if ((currentUser.role === "Caregiver" || currentUser.role === "Guru") && currentUser.cabang) {
            allCabang = allCabang.filter(c => c.nama === currentUser.cabang);
        }
        setCabangList(allCabang);

        // --- Fetch Kelas ---
        let kelasQuery;
        // Logic: cari array 'guruKelas' berarti itu guru yang sedang log in
        if ((currentUser.role === "Caregiver" || currentUser.role === "Guru") && currentUser.nama) {
             kelasQuery = query(collection(db, "kelas"), where("guruKelas", "array-contains", currentUser.nama));
        } else {
             kelasQuery = query(collection(db, "kelas"), orderBy("namaKelas", "asc"));
        }

        const kelasSnapshot = await getDocs(kelasQuery);
        let allKelas = kelasSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Kelas));

        // Extra safety: filter by branch if user has branch
        if ((currentUser.role === "Caregiver" || currentUser.role === "Guru") && currentUser.cabang) {
            allKelas = allKelas.filter(k => k.cabang === currentUser.cabang);
        }
        setKelasList(allKelas);

        // --- Fetch Siswa ---
        // Filter siswa based on allowed classes
        const allowedKelasNames = allKelas.map(k => k.namaKelas);
        // Role dengan akses penuh (sama dengan role yang boleh memilih "Semua Cabang")
        const isFullAccess = ["Admin", "Direktur", "Yayasan"].includes(currentUser.role);
        let siswaQuery;

        if (isFullAccess) {
             siswaQuery = query(collection(db, "siswa"), orderBy("nama", "asc"));
        } else {
             // Optimasi: Filter by branch dulu jika ada
             if (currentUser.cabang) {
                 siswaQuery = query(collection(db, "siswa"), where("cabang", "==", currentUser.cabang));
             } else {
                 siswaQuery = query(collection(db, "siswa"), orderBy("nama", "asc"));
             }
        }

        const siswaSnapshot = await getDocs(siswaQuery);
        let allSiswa = siswaSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Siswa));

        // Filter siswa agar hanya yang ada di kelas yang diampu
        // Siswa daycare menyimpan kelasnya di 'kelasDaycare', jadi cek keduanya
        if (!isFullAccess) {
            allSiswa = allSiswa.filter(s =>
                allowedKelasNames.includes(s.kelas) ||
                (!!s.kelasDaycare && allowedKelasNames.includes(s.kelasDaycare))
            );
        }
        setSiswaList(allSiswa);

        // --- Fetch Aktivitas (Static) ---
        const aktivitasSnapshot = await getDocs(query(collection(db, "daycare_aktivitas"), orderBy("urutan", "asc")));
        const aktivitasDataPromises = aktivitasSnapshot.docs.map(async (aktivitasDoc) => {
            const subAktivitasQuery = query(collection(db, "daycare_sub_aktivitas"), where("aktivitasId", "==", aktivitasDoc.id), orderBy("urutan", "asc"));
            const subAktivitasSnapshot = await getDocs(subAktivitasQuery);
            const subAktivitas = subAktivitasSnapshot.docs.map(subDoc => ({id: subDoc.id, ...subDoc.data()}) as SubAktivitas);
            return { id: aktivitasDoc.id, ...aktivitasDoc.data(), subAktivitas } as Aktivitas;
        });
        const aktivitasData = await Promise.all(aktivitasDataPromises);
        setAktivitasChecklist(aktivitasData);

        // --- Fetch Laporan ---
        const laporanSnapshot = await getDocs(query(collection(db, "daycare_laporan_harian"), orderBy("tanggal", "desc")));
        const laporanData = laporanSnapshot.docs.map(doc => {
            const data = doc.data() as LaporanHarian;

            const siswa = allSiswa.find(s => s.id === data.siswaId);
            // Jika siswa tidak ada di daftar siswa yang boleh dilihat, sembunyikan
            if (!isFullAccess && !siswa) {
                 return null;
            }

            // Cari kelas lewat kelasId; jika kosong/tidak cocok (laporan lama, kelasId null),
            // fallback ke nama kelas siswa (kelasDaycare lebih dulu, lalu kelas reguler)
            const kelas =
                allKelas.find(k => k.id === data.kelasId) ||
                (siswa ? allKelas.find(k =>
                    k.namaKelas === (siswa.kelasDaycare || siswa.kelas) &&
                    (!siswa.cabang || k.cabang === siswa.cabang)
                ) : undefined);

            const displaySiswa = siswa || { nama: 'Siswa tidak ditemukan' };
            const displayKelas = kelas || { namaKelas: 'Kelas tidak ditemukan' };
            // Cari cabang lewat cabangId; jika kosong (laporan lama), fallback ke nama cabang siswa
            const cabang =
                allCabang.find(c => c.id === data.cabangId) ||
                (siswa ? allCabang.find(c => c.nama === siswa.cabang) : undefined);
            const displayCabang = cabang || { nama: 'Cabang tidak ditemukan' };

            return {
                ...data,
                // Pakai ID hasil resolusi agar filter cabang tetap berfungsi untuk laporan lama
                cabangId: cabang?.id || data.cabangId,
                kelasId: kelas?.id || data.kelasId,
                id: doc.id,
                namaSiswa: displaySiswa.nama,
                namaCabang: displayCabang.nama,
                namaKelas: displayKelas.namaKelas,
            };
        }).filter(item => item !== null) as LaporanHarian[];

        if (laporanSnapshot.size !== laporanData.length) {
            console.info(`Aktivitas Harian: ${laporanSnapshot.size} laporan di database, ${laporanData.length} ditampilkan untuk role "${currentUser.role}".`);
        }
        setLaporanList(laporanData);

      } catch (error) {
        console.error("Error fetching data: ", error);
        alert("Gagal memuat data. Silakan coba lagi.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [currentUser]);

  // Effect for page-level filtering
  useEffect(() => {
    // Jika user bukan admin, set filter cabang sesuai data user dan disable
    if (currentUser && (currentUser.role === "Caregiver" || currentUser.role === "Guru") && currentUser.cabang) {
        const userCabang = cabangList.find(c => c.nama === currentUser.cabang);
        if (userCabang) setFilterCabang(userCabang.id);
    }

    const keyword = searchNama.trim().toLowerCase();
    const filtered = laporanList.filter(laporan => {
        const matchCabang = !filterCabang || laporan.cabangId === filterCabang;
        const matchNama = !keyword || (laporan.namaSiswa || "").toLowerCase().includes(keyword);

        // Bandingkan dalam format yyyy-MM-dd (waktu lokal) agar tidak terpengaruh jam
        let matchTanggal = true;
        if (filterTanggalDari || filterTanggalSampai) {
            const tgl = laporan.tanggal?.toDate ? format(laporan.tanggal.toDate(), "yyyy-MM-dd") : "";
            if (!tgl) matchTanggal = false;
            if (filterTanggalDari && tgl < filterTanggalDari) matchTanggal = false;
            if (filterTanggalSampai && tgl > filterTanggalSampai) matchTanggal = false;
        }

        return matchCabang && matchNama && matchTanggal;
    });
    setFilteredLaporanList(filtered);
  }, [filterCabang, searchNama, filterTanggalDari, filterTanggalSampai, laporanList, currentUser, cabangList]);

  // Kembali ke halaman 1 setiap kali filter berubah
  const resetPage = () => setCurrentPage(1);
  const isFilterAktif = searchNama !== "" || filterTanggalDari !== "" || filterTanggalSampai !== "";
  const handleResetFilter = () => {
    setSearchNama("");
    setFilterTanggalDari("");
    setFilterTanggalSampai("");
    resetPage();
  };

  // Effect for cascading dropdowns
  // UPDATED: Now filters by name, not ID
  useEffect(() => {
    if (formData.cabangId) {
      const selectedCabang = cabangList.find(c => c.id === formData.cabangId);
      if (selectedCabang) {
        setFilteredKelasList(kelasList.filter(k => k.cabang === selectedCabang.nama));
      } else {
        setFilteredKelasList([]);
      }
    } else {
      setFilteredKelasList([]);
    }
    // Only reset if not editing or if values are invalid
    if (!editingLaporanId) {
        // If user is restricted and has only 1 class, don't reset if it matches
        if (!((currentUser?.role === "Caregiver" || currentUser?.role === "Guru") && kelasList.length === 1)) {
             setFormData((prev: any) => ({ ...prev, kelasId: "", siswaId: "" }));
        }
    }
  }, [formData.cabangId, cabangList, kelasList, currentUser, editingLaporanId]);

  // UPDATED: Now filters by name, not ID
  useEffect(() => {
    if (formData.cabangId && formData.kelasId) {
      const selectedCabang = cabangList.find(c => c.id === formData.cabangId);
      const selectedKelas = kelasList.find(k => k.id === formData.kelasId);
      if (selectedCabang && selectedKelas) {
        setFilteredSiswaList(
          siswaList.filter(s => s.cabang === selectedCabang.nama && (s.kelas === selectedKelas.namaKelas || s.kelasDaycare === selectedKelas.namaKelas))
        );
      } else {
        setFilteredSiswaList([]);
      }
    } else {
      setFilteredSiswaList([]);
    }
    if (!editingLaporanId) {
        setFormData((prev: any) => ({ ...prev, siswaId: "" }));
    }
  }, [formData.cabangId, formData.kelasId, siswaList, cabangList, kelasList, editingLaporanId]);


  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev: any) => ({ ...prev, [name]: value }));
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
     setFormData((prev: any) => ({ ...prev, tanggal: new Date(e.target.value) }));
  }

  const handleCheckboxChange = (subAktivitasId: string, option: string, isChecked: boolean) => {
    setFormData((prev: any) => {
      const currentOptions = prev.hasil[subAktivitasId] || [];
      let newOptions;
      if (isChecked) {
        newOptions = [...currentOptions, option];
      } else {
        newOptions = currentOptions.filter((o: string) => o !== option && !o.startsWith(`${option}:`));
      }
      return {
        ...prev,
        hasil: {
          ...prev.hasil,
          [subAktivitasId]: newOptions,
        },
      };
    });
  };

  const handleLainnyaTextChange = (subAktivitasId: string, text: string) => {
    setFormData((prev: any) => {
      const currentOptions = prev.hasil[subAktivitasId] || [];
      // Remove previous 'Lainnya' entry if it exists
      const filteredOptions = currentOptions.filter((o: string) => !o.startsWith("Lainnya:"));
      const newOptions = text ? [...filteredOptions, `Lainnya: ${text}`] : filteredOptions;
       // if 'Lainnya' checkbox is not checked, but there is text, check it
      const lainnyaCheckboxChecked = currentOptions.includes('Lainnya');
      if(text && !lainnyaCheckboxChecked) {
          currentOptions.push('Lainnya');
      }

      return {
        ...prev,
        hasil: {
          ...prev.hasil,
          [subAktivitasId]: newOptions,
        },
      };
    });
  };

  const openModal = async (laporan: LaporanHarian | null = null) => {
    if (laporan) {
      setEditingLaporanId(laporan.id);
      setFormData({
        ...laporan,
        tanggal: laporan.tanggal.toDate(),
      });
    } else {
      setEditingLaporanId(null);

      // Auto-select and Lock for Caregiver/Guru
      let defaultCabangId = "";
      let defaultKelasId = "";

      if ((currentUser?.role === "Caregiver" || currentUser?.role === "Guru") && cabangList.length > 0) {
          defaultCabangId = cabangList[0].id;
      }
      // If only one class available (common for teachers), select it
      if ((currentUser?.role === "Caregiver" || currentUser?.role === "Guru") && kelasList.length === 1) {
          defaultKelasId = kelasList[0].id;
      }

      setFormData({
          ...initialFormData,
          cabangId: defaultCabangId,
          kelasId: defaultKelasId
      });
    }
    setIsModalOpen(true);
  };

  const openDetailModal = (laporan: LaporanHarian) => {
      setSelectedLaporan(laporan);
      setIsDetailModalOpen(true);
  }

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingLaporanId(null);
    setFormData(initialFormData);
  };

  const closeDetailModal = () => {
      setIsDetailModalOpen(false);
      setSelectedLaporan(null);
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if(!formData.siswaId) {
        alert("Silakan pilih siswa terlebih dahulu.");
        return;
    }
    setIsSubmitting(true);

    const { id, namaSiswa, namaCabang, namaKelas, ...restOfData } = formData;
    const dataToSave = {
        ...restOfData,
        tanggal: Timestamp.fromDate(formData.tanggal),
    };

    try {
        const siswa = siswaList.find(s => s.id === formData.siswaId);
        const cabang = cabangList.find(c => c.id === formData.cabangId);
        const kelas = kelasList.find(k => k.id === formData.kelasId);

        if (editingLaporanId) {
            const laporanRef = doc(db, "daycare_laporan_harian", editingLaporanId);
            await updateDoc(laporanRef, dataToSave);
            alert("Laporan berhasil diperbarui!");

            setLaporanList(laporanList.map(l =>
                l.id === editingLaporanId
                ? {
                    id: editingLaporanId,
                    ...dataToSave,
                    namaSiswa: siswa?.nama,
                    namaCabang: cabang?.nama,
                    namaKelas: kelas?.namaKelas,
                }
                : l
            ));
        } else {
            const newDocRef = await addDoc(collection(db, "daycare_laporan_harian"), dataToSave);
            alert("Laporan harian berhasil disimpan!");

            setLaporanList([
              {
                id: newDocRef.id,
                ...dataToSave,
                namaSiswa: siswa?.nama,
                namaCabang: cabang?.nama,
                namaKelas: kelas?.namaKelas,
              },
              ...laporanList,
            ]);
        }
        closeModal();

    } catch (error) {
        console.error("Error saving laporan:", error);
        alert("Gagal menyimpan laporan.");
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
      if(!confirm("Yakin ingin menghapus laporan ini?")) return;
      try {
          await deleteDoc(doc(db, "daycare_laporan_harian", id));
          setLaporanList(laporanList.filter(l => l.id !== id));
          alert("Laporan berhasil dihapus.");
      } catch (error) {
          console.error("Error deleting laporan: ", error);
          alert("Gagal menghapus laporan.");
      }
  }

  // Pagination logic (halaman di-clamp agar tetap valid, misal setelah data dihapus)
  const totalPages = Math.max(1, Math.ceil(filteredLaporanList.length / ITEMS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * ITEMS_PER_PAGE;
  const paginatedLaporan = filteredLaporanList.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  // Nomor halaman yang ditampilkan (maks 5, berpusat di halaman aktif)
  const getPageNumbers = () => {
    const maxButtons = 5;
    let start = Math.max(1, safePage - Math.floor(maxButtons / 2));
    const end = Math.min(totalPages, start + maxButtons - 1);
    start = Math.max(1, end - maxButtons + 1);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">Aktivitas Harian Anak</h1>
        <button
          onClick={() => openModal()}
          className="bg-[#581c87] text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-[#45156b] transition"
        >
          <Plus className="w-4 h-4" /> Tambah Aktivitas
        </button>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <div className="lg:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Cari Nama Siswa</label>
              <div className="relative">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchNama}
                    onChange={(e) => { setSearchNama(e.target.value); resetPage(); }}
                    placeholder="Ketik nama siswa..."
                    className="w-full border rounded-lg p-2 pl-9 focus:ring-2 focus:ring-[#581c87] outline-none text-sm"
                  />
              </div>
          </div>
          <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Dari Tanggal</label>
              <input
                type="date"
                value={filterTanggalDari}
                max={filterTanggalSampai || undefined}
                onChange={(e) => { setFilterTanggalDari(e.target.value); resetPage(); }}
                className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#581c87] outline-none text-sm"
              />
          </div>
          <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sampai Tanggal</label>
              <input
                type="date"
                value={filterTanggalSampai}
                min={filterTanggalDari || undefined}
                onChange={(e) => { setFilterTanggalSampai(e.target.value); resetPage(); }}
                className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#581c87] outline-none text-sm"
              />
          </div>
          <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Filter Cabang</label>
              <select
                name="filterCabang"
                value={filterCabang}
                onChange={(e) => { setFilterCabang(e.target.value); resetPage(); }}
                className={`w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#581c87] outline-none text-sm ${(currentUser?.role !== "Admin" && currentUser?.role !== "Direktur" && currentUser?.role !== "Yayasan") ? "bg-gray-100 cursor-not-allowed" : ""}`}
                disabled={(currentUser?.role !== "Admin" && currentUser?.role !== "Direktur" && currentUser?.role !== "Yayasan")}
              >
                  <option value="">Semua Cabang</option>
                  {cabangList.map(c => <option key={c.id} value={c.id}>{c.nama}</option>)}
              </select>
          </div>
          {isFilterAktif && (
              <div className="md:col-span-2 lg:col-span-5 flex items-center justify-between text-sm">
                  <span className="text-gray-500">Ditemukan {filteredLaporanList.length} dari {laporanList.length} laporan</span>
                  <button onClick={handleResetFilter} className="flex items-center gap-1 text-[#581c87] hover:underline">
                      <X className="w-4 h-4" /> Reset Filter
                  </button>
              </div>
          )}
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50 text-gray-900 font-semibold border-b">
              <tr>
                <th className="p-4 w-16 text-center">No.</th>
                <th className="p-4">Tanggal</th>
                <th className="p-4">Nama</th>
                <th className="p-4">Cabang</th>
                <th className="p-4">Kelas</th>
                <th className="p-4 w-48 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={6} className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-[#581c87]" /></td></tr>
              ) : filteredLaporanList.length === 0 ? (
                <tr><td colSpan={6} className="p-8 text-center text-gray-500">{isFilterAktif ? "Tidak ada laporan yang cocok dengan filter." : "Belum ada laporan."}</td></tr>
              ) : (
                paginatedLaporan.map((l, i) => (
                  <tr key={l.id} className="hover:bg-gray-50">
                    <td className="p-4 text-center">{startIndex + i + 1}</td>
                    <td className="p-4">{format(l.tanggal.toDate(), 'dd MMMM yyyy')}</td>
                    <td className="p-4 font-medium text-gray-900">{l.namaSiswa}</td>
                    <td className="p-4">{l.namaCabang}</td>
                    <td className="p-4">{l.namaKelas}</td>
                    <td className="p-4 flex justify-center gap-2">
                       <button onClick={() => openDetailModal(l)} className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition" title="Lihat Detail"><Eye className="w-4 h-4" /></button>
                       <button onClick={() => openModal(l)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition" title="Edit"><Pencil className="w-4 h-4" /></button>
                       <button onClick={() => handleDelete(l.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition" title="Hapus"><Trash2 className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && filteredLaporanList.length > 0 && (
          <div className="flex flex-col md:flex-row justify-between items-center gap-3 p-4 border-t border-gray-100">
            <p className="text-sm text-gray-600">
              Menampilkan {startIndex + 1}–{Math.min(startIndex + ITEMS_PER_PAGE, filteredLaporanList.length)} dari {filteredLaporanList.length} data
            </p>
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage(Math.max(1, safePage - 1))}
                  disabled={safePage === 1}
                  className="p-2 rounded-lg border text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Sebelumnya"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {getPageNumbers().map(page => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`min-w-[36px] px-3 py-1.5 rounded-lg border text-sm transition ${page === safePage ? "bg-[#581c87] text-white border-[#581c87]" : "text-gray-700 hover:bg-gray-100"}`}
                  >
                    {page}
                  </button>
                ))}
                <button
                  onClick={() => setCurrentPage(Math.min(totalPages, safePage + 1))}
                  disabled={safePage === totalPages}
                  className="p-2 rounded-lg border text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Berikutnya"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl flex flex-col h-[95vh] overflow-hidden">
                  <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                      <h3 className="font-bold text-gray-800">{editingLaporanId ? 'Edit' : 'Tambah'} Aktivitas Harian</h3>
                      <button onClick={closeModal} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
                  </div>
                  <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                          <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal</label>
                              <input type="date" name="tanggal" value={format(formData.tanggal, 'yyyy-MM-dd')} onChange={handleDateChange} className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#581c87] outline-none" required />
                          </div>
                          <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Cabang</label>
                              <select 
                                name="cabangId" 
                                value={formData.cabangId} 
                                onChange={handleInputChange} 
                                className={`w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#581c87] outline-none ${(currentUser?.role !== "Admin" && currentUser?.role !== "Direktur" && currentUser?.role !== "Yayasan") ? "bg-gray-100 cursor-not-allowed" : ""}`} 
                                required
                                disabled={(currentUser?.role !== "Admin" && currentUser?.role !== "Direktur" && currentUser?.role !== "Yayasan")}
                              >
                                  <option value="">Pilih Cabang</option>
                                  {cabangList.map(c => <option key={c.id} value={c.id}>{c.nama}</option>)}
                              </select>
                          </div>
                          <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Kelas</label>
                              <select 
                                name="kelasId" 
                                value={formData.kelasId} 
                                onChange={handleInputChange} 
                                className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#581c87] outline-none" 
                                disabled={!formData.cabangId} 
                                required
                              >
                                  <option value="">Pilih Kelas</option>
                                  {filteredKelasList.map(k => <option key={k.id} value={k.id}>{k.namaKelas}</option>)}
                              </select>
                          </div>
                          <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Nama Siswa</label>
                              <select name="siswaId" value={formData.siswaId} onChange={handleInputChange} className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#581c87] outline-none" disabled={!formData.kelasId} required>
                                  <option value="">Pilih Siswa</option>
                                  {filteredSiswaList.map(s => <option key={s.id} value={s.id}>{s.nama}</option>)}
                              </select>
                          </div>
                      </div>
                      <div className="space-y-6 pt-4 border-t">
                          {aktivitasChecklist.map(aktivitas => (
                              <div key={aktivitas.id} className="bg-gray-50 p-4 rounded-lg">
                                  <h4 className="font-bold text-lg text-gray-800 mb-3">{aktivitas.nama}</h4>
                                  <div className="space-y-4">
                                      {aktivitas.subAktivitas.map(sub => {
                                          const lainnyaChecked = formData.hasil[sub.id]?.includes('Lainnya');
                                          const lainnyaText = formData.hasil[sub.id]?.find((o:string) => o.startsWith('Lainnya:'))?.substring(8) || '';
                                          
                                          return (
                                              <div key={sub.id}>
                                                  <p className="font-semibold text-gray-700 mb-2">{sub.deskripsi}</p>
                                                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                                                      {sub.opsiJawaban.map(opsi => (
                                                          <div key={opsi} className="flex items-start">
                                                              <input type="checkbox" id={`${sub.id}-${opsi}`} checked={formData.hasil[sub.id]?.includes(opsi) || false} onChange={e => handleCheckboxChange(sub.id, opsi, e.target.checked)} className="mt-1 h-4 w-4 text-[#581c87] focus:ring-[#581c87] border-gray-300 rounded" />
                                                              <label htmlFor={`${sub.id}-${opsi}`} className="ml-2 text-sm text-gray-700">{opsi}</label>
                                                          </div>
                                                      ))}
                                                  </div>
                                                  {lainnyaChecked && (
                                                      <div className="mt-2">
                                                          <input type="text" value={lainnyaText} onChange={e => handleLainnyaTextChange(sub.id, e.target.value)} placeholder="Tuliskan keterangan lain..." className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-[#581c87] outline-none" />
                                                      </div>
                                                  )}
                                              </div>
                                          )
                                      })}
                                  </div>
                              </div>
                          ))}
                      </div>

                      <div className="p-4 bg-gray-50 -m-6 mt-6 border-t flex justify-end">
                           <button type="button" onClick={closeModal} className="px-4 py-2 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-200">Batal</button>
                           <button type="submit" disabled={isSubmitting} className="ml-3 bg-[#581c87] text-white px-4 py-2 rounded-lg text-sm hover:bg-[#45156b] transition disabled:opacity-50">
                               {isSubmitting ? 'Menyimpan...' : 'Simpan'}
                           </button>
                      </div>
                  </form>
              </div>
          </div>
      )}
      
      {/* Detail Modal */}
      {isDetailModalOpen && selectedLaporan && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl flex flex-col h-[90vh] overflow-hidden">
                  <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                      <div>
                        <h3 className="font-bold text-gray-800">Detail Aktivitas: {selectedLaporan.namaSiswa}</h3>
                        <p className="text-sm text-gray-500">{format(selectedLaporan.tanggal.toDate(), 'dd MMMM yyyy')}</p>
                      </div>
                      <button onClick={closeDetailModal} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-6 space-y-4">
                      {aktivitasChecklist.map(aktivitas => (
                          <div key={aktivitas.id}>
                              <h4 className="font-bold text-lg text-gray-800 mb-2 border-b pb-1">{aktivitas.nama}</h4>
                              {aktivitas.subAktivitas.map(sub => {
                                  const answers = selectedLaporan.hasil[sub.id];
                                  if (!answers || answers.length === 0) return null;

                                  const processedAnswers = answers
                                    .filter(a => a !== 'Lainnya')
                                    .map(a => a.startsWith('Lainnya: ') ? a.substring(8) : a)
                                    .filter(Boolean);

                                  if (processedAnswers.length === 0) {
                                    return null;
                                  }

                                  return (
                                      <div key={sub.id} className="py-2">
                                          <p className="font-semibold text-gray-700">{sub.deskripsi}</p>
                                          <p className="text-gray-600 pl-4">{processedAnswers.join(', ')}</p>
                                      </div>
                                  )
                              })}
                          </div>
                      ))}
                  </div>
              </div>
          </div>
      )}

    </div>
  );
}