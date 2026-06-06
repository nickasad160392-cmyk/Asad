"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LeaveRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace("/izin"); }, [router]);
  return null;
}
