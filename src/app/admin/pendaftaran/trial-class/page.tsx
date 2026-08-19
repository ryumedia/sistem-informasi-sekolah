"use client";

import { useState, useEffect, useMemo } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';
import { Loader2, Filter, RotateCcw, MapPin, Calendar, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

interface TrialClassParticipant {
  id: string;
  namaAnak: string;
  namaPanggilan: string;
  lokasi: string; // Pilihan Lokasi
  tanggal: string; // Pilihan Tanggal (YYYY-MM-DD)
  waktu: string; // Pilihan Waktu (HH:mm)
  alamat: string;
  nomorWa: string;
  program: string; // Program yang dipilih
  tanggalPendaftaran: any; // Timestamp of registration submission
}

function WhatsAppIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
    </svg>
  );
}

export default function TrialClassPage() {
  const [participants, setParticipants] = useState<TrialClassParticipant[]>([]);
  const [masterLokasi, setMasterLokasi] = useState<string[]>([]);
  const [masterJadwal, setMasterJadwal] = useState<{ lokasi?: string; tanggal?: string; waktu?: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter States
  const [filterLokasi, setFilterLokasi] = useState<string>('');
  const [filterTanggal, setFilterTanggal] = useState<string>('');
  const [filterWaktu, setFilterWaktu] = useState<string>('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const qTrial = query(collection(db, "pendaftaran_trial"), orderBy("tanggalPendaftaran", "desc"));
        const qLokasi = query(collection(db, "lokasi_pendaftaran"), orderBy("nama", "asc"));
        const qJadwal = query(collection(db, "jadwal_trial"), orderBy("tanggal", "asc"));

        const [snapTrial, snapLokasi, snapJadwal] = await Promise.allSettled([
          getDocs(qTrial),
          getDocs(qLokasi),
          getDocs(qJadwal)
        ]);

        if (snapTrial.status === "fulfilled") {
          const list = snapTrial.value.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          } as TrialClassParticipant));
          setParticipants(list);
        } else {
          throw snapTrial.reason;
        }

        if (snapLokasi.status === "fulfilled") {
          const loks = snapLokasi.value.docs.map(doc => doc.data().nama as string).filter(Boolean);
          setMasterLokasi(loks);
        }

        if (snapJadwal.status === "fulfilled") {
          const jadwals = snapJadwal.value.docs.map(doc => doc.data() as { lokasi?: string; tanggal?: string; waktu?: string });
          setMasterJadwal(jadwals);
        }
      } catch (error) {
        console.error("Error fetching pendaftaran trial data: ", error);
        setError("Gagal memuat data pendaftar trial class. Silakan coba lagi.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Function to format the trial date string (YYYY-MM-DD)
  const formatTrialDate = (dateString: string) => {
    if (!dateString) return "-";
    try {
      const date = new Date(dateString + 'T00:00:00');
      return format(date, 'EEEE, d MMMM yyyy', { locale: id });
    } catch {
      return dateString;
    }
  };

  // Options for Pilihan Lokasi
  const lokasiOptions = useMemo(() => {
    const set = new Set<string>(masterLokasi);
    participants.forEach(p => {
      if (p.lokasi?.trim()) set.add(p.lokasi.trim());
    });
    return Array.from(set).sort();
  }, [masterLokasi, participants]);

  // Options for Pilihan Tanggal
  const tanggalOptions = useMemo(() => {
    const set = new Set<string>();
    masterJadwal.forEach(j => {
      if (!filterLokasi || j.lokasi === filterLokasi) {
        if (j.tanggal?.trim()) set.add(j.tanggal.trim());
      }
    });
    participants.forEach(p => {
      if (!filterLokasi || p.lokasi === filterLokasi) {
        if (p.tanggal?.trim()) set.add(p.tanggal.trim());
      }
    });
    return Array.from(set).sort();
  }, [masterJadwal, participants, filterLokasi]);

  // Options for Pilihan Waktu
  const waktuOptions = useMemo(() => {
    const set = new Set<string>();
    masterJadwal.forEach(j => {
      const matchLokasi = !filterLokasi || j.lokasi === filterLokasi;
      const matchTanggal = !filterTanggal || j.tanggal === filterTanggal;
      if (matchLokasi && matchTanggal && j.waktu?.trim()) {
        set.add(j.waktu.trim());
      }
    });
    participants.forEach(p => {
      const matchLokasi = !filterLokasi || p.lokasi === filterLokasi;
      const matchTanggal = !filterTanggal || p.tanggal === filterTanggal;
      if (matchLokasi && matchTanggal && p.waktu?.trim()) {
        set.add(p.waktu.trim());
      }
    });
    return Array.from(set).sort();
  }, [masterJadwal, participants, filterLokasi, filterTanggal]);

  // Filtered Participants
  const filteredParticipants = useMemo(() => {
    return participants.filter(p => {
      if (filterLokasi && p.lokasi !== filterLokasi) return false;
      if (filterTanggal && p.tanggal !== filterTanggal) return false;
      if (filterWaktu && p.waktu !== filterWaktu) return false;
      return true;
    });
  }, [participants, filterLokasi, filterTanggal, filterWaktu]);

  const resetFilters = () => {
    setFilterLokasi('');
    setFilterTanggal('');
    setFilterWaktu('');
  };

  const hasActiveFilter = filterLokasi || filterTanggal || filterWaktu;

  // Helper to format WhatsApp URL and open chat
  const getWhatsAppUrl = (nomorWa: string, namaAnak?: string) => {
    if (!nomorWa) return "";
    let cleanNumber = nomorWa.replace(/\D/g, "");
    if (cleanNumber.startsWith("0")) {
      cleanNumber = "62" + cleanNumber.slice(1);
    } else if (!cleanNumber.startsWith("62")) {
      cleanNumber = "62" + cleanNumber;
    }

    const text = encodeURIComponent(
      `Halo Ayah/Bunda${namaAnak ? ` dari ananda ${namaAnak}` : ""}, kami dari tim pendaftaran ingin mengonfirmasi terkait jadwal Trial Class.`
    );

    return `https://wa.me/${cleanNumber}?text=${text}`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Pendaftar Trial Class</h1>
        <p className="text-sm text-gray-500">Daftar semua peserta yang mendaftar untuk kelas percobaan.</p>
        {error && <div className="mt-4 p-3 bg-red-100 text-red-700 rounded-lg">{error}</div>}
      </div>

      {/* Filter Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-gray-800 font-semibold text-sm">
            <Filter className="w-4 h-4 text-[#581c87]" />
            <span>Filter Data Pendaftar</span>
          </div>
          {hasActiveFilter && (
            <button
              onClick={resetFilters}
              className="flex items-center gap-1.5 text-xs font-medium text-purple-700 hover:text-purple-900 bg-purple-50 hover:bg-purple-100 px-3 py-1.5 rounded-lg transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset Filter
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          {/* Filter Pilihan Lokasi */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-gray-400" /> Pilihan Lokasi
            </label>
            <select
              value={filterLokasi}
              onChange={(e) => {
                setFilterLokasi(e.target.value);
                setFilterTanggal('');
                setFilterWaktu('');
              }}
              className="w-full p-2.5 border border-gray-200 rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-[#581c87] focus:border-transparent outline-none transition text-sm"
            >
              <option value="">Semua Lokasi</option>
              {lokasiOptions.map(lok => (
                <option key={lok} value={lok}>{lok}</option>
              ))}
            </select>
          </div>

          {/* Filter Pilihan Tanggal */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-gray-400" /> Pilihan Tanggal
            </label>
            <select
              value={filterTanggal}
              onChange={(e) => {
                setFilterTanggal(e.target.value);
                setFilterWaktu('');
              }}
              className="w-full p-2.5 border border-gray-200 rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-[#581c87] focus:border-transparent outline-none transition text-sm"
            >
              <option value="">Semua Tanggal</option>
              {tanggalOptions.map(tgl => (
                <option key={tgl} value={tgl}>{formatTrialDate(tgl)}</option>
              ))}
            </select>
          </div>

          {/* Filter Pilihan Waktu */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-gray-400" /> Pilihan Waktu
            </label>
            <select
              value={filterWaktu}
              onChange={(e) => setFilterWaktu(e.target.value)}
              className="w-full p-2.5 border border-gray-200 rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-[#581c87] focus:border-transparent outline-none transition text-sm"
            >
              <option value="">Semua Waktu</option>
              {waktuOptions.map(wkt => (
                <option key={wkt} value={wkt}>{wkt}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Summary Badge */}
      <div className="bg-purple-50 border border-purple-200 text-purple-800 text-sm font-medium p-3 rounded-lg flex items-center justify-between">
        <span>Total Pendaftar ditemukan: <span className="font-bold">{filteredParticipants.length}</span></span>
        {hasActiveFilter && (
          <span className="text-xs bg-purple-200/70 text-purple-900 px-2.5 py-0.5 rounded-full font-semibold">Filter Aktif</span>
        )}
      </div>

      {/* Table Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50 text-gray-900 font-semibold border-b">
              <tr>
                <th className="p-4 w-12 text-center">No.</th>
                <th className="p-4">Nama Anak & Panggilan</th>
                <th className="p-4">Pilihan Lokasi</th>
                <th className="p-4">Pilihan Tanggal</th>
                <th className="p-4">Pilihan Waktu</th>
                <th className="p-4">Alamat</th>
                <th className="p-4">Nomor WA</th>
                <th className="p-4 text-center w-36">Hubungi WA</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={8} className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-[#581c87]" /></td></tr>
              ) : filteredParticipants.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-gray-500">
                    {participants.length === 0 ? "Belum ada pendaftar trial class." : "Tidak ada pendaftar yang sesuai dengan filter yang dipilih."}
                  </td>
                </tr>
              ) : (
                filteredParticipants.map((p, index) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="p-4 text-center">{index + 1}</td>
                    <td className="p-4 font-medium text-gray-900">
                      {p.namaAnak} {p.namaPanggilan ? `(${p.namaPanggilan})` : ''}
                    </td>
                    <td className="p-4">{p.lokasi || '-'}</td>
                    <td className="p-4">{formatTrialDate(p.tanggal)}</td>
                    <td className="p-4">{p.waktu || '-'}</td>
                    <td className="p-4">{p.alamat || '-'}</td>
                    <td className="p-4">{p.nomorWa || '-'}</td>
                    <td className="p-4 text-center">
                      {p.nomorWa ? (
                        <a
                          href={getWhatsAppUrl(p.nomorWa, p.namaAnak)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg shadow-sm hover:shadow transition"
                          title={`Hubungi ${p.namaAnak} via WhatsApp (${p.nomorWa})`}
                        >
                          <WhatsAppIcon className="w-3.5 h-3.5 fill-current" />
                          <span>Hubungi WA</span>
                        </a>
                      ) : (
                        <span className="text-gray-400 text-xs">-</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}