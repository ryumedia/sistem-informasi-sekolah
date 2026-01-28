// src/app/login/page.tsx
"use client";

import { useState } from "react";
import { signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Lock, Mail, Eye, EyeOff } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // State untuk modal lupa password
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState("");
  const [forgotPasswordError, setForgotPasswordError] = useState("");
  const [forgotPasswordSuccess, setForgotPasswordSuccess] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push("/"); // Redirect ke halaman utama setelah sukses
    } catch (err: any) {
      console.error(err);
      setError("Email atau password salah.");
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!forgotPasswordEmail) {
      setForgotPasswordError("Silakan masukkan email Anda.");
      return;
    }
    setLoading(true);
    setForgotPasswordError("");
    setForgotPasswordSuccess("");

    try {
      await sendPasswordResetEmail(auth, forgotPasswordEmail);
      setForgotPasswordSuccess(
        "Email untuk reset password telah dikirim. Silakan periksa kotak masuk Anda."
      );
    } catch (err: any) {
      console.error(err);
      setForgotPasswordError("Gagal mengirim email. Pastikan email benar.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <Image
              src="/logo.png"
              alt="Logo Sekolah"
              width={80}
              height={80}
              className="object-contain"
            />
          </div>
          <h1 className="text-2xl font-bold text-gray-800">Selamat Datang</h1>
          <p className="text-sm text-gray-500">Silakan masuk ke akun Anda</p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg mb-4 text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
              <input
                type="email"
                required
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#581c87] outline-none text-gray-900"
                placeholder="nama@sekolah.id"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
              <input
                type={showPassword ? "text" : "password"}
                required
                className="w-full pl-10 pr-10 py-2 border rounded-lg focus:ring-2 focus:ring-[#581c87] outline-none text-gray-900"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? (
                  <EyeOff className="h-5 w-5" />
                ) : (
                  <Eye className="h-5 w-5" />
                )}
              </button>
            </div>
          </div>

          <div className="text-right">
            <button
              type="button"
              onClick={() => {
                setShowForgotPasswordModal(true);
                setForgotPasswordEmail("");
                setForgotPasswordError("");
                setForgotPasswordSuccess("");
              }}
              className="text-sm text-[#581c87] hover:underline"
            >
              Lupa Password?
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#581c87] text-white py-2.5 rounded-lg font-medium hover:bg-[#45156b] transition disabled:opacity-50"
          >
            {loading ? "Memproses..." : "Masuk"}
          </button>
        </form>
      </div>

      {showForgotPasswordModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-sm">
            <h2 className="text-xl font-bold text-gray-800 mb-4">
              Reset Password
            </h2>
            {forgotPasswordError && (
              <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg mb-4">
                {forgotPasswordError}
              </div>
            )}
            {forgotPasswordSuccess && (
              <div className="bg-green-50 text-green-600 text-sm p-3 rounded-lg mb-4">
                {forgotPasswordSuccess}
              </div>
            )}
            {!forgotPasswordSuccess && (
              <div className="space-y-4">
                <p className="text-sm text-gray-600">
                  Masukkan email Anda untuk menerima link reset password.
                </p>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                    <input
                      type="email"
                      required
                      className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#581c87] outline-none text-gray-900"
                      placeholder="nama@sekolah.id"
                      value={forgotPasswordEmail}
                      onChange={(e) => setForgotPasswordEmail(e.target.value)}
                    />
                  </div>
                </div>
                <button
                  onClick={handlePasswordReset}
                  disabled={loading}
                  className="w-full bg-[#581c87] text-white py-2.5 rounded-lg font-medium hover:bg-[#45156b] transition disabled:opacity-50"
                >
                  {loading ? "Mengirim..." : "Kirim Link Reset"}
                </button>
              </div>
            )}
            <button
              onClick={() => setShowForgotPasswordModal(false)}
              className="mt-4 w-full bg-gray-200 text-gray-800 py-2.5 rounded-lg font-medium hover:bg-gray-300 transition"
            >
              Tutup
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
