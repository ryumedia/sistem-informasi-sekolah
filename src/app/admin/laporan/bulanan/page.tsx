"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Edit, Trash2, Plus, Printer } from 'lucide-react';
import { db, auth } from '@/lib/firebase';
import { collection, getDocs, query, orderBy, doc, deleteDoc, where, getDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Laporan {
  id: string;
  informasiDasar: {
    semester: string;
    bulan: string;
    cabang: string;
  };
}

// Helper untuk memuat gambar dari URL agar bisa masuk ke PDF
const loadImage = async (url: string): Promise<string> => {
  try {
    const response = await fetch(url, { mode: 'cors' });
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    throw error;
  }
};

export default function LaporanBulananPage() {
  const [laporan, setLaporan] = useState<Laporan[]>([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedLaporan, setSelectedLaporan] = useState<Laporan | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setLoading(true);
        try {
          // 1. Cek Role & Cabang User
          const qGuru = query(collection(db, "guru"), where("email", "==", user.email));
          const guruSnap = await getDocs(qGuru);
          
          let role = "User";
          let userCabang = "";

          if (!guruSnap.empty) {
            const data = guruSnap.docs[0].data();
            role = data.role;
            // Handle cabang array/string
            if (Array.isArray(data.cabang)) {
                userCabang = data.cabang[0] || "";
            } else {
                userCabang = data.cabang || "";
            }
          }

          // 2. Query Laporan
          let q;
          if (["Admin", "Direktur", "Yayasan"].includes(role)) {
             q = query(collection(db, "laporan_bulanan"), orderBy("createdAt", "desc"));
          } else {
             // Filter by cabang
             q = query(
                collection(db, "laporan_bulanan"), 
                where("informasiDasar.cabang", "==", userCabang),
                orderBy("createdAt", "desc")
             );
          }

          const querySnapshot = await getDocs(q);
          const laporanData = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          } as Laporan));
          setLaporan(laporanData);
        } catch (error) {
          console.error("Error fetching laporan: ", error);
        } finally {
          setLoading(false);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  const handleDeleteClick = (laporan: Laporan) => {
    setSelectedLaporan(laporan);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (selectedLaporan) {
      try {
        await deleteDoc(doc(db, "laporan_bulanan", selectedLaporan.id));
        setLaporan(laporan.filter(item => item.id !== selectedLaporan.id));
        alert("Laporan berhasil dihapus.");
      } catch (error) {
        console.error("Error deleting document: ", error);
        alert("Gagal menghapus laporan.");
      } finally {
        setShowDeleteModal(false);
        setSelectedLaporan(null);
      }
    }
  };

  const handleDownloadPDF = async (laporan: Laporan) => {
    try {
      const docRef = doc(db, "laporan_bulanan", laporan.id);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        const doc = new jsPDF();
        
        // Header with Logo
        const logoUrl = '/logo.png'; // Path from public folder
        const logoData = await loadImage(logoUrl);
        doc.addImage(logoData, 'PNG', 14, 15, 25, 25);

        doc.setFontSize(22);
        doc.setFont("helvetica", "bold");
        doc.text("LAPORAN BULANAN", 45, 26);
        
        doc.setFontSize(18);
        doc.setFont("helvetica", "normal");
        doc.text("Main Riang Islamic Preschool", 45, 34);

        doc.setFontSize(10);
        doc.text(`Cabang: ${data.informasiDasar.cabang}`, 14, 47);
        doc.text(`Periode: ${data.informasiDasar.bulan} - ${data.informasiDasar.semester}`, 14, 54);
        doc.text(`Disusun Oleh: ${data.informasiDasar.disusunOleh}`, 14, 61);

        let finalY = 72;

        // A. Ringkasan Eksekutif
        doc.setFontSize(14);
        doc.text("A. Ringkasan Eksekutif", 14, finalY);
        finalY += 5;
        
        const ringkasanData = [
            ["Capaian Pembelajaran", data.ringkasanEksekutif?.capaianPembelajaran || "-"],
            ["Kinerja SDM", data.ringkasanEksekutif?.kinerjaSDM || "-"],
            ["Keuangan", data.ringkasanEksekutif?.keuangan || "-"],
            ["PPDB", data.ringkasanEksekutif?.ppdb || "-"],
            ["Isu Strategis", data.ringkasanEksekutif?.isuStrategis || "-"]
        ];

        autoTable(doc, {
            startY: finalY,
            head: [['Aspek', 'Uraian']],
            body: ringkasanData,
            theme: 'grid',
            headStyles: { fillColor: [88, 28, 135] },
            columnStyles: { 0: { cellWidth: 50 } }
        });
        finalY = (doc as any).lastAutoTable.finalY + 20;

        // B. Capaian OKR
        if (finalY > 250) { doc.addPage(); finalY = 20; }
        doc.text("B. Capaian OKR", 14, finalY);
        finalY += 5;

        const okrData = [
            ["Pembelajaran", data.capaianOKR?.pembelajaran || "-"],
            ["Budaya Kerja", data.capaianOKR?.budayaKerja || "-"],
            ["Kebersihan", data.capaianOKR?.kebersihan || "-"],
            ["Operasional", data.capaianOKR?.operasional || "-"],
            ["Branding", data.capaianOKR?.branding || "-"]
        ];

        autoTable(doc, {
            startY: finalY,
            head: [['Aspek', 'Uraian']],
            body: okrData,
            theme: 'grid',
            headStyles: { fillColor: [88, 28, 135] },
            columnStyles: { 0: { cellWidth: 50 } }
        });
        finalY = (doc as any).lastAutoTable.finalY + 50;

        // C. Capaian PPDB
        if (finalY > 250) { doc.addPage(); finalY = 20; }
        doc.text("C. Capaian PPDB", 14, finalY);
        finalY += 5;

        const capaianPPDB = data.capaianPPDB || {};
        const totalTarget = Object.values(capaianPPDB).reduce((sum: number, val: any) => sum + Number(val.target || 0), 0);
        const totalCapaian = Object.values(capaianPPDB).reduce((sum: number, val: any) => sum + Number(val.capaian || 0), 0);
        const totalSisa = totalTarget - totalCapaian;
        const totalProsentase = totalTarget > 0 ? ((totalCapaian / totalTarget) * 100).toFixed(1) : '0.0';

        const ppdbBody = Object.entries(capaianPPDB).map(([kelas, val]: any) => {
            const target = Number(val.target || 0);
            const capaian = Number(val.capaian || 0);
            const sisa = target - capaian;
            const prosentase = target > 0 ? ((capaian / target) * 100).toFixed(1) : '0.0';
            return [kelas, target, capaian, sisa, `${prosentase}%`];
        });
        
        autoTable(doc, {
            startY: finalY,
            head: [['Kelas', 'Target', 'Capaian', 'Sisa', '%']],
            body: ppdbBody,
            foot: [['Total', totalTarget, totalCapaian, totalSisa, `${totalProsentase}%`]],
            theme: 'striped',
            headStyles: { fillColor: [88, 28, 135] },
            footStyles: { fillColor: [241, 245, 249], textColor: 20, fontStyle: 'bold' }
        });
        finalY = (doc as any).lastAutoTable.finalY + 10;

        // D. Keuangan Singkat
        if (finalY > 250) { doc.addPage(); finalY = 20; }
        doc.text("D. Keuangan Singkat", 14, finalY);
        finalY += 5;

        const keuanganBody = (data.keuanganSingkat || []).map((item: any) => [
            item.pos, item.pengajuan, item.realisasi, item.catatan
        ]);

        autoTable(doc, {
            startY: finalY,
            head: [['Pos', 'Pengajuan', 'Realisasi', 'Catatan']],
            body: keuanganBody,
            theme: 'striped',
            headStyles: { fillColor: [88, 28, 135] }
        });
        finalY = (doc as any).lastAutoTable.finalY + 10;

        // E. Jumlah Siswa
        if (finalY > 250) { doc.addPage(); finalY = 20; }
        doc.text("E. Jumlah Siswa", 14, finalY);
        finalY += 5;

        const siswaBody = Object.entries(data.jumlahSiswa || {}).map(([kelas, val]: any) => [
            kelas, val.jumlah, val.keterangan
        ]);

        autoTable(doc, {
            startY: finalY,
            head: [['Kelas', 'Jumlah', 'Keterangan']],
            body: siswaBody,
            theme: 'striped',
            headStyles: { fillColor: [88, 28, 135] }
        });
        finalY = (doc as any).lastAutoTable.finalY + 10;

        // F. Isu Strategis
        if (finalY > 230) { doc.addPage(); finalY = 20; }
        doc.text("F. Isu Strategis", 14, finalY);
        finalY += 7;
        doc.setFontSize(10);
        doc.setLineHeightFactor(2);
        const isuText = doc.splitTextToSize(data.isuStrategis || "-", 180);
        doc.text(isuText, 14, finalY);
        finalY += (isuText.length * 6) + 10;
        doc.setLineHeightFactor(2);
        doc.setFontSize(12);

        // G. Rekomendasi Kegiatan
        if (finalY > 230) { doc.addPage(); finalY = 20; }
        doc.text("G. Rekomendasi Kegiatan", 14, finalY);
        finalY += 7;
        doc.setFontSize(10);
        doc.setLineHeightFactor(2);
        const rekText = doc.splitTextToSize(data.rekomendasiKegiatan || "-", 180);
        doc.text(rekText, 14, finalY);
        finalY += (rekText.length * 6) + 5;
        doc.setLineHeightFactor(2);
        doc.setFontSize(12);

        // H. Rencana Agenda
        if (finalY > 230) { doc.addPage(); finalY = 20; }
        doc.text("H. Rencana Agenda", 14, finalY);
        finalY += 7;
        doc.setFontSize(10);
        doc.text(`Tema: ${data.rencanaAgenda?.tema || "-"}`, 14, finalY);
        finalY += 5;
        const deskText = doc.splitTextToSize(`Deskripsi: ${data.rencanaAgenda?.deskripsi || "-"}`, 180);
        doc.text(deskText, 14, finalY);
        finalY += (deskText.length * 5) + 5;

        const agendaBody = (data.rencanaAgenda?.detail || []).map((item: any) => [
            item.tanggal, item.kegiatan
        ]);

        autoTable(doc, {
            startY: finalY,
            head: [['Tanggal', 'Kegiatan']],
            body: agendaBody,
            theme: 'striped',
            headStyles: { fillColor: [88, 28, 135] }
        });
        finalY = (doc as any).lastAutoTable.finalY + 10;

        // I. Dokumentasi
        if (data.dokumentasi && data.dokumentasi.length > 0) {
            doc.addPage();
            finalY = 20;
            doc.setFontSize(14);
            doc.text("I. Dokumentasi Kegiatan", 14, finalY);
            finalY += 10;

            let xPos = 14;
            let yPos = finalY;
            const imgWidth = 80;
            const imgHeight = 60;

            for (let i = 0; i < data.dokumentasi.length; i++) {
                const url = data.dokumentasi[i];
                if (url) {
                    try {
                        const imgData = await loadImage(url);
                        
                        if (xPos + imgWidth > 200) {
                            xPos = 14;
                            yPos += imgHeight + 10;
                        }
                        if (yPos + imgHeight > 280) {
                            doc.addPage();
                            yPos = 20;
                            xPos = 14;
                        }

                        doc.addImage(imgData, 'JPEG', xPos, yPos, imgWidth, imgHeight);
                        xPos += imgWidth + 10;
                    } catch (e) {
                        console.error("Failed to load image for PDF", e);
                    }
                }
            }
        }

        doc.save(`Laporan_${data.informasiDasar.cabang}_${data.informasiDasar.bulan}.pdf`);
      }
    } catch (error) {
      console.error("Error generating PDF:", error);
      alert("Gagal mendownload PDF. Pastikan library jspdf terinstall.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">Laporan Bulanan</h1>
        <div className="flex gap-2">
            <Link
              href="/admin/laporan/bulanan/buat"
              className="bg-[#581c87] text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-[#45156b] transition"
            >
              <Plus className="w-4 h-4" /> Buat Laporan
            </Link>
        </div>
      </div>

      {/* Tabel Data */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600 min-w-[600px]">
          <thead className="bg-gray-50 text-gray-900 font-semibold border-b">
            <tr>
              <th className="p-4 w-16">No</th>
              <th className="p-4">Semester</th>
              <th className="p-4">Bulan</th>
              <th className="p-4">Cabang</th>
              <th className="p-4">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={5} className="p-8 text-center">Memuat data...</td></tr>
            ) : laporan.length === 0 ? (
              <tr><td colSpan={5} className="p-8 text-center">Data tidak ditemukan.</td></tr>
            ) : (
              laporan.map((item, index) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="p-4 text-center">{index + 1}</td>
                  <td className="p-4 font-medium text-gray-900">{item.informasiDasar.semester}</td>
                  <td className="p-4">{item.informasiDasar.bulan}</td>
                  <td className="p-4">{item.informasiDasar.cabang}</td>
                  <td className="p-4 flex gap-2">
                    <button onClick={() => handleDownloadPDF(item)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition" title="Download PDF">
                      <Printer className="w-4 h-4" />
                    </button>
                    <Link href={`/admin/laporan/bulanan/buat?id=${item.id}`} className="p-2 text-[#581c87] hover:bg-[#581c87]/10 rounded-lg transition" title="Edit">
                      <Edit className="w-4 h-4" />
                    </Link>
                    <button 
                      onClick={() => handleDeleteClick(item)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition" 
                      title="Hapus"
                    >
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

       {/* Modal Konfirmasi Hapus */}
       {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Konfirmasi Hapus</h2>
            <p>Apakah Anda yakin ingin menghapus laporan untuk bulan <span className="font-semibold">{selectedLaporan?.informasiDasar.bulan}</span> semester <span className="font-semibold">{selectedLaporan?.informasiDasar.semester}</span>?</p>
            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300 transition"
              >
                Batal
              </button>
              <button
                onClick={confirmDelete}
                className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition"
              >
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
