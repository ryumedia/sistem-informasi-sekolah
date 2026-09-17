import admin from 'firebase-admin';
import { getApps, getApp } from 'firebase-admin/app';

/**
 * Inisialisasi Firebase Admin dilakukan secara LAZY (saat pertama kali dipakai),
 * bukan saat modul dimuat. Ini mencegah seluruh API route gagal dengan 500
 * hanya karena kredensial belum terbaca / bermasalah di lingkungan tertentu.
 */

function getServiceAccount(): admin.ServiceAccount {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  // Saat menyimpan private key di .env, ganti newline asli (\n) dengan literal "\\n"
  // Kode di bawah akan mengubahnya kembali ke format yang benar.
  const privateKey = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');

  const missing: string[] = [];
  if (!projectId) missing.push('FIREBASE_PROJECT_ID');
  if (!clientEmail) missing.push('FIREBASE_CLIENT_EMAIL');
  if (!privateKey) missing.push('FIREBASE_PRIVATE_KEY');

  if (missing.length > 0) {
    throw new Error(
      `Firebase Admin kredensial tidak lengkap. Environment variable berikut tidak ditemukan: ${missing.join(', ')}. ` +
      `Pastikan sudah diatur di server (misal .env.local atau pengaturan environment di hosting).`
    );
  }

  return { projectId, clientEmail, privateKey };
}

function ensureInitialized() {
  if (getApps().length) return getApp();
  try {
    return admin.initializeApp({
      credential: admin.credential.cert(getServiceAccount()),
    });
  } catch (error) {
    // Lempar ulang dengan konteks yang jelas agar muncul di log server
    console.error('Gagal inisialisasi Firebase Admin:', error);
    throw error;
  }
}

// Proxy agar `db` dan `auth` baru benar-benar diinisialisasi saat dipakai,
// bukan saat modul di-import oleh route API mana pun.
const db = new Proxy({} as admin.firestore.Firestore, {
  get(_target, prop) {
    ensureInitialized();
    const firestore = admin.firestore();
    const value = Reflect.get(firestore as object, prop, firestore);
    return typeof value === 'function' ? value.bind(firestore) : value;
  },
});

const auth = new Proxy({} as admin.auth.Auth, {
  get(_target, prop) {
    ensureInitialized();
    const authInstance = admin.auth();
    const value = Reflect.get(authInstance as object, prop, authInstance);
    return typeof value === 'function' ? value.bind(authInstance) : value;
  },
});

export { db, auth, admin };
