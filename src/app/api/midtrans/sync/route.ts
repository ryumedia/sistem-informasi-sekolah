import { NextResponse } from 'next/server';
import { db as adminDb } from '@/lib/firebase-admin';

/**
 * Endpoint sinkronisasi status pembayaran dari Midtrans ke Firestore.
 * Dipanggil dari halaman pembayaran sebagai cadangan jika webhook Midtrans
 * tidak berhasil mengirim notifikasi (misal saat development di localhost).
 */
export async function POST(request: Request) {
  try {
    const { order_id } = await request.json();
    if (!order_id) {
      return NextResponse.json({ error: 'order_id wajib diisi.' }, { status: 400 });
    }

    // 1. Cari dokumen pembayaran berdasarkan order_id
    const pembayaranSnap = await adminDb
      .collection("pembayaran")
      .where("transactionId", "==", order_id)
      .limit(1)
      .get();

    if (pembayaranSnap.empty) {
      return NextResponse.json({ error: 'Transaksi tidak ditemukan.' }, { status: 404 });
    }
    const pembayaranDoc = pembayaranSnap.docs[0];
    const pembayaranData = pembayaranDoc.data();

    // 2. Jika sudah settlement di aplikasi, tidak perlu sinkron lagi
    if (pembayaranData.status === 'settlement' || pembayaranData.status === 'capture') {
      return NextResponse.json({ status: 'ok', message: 'Sudah sinkron.' });
    }

    // 3. Ambil status terbaru langsung dari Midtrans
    const serverKey = process.env.MIDTRANS_SERVER_KEY;
    if (!serverKey) {
      throw new Error("MIDTRANS_SERVER_KEY is not set in environment variables");
    }
    const midtransClient = (await import('midtrans-client')).default;
    const snap = new midtransClient.Snap({
      isProduction: false,
      serverKey: serverKey,
      clientKey: process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY || '',
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const transaction = await (snap as any).transaction.status(order_id);

    const statusMidtrans = transaction.transaction_status;
    const fraudStatus = transaction.fraud_status;

    // 4. Update status pembayaran di Firestore jika berubah
    if (pembayaranData.status !== statusMidtrans) {
      await pembayaranDoc.ref.update({ status: statusMidtrans });

      // 5. Jika sukses, update juga data tagihan (logika sama dengan webhook)
      if (
        (statusMidtrans === 'settlement' || statusMidtrans === 'capture') &&
        (!fraudStatus || fraudStatus === 'accept')
      ) {
        const tagihanRef = adminDb.collection('tagihan_siswa').doc(pembayaranData.tagihanId);
        const tagihanDoc = await tagihanRef.get();

        if (tagihanDoc.exists) {
          const tagihanData = tagihanDoc.data();
          const nominalDibayarSebelumnya = tagihanData?.dibayar || 0;
          const nominalPembayaranIni = pembayaranData.jumlahBayar;
          const totalDibayar = nominalDibayarSebelumnya + nominalPembayaranIni;
          const sisaTagihan = (tagihanData?.nominal || 0) - totalDibayar;

          await tagihanRef.update({
            dibayar: totalDibayar,
            status: sisaTagihan <= 0 ? 'Lunas' : 'Belum Lunas',
          });
        }
      }
    }

    return NextResponse.json({ status: 'ok', transaction_status: statusMidtrans });
  } catch (error: any) {
    console.error('Sync endpoint error:', error.message);
    return NextResponse.json({ error: 'Gagal sinkronisasi.', details: error.message }, { status: 500 });
  }
}
