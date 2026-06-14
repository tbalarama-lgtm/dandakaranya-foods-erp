import Link from "next/link";
import { FolderOpen, ChevronRight } from "lucide-react";
import { DocumentsPageHeader } from "@/components/documents/documents-page-header";
import { DEPARTMENT_LABELS } from "@/lib/documents/constants";
import { canAccessDepartment } from "@/lib/documents/permissions";
import { getRootFolders, requireVaultAccess } from "@/lib/documents/page-data";

export const dynamic = "force-dynamic";

export default async function DepartmentsPage() {
  const user = await requireVaultAccess();
  const folders = await getRootFolders();

  const visible = folders.filter((f) => canAccessDepartment(user.role, f.department));

  return (
    <>
      <DocumentsPageHeader
        title="Departments"
        description="Structured company folders — legal, HR, finance, production, vendors, sales, and R&D."
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visible.map((folder) => (
          <div
            key={folder.id}
            className="rounded-xl border border-border/60 bg-card/80 p-5 shadow-sm backdrop-blur-md"
          >
            <div className="flex items-start gap-3">
              <span className="rounded-xl bg-primary/10 p-2.5 text-primary">
                <FolderOpen className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="font-semibold">{folder.name}</h2>
                <p className="text-xs text-muted-foreground">{DEPARTMENT_LABELS[folder.department]}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {folder._count.documents} files · {folder.children.length} subfolders
                </p>
              </div>
            </div>
            <ul className="mt-4 space-y-1 border-t border-border/50 pt-3">
              {folder.children.map((child) => (
                <li key={child.id}>
                  <Link
                    href={`/documents/all?department=${child.department}&folder=${child.slug}`}
                    className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm hover:bg-muted/60"
                  >
                    <span>{child.name}</span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </>
  );
}
