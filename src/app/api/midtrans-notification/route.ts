import { NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin"; // Gunakan firebase-admin di backend
import crypto from "crypto";

export async function POST(request: Request) {
  try {
    const notificationJson = await request.json();

    // 1. Ambil server key dan periksa keberadaannya
    const serverKey = process.env.MIDTRANS_SERVER_KEY;
    if (!serverKey) {
      throw new Error("MIDTRANS_SERVER_KEY is not set in environment variables");
    }

    // 2. Buat signature key pembanding dari data notifikasi yang masuk
    const hash = crypto.createHash("sha512");
    hash.update(`${notificationJson.order_id}${notificationJson.status_code}${notificationJson.gross_amount}${serverKey}`);
    const generatedSignatureKey = hash.digest("hex");

    // 3. Bandingkan signature key yang kita buat dengan yang dikirim oleh Midtrans
    if (generatedSignatureKey !== notificationJson.signature_key) {
      throw new Error("Invalid signature key");
    }

    // Jika signature valid, kita bisa percaya data dari notifikasi
    const orderId = notificationJson.order_id;
    const transactionStatus = notificationJson.transaction_status;
    const fraudStatus = notificationJson.fraud_status;

    console.log(`Webhook received for order_id: ${orderId}, status: ${transactionStatus}, fraud: ${fraudStatus}`);

    // 4. Cari dokumen pembayaran berdasarkan transactionId (order_id)
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

    // 5. Update status pembayaran di Firestore (Hanya jika status berubah)
    if (pembayaranData.status === transactionStatus) {
      console.log(`Status for order_id: ${orderId} is already '${transactionStatus}'. No update needed.`);
      return NextResponse.json({ status: "ok, no change" });
    }
    await pembayaranDoc.ref.update({ status: transactionStatus });

    // 6. Jika pembayaran sukses (settlement), update juga data tagihan
    if (transactionStatus === "settlement" || transactionStatus === "capture") {
      if (fraudStatus === "accept") {
        // Mode keranjang: tagihanIds berisi beberapa tagihan, jumlahBayar dibagi ke masing-masing
        const tagihanIds: string[] = Array.isArray(pembayaranData.tagihanIds)
          ? pembayaranData.tagihanIds
          : [];

        if (tagihanIds.length > 0) {
          // Alokasikan jumlah yang dibayar ke tiap tagihan secara berurutan.
          // Setiap tagihan dibayar penuh sisanya (mode keranjang tanpa parsial).
          let sisaDana = pembayaranData.jumlahBayar || 0;
          for (const tid of tagihanIds) {
            const tagihanRef = db.collection("tagihan_siswa").doc(tid);
            const tagihanDoc = await tagihanRef.get();
            if (!tagihanDoc.exists || sisaDana <= 0) continue;

            const tagihanData = tagihanDoc.data();
            const nominalDibayarSebelumnya = tagihanData?.dibayar || 0;
            const sisaTagihanSebelumnya = Math.max((tagihanData?.nominal || 0) - nominalDibayarSebelumnya, 0);

            // Yang dialokasikan untuk tagihan ini: penuh sisanya, dibatasi sisa dana
            const alokasi = Math.min(sisaTagihanSebelumnya, sisaDana);
            const totalDibayar = nominalDibayarSebelumnya + alokasi;
            const sisaTagihan = (tagihanData?.nominal || 0) - totalDibayar;

            await tagihanRef.update({
              dibayar: totalDibayar,
              status: sisaTagihan <= 0 ? "Lunas" : "Belum Lunas",
            });

            sisaDana -= alokasi;
          }
        } else if (pembayaranData.tagihanId) {
          // Mode tunggal (kompatibel dengan pembayaran lama)
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

        // Kirim notifikasi WhatsApp (gunakan service agar kegagalan WA tidak mengganggu hasil Midtrans)
        try {
          const notificationResponse = await fetch(`${new URL(request.url).origin}/api/notifikasi/pembayaran`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ paymentId: pembayaranDoc.id }),
          });
          if (!notificationResponse.ok) {
            console.error("Notifikasi pembayaran WhatsApp gagal:", await notificationResponse.text());
          }
        } catch (notificationError) {
          console.error("Error mengirim notifikasi pembayaran:", notificationError);
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