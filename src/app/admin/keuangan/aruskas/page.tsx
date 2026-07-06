// src/app/admin/keuangan/aruskas/page.tsx
"use client";

import { useState, useEffect } from "react";
import { db, auth } from "@/lib/firebase";
import { collection, getDocs, query, orderBy, addDoc, deleteDoc, doc, where, onSnapshot, Timestamp } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { Plus, ArrowUpCircle, ArrowDownCircle, Filter, X, Trash2, Wallet, Download, FileSpreadsheet, ChevronLeft, ChevronRight } from "lucide-react";

interface ArusKas {
  id: string;
  tanggal: Date; // Mengubah tipe dari string ke Date
  cabang: string;
  nomenklatur: string;
  keterangan: string; // Kegiatan
  jenis: "Masuk" | "Keluar";
  nominal: number;
}

export default function ArusKasPage() {
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
  const [filterNomenklatur, setFilterNomenklatur] = useState("");
  
  const [cabangList, setCabangList] = useState<any[]>([]);
  const [nomenklaturList, setNomenklaturList] = useState<any[]>([]);
  const [dataList, setDataList] = useState<ArusKas[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState("");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<"Masuk" | "Keluar">("Masuk");
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    tanggal: new Date().toISOString().split('T')[0],
    cabang: "",
    nomenklatur: "",
    keterangan: "",
    nominal: 0,
  });

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

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
          } else {
             setUserRole("Admin"); 
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const fetchMasterData = async () => {
      try {
        // Cabang
        const qCabang = query(collection(db, "cabang"), orderBy("nama", "asc"));
        const snapCabang = await getDocs(qCabang);
        setCabangList(snapCabang.docs.map((doc) => ({ id: doc.id, ...doc.data() })));

        // Nomenklatur
        const qNomen = query(collection(db, "nomenklatur_keuangan"), orderBy("nama", "asc"));
        const snapNomen = await getDocs(qNomen);
        setNomenklaturList(snapNomen.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      } catch (error) {
        console.error("Error fetching master data:", error);
      }
    };
    fetchMasterData();
  }, []);

  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, "arus_kas"), orderBy("tanggal", "desc"));

    // Menggunakan onSnapshot untuk pembaruan real-time
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const data: ArusKas[] = [];
      querySnapshot.forEach((doc) => {
        const docData = doc.data();
        // Konversi Timestamp atau string ke objek Date
        const tanggal = docData.tanggal instanceof Timestamp 
          ? docData.tanggal.toDate() 
          : new Date(docData.tanggal);

        data.push({
          id: doc.id,
          ...docData,
          tanggal: tanggal,
        } as ArusKas);
      });
      setDataList(data);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching real-time data:", error);
      setLoading(false);
    });

    return () => unsubscribe(); // Berhenti mendengarkan saat komponen unmount
  }, []);

  const filteredData = dataList.filter((item) => {
    // Konversi string tanggal dari filter menjadi objek Date untuk perbandingan yang akurat
    const sDate = startDate ? new Date(startDate) : null;
    const eDate = endDate ? new Date(endDate) : null;

    // Set jam untuk memastikan perbandingan inklusif
    if (sDate) sDate.setHours(0, 0, 0, 0);
    if (eDate) eDate.setHours(23, 59, 59, 999);

    const matchDate = (!sDate || item.tanggal >= sDate) && (!eDate || item.tanggal <= eDate);
    const matchCabang = filterCabang ? item.cabang === filterCabang : true;
    const matchNomenklatur = filterNomenklatur ? item.nomenklatur === filterNomenklatur : true;

    return matchDate && matchCabang && matchNomenklatur;
  });

  // Pagination Logic
  const indexOfLastItem = currentPage * itemsPerPage; 
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredData.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);

  useEffect(() => {
    setCurrentPage(1);
  }, [startDate, endDate, filterCabang, filterNomenklatur]);

  const totalPemasukan = filteredData
    .filter(item => item.jenis === "Masuk")
    .reduce((acc, curr) => acc + curr.nominal, 0);

  const totalPengeluaran = filteredData
    .filter(item => item.jenis === "Keluar")
    .reduce((acc, curr) => acc + curr.nominal, 0);

  const totalSaldo = totalPemasukan - totalPengeluaran;

  const openModal = (type: "Masuk" | "Keluar") => {
    setModalType(type);
    setFormData({
      tanggal: new Date().toISOString().split('T')[0],
      cabang: "",
      nomenklatur: "",
      keterangan: "",
      nominal: 0,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await addDoc(collection(db, "arus_kas"), {
        cabang: formData.cabang,
        nomenklatur: formData.nomenklatur,
        keterangan: formData.keterangan,
        nominal: formData.nominal,
        jenis: modalType,
        tanggal: Timestamp.fromDate(new Date(formData.tanggal)), // Konversi string ke Timestamp
        createdAt: new Date(),
      });
      alert("Data berhasil disimpan!");
      setIsModalOpen(false);
      // Tidak perlu fetchData() lagi karena onSnapshot sudah menangani pembaruan
    } catch (error) {
      console.error("Error saving arus kas:", error);
      alert("Gagal menyimpan data.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if(confirm("Yakin ingin menghapus data ini?")) {
      try {
        await deleteDoc(doc(db, "arus_kas", id));
        // Tidak perlu fetchData() lagi
      } catch (error) {
        console.error("Error deleting:", error);
      }
    }
  }

  const handleDownloadExcel = async () => {
    try {
      // @ts-ignore
      const XLSX = await import("xlsx");

      const dataToExport = filteredData.map(item => ({
        Tanggal: formatDate(item.tanggal),
        Cabang: item.cabang,
        Keterangan: item.keterangan,
        Nomenklatur: item.nomenklatur,
        Jenis: item.jenis,
        Nominal: item.nominal
      }));

      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Arus Kas");

      XLSX.writeFile(workbook, `Laporan_Arus_Kas_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (error) {
      console.error("Gagal membuat Excel:", error);
      alert("Gagal mendownload Excel. Pastikan library xlsx terinstall (npm install xlsx).");
    }
  };

  const handleDownloadPDF = async () => {
    try {
      // @ts-ignore
      const { default: jsPDF } = await import("jspdf");
      // @ts-ignore
      const { default: autoTable } = await import("jspdf-autotable");

      const doc = new jsPDF();

      // Title
      doc.setFontSize(18);
      doc.text("Laporan Arus Kas Sekolah", 14, 22);

      // Filter Info
      doc.setFontSize(11);
      doc.text(`Periode: ${startDate} s/d ${endDate}`, 14, 30);
      doc.text(`Cabang: ${filterCabang || "Semua Cabang"}`, 14, 36);

      // Table
      const tableColumn = ["Tanggal", "Cabang", "Keterangan", "Nomenklatur", "Jenis", "Nominal"];
      const tableRows = filteredData.map(item => [
        formatDate(item.tanggal),
        item.cabang,
        item.keterangan,
        item.nomenklatur,
        item.jenis,
        `Rp ${item.nominal.toLocaleString("id-ID")}`
      ]);

      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: 45,
        theme: 'grid',
        styles: { fontSize: 8 },
        headStyles: { fillColor: [88, 28, 135] }
      });

      // Summary
      const finalY = (doc as any).lastAutoTable.finalY + 10;
      
      doc.setFontSize(10);
      doc.text(`Total Pemasukan: Rp ${totalPemasukan.toLocaleString("id-ID")}`, 14, finalY);
      doc.text(`Total Pengeluaran: Rp ${totalPengeluaran.toLocaleString("id-ID")}`, 14, finalY + 6);
      doc.text(`Total Saldo: Rp ${totalSaldo.toLocaleString("id-ID")}`, 14, finalY + 12);

      doc.save(`Laporan_Arus_Kas_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (error) {
      console.error("Gagal membuat PDF:", error);
      alert("Gagal mendownload PDF. Pastikan library jspdf terinstall dengan benar.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row justify-between items-center gap-4">
        <h1 className="text-2xl font-bold text-gray-800">Arus Kas Sekolah</h1>
        
        <div className="flex flex-wrap gap-2 items-center justify-end">
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
            className={`border rounded-lg p-2 text-sm bg-white outline-none focus:ring-2 focus:ring-[#581c87] text-gray-900 ${userRole === "Kepala Sekolah" ? "bg-gray-100 cursor-not-allowed" : ""}`} 
            value={filterCabang} 
            onChange={(e) => setFilterCabang(e.target.value)}
            disabled={userRole === "Kepala Sekolah"}
          >
            {userRole !== "Kepala Sekolah" && <option value="">Semua Cabang</option>}
            {cabangList.map((c) => <option key={c.id} value={c.nama}>{c.nama}</option>)}
          </select>
          <select className="border rounded-lg p-2 text-sm bg-white outline-none focus:ring-2 focus:ring-[#581c87] text-gray-900" value={filterNomenklatur} onChange={(e) => setFilterNomenklatur(e.target.value)}>
            <option value="">Semua Nomenklatur</option>
            {nomenklaturList.map((n) => (
              <option key={n.id} value={n.nama}>{n.nama}</option>
            ))}
          </select>

          {["Admin", "Direktur", "Yayasan"].includes(userRole) && (
            <>
              <button onClick={() => openModal("Masuk")} className="bg-green-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-green-700 transition text-sm">
                <Plus className="w-4 h-4" /> Pemasukan
              </button>
              <button onClick={() => openModal("Keluar")} className="bg-red-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-red-700 transition text-sm">
                <Plus className="w-4 h-4" /> Pengeluaran
              </button>
            </>
          )}
          <button onClick={handleDownloadExcel} className="bg-emerald-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-emerald-700 transition text-sm">
            <FileSpreadsheet className="w-4 h-4" /> Download Excel
          </button>
          <button onClick={handleDownloadPDF} className="bg-[#581c87] text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-[#45156b] transition text-sm">
            <Download className="w-4 h-4" /> Download PDF
          </button>
        </div>
      </div>

      {/* Filter & Resume */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-green-50 p-6 rounded-xl border border-green-100">
          <div className="flex items-center gap-3 mb-2">
            <ArrowUpCircle className="w-8 h-8 text-green-600" />
            <span className="text-sm text-green-800 font-medium">Total Pemasukan</span>
          </div>
          <h3 className="text-2xl font-bold text-green-700">Rp {totalPemasukan.toLocaleString("id-ID")}</h3>
        </div>

        <div className="bg-red-50 p-6 rounded-xl border border-red-100">
          <div className="flex items-center gap-3 mb-2">
            <ArrowDownCircle className="w-8 h-8 text-red-600" />
            <span className="text-sm text-red-800 font-medium">Total Pengeluaran</span>
          </div>
          <h3 className="text-2xl font-bold text-red-700">Rp {totalPengeluaran.toLocaleString("id-ID")}</h3>
        </div>

        <div className="bg-blue-50 p-6 rounded-xl border border-blue-100">
          <div className="flex items-center gap-3 mb-2">
            <Wallet className="w-8 h-8 text-blue-600" />
            <span className="text-sm text-blue-800 font-medium">Total Saldo</span>
          </div>
          <h3 className={`text-2xl font-bold ${totalSaldo < 0 ? "text-red-600" : "text-blue-700"}`}>
            Rp {totalSaldo.toLocaleString("id-ID")}
          </h3>
        </div>
      </div>

      {/* Tabel Arus Kas */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600 min-w-[800px]">
          <thead className="bg-gray-50 text-gray-900 font-semibold border-b">
            <tr>
              <th className="p-4">Tanggal</th>
              <th className="p-4">Cabang</th>
              <th className="p-4">Keterangan / Nomenklatur</th>
              <th className="p-4">Jenis</th>
              <th className="p-4">Nominal</th>
              <th className="p-4">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={6} className="p-8 text-center">Memuat data...</td></tr>
            ) : filteredData.length === 0 ? (
              <tr><td colSpan={6} className="p-8 text-center">Belum ada data arus kas pada periode ini.</td></tr>
            ) : (
              currentItems.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="p-4">{formatDate(item.tanggal)}</td>
                  <td className="p-4">{item.cabang}</td>
                  <td className="p-4">
                    <div className="font-medium text-gray-900">{item.keterangan}</div>
                    <div className="text-xs text-gray-500">{item.nomenklatur}</div>
                  </td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      item.jenis === 'Masuk' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {item.jenis}
                    </span>
                  </td>
                  <td className={`p-4 font-bold ${item.jenis === 'Masuk' ? 'text-green-600' : 'text-red-600'}`}>
                    {item.jenis === 'Masuk' ? '+' : '-'} Rp {item.nominal.toLocaleString("id-ID")}
                  </td>
                  <td className="p-4">
                    <button onClick={() => handleDelete(item.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition">
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

      {/* Modal Input Arus Kas */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className={`p-4 border-b flex justify-between items-center ${modalType === 'Masuk' ? 'bg-green-50' : 'bg-red-50'}`}>
              <h3 className={`font-bold ${modalType === 'Masuk' ? 'text-green-800' : 'text-red-800'}`}>
                Tambah {modalType === 'Masuk' ? 'Pemasukan' : 'Pengeluaran'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal</label>
                <input required type="date" className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#581c87] outline-none text-gray-900"
                  value={formData.tanggal} onChange={(e) => setFormData({...formData, tanggal: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cabang</label>
                <select required className="w-full border rounded-lg p-2 bg-white focus:ring-2 focus:ring-[#581c87] outline-none text-gray-900"
                  value={formData.cabang} onChange={(e) => setFormData({...formData, cabang: e.target.value})}>
                  <option value="">Pilih Cabang</option>
                  {cabangList.map((c) => (
                    <option key={c.id} value={c.nama}>{c.nama}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nomenklatur</label>
                <select required className="w-full border rounded-lg p-2 bg-white focus:ring-2 focus:ring-[#581c87] outline-none text-gray-900"
                  value={formData.nomenklatur} onChange={(e) => setFormData({...formData, nomenklatur: e.target.value})}>
                  <option value="">Pilih Nomenklatur</option>
                  {nomenklaturList
                    .filter((n) => n.kategori === (modalType === "Masuk" ? "Pemasukan" : "Pengeluaran"))
                    .map((n) => (
                    <option key={n.id} value={n.nama}>{n.nama}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Kegiatan / Keterangan</label>
                <input required type="text" className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#581c87] outline-none text-gray-900"
                  placeholder="Contoh: Pembayaran SPP, Beli ATK"
                  value={formData.keterangan} onChange={(e) => setFormData({...formData, keterangan: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nominal (Rp)</label>
                <input required type="text" className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#581c87] outline-none text-gray-900"
                  value={formData.nominal === 0 ? "" : formData.nominal.toLocaleString("id-ID")} 
                  onChange={(e) => {
                    // Hapus titik untuk mendapatkan nilai angka murni
                    const rawValue = e.target.value.replace(/\./g, "");
                    if (!isNaN(Number(rawValue))) {
                      setFormData({...formData, nominal: Number(rawValue)});
                    }
                  }}
                  placeholder="0" />
              </div>
              <button disabled={submitting} type="submit" className={`w-full text-white py-2 rounded-lg transition font-medium mt-2 ${
                modalType === 'Masuk' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
              }`}>
                {submitting ? "Menyimpan..." : "Simpan Data"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
