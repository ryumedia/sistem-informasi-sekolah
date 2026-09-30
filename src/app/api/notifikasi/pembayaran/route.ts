import { NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";

const normalizePhoneNumber = (value: unknown) => {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!digits || /^0+$/.test(digits)) return "";
  if (digits.startsWith("0")) return `62${digits.slice(1)}`;
  if (digits.startsWith("62")) return digits;
  return `62${digits}`;
};

const renderTemplate = (template: string, data: Record<string, unknown>) =>
  template
    .replaceAll("{siswaNama}", String(data.siswaNama ?? ""))
    .replaceAll("{jumlahBayar}", String(data.jumlahBayar ?? ""));

export async function POST(request: Request) {
  try {
    const { paymentId } = await request.json();
    if (!paymentId || typeof paymentId !== "string") {
      return NextResponse.json({ error: "paymentId wajib diisi." }, { status: 400 });
    }

    const paymentRef = db.collection("pembayaran").doc(paymentId);
    const paymentSnap = await paymentRef.get();
    if (!paymentSnap.exists) {
      return NextResponse.json({ error: "Data pembayaran tidak ditemukan." }, { status: 404 });
    }

    const payment = paymentSnap.data() || {};

    // 1. Temukan siswa untuk mengambil nomor WA dan data cabang
    let siswaSnap = null;
    if (payment.siswaId && typeof payment.siswaId === "string") {
      siswaSnap = await db.collection("siswa").doc(payment.siswaId).get();
    }

    const siswa = siswaSnap?.exists ? siswaSnap?.data() : null;
    const noWA = normalizePhoneNumber(siswa?.noWA);

    // 2. Jika nomor WA tidak ada, lewati pengiriman tetapi tetap sukses
    if (!noWA) {
      await paymentRef.update({
        notifikasiPembayaran: {
          status: "dilewati",
          reason: "Nomor WhatsApp siswa tidak tersedia.",
          sentAt: new Date(),
        },
      });
      return NextResponse.json({ success: true, skipped: true, reason: "Nomor WhatsApp tidak tersedia." });
    }

    // 3. Temukan cabang siswa untuk menggunakan API Starsender cabang
    let cabangSnap = null;
    if (siswa?.cabang && typeof siswa.cabang === "string") {
      cabangSnap = await db.collection("cabang").where("nama", "==", siswa.cabang).limit(1).get();
    }

    const cabang = cabangSnap && !cabangSnap.empty ? cabangSnap.docs[0].data() : null;
    const apiKey = cabang?.apiStarsender;

    if (typeof apiKey !== "string" || !apiKey.trim()) {
      await paymentRef.update({
        notifikasiPembayaran: {
          status: "gagal",
          reason: "API Starsender cabang tidak ditemukan.",
          sentAt: new Date(),
        },
      });
      return NextResponse.json({ success: true, skipped: true, reason: "API Starsender cabang tidak ditemukan." });
    }

    // 4. Ambil template pesan
    const templateSnap = await db.collection("template_notifikasi").doc("pembayaran").get();
    const template = templateSnap.data()?.templatePesan;

    if (typeof template !== "string" || !template.trim()) {
      await paymentRef.update({
        notifikasiPembayaran: {
          status: "gagal",
          reason: "Template notifikasi pembayaran belum tersedia.",
          sentAt: new Date(),
        },
      });
      return NextResponse.json({ success: true, skipped: true, reason: "Template notifikasi pembayaran belum tersedia." });
    }

    // 5. Siapkan dan kirim pesan
    const message = renderTemplate(template, { ...payment, siswaNama: payment.siswaNama ?? siswa?.nama ?? "" });
    const endpoint = process.env.STARSENDER_API_URL || "https://api.starsender.online/api/send";

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: apiKey.trim(),
      },
      body: JSON.stringify({
        messageType: "text",
        to: noWA,
        body: message,
      }),
    });

    const responseBody = await response.text();
    let parsedBody: { success?: boolean; message?: string } | null = null;
    try {
      parsedBody = JSON.parse(responseBody) as { success?: boolean; message?: string };
    } catch {
      // Respons non-JSON tetap ditangani berdasarkan status HTTP.
    }

    const isSent = response.ok && parsedBody?.success !== false;

    await paymentRef.update({
      notifikasiPembayaran: {
        status: isSent ? "terkirim" : "gagal",
        recipient: noWA,
        sentAt: new Date(),
        error: isSent ? null : `Starsender HTTP ${response.status}: ${responseBody.slice(0, 500)}`,
      },
    });

    if (!isSent) {
      return NextResponse.json({ success: true, skipped: true, reason: `Gagal mengirim pesan WhatsApp: HTTP ${response.status}` });
    }

    return NextResponse.json({ success: true, sent: true });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Kesalahan tidak diketahui";
    console.error("Gagal mengirim notifikasi pembayaran:", errorMessage);
    return NextResponse.json({ error: "Gagal mengirim notifikasi pembayaran.", details: errorMessage }, { status: 500 });
  }
}
