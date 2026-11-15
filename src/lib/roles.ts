/**
 * Helper pemetaan role.
 *
 * "Asisten Guru" diperlakukan sama dengan "Guru" pada semua pengecekan
 * akses maupun filter data di Panel Admin.
 */
export const normalizeRole = (role?: string | null): string =>
  role === "Asisten Guru" ? "Guru" : role || "";

/** True jika role user (setelah dinormalisasi) termasuk dalam daftar role yang diizinkan. */
export const isRoleIn = (role: string | null | undefined, allowed: string[]): boolean =>
  allowed.includes(normalizeRole(role));

/** True jika role user adalah Guru (termasuk Asisten Guru). */
export const isGuruRole = (role?: string | null): boolean => normalizeRole(role) === "Guru";

/** Role yang sama-sama mendapat perilaku khusus Guru. */
export const GURU_ROLES = ["Guru", "Asisten Guru"];
