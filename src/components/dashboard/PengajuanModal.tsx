// d:\Private\Ryumedia\sistem-informasi-sekolah\src\components\dashboard\PengajuanModal.tsx
"use client";
import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, addDoc, query, orderBy, getDocs } from "firebase/firestore";
import { X } from "lucide-react";

export default function PengajuanModal({ user, userData, onClose }: { user: any; userData: any; onClose: () => void }) {
  const [nomenklaturList, setNomenklaturList] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    tanggal: new Date().toISOString().split('T')[0],
    pengaju: userData?.nama || user?.displayName || "",
    cabang: userData?.cabang || "",
    nomenklatur: "",
    barang: "",
    harga: 0,
    qty: 1,
  });

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

  const totalHarga = formData.harga * formData.qty;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const initialStatus = formData.cabang === 'Main Riang Pusat' ? 'Menunggu Direktur' : 'Menunggu KS';

      await addDoc(collection(db, "pengajuan"), {
        tanggal: formData.tanggal,
        pengaju: formData.pengaju,
        cabang: formData.cabang,
        nomenklatur: formData.nomenklatur,
        barang: formData.barang,
        hargaSatuan: Number(formData.harga),
        qty: Number(formData.qty),
        total: totalHarga,
        status: initialStatus,
        userId: user.uid,
        createdAt: new Date(),
      });
      alert("Pengajuan berhasil dikirim!");
      onClose();
    } catch (error) {
      console.error("Error submitting:", error);
      alert("Gagal mengirim pengajuan.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="p-4 border-b flex justify-between items-center bg-gray-50 sticky top-0">
          <h3 className="font-bold text-gray-800">Form Pengajuan Anggaran</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Tanggal</label>
              <input required type="date" className="w-full border rounded-lg p-2 text-sm text-gray-900"
                value={formData.tanggal} onChange={(e) => setFormData({...formData, tanggal: e.target.value})} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Cabang</label>
              <input readOnly type="text" className="w-full border rounded-lg p-2 text-sm bg-gray-100 text-gray-600"
                value={formData.cabang} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Nama Pengaju</label>
            <input readOnly type="text" className="w-full border rounded-lg p-2 text-sm bg-gray-100 text-gray-600"
              value={formData.pengaju} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Nomenklatur (Pos Anggaran)</label>
            <select required className="w-full border rounded-lg p-2 text-sm bg-white text-gray-900"
              value={formData.nomenklatur} onChange={(e) => setFormData({...formData, nomenklatur: e.target.value})}>
              <option value="">Pilih Nomenklatur</option>
              {nomenklaturList
                .filter((item: any) => item.kategori === "Pengeluaran")
                .map((item: any) => (
                <option key={item.id} value={item.nama}>{item.nama}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Nama Barang / Jasa</label>
            <input required type="text" className="w-full border rounded-lg p-2 text-sm text-gray-900" placeholder="Contoh: Kertas HVS A4"
              value={formData.barang} onChange={(e) => setFormData({...formData, barang: e.target.value})} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-500 mb-1">Harga Satuan (Rp)</label>
              <input required type="text" className="w-full border rounded-lg p-2 text-sm text-gray-900"
                value={formData.harga === 0 ? "" : formData.harga.toLocaleString("id-ID")} 
                onChange={(e) => {
                  const rawValue = e.target.value.replace(/\./g, "");
                  if (!isNaN(Number(rawValue))) {
                    setFormData({...formData, harga: Number(rawValue)});
                  }
                }}
                placeholder="0" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Qty</label>
              <input required type="number" min="1" className="w-full border rounded-lg p-2 text-sm text-gray-900"
                value={formData.qty} onChange={(e) => setFormData({...formData, qty: Number(e.target.value)})} />
            </div>
          </div>
          <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
            <label className="block text-xs font-medium text-gray-500 mb-1">Total Harga</label>
            <div className="text-lg font-bold text-[#581c87]">
              Rp {totalHarga.toLocaleString("id-ID")}
            </div>
          </div>
          <button disabled={submitting} type="submit" className="w-full bg-[#581c87] text-white py-3 rounded-lg hover:bg-[#45156b] transition font-medium mt-2 disabled:opacity-50">
            {submitting ? "Mengirim..." : "Kirim Pengajuan"}
          </button>
        </form>
      </div>
    </div>
  );
}
