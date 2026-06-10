import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { format } from "date-fns";
import { formatClassDateTimeMedium } from "@/lib/dateUtils";
import {
  CalendarDays,
  Users,
  AlertTriangle,
  Mail,
  ArrowRight,
  TrendingUp,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

function CapacityBar({ enrolled, capacity }: { enrolled: number; capacity: number }) {
  const pct = capacity > 0 ? Math.round((enrolled / capacity) * 100) : 0;
  const color = pct >= 100 ? "bg-red-500" : pct >= 80 ? "bg-amber-500" : "bg-green-500";
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{enrolled} enrolled</span>
        <span>{capacity - enrolled} open</span>
      </div>
      <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", color)}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const isAdmin = user?.role === "super_admin" || user?.role === "admin";

  const { data: dashData, isLoading: dashLoading } = trpc.admin.dashboard.useQuery(undefined, {
    enabled: isAdmin,
    refetchInterval: 60000,
  });

  const { data: classes, isLoading: classesLoading } = trpc.classes.list.useQuery(
    { upcoming: true },
    { enabled: !isAdmin }
  );

  const loading = isAdmin ? dashLoading : classesLoading;
  const upcomingClasses = isAdmin ? dashData?.upcomingClasses : classes?.slice(0, 5);

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 17 ? "afternoon" : "evening"},{" "}
          {user?.name?.split(" ")[0] ?? "there"}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          {format(new Date(), "EEEE, MMMM d, yyyy")} · America/Los_Angeles
        </p>
      </div>

      {/* Admin Stats Row */}
      {isAdmin && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {dashLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))
          ) : (
            <>
              <Card className="bg-card border-border">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <CalendarDays className="h-4 w-4 text-primary" />
                    <span className="text-xs text-muted-foreground">Upcoming</span>
                  </div>
                  <p className="text-2xl font-bold text-foreground">{dashData?.totalUpcoming ?? 0}</p>
                  <p className="text-xs text-muted-foreground">classes</p>
                </CardContent>
              </Card>
              <Card className="bg-card border-border">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingUp className="h-4 w-4 text-green-400" />
                    <span className="text-xs text-muted-foreground">Total Seats</span>
                  </div>
                  <p className="text-2xl font-bold text-foreground">
                    {upcomingClasses?.reduce((s, c) => s + (c.enrolledCount ?? 0), 0) ?? 0}
                  </p>
                  <p className="text-xs text-muted-foreground">enrolled</p>
                </CardContent>
              </Card>
              <Card className={cn("bg-card border-border", (dashData?.unreadAlerts ?? 0) > 0 && "border-amber-700/50")}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle className={cn("h-4 w-4", (dashData?.unreadAlerts ?? 0) > 0 ? "text-amber-400" : "text-muted-foreground")} />
                    <span className="text-xs text-muted-foreground">Alerts</span>
                  </div>
                  <p className="text-2xl font-bold text-foreground">{dashData?.unreadAlerts ?? 0}</p>
                  <p className="text-xs text-muted-foreground">unread</p>
                </CardContent>
              </Card>
              <Card className={cn("bg-card border-border", (dashData?.failedEmails ?? 0) > 0 && "border-red-700/50")}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Mail className={cn("h-4 w-4", (dashData?.failedEmails ?? 0) > 0 ? "text-red-400" : "text-muted-foreground")} />
                    <span className="text-xs text-muted-foreground">Email Failures</span>
                  </div>
                  <p className="text-2xl font-bold text-foreground">{dashData?.failedEmails ?? 0}</p>
                  <p className="text-xs text-muted-foreground">failed</p>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      )}

      {/* Upcoming Classes */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-foreground">Upcoming Classes</h2>
          <Link href="/classes">
            <Button variant="ghost" size="sm" className="text-primary hover:text-primary/80">
              View all <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </Link>
        </div>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
        ) : !upcomingClasses?.length ? (
          <Card className="bg-card border-border">
            <CardContent className="p-8 text-center">
              <CalendarDays className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">No upcoming classes scheduled</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-12">
            {upcomingClasses.map((cls: any) => {
              const isFull = cls.enrolledCount >= cls.capacity;
              const isNearFull = cls.enrolledCount >= cls.capacity * 0.8;
              return (
                <Link key={cls.id} href={`/classes/${cls.id}`}>
                  <Card className="bg-card border-border hover:border-primary/50 transition-colors cursor-pointer">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="min-w-0">
                          <h3 className="font-semibold text-foreground text-sm leading-tight truncate">
                            {cls.title}
                          </h3>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatClassDateTimeMedium(cls.startDatetime)}
                            </span>
                            {cls.location && (
                              <span className="text-xs text-muted-foreground">
                                · {cls.location.name}
                              </span>
                            )}
                          </div>
                        </div>
                        <Badge
                          className={cn(
                            "text-xs flex-shrink-0",
                            isFull
                              ? "bg-red-900/50 text-red-300 border-red-700/50"
                              : isNearFull
                              ? "bg-amber-900/50 text-amber-300 border-amber-700/50"
                              : "bg-green-900/50 text-green-300 border-green-700/50"
                          )}
                          variant="outline"
                        >
                          {isFull ? "Full" : `${cls.capacity - cls.enrolledCount} open`}
                        </Badge>
                      </div>
                      <CapacityBar enrolled={cls.enrolledCount} capacity={cls.capacity} />
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Recent Activity (admin only) */}
      {isAdmin && dashData?.recentActivity && dashData.recentActivity.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-3">Recent Activity</h2>
          <Card className="bg-card border-border">
            <CardContent className="p-0">
              {dashData.recentActivity.slice(0, 5).map((activity: any, i: number) => (
                <div
                  key={activity.id}
                  className={cn(
                    "flex items-start gap-3 px-4 py-3",
                    i < dashData.recentActivity.length - 1 && "border-b border-border"
                  )}
                >
                  <div className="w-2 h-2 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm text-foreground">{activity.notes || activity.actionType.replace(/_/g, " ")}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {format(new Date(activity.createdAt), "MMM d · h:mm a")}
                    </p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
