// src/app/api/admin/update-user/route.ts
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
    const { uid, email, password } = await request.json();

    if (!uid) {
      return NextResponse.json({ error: "UID is required" }, { status: 400 });
    }

    const updateData: any = {};
    if (email) updateData.email = email;
    if (password && password.length >= 6) updateData.password = password;

    await admin.auth().updateUser(uid, updateData);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error updating auth:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
