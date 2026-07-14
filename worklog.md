# Worklog: Replace `supabaseServer` with `auth.db` in API Routes

**Date:** 2025-06-18
**Task:** Update 18 API route files to use `auth.db` (from `withAuth()`) instead of the top-level `supabaseServer` import.

## Summary

All 18 target files under `src/app/api/` have been updated. In each file:

1. **Removed** the import `import { supabaseServer } from '@/lib/supabase-server'`
2. **Replaced** all occurrences of `supabaseServer` with `auth.db` inside functions that call `withAuth(request)`

## Files Changed (18 total, 91 replacements)

| # | File | Replacements |
|---|------|-------------|
| 1 | `auth/me/route.ts` | 3 |
| 2 | `auth/switch-store/route.ts` | 2 |
| 3 | `reconciliation/route.ts` | 3 |
| 4 | `stock-takes/route.ts` | 12 |
| 5 | `expenses/route.ts` | 4 |
| 6 | `analytics/route.ts` | 3 |
| 7 | `settings/route.ts` | 4 |
| 8 | `dashboard/route.ts` | 10 |
| 9 | `products/route.ts` | 7 |
| 10 | `categories/route.ts` | 5 |
| 11 | `stores/route.ts` | 3 |
| 12 | `reports/route.ts` | 6 |
| 13 | `purchases/route.ts` | 4 |
| 14 | `suppliers/route.ts` | 7 |
| 15 | `sales/route.ts` | 3 |
| 16 | `super-admin/route.ts` | 7 |
| 17 | `audit-logs/route.ts` | 1 |
| 18 | `staff/route.ts` | 7 |

## Files NOT Modified (as instructed)

- `auth/login/route.ts` — creates its own `supabaseServer` via `createClient()` for sign-in; does not use `withAuth`
- `auth/register/route.ts` — does not use `withAuth`
- `auth/logout/route.ts` — not in the target list
- `route.ts` (root api route) — not in the target list

## Verification

- `rg supabaseServer src/app/api/**/route.ts` — only matches in `auth/login/route.ts` (expected)
- `rg supabase-server src/app/api/**/route.ts` — zero matches (all imports removed)
- `rg auth\.db src/app/api/**/route.ts` — 91 occurrences across all 18 files

## Notes

- In `staff/route.ts`, the `SUPABASE_URL` and `SUPABASE_ANON_KEY` constants were preserved as-is (they are used directly for a `fetch()` call to the addstaff edge function, not via `supabaseServer`).
- No files had `supabaseServer` usage outside of `withAuth`-using functions, so the import was safe to remove in all 18 cases.