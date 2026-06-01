import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  Mail,
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Link2,
  Settings,
  ChevronDown,
  ChevronUp,
  Loader2,
  Users,
  ShoppingBag,
  Save,
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { SettingsTab } from "@/components/SettingsTab";
import UsersTab from "@/components/UsersTab";
import CCWRenewalsTab from "@/components/CCWRenewalsTab";

const EMAIL_STATUS_COLORS: Record<string, string> = {
  pending: "bg-blue-900/40 text-blue-300 border-blue-700/50",
  sent: "bg-green-900/40 text-green-300 border-green-700/50",
  failed: "bg-red-900/40 text-red-300 border-red-700/50",
  retrying: "bg-amber-900/40 text-amber-300 border-amber-700/50",
};

const EMAIL_TYPE_LABELS: Record<string, string> = {
  confirmation: "Confirmation",
  reminder: "2-Day Reminder",
  move_notification: "Move Notice",
  custom: "Custom",
};

export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState("emails");

  const utils = trpc.useUtils();

  const { data: emailQueue, isLoading: emailLoading } = trpc.admin.emailQueue.useQuery(
    undefined,
    { refetchInterval: 30000 }
  );

  const { data: alerts, isLoading: alertsLoading } = trpc.admin.alerts.useQuery(
    { unreadOnly: false },
    { refetchInterval: 30000 }
  );

  const { data: wooMappings, isLoading: wooLoading } = trpc.admin.integrationSettings.useQuery();

  const retryEmail = trpc.admin.retryEmail.useMutation({
    onSuccess: () => {
      toast.success("Email queued for retry");
      utils.admin.emailQueue.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const markAlertRead = trpc.admin.markAlertRead.useMutation({
    onSuccess: () => {
      utils.admin.alerts.invalidate();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const failedEmails = emailQueue?.filter((e) => e.status === "failed") ?? [];
  const pendingEmails = emailQueue?.filter((e) => e.status === "pending") ?? [];
  const sentEmails = emailQueue?.filter((e) => e.status === "sent") ?? [];
  const unreadAlerts = alerts?.filter((a) => !a.isRead) ?? [];

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Admin Panel</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Email queue, alerts, and WooCommerce sync</p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className={cn("bg-card border-border", failedEmails.length > 0 && "border-red-700/50")}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <XCircle className={cn("h-4 w-4", failedEmails.length > 0 ? "text-red-400" : "text-muted-foreground")} />
              <span className="text-xs text-muted-foreground">Failed</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{failedEmails.length}</p>
            <p className="text-xs text-muted-foreground">emails</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="h-4 w-4 text-blue-400" />
              <span className="text-xs text-muted-foreground">Pending</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{pendingEmails.length}</p>
            <p className="text-xs text-muted-foreground">emails</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="h-4 w-4 text-green-400" />
              <span className="text-xs text-muted-foreground">Sent</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{sentEmails.length}</p>
            <p className="text-xs text-muted-foreground">emails</p>
          </CardContent>
        </Card>
        <Card className={cn("bg-card border-border", unreadAlerts.length > 0 && "border-amber-700/50")}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className={cn("h-4 w-4", unreadAlerts.length > 0 ? "text-amber-400" : "text-muted-foreground")} />
              <span className="text-xs text-muted-foreground">Alerts</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{unreadAlerts.length}</p>
            <p className="text-xs text-muted-foreground">unread</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-secondary border border-border">
          <TabsTrigger value="emails" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Mail className="h-4 w-4 mr-1.5" />
            Email Queue
            {failedEmails.length > 0 && (
              <Badge className="ml-1.5 bg-red-600 text-white text-xs px-1.5 py-0">{failedEmails.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="alerts" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <AlertTriangle className="h-4 w-4 mr-1.5" />
            Alerts
            {unreadAlerts.length > 0 && (
              <Badge className="ml-1.5 bg-amber-600 text-white text-xs px-1.5 py-0">{unreadAlerts.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="woo" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Link2 className="h-4 w-4 mr-1.5" />
            WooCommerce
          </TabsTrigger>
          <TabsTrigger value="settings" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Settings className="h-4 w-4 mr-1.5" />
            Settings
          </TabsTrigger>
          <TabsTrigger value="ccw" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            CCW Renewals
          </TabsTrigger>
          <TabsTrigger value="users" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Users className="h-4 w-4 mr-1.5" />
            Users
          </TabsTrigger>
        </TabsList>

        {/* Email Queue Tab */}
        <TabsContent value="emails" className="mt-4">
          {emailLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
            </div>
          ) : !emailQueue?.length ? (
            <Card className="bg-card border-border">
              <CardContent className="p-8 text-center">
                <Mail className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-muted-foreground">No emails in queue</p>
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-card border-border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-secondary/50">
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">To</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Type</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Attempts</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Updated</th>
                      <th className="px-4 py-3 w-20" />
                    </tr>
                  </thead>
                  <tbody>
                    {emailQueue.map((email) => (
                      <tr key={email.id} className="border-b border-border last:border-0 hover:bg-secondary/30 transition-colors">
                        <td className="px-4 py-3">
                          <p className="text-foreground font-medium text-xs">{email.toEmail}</p>
                          {email.subject && <p className="text-muted-foreground text-xs truncate max-w-[200px]">{email.subject}</p>}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs text-muted-foreground">{EMAIL_TYPE_LABELS[(email as any).emailType] ?? "Email"}</span>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className={cn("text-xs", EMAIL_STATUS_COLORS[email.status])}>
                            {email.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs text-muted-foreground">{email.retryCount ?? 0} retries</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(email.updatedAt), "MMM d · h:mm a")}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {email.status === "failed" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => retryEmail.mutate({ emailQueueId: email.id })}
                              disabled={retryEmail.isPending}
                              className="text-xs text-primary hover:text-primary/80 h-7"
                            >
                              <RefreshCw className="h-3 w-3 mr-1" />
                              Retry
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </TabsContent>

        {/* Alerts Tab */}
        <TabsContent value="alerts" className="mt-4">
          {alertsLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
            </div>
          ) : !alerts?.length ? (
            <Card className="bg-card border-border">
              <CardContent className="p-8 text-center">
                <CheckCircle2 className="h-8 w-8 text-green-400 mx-auto mb-2" />
                <p className="text-muted-foreground">No alerts — all clear</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {alerts.map((alert) => (
                <Card
                  key={alert.id}
                  className={cn(
                    "bg-card border-border",
                    !alert.isRead && "border-amber-700/50"
                  )}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0 text-amber-400" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground">{alert.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{alert.message}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {format(new Date(alert.createdAt), "MMM d, yyyy · h:mm a")}
                          </p>
                        </div>
                      </div>
                      {!alert.isRead && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => markAlertRead.mutate({ id: alert.id })}
                          className="text-xs text-muted-foreground hover:text-foreground flex-shrink-0"
                        >
                          Dismiss
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* WooCommerce Tab */}
        <WooCommerceTab />

        {/* Settings Tab */}
        <TabsContent value="settings" className="mt-4">
          <SettingsTab />
        </TabsContent>
        <TabsContent value="ccw" className="mt-4">
          <CCWRenewalsTab />
        </TabsContent>
        <TabsContent value="users" className="mt-4">
          <UsersTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── WooCommerce Sync Tab ─────────────────────────────────────────────────────

type SyncResult = {
  id: number;
  name: string;
  variationId: number | null;
  variationName: string | null;
  action: "created" | "skipped";
  classId?: number;
  reason?: string;
};

function WooCommerceTab() {
  const utils = trpc.useUtils();
  const [syncResults, setSyncResults] = useState<SyncResult[]>([]);
  const [hasSynced, setHasSynced] = useState(false);
  const [summary, setSummary] = useState<{ created: number; skipped: number; total: number } | null>(null);

  const syncMutation = trpc.admin.syncWooProducts.useMutation({
    onSuccess: (data) => {
      setSyncResults(data.results);
      setSummary({ created: data.created, skipped: data.skipped, total: data.total });
      setHasSynced(true);
      utils.classes.list.invalidate();
      if (data.created > 0) {
        toast.success(`Created ${data.created} class${data.created !== 1 ? "es" : ""} from WooCommerce products`);
      } else {
        toast.info(`Sync complete — ${data.skipped} product${data.skipped !== 1 ? "s" : ""} already mapped, nothing new to create`);
      }
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <TabsContent value="woo" className="mt-4 space-y-4">
      {/* Webhook info banner */}
      <div className="p-4 rounded-lg bg-blue-900/20 border border-blue-700/50">
        <p className="text-sm text-blue-300 font-medium mb-0.5">Webhook endpoint</p>
        <code className="text-xs font-mono text-blue-200 bg-blue-900/40 px-2 py-1 rounded block">
          https://r2bclass-94klu95d.manus.space/api/webhooks/woocommerce
        </code>
        <p className="text-xs text-blue-400 mt-1.5">
          Set this in WooCommerce → Settings → Advanced → Webhooks. Subscribe to: Order Created, Order Updated.
        </p>
      </div>

      {/* Sync button + summary */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Auto-Create Classes from WooCommerce</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Reads <code className="font-mono">class_date</code>, <code className="font-mono">class_location</code>, and stock quantity from each product to create classes automatically. Already-mapped products are skipped.
          </p>
        </div>
        <Button
          onClick={() => syncMutation.mutate()}
          disabled={syncMutation.isPending}
          className="ml-4 shrink-0 bg-primary text-primary-foreground hover:bg-primary/90"
        >
          {syncMutation.isPending ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Syncing…</>
          ) : (
            <><ShoppingBag className="h-4 w-4 mr-2" />Sync &amp; Create Classes</>  
          )}
        </Button>
      </div>

      {/* Summary badges */}
      {summary && (
        <div className="flex gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-900/30 border border-green-700/40">
            <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
            <span className="text-xs text-green-300 font-medium">{summary.created} created</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary border border-border">
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground font-medium">{summary.skipped} skipped</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary border border-border">
            <ShoppingBag className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground font-medium">{summary.total} total</span>
          </div>
        </div>
      )}

      {/* Results table */}
      {!hasSynced ? (
        <Card className="bg-card border-border">
          <CardContent className="p-8 text-center">
            <ShoppingBag className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-muted-foreground font-medium">Click "Sync &amp; Create Classes" to import from WooCommerce</p>
            <p className="text-xs text-muted-foreground mt-1">
              Requires WooCommerce API credentials saved in Admin → Settings
            </p>
          </CardContent>
        </Card>
      ) : syncResults.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="p-8 text-center">
            <XCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-muted-foreground">No published products found in WooCommerce</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-card border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/50">
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Product</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">WC ID</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Result</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Details</th>
                </tr>
              </thead>
              <tbody>
                {syncResults.map((r, i) => {
                  const key = r.variationId ? `${r.id}_${r.variationId}` : String(r.id);
                  return (
                    <tr key={`${key}-${i}`} className="border-b border-border last:border-0 hover:bg-secondary/30 transition-colors">
                      <td className="px-4 py-3">
                        <p className="text-foreground font-medium text-sm">{r.name}</p>
                        {r.variationName && (
                          <p className="text-xs text-muted-foreground mt-0.5">Variation: {r.variationName}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-muted-foreground font-mono">
                          #{r.id}{r.variationId ? ` / ${r.variationId}` : ""}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {r.action === "created" ? (
                          <Badge variant="outline" className="bg-green-900/40 text-green-300 border-green-700/50 text-xs">
                            <CheckCircle2 className="h-3 w-3 mr-1" />Created
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-secondary text-muted-foreground border-border text-xs">
                            Skipped
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {r.action === "created" && r.classId ? (
                          <span className="text-xs text-muted-foreground">Class #{r.classId} created</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">{r.reason ?? ""}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </TabsContent>
  );
}
