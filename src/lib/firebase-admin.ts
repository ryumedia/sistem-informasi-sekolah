import admin from 'firebase-admin';
import { getApps } from 'firebase-admin/app';

// Ambil kredensial dari environment variables.
// Ini adalah cara yang aman untuk menangani kunci rahasia.
const serviceAccount: admin.ServiceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  // Saat menyimpan private key di .env, ganti newline asli (\n) dengan literal "\\n"
  // Kode di bawah akan mengubahnya kembali menjadi format yang benar.
  privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
};

// Cek apakah aplikasi Firebase sudah diinisialisasi sebelumnya.
// Ini untuk mencegah error saat hot-reloading di lingkungan development.
if (!getApps().length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

// Ekspor instance layanan yang akan digunakan di backend, seperti Firestore.
const db = admin.firestore();
const auth = admin.auth();

export { db, auth, admin };
