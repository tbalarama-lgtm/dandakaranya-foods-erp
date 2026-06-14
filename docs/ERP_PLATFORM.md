# Dandakaranya Foods — Enterprise ERP Platform

Production-ready operations console for forest-origin food manufacturing, export, and tribal supply chain management.

**Stack:** Next.js 16 · TypeScript · Prisma · PostgreSQL (Supabase) · NextAuth · Tailwind · shadcn/Radix · Recharts

**Local dev:** `cd admin-dashboard && npm run dev` → http://localhost:3001

**Default login:** `admin@dandakaranyafoods.com` / `Admin@2026`

---

## 13 Enterprise Modules

| # | Module | Route | Description |
|---|--------|-------|-------------|
| 1 | **Executive Dashboard** | `/` | Command center — KPIs, alerts, pipeline, inventory, approvals |
| 2 | **Sales Management** | `/sales` | Invoices, orders, quotations, GST, PDF export |
| 3 | **Purchase Management** | `/procurement` | RFQ, PO, GRN, approvals, budgets, payables |
| 4 | **Production Management** | `/production` | Planning, BOM, work orders, batches, OEE |
| 5 | **Inventory Management** | `/inventory` | Stock, products, reservations, cycle counts |
| 6 | **Finance & Accounting** | `/finance` | Ledger, expenses, GST, P&L, cash flow |
| 7 | **HR & Payroll** | `/hr` | Employees, attendance, biometric, payroll, recruitment |
| 8 | **CRM & Lead Management** | `/leads` | Pipeline, customers, WhatsApp, follow-ups |
| 9 | **Quality Control** | `/quality` | GRN QC, production QC, batch trace, compliance |
| 10 | **Logistics & Dispatch** | `/logistics` | Warehouses, pick-pack-dispatch, transfers, branches |
| 11 | **Document Vault** | `/documents` | Supabase storage, approvals, department ACLs |
| 12 | **Reports & Analytics** | `/reports` | P&L, pipeline, exports, cross-module analytics |
| 13 | **Admin Console** | `/admin` | Users, roles, audit logs, company, integrations |

Module registry: `src/lib/erp-modules.ts`

---

## Folder Structure

```
admin-dashboard/
├── prisma/
│   ├── schema.prisma      # 119 models — full manufacturing ERP
│   └── seed.ts            # Sample data (users, products, leads, POs, etc.)
├── docs/
│   └── ERP_PLATFORM.md    # This file
├── public/
│   └── logo.png
├── src/
│   ├── app/
│   │   ├── layout.tsx           # Root: fonts, theme, session
│   │   ├── login/page.tsx
│   │   ├── (dashboard)/         # Protected ERP shell
│   │   │   ├── layout.tsx       # AppShell + DB health gate
│   │   │   ├── page.tsx         # Executive dashboard
│   │   │   ├── admin/           # Admin console (NEW)
│   │   │   ├── quality/         # Quality control hub (NEW)
│   │   │   ├── logistics/       # Logistics hub (NEW)
│   │   │   ├── sales/ finance/ hr/ production/ procurement/
│   │   │   ├── inventory/ warehouses/ documents/ reports/ leads/
│   │   │   └── ...
│   │   └── api/
│   │       ├── auth/[...nextauth]
│   │       └── v1/              # REST API (dashboard, sales, hr, etc.)
│   ├── actions/                 # Server actions per domain
│   ├── components/
│   │   ├── ui/                  # shadcn primitives
│   │   ├── layout/              # sidebar, navbar, app-shell
│   │   ├── dashboard/           # command center widgets
│   │   ├── quality/             # QC hub (NEW)
│   │   ├── logistics/           # Logistics hub (NEW)
│   │   ├── admin/               # Admin console (NEW)
│   │   └── [module]/            # Per-module components
│   ├── lib/
│   │   ├── erp-modules.ts       # 13-module registry
│   │   ├── rbac.ts              # Role-based permissions
│   │   ├── tenant.ts            # Multi-company scope (NEW)
│   │   ├── db.ts                # Prisma client
│   │   └── *-metrics.ts         # Per-module analytics
│   ├── auth.ts / auth.config.ts
│   └── middleware.ts
└── supabase/                    # Document vault storage SQL
```

---

## Database (PostgreSQL / Supabase)

- **118+ Prisma models** covering CRM, sales, procurement, GRN/QC, inventory, warehouses, production, finance, HR, documents
- **Organization model** for multi-company readiness (`prisma/schema.prisma`)
- **Sample seed:** `npm run db:seed` after `npm run db:push`

### Key model groups

| Domain | Models |
|--------|--------|
| Auth | `User`, `Organization`, `ActivityLog`, `AuditTrail` |
| CRM/Sales | `Lead`, `Customer`, `Quotation`, `SalesOrder`, `SaleInvoice`, `Payment` |
| Procurement | `Vendor`, `Purchase`, `ProcurementRFQ`, `GoodsReceiptNote`, `GRNInspection` |
| Inventory | `Product`, `Batch`, `StockMovement`, `Warehouse`, `WarehouseBin` |
| Logistics | `PickPackDispatch`, `WarehouseTransfer`, `DockAppointment` |
| Production | `Recipe`, `ProductionWorkOrder`, `ProductionBatch`, `ProductionComplianceLog` |
| Finance | `Expense`, `LedgerAccount`, `LedgerEntry` |
| HR | `Employee`, `Attendance`, `BiometricDevice`, `PayrollRun` |
| Documents | `Document`, `DocumentFolder`, `DocumentApprovalStep` |

---

## Security & RBAC

5 roles with 37 granular permissions:

| Role | Access |
|------|--------|
| `ADMIN` | Full system |
| `MANAGER` | Operations, production, inventory, reports |
| `SALES_EXECUTIVE` | CRM, sales, quotations |
| `ACCOUNTANT` | Finance, procurement, reports |
| `HR_EXECUTIVE` | HR module, document vault (HR scope) |

- NextAuth v5 credentials + JWT (8h session)
- Middleware protects all routes except `/login`
- Per-page `requirePermission()` guards
- Full audit trail in `ActivityLog`

---

## UI & Theming

- **Dark/Light mode** via `ThemeProvider` (system preference supported)
- **Enterprise navy + gold** brand (`#071226`, `#B68D40`)
- **Responsive:** collapsible sidebar, mobile drawer, desktop-first KPI grids
- **Charts:** Recharts (area, bar, pie) on all module hubs
- **shadcn-style** Radix components in `src/components/ui/`

---

## Multi-Company Architecture

Foundation in place for scaling to multiple legal entities:

1. `Organization` model with `code`, `gstin`, `isDefault`
2. `User.organizationId` links staff to a company
3. `src/lib/tenant.ts` — `resolveTenantScope()` for future query scoping
4. **Next step:** add `organizationId` to transactional models (Product, Customer, etc.) as needed

---

## Quick Start

```bash
cd admin-dashboard
cp .env.local.example .env.local
# Set DATABASE_URL, DIRECT_URL, AUTH_SECRET

npm install
npm run db:push
npm run db:seed
npm run dev
```

Open **http://localhost:3001** and sign in with seeded credentials.

---

## Deployment

- **ERP:** Netlify → `erp.dandakaranyafoods.com` (port 3001 locally)
- **Marketing site:** separate Next.js app in parent folder → `dandakaranyafoods.com`
- Portal sign-in bridge: `/api/auth/portal-signin` (CORS from marketing site)

---

© Dandakaranya Foods · Sukma, Chhattisgarh · Forest Heritage of India
