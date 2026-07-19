// src/components/dashboard/EditProfileModal.tsx
import { useState, useEffect } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { X, Save, Loader2 } from "lucide-react";

interface EditProfileModalProps {
  user: any;
  userData: any;
  onClose: () => void;
  onProfileUpdate: () => void;
}

interface FormField {
  label: string;
  name: string;
  type?: 'text' | 'number' | 'date' | 'select' | 'textarea';
  options?: string[];
}

export default function EditProfileModal({ user, userData, onClose, onProfileUpdate }: EditProfileModalProps) {
  const [formData, setFormData] = useState<any>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (userData) {
      setFormData(userData);
    }
  }, [userData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev: any) => ({ ...prev, [name]: value }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !userData?.id) {
      setError("Data pengguna tidak valid.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let collectionName = "";
      if (userData.role === "Siswa") collectionName = "siswa";
      else if (userData.role === "Guru") collectionName = "guru";
      else if (userData.role === "Caregiver") collectionName = "caregivers";
      else {
        // Untuk role lain seperti Admin, Kepala Sekolah, dll. kita asumsikan ada di koleksi 'guru'
        collectionName = "guru";
      }

      const userDocRef = doc(db, collectionName, userData.id);
      
      // Hanya kirim field yang diubah
      const updatedFields: { [key: string]: any } = {};
      Object.keys(formData).forEach(key => {
        if (formData[key] !== userData[key]) {
          updatedFields[key] = formData[key];
        }
      });

      if (Object.keys(updatedFields).length > 0) {
        await updateDoc(userDocRef, updatedFields);
      }
      
      onProfileUpdate(); // Panggil callback untuk refresh data di halaman utama
    } catch (err) {
      console.error("Error updating profile:", err);
      setError("Gagal menyimpan perubahan. Silakan coba lagi.");
    } finally {
      setLoading(false);
    }
  };

  const renderField = ({ label, name, type = "text", options }: FormField) => (
    <div key={name}>
      <label htmlFor={name} className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {type === "select" ? (
        <select
          id={name}
          name={name}
          value={formData[name] || ""}
          onChange={handleChange}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 text-gray-900"
        >
          {options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
        </select>
      ) : type === 'textarea' ? (
        <textarea
          id={name}
          name={name}
          value={formData[name] || ""}
          onChange={handleChange}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 text-gray-900"
        />
      ) : (
        <input
          type={type}
          id={name}
          name={name}
          value={formData[name] || ""}
          onChange={handleChange}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 text-gray-900"
        />
      )}
    </div>
  );

  const fieldsForSiswa: FormField[] = [
    { label: "Nama Siswa", name: "nama" },
    { label: "Jenis Kelamin", name: "jenisKelamin", type: "select", options: ["Laki-laki", "Perempuan"] },
    { label: "Agama", name: "agama", type: "select", options: ["Islam", "Kristen", "Katolik", "Hindu", "Buddha", "Konghucu"] },
    { label: "Tempat Lahir", name: "tempatLahir", type: "text" },
    { label: "Tanggal Lahir", name: "tanggalLahir", type: "date" },
    { label: "Nama Ayah", name: "namaAyah", type: "text" },
    { label: "Nama Ibu", name: "namaIbu", type: "text" },
    { label: "Anak Ke-", name: "anakKe", type: "number" },
    { label: "Alamat", name: "alamat", type: "textarea" },
  ]

  const fieldsForGuru: FormField[] = [
    { label: "Nama Lengkap", name: "nama" },
    { label: "NIY", name: "niy", type: "text" },
    { label: "No. KTP", name: "noKtp", type: "number" },
    { label: "Tempat Lahir", name: "tempatLahir", type: "text" },
    { label: "Tanggal Lahir", name: "tanggalLahir", type: "date" },
    { label: "Alamat", name: "alamat", type: "textarea" },
    { label: "Lulusan", name: "lulusan", type: "text" },
  ]

  const getFieldsToRender = () => {
    if (!userData) return [];
    switch (userData.role) {
      case "Siswa":
        return fieldsForSiswa;
      case "Guru":
      case "Admin":
      case "Kepala Sekolah":
      case "Direktur":
      case "Yayasan":
      case "Caregiver":
        return fieldsForGuru;
      default:
        return [];
    }
  };

  const fieldsToRender = getFieldsToRender();

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex justify-center items-center">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg flex flex-col max-h-[90vh]">
        <header className="flex justify-between items-center p-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-800">Edit Profil</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100">
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </header>

        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6">
          <div className="space-y-4">
            {fieldsToRender.map(field => renderField(field))}
            
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
        </form>

        <footer className="p-4 border-t border-gray-200 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-semibold text-sm"
          >
            Batal
          </button>
          <button
            type="submit"
            onClick={handleSave}
            disabled={loading}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-semibold text-sm flex items-center gap-2 disabled:bg-purple-300"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Menyimpan...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Simpan Perubahan
              </>
            )}
          </button>
        </footer>
      </div>
    </div>
  );
}