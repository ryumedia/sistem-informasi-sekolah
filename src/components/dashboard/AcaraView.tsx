"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, Timestamp, orderBy, doc, getDoc } from "firebase/firestore";
import { ArrowLeft, Calendar, Clock, MapPin, Map, CheckCircle, Camera } from "lucide-react";
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

interface Acara {
  id: string;
  nama: string;
  tanggal: Timestamp;
  waktu: string;
  tempat: string;
  linkGMap?: string;
  linkDokumentasi?: string;
}

export default function AcaraView({ userData, onBack }: { userData: any, onBack: () => void }) {
  const [acaraList, setAcaraList] = useState<Acara[]>([]);
  const [loading, setLoading] = useState(true);
  const [attendedEvents, setAttendedEvents] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchAcara = async () => {
      if (!userData?.cabang) {
        setLoading(false);
        return;
      }

      try {
        // 1. Ambil semua acara yang relevan, diurutkan dari terbaru
        const q = query(
          collection(db, "acara"), 
          where("cabang", "array-contains", userData.cabang),
          orderBy("tanggal", "desc")
        );

        const snap = await getDocs(q);
        const items = snap.docs.map(d => ({ id: d.id, ...d.data() } as Acara));
        setAcaraList(items);

        // 2. Cek status kehadiran untuk setiap acara secara paralel
        if (items.length > 0 && userData.id) {
          const attendancePromises = items.map(acara => 
            getDoc(doc(db, 'acara', acara.id, 'peserta', userData.id))
          );
          
          const attendanceSnapshots = await Promise.all(attendancePromises);
          
          const attendedIds = new Set<string>();
          attendanceSnapshots.forEach((snap, index) => {
            if (snap.exists()) {
              attendedIds.add(items[index].id);
            }
          });
          setAttendedEvents(attendedIds);
        }

      } catch (err) {
        console.error("Error fetching acara:", err);
        // Optionally show an error message to the user
      } finally {
        setLoading(false);
      }
    };
    fetchAcara();
  }, [userData]);

  const formatDate = (timestamp: Timestamp) => {
    if (!timestamp) return "-";
    return format(timestamp.toDate(), 'EEEE, d MMMM yyyy', { locale: id });
  };

  return (
    <div className="flex-1 bg-gray-50 min-h-screen flex flex-col">
       <header className="bg-white p-4 shadow-sm sticky top-0 z-10 flex items-center gap-3">
          <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <h1 className="text-lg font-bold text-gray-800">Acara Mendatang</h1>
       </header>

       <div className="p-4 space-y-4">
          {loading ? (
             <div className="text-center py-10 text-gray-500">Memuat acara...</div>
          ) : acaraList.length === 0 ? (
             <div className="text-center py-10 text-gray-500 bg-white rounded-xl p-6">Tidak ada acara mendatang untuk cabang Anda.</div>
          ) : (
             <div className="space-y-3">
               {acaraList.map((item) => (
                 <div key={item.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 relative">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-bold text-gray-800 pr-16">{item.nama}</h3>
                      {attendedEvents.has(item.id) && (
                        <div className="absolute top-4 right-4 flex items-center gap-1 bg-green-100 text-green-800 text-xs font-semibold px-2 py-1 rounded-full">
                          <CheckCircle className="w-3 h-3" />
                          Hadir
                        </div>
                      )}
                    </div>
                    <div className="space-y-2 text-sm text-gray-600">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-purple-500" />
                        <span>{formatDate(item.tanggal)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-blue-500" />
                        <span>{item.waktu}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-orange-500" />
                        <span>{item.tempat}</span>
                      </div>
                    </div>
                    {(item.linkGMap || item.linkDokumentasi) && (
                      <div className="border-t mt-3 pt-3 flex justify-end gap-2">
                        {item.linkDokumentasi && (
                          <a href={item.linkDokumentasi} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 bg-purple-600 text-white px-3 py-1.5 rounded-lg hover:bg-purple-700 transition text-xs font-medium">
                            <Camera className="w-3 h-3" />
                            Lihat Dokumentasi
                          </a>
                        )}
                        {item.linkGMap && (
                          <a href={item.linkGMap} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition text-xs font-medium">
                            <Map className="w-3 h-3" />
                            Lihat Peta
                          </a>
                        )}
                      </div>
                    )}
                 </div>
               ))}
             </div>
          )}
       </div>
    </div>
  );
}