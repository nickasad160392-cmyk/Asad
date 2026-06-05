"use client";

import { useAuth } from "@/lib/auth-context";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";
import { Home, Clock, CalendarHeart, LayoutDashboard } from "lucide-react";
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
      <div className="flex-1 flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="w-8 h-8 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin"></div>
      </div>
    );
  }

  const isAdmin = user.role === "admin" || user.role === "hr";

  const navItems = [
    { name: "Dashboard", href: "/dashboard", icon: Home },
    { name: "History", href: "/history", icon: Clock },
    { name: "Leave", href: "/leave", icon: CalendarHeart },
    ...(isAdmin ? [{ name: "Admin", href: "/admin", icon: LayoutDashboard }] : []),
  ];

  return (
    <div className="flex-1 flex flex-col bg-slate-50 dark:bg-slate-900 h-full overflow-hidden">
      <main className="flex-1 overflow-y-auto pb-24">
        {children}
      </main>

      <nav className="absolute bottom-0 w-full bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 pb-safe z-50">
        <div className="flex items-center justify-around h-16 px-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors",
                  isActive
                    ? "text-indigo-600 dark:text-indigo-400"
                    : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-300"
                )}
              >
                <Icon className={cn("w-5 h-5", isActive ? "stroke-[2.5px]" : "stroke-2")} />
                <span className="text-[10px] font-medium">{item.name}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
