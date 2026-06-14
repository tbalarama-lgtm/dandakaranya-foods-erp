# Dandakaranya Foods — ERP Admin Dashboard

Production-ready operations console: **Next.js 16 · TypeScript · Prisma · PostgreSQL (Supabase) · NextAuth · Tailwind · Recharts**.

## Modules

| Route | Features |
|-------|----------|
| `/` | KPIs, revenue chart, top products, activity & notifications |
| `/sales` | Invoices, GST, payment status, PDF export |
| `/sales/new` | Create invoice (auto GST + stock decrement) |
| `/purchases` | Vendor purchases, payment tracking |
| `/leads` | CRM stages, assignee, WhatsApp/email, follow-ups |
| `/leads/new` | Add lead with notes |
| `/inventory` | Stock levels, low-stock alerts, quick in/out |
| `/products` | SKU, barcode, GST, categories |
| `/customers` | Buyer database |
| `/vendors` | Supplier database |
| `/reports` | P&L, pipeline, team performance |
| `/activity` | Full audit log, search, CSV export |
| `/users` | Roles: Admin, Manager, Sales, Accountant |
| `/company` | Company profile for invoices |
| `/settings` | Security & backup notes |
| `/search` | Global search |
| `/notifications` | In-app alerts |

## Quick start

```bash
cd admin-dashboard
cp .env.local.example .env.local
# Edit DATABASE_URL (Supabase Postgres URI) and AUTH_SECRET

npm install
npm run db:push
npm run db:seed
npm run dev
```

Open **http://localhost:3001**

### Demo logins (after seed)

| Email | Role | Password |
|-------|------|----------|
| admin@dandakaranyafoods.com | Admin | Admin@2026 |
| manager@dandakaranyafoods.com | Manager | Admin@2026 |
| sales@dandakaranyafoods.com | Sales | Admin@2026 |
| accountant@dandakaranyafoods.com | Accountant | Admin@2026 |

## Supabase setup

1. Create a project at [supabase.com](https://supabase.com)
2. **Settings → Database** → copy **Connection string** (URI, use pooler for serverless)
3. Set `DATABASE_URL` in `.env.local`
4. Run `npm run db:push` then `npm run db:seed`
5. Generate `AUTH_SECRET`: `openssl rand -base64 32`

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Dev server (port 3001) |
| `npm run build` | Production build |
| `npm run db:push` | Apply Prisma schema |
| `npm run db:seed` | Sample data |
| `npm run db:studio` | Prisma Studio |

## Architecture

```
src/
  app/(dashboard)/   # Protected ERP pages
  app/login/         # NextAuth sign-in
  app/api/           # PDF export, activity CSV
  actions/           # Server actions (sales, leads, inventory)
  components/        # UI + layout + charts
  lib/               # db, rbac, activity, reports
  auth.ts            # NextAuth + credentials
prisma/
  schema.prisma      # Full ERP data model
  seed.ts            # Demo data
```

## Main website

The public Vite shop remains at the repo root (`npm run dev` → port 5173). This ERP is a **separate app** for internal operations.

## Deploy (Vercel)

- Root directory: `admin-dashboard`
- Env: `DATABASE_URL`, `AUTH_SECRET`, `NEXT_PUBLIC_SITE_URL`
