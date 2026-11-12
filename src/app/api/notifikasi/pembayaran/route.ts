import { NextResponse } from "next/server";
import { format } from "date-fns";
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
    .replaceAll("{jumlahBayar}", String(data.jumlahBayar ?? ""))
    .replaceAll("{jenisTagihan}", String(data.jenisTagihan ?? ""))
    .replaceAll("{tanggalBayar}", String(data.tanggalBayar ?? ""));

// Field tanggalBayar di Firestore berisi Timestamp (bisa juga Date/ISO string).
// Format ke zona waktu Indonesia: dd-mm-yyyy (hh:mm:ss)
const formatTanggalBayar = (value: unknown) => {
  if (!value) return "";

  let date: Date | null = null;
  if (value instanceof Date) {
    date = value;
  } else if (typeof value === "string") {
    const parsed = new Date(value);
    date = isNaN(parsed.getTime()) ? null : parsed;
  } else if (typeof value === "object") {
    // Firestore Timestamp / Admin SDK Timestamp
    const obj = value as { toDate?: () => Date; seconds?: number; _seconds?: number };
    if (typeof obj.toDate === "function") {
      date = obj.toDate();
    } else if (typeof obj.seconds === "number") {
      date = new Date(obj.seconds * 1000);
    } else if (typeof obj._seconds === "number") {
      date = new Date(obj._seconds * 1000);
    }
  }

  if (!date || isNaN(date.getTime())) return "";

  // date-fns memakai zona waktu server; geser ke WIB (UTC+7)
  const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
  const wib = new Date(date.getTime() + WIB_OFFSET_MS);
  return format(wib, "dd-MM-yyyy (HH:mm:ss)");
};

// Pembayaran menyimpan tagihanIds (array), bukan nama tagihan.
// Ambil dokumen tagihan_siswa untuk tiap ID lalu susun nama jenis biaya beserta periode.
const resolveJenisTagihan = async (payment: Record<string, unknown>) => {
  const tagihanIds: string[] =
    Array.isArray(payment.tagihanIds) && payment.tagihanIds.length > 0
      ? (payment.tagihanIds as string[])
      : typeof payment.tagihanId === "string"
        ? [payment.tagihanId]
        : [];

  if (tagihanIds.length === 0) return "";

  const tagihanSnaps = await Promise.all(
    tagihanIds.map((id) => db.collection("tagihan_siswa").doc(id).get().catch(() => null)),
  );

  const labels = tagihanSnaps
    .map((snap) => {
      if (!snap?.exists) return "";
      const tagihan = snap.data() || {};
      return [tagihan.jenisBiaya, tagihan.bulan, tagihan.tahun]
        .map((part) => String(part ?? "").trim())
        .filter(Boolean)
        .join(" ");
    })
    .filter(Boolean);

  return labels.join(", ");
};

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
    const jenisTagihan = await resolveJenisTagihan(payment);
    const message = renderTemplate(template, {
      ...payment,
      siswaNama: payment.siswaNama ?? siswa?.nama ?? "",
      jenisTagihan,
      tanggalBayar: formatTanggalBayar(payment.tanggalBayar),
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
