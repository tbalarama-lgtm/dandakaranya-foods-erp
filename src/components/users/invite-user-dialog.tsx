"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Sparkles, UserPlus } from "lucide-react";
import { UserRole } from "@prisma/client";
import { toast } from "sonner";
import { inviteUser } from "@/actions/users";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectField } from "@/components/ui/select-field";
import { roleLabel } from "@/lib/rbac";
import { ICON_STROKE } from "@/lib/enterprise-ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function InviteUserDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <motion.div
          whileHover={{ scale: 1.03, y: -1 }}
          whileTap={{ scale: 0.97 }}
          className="relative"
        >
          <Button variant="premium" className="relative overflow-hidden shadow-[0_4px_18px_rgba(182,141,64,0.35)]">
            <motion.span
              className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent"
              animate={{ x: ["-120%", "120%"] }}
              transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut", repeatDelay: 1.2 }}
            />
            <UserPlus className="h-4 w-4" strokeWidth={ICON_STROKE} />
            Invite user
            <Sparkles className="h-3.5 w-3.5 opacity-80" strokeWidth={ICON_STROKE} />
          </Button>
        </motion.div>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite team member</DialogTitle>
          <DialogDescription>Create an ERP login with role-based access.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setLoading(true);
            const fd = new FormData(e.currentTarget);
            try {
              await inviteUser({
                name: String(fd.get("name")),
                email: String(fd.get("email")),
                password: String(fd.get("password")),
                role: fd.get("role") as UserRole,
              });
              toast.success("User invited");
              setOpen(false);
              router.refresh();
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Invite failed");
            } finally {
              setLoading(false);
            }
          }}
        >
          <div>
            <Label htmlFor="u-name">Full name</Label>
            <Input id="u-name" name="name" required className="mt-1.5" />
          </div>
          <div>
            <Label htmlFor="u-email">Email</Label>
            <Input id="u-email" name="email" type="email" required className="mt-1.5" />
          </div>
          <div>
            <Label htmlFor="u-password">Temporary password</Label>
            <Input id="u-password" name="password" type="password" minLength={8} required className="mt-1.5" />
          </div>
          <SelectField label="Role" name="role" defaultValue={UserRole.SALES_EXECUTIVE}>
            {Object.values(UserRole).map((r) => (
              <option key={r} value={r}>
                {roleLabel(r)}
              </option>
            ))}
          </SelectField>
          <DialogFooter>
            <Button type="submit" variant="premium" disabled={loading}>
              {loading ? "Creating…" : "Create user"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
