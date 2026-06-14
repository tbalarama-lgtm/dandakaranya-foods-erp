import { PERMISSION_MATRIX } from "@/lib/documents/permissions";
import { roleLabel } from "@/lib/rbac";

export function PermissionMatrix() {
  return (
    <div className="overflow-hidden rounded-xl border border-border/60 bg-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40 text-left">
            <th className="px-4 py-3 font-semibold">Role</th>
            <th className="px-4 py-3 font-semibold">Departments</th>
            <th className="px-4 py-3 font-semibold">Permissions</th>
          </tr>
        </thead>
        <tbody>
          {PERMISSION_MATRIX.map((row) => (
            <tr key={row.role} className="border-b border-border/50">
              <td className="px-4 py-3 font-medium">{roleLabel(row.role)}</td>
              <td className="px-4 py-3 text-muted-foreground">{row.departments}</td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-1">
                  {row.permissions.map((p) => (
                    <span
                      key={p}
                      className="rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary"
                    >
                      {p.replace("documents.", "")}
                    </span>
                  ))}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
