# MediShelf POS — Production Audit Report

**Date:** 2026-10-14 · **Scope:** entire `src/` tree (≈25k lines, 189 files): POS, checkout, invoices, customers, catalog, inventory, suppliers, reports, dashboard, scheduled emails, auth, RBAC, accounts, billing/Razorpay, shared UI.
**Result:** 122 files changed (+3.6k / −2.6k). `tsc` clean, `next build` clean (83 routes), no new lint rule violations (React-hook warnings 33 → 15).

---

## 1. Do these before deploying

| # | Action | Why |
|---|--------|-----|
| 1 | **Rotate the MongoDB password for user `navnit_db_user` on the `clinicemr` cluster.** | It was hard-coded in `scripts/check_customer.js` and committed (commit `b9b29dc`). Removed from the file, but it remains in git history. Purging history (`git filter-repo`) is optional once rotated. |
| 2 | Run `npm run db:setup` against each environment. | Adds 13 new indexes (§5). The script now continues past failures and prints any unique index that couldn't build because of existing duplicate data (e.g. duplicate `customers.customer_id`). Clean those up and re-run. |
| 3 | Smoke-test on a staging DB (§7). | None of the changes were executed against a database (only a shared remote Atlas cluster was configured, so no write tests were run). |
| 4 | Confirm the behaviour changes in §6 are acceptable. | Some report figures and validation rules intentionally change. |

---

## 2. Critical & High findings (all fixed)

### Security
| Sev | Area | Issue | Fix |
|---|---|---|---|
| **Critical** | `scripts/check_customer.js` | Live MongoDB credentials committed to the repo. | Reads `MONGODB_URI` from env. **Rotate the password (§1).** |
| **Critical** | `next.config.ts` CSP | `script-src/connect-src 'self'` blocked `checkout.razorpay.com`, so **subscriptions could not be paid**. It also blocked Microsoft Clarity. Dev mode lacked the `'unsafe-eval'` React needs. | Allow-listed Razorpay (script, frame, API) and Clarity. Added `object-src 'none'`, `Referrer-Policy` and `Permissions-Policy`. |
| High | `api/users/[id]` | A non-owner with USERS:EDIT could reset the password of a **more-privileged** colleague and sign in as them, or delete them. | The target's current permissions must be a subset of the caller's; filters are tenant-scoped; the OWNER can't be deleted. Self password changes are routed to Account → Security. |
| High | `api/auth/reset-password` | The lookup also accepted the raw stored token, so a leaked DB/backup hash was directly usable. The token wasn't atomically single-use. | Matches the hash only, and consumes the token with an atomic conditional update. |
| High | Password change / reset | Existing JWT sessions survived a password change (a stolen session stayed valid). | `password_changed_at` + `authAt` on the token. Older sessions end within 60 s. The security page signs the user out with a message. |
| High | `api/audit-logs`, `inventory/movements`, `products/[id]/logs` | `$lookup` returned whole user docs, **including `resetToken`/password hash**. Unescaped `$regex` (ReDoS / 500). NaN paging crashed with a 500. | Field projections, `escapeRegExp`, parsed and clamped paging, tenant-scoped lookups after skip/limit. |
| High | All report routes + daily email | Product, batch, category and supplier `$lookup`s were **not tenant-scoped**. | `tenant_id` match in every lookup sub-pipeline (except legacy `sale_items`, see §6). |
| High | `api/pos/invoices/[id]` | Returned `cost_price`/`profit` to cashiers. | Projected out. Idempotency fields are stripped too. |
| High | `api/settings/reports/test` | Anyone with settings access could email the store's report PDF to **any address**, with no rate limit. Settings routes also skipped the lapsed-subscription lock. | Only saved recipients, 5 per hour per tenant, audited. Uses `checkPermission` (respects the 402 lock). |
| Medium | Misc auth | No rate limit on password change. Forgot-password only limited per IP (inbox flooding) and timing revealed which accounts exist. Emails weren't normalized before validation. HTML injection in email templates (store name). Reset token left in the URL and visible to session replay. | Rate limits, `after()` sends, `trim().toLowerCase()` in schemas, `escapeHtml`, token stripped from the URL. |
| Medium | Razorpay webhooks | Out-of-order events could move a subscription backwards (late `activated` overwriting `halted`). Store activation could skip business details. | `synced_at` freshness guard, re-fetch from Razorpay, conditional checkout promotion. Checkout needs `currency` set. |

### Money, stock & data integrity
| Sev | Area | Issue | Fix |
|---|---|---|---|
| High | `lib/posMath.ts` + sell API | Client and server rounded differently. **About 1 in 400 discounted carts displayed a total one cent below what was billed and printed.** | Single shared `totalsFromDiscount()`. Fuzzed with 200k carts: 0 mismatches. |
| High | POS sell page | A timed-out checkout retried with a different payment method got a **new idempotency key → double billing**. Rapid scans could exceed stock. Parallel Enter presses added items twice. Stale search responses overwrote newer ones. | Stable key (payment method excluded; the server returns 409 on a mismatch, including in the race path). Quantities are capped inside the state updater. Re-entrancy lock. Responses are matched to the latest query. |
| High | P&L, dashboard, sales report, daily email | **Profit was overstated** (line profit taken before the bill discount). The P&L waterfall subtracted discounts twice. The daily email treated a line *percentage* discount as currency. Legacy lines with no cost price counted as 0 cost. Days were grouped in UTC. | One definition, `saleLineStages()`: the bill discount is allocated across lines in proportion to their amount, tax is excluded, legacy COGS is derived. Grouping uses the store timezone. |
| High | `inventory/adjust` | Manual "SALE" adjustments polluted the ledger. DAMAGE could *add* stock, RETURN could remove it. | Allowed types are DAMAGE (−), RETURN (+), ADJUSTMENT (±). Quantity and notes are bounded. |
| High | `inventory/batches` POST | The batch and its PURCHASE movement weren't atomic, there was no audit trail, and duplicate batch numbers raced. Zero-price and expired batches were accepted (they can't be sold). | Transaction (with standalone fallback), `withAuditLog`, 11000 → 409, `selling_price > 0`, expiry ≥ store today, `supplier_id` + `qty_received` stored. |
| High | `products/bulk` | Zod v4 `err.errors` is undefined, so every row error read "Invalid data". Categories were created before validation (orphans on rejected uploads). An ordered insert aborted midway. No row limit. | Validate first, then race-safe upserts. Unordered insert with per-row partial-success reporting. 1,000-row and 5 MB caps. |
| High | `ProductForm` | Editing any product with a cleared optional field failed silently (null vs string). | Initial data is normalized; inline errors and a summary banner are shown. |
| High | `customers` POST | `CUST-YYYY-NNNN` came from a read-max-then-add-1, so concurrent creates got duplicate ids. | Atomic counter (same pattern as invoice numbers), plus a unique index. |
| Medium | Low-stock (dashboard, alerts, stock list, daily email) | Expired batches counted as available stock, so the four screens disagreed. | One rule: active product, non-expired stock with `qty > 0`, `<=` the minimum. |
| Medium | Expiry report | Batches with a blank expiry ("never expires") showed as **Expired**. | Uses `$gt: ""`, store-local today. |
| Medium | Fast-moving / inventory value | Average daily sales divided by future days. Expected profit included expired stock. Category was always "General Health". | Fixed; `expired_value` is reported separately. |
| Medium | Customers | An update without `status` silently **reactivated** deleted customers. Inactive customers were selectable at POS. Cashiers received full PII (address, DOB, notes). | Fixed. Users without CUSTOMERS:VIEW get only name, phone, email and id. |
| Medium | Suppliers | Renaming a supplier orphaned its purchase history. "Quantity received" showed the *current* quantity. | Batches are linked by `supplier_id` and renames propagate. Shows `qty_received`. |
| Medium | Scheduled reports (`agenda.ts`) | One tenant with a bad timezone stopped every store's report. A failed send retried every minute all day. A failed log write after a successful send caused **duplicate emails**. A missing `RESEND_API_KEY` was logged as SUCCESS. | Isolation per tenant, PENDING-claim before send, max 3 failures per day, `concurrency: 1`, single start per process, errors thrown when nothing was sent. |

---

## 3. Performance

| Change | Effect |
|---|---|
| **Session refresh memo** (`lib/sessionAccess.ts`) | `auth()` in route handlers can't write the refreshed cookie, so after 60 s **every API call** did 2 DB round trips, and audited routes did it twice. Now there is one lookup per user per 10 s per instance. Revocation still applies within the same window. |
| Report routes | Each report ran the same lookup-heavy pipeline 3–4 times (metrics / page / count / export) and joined *all* rows before `skip/limit`. Now: one `$facet` pass, pagination before joins, product filters resolved to ids first, `countDocuments` for counts, `limit ≤ 100`, export ≤ 10k rows, range ≤ 366 days. |
| Lookups | Per-document `$expr` lookups (no index use) replaced with equality joins on `{tenant_id, product_id}` in products, low-stock and fast-moving. |
| `GET /api/inventory/batches` | Returned full product docs for every batch with no limit. Now projected, with optional filters and a 10k hard cap. |
| Frontend | AbortController / latest-request guards on every filterable list (invoices, customers, history, audit logs, 5 reports). Debounced customer search. Memoized `CurrencyContext` value (it re-rendered every consumer on each session refetch). Header no longer calls `auth()` a second time. SearchableSelect renders at most 200 options. |
| Logging | The file logger wrote `logs/app.log` without rotation in production; it is now dev-only. Errors still go to the Mongo `logs` collection. `logs/` is now git-ignored and the committed log, which contained an email address, is untracked. |

---

## 4. UI / UX & accessibility

- **Focus rings were invisible app-wide.** A global `* { box-shadow: none !important }` killed every Tailwind v4 ring (246 usages). Now only drop shadows are reset. **Expect visible focus rings and any intentional `ring-*` decoration to appear.**
- Undefined theme tokens (`bg-card`, `bg-popover`, `bg-accent`) rendered transparent: the currency menu had no background and the select had no hover. Added.
- `animate-in` utilities did nothing (plugin not installed). Minimal keyframes added, and `prefers-reduced-motion` is respected.
- `Form` never rendered validation messages. `Modal` had no dialog semantics, Escape, focus trap or scroll lock. `SearchableSelect` was mouse-only (now an ARIA combobox with full keyboard support). `Button` gained a `loading` prop.
- **Mobile:** the dashboard sidebar is now a drawer below `lg`, the account sidebar collapses to an icon rail, and wide tables scroll inside their container.
- **Navigation:** the active tab is now correct (POS tabs, Categories vs Products). Cashiers no longer see a Dashboard link that bounced them. Audit Logs is shown based on the permission the API actually checks.
- `error.tsx` uses Next 16 `retry()`. Added `global-error.tsx` for root-layout failures.
- Currency: `$-5.00` → `-$5.00`, thousands grouped. Hard-coded `$` on customer and purchase-history pages now follows the store currency.
- Dates: `new Date("yyyy-MM-dd")` showed the *previous day* west of UTC (DOB, expiry, inventory). Fixed.
- Double-submit guards, loading/empty/error states with Retry, `htmlFor`/`aria-label`/`autoComplete` across auth, onboarding, account, catalog, customers, suppliers and POS.

---

## 5. Database indexes added (`src/scripts/setup-db.ts`)

`products {tenant_id, category_id}` · `batches {tenant_id, created_at}`, `{tenant_id, supplier_id}` · `sales {tenant_id, customer_id, created_at}` · `sale_items {tenant_id, product_id}` · `stock_movements {tenant_id, movement_type, created_at}`, `{tenant_id, batch_id}` · `customers {tenant_id, customer_id}` **unique (partial)** · `audit_logs {tenant_id, user_id, timestamp}` · `settings {tenant_id}`, `{reports.enabled}` · `email_logs {tenant_id, reportType, date, status}`, `{tenant_id, sentAt}`.

---

## 6. Behaviour changes to confirm

1. **Profit figures will be lower** than before wherever bill discounts exist (the previous figures were overstated). "Gross Revenue" in the P&L is relabelled "Net Revenue (ex. tax)". Sales KPI is "Total Sales (incl. tax)".
2. Expected profit and selling value exclude expired stock. Low-stock counts now include products with minimum stock 0 that are out of stock.
3. New batches require `selling_price > 0`, quantity > 0 and a non-past expiry. A selling price below cost is warned, not blocked.
4. Manual stock adjustment no longer offers "Sale".
5. A test report email can only go to a saved recipient.
6. Changing your own password (Account → Security) signs out all your sessions, including the current one. Admins can't change their *own* password from the Users screen.
7. New length limits on names, barcodes, notes and addresses. A record already over a limit will need trimming on its next edit.
8. **Legacy data:** `sale_items` created before commit `4b050f4` have no `tenant_id`. Line-item joins deliberately don't filter on it, because the parent sale is already tenant-scoped. An optional backfill would allow tightening later: `sale_items.tenant_id ← sales.tenant_id` via `sale_id`.

---

## 7. Verification performed

- `npx tsc --noEmit` ✔ · `npm run build` ✔ (83 routes) · ESLint: no new rule categories.
- 200k-cart fuzz of client vs server totals: 0 mismatches after the fix (486 before).
- 20k-sale randomized test: the bill-discount allocation sums back to `subtotal − discount` (±0.02).
- `resolveReportRange` tested across IST, New York (DST day), UTC and Kiritimati; invalid dates and ranges over 366 days return 400.
- Two independent adversarial review passes over the full diff. They found one high-severity regression (the legacy `sale_items` tenant filter, which would have blanked historical reports) and three low-severity ones. All four are fixed.
- **Not performed:** execution against MongoDB, browser/E2E or responsive testing (no local DB or Docker available, and the configured DB is a shared remote cluster).

**Recommended staging smoke test:** checkout (cash, then retry on timeout with the payment method switched → expect 409, not a second sale); receive stock; adjust DAMAGE; bulk upload with one bad row; P&L for a range with discounted sales; daily report test-send; Razorpay subscribe in test mode (verifies CSP); password reset end-to-end; keyboard-only pass through POS and a modal.

---

## 8. Remaining risks & recommendations

| Priority | Item |
|---|---|
| High | **No returns/refunds flow** (`/pos/returns` is "coming soon"). Once it ships, every report needs returns adjustments and stock must be restored atomically. |
| Medium | **Tax model:** POS applies a flat 5% (`POS_TAX_RATE`) and ignores each product's `tax_rate`. This was left unchanged as a business decision, but it is likely wrong for GST/VAT compliance. |
| Medium | `GET /api/products` is unpaginated with 3 lookups per product. The products page and add-stock picker filter on the client; server pagination needs a UI change. |
| Medium | Dark mode is not implemented (no dark tokens; ~25 files hard-code slate/zinc). The `dark` variant is now wired for next-themes, but pages need to move to tokens first. |
| Medium | Shared UI components are barely adopted: `Modal`, `Table`, `Card`, `Alert` have 0 page imports, and there are 7 hand-built modals and three alert systems (sweetalert2 / inline / `Alert`). Converge on `ui/*`, and lazy-load `sweetalert2` and `recharts`. `framer-motion` is unused and can be removed. |
| Low | Fractional quantities are allowed (POS, adjustments). If not intended for loose units, enforce integers in `saleItemSchema`/`batchSchema`. |
| Low | Role or permission changes still take up to 60 s to reach other users' sessions (`ACCESS_REFRESH_MS`). |
| Low | Registration responses reveal whether an email is registered (rate-limited); fully closing this needs an email-verification flow. |
| Low | `getClientIp` trusts `X-Forwarded-For`; make sure the hosting proxy overwrites it. |
| Low | Stray debug scripts (`src/check_db.js`, `test_agenda.js`, `scripts/check_customer.js`) dump raw collections; consider deleting them. |
| Low | WEEKLY/MONTHLY report frequencies are accepted but always send daily (the UI says daily only). |
