"use client";

import { useState, useEffect, useRef } from "react";
import { db, storage, auth } from "@/lib/firebase";
import {
  collection,
  query,
  orderBy,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  updateDoc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import {
  FileText,
  Eye,
  Download,
  Pencil,
  Trash2,
  Plus,
  X,
  Loader2,
  Save,
  UploadCloud,
} from "lucide-react";

interface Dokumen {
  id: string;
  nama: string;
  url: string;
  storagePath: string;
  createdAt: any;
}

export default function DokumenPage() {
  const [dokumenList, setDokumenList] = useState<Dokumen[]>([]);
  const [loading, setLoading] = useState(true);
  
  // State untuk Modal Tambah/Edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ nama: "" });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State untuk Modal View PDF
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedDocUrl, setSelectedDocUrl] = useState<string>("");
  const [selectedDocName, setSelectedDocName] = useState<string>("");

  // Fetch Data
  const fetchDokumen = async () => {
    setLoading(true);
    try {
      const q = query(
        collection(db, "dokumen_sekolah"),
        orderBy("createdAt", "desc")
      );
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Dokumen[];
      setDokumenList(data);
    } catch (error) {
      console.error("Error fetching documents:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDokumen();
  }, []);

  // Handle File Select
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.type !== "application/pdf") {
        alert("Mohon upload file berformat PDF.");
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
      setSelectedFile(file);
    }
  };

  // Handle Submit (Add/Edit)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!auth.currentUser) {
      alert("Sesi Anda telah berakhir. Silakan login ulang.");
      return;
    }

    if (!formData.nama) return alert("Nama dokumen wajib diisi.");
    if (!editingId && !selectedFile) return alert("Silakan pilih file PDF.");

    setIsUploading(true);
    try {
      let url = "";
      let storagePath = "";

      // Jika ada file baru yang dipilih (untuk Add atau Edit replace file)
      if (selectedFile) {
        // 1. Upload File ke Firebase Storage
        const fileName = `${Date.now()}_${selectedFile.name}`;
        storagePath = `dokumen_sekolah/${fileName}`;
        const storageRef = ref(storage, storagePath);
        
        await uploadBytes(storageRef, selectedFile);
        url = await getDownloadURL(storageRef);

        // Jika sedang Edit dan upload file baru, hapus file lama
        if (editingId) {
          const oldDoc = dokumenList.find((d) => d.id === editingId);
          if (oldDoc?.storagePath) {
            const oldRef = ref(storage, oldDoc.storagePath);
            await deleteObject(oldRef).catch((err) => console.log("Old file not found", err));
          }
        }
      }

      // 2. Simpan Metadata ke Firestore
      if (editingId) {
        const updateData: any = {
          nama: formData.nama,
          updatedAt: serverTimestamp(),
        };
        if (url) {
          updateData.url = url;
          updateData.storagePath = storagePath;
        }
        await updateDoc(doc(db, "dokumen_sekolah", editingId), updateData);
        alert("Dokumen berhasil diperbarui!");
      } else {
        await addDoc(collection(db, "dokumen_sekolah"), {
          nama: formData.nama,
          url,
          storagePath,
          createdAt: serverTimestamp(),
        });
        alert("Dokumen berhasil diupload!");
      }

      handleCloseModal();
      fetchDokumen();
    } catch (error) {
      console.error("Error uploading:", error);
      alert("Gagal menyimpan dokumen.");
    } finally {
      setIsUploading(false);
    }
  };

  // Handle Delete
  const handleDelete = async (item: Dokumen) => {
    if (!confirm(`Yakin ingin menghapus dokumen "${item.nama}"?`)) return;

    try {
      // 1. Hapus file dari Storage
      if (item.storagePath) {
        const storageRef = ref(storage, item.storagePath);
        await deleteObject(storageRef).catch((err) => console.log("File storage not found", err));
      }

      // 2. Hapus data dari Firestore
      await deleteDoc(doc(db, "dokumen_sekolah", item.id));
      
      setDokumenList((prev) => prev.filter((d) => d.id !== item.id));
      alert("Dokumen berhasil dihapus.");
    } catch (error) {
      console.error("Error deleting:", error);
      alert("Gagal menghapus dokumen.");
    }
  };

  const handleEdit = (item: Dokumen) => {
    setEditingId(item.id);
    setFormData({ nama: item.nama });
    setSelectedFile(null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setFormData({ nama: "" });
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleView = (item: Dokumen) => {
    setSelectedDocUrl(item.url);
    setSelectedDocName(item.nama);
    setIsViewModalOpen(true);
  };

  // Format Tanggal
  const formatDate = (timestamp: any) => {
    if (!timestamp) return "-";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return new Intl.DateTimeFormat("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(date);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Dokumen Sekolah</h1>
          <p className="text-gray-500 text-sm">Kelola arsip dan dokumen digital sekolah (PDF).</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-[#581c87] text-white px-4 py-2 rounded-lg hover:bg-[#45156b] transition flex items-center gap-2 shadow-lg shadow-purple-200"
        >
          <Plus className="w-4 h-4" />
          Tambah Dokumen
        </button>
      </div>

      {/* Tabel Dokumen */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50 text-gray-900 font-semibold border-b">
              <tr>
                <th className="p-4 w-12 text-center">No</th>
                <th className="p-4">Nama Dokumen</th>
                <th className="p-4 w-48">Tanggal Upload</th>
                <th className="p-4 w-48 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-[#581c87]" />
                  </td>
                </tr>
              ) : dokumenList.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-gray-500 italic">
                    Belum ada dokumen yang diupload.
                  </td>
                </tr>
              ) : (
                dokumenList.map((doc, index) => (
                  <tr key={doc.id} className="hover:bg-gray-50 transition">
                    <td className="p-4 text-center">{index + 1}</td>
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="bg-red-50 p-2 rounded-lg text-red-600">
                          <FileText className="w-5 h-5" />
                        </div>
                        <span className="font-medium text-gray-800">{doc.nama}</span>
                      </div>
                    </td>
                    <td className="p-4">{formatDate(doc.createdAt)}</td>
                    <td className="p-4">
                      <div className="flex justify-center items-center gap-2">
                        <button onClick={() => handleView(doc)} className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition" title="Lihat">
                          <Eye className="w-4 h-4" />
                        </button>
                        <a href={doc.url} target="_blank" rel="noopener noreferrer" className="p-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition" title="Download">
                          <Download className="w-4 h-4" />
                        </a>
                        <button onClick={() => handleEdit(doc)} className="p-2 bg-orange-50 text-orange-600 rounded-lg hover:bg-orange-100 transition" title="Edit">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(doc)} className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition" title="Hapus">
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

      {/* Modal Tambah/Edit */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-xl">
              <h3 className="font-bold text-gray-800">{editingId ? "Edit Dokumen" : "Upload Dokumen Baru"}</h3>
              <button onClick={handleCloseModal} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nama Dokumen</label>
                <input
                  type="text"
                  required
                  className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#581c87] outline-none"
                  placeholder="Contoh: Kalender Akademik 2024"
                  value={formData.nama}
                  onChange={(e) => setFormData({ ...formData, nama: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">File PDF</label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:bg-gray-50 transition cursor-pointer relative">
                  <input
                    type="file"
                    accept="application/pdf"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    disabled={isUploading}
                  />
                  <div className="flex flex-col items-center gap-2 text-gray-500">
                    <UploadCloud className="w-8 h-8 text-[#581c87]" />
                    <span className="text-sm">{selectedFile ? selectedFile.name : "Klik untuk pilih file PDF"}</span>
                  </div>
                </div>
                {editingId && !selectedFile && <p className="text-xs text-gray-400 mt-1">*Biarkan kosong jika tidak ingin mengganti file.</p>}
              </div>
              <button
                type="submit"
                disabled={isUploading}
                className="w-full bg-[#581c87] text-white py-2 rounded-lg hover:bg-[#45156b] transition font-medium flex justify-center items-center gap-2 disabled:opacity-70"
              >
                {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {isUploading ? "Mengupload..." : "Simpan Dokumen"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal View PDF */}
      {isViewModalOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col">
            <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-xl">
              <h3 className="font-bold text-gray-800 flex items-center gap-2">
                <FileText className="w-4 h-4 text-red-600" /> {selectedDocName}
              </h3>
              <button onClick={() => setIsViewModalOpen(false)} className="text-gray-500 hover:text-gray-800 bg-gray-200 p-1 rounded-full">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 bg-gray-100 p-1">
              <iframe
                src={selectedDocUrl}
                className="w-full h-full rounded-b-lg border-none"
                title="PDF Viewer"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}