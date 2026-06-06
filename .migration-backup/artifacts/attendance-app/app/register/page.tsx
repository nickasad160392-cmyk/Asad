"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useRegister } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { Loader2, Eye, EyeOff, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const { setUser } = useAuth();
  const router = useRouter();
  const register = useRegister();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password) {
      toast.error("Nama, email, dan kata sandi wajib diisi");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Konfirmasi kata sandi tidak cocok");
      return;
    }
    if (password.length < 6) {
      toast.error("Kata sandi minimal 6 karakter");
      return;
    }

    register.mutate(
      { data: { name, email, password, phone: phone || undefined } },
      {
        onSuccess: (data) => {
          setUser(data.user);
          toast.success("Registrasi berhasil! Selamat datang.");
          router.replace("/dashboard");
        },
        onError: (err: any) => {
          const msg = err?.response?.data?.error || err?.data?.error || "Registrasi gagal. Coba lagi.";
          toast.error(msg);
        },
      },
    );
  };

  return (
    <div className="flex-1 flex flex-col min-h-[100dvh] bg-white">
      <div className="bg-[#FACC15] px-6 pt-14 pb-10 rounded-b-[40px]">
        <Link href="/login" className="inline-flex items-center gap-1 text-[#4A4435]/70 mb-4">
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm font-medium">Kembali</span>
        </Link>
        <h1 className="text-2xl font-extrabold text-[#4A4435]">Buat Akun Baru</h1>
        <p className="text-[#4A4435]/70 mt-1 text-sm">Lengkapi data diri Anda untuk mendaftar</p>
      </div>

      <div className="flex-1 px-6 pt-7 pb-8 flex flex-col">
        <form onSubmit={handleSubmit} className="space-y-4 flex-1">
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-[#4A4435]">Nama Lengkap</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nama sesuai KTP"
              className="w-full h-12 px-4 rounded-xl border border-gray-200 bg-gray-50 text-[#4A4435] placeholder-[#8C8573] text-sm focus:outline-none focus:ring-2 focus:ring-[#FACC15] focus:border-transparent transition"
              disabled={register.isPending}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-[#4A4435]">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@perusahaan.com"
              className="w-full h-12 px-4 rounded-xl border border-gray-200 bg-gray-50 text-[#4A4435] placeholder-[#8C8573] text-sm focus:outline-none focus:ring-2 focus:ring-[#FACC15] focus:border-transparent transition"
              disabled={register.isPending}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-[#4A4435]">
              Nomor HP <span className="font-normal text-[#8C8573]">(opsional)</span>
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="08xxxxxxxxxx"
              className="w-full h-12 px-4 rounded-xl border border-gray-200 bg-gray-50 text-[#4A4435] placeholder-[#8C8573] text-sm focus:outline-none focus:ring-2 focus:ring-[#FACC15] focus:border-transparent transition"
              disabled={register.isPending}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-[#4A4435]">Kata Sandi</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimal 6 karakter"
                className="w-full h-12 px-4 pr-12 rounded-xl border border-gray-200 bg-gray-50 text-[#4A4435] placeholder-[#8C8573] text-sm focus:outline-none focus:ring-2 focus:ring-[#FACC15] focus:border-transparent transition"
                disabled={register.isPending}
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

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-[#4A4435]">Konfirmasi Kata Sandi</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Ulangi kata sandi"
              className="w-full h-12 px-4 rounded-xl border border-gray-200 bg-gray-50 text-[#4A4435] placeholder-[#8C8573] text-sm focus:outline-none focus:ring-2 focus:ring-[#FACC15] focus:border-transparent transition"
              disabled={register.isPending}
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={register.isPending}
              className="w-full h-12 rounded-2xl bg-[#FACC15] text-[#4A4435] font-bold text-base flex items-center justify-center gap-2 shadow-md active:scale-[0.98] transition-transform disabled:opacity-60"
            >
              {register.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : "Daftar Sekarang"}
            </button>
          </div>

          <p className="text-center text-sm text-[#8C8573]">
            Sudah punya akun?{" "}
            <Link href="/login" className="text-[#4A4435] font-semibold underline underline-offset-2">
              Masuk
            </Link>
          </p>
        </form>

        <p className="text-center text-xs text-[#8C8573]/60 mt-4">PT. Lembayung Wanantara Padha</p>
      </div>
    </div>
  );
}
