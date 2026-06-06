---
name: API server auth pattern
description: JWT auth setup for the Express 5 API server and frontend token wiring
---

**Express 5 params:** `req.params.id` is typed `string | string[]` — always cast with `String(req.params.id)` before parseInt.

**JWT:** Signed with `process.env.JWT_SECRET` (fallback hardcoded default for dev). 30-day expiry. Token returned in login/register response body AND set as httpOnly cookie `token`.

**Frontend token wiring:** `setAuthTokenGetter()` from `@workspace/api-client-react` is configured in `artifacts/attendance-app/src/main.tsx` to read from `sessionStorage.getItem("absensi_token")`. Token is stored there by `auth-context.tsx` `login()` function.

**Error handling:** API errors use `err?.data?.error` pattern (custom-fetch wraps errors as `ApiError` with `.data` field), NOT `err?.response?.data?.error` (axios pattern).

**Why:** The API client uses a custom fetch wrapper (not axios), so error shape is different from typical React Query + axios setups.
