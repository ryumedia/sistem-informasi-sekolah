// src/app/admin/keuangan/realisasi/page.tsx
"use client";

import { useState, useEffect } from "react";
import { db, auth } from "@/lib/firebase";
import { collection, getDocs, query, orderBy, where, doc, updateDoc, addDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { FileText, Filter, X, Save, Eye, Wallet, TrendingUp, TrendingDown, ChevronLeft, ChevronRight } from "lucide-react";

interface Pengajuan {
  id: string;
  tanggal: string;
  pengaju: string;
  cabang: string;
  barang: string;
  total: number;
  status: string;
  realisasi?: number;
  selisih?: number;
  buktiRealisasi?: string;
  arusKasId?: string;
  nomenklatur?: string;
  tanggalRealisasi?: string;
}

export default function RealisasiPage() {
  const now = new Date();
  const formatDate = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [startDate, setStartDate] = useState(formatDate(new Date(now.getFullYear(), now.getMonth(), 1)));
  const [endDate, setEndDate] = useState(formatDate(new Date(now.getFullYear(), now.getMonth() + 1, 0)));
  const [filterCabang, setFilterCabang] = useState("");
  const [filterNama, setFilterNama] = useState("");
  const [filterNomenklatur, setFilterNomenklatur] = useState("");
  const [cabangList, setCabangList] = useState<any[]>([]);
  const [nomenklaturList, setNomenklaturList] = useState<any[]>([]);
  const [dataList, setDataList] = useState<Pengajuan[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);

  // State untuk Modal Laporan
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Pengajuan | null>(null);
  const [realisasiInput, setRealisasiInput] = useState<number>(0);
  const [realisasiDate, setRealisasiDate] = useState<string>("");
  const [buktiInput, setBuktiInput] = useState<string>("");
  const [viewBukti, setViewBukti] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
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

  useEffect(() => {
    const fetchNomenklatur = async () => {
      try {
        const q = query(collection(db, "nomenklatur_keuangan"), orderBy("nama", "asc"));
        const querySnapshot = await getDocs(q);
        const data = querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setNomenklaturList(data);
      } catch (error) {
        console.error("Error fetching nomenklatur:", error);
      }
    };
    fetchNomenklatur();
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          let userDoc: any = null;
          let defaultRole = "User";

          const guruQuery = query(collection(db, "guru"), where("email", "==", user.email));
          const guruSnap = await getDocs(guruQuery);
          
          if (!guruSnap.empty) {
            userDoc = guruSnap.docs[0];
            defaultRole = 'Guru';
          } else {
            const caregiverQuery = query(collection(db, "caregivers"), where("email", "==", user.email));
            const caregiverSnap = await getDocs(caregiverQuery);
            if (!caregiverSnap.empty) {
              userDoc = caregiverSnap.docs[0];
              defaultRole = 'Caregiver';
            }
          }

          if (userDoc) {
            const docData = userDoc.data();
            const role = docData.role || defaultRole;
            setCurrentUser({
              id: userDoc.id,
              uid: user.uid,
              ...docData,
              role: role,
            });
            if (["Kepala Sekolah", "Guru", "Caregiver"].includes(role) && docData.cabang) {
              setFilterCabang(docData.cabang);
            }
          } else {
             setCurrentUser({ id: user.uid, uid: user.uid, email: user.email, role: "Admin" }); 
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
          setCurrentUser({ id: user.uid, email: user.email, role: "Admin" });
        }
      } else {
        setCurrentUser(null);
      }
    });
    return () => unsubscribe();
  }, []);

  const fetchData = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      // Ambil data pengajuan yang sudah disetujui
      const pengajuanCollection = collection(db, "pengajuan");
      const constraints: any[] = [where("status", "==", "Disetujui")];

      if (["Guru", "Caregiver"].includes(currentUser.role)) {
         constraints.push(where("userId", "==", currentUser.uid || currentUser.id));
      } else if (currentUser.role === "Kepala Sekolah" && currentUser.cabang) {
         constraints.push(where("cabang", "==", currentUser.cabang));
      }

      const q = query(pengajuanCollection, ...constraints);
      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Pengajuan[];
      
      // Urutkan berdasarkan tanggal terbaru
      data.sort((a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime());
      
      setDataList(data);
    } catch (error) {
      console.error("Error fetching realisasi:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser) {
      fetchData();
    }
  }, [currentUser]);

  const filteredData = dataList.filter((item) => {
    const matchDate = (!startDate || item.tanggal >= startDate) && (!endDate || item.tanggal <= endDate);
    const matchNama = filterNama ? (item.pengaju || "").toLowerCase().includes(filterNama.toLowerCase()) : true;
    const matchNomenklatur = filterNomenklatur ? item.nomenklatur === filterNomenklatur : true;
    const matchCabang = filterCabang ? item.cabang === filterCabang : true;

    return matchDate && matchCabang && matchNama && matchNomenklatur;
  });

  // Pagination Logic
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredData.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);

  useEffect(() => {
    setCurrentPage(1);
  }, [startDate, endDate, filterCabang, filterNomenklatur, filterNama]);

  const totalAnggaran = filteredData.reduce((acc, curr) => acc + (curr.total || 0), 0);
  const totalRealisasi = filteredData.reduce((acc, curr) => acc + (curr.realisasi || 0), 0);
  const totalSelisih = totalAnggaran - totalRealisasi;

  const handleOpenModal = (item: Pengajuan) => {
    setSelectedItem(item);
    setRealisasiInput(item.realisasi || 0);
    setRealisasiDate(item.tanggalRealisasi || new Date().toISOString().split("T")[0]);
    setBuktiInput(item.buktiRealisasi || "");
    setIsModalOpen(true);
  };

  const handleSubmitLaporan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;
    setSubmitting(true);
    try {
      const selisih = selectedItem.total - realisasiInput;
      
      // Logic: Catat ke Arus Kas sebagai Pengeluaran
      const baseArusKasData = {
        tanggal: realisasiDate,
        cabang: selectedItem.cabang,
        nomenklatur: selectedItem.nomenklatur || "Realisasi Pengajuan", // Ambil dari pengajuan
        keterangan: selectedItem.barang, // Nama kegiatan/barang
        jenis: "Keluar",
        nominal: realisasiInput,
      };

      let arusKasId = selectedItem.arusKasId;

      if (arusKasId) {
        // Jika sudah ada ID arus kas (edit realisasi), update datanya
        await updateDoc(doc(db, "arus_kas", arusKasId), baseArusKasData).catch(async () => {
           // Jika dokumen arus kas tidak ditemukan (misal terhapus manual), buat baru
           const newDoc = await addDoc(collection(db, "arus_kas"), { ...baseArusKasData, createdAt: new Date() });
           arusKasId = newDoc.id;
        });
      } else {
        // Buat data arus kas baru
        const newDoc = await addDoc(collection(db, "arus_kas"), { ...baseArusKasData, createdAt: new Date() });
        arusKasId = newDoc.id;
      }

      await updateDoc(doc(db, "pengajuan", selectedItem.id), {
        realisasi: realisasiInput,
        selisih: selisih,
        buktiRealisasi: buktiInput,
        arusKasId: arusKasId, // Simpan referensi ID Arus Kas
        tanggalRealisasi: realisasiDate
      });
      alert("Laporan realisasi berhasil disimpan dan tercatat di Arus Kas!");
      setIsModalOpen(false);
      fetchData();
    } catch (error) {
      console.error("Error saving realisasi:", error);
      alert("Gagal menyimpan laporan.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setBuktiInput(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">Realisasi Anggaran</h1>
        
        {/* Filter Area */}
        <div className="flex flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Dari:</span>
            <input 
              type="date" 
              className="border rounded-lg p-2 text-sm bg-white outline-none focus:ring-2 focus:ring-[#581c87] text-gray-900"
              value={startDate} 
              onChange={(e) => setStartDate(e.target.value)}
            />
            <span className="text-sm text-gray-600">Sampai:</span>
            <input 
              type="date" 
              className="border rounded-lg p-2 text-sm bg-white outline-none focus:ring-2 focus:ring-[#581c87] text-gray-900"
              value={endDate} 
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          <select 
            className={`border rounded-lg p-2 text-sm bg-white outline-none focus:ring-2 focus:ring-[#581c87] text-gray-900 ${["Kepala Sekolah", "Guru", "Caregiver"].includes(currentUser?.role) ? "bg-gray-100 cursor-not-allowed" : ""}`} 
            value={filterCabang} 
            onChange={(e) => setFilterCabang(e.target.value)}
            disabled={["Kepala Sekolah", "Guru", "Caregiver"].includes(currentUser?.role)}
          >
            {!["Kepala Sekolah", "Guru", "Caregiver"].includes(currentUser?.role) && <option value="">Semua Cabang</option>}
            {cabangList.map((c) => <option key={c.id} value={c.nama}>{c.nama}</option>)}
          </select>
          <select className="border rounded-lg p-2 text-sm bg-white outline-none focus:ring-2 focus:ring-[#581c87] text-gray-900" value={filterNomenklatur} onChange={(e) => setFilterNomenklatur(e.target.value)}>
            <option value="">Semua Nomenklatur</option>
            {nomenklaturList.map((n) => (
              <option key={n.id} value={n.nama}>{n.nama}</option>
            ))}
          </select>
          <input 
            type="text" 
            placeholder="Cari Nama Pengaju" 
            className="border rounded-lg p-2 text-sm bg-white outline-none focus:ring-2 focus:ring-[#581c87] text-gray-900"
            value={filterNama}
            onChange={(e) => setFilterNama(e.target.value)}
          />
          <button className="bg-gray-100 p-2 rounded-lg text-gray-600 hover:bg-gray-200">
            <Filter className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Cards Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card Total Anggaran */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="p-3 rounded-full bg-blue-50 text-blue-600">
            <Wallet className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-gray-500">Total Anggaran</p>
            <h3 className="text-xl font-bold text-gray-800">Rp {totalAnggaran.toLocaleString("id-ID")}</h3>
          </div>
        </div>

        {/* Card Total Realisasi */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="p-3 rounded-full bg-green-50 text-green-600">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-gray-500">Total Realisasi</p>
            <h3 className="text-xl font-bold text-green-600">Rp {totalRealisasi.toLocaleString("id-ID")}</h3>
          </div>
        </div>

        {/* Card Total Selisih */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="p-3 rounded-full bg-orange-50 text-orange-600">
            <TrendingDown className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-gray-500">Total Selisih (Sisa)</p>
            <h3 className={`text-xl font-bold ${totalSelisih < 0 ? "text-red-600" : "text-orange-600"}`}>Rp {totalSelisih.toLocaleString("id-ID")}</h3>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600 min-w-[900px]">
          <thead className="bg-gray-50 text-gray-900 font-semibold border-b">
            <tr>
              <th className="p-4">No</th>
              <th className="p-4">Nama Pengaju</th>
              <th className="p-4">Kegiatan / Nomenklatur</th>
              <th className="p-4">Cabang</th>
              <th className="p-4">Anggaran</th>
              <th className="p-4">Realisasi</th>
              <th className="p-4">Selisih</th>
              <th className="p-4">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={7} className="p-8 text-center">Memuat data...</td></tr>
            ) : filteredData.length === 0 ? (
              <tr><td colSpan={7} className="p-8 text-center">Tidak ada data anggaran disetujui pada periode ini.</td></tr>
            ) : (
              currentItems.map((item, index) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="p-4">{indexOfFirstItem + index + 1}</td>
                  <td className="p-4 font-medium text-gray-900">{item.pengaju}</td>
                  <td className="p-4">
                    <div className="font-medium text-gray-900">{item.barang}</div>
                    <div className="text-xs text-gray-500">{item.nomenklatur}</div>
                  </td>
                  <td className="p-4">{item.cabang}</td>
                  <td className="p-4">Rp {item.total.toLocaleString("id-ID")}</td>
                  <td className={`p-4 font-medium ${item.realisasi ? "text-green-600" : "text-gray-400"}`}>
                    {item.realisasi ? `Rp ${item.realisasi.toLocaleString("id-ID")}` : "-"}
                  </td>
                  <td className={`p-4 ${item.selisih && item.selisih < 0 ? "text-red-500" : "text-gray-500"}`}>
                    {item.selisih !== undefined ? `Rp ${item.selisih.toLocaleString("id-ID")}` : "-"}
                  </td>
                  <td className="p-4 flex items-center gap-2">
                    <button 
                      onClick={() => handleOpenModal(item)}
                      className="p-2 text-[#581c87] hover:bg-[#581c87]/10 rounded-lg flex items-center gap-1" 
                      title="Lapor Realisasi"
                    >
                      <FileText className="w-4 h-4" />
                    </button>
                    {item.buktiRealisasi && (
                      <button 
                        onClick={() => setViewBukti(item.buktiRealisasi || null)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg flex items-center gap-1" 
                        title="Lihat Bukti"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>
      </div>

      {/* Pagination */}
      {!loading && filteredData.length > 0 && (
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-gray-600">
            Menampilkan {indexOfFirstItem + 1} hingga {Math.min(indexOfLastItem, filteredData.length)} dari {filteredData.length} data
          </p>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="p-2 border rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }

                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm font-medium transition ${
                      currentPage === pageNum
                        ? "bg-[#581c87] text-white"
                        : "text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="p-2 border rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Modal Laporan Realisasi */}
      {isModalOpen && selectedItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden">
            <div className="p-4 border-b flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-gray-800">Laporan Realisasi</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmitLaporan} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal Realisasi</label>
                  <input required type="date" className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#581c87] outline-none text-gray-900"
                    value={realisasiDate} onChange={(e) => setRealisasiDate(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Kegiatan / Barang</label>
                  <input disabled type="text" className="w-full border rounded-lg p-2 bg-gray-100 text-gray-600" value={selectedItem.barang} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nomenklatur</label>
                  <input disabled type="text" className="w-full border rounded-lg p-2 bg-gray-100 text-gray-600" value={selectedItem.nomenklatur || "-"} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Anggaran Disetujui</label>
                  <input disabled type="text" className="w-full border rounded-lg p-2 bg-gray-100 text-gray-800 font-bold" value={`Rp ${selectedItem.total.toLocaleString("id-ID")}`} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Jumlah Realisasi (Rp)</label>
                  <input required type="number" min="0" className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#581c87] outline-none text-gray-900"
                    value={realisasiInput} onChange={(e) => setRealisasiInput(Number(e.target.value))} />
                </div>
                <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                  <label className="block text-xs font-medium text-blue-600 mb-1">Selisih (Sisa Anggaran)</label>
                  <div className={`text-lg font-bold ${(selectedItem.total - realisasiInput) < 0 ? "text-red-600" : "text-blue-700"}`}>
                    Rp {(selectedItem.total - realisasiInput).toLocaleString("id-ID")}
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bukti Realisasi (Gambar)</label>
                <input 
                  type="file" 
                  accept="image/*"
                  onChange={handleFileChange}
                  className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-[#581c87] hover:file:bg-purple-100"
                />
                {buktiInput && (
                  <div className="mt-2">
                    <img src={buktiInput} alt="Preview" className="h-20 object-contain border rounded" />
                  </div>
                )}
              </div>
              <button disabled={submitting} type="submit" className="w-full bg-[#581c87] text-white py-2 rounded-lg hover:bg-[#45156b] transition font-medium mt-2 flex justify-center items-center gap-2">
                <Save className="w-4 h-4" /> {submitting ? "Menyimpan..." : (selectedItem.arusKasId ? "Perbarui Realisasi" : "Kirim Realisasi")}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal Lihat Bukti */}
      {viewBukti && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setViewBukti(null)}>
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-gray-800">Bukti Realisasi</h3>
              <button onClick={() => setViewBukti(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 flex justify-center bg-gray-100">
              <img src={viewBukti} alt="Bukti" className="max-h-[70vh] object-contain rounded-lg shadow-sm" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
