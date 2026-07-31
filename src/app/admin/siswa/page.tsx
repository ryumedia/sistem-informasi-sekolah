// src/app/admin/siswa/page.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { db, firebaseConfig, auth } from "@/lib/firebase";
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy, where } from "firebase/firestore";
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, onAuthStateChanged } from "firebase/auth";
import { Plus, X, Pencil, Trash2, Search, Lock, FileText, Upload, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { Download } from "lucide-react";

interface Siswa {
  id: string;
  nama: string;
  kelas: string;
  cabang: string;
  email: string;
  status: string;
  uid?: string;

  // Data Pribadi
  jenisKelamin: string;
  kewarganegaraan?: string;
  nik?: string;
  noKartuKeluarga?: string;
  tempatLahir: string;
  tanggalLahir: string;
  noAktaLahir?: string;
  agama?: string;
  rt?: string;
  rw?: string;
  dusun?: string;
  desaKelurahan?: string;
  kodePos?: string;
  lintang?: string;
  bujur?: string;
  tempatTinggal?: string;
  modaTransportasi?: string;
  anakKe?: string;
  fotoAktaKelahiran?: string;
  fotoKartuKeluarga?: string;

  // Data Ayah
  namaAyah: string;
  nikAyah?: string;
  tahunLahirAyah?: string;
  pendidikanAyah?: string;
  pekerjaanAyah?: string;
  penghasilanAyah?: string;

  // Data Ibu
  namaIbu: string;
  nikIbu?: string;
  tahunLahirIbu?: string;
  pendidikanIbu?: string;
  pekerjaanIbu?: string;
  penghasilanIbu?: string;

  // Kontak
  noTelpRumah?: string;
  noWA?: string;

  // Data Sekolah
  jenjangUsia?: string;
  nisn: string;
  isDaycare?: boolean;
  kelasDaycare?: string;
  foto?: string;
}

export default function DataSiswaPage() {
  const [siswaList, setSiswaList] = useState<Siswa[]>([]);
  const [cabangList, setCabangList] = useState<any[]>([]);
  const [kelasList, setKelasList] = useState<any[]>([]);
  const [usiaList, setUsiaList] = useState<any[]>([]);
  const [transportasiList, setTransportasiList] = useState<any[]>([]);
  const [pendidikanList, setPendidikanList] = useState<any[]>([]);
  const [pekerjaanList, setPekerjaanList] = useState<any[]>([]);
  const [penghasilanList, setPenghasilanList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [viewDetail, setViewDetail] = useState<Siswa | null>(null);
  const [userRole, setUserRole] = useState<string>("");
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;
  
  // Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCabang, setFilterCabang] = useState("");
  const [filterKelas, setFilterKelas] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  // State Form
  const [formData, setFormData] = useState({
    nama: "",
    email: "",
    password: "",
    status: "Aktif",
    cabang: "",
    kelas: "",
    nisn: "",
    jenjangUsia: "",
    isDaycare: false,
    kelasDaycare: "",
    foto: "",

    // Data Pribadi
    jenisKelamin: "Laki-laki",
    kewarganegaraan: "Indonesia (WNI)",
    nik: "",
    noKartuKeluarga: "",
    tempatLahir: "",
    tanggalLahir: "",
    noAktaLahir: "",
    agama: "",
    rt: "",
    rw: "",
    dusun: "",
    desaKelurahan: "",
    kodePos: "",
    lintang: "",
    bujur: "",
    tempatTinggal: "Bersama Orang Tua",
    modaTransportasi: "",
    anakKe: "",
    fotoAktaKelahiran: "",
    fotoKartuKeluarga: "",

    // Data Orang Tua & Kontak
    namaAyah: "",
    namaIbu: "",
    nikAyah: "",
    tahunLahirAyah: "",
    pendidikanAyah: "",
    pekerjaanAyah: "",
    penghasilanAyah: "",
    nikIbu: "",
    tahunLahirIbu: "",
    pendidikanIbu: "",
    pekerjaanIbu: "",
    penghasilanIbu: "",
    noTelpRumah: "",
    noWA: "",
  });

  // Fetch Data Siswa
  const fetchSiswa = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, "siswa"), orderBy("nama", "asc"));
      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Siswa[];
      setSiswaList(data);
    } catch (error) {
      console.error("Error fetching siswa:", error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch Data Cabang
  useEffect(() => {
    fetchSiswa();
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
    const fetchKelas = async () => {
      try {
        const q = query(collection(db, "kelas"), orderBy("namaKelas", "asc"));
        const querySnapshot = await getDocs(q);
        const data = querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setKelasList(data);
      } catch (error) {
        console.error("Error fetching kelas:", error);
      }
    };
    const fetchUsia = async () => {
      try {
        const q = query(collection(db, "kelompok_usia"), orderBy("usia", "asc"));
        const querySnapshot = await getDocs(q);
        const data = querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setUsiaList(data);
      } catch (error) {
        console.error("Error fetching usia:", error);
      }
    };
    const fetchMasterData = async (collectionName: string, setter: Function) => {
      // Tentukan field untuk diurutkan berdasarkan nama koleksi
      const orderByField = collectionName === 'transportasi' ? 'nama' : 'urutan';
      try {
        const q = query(collection(db, collectionName), orderBy(orderByField, "asc"));
        const querySnapshot = await getDocs(q);
        const data = querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setter(data);
      } catch (error) {
        console.error(`Error fetching ${collectionName}:`, error);
        alert(`Gagal mengambil data master untuk ${collectionName}.`);
      }
    };

    fetchCabang();
    fetchKelas();
    fetchUsia();
    fetchMasterData("transportasi", setTransportasiList);
    fetchMasterData("pendidikan", setPendidikanList);
    fetchMasterData("pekerjaan", setPekerjaanList);
    fetchMasterData("penghasilan", setPenghasilanList);
  }, []);

  // Cek Role User (Kepala Sekolah hanya bisa lihat cabangnya sendiri)
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        try {
          // Cek di koleksi guru dan caregivers secara bersamaan
          const qGuru = query(collection(db, "guru"), where("email", "==", currentUser.email));
          const qCaregiver = query(collection(db, "caregivers"), where("email", "==", currentUser.email));

          const [guruSnapshot, caregiverSnapshot] = await Promise.all([
            getDocs(qGuru),
            getDocs(qCaregiver)
          ]);

          let userData: any = null;
          if (!guruSnapshot.empty) {
            userData = guruSnapshot.docs[0].data();
          } else if (!caregiverSnapshot.empty) {
            userData = caregiverSnapshot.docs[0].data();
          }

          if (userData) {
            setUserRole(userData.role);
            // Otomatis set filter cabang untuk role tertentu
            if (["Kepala Sekolah", "Guru", "Caregiver"].includes(userData.role)) {
              setFilterCabang(userData.cabang);
            }
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  // Handle File Change (Base64)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, fieldName: keyof typeof formData) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData((prev) => ({ ...prev, [fieldName]: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const clearFile = (fieldName: keyof typeof formData) => {
    setFormData(prev => ({...prev, [fieldName]: ""}));
    // Also clear the file input if needed, though it's tricky.
    // This state change is usually enough.
  }

  // Handle Submit (Tambah/Edit)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editId) {
        // Mode Edit: Update data yang ada
        
        // 1. Cek apakah email berubah, jika ya update di Auth via API
        const currentSiswa = siswaList.find(s => s.id === editId);
        if (currentSiswa && currentSiswa.uid && currentSiswa.email !== formData.email) {
           const res = await fetch('/api/admin/update-user', {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ uid: currentSiswa.uid, email: formData.email })
           });
           
           if (!res.ok) {
             const errData = await res.json();
             throw new Error(errData.error || "Gagal update email di Auth System");
           }
        }

        const dataToUpdate: Partial<Siswa> = {
          nama: formData.nama,
          email: formData.email,
          status: formData.status,
          cabang: formData.cabang,
          kelas: formData.kelas,
          nisn: formData.nisn,
          jenjangUsia: formData.jenjangUsia,
          isDaycare: formData.isDaycare,
          kelasDaycare: formData.isDaycare ? formData.kelasDaycare : "",
          foto: formData.foto,

          // Data Pribadi
          jenisKelamin: formData.jenisKelamin,
          kewarganegaraan: formData.kewarganegaraan,
          nik: formData.nik,
          noKartuKeluarga: formData.noKartuKeluarga,
          tempatLahir: formData.tempatLahir,
          tanggalLahir: formData.tanggalLahir,
          noAktaLahir: formData.noAktaLahir,
          agama: formData.agama,
          rt: formData.rt,
          rw: formData.rw,
          dusun: formData.dusun,
          desaKelurahan: formData.desaKelurahan,
          kodePos: formData.kodePos,
          lintang: formData.lintang,
          bujur: formData.bujur,
          tempatTinggal: formData.tempatTinggal,
          modaTransportasi: formData.modaTransportasi,
          anakKe: formData.anakKe,
          fotoAktaKelahiran: formData.fotoAktaKelahiran,
          fotoKartuKeluarga: formData.fotoKartuKeluarga,

          namaAyah: formData.namaAyah,
          nikAyah: formData.nikAyah,
          tahunLahirAyah: formData.tahunLahirAyah,
          pendidikanAyah: formData.pendidikanAyah,
          pekerjaanAyah: formData.pekerjaanAyah,
          penghasilanAyah: formData.penghasilanAyah,
          namaIbu: formData.namaIbu,
          nikIbu: formData.nikIbu,
          tahunLahirIbu: formData.tahunLahirIbu,
          pendidikanIbu: formData.pendidikanIbu,
          pekerjaanIbu: formData.pekerjaanIbu,
          penghasilanIbu: formData.penghasilanIbu,
          noTelpRumah: formData.noTelpRumah,
          noWA: formData.noWA,
        };
        await updateDoc(doc(db, "siswa", editId), dataToUpdate);
        alert("Data siswa berhasil diperbarui!");
      } else {

        // Mode Tambah: Buat data baru

        // Cek apakah email sudah ada di koleksi lain
        const emailExistsQuery = [
          query(collection(db, "siswa"), where("email", "==", formData.email)),
          query(collection(db, "guru"), where("email", "==", formData.email)),
          query(collection(db, "caregivers"), where("email", "==", formData.email)),
        ];

        const queryResults = await Promise.all(emailExistsQuery.map(q => getDocs(q)));
        
        if (queryResults.some(snap => !snap.empty)) {
          alert("Email sudah terdaftar, silakan gunakan email lain.");
          setSubmitting(false);
          return;
        }

        // 1. Buat User di Firebase Auth (gunakan Secondary App)
        const secondaryApp = initializeApp(firebaseConfig, "Secondary");
        const secondaryAuth = getAuth(secondaryApp);
        const userCredential = await createUserWithEmailAndPassword(secondaryAuth, formData.email, formData.password);
        await deleteApp(secondaryApp);

        // 2. Simpan ke Firestore dengan Role 'Siswa' & UID
        const dataToAdd: Omit<Siswa, 'id'> = {
          nama: formData.nama,
          email: formData.email,
          status: formData.status,
          cabang: formData.cabang,
          kelas: formData.kelas,
          nisn: formData.nisn,
          jenjangUsia: formData.jenjangUsia,
          isDaycare: formData.isDaycare,
          kelasDaycare: formData.isDaycare ? formData.kelasDaycare : "",
          foto: formData.foto,
          uid: userCredential.user.uid,

          // Data Pribadi
          jenisKelamin: formData.jenisKelamin,
          kewarganegaraan: formData.kewarganegaraan,
          nik: formData.nik,
          noKartuKeluarga: formData.noKartuKeluarga,
          tempatLahir: formData.tempatLahir,
          tanggalLahir: formData.tanggalLahir,
          noAktaLahir: formData.noAktaLahir,
          agama: formData.agama,
          rt: formData.rt,
          rw: formData.rw,
          dusun: formData.dusun,
          desaKelurahan: formData.desaKelurahan,
          kodePos: formData.kodePos,
          lintang: formData.lintang,
          bujur: formData.bujur,
          tempatTinggal: formData.tempatTinggal,
          modaTransportasi: formData.modaTransportasi,
          anakKe: formData.anakKe,
          fotoAktaKelahiran: formData.fotoAktaKelahiran,
          fotoKartuKeluarga: formData.fotoKartuKeluarga,

          namaAyah: formData.namaAyah,
          nikAyah: formData.nikAyah,
          tahunLahirAyah: formData.tahunLahirAyah,
          pendidikanAyah: formData.pendidikanAyah,
          pekerjaanAyah: formData.pekerjaanAyah,
          penghasilanAyah: formData.penghasilanAyah,
          namaIbu: formData.namaIbu,
          nikIbu: formData.nikIbu,
          tahunLahirIbu: formData.tahunLahirIbu,
          pendidikanIbu: formData.pendidikanIbu,
          pekerjaanIbu: formData.pekerjaanIbu,
          penghasilanIbu: formData.penghasilanIbu,
          noTelpRumah: formData.noTelpRumah,
          noWA: formData.noWA,
        };
        await addDoc(collection(db, "siswa"), { ...dataToAdd, role: "Siswa", createdAt: new Date() });
        alert("Siswa baru berhasil ditambahkan sebagai User!");
      }
      closeModal();
      fetchSiswa();
    } catch (error: any) {
      console.error("Error saving siswa:", error);
      if (error.code === 'auth/email-already-in-use') {
        alert("Email sudah terdaftar, silakan gunakan email lain.");
      } else {
        alert("Gagal menyimpan data: " + error.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Delete
  const handleDelete = async (id: string) => {
    if (confirm("Yakin ingin menghapus data siswa ini?")) {
      try {
        // 1. Cari data siswa untuk mendapatkan UID/Email
        const siswaToDelete = siswaList.find(s => s.id === id);
        
        // 2. Hapus user di Auth via API
        if (siswaToDelete) {
            await fetch('/api/admin/delete-user', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ uid: siswaToDelete.uid, email: siswaToDelete.email })
            });
        }

        await deleteDoc(doc(db, "siswa", id));
        alert("Data siswa berhasil dihapus.");
        fetchSiswa();
      } catch (error) {
        console.error("Error deleting:", error);
        alert("Gagal menghapus data.");
      }
    }
  };

  const handleEdit = (siswa: Siswa) => {
    setEditId(siswa.id);
    setFormData({
      nama: siswa.nama,
      email: siswa.email,
      password: "", // Password tidak di-load saat edit
      status: siswa.status,
      kelas: siswa.kelas,
      cabang: siswa.cabang,
      nisn: siswa.nisn || "",
      jenjangUsia: siswa.jenjangUsia || "",
      isDaycare: siswa.isDaycare || false,
      kelasDaycare: siswa.kelasDaycare || "",
      foto: siswa.foto || "",

      // Data Pribadi
      jenisKelamin: siswa.jenisKelamin || "Laki-laki",
      kewarganegaraan: siswa.kewarganegaraan || "Indonesia (WNI)",
      nik: siswa.nik || "",
      noKartuKeluarga: siswa.noKartuKeluarga || "",
      tempatLahir: siswa.tempatLahir || "",
      tanggalLahir: siswa.tanggalLahir || "",
      noAktaLahir: siswa.noAktaLahir || "",
      agama: siswa.agama || "",
      rt: siswa.rt || "",
      rw: siswa.rw || "",
      dusun: siswa.dusun || "",
      desaKelurahan: siswa.desaKelurahan || "",
      kodePos: siswa.kodePos || "",
      lintang: siswa.lintang || "",
      bujur: siswa.bujur || "",
      tempatTinggal: siswa.tempatTinggal || "Bersama Orang Tua",
      modaTransportasi: siswa.modaTransportasi || "",
      anakKe: siswa.anakKe || "",
      fotoAktaKelahiran: siswa.fotoAktaKelahiran || "",
      fotoKartuKeluarga: siswa.fotoKartuKeluarga || "",

      // Data Orang Tua & Kontak
      namaAyah: siswa.namaAyah || "",
      nikAyah: siswa.nikAyah || "",
      tahunLahirAyah: siswa.tahunLahirAyah || "",
      pendidikanAyah: siswa.pendidikanAyah || "",
      pekerjaanAyah: siswa.pekerjaanAyah || "",
      penghasilanAyah: siswa.penghasilanAyah || "",
      namaIbu: siswa.namaIbu || "",
      nikIbu: siswa.nikIbu || "",
      tahunLahirIbu: siswa.tahunLahirIbu || "",
      pendidikanIbu: siswa.pendidikanIbu || "",
      pekerjaanIbu: siswa.pekerjaanIbu || "",
      penghasilanIbu: siswa.penghasilanIbu || "",
      noTelpRumah: siswa.noTelpRumah || "",
      noWA: siswa.noWA || "",
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditId(null);
    setFormData({
      nama: "",
      email: "",
      password: "",
      status: "Aktif",
      cabang: "",
      kelas: "",
      nisn: "",
      jenjangUsia: "",
      isDaycare: false,
      kelasDaycare: "",
      foto: "",

      // Data Pribadi
      jenisKelamin: "Laki-laki",
      kewarganegaraan: "Indonesia (WNI)",
      nik: "",
      noKartuKeluarga: "",
      tempatLahir: "",
      tanggalLahir: "",
      noAktaLahir: "",
      agama: "",
      rt: "",
      rw: "",
      dusun: "",
      desaKelurahan: "",
      kodePos: "",
      lintang: "",
      bujur: "",
      tempatTinggal: "Bersama Orang Tua",
      modaTransportasi: "",
      anakKe: "",
      fotoAktaKelahiran: "",
      fotoKartuKeluarga: "",

      // Data Orang Tua & Kontak
      namaAyah: "",
      namaIbu: "",
      nikAyah: "",
      tahunLahirAyah: "",
      pendidikanAyah: "",
      pekerjaanAyah: "",
      penghasilanAyah: "",
      nikIbu: "",
      tahunLahirIbu: "",
      pendidikanIbu: "",
      pekerjaanIbu: "",
      penghasilanIbu: "",
      noTelpRumah: "",
      noWA: "",
    });
  };

  // Handle Import Excel
  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    let secondaryApp: any;

    try {
      // @ts-ignore
      const XLSX = await import("xlsx");
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { cellDates: true });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      if (jsonData.length === 0) {
        alert("File Excel kosong.");
        setImporting(false);
        return;
      }

      // Initialize Secondary App for Auth creation
      secondaryApp = initializeApp(firebaseConfig, "SecondaryImport");
      const secondaryAuth = getAuth(secondaryApp);

      let success = 0;
      let failed = 0;
      const errors: string[] = [];

      for (const row of jsonData as any[]) {
        // Basic Validation (Pastikan kolom Excel sesuai: Nama, Email, Password)
        if (!row.Nama || !row.Email || !row.Password) {
            failed++;
            continue;
        }

        // Format Tanggal Lahir (Handle Date Object Excel & String DD/MM/YYYY)
        let tglLahir = row['Tanggal Lahir'] || "";
        if (tglLahir instanceof Date) {
            const y = tglLahir.getFullYear();
            const m = String(tglLahir.getMonth() + 1).padStart(2, '0');
            const d = String(tglLahir.getDate()).padStart(2, '0');
            tglLahir = `${y}-${m}-${d}`;
        } else if (typeof tglLahir === 'string' && tglLahir.includes('/')) {
            // Asumsi format DD/MM/YYYY
            const parts = tglLahir.split('/');
            if (parts.length === 3) {
                tglLahir = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
            }
        }

        try {
            // Check if email exists in Firestore
             const emailExistsQuery = [
                query(collection(db, "siswa"), where("email", "==", row.Email)),
                query(collection(db, "guru"), where("email", "==", row.Email)),
                query(collection(db, "caregivers"), where("email", "==", row.Email)),
            ];
            const queryResults = await Promise.all(emailExistsQuery.map(q => getDocs(q)));
            if (queryResults.some(snap => !snap.empty)) {
                throw new Error(`Email ${row.Email} sudah terdaftar.`);
            }

            // Create Auth User
            const userCredential = await createUserWithEmailAndPassword(secondaryAuth, row.Email, row.Password);
            
            // Add to Firestore
            await addDoc(collection(db, "siswa"), {
                nama: row.Nama,
                email: row.Email,
                jenisKelamin: row['Jenis Kelamin'] || "Laki-laki",
                nisn: row.NISN || "",
                tempatLahir: row['Tempat Lahir'] || "",
                tanggalLahir: tglLahir, 
                agama: row.Agama || "",                
                anakKe: row['Anak Ke-berapa'] || "",
                namaAyah: row['Nama Ayah'] || "",
                nikAyah: row['NIK Ayah'] || "",
                tahunLahirAyah: row['Tahun Lahir Ayah'] || "",
                pendidikanAyah: row['Pendidikan Ayah'] || "",
                pekerjaanAyah: row['Pekerjaan Ayah'] || "",
                penghasilanAyah: row['Penghasilan Ayah'] || "",
                namaIbu: row['Nama Ibu'] || "",
                nikIbu: row['NIK Ibu'] || "",
                tahunLahirIbu: row['Tahun Lahir Ibu'] || "",
                pendidikanIbu: row['Pendidikan Ibu'] || "",
                pekerjaanIbu: row['Pekerjaan Ibu'] || "",
                penghasilanIbu: row['Penghasilan Ibu'] || "",
                noWA: row['Nomor WA'] || "",
                kelas: row.Kelas || "",
                cabang: row.Cabang || "",
                status: "Aktif",
                role: "Siswa",
                uid: userCredential.user.uid,
                createdAt: new Date(),
                jenjangUsia: row['Jenjang Usia'] || "",
                isDaycare: row.Daycare === true || row.Daycare === "Ya" || row.Daycare === "TRUE",
                kelasDaycare: row['Kelas Daycare'] || "",
            });
            success++;
        } catch (err: any) {
            console.error(`Gagal import ${row.Nama}:`, err);
            failed++;
            errors.push(`${row.Nama}: ${err.message}`);
        }
      }

      alert(`Import Selesai.\nSukses: ${success}\nGagal: ${failed}\n${errors.length > 0 ? "Cek console untuk detail error." : ""}`);
      if (errors.length > 0) console.log("Import Errors:", errors);
      fetchSiswa();
    } catch (error) {
      console.error("Error processing file:", error);
      alert("Terjadi kesalahan saat memproses file. Pastikan format Excel benar.");
    } finally {
      if (secondaryApp) await deleteApp(secondaryApp);
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Handle Export Excel
  const handleExportExcel = async () => {
    try {
      // @ts-ignore
      const XLSX = await import("xlsx");
      // Map data to have user-friendly headers
      const dataToExport = filteredSiswa.map(siswa => ({
        'Nama Siswa': siswa.nama,
        'Email': siswa.email,
        'Status': siswa.status,
        'Cabang': siswa.cabang,
        'Kelas': siswa.kelas,
        'NISN': siswa.nisn,
        'Jenis Kelamin': siswa.jenisKelamin,
        'Tempat Lahir': siswa.tempatLahir,
        'Tanggal Lahir': siswa.tanggalLahir,
      }));
      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Data Siswa");
      XLSX.writeFile(workbook, `Data-Siswa-${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (error) {
      console.error("Error exporting to Excel:", error);
      alert("Gagal mengekspor data ke Excel.");
    }
  };

  // Logic Filter
  const filteredSiswa = siswaList.filter((siswa) => {
    const matchSearch = siswa.nama.toLowerCase().includes(searchQuery.toLowerCase()) || 
                        siswa.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchCabang = filterCabang ? siswa.cabang === filterCabang : true;
    const matchKelas = filterKelas ? (siswa.kelas === filterKelas || siswa.kelasDaycare === filterKelas) : true;
    
    const matchStatus = filterStatus ? siswa.status === filterStatus : true;
    return matchSearch && matchCabang && matchKelas && matchStatus;
  });

  // Pagination Logic
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredSiswa.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredSiswa.length / itemsPerPage);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterCabang, filterKelas, filterStatus]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">Data Siswa</h1>
        <div className="flex gap-2">
            <input 
                type="file" 
                accept=".xlsx, .xls" 
                ref={fileInputRef} 
                className="hidden" 
                onChange={handleFileImport} 
            />
            <button
                onClick={() => fileInputRef.current?.click()}
                disabled={importing}
                className="bg-green-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-green-700 transition disabled:opacity-50"
            >
                {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                Import Excel
            </button>
            <button
                onClick={handleExportExcel}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition"
            >
                <Download className="w-4 h-4" /> Export Excel
            </button>
            <button
            onClick={() => setIsModalOpen(true)}
            className="bg-[#581c87] text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-[#45156b] transition"
            >
            <Plus className="w-4 h-4" /> Tambah Siswa
            </button>
        </div>
      </div>

      {/* Filter Section */}
      <div className="flex flex-col md:flex-row gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Cari nama siswa atau email..."
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#581c87] outline-none text-gray-900"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <select
          className={`border rounded-lg px-4 py-2 bg-white focus:ring-2 focus:ring-[#581c87] outline-none text-gray-900 ${userRole === "Kepala Sekolah" ? "bg-gray-100 cursor-not-allowed" : ""}`}
          value={filterCabang}
          onChange={(e) => setFilterCabang(e.target.value)}
          disabled={userRole === "Kepala Sekolah"}
        >
          {userRole !== "Kepala Sekolah" && <option value="">Semua Cabang</option>}
          {cabangList.map((c) => <option key={c.id} value={c.nama}>{c.nama}</option>)}
        </select>
        <select
          className="border rounded-lg px-4 py-2 bg-white focus:ring-2 focus:ring-[#581c87] outline-none text-gray-900"
          value={filterKelas}
          onChange={(e) => setFilterKelas(e.target.value)}
        >
          <option value="">Semua Kelas</option>
          {kelasList
            .filter((k) => !filterCabang || k.cabang === filterCabang)
            .map((k) => <option key={k.id} value={k.namaKelas}>{k.namaKelas}</option>)}
        </select>
        <select
          className="border rounded-lg px-4 py-2 bg-white focus:ring-2 focus:ring-[#581c87] outline-none text-gray-900"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
        >
          <option value="">Semua Status</option>
          <option value="Aktif">Aktif</option>
          <option value="Nonaktif">Nonaktif</option>
          <option value="Lulus">Lulus</option>
          <option value="Pindah">Pindah</option>
        </select>
      </div>

      {/* Tabel Data */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600 min-w-[1000px]">
          <thead className="bg-gray-50 text-gray-900 font-semibold border-b">
            <tr>
              <th className="p-4 w-16">No</th>
              <th className="p-4">Nama Siswa</th>
              <th className="p-4">Cabang</th>
              <th className="p-4">Kelas</th>
              <th className="p-4">Email</th>
              <th className="p-4">Status</th>
              <th className="p-4">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={8} className="p-8 text-center">Memuat data...</td></tr>
            ) : filteredSiswa.length === 0 ? (
              <tr><td colSpan={8} className="p-8 text-center">Data tidak ditemukan.</td></tr>
            ) : (
              currentItems.map((siswa, index) => (
                <tr key={siswa.id} className="hover:bg-gray-50">
                  <td className="p-4 text-center">{indexOfFirstItem + index + 1}</td>
                  <td className="p-4 font-medium text-gray-900">
                    <div className="flex items-center gap-2">
                      <span>{siswa.nama}</span>
                      {siswa.isDaycare && (
                        <span className="bg-yellow-100 text-yellow-800 text-xs font-semibold px-2 py-0.5 rounded-full">Daycare</span>
                      )}
                    </div>
                  </td>
                  <td className="p-4">{siswa.cabang}</td>
                  <td className="p-4">
                    <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs font-medium">
                      {siswa.kelas}
                    </span>
                  </td>
                  <td className="p-4 text-gray-500">{siswa.email}</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      siswa.status === 'Aktif' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {siswa.status}
                    </span>
                  </td>
                  <td className="p-4 flex gap-2">
                    <button onClick={() => setViewDetail(siswa)} className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition" title="Lihat Detail">
                      <FileText className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleEdit(siswa)} className="p-2 text-[#581c87] hover:bg-[#581c87]/10 rounded-lg transition" title="Edit">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(siswa.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition" title="Hapus">
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

      {/* Pagination */}
      {!loading && filteredSiswa.length > 0 && (
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-gray-600">
            Menampilkan {indexOfFirstItem + 1} hingga {Math.min(indexOfLastItem, filteredSiswa.length)} dari {filteredSiswa.length} data
          </p>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="p-2 border rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }

                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm font-medium transition ${
                      currentPage === pageNum
                        ? "bg-[#581c87] text-white"
                        : "text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="p-2 border rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Modal Tambah/Edit */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-7xl overflow-hidden flex flex-col max-h-[95vh]">
            <div className="p-4 border-b flex justify-between items-center bg-gray-50 shrink-0">
              <h3 className="font-bold text-gray-800">{editId ? "Edit Data Siswa" : "Tambah Siswa Baru"}</h3>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
              {/* A. DATA PRIBADI */}
              <div className="space-y-4 border-b pb-4">
                <h4 className="text-lg font-semibold text-gray-800">A. Data Pribadi</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nama Siswa</label>
                    <input required type="text" className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#581c87] outline-none text-gray-900" value={formData.nama} onChange={(e) => setFormData({...formData, nama: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Jenis Kelamin</label>
                    <select className="w-full border rounded-lg p-2 bg-white focus:ring-2 focus:ring-[#581c87] outline-none text-gray-900" value={formData.jenisKelamin} onChange={(e) => setFormData({...formData, jenisKelamin: e.target.value})}>
                      <option value="Laki-laki">Laki-laki</option>
                      <option value="Perempuan">Perempuan</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Kewarganegaraan</label>
                    <input type="text" className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#581c87] outline-none text-gray-900" value={formData.kewarganegaraan} onChange={(e) => setFormData({...formData, kewarganegaraan: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">NIK</label>
                    <input type="text" className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#581c87] outline-none text-gray-900" value={formData.nik} onChange={(e) => setFormData({...formData, nik: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">No. Kartu Keluarga</label>
                    <input type="text" className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#581c87] outline-none text-gray-900" value={formData.noKartuKeluarga} onChange={(e) => setFormData({...formData, noKartuKeluarga: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tempat Lahir</label>
                    <input type="text" className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#581c87] outline-none text-gray-900" value={formData.tempatLahir} onChange={(e) => setFormData({...formData, tempatLahir: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal Lahir</label>
                    <input type="date" className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#581c87] outline-none text-gray-900" value={formData.tanggalLahir} onChange={(e) => setFormData({...formData, tanggalLahir: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">No. Akta Lahir</label>
                    <input type="text" className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#581c87] outline-none text-gray-900" value={formData.noAktaLahir} onChange={(e) => setFormData({...formData, noAktaLahir: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Agama</label>
                    <input type="text" className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#581c87] outline-none text-gray-900" value={formData.agama} onChange={(e) => setFormData({...formData, agama: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">RT</label>
                    <input type="text" className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#581c87] outline-none text-gray-900" value={formData.rt} onChange={(e) => setFormData({...formData, rt: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">RW</label>
                    <input type="text" className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#581c87] outline-none text-gray-900" value={formData.rw} onChange={(e) => setFormData({...formData, rw: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nama Dusun</label>
                    <input type="text" className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#581c87] outline-none text-gray-900" value={formData.dusun} onChange={(e) => setFormData({...formData, dusun: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Desa/Kelurahan</label>
                    <input type="text" className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#581c87] outline-none text-gray-900" value={formData.desaKelurahan} onChange={(e) => setFormData({...formData, desaKelurahan: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Kode Pos</label>
                    <input type="text" className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#581c87] outline-none text-gray-900" value={formData.kodePos} onChange={(e) => setFormData({...formData, kodePos: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Lintang (Optional)</label>
                    <input type="text" className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#581c87] outline-none text-gray-900" value={formData.lintang} onChange={(e) => setFormData({...formData, lintang: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Bujur (Optional)</label>
                    <input type="text" className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#581c87] outline-none text-gray-900" value={formData.bujur} onChange={(e) => setFormData({...formData, bujur: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tempat Tinggal</label>
                    <select className="w-full border rounded-lg p-2 bg-white focus:ring-2 focus:ring-[#581c87] outline-none text-gray-900" value={formData.tempatTinggal} onChange={(e) => setFormData({...formData, tempatTinggal: e.target.value})}>
                      <option>Bersama Orang Tua</option>
                      <option>Wali</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Moda Transportasi</label>
                    <select className="w-full border rounded-lg p-2 bg-white focus:ring-2 focus:ring-[#581c87] outline-none text-gray-900" value={formData.modaTransportasi} onChange={(e) => setFormData({...formData, modaTransportasi: e.target.value})}>
                      <option value="">Pilih Transportasi</option>
                      {transportasiList.map((t) => <option key={t.id} value={t.nama}>{t.nama}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Anak Ke-</label>
                    <input type="number" className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#581c87] outline-none text-gray-900" value={formData.anakKe} onChange={(e) => setFormData({...formData, anakKe: e.target.value})} />
                  </div>
                </div>
              </div>

              {/* B. DATA AYAH KANDUNG */}
              <div className="space-y-4 border-b pb-4">
                <h4 className="text-lg font-semibold text-gray-800">B. Data Ayah Kandung</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nama Ayah</label>
                    <input type="text" className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#581c87] outline-none text-gray-900" value={formData.namaAyah} onChange={(e) => setFormData({...formData, namaAyah: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">NIK Ayah</label>
                    <input type="text" className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#581c87] outline-none text-gray-900" value={formData.nikAyah} onChange={(e) => setFormData({...formData, nikAyah: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tahun Lahir Ayah</label>
                    <input type="text" className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#581c87] outline-none text-gray-900" value={formData.tahunLahirAyah} onChange={(e) => setFormData({...formData, tahunLahirAyah: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Pendidikan Ayah</label>
                    <select className="w-full border rounded-lg p-2 bg-white focus:ring-2 focus:ring-[#581c87] outline-none text-gray-900" value={formData.pendidikanAyah} onChange={(e) => setFormData({...formData, pendidikanAyah: e.target.value})}>
                      <option value="">Pilih Pendidikan</option>
                      {pendidikanList.map((p) => <option key={p.id} value={p.nama}>{p.nama}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Pekerjaan Ayah</label>
                    <select className="w-full border rounded-lg p-2 bg-white focus:ring-2 focus:ring-[#581c87] outline-none text-gray-900" value={formData.pekerjaanAyah} onChange={(e) => setFormData({...formData, pekerjaanAyah: e.target.value})}>
                      <option value="">Pilih Pekerjaan</option>
                      {pekerjaanList.map((p) => <option key={p.id} value={p.nama}>{p.nama}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Penghasilan Ayah</label>
                    <select className="w-full border rounded-lg p-2 bg-white focus:ring-2 focus:ring-[#581c87] outline-none text-gray-900" value={formData.penghasilanAyah} onChange={(e) => setFormData({...formData, penghasilanAyah: e.target.value})}>
                      <option value="">Pilih Penghasilan</option>
                      {penghasilanList.map((p) => <option key={p.id} value={p.nama}>{p.nama}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* C. DATA IBU KANDUNG */}
              <div className="space-y-4 border-b pb-4">
                <h4 className="text-lg font-semibold text-gray-800">C. Data Ibu Kandung</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nama Ibu</label>
                    <input type="text" className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#581c87] outline-none text-gray-900" value={formData.namaIbu} onChange={(e) => setFormData({...formData, namaIbu: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">NIK Ibu</label>
                    <input type="text" className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#581c87] outline-none text-gray-900" value={formData.nikIbu} onChange={(e) => setFormData({...formData, nikIbu: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tahun Lahir Ibu</label>
                    <input type="text" className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#581c87] outline-none text-gray-900" value={formData.tahunLahirIbu} onChange={(e) => setFormData({...formData, tahunLahirIbu: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Pendidikan Ibu</label>
                    <select className="w-full border rounded-lg p-2 bg-white focus:ring-2 focus:ring-[#581c87] outline-none text-gray-900" value={formData.pendidikanIbu} onChange={(e) => setFormData({...formData, pendidikanIbu: e.target.value})}>
                      <option value="">Pilih Pendidikan</option>
                      {pendidikanList.map((p) => <option key={p.id} value={p.nama}>{p.nama}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Pekerjaan Ibu</label>
                    <select className="w-full border rounded-lg p-2 bg-white focus:ring-2 focus:ring-[#581c87] outline-none text-gray-900" value={formData.pekerjaanIbu} onChange={(e) => setFormData({...formData, pekerjaanIbu: e.target.value})}>
                      <option value="">Pilih Pekerjaan</option>
                      {pekerjaanList.map((p) => <option key={p.id} value={p.nama}>{p.nama}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Penghasilan Ibu</label>
                    <select className="w-full border rounded-lg p-2 bg-white focus:ring-2 focus:ring-[#581c87] outline-none text-gray-900" value={formData.penghasilanIbu} onChange={(e) => setFormData({...formData, penghasilanIbu: e.target.value})}>
                      <option value="">Pilih Penghasilan</option>
                      {penghasilanList.map((p) => <option key={p.id} value={p.nama}>{p.nama}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* D. KONTAK */}
              <div className="space-y-4 border-b pb-4">
                <h4 className="text-lg font-semibold text-gray-800">D. Kontak</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nomor Telepon Rumah (Optional)</label>
                    <input type="text" className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#581c87] outline-none text-gray-900" value={formData.noTelpRumah} onChange={(e) => setFormData({...formData, noTelpRumah: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nomor WA</label>
                    <input type="text" className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#581c87] outline-none text-gray-900" value={formData.noWA} onChange={(e) => setFormData({...formData, noWA: e.target.value})} />
                  </div>
                </div>
              </div>

              {/* E. DATA SEKOLAH */}
              <div className="space-y-4 border-b pb-4">
                <h4 className="text-lg font-semibold text-gray-800">E. Data Sekolah</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Jenjang Usia</label>
                    <select className="w-full border rounded-lg p-2 bg-white focus:ring-2 focus:ring-[#581c87] outline-none text-gray-900" value={formData.jenjangUsia} onChange={(e) => setFormData({...formData, jenjangUsia: e.target.value})}>
                      <option value="">Pilih Jenjang Usia</option>
                      {usiaList.map((u) => <option key={u.id} value={u.usia}>{u.usia}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">NISN</label>
                    <input type="text" className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#581c87] outline-none text-gray-900" value={formData.nisn} onChange={(e) => setFormData({...formData, nisn: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                    <select className="w-full border rounded-lg p-2 bg-white focus:ring-2 focus:ring-[#581c87] outline-none text-gray-900" value={formData.status} onChange={(e) => setFormData({...formData, status: e.target.value})}>
                      <option value="Aktif">Aktif</option>
                      <option value="Nonaktif">Nonaktif</option>
                      <option value="Lulus">Lulus</option>
                      <option value="Pindah">Pindah</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Cabang</label>
                    <select required className="w-full border rounded-lg p-2 bg-white focus:ring-2 focus:ring-[#581c87] outline-none text-gray-900" value={formData.cabang} onChange={(e) => setFormData({...formData, cabang: e.target.value})}>
                      <option value="">Pilih Cabang</option>
                      {cabangList.map((c) => <option key={c.id} value={c.nama}>{c.nama}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Kelas</label>
                    <select className="w-full border rounded-lg p-2 bg-white focus:ring-2 focus:ring-[#581c87] outline-none text-gray-900" value={formData.kelas} onChange={(e) => setFormData({...formData, kelas: e.target.value})}>
                      <option value="">Pilih Kelas</option>
                      {kelasList.filter((k) => !formData.cabang || k.cabang === formData.cabang).map((k) => <option key={k.id} value={k.namaKelas}>{k.namaKelas}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email (Login)</label>
                    <input required type="email" className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#581c87] outline-none text-gray-900" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} />
                  </div>
                  {!editId && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                        <input required type="text" minLength={6} className="w-full pl-9 border rounded-lg p-2 focus:ring-2 focus:ring-[#581c87] outline-none text-gray-900" value={formData.password} onChange={(e) => setFormData({...formData, password: e.target.value})} placeholder="Min. 6 karakter" />
                      </div>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                  <div>
                    <label className="flex items-center cursor-pointer">
                      <span className="mr-3 text-sm font-medium text-gray-700">Apakah Siswa Daycare?</span>
                      <div className="relative">
                          <input 
                              type="checkbox" 
                              id="isDaycareToggle" 
                              className="sr-only peer"
                              checked={formData.isDaycare}
                              onChange={(e) => {
                                  const isChecked = e.target.checked;
                                  setFormData({
                                      ...formData, 
                                      isDaycare: isChecked, 
                                      kelasDaycare: isChecked ? formData.kelasDaycare : "" 
                                  });
                              }}
                          />
                          <div className="block bg-gray-200 w-14 h-8 rounded-full peer-checked:bg-[#581c87]"></div>
                          <div className="dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform peer-checked:translate-x-full"></div>
                      </div>
                    </label>
                  </div>
                  {formData.isDaycare && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Kelas Daycare</label>
                      <select required={formData.isDaycare} className="w-full border rounded-lg p-2 bg-white focus:ring-2 focus:ring-[#581c87] outline-none text-gray-900"
                        value={formData.kelasDaycare} onChange={(e) => setFormData({...formData, kelasDaycare: e.target.value})}>
                        <option value="">Pilih Kelas Daycare</option>
                        {kelasList
                          .filter((k) => k.jenjangKelas === 'Daycare' && (!formData.cabang || k.cabang === formData.cabang))
                          .map((k) => <option key={k.id} value={k.namaKelas}>{k.namaKelas}</option>)}
                      </select>
                    </div>
                  )}
                </div>
              </div>

              {/* F. UPLOAD DOKUMEN */}
              <div className="space-y-4">
                <h4 className="text-lg font-semibold text-gray-800">F. Upload Dokumen</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Foto Siswa</label>
                  <input type="file" accept="image/*" onChange={(e) => handleFileChange(e, 'foto')} className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-[#581c87] hover:file:bg-purple-100" />
                  {formData.foto && (
                    <div className="mt-2 relative w-20 h-20">
                      <img src={formData.foto} alt="Preview" className="w-full h-full object-cover rounded-lg border" />
                      <button type="button" onClick={() => clearFile('foto')} className="absolute -top-2 -right-2 bg-red-100 text-red-600 rounded-full p-0.5 hover:bg-red-200"><X className="w-3 h-3" /></button>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Upload Foto Akta Kelahiran</label>
                  <input type="file" accept="image/*,application/pdf" onChange={(e) => handleFileChange(e, 'fotoAktaKelahiran')} className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-[#581c87] hover:file:bg-purple-100" />
                  {formData.fotoAktaKelahiran && (
                    <div className="mt-2 relative w-20 h-20">
                      <img src={formData.fotoAktaKelahiran} alt="Preview" className="w-full h-full object-cover rounded-lg border" />
                      <button type="button" onClick={() => clearFile('fotoAktaKelahiran')} className="absolute -top-2 -right-2 bg-red-100 text-red-600 rounded-full p-0.5 hover:bg-red-200"><X className="w-3 h-3" /></button>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Upload Foto Kartu Keluarga</label>
                  <input type="file" accept="image/*,application/pdf" onChange={(e) => handleFileChange(e, 'fotoKartuKeluarga')} className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-[#581c87] hover:file:bg-purple-100" />
                  {formData.fotoKartuKeluarga && (
                    <div className="mt-2 relative w-20 h-20">
                      <img src={formData.fotoKartuKeluarga} alt="Preview" className="w-full h-full object-cover rounded-lg border" />
                      <button type="button" onClick={() => clearFile('fotoKartuKeluarga')} className="absolute -top-2 -right-2 bg-red-100 text-red-600 rounded-full p-0.5 hover:bg-red-200"><X className="w-3 h-3" /></button>
                    </div>
                  )}
                </div>
              </div>
              </div>

              <button disabled={submitting} type="submit" className="w-full bg-[#581c87] text-white py-2 rounded-lg hover:bg-[#45156b] transition font-medium mt-2">
                {submitting ? "Menyimpan..." : "Simpan Data"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal Detail Siswa */}
      {viewDetail && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setViewDetail(null)}>
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full overflow-hidden relative" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-gray-800">Detail Siswa</h3>
              <button onClick={() => setViewDetail(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[80vh]">
              <div className="flex flex-col md:flex-row gap-6">
                <div className="w-full md:w-1/3 flex flex-col items-center">
                  {viewDetail.foto ? (
                    <img src={viewDetail.foto} alt={viewDetail.nama} className="w-32 h-32 object-cover rounded-full border-4 border-purple-50 shadow-sm" />
                  ) : (
                    <div className="w-32 h-32 bg-purple-100 rounded-full flex items-center justify-center text-purple-500 text-4xl font-bold">
                      {viewDetail.nama.charAt(0)}
                    </div>
                  )}
                  <div className="mt-4 text-center">
                    <h4 className="font-bold text-gray-900">{viewDetail.nama}</h4>
                    <p className="text-sm text-gray-500">{viewDetail.nisn || "-"}</p>
                    <span className={`mt-2 inline-block px-2 py-1 rounded-full text-xs font-medium ${viewDetail.status === 'Aktif' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {viewDetail.status}
                    </span>
                  </div>
                </div>
                <div className="w-full md:w-2/3 space-y-3">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div><p className="text-gray-500">Jenis Kelamin</p><p className="font-medium">{viewDetail.jenisKelamin}</p></div>
                    <div><p className="text-gray-500">Agama</p><p className="font-medium">{viewDetail.agama || "-"}</p></div>
                    <div><p className="text-gray-500">Jenjang Usia</p><p className="font-medium">{viewDetail.jenjangUsia || "-"}</p></div>
                    <div><p className="text-gray-500">Tempat, Tgl Lahir</p><p className="font-medium">{viewDetail.tempatLahir}, {viewDetail.tanggalLahir}</p></div>
                    <div><p className="text-gray-500">Anak Ke</p><p className="font-medium">{viewDetail.anakKe || "-"}</p></div>
                    <div><p className="text-gray-500">Kelas</p><p className="font-medium">{viewDetail.kelas}</p></div>
                    <div><p className="text-gray-500">Cabang</p><p className="font-medium">{viewDetail.cabang}</p></div>
                    <div className="col-span-2 border-t pt-2 mt-2"><p className="text-gray-500">Nama Ayah</p><p className="font-medium">{viewDetail.namaAyah || "-"}</p></div>
                    <div><p className="text-gray-500">Pendidikan Ayah</p><p className="font-medium">{viewDetail.pendidikanAyah || "-"}</p></div>
                    <div><p className="text-gray-500">Pekerjaan Ayah</p><p className="font-medium">{viewDetail.pekerjaanAyah || "-"}</p></div>
                    <div className="col-span-2 border-t pt-2 mt-2"><p className="text-gray-500">Nama Ibu</p><p className="font-medium">{viewDetail.namaIbu || "-"}</p></div>
                    <div><p className="text-gray-500">Pendidikan Ibu</p><p className="font-medium">{viewDetail.pendidikanIbu || "-"}</p></div>
                    <div><p className="text-gray-500">Pekerjaan Ibu</p><p className="font-medium">{viewDetail.pekerjaanIbu || "-"}</p></div>
                    <div className="col-span-2 border-t pt-2 mt-2"><p className="text-gray-500">Nomor WA</p><p className="font-medium">{viewDetail.noWA || "-"}</p></div>
                    <div className="col-span-2"><p className="text-gray-500">Email</p><p className="font-medium">{viewDetail.email}</p></div>
                    <div className="col-span-2"><p className="text-gray-500">Alamat</p><p className="font-medium">
                      {[viewDetail.dusun, `RT ${viewDetail.rt || '-'} / RW ${viewDetail.rw || '-'}`, viewDetail.desaKelurahan, viewDetail.kodePos]
                        .filter(Boolean).join(', ')}
                    </p></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
