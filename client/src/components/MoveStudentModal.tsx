import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { ArrowRightLeft, Loader2, AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { formatClassDateMedium, formatClassDateTimeFull } from "@/lib/dateUtils";

interface Props {
  open: boolean;
  enrollmentId: number;
  currentClassId: number;
  onClose: () => void;
  onSuccess: () => void;
}

export default function MoveStudentModal({ open, enrollmentId, currentClassId, onClose, onSuccess }: Props) {
  const [targetClassId, setTargetClassId] = useState<string>("");
  const [notifyStudent, setNotifyStudent] = useState(false);

  const { data: classes } = trpc.classes.list.useQuery({});

  const availableClasses = (classes ?? []).filter(
    (c) => c.id !== currentClassId && c.status === "upcoming" && c.enrolledCount < c.capacity
  );

  const moveMutation = trpc.enrollments.move.useMutation({
    onSuccess: () => {
      toast.success("Student moved successfully");
      onSuccess();
    },
    onError: (err) => {
      toast.error(err.message || "Failed to move student");
    },
  });

  const selectedClass = availableClasses.find((c) => c.id === parseInt(targetClassId));

  const handleMove = () => {
    if (!targetClassId) {
      toast.error("Please select a destination class");
      return;
    }
    moveMutation.mutate({
      enrollmentId,
      toClassId: parseInt(targetClassId),
      notifyStudent,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-card border-border text-foreground max-w-md w-full mx-4">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <ArrowRightLeft className="h-5 w-5 text-primary" />
            Move Student
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Atomically transfer this student to another class. Both seat counts will update instantly.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {availableClasses.length === 0 ? (
            <div className="flex items-center gap-2 p-4 rounded-lg bg-amber-900/20 border border-amber-700/50">
              <AlertTriangle className="h-5 w-5 text-amber-400 flex-shrink-0" />
              <p className="text-sm text-amber-300">
                No other upcoming classes with available seats found.
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label className="text-sm text-foreground">Destination Class</Label>
                <Select value={targetClassId} onValueChange={setTargetClassId}>
                  <SelectTrigger className="bg-input border-border text-foreground">
                    <SelectValue placeholder="Select a class..." />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border max-h-64">
                    {availableClasses.map((cls) => (
                      <SelectItem key={cls.id} value={String(cls.id)}>
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground">{cls.title}</span>
                          <span className="text-xs text-muted-foreground">
                            {formatClassDateMedium(cls.startDatetime)} · {cls.capacity - cls.enrolledCount} seats open
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedClass && (
                <div className="p-3 rounded-lg bg-secondary border border-border space-y-1">
                  <p className="text-sm font-medium text-foreground">{selectedClass.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatClassDateTimeFull(selectedClass.startDatetime)}
                  </p>
                  {selectedClass.location && (
                    <p className="text-xs text-muted-foreground">{selectedClass.location.name}</p>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="outline" className="text-xs bg-green-900/40 text-green-300 border-green-700/50">
                      {selectedClass.capacity - selectedClass.enrolledCount} seats available
                    </Badge>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between py-2 border-t border-border">
                <div>
                  <p className="text-sm font-medium text-foreground">Notify student by email</p>
                  <p className="text-xs text-muted-foreground">Send updated confirmation via Mailgun</p>
                </div>
                <Switch checked={notifyStudent} onCheckedChange={setNotifyStudent} />
              </div>

              <div className="p-3 rounded-lg bg-blue-900/20 border border-blue-700/50">
                <p className="text-xs text-blue-300">
                  This move is atomic — the student will be removed from the current class and added to the new class in a single operation. No partial state is possible.
                </p>
              </div>
            </>
          )}

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              className="flex-1 text-muted-foreground hover:text-foreground"
            >
              Cancel
            </Button>
            {availableClasses.length > 0 && (
              <Button
                onClick={handleMove}
                disabled={!targetClassId || moveMutation.isPending}
                className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                {moveMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Moving...</>
                ) : (
                  "Move Student"
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
