import { useState } from "react";
import { useRoute, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  ArrowLeft,
  MapPin,
  Clock,
  Users,
  Plus,
  Download,
  UserMinus,
  ArrowRightLeft,
  MoreHorizontal,
  CheckCircle2,
  DollarSign,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import AddStudentModal from "@/components/AddStudentModal";
import MoveStudentModal from "@/components/MoveStudentModal";
import RemoveStudentDialog from "@/components/RemoveStudentDialog";

const PAYMENT_PILL: Record<string, string> = {
  paid: "bg-green-900/40 text-green-400 border-green-700/50",
  unpaid: "bg-amber-900/40 text-amber-400 border-amber-700/50",
  free: "bg-blue-900/40 text-blue-400 border-blue-700/50",
};

const PAYMENT_LABEL: Record<string, string> = {
  paid: "Paid",
  unpaid: "Unpaid",
  free: "Free",
};

const SOURCE_LABEL: Record<string, string> = {
  woocommerce: "WooCommerce",
  manual: "Manual",
  import: "Import",
};

export default function ClassDetail() {
  const [, params] = useRoute("/classes/:id");
  const classId = parseInt(params?.id ?? "0");
  const { user } = useAuth();
  const isAdmin = user?.role === "super_admin" || user?.role === "admin";
  const canEdit = user?.role !== "instructor";

  const [showAdd, setShowAdd] = useState(false);
  const [moveEnrollment, setMoveEnrollment] = useState<number | null>(null);
  const [removeEnrollment, setRemoveEnrollment] = useState<number | null>(null);
  const [selectedPaymentEnrollment, setSelectedPaymentEnrollment] = useState<number | null>(null);

  const utils = trpc.useUtils();

  const { data: cls, isLoading: clsLoading } = trpc.classes.get.useQuery({ id: classId });
  const { data: roster, isLoading: rosterLoading } = trpc.enrollments.forClass.useQuery({ classId });

  const { data: csvData, refetch: fetchCsv } = trpc.enrollments.exportCsv.useQuery(
    { classId },
    { enabled: false }
  );

  const updatePayment = trpc.enrollments.updatePaymentStatus.useMutation({
    onSuccess: () => {
      utils.enrollments.forClass.invalidate({ classId });
      toast.success("Payment status updated");
      setSelectedPaymentEnrollment(null);
    },
    onError: (err) => toast.error(err.message),
  });

  const handleExportCsv = async () => {
    const result = await fetchCsv();
    if (result.data) {
      const blob = new Blob([result.data.csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.data.filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("CSV exported");
    }
  };

  if (clsLoading) {
    return (
      <div className="p-4 sm:p-6 space-y-4 max-w-4xl mx-auto">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (!cls) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground">Class not found</p>
        <Link href="/classes">
          <Button variant="ghost" className="mt-3">Back to Classes</Button>
        </Link>
      </div>
    );
  }

  const pct = cls.capacity > 0 ? Math.round((cls.enrolledCount / cls.capacity) * 100) : 0;
  const isFull = cls.enrolledCount >= cls.capacity;

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-4xl mx-auto">
      {/* Back + Header */}
      <div className="flex items-center gap-3">
        <Link href="/classes">
          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold text-foreground leading-tight truncate">{cls.title}</h1>
          {cls.classType && (
            <p className="text-sm text-muted-foreground">{cls.classType}</p>
          )}
        </div>
      </div>

      {/* Class Info Card */}
      <Card className="bg-card border-border">
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-primary flex-shrink-0" />
              <div>
                <p className="text-foreground font-medium">
                  {format(new Date(cls.startDatetime), "EEEE, MMMM d, yyyy")}
                </p>
                <p className="text-muted-foreground text-xs">
                  {format(new Date(cls.startDatetime), "h:mm a")} – {format(new Date(cls.endDatetime), "h:mm a")}
                </p>
              </div>
            </div>
            {cls.location && (
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-primary flex-shrink-0" />
                <div>
                  <p className="text-foreground font-medium">{cls.location.name}</p>
                  {cls.location.city && (
                    <p className="text-muted-foreground text-xs">{cls.location.city}, {cls.location.state}</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Capacity Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">
                  {cls.enrolledCount} / {cls.capacity} enrolled
                </span>
              </div>
              <Badge
                variant="outline"
                className={cn(
                  "text-xs",
                  isFull
                    ? "bg-red-900/40 text-red-300 border-red-700/50"
                    : pct >= 80
                    ? "bg-amber-900/40 text-amber-300 border-amber-700/50"
                    : "bg-green-900/40 text-green-300 border-green-700/50"
                )}
              >
                {isFull ? "Full" : `${cls.capacity - cls.enrolledCount} seats open`}
              </Badge>
            </div>
            <div className="h-2 bg-secondary rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  isFull ? "bg-red-500" : pct >= 80 ? "bg-amber-500" : "bg-green-500"
                )}
                style={{ width: `${Math.min(pct, 100)}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Roster Header + Actions */}
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-foreground">
          Roster ({roster?.length ?? 0})
        </h2>
        <div className="flex items-center gap-2">
          {canEdit && (
            <Button
              onClick={() => setShowAdd(true)}
              disabled={isFull}
              className="bg-primary hover:bg-primary/90 text-primary-foreground text-sm"
              size="sm"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Student
            </Button>
          )}
          {isAdmin && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCsv}
              className="border-border text-muted-foreground hover:text-foreground text-sm"
            >
              <Download className="h-4 w-4 mr-1" />
              CSV
            </Button>
          )}
        </div>
      </div>

      {/* Roster Table */}
      {rosterLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-lg" />
          ))}
        </div>
      ) : !roster?.length ? (
        <Card className="bg-card border-border">
          <CardContent className="p-10 text-center">
            <Users className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No students enrolled yet</p>
            {canEdit && !isFull && (
              <Button
                onClick={() => setShowAdd(true)}
                className="mt-4 bg-primary hover:bg-primary/90 text-primary-foreground"
                size="sm"
              >
                <Plus className="h-4 w-4 mr-1.5" />
                Add First Student
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-card border-border overflow-hidden">
          {/* Desktop Table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/50">
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Student</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Contact</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Payment</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Source</th>
                  {canEdit && <th className="px-4 py-3 w-10" />}
                </tr>
              </thead>
              <tbody>
                {roster.map((enr, i) => (
                  <tr
                    key={enr.id}
                    className={cn("border-b border-border last:border-0 hover:bg-secondary/30 transition-colors")}
                  >
                    <td className="px-4 py-3">
                      <Link href={`/students/${enr.student.id}`}>
                        <span className="font-medium text-foreground hover:text-primary cursor-pointer">
                          {enr.student.firstName} {enr.student.lastName}
                        </span>
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      <div>{enr.student.email}</div>
                      {enr.student.phone && <div>{enr.student.phone}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className={cn(
                            "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border cursor-pointer hover:opacity-80 transition-opacity",
                            PAYMENT_PILL[enr.paymentStatus]
                          )}>
                            {PAYMENT_LABEL[enr.paymentStatus]}
                          </button>
                        </DropdownMenuTrigger>
                        {canEdit && (
                          <DropdownMenuContent className="bg-popover border-border">
                            {["paid", "unpaid", "free"].map((status) => (
                              <DropdownMenuItem
                                key={status}
                                onClick={() => updatePayment.mutate({ enrollmentId: enr.id, paymentStatus: status as any })}
                                className="text-foreground hover:bg-secondary cursor-pointer"
                              >
                                <span className={cn("w-2 h-2 rounded-full mr-2", status === "paid" ? "bg-green-500" : status === "unpaid" ? "bg-amber-500" : "bg-blue-500")} />
                                {PAYMENT_LABEL[status]}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        )}
                      </DropdownMenu>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-muted-foreground">{SOURCE_LABEL[enr.source] ?? enr.source}</span>
                    </td>
                    {canEdit && (
                      <td className="px-4 py-3">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-popover border-border">
                            <DropdownMenuItem
                              onClick={() => setMoveEnrollment(enr.id)}
                              className="text-foreground hover:bg-secondary cursor-pointer"
                            >
                              <ArrowRightLeft className="h-4 w-4 mr-2" /> Move to another class
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="bg-border" />
                            <DropdownMenuItem
                              onClick={() => setRemoveEnrollment(enr.id)}
                              className="text-red-400 hover:bg-red-900/30 cursor-pointer"
                            >
                              <UserMinus className="h-4 w-4 mr-2" /> Remove from class
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="sm:hidden divide-y divide-border">
            {roster.map((enr) => (
              <div key={enr.id} className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <Link href={`/students/${enr.student.id}`}>
                      <p className="font-medium text-foreground hover:text-primary cursor-pointer">
                        {enr.student.firstName} {enr.student.lastName}
                      </p>
                    </Link>
                    <p className="text-xs text-muted-foreground">{enr.student.email}</p>
                    {enr.student.phone && <p className="text-xs text-muted-foreground">{enr.student.phone}</p>}
                  </div>
                  {canEdit && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-popover border-border">
                        <DropdownMenuItem onClick={() => setMoveEnrollment(enr.id)} className="text-foreground hover:bg-secondary cursor-pointer">
                          <ArrowRightLeft className="h-4 w-4 mr-2" /> Move to another class
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-border" />
                        <DropdownMenuItem onClick={() => setRemoveEnrollment(enr.id)} className="text-red-400 hover:bg-red-900/30 cursor-pointer">
                          <UserMinus className="h-4 w-4 mr-2" /> Remove
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border", PAYMENT_PILL[enr.paymentStatus])}>
                    {PAYMENT_LABEL[enr.paymentStatus]}
                  </span>
                  <span className="text-xs text-muted-foreground">{SOURCE_LABEL[enr.source]}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Modals */}
      {showAdd && (
        <AddStudentModal
          open={showAdd}
          classId={classId}
          onClose={() => setShowAdd(false)}
          onSuccess={() => {
            setShowAdd(false);
            utils.enrollments.forClass.invalidate({ classId });
            utils.classes.get.invalidate({ id: classId });
          }}
        />
      )}
      {moveEnrollment !== null && (
        <MoveStudentModal
          open={true}
          enrollmentId={moveEnrollment}
          currentClassId={classId}
          onClose={() => setMoveEnrollment(null)}
          onSuccess={() => {
            setMoveEnrollment(null);
            utils.enrollments.forClass.invalidate({ classId });
            utils.classes.get.invalidate({ id: classId });
          }}
        />
      )}
      {removeEnrollment !== null && (
        <RemoveStudentDialog
          open={true}
          enrollmentId={removeEnrollment}
          onClose={() => setRemoveEnrollment(null)}
          onSuccess={() => {
            setRemoveEnrollment(null);
            utils.enrollments.forClass.invalidate({ classId });
            utils.classes.get.invalidate({ id: classId });
          }}
        />
      )}
    </div>
  );
}
