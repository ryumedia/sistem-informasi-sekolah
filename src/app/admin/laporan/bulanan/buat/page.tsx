"use client";

import { useState, useEffect, ChangeEvent, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Save, Calendar, CheckCircle2, Plus, Trash2, Upload, Briefcase, Users, Target, DollarSign, Lightbulb, BookOpen, Activity, Home } from 'lucide-react';
import { db, auth, storage } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, getDoc, addDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import React from 'react';
import { onAuthStateChanged } from 'firebase/auth';

// Type Definitions
interface Semester {
    id: string;
    namaPeriode: string;
    isDefault?: boolean;
}
interface Cabang {
    id: string;
    nama: string;
}
interface Kelas {
    id: string;
    nama?: string;
    namaKelas?: string | string[];
    cabang?: string;
    jumlah_murid?: number;
}
interface CapaianPPDB {
    [key: string]: {
        target: string;
        capaian: string;
    };
}
interface KeuanganSingkat {
    id: number;
    pos: string;
    pengajuan: string;
    realisasi: string;
    catatan: string;
}
interface JumlahSiswa {
    [key: string]: {
        jumlah: number;
        keterangan: string;
    };
}
interface RencanaAgendaDetail {
    id: number;
    tanggal: string;
    kegiatan: string;
}
interface RencanaAgenda {
    tema: string;
    deskripsi: string;
    detail: RencanaAgendaDetail[];
}
interface RingkasanEksekutif {
    capaianPembelajaran: string;
    kinerjaSDM: string;
    keuangan: string;
    ppdb: string;
    isuStrategis: string;
}
interface CapaianOKR {
    pembelajaran: string;
    budayaKerja: string;
    kebersihan: string;
    operasional: string;
    branding: string;
}

const ringkasanEksekutifLabels: Record<keyof RingkasanEksekutif, string> = {
    capaianPembelajaran: 'Capaian Pembelajaran',
    kinerjaSDM: 'Kinerja SDM',
    keuangan: 'Keuangan',
    ppdb: 'PPDB',
    isuStrategis: 'Isu Strategis',
};

const capaianOKRLabels: Record<keyof CapaianOKR, string> = {
    pembelajaran: 'Pembelajaran dengan konsep Trilogi Main Riang',
    budayaKerja: 'Budaya Kerja & Pembinaan',
    kebersihan: 'Kebersihan & Sarpras',
    operasional: 'Operasional & Keuangan',
    branding: 'Branding & Publikasi',
};

const steps = [
    { id: 1, name: 'Informasi Dasar' },
    { id: 2, name: 'Ringkasan Eksekutif' },
    { id: 3, name: 'Capaian OKR' },
    { id: 4, name: 'Capaian PPDB' },
    { id: 5, name: 'Keuangan Singkat' },
    { id: 6, name: 'Jumlah Siswa' },
    { id: 7, name: 'Isu Strategis' },
    { id: 8, name: 'Rekomendasi' },
    { id: 9, name: 'Rencana Agenda' },
    { id: 10, name: 'Dokumentasi' },
    { id: 11, name: 'Konfirmasi' },
];

export default function BuatLaporanPage() {
    const [currentStep, setCurrentStep] = useState(1);
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();
    const searchParams = useSearchParams();
    const editId = searchParams.get('id');

    // Step 1 State
    const [semesters, setSemesters] = useState<Semester[]>([]);
    const [cabangList, setCabangList] = useState<Cabang[]>([]);
    const [selectedSemester, setSelectedSemester] = useState('');
    const [selectedBulan, setSelectedBulan] = useState('Januari');
    const [selectedCabang, setSelectedCabang] = useState('');
    const [disusunOleh, setDisusunOleh] = useState('Memuat...');

    // Step 2 State
    const [ringkasanEksekutif, setRingkasanEksekutif] = useState<RingkasanEksekutif>({
        capaianPembelajaran: '',
        kinerjaSDM: '',
        keuangan: '',
        ppdb: '',
        isuStrategis: '',
    });

    // Step 3 State
    const [capaianOKR, setCapaianOKR] = useState<CapaianOKR>({
        pembelajaran: '',
        budayaKerja: '',
        kebersihan: '',
        operasional: '',
        branding: '',
    });

    // Step 4 State
    const [capaianPPDB, setCapaianPPDB] = useState<CapaianPPDB>({});

    // Step 5 State
    const [keuanganSingkat, setKeuanganSingkat] = useState<KeuanganSingkat[]>([{ id: 1, pos: '', pengajuan: '', realisasi: '', catatan: '' }]);

    // Step 6 State
    const [jumlahSiswa, setJumlahSiswa] = useState<JumlahSiswa>({});

    // Step 7 State
    const [isuStrategis, setIsuStrategis] = useState('');

    // Step 8 State
    const [rekomendasiKegiatan, setRekomendasiKegiatan] = useState('');

    // Step 9 State
    const [rencanaAgenda, setRencanaAgenda] = useState<RencanaAgenda>({
        tema: '',
        deskripsi: '',
        detail: [{ id: 1, tanggal: '', kegiatan: '' }],
    });

    // Step 10 State
    const [dokumentasi, setDokumentasi] = useState<(string | File | null)[]>([null, null, null, null]);

    useEffect(() => {
        if (editId) {
            const fetchReport = async () => {
                try {
                    const docRef = doc(db, "laporan_bulanan", editId);
                    const docSnap = await getDoc(docRef);
                    if (docSnap.exists()) {
                        const data = docSnap.data();
                        setSelectedSemester(data.informasiDasar.semesterId);
                        setSelectedBulan(data.informasiDasar.bulan);
                        setSelectedCabang(data.informasiDasar.cabangId);
                        setDisusunOleh(data.informasiDasar.disusunOleh);
                        setRingkasanEksekutif(data.ringkasanEksekutif);
                        setCapaianOKR(data.capaianOKR);
                        setCapaianPPDB(data.capaianPPDB);
                        setKeuanganSingkat(data.keuanganSingkat);
                        setJumlahSiswa(data.jumlahSiswa);
                        setIsuStrategis(data.isuStrategis);
                        setRekomendasiKegiatan(data.rekomendasiKegiatan);
                        setRencanaAgenda(data.rencanaAgenda);
                        if (data.dokumentasi && Array.isArray(data.dokumentasi)) {
                            const docs = [...data.dokumentasi];
                            while (docs.length < 4) docs.push(null);
                            setDokumentasi(docs);
                        }
                    }
                } catch (error) {
                    console.error("Error fetching report:", error);
                }
            };
            fetchReport();
        }

        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                const uid = user.uid.trim();
                // Gunakan nama dari profil Auth sebagai default/fallback agar tidak stuck loading
                if (user.displayName) setDisusunOleh(user.displayName);

                try {
                    // ================== TEMPORARY WORKAROUND ==================
                    // The following code fetches all documents from the 'guru' collection and searches
                    // on the client-side. This is inefficient and should be replaced with a direct
                    // Firestore query. The direct query is likely failing due to a missing Firestore
                    // index or a security rule.
                    //
                    // CORRECT QUERY (Enable after fixing Firestore config):
                    // const q = query(collection(db, "guru"), where("uid", "array-contains", uid));
                    // const querySnapshot = await getDocs(q);
                    //
                    // Check browser console for Firestore index creation links or review security rules.
                    // ==========================================================
                    const guruCollectionRef = collection(db, "guru");
                    const querySnapshot = await getDocs(guruCollectionRef);
                    const allGurus = querySnapshot.docs.map(d => d.data());

                    const userDocData = allGurus.find(guru => 
                        (Array.isArray(guru.uid) && guru.uid.includes(uid)) || guru.uid === uid
                    );

                    if (userDocData) {
                        // Hanya set nama penyusun jika BUKAN mode edit
                        if (!editId) {
                            const displayName = Array.isArray(userDocData.nama) ? userDocData.nama[0] : userDocData.nama;
                            setDisusunOleh(displayName || "Nama tidak ditemukan");
                        }

                        const userCabang = userDocData.cabang;
                        let userCabangName: string | undefined;

                        if (Array.isArray(userCabang) && userCabang.length > 0) {
                            userCabangName = userCabang[0]; // Ambil cabang pertama dari array
                        } else if (typeof userCabang === 'string' && userCabang) {
                            userCabangName = userCabang;
                        }

                        if (userCabangName) {
                            const qCabang = query(collection(db, "cabang"), where("nama", "==", userCabangName));
                            const cabangSnapshot = await getDocs(qCabang);

                            if (!cabangSnapshot.empty) {
                                const cabangData = cabangSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Cabang));
                                setCabangList(cabangData);
                                // Hanya set default cabang jika BUKAN mode edit
                                if (!editId && cabangData.length > 0) setSelectedCabang(cabangData[0].id);
                            } else {
                                console.error(`Cabang dengan nama "${userCabangName}" tidak ditemukan di collection 'cabang'.`);
                                setCabangList([]);
                            }
                        } else {
                            setCabangList([]);
                        }
                    } else {
                        if (!user.displayName && !editId) setDisusunOleh("User tidak terdaftar sebagai guru");
                    }
                } catch (error) {
                    console.error("Error fetching user data:", error);
                    if (!user.displayName && !editId) setDisusunOleh("Gagal memuat data guru");
                }
            } else {
                setDisusunOleh("User tidak login");
            }
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                const qSemester = query(collection(db, "kpi_periode"), where("isDefault", "==", true));
                const semesterSnapshot = await getDocs(qSemester);
                const semesterData = semesterSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Semester));
                setSemesters(semesterData);
                if (semesterData.length > 0) {
                    setSelectedSemester(semesterData[0].id);
                }
            } catch (error) {
                console.error("Error fetching semester data:", error);
                setSemesters([]);
            }
        };
        fetchInitialData();
    }, []);

    useEffect(() => {
        const fetchKelas = async () => {
            if (!selectedCabang) return;
            try {
                const cabangObj = cabangList.find(c => c.id === selectedCabang);
                if (!cabangObj) {
                    console.log("DEBUG: Cabang tidak ditemukan di list");
                    return;
                }

                console.log("DEBUG: Mencari kelas untuk cabang:", cabangObj.nama);

                const q = query(collection(db, "kelas"), where("cabang", "==", cabangObj.nama));
                const qSiswa = query(collection(db, "siswa"), where("cabang", "==", cabangObj.nama));

                const [querySnapshot, siswaSnapshot] = await Promise.all([
                    getDocs(q),
                    getDocs(qSiswa)
                ]);
                
                console.log("DEBUG: Ditemukan dokumen kelas:", querySnapshot.size);
                console.log("DEBUG: Ditemukan dokumen siswa:", siswaSnapshot.size);

                // Hitung jumlah siswa per kelas berdasarkan data di collection 'siswa'
                const realStudentCounts: Record<string, number> = {};
                siswaSnapshot.docs.forEach(doc => {
                    const sData = doc.data();
                    const sKelas = sData.kelas;
                    if (sKelas && typeof sKelas === 'string') {
                        realStudentCounts[sKelas] = (realStudentCounts[sKelas] || 0) + 1;
                    }
                });

                const extractedClasses: string[] = [];

                querySnapshot.docs.forEach(doc => {
                    const data = doc.data() as Kelas;
                    if (Array.isArray(data.namaKelas)) {
                        data.namaKelas.forEach(nama => {
                            if (typeof nama === 'string') extractedClasses.push(nama);
                        });
                    } else if (typeof data.namaKelas === 'string') {
                        extractedClasses.push(data.namaKelas);
                    } else if (typeof data.nama === 'string') {
                        extractedClasses.push(data.nama);
                    }
                });

                console.log("DEBUG: Kelas terekstrak:", extractedClasses);

                // Hapus duplikat dan urutkan abjad
                const uniqueClasses = Array.from(new Set(extractedClasses)).sort();

                const initialPPDB: CapaianPPDB = {};
                const initialJumlahSiswa: JumlahSiswa = {};
                
                uniqueClasses.forEach(nama => { 
                    initialPPDB[nama] = { target: '', capaian: '' };
                    initialJumlahSiswa[nama] = { jumlah: realStudentCounts[nama] || 0, keterangan: '' };
                });

                // Hanya reset data jika BUKAN mode edit
                if (!editId) {
                    setCapaianPPDB(initialPPDB);
                    setJumlahSiswa(initialJumlahSiswa);
                }
            } catch(error) {
                console.error("Error fetching kelas data:", error);
            }
        };
        fetchKelas();
    }, [selectedCabang, cabangList, editId]);
    
    const handleNext = () => currentStep < steps.length && setCurrentStep(prev => prev + 1);
    const handlePrev = () => currentStep > 1 && setCurrentStep(prev => prev - 1);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        const semesterName = semesters.find(s => s.id === selectedSemester)?.namaPeriode || 'Unknown';
        const cabangName = cabangList.find(c => c.id === selectedCabang)?.nama || 'Unknown';

        // Upload Dokumentasi ke Firebase Storage
        const uploadedUrls = await Promise.all(
            dokumentasi.map(async (item, index) => {
                if (!item) return null;
                if (typeof item === 'string') return item; // Sudah berupa URL (dari edit)

                const storageRef = ref(storage, `laporan_bulanan/${Date.now()}_${index}_${item.name}`);
                await uploadBytes(storageRef, item);
                return await getDownloadURL(storageRef);
            })
        );
        const finalDokumentasi = uploadedUrls.filter(url => url !== null);

        const fullReportData = {
            informasiDasar: { 
                semesterId: selectedSemester,
                semester: semesterName,
                bulan: selectedBulan, 
                cabangId: selectedCabang,
                cabang: cabangName,
                disusunOleh 
            },
            ringkasanEksekutif,
            capaianOKR,
            capaianPPDB,
            keuanganSingkat,
            jumlahSiswa,
            isuStrategis,
            rekomendasiKegiatan,
            rencanaAgenda,
            dokumentasi: finalDokumentasi,
            createdAt: new Date()
        };

        try {
            if (editId) {
                await updateDoc(doc(db, "laporan_bulanan", editId), fullReportData);
                alert("Laporan berhasil diperbarui!");
            } else {
                await addDoc(collection(db, "laporan_bulanan"), fullReportData);
                alert("Laporan berhasil disimpan!");
            }
            router.push('/admin/laporan/bulanan');
        } catch (error) {
            console.error("Error adding document: ", error);
            alert("Gagal menyimpan laporan. Silakan coba lagi.");
            setIsLoading(false);
        }
    };

    const renderStepContent = () => {
        switch (currentStep) {
            case 1:
                return (
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2"><Calendar className="w-5 h-5" /> Informasi Dasar</h3>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Pilih Semester</label>
                            <select value={selectedSemester} onChange={(e) => setSelectedSemester(e.target.value)} className="w-full border rounded-lg p-2 bg-white outline-none" disabled={!semesters || semesters.length === 0}>
                                {semesters && semesters.map(s => <option key={s.id} value={s.id}>{s.namaPeriode}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Pilih Periode Bulan</label>
                            <select value={selectedBulan} onChange={(e) => setSelectedBulan(e.target.value)} className="w-full border rounded-lg p-2 bg-white outline-none">
                                {['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'].map(b => <option key={b}>{b}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Pilih Cabang</label>
                            <select value={selectedCabang} disabled className="w-full border rounded-lg p-2 bg-gray-100 outline-none">
                                {cabangList && cabangList.map(c => <option key={c.id} value={c.id}>{c.nama}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Disusun Oleh</label>
                            <input type="text" value={disusunOleh} readOnly className="w-full border rounded-lg p-2 bg-gray-100" />
                        </div>
                    </div>
                );
            case 2: // Ringkasan Eksekutif
                return (
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2"><Briefcase className="w-5 h-5" /> A. Ringkasan Eksekutif</h3>
                        {(Object.keys(ringkasanEksekutif) as Array<keyof RingkasanEksekutif>).map((key) => (
                            <div key={key}>
                                <label className="block text-sm font-medium text-gray-700 mb-1">{ringkasanEksekutifLabels[key]}</label>
                                <textarea
                                    rows={4}
                                    value={ringkasanEksekutif[key]}
                                    onChange={(e) => setRingkasanEksekutif(prev => ({ ...prev, [key]: e.target.value }))}
                                    className="w-full border rounded-lg p-2 outline-none"
                                />
                            </div>
                        ))}
                    </div>
                );
            case 3: // Capaian OKR
                return (
                    <div className="space-y-4">
                         <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2"><Target className="w-5 h-5" /> B. Capaian OKR</h3>
                        {(Object.keys(capaianOKR) as Array<keyof CapaianOKR>).map((key) => (
                            <div key={key}>
                                <label className="block text-sm font-medium text-gray-700 mb-1">{capaianOKRLabels[key]}</label>
                                <textarea
                                    rows={4}
                                    value={capaianOKR[key]}
                                    onChange={(e) => setCapaianOKR(prev => ({ ...prev, [key]: e.target.value }))}
                                    className="w-full border rounded-lg p-2 outline-none"
                                />
                            </div>
                        ))}
                    </div>
                );
            case 4: // Capaian PPDB
                const totalTarget = Object.values(capaianPPDB).reduce((sum, val) => sum + Number(val.target || 0), 0);
                const totalCapaian = Object.values(capaianPPDB).reduce((sum, val) => sum + Number(val.capaian || 0), 0);
                const totalSisa = totalTarget - totalCapaian;
                const totalProsentase = totalTarget > 0 ? (totalCapaian / totalTarget * 100).toFixed(1) : 0;
                return (
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2"><Users className="w-5 h-5" /> C. Capaian PPDB</h3>
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-max border-collapse">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="p-2 border text-left text-sm font-semibold text-gray-600">Kelas</th>
                                        <th className="p-2 border text-left text-sm font-semibold text-gray-600">Target</th>
                                        <th className="p-2 border text-left text-sm font-semibold text-gray-600">Capaian</th>
                                        <th className="p-2 border text-left text-sm font-semibold text-gray-600">Sisa</th>
                                        <th className="p-2 border text-left text-sm font-semibold text-gray-600">%</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {Object.keys(capaianPPDB).map(namaKelas => {
                                        const { target, capaian } = capaianPPDB[namaKelas];
                                        const sisa = Number(target || 0) - Number(capaian || 0);
                                        const prosentase = Number(target || 0) > 0 ? (Number(capaian || 0) / Number(target || 0) * 100).toFixed(1) : 0;
                                        return (
                                            <tr key={namaKelas}>
                                                <td className="p-2 border font-medium">{namaKelas}</td>
                                                <td className="p-2 border"><input type="number" value={target} onChange={e => setCapaianPPDB(p => ({...p, [namaKelas]: {...p[namaKelas], target: e.target.value}}))} className="w-full p-1 border rounded" /></td>
                                                <td className="p-2 border"><input type="number" value={capaian} onChange={e => setCapaianPPDB(p => ({...p, [namaKelas]: {...p[namaKelas], capaian: e.target.value}}))} className="w-full p-1 border rounded" /></td>
                                                <td className="p-2 border bg-gray-50">{sisa}</td>
                                                <td className="p-2 border bg-gray-50">{prosentase}%</td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                                <tfoot className="font-bold bg-gray-100">
                                    <tr>
                                        <td className="p-2 border">Total</td>
                                        <td className="p-2 border">{totalTarget}</td>
                                        <td className="p-2 border">{totalCapaian}</td>
                                        <td className="p-2 border">{totalSisa}</td>
                                        <td className="p-2 border">{totalProsentase}%</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                );
            case 5: // Keuangan Singkat
                const addKeuanganRow = () => setKeuanganSingkat(k => [...k, { id: Date.now(), pos: '', pengajuan: '', realisasi: '', catatan: '' }]);
                const removeKeuanganRow = (id: number) => setKeuanganSingkat(k => k.filter(row => row.id !== id));
                const handleKeuanganChange = (id: number, field: keyof KeuanganSingkat, value: string) => {
                    let newValue = value;
                    if (field === 'pengajuan' || field === 'realisasi') {
                        // Hapus karakter non-digit lalu format dengan titik
                        const rawValue = value.replace(/\D/g, '');
                        newValue = rawValue.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
                    }
                    setKeuanganSingkat(k => k.map(row => row.id === id ? { ...row, [field]: newValue } : row));
                };
                return (
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2"><DollarSign className="w-5 h-5" /> D. Keuangan Singkat</h3>
                        {keuanganSingkat.map((row) => (
                            <div key={row.id} className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end p-2 border rounded-lg">
                                <input type="text" placeholder="Pos" value={row.pos} onChange={e => handleKeuanganChange(row.id, 'pos', e.target.value)} className="w-full p-1 border rounded" />
                                <input type="text" placeholder="Pengajuan" value={row.pengajuan} onChange={e => handleKeuanganChange(row.id, 'pengajuan', e.target.value)} className="w-full p-1 border rounded" />
                                <input type="text" placeholder="Realisasi" value={row.realisasi} onChange={e => handleKeuanganChange(row.id, 'realisasi', e.target.value)} className="w-full p-1 border rounded" />
                                <div className="flex gap-2">
                                <input type="text" placeholder="Catatan" value={row.catatan} onChange={e => handleKeuanganChange(row.id, 'catatan', e.target.value)} className="w-full p-1 border rounded" />
                                <button type="button" onClick={() => removeKeuanganRow(row.id)} className="p-2 text-red-500 hover:bg-red-100 rounded" disabled={keuanganSingkat.length <= 1}><Trash2 className="w-4 h-4" /></button>
                                </div>
                            </div>
                        ))}
                         <button type="button" onClick={addKeuanganRow} className="flex items-center gap-2 text-sm text-white bg-[#ff984e] hover:bg-[#e88b45] px-3 py-2 rounded-md"><Plus className="w-4 h-4" /> Tambah Baris</button>
                    </div>
                );
             case 6: // Jumlah Siswa
                return (
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2"><Home className="w-5 h-5" /> E. Jumlah Siswa</h3>
                        <table className="w-full min-w-max border-collapse">
                             <thead className="bg-gray-50">
                                <tr>
                                    <th className="p-2 border text-left text-sm font-semibold text-gray-600">Kelas</th>
                                    <th className="p-2 border text-left text-sm font-semibold text-gray-600">Jumlah</th>
                                    <th className="p-2 border text-left text-sm font-semibold text-gray-600">Keterangan</th>
                                </tr>
                            </thead>
                            <tbody>
                                {Object.keys(jumlahSiswa).map(namaKelas => (
                                    <tr key={namaKelas}>
                                        <td className="p-2 border font-medium">{namaKelas}</td>
                                        <td className="p-2 border bg-gray-50">{jumlahSiswa[namaKelas].jumlah}</td>
                                        <td className="p-2 border"><input type="text" value={jumlahSiswa[namaKelas].keterangan} onChange={e => setJumlahSiswa(p => ({ ...p, [namaKelas]: { ...p[namaKelas], keterangan: e.target.value } }))} className="w-full p-1 border rounded" /></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                );
            case 7: // Isu Strategis
                return (
                     <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2"><Lightbulb className="w-5 h-5" /> F. Isu Strategis Bulan Ini</h3>
                        <textarea rows={6} value={isuStrategis} onChange={(e) => setIsuStrategis(e.target.value)} className="w-full border rounded-lg p-2 outline-none" />
                    </div>
                );
            case 8: // Rekomendasi
                return (
                     <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2"><Activity className="w-5 h-5" /> G. Rekomendasi Kegiatan</h3>
                        <textarea rows={6} value={rekomendasiKegiatan} onChange={(e) => setRekomendasiKegiatan(e.target.value)} className="w-full border rounded-lg p-2 outline-none" />
                    </div>
                );
            case 9: // Rencana Agenda
                 const addAgendaRow = () => setRencanaAgenda(p => ({ ...p, detail: [...p.detail, { id: Date.now(), tanggal: '', kegiatan: '' }] }));
                 const removeAgendaRow = (id: number) => setRencanaAgenda(p => ({...p, detail: p.detail.filter(d => d.id !== id)}));
                 const handleAgendaChange = (id: number, field: keyof RencanaAgendaDetail, value: string) => {
                    setRencanaAgenda(p => ({...p, detail: p.detail.map(d => d.id === id ? {...d, [field]: value} : d)}));
                 };
                return (
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2"><BookOpen className="w-5 h-5" /> H. Rencana Agenda Bulan Depan</h3>
                        <div>
                             <label className="block text-sm font-medium text-gray-700 mb-1">Tema Pembelajaran</label>
                             <input type="text" value={rencanaAgenda.tema} onChange={e => setRencanaAgenda(p => ({ ...p, tema: e.target.value }))} className="w-full border rounded-lg p-2" />
                        </div>
                         <div>
                             <label className="block text-sm font-medium text-gray-700 mb-1">Deskripsi Singkat</label>
                             <textarea rows={4} value={rencanaAgenda.deskripsi} onChange={e => setRencanaAgenda(p => ({ ...p, deskripsi: e.target.value }))} className="w-full border rounded-lg p-2" />
                        </div>
                        <h4 className="font-semibold pt-2">Detail Kegiatan</h4>
                        {rencanaAgenda.detail.map(item => (
                             <div key={item.id} className="flex gap-2 items-center">
                                <input type="date" value={item.tanggal} onChange={e => handleAgendaChange(item.id, 'tanggal', e.target.value)} className="w-full p-1 border rounded" />
                                <input type="text" placeholder="Kegiatan" value={item.kegiatan} onChange={e => handleAgendaChange(item.id, 'kegiatan', e.target.value)} className="w-full p-1 border rounded" />
                                <button type="button" onClick={() => removeAgendaRow(item.id)} disabled={rencanaAgenda.detail.length <= 1} className="p-2 text-red-500 hover:bg-red-100 rounded"><Trash2 className="w-4 h-4" /></button>
                             </div>
                        ))}
                        <button type="button" onClick={addAgendaRow} className="flex items-center gap-2 text-sm text-white bg-[#ff984e] hover:bg-[#e88b45] px-3 py-2 rounded-md"><Plus className="w-4 h-4" /> Tambah Kegiatan</button>
                    </div>
                );
            case 10: // Dokumentasi
                const handleFileChange = (index: number, file: File | null) => {
                    const newFiles = [...dokumentasi];
                    newFiles[index] = file;
                    setDokumentasi(newFiles);
                }
                const removeFile = (index: number) => {
                    const newFiles = [...dokumentasi];
                    newFiles[index] = null;
                    setDokumentasi(newFiles);
                }
                return (
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2"><Upload className="w-5 h-5" /> I. Dokumentasi Kegiatan</h3>
                         <p className="text-sm text-gray-500">Upload hingga 4 foto kegiatan.</p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {dokumentasi.map((file, index) => {
                                let previewUrl = null;
                                if (file instanceof File) previewUrl = URL.createObjectURL(file);
                                else if (typeof file === 'string') previewUrl = file;

                                return (
                                <div key={index} className="w-full h-32 border-2 border-dashed rounded-lg flex items-center justify-center relative">
                                    {!previewUrl && <input type="file" accept="image/*" onChange={(e: ChangeEvent<HTMLInputElement>) => handleFileChange(index, e.target.files ? e.target.files[0] : null)} className="absolute w-full h-full opacity-0 cursor-pointer z-10" />}
                                    {previewUrl ? (
                                        <div className="relative w-full h-full">
                                            <img src={previewUrl} alt={`Dokumentasi ${index + 1}`} className="w-full h-full object-cover rounded-lg" />
                                            <button type="button" onClick={() => removeFile(index)} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 z-20 hover:bg-red-600"><Trash2 className="w-3 h-3" /></button>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center text-gray-400">
                                            <Upload className="w-6 h-6 mb-1" />
                                            <span className="text-xs">Upload</span>
                                        </div>
                                    )}
                                </div>
                                );
                            })}
                        </div>
                    </div>
                );
            case 11: // Konfirmasi
                 return (
                    <div className="space-y-6 bg-gray-50 p-6 rounded-lg border">
                        <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2"><CheckCircle2 className="w-5 h-5 text-green-600"/> Konfirmasi Data Laporan</h3>
                        <div className="text-sm space-y-3">
                            <p><strong>Semester:</strong> {semesters.find(s => s.id === selectedSemester)?.namaPeriode}</p>
                            <p><strong>Periode:</strong> {selectedBulan}</p>
                            <p><strong>Cabang:</strong> {cabangList.find(c => c.id === selectedCabang)?.nama}</p>
                            {/* Tambahkan preview data lain di sini jika perlu */}
                        </div>
                        <p className="text-xs text-gray-500 pt-4 border-t">Pastikan semua data yang Anda masukkan sudah benar sebelum menyimpan.</p>
                    </div>
                );
            default: return null;
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Link href="/admin/laporan/bulanan" className="p-2 hover:bg-gray-100 rounded-full">
                    <ArrowLeft className="w-5 h-5 text-gray-600" />
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">{editId ? 'Edit Laporan Bulanan' : 'Buat Laporan Bulanan Baru'}</h1>
                    <p className="text-sm text-gray-500">Langkah {currentStep} dari {steps.length}: {steps[currentStep - 1].name}</p>
                </div>
            </div>

            {/* Stepper */}
             <div className="flex items-center">
                {steps.map((step, index) => (
                <React.Fragment key={step.id}>
                    <div className={`flex flex-col items-center cursor-pointer ${currentStep >= step.id ? 'text-[#581c87]' : 'text-gray-400'}`} onClick={() => setCurrentStep(step.id)}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 font-bold ${currentStep >= step.id ? 'bg-[#581c87] text-white border-[#581c87]' : 'border-gray-300 bg-gray-50'}`}>
                           {step.id}
                        </div>
                         <p className="text-xs mt-2 text-center font-medium max-w-20">{step.name}</p>
                    </div>
                    {index < steps.length - 1 && (
                    <div className={`flex-auto border-t-2 transition-colors duration-500 ${currentStep > index + 1 ? 'border-[#581c87]' : 'border-gray-300'}`}></div>
                    )}
                </React.Fragment>
                ))}
            </div>

            <form onSubmit={handleSubmit} className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 space-y-6">
                
                {renderStepContent()}

                {/* Navigation Buttons */}
                <div className="flex justify-between pt-6 border-t mt-8">
                    <button type="button" onClick={handlePrev} disabled={currentStep === 1 || isLoading} className="bg-gray-200 text-gray-800 px-6 py-2 rounded-lg hover:bg-gray-300 transition disabled:opacity-50 disabled:cursor-not-allowed">
                        Kembali
                    </button>

                    {currentStep < steps.length ? (
                        <button type="button" onClick={handleNext} className="bg-[#581c87] text-white px-6 py-2 rounded-lg hover:bg-[#45156b] transition">
                            Lanjutkan
                        </button>
                    ) : (
                        <button type="submit" disabled={isLoading} className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition font-medium flex items-center justify-center gap-2">
                            {isLoading ? 'Menyimpan...' : <><Save className="w-4 h-4" /> {editId ? 'Perbarui Laporan' : 'Simpan Laporan'}</>}
                        </button>
                    )}
                </div>
            </form>
        </div>
    );
}