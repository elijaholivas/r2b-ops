import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Archive as ArchiveIcon,
  RotateCcw,
  CalendarDays,
  MapPin,
  Users,
  Search,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

function formatDateRange(start: Date | string, end: Date | string) {
  const s = new Date(start);
  const e = new Date(end);
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" };
  const timeOpts: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit", hour12: true };
  if (s.toDateString() === e.toDateString()) {
    return `${s.toLocaleDateString(undefined, opts)} · ${s.toLocaleTimeString(undefined, timeOpts)} – ${e.toLocaleTimeString(undefined, timeOpts)}`;
  }
  return `${s.toLocaleDateString(undefined, opts)} – ${e.toLocaleDateString(undefined, opts)}`;
}

export default function Archive() {
  const [search, setSearch] = useState("");
  const utils = trpc.useUtils();

  const { data: archivedClasses = [], isLoading, error, refetch } = trpc.classes.listArchived.useQuery();

  const restore = trpc.classes.restore.useMutation({
    onSuccess: () => {
      toast.success("Class restored to active");
      utils.classes.listArchived.invalidate();
      utils.classes.list.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || "Failed to restore class");
    },
  });

  const filtered = archivedClasses.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      c.title.toLowerCase().includes(q) ||
      c.classType?.toLowerCase().includes(q) ||
      c.location?.name?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-muted">
          <ArchiveIcon className="h-5 w-5 text-muted-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Class Archive</h1>
          <p className="text-sm text-muted-foreground">
            Classes are automatically archived 8 hours after their end time. Admins can restore them if needed.
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search archived classes..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Content */}
      {error ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-lg font-medium text-destructive">Failed to load archived classes</p>
            <p className="text-sm text-muted-foreground mt-1">{error.message}</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => refetch()}>
              Try Again
            </Button>
          </CardContent>
        </Card>
      ) : isLoading ? (
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <ArchiveIcon className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <p className="text-lg font-medium text-muted-foreground">
              {search ? "No archived classes match your search" : "No archived classes yet"}
            </p>
            <p className="text-sm text-muted-foreground/60 mt-1">
              Classes appear here automatically 8 hours after they end.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground mb-2">
            {filtered.length} archived class{filtered.length !== 1 ? "es" : ""}
            {search && ` matching "${search}"`}
          </p>
          {filtered.map((cls) => (
            <Card key={cls.id} className="border-border/60 hover:border-border transition-colors">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-foreground truncate">{cls.title}</h3>
                      {cls.classType && (
                        <Badge variant="secondary" className="text-xs shrink-0">
                          {cls.classType}
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-xs shrink-0 text-muted-foreground">
                        Archived
                      </Badge>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                        {formatDateRange(cls.startDatetime, cls.endDatetime)}
                      </span>
                      {cls.location && (
                        <span className="flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5 shrink-0" />
                          {cls.location.name}
                        </span>
                      )}
                      <span className="flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5 shrink-0" />
                        {cls.enrolledCount} enrolled
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Link href={`/classes/${cls.id}`}>
                      <Button variant="outline" size="sm" className="gap-1.5">
                        <ExternalLink className="h-3.5 w-3.5" />
                        View
                      </Button>
                    </Link>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5 border-primary/40 text-primary hover:bg-primary/10"
                          disabled={restore.isPending}
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          Restore
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Restore this class?</AlertDialogTitle>
                          <AlertDialogDescription>
                            <strong>{cls.title}</strong> will be moved back to the active classes list.
                            {new Date(cls.endDatetime) < new Date()
                              ? " Since the class date has already passed, it will be marked as Completed."
                              : " It will be marked as Upcoming."}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => restore.mutate({ id: cls.id })}
                          >
                            Restore Class
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
