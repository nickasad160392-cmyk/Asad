"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLogin } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { Loader2, Eye, EyeOff } from "lucide-react";
import Link from "next/link";

export default function LoginPage() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const { setUser } = useAuth();
  const router = useRouter();
  const login = useLogin();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier || !password) {
      toast.error("Email/ID dan kata sandi wajib diisi");
      return;
    }
    if (rememberMe) {
      localStorage.setItem("absensi_remember", "true");
    } else {
      localStorage.removeItem("absensi_remember");
    }
    login.mutate(
      { data: { identifier, password } },
      {
        onSuccess: (data) => {
          setUser(data.user, rememberMe);
          router.replace("/dashboard");
        },
        onError: (err: any) => {
          const msg = err?.response?.data?.error || err?.data?.error || "Login gagal. Periksa kembali email dan kata sandi Anda.";
          toast.error(msg);
        },
      },
    );
  };

  return (
    <div className="flex-1 flex flex-col min-h-[100dvh] bg-white">
      <div className="bg-[#FACC15] px-6 pt-16 pb-12 rounded-b-[40px]">
        <div className="w-14 h-14 rounded-2xl bg-[#4A4435] flex items-center justify-center mb-5 shadow-lg">
          <svg className="w-8 h-8 text-[#FACC15]" fill="currentColor" viewBox="0 0 24 24">
            <path d="M17 12h-5v5h5v-5zM16 1v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-1V1h-2zm3 18H5V8h14v11z"/>
          </svg>
        </div>
        <h1 className="text-3xl font-extrabold text-[#4A4435] tracking-tight">Absensi</h1>
        <p className="text-[#4A4435]/70 mt-1 text-sm font-medium">Masuk untuk mencatat kehadiran Anda</p>
      </div>

      <div className="flex-1 px-6 pt-8 pb-8 flex flex-col">
        <form onSubmit={handleSubmit} className="space-y-4 flex-1">
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-[#4A4435]">Email atau ID Karyawan</label>
            <input
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="Masukkan email atau ID"
              className="w-full h-12 px-4 rounded-xl border border-gray-200 bg-gray-50 text-[#4A4435] placeholder-[#8C8573] text-sm focus:outline-none focus:ring-2 focus:ring-[#FACC15] focus:border-transparent transition"
              disabled={login.isPending}
              autoComplete="username"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-[#4A4435]">Kata Sandi</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full h-12 px-4 pr-12 rounded-xl border border-gray-200 bg-gray-50 text-[#4A4435] placeholder-[#8C8573] text-sm focus:outline-none focus:ring-2 focus:ring-[#FACC15] focus:border-transparent transition"
                disabled={login.isPending}
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8C8573]"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <label className="flex items-center gap-2.5 cursor-pointer">
            <div
              onClick={() => setRememberMe(!rememberMe)}
              className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                rememberMe ? "bg-[#FACC15] border-[#FACC15]" : "border-gray-300 bg-white"
              }`}
            >
              {rememberMe && (
                <svg className="w-3 h-3 text-[#4A4435]" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
            <span className="text-sm text-[#4A4435]">Simpan Sandi</span>
          </label>

          <div className="pt-2">
            <button
              type="submit"
              disabled={login.isPending}
              className="w-full h-12 rounded-2xl bg-[#FACC15] text-[#4A4435] font-bold text-base flex items-center justify-center gap-2 shadow-md active:scale-[0.98] transition-transform disabled:opacity-60"
            >
              {login.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : "Masuk"}
            </button>
          </div>

          <div className="text-center pt-2">
            <p className="text-sm text-[#8C8573]">
              Belum punya akun?{" "}
              <Link href="/register" className="text-[#4A4435] font-semibold underline underline-offset-2">
                Daftar di sini
              </Link>
            </p>
          </div>
        </form>

        <p className="text-center text-xs text-[#8C8573]/60 mt-6">PT. Lembayung Wanantara Padha</p>
      </div>
    </div>
  );
}
