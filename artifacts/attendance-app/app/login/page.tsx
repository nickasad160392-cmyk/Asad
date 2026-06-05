"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLogin } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth-context";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Building2, Loader2 } from "lucide-react";

export default function LoginPage() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const { setUser } = useAuth();
  const router = useRouter();
  const login = useLogin();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier || !password) {
      toast.error("Silakan isi ID dan kata sandi");
      return;
    }

    login.mutate(
      { data: { identifier, password } },
      {
        onSuccess: (data) => {
          setUser(data.user);
          router.replace("/dashboard");
        },
        onError: (err) => {
          toast.error(err.data?.error || "Gagal masuk. Periksa kredensial Anda.");
        },
      }
    );
  };

  return (
    <div className="flex-1 flex flex-col justify-center px-6 bg-white dark:bg-slate-950">
      <div className="mb-10 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-600 text-white mb-6 shadow-lg shadow-indigo-600/30">
          <Building2 className="w-8 h-8" />
        </div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
          AttendTrack
        </h1>
        <p className="text-slate-500 mt-2 text-sm">Masuk untuk mencatat kehadiran</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="identifier" className="text-slate-700 dark:text-slate-300">
            Email atau ID Karyawan
          </Label>
          <Input
            id="identifier"
            type="text"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="Ketik email atau ID"
            className="h-12 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800"
            disabled={login.isPending}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password" className="text-slate-700 dark:text-slate-300">
            Kata Sandi
          </Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="h-12 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800"
            disabled={login.isPending}
          />
        </div>

        <Button
          type="submit"
          className="w-full h-12 text-base font-semibold mt-4 shadow-lg shadow-indigo-600/20"
          disabled={login.isPending}
        >
          {login.isPending ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            "Masuk"
          )}
        </Button>
      </form>
      
      <div className="mt-8 text-center">
        <p className="text-xs text-slate-400">
          Dengan masuk, Anda menyetujui Ketentuan Layanan.
        </p>
      </div>
    </div>
  );
}
