import { NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin"; // Gunakan firebase-admin di backend
import crypto from "crypto";

const getTagihanById = async (tagihanId: string) => {
  const tagihanRef = db.collection("tagihan_siswa").doc(tagihanId);
  const doc = await tagihanRef.get();
  if (!doc.exists) {
    return null;
  }
  return { id: doc.id, ...doc.data() };
};

export async function POST(request: Request) {
  try {
    const notificationJson = await request.json();

    // 1. Buat signature key dari data notifikasi
    const serverKey = process.env.MIDTRANS_SERVER_KEY;
    if (!serverKey) {
      console.error("MIDTRANS_SERVER_KEY is not set");
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    const signatureKey = crypto
      .createHash("sha512")
      .update(
        `${notificationJson.order_id}${notificationJson.status_code}${notificationJson.gross_amount}${serverKey}`
      )
      .digest("hex");

    // 2. Verifikasi signature key
    if (signatureKey !== notificationJson.signature_key) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
    }

    // 3. Dapatkan data dari notifikasi
    const orderId = notificationJson.order_id;
    const transactionStatus = notificationJson.transaction_status;
    const fraudStatus = notificationJson.fraud_status;

    // Cari dokumen pembayaran berdasarkan transactionId (order_id)
    const pembayaranQuery = db
      .collection("pembayaran")
      .where("transactionId", "==", orderId);
    const pembayaranSnap = await pembayaranQuery.get();

    if (pembayaranSnap.empty) {
      console.warn(`Webhook Error: Pembayaran dengan order_id ${orderId} tidak ditemukan.`);
      // Penting untuk tetap return 200 agar Midtrans tidak mengirim ulang notifikasi
      return NextResponse.json({ status: "ok" });
    }

    const pembayaranDoc = pembayaranSnap.docs[0];
    const pembayaranData = pembayaranDoc.data();

    // 4. Update status pembayaran di Firestore
    await pembayaranDoc.ref.update({ status: transactionStatus });

    // 5. Jika pembayaran sukses (settlement), update juga data tagihan
    if (transactionStatus === "settlement" || transactionStatus === "capture") {
      if (fraudStatus === "accept") {
        const tagihanRef = db.collection("tagihan_siswa").doc(pembayaranData.tagihanId);
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

    // Beri respons 200 OK ke Midtrans agar tidak mengirim notifikasi berulang
    return NextResponse.json({ status: "ok" });

  } catch (error) {
    console.error("Webhook processing error:", error);
    // Meskipun ada error, coba untuk tidak mengirim status 500 jika memungkinkan
    // agar Midtrans tidak terus-menerus mengirim ulang. Cukup log errornya.
    return NextResponse.json({ status: "error", message: (error as Error).message }, { status: 200 });
  }
}