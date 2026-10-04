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
    .replaceAll("{nama}", String(data.nama ?? ""))
    .replaceAll("{bulan}", String(data.bulan ?? ""))
    .replaceAll("{tahun}", String(data.tahun ?? ""));

export async function POST(request: Request) {
  try {
    const { tagihanId } = await request.json();
    if (!tagihanId || typeof tagihanId !== "string") {
      return NextResponse.json({ error: "tagihanId wajib diisi." }, { status: 400 });
    }

    const tagihanRef = db.collection("tagihan_siswa").doc(tagihanId);
    const tagihanSnap = await tagihanRef.get();
    if (!tagihanSnap.exists) {
      return NextResponse.json({ error: "Data tagihan tidak ditemukan." }, { status: 404 });
    }

    const tagihan = tagihanSnap.data() || {};

    // 1. Temukan siswa untuk mengambil nama, nomor WA, dan data cabang
    let siswaSnap = null;
    if (tagihan.siswaId && typeof tagihan.siswaId === "string") {
      siswaSnap = await db.collection("siswa").doc(tagihan.siswaId).get();
    }

    const siswa = siswaSnap?.exists ? siswaSnap?.data() : null;
    const noWA = normalizePhoneNumber(siswa?.noWA);

    // 2. Jika nomor WA tidak ada, lewati pengiriman tetapi tetap sukses
    if (!noWA) {
      await tagihanRef.update({
        notifikasiTagihan: {
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
      await tagihanRef.update({
        notifikasiTagihan: {
          status: "gagal",
          reason: "API Starsender cabang tidak ditemukan.",
          sentAt: new Date(),
        },
      });
      return NextResponse.json({ success: true, skipped: true, reason: "API Starsender cabang tidak ditemukan." });
    }

    // 4. Ambil template pesan
    const templateSnap = await db.collection("template_notifikasi").doc("tagihan").get();
    const template = templateSnap.data()?.templatePesan;

    if (typeof template !== "string" || !template.trim()) {
      await tagihanRef.update({
        notifikasiTagihan: {
          status: "gagal",
          reason: "Template notifikasi tagihan belum tersedia.",
          sentAt: new Date(),
        },
      });
      return NextResponse.json({ success: true, skipped: true, reason: "Template notifikasi tagihan belum tersedia." });
    }

    // 5. Siapkan dan kirim pesan
    const message = renderTemplate(template, {
      nama: siswa?.nama ?? "",
      bulan: tagihan.bulan ?? "",
      tahun: tagihan.tahun ?? "",
    });
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

    await tagihanRef.update({
      notifikasiTagihan: {
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
    console.error("Gagal mengirim notifikasi tagihan:", errorMessage);
    return NextResponse.json({ error: "Gagal mengirim notifikasi tagihan.", details: errorMessage }, { status: 500 });
  }
}
