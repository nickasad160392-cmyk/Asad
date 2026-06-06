"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

export default function RootPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      if (user) {
        router.replace("/dashboard");
      } else {
        router.replace("/login");
      }
    }
  }, [user, isLoading, router]);

  return (
    <div className="flex-1 flex items-center justify-center h-screen bg-[#FACC15]">
      <div className="text-center">
        <div className="w-16 h-16 rounded-2xl bg-[#4A4435] flex items-center justify-center mx-auto mb-4 shadow-lg">
          <svg className="w-9 h-9 text-[#FACC15]" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/>
          </svg>
        </div>
        <p className="text-[#4A4435] font-bold text-xl">Absensi</p>
      </div>
    </div>
  );
}
