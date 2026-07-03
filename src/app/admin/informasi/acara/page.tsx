"use client";

import { useState, useEffect, FormEvent } from 'react';
import Link from 'next/link';
import { db } from "@/lib/firebase";
import { collection, query, orderBy, getDocs, deleteDoc, doc, Timestamp, addDoc, updateDoc, serverTimestamp, getDoc, setDoc } from "firebase/firestore";
import { Loader2, PlusCircle, Users, QrCode, Edit, Trash2, X, Building, Calendar, Clock, MapPin, Map } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { Scanner } from '@yudiel/react-qr-scanner';

interface Acara {
  id: string;
  nama: string;
  tanggal: Timestamp;
  waktu: string;
  tempat: string;
  cabang: string[];
  linkGMap?: string;
  createdAt?: Timestamp;
}

export default function DaftarAcaraPage() {
  const [acaraList, setAcaraList] = useState<Acara[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedAcara, setSelectedAcara] = useState<Acara | null>(null);
  const [cabangList, setCabangList] = useState<any[]>([]);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scanningAcara, setScanningAcara] = useState<Acara | null>(null);

  useEffect(() => {
    const fetchAcara = async () => {
      try {
        // Fetch Acara
        const q = query(collection(db, "acara"), orderBy("tanggal", "desc"));
        const snapshot = await getDocs(q);
        const list = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Acara));
        setAcaraList(list);

        // Fetch Cabang for Modal
        const cabangQuery = query(collection(db, "cabang"), orderBy("nama", "asc"));
        const cabangSnapshot = await getDocs(cabangQuery);
        const cabangs = cabangSnapshot.docs.map(doc => ({
          id: doc.id,
          nama: doc.data().nama,
        }));
        setCabangList(cabangs);

      } catch (error) {
        console.error("Error fetching events: ", error);
        alert("Gagal memuat data acara.");
      } finally {
        setLoading(false);
      }
    };
    fetchAcara();
  }, []);

  const handleOpenModal = (acara: Acara | null = null) => {
    setSelectedAcara(acara);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedAcara(null);
  };

  const handleOpenScanner = (acara: Acara) => {
    setScanningAcara(acara);
    setIsScannerOpen(true);
  };

  const handleCloseScanner = () => {
    setIsScannerOpen(false);
    setScanningAcara(null);
  };

  const handleDelete = async (acara: Acara) => {
    if (!confirm(`Yakin ingin menghapus acara "${acara.nama}"?`)) return;

    try {
      await deleteDoc(doc(db, "acara", acara.id));
      setAcaraList(prev => prev.filter(a => a.id !== acara.id));
      alert("Acara berhasil dihapus.");
    } catch (error) {
      console.error("Error deleting event: ", error);
      alert("Gagal menghapus acara.");
    }
  };

  const handleFormSubmit = (acara: Acara) => {
    if (selectedAcara) {
      // Update
      setAcaraList(prev => prev.map(a => a.id === acara.id ? acara : a));
    } else {
      // Add
      setAcaraList(prev => [acara, ...prev]);
    }
  };

  // Disesuaikan dengan library baru
  const handleScanResult = async (decodedCodes: any[]) => {
    // Ambil hasil pertama dari array yang terdeteksi
    const firstResult = decodedCodes[0];
    if (!firstResult || !scanningAcara) return;
    const userId = firstResult.rawValue;
    console.log(`Scanned User ID: ${userId}`);
    handleCloseScanner(); // Langsung tutup scanner setelah dapat hasil

    try {
      // 1. Cek apakah user sudah terdaftar sebagai peserta di acara ini
      const pesertaRef = doc(db, 'acara', scanningAcara.id, 'peserta', userId);
      const pesertaSnap = await getDoc(pesertaRef);

      if (pesertaSnap.exists()) {
        alert(`Peserta sudah melakukan check-in sebelumnya pada pukul ${format(pesertaSnap.data().checkInTime.toDate(), 'HH:mm:ss')}.`);
        return;
      }

      // 2. Jika belum, cari data user di koleksi 'guru' atau 'siswa'
      let userDoc;
      const guruRef = doc(db, 'guru', userId);
      const siswaRef = doc(db, 'siswa', userId);

      const guruSnap = await getDoc(guruRef);
      if (guruSnap.exists()) {
        userDoc = guruSnap.data();
      } else {
        const siswaSnap = await getDoc(siswaRef);
        if (siswaSnap.exists()) {
          userDoc = siswaSnap.data();
        }
      }

      if (!userDoc) {
        throw new Error(`User dengan ID ${userId} tidak ditemukan.`);
      }

      // 3. Simpan data user sebagai peserta
      const dataPeserta = {
        nama: userDoc.nama,
        email: userDoc.email,
        role: userDoc.role,
        cabang: userDoc.cabang || 'Tidak ada',
        kelas: userDoc.kelas || '-',
        checkInTime: serverTimestamp(),
      };

      await setDoc(pesertaRef, dataPeserta);

      alert(`Check-in berhasil!\n\nNama: ${userDoc.nama}\nRole: ${userDoc.role}\nCabang: ${userDoc.cabang || 'Tidak ada'}`);

    } catch (error) {
      console.error("Error processing scan:", error);
      alert("Gagal melakukan check-in. " + (error as Error).message);
    }
  };

  const formatDate = (timestamp: Timestamp) => {
    if (!timestamp) return "-";
    return format(timestamp.toDate(), 'd MMMM yyyy');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Daftar Acara</h1>
          <p className="text-sm text-gray-500">Kelola semua acara sekolah yang akan datang dan yang sudah lewat.</p>
        </div>
        <button 
          onClick={() => handleOpenModal()} 
          className="inline-flex items-center gap-2 bg-[#581c87] text-white px-4 py-2 rounded-lg hover:bg-[#4a166f] transition"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Tambah Acara</span>
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50 text-gray-900 font-semibold border-b">
              <tr>
                <th className="p-4 w-12 text-center">No.</th>
                <th className="p-4">Nama Acara</th>
                <th className="p-4">Cabang</th>
                <th className="p-4">Tanggal</th>
                <th className="p-4">Waktu</th>
                <th className="p-4">Tempat</th>
                <th className="p-4 w-40 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-[#581c87]" />
                  </td>
                </tr>
              ) : acaraList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-gray-500">
                    Belum ada acara yang ditambahkan.
                  </td>
                </tr>
              ) : (
                acaraList.map((item, index) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="p-4 text-center">{index + 1}</td>
                    <td className="p-4 font-medium text-gray-900">{item.nama}</td>
                    <td className="p-4">
                      <div className="flex flex-wrap gap-1">
                        {item.cabang?.map(c => (
                          <span key={c} className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-md">{c}</span>
                        )) || '-'}
                      </div>
                    </td>
                    <td className="p-4">{formatDate(item.tanggal)}</td>
                    <td className="p-4">{item.waktu}</td>
                    <td className="p-4">{item.tempat}</td>
                    <td className="p-4">
                      <div className="flex justify-center items-center gap-1">
                        <Link
                          href={`/admin/informasi/acara/peserta/${item.id}`}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition" 
                          title="Lihat Peserta">
                          <Users className="w-4 h-4" />
                        </Link>
                        <button 
                          onClick={() => handleOpenScanner(item)} 
                          className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition" 
                          title="Scan QR Code">
                          <QrCode className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleOpenModal(item)}
                          className="p-2 text-yellow-600 hover:bg-yellow-50 rounded-lg transition" 
                          title="Edit">
                          <Edit className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDelete(item)} 
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition" 
                          title="Hapus">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <AcaraModal 
          acara={selectedAcara} 
          cabangList={cabangList}
          onClose={handleCloseModal} 
          onSubmit={handleFormSubmit}
        />
      )}

      {isScannerOpen && (
        <ScannerModal
          acaraNama={scanningAcara?.nama || ''}
          onClose={handleCloseScanner}
          onScan={handleScanResult}
        />
      )}
    </div>
  );
}

// --- MODAL COMPONENT ---
interface AcaraModalProps {
  acara: Acara | null;
  cabangList: any[];
  onClose: () => void;
  onSubmit: (acara: Acara) => void;
}

function AcaraModal({ acara, cabangList, onClose, onSubmit }: AcaraModalProps) {
  const [formData, setFormData] = useState({
    nama: acara?.nama || '',
    tanggal: acara?.tanggal ? format(acara.tanggal.toDate(), 'yyyy-MM-dd') : '',
    waktu: acara?.waktu || '',
    tempat: acara?.tempat || '',
    cabang: acara?.cabang || [],
    linkGMap: acara?.linkGMap || '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCabangChange = (cabangNama: string) => {
    setFormData(prev => {
      const newCabang = prev.cabang.includes(cabangNama)
        ? prev.cabang.filter(c => c !== cabangNama)
        : [...prev.cabang, cabangNama];
      return { ...prev, cabang: newCabang };
    });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (formData.cabang.length === 0) {
      alert("Silakan pilih minimal satu cabang.");
      return;
    }
    setIsSubmitting(true);

    const dataToSave = {
      ...formData,
      tanggal: Timestamp.fromDate(parseISO(formData.tanggal)),
    };

    try {
      if (acara) {
        // Update
        const docRef = doc(db, "acara", acara.id);
        await updateDoc(docRef, dataToSave);
        onSubmit({ ...acara, ...dataToSave });
        alert("Acara berhasil diperbarui.");
      } else {
        // Create
        const docRef = await addDoc(collection(db, "acara"), {
          ...dataToSave,
          createdAt: serverTimestamp(),
        });
        onSubmit({ id: docRef.id, ...dataToSave, createdAt: Timestamp.now() });
        alert("Acara berhasil ditambahkan.");
      }
      onClose();
    } catch (error) {
      console.error("Error saving event: ", error);
      alert("Gagal menyimpan data acara.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex justify-center items-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-5 border-b">
          <h2 className="text-xl font-bold text-gray-800">{acara ? 'Edit Acara' : 'Tambah Acara Baru'}</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100">
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* --- NAMA ACARA --- */}
          <div className="space-y-2">
            <label htmlFor="nama" className="font-medium text-sm text-gray-700">Nama Acara</label>
            <input type="text" id="nama" value={formData.nama} onChange={e => setFormData({...formData, nama: e.target.value})} className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-[#581c87] outline-none" required />
          </div>

          {/* --- CABANG --- */}
          <div className="space-y-3">
            <label className="font-medium text-sm text-gray-700 flex items-center gap-2"><Building className="w-4 h-4" />Pilih Cabang</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 p-4 border rounded-lg bg-gray-50/50">
              {cabangList.map(c => (
                <label key={c.id} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={formData.cabang.includes(c.nama)}
                    onChange={() => handleCabangChange(c.nama)}
                    className="w-4 h-4 text-[#581c87] rounded focus:ring-[#581c87]"
                  />
                  {c.nama}
                </label>
              ))}
            </div>
          </div>

          {/* --- TANGGAL & WAKTU --- */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label htmlFor="tanggal" className="font-medium text-sm text-gray-700 flex items-center gap-2"><Calendar className="w-4 h-4" />Tanggal</label>
              <input type="date" id="tanggal" value={formData.tanggal} onChange={e => setFormData({...formData, tanggal: e.target.value})} className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-[#581c87] outline-none" required />
            </div>
            <div className="space-y-2">
              <label htmlFor="waktu" className="font-medium text-sm text-gray-700 flex items-center gap-2"><Clock className="w-4 h-4" />Waktu</label>
              <input type="text" id="waktu" placeholder="cth: 09:00 - 12:00" value={formData.waktu} onChange={e => setFormData({...formData, waktu: e.target.value})} className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-[#581c87] outline-none" required />
            </div>
          </div>

          {/* --- TEMPAT --- */}
          <div className="space-y-2">
            <label htmlFor="tempat" className="font-medium text-sm text-gray-700 flex items-center gap-2"><MapPin className="w-4 h-4" />Tempat</label>
            <input type="text" id="tempat" placeholder="cth: Aula Sekolah" value={formData.tempat} onChange={e => setFormData({...formData, tempat: e.target.value})} className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-[#581c87] outline-none" required />
          </div>

          {/* --- LINK GOOGLE MAP --- */}
          <div className="space-y-2">
            <label htmlFor="linkGMap" className="font-medium text-sm text-gray-700 flex items-center gap-2"><Map className="w-4 h-4" />Link Google Map (Opsional)</label>
            <input type="url" id="linkGMap" placeholder="https://maps.app.goo.gl/..." value={formData.linkGMap} onChange={e => setFormData({...formData, linkGMap: e.target.value})} className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-[#581c87] outline-none" />
          </div>
        </form>

        <div className="p-5 border-t bg-gray-50 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition">
            Batal
          </button>
          <button type="submit" form="acara-form" onClick={handleSubmit} disabled={isSubmitting} className="px-6 py-2 bg-[#581c87] text-white rounded-lg hover:bg-[#4a166f] transition disabled:bg-gray-300 flex items-center gap-2">
            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {acara ? 'Simpan Perubahan' : 'Simpan Acara'}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- SCANNER MODAL COMPONENT ---
interface ScannerModalProps {
  acaraNama: string;
  onClose: () => void;
  onScan: (result: any) => void;
}

function ScannerModal({ acaraNama, onClose, onScan }: ScannerModalProps) {
  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex justify-center items-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md flex flex-col overflow-hidden">
        <div className="flex justify-between items-center p-5 border-b">
          <div>
            <h2 className="text-xl font-bold text-gray-800">Scan QR Presensi</h2>
            <p className="text-sm text-gray-500">Acara: {acaraNama}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100">
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>
        {/* PERBAIKAN: Menggunakan div dengan aspect-ratio untuk stabilitas render kamera */}
        <div className="w-full bg-gray-900 aspect-square overflow-hidden relative">
          <Scanner
            onScan={onScan}
            onError={(error: any) => console.log(error?.message)}
            constraints={{
              facingMode: 'environment'
            }}
            // PERBAIKAN: Styling video agar mengisi container secara absolut
            styles={{
              video: { 
                objectFit: 'cover',
                width: '100%',
                height: '100%',
              },
            }} />
        </div>
        <p className="text-center text-sm text-gray-500 p-4 bg-gray-50">Arahkan kamera ke QR Code milik peserta.</p>
      </div>
    </div>
  );
}