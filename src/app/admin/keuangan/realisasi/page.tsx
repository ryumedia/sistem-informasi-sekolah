// src/app/admin/keuangan/realisasi/page.tsx
"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, orderBy, where, doc, updateDoc, addDoc } from "firebase/firestore";
import { FileText, Filter, X, Save, Eye } from "lucide-react";

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
}

export default function RealisasiPage() {
  const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => (currentYear - 1 + i).toString());

  const [filterTahun, setFilterTahun] = useState(currentYear.toString());
  const [filterBulan, setFilterBulan] = useState(monthNames[new Date().getMonth()]);
  const [filterCabang, setFilterCabang] = useState("");
  const [cabangList, setCabangList] = useState<any[]>([]);
  const [dataList, setDataList] = useState<Pengajuan[]>([]);
  const [loading, setLoading] = useState(true);

  // State untuk Modal Laporan
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Pengajuan | null>(null);
  const [realisasiInput, setRealisasiInput] = useState<number>(0);
  const [buktiInput, setBuktiInput] = useState<string>("");
  const [viewBukti, setViewBukti] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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

  const fetchData = async () => {
    setLoading(true);
    try {
      // Ambil data pengajuan yang sudah disetujui
      const q = query(collection(db, "pengajuan"), where("status", "==", "Disetujui"));
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
    fetchData();
  }, []);

  const filteredData = dataList.filter((item) => {
    const date = new Date(item.tanggal);
    const year = date.getFullYear().toString();
    const monthIndex = date.getMonth();
    const month = monthNames[monthIndex];

    return filterTahun === year && filterBulan === month && (filterCabang ? item.cabang === filterCabang : true);
  });

  const handleOpenModal = (item: Pengajuan) => {
    setSelectedItem(item);
    setRealisasiInput(item.realisasi || 0);
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
      const arusKasData = {
        tanggal: new Date().toISOString().split("T")[0], // Tanggal hari ini
        cabang: selectedItem.cabang,
        nomenklatur: selectedItem.nomenklatur || "Realisasi Pengajuan", // Ambil dari pengajuan
        keterangan: selectedItem.barang, // Nama kegiatan/barang
        jenis: "Keluar",
        nominal: realisasiInput,
        createdAt: new Date(),
      };

      let arusKasId = selectedItem.arusKasId;

      if (arusKasId) {
        // Jika sudah ada ID arus kas (edit realisasi), update datanya
        await updateDoc(doc(db, "arus_kas", arusKasId), arusKasData).catch(async () => {
           // Jika dokumen arus kas tidak ditemukan (misal terhapus manual), buat baru
           const newDoc = await addDoc(collection(db, "arus_kas"), arusKasData);
           arusKasId = newDoc.id;
        });
      } else {
        // Buat data arus kas baru
        const newDoc = await addDoc(collection(db, "arus_kas"), arusKasData);
        arusKasId = newDoc.id;
      }

      await updateDoc(doc(db, "pengajuan", selectedItem.id), {
        realisasi: realisasiInput,
        selisih: selisih,
        buktiRealisasi: buktiInput,
        arusKasId: arusKasId // Simpan referensi ID Arus Kas
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
        <div className="flex gap-2">
          <select className="border rounded-lg p-2 text-sm bg-white outline-none focus:ring-2 focus:ring-[#581c87] text-gray-900" value={filterTahun} onChange={(e) => setFilterTahun(e.target.value)}>
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <select className="border rounded-lg p-2 text-sm bg-white outline-none focus:ring-2 focus:ring-[#581c87] text-gray-900" value={filterBulan} onChange={(e) => setFilterBulan(e.target.value)}>
            {monthNames.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          <select className="border rounded-lg p-2 text-sm bg-white outline-none focus:ring-2 focus:ring-[#581c87] text-gray-900" value={filterCabang} onChange={(e) => setFilterCabang(e.target.value)}>
            <option value="">Semua Cabang</option>
            {cabangList.map((c) => <option key={c.id} value={c.nama}>{c.nama}</option>)}
          </select>
          <button className="bg-gray-100 p-2 rounded-lg text-gray-600 hover:bg-gray-200">
            <Filter className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600 min-w-[900px]">
          <thead className="bg-gray-50 text-gray-900 font-semibold border-b">
            <tr>
              <th className="p-4">No</th>
              <th className="p-4">Kegiatan</th>
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
              filteredData.map((item, index) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="p-4">{index + 1}</td>
                  <td className="p-4 font-medium text-gray-900">{item.barang}</td>
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

      {/* Modal Laporan Realisasi */}
      {isModalOpen && selectedItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-4 border-b flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-gray-800">Laporan Realisasi</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmitLaporan} className="p-6 space-y-4">
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
              <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                <label className="block text-xs font-medium text-blue-600 mb-1">Selisih (Sisa Anggaran)</label>
                <div className={`text-lg font-bold ${(selectedItem.total - realisasiInput) < 0 ? "text-red-600" : "text-blue-700"}`}>
                  Rp {(selectedItem.total - realisasiInput).toLocaleString("id-ID")}
                </div>
              </div>
              <button disabled={submitting} type="submit" className="w-full bg-[#581c87] text-white py-2 rounded-lg hover:bg-[#45156b] transition font-medium mt-2 flex justify-center items-center gap-2">
                <Save className="w-4 h-4" /> {submitting ? "Menyimpan..." : "Kirim Laporan"}
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
