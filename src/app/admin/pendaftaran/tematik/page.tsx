"use client";

import { useState, useEffect, useMemo } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, getDocs, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { Loader2, Filter, RotateCcw, MapPin, Calendar, Trash2, Edit, X } from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

interface TematikParticipant {
    id: string;
    namaAnak: string;
    namaPanggilan: string;
    namaOrangTua: string;
    lokasi: string;
    bulan: string;
    alamat: string;
    nomorWa: string;
    tanggalPendaftaran?: { toDate?: () => Date } | Date | string | number;
    status: string;
}

function WhatsAppIcon({ className = "w-4 h-4" }: { className?: string }) {
    return (
        <svg className={className} fill="currentColor" viewBox="0 0 24 24">
            <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
        </svg>
    );
}

export default function AdminTematikPage() {
    const [participants, setParticipants] = useState<TematikParticipant[]>([]);
    const [masterLokasi, setMasterLokasi] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Modal state for Edit
    const [editingParticipant, setEditingParticipant] = useState<TematikParticipant | null>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);

    // Filters
    const [filterLokasi, setFilterLokasi] = useState<string>('');
    const [filterBulan, setFilterBulan] = useState<string>('');
    const [filterStatus, setFilterStatus] = useState<string>('');

    useEffect(() => {
        const fetchData = async () => {
            try {
                const qTematik = query(collection(db, "pendaftaran_tematik"), orderBy("tanggalPendaftaran", "desc"));
                const qLokasi = query(collection(db, "lokasi_pendaftaran"), orderBy("nama", "asc"));

                const [snapTematik, snapLokasi] = await Promise.allSettled([
                    getDocs(qTematik),
                    getDocs(qLokasi)
                ]);

                if (snapTematik.status === "fulfilled") {
                    const list = snapTematik.value.docs.map(docSnap => ({
                        id: docSnap.id,
                        ...docSnap.data()
                    } as TematikParticipant));
                    setParticipants(list);
                }

                if (snapLokasi.status === "fulfilled") {
                    const loks = snapLokasi.value.docs.map(docSnap => docSnap.data().nama as string).filter(Boolean);
                    setMasterLokasi(loks);
                }
            } catch (err) {
                console.error("Error fetching data:", err);
                setError("Gagal memuat data pendaftar Kelas Tematik.");
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const handleDelete = async (id: string) => {
        if (!confirm("Yakin ingin menghapus pendaftaran ini?")) return;
        try {
            await deleteDoc(doc(db, "pendaftaran_tematik", id));
            setParticipants(prev => prev.filter(p => p.id !== id));
        } catch (err) {
            console.error("Error deleting registration:", err);
            alert("Gagal menghapus pendaftaran.");
        }
    };

    const handleSaveEdit = async (formData: Partial<TematikParticipant>) => {
        if (!editingParticipant) return;
        try {
            const docRef = doc(db, "pendaftaran_tematik", editingParticipant.id);
            await updateDoc(docRef, formData);

            setParticipants(prev =>
                prev.map(p => p.id === editingParticipant.id ? { ...p, ...formData } as TematikParticipant : p)
            );
            setIsEditModalOpen(false);
            setEditingParticipant(null);
        } catch (err) {
            console.error("Error updating participant:", err);
            alert("Gagal memperbarui data pendaftaran.");
        }
    };

    const getStatusBadge = (status?: string) => {
        const currentStatus = status || 'Baru';
        switch (currentStatus) {
            case 'Sudah Bayar':
                return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800">Sudah Bayar</span>;
            case 'Berakhir':
                return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-700 border border-gray-200">Berakhir</span>;
            case 'Baru':
            default:
                return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">Baru</span>;
        }
    };

    const lokasiOptions = useMemo(() => {
        const set = new Set<string>(masterLokasi);
        participants.forEach(p => {
            if (p.lokasi?.trim()) set.add(p.lokasi.trim());
        });
        return Array.from(set).sort();
    }, [masterLokasi, participants]);

    const bulanOptions = useMemo(() => {
        const set = new Set<string>();
        participants.forEach(p => {
            if (!filterLokasi || p.lokasi === filterLokasi) {
                if (p.bulan?.trim()) set.add(p.bulan.trim());
            }
        });
        return Array.from(set).sort();
    }, [participants, filterLokasi]);

    const filteredParticipants = useMemo(() => {
        return participants.filter(p => {
            if (filterLokasi && p.lokasi !== filterLokasi) return false;
            if (filterBulan && p.bulan !== filterBulan) return false;
            if (filterStatus && (p.status || 'Baru') !== filterStatus) return false;
            return true;
        });
    }, [participants, filterLokasi, filterBulan, filterStatus]);

    const resetFilters = () => {
        setFilterLokasi('');
        setFilterBulan('');
        setFilterStatus('');
    };

    const getWhatsAppUrl = (nomorWa: string, namaAnak?: string) => {
        if (!nomorWa) return "";
        let cleanNumber = nomorWa.replace(/\D/g, "");
        if (cleanNumber.startsWith("0")) {
            cleanNumber = "62" + cleanNumber.slice(1);
        } else if (!cleanNumber.startsWith("62")) {
            cleanNumber = "62" + cleanNumber;
        }

        const text = encodeURIComponent(
            `Halo Ayah/Bunda${namaAnak ? ` dari ananda ${namaAnak}` : ""}, kami dari tim pendaftaran ingin mengonfirmasi terkait pendaftaran Kelas Tematik.`
        );

        return `https://wa.me/${cleanNumber}?text=${text}`;
    };

    const formatDate = (timestamp: { toDate?: () => Date } | Date | string | number | null | undefined) => {
        if (!timestamp) return "-";
        try {
            const date = (timestamp && typeof timestamp === 'object' && 'toDate' in timestamp && typeof timestamp.toDate === 'function')
                ? timestamp.toDate()
                : new Date(timestamp as string | number | Date);
            return format(date, 'd MMMM yyyy, HH:mm', { locale: id });
        } catch {
            return "-";
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-800">Pendaftar Kelas Tematik</h1>
                <p className="text-sm text-gray-500">Daftar semua peserta yang telah mendaftar untuk Kelas Tematik.</p>
                {error && <div className="mt-4 p-3 bg-red-100 text-red-700 rounded-lg">{error}</div>}
            </div>

            {/* FILTER SECTION */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-gray-800 font-semibold text-sm">
                        <Filter className="w-4 h-4 text-orange-600" />
                        <span>Filter Data Pendaftar</span>
                    </div>
                    {(filterLokasi || filterBulan || filterStatus) && (
                        <button
                            onClick={resetFilters}
                            className="flex items-center gap-1.5 text-xs font-medium text-orange-700 hover:text-orange-900 bg-orange-50 hover:bg-orange-100 px-3 py-1.5 rounded-lg transition"
                        >
                            <RotateCcw className="w-3.5 h-3.5" />
                            Reset Filter
                        </button>
                    )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                    <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1 flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-gray-400" /> Pilihan Lokasi
                        </label>
                        <select
                            value={filterLokasi}
                            onChange={(e) => {
                                setFilterLokasi(e.target.value);
                                setFilterBulan('');
                            }}
                            className="w-full p-2.5 border border-gray-200 rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-orange-500 outline-none transition text-sm"
                        >
                            <option value="">Semua Lokasi</option>
                            {lokasiOptions.map(lok => (
                                <option key={lok} value={lok}>{lok}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1 flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-gray-400" /> Pilihan Bulan
                        </label>
                        <select
                            value={filterBulan}
                            onChange={(e) => setFilterBulan(e.target.value)}
                            className="w-full p-2.5 border border-gray-200 rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-orange-500 outline-none transition text-sm"
                        >
                            <option value="">Semua Bulan</option>
                            {bulanOptions.map(bln => (
                                <option key={bln} value={bln}>{bln}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1 flex items-center gap-1">
                            Status Pendaftaran
                        </label>
                        <select
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                            className="w-full p-2.5 border border-gray-200 rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-orange-500 outline-none transition text-sm"
                        >
                            <option value="">Semua Status</option>
                            <option value="Baru">Baru</option>
                            <option value="Sudah Bayar">Sudah Bayar</option>
                            <option value="Berakhir">Berakhir</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* SUMMARY BADGE */}
            <div className="bg-orange-50 border border-orange-200 text-orange-800 text-sm font-medium p-3 rounded-lg flex items-center justify-between">
                <span>Total Pendaftar ditemukan: <span className="font-bold">{filteredParticipants.length}</span></span>
                {(filterLokasi || filterBulan || filterStatus) && (
                    <span className="text-xs bg-orange-200/70 text-orange-900 px-2.5 py-0.5 rounded-full font-semibold">Filter Aktif</span>
                )}
            </div>

            {/* TABLE SECTION */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-gray-600">
                        <thead className="bg-gray-50 text-gray-900 font-semibold border-b">
                            <tr>
                                <th className="p-4 w-12 text-center">No.</th>
                                <th className="p-4">Tanggal Daftar</th>
                                <th className="p-4">Nama Anak</th>
                                <th className="p-4">Orang Tua</th>
                                <th className="p-4">Lokasi</th>
                                <th className="p-4">Bulan</th>
                                <th className="p-4">Alamat</th>
                                <th className="p-4 text-center">Status</th>
                                <th className="p-4 text-center w-32">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                <tr><td colSpan={9} className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-orange-600" /></td></tr>
                            ) : filteredParticipants.length === 0 ? (
                                <tr>
                                    <td colSpan={9} className="p-8 text-center text-gray-500">
                                        {participants.length === 0 ? "Belum ada pendaftar Kelas Tematik." : "Tidak ada pendaftar yang sesuai dengan filter."}
                                    </td>
                                </tr>
                            ) : (
                                filteredParticipants.map((p, index) => (
                                    <tr key={p.id} className="hover:bg-gray-50">
                                        <td className="p-4 text-center">{index + 1}</td>
                                        <td className="p-4 text-xs text-gray-500">{formatDate(p.tanggalPendaftaran)}</td>
                                        <td className="p-4 font-medium text-gray-900">
                                            {p.namaAnak} {p.namaPanggilan ? `(${p.namaPanggilan})` : ''}
                                        </td>
                                        <td className="p-4">{p.namaOrangTua || '-'}</td>
                                        <td className="p-4">{p.lokasi || '-'}</td>
                                        <td className="p-4 font-semibold text-orange-700">{p.bulan || '-'}</td>
                                        <td className="p-4">{p.alamat || '-'}</td>
                                        <td className="p-4 text-center">{getStatusBadge(p.status)}</td>
                                        <td className="p-4 text-center">
                                            <div className="flex justify-center items-center gap-1">
                                                {p.nomorWa ? (
                                                    <a
                                                        href={getWhatsAppUrl(p.nomorWa, p.namaAnak)}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition"
                                                        title={`Hubungi WA (${p.nomorWa})`}
                                                    >
                                                        <WhatsAppIcon className="w-4 h-4 fill-current" />
                                                    </a>
                                                ) : (
                                                    <span className="p-2 text-gray-300" title="Tidak ada nomor WA">
                                                        <WhatsAppIcon className="w-4 h-4 fill-current" />
                                                    </span>
                                                )}
                                                <button
                                                    onClick={() => { setEditingParticipant(p); setIsEditModalOpen(true); }}
                                                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                                                    title="Edit Data / Status"
                                                >
                                                    <Edit className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(p.id)}
                                                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                                                    title="Hapus"
                                                >
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

            {/* EDIT MODAL */}
            {isEditModalOpen && editingParticipant && (
                <EditTematikModal
                    data={editingParticipant}
                    onClose={() => { setIsEditModalOpen(false); setEditingParticipant(null); }}
                    onSave={handleSaveEdit}
                />
            )}
        </div>
    );
}

// --- MODAL EDIT COMPONENT ---
function EditTematikModal({
    data,
    onClose,
    onSave
}: {
    data: TematikParticipant;
    onClose: () => void;
    onSave: (formData: Partial<TematikParticipant>) => Promise<void>;
}) {
    const [formData, setFormData] = useState({
        status: data.status || 'Baru',
        namaAnak: data.namaAnak || '',
        namaPanggilan: data.namaPanggilan || '',
        namaOrangTua: data.namaOrangTua || '',
        lokasi: data.lokasi || '',
        bulan: data.bulan || '',
        nomorWa: data.nomorWa || '',
        alamat: data.alamat || '',
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        await onSave(formData);
        setIsSubmitting(false);
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden">
                <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2">
                        <Edit className="w-5 h-5 text-orange-600" /> Edit Pendaftaran Kelas Tematik
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-200 transition">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
                    <div>
                        <label className="block text-sm font-semibold text-gray-800 mb-1">Status Pendaftaran</label>
                        <select
                            value={formData.status}
                            onChange={e => setFormData({ ...formData, status: e.target.value })}
                            className="w-full border border-gray-300 rounded-lg p-2.5 bg-white text-gray-900 font-medium focus:ring-2 focus:ring-orange-500 outline-none"
                        >
                            <option value="Baru">Baru</option>
                            <option value="Sudah Bayar">Sudah Bayar</option>
                            <option value="Berakhir">Berakhir</option>
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Nama Lengkap Anak</label>
                            <input
                                required
                                value={formData.namaAnak}
                                onChange={e => setFormData({ ...formData, namaAnak: e.target.value })}
                                className="w-full border border-gray-300 rounded-lg p-2 text-gray-900 focus:ring-2 focus:ring-orange-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Nama Panggilan</label>
                            <input
                                required
                                value={formData.namaPanggilan}
                                onChange={e => setFormData({ ...formData, namaPanggilan: e.target.value })}
                                className="w-full border border-gray-300 rounded-lg p-2 text-gray-900 focus:ring-2 focus:ring-orange-500 outline-none"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Nama Orang Tua</label>
                            <input
                                required
                                value={formData.namaOrangTua}
                                onChange={e => setFormData({ ...formData, namaOrangTua: e.target.value })}
                                className="w-full border border-gray-300 rounded-lg p-2 text-gray-900 focus:ring-2 focus:ring-orange-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Nomor WA Orang Tua</label>
                            <input
                                required
                                value={formData.nomorWa}
                                onChange={e => setFormData({ ...formData, nomorWa: e.target.value })}
                                className="w-full border border-gray-300 rounded-lg p-2 text-gray-900 focus:ring-2 focus:ring-orange-500 outline-none"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Lokasi</label>
                            <input
                                required
                                value={formData.lokasi}
                                onChange={e => setFormData({ ...formData, lokasi: e.target.value })}
                                className="w-full border border-gray-300 rounded-lg p-2 text-gray-900 focus:ring-2 focus:ring-orange-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Bulan</label>
                            <input
                                required
                                value={formData.bulan}
                                onChange={e => setFormData({ ...formData, bulan: e.target.value })}
                                className="w-full border border-gray-300 rounded-lg p-2 text-gray-900 focus:ring-2 focus:ring-orange-500 outline-none"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Alamat</label>
                        <textarea
                            required
                            rows={3}
                            value={formData.alamat}
                            onChange={e => setFormData({ ...formData, alamat: e.target.value })}
                            className="w-full border border-gray-300 rounded-lg p-2 text-gray-900 focus:ring-2 focus:ring-orange-500 outline-none"
                        ></textarea>
                    </div>

                    <div className="pt-3 flex justify-end gap-3 border-t border-gray-100">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 border border-gray-300 transition"
                        >
                            Batal
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-purple-700 transition disabled:opacity-50 shadow-md"
                        >
                            {isSubmitting ? 'Menyimpan...' : 'Simpan'}  
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
