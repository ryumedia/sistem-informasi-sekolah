"use client";

import { useState, useEffect, useId } from "react";
import { db, firebaseConfig, auth } from "@/lib/firebase";
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy, where } from "firebase/firestore";
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, onAuthStateChanged } from "firebase/auth";
import { Plus, X, Pencil, Trash2, Lock, Search, Eye, Upload } from "lucide-react";
import Image from "next/image";

interface Guru {
  id: string;
  nama: string;
  email: string;
  role: string;
  status: string;
  uid?: string;
  cabang?: string;
  niy?: string;
  tempatLahir?: string;
  tanggalLahir?: string;
  noKtp?: string;
  alamat?: string;
  lulusan?: string;
  tmtMengajar?: string;
  tstMengajar?: string;
  jabatan?: string;
  fotoUrl?: string;
  tandaTangan?: string; // base64
}

const initialFormData = {
  nama: "",
  email: "",
  password: "",
  role: "Guru",
  cabang: "",
  status: "Aktif",
  niy: "",
  tempatLahir: "",
  tanggalLahir: "",
  noKtp: "",
  alamat: "",
  lulusan: "",
  tmtMengajar: "",
  tstMengajar: "",
  jabatan: "",
  fotoUrl: "",
  tandaTangan: "",
};

export default function DataGuruPage() {
  const [guruList, setGuruList] = useState<Guru[]>([]);
  const [cabangList, setCabangList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedGuruDetail, setSelectedGuruDetail] = useState<Guru | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCabang, setFilterCabang] = useState("");
  const [userRole, setUserRole] = useState<string>("");
  const [formData, setFormData] = useState<typeof initialFormData>(initialFormData);
  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [fotoPreviewUrl, setFotoPreviewUrl] = useState<string | null>(null);

  // --- Data Fetching Effects ---
  const fetchGuru = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, "guru"), orderBy("nama", "asc"));
      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Guru[];
      setGuruList(data);
    } catch (error) {
      console.error("Error fetching guru:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGuru();
    const fetchCabang = async () => {
      try {
        const q = query(collection(db, "cabang"), orderBy("nama", "asc"));
        const querySnapshot = await getDocs(q);
        setCabangList(querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      } catch (error) {
        console.error("Error fetching cabang:", error);
      }
    };
    fetchCabang();
  }, []);

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
              setFilterCabang(userData.cabang as string);
            }
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
        }
      }
    });
    return () => unsubscribe();
  }, []);
  
  // Effect for creating and revoking photo preview URL to prevent memory leaks
  useEffect(() => {
    if (fotoFile) {
        const url = URL.createObjectURL(fotoFile);
        setFotoPreviewUrl(url);
        return () => URL.revokeObjectURL(url);
    }
  }, [fotoFile]);


  // --- Form & Modal Handlers ---
  const handleFileChange = (setter: (file: File | null) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setter(e.target.files[0]);
    } else {
      setter(null);
    }
  };

  const handleTandaTanganChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, tandaTangan: reader.result as string }));
      };
      reader.readAsDataURL(file);
    } else {
       setFormData(prev => ({ ...prev, tandaTangan: "" }));
    }
  };

  const openAddModal = () => {
    setEditId(null);
    setFormData(initialFormData);
    setIsModalOpen(true);
  };
  
  const handleEdit = (guru: Guru) => {
    setEditId(guru.id);
    setFormData({ ...initialFormData, ...guru, password: "" });
    setIsModalOpen(true);
  };
  
  const handleDetail = (guru: Guru) => {
    setSelectedGuruDetail(guru);
    setIsDetailModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setIsDetailModalOpen(false);
    setEditId(null);
    setSelectedGuruDetail(null);
    setFotoFile(null);
    setFotoPreviewUrl(null);
    // Reset form data only when closing the main modal
    if(isModalOpen) setFormData(initialFormData);
  };

  // --- CRUD Functions ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    let submissionData = { ...formData };

    try {
      // 1. Handle Foto Upload to Firebase Storage
      if (fotoFile) {
        const storage = getStorage();
        const storageRef = ref(storage, `guru_fotos/${Date.now()}_${fotoFile.name}`);
        await uploadBytes(storageRef, fotoFile);
        submissionData.fotoUrl = await getDownloadURL(storageRef);
      }

      // 2. Handle Firestore Document (Add/Update)
      if (editId) { // --- UPDATE ---
        const currentGuru = guruList.find(g => g.id === editId);
        // Update auth email if changed
        if (currentGuru && currentGuru.uid && currentGuru.email !== submissionData.email) {
           const res = await fetch('/api/admin/update-user', {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ uid: currentGuru.uid, email: submissionData.email })
           });
           if (!res.ok) throw new Error(await res.json().then(d => d.error || "Gagal update email"));
        }

        const docRef = doc(db, "guru", editId);
        const { password, ...updateData } = submissionData;
        await updateDoc(docRef, updateData);
        alert("Berhasil memperbarui data guru!");
      } else { // --- CREATE ---
        // Create user in Firebase Auth
        const secondaryApp = initializeApp(firebaseConfig, "Secondary");
        const secondaryAuth = getAuth(secondaryApp);
        const userCredential = await createUserWithEmailAndPassword(secondaryAuth, submissionData.email, submissionData.password);
        await deleteApp(secondaryApp);

        // Add user data to Firestore
        await addDoc(collection(db, "guru"), {
          ...submissionData,
          uid: userCredential.user.uid,
          createdAt: new Date(),
        });
        
        alert(`Berhasil menambahkan guru baru!\nEmail: ${submissionData.email}\nPassword: ${submissionData.password}`);
      }
      
      closeModal();
      fetchGuru();
    } catch (error: any) {
      console.error("Error saving document: ", error);
      alert(error.message || "Gagal menyimpan data.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Apakah Anda yakin ingin menghapus data ini dan semua informasi terkait?")) {
      try {
        const guruToDelete = guruList.find(g => g.id === id);
        
        // 1. Delete photo from storage if it exists
        if (guruToDelete?.fotoUrl) {
            try {
                const storage = getStorage();
                const photoRef = ref(storage, guruToDelete.fotoUrl);
                await deleteObject(photoRef);
            } catch (storageError: any) {
                // Log error but don't block deletion if photo not found
                if (storageError.code !== 'storage/object-not-found') {
                    console.error("Error deleting photo from storage:", storageError);
                }
            }
        }

        // 2. Delete user from Firebase Auth via API
        if (guruToDelete) {
            await fetch('/api/admin/delete-user', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ uid: guruToDelete.uid, email: guruToDelete.email })
            });
        }
        
        // 3. Delete document from Firestore
        await deleteDoc(doc(db, "guru", id));
        alert("Data berhasil dihapus.");
        fetchGuru();
      } catch (error) {
        console.error("Error deleting: ", error);
        alert("Gagal menghapus data.");
      }
    }
  };

  // --- Filtering & Rendering ---
  const filteredGuruList = guruList.filter((guru) => {
    const matchesSearch = guru.nama.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          guru.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCabang = filterCabang ? guru.cabang === filterCabang : true;
    return matchesSearch && matchesCabang;
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">Data Guru & Staff</h1>
        <button onClick={openAddModal} className="bg-[#581c87] text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-[#45156b] transition">
          <Plus className="w-4 h-4" /> Tambah Guru
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col md:flex-row gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Cari nama atau email guru..."
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#581c87] outline-none text-gray-900"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <select
          className={`border rounded-lg px-4 py-2 bg-white focus:ring-2 focus:ring-[#581c87] outline-none min-w-[200px] text-gray-900 ${userRole === "Kepala Sekolah" ? "bg-gray-100 cursor-not-allowed" : ""}`}
          value={filterCabang}
          onChange={(e) => setFilterCabang(e.target.value)}
          disabled={userRole === "Kepala Sekolah"}
        >
          {userRole !== "Kepala Sekolah" && <option value="">Semua Cabang</option>}
          {cabangList.map((c) => <option key={c.id} value={c.nama}>{c.nama}</option>)}
        </select>
      </div>

      {/* Teachers Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600 min-w-[900px]">
            <thead className="bg-gray-50 text-gray-900 font-semibold border-b">
              <tr>
                <th className="p-4 w-16 text-center">No</th>
                <th className="p-4">Nama Lengkap</th>
                <th className="p-4">Email</th>
                <th className="p-4">Role</th>
                <th className="p-4">Cabang</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={7} className="p-8 text-center">Memuat data...</td></tr>
              ) : filteredGuruList.length === 0 ? (
                <tr><td colSpan={7} className="p-8 text-center">Data tidak ditemukan.</td></tr>
              ) : (
                filteredGuruList.map((guru, index) => (
                  <tr key={guru.id} className="hover:bg-gray-50">
                    <td className="p-4 text-center">{index + 1}</td>
                    <td className="p-4 font-medium text-gray-900">{guru.nama}</td>
                    <td className="p-4">{guru.email}</td>
                    <td className="p-4"><span className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs font-medium border border-gray-200">{guru.role}</span></td>
                    <td className="p-4 text-gray-600">{guru.cabang || "-"}</td>
                    <td className="p-4"><span className={`px-2 py-1 rounded-full text-xs font-medium ${guru.status === 'Aktif' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{guru.status}</span></td>
                    <td className="p-4 flex gap-2 justify-center">
                      <button onClick={() => handleDetail(guru)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition" title="Lihat Detail"><Eye className="w-4 h-4" /></button>
                      <button onClick={() => handleEdit(guru)} className="p-2 text-[#581c87] hover:bg-[#581c87]/10 rounded-lg transition" title="Edit"><Pencil className="w-4 h-4" /></button>
                      <button onClick={() => handleDelete(guru.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition" title="Hapus"><Trash2 className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl">
            <div className="p-4 border-b flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-gray-800">{editId ? "Edit Data Guru" : "Tambah Guru Baru"}</h3>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <InputGroup label="Nama Lengkap" required value={formData.nama} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({...formData, nama: e.target.value})} />
                <InputGroup label="Email" type="email" required value={formData.email} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({...formData, email: e.target.value})} />
              </div>
              
              {!editId && <InputGroup label="Password (Login)" type="text" required minLength={6} placeholder="Min. 6 karakter" icon={<Lock/>} value={formData.password} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({...formData, password: e.target.value})} />}
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <InputGroup label="NIY" value={formData.niy} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({...formData, niy: e.target.value})} />
                <InputGroup label="No. KTP" value={formData.noKtp} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({...formData, noKtp: e.target.value})} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <InputGroup label="Tempat Lahir" value={formData.tempatLahir} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({...formData, tempatLahir: e.target.value})} />
                <InputGroup label="Tanggal Lahir" type="date" value={formData.tanggalLahir} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({...formData, tanggalLahir: e.target.value})} />
              </div>

              <InputGroup label="Alamat" as="textarea" value={formData.alamat} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData({...formData, alamat: e.target.value})} />
              <InputGroup label="Lulusan" value={formData.lulusan} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({...formData, lulusan: e.target.value})} />
              <InputGroup label="Jabatan" value={formData.jabatan} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({...formData, jabatan: e.target.value})} />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <InputGroup label="TMT Mengajar" type="date" value={formData.tmtMengajar} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({...formData, tmtMengajar: e.target.value})} />
                <InputGroup label="TST Mengajar" type="date" value={formData.tstMengajar} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({...formData, tstMengajar: e.target.value})} />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <SelectGroup label="Cabang Sekolah" value={formData.cabang} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormData({...formData, cabang: e.target.value})}>
                  <option value="">Pilih Cabang</option>
                  {cabangList.map(c => <option key={c.id} value={c.nama}>{c.nama}</option>)}
                </SelectGroup>
                <SelectGroup label="Role" value={formData.role} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormData({...formData, role: e.target.value})}>
                    <option value="Guru">Guru</option><option value="Admin">Admin</option><option value="Kepala Sekolah">Kepala Sekolah</option><option value="Direktur">Direktur</option><option value="Yayasan">Yayasan</option><option value="Caregiver">Caregiver</option><option value="Asisten Guru">Asisten Guru</option>
                </SelectGroup>
                <SelectGroup label="Status" value={formData.status} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormData({...formData, status: e.target.value})}>
                  <option value="Aktif">Aktif</option><option value="Nonaktif">Nonaktif</option>
                </SelectGroup>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FileUploadGroup label="Upload Foto" onChange={handleFileChange(setFotoFile)} previewUrl={fotoPreviewUrl ?? formData.fotoUrl} alt="Preview Foto Guru" />
                <FileUploadGroup label="Upload Tanda Tangan" onChange={handleTandaTanganChange} previewUrl={formData.tandaTangan} isSignature alt="Preview Tanda Tangan" />
              </div>

              <button disabled={submitting} type="submit" className="w-full bg-[#581c87] text-white py-2.5 rounded-lg hover:bg-[#45156b] transition font-semibold mt-4">
                {submitting ? "Menyimpan..." : "Simpan Data"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {isDetailModalOpen && selectedGuruDetail && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl">
                <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                    <h3 className="font-bold text-gray-800">Detail Guru: {selectedGuruDetail.nama}</h3>
                    <button onClick={closeModal} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
                </div>
                <div className="p-6 max-h-[80vh] overflow-y-auto space-y-4">
                    {selectedGuruDetail.fotoUrl && (
                        <div className="flex justify-center mb-4">
                            <Image src={selectedGuruDetail.fotoUrl} alt={`Foto ${selectedGuruDetail.nama}`} width={128} height={128} className="rounded-full object-cover w-32 h-32 border-4 border-gray-200" />
                        </div>
                    )}
                    <DetailItem label="Nama Lengkap" value={selectedGuruDetail.nama} />
                    <DetailItem label="Email" value={selectedGuruDetail.email} />
                    <DetailItem label="NIY" value={selectedGuruDetail.niy} />
                    <DetailItem label="No. KTP" value={selectedGuruDetail.noKtp} />
                    <DetailItem label="Tempat, Tanggal Lahir" value={formatTempatTanggalLahir(selectedGuruDetail.tempatLahir, selectedGuruDetail.tanggalLahir)} />
                    <DetailItem label="Alamat" value={selectedGuruDetail.alamat} />
                    <DetailItem label="Lulusan" value={selectedGuruDetail.lulusan} />
                    <DetailItem label="Jabatan" value={selectedGuruDetail.jabatan} />
                    <DetailItem label="TMT Mengajar" value={formatDate(selectedGuruDetail.tmtMengajar)} />
                    <DetailItem label="TST Mengajar" value={formatDate(selectedGuruDetail.tstMengajar)} />
                    <DetailItem label="Cabang" value={selectedGuruDetail.cabang} />
                    <DetailItem label="Role" value={selectedGuruDetail.role} />
                    <DetailItem label="Status" value={selectedGuruDetail.status} />
                    {selectedGuruDetail.tandaTangan && (
                        <div>
                            <p className="block text-sm font-medium text-gray-500">Tanda Tangan</p>
                            <div className="mt-1 p-2 border rounded-lg bg-gray-50 flex justify-center">
                                <Image src={selectedGuruDetail.tandaTangan} alt={`Tanda Tangan ${selectedGuruDetail.nama}`} width={200} height={100} className="object-contain" />
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
      )}
    </div>
  );
}

// --- Helper Components & Functions ---

interface InputGroupProps extends React.InputHTMLAttributes<HTMLInputElement | HTMLTextAreaElement> {
    label: string;
    as?: 'input' | 'textarea';
    icon?: React.ReactNode;
}
const InputGroup = ({ label, as = 'input', icon, ...props }: InputGroupProps) => {
    const id = useId();
    return (
        <div>
            <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">{label}{props.required && <span className="text-red-500">*</span>}</label>
            <div className="relative">
                {icon && <div className="absolute left-3 top-2.5 h-4 w-4 text-gray-400 pointer-events-none">{icon}</div>}
                {as === 'textarea' ? (
                    <textarea id={id} {...props} rows={3} className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#581c87] outline-none text-gray-900" />
                ) : (
                    <input id={id} {...props} className={`w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#581c87] outline-none text-gray-900 ${icon ? 'pl-9' : ''}`} />
                )}
            </div>
        </div>
    );
};

interface SelectGroupProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
    label: string;
}
const SelectGroup = ({ label, children, ...props }: SelectGroupProps) => {
    const id = useId();
    return (
        <div>
            <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
            <select id={id} {...props} className="w-full border rounded-lg p-2 bg-white focus:ring-2 focus:ring-[#581c87] outline-none text-gray-900">{children}</select>
        </div>
    );
};

interface FileUploadGroupProps {
    label: string;
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
    previewUrl?: string | null;
    isSignature?: boolean;
    alt: string;
}
const FileUploadGroup = ({ label, onChange, previewUrl, isSignature = false, alt }: FileUploadGroupProps) => {
    const id = useId();
    return (
        <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
            <div className="mt-1 flex items-center gap-4">
                {previewUrl ? (
                    <div className={`shrink-0 ${isSignature ? 'w-32 h-16' : 'w-16 h-16'}`}>
                        <Image src={previewUrl} alt={alt} width={isSignature ? 128 : 64} height={64} className={`object-contain ${isSignature ? '' : 'rounded-full'} w-full h-full bg-gray-100`} />
                    </div>
                ) : (
                   <div className={`flex items-center justify-center text-gray-400 bg-gray-100 ${isSignature ? 'w-32 h-16 rounded-md' : 'w-16 h-16 rounded-full'}`}><Upload className="w-6 h-6" /></div>
                )}
                <label htmlFor={id} className="cursor-pointer bg-white rounded-md border border-gray-300 py-2 px-3 text-sm font-medium text-gray-700 hover:bg-gray-50">
                    <span>{previewUrl ? 'Ganti' : 'Pilih File'}</span>
                    <input id={id} type="file" className="sr-only" onChange={onChange} accept="image/*" />
                </label>
            </div>
        </div>
    );
};

interface DetailItemProps {
    label: string;
    value?: string | null;
}
const DetailItem = ({ label, value }: DetailItemProps) => (
    (value && value.trim() !== '' && value.trim() !== ',') ? (
        <div>
            <p className="block text-sm font-medium text-gray-500">{label}</p>
            <p className="text-gray-900 font-medium">{value}</p>
        </div>
    ) : null
);

const formatDate = (dateString?: string | null) => {
    if (!dateString) return null;
    try {
        return new Date(dateString).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric'});
    } catch {
        return dateString;
    }
};

const formatTempatTanggalLahir = (tempat?: string | null, tanggal?: string | null) => {
    const parts = [];
    if (tempat) parts.push(tempat);
    if (tanggal) parts.push(formatDate(tanggal));
    return parts.join(', ');
};