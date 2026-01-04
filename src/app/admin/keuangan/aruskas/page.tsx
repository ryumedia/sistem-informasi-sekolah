// src/app/admin/keuangan/aruskas/page.tsx
"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, orderBy, addDoc, deleteDoc, doc } from "firebase/firestore";
import { Plus, ArrowUpCircle, ArrowDownCircle, Filter, X, Trash2, Wallet, Download } from "lucide-react";

interface ArusKas {
  id: string;
  tanggal: string;
  cabang: string;
  nomenklatur: string;
  keterangan: string; // Kegiatan
  jenis: "Masuk" | "Keluar";
  nominal: number;
}

export default function ArusKasPage() {
  const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => (currentYear - 1 + i).toString());

  const [filterTahun, setFilterTahun] = useState(currentYear.toString());
  const [filterBulan, setFilterBulan] = useState(monthNames[new Date().getMonth()]);
  const [filterCabang, setFilterCabang] = useState("");
  
  const [cabangList, setCabangList] = useState<any[]>([]);
  const [nomenklaturList, setNomenklaturList] = useState<any[]>([]);
  const [dataList, setDataList] = useState<ArusKas[]>([]);
  const [loading, setLoading] = useState(true);

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

  const fetchData = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, "arus_kas"), orderBy("tanggal", "asc"));
      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as ArusKas[];
      setDataList(data);
    } catch (error) {
      console.error("Error fetching arus kas:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredData = dataList.filter((item) => {
    const date = new Date(item.tanggal);
    const year = date.getFullYear().toString();
    const monthIndex = date.getMonth();
    const month = monthNames[monthIndex];

    const matchTahun = filterTahun ? filterTahun === year : true;
    const matchBulan = filterBulan ? filterBulan === month : true;
    const matchCabang = filterCabang ? item.cabang === filterCabang : true;

    return matchTahun && matchBulan && matchCabang;
  });

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
        ...formData,
        jenis: modalType,
        createdAt: new Date(),
      });
      alert("Data berhasil disimpan!");
      setIsModalOpen(false);
      fetchData();
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
        fetchData();
      } catch (error) {
        console.error("Error deleting:", error);
      }
    }
  }

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
      doc.text(`Periode: ${filterBulan || "Semua Bulan"} ${filterTahun || "Semua Tahun"}`, 14, 30);
      doc.text(`Cabang: ${filterCabang || "Semua Cabang"}`, 14, 36);

      // Table
      const tableColumn = ["Tanggal", "Cabang", "Keterangan", "Nomenklatur", "Jenis", "Nominal"];
      const tableRows = filteredData.map(item => [
        item.tanggal,
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
          <select className="border rounded-lg p-2 text-sm bg-white outline-none focus:ring-2 focus:ring-[#581c87] text-gray-900" value={filterTahun} onChange={(e) => setFilterTahun(e.target.value)}>
            <option value="">Semua Tahun</option>
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <select className="border rounded-lg p-2 text-sm bg-white outline-none focus:ring-2 focus:ring-[#581c87] text-gray-900" value={filterBulan} onChange={(e) => setFilterBulan(e.target.value)}>
            <option value="">Semua Bulan</option>
            {monthNames.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          <select className="border rounded-lg p-2 text-sm bg-white outline-none focus:ring-2 focus:ring-[#581c87] text-gray-900" value={filterCabang} onChange={(e) => setFilterCabang(e.target.value)}>
            <option value="">Semua Cabang</option>
            {cabangList.map((c) => <option key={c.id} value={c.nama}>{c.nama}</option>)}
          </select>

          <button onClick={() => openModal("Masuk")} className="bg-green-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-green-700 transition text-sm">
            <Plus className="w-4 h-4" /> Pemasukan
          </button>
          <button onClick={() => openModal("Keluar")} className="bg-red-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-red-700 transition text-sm">
            <Plus className="w-4 h-4" /> Pengeluaran
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
              filteredData.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="p-4">{item.tanggal}</td>
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
