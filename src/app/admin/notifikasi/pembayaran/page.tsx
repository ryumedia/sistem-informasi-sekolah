"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { Loader2, Save } from "lucide-react";

const templateRef = doc(db, "template_notifikasi", "pembayaran");

export default function NotifikasiPembayaranPage() {
  const [templatePesan, setTemplatePesan] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadTemplate = async () => {
      try {
        const snapshot = await getDoc(templateRef);
        if (snapshot.exists() && typeof snapshot.data().templatePesan === "string") {
          setTemplatePesan(snapshot.data().templatePesan);
        }
      } catch (error) {
        console.error("Gagal memuat template notifikasi:", error);
        alert("Gagal memuat template pesan.");
      } finally {
        setLoading(false);
      }
    };

    loadTemplate();
  }, []);

  const handleSave = async () => {
    if (!templatePesan.trim()) {
      alert("Template pesan tidak boleh kosong.");
      return;
    }

    setSaving(true);
    try {
      await setDoc(templateRef, {
        templatePesan: templatePesan.trim(),
        updatedAt: new Date(),
      }, { merge: true });
      alert("Template notifikasi pembayaran berhasil disimpan.");
    } catch (error) {
      console.error("Gagal menyimpan template notifikasi:", error);
      alert("Gagal menyimpan template pesan.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Notifikasi Pembayaran</h1>
        <p className="text-sm text-gray-500 mt-1">
          Atur template pesan WhatsApp yang dikirim terkait tagihan pembayaran.
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        {loading ? (
          <div className="py-12 text-center">
            <Loader2 className="w-6 h-6 animate-spin mx-auto text-[#581c87]" />
            <p className="text-sm text-gray-500 mt-2">Memuat template...</p>
          </div>
        ) : (
          <div className="max-w-4xl">
            <label htmlFor="template-pesan" className="block text-sm font-medium text-gray-700 mb-2">
              Template Pesan
            </label>
            <textarea
              id="template-pesan"
              value={templatePesan}
              onChange={(event) => setTemplatePesan(event.target.value)}
              placeholder="Tulis template pesan notifikasi pembayaran..."
              rows={8}
              className="w-full min-w-[280px] resize-y min-h-[180px] border rounded-lg p-3 text-sm text-gray-900 focus:ring-2 focus:ring-[#581c87] focus:border-[#581c87] outline-none"
            />
            <p className="text-xs text-gray-500 mt-2">
              Variabel yang tersedia: <code className="bg-gray-100 px-1 py-0.5 rounded">{'{siswaNama}'}</code>{" "}
              dan <code className="bg-gray-100 px-1 py-0.5 rounded">{'{jumlahBayar}'}</code>
            </p>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="mt-5 bg-[#581c87] text-white px-5 py-2 rounded-lg flex items-center gap-2 hover:bg-[#45156b] transition disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? "Menyimpan..." : "Simpan"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
