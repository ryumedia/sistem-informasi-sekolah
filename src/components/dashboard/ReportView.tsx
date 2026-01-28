// src/components/dashboard/ReportView.tsx
"use client";

import { ArrowLeft, FileText } from "lucide-react";

interface ReportViewProps {
  user: any;
  userData: any;
  onBack: () => void;
}

export default function ReportView({ user, userData, onBack }: ReportViewProps) {
  return (
    <div className="flex-1 flex flex-col bg-gray-50">
      <header className="bg-white p-4 shadow-sm sticky top-0 z-10 flex items-center gap-3">
        <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full transition">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div>
          <h1 className="text-lg font-bold text-gray-800">Laporan Harian (Daycare)</h1>
          <p className="text-xs text-gray-500">Aktivitas dan perkembangan anak.</p>
        </div>
      </header>

      <div className="flex-1 p-6 space-y-4">
        <div className="bg-white p-6 rounded-xl shadow-sm text-center">
            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="font-semibold text-gray-700">Fitur Laporan Daycare</h3>
            <p className="text-sm text-gray-500 mt-1">
                Tampilan untuk laporan aktivitas harian siswa jenjang Daycare akan tersedia di sini.
            </p>
        </div>
      </div>
    </div>
  );
}
