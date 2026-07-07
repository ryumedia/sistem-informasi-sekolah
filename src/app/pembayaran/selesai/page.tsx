"use client";

import { Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { CheckCircle, XCircle, Clock, ArrowLeft } from 'lucide-react';
import { useEffect } from 'react';

function StatusContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const transactionStatus = searchParams.get('transaction_status');
  const orderId = searchParams.get('order_id');
  const statusCode = searchParams.get('status_code');

  useEffect(() => {
    // Jika pengguna kembali ke halaman ini (misalnya dengan tombol back browser)
    // dan tidak ada status, arahkan mereka kembali ke dashboard.
    if (!transactionStatus) {
      router.replace('/dashboard');
    }
  }, [transactionStatus, router]);

  const getStatusInfo = () => {
    switch (transactionStatus) {
      case 'settlement':
      case 'capture':
        return {
          Icon: CheckCircle,
          title: 'Pembayaran Berhasil',
          message: 'Terima kasih! Pembayaran Anda telah kami terima dan tagihan Anda sedang diperbarui.',
          color: 'text-green-500',
        };
      case 'pending':
        return {
          Icon: Clock,
          title: 'Pembayaran Tertunda',
          message: 'Kami sedang menunggu konfirmasi pembayaran Anda. Silakan selesaikan pembayaran sebelum batas waktu.',
          color: 'text-yellow-500',
        };
      case 'deny':
      case 'cancel':
      case 'expire':
        return {
          Icon: XCircle,
          title: 'Pembayaran Gagal',
          message: 'Maaf, pembayaran Anda gagal atau dibatalkan. Silakan coba lagi atau gunakan metode pembayaran lain.',
          color: 'text-red-500',
        };
      default:
        return {
          Icon: Clock,
          title: 'Memverifikasi Pembayaran...',
          message: 'Mohon tunggu sebentar, kami sedang memeriksa status pembayaran Anda.',
          color: 'text-gray-500',
        };
    }
  };

  const { Icon, title, message, color } = getStatusInfo();

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4 text-center">
      <div className="bg-white p-8 rounded-2xl shadow-lg max-w-md w-full">
        <Icon className={`w-20 h-20 mx-auto ${color}`} />
        <h1 className="text-2xl font-bold text-gray-800 mt-6 mb-2">{title}</h1>
        <p className="text-gray-600 mb-6">{message}</p>
        {orderId && (
          <div className="text-sm text-gray-500 bg-gray-100 px-4 py-2 rounded-lg inline-block">
            Order ID: {orderId}
          </div>
        )}
        <button
          onClick={() => router.push('/')}
          className="mt-8 w-full bg-[#581c87] text-white py-3 rounded-lg hover:bg-[#45156b] transition font-medium flex items-center justify-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Kembali ke Halaman Utama
        </button>
      </div>
    </div>
  );
}

export default function SelesaiPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <StatusContent />
        </Suspense>
    )
}
