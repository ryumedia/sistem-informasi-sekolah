"use client";

import { useState, useEffect } from "react";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  where,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  Plus,
  Pencil,
  Trash2,
  X,
  Loader2,
  FileText,
  Printer,
  Sparkles,
  CheckSquare,
  Square,
  RefreshCw,
  Save,
  Eye,
  Code,
} from "lucide-react";

// --- Interfaces ---

interface RPPH {
  id: string;
  tanggal: string;
  tema: string;
  subTema: string;
  materi: string;
  deskripsi: string;
  kelas: string;
  kelompokUsia: string;
  tahapPerkembangan: string[]; // Array of IDs or Strings
  indikator: string[];
  trilogi: string[];
  content: string; // Hasil generate AI
  createdAt: any;
}

interface DataMaster {
  id: string;
  [key: string]: any;
}

export default function RPPHPage() {
  // --- State Data Utama ---
  const [rpphList, setRpphList] = useState<RPPH[]>([]);
  const [loading, setLoading] = useState(true);

  // --- State Data Master (untuk Dropdown) ---
  const [kelasList, setKelasList] = useState<DataMaster[]>([]);
  const [usiaList, setUsiaList] = useState<DataMaster[]>([]);
  const [tahapList, setTahapList] = useState<DataMaster[]>([]); // Filtered by Usia
  const [indikatorList, setIndikatorList] = useState<DataMaster[]>([]);
  const [trilogiList, setTrilogiList] = useState<DataMaster[]>([]);

  // --- State Modal & Form ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [generatedContent, setGeneratedContent] = useState("");
  const [activeTab, setActiveTab] = useState<'preview' | 'html'>('preview');

  const initialFormState = {
    tanggal: new Date().toISOString().split("T")[0],
    tema: "",
    subTema: "",
    materi: "",
    deskripsi: "",
    kelas: "",
    kelompokUsiaId: "", // ID untuk filter
    kelompokUsia: "", // Nama untuk display
    tahapPerkembangan: [] as string[],
    indikator: [] as string[],
    trilogi: [] as string[],
  };

  const [formData, setFormData] = useState(initialFormState);

  // --- Fetch Data ---

  const fetchRPPH = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, "rpph"), orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as RPPH[];
      setRpphList(data);
    } catch (error) {
      console.error("Error fetching RPPH:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDataMaster = async () => {
    try {
      // Kelas
      const kelasSnap = await getDocs(query(collection(db, "kelas"), orderBy("namaKelas", "asc")));
      setKelasList(kelasSnap.docs.map((d) => ({ id: d.id, ...d.data() })));

      // Kelompok Usia
      const usiaSnap = await getDocs(query(collection(db, "kelompok_usia"), orderBy("usia", "asc")));
      setUsiaList(usiaSnap.docs.map((d) => ({ id: d.id, ...d.data() })));

      // Indikator (Sub)
      const indikatorSnap = await getDocs(collection(db, "sub_indikators"));
      const indikatorData = indikatorSnap.docs.map((d) => ({ id: d.id, ...d.data() } as DataMaster));
      // Sort natural (numeric: true) agar 1.1, 1.2, ... 1.10, 2.1 urut benar
      indikatorData.sort((a, b) => 
        (a.kode || "").localeCompare(b.kode || "", undefined, { numeric: true })
      );
      setIndikatorList(indikatorData);

      // Trilogi (Sub)
      const trilogiSnap = await getDocs(collection(db, "sub_trilogi"));
      const trilogiData = trilogiSnap.docs.map((d) => ({ id: d.id, ...d.data() } as DataMaster));
      trilogiData.sort((a, b) => 
        (a.kode || "").localeCompare(b.kode || "", undefined, { numeric: true })
      );
      setTrilogiList(trilogiData);
    } catch (error) {
      console.error("Error fetching master data:", error);
    }
  };

  // Fetch Tahap Perkembangan saat Usia dipilih
  useEffect(() => {
    if (formData.kelompokUsiaId) {
      const fetchTahap = async () => {
        const q = query(
          collection(db, "tahap_perkembangan"),
          where("kelompokUsiaId", "==", formData.kelompokUsiaId)
        );
        const snap = await getDocs(q);
        setTahapList(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      };
      fetchTahap();
    } else {
      setTahapList([]);
    }
  }, [formData.kelompokUsiaId]);

  useEffect(() => {
    fetchRPPH();
    fetchDataMaster();
  }, []);

  // --- Handlers ---

  const handleMultiSelect = (field: "tahapPerkembangan" | "indikator" | "trilogi", value: string) => {
    setFormData((prev) => {
      const current = prev[field];
      if (current.includes(value)) {
        return { ...prev, [field]: current.filter((item) => item !== value) };
      } else {
        return { ...prev, [field]: [...current, value] };
      }
    });
  };

  // Fungsi Mock AI Generator (Bisa diganti dengan call API ke Gemini/OpenAI)
  const generateRPPHContent = (data: typeof formData) => {
    // Simulasi AI: Membuat konten dinamis berdasarkan input
    const opening = `1. Berbaris di halaman, ikrar, dan senam irama.\n2. Berdoa sebelum belajar.\n3. Apersepsi tentang ${data.tema} (${data.subTema}).\n4. Diskusi pemantik tentang ${data.materi}.`;
    
    const core = `1. Mengamati: Anak mengamati media gambar/video tentang ${data.subTema}.\n2. Menanya: Guru memancing pertanyaan tentang ${data.materi}.\n3. Mengumpulkan Informasi: Anak mengeksplorasi alat dan bahan yang disediakan.\n4. Menalar: Anak mengelompokkan benda sesuai warna/bentuk terkait tema.\n5. Mengkomunikasikan: Anak menceritakan hasil karyanya di depan kelas.`;
    
    const closing = `1. Menanyakan perasaan anak hari ini.\n2. Evaluasi kegiatan hari ini.\n3. Menginformasikan kegiatan untuk esok hari.\n4. Berdoa sesudah belajar.`;
    
    const tools = `Kertas gambar, krayon/pensil warna, gunting, lem, media gambar ${data.subTema}, alat peraga edukatif.`;

    return `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <h2 style="text-align: center; margin-bottom: 20px; text-transform: uppercase;">Rencana Pelaksanaan Pembelajaran Harian (RPPH)</h2>
        
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 14px;">
          <tr><td style="width: 150px; font-weight: bold;">Hari/Tanggal</td><td>: ${new Date(data.tanggal).toLocaleDateString("id-ID", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</td></tr>
          <tr><td style="font-weight: bold;">Kelompok Usia</td><td>: ${data.kelompokUsia}</td></tr>
          <tr><td style="font-weight: bold;">Tema / Sub Tema</td><td>: ${data.tema} / ${data.subTema}</td></tr>
          <tr><td style="font-weight: bold;">Materi</td><td>: ${data.materi}</td></tr>
        </table>

        <h3 style="border-bottom: 1px solid #ccc; padding-bottom: 5px;">A. Deskripsi Kegiatan</h3>
        <p style="text-align: justify;">${data.deskripsi}</p>

        <h3 style="border-bottom: 1px solid #ccc; padding-bottom: 5px; margin-top: 20px;">B. Tujuan & Indikator Pembelajaran</h3>
        <ul>
          ${data.indikator.map(i => `<li>${i}</li>`).join("")}
        </ul>

        <h3 style="border-bottom: 1px solid #ccc; padding-bottom: 5px; margin-top: 20px;">C. Alat dan Bahan</h3>
        <p>${tools}</p>

        <h3 style="border-bottom: 1px solid #ccc; padding-bottom: 5px; margin-top: 20px;">D. Kegiatan Pembelajaran</h3>
        
        <h4 style="margin-bottom: 5px; color: #444;">1. Kegiatan Pembukaan (+/- 30 Menit)</h4>
        <div style="white-space: pre-line; margin-bottom: 15px; margin-left: 15px;">${opening}</div>

        <h4 style="margin-bottom: 5px; color: #444;">2. Kegiatan Inti (+/- 60 Menit)</h4>
        <div style="white-space: pre-line; margin-bottom: 15px; margin-left: 15px;">${core}</div>

        <h4 style="margin-bottom: 5px; color: #444;">3. Kegiatan Penutup (+/- 30 Menit)</h4>
        <div style="white-space: pre-line; margin-bottom: 15px; margin-left: 15px;">${closing}</div>

        <h3 style="border-bottom: 1px solid #ccc; padding-bottom: 5px; margin-top: 20px;">E. Nilai Khas Sekolah (Trilogi)</h3>
        <ul>
          ${data.trilogi.map(t => `<li>${t}</li>`).join("")}
        </ul>

        <div style="margin-top: 50px; display: flex; justify-content: space-between; page-break-inside: avoid;">
          <div style="text-align: center; width: 40%;">
            <p>Mengetahui,<br/>Kepala Sekolah</p>
            <br/><br/><br/><br/>
            <p>( ........................... )</p>
          </div>
          <div style="text-align: center; width: 40%;">
            <p>Guru Kelas</p>
            <br/><br/><br/><br/>
            <p>( ........................... )</p>
          </div>
        </div>
      </div>
    `;
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    // Simulasi delay AI
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const content = generateRPPHContent(formData);
    setGeneratedContent(content);
    setActiveTab("preview");
    setIsGenerating(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!generatedContent) {
      alert("Silakan klik tombol 'Generate AI' terlebih dahulu untuk membuat konten RPPH.");
      return;
    }

    setIsGenerating(true);

    try {
      // Kita simpan generatedContent yang mungkin sudah diedit oleh guru di textarea
      // generatedContent diambil dari state

      const payload: any = {
        ...formData,
        content: generatedContent, // Simpan konten final (hasil edit guru)
        updatedAt: Timestamp.now(),
      };

      if (!editingId) {
        payload.createdAt = Timestamp.now();
      }

      if (editingId) {
        await updateDoc(doc(db, "rpph", editingId), payload);
        alert("RPPH berhasil diperbarui!");
      } else {
        await addDoc(collection(db, "rpph"), payload);
        alert("RPPH berhasil dibuat!");
      }

      setIsModalOpen(false);
      setFormData(initialFormState);
      setEditingId(null);
      setGeneratedContent("");
      fetchRPPH();
    } catch (error) {
      console.error("Error saving RPPH:", error);
      alert("Gagal menyimpan RPPH.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Hapus dokumen RPPH ini?")) return;
    try {
      await deleteDoc(doc(db, "rpph", id));
      fetchRPPH();
    } catch (error) {
      console.error("Error deleting:", error);
    }
  };

  const handleEdit = (item: RPPH) => {
    const selectedUsia = usiaList.find(u => u.usia === item.kelompokUsia);
    setEditingId(item.id);
    setFormData({
      tanggal: item.tanggal,
      tema: item.tema,
      subTema: item.subTema,
      materi: item.materi,
      deskripsi: item.deskripsi,
      kelas: item.kelas,
      kelompokUsia: item.kelompokUsia,
      kelompokUsiaId: selectedUsia ? selectedUsia.id : "",
      tahapPerkembangan: item.tahapPerkembangan,
      indikator: item.indikator,
      trilogi: item.trilogi,
    });
    setGeneratedContent(item.content); // Load konten yang sudah ada untuk diedit
    setActiveTab("preview");
    setIsModalOpen(true);
  };

  const handlePrint = (content: string) => {
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Cetak RPPH</title>
            <style>
              body { padding: 20px; font-family: sans-serif; }
              @media print {
                @page { margin: 2cm; }
              }
            </style>
          </head>
          <body>
            ${content}
            <script>
              window.onload = function() { window.print(); }
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">Generator RPPH (AI)</h1>
        <button
          onClick={() => {
            setEditingId(null);
            setFormData(initialFormState);
            setGeneratedContent("");
            setActiveTab("preview");
            setIsModalOpen(true);
          }}
          className="bg-[#581c87] text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-[#45156b] transition shadow-lg shadow-purple-200"
        >
          <Sparkles className="w-4 h-4" /> Buat RPPH Baru
        </button>
      </div>

      {/* Table List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50 text-gray-900 font-semibold border-b">
              <tr>
                <th className="p-4 w-12">No</th>
                <th className="p-4">Tanggal</th>
                <th className="p-4">Tema / Sub Tema</th>
                <th className="p-4">Kelas</th>
                <th className="p-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-[#581c87]" />
                  </td>
                </tr>
              ) : rpphList.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-500">
                    Belum ada dokumen RPPH. Klik "Buat RPPH Baru" untuk memulai.
                  </td>
                </tr>
              ) : (
                rpphList.map((item, index) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="p-4 text-center">{index + 1}</td>
                    <td className="p-4">{item.tanggal}</td>
                    <td className="p-4">
                      <div className="font-medium text-gray-900">{item.tema}</div>
                      <div className="text-xs text-gray-500">{item.subTema}</div>
                    </td>
                    <td className="p-4">{item.kelas}</td>
                    <td className="p-4 flex justify-center gap-2">
                      <button
                        onClick={() => handlePrint(item.content)}
                        className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition"
                        title="Download PDF / Print"
                      >
                        <Printer className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleEdit(item)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                        title="Edit Data"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
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

      {/* Modal Form */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl my-8 flex flex-col max-h-[90vh]">
            <div className="p-4 border-b flex justify-between items-center bg-gray-50 sticky top-0 z-10 rounded-t-xl">
              <h3 className="font-bold text-gray-800 flex items-center gap-2">
                {editingId ? <Pencil className="w-4 h-4" /> : <Sparkles className="w-4 h-4 text-[#581c87]" />}
                {editingId ? "Edit Data RPPH" : "Generator RPPH AI"}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto">
              {/* Baris 1 */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Tanggal Kegiatan</label>
                  <input
                    required
                    type="date"
                    className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-[#581c87] outline-none"
                    value={formData.tanggal}
                    onChange={(e) => setFormData({ ...formData, tanggal: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Kelas</label>
                  <select
                    required
                    className="w-full border rounded-lg p-2 text-sm bg-white focus:ring-2 focus:ring-[#581c87] outline-none"
                    value={formData.kelas}
                    onChange={(e) => setFormData({ ...formData, kelas: e.target.value })}
                  >
                    <option value="">Pilih Kelas</option>
                    {kelasList.map((k) => (
                      <option key={k.id} value={k.namaKelas}>{k.namaKelas}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Kelompok Usia</label>
                  <select
                    required
                    className="w-full border rounded-lg p-2 text-sm bg-white focus:ring-2 focus:ring-[#581c87] outline-none"
                    value={formData.kelompokUsiaId}
                    onChange={(e) => {
                      const selected = usiaList.find((u) => u.id === e.target.value);
                      setFormData({
                        ...formData,
                        kelompokUsiaId: e.target.value,
                        kelompokUsia: selected?.usia || "",
                        tahapPerkembangan: [], // Reset tahap perkembangan jika usia berubah
                      });
                    }}
                  >
                    <option value="">Pilih Usia</option>
                    {usiaList.map((u) => (
                      <option key={u.id} value={u.id}>{u.usia}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Baris 2 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Tema</label>
                  <input
                    required
                    type="text"
                    className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-[#581c87] outline-none"
                    placeholder="Contoh: Alam Semesta"
                    value={formData.tema}
                    onChange={(e) => setFormData({ ...formData, tema: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Sub Tema</label>
                  <input
                    required
                    type="text"
                    className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-[#581c87] outline-none"
                    placeholder="Contoh: Benda Langit"
                    value={formData.subTema}
                    onChange={(e) => setFormData({ ...formData, subTema: e.target.value })}
                  />
                </div>
              </div>

              {/* Materi & Deskripsi */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Materi Pembelajaran</label>
                <input
                  required
                  type="text"
                  className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-[#581c87] outline-none"
                  placeholder="Contoh: Mengenal matahari, bulan, dan bintang"
                  value={formData.materi}
                  onChange={(e) => setFormData({ ...formData, materi: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Deskripsi Singkat Kegiatan</label>
                <textarea
                  required
                  rows={3}
                  className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-[#581c87] outline-none"
                  placeholder="Jelaskan secara singkat alur kegiatan..."
                  value={formData.deskripsi}
                  onChange={(e) => setFormData({ ...formData, deskripsi: e.target.value })}
                />
              </div>

              {/* Multi Select Sections */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 border-t pt-4">
                {/* Tahap Perkembangan */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-gray-800">Tahap Perkembangan (STPPA)</label>
                  <div className="h-40 overflow-y-auto border rounded-lg p-2 bg-gray-50 text-sm">
                    {tahapList.length === 0 ? (
                      <p className="text-xs text-gray-400 italic p-2">Pilih Kelompok Usia terlebih dahulu.</p>
                    ) : (
                      tahapList.map((item) => (
                        <div key={item.id} className="flex items-start gap-2 mb-2 cursor-pointer" onClick={() => handleMultiSelect("tahapPerkembangan", item.deskripsi)}>
                          {formData.tahapPerkembangan.includes(item.deskripsi) ? (
                            <CheckSquare className="w-4 h-4 text-[#581c87] mt-0.5 shrink-0" />
                          ) : (
                            <Square className="w-4 h-4 text-gray-300 mt-0.5 shrink-0" />
                          )}
                          <span className="text-xs text-gray-700">{item.lingkup} - {item.deskripsi}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Indikator */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-gray-800">Indikator Pembelajaran</label>
                  <div className="h-40 overflow-y-auto border rounded-lg p-2 bg-gray-50 text-sm">
                    {indikatorList.map((item) => (
                      <div key={item.id} className="flex items-start gap-2 mb-2 cursor-pointer" onClick={() => handleMultiSelect("indikator", item.deskripsi)}>
                        {formData.indikator.includes(item.deskripsi) ? (
                          <CheckSquare className="w-4 h-4 text-[#581c87] mt-0.5 shrink-0" />
                        ) : (
                          <Square className="w-4 h-4 text-gray-300 mt-0.5 shrink-0" />
                        )}
                        <span className="text-xs text-gray-700">{item.kode} - {item.deskripsi}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Trilogi */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-gray-800">Trilogi Mainriang</label>
                  <div className="h-40 overflow-y-auto border rounded-lg p-2 bg-gray-50 text-sm">
                    {trilogiList.map((item) => (
                      <div key={item.id} className="flex items-start gap-2 mb-2 cursor-pointer" onClick={() => handleMultiSelect("trilogi", item.deskripsi)}>
                        {formData.trilogi.includes(item.deskripsi) ? (
                          <CheckSquare className="w-4 h-4 text-[#581c87] mt-0.5 shrink-0" />
                        ) : (
                          <Square className="w-4 h-4 text-gray-300 mt-0.5 shrink-0" />
                        )}
                        <span className="text-xs text-gray-700">{item.kode} - {item.deskripsi}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Section Editor Hasil AI */}
              {generatedContent && (
                <div className="border-t pt-4 space-y-2">
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex gap-2 bg-gray-100 p-1 rounded-lg">
                      <button
                        type="button"
                        onClick={() => setActiveTab("preview")}
                        className={`px-3 py-1 text-xs font-medium rounded-md transition flex items-center gap-1 ${
                          activeTab === "preview"
                            ? "bg-white text-[#581c87] shadow-sm"
                            : "text-gray-500 hover:text-gray-700"
                        }`}
                      >
                        <Eye className="w-3 h-3" /> Tampilan Visual
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab("html")}
                        className={`px-3 py-1 text-xs font-medium rounded-md transition flex items-center gap-1 ${
                          activeTab === "html"
                            ? "bg-white text-[#581c87] shadow-sm"
                            : "text-gray-500 hover:text-gray-700"
                        }`}
                      >
                        <Code className="w-3 h-3" /> Kode HTML
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={handleGenerate}
                      className="text-xs flex items-center gap-1 text-[#581c87] hover:underline"
                    >
                      <RefreshCw className="w-3 h-3" /> Buat Ulang (Regenerate)
                    </button>
                  </div>

                  {activeTab === "preview" ? (
                    <div className="space-y-2">
                      <p className="text-xs text-blue-600 flex items-center gap-1 bg-blue-50 p-2 rounded border border-blue-100">
                        <Sparkles className="w-3 h-3" />
                        <strong>Tips:</strong> Anda bisa langsung mengklik dan mengetik pada tampilan di bawah ini untuk mengedit isinya.
                      </p>
                      <div
                        className="w-full border rounded-lg p-8 text-sm bg-white min-h-[400px] focus:ring-2 focus:ring-[#581c87] outline-none shadow-inner overflow-y-auto max-h-[500px]"
                        contentEditable
                        suppressContentEditableWarning
                        dangerouslySetInnerHTML={{ __html: generatedContent }}
                        onBlur={(e) => setGeneratedContent(e.currentTarget.innerHTML)}
                        style={{ fontFamily: "Arial, sans-serif", lineHeight: "1.6" }}
                      />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-xs text-gray-500">
                        Mode edit kode HTML untuk penyesuaian struktur tingkat lanjut.
                      </p>
                      <textarea
                        rows={15}
                        className="w-full border rounded-lg p-4 text-sm font-mono bg-gray-50 focus:ring-2 focus:ring-[#581c87] outline-none"
                        value={generatedContent}
                        onChange={(e) => setGeneratedContent(e.target.value)}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Footer Actions */}
              <div className="pt-4 border-t flex justify-end gap-3 sticky bottom-0 bg-white pb-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium"
                >
                  Batal
                </button>
                
                {!generatedContent ? (
                  <button
                    type="button"
                    onClick={handleGenerate}
                    disabled={isGenerating}
                    className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition text-sm font-medium flex items-center gap-2 disabled:opacity-70"
                  >
                    {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    Generate AI
                  </button>
                ) : (
                <button
                  type="submit"
                  disabled={isGenerating}
                  className="bg-[#581c87] text-white px-6 py-2 rounded-lg hover:bg-[#45156b] transition text-sm font-medium flex items-center gap-2 disabled:opacity-70"
                >
                  {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Simpan RPPH
                </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}