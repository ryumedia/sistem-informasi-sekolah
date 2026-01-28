// src/app/admin/keuangan/pengajuan/page.tsx
"use client";

import { useState, useEffect } from "react";
import { db, auth } from "@/lib/firebase";
import { collection, getDocs, query, orderBy, doc, updateDoc, where, deleteDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { Eye, CheckCircle, XCircle, Filter, X, Pencil, Trash2, Save } from "lucide-react";

interface Pengajuan {
  id: string;
  tanggal: string;
  pengaju: string;
  cabang: string;
  nomenklatur: string;
  barang: string;
  hargaSatuan: number;
  qty: number;
  total: number;
  status: string;
}

export default function PengajuanPage() {
  const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => (currentYear - 1 + i).toString());

  const [filterTahun, setFilterTahun] = useState(currentYear.toString());
  const [filterBulan, setFilterBulan] = useState(monthNames[new Date().getMonth()]);
  const [filterCabang, setFilterCabang] = useState("");
  const [filterNama, setFilterNama] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [cabangList, setCabangList] = useState<any[]>([]);
  const [nomenklaturList, setNomenklaturList] = useState<any[]>([]);
  
  const [dataList, setDataList] = useState<Pengajuan[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  
  // State Modal
  const [detailItem, setDetailItem] = useState<Pengajuan | null>(null);
  const [editItem, setEditItem] = useState<Pengajuan | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [editFormData, setEditFormData] = useState({
    tanggal: "",
    cabang: "",
    nomenklatur: "",
    barang: "",
    hargaSatuan: 0,
    qty: 0,
  });

  // 1. Cek Role User yang Login
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
             // Fallback for admin or other roles not in guru/caregivers
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

  // 2. Ambil Data Cabang untuk Filter
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

  // Fetch Nomenklatur untuk Edit Modal
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

  // 3. Ambil Data Pengajuan dari Firestore
  const fetchData = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      let q;
      const pengajuanCollection = collection(db, "pengajuan");
      const userRoles = currentUser.role || [];

      if (userRoles.includes('Guru') || userRoles.includes('Caregiver')) {
        q = query(pengajuanCollection, where("userId", "==", currentUser.uid || currentUser.id), orderBy("createdAt", "desc"));
      } else if (userRoles.includes('Kepala Sekolah') && currentUser.cabang) {
        q = query(pengajuanCollection, where("cabang", "==", currentUser.cabang), orderBy("createdAt", "desc"));
      } else {
        q = query(pengajuanCollection, orderBy("createdAt", "desc"));
      }
      
      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Pengajuan[];
      
      setDataList(data);
    } catch (error) {
      console.error("Error fetching pengajuan:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser) {
      fetchData();
    }
  }, [currentUser]);

  // 4. Logic Filter Client-Side
  const filteredData = dataList.filter((item) => {
    const date = new Date(item.tanggal);
    const year = date.getFullYear().toString();
    const monthIndex = date.getMonth();
    const month = monthNames[monthIndex];

    const matchTahun = filterTahun === year;
    const matchBulan = filterBulan === month;
    const matchCabang = filterCabang ? item.cabang === filterCabang : true;
    const matchNama = filterNama ? (item.pengaju || "").toLowerCase().includes(filterNama.toLowerCase()) : true;
    const matchStatus = filterStatus ? item.status === filterStatus : true;

    return matchTahun && matchBulan && matchCabang && matchStatus && matchNama;
  });

  // 5. Logic Approval Berjenjang
  const handleApprove = async (item: Pengajuan) => {
    let newStatus = "";
    const userRoles = currentUser?.role || [];
    
    if (item.status === "Menunggu KS") {
      if (!userRoles.includes("Kepala Sekolah")) return alert("Hanya Kepala Sekolah yang dapat menyetujui tahap ini.");
      newStatus = "Menunggu Direktur";
    } else if (item.status === "Menunggu Direktur") {
      if (!userRoles.includes("Direktur")) return alert("Hanya Direktur yang dapat menyetujui tahap ini.");
      newStatus = "Disetujui";
    } else {
      return;
    }

    if (confirm(`Setujui pengajuan ini? Status akan berubah menjadi '${newStatus}'.`)) {
      await updateDoc(doc(db, "pengajuan", item.id), { status: newStatus });
      alert("Status berhasil diperbarui!");
      fetchData();
    }
  };

  // 6. Logic Delete
  const handleDelete = async (id: string) => {
    if (confirm("Yakin ingin menghapus pengajuan ini? Tindakan ini tidak dapat dibatalkan.")) {
      try {
        await deleteDoc(doc(db, "pengajuan", id));
        alert("Data berhasil dihapus.");
        fetchData();
      } catch (error) {
        console.error("Error deleting:", error);
        alert("Gagal menghapus data.");
      }
    }
  };

  // 7. Logic Edit
  const openEditModal = (item: Pengajuan) => {
    setEditItem(item);
    setEditFormData({
      tanggal: item.tanggal,
      cabang: item.cabang,
      nomenklatur: item.nomenklatur,
      barang: item.barang,
      hargaSatuan: item.hargaSatuan,
      qty: item.qty,
    });
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editItem) return;
    setSubmitting(true);
    try {
      await updateDoc(doc(db, "pengajuan", editItem.id), {
        ...editFormData,
        total: Number(editFormData.hargaSatuan) * Number(editFormData.qty),
      });
      alert("Data berhasil diperbarui!");
      setEditItem(null);
      fetchData();
    } catch (error) {
      console.error("Error updating:", error);
      alert("Gagal memperbarui data.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">Daftar Pengajuan Anggaran</h1>
        
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
          <select 
            className={`border rounded-lg p-2 text-sm bg-white outline-none focus:ring-2 focus:ring-[#581c87] text-gray-900 ${["Kepala Sekolah", "Guru", "Caregiver"].includes(currentUser?.role) ? "bg-gray-100 cursor-not-allowed" : ""}`} 
            value={filterCabang} 
            onChange={(e) => setFilterCabang(e.target.value)}
            disabled={["Kepala Sekolah", "Guru", "Caregiver"].includes(currentUser?.role)}
          >
            {!["Kepala Sekolah", "Guru", "Caregiver"].includes(currentUser?.role) && <option value="">Semua Cabang</option>}
            {cabangList.map((c) => <option key={c.id} value={c.nama}>{c.nama}</option>)}
          </select>
          <input 
            type="text" 
            placeholder="Cari Nama Pengaju" 
            className="border rounded-lg p-2 text-sm bg-white outline-none focus:ring-2 focus:ring-[#581c87] text-gray-900"
            value={filterNama}
            onChange={(e) => setFilterNama(e.target.value)}
          />
          <select className="border rounded-lg p-2 text-sm bg-white outline-none focus:ring-2 focus:ring-[#581c87] text-gray-900" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="">Semua Status</option>
            <option value="Menunggu KS">Menunggu KS</option>
            <option value="Menunggu Direktur">Menunggu Direktur</option>
            <option value="Disetujui">Disetujui</option>
            <option value="Ditolak">Ditolak</option>
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
              <th className="p-4">Tanggal</th>
              <th className="p-4">Nama Pengaju</th>
              <th className="p-4">Cabang</th>
              <th className="p-4">Total Pengajuan</th>
              <th className="p-4">Status Approval</th>
              <th className="p-4">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={7} className="p-8 text-center">Memuat data...</td></tr>
            ) : filteredData.length === 0 ? (
              <tr><td colSpan={7} className="p-8 text-center">Tidak ada data pengajuan pada periode ini.</td></tr>
            ) : (
              filteredData.map((item, index) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="p-4">{index + 1}</td>
                  <td className="p-4">{item.tanggal}</td>
                  <td className="p-4 font-medium text-gray-900">{item.pengaju}</td>
                  <td className="p-4">{item.cabang}</td>
                  <td className="p-4 font-bold text-[#581c87]">Rp {item.total.toLocaleString("id-ID")}</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      item.status === 'Disetujui' ? 'bg-green-100 text-green-700' : 
                      item.status === 'Menunggu Direktur' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
                    }`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="p-4 flex gap-2">
                    <button onClick={() => setDetailItem(item)} className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg" title="Lihat Detail">
                      <Eye className="w-4 h-4" />
                    </button>
                    {item.status !== 'Disetujui' && (
                      <button onClick={() => handleApprove(item)} className="p-2 text-green-600 hover:bg-green-50 rounded-lg" title="Approve">
                        <CheckCircle className="w-4 h-4" />
                      </button>
                    )}
                    <button onClick={() => openEditModal(item)} className="p-2 text-[#581c87] hover:bg-[#581c87]/10 rounded-lg" title="Edit">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(item.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg" title="Hapus">
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

      {/* Modal Detail Pengajuan */}
      {detailItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-4 border-b flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-gray-800">Detail Pengajuan</h3>
              <button onClick={() => setDetailItem(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-gray-500 text-xs">Tanggal</p>
                  <p className="font-medium">{detailItem.tanggal}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Status</p>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    detailItem.status === 'Disetujui' ? 'bg-green-100 text-green-700' : 
                    detailItem.status === 'Menunggu Direktur' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
                  }`}>
                    {detailItem.status}
                  </span>
                </div>
              </div>
              <div>
                <p className="text-gray-500 text-xs">Pengaju</p>
                <p className="font-medium">{detailItem.pengaju}</p>
                <p className="text-xs text-gray-400">{detailItem.cabang}</p>
              </div>
              <div className="border-t pt-3 mt-2">
                <p className="text-gray-500 text-xs mb-1">Rincian Barang/Jasa</p>
                <p className="font-bold text-gray-800">{detailItem.barang}</p>
                <p className="text-xs text-gray-500">{detailItem.nomenklatur}</p>
              </div>
              <div className="grid grid-cols-3 gap-2 bg-gray-50 p-3 rounded-lg">
                <div>
                  <p className="text-gray-500 text-xs">Harga</p>
                  <p className="font-medium">Rp {detailItem.hargaSatuan?.toLocaleString("id-ID")}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Qty</p>
                  <p className="font-medium">{detailItem.qty}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Total</p>
                  <p className="font-bold text-[#581c87]">Rp {detailItem.total?.toLocaleString("id-ID")}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Edit Pengajuan */}
      {editItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-4 border-b flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-gray-800">Edit Pengajuan</h3>
              <button onClick={() => setEditItem(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleUpdate} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal</label>
                <input required type="date" className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#581c87] outline-none text-gray-900"
                  value={editFormData.tanggal} onChange={(e) => setEditFormData({...editFormData, tanggal: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cabang</label>
                <select className="w-full border rounded-lg p-2 bg-white focus:ring-2 focus:ring-[#581c87] outline-none text-gray-900"
                  value={editFormData.cabang} onChange={(e) => setEditFormData({...editFormData, cabang: e.target.value})}>
                  <option value="">Pilih Cabang</option>
                  {cabangList.map((c) => (
                    <option key={c.id} value={c.nama}>{c.nama}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nomenklatur</label>
                <select className="w-full border rounded-lg p-2 bg-white focus:ring-2 focus:ring-[#581c87] outline-none text-gray-900"
                  value={editFormData.nomenklatur} onChange={(e) => setEditFormData({...editFormData, nomenklatur: e.target.value})}>
                  <option value="">Pilih Nomenklatur</option>
                  {nomenklaturList.map((n) => (
                    <option key={n.id} value={n.nama}>{n.nama}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Barang / Jasa</label>
                <input required type="text" className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#581c87] outline-none text-gray-900"
                  value={editFormData.barang} onChange={(e) => setEditFormData({...editFormData, barang: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Harga Satuan</label>
                  <input required type="number" min="0" className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#581c87] outline-none text-gray-900"
                    value={editFormData.hargaSatuan} onChange={(e) => setEditFormData({...editFormData, hargaSatuan: Number(e.target.value)})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Qty</label>
                  <input required type="number" min="1" className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#581c87] outline-none text-gray-900"
                    value={editFormData.qty} onChange={(e) => setEditFormData({...editFormData, qty: Number(e.target.value)})} />
                </div>
              </div>
              <button disabled={submitting} type="submit" className="w-full bg-[#581c87] text-white py-2 rounded-lg hover:bg-[#45156b] transition font-medium mt-2 flex justify-center items-center gap-2">
                <Save className="w-4 h-4" /> {submitting ? "Menyimpan..." : "Simpan Perubahan"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
