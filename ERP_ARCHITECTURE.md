# Dandakaranya Foods — Enterprise ERP Architecture

## Overview

Modular Next.js 16 ERP with Prisma + PostgreSQL (Supabase), NextAuth credentials, server actions, and versioned REST APIs under `/api/v1`.

## Folder structure

```
admin-dashboard/
├── prisma/
│   ├── schema.prisma      # Full domain model (10 modules)
│   └── seed.ts            # Dummy data for all modules
├── src/
│   ├── app/
│   │   ├── (dashboard)/   # Authenticated ERP pages
│   │   │   ├── page.tsx           # Landing dashboard
│   │   │   ├── sales/             # Sales management
│   │   │   ├── purchases/         # Purchase management
│   │   │   ├── inventory/         # Inventory & warehouses
│   │   │   ├── production/        # Production module
│   │   │   ├── finance/           # Finance & accounts
│   │   │   ├── hr/                # HR management
│   │   │   ├── leads/             # CRM
│   │   │   ├── reports/           # Analytics
│   │   │   ├── branches/          # Multi-branch
│   │   │   └── settings/          # Admin settings
│   │   ├── api/
│   │   │   ├── auth/[...nextauth]
│   │   │   ├── v1/                # Secure JSON APIs
│   │   │   └── invoices/[id]/pdf
│   │   └── login/
│   ├── actions/           # Server actions (mutations)
│   ├── components/
│   │   ├── layout/        # Shell, sidebar, navbar
│   │   ├── dashboard/     # KPI cards, charts, activity feed
│   │   ├── modules/       # Module page templates
│   │   ├── shared/        # Data tables, empty states
│   │   └── ui/            # Design system (shadcn-style)
│   └── lib/
│       ├── api/handler.ts # Auth + RBAC API wrapper
│       ├── erp-metrics.ts # Dashboard aggregations
│       ├── rbac.ts        # Role permissions
│       ├── activity.ts    # Activity logging
│       └── db.ts          # Prisma client
└── ERP_ARCHITECTURE.md
```

## Database modules

| Module | Models |
|--------|--------|
| Dashboard | Aggregates from Sales, Purchases, Inventory, Production, CRM, Finance, HR |
| Sales | `SalesOrder`, `SaleInvoice`, `Customer`, `Payment`, `DeliveryStatus` |
| Purchases | `Purchase`, `Vendor`, `ApprovalStatus` |
| Inventory | `Product`, `Warehouse`, `Batch`, `StockMovement` |
| Production | `Recipe`, `RecipeLine`, `ProductionBatch`, `ProductionLog` |
| CRM | `Lead`, `LeadNote`, `LeadCommunication`, `LeadProduct` |
| Finance | `Expense`, `LedgerAccount`, `LedgerEntry` |
| HR | `Employee`, `Attendance`, `LeaveRequest`, `PayrollRun` |
| System | `Branch`, `User`, `ActivityLog`, `AuditTrail`, `Notification`, `ApiIntegration`, `BackupLog` |

## API routes (`/api/v1`)

| Route | Method | Permission |
|-------|--------|------------|
| `/api/v1/dashboard` | GET | dashboard.view |
| `/api/v1/sales` | GET | sales.view |
| `/api/v1/purchases` | GET | purchases.view |
| `/api/v1/inventory` | GET | inventory.view |
| `/api/v1/production` | GET | production.view |
| `/api/v1/finance` | GET | finance.view |
| `/api/v1/hr` | GET | hr.view |
| `/api/v1/leads` | GET | leads.view |
| `/api/v1/reports/export` | GET | reports.view |

All routes use session auth via `apiHandler()` in `src/lib/api/handler.ts`.

## Authentication flow

1. User signs in at `/login` (NextAuth credentials).
2. Middleware protects `(dashboard)` routes.
3. Session includes `id`, `role` for RBAC.
4. Dev fallback: `DEV_AUTH_*` in `.env.local` if DB unavailable.

## Setup

```bash
cd admin-dashboard
npm install
cp .env.local.example .env.local   # configure DATABASE_URL
npm run db:push
npm run db:seed
npm run dev                        # http://localhost:3001
```

**Login:** `t.balarama@gmail.com` / `Admin@2026`

## Design system

- **Palette:** Forest green primary (`hsl(158 35% 32%)`), gold accent, dark sidebar
- **Fonts:** Inter
- **Charts:** Recharts (revenue, pipeline)
- **Motion:** Framer Motion on dashboard KPI cards
- **Toasts:** Sonner

## Scalability notes

- Add new modules under `src/app/(dashboard)/<module>` + `src/actions/<module>.ts`
- Extend `prisma/schema.prisma` and run `db:push`
- Register nav items in `src/components/layout/sidebar.tsx`
- Expose read APIs under `src/app/api/v1/<module>/route.ts`
