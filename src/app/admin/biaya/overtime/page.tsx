"use client";

import { useState, useEffect } from 'react';
import { Timer, Search, Pencil, Trash2, X, RotateCcw } from 'lucide-react';
import { db, auth } from '@/lib/firebase';
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  where,
  getDocs,
  doc,
  deleteDoc,
  updateDoc,
  Timestamp,
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

// --- INTERFACES ---
interface OvertimeEntry {
  id: string;
  tanggal: string; // contoh: "2025-01-15"
  nama: string;
  cabang: string;
  kelas: string;
  jenis: string; // contoh: "Kedatangan" | "Kepulangan"
  waktu: string; // jam, contoh: "11:25"
  nominal: number; // dalam rupiah
}

// --- MAIN COMPONENT ---
export default function OvertimePage() {
  const [overtimeList, setOvertimeList] = useState<OvertimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const unsubscribe = onSnapshot(
      query(collection(db, 'overtime')),
      (snapshot) => {
        const items = snapshot.docs.map(d => {
          const data = d.data();
          const rawTanggal = data.tanggal;
          return {
            id: d.id,
            tanggal:
              typeof rawTanggal === 'string'
                ? rawTanggal
                : rawTanggal?.toDate
                  ? rawTanggal.toDate().toISOString().slice(0, 10)
                  : '',
            nama: data.nama || '',
            cabang: data.cabang || '',
            kelas: data.kelas || '',
            jenis: data.jenis || '',
            waktu: data.waktu || '',
            nominal: Number(data.nominal) || 0,
          } as OvertimeEntry;
        });
        items.sort((a, b) =>
          `${b.tanggal} ${b.waktu}`.localeCompare(`${a.tanggal} ${a.waktu}`)
        );
        setOvertimeList(items);
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching overtime:', error);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  const filteredList = overtimeList.filter(item =>
    [item.nama, item.cabang, item.kelas, item.jenis, item.tanggal]
      .join(' ')
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  const totalNominal = filteredList.reduce((sum, item) => sum + (item.nominal || 0), 0);

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Timer className="w-6 h-6" /> Biaya Overtime
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Daftar biaya overtime per siswa, cabang, dan kelas.
          </p>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari nama, cabang, kelas..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full border rounded-lg pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>
      </div>

      {/* TABLE */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50 text-gray-900 font-semibold border-b">
              <tr>
                <th className="p-4 w-12 text-center">No.</th>
                <th className="p-4">Tanggal</th>
                <th className="p-4">Nama</th>
                <th className="p-4">Cabang</th>
                <th className="p-4">Kelas</th>
                <th className="p-4">Jenis</th>
                <th className="p-4">Waktu</th>
                <th className="p-4">Nominal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-gray-500">
                    Memuat data overtime...
                  </td>
                </tr>
              ) : filteredList.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-gray-500">
                    {overtimeList.length === 0
                      ? 'Belum ada data biaya overtime.'
                      : 'Tidak ada data yang sesuai pencarian.'}
                  </td>
                </tr>
              ) : (
                filteredList.map((item, index) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="p-4 text-center">{index + 1}</td>
                    <td className="p-4 whitespace-nowrap">
                      {item.tanggal
                        ? new Date(item.tanggal).toLocaleDateString('id-ID', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })
                        : '-'}
                    </td>
                    <td className="p-4 font-medium text-gray-900">{item.nama}</td>
                    <td className="p-4">{item.cabang}</td>
                    <td className="p-4">{item.kelas}</td>
                    <td className="p-4">{item.jenis}</td>
                    <td className="p-4">{item.waktu}</td>
                    <td className="p-4 font-semibold text-blue-700">
                      Rp {item.nominal.toLocaleString('id-ID')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {filteredList.length > 0 && (
              <tfoot className="bg-gray-50 border-t font-semibold text-gray-900">
                <tr>
                  <td className="p-4 text-right" colSpan={7}>Total</td>
                  <td className="p-4 text-blue-700">Rp {totalNominal.toLocaleString('id-ID')}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
