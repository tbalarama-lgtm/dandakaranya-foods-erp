import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function DatabaseSetup() {
  return (
    <div className="space-y-6">
      <Card className="max-w-2xl border-gold-500/30">
        <CardHeader>
          <CardTitle>Connect Supabase PostgreSQL</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            You are signed in, but this app needs a real <strong className="text-foreground">PostgreSQL</strong>{" "}
            database. Use the same Supabase project as your main website, or create a new free project.
          </p>

          <div className="rounded-xl bg-muted/60 p-4 text-foreground">
            <p className="font-semibold">Step 1 — Get connection strings</p>
            <ol className="mt-2 list-decimal space-y-1 pl-5">
              <li>
                Open{" "}
                <a
                  href="https://supabase.com/dashboard"
                  className="text-gold-600 hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  supabase.com/dashboard
                </a>{" "}
                → your project
              </li>
              <li>
                Click <strong>Connect</strong> (top) → <strong>ORMs</strong> → <strong>Prisma</strong>
              </li>
              <li>
                Copy <strong>DATABASE_URL</strong> (Session pooler, port <strong>6543</strong>, includes{" "}
                <code className="text-xs">?pgbouncer=true</code>)
              </li>
              <li>
                Copy <strong>DIRECT_URL</strong> (Direct connection, port <strong>5432</strong>)
              </li>
              <li>
                Replace <code className="text-xs">[YOUR-PASSWORD]</code> with your database password
                (from project creation, or reset under Settings → Database)
              </li>
            </ol>
          </div>

          <div>
            <p className="font-semibold text-foreground">Step 2 — Edit `.env.local`</p>
            <p className="mt-1">
              File: <code className="rounded bg-muted px-1">admin-dashboard/.env.local</code>
            </p>
            <pre className="mt-2 overflow-x-auto rounded-xl bg-forest-950 p-4 text-xs text-cream-50">
{`DATABASE_URL="postgresql://postgres.nxolzqydwieraygfzvjj:[YOUR-PASSWORD]@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.nxolzqydwieraygfzvjj:[YOUR-PASSWORD]@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres"
AUTH_SECRET="any-long-random-string"`}
            </pre>
          </div>

          <div>
            <p className="font-semibold text-foreground">Step 3 — Run in terminal</p>
            <pre className="mt-2 overflow-x-auto rounded-xl bg-forest-950 p-4 text-xs text-cream-50">
{`cd admin-dashboard
npm run db:test
npm run db:push
npm run db:seed`}
            </pre>
            <p className="mt-2 text-xs">
              <code>db:test</code> should print “Database connected”. Then{" "}
              <strong>restart the dev server</strong> (<code>npm run dev</code>) and refresh this page.
            </p>
          </div>

          <p className="text-xs">
            After seed, sign in with <strong>t.balarama@gmail.com</strong> / <strong>Admin@2026</strong>{" "}
            (not only dev fallback).
          </p>
        </CardContent>
      </Card>

      <Card className="max-w-2xl">
        <CardContent className="pt-6 text-sm text-muted-foreground">
          <p className="font-semibold text-foreground">Password tips</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>If the password has <code>@</code> or <code>#</code>, URL-encode it in the connection string.</li>
            <li>
              Forgot password? Supabase → <strong>Settings → Database</strong> → Reset database password.
            </li>
            <li>
              The main site uses <code>VITE_SUPABASE_URL</code> (HTTP API) — the ERP needs the{" "}
              <strong>Postgres URI</strong>, which is different.
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
