// src/app/api/admin/update-user/route.ts
import { NextResponse } from "next/server";
import { auth } from "@/lib/firebase-admin";

export async function POST(request: Request) {
  try {
    const { uid, email, password } = await request.json();

    if (!uid) {
      return NextResponse.json({ error: "UID is required" }, { status: 400 });
    }

    const updateData: any = {};
    if (email) updateData.email = email;
    if (password && password.length >= 6) updateData.password = password;

    await auth.updateUser(uid, updateData);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error updating auth:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
