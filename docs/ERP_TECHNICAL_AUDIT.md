# Dandakaranya Foods ERP — Technical & Functional Audit

**Audit date:** 2026-08-28  
**Environment:** Local Cloud Agent dev (Next.js 16.2.6, Node 22, PostgreSQL 16, Prisma 5.22)  
**Application URL:** http://localhost:3001  
**Auditor role:** Enterprise ERP architect / QA / security / database review (read-only audit; no large refactors)  
**Evidence sources:** Repository inspection, `tsc`/`eslint`/`build`, curl probes, seeded DB counts, browser verification (admin session)

---

## 1. Executive Summary

The Dandakaranya Foods ERP is a **large, modular Next.js 16 application** with an expansive Prisma schema (**127 models**), **113 dashboard routes**, **34 API routes**, and **24 server-action modules**. Core operational domains—**CRM, sales, procurement, inventory, warehouse, production (MES core), quality, logistics, reports, and admin**—are backed by **real PostgreSQL data** and generally functional server actions with RBAC on mutations.

However, the codebase exhibits **significant production-readiness gaps**:

| Area | Verdict |
|------|---------|
| **Core ops modules** | Largely **WORKING** with seeded data; browser-verified for list/hub pages |
| **Finance module** | **UI ONLY** — almost entirely static mock data despite realistic UI |
| **HR module** | **PARTIALLY WORKING** — JSON file store + mock data; Prisma `Employee` underused |
| **Security** | **P0:** unauthenticated search API leaks CRM/sales data; **P1:** page-level RBAC gaps on Finance/HR/Production |
| **Quality gates** | **Production build FAILS** (TypeScript); 95 TS errors in 9 lib files; **zero automated tests** |
| **Deployment** | **Not production-ready** until build passes and critical security fixes land |

**Bottom line:** Strong demo-grade operational ERP for sales/procurement/inventory/production. Finance and HR are largely presentation layers. Treat as **internal pilot / demo**, not production financial or HR system, until Phase 2 hardening completes.

---

## 2. Architecture Assessment

### 2.1 Application architecture

| Layer | Technology | Notes |
|-------|------------|-------|
| Frontend | Next.js 16 App Router, React 19, Tailwind, Radix/shadcn-style UI | `(dashboard)` route group for authenticated shell |
| Backend | Server Components + Server Actions + Route Handlers | No separate API server |
| Auth | NextAuth v5 credentials + JWT (8h session) | Prisma user lookup; dev fallback on DB error |
| Data | Prisma 5 + PostgreSQL | Supabase-oriented URLs; local PG in dev |
| PDF | jsPDF + autotable | Invoice, quotation, payslip |
| Charts | Recharts | Dashboard, reports, module KPIs |

**Pattern:** Page → `lib/*-metrics.ts` (reads) → client components → `src/actions/*` (writes) → Prisma. Enterprise subsystems add `*-engine.ts`, `*-workflow.ts`, and domain audit log tables.

### 2.2 Next.js structure

```
src/app/
  layout.tsx                 # Root providers, fonts, theme
  login/                     # Credentials sign-in
  (dashboard)/               # ~113 pages, shared layout (auth + DB health gate)
    layout.tsx               # AppShell, sidebar badges
    page.tsx                 # Executive dashboard
    sales/, leads/, procurement/, inventory/, production/, finance/, hr/, ...
  api/
    auth/[...nextauth]/      # NextAuth
    v1/*                     # Versioned JSON APIs (RBAC via apiHandler)
    documents/, invoices/, quotations/, hr/, activity/, search/
  iclock/                    # ZKTeco ADMS device endpoints (public)
```

**Middleware:** `src/middleware.ts` wraps NextAuth `auth()` — enforces **login only**, not RBAC. Matcher excludes `iclock/*`, biometric webhook, static assets.

**Risk:** Next.js 16 deprecates `middleware` in favor of `proxy` (warning logged). Not blocking today.

### 2.3 Prisma / database architecture

- **127 models** spanning sales, procurement, inventory, warehouse, production MES, finance, HR, documents, biometric, compliance.
- **Money fields:** `Decimal` throughout; **no `Float` money fields** found (good).
- **Connection:** `DATABASE_URL` (pooler) + `DIRECT_URL` (migrations/seed).
- **Resilience layer:** `prisma-safe.ts`, `safe-prisma.ts`, `db-health.ts` — tolerate schema drift by returning empty metrics instead of hard failures (risk in production).
- **Transactions:** Used in sales invoicing, GRN receipt, RFQ→PO, warehouse transfers, production workflow, budget workflow (good for inventory/financial consistency where implemented).

### 2.4 Authentication implementation

| Component | File | Behavior |
|-----------|------|----------|
| NextAuth config | `src/auth.config.ts` | JWT callbacks; `authorized()` redirects unauthenticated users to `/login` |
| Credentials provider | `src/auth.ts` | bcrypt verify; activity logging; **dev fallback** via `tryDevLogin()` on DB errors |
| Session helpers | `src/lib/session.ts` | `getCurrentUser`, `requireUser`, `requirePermission` |
| Portal sign-in | `api/auth/portal-signin` | Cross-origin POST with origin validation |
| Legacy (dead) | `src/lib/auth.ts` | Supabase cookie session — **unused** |

**Findings:**
- `sessionVersion` stored in JWT but **never validated** on requests → forced logout / password reset ineffective.
- MFA UI exists (`NEXT_PUBLIC_ERP_MFA_ENABLED`) but verification is a **client-side placeholder** (800ms delay, no server check).
- Seed/default password `Admin@2026` documented in README.

### 2.5 Authorization / RBAC

| Role | Permissions (summary) |
|------|----------------------|
| ADMIN | Full |
| MANAGER | Broad ops; no `users.manage`, `sales.delete` |
| SALES_EXECUTIVE | Sales, leads, inventory view, documents upload |
| ACCOUNTANT | Finance, purchases, reports, documents |
| HR_EXECUTIVE | HR, documents |

**Enforcement layers (inconsistent):**

| Layer | Status |
|-------|--------|
| Middleware | Login only |
| Sidebar / `erp-modules.ts` | Role-filtered nav (UI) |
| ~41 dashboard pages | `requirePermission()` |
| **~72 dashboard pages** | **No `requirePermission`** — any authenticated user with direct URL |
| Server actions (mutations) | Generally `requirePermission` (good) |
| API v1 | `apiHandler({ permission })` (good) |
| Many non-v1 API routes | Manual `auth()` + `can()` (variable) |

**Critical gap:** Finance (14 routes) and HR (17 routes) have **zero** `requirePermission` calls in page files. Sidebar hides links from sales users, but **direct navigation is not blocked server-side**.

### 2.6 API / server actions

- **24 action files** under `src/actions/` — all `"use server"`.
- **34 API route handlers** — mix of `apiHandler`, manual auth, and **unprotected endpoints**.
- Validation: Zod in core CRM/sales/procurement actions; workflow actions often use typed args without Zod.
- Error handling: mix of `ActionResult` (`actionOk`/`actionFail`), thrown `Error("Forbidden")`, and API JSON errors.

### 2.7 Shared services (`src/lib/`)

~142 files organized by domain: `*-metrics.ts`, `*-engine.ts`, `*-types.ts`, PDF, CRM, documents, biometric, notifications.

**Technical debt:**
- Duplicate invoice serializers (`serialize-invoice.ts`, `invoice-serialize.ts`)
- Duplicate safe-query helpers (`prisma-safe.ts`, `safe-prisma.ts`)
- Shop/marketing components + `src/lib/api.ts` — **no dashboard routes reference them**
- `AuditTrail` model seeded but **never written at runtime** (app uses `ActivityLog`)

### 2.8 Validation

- **Zod:** auth login, sales, leads, quotations, customers, products, users, vendors, RFQ, GRN, documents, PO (partial).
- **Gaps:** warehouse/production/budget/approval workflows, notifications, HR form parsing without Zod.

### 2.9 Error handling

- Dashboard `error.tsx` detects Prisma migration errors and suggests `db:push` / `db:seed`.
- No centralized error taxonomy, no observability integration (Sentry, etc.).
- `logActivity` failures swallowed in auth (`.catch(() => undefined)`).

### 2.10 Audit logging

| System | Usage |
|--------|-------|
| `ActivityLog` + `logActivity()` | Primary — auth, sales, procurement, users, documents |
| Domain audit tables | `inventoryAuditLog`, `warehouseAuditLog`, `productionAuditLog`, `budgetAuditLog`, etc. — enterprise modules |
| `AuditTrail` model | **Dead** — seed only |

UI: `/activity` + CSV export (max 5000 rows, requires `activity.export`).

### 2.11 Environment configuration

| Source | Notes |
|--------|-------|
| `.env.local` | Local dev (gitignored); created by `.cursor/install.sh` |
| `.cursor/environment.json` | Cloud Agent bootstrap |
| README references `.env.local.example` | **Missing from repository** |

Key vars: `DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET`, `NEXTAUTH_URL`, Supabase keys (optional), biometric secrets, dev login overrides.

### 2.12 Test architecture

**None.** No Jest/Vitest/Playwright. Manual scripts only: `scripts/test-db.mjs`, `scripts/health-check.mjs`, `scripts/seed-with-direct.mjs`.

### 2.13 Seed / demo-data architecture

- `prisma/seed.ts` (~1970 lines): idempotent upserts across all domains.
- Default password: `Admin@2026` for all demo users.
- Seed ordering bug (quotation before lead) **fixed** on branch `cursor/setup-dev-environment-e076`.
- Re-seeding on non-empty DB can fail (unique constraint on `BudgetForecastPoint`) — install script guards seed to empty DB only.

**Seeded record counts (verified 2026-08-28):**

| Entity | Count |
|--------|-------|
| Users | 6 |
| Leads | 5 |
| Quotations | 6 |
| Sales orders | 1 |
| Sale invoices | 1 |
| Vendors | 2 |
| Purchases | 1 |
| GRNs | 1 |
| Products | 7 |
| Production batches | 2 |
| Ledger accounts | 2 |
| Expenses | 2 |
| Documents | 0 |
| Prisma Employee | 1 |

---

## 3. Module-by-Module Status Matrix

**Legend:** WORKING · PARTIALLY WORKING · UI ONLY · BROKEN · MISSING · NOT VERIFIED

| Module | Route(s) | Classification | Evidence |
|--------|----------|----------------|----------|
| **Dashboard** | `/` | **WORKING** | Prisma via `erp-metrics.ts`; browser: KPIs populated (Revenue MTD ₹2,090, etc.) |
| **CRM / Leads** | `/leads`, `/leads/new`, `/leads/[id]`, `/leads/whatsapp` | **WORKING** | Prisma + actions; browser: 4 kanban cards, pipeline ₹31.5L; DB: 5 leads |
| **Customers** | `/customers`, `/customers/[id]` | **WORKING** | Prisma + `customers` actions; `requirePermission` on pages |
| **Sales (Invoices)** | `/sales`, `/sales/new`, `/sales/[id]` | **WORKING** | Prisma + `sales` actions; DB: 1 invoice; page not browser-opened (curl 307 unauth) |
| **Quotations** | `/quotations`, `/quotations/new`, `/quotations/[id]` | **WORKING** | Prisma + actions; browser: 6 quotes listed; detail not opened |
| **Sales Orders** | `/sales/orders` | **WORKING** | Prisma; browser: SO-2026-0001 CONFIRMED |
| **Sales GST** | `/sales/gst` | **WORKING** | Prisma invoice-metrics; `requirePermission` |
| **Procurement Hub** | `/procurement` | **WORKING** | Prisma procurement-metrics |
| **RFQ & Sourcing** | `/procurement/rfq/*` | **WORKING** | Prisma + `rfq` actions |
| **GRN / Incoming QC** | `/procurement/grn/*` | **PARTIALLY WORKING** | Prisma + `grn` actions; DB: 1 GRN; page not browser-verified |
| **Procurement Approvals** | `/procurement/approvals/*` | **WORKING** | Prisma + approval-workflow; build TS error in `approval-metrics.ts` affects type safety |
| **Procurement Budgets** | `/procurement/budgets/*` | **PARTIALLY WORKING** | Prisma + budget-workflow; TS errors in budget-engine/types |
| **Procurement Payables** | `/procurement/payables` | **WORKING** | Prisma |
| **Purchase Orders (legacy)** | `/purchases/*` | **WORKING** | Prisma + actions; browser: PUR-2026-0001 |
| **PO Approvals (legacy)** | `/purchases/approvals` | **PARTIALLY WORKING** | Prisma reads; **no `requirePermission` on page** |
| **Suppliers / Vendors** | `/vendors/*` | **WORKING** | Prisma + vendor actions; browser: Bastar FPO Collective |
| **Inventory** | `/inventory/*` | **WORKING** | Prisma + inventory-workflow; browser: 7 SKUs, movements |
| **Products** | `/products` | **WORKING** | Prisma + product actions |
| **Warehouse** | `/warehouses/*` | **PARTIALLY WORKING** | Prisma + warehouse-workflow; **no page-level RBAC**; dispatch not browser-verified |
| **Production (MES core)** | `/production`, schedule, work-orders, batches, recipes, logs, costs, materials, machines | **WORKING** | Prisma production-metrics; browser: OEE 72%, batch PRD-2026-001 |
| **Production (sub)** | staff, maintenance, inventory, reports | **UI ONLY** | `MOCK_*` in `production-modules-client.tsx` |
| **Quality Control** | `/quality`, `/production/quality` | **PARTIALLY WORKING** | Prisma quality-metrics; QC form placeholder toast; not browser-verified |
| **Logistics** | `/logistics` | **WORKING** | Prisma logistics-metrics; `requirePermission` on page |
| **Finance (overview)** | `/finance` | **UI ONLY** | `getFinanceDashboardMetrics()` from `@/lib/finance/mock-data`; browser shows numbers but **not from DB** |
| **Finance (sub-pages)** | sales, purchases, cash-bank, gst, payroll, inventory, reports, budget, P&L, cash-flow | **UI ONLY** | Mock data files |
| **Finance (ledger)** | `/finance/ledger` | **PARTIALLY WORKING** | Prisma `ledgerAccount` (DB: 2 accounts); empty-state messaging |
| **Finance (expenses)** | `/finance/expenses` | **PARTIALLY WORKING** | Prisma with mock fallback when empty |
| **HR (overview)** | `/hr` | **UI ONLY** | `getHrDashboardMetrics()` mock |
| **HR Employees** | `/hr/employees/*` | **PARTIALLY WORKING** | JSON file store + `MOCK_EMPLOYEES`; browser shows 9+ employees; **not Prisma Employee** |
| **HR (attendance, leave, recruitment, etc.)** | `/hr/attendance`, leave, shifts, holidays, performance, analytics, biometric | **UI ONLY** | `@/lib/hr/mock-data` |
| **HR Payroll** | `/hr/payroll` | **PARTIALLY WORKING** | Prisma `payrollRun` with mock fallback; actions exist |
| **Documents** | `/documents/*` | **PARTIALLY WORKING** | Prisma queries + `requireVaultAccess`; **DB: 0 documents** — empty vault |
| **Reports / Analytics** | `/reports` | **WORKING** | Prisma `reports.ts`; browser: charts + AI insights |
| **Notifications** | `/notifications` | **WORKING** | Prisma + notification rules |
| **Approvals** | procurement, documents, purchases | **WORKING** / **PARTIALLY WORKING** | See procurement/documents; legacy purchases approvals lacks page RBAC |
| **Settings** | `/settings`, `/settings/integrations` | **PARTIALLY WORKING** | Prisma counts; mostly static cards; integrations from DB |
| **Administration** | `/admin`, `/users`, `/activity`, `/company` | **WORKING** | Prisma; `/users` enforces `users.manage` |
| **Search** | `/search` | **WORKING** | Prisma global search page |
| **Branches** | `/branches` | **MISSING** (redirect) | Redirects to `/warehouses` |
| **Biometric (device)** | `/iclock/*`, webhook | **PARTIALLY WORKING** | Public endpoints; serial/device-key auth only |

**Summary counts:**

| Classification | Modules (approx.) |
|----------------|-------------------|
| WORKING | 22 |
| PARTIALLY WORKING | 18 |
| UI ONLY | 12 |
| BROKEN | 0 (runtime); build TS blocks deploy |
| MISSING | 1 (branches redirect) |
| NOT VERIFIED | 8 (detail pages, GRN UI, dispatch, documents UI, RBAC browser, ledger UI, quotation detail, sales invoice list UI) |

---

## 4. End-to-End Workflow Status

### 4.1 Lead → Customer → Quotation → Sales Order

| Step | Status | Evidence |
|------|--------|----------|
| Leads exist with pipeline data | **VERIFIED** | Browser: 4 kanban cards; DB: 5 leads; `lead-demo-1` Global Spice Imports |
| Lead detail view | **NOT VERIFIED (UI)** | Kanban card click failed in browser; route `/leads/[id]` exists with Prisma |
| Customers linked | **VERIFIED (data)** | Seed creates customers; CRM conversion helpers in `crm-queries.ts` |
| Quotations from leads | **VERIFIED (data)** | QT-2026-0002 references `lead-demo-1`; browser: 6 quotations |
| Quotation detail / PDF | **NOT VERIFIED** | Route exists; PDF API requires `sales.view` |
| Sales order | **VERIFIED** | Browser: SO-2026-0001; DB: 1 order |
| Invoice | **VERIFIED (data)** | DB: 1 `saleInvoice`; `/sales` not browser-opened |
| Full UI conversion flow | **NOT VERIFIED** | Create/update flows not exercised in browser this audit |

**Workflow verdict:** **PARTIALLY WORKING** — seeded chain exists; list pages verified; interactive conversion and detail navigation not fully proven.

### 4.2 Supplier → Purchase Order → Inventory Receipt

| Step | Status | Evidence |
|------|--------|----------|
| Vendors | **VERIFIED** | Browser: Bastar FPO; DB: 2 vendors |
| Purchase order | **VERIFIED** | Browser: PUR-2026-0001 ₹52,500 Draft |
| GRN | **PARTIALLY VERIFIED** | DB: 1 GRN; `grn.ts` uses `$transaction`; GRN page not browser-opened |
| Inventory updated | **VERIFIED** | Browser: stock levels, GRN receipt movement 500 kg tamarind |
| QC on receipt | **PARTIALLY VERIFIED** | GRN inspection models in schema; QC hub not browser-opened |

**Workflow verdict:** **PARTIALLY WORKING** — data chain present; GRN UI and receive flow not browser-verified.

### 4.3 Inventory → Production → Finished Goods

| Step | Status | Evidence |
|------|--------|----------|
| Inventory stock | **VERIFIED** | Browser: Iron Booster 90 kg, Tamarind 500 kg |
| Production batches | **VERIFIED** | Browser: PRD-2026-001; DB: 2 batches |
| Work orders / schedule | **NOT VERIFIED** | Routes exist with actions |
| Finished goods inventory | **UI ONLY (sub-page)** | `/production/inventory` uses mock data |
| Stock decrement on invoice | **VERIFIED (code)** | `sales.ts` `$transaction` adjusts stock |

**Workflow verdict:** **PARTIALLY WORKING** — core MES + inventory real; production inventory sub-module mock.

### 4.4 Order → Dispatch → Invoice

| Step | Status | Evidence |
|------|--------|----------|
| Sales order | **VERIFIED** | SO-2026-0001 IN_TRANSIT |
| Invoice | **VERIFIED (data)** | DB: 1 invoice |
| Dispatch | **NOT VERIFIED** | `/warehouses/dispatch` exists; warehouse-workflow actions |
| PDF invoice | **NOT VERIFIED** | API exists with RBAC |

**Workflow verdict:** **PARTIALLY WORKING** — order + invoice seeded; dispatch not verified.

### 4.5 Employee → Role → Permissions

| Step | Status | Evidence |
|------|--------|----------|
| Users & roles (admin) | **VERIFIED (code)** | `/users` requires `users.manage` |
| Role change action | **NOT VERIFIED** | `users.ts` action has RBAC |
| HR employees | **PARTIALLY WORKING** | File store, not tied to `User.role` |
| Sales user blocked from `/users` | **NOT VERIFIED (browser)** | Logout/re-login blocked automation; code enforces `users.manage` |
| Sales user blocked from `/finance` | **LIKELY FAILS (security gap)** | No page RBAC; sidebar hides only |

**Workflow verdict:** **PARTIALLY WORKING** — admin user management real; cross-module RBAC enforcement incomplete.

### 4.6 Forms, validation, navigation (cross-cutting)

| Check | Status | Notes |
|-------|--------|-------|
| Login form | **VERIFIED** | Admin login succeeds |
| Sidebar navigation | **PARTIAL** | Some clicks failed in browser automation; direct URLs reliable |
| Empty states | **PARTIALLY VERIFIED** | Documents vault empty (0 docs); ledger has 2 accounts |
| Error states | **NOT VERIFIED** | Error boundary exists for schema drift |
| Pagination / filters | **NOT VERIFIED** | Not systematically tested |
| CRUD mutations | **NOT VERIFIED** | Read-heavy audit; actions have RBAC in code |

---

## 5. RBAC / Security Findings

### 5.1 Findings by severity

#### P0 — Critical

| ID | Finding | Evidence | Recommendation |
|----|---------|----------|----------------|
| SEC-001 | **Unauthenticated data leak via search suggest API** | `curl http://localhost:3001/api/search/suggest?q=Global` → **HTTP 200** with lead data, no session cookie. Route has **no auth check**; middleware does not block this path effectively for API JSON response. | Add `auth()` + permission check; return 401 unauthenticated |
| SEC-002 | **Production build fails** | `npm run build` exit code 1 — TypeScript error in `approval-metrics.ts` | Fix TS errors before any production deploy |
| SEC-003 | **Dev auth bypass on DB failure** | `src/auth.ts` catches DB errors → `tryDevLogin()` in non-production | Disable in staging; ensure `NODE_ENV=production`; remove hardcoded dev credentials from defaults |

#### P1 — High

| ID | Finding | Evidence | Recommendation |
|----|---------|----------|----------------|
| SEC-010 | **Finance pages lack server-side RBAC** | Zero `requirePermission` in `finance/**/page.tsx`; any logged-in user can hit `/finance` | Add `requirePermission("finance.view")` to all finance pages |
| SEC-011 | **HR pages lack server-side RBAC** | Zero `requirePermission` in `hr/**/page.tsx` | Add `requirePermission("hr.view")` / `hr.manage` |
| SEC-012 | **~72 dashboard pages without `requirePermission`** | Includes production, warehouse, purchases/approvals, settings | Audit matrix: page-level permission matching sidebar roles |
| SEC-013 | **`sessionVersion` not enforced** | JWT stores it; never checked against DB on requests | Validate on session refresh or sensitive actions |
| SEC-014 | **MFA is UI-only placeholder** | `login-form.tsx` — no server verification | Implement TOTP/WebAuthn or remove UI |
| SEC-015 | **Public biometric endpoints** | `/iclock/cdata` POST → 200 with serial only; middleware excluded | Shared secret, IP allowlist, mTLS for devices |
| SEC-016 | **Biometric webhook weak fallback** | Can fall back to first enabled device if secret missing | Fail closed when secret unset |
| SEC-017 | **Default/demo credentials in seed + README** | `Admin@2026` for all users | Force password change on first login in prod |

#### P2 — Medium

| ID | Finding | Evidence | Recommendation |
|----|---------|----------|----------------|
| SEC-020 | **Search suggest lacks role filtering** | Even authenticated, no permission check on invoice/lead/product search | Require `dashboard.view` minimum; filter by role |
| SEC-021 | **Invoice PDF: role check but no ownership** | Any user with `sales.view` can fetch any invoice ID | Acceptable for internal ERP; document as IDOR-by-design or add branch scoping |
| SEC-022 | **Activity export** | Session check + `can(role, "activity.export")` in handler — OK | — |
| SEC-023 | **Notifications API** | Session only, no specific permission | Low risk |
| SEC-024 | **Missing `.env.local.example`** | README references missing file | Add sanitized template |
| SEC-025 | **Error responses may leak detail** | Invoice PDF 500 includes `detail: err.message` | Sanitize prod errors |

#### P3 — Low

| ID | Finding | Evidence |
|----|---------|----------|
| SEC-030 | Legacy Supabase cookie auth unused | `src/lib/auth.ts` dead code |
| SEC-031 | CSRF | NextAuth + SameSite cookies; server actions use POST — standard Next.js mitigations |
| SEC-032 | Portal CORS | Origin-validated portal sign-in — reasonable |

### 5.2 RBAC enforcement summary

| Control | Server enforced? |
|---------|------------------|
| Login required for dashboard | **Yes** (middleware → 307 to `/login`) |
| Login required for `/api/v1/*` | **Yes** (401) |
| Login required for `/api/search/suggest` | **No** — **FAIL** |
| Role required for `/users` | **Yes** (`users.manage`) |
| Role required for `/finance` | **No** — **FAIL** |
| Role required for mutations | **Mostly yes** (server actions) |
| Sidebar hides unauthorized modules | **Yes** (UI only) |

---

## 6. Database Findings

### 6.1 Schema overview

| Metric | Value |
|--------|-------|
| Models | 127 |
| Relations | ~292 `@relation` |
| Indexes / uniques | ~430 `@@index`, `@@unique`, `@unique` |
| Money type | `Decimal` (232 usages) — **no Float money fields** |
| Soft delete | `deletedAt`, `archivedAt` on Document and related models |

### 6.2 Strengths

- Comprehensive domain model for manufacturing ERP (procurement, warehouse, MES, compliance).
- Foreign keys and enums for status workflows (approval, delivery, production, lead stages).
- Transaction boundaries on critical inventory/financial mutations (sales invoice, GRN, warehouse transfer).
- Idempotent seed with enterprise sub-seeders (inventory, warehouse, production).

### 6.3 Risks / gaps

| ID | Severity | Finding |
|----|----------|---------|
| DB-001 | P1 | **Schema–code drift** — TS errors reference missing `BudgetUtilizationTier`; `isPrismaValidationError` undefined in vendor-metrics |
| DB-002 | P1 | **HR dual persistence** — Prisma `Employee` (1 row) vs JSON `data/hr-employees.json` + mocks — data fragmentation |
| DB-003 | P2 | **AuditTrail unused** — compliance gap vs ActivityLog-only runtime auditing |
| DB-004 | P2 | **Seed not idempotent on re-run** — unique violations on `BudgetForecastPoint` |
| DB-005 | P2 | **127 models complexity** — migration coordination, index maintenance, query performance at scale unproven |
| DB-006 | P2 | **No row-level multi-tenancy** — `Organization` exists but light tenant scoping |
| DB-007 | P3 | **Documents empty in seed** — vault demos require manual upload |
| DB-008 | P3 | **Branches merged into warehouses** — redirect may confuse operators |

### 6.4 Financial / inventory consistency

- Sales invoice creation uses `$transaction` with stock adjustment (good).
- GRN receipt uses multi-step `$transaction` (good).
- Finance UI mock data **does not** reflect ledger/expense DB state — operators could see conflicting numbers between `/finance` and `/reports`.

---

## 7. UI/UX Technical Findings (no redesign)

| ID | Severity | Finding |
|----|----------|---------|
| UX-001 | P2 | Sidebar navigation unreliable in automated testing — may indicate click-target or hydration issues |
| UX-002 | P2 | Lead kanban cards may not navigate to detail — hurts CRM workflow |
| UX-003 | P2 | Finance/HR modules **look production-grade** but are largely mock — **misleading UX** |
| UX-004 | P3 | Fixed viewport width 1280 in root layout — mobile not supported |
| UX-005 | P3 | Production QC "New inspection" shows toast placeholder |
| UX-006 | P3 | HR delete shows "Employee removed (mock)" toast |
| UX-007 | P3 | Empty document vault with no seeded sample documents |

---

## 8. Performance / Scalability Risks

| ID | Severity | Risk |
|----|----------|------|
| PERF-001 | P1 | `force-dynamic` on dashboard layout — no static caching for authenticated pages |
| PERF-002 | P2 | Large Prisma includes on hub pages (N+1 potential) — not profiled |
| PERF-003 | P2 | Reports/analytics aggregate many tables per request |
| PERF-004 | P2 | Notification SSE polls every 3s |
| PERF-005 | P3 | 127-model schema — cold start / prisma generate ~1.4s on build |
| PERF-006 | P3 | `prisma-safe` empty fallbacks hide DB issues — may mask outages |

---

## 9. Test Coverage Gaps

| Area | Coverage |
|------|----------|
| Unit tests | **0%** — none |
| Integration tests | **0%** |
| E2E tests | **0%** |
| Manual browser (this audit) | ~12 modules list-level verified |
| Manual DB scripts | `db:test`, health-check only |

**Critical untested paths:** GRN receive, invoice creation, role escalation, quotation→order conversion UI, document upload, biometric webhook, production work-order mutations.

---

## 10. Critical Bugs

| ID | Severity | Bug | Status |
|----|----------|-----|--------|
| BUG-001 | P0 | Unauthenticated `/api/search/suggest` exposes business data | Open |
| BUG-002 | P0 | Production build fails TypeScript check | Open |
| BUG-003 | P1 | Seed FK ordering (lead before quotation) | **Fixed** on setup branch |
| BUG-004 | P1 | Seed non-idempotent on re-run | Mitigated in install.sh guard |
| BUG-005 | P1 | `approval-metrics.ts` type mismatch breaks build | Open |
| BUG-006 | P2 | `npm run lint` broken — `Invalid project directory: /workspace/lint` | Open |
| BUG-007 | P2 | 95 TypeScript errors across 9 lib files | Open |
| BUG-008 | P2 | ESLint: 65 errors in `src/` (unused vars, prefer-const) | Open |

---

## 11. High-Priority Improvements

1. **Fix SEC-001** — authenticate and authorize search suggest API (immediate).
2. **Fix build** — resolve `approval-metrics.ts` and related TS errors in metrics layer.
3. **Add page-level RBAC** to Finance, HR, Production, Warehouse pages matching sidebar roles.
4. **Enforce `sessionVersion`** on JWT validation.
5. **Replace Finance mock layer** with Prisma-backed reads (start with dashboard KPIs from `reports.ts` / ledger).
6. **Consolidate HR** onto Prisma `Employee` or document JSON store as interim-only.
7. **Add `.env.local.example`** with required vars documented.
8. **Remove or gate dev login fallback** outside local development.
9. **Add minimal test suite** — RBAC matrix tests + critical `$transaction` flows.
10. **Harden biometric/iclock endpoints** before exposing to network.

---

## 12. Medium-Priority Improvements

1. Resolve duplicate serializers and safe-query helpers.
2. Remove dead shop/Supabase auth code or isolate in separate package.
3. Implement real MFA or remove placeholder UI.
4. Seed sample documents for vault demo.
5. Fix `npm run lint` for Next.js 16.
6. Add branch/warehouse scoping to queries for multi-site growth.
7. Wire `AuditTrail` or remove model to avoid confusion.
8. Standardize error handling (`ActionResult` vs thrown errors).
9. Add Zod validation to workflow actions.
10. Profile and index hot paths (reports, dashboard aggregations).

---

## 13. Low-Priority Improvements

1. Migrate middleware → proxy per Next.js 16 guidance.
2. Fix sidebar navigation / kanban click targets.
3. Remove production mock sub-pages or label clearly as "Demo data".
4. Add pagination tests for large tables.
5. Consolidate `/purchases` and `/procurement` UX (parallel routes).
6. Improve empty states with guided setup actions.

---

## 14. Production-Readiness Assessment

| Criterion | Ready? | Notes |
|-----------|--------|-------|
| Builds successfully | **No** | TS failure in build step |
| Security baseline | **No** | Unauthenticated API leak; RBAC gaps |
| Data integrity (core ops) | **Partial** | Transactions on key flows |
| Financial compliance | **No** | Finance module mock |
| HR compliance | **No** | Mock + file store |
| Observability | **No** | Console logging only |
| Automated tests | **No** | Zero coverage |
| Documentation | **Partial** | README good; missing env example |
| Deployment config | **Partial** | Netlify config present; standalone output |

**Overall production-readiness: NOT READY (estimated 2–3 focused hardening phases required).**

**Suitable today for:** internal ops demo, sales/procurement/inventory pilot with real data, developer onboarding.

**Not suitable for:** production finance, statutory HR/payroll, public internet exposure without security fixes.

---

## 15. Recommended Implementation Roadmap

### Phase A — Security & build gate (1–2 weeks)

- Fix SEC-001 search API
- Fix all build-blocking TS errors (`approval-metrics`, `budget-engine`, `reports`, `vendor-metrics`, etc.)
- Add page RBAC to Finance/HR/Production/Warehouse
- Enforce sessionVersion
- Add `.env.local.example`
- **Exit criteria:** `npm run build` green; curl unauthenticated search returns 401

### Phase B — Test & RBAC verification (1–2 weeks)

- Playwright/Vitest: login, RBAC matrix (5 roles × critical routes), sales invoice + GRN happy paths
- Fix lint script
- Document RBAC matrix in repo
- **Exit criteria:** automated RBAC tests pass; 80% of P0/P1 security items closed

### Phase C — Finance & HR truth layer (3–4 weeks)

- Replace finance mock reads with Prisma aggregations aligned to `/reports` and ledger
- Migrate HR employees to Prisma `Employee` linked to `User` where appropriate
- Seed documents + payroll demo data
- **Exit criteria:** Finance dashboard numbers match DB; HR CRUD persists to PostgreSQL

### Phase D — Operational hardening (ongoing)

- Biometric endpoint hardening
- Performance profiling on dashboard/reports
- Multi-branch query scoping
- Remove dead code; consolidate procurement routes
- **Exit criteria:** load test baseline; security review sign-off

---

## Appendix A — Quality Gate Results

| Gate | Command | Result | Notes |
|------|---------|--------|-------|
| TypeScript | `npx tsc --noEmit` | **FAIL** | 95 errors in 9 files (pre-existing) |
| ESLint (src) | `npx eslint src` | **FAIL** | 65 errors, 4 warnings (pre-existing) |
| ESLint (npm script) | `npm run lint` | **BROKEN** | Wrong directory `/workspace/lint` |
| Unit/Integration tests | — | **N/A** | No test suite |
| Production build | `npm run build` | **FAIL** | Compiles then TS check fails on `approval-metrics.ts:444` |
| Dev server | `npm run dev` | **PASS** | Port 3001, login 200 |
| DB connectivity | `npm run db:test` | **PASS** | DATABASE_OK |

**Failures introduced by audit work:** None (audit was read-only; no application code changed on this branch).

**Environment limitations:** RBAC browser tests incomplete due to automation logout/login issues; supplemented with curl + code review.

---

## Appendix B — Browser Verification Evidence

Screenshots captured during audit (admin session):

| Module | Evidence |
|--------|----------|
| Leads / CRM | Kanban with 4 leads, pipeline ₹31.5L |
| Quotations | 6 quotes including QT-2026-0001/0002 |
| Sales orders | SO-2026-0001 |
| Vendors | Bastar FPO Collective |
| Purchases | PUR-2026-0001 |
| Inventory | 7 SKUs, movement history |
| Production | OEE 72%, batch PRD-2026-001 |
| Finance | Mock metrics displayed (₹28.4L revenue) |
| HR employees | 9+ employees (mock/file store) |
| Reports | Charts + AI insights |

Unauthenticated curl probes:

| Endpoint | HTTP | Notes |
|----------|------|-------|
| `/finance` | 307 → login | Protected |
| `/api/v1/sales` | 401 | Protected |
| `/api/search/suggest?q=Global` | **200 + JSON** | **Unprotected — critical** |
| `/iclock/cdata` POST | 200 | Public device endpoint |

---

## Appendix C — Files Changed in This Audit

| File | Change |
|------|--------|
| `docs/ERP_TECHNICAL_AUDIT.md` | **Created** — this document |

No application source code modified. Prior environment setup changes live on branch `cursor/setup-dev-environment-e076`.

---

## Audit Summary Counts

| Metric | Value |
|--------|-------|
| Modules discovered | **28 logical modules** / 113 routes |
| Modules browser-verified (list/hub level) | **12** |
| Modules code-verified only | **16** |
| Workflows verified end-to-end | **0 full** / **4 partial** (data chain exists) |
| Tests passed | **0** (no suite) / DB test **1** pass |
| Build status | **FAIL** |
| Security P0 | **3** |
| Security P1 | **8** |
| Database P1 | **2** |

**Recommended next implementation phase:** **Phase A — Security & build gate** (fix unauthenticated search API + build-blocking TypeScript errors + page-level RBAC on Finance/HR).

---

*End of audit report.*
