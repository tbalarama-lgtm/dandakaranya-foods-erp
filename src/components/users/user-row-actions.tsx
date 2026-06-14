"use client";

import { UserRole } from "@prisma/client";
import { toast } from "sonner";
import { toggleUserActive, updateUserRole } from "@/actions/users";
import { roleLabel } from "@/lib/rbac";

export function UserRoleSelect({
  userId,
  role,
  disabled,
}: {
  userId: string;
  role: UserRole;
  disabled?: boolean;
}) {
  return (
    <select
      value={role}
      disabled={disabled}
      className="rounded-lg border border-border bg-background px-2 py-1 text-xs"
      onChange={async (e) => {
        try {
          await updateUserRole(userId, e.target.value as UserRole);
          toast.success("Role updated");
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Update failed");
        }
      }}
    >
      {Object.values(UserRole).map((r) => (
        <option key={r} value={r}>
          {roleLabel(r)}
        </option>
      ))}
    </select>
  );
}

export function UserActiveToggle({
  userId,
  active,
  disabled,
}: {
  userId: string;
  active: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      className="text-xs font-semibold text-gold-600 hover:underline disabled:opacity-50"
      onClick={async () => {
        try {
          await toggleUserActive(userId, !active);
          toast.success(active ? "User disabled" : "User activated");
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Update failed");
        }
      }}
    >
      {active ? "Disable" : "Enable"}
    </button>
  );
}
