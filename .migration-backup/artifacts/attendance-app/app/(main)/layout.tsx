"use client";

import { useAuth } from "@/lib/auth-context";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";
import { Home, Camera, FileText, Clock, LayoutDashboard } from "lucide-react";
import { cn } from "@/lib/utils";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace("/login");
    }
  }, [user, isLoading, router]);

  if (isLoading || !user) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#FBF9F3]">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full border-4 border-[#FACC15] border-t-transparent animate-spin mx-auto mb-3" />
          <p className="text-[#8C8573] text-sm">Memuat...</p>
        </div>
      </div>
    );
  }

  const isAdmin = user.role === "admin" || user.role === "hr";

  const navItems = [
    { name: "Beranda", href: "/dashboard", icon: Home },
    { name: "Absen", href: "/absen", icon: Camera },
    { name: "Izin", href: "/izin", icon: FileText },
    { name: "Riwayat", href: "/riwayat", icon: Clock },
    ...(isAdmin ? [{ name: "Admin", href: "/admin", icon: LayoutDashboard }] : []),
  ];

  return (
    <div className="flex-1 flex flex-col bg-[#FBF9F3] h-full overflow-hidden">
      <main className="flex-1 overflow-y-auto pb-20">
        {children}
      </main>

      <nav className="absolute bottom-0 w-full bg-white border-t border-gray-200 pb-safe z-50 shadow-[0_-2px_12px_rgba(0,0,0,0.06)]">
        <div className={cn(
          "flex items-center justify-around h-16 px-1",
          isAdmin ? "gap-0" : "gap-1"
        )}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href ||
              (item.href !== "/dashboard" && (pathname ?? "").startsWith(item.href));
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex flex-col items-center justify-center flex-1 h-full space-y-1 transition-all duration-150",
                  isActive ? "text-[#4A4435]" : "text-[#8C8573]"
                )}
              >
                <div className={cn(
                  "flex items-center justify-center rounded-xl transition-all duration-150",
                  isActive ? "bg-[#FACC15] w-10 h-6" : "w-6 h-6"
                )}>
                  <Icon className={cn(
                    "transition-all duration-150",
                    isActive ? "w-4 h-4 stroke-[2.5px]" : "w-5 h-5 stroke-2"
                  )} />
                </div>
                <span className={cn(
                  "text-[10px] leading-none",
                  isActive ? "font-bold text-[#4A4435]" : "font-medium"
                )}>
                  {item.name}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
