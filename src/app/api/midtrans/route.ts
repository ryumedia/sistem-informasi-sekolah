import { NextResponse } from 'next/server';
import midtransClient from 'midtrans-client';
import { randomUUID } from 'crypto';

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

export async function POST(request: Request) {
  try {
    const { tagihanId, amount, userDetails, itemDetails } = await request.json();

    if (!tagihanId || !amount || !userDetails || !itemDetails) {
      return NextResponse.json({ error: 'Data yang dikirim tidak lengkap.' }, { status: 400 });
    }

    // Validasi tambahan untuk nominal pembayaran
    if (typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json({ error: 'Nominal pembayaran tidak valid.' }, { status: 400 });
    }

    // Buat order ID yang unik, misalnya dengan timestamp
    const order_id = `trx-${randomUUID()}`;

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