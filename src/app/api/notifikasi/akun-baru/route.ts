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
    .replaceAll("{email}", String(data.email ?? ""))
    .replaceAll("{noWA}", String(data.noWA ?? ""))
    .replaceAll("{cabang}", String(data.cabang ?? ""));

export async function POST(request: Request) {
  try {
    const { siswaId } = await request.json();
    if (!siswaId || typeof siswaId !== "string") {
      return NextResponse.json({ error: "siswaId wajib diisi." }, { status: 400 });
    }

    const siswaRef = db.collection("siswa").doc(siswaId);
    const siswaSnap = await siswaRef.get();
    if (!siswaSnap.exists) {
      return NextResponse.json({ error: "Data siswa tidak ditemukan." }, { status: 404 });
    }

    const siswa = siswaSnap.data() || {};
    const [templateSnap, cabangSnap] = await Promise.all([
      db.collection("template_notifikasi").doc("akun_baru").get(),
      db.collection("cabang").where("nama", "==", siswa.cabang).limit(1).get(),
    ]);

    const template = templateSnap.data()?.templatePesan;
    const cabang = cabangSnap.empty ? undefined : cabangSnap.docs[0].data();
    const apiKey = cabang?.apiStarsender;
    const recipient = normalizePhoneNumber(siswa.noWA);

    if (typeof template !== "string" || !template.trim()) {
      return NextResponse.json({ error: "Template notifikasi akun baru belum tersedia." }, { status: 422 });
    }
    if (!cabang) {
      return NextResponse.json({ error: "Cabang siswa tidak ditemukan." }, { status: 422 });
    }
    if (typeof apiKey !== "string" || !apiKey.trim()) {
      return NextResponse.json({ error: "API Starsender untuk cabang tersebut belum diatur." }, { status: 422 });
    }
    if (!recipient) {
      return NextResponse.json({ error: "Nomor WhatsApp siswa tidak tersedia." }, { status: 422 });
    }

    const message = renderTemplate(template, siswa);
    const endpoint = process.env.STARSENDER_API_URL || "https://api.starsender.online/api/send";
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: apiKey.trim(),
      },
      body: JSON.stringify({
        messageType: "text",
        to: recipient,
        body: message,
      }),
    });

    const responseBody = await response.text();
    let parsedBody: { success?: boolean; message?: string } | null = null;
    try {
      parsedBody = JSON.parse(responseBody) as { success?: boolean; message?: string };
    } catch {
      // Respons non-JSON tetap dicatat sebagai error di bawah jika HTTP gagal.
    }

    const success = response.ok && parsedBody?.success !== false;
    await siswaRef.update({
      notifikasiAkunBaru: {
        status: success ? "terkirim" : "gagal",
        recipient,
        sentAt: new Date(),
        error: success ? null : `Starsender HTTP ${response.status}: ${responseBody.slice(0, 500)}`,
      },
    });

    if (!success) {
      return NextResponse.json({ error: "Pesan WhatsApp gagal dikirim.", details: responseBody.slice(0, 500) }, { status: 502 });
    }
    return NextResponse.json({ success: true, recipient });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Kesalahan tidak diketahui";
    console.error("Gagal mengirim notifikasi akun baru:", errorMessage);
    return NextResponse.json({ error: "Gagal mengirim notifikasi WhatsApp.", details: errorMessage }, { status: 500 });
  }
}
