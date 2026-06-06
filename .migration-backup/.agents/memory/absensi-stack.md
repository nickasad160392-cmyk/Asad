---
name: Absensi app stack
description: Key technical decisions for the Absensi attendance app rebuild
---

**App**: PT. Lembayung Wanantara Padha attendance system ("Absensi")
**Brand colors**: Primary yellow #FACC15, background #FBF9F3, charcoal #4A4435, muted #8C8573
**Language**: Indonesian UI throughout

**Frontend**: Next.js 15 app in artifacts/attendance-app, bottom nav (Beranda/Absen/Izin/Riwayat/Admin)
**API**: Express 5 in artifacts/api-server, port 8080, prefix /api
**DB**: PostgreSQL + Drizzle ORM
**Codegen**: Orval from lib/api-spec/openapi.yaml → lib/api-client-react/src/generated/

**Billing cycle**: 7th of month to 6th of next month (cycleStart param = YYYY-MM-07)
**Status values**: hadir, terlambat, izin, sakit, alpha, lembur (Indonesian)
**Leave types**: sakit, pribadi, keluarga, dinas

**Routes**: /login, /register, /dashboard, /absen, /izin, /riwayat, /admin, /admin/karyawan, /admin/izin, /admin/rekap
**Old routes /history and /leave**: redirect to /riwayat and /izin

**Why:** Full rebuild from English "AttendTrack" to Indonesian "Absensi" with new brand identity and 7-6 billing cycle logic
