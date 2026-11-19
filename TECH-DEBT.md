# Catatan Teknis (Technical Debt)

Dokumen ini mencatat pekerjaan perbaikan yang **sengaja ditunda** agar tidak mengganggu
stabilitas aplikasi saat sedang dipakai. Kerjakan saat pemakaian sudah landai.

---

## 1. Lint: `src/app/admin/keuangan/pengajuan/page.tsx`

Status: **ditunda** (2026-11-19). Perilaku aplikasi sudah benar; ini murni kebersihan kode.

Hasil `npx eslint src/app/admin/keuangan/pengajuan/page.tsx`: **4 error, 3 warning**
(jumlah sama persis sebelum penambahan fitur tombol Tambah & filter Jenis Pengajuan).

### Error: `@typescript-eslint/no-explicit-any`
| Lokasi | Kode |
|---|---|
| `cabangList` | `useState<any[]>([])` |
| `nomenklaturList` | `useState<any[]>([])` |
| `currentUser` | `useState<any>(null)` |
| `let userDoc: any = null` | di dalam `onAuthStateChanged` |

Rencana perbaikan (tanpa mengubah logika bisnis):

```ts
interface UserData {
  id?: string;
  uid?: string;
  email?: string | null;
  nama?: string;
  role?: string;
  cabang?: string;
}
interface Cabang { id: string; nama: string }
interface Nomenklatur { id: string; nama: string }
```

- `currentUser` → `useState<UserData | null>(null)`
- `userDoc` → `QueryDocumentSnapshot<DocumentData>` (dari `firebase/firestore`)
- Di dalam callback, bentuk objek tetap sama (`id`, `uid`, `...docData`, `role`).

### Bug terselubung (perbaiki bersamaan)
`const userRoles = currentUser?.role || [];` — `role` adalah **string**, bukan array.
Saat ini `.includes(...)` tetap berjalan karena string juga punya method `includes`,
sehingga `"Kepala Sekolah".includes("Kepala Sekolah")` bernilai `true` **secara kebetulan**.
Ganti dengan:

```ts
const userRoles: string[] = currentUser?.role ? [currentUser.role] : [];
```

Terdapat di: `handleApprove`, `handleBulkApprove`, `handleDelete`, `openEditModal`.

### Warning
- `'XCircle' is defined but never used` → hapus dari import `lucide-react`.
- `'index' is defined but never used` → hapus parameter kedua di `currentItems.map((item, index) =>`.
- `React Hook useEffect has a missing dependency: 'fetchData'` → bungkus `fetchData`
  dengan `useCallback(..., [currentUser, startDate, endDate])`, lalu pakai di dependency
  `useEffect`.

### Catatan risiko data (bug laten, bukan lint)
`item.total` dipakai langsung (`.toLocaleString()` dan `sum + item.total`).
Data lama di Firestore yang `total`-nya string/kosong akan menghasilkan `Rp NaN`
atau konkatenasi string. Aman-nya:

```ts
const totalPengajuanTerpilih = filteredData
  .filter(item => selectedItems.includes(item.id))
  .reduce((sum, item) => sum + (Number(item.total) || 0), 0);
```

---

## 2. Lint global proyek

`npm run lint` saat ini: **341 error, 70 warning** di 86+ halaman.
Mayoritas `no-explicit-any` dan `react/no-unescaped-entities`.
Tidak ada rencana perbaikan massal — kerjakan per file saat file tersebut disentuh
untuk keperluan lain.

---

## Checklist saat bersih-bersih nanti

- [ ] `npx tsc --noEmit` lolos (exit 0)
- [ ] `npx eslint <file>` untuk file yang diubah → 0 error 0 warning
- [ ] Uji manual: login sebagai Guru, Kepala Sekolah, Direktur; buka
      `/admin/keuangan/pengajuan`, cek tambah/edit/approve/approve masal/hapus
- [ ] Commit terpisah dari perubahan fitur
