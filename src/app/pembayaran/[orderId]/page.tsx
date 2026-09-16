"use client";

import { useState, useEffect, use, useRef } from 'react';
import Link from 'next/link';
import { Loader2, ShieldCheck } from 'lucide-react';
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";

interface PembayaranDoc {
  id: string;
  tagihanId: string;
  siswaId: string;
  siswaNama?: string;
  siswaEmail?: string;
  jumlahBayar: number;
  transactionId?: string;
  snapToken?: string;
  status: string;
}

export default function HalamanPembayaranSnap({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = use(params);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const snapOpened = useRef(false);

  useEffect(() => {
    // Muat script Midtrans Snap
    const clientKey = process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY;
    const script = document.createElement('script');
    script.src = "https://app.sandbox.midtrans.com/snap/snap.js"; // Ganti ke URL production jika sudah live
    script.setAttribute('data-client-key', clientKey || '');
    script.async = true;

    const onSnapReady = async () => {
      if (snapOpened.current) return;
      snapOpened.current = true;

      try {
        // 1. Cari dokumen pembayaran berdasarkan Order ID di URL (validasi eksistensi)
        const q = query(
          collection(db, "pembayaran"),
          where("transactionId", "==", orderId)
        );
        const snapPembayaran = await getDocs(q);
        if (snapPembayaran.empty) {
          throw new Error('Transaksi tidak ditemukan.');
        }
        const pembayaran = { id: snapPembayaran.docs[0].id, ...snapPembayaran.docs[0].data() } as PembayaranDoc;

        if (pembayaran.status !== 'pending') {
          throw new Error('Transaksi ini sudah tidak dapat dibayar.');
        }

        // 2. Ambil token Snap: utamakan dari dokumen Firestore (disimpan saat transaksi
        //    dibuat). Jika dokumen lama tidak punya token, minta ke backend via Get Status.
        let snapToken = pembayaran.snapToken;
        if (!snapToken) {
          const response = await fetch(`/api/midtrans?order_id=${encodeURIComponent(orderId)}`);
          const data = await response.json();
          if (data.error || !data.token) {
            throw new Error(data.error || 'Token pembayaran tidak diterima.');
          }
          if (data.transaction_status && data.transaction_status !== 'pending') {
            window.location.href = `/pembayaran/selesai?order_id=${orderId}&transaction_status=${data.transaction_status}`;
            return;
          }
          snapToken = data.token;
        }

        // 3. Buka Snap di halaman ini
        setStatus('ready');
        (window as any).snap.pay(snapToken, {
          onSuccess: (result: any) => {
            window.location.href = `/pembayaran/selesai?order_id=${result.order_id}&status_code=${result.status_code}&transaction_status=${result.transaction_status}`;
          },
          onPending: (result: any) => {
            window.location.href = `/pembayaran/selesai?order_id=${result.order_id}&status_code=${result.status_code}&transaction_status=${result.transaction_status}`;
          },
          onError: (result: any) => {
            window.location.href = `/pembayaran/selesai?order_id=${result.order_id}&status_code=${result.status_code}&transaction_status=error`;
          },
          onClose: () => {
            // Jika user menutup Snap, tampilkan tombol untuk membuka lagi
            setStatus('error');
            setErrorMessage('Kamu menutup halaman pembayaran. Klik tombol di bawah untuk membayar lagi.');
          },
        });
      } catch (error: any) {
        console.error('Gagal memuat pembayaran:', error);
        setStatus('error');
        setErrorMessage(error.message || 'Gagal memuat halaman pembayaran.');
      }
    };

    script.onload = () => {
      // Snap punya callback global saat siap
      if ((window as any).snap) {
        onSnapReady();
      } else {
        script.addEventListener('load', () => setTimeout(onSnapReady, 500));
        setTimeout(onSnapReady, 1500);
      }
    };
    script.onerror = () => {
      setStatus('error');
      setErrorMessage('Gagal memuat modul pembayaran. Periksa koneksi internet kamu.');
    };

    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, [orderId]);

  return (
    <div className="flex-1 bg-gray-50 min-h-screen flex-col">
      <header className="bg-white p-4 shadow-sm sticky top-0 z-10 flex items-center gap-3">
        <ShieldCheck className="w-5 h-5 text-purple-600" />
        <h1 className="text-lg font-bold text-gray-800">Halaman Pembayaran</h1>
      </header>

      <div className="flex-1 flex-col items-center justify-center p-6 text-center">
        {status === 'loading' && (
          <>
            <Loader2 className="w-10 h-10 animate-spin text-purple-600" />
            <p className="mt-4 text-gray-600">Menyiapkan halaman pembayaran...</p>
            <p className="mt-1 text-xs font-mono text-gray-400">Order ID: {orderId}</p>
          </>
        )}

        {status === 'ready' && (
          <p className="text-gray-600">Menampilkan opsi pembayaran...</p>
        )}

        {status === 'error' && (
          <>
            <p className="text-red-600 font-medium">{errorMessage}</p>
            <p className="mt-1 text-xs font-mono text-gray-400">Order ID: {orderId}</p>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => window.location.reload()}
                className="bg-[#581c87] text-white px-5 py-2.5 rounded-lg hover:bg-[#45156b] transition text-sm font-medium"
              >
                Coba Lagi
              </button>
              <Link
                href="/"
                className="bg-gray-100 text-gray-700 px-5 py-2.5 rounded-lg hover:bg-gray-200 transition text-sm font-medium"
              >
                Kembali
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
