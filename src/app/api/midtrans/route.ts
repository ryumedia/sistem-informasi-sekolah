import { NextResponse } from 'next/server';
import midtransClient from 'midtrans-client';
import { randomUUID } from 'crypto';
import { db as adminDb } from '@/lib/firebase-admin';

// Ambil server key dari environment variable dan pastikan tidak undefined
const serverKey = process.env.MIDTRANS_SERVER_KEY;
if (!serverKey) {
  throw new Error("MIDTRANS_SERVER_KEY is not defined in environment variables.");
}

// Ambil client key dari environment variable dan pastikan tidak undefined
const clientKey = process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY;
if (!clientKey) {
  throw new Error("NEXT_PUBLIC_MIDTRANS_CLIENT_KEY is not defined in environment variables.");
}

// Inisialisasi Snap API dari Midtrans
const snap = new midtransClient.Snap({
  isProduction: false, // Set ke true jika sudah di production
  serverKey: serverKey,
  clientKey: clientKey,
});

export async function GET(request: Request) {
  try {
    const orderId = new URL(request.url).searchParams.get('order_id');
    if (!orderId) {
      return NextResponse.json({ error: 'order_id wajib diisi.' }, { status: 400 });
    }

    // Ambil status transaksi dari Midtrans. Responsnya memuat token yang masih valid
    // untuk transaksi yang berstatus pending.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const transaction = await (snap as any).transaction.status(orderId);

    // --- SINKRONISASI CADANGAN ---
    // Pastikan status di Firestore mengikuti status terbaru dari Midtrans.
    // Ini menangani kasus di mana webhook Midtrans gagal/terlambat tiba.
    try {
      const pembayaranSnap = await adminDb
        .collection("pembayaran")
        .where("transactionId", "==", orderId)
        .limit(1)
        .get();

      if (!pembayaranSnap.empty) {
        const pembayaranDoc = pembayaranSnap.docs[0];
        const pembayaranData = pembayaranDoc.data();
        const statusMidtrans = transaction.transaction_status;
        const fraudStatus = transaction.fraud_status;

        if (pembayaranData.status !== statusMidtrans) {
          await pembayaranDoc.ref.update({ status: statusMidtrans });

          // Jika pembayaran sukses, update juga data tagihan (logika sama dengan webhook)
          if (
            (statusMidtrans === "settlement" || statusMidtrans === "capture") &&
            (!fraudStatus || fraudStatus === "accept")
          ) {
            const tagihanRef = adminDb.collection("tagihan_siswa").doc(pembayaranData.tagihanId);
            const tagihanDoc = await tagihanRef.get();

            if (tagihanDoc.exists) {
              const tagihanData = tagihanDoc.data();
              const nominalDibayarSebelumnya = tagihanData?.dibayar || 0;
              const nominalPembayaranIni = pembayaranData.jumlahBayar;
              const totalDibayar = nominalDibayarSebelumnya + nominalPembayaranIni;
              const sisaTagihan = (tagihanData?.nominal || 0) - totalDibayar;

              await tagihanRef.update({
                dibayar: totalDibayar,
                status: sisaTagihan <= 0 ? "Lunas" : "Belum Lunas",
              });
            }
          }
        }
      }
    } catch (syncError: any) {
      // Sinkronisasi gagal tidak boleh menggagalkan pengambilan token
      console.error("Gagal sinkronisasi status ke Firestore:", syncError.message);
    }

    return NextResponse.json({
      token: transaction.token,
      transaction_status: transaction.transaction_status,
      order_id: orderId,
    });
  } catch (error: any) {
    console.error("Midtrans GET status Error:", error.message);
    return NextResponse.json({ error: 'Gagal mengambil status transaksi.', details: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { tagihanId, amount, userDetails, itemDetails, order_id: existingOrderId } = await request.json();

    if (!tagihanId || !amount || !userDetails || !itemDetails) {
      return NextResponse.json({ error: 'Data yang dikirim tidak lengkap.' }, { status: 400 });
    }

    // Validasi tambahan untuk nominal pembayaran
    if (typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json({ error: 'Nominal pembayaran tidak valid.' }, { status: 400 });
    }

    // Gunakan Order ID yang sudah ada (untuk melanjutkan transaksi),
    // atau buat yang baru jika tidak dikirim (transaksi baru).
    const order_id = existingOrderId || `trx-${randomUUID()}`;

    const parameter = {
      transaction_details: {
        order_id: order_id,
        gross_amount: amount,
      },
      customer_details: {
        first_name: userDetails.nama,
        email: userDetails.email,
        // Tambahkan detail lain jika ada, misal nomor telepon
      },
      item_details: [
        {
          id: tagihanId,
          price: amount,
          quantity: 1,
          name: itemDetails.name,
          category: itemDetails.category || 'Pendidikan',
          merchant_name: 'Sekolah Riang',
        },
      ],
      callbacks: {
        finish: `${request.headers.get('origin')}/pembayaran/selesai?order_id=${order_id}`
      }
    };

    // Menggunakan createTransaction sesuai dengan @types/midtrans-client
    const transaction = await snap.createTransaction(parameter);

    return NextResponse.json({ token: transaction.token, order_id });

  } catch (error: any) {
    console.error("Midtrans API Error:", error.message);
    return NextResponse.json({ error: 'Failed to create transaction', details: error.message }, { status: 500 });
  }
}