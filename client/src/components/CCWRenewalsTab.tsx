import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { format, formatDistanceToNow } from "date-fns";
import { formatClassDateMedium } from "@/lib/dateUtils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { RefreshCw, Mail, Clock, CheckCircle2, AlertCircle, Calendar, BookOpen } from "lucide-react";
import { toast } from "sonner";

const STATUS_PILL: Record<string, string> = {
  pending: "bg-amber-900/40 text-amber-400 border-amber-700/50",
  sent: "bg-green-900/40 text-green-400 border-green-700/50",
  cancelled: "bg-gray-800 text-gray-400 border-gray-600",
  converted: "bg-blue-900/40 text-blue-400 border-blue-700/50",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  sent: "Sent",
  cancelled: "Cancelled",
  converted: "Renewed",
};

type StatusFilter = "all" | "pending" | "sent" | "cancelled";

export default function CCWRenewalsTab() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending");
  const { data: renewals, isLoading, refetch } = trpc.ccwRenewals.list.useQuery(
    statusFilter === "all" ? {} : { status: statusFilter as "pending" | "sent" | "cancelled" }
  );
  const { data: stats } = trpc.ccwRenewals.stats.useQuery();

  const sendNow = trpc.ccwRenewals.sendNow.useMutation({
    onSuccess: () => { toast.success("Renewal reminder sent"); refetch(); },
    onError: (err) => toast.error(err.message),
  });

  const cancelReminder = trpc.ccwRenewals.cancel.useMutation({
    onSuccess: () => { toast.success("Reminder cancelled"); refetch(); },
    onError: (err) => toast.error(err.message),
  });

  const processNow = trpc.ccwRenewals.processNow.useMutation({
    onSuccess: (data) => { toast.success(`Processed ${data.sent} renewal reminders`); refetch(); },
    onError: (err) => toast.error(err.message),
  });

  if (isLoading) return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Stats Row */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total Tracked", value: stats.total, icon: Calendar, color: "text-foreground" },
            { label: "Pending", value: stats.pending, icon: Clock, color: "text-amber-400" },
            { label: "Sent", value: stats.sent, icon: CheckCircle2, color: "text-green-400" },
            { label: "Due This Month", value: stats.dueThisMonth, icon: AlertCircle, color: "text-red-400" },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-secondary/50 rounded-lg p-3 space-y-1">
              <div className="flex items-center gap-1.5">
                <Icon className={cn("h-3.5 w-3.5", color)} />
                <span className="text-xs text-muted-foreground">{label}</span>
              </div>
              <p className={cn("text-xl font-bold", color)}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Status Filter */}
      <div className="flex gap-1.5 flex-wrap">
        {(["pending", "sent", "all", "cancelled"] as StatusFilter[]).map((s) => (
          <Button
            key={s}
            size="sm"
            variant={statusFilter === s ? "default" : "outline"}
            onClick={() => setStatusFilter(s)}
            className={cn(
              "h-7 text-xs capitalize",
              statusFilter === s
                ? "bg-primary text-primary-foreground"
                : "border-border text-muted-foreground hover:text-foreground"
            )}
          >
            {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
          </Button>
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-foreground">CCW Renewal Reminders</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Sent 18 months after initial CCW class completion — 6 months before the 2-year renewal deadline
          </p>
        </div>
        <Button
          size="sm" variant="outline"
          onClick={() => processNow.mutate()}
          disabled={processNow.isPending}
          className="border-border text-muted-foreground hover:text-foreground"
        >
          <RefreshCw className={cn("h-4 w-4 mr-1.5", processNow.isPending && "animate-spin")} />
          {processNow.isPending ? "Processing..." : "Process Now"}
        </Button>
      </div>

      {/* Renewals List */}
      {!renewals?.length ? (
        <div className="text-center py-10 text-muted-foreground">
          <Mail className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No CCW renewal reminders tracked yet.</p>
          <p className="text-xs mt-1">Reminders are automatically created when students complete an Initial CCW class.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {renewals.map((r) => (
            <div key={r.id} className="bg-secondary/30 rounded-lg p-3 flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-foreground text-sm">
                    {r.student.firstName} {r.student.lastName}
                  </span>
                  <Badge variant="outline" className={cn("text-xs", STATUS_PILL[r.status])}>
                    {STATUS_LABEL[r.status]}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground truncate">{r.student.email}</p>
                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1 text-foreground/70 font-medium">
                    <BookOpen className="h-3 w-3" />
                    {r.class.title ?? "Class"}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {formatClassDateMedium(r.class.startDatetime)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Reminder due: {format(new Date(r.scheduledFor), "MMM d, yyyy")}
                    {r.status === "pending" && (
                      <span className={cn(
                        "ml-1",
                        new Date(r.scheduledFor) <= new Date() ? "text-red-400 font-medium" : "text-muted-foreground"
                      )}>
                        ({new Date(r.scheduledFor) <= new Date()
                          ? "overdue"
                          : `in ${formatDistanceToNow(new Date(r.scheduledFor))}`})
                      </span>
                    )}
                  </span>
                  {r.sentAt && (
                    <span className="flex items-center gap-1 text-green-400">
                      <CheckCircle2 className="h-3 w-3" />
                      Sent {format(new Date(r.sentAt), "MMM d, yyyy")}
                    </span>
                  )}
                </div>
              </div>
              {r.status === "pending" && (
                <div className="flex gap-1.5 flex-shrink-0">
                  <Button
                    size="sm" variant="outline"
                    onClick={() => sendNow.mutate({ id: r.id })}
                    disabled={sendNow.isPending}
                    className="h-7 text-xs border-[#c0392b]/50 text-[#c0392b] hover:bg-[#c0392b]/10"
                  >
                    <Mail className="h-3 w-3 mr-1" /> Send Now
                  </Button>
                  <Button
                    size="sm" variant="ghost"
                    onClick={() => cancelReminder.mutate({ id: r.id })}
                    disabled={cancelReminder.isPending}
                    className="h-7 text-xs text-muted-foreground hover:text-foreground"
                  >
                    Cancel
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
