import { NextResponse } from 'next/server';

/**
 * Endpoint diagnostik: cek kesehatan firebase-admin di server produksi.
 * Hanya mengecek inisialisasi + operasi read sederhana. Hapus file ini
 * setelah masalah selesai jika tidak dibutuhkan.
 */
export async function GET() {
  const result: Record<string, unknown> = {
    envCheck: {
      FIREBASE_PROJECT_ID: !!process.env.FIREBASE_PROJECT_ID,
      FIREBASE_CLIENT_EMAIL: !!process.env.FIREBASE_CLIENT_EMAIL,
      FIREBASE_PRIVATE_KEY: !!process.env.FIREBASE_PRIVATE_KEY,
      MIDTRANS_SERVER_KEY: !!process.env.MIDTRANS_SERVER_KEY,
      NEXT_PUBLIC_MIDTRANS_CLIENT_KEY: !!process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY,
    },
  };

  try {
    const { db } = await import('@/lib/firebase-admin');
    // Coba operasi read paling murah
    const test = await db.collection('pembayaran').limit(1).get();
    result.firestoreRead = 'OK';
    result.pembayaranCountSample = test.size;
    return NextResponse.json({ status: 'ok', ...result });
  } catch (error: any) {
    return NextResponse.json(
      {
        status: 'error',
        ...result,
        errorMessage: error.message,
        errorStack: error.stack?.split('\n').slice(0, 5),
      },
      { status: 500 }
    );
  }
}
