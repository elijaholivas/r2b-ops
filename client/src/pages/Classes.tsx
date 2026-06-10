import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { formatClassShort, parseClassDatetime } from "@/lib/dateUtils";
import {
  CalendarDays,
  MapPin,
  Users,
  Plus,
  Search,
  Filter,
  Clock,
  ChevronRight,
  MoreHorizontal,
  Copy,
  Archive,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import CreateClassModal from "@/components/CreateClassModal";
import DuplicateClassModal from "@/components/DuplicateClassModal";

function CapacityBar({ enrolled, capacity }: { enrolled: number; capacity: number }) {
  const pct = capacity > 0 ? Math.round((enrolled / capacity) * 100) : 0;
  const color = pct >= 100 ? "bg-red-500" : pct >= 80 ? "bg-amber-500" : "bg-green-500";
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{enrolled}/{capacity} enrolled</span>
        <span>{pct}%</span>
      </div>
      <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
    </div>
  );
}

/** Derive the display status from the actual class dates, ignoring the stored status field */
function getDisplayStatus(cls: { startDatetime: string | Date; endDatetime: string | Date; status: string }) {
  if (cls.status === "cancelled") return "cancelled";
  const now = new Date();
  const start = parseClassDatetime(cls.startDatetime);
  const end = parseClassDatetime(cls.endDatetime);
  if (now < start) return "upcoming";
  if (now >= start && now <= end) return "in_progress";
  return "past";
}

const STATUS_LABELS: Record<string, string> = {
  upcoming: "Upcoming",
  in_progress: "In Progress",
  past: "Past",
  cancelled: "Cancelled",
};

const STATUS_COLORS: Record<string, string> = {
  upcoming: "bg-blue-900/40 text-blue-300 border-blue-700/50",
  in_progress: "bg-green-900/40 text-green-300 border-green-700/50",
  past: "bg-secondary text-muted-foreground border-border",
  cancelled: "bg-red-900/40 text-red-300 border-red-700/50",
};

type ClassItem = {
  id: number;
  title: string;
  status: string;
  startDatetime: string | Date;
  endDatetime: string | Date;
  classType?: string | null;
  price?: string | null;
  enrolledCount: number;
  capacity: number;
  locationId?: number | null;
  location?: { id: number; name: string } | null;
};

function ClassCard({
  cls,
  isAdmin,
  onDuplicate,
  onArchive,
}: {
  cls: ClassItem;
  isAdmin: boolean;
  onDuplicate: (id: number) => void;
  onArchive: (id: number, title: string) => void;
}) {
  const displayStatus = getDisplayStatus(cls);
  const isFull = cls.enrolledCount >= cls.capacity;

  return (
    <div className="relative">
      <Link href={`/classes/${cls.id}`}>
        <Card className="bg-card border-border hover:border-primary/50 transition-colors cursor-pointer group">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <h3 className="font-semibold text-foreground text-sm leading-tight">
                    {cls.title}
                  </h3>
                  <Badge
                    variant="outline"
                    className={cn("text-xs", STATUS_COLORS[displayStatus] ?? "bg-secondary text-muted-foreground")}
                  >
                    {STATUS_LABELS[displayStatus] ?? displayStatus}
                  </Badge>
                  {cls.classType && (
                    <Badge variant="outline" className="text-xs bg-secondary text-muted-foreground border-border">
                      {cls.classType}
                    </Badge>
                  )}
                  {isFull && displayStatus === "upcoming" && (
                    <Badge variant="outline" className="text-xs bg-red-900/40 text-red-300 border-red-700/50">
                      Full
                    </Badge>
                  )}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatClassShort(cls.startDatetime)}
                  </span>
                  {cls.location && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {cls.location.name}
                    </span>
                  )}
                  {cls.price && (
                    <span className="text-green-400 font-medium">${cls.price}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {isAdmin && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.preventDefault()}>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground hover:bg-secondary"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-popover border-border">
                      <DropdownMenuItem
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDuplicate(cls.id); }}
                        className="text-foreground hover:bg-secondary cursor-pointer"
                      >
                        <Copy className="h-4 w-4 mr-2" />
                        Duplicate Class
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onArchive(cls.id, cls.title); }}
                        className="text-red-400 hover:bg-secondary cursor-pointer"
                      >
                        <Archive className="h-4 w-4 mr-2" />
                        Archive
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
            </div>
            <CapacityBar enrolled={cls.enrolledCount} capacity={cls.capacity} />
          </CardContent>
        </Card>
      </Link>
    </div>
  );
}

function SectionHeader({ title, count, collapsed, onToggle }: { title: string; count: number; collapsed: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className="flex items-center gap-2 w-full text-left group"
    >
      <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{title}</span>
      <Badge variant="secondary" className="text-xs">{count}</Badge>
      <ChevronDown className={cn("h-4 w-4 text-muted-foreground ml-auto transition-transform", collapsed && "-rotate-90")} />
    </button>
  );
}

export default function Classes() {
  const { user } = useAuth();
  const isAdmin = user?.role === "super_admin" || user?.role === "admin";
  const [search, setSearch] = useState("");
  const [locationFilter, setLocationFilter] = useState("all");
  const [capacityFilter, setCapacityFilter] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [duplicatingId, setDuplicatingId] = useState<number | null>(null);
  const [pastCollapsed, setPastCollapsed] = useState(false);

  const { data: classes, isLoading, error, refetch } = trpc.classes.list.useQuery({});
  const { data: locationsList } = trpc.classes.locations.useQuery();

  const archiveClass = trpc.classes.archive.useMutation({
    onSuccess: () => { toast.success("Class archived"); refetch(); },
    onError: (err) => toast.error(err.message),
  });

  const handleArchive = (id: number, title: string) => {
    if (confirm(`Archive "${title}"? It will be moved to the Archive.`)) {
      archiveClass.mutate({ id });
    }
  };

  const now = new Date();

  // Apply filters then split into upcoming/past
  const filtered = (classes ?? []).filter((cls) => {
    const matchSearch =
      !search ||
      cls.title.toLowerCase().includes(search.toLowerCase()) ||
      cls.location?.name?.toLowerCase().includes(search.toLowerCase()) ||
      cls.classType?.toLowerCase().includes(search.toLowerCase());
    const matchLocation = locationFilter === "all" || String(cls.locationId) === locationFilter;
    const isFull = cls.enrolledCount >= cls.capacity;
    const matchCapacity =
      capacityFilter === "all" ||
      (capacityFilter === "available" && !isFull) ||
      (capacityFilter === "full" && isFull);
    return matchSearch && matchLocation && matchCapacity;
  });

  // Upcoming: start date is in the future OR class is currently in progress — sorted ascending
  const upcomingClasses = filtered
    .filter((cls) => cls.status !== "cancelled" && parseClassDatetime(cls.endDatetime) > now)
    .sort((a, b) => parseClassDatetime(a.startDatetime).getTime() - parseClassDatetime(b.startDatetime).getTime());

  // Past: end date has passed — sorted descending (most recent first)
  const pastClasses = filtered
    .filter((cls) => parseClassDatetime(cls.endDatetime) <= now && cls.status !== "cancelled")
    .sort((a, b) => parseClassDatetime(b.startDatetime).getTime() - parseClassDatetime(a.startDatetime).getTime());

  // Cancelled classes (show at bottom of past)
  const cancelledClasses = filtered
    .filter((cls) => cls.status === "cancelled")
    .sort((a, b) => parseClassDatetime(b.startDatetime).getTime() - parseClassDatetime(a.startDatetime).getTime());

  const allPast = [...pastClasses, ...cancelledClasses];

  const hasFilters = search || locationFilter !== "all" || capacityFilter !== "all";

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Classes</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {upcomingClasses.length} upcoming · {allPast.length} past
          </p>
        </div>
        {isAdmin && (
          <Button
            onClick={() => setShowCreate(true)}
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            New Class
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search classes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-input border-border text-foreground placeholder:text-muted-foreground"
          />
        </div>
        {locationsList && locationsList.length > 0 && (
          <Select value={locationFilter} onValueChange={setLocationFilter}>
            <SelectTrigger className="w-44 bg-input border-border text-foreground">
              <MapPin className="h-4 w-4 mr-1.5 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border">
              <SelectItem value="all">All Locations</SelectItem>
              {locationsList.map((loc) => (
                <SelectItem key={loc.id} value={String(loc.id)}>{loc.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Select value={capacityFilter} onValueChange={setCapacityFilter}>
          <SelectTrigger className="w-36 bg-input border-border text-foreground">
            <Users className="h-4 w-4 mr-1.5 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-popover border-border">
            <SelectItem value="all">All Capacity</SelectItem>
            <SelectItem value="available">Has Open Seats</SelectItem>
            <SelectItem value="full">Full</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Class List */}
      {error ? (
        <Card className="bg-card border-border">
          <CardContent className="p-10 text-center">
            <p className="text-base font-medium text-destructive mb-1">Failed to load classes</p>
            <p className="text-sm text-muted-foreground mb-4">{error.message}</p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>Try Again</Button>
          </CardContent>
        </Card>
      ) : isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="p-10 text-center">
            <CalendarDays className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">
              {hasFilters ? "No classes match your filters" : "No classes found"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Upcoming Section */}
          {upcomingClasses.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Upcoming</span>
                <Badge variant="secondary" className="text-xs">{upcomingClasses.length}</Badge>
              </div>
              {upcomingClasses.map((cls) => (
                <ClassCard
                  key={cls.id}
                  cls={cls}
                  isAdmin={isAdmin}
                  onDuplicate={setDuplicatingId}
                  onArchive={handleArchive}
                />
              ))}
            </div>
          )}

          {/* Past Section */}
          {allPast.length > 0 && (
            <div className="space-y-3">
              <SectionHeader
                title="Past"
                count={allPast.length}
                collapsed={pastCollapsed}
                onToggle={() => setPastCollapsed((v) => !v)}
              />
              {!pastCollapsed && allPast.map((cls) => (
                <ClassCard
                  key={cls.id}
                  cls={cls}
                  isAdmin={isAdmin}
                  onDuplicate={setDuplicatingId}
                  onArchive={handleArchive}
                />
              ))}
            </div>
          )}

          {/* No upcoming message */}
          {upcomingClasses.length === 0 && allPast.length > 0 && (
            <Card className="bg-card border-border">
              <CardContent className="p-6 text-center">
                <CalendarDays className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No upcoming classes. Create one to get started.</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {showCreate && (
        <CreateClassModal
          open={showCreate}
          onClose={() => setShowCreate(false)}
          onSuccess={() => { setShowCreate(false); refetch(); }}
        />
      )}
      {duplicatingId !== null && (
        <DuplicateClassModal
          classId={duplicatingId}
          open={duplicatingId !== null}
          onClose={() => setDuplicatingId(null)}
          onSuccess={() => { setDuplicatingId(null); refetch(); }}
        />
      )}
    </div>
  );
}
