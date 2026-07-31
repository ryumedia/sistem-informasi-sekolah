// src/components/dashboard/EditProfileModal.tsx
import { useState, useEffect } from "react";
import { doc, updateDoc, collection, query, orderBy, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { X, Save, Loader2, Upload } from "lucide-react";

interface EditProfileModalProps {
  user: any;
  userData: any;
  onClose: () => void;
  onProfileUpdate: () => void;
}

interface MasterData {
  id: string;
  nama: string;
}

export default function EditProfileModal({ user, userData, onClose, onProfileUpdate }: EditProfileModalProps) {
  const [formData, setFormData] = useState<any>({});
  const [loading, setLoading] = useState(false);
  const [masterDataLoading, setMasterDataLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // State for master data dropdowns
  const [transportasiList, setTransportasiList] = useState<MasterData[]>([]);
  const [pendidikanList, setPendidikanList] = useState<MasterData[]>([]);
  const [pekerjaanList, setPekerjaanList] = useState<MasterData[]>([]);
  const [penghasilanList, setPenghasilanList] = useState<MasterData[]>([]);

  useEffect(() => {
    if (userData) {
      setFormData(userData);
    }

    // Fetch master data only for students
    if (userData?.role === 'Siswa') {
      const fetchAllMasterData = async () => {
        setMasterDataLoading(true);
        const fetchMasterData = async (collectionName: string, setter: Function) => {
          const orderByField = collectionName === 'transportasi' ? 'nama' : 'urutan';
          try {
            const q = query(collection(db, collectionName), orderBy(orderByField, "asc"));
            const querySnapshot = await getDocs(q);
            const data = querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as MasterData[];
            setter(data);
          } catch (error) {
            console.error(`Error fetching ${collectionName}:`, error);
          }
        };

        await Promise.all([
          fetchMasterData("transportasi", setTransportasiList),
          fetchMasterData("pendidikan", setPendidikanList),
          fetchMasterData("pekerjaan", setPekerjaanList),
          fetchMasterData("penghasilan", setPenghasilanList),
        ]);
        setMasterDataLoading(false);
      };

      fetchAllMasterData();
    } else {
      setMasterDataLoading(false);
    }
  }, [userData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev: any) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, fieldName: string) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData((prev: any) => ({ ...prev, [fieldName]: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const clearFile = (fieldName: string) => {
    setFormData((prev: any) => ({...prev, [fieldName]: ""}));
  }

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
      if (userData.role === "Siswa") {
        collectionName = "siswa";
      } else if (["Guru", "Caregiver", "Admin", "Kepala Sekolah", "Direktur", "Yayasan"].includes(userData.role)) {
        // Untuk role lain seperti Admin, Kepala Sekolah, dll. kita asumsikan ada di koleksi 'guru'
        collectionName = "guru";
      }

      const userDocRef = doc(db, collectionName, userData.id);
      
      // Hanya kirim field yang diubah
      const updatedFields: { [key: string]: any } = {};
      Object.keys(formData).forEach(key => {
        // Bandingkan dengan data awal (userData), juga handle field baru yang mungkin undefined di userData
        if (formData[key] !== userData[key] || (formData[key] && userData[key] === undefined)) {
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

  const renderSiswaForm = () => (
    <div className="space-y-6">
      {/* A. DATA PRIBADI */}
      <div className="space-y-4 border-b border-gray-200 pb-4">
        <h4 className="text-md font-semibold text-gray-800">A. Data Pribadi</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-900">
          <div><label className="block font-medium text-gray-700 mb-1">Nama Siswa</label><input type="text" name="nama" value={formData.nama || ''} onChange={handleChange} className="w-full p-2 border rounded-md text-gray-900" /></div>
          <div><label className="block font-medium text-gray-700 mb-1">Jenis Kelamin</label><select name="jenisKelamin" value={formData.jenisKelamin || ''} onChange={handleChange} className="w-full p-2 border rounded-md bg-white text-gray-900"><option value="Laki-laki">Laki-laki</option><option value="Perempuan">Perempuan</option></select></div>
          <div><label className="block font-medium text-gray-700 mb-1">Kewarganegaraan</label><input type="text" name="kewarganegaraan" value={formData.kewarganegaraan || ''} onChange={handleChange} className="w-full p-2 border rounded-md text-gray-900" /></div>
          <div><label className="block font-medium text-gray-700 mb-1">NIK</label><input type="text" name="nik" value={formData.nik || ''} onChange={handleChange} className="w-full p-2 border rounded-md text-gray-900" /></div>
          <div><label className="block font-medium text-gray-700 mb-1">No. Kartu Keluarga</label><input type="text" name="noKartuKeluarga" value={formData.noKartuKeluarga || ''} onChange={handleChange} className="w-full p-2 border rounded-md text-gray-900" /></div>
          <div><label className="block font-medium text-gray-700 mb-1">Tempat Lahir</label><input type="text" name="tempatLahir" value={formData.tempatLahir || ''} onChange={handleChange} className="w-full p-2 border rounded-md text-gray-900" /></div>
          <div><label className="block font-medium text-gray-700 mb-1">Tanggal Lahir</label><input type="date" name="tanggalLahir" value={formData.tanggalLahir || ''} onChange={handleChange} className="w-full p-2 border rounded-md text-gray-900" /></div>
          <div><label className="block font-medium text-gray-700 mb-1">No. Akta Lahir</label><input type="text" name="noAktaLahir" value={formData.noAktaLahir || ''} onChange={handleChange} className="w-full p-2 border rounded-md text-gray-900" /></div>
          <div><label className="block font-medium text-gray-700 mb-1">Agama</label><input type="text" name="agama" value={formData.agama || ''} onChange={handleChange} className="w-full p-2 border rounded-md text-gray-900" /></div>
          <div><label className="block font-medium text-gray-700 mb-1">RT</label><input type="text" name="rt" value={formData.rt || ''} onChange={handleChange} className="w-full p-2 border rounded-md text-gray-900" /></div>
          <div><label className="block font-medium text-gray-700 mb-1">RW</label><input type="text" name="rw" value={formData.rw || ''} onChange={handleChange} className="w-full p-2 border rounded-md text-gray-900" /></div>
          <div><label className="block font-medium text-gray-700 mb-1">Nama Dusun</label><input type="text" name="dusun" value={formData.dusun || ''} onChange={handleChange} className="w-full p-2 border rounded-md text-gray-900" /></div>
          <div><label className="block font-medium text-gray-700 mb-1">Desa/Kelurahan</label><input type="text" name="desaKelurahan" value={formData.desaKelurahan || ''} onChange={handleChange} className="w-full p-2 border rounded-md text-gray-900" /></div>
          <div><label className="block font-medium text-gray-700 mb-1">Kode Pos</label><input type="text" name="kodePos" value={formData.kodePos || ''} onChange={handleChange} className="w-full p-2 border rounded-md text-gray-900" /></div>
          <div><label className="block font-medium text-gray-700 mb-1">Lintang (Optional)</label><input type="text" name="lintang" value={formData.lintang || ''} onChange={handleChange} className="w-full p-2 border rounded-md text-gray-900" /></div>
          <div><label className="block font-medium text-gray-700 mb-1">Bujur (Optional)</label><input type="text" name="bujur" value={formData.bujur || ''} onChange={handleChange} className="w-full p-2 border rounded-md text-gray-900" /></div>
          <div><label className="block font-medium text-gray-700 mb-1">Tempat Tinggal</label><select name="tempatTinggal" value={formData.tempatTinggal || ''} onChange={handleChange} className="w-full p-2 border rounded-md bg-white text-gray-900"><option value="Bersama Orang Tua">Bersama Orang Tua</option><option value="Wali">Wali</option></select></div>
          <div><label className="block font-medium text-gray-700 mb-1">Moda Transportasi</label><select name="modaTransportasi" value={formData.modaTransportasi || ''} onChange={handleChange} className="w-full p-2 border rounded-md bg-white text-gray-900"><option value="">Pilih Transportasi</option>{transportasiList.map(t => <option key={t.id} value={t.nama}>{t.nama}</option>)}</select></div>
          <div><label className="block font-medium text-gray-700 mb-1">Anak Ke-</label><input type="number" name="anakKe" value={formData.anakKe || ''} onChange={handleChange} className="w-full p-2 border rounded-md text-gray-900" /></div>
        </div>
      </div>

      {/* B. DATA AYAH KANDUNG */}
      <div className="space-y-4 border-b border-gray-200 pb-4">
        <h4 className="text-md font-semibold text-gray-800">B. Data Ayah Kandung</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-900">
          <div><label className="block font-medium text-gray-700 mb-1">Nama Ayah</label><input type="text" name="namaAyah" value={formData.namaAyah || ''} onChange={handleChange} className="w-full p-2 border rounded-md text-gray-900" /></div>
          <div><label className="block font-medium text-gray-700 mb-1">NIK Ayah</label><input type="text" name="nikAyah" value={formData.nikAyah || ''} onChange={handleChange} className="w-full p-2 border rounded-md text-gray-900" /></div>
          <div><label className="block font-medium text-gray-700 mb-1">Tahun Lahir Ayah</label><input type="text" name="tahunLahirAyah" value={formData.tahunLahirAyah || ''} onChange={handleChange} className="w-full p-2 border rounded-md text-gray-900" /></div>
          <div><label className="block font-medium text-gray-700 mb-1">Pendidikan Ayah</label><select name="pendidikanAyah" value={formData.pendidikanAyah || ''} onChange={handleChange} className="w-full p-2 border rounded-md bg-white text-gray-900"><option value="">Pilih Pendidikan</option>{pendidikanList.map(p => <option key={p.id} value={p.nama}>{p.nama}</option>)}</select></div>
          <div><label className="block font-medium text-gray-700 mb-1">Pekerjaan Ayah</label><select name="pekerjaanAyah" value={formData.pekerjaanAyah || ''} onChange={handleChange} className="w-full p-2 border rounded-md bg-white text-gray-900"><option value="">Pilih Pekerjaan</option>{pekerjaanList.map(p => <option key={p.id} value={p.nama}>{p.nama}</option>)}</select></div>
          <div><label className="block font-medium text-gray-700 mb-1">Penghasilan Ayah</label><select name="penghasilanAyah" value={formData.penghasilanAyah || ''} onChange={handleChange} className="w-full p-2 border rounded-md bg-white text-gray-900"><option value="">Pilih Penghasilan</option>{penghasilanList.map(p => <option key={p.id} value={p.nama}>{p.nama}</option>)}</select></div>
        </div>
      </div>

      {/* C. DATA IBU KANDUNG */}
      <div className="space-y-4 border-b border-gray-200 pb-4">
        <h4 className="text-md font-semibold text-gray-800">C. Data Ibu Kandung</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-900">
          <div><label className="block font-medium text-gray-700 mb-1">Nama Ibu</label><input type="text" name="namaIbu" value={formData.namaIbu || ''} onChange={handleChange} className="w-full p-2 border rounded-md text-gray-900" /></div>
          <div><label className="block font-medium text-gray-700 mb-1">NIK Ibu</label><input type="text" name="nikIbu" value={formData.nikIbu || ''} onChange={handleChange} className="w-full p-2 border rounded-md text-gray-900" /></div>
          <div><label className="block font-medium text-gray-700 mb-1">Tahun Lahir Ibu</label><input type="text" name="tahunLahirIbu" value={formData.tahunLahirIbu || ''} onChange={handleChange} className="w-full p-2 border rounded-md text-gray-900" /></div>
          <div><label className="block font-medium text-gray-700 mb-1">Pendidikan Ibu</label><select name="pendidikanIbu" value={formData.pendidikanIbu || ''} onChange={handleChange} className="w-full p-2 border rounded-md bg-white text-gray-900"><option value="">Pilih Pendidikan</option>{pendidikanList.map(p => <option key={p.id} value={p.nama}>{p.nama}</option>)}</select></div>
          <div><label className="block font-medium text-gray-700 mb-1">Pekerjaan Ibu</label><select name="pekerjaanIbu" value={formData.pekerjaanIbu || ''} onChange={handleChange} className="w-full p-2 border rounded-md bg-white text-gray-900"><option value="">Pilih Pekerjaan</option>{pekerjaanList.map(p => <option key={p.id} value={p.nama}>{p.nama}</option>)}</select></div>
          <div><label className="block font-medium text-gray-700 mb-1">Penghasilan Ibu</label><select name="penghasilanIbu" value={formData.penghasilanIbu || ''} onChange={handleChange} className="w-full p-2 border rounded-md bg-white text-gray-900"><option value="">Pilih Penghasilan</option>{penghasilanList.map(p => <option key={p.id} value={p.nama}>{p.nama}</option>)}</select></div>
        </div>
      </div>

      {/* D. UPLOAD DOKUMEN */}
      <div className="space-y-4">
        <h4 className="text-md font-semibold text-gray-800">D. Upload Dokumen</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-900">
          <div>
            <label className="block font-medium text-gray-700 mb-1">Foto Akta Kelahiran</label>
            <input type="file" accept="image/*,application/pdf" onChange={(e) => handleFileChange(e, 'fotoAktaKelahiran')} className="w-full text-xs text-gray-500 file:mr-2 file:py-1 file:px-2 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100" />
            {formData.fotoAktaKelahiran && (
              <div className="mt-2 relative w-20 h-20">
                <img src={formData.fotoAktaKelahiran} alt="Preview" className="w-full h-full object-cover rounded-lg border" />
                <button type="button" onClick={() => clearFile('fotoAktaKelahiran')} className="absolute -top-2 -right-2 bg-red-100 text-red-600 rounded-full p-0.5 hover:bg-red-200"><X className="w-3 h-3" /></button>
              </div>
            )}
          </div>
          <div>
            <label className="block font-medium text-gray-700 mb-1">Foto Kartu Keluarga</label>
            <input type="file" accept="image/*,application/pdf" onChange={(e) => handleFileChange(e, 'fotoKartuKeluarga')} className="w-full text-xs text-gray-500 file:mr-2 file:py-1 file:px-2 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100" />
            {formData.fotoKartuKeluarga && (
              <div className="mt-2 relative w-20 h-20">
                <img src={formData.fotoKartuKeluarga} alt="Preview" className="w-full h-full object-cover rounded-lg border" />
                <button type="button" onClick={() => clearFile('fotoKartuKeluarga')} className="absolute -top-2 -right-2 bg-red-100 text-red-600 rounded-full p-0.5 hover:bg-red-200"><X className="w-3 h-3" /></button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const renderOtherUserForm = () => (
    <div className="space-y-4">
      <div className="text-sm">
        <label className="block font-medium text-gray-700 mb-1">Nama Lengkap</label>
        <input type="text" name="nama" value={formData.nama || ''} onChange={handleChange} className="w-full p-2 border rounded-md text-gray-900" />
      </div>
      <div className="text-sm">
        <label className="block font-medium text-gray-700 mb-1">NIY</label>
        <input type="text" name="niy" value={formData.niy || ''} onChange={handleChange} className="w-full p-2 border rounded-md text-gray-900" />
      </div>
      <div className="text-sm">
        <label className="block font-medium text-gray-700 mb-1">No. KTP</label>
        <input type="number" name="noKtp" value={formData.noKtp || ''} onChange={handleChange} className="w-full p-2 border rounded-md text-gray-900" />
      </div>
      <div className="text-sm">
        <label className="block font-medium text-gray-700 mb-1">Tempat Lahir</label>
        <input type="text" name="tempatLahir" value={formData.tempatLahir || ''} onChange={handleChange} className="w-full p-2 border rounded-md text-gray-900" />
      </div>
      <div className="text-sm">
        <label className="block font-medium text-gray-700 mb-1">Tanggal Lahir</label>
        <input type="date" name="tanggalLahir" value={formData.tanggalLahir || ''} onChange={handleChange} className="w-full p-2 border rounded-md text-gray-900" />
      </div>
      <div className="text-sm">
        <label className="block font-medium text-gray-700 mb-1">Alamat</label>
        <textarea name="alamat" value={formData.alamat || ''} onChange={handleChange} rows={3} className="w-full p-2 border rounded-md text-gray-900" />
      </div>
      <div className="text-sm">
        <label className="block font-medium text-gray-700 mb-1">Lulusan</label>
        <input type="text" name="lulusan" value={formData.lulusan || ''} onChange={handleChange} className="w-full p-2 border rounded-md text-gray-900" />
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex justify-center items-center">
      <div className={`bg-white rounded-2xl shadow-xl w-full ${userData?.role === 'Siswa' ? 'max-w-4xl' : 'max-w-lg'} flex flex-col max-h-[90vh]`}>
        <header className="flex justify-between items-center p-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-800">Edit Profil</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100">
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </header>

        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6">
          <div className="space-y-4">
            {masterDataLoading ? (
              <div className="flex justify-center items-center p-10">
                <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
              </div>
            ) : (
              userData?.role === 'Siswa' ? renderSiswaForm() : renderOtherUserForm()
            )}
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
            disabled={loading || masterDataLoading}
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