// src/app/api/admin/delete-user/route.ts
import { NextResponse } from "next/server";
import * as admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}

export async function POST(request: Request) {
  try {
    const { uid, email } = await request.json();

    let targetUid = uid;

    // Jika UID tidak ada tapi Email ada (untuk data legacy/lama), cari UID by Email
    if (!targetUid && email) {
        try {
            const userRecord = await admin.auth().getUserByEmail(email);
            targetUid = userRecord.uid;
        } catch (e) {
            // User tidak ditemukan by email, anggap sudah terhapus
            console.log("User not found by email (might be already deleted):", email);
            return NextResponse.json({ success: true, message: "User not found, assumed deleted" });
        }
    }

    if (!targetUid) {
      return NextResponse.json({ error: "UID or Email is required" }, { status: 400 });
    }

    // Hapus user dari Firebase Authentication
    await admin.auth().deleteUser(targetUid);

    return NextResponse.json({ success: true, message: "User Auth deleted" });
  } catch (error: any) {
    console.error("Error deleting auth:", error);
    if (error.code === 'auth/user-not-found') {
        return NextResponse.json({ success: true, message: "User already deleted" });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
