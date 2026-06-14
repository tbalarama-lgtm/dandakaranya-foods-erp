"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const needsMigration =
    error.message?.includes("does not exist") ||
    error.message?.includes("Unknown arg") ||
    error.message?.includes("column") ||
    error.message?.includes("SalesOrder");

  return (
    <Card className="mx-auto max-w-lg border-destructive/30">
      <CardHeader>
        <CardTitle>Something went wrong</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <p className="text-muted-foreground">
          {needsMigration
            ? "The database schema may be out of date after the ERP upgrade. Run the migration commands below, then refresh."
            : "An unexpected error occurred while loading this page."}
        </p>
        {needsMigration && (
          <pre className="overflow-x-auto rounded-lg bg-muted p-3 text-xs">
            npm run db:push -- --accept-data-loss{"\n"}npm run db:seed
          </pre>
        )}
        <div className="flex flex-wrap gap-2">
          <Button onClick={reset}>Try again</Button>
          <Button asChild variant="outline">
            <Link href="/">Dashboard</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
