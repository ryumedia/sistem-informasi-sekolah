// d:\Private\Ryumedia\sistem-informasi-sekolah\src\components\dashboard\PengumumanDetailModal.tsx
"use client";
import { X } from "lucide-react";
import { formatDate } from "@/lib/dateUtils";

export default function PengumumanDetailModal({ data, onClose }: { data: any; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[80vh] overflow-y-auto flex flex-col">
        <div className="p-4 border-b flex justify-between items-start bg-gray-50 sticky top-0">
          <div>
             <h3 className="font-bold text-gray-800 text-lg">{data.judul}</h3>
             <p className="text-xs text-gray-500 mt-1">{formatDate(data.createdAt)} • {data.cabang}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <X className="w-6 h-6" />
          </button>
        </div>
        <div className="p-6 text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">
          {data.deskripsi}
        </div>
      </div>
    </div>
  );
}
