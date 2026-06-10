import { useRoute, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { format } from "date-fns";
import { formatClassDateTimeFull, formatClassDateMedium } from "@/lib/dateUtils";
import { ArrowLeft, Mail, Phone, CalendarDays, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const PAYMENT_PILL: Record<string, string> = {
  paid: "bg-green-900/40 text-green-400 border-green-700/50",
  unpaid: "bg-amber-900/40 text-amber-400 border-amber-700/50",
  free: "bg-blue-900/40 text-blue-400 border-blue-700/50",
};

const STATUS_PILL: Record<string, string> = {
  enrolled: "bg-green-900/40 text-green-400 border-green-700/50",
  removed: "bg-red-900/40 text-red-400 border-red-700/50",
  moved: "bg-purple-900/40 text-purple-400 border-purple-700/50",
  attended: "bg-blue-900/40 text-blue-400 border-blue-700/50",
};

export default function StudentDetail() {
  const [, params] = useRoute("/students/:id");
  const studentId = parseInt(params?.id ?? "0");

  const { data: student, isLoading } = trpc.students.get.useQuery({ id: studentId });

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 space-y-4 max-w-3xl mx-auto">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (!student) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground">Student not found</p>
        <Link href="/students">
          <Button variant="ghost" className="mt-3">Back to Search</Button>
        </Link>
      </div>
    );
  }

  const activeEnrollments = student.enrollments?.filter((e) => e.status === "enrolled") ?? [];
  const pastEnrollments = student.enrollments?.filter((e) => e.status !== "enrolled") ?? [];

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-3xl mx-auto">
      {/* Back */}
      <div className="flex items-center gap-3">
        <Link href="/students">
          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <h1 className="text-xl font-bold text-foreground">
          {student.firstName} {student.lastName}
        </h1>
      </div>

      {/* Contact Info */}
      <Card className="bg-card border-border">
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <Mail className="h-4 w-4 text-primary flex-shrink-0" />
            <a href={`mailto:${student.email}`} className="text-foreground hover:text-primary transition-colors">
              {student.email}
            </a>
          </div>
          {student.phone && (
            <div className="flex items-center gap-2 text-sm">
              <Phone className="h-4 w-4 text-primary flex-shrink-0" />
              <a href={`tel:${student.phone}`} className="text-foreground hover:text-primary transition-colors">
                {student.phone}
              </a>
            </div>
          )}
          <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1 border-t border-border">
            <Clock className="h-3 w-3" />
            <span>Added {format(new Date(student.createdAt), "MMMM d, yyyy")}</span>
          </div>
        </CardContent>
      </Card>

      {/* Current Enrollments */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-3">
          Current Classes ({activeEnrollments.length})
        </h2>
        {activeEnrollments.length === 0 ? (
          <Card className="bg-card border-border">
            <CardContent className="p-6 text-center">
              <CalendarDays className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Not enrolled in any upcoming classes</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {activeEnrollments.map((enr) => (
              <Link key={enr.id} href={enr.class ? `/classes/${enr.class.id}` : "/classes"}>
                <Card className="bg-card border-border hover:border-primary/50 transition-colors cursor-pointer">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-foreground text-sm">{enr.class?.title ?? "Unknown class"}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {enr.class ? formatClassDateTimeFull(enr.class.startDatetime) : ""}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className={cn("text-xs flex-shrink-0", PAYMENT_PILL[enr.paymentStatus])}
                      >
                        {enr.paymentStatus.charAt(0).toUpperCase() + enr.paymentStatus.slice(1)}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Class History */}
      {pastEnrollments.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-3">
            Class History ({pastEnrollments.length})
          </h2>
          <div className="space-y-2">
            {pastEnrollments.map((enr) => (
              <Card key={enr.id} className="bg-card border-border opacity-70">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-foreground text-sm">{enr.class?.title ?? "Unknown class"}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {enr.class ? formatClassDateMedium(enr.class.startDatetime) : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge
                        variant="outline"
                        className={cn("text-xs", STATUS_PILL[enr.status] ?? "bg-secondary text-muted-foreground")}
                      >
                        {enr.status}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={cn("text-xs", PAYMENT_PILL[enr.paymentStatus])}
                      >
                        {enr.paymentStatus}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
