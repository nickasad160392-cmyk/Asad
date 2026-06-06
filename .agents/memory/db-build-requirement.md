---
name: DB package build requirement
description: @workspace/db must be compiled before api-server typecheck can resolve its exported schema symbols
---

The `lib/db` package uses TypeScript project references (`"composite": true`, `"emitDeclarationOnly": true`). The api-server's tsconfig lists it as a reference. If `lib/db/dist/` doesn't exist or is stale, running `tsc --noEmit` on the api-server will report "Module '@workspace/db' has no exported member 'users'" etc.

**Why:** TypeScript project references require declaration files to exist in `dist/` before dependent packages can use them.

**How to apply:** Before running api-server typecheck after schema changes, run `npx tsc -p lib/db/tsconfig.json` first. The `drizzle-kit push` command does NOT build declarations — it only syncs to the DB.
