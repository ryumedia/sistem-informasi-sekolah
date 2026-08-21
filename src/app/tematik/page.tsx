"use client";

import { useState, useEffect, FormEvent, useMemo } from 'react';
import Image from 'next/image';
import { db } from '@/lib/firebase';
import { collection, query, getDocs, addDoc, Timestamp, orderBy } from 'firebase/firestore';
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

// --- INTERFACES ---
interface Lokasi {
    id: string;
    nama: string;
}

interface KuotaTematik {
    id: string;
    lokasi: string;
    bulan: string;
    kuota: number;
}

interface FormData {
    lokasi: string;
    bulan: string;
    namaAnak: string;
    namaPanggilan: string;
    namaOrangTua: string;
    nomorWa: string;
    alamat: string;
}

export default function PendaftaranKelasTematikPage() {
    const [formData, setFormData] = useState<FormData>({
        lokasi: '',
        bulan: '',
        namaAnak: '',
        namaPanggilan: '',
        namaOrangTua: '',
        nomorWa: '',
        alamat: '',
    });

    const [lokasiOptions, setLokasiOptions] = useState<Lokasi[]>([]);
    const [kuotaTematikList, setKuotaTematikList] = useState<KuotaTematik[]>([]);

    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    // Fetch Lokasi & Kuota Tematik
    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const lokasiQuery = query(collection(db, "lokasi_pendaftaran"), orderBy("nama", "asc"));
                const kuotaQuery = query(collection(db, "kuota_tematik"), orderBy("lokasi", "asc"));

                const [lokasiSnap, kuotaSnap] = await Promise.all([
                    getDocs(lokasiQuery),
                    getDocs(kuotaQuery),
                ]);

                setLokasiOptions(lokasiSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Lokasi)));
                setKuotaTematikList(kuotaSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as KuotaTematik)));
            } catch (err) {
                console.error("Error fetching data:", err);
                setError("Gagal memuat data pendaftaran. Silakan coba lagi nanti.");
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    // Filter bulan berdasarkan lokasi yang dipilih & kuota > 0
    const availableMonths = useMemo(() => {
        if (!formData.lokasi) return [];
        return kuotaTematikList.filter(
            item => item.lokasi === formData.lokasi && Number(item.kuota) > 0
        );
    }, [formData.lokasi, kuotaTematikList]);

    // Cek apakah lokasi yang dipilih tidak memiliki kuota / data kuota habis
    const isLocationFullOrEmpty = useMemo(() => {
        if (!formData.lokasi) return false;
        return availableMonths.length === 0;
    }, [formData.lokasi, availableMonths]);

    const handleInputChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
    ) => {
        const { name, value } = e.target;
        setFormData(prev => {
            const newState = { ...prev, [name]: value };
            if (name === 'lokasi') {
                newState.bulan = '';
            }
            return newState;
        });
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (isLocationFullOrEmpty) return;

        setIsSubmitting(true);
        setError(null);
        setSuccessMessage(null);

        try {
            await addDoc(collection(db, "pendaftaran_tematik"), {
                ...formData,
                tanggalPendaftaran: Timestamp.now(),
                status: "Baru"
            });

            setSuccessMessage("Pendaftaran Kelas Tematik berhasil dikirim! Kami akan segera menghubungi Anda.");
            setFormData({
                lokasi: '',
                bulan: '',
                namaAnak: '',
                namaPanggilan: '',
                namaOrangTua: '',
                nomorWa: '',
                alamat: '',
            });
        } catch (err) {
            console.error("Error submitting registration:", err);
            setError("Gagal mengirim pendaftaran. Silakan coba lagi.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-50 flex flex-col items-center justify-center p-4 py-8 sm:py-12 text-gray-900 dark:text-gray-900">
            <div className="w-full max-w-2xl">
                {/* LOGO & TITLE */}
                <div className="text-center mb-6">
                    <Image
                        src="/logo.png"
                        alt="Logo Main Riang"
                        width={150}
                        height={150}
                        className="mx-auto"
                        priority
                    />
                    <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-800 mt-4">Pendaftaran Kelas Tematik</h1>
                    <p className="text-sm text-gray-600 dark:text-gray-600 mt-1">Silakan lengkapi formulir pendaftaran di bawah ini.</p>
                </div>

                {/* FORM CONTAINER */}
                <div className="bg-white dark:bg-white rounded-2xl shadow-lg border border-gray-100 dark:border-gray-200 p-6 sm:p-8">
                    {loading ? (
                        <div className="flex flex-col justify-center items-center p-12 space-y-3">
                            <Loader2 className="w-10 h-10 animate-spin text-purple-600 dark:text-purple-600" />
                            <p className="text-sm text-gray-600 dark:text-gray-600 font-medium">Memuat data pendaftaran...</p>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-6">
                            {/* STATUS MESSAGES */}
                            {successMessage && (
                                <div className="bg-green-50 dark:bg-green-50 border border-green-200 dark:border-green-200 text-green-800 dark:text-green-800 p-4 rounded-xl flex items-center gap-3">
                                    <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-600 shrink-0" />
                                    <p className="text-sm font-medium">{successMessage}</p>
                                </div>
                            )}

                            {error && (
                                <div className="bg-red-50 dark:bg-red-50 border border-red-200 dark:border-red-200 text-red-800 dark:text-red-800 p-4 rounded-xl flex items-center gap-3">
                                    <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-600 shrink-0" />
                                    <p className="text-sm font-medium">{error}</p>
                                </div>
                            )}

                            {/* 1. PILIH LOKASI */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-700 mb-1">
                                    Pilih Lokasi <span className="text-red-500">*</span>
                                </label>
                                <select
                                    name="lokasi"
                                    value={formData.lokasi}
                                    onChange={handleInputChange}
                                    required
                                    className="w-full border border-gray-300 dark:border-gray-300 rounded-lg p-2.5 bg-white dark:bg-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none text-gray-900 dark:text-gray-900"
                                >
                                    <option value="" disabled className="bg-white dark:bg-white text-gray-900 dark:text-gray-900">-- Pilih Lokasi --</option>
                                    {lokasiOptions.map(opt => (
                                        <option key={opt.id} value={opt.nama} className="bg-white dark:bg-white text-gray-900 dark:text-gray-900">{opt.nama}</option>
                                    ))}
                                </select>
                            </div>

                            {/* ALERT BILA KUOTA HABIS / DATA TIDAK TERSEDIA */}
                            {formData.lokasi && isLocationFullOrEmpty && (
                                <div className="bg-red-50 dark:bg-red-50 border border-red-200 dark:border-red-200 text-red-800 dark:text-red-800 p-4 rounded-xl flex items-start gap-3 animate-fadeIn">
                                    <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-600 shrink-0 mt-0.5" />
                                    <div>
                                        <h4 className="font-bold text-sm text-red-800 dark:text-red-800">Kelas Tematik Pada Lokasi Ini Sudah Penuh</h4>
                                        <p className="text-xs text-red-600 dark:text-red-600 mt-1">
                                            Mohon maaf, kuota untuk lokasi ini tidak tersedia atau sudah habis. Silakan pilih lokasi pendaftaran lainnya.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* ISIAN FORMULIR LAINNYA (DISABLED JIKA BELUM PILIH LOKASI ATAU KUOTA HABIS) */}
                            <fieldset disabled={!formData.lokasi || isLocationFullOrEmpty} className="space-y-6 disabled:opacity-60 transition-opacity">
                                {/* 2. PILIH BULAN */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-700 mb-1">
                                        Pilih Bulan <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        name="bulan"
                                        value={formData.bulan}
                                        onChange={handleInputChange}
                                        required
                                        className="w-full border border-gray-300 dark:border-gray-300 rounded-lg p-2.5 bg-white dark:bg-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none text-gray-900 dark:text-gray-900 disabled:bg-gray-100 dark:disabled:bg-gray-100 disabled:text-gray-500 dark:disabled:text-gray-500 disabled:cursor-not-allowed"
                                    >
                                        <option value="" disabled className="bg-white dark:bg-white text-gray-900 dark:text-gray-900">-- Pilih Bulan --</option>
                                        {availableMonths.map(opt => (
                                            <option key={opt.id} value={opt.bulan} className="bg-white dark:bg-white text-gray-900 dark:text-gray-900">
                                                {opt.bulan} (Sisa Kuota: {opt.kuota})
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* 3 & 4. NAMA ANAR & NAMA PANGGILAN */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-700 mb-1">
                                            Nama Lengkap Anak <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            name="namaAnak"
                                            value={formData.namaAnak}
                                            onChange={handleInputChange}
                                            required
                                            placeholder="Masukkan nama lengkap anak"
                                            className="w-full border border-gray-300 dark:border-gray-300 rounded-lg p-2.5 bg-white dark:bg-white focus:ring-2 focus:ring-purple-500 outline-none text-gray-900 dark:text-gray-900 placeholder:text-gray-400 dark:placeholder:text-gray-400 disabled:bg-gray-100 dark:disabled:bg-gray-100 disabled:text-gray-500 dark:disabled:text-gray-500 disabled:cursor-not-allowed"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-700 mb-1">
                                            Nama Panggilan <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            name="namaPanggilan"
                                            value={formData.namaPanggilan}
                                            onChange={handleInputChange}
                                            required
                                            placeholder="Masukkan nama panggilan"
                                            className="w-full border border-gray-300 dark:border-gray-300 rounded-lg p-2.5 bg-white dark:bg-white focus:ring-2 focus:ring-purple-500 outline-none text-gray-900 dark:text-gray-900 placeholder:text-gray-400 dark:placeholder:text-gray-400 disabled:bg-gray-100 dark:disabled:bg-gray-100 disabled:text-gray-500 dark:disabled:text-gray-500 disabled:cursor-not-allowed"
                                        />
                                    </div>
                                </div>

                                {/* 5 & 6. NAMA ORANG TUA & NOMOR WA */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-700 mb-1">
                                            Nama Orang Tua <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            name="namaOrangTua"
                                            value={formData.namaOrangTua}
                                            onChange={handleInputChange}
                                            required
                                            placeholder="Masukkan nama orang tua"
                                            className="w-full border border-gray-300 dark:border-gray-300 rounded-lg p-2.5 bg-white dark:bg-white focus:ring-2 focus:ring-purple-500 outline-none text-gray-900 dark:text-gray-900 placeholder:text-gray-400 dark:placeholder:text-gray-400 disabled:bg-gray-100 dark:disabled:bg-gray-100 disabled:text-gray-500 dark:disabled:text-gray-500 disabled:cursor-not-allowed"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-700 mb-1">
                                            Nomor WA Orang Tua <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="tel"
                                            name="nomorWa"
                                            value={formData.nomorWa}
                                            onChange={handleInputChange}
                                            required
                                            placeholder="Contoh: 08123456789"
                                            className="w-full border border-gray-300 dark:border-gray-300 rounded-lg p-2.5 bg-white dark:bg-white focus:ring-2 focus:ring-purple-500 outline-none text-gray-900 dark:text-gray-900 placeholder:text-gray-400 dark:placeholder:text-gray-400 disabled:bg-gray-100 dark:disabled:bg-gray-100 disabled:text-gray-500 dark:disabled:text-gray-500 disabled:cursor-not-allowed"
                                        />
                                    </div>
                                </div>

                                {/* 7. ALAMAT */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-700 mb-1">
                                        Alamat <span className="text-red-500">*</span>
                                    </label>
                                    <textarea
                                        name="alamat"
                                        value={formData.alamat}
                                        onChange={handleInputChange}
                                        required
                                        rows={3}
                                        placeholder="Masukkan alamat lengkap"
                                        className="w-full border border-gray-300 dark:border-gray-300 rounded-lg p-2.5 bg-white dark:bg-white focus:ring-2 focus:ring-purple-500 outline-none text-gray-900 dark:text-gray-900 placeholder:text-gray-400 dark:placeholder:text-gray-400 disabled:bg-gray-100 dark:disabled:bg-gray-100 disabled:text-gray-500 dark:disabled:text-gray-500 disabled:cursor-not-allowed"
                                    ></textarea>
                                </div>

                                {/* SUBMIT BUTTON */}
                                <div className="pt-2">
                                    <button
                                        type="submit"
                                        disabled={isSubmitting || !formData.lokasi || isLocationFullOrEmpty}
                                        className="w-full bg-purple-600 dark:bg-purple-600 text-white dark:text-white font-bold py-3 px-4 rounded-xl hover:bg-purple-700 dark:hover:bg-purple-700 transition disabled:bg-gray-300 dark:disabled:bg-gray-300 disabled:text-gray-500 dark:disabled:text-gray-500 disabled:cursor-not-allowed shadow-md flex items-center justify-center gap-2 text-base"
                                    >
                                        {isSubmitting ? (
                                            <>
                                                <Loader2 className="w-5 h-5 animate-spin" /> Mendaftar...
                                            </>
                                        ) : (
                                            'Kirim Pendaftaran Kelas Tematik'
                                        )}
                                    </button>
                                </div>
                            </fieldset>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
