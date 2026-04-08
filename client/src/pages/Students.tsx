import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Search, Users, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export default function Students() {
  const [query, setQuery] = useState("");

  const { data: results, isLoading } = trpc.students.search.useQuery(
    { query },
    { enabled: query.length >= 2 }
  );

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Student Search</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Search by name, email, phone, or class date
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search students..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9 bg-input border-border text-foreground placeholder:text-muted-foreground text-base"
          autoFocus
        />
      </div>

      {query.length > 0 && query.length < 2 && (
        <p className="text-sm text-muted-foreground">Type at least 2 characters to search</p>
      )}

      {query.length >= 2 && isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </div>
      )}

      {query.length >= 2 && !isLoading && results?.length === 0 && (
        <Card className="bg-card border-border">
          <CardContent className="p-8 text-center">
            <Users className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-muted-foreground">No students found for "{query}"</p>
          </CardContent>
        </Card>
      )}

      {results && results.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">{results.length} result{results.length !== 1 ? "s" : ""}</p>
          {results.map((student) => (
            <Link key={student.id} href={`/students/${student.id}`}>
              <Card className="bg-card border-border hover:border-primary/50 transition-colors cursor-pointer group">
                <CardContent className="p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">
                      {student.firstName} {student.lastName}
                    </p>
                    <p className="text-sm text-muted-foreground truncate">{student.email}</p>
                    {student.phone && (
                      <p className="text-xs text-muted-foreground">{student.phone}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-xs text-muted-foreground">
                      {student.enrollments?.length ?? 0} class{(student.enrollments?.length ?? 0) !== 1 ? "es" : ""}
                    </span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {query.length === 0 && (
        <Card className="bg-card border-border">
          <CardContent className="p-10 text-center">
            <Search className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">Enter a name, email, or phone number to find students</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
