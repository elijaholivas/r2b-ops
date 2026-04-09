import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import {
  UserPlus,
  MoreHorizontal,
  ShieldCheck,
  KeyRound,
  UserX,
  UserCheck,
  Loader2,
  Mail,
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  staff: "Staff",
  instructor: "Instructor",
  user: "User",
};

const ROLE_COLORS: Record<string, string> = {
  super_admin: "bg-red-900/40 text-red-300 border-red-700/50",
  admin: "bg-orange-900/40 text-orange-300 border-orange-700/50",
  staff: "bg-blue-900/40 text-blue-300 border-blue-700/50",
  instructor: "bg-purple-900/40 text-purple-300 border-purple-700/50",
  user: "bg-secondary text-muted-foreground border-border",
};

type UserRow = {
  id: number;
  name: string | null;
  email: string | null;
  role: string;
  isActive?: boolean | null;
  lastSignedIn: Date;
  createdAt: Date;
};

function CreateUserDialog({ open, onClose, onSuccess }: { open: boolean; onClose: () => void; onSuccess: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "staff" | "instructor">("staff");

  const create = trpc.auth.createStaffUser.useMutation({
    onSuccess: () => {
      toast.success("User created successfully");
      setName(""); setEmail(""); setPassword(""); setRole("staff");
      onSuccess();
    },
    onError: (err) => toast.error(err.message),
  });

  const handleSubmit = () => {
    if (!name.trim() || !email.trim() || !password.trim()) {
      toast.error("All fields are required");
      return;
    }
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    create.mutate({ name: name.trim(), email: email.trim(), password, role });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-card border-border text-foreground max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            Create Staff Account
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-sm text-foreground">Full Name</Label>
            <Input
              placeholder="Jane Smith"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-secondary border-border text-foreground placeholder:text-muted-foreground"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm text-foreground">Email Address</Label>
            <Input
              type="email"
              placeholder="jane@r2bear.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-secondary border-border text-foreground placeholder:text-muted-foreground"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm text-foreground">Temporary Password</Label>
            <Input
              type="password"
              placeholder="Min. 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-secondary border-border text-foreground placeholder:text-muted-foreground"
            />
            <p className="text-xs text-muted-foreground">The user can change this after first login.</p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm text-foreground">Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as typeof role)}>
              <SelectTrigger className="bg-secondary border-border text-foreground">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                <SelectItem value="admin">Admin — full access except user management</SelectItem>
                <SelectItem value="staff">Staff — manage rosters, add/move students</SelectItem>
                <SelectItem value="instructor">Instructor — view assigned classes only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose} className="text-muted-foreground hover:text-foreground">
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={create.isPending}
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            {create.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <UserPlus className="h-4 w-4 mr-1.5" />}
            Create Account
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResetPasswordDialog({ user, open, onClose }: { user: UserRow | null; open: boolean; onClose: () => void }) {
  const [password, setPassword] = useState("");
  const reset = trpc.auth.resetPassword.useMutation({
    onSuccess: () => {
      toast.success("Password reset successfully");
      setPassword("");
      onClose();
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-card border-border text-foreground max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" />
            Reset Password
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">
            Setting a new password for <span className="text-foreground font-medium">{user?.name ?? user?.email}</span>.
          </p>
          <div className="space-y-1.5">
            <Label className="text-sm text-foreground">New Password</Label>
            <Input
              type="password"
              placeholder="Min. 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-secondary border-border text-foreground placeholder:text-muted-foreground"
            />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose} className="text-muted-foreground hover:text-foreground">
            Cancel
          </Button>
          <Button
            onClick={() => user && reset.mutate({ userId: user.id, newPassword: password })}
            disabled={reset.isPending || password.length < 8}
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            {reset.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <KeyRound className="h-4 w-4 mr-1.5" />}
            Reset Password
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function UsersTab() {
  const { user: currentUser } = useAuth();
  const isSuperAdmin = currentUser?.role === "super_admin";
  const [showCreate, setShowCreate] = useState(false);
  const [resetTarget, setResetTarget] = useState<UserRow | null>(null);

  const { data: users, isLoading, refetch } = trpc.auth.listUsers.useQuery();

  const updateRole = trpc.auth.updateUserRole.useMutation({
    onSuccess: () => { toast.success("Role updated"); refetch(); },
    onError: (err) => toast.error(err.message),
  });

  const setActive = trpc.auth.setUserActive.useMutation({
    onSuccess: (_, vars) => {
      toast.success(vars.isActive ? "Account reactivated" : "Account deactivated");
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-foreground">Staff Accounts</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            {users?.length ?? 0} account{users?.length !== 1 ? "s" : ""}
          </p>
        </div>
        {isSuperAdmin && (
          <Button
            onClick={() => setShowCreate(true)}
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
            size="sm"
          >
            <UserPlus className="h-4 w-4 mr-1.5" />
            Add User
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-2">
          {(users ?? []).map((u) => {
            const isCurrentUser = u.id === currentUser?.id;
            const isInactive = (u as any).isActive === false;
            return (
              <div
                key={u.id}
                className={`flex items-center gap-3 p-3 rounded-lg border ${
                  isInactive
                    ? "bg-secondary/30 border-border opacity-60"
                    : "bg-secondary/50 border-border"
                }`}
              >
                {/* Avatar */}
                <div className="h-9 w-9 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-semibold text-primary">
                    {(u.name ?? u.email ?? "?")[0].toUpperCase()}
                  </span>
                </div>

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-foreground truncate">
                      {u.name ?? "—"}
                    </span>
                    {isCurrentUser && (
                      <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/30">
                        You
                      </Badge>
                    )}
                    {isInactive && (
                      <Badge variant="outline" className="text-xs bg-secondary text-muted-foreground border-border">
                        Inactive
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground flex-wrap">
                    {u.email && (
                      <span className="flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {u.email}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Last login: {format(new Date(u.lastSignedIn), "MMM d, yyyy")}
                    </span>
                  </div>
                </div>

                {/* Role badge */}
                <Badge
                  variant="outline"
                  className={`text-xs flex-shrink-0 hidden sm:flex ${ROLE_COLORS[u.role] ?? ROLE_COLORS.user}`}
                >
                  {ROLE_LABELS[u.role] ?? u.role}
                </Badge>

                {/* Actions */}
                {!isCurrentUser && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground flex-shrink-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-popover border-border w-52">
                      {/* Change role submenu */}
                      {isSuperAdmin && (
                        <>
                          <div className="px-2 py-1.5 text-xs text-muted-foreground font-medium">Change Role</div>
                          {(["super_admin", "admin", "staff", "instructor"] as const).map((r) => (
                            <DropdownMenuItem
                              key={r}
                              onClick={() => updateRole.mutate({ userId: u.id, role: r })}
                              className={`text-sm cursor-pointer ${u.role === r ? "text-primary" : "text-foreground"} hover:bg-secondary`}
                            >
                              <ShieldCheck className="h-3.5 w-3.5 mr-2" />
                              {ROLE_LABELS[r]}
                              {u.role === r && " ✓"}
                            </DropdownMenuItem>
                          ))}
                          <DropdownMenuSeparator className="bg-border" />
                        </>
                      )}
                      <DropdownMenuItem
                        onClick={() => setResetTarget(u as UserRow)}
                        className="text-foreground hover:bg-secondary cursor-pointer"
                      >
                        <KeyRound className="h-4 w-4 mr-2" />
                        Reset Password
                      </DropdownMenuItem>
                      {isSuperAdmin && (
                        <DropdownMenuItem
                          onClick={() => setActive.mutate({ userId: u.id, isActive: isInactive })}
                          className={`cursor-pointer hover:bg-secondary ${isInactive ? "text-green-400" : "text-red-400"}`}
                        >
                          {isInactive ? (
                            <><UserCheck className="h-4 w-4 mr-2" />Reactivate Account</>
                          ) : (
                            <><UserX className="h-4 w-4 mr-2" />Deactivate Account</>
                          )}
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            );
          })}
        </div>
      )}

      <CreateUserDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onSuccess={() => { setShowCreate(false); refetch(); }}
      />
      <ResetPasswordDialog
        user={resetTarget}
        open={resetTarget !== null}
        onClose={() => setResetTarget(null)}
      />
    </div>
  );
}
