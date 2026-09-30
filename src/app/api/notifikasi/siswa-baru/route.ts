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
    .replaceAll("{namaAnak}", String(data.namaAnak ?? ""))
    .replaceAll("{lokasi}", String(data.lokasi ?? ""))
    .replaceAll("{program}", String(data.program ?? ""));

export async function POST(request: Request) {
  try {
    const { registrationId } = await request.json();
    if (!registrationId || typeof registrationId !== "string") {
      return NextResponse.json({ error: "registrationId wajib diisi." }, { status: 400 });
    }

    const registrationRef = db.collection("siswa_baru_registrations").doc(registrationId);
    const registrationSnap = await registrationRef.get();
    if (!registrationSnap.exists) {
      return NextResponse.json({ error: "Data pendaftaran tidak ditemukan." }, { status: 404 });
    }

    const registration = registrationSnap.data() || {};
    const [templateSnap, cabangSnap] = await Promise.all([
      db.collection("template_notifikasi").doc("siswa_baru").get(),
      db.collection("cabang").where("nama", "==", registration.lokasi).limit(1).get(),
    ]);

    const template = templateSnap.data()?.templatePesan;
    const cabang = cabangSnap.empty ? undefined : cabangSnap.docs[0].data();
    const apiKey = cabang?.apiStarsender;
    const recipients = [normalizePhoneNumber(registration.noWaAyah), normalizePhoneNumber(registration.noWaIbu)]
      .filter((number, index, numbers) => number && numbers.indexOf(number) === index);

    if (typeof template !== "string" || !template.trim()) {
      return NextResponse.json({ error: "Template notifikasi siswa baru belum tersedia." }, { status: 422 });
    }
    if (!cabang) {
      return NextResponse.json({ error: "Cabang sesuai lokasi pendaftaran tidak ditemukan." }, { status: 422 });
    }
    if (typeof apiKey !== "string" || !apiKey.trim()) {
      return NextResponse.json({ error: "API Starsender untuk cabang tersebut belum diatur." }, { status: 422 });
    }
    if (recipients.length === 0) {
      return NextResponse.json({ error: "Nomor WhatsApp Ayah/Ibu tidak tersedia." }, { status: 422 });
    }

    const message = renderTemplate(template, registration);
    const endpoint = process.env.STARSENDER_API_URL || "https://api.starsender.online/api/send";
    const results = await Promise.allSettled(recipients.map(async (number) => {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: apiKey.trim(),
        },
        body: JSON.stringify({
          messageType: "text",
          to: number,
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
      if (!response.ok || parsedBody?.success === false) {
        throw new Error(`Starsender HTTP ${response.status}: ${responseBody.slice(0, 500)}`);
      }
      return responseBody;
    }));

    const failed = results.filter((result): result is PromiseRejectedResult => result.status === "rejected");
    const failureDetails = failed.map((result) => result.reason instanceof Error ? result.reason.message : String(result.reason));
    await registrationRef.update({
      notifikasiSiswaBaru: {
        status: failed.length === results.length ? "gagal" : "terkirim",
        recipients,
        sentAt: new Date(),
        error: failureDetails.length ? failureDetails.join(" | ").slice(0, 1000) : null,
      },
    });

    if (failed.length === results.length) {
      return NextResponse.json({ error: "Pesan WhatsApp gagal dikirim.", details: failureDetails }, { status: 502 });
    }
    return NextResponse.json({ success: true, sent: results.length - failed.length, failed: failed.length });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Kesalahan tidak diketahui";
    console.error("Gagal mengirim notifikasi siswa baru:", errorMessage);
    return NextResponse.json({ error: "Gagal mengirim notifikasi WhatsApp.", details: errorMessage }, { status: 500 });
  }
}
