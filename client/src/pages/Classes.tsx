import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { format } from "date-fns";
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

const STATUS_LABELS: Record<string, string> = {
  upcoming: "Upcoming",
  in_progress: "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

const STATUS_COLORS: Record<string, string> = {
  upcoming: "bg-blue-900/40 text-blue-300 border-blue-700/50",
  in_progress: "bg-green-900/40 text-green-300 border-green-700/50",
  completed: "bg-secondary text-muted-foreground border-border",
  cancelled: "bg-red-900/40 text-red-300 border-red-700/50",
};

export default function Classes() {
  const { user } = useAuth();
  const isAdmin = user?.role === "super_admin" || user?.role === "admin";
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [locationFilter, setLocationFilter] = useState("all");
  const [capacityFilter, setCapacityFilter] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [duplicatingId, setDuplicatingId] = useState<number | null>(null);

  const { data: classes, isLoading, refetch } = trpc.classes.list.useQuery({});
  const { data: locationsList } = trpc.classes.locations.useQuery();

  const archiveClass = trpc.classes.archive.useMutation({
    onSuccess: () => { toast.success("Class archived"); refetch(); },
    onError: (err) => toast.error(err.message),
  });

  const filtered = (classes ?? []).filter((cls) => {
    const matchSearch =
      !search ||
      cls.title.toLowerCase().includes(search.toLowerCase()) ||
      cls.location?.name?.toLowerCase().includes(search.toLowerCase()) ||
      cls.classType?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || cls.status === statusFilter;
    const matchLocation = locationFilter === "all" || String(cls.locationId) === locationFilter;
    const isFull = cls.enrolledCount >= cls.capacity;
    const matchCapacity =
      capacityFilter === "all" ||
      (capacityFilter === "available" && !isFull) ||
      (capacityFilter === "full" && isFull);
    return matchSearch && matchStatus && matchLocation && matchCapacity;
  });

  const hasFilters = search || statusFilter !== "all" || locationFilter !== "all" || capacityFilter !== "all";

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Classes</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {filtered.length} class{filtered.length !== 1 ? "es" : ""}
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
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36 bg-input border-border text-foreground">
            <Filter className="h-4 w-4 mr-1.5 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-popover border-border">
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="upcoming">Upcoming</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
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
      {isLoading ? (
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
        <div className="space-y-3">
          {filtered.map((cls) => {
            const isFull = cls.enrolledCount >= cls.capacity;
            return (
              <div key={cls.id} className="relative">
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
                              className={cn("text-xs", STATUS_COLORS[cls.status] ?? "bg-secondary text-muted-foreground")}
                            >
                              {STATUS_LABELS[cls.status] ?? cls.status}
                            </Badge>
                            {cls.classType && (
                              <Badge variant="outline" className="text-xs bg-secondary text-muted-foreground border-border">
                                {cls.classType}
                              </Badge>
                            )}
                            {isFull && (
                              <Badge variant="outline" className="text-xs bg-red-900/40 text-red-300 border-red-700/50">
                                Full
                              </Badge>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {format(new Date(cls.startDatetime), "EEE, MMM d · h:mm a")}
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
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setDuplicatingId(cls.id);
                                  }}
                                  className="text-foreground hover:bg-secondary cursor-pointer"
                                >
                                  <Copy className="h-4 w-4 mr-2" />
                                  Duplicate Class
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if (confirm(`Archive "${cls.title}"? It will be hidden from all views.`)) {
                                      archiveClass.mutate({ id: cls.id });
                                    }
                                  }}
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
          })}
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
